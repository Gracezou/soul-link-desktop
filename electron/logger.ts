import fs from 'fs'
import path from 'path'
import { app } from 'electron'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface Logger {
  log(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

export interface ApiLogger {
  request(data: { purpose: 'chat' | 'completion' | 'memory_extraction' | 'compression' | 'test'; model: string; messageCount: number; tokenEstimate?: number }): void
  response(data: { purpose: string; latencyMs: number; status: number; responseLength?: number; error?: string }): void
  streaming(data: { deltaCount: number; totalLength: number; latencyMs: number }): void
  oocRetry(data: { attempt: number; detected: boolean }): void
}

export interface ConvTurn {
  sessionId: string
  messageId: string
  character: string
  turn: { userMessage: string; assistantMessage: string; rawResponse: string }
  analysis: { oocDetected: boolean; oocPattern: string | null; oocRetryCount: number; emotionTag: string | null }
  context: { historyLength: number; tokenEstimate: number; hasSummary: boolean; memoryCount: number }
  timing: { latencyMs: number; deltaCount: number }
}

export interface ConvLogger {
  logTurn(turn: ConvTurn): void
}

// ---------------------------------------------------------------------------
// FileWriter — manages a single rotating JSONL log file
// ---------------------------------------------------------------------------

class FileWriter {
  private stream: fs.WriteStream | null = null
  private currentDate = ''
  private readonly prefix: string
  private readonly dir: string

  constructor(prefix: string, dir: string) {
    this.prefix = prefix
    this.dir = dir
  }

  write(data: Record<string, unknown>): void {
    const today = todayString()
    if (today !== this.currentDate) {
      this.closeStream()
      this.currentDate = today
      const filePath = path.join(this.dir, `${this.prefix}-${today}.jsonl`)
      this.stream = fs.createWriteStream(filePath, { flags: 'a' })
    }
    const line = JSON.stringify({ ts: new Date().toISOString(), ...data }) + '\n'
    this.stream!.write(line)
  }

  close(): void {
    this.closeStream()
  }

  private closeStream(): void {
    if (this.stream) {
      this.stream.end()
      this.stream = null
    }
  }
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let logsDir: string | null = null
let opsWriter: FileWriter | null = null
let apiWriter: FileWriter | null = null
let convWriter: FileWriter | null = null

function getOpsWriter(): FileWriter | null {
  if (!logsDir) return null
  if (!opsWriter) opsWriter = new FileWriter('ops', logsDir)
  return opsWriter
}

function getApiWriter(): FileWriter | null {
  if (!logsDir) return null
  if (!apiWriter) apiWriter = new FileWriter('api', logsDir)
  return apiWriter
}

function getConvWriter(): FileWriter | null {
  if (!logsDir) return null
  if (!convWriter) convWriter = new FileWriter('conv', logsDir)
  return convWriter
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayString(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

function cleanupOldLogs(dir: string): void {
  let files: string[]
  try {
    files = fs.readdirSync(dir)
  } catch {
    return
  }

  const opsApiCutoff = daysAgo(7)
  const convCutoff = daysAgo(30)

  for (const file of files) {
    if (!file.endsWith('.jsonl')) continue
    const dateMatch = file.match(/\d{4}-\d{2}-\d{2}/)
    if (!dateMatch) continue
    const fileDate = new Date(dateMatch[0] + 'T00:00:00')
    if (isNaN(fileDate.getTime())) continue

    const isConv = file.startsWith('conv-')
    const cutoff = isConv ? convCutoff : opsApiCutoff

    if (fileDate < cutoff) {
      try { fs.unlinkSync(path.join(dir, file)) } catch { /* ignore */ }
    }
  }
}

function extractData(args: unknown[]): Record<string, unknown> | undefined {
  if (args.length === 0) return undefined
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
    return args[0] as Record<string, unknown>
  }
  return { args }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initLogging(userDataPath: string): void {
  const candidateLogsDir = path.join(userDataPath, 'logs')
  fs.mkdirSync(candidateLogsDir, { recursive: true })
  cleanupOldLogs(candidateLogsDir)
  logsDir = candidateLogsDir
}

export function shutdownLogging(): void {
  opsWriter?.close()
  apiWriter?.close()
  convWriter?.close()
  opsWriter = null
  apiWriter = null
  convWriter = null
}

export function createLogger(prefix: string): Logger {
  const tag = `[${prefix}]`
  function ts(): string { return new Date().toISOString() }

  function writeOps(level: string, msg: string, args: unknown[]): void {
    const writer = getOpsWriter()
    if (!writer) return
    const entry: Record<string, unknown> = { level, prefix, msg }
    const data = extractData(args)
    if (data) entry.data = data
    writer.write(entry)
  }

  return {
    log: (msg, ...a) => {
      if (!app.isPackaged) console.log(`${ts()} ${tag} ${msg}`, ...a)
      writeOps('info', msg, a)
    },
    info: (msg, ...a) => {
      if (!app.isPackaged) console.info(`${ts()} ${tag} ${msg}`, ...a)
      writeOps('info', msg, a)
    },
    warn: (msg, ...a) => {
      console.warn(`${ts()} ${tag} ${msg}`, ...a)
      writeOps('warn', msg, a)
    },
    error: (msg, ...a) => {
      console.error(`${ts()} ${tag} ${msg}`, ...a)
      writeOps('error', msg, a)
    },
  }
}

export function createApiLogger(): ApiLogger {
  return {
    request(data) {
      getApiWriter()?.write({ type: 'request', ...data })
    },
    response(data) {
      getApiWriter()?.write({ type: 'response', ...data })
    },
    streaming(data) {
      getApiWriter()?.write({ type: 'streaming', ...data })
    },
    oocRetry(data) {
      getApiWriter()?.write({ type: 'oocRetry', ...data })
    },
  }
}

export function createConvLogger(): ConvLogger {
  return {
    logTurn(turn) {
      getConvWriter()?.write(turn as unknown as Record<string, unknown>)
    },
  }
}
