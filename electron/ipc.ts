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
} as const
