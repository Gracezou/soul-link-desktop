import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { IPC } from './ipc'
import { BridgeWorker } from './bridge/worker'
import { DEFAULT_BRIDGE_CONFIG } from './bridge/config'
import { createPetWindow } from './windows/petWindow'
import { createChatWindow } from './windows/chatWindow'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null   // chat window
let petWindow: BrowserWindow | null = null
let bridgeWorker: BridgeWorker | null = null

function createChatWindowInstance(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus()
    return mainWindow
  }

  const pet = petWindow!
  mainWindow = createChatWindow(pet)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

function setupIpcHandlers(): void {
  // Bridge
  ipcMain.handle(IPC.BRIDGE_SEND, async (_event, data: { message: string }) => {
    await bridgeWorker?.sendMessage(data.message)
  })

  ipcMain.handle(IPC.BRIDGE_SEND_COMMAND, async (_event, data: { command: string }) => {
    await bridgeWorker?.sendCommand(data.command)
  })

  ipcMain.handle(IPC.SETTINGS_GET, async () => {
    return DEFAULT_BRIDGE_CONFIG
  })

  // Pet window click-through toggle
  ipcMain.on(IPC.PET_MOUSE_ENTER, () => {
    petWindow?.setIgnoreMouseEvents(false)
  })

  ipcMain.on(IPC.PET_MOUSE_LEAVE, () => {
    petWindow?.setIgnoreMouseEvents(true, { forward: true })
  })

  // Open chat window from bubble
  ipcMain.on('chat:open', () => {
    createChatWindowInstance()
  })

  // Close window (for frameless windows)
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
    const dx = (data as { x: number; y: number }).x - dragStartScreenX
    const dy = (data as { x: number; y: number }).y - dragStartScreenY
    petWindow.setPosition(winStartX + dx, winStartY + dy)
  })

  ipcMain.on('pet:drag-end', () => {
    // Physics drop handled in renderer; window position already updated
  })
}

app.whenReady().then(async () => {
  // Create pet window first
  petWindow = createPetWindow()

  // Create chat window (initially visible in dev for testing)
  if (isDev) {
    mainWindow = createChatWindowInstance()
  }

  setupIpcHandlers()

  // Initialize bridge worker
  bridgeWorker = new BridgeWorker(DEFAULT_BRIDGE_CONFIG)
  bridgeWorker.setMainWindow(petWindow)

  // Don't auto-start bridge without a token configured
  // bridgeWorker.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      petWindow = createPetWindow()
    }
  })
})

app.on('window-all-closed', () => {
  bridgeWorker?.destroy()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
