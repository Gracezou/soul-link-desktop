export function getCPAConfig() {
  return {
    baseUrl: process.env.CPA_BASE_URL || 'http://188.239.18.173:8317/v1',
    apiKey: process.env.CPA_API_KEY || '',
    model: process.env.CPA_MODEL || 'MiniMax-M2',
  }
}

export function skipIfNoCPA(): boolean {
  if (!process.env.CPA_API_KEY) {
    console.warn('Skipping integration test: CPA_API_KEY not set')
    return true
  }
  return false
}
