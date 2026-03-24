import { BrowserWindow, screen, app } from 'electron'
import path from 'path'

const isDev = !app.isPackaged

export function createPetWindow(savedX?: number, savedY?: number): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width: 200,
    height: 316,
    x: savedX ?? width - 220,
    y: savedY ?? height - 220,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    movable: true,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173/?page=pet')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { page: 'pet' },
    })
  }

  // Click-through transparent areas by default
  win.setIgnoreMouseEvents(true, { forward: true })

  return win
}
