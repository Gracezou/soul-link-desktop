import path from 'path'
import { app } from 'electron'

export function getResourcePath(...segments: string[]): string {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'res')
    : path.join(__dirname, '../../res')
  return segments.length ? path.join(base, ...segments) : base
}

export function getDataPath(...segments: string[]): string {
  const base = app.isPackaged
    ? app.getPath('userData')
    : path.join(__dirname, '../../data')
  return segments.length ? path.join(base, ...segments) : base
}

export function getDBPath(): string {
  // NOTE: packaged env places DB directly in userData root (not data/ subdir) to protect existing user databases
  return app.isPackaged
    ? path.join(app.getPath('userData'), 'soul-link.db')
    : path.join(__dirname, '../../data/soul-link.db')
}

export function getCardPath(cardName: string): string {
  return getResourcePath('cards', `${cardName}_card.json`)
}

export function getSpritePath(character: string): string {
  return getResourcePath('sprites', character)
}
