import { BrowserWindow, screen, app } from 'electron'
import path from 'path'

const isDev = !app.isPackaged

export function createPetWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width: 200,
    height: 240,
    x: width - 220,
    y: height - 220,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173/pet.html')
  } else {
    win.loadFile(path.join(__dirname, '../dist/pet.html'))
  }

  // Click-through transparent areas by default
  win.setIgnoreMouseEvents(true, { forward: true })

  return win
}
