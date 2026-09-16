import fs from 'fs'
import path from 'path'

import { SoulLinkAgent } from '../../electron/agent'
import { SessionStore } from '../../electron/agent/session-store'
import { initLogging, shutdownLogging } from '../../electron/logger'
import { getCPAConfig, missingCPAEnv } from './helpers'

type ConvRecord = {
  ts: string
  turn: {
    userMessage: string
    assistantMessage: string
    rawResponse: string
  }
  context: {
    historyLength: number
    tokenEstimate: number
  }
}

type OpsRecord = {
  level?: string
  msg?: string
}

const MODELS = ['MiniMax-M3', 'MiniMax-M2.5-highspeed'] as const
const BASELINE_TOKEN_ESTIMATE = 4445
const THINKING_TAG_RE = /<(?:think|thinking)\b/i
const missingEnv = missingCPAEnv()
const liveTestEnabled = process.env.CPA_SLOW_TESTS === '1' && missingEnv.length === 0
const liveTest = liveTestEnabled ? test : test.skip

function readJsonl<T>(logsDir: string, prefix: string): T[] {
  if (!fs.existsSync(logsDir)) return []

  return fs.readdirSync(logsDir)
    .filter((file) => file.startsWith(`${prefix}-`) && file.endsWith('.jsonl'))
    .flatMap((file) => fs.readFileSync(path.join(logsDir, file), 'utf8').split('\n'))
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

async function waitForConvRecords(logsDir: string, startedAt: string, expected: number): Promise<ConvRecord[]> {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const records = readJsonl<ConvRecord>(logsDir, 'conv')
      .filter((record) => record.ts >= startedAt)
    if (records.length >= expected) return records
    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  return readJsonl<ConvRecord>(logsDir, 'conv')
    .filter((record) => record.ts >= startedAt)
}

describe('thinking persistence acceptance (live gateway)', () => {
  if (process.env.CPA_SLOW_TESTS === '1' && missingEnv.length > 0) {
    console.warn(`Skipping thinking persistence acceptance — missing ${missingEnv.join(', ')}`)
  }

  liveTest('keeps thinking out of logs and the development database for supported MiniMax models', async () => {
    const repoRoot = path.resolve(__dirname, '../..')
    const dataDir = path.join(repoRoot, 'data')
    const logsDir = path.join(dataDir, 'logs')
    const dbPath = path.join(dataDir, 'soul-link.db')
    const resBase = path.join(repoRoot, 'res')
    const baseConfig = getCPAConfig()
    const startedAt = new Date().toISOString()
    const finalByModel: Record<string, string> = {}

    initLogging(dataDir)

    try {
      const m3Agent = new SoulLinkAgent({
        ...baseConfig,
        model: MODELS[0],
        cardName: 'baiyuan',
        resBase,
        dbPath,
        maxTotalTokens: 8000,
        systemPromptBudget: 2000,
        outputReserve: 500,
      })
      await m3Agent.initialize()
      await m3Agent.resetSession()

      for (let turn = 1; turn <= 6; turn += 1) {
        const prompt = '早上好 👋'
        let finalText = ''
        const cumulativeDeltas: string[] = []

        await m3Agent.sendMessage(prompt, {
          onDelta: (_messageId, text) => cumulativeDeltas.push(text),
          onFinal: (_messageId, text) => { finalText = text },
          onError: (_messageId, error) => { throw new Error(error) },
        })

        expect(finalText).toBeTruthy()
        expect(finalText).not.toMatch(THINKING_TAG_RE)
        if (cumulativeDeltas.length > 0) {
          expect(cumulativeDeltas.at(-1)).toBe(finalText)
          expect(cumulativeDeltas.every((text) => !THINKING_TAG_RE.test(text))).toBe(true)
        }
        finalByModel[MODELS[0]] = finalText
      }
      m3Agent.dispose()

      const m25Agent = new SoulLinkAgent({
        ...baseConfig,
        model: MODELS[1],
        cardName: 'baiyuan',
        resBase,
        dbPath,
        maxTotalTokens: 8000,
        systemPromptBudget: 2000,
        outputReserve: 500,
      })
      await m25Agent.initialize()
      await m25Agent.resetSession()

      await m25Agent.sendMessage('早上好 👋', {
        onDelta: () => {},
        onFinal: (_messageId, text) => { finalByModel[MODELS[1]] = text },
        onError: (_messageId, error) => { throw new Error(error) },
      })

      expect(finalByModel[MODELS[1]]).toBeTruthy()
      expect(finalByModel[MODELS[1]]).not.toMatch(THINKING_TAG_RE)
      m25Agent.dispose()
    } finally {
      shutdownLogging()
    }

    const convRecords = await waitForConvRecords(logsDir, startedAt, 7)
    expect(convRecords).toHaveLength(7)
    expect(convRecords.every((record) => !THINKING_TAG_RE.test(record.turn.assistantMessage))).toBe(true)

    const rawResponseContainsThinkingByModel = {
      [MODELS[0]]: convRecords
        .slice(0, 6)
        .map((record) => THINKING_TAG_RE.test(record.turn.rawResponse)),
      [MODELS[1]]: convRecords
        .slice(6)
        .map((record) => THINKING_TAG_RE.test(record.turn.rawResponse)),
    }

    const comparable = convRecords.find((record) => record.context.historyLength === 10)
    expect(comparable).toBeDefined()
    expect(Number.isFinite(comparable!.context.tokenEstimate)).toBe(true)
    expect(comparable!.context.tokenEstimate).toBeGreaterThan(0)

    const store = new SessionStore(dbPath)
    await store.initialize()
    const assistantRows = store.getDatabase().exec(
      "SELECT content FROM messages WHERE role = 'assistant' ORDER BY created_at ASC"
    )
    const assistantContents = (assistantRows[0]?.values ?? []).map(([content]) => String(content))
    store.close()

    expect(assistantContents.length).toBeGreaterThanOrEqual(7)
    expect(assistantContents.every((content) => !THINKING_TAG_RE.test(content))).toBe(true)

    const unsupportedWarnings = readJsonl<OpsRecord>(logsDir, 'ops')
      .filter((record) => record.level === 'warn')
      .filter((record) => record.msg === 'reasoning_split unsupported, retried without')
      .filter((record) => {
        const timestamp = (record as OpsRecord & { ts?: string }).ts
        return typeof timestamp === 'string' && timestamp >= startedAt
      })
    expect(unsupportedWarnings).toHaveLength(0)

    console.log(JSON.stringify({
      models: MODELS,
      assistantMessagesChecked: assistantContents.length,
      rawResponseContainsThinkingByModel,
      historyLength: comparable!.context.historyLength,
      tokenEstimate: comparable!.context.tokenEstimate,
      baselineTokenEstimate: BASELINE_TOKEN_ESTIMATE,
      tokenEstimateDeltaFromBaseline: comparable!.context.tokenEstimate - BASELINE_TOKEN_ESTIMATE,
      tokenEstimateBelowBaseline: comparable!.context.tokenEstimate < BASELINE_TOKEN_ESTIMATE,
      unsupportedWarningCount: unsupportedWarnings.length,
      finalLengthsByModel: Object.fromEntries(
        Object.entries(finalByModel).map(([model, text]) => [model, text.length])
      ),
    }, null, 2))
  }, 300000)
})
