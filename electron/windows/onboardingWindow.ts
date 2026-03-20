import { BrowserWindow, screen, app } from 'electron'
import path from 'path'

const isDev = !app.isPackaged

export function createOnboardingWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width: 640,
    height: 720,
    x: Math.floor((width - 640) / 2),
    y: Math.floor((height - 720) / 2),
    resizable: false,
    frame: true,
    transparent: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173/?page=onboarding')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { page: 'onboarding' },
    })
  }

  return win
}
