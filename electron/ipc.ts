export const IPC = {
  // Bridge → Renderer
  BRIDGE_CONNECTED: 'bridge:connected',
  BRIDGE_DISCONNECTED: 'bridge:disconnected',
  BRIDGE_MESSAGE: 'bridge:message',
  BRIDGE_ERROR: 'bridge:error',
  BRIDGE_SESSION_STATUS: 'bridge:session',

  // Renderer → Bridge
  BRIDGE_SEND: 'bridge:send',
  BRIDGE_SEND_COMMAND: 'bridge:command',

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

  // Window management (from toolbar / renderer)
  WINDOW_TOGGLE_CHAT: 'window:toggle-chat',
  WINDOW_OPEN_SETTINGS: 'window:open-settings',

  // Bridge status query (renderer → main, returns current session state)
  BRIDGE_GET_SESSION: 'bridge:get-session',

  // Onboarding
  BRIDGE_TEST_CONNECTION: 'bridge:test-connection',
  ONBOARDING_COMPLETE: 'onboarding:complete',
  APP_RELAUNCH: 'app:relaunch',

  // Cards
  CARDS_LIST: 'cards:list',
  // Chat history window
  WINDOW_OPEN_HISTORY: 'window:open-history',
  CHAT_GET_HISTORY: 'chat:get-history',
  CHAT_ON_MESSAGE: 'chat:on-message',
  // Chat streaming (bubble feedback)
  CHAT_ACK: 'chat:ack',
  CHAT_DELTA: 'chat:delta',
  CHAT_FINAL: 'chat:final',
} as const
