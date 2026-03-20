import { BrowserWindow } from 'electron'
import { OpenClawClient } from './client'
import type { BridgeConfig } from './config'
import type { BridgeMessage } from './types'
import { IPC } from '../ipc'

/**
 * Startup sequence (strictly sequential):
 * 1. client.connect() → wait for connect.challenge → handshake
 * 2. /rp list-assets --type card → check if defaultCard exists
 * 3. If not found: /rp import-card --url <cardImportUrl> → wait for ✅
 * 4. /rp start --card <cardName> → wait for success (no ❌)
 * 5. Mark session ready → allow user messages
 */
export class BridgeWorker {
  private client: OpenClawClient
  private config: BridgeConfig
  private mainWindow: BrowserWindow | null = null
  private sessionReady = false
  private currentCard = ''

  constructor(config: BridgeConfig) {
    this.config = config
    this.client = new OpenClawClient(config)

    this.client.on('connected', () => {
      this.sendToRenderer(IPC.BRIDGE_CONNECTED, undefined)
    })

    this.client.on('disconnected', () => {
      this.sessionReady = false
      this.sendToRenderer(IPC.BRIDGE_DISCONNECTED, undefined)
    })

    this.client.on('message', (msg: BridgeMessage) => {
      this.sendToRenderer(IPC.BRIDGE_MESSAGE, msg)
    })

    this.client.on('error', (err: { message: string }) => {
      this.sendToRenderer(IPC.BRIDGE_ERROR, err)
    })
  }

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win
  }

  async start(): Promise<void> {
    console.log('[Worker] Starting bridge worker...')
    this.client.connect()

    // Step 1: Wait for handshake
    await this.waitForConnected()
    console.log('[Worker] Handshake complete')

    // Step 2: List assets to check if card exists
    await this.setupSession()
  }

  private waitForConnected(): Promise<void> {
    return new Promise((resolve) => {
      // client.ts emits '_handshake' when it receives id="1" ok=true connect response
      // and also calls markConnected() at that point
      this.client.once('_handshake', () => {
        resolve()
      })
    })
  }

  private async setupSession(): Promise<void> {
    try {
      // Step 2: List cards
      console.log('[Worker] Checking for card:', this.config.defaultCard)
      this.client.sendMessage('/rp list-assets --type card')
      const listResponse = await this.client.waitForFinalResponse()

      const cardExists = listResponse.text
        .toLowerCase()
        .includes(this.config.defaultCard.toLowerCase())

      // Step 3: Import card if not found
      if (!cardExists && this.config.cardImportUrl) {
        console.log('[Worker] Card not found, importing from:', this.config.cardImportUrl)
        this.client.sendMessage(`/rp import-card --url ${this.config.cardImportUrl}`)
        const importResponse = await this.client.waitForFinalResponse(60000)
        if (!importResponse.text.includes('✅')) {
          console.warn('[Worker] Card import may have failed:', importResponse.text)
        }
      }

      // Step 4: Start RP session
      console.log('[Worker] Starting RP session with card:', this.config.defaultCard)
      this.client.sendMessage(`/rp start --card ${this.config.defaultCard}`)
      const startResponse = await this.client.waitForFinalResponse(30000)

      if (startResponse.text.includes('❌')) {
        throw new Error(`Failed to start RP session: ${startResponse.text}`)
      }

      // Step 5: Mark ready
      this.sessionReady = true
      this.currentCard = this.config.defaultCard
      console.log('[Worker] Session ready!')
      this.sendToRenderer(IPC.BRIDGE_SESSION_STATUS, {
        ready: true,
        card: this.currentCard,
      })
    } catch (err) {
      console.error('[Worker] Session setup failed:', err)
      this.sendToRenderer(IPC.BRIDGE_ERROR, {
        message: `Session setup failed: ${(err as Error).message}`,
      })
    }
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.sessionReady) {
      console.warn('[Worker] Session not ready, dropping message')
      return
    }
    this.client.sendMessage(message)
  }

  async sendCommand(command: string): Promise<void> {
    this.client.sendMessage(command)
  }

  destroy(): void {
    this.client.destroy()
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }
}
