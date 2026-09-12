const REQUIRED = ['CPA_BASE_URL', 'CPA_API_KEY', 'CPA_MODEL'] as const

export function getCPAConfig() {
  return {
    baseUrl: process.env.CPA_BASE_URL ?? '',
    apiKey: process.env.CPA_API_KEY ?? '',
    model: process.env.CPA_MODEL ?? '',
  }
}

export function missingCPAEnv(): string[] {
  return REQUIRED.filter((name) => !(process.env[name] ?? '').trim())
}

/**
 * Integration tests need a live gateway. All three variables are required:
 * there is deliberately no default base URL, because a stale default silently
 * points the whole suite at the wrong host instead of skipping.
 */
export function skipIfNoCPA(): boolean {
  const missing = missingCPAEnv()
  if (missing.length === 0) {
    return false
  }
  console.warn(
    `Skipping integration tests — missing ${missing.join(', ')}.\n` +
      '  CPA_BASE_URL=http://<host>:<port>/v1 \\\n' +
      '  CPA_API_KEY=<key> \\\n' +
      '  CPA_MODEL=<model> \\\n' +
      '  npm run test:integration\n' +
      '  Check the gateway first:  node tools/cpa_probe.mjs'
  )
  return true
}
