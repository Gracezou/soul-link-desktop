import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, protocol, net } from 'electron'

// Must be called before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'res', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

// Single instance lock — prevents duplicate windows on hot reload
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}
import path from 'path'
import fs from 'fs'
import WebSocket from 'ws'
import { IPC } from './ipc'
import { createLogger } from './logger'

const mainLogger = createLogger('Main')
import { BridgeWorker } from './bridge/worker'
import { DEFAULT_BRIDGE_CONFIG } from './bridge/config'
import { createPetWindow } from './windows/petWindow'
import { createChatWindow } from './windows/chatWindow'
import { createSettingsWindow } from './windows/settingsWindow'
import { createOnboardingWindow } from './windows/onboardingWindow'
import { getSettings, updateSettings } from './store/settings'
import { CompanionScheduler } from './companion/scheduler'

// Set once at startup; all resource consumers read this instead of branching on isDev
process.env.SOUL_LINK_RES_BASE = app.isPackaged
  ? path.join(process.resourcesPath, 'res')
  : path.join(__dirname, '../res')

let mainWindow: BrowserWindow | null = null   // chat window
let petWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let onboardingWindow: BrowserWindow | null = null
let bridgeWorker: BridgeWorker | null = null
let tray: Tray | null = null
let companion: CompanionScheduler | null = null

function createChatWindowInstance(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus()
    return mainWindow
  }

  mainWindow = createChatWindow(petWindow!)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

function createSettingsWindowInstance(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }
  settingsWindow = createSettingsWindow()
  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

function setupTray(): void {
  try {
    const iconPath = path.join(
      path.join(process.env.SOUL_LINK_RES_BASE!, 'icons/tray.png')
    )
    const icon = nativeImage.createFromPath(iconPath)
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
    tray.setToolTip('Soul Link Desktop')

    const menu = Menu.buildFromTemplate([
      { label: '显示宠物', click: () => petWindow?.show() },
      { label: '打开聊天', click: () => createChatWindowInstance() },
      { label: '设置', click: () => createSettingsWindowInstance() },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ])

    tray.setContextMenu(menu)
    tray.on('click', () => createChatWindowInstance())
  } catch {
    mainLogger.warn('Could not create tray icon (icon may not exist yet)')
  }
}

function setupIpcHandlers(): void {
  // Bridge
  ipcMain.handle(IPC.BRIDGE_SEND, async (_event, data: { message: string }) => {
    await bridgeWorker?.sendMessage(data.message)
  })

  ipcMain.handle(IPC.BRIDGE_SEND_COMMAND, async (_event, data: { command: string }) => {
    await bridgeWorker?.sendCommand(data.command)
  })

  // Settings
  ipcMain.handle(IPC.SETTINGS_GET, async () => {
    return getSettings()
  })

  ipcMain.handle(IPC.SETTINGS_SET, async (_event, partial: Record<string, unknown>) => {
    updateSettings(partial as Parameters<typeof updateSettings>[0])
    // Notify all windows of settings change
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.SETTINGS_ON_CHANGE, getSettings())
      }
    })
  })

  // Pet window click-through toggle
  ipcMain.on(IPC.PET_MOUSE_ENTER, () => {
    petWindow?.setIgnoreMouseEvents(false)
  })

  ipcMain.on(IPC.PET_MOUSE_LEAVE, () => {
    petWindow?.setIgnoreMouseEvents(true, { forward: true })
  })

  // Open windows
  ipcMain.on('chat:open', () => {
    createChatWindowInstance()
  })

  ipcMain.on('settings:open', () => {
    createSettingsWindowInstance()
  })

  ipcMain.on(IPC.WINDOW_TOGGLE_CHAT, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    } else {
      createChatWindowInstance()
    }
  })

  ipcMain.on(IPC.WINDOW_OPEN_SETTINGS, () => {
    createSettingsWindowInstance()
  })

  // Onboarding: test connection with full OpenClaw handshake validation
  ipcMain.handle(IPC.BRIDGE_TEST_CONNECTION, async (_event, data: { gatewayWsUrl: string; authToken: string }) => {
    const testLogger = createLogger('TestConn')
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      let resolved = false

      function done(result: { success: boolean; error?: string }): void {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        try { ws.terminate() } catch { /* ignore */ }
        resolve(result)
      }

      const timeout = setTimeout(() => {
        testLogger.warn('Connection test timed out after 15s')
        done({ success: false, error: '连接超时' })
      }, 15000)

      const origin = data.gatewayWsUrl
        .replace(/^ws:\/\//, 'http://')
        .replace(/^wss:\/\//, 'https://')
        .replace(/\/$/, '')

      const url = `${data.gatewayWsUrl}?token=${encodeURIComponent(data.authToken)}`
      testLogger.log('Opening test connection to:', data.gatewayWsUrl)
      const ws = new WebSocket(url, { headers: { origin } })

      ws.on('open', () => {
        testLogger.log('TCP connection established, waiting for challenge...')
      })

      ws.on('message', (raw: WebSocket.RawData) => {
        let msg: { type: string; event?: string; id?: string; ok?: boolean }
        try {
          msg = JSON.parse(raw.toString()) as { type: string; event?: string; id?: string; ok?: boolean }
        } catch {
          testLogger.warn('Failed to parse message during test:', raw.toString())
          return
        }

        // Step 2: Receive challenge → send connect request
        if (msg.type === 'event' && msg.event === 'connect.challenge') {
          testLogger.log('Received connect.challenge, sending connect request...')
          const req = JSON.stringify({
            type: 'req',
            id: '1',
            method: 'connect',
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              role: 'operator',
              scopes: ['operator.admin', 'operator.approvals', 'operator.pairing'],
              auth: { token: data.authToken },
              client: {
                id: 'openclaw-control-ui',
                version: 'dev',
                platform: process.platform,
                mode: 'webchat',
              },
              caps: [],
              locale: 'zh-CN',
            },
          })
          ws.send(req)
          return
        }

        // Step 4: Receive connect response
        if (msg.type === 'res' && msg.id === '1') {
          if (msg.ok) {
            testLogger.log('Handshake succeeded — token valid')
            done({ success: true })
          } else {
            testLogger.warn('Handshake rejected — token invalid or insufficient permissions')
            done({ success: false, error: 'token 无效或权限不足' })
          }
        }
      })

      ws.on('close', () => {
        testLogger.log('Connection closed before handshake completed')
        done({ success: false, error: '连接被服务器关闭' })
      })

      ws.on('error', (err: Error) => {
        testLogger.error('Connection test error:', err.message)
        done({ success: false, error: err.message })
      })
    })
  })

  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  // Pet drag — move the pet window
  let dragStartScreenX = 0
  let dragStartScreenY = 0
  let winStartX = 0
  let winStartY = 0

  ipcMain.on('pet:drag-start', (_event, data: { x: number; y: number }) => {
    const bounds = petWindow?.getBounds()
    if (!bounds) return
    dragStartScreenX = (data as { x: number; y: number }).x
    dragStartScreenY = (data as { x: number; y: number }).y
    winStartX = bounds.x
    winStartY = bounds.y
  })

  ipcMain.on('pet:drag-move', (_event, data: { x: number; y: number }) => {
    if (!petWindow) return
    const { x, y } = data as { x: number; y: number }
    const dx = x - dragStartScreenX
    const dy = y - dragStartScreenY
    petWindow.setPosition(winStartX + dx, winStartY + dy)
  })

  ipcMain.on('pet:drag-end', () => {
    // Window position already updated during drag
  })

  // Onboarding complete: close onboarding window, launch main app
  ipcMain.on(IPC.ONBOARDING_COMPLETE, () => {
    if (onboardingWindow && !onboardingWindow.isDestroyed()) {
      onboardingWindow.close()
    }
    launchMainApp()
  })

  // Relaunch app (used by "重新运行初始化引导" in settings)
  ipcMain.on(IPC.APP_RELAUNCH, () => {
    app.relaunch()
    app.quit()
  })

  // Companion
  ipcMain.handle(IPC.COMPANION_STATUS, async () => {
    return { running: companion?.isRunning ?? false }
  })

  // Bridge session status query — renderer calls this on mount to sync missed events
  ipcMain.handle(IPC.BRIDGE_GET_SESSION, () => {
    return bridgeWorker?.getStatus() ?? { ready: false, card: '' }
  })

  // Cards: scan res/cards/ and return card info list
  ipcMain.handle(IPC.CARDS_LIST, () => {
    const cardsDir = path.join(process.env.SOUL_LINK_RES_BASE!, 'cards')

    let files: string[]
    try {
      files = fs.readdirSync(cardsDir)
    } catch {
      return []
    }

    interface CardInfo { id: string; name: string; description: string; avatarDataUrl?: string }
    const cards: CardInfo[] = []

    const jsonFiles = files.filter(f => f.endsWith('.json'))
    const processedIds = new Set<string>()

    for (const file of jsonFiles) {
      const id = file.replace(/_card\.json$/, '').replace(/\.json$/, '')
      processedIds.add(id)
      try {
        const json = JSON.parse(fs.readFileSync(path.join(cardsDir, file), 'utf-8')) as Record<string, unknown>
        const data = (json.data ?? json) as Record<string, unknown>
        const name = String(data.name ?? id)
        const description = String(data.description ?? '').slice(0, 120)

        let avatarDataUrl: string | undefined
        const pngPath = path.join(cardsDir, `${id}.png`)
        if (fs.existsSync(pngPath)) {
          avatarDataUrl = `data:image/png;base64,${fs.readFileSync(pngPath).toString('base64')}`
        } else if (typeof data.avatar === 'string' && data.avatar.length > 50) {
          avatarDataUrl = data.avatar.startsWith('data:') ? data.avatar : `data:image/png;base64,${data.avatar}`
        }

        cards.push({ id, name, description, avatarDataUrl })
      } catch {
        // skip malformed file
      }
    }

    // Standalone PNG files not already covered by a JSON
    // SillyTavern PNG cards embed JSON in a tEXt chunk with keyword "chara" (base64-encoded)
    for (const file of files.filter(f => f.endsWith('.png'))) {
      const id = file.replace(/\.png$/, '')
      if (processedIds.has(id)) continue
      try {
        const buf = fs.readFileSync(path.join(cardsDir, file))
        const avatarDataUrl = `data:image/png;base64,${buf.toString('base64')}`

        // Try to extract embedded SillyTavern card metadata from PNG tEXt chunks
        let name = id
        let description = ''
        try {
          const meta = extractPngTextChunk(buf, 'chara')
          if (meta) {
            const json = JSON.parse(Buffer.from(meta, 'base64').toString('utf-8')) as Record<string, unknown>
            const data = (json.data ?? json) as Record<string, unknown>
            name = String(data.name ?? id)
            description = String(data.description ?? '').slice(0, 120)
          }
        } catch { /* not a SillyTavern card, use filename */ }

        cards.push({ id, name, description, avatarDataUrl })
      } catch (err) {
        mainLogger.warn(`Failed to read card PNG: ${file}`, err)
      }
    }

    mainLogger.log(`cards:list → cardsDir=${cardsDir}, found ${cards.length} card(s)`)
    return cards
  })
}

/**
 * Extract the value of a named tEXt chunk from a PNG buffer.
 * PNG tEXt chunk layout: length(4) + "tEXt"(4) + keyword + NUL + text + CRC(4)
 */
function extractPngTextChunk(buf: Buffer, keyword: string): string | null {
  let offset = 8 // skip PNG signature
  while (offset < buf.length - 12) {
    const length = buf.readUInt32BE(offset)
    const type = buf.toString('ascii', offset + 4, offset + 8)
    if (type === 'tEXt') {
      const chunkData = buf.slice(offset + 8, offset + 8 + length)
      const nullIdx = chunkData.indexOf(0)
      if (nullIdx !== -1) {
        const key = chunkData.slice(0, nullIdx).toString('ascii')
        if (key === keyword) {
          return chunkData.slice(nullIdx + 1).toString('latin1')
        }
      }
    }
    offset += 12 + length // length + type(4) + data + CRC(4)
  }
  return null
}

function launchMainApp(): void {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.focus()
    return
  }

  petWindow = createPetWindow()

  setupTray()

  const settings = getSettings()

  bridgeWorker = new BridgeWorker({
    ...DEFAULT_BRIDGE_CONFIG,
    ...settings.openclaw,
  })
  bridgeWorker.setMainWindow(petWindow)

  companion = new CompanionScheduler(settings.companion)
  companion.setWindow(petWindow)
  if (settings.companion.enabled) {
    companion.start()
  }

  if (settings.openclaw.authToken) {
    void bridgeWorker.start()
  }
}

app.whenReady().then(async () => {
  // Register res:// protocol — routes res://sprites/... and res://cards/... to SOUL_LINK_RES_BASE
  protocol.handle('res', (request) => {
    const url = new URL(request.url)
    // res://sprites/baiyuan/manifest.json → hostname=sprites, pathname=/baiyuan/manifest.json
    const filePath = path.join(process.env.SOUL_LINK_RES_BASE!, url.hostname, url.pathname)
    return net.fetch(`file://${filePath}`)
  })

  setupIpcHandlers()

  const settings = getSettings()

  if (!settings.onboarding.completed) {
    // First run: show onboarding only, no pet window
    onboardingWindow = createOnboardingWindow()
    onboardingWindow.on('closed', () => {
      onboardingWindow = null
    })
  } else {
    launchMainApp()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      launchMainApp()
    }
  })
})

app.on('window-all-closed', () => {
  companion?.stop()
  bridgeWorker?.destroy()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
