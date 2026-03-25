import { BrowserWindow } from 'electron'
import { OpenClawClient } from './client'
import type { BridgeConfig } from './config'
import type { BridgeMessage } from './types'
import { IPC } from '../ipc'
import { createLogger } from '../logger'

const logger = createLogger('Worker')

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
  public onMessage: ((msg: BridgeMessage) => void) | null = null
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
      logger.log(`← AI [${msg.runId}] ${msg.text.length} chars: "${msg.text.slice(0, 60)}${msg.text.length > 60 ? '...' : ''}"`)
      if (this.onMessage) this.onMessage(msg)
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
    const t0 = Date.now()
    logger.log('Starting bridge worker...')
    this.client.connect()

    // Step 1: Wait for handshake
    await this.waitForConnected()
    logger.log(`Handshake complete (${Date.now() - t0}ms)`)

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
    const t0 = Date.now()
    try {
      // Step 2: List cards
      logger.log('Checking for card:', this.config.defaultCard)
      this.client.sendMessage('/rp list-assets --type card')
      const listResponse = await this.client.waitForFinalResponse()
      logger.log(`list-assets responded (${Date.now() - t0}ms)`)

      const cardExists = listResponse.text
        .toLowerCase()
        .includes(this.config.defaultCard.toLowerCase())

      // Step 3: Import card if not found
      if (!cardExists && this.config.cardImportUrl) {
        logger.log('Card not found, importing from:', this.config.cardImportUrl)
        const tImport = Date.now()
        this.client.sendMessage(`/rp import-card --url ${this.config.cardImportUrl}`)
        const importResponse = await this.client.waitForFinalResponse(60000)
        logger.log(`import-card responded (${Date.now() - tImport}ms):`, importResponse.text)
        if (importResponse.text.includes('✅')) {
          logger.log('Card imported successfully')
        } else if (importResponse.text.toLowerCase().includes('already exists')) {
          logger.log('Card already exists on server, skipping import')
        } else {
          throw new Error(`Card import failed: ${importResponse.text}`)
        }
      }

      // Step 4: Start RP session
      logger.log('Starting RP session with card:', this.config.defaultCard)
      const tStart = Date.now()
      this.client.sendMessage(`/rp start --card ${this.config.defaultCard}`)
      const startResponse = await this.client.waitForFinalResponse(30000)
      logger.log(`rp start responded (${Date.now() - tStart}ms)`)

      const isStartSuccess =
        startResponse.text.includes('✅') ||
        startResponse.text.includes('Active session already exists')

      if (!isStartSuccess) {
        throw new Error(`Failed to start RP session: ${startResponse.text}`)
      }

      // Step 5: Mark ready
      this.sessionReady = true
      this.currentCard = this.config.defaultCard
      logger.log(`Session ready! Total setup time: ${Date.now() - t0}ms`)
      this.sendToRenderer(IPC.BRIDGE_SESSION_STATUS, {
        ready: true,
        card: this.currentCard,
      })
    } catch (err) {
      logger.error('Session setup failed:', err)
      this.sendToRenderer(IPC.BRIDGE_ERROR, {
        message: `Session setup failed: ${(err as Error).message}`,
      })
    }
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.sessionReady) {
      logger.warn('Session not ready, dropping message:', message.slice(0, 60))
      return
    }
    logger.log(`→ user: "${message.slice(0, 80)}${message.length > 80 ? '...' : ''}"`)
    this.client.sendMessage(message)
  }

  async sendCommand(command: string): Promise<void> {
    this.client.sendMessage(command)
  }

  getStatus(): { ready: boolean; card: string } {
    return { ready: this.sessionReady, card: this.currentCard }
  }

  destroy(): void {
    this.client.destroy()
  }

  private sendToRenderer(channel: string, data: unknown): void {
    // Broadcast to all open windows so chat window also receives bridge events
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    })
  }
}
