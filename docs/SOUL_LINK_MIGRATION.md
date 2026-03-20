# Soul Link Desktop — Migration & Architecture Document

> **Target Audience**: Claude Code (automated code generation)
> **Date**: 2026-03-20
> **Task**: Migrate from DyberPet (Python/Qt) to soul-link-desktop (Electron/React/TypeScript)

---

## 0. Workspace Layout

Claude Code has access to a parent directory containing two sibling project folders:

```
<workspace_root>/
├── DyberPet/                    # SOURCE — existing Python/Qt project (read from, do not modify)
└── soul-link-desktop/           # TARGET — new Electron project (create and write here)
```

**CRITICAL RULES**:
- **DyberPet/** is READ-ONLY. Copy/reference files from it but NEVER modify it.
- **soul-link-desktop/** is the ONLY directory where you create, modify, and delete files.
- All file paths in this document are relative to `<workspace_root>/`.

---

## 1. Project Overview

### 1.1 What We're Building

**Soul Link Desktop** — An AI-powered desktop companion app for otome game fans. Users bind a character persona (e.g., "柏源" from《世界之外》) to a desktop pet for long-term romantic interaction. The AI backend is powered by OpenClaw + rp-plugin.

### 1.2 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Electron (Node.js) |
| Frontend | React 18+ / TypeScript 5+ |
| State Management | Zustand |
| Build Tool | Vite (for renderer) |
| Animation | Canvas 2D (sprite sheet frame animation) |
| Communication | WebSocket JSON-RPC 2.0 (to OpenClaw Gateway) |
| Packaging | electron-builder (Windows + macOS) |
| Styling | CSS Modules or Tailwind CSS |

### 1.3 What We're Migrating from DyberPet

Only two things are migrated from the old project. Everything else is written fresh.

| Component | Source (DyberPet) | Target (soul-link-desktop) | Migration Type |
|-----------|-------------------|---------------------------|----------------|
| OpenClaw Bridge | `DyberPet/DyberPet/openclaw_bridge/` | `soul-link-desktop/electron/bridge/` | Rewrite Python → TypeScript (same logic, new language) |
| Animation Data | `DyberPet/res/role/*/act_conf.json` + frame images | `soul-link-desktop/res/sprites/*/` | Convert format + copy assets |

**NOT migrated** (written from scratch):
- PetWidget → Rewrite as Canvas 2D renderer (`src/pet/`)
- Chat UI → New React components (`src/chat/`)
- Settings → New React + electron-store (`src/settings/`, `electron/store/`)
- Physics → Rewrite in TypeScript (`src/pet/PhysicsEngine.ts`)
- All UI components

---

## 2. Target Directory Structure

```
soul-link-desktop/
├── CLAUDE.md                          # Claude Code project guidance
├── README.md
├── package.json
├── electron-builder.yml               # Packaging config (Windows + macOS)
├── tsconfig.json
├── tsconfig.node.json                 # For electron/ main process
├── vite.config.ts                     # Vite config for renderer
├── .gitignore
│
├── electron/                          # ─── MAIN PROCESS ───
│   ├── main.ts                        # Electron entry: create windows, setup IPC
│   ├── preload.ts                     # Context bridge for renderer ↔ main IPC
│   │
│   ├── windows/                       # Window management
│   │   ├── petWindow.ts               # Pet window: transparent, frameless, always-on-top, click-through
│   │   ├── chatWindow.ts              # Chat window: popup from bubble click
│   │   └── settingsWindow.ts          # Settings window
│   │
│   ├── bridge/                        # OpenClaw communication (MIGRATED from Python)
│   │   ├── client.ts                  # WebSocket JSON-RPC 2.0 client
│   │   ├── worker.ts                  # Message coordinator, session lifecycle
│   │   ├── config.ts                  # Connection config types + defaults
│   │   └── types.ts                   # Gateway protocol type definitions
│   │
│   ├── card/                          # Character card management
│   │   ├── manager.ts                 # Detect / import / switch cards on startup
│   │   └── schema.ts                  # SillyTavern V2 card TypeScript types
│   │
│   ├── companion/                     # Proactive interaction system (idle triggers)
│   │   ├── scheduler.ts               # Timer-based trigger (configurable on/off)
│   │   └── triggers.ts                # Trigger conditions (idle time, time-of-day, etc.)
│   │
│   ├── store/                         # Persistent settings
│   │   └── settings.ts                # electron-store wrapper, read/write settings.json
│   │
│   ├── ipc.ts                         # IPC channel name constants + type-safe handlers
│   │
│   └── utils/
│       └── paths.ts                   # Cross-platform path resolution
│
├── src/                               # ─── RENDERER PROCESS (React) ───
│   ├── main.tsx                       # React entry
│   ├── App.tsx                        # Root component + router
│   │
│   ├── pet/                           # Desktop pet rendering (Canvas 2D)
│   │   ├── PetCanvas.tsx              # Main canvas component: renders sprite frames
│   │   ├── AnimationEngine.ts         # Animation state machine (probability-based selection)
│   │   ├── PhysicsEngine.ts           # Drag, fall, bounce physics
│   │   ├── SpriteSheet.ts            # Sprite/frame loader + cache
│   │   └── expressions/
│   │       └── ExpressionRenderer.ts  # Future: dynamic expressions from image generation
│   │
│   ├── chat/                          # Chat interaction UI
│   │   ├── ChatBubble.tsx             # Floating bubble button (triggers chat window)
│   │   ├── ChatWindow.tsx             # Chat window main component
│   │   ├── MessageList.tsx            # Scrollable message list
│   │   ├── MessageBubble.tsx          # Single message: renders *actions* in italic, "dialogue" normally
│   │   └── ImageMessage.tsx           # Image display (for rp image generation results)
│   │
│   ├── settings/                      # Settings panel UI
│   │   ├── SettingsPanel.tsx          # Main settings container
│   │   ├── ConnectionSection.tsx      # OpenClaw gateway URL, token, connection test
│   │   ├── CharacterSection.tsx       # Character card selection / switching
│   │   └── CompanionSection.tsx       # Idle interaction on/off, frequency slider
│   │
│   ├── hooks/                         # React Hooks
│   │   ├── useBridge.ts              # Subscribe to OpenClaw messages via IPC
│   │   ├── useAnimation.ts           # Pet animation state
│   │   └── useChat.ts                # Chat messages state
│   │
│   ├── stores/                        # Zustand state stores
│   │   ├── chatStore.ts              # Messages, input state, loading
│   │   ├── petStore.ts               # Animation name, FV level, physics state
│   │   └── settingsStore.ts          # Gateway config, character selection, companion toggle
│   │
│   ├── utils/
│   │   ├── responseParser.ts          # Parse rp-plugin response → actions, dialogues, emotions, media
│   │   └── emotionMapper.ts           # Map emotions → animation commands
│   │
│   └── styles/
│       ├── global.css
│       ├── chat.module.css
│       └── pet.module.css
│
├── res/                               # ─── STATIC RESOURCES ───
│   ├── cards/                         # Character card files
│   │   └── baiyuan_card.json          # Copy from DyberPet/res/cards/ or tools/baiyuan/
│   ├── sprites/                       # Pet animation frames (converted from DyberPet format)
│   │   └── baiyuan/
│   │       ├── manifest.json          # Animation definitions (converted from act_conf.json)
│   │       └── frames/               # Frame images (copied from DyberPet/res/role/)
│   └── icons/
│       └── tray.png                   # System tray icon
│
├── tools/                             # ─── DEVELOPMENT TOOLS ───
│   ├── card_gen.py                    # Character card PNG embed tool (keep as Python)
│   └── sprite_converter.py           # Convert DyberPet act_conf.json → manifest.json
│
├── tests/
│   ├── bridge.test.ts
│   ├── responseParser.test.ts
│   ├── emotionMapper.test.ts
│   └── cardManager.test.ts
│
├── data/                              # ─── RUNTIME DATA (gitignored) ───
│   └── settings.json
│
└── docs/
    ├── ARCHITECTURE.md                # This document (trimmed for repo)
    ├── BRIDGE_PROTOCOL.md             # WebSocket JSON-RPC protocol spec
    └── CHARACTER_CARD.md              # Character card creation guide
```

---

## 3. OpenClaw Bridge Migration (Python → TypeScript)

### 3.1 Source Files (READ-ONLY reference)

```
DyberPet/DyberPet/openclaw_bridge/
├── __init__.py
├── config.py              → electron/bridge/config.ts
├── client.py              → electron/bridge/client.ts
├── worker.py              → electron/bridge/worker.ts
├── response_parser.py     → src/utils/responseParser.ts
├── emotion_mapper.py      → src/utils/emotionMapper.ts
```

### 3.2 Gateway Protocol (from MVP testing)

**Endpoint**: `ws://188.239.18.173:4000/` (production) or configurable
**Auth**: Token as query param `?token=<TOKEN>`

#### Connection Handshake

1. Connect to WebSocket URL
2. Receive `connect.challenge`:
```json
{"type":"event","event":"connect.challenge","payload":{"nonce":"xxx","ts":123}}
```
3. Send connect request (simulate Control UI webchat client):
```json
{
  "type": "req",
  "id": "1",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "role": "operator",
    "scopes": ["operator.admin", "operator.approvals", "operator.pairing"],
    "auth": { "token": "<GATEWAY_TOKEN>" },
    "client": {
      "id": "openclaw-control-ui",
      "version": "dev",
      "platform": "linux",
      "mode": "webchat"
    },
    "caps": [],
    "locale": "zh-CN"
  }
}
```
**IMPORTANT**: Must set HTTP Origin header to match gateway address (e.g., `http://188.239.18.173:4000`).
**IMPORTANT**: `dangerouslyDisableDeviceAuth: true` must be set on the server to skip device fingerprint validation. No `device` object in connect params.

4. Receive success response: `{"type":"res","id":"1","ok":true,...}`

#### Sending Messages

```json
{
  "type": "req",
  "id": "<uuid>",
  "method": "chat.send",
  "params": {
    "message": "hello",
    "sessionKey": "dyberpet-default",
    "idempotencyKey": "<uuid>"
  }
}
```

**DO NOT use JSON-RPC 2.0 format** (no `"jsonrpc": "2.0"` field). Gateway uses its own frame protocol with `"type": "req"`.

#### Receiving Responses

Responses come as streaming `chat` events:
- `state: "delta"` — partial/incremental text
- `state: "final"` — complete response

```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "runId": "xxx",
    "sessionKey": "agent:main:dyberpet-default",
    "seq": 5,
    "state": "final",
    "message": {
      "role": "assistant",
      "content": [{"type": "text", "text": "response text here"}]
    }
  }
}
```

Extract text: `payload.message.content[0].text`
Only process `state === "final"` for display. Ignore delta frames for now.

#### Sending /rp Commands

Same as regular messages — put the command as the message text:
```json
{"type":"req","id":"<uuid>","method":"chat.send","params":{"message":"/rp start --card baiyuan","sessionKey":"dyberpet-default","idempotencyKey":"<uuid>"}}
```

### 3.3 client.ts Specification

```typescript
/**
 * WebSocket client for OpenClaw Gateway.
 *
 * Runs in Electron main process.
 * Uses Node.js 'ws' package (not browser WebSocket) for Origin header support.
 *
 * Lifecycle:
 *   connect() → receive challenge → send connect req → handshake complete
 *   → sendMessage() / sendCommand() → receive chat events → emit to renderer via IPC
 *
 * Events emitted via IPC to renderer:
 *   'bridge:connected'
 *   'bridge:disconnected'
 *   'bridge:message' → { runId, text }
 *   'bridge:error' → { message }
 *   'bridge:status' → { sessionActive, cardLoaded }
 */

// Dependencies:
// - 'ws' package (npm install ws) — supports custom headers including Origin
// - NOT browser WebSocket (no Origin header control)

// Key implementation notes from MVP debugging:
// 1. Must set Origin header: { origin: 'http://188.239.18.173:4000' }
// 2. Challenge response: type="req", method="connect", NO device object
// 3. client.id must be "openclaw-control-ui", client.mode must be "webchat"
// 4. Message format: type="req", method="chat.send" (NOT jsonrpc 2.0)
// 5. Response parsing: listen for event="chat", state="final"
// 6. Handle reconnection with exponential backoff
```

### 3.4 worker.ts Specification

```typescript
/**
 * Coordinates bridge client, card management, and session lifecycle.
 *
 * Startup sequence (MUST be strictly sequential, wait for each step):
 *   1. client.connect() → wait for handshake complete
 *   2. sendCommand('/rp list-assets --type card') → wait for final response
 *   3. If card not found:
 *      sendCommand('/rp import-card --url <card_url>') → wait for "✅" in response
 *   4. sendCommand('/rp start --card <card_name>') → wait for success (no "❌")
 *   5. Mark session as ready → allow user messages
 *
 * IMPORTANT: User messages MUST be blocked until setup completes.
 * Each step waits for the chat event with state="final" before proceeding.
 *
 * Card name resolution:
 *   The card name in /rp start must match the "name" field inside the card JSON.
 *   Currently "柏源" (Chinese). Use the name from import response, or card ID.
 */
```

### 3.5 responseParser.ts Specification

```typescript
/**
 * Parses rp-plugin response text into structured data.
 *
 * Input: raw text from chat final event
 * Output: ParsedResponse { actions, dialogues, emotions, mediaUrls, fullText }
 *
 * Parsing rules:
 * 1. Extract MEDIA:<url> lines → mediaUrls, remove from display text
 * 2. Extract *...* → actions list
 * 3. Extract "..." or 「...」→ dialogues list
 * 4. Detect emotions from action text:
 *    - happy: 笑, 微笑, 眉眼舒展, 上扬, 开心, 高兴
 *    - intimate: 靠近, 拥抱, 牵手, 握住, 贴近, 亲
 *    - concerned: 皱眉, 担心, 叹气, 收紧, 不安
 *    - sad: 沉默, 低头, 叹息, 黯淡
 *    - playful: 歪头, 坏笑, 狡黠, 眨眼, 戏弄
 *    - protective: 挡在, 护住, 拉到身后, 果断
 *    - cooking: 厨房, 做饭, 端着, 热腾腾
 *    - default: talk (no specific emotion detected)
 *
 * Reference implementation: DyberPet/DyberPet/openclaw_bridge/response_parser.py
 */
```

### 3.6 emotionMapper.ts Specification

```typescript
/**
 * Maps parsed emotions to pet animation commands.
 *
 * Input: ParsedResponse (from responseParser)
 * Output: AnimationCommand { animationName, fvDelta, durationMs }
 *
 * Mapping table (configurable via manifest.json):
 * | Emotion     | Animation   | FV Delta |
 * |-------------|-------------|----------|
 * | happy       | happy       | +5       |
 * | intimate    | intimate    | +8       |
 * | concerned   | concerned   | +3       |
 * | sad         | sad         | +0       |
 * | playful     | playful     | +5       |
 * | protective  | protective  | +8       |
 * | cooking     | cooking     | +5       |
 * | talk        | talk        | +2       |
 *
 * Fallback: if mapped animation doesn't exist in current sprite manifest,
 * fall back to 'talk', then 'default'.
 *
 * NOTE: This mapping will be redesigned when integrating OpenClaw image generation.
 * Current version is MVP placeholder. Mark with TODO comments.
 *
 * Reference implementation: DyberPet/DyberPet/openclaw_bridge/emotion_mapper.py
 */
```

---

## 4. Animation Engine Rewrite

### 4.1 Source Reference (READ-ONLY)

The old animation system lives in:
```
DyberPet/DyberPet/modules.py          # Animation_worker class
DyberPet/res/role/*/act_conf.json      # Animation definitions
DyberPet/res/role/*/action/            # Frame images (PNG sequences)
```

**Do NOT copy modules.py directly.** Read its logic and rewrite in TypeScript.

### 4.2 Core Logic to Preserve

From `modules.py` Animation_worker:
- **Probability-based action selection**: Each animation has a probability weight. The worker randomly selects the next animation based on weights.
- **Status requirements**: Some animations only play when FV (favorability) is above a threshold.
- **Frame sequence playback**: Each animation is a sequence of PNG frames played at a configured FPS.
- **Idle loop**: When no specific animation is triggered, loop through idle/default animations.

### 4.3 New Animation Format (manifest.json)

Create a converter tool (`tools/sprite_converter.py`) that reads DyberPet's `act_conf.json` and outputs the new format:

```json
{
  "character": "baiyuan",
  "defaultAnimation": "idle",
  "frameRate": 10,
  "animations": {
    "idle": {
      "frames": ["idle_001.png", "idle_002.png", "idle_003.png"],
      "loop": true,
      "probability": 0.5,
      "minFV": 0
    },
    "happy": {
      "frames": ["happy_001.png", "happy_002.png"],
      "loop": false,
      "probability": 0.2,
      "minFV": 20,
      "next": "idle"
    },
    "talk": {
      "frames": ["talk_001.png", "talk_002.png", "talk_003.png"],
      "loop": true,
      "probability": 0,
      "minFV": 0,
      "trigger": "on_message"
    }
  }
}
```

### 4.4 PetCanvas.tsx

```typescript
/**
 * Renders pet sprite animation on a transparent Canvas.
 *
 * - Loads sprite frames from res/sprites/<character>/frames/
 * - Reads animation definitions from manifest.json
 * - Plays frame sequences at configured FPS
 * - Receives animation commands from emotionMapper via IPC/store
 * - Canvas is transparent (pet window has transparent background)
 *
 * Mouse interaction:
 * - Drag: initiate drag (PhysicsEngine handles movement)
 * - Click: trigger click animation or open chat bubble
 * - Double-click: open settings (optional)
 */
```

### 4.5 PhysicsEngine.ts

```typescript
/**
 * Handles desktop pet physics: drag, fall, bounce.
 *
 * Rewrite of DyberPet MouseMoveManager logic:
 * - Drag: follow cursor while mouse button held
 * - Drop: when released, apply gravity (fall to screen bottom or taskbar)
 * - Bounce: configurable bounce coefficient on landing
 * - Screen edge detection: keep pet within screen bounds
 *
 * Uses requestAnimationFrame for smooth updates.
 * Coordinates with PetCanvas for position updates.
 *
 * Reference: DyberPet/DyberPet/DyberPet.py (MouseMoveManager class)
 */
```

---

## 5. IPC Design (Main ↔ Renderer)

### 5.1 Channel Definitions

```typescript
// electron/ipc.ts — shared channel names

export const IPC = {
  // Bridge → Renderer
  BRIDGE_CONNECTED: 'bridge:connected',
  BRIDGE_DISCONNECTED: 'bridge:disconnected',
  BRIDGE_MESSAGE: 'bridge:message',          // { runId: string, text: string }
  BRIDGE_ERROR: 'bridge:error',              // { message: string }
  BRIDGE_SESSION_STATUS: 'bridge:session',   // { ready: boolean, card: string }

  // Renderer → Bridge
  BRIDGE_SEND: 'bridge:send',               // { message: string }
  BRIDGE_SEND_COMMAND: 'bridge:command',     // { command: string }

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_ON_CHANGE: 'settings:changed',

  // Companion
  COMPANION_NUDGE: 'companion:nudge',        // Trigger proactive message
  COMPANION_STATUS: 'companion:status',
} as const;
```

### 5.2 Data Flow

```
User types "早上好" in ChatWindow.tsx
  → chatStore.sendMessage("早上好")
    → ipcRenderer.invoke(IPC.BRIDGE_SEND, { message: "早上好" })
      → [main process] worker.ts receives, calls client.sendMessage()
        → [WebSocket] Gateway → rp-plugin → LLM → response
      → [main process] client.ts receives chat final event
        → worker.ts processes: parse response, map emotion
        → mainWindow.webContents.send(IPC.BRIDGE_MESSAGE, { text, runId })
          → [renderer] useBridge hook receives
            → chatStore.addMessage(text)
              → ChatWindow re-renders with new message
            → petStore.setAnimation(emotionResult)
              → PetCanvas plays new animation
```

---

## 6. Settings Schema

```typescript
// electron/bridge/config.ts

interface SoulLinkSettings {
  openclaw: {
    gatewayWsUrl: string;        // default: "ws://188.239.18.173:4000/"
    authToken: string;            // Gateway token
    sessionKey: string;           // default: "dyberpet-default"
    channel: string;              // default: "webchat"
    defaultCard: string;          // default: "baiyuan"
    cardImportUrl: string;        // URL for auto-importing card on first run
    timeoutSeconds: number;       // default: 30
    reconnectIntervalMs: number;  // default: 5000
  };
  companion: {
    enabled: boolean;             // default: false (save tokens)
    idleMinutes: number;          // default: 30
    mode: 'balanced' | 'checkin' | 'question' | 'report';  // default: 'balanced'
  };
  pet: {
    character: string;            // default: "baiyuan"
    positionX: number;            // last position
    positionY: number;
    scale: number;                // default: 1.0
  };
  ui: {
    language: string;             // default: "zh-CN"
  };
}
```

---

## 7. Electron Window Setup

### 7.1 Pet Window (petWindow.ts)

```typescript
/**
 * Transparent, frameless, always-on-top window for the desktop pet.
 *
 * Key Electron BrowserWindow options:
 * {
 *   transparent: true,
 *   frame: false,
 *   alwaysOnTop: true,
 *   skipTaskbar: true,
 *   hasShadow: false,
 *   resizable: false,
 *   webPreferences: {
 *     preload: path.join(__dirname, 'preload.js'),
 *     contextIsolation: true,
 *     nodeIntegration: false,
 *   }
 * }
 *
 * Click-through: Use win.setIgnoreMouseEvents(true, { forward: true })
 * to make transparent areas click-through while keeping the pet sprite clickable.
 *
 * The renderer detects mouse enter/leave on the canvas element and toggles
 * setIgnoreMouseEvents accordingly via IPC.
 */
```

### 7.2 Chat Window (chatWindow.ts)

```typescript
/**
 * Chat popup window. Opened when user clicks the chat bubble.
 *
 * Positioned relative to the pet window (e.g., above or beside it).
 * Can be closed independently. Remembers position.
 *
 * NOT transparent. Normal window with custom frame (or frameless + custom titlebar).
 */
```

---

## 8. MVP Implementation Order

Execute in this exact sequence. Each step should be a working state before proceeding.

### Phase 1: Project Scaffold
1. Initialize `soul-link-desktop/` with `npm init`
2. Install dependencies: electron, react, typescript, vite, zustand, ws, electron-builder, electron-store
3. Set up Vite config for Electron renderer
4. Set up TypeScript configs (tsconfig.json, tsconfig.node.json)
5. Create electron/main.ts with a basic BrowserWindow
6. Verify: `npm run dev` opens an Electron window

### Phase 2: Bridge (OpenClaw Connection)
7. Create `electron/bridge/config.ts` with default settings
8. Create `electron/bridge/client.ts` — WebSocket client with handshake
9. Create `electron/bridge/worker.ts` — startup sequence (check card → import → start session)
10. Create `electron/ipc.ts` — channel definitions
11. Wire IPC in main.ts
12. Verify: app connects to Gateway, handshake succeeds, `/rp` commands work

### Phase 3: Chat UI
13. Create `src/stores/chatStore.ts`
14. Create `src/hooks/useBridge.ts`
15. Create `src/chat/ChatWindow.tsx` + `MessageList.tsx` + `MessageBubble.tsx`
16. Create `src/utils/responseParser.ts`
17. Wire chat window to bridge via IPC
18. Verify: send "你好" → receive baiyuan in-character response → display in chat

### Phase 4: Pet Window
19. Create `electron/windows/petWindow.ts` — transparent window setup
20. Create `res/sprites/baiyuan/manifest.json` — (manual or converter tool)
21. Copy frame images from `DyberPet/res/role/` to `soul-link-desktop/res/sprites/`
22. Create `src/pet/SpriteSheet.ts` — frame loader
23. Create `src/pet/AnimationEngine.ts` — animation state machine
24. Create `src/pet/PetCanvas.tsx` — canvas renderer
25. Create `src/utils/emotionMapper.ts`
26. Wire emotion mapping: bridge response → emotion → pet animation
27. Verify: pet appears on desktop, plays idle animation, reacts to chat responses

### Phase 5: Chat Bubble + Integration
28. Create `src/chat/ChatBubble.tsx` — floating button near pet
29. Wire bubble click → open chat window
30. Create `src/pet/PhysicsEngine.ts` — drag and drop
31. Verify: full flow — click bubble → chat → response → pet animates

### Phase 6: Settings + Polish
32. Create `electron/store/settings.ts` — electron-store wrapper
33. Create `src/settings/SettingsPanel.tsx` + sections
34. Create `electron/companion/scheduler.ts` — idle trigger (with on/off toggle)
35. System tray integration
36. Verify: settings persist, companion triggers work when enabled

### Phase 7: Packaging
37. Configure electron-builder.yml for Windows (.exe) and macOS (.dmg)
38. Test build on both platforms
39. Verify: packaged app runs correctly on clean machine

---

## 9. MVP Backlog (Post-Migration)

These items are tracked but NOT part of the initial migration:

1. **Animation/Expression System** — Integrate OpenClaw image generation for dynamic character expressions. Design the pipeline: chat response → emotion detection → image generation request → display. Requires detailed design.

2. **Character Card Decoupling & Multi-Character** — Support switching between multiple characters. Card manager should handle multiple cards, preset selection, UI for character switching.

3. **Response Filtering & Protocol** — Optimize delta streaming display, implement response protocol constraints with OpenClaw, potentially modify rp-plugin capabilities.

4. **M3: Multi-User Support** — Server-side session isolation per user. Each remote user (via Telegram/Discord) has independent conversation. Desktop clients use unique sessionKeys.

5. **M4: Companion Agent** — Full Generative Agents style behavior loop. Memory Stream → Reflection → Planning. Proactive emotional check-ins, follow-up questions, action reports.

6. **Web UI** — Reuse React chat components for a web-based client (remote users without desktop app).

7. **Item/Gift System** — Character requests items or food during idle interactions. Triggers specific animations and dialogue. Configurable on/off to manage token costs.

---

## 10. Key Reference Files in DyberPet (READ-ONLY)

When implementing, reference these files for logic (but rewrite in TypeScript):

| Purpose | Source File |
|---------|------------|
| WebSocket client + handshake | `DyberPet/DyberPet/openclaw_bridge/client.py` |
| Session startup sequence | `DyberPet/DyberPet/openclaw_bridge/worker.py` |
| Response parsing | `DyberPet/DyberPet/openclaw_bridge/response_parser.py` |
| Emotion mapping | `DyberPet/DyberPet/openclaw_bridge/emotion_mapper.py` |
| Connection config | `DyberPet/DyberPet/openclaw_bridge/config.py` |
| Animation definitions | `DyberPet/res/role/*/act_conf.json` |
| Animation worker logic | `DyberPet/DyberPet/modules.py` (Animation_worker class) |
| Pet widget (physics) | `DyberPet/DyberPet/DyberPet.py` (MouseMoveManager class) |
| Character card JSON | `DyberPet/res/cards/baiyuan_card.json` or `tools/baiyuan/baiyuan_card.json` |

---

## 11. Configuration for Live Test Server

```json
{
  "openclaw": {
    "gatewayWsUrl": "ws://188.239.18.173:4000/",
    "authToken": "<get from: openclaw config get gateway.auth.token>",
    "sessionKey": "dyberpet-default",
    "channel": "webchat",
    "defaultCard": "baiyuan",
    "cardImportUrl": "http://188.239.18.173:5173/baiyuan/baiyuan_card.png"
  }
}
```

**Server prerequisites** (already configured):
- `gateway.controlUi.dangerouslyDisableDeviceAuth: true`
- `gateway.controlUi.allowedOrigins: ["*"]`
- rp-plugin installed and enabled
- MiniMax-M2 model configured via CPA proxy
