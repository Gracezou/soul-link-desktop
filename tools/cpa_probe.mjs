#!/usr/bin/env node
/**
 * Probe an OpenAI-compatible gateway before running the integration suite.
 *
 * Separates "the gateway or the config is wrong" from "the tests are wrong".
 * When this passes, a failing `npm run test:integration` is a code problem.
 *
 * Usage
 *   CPA_BASE_URL=http://host:port/v1 CPA_API_KEY=sk-... CPA_MODEL=MiniMax-M2-her \
 *     node tools/cpa_probe.mjs
 *
 *   node tools/cpa_probe.mjs --base http://host:port/v1 --key sk-... --model M2-her
 *
 * Checks, in order:
 *   1. GET  /models              reachability, auth, and whether the model is served
 *   2. POST /chat/completions    non-streaming round trip and response shape
 *   3. POST /chat/completions    streaming: SSE frames, time to first delta
 *
 * Exit 0 when every check passes, 1 otherwise. No dependencies, Node 18+.
 * Never print the key. Never hardcode a host — a stale default is how a suite
 * ends up silently talking to the wrong server.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Load KEY=VALUE pairs from a .env file into process.env.
 *
 * Deliberately self-contained and shell-agnostic: `set -a; source .env.local`
 * is bash syntax and fails outright under fish, which is exactly the kind of
 * incidental breakage that should not stand between someone and a test run.
 * Existing environment variables always win, so an inline `FOO=bar node ...`
 * still overrides the file.
 */
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return false
  for (const rawLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (value.includes('<') && value.includes('>')) continue   // untouched placeholder
    if (!value) continue
    if (process.env[key] === undefined || process.env[key] === '') process.env[key] = value
  }
  return true
}

const args = process.argv.slice(2)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPathIndex = args.indexOf('--env')
const envPath = envPathIndex >= 0 ? resolve(args[envPathIndex + 1]) : resolve(repoRoot, '.env.local')
const envLoaded = loadEnvFile(envPath)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

const baseUrl = (flag('base') ?? process.env.CPA_BASE_URL ?? '').replace(/\/+$/, '')
const apiKey = flag('key') ?? process.env.CPA_API_KEY ?? ''
const model = flag('model') ?? process.env.CPA_MODEL ?? ''
const timeoutMs = Number(flag('timeout') ?? 30000)

const missing = [
  ['CPA_BASE_URL / --base', baseUrl],
  ['CPA_API_KEY / --key', apiKey],
  ['CPA_MODEL / --model', model],
].filter(([, v]) => !v).map(([n]) => n)

if (missing.length) {
  console.error(`missing: ${missing.join(', ')}`)
  console.error(envLoaded
    ? `\nRead ${envPath}, but those values are still empty or left as <placeholders>. Fill them in.`
    : `\nNo ${envPath} found.  cp .env.example .env.local  then fill it in.`)
  console.error('\nOr pass them inline:')
  console.error('  CPA_BASE_URL=http://<host>:<port>/v1 CPA_API_KEY=<key> CPA_MODEL=<model> node tools/cpa_probe.mjs')
  process.exit(1)
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${apiKey}`,
}

let failed = 0
let thinkingSeen = false

const THINK_TAG = /<think>|<\/think>|<thinking>|\[思考\]/i

function reportThinking(where, content, parsed) {
  const inline = typeof content === 'string' && THINK_TAG.test(content)
  const separate = parsed && (parsed.reasoning_content || parsed.choices?.[0]?.message?.reasoning_content ||
                              parsed.choices?.[0]?.delta?.reasoning_content)
  if (inline) {
    thinkingSeen = true
    console.log(`        !! ${where}: 思维链混在 content 里（<think> 标签）`)
  }
  if (separate) {
    thinkingSeen = true
    console.log(`        ~~ ${where}: 思维链在独立的 reasoning_content 字段里（content 干净）`)
  }
  return inline
}

const ok = (label, detail = '') => console.log(`  PASS  ${label}${detail ? '  ' + detail : ''}`)
const bad = (label, detail = '') => {
  failed += 1
  console.log(`  FAIL  ${label}${detail ? '  ' + detail : ''}`)
}

async function withTimeout(fn) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fn(ctrl.signal)
  } finally {
    clearTimeout(timer)
  }
}

function redact(text) {
  return apiKey ? text.split(apiKey).join('<key>') : text
}

console.log(`gateway  ${baseUrl}`)
console.log(`model    ${model}`)
console.log(`timeout  ${timeoutMs}ms`)
if (envLoaded) console.log(`env      ${envPath}`)
console.log()

// 1 — GET /models
console.log('1. GET /models')
let servedModels = null
try {
  const t0 = Date.now()
  const res = await withTimeout((signal) => fetch(`${baseUrl}/models`, { headers, signal }))
  const ms = Date.now() - t0
  const text = await res.text()
  if (!res.ok) {
    bad(`HTTP ${res.status}`, `${ms}ms  ${redact(text).slice(0, 200)}`)
    if (res.status === 401 || res.status === 403) console.log('        -> the key is rejected by the gateway')
    if (res.status === 404) console.log('        -> is the base URL missing or duplicating /v1 ?')
  } else {
    ok(`HTTP 200`, `${ms}ms`)
    try {
      const data = JSON.parse(text)
      servedModels = (data.data ?? []).map((m) => m.id).filter(Boolean)
      if (servedModels.length) {
        console.log(`        served: ${servedModels.join(', ')}`)
        if (servedModels.includes(model)) ok(`model "${model}" is served`)
        else bad(`model "${model}" is NOT in the served list`, '-> fix CPA_MODEL or configure it on the gateway')
      } else {
        console.log('        gateway returned an empty model list — cannot verify the model name')
      }
    } catch {
      console.log('        response is not JSON; skipping the model-name check')
    }
  }
} catch (err) {
  bad('request failed', String(err.message ?? err))
  console.log('        -> host unreachable, port closed, or blocked by a network policy')
}

// 2 — non-streaming completion
console.log('\n2. POST /chat/completions  (stream: false)')
try {
  const t0 = Date.now()
  const res = await withTimeout((signal) =>
    fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: '回复两个字：收到' }],
        stream: false,
        max_tokens: 32,
      }),
    })
  )
  const ms = Date.now() - t0
  const text = await res.text()
  if (!res.ok) {
    bad(`HTTP ${res.status}`, `${ms}ms  ${redact(text).slice(0, 300)}`)
  } else {
    const data = JSON.parse(text)
    const content = data?.choices?.[0]?.message?.content
    if (typeof content === 'string' && content.length) {
      ok('got content', `${ms}ms  ${JSON.stringify(content.slice(0, 40))}`)
      const usage = data.usage
      if (usage) console.log(`        usage: prompt ${usage.prompt_tokens}, completion ${usage.completion_tokens}`)
      reportThinking('非流式', content, data)
    } else {
      bad('response has no choices[0].message.content', JSON.stringify(data).slice(0, 300))
    }
  }
} catch (err) {
  bad('request failed', String(err.message ?? err))
}

// 3 — streaming completion
console.log('\n3. POST /chat/completions  (stream: true)')
try {
  const t0 = Date.now()
  const res = await withTimeout((signal) =>
    fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: '从 1 数到 10，用中文' }],
        stream: true,
        max_tokens: 128,
      }),
    })
  )
  if (!res.ok) {
    bad(`HTTP ${res.status}`, redact(await res.text()).slice(0, 300))
  } else if (!res.body) {
    bad('no response body to stream')
  } else {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let deltas = 0
    let firstDeltaMs = null
    let full = ''
    let sawDone = false
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') {
          sawDone = true
          continue
        }
        try {
          const chunk = JSON.parse(payload)
          const piece = chunk?.choices?.[0]?.delta?.content
          if (typeof piece === 'string' && piece.length) {
            if (firstDeltaMs === null) firstDeltaMs = Date.now() - t0
            deltas += 1
            full += piece
          }
        } catch {
          /* keep reading; a partial frame will be completed by the next chunk */
        }
      }
    }
    const totalMs = Date.now() - t0
    if (deltas > 0) {
      ok(`${deltas} delta(s)`, `first delta ${firstDeltaMs}ms, total ${totalMs}ms`)
      console.log(`        text: ${JSON.stringify(full.slice(0, 60))}`)
      reportThinking('流式', full, null)
      if (!sawDone) console.log('        note: stream ended without a [DONE] frame')
      if (deltas === 1) {
        console.log('        note: only one delta — the gateway may be buffering the whole reply,')
        console.log('              which makes the typewriter bubble jump instead of type')
      }
    } else {
      bad('no content deltas parsed from the SSE stream')
    }
  }
} catch (err) {
  bad('request failed', String(err.message ?? err))
}

// 4 — thinking mitigation
if (thinkingSeen) {
  console.log('\n4. 思维链缓解：重试并带上 reasoning_split: true')
  console.log('   （MiniMax M2.x 官方契约说 thinking 无法关闭；reasoning_split 只是把它')
  console.log('     从 content 里挪进独立字段——仍然计费、仍然占首字延迟）')
  try {
    const t0 = Date.now()
    const res = await withTimeout((signal) =>
      fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        signal,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: '回复两个字：收到' }],
          stream: false,
          max_tokens: 64,
          reasoning_split: true,
        }),
      })
    )
    const ms = Date.now() - t0
    const text = await res.text()
    if (!res.ok) {
      console.log(`  FAIL  HTTP ${res.status}  ${redact(text).slice(0, 200)}`)
      console.log('        -> 该参数不被接受，只能在客户端过滤 <think>')
    } else {
      const data = JSON.parse(text)
      const content = data?.choices?.[0]?.message?.content ?? ''
      const stillInline = THINK_TAG.test(content)
      console.log(`  ${stillInline ? 'FAIL' : 'PASS'}  content ${stillInline ? '仍含 <think>' : '已干净'}` +
                  `  ${ms}ms  ${JSON.stringify(content.slice(0, 40))}`)
      if (data?.choices?.[0]?.message?.reasoning_content) {
        console.log('        思维链已分离到 reasoning_content')
      }
      if (!stillInline) {
        console.log('        -> 建议在 llm-client.ts 的请求体里固定带上 reasoning_split: true')
      } else {
        console.log('        -> 仍需在客户端过滤 <think>（归入 E1 气泡重做）')
      }
    }
  } catch (err) {
    console.log(`  FAIL  request failed  ${String(err.message ?? err)}`)
  }
}

console.log()
if (thinkingSeen) {
  console.log('注意：该模型会产出思维链。接线前请确认 content 已干净，')
  console.log('      否则用户会在气泡里看到角色自言自语做分析。')
}
if (failed) {
  console.log(`FAILED — ${failed} check(s). Fix the gateway or the config before running the integration suite.`)
  process.exit(1)
}
console.log('All checks passed. Run:  npm run test:integration')
