import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { IPC } from './ipc'
import { BridgeWorker } from './bridge/worker'
import { DEFAULT_BRIDGE_CONFIG } from './bridge/config'
import { createPetWindow } from './windows/petWindow'
import { createChatWindow } from './windows/chatWindow'
import { createSettingsWindow } from './windows/settingsWindow'
import { getSettings, updateSettings } from './store/settings'
import { CompanionScheduler } from './companion/scheduler'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null   // chat window
let petWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
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
      isDev ? path.join(__dirname, '../../res/icons/tray.png') : path.join(process.resourcesPath, 'res/icons/tray.png')
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
    console.warn('[Tray] Could not create tray icon (icon may not exist yet)')
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

  // Companion
  ipcMain.handle(IPC.COMPANION_STATUS, async () => {
    return { running: companion?.isRunning ?? false }
  })
}

app.whenReady().then(async () => {
  // Create pet window first
  petWindow = createPetWindow()

  // Create chat window in dev for testing
  if (isDev) {
    mainWindow = createChatWindowInstance()
  }

  setupIpcHandlers()
  setupTray()

  // Load persisted settings
  const settings = getSettings()

  // Initialize bridge worker with saved config
  bridgeWorker = new BridgeWorker({
    ...DEFAULT_BRIDGE_CONFIG,
    ...settings.openclaw,
  })
  bridgeWorker.setMainWindow(petWindow)

  // Initialize companion scheduler
  companion = new CompanionScheduler(settings.companion)
  companion.setWindow(petWindow)
  if (settings.companion.enabled) {
    companion.start()
  }

  // Don't auto-start bridge without a token configured
  if (settings.openclaw.authToken) {
    void bridgeWorker.start()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      petWindow = createPetWindow()
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
