import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { IPC } from './ipc'
import { BridgeWorker } from './bridge/worker'
import { DEFAULT_BRIDGE_CONFIG } from './bridge/config'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let bridgeWorker: BridgeWorker | null = null

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  return win
}

function setupIpcHandlers(): void {
  ipcMain.handle(IPC.BRIDGE_SEND, async (_event, data: { message: string }) => {
    await bridgeWorker?.sendMessage(data.message)
  })

  ipcMain.handle(IPC.BRIDGE_SEND_COMMAND, async (_event, data: { command: string }) => {
    await bridgeWorker?.sendCommand(data.command)
  })

  ipcMain.handle(IPC.SETTINGS_GET, async () => {
    return DEFAULT_BRIDGE_CONFIG
  })
}

app.whenReady().then(async () => {
  mainWindow = createMainWindow()
  setupIpcHandlers()

  // Initialize bridge worker with default config (settings module will override later)
  bridgeWorker = new BridgeWorker(DEFAULT_BRIDGE_CONFIG)
  bridgeWorker.setMainWindow(mainWindow)

  // Don't auto-start bridge in dev without a token
  // bridgeWorker.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  bridgeWorker?.destroy()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
