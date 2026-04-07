# Soul Link Desktop — Agent Migration: Replace OpenClaw with Self-Built Agent

> **For Claude Code. Full migration plan.**
> **Goal: Remove OpenClaw/bridge dependency. Build self-contained agent in Electron main process.**
> **This is a BREAKING change — the entire communication layer is replaced.**

---

## 0. Migration Overview

### What Changes

```
BEFORE (OpenClaw):
  Renderer → IPC → bridge/ (WebSocket) → OpenClaw Gateway → rp-plugin → CPA → LLM

AFTER (Self-Built Agent):
  Renderer → IPC → agent/ (HTTP REST) → CPA → LLM
```

### What Gets DELETED
- `electron/bridge/` — entire directory (client.ts, worker.ts, config.ts, types.ts)
- All WebSocket-related code and dependencies (`ws` package)
- All OpenClaw-specific IPC channels (bridge:*)
- Onboarding Step 2: Gateway URL + token config → replaced with CPA URL + API key

### What Gets CREATED
- `electron/agent/` — new directory with 9 files
- SQLite database at `data/soul-link.db`
- New IPC channels (agent:*)
- Updated onboarding flow

### What Stays UNCHANGED
- `src/` renderer (React UI, chat bubble, toolbar, pet canvas)
- `res/` resources (sprites, cards)
- Theme system, i18n, drag, toolbar
- Presets, chat history window

---

## 1. New Directory Structure

### Delete
```
electron/bridge/           ← DELETE entire directory
  ├── client.ts
  ├── worker.ts
  ├── config.ts
  └── types.ts
```

### Create
```
electron/agent/
├── index.ts               # SoulLinkAgent class — public API facade
├── llm-client.ts          # HTTP REST client to CPA (OpenAI-compatible)
├── character-engine.ts    # Card JSON → system prompt builder
├── context-manager.ts     # 3-level context assembly + token budget
├── compressor.ts          # Dialogue summarization (Level 2)
├── session-store.ts       # SQLite: messages + sessions CRUD
├── memory-store.ts        # SQLite: long-term memory extraction + storage
├── ooc-detector.ts        # Out-of-character detection + retry
├── token-counter.ts       # Token estimation utility
└── types.ts               # Shared TypeScript types
```

---

## 2. Agent Module Specifications

### 2.1 types.ts

```typescript
export interface AgentConfig {
  cpa: {
    baseUrl: string;           // e.g. "http://188.239.18.173:8317/v1"
    apiKey: string;            // CPA API key
    model: string;             // e.g. "MiniMax-M2"
  };
  character: {
    cardPath: string;          // path to card JSON file
    cardName: string;          // e.g. "baiyuan"
  };
  context: {
    maxTotalTokens: number;    // default: 8192
    systemPromptBudget: number; // default: 2000
    outputReserve: number;     // default: 1200
    maxActiveMessages: number; // default: 20 (hard cap)
    compressionThreshold: number; // default: 30 (trigger summary after N messages)
  };
  paths: {
    dbPath: string;            // default: "data/soul-link.db"
  };
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;             // clean display text
  raw_content?: string;        // original LLM output (with tags)
  emotion?: string;            // extracted emotion tag
  token_count: number;
  created_at: number;          // unix timestamp ms
}

export interface Session {
  id: string;
  character_id: string;
  created_at: number;
  last_message_at: number;
  message_count: number;
  summary: string | null;
  summary_updated_at: number | null;
}

export interface Memory {
  id: string;
  character_id: string;
  category: 'user_info' | 'preference' | 'event' | 'relationship' | 'mood';
  key: string;
  value: string;
  confidence: number;
  created_at: number;
  updated_at: number;
}

export interface AgentResponse {
  displayText: string;
  emotion: string | null;
  rawText: string;
  oocDetected: boolean;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
}

export interface StreamCallbacks {
  onDelta: (text: string) => void;
  onFinal: (response: AgentResponse) => void;
  onError: (error: Error) => void;
}
```

### 2.2 index.ts — SoulLinkAgent (Public API)

```typescript
/**
 * Main agent facade. Instantiated in electron/main.ts.
 * 
 * DESIGN RULES:
 * - Zero Electron imports. No ipcMain, no BrowserWindow, no electron-store.
 * - All Electron integration happens in main.ts via IPC wrappers.
 * - Config passed via constructor, not read from environment.
 * - All public methods return Promise.
 * - SQLite path, CPA URL, card path all come from config.
 *
 * This class can be extracted to a standalone Node.js server
 * by wrapping it with Express/Fastify routes.
 */

export class SoulLinkAgent {
  constructor(config: AgentConfig) {}

  /** Open SQLite DB, load character card, resume or create session */
  async initialize(): Promise<void> {}

  /** Full pipeline: build context → call LLM → filter → save → return */
  async sendMessage(text: string, callbacks: StreamCallbacks): Promise<void> {}

  /** Fetch messages from SQLite for history window */
  async getHistory(limit?: number): Promise<ChatMessage[]> {}

  /** Load new character card, start new session */
  async switchCharacter(cardName: string): Promise<void> {}

  /** Get all long-term memories for current character */
  async getMemories(): Promise<Memory[]> {}

  /** Clear current session messages, keep memories */
  async resetSession(): Promise<void> {}

  /** Clean shutdown: close SQLite */
  async dispose(): Promise<void> {}
}
```

### 2.3 llm-client.ts — HTTP REST to CPA

```typescript
/**
 * Sends chat completion requests to CPA using OpenAI-compatible API.
 *
 * Endpoint: POST {baseUrl}/chat/completions
 *
 * Features:
 * - Streaming (SSE) support for delta/final events
 * - Non-streaming fallback
 * - Timeout handling (30s default)
 * - Error handling with retry (max 2)
 *
 * IMPORTANT: CPA exposes OpenAI-compatible format.
 * Request body:
 * {
 *   model: "MiniMax-M2",
 *   messages: [...],
 *   stream: true,
 *   temperature: 1.0,
 *   max_tokens: 1200
 * }
 *
 * Authorization header: Bearer <apiKey>
 *
 * Streaming response format (SSE):
 *   data: {"choices":[{"delta":{"content":"partial text"}}]}
 *   data: [DONE]
 *
 * Non-streaming response:
 *   {"choices":[{"message":{"content":"full text"}}],"usage":{"prompt_tokens":N,"completion_tokens":N}}
 *
 * Use Node.js native fetch (available in Node 18+).
 * Parse SSE manually — split by "data: " lines.
 */
```

### 2.4 character-engine.ts — Card to System Prompt

```typescript
/**
 * Reads SillyTavern V2 character card JSON and builds the system prompt.
 *
 * Input: card JSON file from res/cards/<name>.json
 * Output: system prompt string
 *
 * System prompt assembly order:
 *   1. card.data.system_prompt (core character rules)
 *   2. card.data.description (character description)
 *   3. card.data.personality (personality traits)
 *   4. card.data.scenario (current scenario/setting)
 *   5. [INJECTED] Long-term memories from memory-store
 *   6. [INJECTED] Conversation summary from session
 *   7. card.data.post_history_instructions (emotion tag rules, OOC rules)
 *
 * Also extracts:
 *   - card.data.first_mes → used as first assistant message in new sessions
 *   - card.data.mes_example → parsed into example dialogue messages
 *   - card.data.character_book → lorebook entries (future use)
 *
 * Card path: res/cards/<name>_card.json
 * Card format: SillyTavern V2 spec (spec: chara_card_v2)
 */
```

### 2.5 context-manager.ts — 3-Level Context Assembly

```typescript
/**
 * Builds the messages array for each LLM request.
 *
 * Three levels of context:
 *
 * Level 1 (Active Messages):
 *   - Most recent N messages from SQLite
 *   - Sliding window: walk backwards, accumulate until token budget exceeded
 *   - Token budget: maxTotalTokens - systemPromptBudget - outputReserve
 *
 * Level 2 (Conversation Summary):
 *   - When messages are evicted from Level 1, they are summarized
 *   - Summary is injected into system prompt: "[之前的对话摘要] ..."
 *   - Summary is regenerated when compressionThreshold new messages accumulate
 *
 * Level 3 (Long-Term Memory):
 *   - Structured facts from memory-store
 *   - Injected into system prompt: "[用户信息] 生日: 3月15日, 喜欢猫 ..."
 *
 * Output format (OpenAI messages array):
 * [
 *   { role: "system", content: "<card + memories + summary + rules>" },
 *   { role: "assistant", content: "<first_mes or example>" },  // optional
 *   { role: "user", content: "older message" },
 *   { role: "assistant", content: "older response" },
 *   ...
 *   { role: "user", content: "current message" }
 * ]
 */
```

### 2.6 compressor.ts — Dialogue Summarization

```typescript
/**
 * Compresses old conversation messages into a short summary.
 *
 * When to trigger:
 *   - After responding to user
 *   - Check: total messages in session > compressionThreshold
 *   - AND: messages not yet summarized > 20
 *   - Run asynchronously (do not block response)
 *
 * How:
 *   1. Fetch messages that are outside the active window
 *   2. Send them to LLM with a summarization prompt
 *   3. LLM returns 2-3 sentence summary
 *   4. Store summary in sessions table
 *   5. Existing summary is merged with new summary (incremental)
 *
 * Uses the same CPA/model as main chat, but with:
 *   temperature: 0.3 (factual, not creative)
 *   max_tokens: 200
 *   stream: false
 *
 * Summarization prompt (Chinese):
 *   "将以下对话压缩为简短摘要，保留：话题、关键动作、用户情绪、重要约定。2-3句话。"
 *
 * Cost: ~$0.001 per summarization (negligible)
 */
```

### 2.7 session-store.ts — SQLite Operations

```typescript
/**
 * SQLite database operations for messages and sessions.
 *
 * Uses better-sqlite3 (synchronous, fast, no async overhead).
 *
 * Install: npm install better-sqlite3
 * Types: npm install -D @types/better-sqlite3
 *
 * Database file: config.paths.dbPath (default: data/soul-link.db)
 *
 * Tables (auto-created on first run):
 *
 * CREATE TABLE IF NOT EXISTS sessions (
 *   id TEXT PRIMARY KEY,
 *   character_id TEXT NOT NULL,
 *   created_at INTEGER NOT NULL,
 *   last_message_at INTEGER,
 *   message_count INTEGER DEFAULT 0,
 *   summary TEXT,
 *   summary_updated_at INTEGER
 * );
 *
 * CREATE TABLE IF NOT EXISTS messages (
 *   id TEXT PRIMARY KEY,
 *   session_id TEXT NOT NULL,
 *   role TEXT NOT NULL,
 *   content TEXT NOT NULL,
 *   raw_content TEXT,
 *   emotion TEXT,
 *   token_count INTEGER,
 *   created_at INTEGER NOT NULL
 * );
 *
 * CREATE INDEX IF NOT EXISTS idx_messages_session
 *   ON messages(session_id, created_at);
 *
 * Public methods:
 *   createSession(characterId): Session
 *   getActiveSession(characterId): Session | null
 *   addMessage(msg: ChatMessage): void
 *   getMessages(sessionId, limit?, offset?): ChatMessage[]
 *   getMessageCount(sessionId): number
 *   getMessagesAfter(sessionId, afterTimestamp): ChatMessage[]
 *   updateSessionSummary(sessionId, summary): void
 *   deleteSession(sessionId): void
 */
```

### 2.8 memory-store.ts — Long-Term Memory

```typescript
/**
 * Extracts and stores long-term memories from conversations.
 *
 * SQLite table (auto-created):
 *
 * CREATE TABLE IF NOT EXISTS memories (
 *   id TEXT PRIMARY KEY,
 *   character_id TEXT NOT NULL,
 *   category TEXT NOT NULL,
 *   key TEXT NOT NULL,
 *   value TEXT NOT NULL,
 *   source_message_id TEXT,
 *   confidence REAL DEFAULT 1.0,
 *   created_at INTEGER NOT NULL,
 *   updated_at INTEGER NOT NULL,
 *   UNIQUE(character_id, category, key)
 * );
 *
 * Extraction:
 *   - Runs ASYNC after each AI response (non-blocking)
 *   - Only triggers when user message contains personal pronouns
 *     (我、我的、my、mine) or is longer than 20 characters
 *   - Sends user+AI message pair to LLM with extraction prompt
 *   - LLM returns JSON array of extracted facts
 *   - Upsert into SQLite (update if key exists)
 *
 * Categories:
 *   user_info:     birthday, name, age, job, location
 *   preference:    favorite_food, hobbies, dislikes
 *   event:         recent_trip, upcoming_exam, job_change
 *   relationship:  pet_name, partner_name, friend_name
 *   mood:          recent_mood, stress_level
 *
 * Injection:
 *   getMemoriesForPrompt(characterId): string
 *   Returns formatted string for system prompt injection:
 *   "[用户信息]\n- 生日: 3月15日\n- 爱好: 烘焙、养猫\n- 最近状态: 工作忙碌"
 */
```

### 2.9 ooc-detector.ts — Out-of-Character Detection

```typescript
/**
 * Reuse logic from src/utils/oocDetector.ts.
 * Move to electron/agent/ so it runs in main process.
 *
 * When OOC detected:
 *   1. Do NOT save the OOC response to history
 *   2. Retry: call LLM again with same context + appended instruction:
 *      "请以角色身份回复，不要以AI助手身份回答。"
 *   3. Max 2 retries per message
 *   4. If still OOC after 2 retries: save and return anyway
 *
 * Detection patterns: same as existing oocDetector.ts
 *   Chinese: 我是AI, 语言模型, AI助手, 作为AI, etc.
 *   English: I'm an AI, language model, as an AI, etc.
 */
```

### 2.10 token-counter.ts

```typescript
/**
 * Estimates token count for Chinese/English mixed text.
 * No external dependency (no tiktoken). Rough but sufficient for budgeting.
 *
 * Rules:
 *   Chinese characters: ~1.5 tokens each
 *   English words: ~1.3 tokens each
 *   Punctuation/whitespace: ~0.3 tokens each
 *
 * export function estimateTokens(text: string): number
 */
```

---

## 3. IPC Channel Migration

### Delete These Channels (bridge-related)

```typescript
// REMOVE all of these from electron/ipc.ts and preload.ts
BRIDGE_CONNECTED
BRIDGE_DISCONNECTED
BRIDGE_MESSAGE
BRIDGE_ERROR
BRIDGE_SESSION_STATUS
BRIDGE_SEND
BRIDGE_SEND_COMMAND
BRIDGE_TEST_CONNECTION

// Also remove:
'chat:ack'
'chat:delta'
'chat:final'
'bridge:send'
'bridge:session'
'bridge:test-connection'
```

### Add These Channels (agent-related)

```typescript
// electron/ipc.ts — new channels

export const IPC = {
  // Agent → Renderer (messages)
  AGENT_READY: 'agent:ready',              // { ready: boolean, character: string }
  AGENT_DELTA: 'agent:delta',              // { text: string } streaming partial
  AGENT_FINAL: 'agent:final',              // { displayText, emotion, rawText, tokenUsage }
  AGENT_ERROR: 'agent:error',              // { message: string }
  AGENT_WAITING: 'agent:waiting',          // {} signal that LLM is thinking

  // Renderer → Agent (user actions)
  AGENT_SEND: 'agent:send',               // { message: string }
  AGENT_GET_HISTORY: 'agent:get-history',  // { limit?: number } → returns ChatMessage[]
  AGENT_RESET_SESSION: 'agent:reset',      // {} → clears session

  // Connection test (for onboarding)
  AGENT_TEST_CONNECTION: 'agent:test-connection',
  // { baseUrl: string, apiKey: string, model: string }
  // → returns { success: boolean, error?: string }

  // Settings (unchanged)
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_ON_CHANGE: 'settings:changed',

  // Windows (unchanged)
  WINDOW_TOGGLE_CHAT: 'window:toggle-chat',
  WINDOW_OPEN_SETTINGS: 'window:open-settings',
  WINDOW_OPEN_HISTORY: 'window:open-history',
  WINDOW_CLOSE_HISTORY: 'window:close-history',

  // Pet window (unchanged)
  PET_MOVE_WINDOW: 'pet:move-window',
  PET_SAVE_POSITION: 'pet:save-position',
  PET_RESIZE_WINDOW: 'pet:resize-window',
  PET_SET_CLICKTHROUGH: 'pet:set-clickthrough',

  // Companion (unchanged)
  COMPANION_NUDGE: 'companion:nudge',
  COMPANION_STATUS: 'companion:status',

  // Onboarding (unchanged)
  ONBOARDING_COMPLETE: 'onboarding:complete',
} as const;
```

---

## 4. main.ts Rewrite

### Before (OpenClaw bridge)

```typescript
// OLD — delete this pattern
import { BridgeWorker } from './bridge/worker';
const bridge = new BridgeWorker(config);
bridge.start();
ipcMain.on('bridge:send', (_, data) => bridge.sendMessage(data.message));
```

### After (Self-built agent)

```typescript
// NEW
import { SoulLinkAgent } from './agent';

let agent: SoulLinkAgent;

async function startAgent() {
  const settings = loadSettings();

  agent = new SoulLinkAgent({
    cpa: {
      baseUrl: settings.cpa.baseUrl,
      apiKey: settings.cpa.apiKey,
      model: settings.cpa.model,
    },
    character: {
      cardPath: `res/cards/${settings.character.cardName}_card.json`,
      cardName: settings.character.cardName,
    },
    context: {
      maxTotalTokens: 8192,
      systemPromptBudget: 2000,
      outputReserve: 1200,
      maxActiveMessages: 20,
      compressionThreshold: 30,
    },
    paths: {
      dbPath: path.join(app.getPath('userData'), 'soul-link.db'),
    },
  });

  await agent.initialize();

  // Notify renderer that agent is ready
  petWindow?.webContents.send('agent:ready', {
    ready: true,
    character: settings.character.cardName,
  });
}

// IPC handlers
ipcMain.on('agent:send', async (_, { message }) => {
  // Send waiting signal
  petWindow?.webContents.send('agent:waiting');

  await agent.sendMessage(message, {
    onDelta: (text) => {
      petWindow?.webContents.send('agent:delta', { text });
    },
    onFinal: (response) => {
      petWindow?.webContents.send('agent:final', response);
      // Also send to history window if open
      historyWindow?.webContents.send('agent:final', response);
    },
    onError: (error) => {
      petWindow?.webContents.send('agent:error', { message: error.message });
    },
  });
});

ipcMain.handle('agent:get-history', async (_, { limit }) => {
  return agent.getHistory(limit || 100);
});

ipcMain.handle('agent:test-connection', async (_, { baseUrl, apiKey, model }) => {
  try {
    // Quick test: send a minimal request to CPA
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5,
      }),
    });
    if (res.ok) return { success: true };
    const err = await res.json();
    return { success: false, error: err.error?.message || `HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.on('agent:reset', async () => {
  await agent.resetSession();
  petWindow?.webContents.send('agent:ready', {
    ready: true,
    character: agent.currentCharacter,
  });
});
```

---

## 5. Onboarding Migration

### Step 2 Changes: Gateway Config → CPA Config

**Before:**
```
Step 2: Connect OpenClaw
- Gateway WebSocket URL: ws://...
- Auth Token: ****
- [Test Connection] → WebSocket handshake test
```

**After:**
```
Step 2: Connect AI Service
- API Address: http://... (CPA base URL, e.g. http://188.239.18.173:8317/v1)
- API Key: **** (CPA API key)
- Model: [dropdown or text input] (default: MiniMax-M2)
- [Test Connection] → HTTP POST test to /chat/completions
```

### Settings Schema Change

```typescript
// BEFORE
interface SoulLinkSettings {
  openclaw: {
    gatewayWsUrl: string;
    authToken: string;
    sessionKey: string;
    defaultCard: string;
    cardImportUrl: string;
    // ...
  };
}

// AFTER
interface SoulLinkSettings {
  cpa: {
    baseUrl: string;           // "http://188.239.18.173:8317/v1"
    apiKey: string;            // CPA API key
    model: string;             // "MiniMax-M2"
  };
  character: {
    cardName: string;          // "baiyuan"
  };
  companion: {
    enabled: boolean;
    idleMinutes: number;
    mode: string;
  };
  pet: {
    character: string;
    positionX: number;
    positionY: number;
    scale: number;
  };
  ui: {
    language: string;
    theme: string;
  };
  onboarding: {
    completed: boolean;
    completedAt?: string;
  };
}
```

### Onboarding UI Update

In `src/onboarding/ConnectionStep.tsx`:
- Replace Gateway URL input with CPA Base URL input
- Replace Auth Token input with API Key input
- Add Model name input (text field, default "MiniMax-M2")
- Test connection: HTTP POST instead of WebSocket handshake
- Update all i18n keys accordingly

New i18n keys:
```json
{
  "onboarding": {
    "connection": {
      "title": "连接 AI 服务",
      "baseUrl": "API 地址",
      "baseUrlPlaceholder": "http://your-server:port/v1",
      "apiKey": "API 密钥",
      "model": "模型名称",
      "modelPlaceholder": "MiniMax-M2",
      "testConnection": "测试连接",
      "success": "连接成功",
      "failed": "连接失败"
    }
  }
}
```

---

## 6. Renderer Updates

### 6.1 Update useBridge Hook → useAgent Hook

Rename `src/hooks/useBridge.ts` to `src/hooks/useAgent.ts`.

Replace all channel names:
```typescript
// BEFORE
window.electronAPI.on('bridge:message', handler);
window.electronAPI.send('bridge:send', { message });
window.electronAPI.on('bridge:session', handler);

// AFTER
window.electronAPI.on('agent:final', handler);
window.electronAPI.send('agent:send', { message });
window.electronAPI.on('agent:ready', handler);
```

### 6.2 Update ChatBubbleFeedback

Replace IPC event listeners:
```typescript
// BEFORE
window.electronAPI.on('chat:ack', onAck);
window.electronAPI.on('chat:delta', onDelta);
window.electronAPI.on('chat:final', onFinal);

// AFTER
window.electronAPI.on('agent:waiting', onWaiting);   // show "..."
window.electronAPI.on('agent:delta', onDelta);        // typewriter
window.electronAPI.on('agent:final', onFinal);        // complete, start dismiss timer
```

### 6.3 Update CompactInput

Replace send IPC:
```typescript
// BEFORE
window.electronAPI.send('bridge:send', { message: text });

// AFTER
window.electronAPI.send('agent:send', { message: text });
```

### 6.4 Update ChatHistory

Replace history fetch:
```typescript
// BEFORE
window.electronAPI.invoke('chat:get-history', { limit: 100 });

// AFTER
window.electronAPI.invoke('agent:get-history', { limit: 100 });
```

### 6.5 Update chatStore

Replace session status handling:
```typescript
// BEFORE
// Listen for bridge:session { ready }
// Listen for bridge:message

// AFTER
// Listen for agent:ready { ready, character }
// Listen for agent:final { displayText, emotion }
```

### 6.6 Update preload.ts

Remove all bridge:* channels from allowed lists.
Add all agent:* channels to allowed lists.

```typescript
// preload.ts — update allowed channels

const ALLOWED_SEND = [
  'agent:send',
  'agent:reset',
  'pet:move-window',
  'pet:save-position',
  'pet:resize-window',
  'pet:set-clickthrough',
  'window:close-history',
  'onboarding:complete',
];

const ALLOWED_INVOKE = [
  'agent:get-history',
  'agent:test-connection',
  'settings:get',
  'settings:set',
  'window:toggle-chat',
  'window:open-settings',
  'window:open-history',
];

const ALLOWED_ON = [
  'agent:ready',
  'agent:waiting',
  'agent:delta',
  'agent:final',
  'agent:error',
  'settings:changed',
];
```

---

## 7. Dependencies

### Remove
```bash
npm uninstall ws @types/ws
```

### Add
```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

No other new dependencies needed. Node.js native `fetch` handles HTTP.

---

## 8. Implementation Order

### Step 1: Create agent/ skeleton (create files, export types)
- Create all 9 files in electron/agent/
- Define types, export empty classes/functions
- Verify: project compiles with no errors

### Step 2: Implement core pipeline
- token-counter.ts (utility, no dependencies)
- session-store.ts (SQLite init, message CRUD)
- character-engine.ts (card JSON parser)
- llm-client.ts (HTTP POST to CPA, streaming SSE)
- context-manager.ts (Level 1 sliding window only)
- index.ts (wire everything, sendMessage flow)
- Verify: agent.sendMessage("hello") returns LLM response

### Step 3: Wire IPC
- Update electron/ipc.ts (new channel names)
- Update electron/preload.ts (allowed channels)
- Update electron/main.ts (replace bridge with agent)
- Verify: app starts, agent initializes, renderer can send messages

### Step 4: Update renderer
- Rename useBridge → useAgent, update all IPC channels
- Update ChatBubbleFeedback (agent:waiting, agent:delta, agent:final)
- Update CompactInput (agent:send)
- Update chatStore (agent:ready, agent:final)
- Verify: type message → see response in bubble with typewriter effect

### Step 5: Update onboarding
- Modify ConnectionStep (CPA URL + API key + model)
- Update settings schema (openclaw → cpa)
- Update test connection (HTTP POST instead of WebSocket)
- Verify: fresh start → onboarding → configure CPA → test → complete → chat works

### Step 6: Delete bridge/
- Remove electron/bridge/ directory
- Remove ws dependency
- Search entire codebase for any remaining "bridge" references
- Verify: no compilation errors, no runtime errors, clean build

### Step 7: Add compression + memory
- Implement compressor.ts
- Implement memory-store.ts
- Wire into context-manager.ts (Level 2 + Level 3)
- ooc-detector.ts (copy logic from src/utils/)
- Verify: long conversation → summary generated, user info extracted

### Step 8: Final test
- Fresh install test (delete data/settings.json + soul-link.db)
- Onboarding flow → CPA connection → character select → companion toggle
- Send messages → bubble feedback → typewriter → emotion animation
- Long conversation (30+ messages) → compression triggers
- User reveals info → memory extracted → next session uses it
- History window → shows all messages
- Restart app → session resumes, memories persist

---

## 9. Migration Checklist

```
[ ] agent/ directory created with all 9 files
[ ] types.ts defined
[ ] token-counter.ts implemented
[ ] session-store.ts SQLite working
[ ] character-engine.ts card parsing working
[ ] llm-client.ts HTTP + SSE streaming working
[ ] context-manager.ts Level 1 (sliding window) working
[ ] index.ts SoulLinkAgent facade working
[ ] ipc.ts updated with agent:* channels
[ ] preload.ts updated with allowed channels
[ ] main.ts using SoulLinkAgent instead of BridgeWorker
[ ] useBridge.ts → useAgent.ts renamed and updated
[ ] ChatBubbleFeedback using agent:* events
[ ] CompactInput using agent:send
[ ] chatStore using agent:ready/final
[ ] ChatHistory using agent:get-history
[ ] Onboarding ConnectionStep → CPA config
[ ] Settings schema openclaw → cpa
[ ] bridge/ directory deleted
[ ] ws package uninstalled
[ ] better-sqlite3 installed
[ ] compressor.ts implemented
[ ] memory-store.ts implemented
[ ] ooc-detector.ts moved to agent/
[ ] No "bridge" references remain in codebase
[ ] Fresh install test passes
[ ] Long conversation test passes
[ ] App restart test passes
```
