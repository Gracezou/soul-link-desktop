export interface TriggerCondition {
  type: 'idle' | 'time-of-day' | 'manual'
  idleMinutes?: number
  hour?: number
}

export function shouldTrigger(condition: TriggerCondition, lastActivityTime: number): boolean {
  const now = Date.now()

  switch (condition.type) {
    case 'idle': {
      const idleMs = (condition.idleMinutes ?? 30) * 60 * 1000
      return now - lastActivityTime >= idleMs
    }
    case 'time-of-day': {
      const currentHour = new Date().getHours()
      return currentHour === (condition.hour ?? 12)
    }
    case 'manual':
      return true
    default:
      return false
  }
}
