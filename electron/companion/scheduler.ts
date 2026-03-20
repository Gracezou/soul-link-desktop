import type { BrowserWindow } from 'electron'
import { IPC } from '../ipc'

type CompanionMode = 'balanced' | 'checkin' | 'question' | 'report'

interface CompanionConfig {
  enabled: boolean
  idleMinutes: number
  mode: CompanionMode
}

const NUDGE_MESSAGES: Record<CompanionMode, string[]> = {
  balanced: ['你好，我在想你', '最近有什么开心的事吗？', '要不要休息一下？'],
  checkin: ['今天过得怎么样？', '有没有好好吃饭？', '累了的话说一声'],
  question: ['你今天学了什么新东西？', '有没有什么想聊的？', '最近有什么烦恼吗？'],
  report: ['我刚才在想你', '时间过得真快', '又想和你说说话了'],
}

export class CompanionScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private config: CompanionConfig
  private mainWindow: BrowserWindow | null = null

  constructor(config: CompanionConfig) {
    this.config = config
  }

  setWindow(win: BrowserWindow): void {
    this.mainWindow = win
  }

  updateConfig(config: Partial<CompanionConfig>): void {
    this.config = { ...this.config, ...config }
    if (this.timer) {
      this.stop()
      if (this.config.enabled) this.start()
    }
  }

  start(): void {
    if (!this.config.enabled || this.timer) return

    const intervalMs = this.config.idleMinutes * 60 * 1000
    this.timer = setInterval(() => {
      this.triggerNudge()
    }, intervalMs)

    console.log(`[Companion] Scheduler started (every ${this.config.idleMinutes} min, mode: ${this.config.mode})`)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      console.log('[Companion] Scheduler stopped')
    }
  }

  private triggerNudge(): void {
    const messages = NUDGE_MESSAGES[this.config.mode]
    const message = messages[Math.floor(Math.random() * messages.length)]

    console.log('[Companion] Nudging with:', message)

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC.COMPANION_NUDGE, { message })
    }
  }

  get isRunning(): boolean {
    return this.timer !== null
  }
}
