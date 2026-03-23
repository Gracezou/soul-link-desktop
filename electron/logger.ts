import { app } from 'electron'

export interface Logger {
  log(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

export function createLogger(prefix: string): Logger {
  const tag = `[${prefix}]`
  function ts(): string { return new Date().toISOString() }
  return {
    log:   (msg, ...a) => { if (!app.isPackaged) console.log(`${ts()} ${tag} ${msg}`, ...a) },
    info:  (msg, ...a) => { if (!app.isPackaged) console.info(`${ts()} ${tag} ${msg}`, ...a) },
    warn:  (msg, ...a) => console.warn(`${ts()} ${tag} ${msg}`, ...a),
    error: (msg, ...a) => console.error(`${ts()} ${tag} ${msg}`, ...a),
  }
}
