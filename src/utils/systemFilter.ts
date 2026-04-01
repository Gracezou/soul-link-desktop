const SYSTEM_MESSAGE_PATTERNS = [
  /^📋/,
  /^✅\s*🎭/,
  /^❌/,
  /^🎭.*\(card\s+v[12]\)/,
  /^📜/,
  /rp\s+(import|list|show|delete|start|end|pause|resume|session|retry)/i,
  /Asset not found/,
  /Active session already exists/,
  /already exists in this channel/,
  /没有资产/,
  /资产列表/,
  /角色卡导入成功/,
  /session\s+(started|ended|paused|resumed)/i,
]

export function isSystemMessage(text: string): boolean {
  const trimmed = text.trim()
  return SYSTEM_MESSAGE_PATTERNS.some(pattern => pattern.test(trimmed))
}
