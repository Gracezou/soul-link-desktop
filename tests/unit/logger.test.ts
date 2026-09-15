import fs from 'fs'
import os from 'os'
import path from 'path'

type LoggerModule = typeof import('../../electron/logger')

const POLL_TIMEOUT_MS = 2000
const POLL_INTERVAL_MS = 20

async function readJsonLinesEventually(
  filePath: string,
  expectedCount: number,
): Promise<Array<Record<string, unknown>>> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    try {
      const content = fs.readFileSync(filePath, 'utf8').trim()
      if (content) {
        const lines = content.split('\n').map((line) => JSON.parse(line) as Record<string, unknown>)
        if (lines.length >= expectedCount) return lines
      }
    } catch (err) {
      const isPendingWrite = err instanceof SyntaxError
        || (err as NodeJS.ErrnoException).code === 'ENOENT'
      if (!isPendingWrite) throw err
    }

    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  throw new Error(`Timed out waiting for ${expectedCount} JSONL line(s) in ${filePath}`)
}

describe('logger', () => {
  let tmpDir: string
  let loggerModule: LoggerModule
  let streams: fs.WriteStream[]
  let streamErrors: Error[]
  let createWriteStream: jest.SpyInstance

  beforeEach(() => {
    jest.resetModules()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soul-link-logger-'))
    streams = []
    streamErrors = []
    const originalCreateWriteStream = fs.createWriteStream
    createWriteStream = jest.spyOn(fs, 'createWriteStream').mockImplementation((...args) => {
      const stream = originalCreateWriteStream(...args)
      streams.push(stream)
      stream.on('error', (error) => streamErrors.push(error))
      return stream
    })
    loggerModule = require('../../electron/logger') as LoggerModule
  })

  afterEach(async () => {
    loggerModule.shutdownLogging()
    try {
      const deadline = Date.now() + POLL_TIMEOUT_MS
      while (streams.some((stream) => !stream.closed)) {
        if (Date.now() >= deadline) {
          throw new Error('Timed out waiting for logger streams to close; retaining temporary directory')
        }
        await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }
      fs.rmSync(tmpDir, { recursive: true, force: true })
      expect(streamErrors).toEqual([])
    } finally {
      createWriteStream.mockRestore()
    }
  })

  function logFile(prefix: 'ops' | 'api' | 'conv'): string {
    const today = new Date().toISOString().slice(0, 10)
    return path.join(tmpDir, 'logs', `${prefix}-${today}.jsonl`)
  }

  test('writes structured ops entries after initialization', async () => {
    loggerModule.initLogging(tmpDir)
    loggerModule.createLogger('X').info('hi', { a: 1 })
    loggerModule.shutdownLogging()

    const [entry] = await readJsonLinesEventually(logFile('ops'), 1)

    expect(entry).toMatchObject({
      level: 'info',
      prefix: 'X',
      msg: 'hi',
      data: { a: 1 },
    })
    expect(entry.ts).toEqual(expect.any(String))
  })

  test('writes API request entries after initialization', async () => {
    loggerModule.initLogging(tmpDir)
    loggerModule.createApiLogger().request({
      purpose: 'chat',
      model: 'test-model',
      messageCount: 2,
      tokenEstimate: 12,
    })
    loggerModule.shutdownLogging()

    const [entry] = await readJsonLinesEventually(logFile('api'), 1)

    expect(entry).toMatchObject({
      type: 'request',
      purpose: 'chat',
      model: 'test-model',
      messageCount: 2,
      tokenEstimate: 12,
    })
  })

  test('writes complete conversation turn entries after initialization', async () => {
    const turn = {
      sessionId: 'session-1',
      messageId: 'message-1',
      character: 'baiyuan',
      turn: {
        userMessage: 'hello',
        assistantMessage: 'hi',
        rawResponse: 'hi [emotion:happy]',
      },
      analysis: {
        oocDetected: false,
        oocPattern: null,
        oocRetryCount: 0,
        emotionTag: 'happy',
      },
      context: {
        historyLength: 4,
        tokenEstimate: 128,
        hasSummary: false,
        memoryCount: 1,
      },
      timing: {
        latencyMs: 321,
        deltaCount: 5,
      },
    }

    loggerModule.initLogging(tmpDir)
    loggerModule.createConvLogger().logTurn(turn)
    loggerModule.shutdownLogging()

    const [entry] = await readJsonLinesEventually(logFile('conv'), 1)

    expect(entry).toMatchObject(turn)
  })

  test.each([false, true])('silently skips all logger types without initialization (failed attempt: %s)', async (failInitialization) => {
    if (failInitialization) {
      const blockedPath = path.join(tmpDir, 'not-a-directory')
      fs.writeFileSync(blockedPath, 'blocks mkdir')
      expect(() => loggerModule.initLogging(blockedPath)).toThrow()
    }
    expect(() => {
      loggerModule.createLogger('X').info('hi')
      loggerModule.createApiLogger().request({
        purpose: 'test',
        model: 'test-model',
        messageCount: 1,
      })
      loggerModule.createConvLogger().logTurn({
        sessionId: 'session-1',
        messageId: 'message-1',
        character: 'baiyuan',
        turn: { userMessage: 'hello', assistantMessage: 'hi', rawResponse: 'hi' },
        analysis: { oocDetected: false, oocPattern: null, oocRetryCount: 0, emotionTag: null },
        context: { historyLength: 0, tokenEstimate: 1, hasSummary: false, memoryCount: 0 },
        timing: { latencyMs: 1, deltaCount: 1 },
      })
    }).not.toThrow()

    expect(fs.existsSync(path.join(tmpDir, 'logs'))).toBe(false)
    expect(createWriteStream).not.toHaveBeenCalled()
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(streamErrors).toEqual([])
  })

  // 保留期清理：ops/api 7 天、conv 30 天。SPEC-B1-LOGGING.md 的验收项 8/9 原本要求
  // 手工往日志目录塞文件再重启应用，这里把它变成自动化断言。
  test('applies retention windows on initialization', () => {
    const logsDir = path.join(tmpDir, 'logs')
    fs.mkdirSync(logsDir, { recursive: true })

    const stamp = (daysAgo: number): string => {
      const d = new Date()
      d.setDate(d.getDate() - daysAgo)
      return d.toISOString().slice(0, 10)
    }

    const files = {
      opsToday: `ops-${stamp(0)}.jsonl`,
      opsStale: `ops-${stamp(10)}.jsonl`,   // 超过 ops 的 7 天窗口
      apiStale: `api-${stamp(10)}.jsonl`,
      convMid: `conv-${stamp(10)}.jsonl`,   // 仍在 conv 的 30 天窗口内
      convStale: `conv-${stamp(40)}.jsonl`,
      unrelated: 'notes.txt',               // 非 .jsonl，不应被碰
    }
    for (const name of Object.values(files)) {
      fs.writeFileSync(path.join(logsDir, name), '{}\n')
    }

    loggerModule.initLogging(tmpDir)

    const exists = (name: string): boolean => fs.existsSync(path.join(logsDir, name))
    expect(exists(files.opsToday)).toBe(true)
    expect(exists(files.convMid)).toBe(true)
    expect(exists(files.unrelated)).toBe(true)
    expect(exists(files.opsStale)).toBe(false)
    expect(exists(files.apiStale)).toBe(false)
    expect(exists(files.convStale)).toBe(false)
  })

  test('can initialize and write again after shutdown', async () => {
    loggerModule.initLogging(tmpDir)
    loggerModule.createLogger('X').info('first')
    loggerModule.shutdownLogging()
    await readJsonLinesEventually(logFile('ops'), 1)

    loggerModule.initLogging(tmpDir)
    loggerModule.createLogger('X').info('second')
    loggerModule.shutdownLogging()

    const entries = await readJsonLinesEventually(logFile('ops'), 2)
    expect(entries.map((entry) => entry.msg)).toEqual(['first', 'second'])
  })
})
