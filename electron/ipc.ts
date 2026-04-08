export const IPC = {
  // Agent → Renderer (push events)
  AGENT_READY: 'agent:ready',
  AGENT_WAITING: 'agent:waiting',
  AGENT_DELTA: 'agent:delta',
  AGENT_FINAL: 'agent:final',
  AGENT_ERROR: 'agent:error',
  AGENT_MESSAGE_SAVED: 'agent:message-saved',

  // Renderer → Agent (invoke/send)
  AGENT_SEND: 'agent:send',
  AGENT_GET_HISTORY: 'agent:get-history',
  AGENT_RESET_SESSION: 'agent:reset',
  AGENT_TEST_CONNECTION: 'agent:test-connection',
  AGENT_GET_STATUS: 'agent:get-status',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_ON_CHANGE: 'settings:changed',

  // Pet window mouse events
  PET_MOUSE_ENTER: 'pet:mouse-enter',
  PET_MOUSE_LEAVE: 'pet:mouse-leave',

  // Companion
  COMPANION_NUDGE: 'companion:nudge',
  COMPANION_STATUS: 'companion:status',

  // Window management
  WINDOW_TOGGLE_CHAT: 'window:toggle-chat',
  WINDOW_OPEN_SETTINGS: 'window:open-settings',
  WINDOW_OPEN_HISTORY: 'window:open-history',

  // Onboarding
  ONBOARDING_COMPLETE: 'onboarding:complete',
  APP_RELAUNCH: 'app:relaunch',

  // Cards
  CARDS_LIST: 'cards:list',
} as const
