import { contextBridge, ipcRenderer } from 'electron'

// Preload script: exposes a minimal, open IPC API to the renderer.
// This API passes all channels through without an allowlist because the renderer
// is a trusted first-party UI loaded from the local filesystem.
//
// Expected channels used by this app:
//
// Push events (main → renderer, use .on()):
//   agent:ready          — { ready: boolean, character: string }
//   agent:waiting        — { messageId: string }
//   agent:delta          — { messageId: string, delta: string }
//   agent:final          — { messageId: string, text: string }
//   agent:error          — { messageId: string, error: string }
//   agent:message-saved  — { message: ChatMessage }
//   settings:changed     — SoulLinkSettings (full object)
//   companion:nudge      — { message: string }
//
// Invoke channels (renderer → main, use .invoke()):
//   settings:get         — returns SoulLinkSettings
//   settings:set         — (partial: Partial<SoulLinkSettings>) => void
//   agent:get-history    — returns ChatMessage[]
//   agent:test-connection — ({ baseUrl, apiKey, model }) => { success, error? }
//   agent:get-status     — returns { ready: boolean, character: string }
//   cards:list           — returns CardInfo[]
//   window:open-history  — opens history window
//   companion:status     — returns { running: boolean }
//
// Fire-and-forget (renderer → main, use .send()):
//   agent:send           — { message: string }
//   agent:reset          — resets current session
//   window:toggle-chat   — toggle chat window visibility
//   window:open-settings — open settings window
//   window:close         — close the current window
//   window:close-history — close history window
//   pet:mouse-enter      — disable click-through
//   pet:mouse-leave      — enable click-through
//   pet:move-window      — { deltaX, deltaY }
//   pet:save-position    — save current position to settings
//   pet:resize-window    — { width?, height }
//   pet:set-clickthrough — { enabled: boolean }
//   pet:set-focusable    — { focusable: boolean }
//   onboarding:complete  — mark onboarding done, launch main app
//   app:relaunch         — relaunch the app

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: string, data?: unknown) => {
    ipcRenderer.send(channel, data)
  },
  invoke: (channel: string, data?: unknown) => {
    return ipcRenderer.invoke(channel, data)
  },
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const wrapper = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, wrapper)
    return () => ipcRenderer.removeListener(channel, wrapper)
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },
  resBase: process.env.SOUL_LINK_RES_BASE ?? '',
})
