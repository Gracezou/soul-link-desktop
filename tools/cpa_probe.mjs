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

const args = process.argv.slice(2)
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
  console.error('\nCPA_BASE_URL=http://<host>:<port>/v1 CPA_API_KEY=<key> CPA_MODEL=<model> node tools/cpa_probe.mjs')
  process.exit(1)
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${apiKey}`,
}

let failed = 0

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
      if (!sawDone) console.log('        note: stream ended without a [DONE] frame')
      if (deltas === 1) console.log('        note: only one delta — the gateway may be buffering the whole reply,')
      console.log('              which makes the typewriter bubble jump instead of type')
    } else {
      bad('no content deltas parsed from the SSE stream')
    }
  }
} catch (err) {
  bad('request failed', String(err.message ?? err))
}

console.log()
if (failed) {
  console.log(`FAILED — ${failed} check(s). Fix the gateway or the config before running the integration suite.`)
  process.exit(1)
}
console.log('All checks passed. Run:  npm run test:integration')
