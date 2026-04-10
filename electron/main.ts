import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, protocol, net, session } from 'electron'
import { pathToFileURL } from 'node:url'

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
import { IPC } from './ipc'
import { createLogger } from './logger'

const mainLogger = createLogger('Main')
import { SoulLinkAgent } from './agent'
import { createPetWindow } from './windows/petWindow'
import { createChatWindow } from './windows/chatWindow'
import { createSettingsWindow } from './windows/settingsWindow'
import { createOnboardingWindow } from './windows/onboardingWindow'
import { getSettings, updateSettings } from './store/settings'
import { CompanionScheduler } from './companion/scheduler'
import { getResourcePath, getDBPath } from './utils/paths'
import { needsOnboarding } from './utils/onboardingGuard'

// Set once at startup; all resource consumers read this instead of branching on isDev
process.env.SOUL_LINK_RES_BASE = app.isPackaged
  ? path.join(process.resourcesPath, 'res')
  : path.join(__dirname, '../res')

let historyWindow: BrowserWindow | null = null
let mainWindow: BrowserWindow | null = null   // chat window
let petWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let onboardingWindow: BrowserWindow | null = null
let agent: SoulLinkAgent | null = null
let agentReady = false
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
    const iconPath = getResourcePath('icons', 'tray.png')
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
  // Agent
  ipcMain.on(IPC.AGENT_SEND, (_event, data: { message: string }) => {
    if (!agent) {
      petWindow?.webContents.send(IPC.AGENT_ERROR, { messageId: '', error: 'Agent not initialized' })
      return
    }
    void agent.sendMessage(data.message, {
      onWaiting: (msgId) => {
        petWindow?.webContents.send(IPC.AGENT_WAITING, { messageId: msgId })
      },
      onDelta: (msgId, delta) => {
        petWindow?.webContents.send(IPC.AGENT_DELTA, { messageId: msgId, delta })
      },
      onFinal: (msgId, text) => {
        petWindow?.webContents.send(IPC.AGENT_FINAL, { messageId: msgId, text })
      },
      onError: (msgId, error) => {
        petWindow?.webContents.send(IPC.AGENT_ERROR, { messageId: msgId, error })
      },
      onSaved: (msg) => {
        if (historyWindow && !historyWindow.isDestroyed()) {
          historyWindow.webContents.send(IPC.AGENT_MESSAGE_SAVED, { message: msg })
        }
      },
    })
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

  ipcMain.handle(IPC.AGENT_GET_HISTORY, async () => {
    if (!agent) return []
    return agent.getHistory()
  })

  ipcMain.handle(IPC.AGENT_TEST_CONNECTION, async (_event, data: { baseUrl: string; apiKey: string; model: string }) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const baseUrl = data.baseUrl.replace(/\/+$/, '')
      const response = await globalThis.fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.apiKey}` },
        body: JSON.stringify({ model: data.model, messages: [{ role: 'user', content: 'ping' }], stream: false }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    } finally {
      clearTimeout(timeout)
    }
  })

  ipcMain.handle(IPC.AGENT_GET_STATUS, () => {
    return { ready: agentReady, character: getSettings().character.cardName }
  })

  ipcMain.on(IPC.AGENT_RESET_SESSION, async () => {
    if (!agent) return
    await agent.resetSession()
    petWindow?.webContents.send(IPC.AGENT_READY, { ready: true, character: getSettings().character.cardName })
  })

  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.on('window:close-history', () => {
    if (historyWindow && !historyWindow.isDestroyed()) historyWindow.close()
  })

  // Pet window drag (delta-based)
  ipcMain.on('pet:move-window', (_event, data: { deltaX: number; deltaY: number }) => {
    if (!petWindow || petWindow.isDestroyed()) return
    const [x, y] = petWindow.getPosition()
    petWindow.setPosition(x + data.deltaX, y + data.deltaY)
  })

  let savePositionTimeout: ReturnType<typeof setTimeout> | null = null
  ipcMain.on('pet:save-position', () => {
    if (!petWindow || petWindow.isDestroyed()) return
    if (savePositionTimeout) clearTimeout(savePositionTimeout)
    savePositionTimeout = setTimeout(() => {
      if (!petWindow || petWindow.isDestroyed()) return
      const [x, y] = petWindow.getPosition()
      const currentPet = getSettings().pet
      updateSettings({ pet: { ...currentPet, positionX: x, positionY: y } })
    }, 500)
  })

  ipcMain.on('pet:resize-window', (_event, data: { width?: number; height: number }) => {
    if (!petWindow || petWindow.isDestroyed()) return
    const [currentWidth] = petWindow.getSize()
    petWindow.setSize(data.width ?? currentWidth, data.height, true)
  })

  ipcMain.on('pet:set-clickthrough', (_event, data: { enabled: boolean }) => {
    if (!petWindow || petWindow.isDestroyed()) return
    petWindow.setIgnoreMouseEvents(data.enabled, { forward: data.enabled })
  })

  ipcMain.on('pet:set-focusable', (_event, data: { focusable: boolean }) => {
    if (!petWindow || petWindow.isDestroyed()) return
    petWindow.setFocusable(data.focusable)
    if (data.focusable) {
      setTimeout(() => {
        if (!petWindow || petWindow.isDestroyed()) return
        petWindow.focus()
      }, 50)
    }
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
  ipcMain.handle(IPC.APP_GET_VERSION, () => app.getVersion())

  // Companion
  ipcMain.handle(IPC.COMPANION_STATUS, async () => {
    return { running: companion?.isRunning ?? false }
  })

  // Cards: scan res/cards/ and return card info list
  ipcMain.handle(IPC.CARDS_LIST, () => {
    const cardsDir = getResourcePath('cards')

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

  // Open or focus the history window
  ipcMain.handle(IPC.WINDOW_OPEN_HISTORY, () => {
    if (historyWindow && !historyWindow.isDestroyed()) {
      historyWindow.focus()
      return
    }
    historyWindow = new BrowserWindow({
      width: 400,
      height: 600,
      minWidth: 350,
      minHeight: 400,
      frame: false,
      transparent: false,
      resizable: true,
      focusable: true,
      movable: true,
      closable: true,
      webPreferences: {
        preload: path.join(__dirname, '../preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    })
    if (!app.isPackaged) {
      void historyWindow.loadURL('http://localhost:5173/?page=history')
    } else {
      void historyWindow.loadFile(path.join(__dirname, '../dist/index.html'), { query: { page: 'history' } })
    }
    historyWindow.on('closed', () => {
      historyWindow = null
    })
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

  const savedPet = getSettings().pet
  const savedX = savedPet.positionX >= 0 ? savedPet.positionX : undefined
  const savedY = savedPet.positionY >= 0 ? savedPet.positionY : undefined
  petWindow = createPetWindow(savedX, savedY)

  // Persist window position after each move (debounced)
  let savePositionTimer: ReturnType<typeof setTimeout> | null = null
  petWindow.on('moved', () => {
    if (savePositionTimer) clearTimeout(savePositionTimer)
    savePositionTimer = setTimeout(() => {
      if (!petWindow || petWindow.isDestroyed()) return
      const [x, y] = petWindow.getPosition()
      const currentPet = getSettings().pet
      updateSettings({ pet: { ...currentPet, positionX: x, positionY: y } })
      mainLogger.log(`Pet position saved: (${x}, ${y})`)
    }, 500)
  })

  setupTray()

  const settings = getSettings()
  const dbPath = getDBPath()
  agent = new SoulLinkAgent({
    baseUrl: settings.cpa.baseUrl,
    apiKey: settings.cpa.apiKey,
    model: settings.cpa.model,
    cardName: settings.character.cardName,
    dbPath,
    resBase: process.env.SOUL_LINK_RES_BASE!,
    maxTotalTokens: 8000,
    systemPromptBudget: 2000,
    outputReserve: 500,
  })
  agent.initialize().then(() => {
    agentReady = true
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send(IPC.AGENT_READY, { ready: true, character: settings.character.cardName })
    }
  }).catch((err: Error) => {
    mainLogger.error('Agent initialization failed:', err.message)
  })

  companion = new CompanionScheduler(settings.companion)
  companion.setWindow(petWindow)
  // TODO: wire companion nudge to agent once scheduler supports onNudge callback.
  if (settings.companion.enabled) {
    companion.start()
  }
}

app.whenReady().then(async () => {
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const filtered = Object.fromEntries(
        Object.entries(details.responseHeaders ?? {})
          .filter(([k]) => k.toLowerCase() !== 'content-security-policy')
      )
      callback({
        responseHeaders: {
          ...filtered,
          'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: file: res:",
            "connect-src 'self' http: https:",
          ].join('; '),
        },
      })
    })
  }

  // Register res:// protocol — routes res://sprites/... and res://cards/... to SOUL_LINK_RES_BASE
  protocol.handle('res', (request) => {
    const url = new URL(request.url)
    // res://sprites/baiyuan/manifest.json → hostname=sprites, pathname=/baiyuan/manifest.json
    const filePath = getResourcePath(url.hostname, url.pathname)
    return net.fetch(pathToFileURL(filePath).toString())
  })

  setupIpcHandlers()

  const settings = getSettings()

  if (needsOnboarding(settings)) {
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
  agent?.dispose()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
