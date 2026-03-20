import path from 'path'
import { app } from 'electron'

export function getResourcesPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'res')
    : path.join(__dirname, '../../res')
}

export function getDataPath(): string {
  return app.isPackaged
    ? path.join(app.getPath('userData'), 'data')
    : path.join(__dirname, '../../data')
}

export function getSpritesPath(character: string): string {
  return path.join(getResourcesPath(), 'sprites', character)
}
