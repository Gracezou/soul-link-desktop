// Loads .env.local into process.env before the integration suite runs, so the
// tests do not depend on shell-specific syntax for exporting variables.
const { existsSync, readFileSync } = require('node:fs')
const { resolve } = require('node:path')

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

loadEnvFile(resolve(__dirname, '..', '.env.local'))
