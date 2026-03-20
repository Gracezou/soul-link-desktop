import { BrowserWindow, app } from 'electron'
import path from 'path'

const isDev = !app.isPackaged

export function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 600,
    height: 500,
    title: 'Soul Link 设置',
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173/?page=settings')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { page: 'settings' },
    })
  }

  return win
}
