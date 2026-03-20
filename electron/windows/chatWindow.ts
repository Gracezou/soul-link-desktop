import { BrowserWindow, app } from 'electron'
import path from 'path'

const isDev = !app.isPackaged

export function createChatWindow(petWindow: BrowserWindow): BrowserWindow {
  const petBounds = petWindow.getBounds()

  const win = new BrowserWindow({
    width: 380,
    height: 520,
    x: Math.max(0, petBounds.x - 390),
    y: Math.max(0, petBounds.y - 300),
    frame: false,
    resizable: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  return win
}
