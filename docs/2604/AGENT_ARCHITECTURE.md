# Soul Link Desktop — Self-Built Agent Architecture

> **Design document. Covers deployment form, context management, and compression strategy.**

---

## 1. Deployment: Embedded in Electron (MVP)

### 1.1 Architecture

The agent runs inside Electron's main process as a pure Node.js module. No separate server needed for MVP.

```
┌─ Electron App ──────────────────────────────────────┐
│                                                      │
│  Main Process                                        │
│  ├── agent/                    ← NEW: self-built     │
│  │   ├── llm-client.ts        HTTP REST → CPA       │
│  │   ├── character-engine.ts  Card → system_prompt   │
│  │   ├── context-manager.ts   3-level context mgmt   │
│  │   ├── session-store.ts     SQLite (better-sqlite3) │
│  │   ├── memory-store.ts      Long-term memory        │
│  │   ├── compressor.ts        Dialogue summarization  │
│  │   └── ooc-detector.ts      Out-of-character check  │
│  │                                                    │
│  ├── bridge/                   ← KEEP: optional       │
│  │   └── (OpenClaw fallback)   Can be disabled        │
│  │                                                    │
│  └── ipc.ts                    ← Unchanged            │
│                                                      │
│  Renderer Process                                    │
│  └── (React UI — unchanged)                          │
│                                                      │
└──────────────────────────────────────────────────────┘
         │
         │ HTTP REST (OpenAI-compatible)
         ▼
    ┌─────────┐
    │   CPA   │  ← Already deployed, keeps model routing
    └────┬────┘
         │
         ▼
    ┌──────────┐
    │ MiniMax  │  (or any model CPA routes to)
    │   M2     │
    └──────────┘
```

### 1.2 Why Embed, Not Separate Server

| Factor | Embedded (MVP) | Separate Server |
|--------|---------------|-----------------|
| Setup complexity | Zero — ships with app | Need server deployment |
| Latency | Local function call, no network hop | Extra HTTP round trip |
| Data privacy | All data stays on user's machine | Data goes through your server |
| Multi-user | Not needed for MVP | Required when scaling |
| API key | Bundled in app config or user provides | Managed server-side |
| Cost control | Per-user, transparent | Centralized billing |

### 1.3 Future Extraction Path

When you need multi-user support or Web UI:

1. Move `agent/` directory to a new `soul-link-server/` project
2. Wrap with Express/Fastify REST API
3. Electron app replaces local agent calls with HTTP API calls
4. Add user auth + billing layer

This works because agent/ is designed with **zero Electron dependencies**:
- No `ipcMain`, no `BrowserWindow`, no `electron-store`
- Pure Node.js: HTTP fetch, SQLite, file system
- All Electron integration happens through `ipc.ts` wrapper, not inside agent/

---

## 2. Database Design

### 2.1 SQLite Schema (single file: `data/soul-link.db`)

```sql
-- Conversation messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,              -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,           -- display text (tags stripped)
  raw_content TEXT,                -- original text from LLM (with tags)
  emotion TEXT,                    -- extracted emotion tag
  token_count INTEGER,             -- estimated token count of this message
  created_at INTEGER NOT NULL,     -- unix timestamp ms
  INDEX idx_session_time (session_id, created_at)
);

-- Session metadata
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,      -- which character card
  created_at INTEGER NOT NULL,
  last_message_at INTEGER,
  message_count INTEGER DEFAULT 0,
  summary TEXT,                    -- compressed summary of old messages
  summary_updated_at INTEGER       -- when summary was last regenerated
);

-- Long-term memory (cross-session)
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,      -- memories are per-character
  category TEXT NOT NULL,          -- 'user_info' | 'preference' | 'event' | 'relationship'
  key TEXT NOT NULL,               -- e.g. 'birthday', 'favorite_food', 'recent_mood'
  value TEXT NOT NULL,             -- e.g. '3月15日', '猫', '最近工作压力大'
  source_message_id TEXT,          -- which message this was extracted from
  confidence REAL DEFAULT 1.0,    -- how certain (1.0 = explicitly stated, 0.5 = inferred)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(character_id, category, key)
);
```

### 2.2 Why SQLite

- Ships with Electron, no external DB needed
- Single file, easy backup/reset
- `better-sqlite3` is synchronous — no async complexity in main process
- Fast enough for single-user: thousands of messages, sub-ms queries
- Future extraction: migrate to PostgreSQL when going server-side (schema is compatible)

---

## 3. Three-Level Context Management

### 3.1 Overview

```
┌─────────────────────────────────────────────────────┐
│                   LLM Request                        │
│                                                      │
│  ┌─ system prompt ──────────────────────────────┐   │
│  │ Character card (personality, scenario, rules)  │   │
│  │ + Level 3: Long-term memories                  │   │
│  │ + Level 2: Conversation summary                │   │
│  │ + post_history_instructions (emotion tag rule)  │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ Level 1: Active messages ───────────────────┐   │
│  │ assistant: *柏源做好了早餐* "吃吧。"           │   │
│  │ user: 谢谢！好香                               │   │
│  │ assistant: *笑了笑* "喜欢就好。"               │   │
│  │ user: 今天有什么计划？                          │   │
│  │ ... (most recent N turns)                       │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ current user message ───────────────────────┐   │
│  │ user: 下午一起去打网球吧                        │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 3.2 Level 1: Active Messages (Sliding Window)

**What**: The most recent conversation messages, sent as-is to the LLM.

**Strategy**: Keep the last N messages where total tokens < budget.

```typescript
// context-manager.ts

interface ContextConfig {
  maxTotalTokens: 8192,        // Total context budget
  systemPromptBudget: 2000,    // System prompt + memories + summary
  outputReserve: 1200,         // Reserved for LLM output
  // Remaining = history budget
  // 8192 - 2000 - 1200 = 5000 tokens for active messages
}

function buildActiveMessages(
  allMessages: Message[],
  tokenBudget: number
): Message[] {
  const result: Message[] = [];
  let totalTokens = 0;

  // Walk backwards from most recent
  for (let i = allMessages.length - 1; i >= 0; i--) {
    const msg = allMessages[i];
    const msgTokens = msg.token_count || estimateTokens(msg.content);

    if (totalTokens + msgTokens > tokenBudget) break;

    result.unshift(msg);
    totalTokens += msgTokens;
  }

  return result;
}
```

**Token estimation** (simple, no external dependency):
```typescript
function estimateTokens(text: string): number {
  // Chinese: ~1.5 tokens per character
  // English: ~1.3 tokens per word
  // Mixed: rough estimate
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.5 + otherChars * 0.4);
}
```

### 3.3 Level 2: Conversation Summary (Compression)

**What**: When old messages are evicted from Level 1, summarize them instead of losing them entirely.

**When to trigger**:
- When the active window starts trimming messages (total messages > threshold)
- Batch: summarize every 20 evicted messages at once (not per-message)
- Async: run summarization after responding to user, not blocking

**How**:
```typescript
// compressor.ts

async function summarizeMessages(
  messages: Message[],
  existingSummary: string | null,
  llmClient: LLMClient
): Promise<string> {
  const prompt = `你是一个对话摘要助手。请将以下对话压缩为简短的摘要，保留关键信息：
- 讨论了哪些话题
- 角色做了什么动作
- 用户表达了什么情绪或需求
- 重要的承诺或约定

${existingSummary ? `之前的摘要：\n${existingSummary}\n\n新增对话：` : '对话内容：'}

${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

请用 2-3 句话概括。只输出摘要，不要其他内容。`;

  const response = await llmClient.complete({
    model: 'MiniMax-M2',   // Use cheaper model for summarization
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0.3,       // Low creativity for factual summary
  });

  return response.content;
}
```

**Summary injection** — goes into system prompt:
```typescript
function buildSystemPrompt(
  card: CharacterCard,
  summary: string | null,
  memories: Memory[]
): string {
  let prompt = card.system_prompt;
  prompt += '\n\n' + card.personality;
  prompt += '\n\n' + card.scenario;

  // Level 3: Long-term memories
  if (memories.length > 0) {
    prompt += '\n\n[用户信息]\n';
    prompt += memories.map(m => `- ${m.key}: ${m.value}`).join('\n');
  }

  // Level 2: Conversation summary
  if (summary) {
    prompt += '\n\n[之前的对话摘要]\n' + summary;
  }

  // Post-history instructions (emotion tag, etc.)
  prompt += '\n\n' + card.post_history_instructions;

  return prompt;
}
```

**Cost of summarization**:
- Triggered every ~20 messages (not every message)
- Input: ~3K tokens (20 messages), Output: ~100 tokens (summary)
- Cost per summarization: ~$0.001 (negligible)
- Monthly (50 msgs/day): ~75 summarizations = ~$0.075

### 3.4 Level 3: Long-Term Memory (Cross-Session)

**What**: Structured facts about the user that persist across sessions.

**Categories**:
```
user_info:     birthday, name, age, occupation, location
preference:    favorite_food, favorite_color, hobbies, dislikes
event:         recent_trip, upcoming_exam, breakup, job_change
relationship:  pet_name, partner_name, friend_mentioned
mood:          recent_mood, stress_level, emotional_state
```

**Extraction** — after each AI response, async check if user revealed extractable info:
```typescript
// memory-store.ts

async function extractMemories(
  userMessage: string,
  aiResponse: string,
  llmClient: LLMClient
): Promise<MemoryEntry[]> {
  const prompt = `分析以下对话，提取用户透露的个人信息。
只提取用户明确说出的事实，不要推测。

用户: ${userMessage}
角色: ${aiResponse}

如果有可提取的信息，用 JSON 数组返回：
[{"category": "user_info", "key": "birthday", "value": "3月15日"}]

如果没有可提取的信息，返回空数组：[]

只输出 JSON，不要其他内容。`;

  const response = await llmClient.complete({
    model: 'MiniMax-M2',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0.1,
  });

  try {
    return JSON.parse(response.content);
  } catch {
    return [];
  }
}
```

**When to run**: Not every message — only when user message is long enough or contains personal pronouns (我、我的、my).

**Cost**: ~$0.001 per extraction, skip most messages → negligible.

---

## 4. Complete Request Flow

```
User sends "下午一起去打网球吧"
  │
  ▼
┌─ context-manager.ts ──────────────────────────────┐
│                                                    │
│  1. Load character card → system_prompt base       │
│  2. Load memories from SQLite → inject             │
│  3. Load session summary → inject                  │
│  4. Load recent messages from SQLite               │
│  5. Apply sliding window (token budget)            │
│  6. Assemble final messages array                  │
│                                                    │
│  Final messages:                                    │
│  [                                                  │
│    { system: "[角色卡+记忆+摘要+规则]" },          │
│    { assistant: "早上好..." },  ← recent history   │
│    { user: "谢谢" },                                │
│    { assistant: "不客气..." },                      │
│    { user: "下午一起去打网球吧" }  ← current       │
│  ]                                                  │
│                                                    │
│  Estimated tokens: ~4500                            │
│                                                    │
└──────────┬─────────────────────────────────────────┘
           │
           ▼
┌─ llm-client.ts ───────────────────┐
│                                    │
│  POST http://CPA:PORT/v1/chat/completions
│  {                                 │
│    model: "MiniMax-M2",           │
│    messages: [...],                │
│    stream: true,                   │
│    temperature: 1.0,               │
│    max_tokens: 1200                │
│  }                                 │
│                                    │
│  ← SSE stream response            │
│                                    │
└──────────┬─────────────────────────┘
           │
           ▼
┌─ Post-processing (async) ─────────┐
│                                    │
│  1. protocolFilter → system msg?   │
│  2. oocDetector → retry?           │
│  3. tagExtractor → [emotion:xxx]   │
│  4. Save AI message to SQLite      │
│  5. Check if summary needed        │
│     (messages > threshold?)        │
│  6. Extract memories (async, bg)   │
│                                    │
└──────────┬─────────────────────────┘
           │
           ▼
  IPC → Renderer → ChatBubble + petStore
```

---

## 5. Token Budget Breakdown

Per request, worst case:

```
Component               Tokens     Notes
─────────────────────   ──────     ─────
Character card          ~800       system_prompt + personality + scenario
Long-term memories      ~200       ~10 memory entries × 20 tokens
Conversation summary    ~300       2-3 sentences of compressed history
Post-history rules      ~150       emotion tag instructions
Example dialogue        ~300       (optional, 2 example exchanges)
───── System total      ~1750

Recent messages (10)    ~3000      avg 300 tokens per turn
Current user message    ~50
───── History total     ~3050

Output reserve          ~1200
─────────────────────   ──────
GRAND TOTAL             ~6000      well within 8K budget
```

Compare with OpenClaw:

```
OpenClaw per request    ~10-15K    (SOUL.md + tools + full history + heartbeat context)
Self-built per request  ~6K        (40-60% reduction)
```

---

## 6. File Structure

```
electron/agent/
├── index.ts                # Agent facade: init, sendMessage, getHistory
├── llm-client.ts           # HTTP REST client to CPA (OpenAI-compatible)
├── character-engine.ts     # Card JSON → system_prompt builder
├── context-manager.ts      # 3-level context assembly + token budget
├── compressor.ts           # Dialogue summarization (Level 2)
├── session-store.ts        # SQLite: messages + sessions table
├── memory-store.ts         # SQLite: memories table + extraction
├── ooc-detector.ts         # Out-of-character detection (reuse existing)
├── token-counter.ts        # Token estimation utility
└── types.ts                # Shared TypeScript types
```

### Key Design Rules (for future extraction to server)

1. **No Electron imports** — agent/ must not import from 'electron'
2. **No IPC calls** — agent/ returns data, caller (ipc.ts) handles IPC
3. **Config via constructor** — pass config object, don't read from electron-store directly
4. **SQLite path via config** — `new Agent({ dbPath: 'data/soul-link.db', ... })`
5. **Pure async functions** — every public method returns Promise

```typescript
// electron/agent/index.ts — clean public API

export class SoulLinkAgent {
  constructor(config: AgentConfig) { ... }

  async initialize(): Promise<void>
  // Load character card, open SQLite, check session

  async sendMessage(text: string): Promise<AgentResponse>
  // Full pipeline: context build → LLM call → filter → save → return

  async getHistory(sessionId: string, limit?: number): Promise<Message[]>
  // Fetch messages from SQLite

  async switchCharacter(cardPath: string): Promise<void>
  // Load new card, start new session

  async getMemories(): Promise<Memory[]>
  // Return all long-term memories for current character

  async resetSession(): Promise<void>
  // Clear current session, keep memories
}

interface AgentResponse {
  displayText: string;       // Clean text for bubble
  emotion: string | null;    // For animation
  rawText: string;           // Original LLM output
  oocDetected: boolean;      // Was OOC retry triggered
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
}
```

---

## 7. Implementation Order

### Phase 1: Core Pipeline (1 week)
1. `token-counter.ts` — token estimation
2. `llm-client.ts` — HTTP POST to CPA, streaming SSE
3. `character-engine.ts` — card JSON parser → system prompt
4. `session-store.ts` — SQLite init + message CRUD
5. `context-manager.ts` — sliding window (Level 1 only)
6. `index.ts` — Agent facade, wire everything
7. Replace bridge IPC calls with agent calls
8. **Verify**: send message → get character response → display in bubble

### Phase 2: Filtering + Streaming (3 days)
9. `ooc-detector.ts` — copy from existing utils
10. Wire protocolFilter into agent response pipeline
11. SSE streaming → delta/final IPC events (same as current)
12. **Verify**: OOC detected → auto retry, system messages suppressed

### Phase 3: Compression (3 days)
13. `compressor.ts` — summarize old messages via LLM
14. Level 2 summary injection into system prompt
15. Auto-trigger: when message count > threshold, compress in background
16. **Verify**: long conversation → summary generated → old messages trimmed → context stays small

### Phase 4: Long-Term Memory (1 week)
17. `memory-store.ts` — SQLite CRUD + extraction prompt
18. Memory injection into system prompt
19. Async extraction after AI response (background, non-blocking)
20. **Verify**: user says "我生日是3月15日" → next session, 柏源 remembers

### Phase 5: Cleanup (2 days)
21. bridge/ module → mark as optional, disable by default
22. Settings panel: remove OpenClaw config, add CPA direct config
23. Update onboarding wizard (Gateway URL → CPA URL)
24. **Verify**: full app works without OpenClaw running
