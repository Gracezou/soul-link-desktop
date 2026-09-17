# Soul Link Desktop — 架构权威文档
> Phase 2 · architect · 2026-09-09 · 本文件是架构描述的唯一事实来源；CLAUDE.md 与 .claude/agents/*.md 必须与本文件一致

## 0. 架构裁决（R1–R8）

### R1 — 权威架构描述放在哪里
**裁决：外置。本文件 `docs/ARCHITECTURE.md` 即权威架构文档；`CLAUDE.md` / `AGENTS.md` 只保留「事实卡片」（目录规则、命令、IPC 常量清单、settings schema、Known Gaps）并链接到本文件。** — **Recommended**

理由：`docs/2604/AGENT_ARCHITECTURE.md` 是 4 月的**设计稿**，其内容与实现已多处不符（它写 `session-store.ts` 用 better-sqlite3，实际是 `sql.js`；它写 `bridge/` 应「KEEP as optional fallback」，实际已删除；它设计的 `messages` 表含 `raw_content` / `emotion` / `token_count` 列，实际表只有 6 列），不能直接充当权威。agent-facing 文件越短越不易再次腐化。T15 **执行**（本文件即其产出）；T4 的链接目标为 `docs/ARCHITECTURE.md`。

### R2 — `architect.md` 的 "Key Interfaces to Preserve" 是主动有害指令
**裁决：整节删除并替换为本文件 §6 的逐字内容。** — **Recommended**

理由：现文的三条（`bridge:message → useBridge` 管线、"Bridge lifecycle … Do not break this sequence"、settings `openclaw` 段「只扩展不重构」）指向的代码在 `34733ff` 中已被删除，任何遵守它的 agent 都会拒绝该次迁移甚至试图恢复 `electron/bridge/`。§6 已写成可直接粘贴形态。

### R3 — 其余 3 处同类有害指令
**裁决：一并替换，替换文案见 §6 与下表。** — **Recommended**

| 位置 | 现文（有害） | 替换为 |
|---|---|---|
| `code-reviewer.md` Project Architecture | "Response pipeline integrity preserved (bridge:message → parser → stores)" | "响应管线完整：`agent:waiting/delta/final` → `ChatBubbleFeedback`（气泡主链路）与 `useAgent` → `chatStore`/`petStore`（旁路），见 `docs/ARCHITECTURE.md` §4" |
| `code-reviewer.md` Project Architecture | "BridgeWorker lifecycle not broken" | "`SoulLinkAgent` 生命周期完整：`initialize()` → `sendMessage()` → `dispose()`；不得在 `agent/` 内引入 Electron API 依赖" |
| `architect.md` Rules 末条 | "maintain … bridge lifecycle integrity" | "maintain the `agent:*` IPC contract and the `SoulLinkAgent` lifecycle described in `docs/ARCHITECTURE.md`" |
| `electron-dev.md` Project Context | `bridge/client.ts` `bridge/worker.ts` `bridge/config.ts` `bridge/types.ts` | `agent/`（11 文件，见 §1）、`logger.ts`、`utils/paths.ts`、`utils/onboardingGuard.ts`、`windows/onboardingWindow.ts` |

### R4 — `agent:*` 只发 petWindow
**裁决：这是功能缺陷，不是有意设计。文档如实描述现状（气泡是当前唯一有效出口），同时列为 P1 backlog，另立需求走完整 5 阶段。** — 现状 **Not Recommended**，但本次不改代码

证据链：`main.ts` 的 `AGENT_SEND` handler 把 `onWaiting/onDelta/onFinal/onError` 一律 `petWindow?.webContents.send(...)`；chat window 加载 `App.tsx` 默认分支 → `AgentApp` → `useAgent()` 订阅 `agent:final`，但该窗口是独立 renderer，永远收不到事件。后果可验证：`chatStore.addUserMessage` 把 `isLoading` 置 true，只有 `addAssistantMessage` 会清除，因此 chat window 发出一条消息后输入框与发送按钮**永久禁用**。这不可能是有意设计。推荐修法（backlog）：在 `main.ts` 提取 `broadcastToWindows(channel, payload)`，向 `petWindow` + `mainWindow` 广播 `agent:waiting/delta/final/error`；`agent:message-saved` 维持只发 historyWindow。

### R5 — preload 无 channel allowlist
**裁决：接受现状，改写 `code-reviewer.md` 的审查条目为可执行标准；同时记 P2 安全 backlog。** — 接受现状 **Recommended**（当前威胁模型下），引入 allowlist **Recommended as backlog**

理由：当前实际风险面 = 「渲染端若被注入脚本，可调用任意已注册的 `ipcMain` handler」。而本应用不加载任何远程内容（全部 `loadFile` / 本地 vite dev server），打包态 CSP 为 `script-src 'self'`，`nodeIntegration:false` + `contextIsolation:true`，且 handler 集合内没有任意文件读写或任意命令执行的原语——最坏后果是改设置、开窗口、发消息。收益低于把 27 个通道逐一类型化的改动成本，故本次不改。`code-reviewer.md` 的条目应从「Preload exposes only necessary APIs」改为：**「preload 通过通用 `send/invoke/on` 转发；新增通道必须在 `preload.ts` 顶部注释块中登记载荷类型，且不得暴露任何接受路径/命令字符串的 handler」**。

### R6 — IPC 常量表不完整
**裁决：文档如实标注为已知偏差；规则收紧为「新增通道必须进 `ipc.ts` 常量表」（对新代码强制，存量不回改）；补齐存量列为 P2 backlog。** — **Recommended**

补正 pm-planner：裸字符串通道**不是 9 个而是 12 个**，且其中 **3 个是死通道**——`src/pet/PetCanvas.tsx` 发送 `pet:drag-start` / `pet:drag-move` / `pet:drag-end`，`electron/` 中**没有任何 handler**（拖拽实际由 `PetApp.tsx` 的 `pet:move-window` 实现）。完整清单见 §3。

### R7 — Codex 调用参数是否仍有效
**裁决：属环境配置，非架构事实。推荐默认：从 `electron-dev.md` / `frontend-dev.md` 中删除写死的 `--model gpt-5.4-mini`，保留 `codex exec --approval-mode auto-edit`，模型交由 Codex 侧默认配置决定。** — **Recommended**

理由：写死一个 5 个月前的模型名是「必然过期」的配置，删除它 Phase 3 不会失败；owner 若要锁定模型应在 Codex 自身配置中锁，而不是在 6 份 agent 定义里复制。不阻塞本次任何任务。

### R8 — ESLint 缺失
**裁决：方案 A。所有文档中移除 `npx eslint .`，Known Gaps 记「无 lint 工具链」backlog。** — **Recommended**

Phase 5 的准确命令集（已实跑验证）：

```
npx tsc -p tsconfig.json --noEmit          # renderer
npx tsc -p tsconfig.node.json --noEmit     # main
npm test                                    # jest tests/unit/ → 7 suites / 67 tests
npm run build:renderer && npm run build:main
npm run build                               # 仅在需要产出安装包时
```

---

## 1. 模块地图

```
electron/            主进程（CommonJS，tsc -p tsconfig.node.json → dist-electron/）
├── main.ts          应用入口：单实例锁、res:// 协议、CSP、全部 ipcMain 注册、
│                    托盘、launchMainApp()（建 petWindow → 建 Agent → 建 Companion）
├── ipc.ts           IPC 通道常量表（不完整，见 §3）
├── preload.ts       contextBridge 暴露 electronAPI { send, invoke, on, removeAllListeners, resBase }
├── logger.ts        三路 JSONL 日志（ops/api/conv）+ 保留期清理
├── agent/           自建 Agent，零 Electron 依赖（可整体外提为独立服务）
│   ├── index.ts             SoulLinkAgent — 编排者
│   ├── types.ts             AgentConfig / CharacterCard / ChatMessage / Session / StreamCallbacks / *Payload
│   ├── llm-client.ts        OpenAI 兼容 HTTP；streamChat(SSE) / chatCompletion / testConnection
│   ├── character-engine.ts  SillyTavern V2 卡（res/cards/<name>_card.json）→ system prompt
│   ├── context-manager.ts   token 预算滑窗；system + mes_example + 历史 + 新消息
│   ├── compressor.ts        旧消息 → 摘要（独立 LlmClient 实例）
│   ├── memory-store.ts      长期记忆表 memories，复用 SessionStore 的 db 句柄
│   ├── session-store.ts     sql.js(WASM) SQLite：sessions / messages
│   ├── ooc-detector.ts      出戏检测（中英 13 条正则）
│   ├── token-counter.ts     CJK×2 + 英文词×1 + 数字 + 标点/4，每消息 +4
│   └── tag-utils.ts         从回复尾部提取 [emotion:xxx]
├── store/settings.ts SoulLinkSettings + electron-store（含 0.2.0 migration）
├── windows/         petWindow / chatWindow / settingsWindow / onboardingWindow
│                    （history window 直接在 main.ts 内联构造，未抽出）
├── companion/       scheduler.ts（定时 nudge）、triggers.ts（纯函数，无调用者）
├── utils/           paths.ts（getResourcePath/getDataPath/getDBPath/...）、onboardingGuard.ts
└── card/            空目录（遗留）

src/                 渲染进程（ESM，vite → dist/），单 HTML 按 ?page= 分派
├── App.tsx          page=history → ChatHistory；其余 → AgentApp（useAgent + 主题/i18n 初始化）
├── hooks/           useAgent（agent:ready/final → stores）、useChat（sendMessage）、useAnimation
├── pet/             PetApp / PetCanvas / AnimationEngine / SpriteSheet / PhysicsEngine / expressions
├── chat/            ChatBubbleFeedback（气泡主链路）/ ChatWindow / ChatHistory / CompactInput / ...
├── utils/           protocolFilter = systemFilter + oocDetector + tagExtractor；responseParser；
│                    bubbleParser；emotionMapper
├── stores/          chatStore / petStore / settingsStore（死代码，见 §9）
├── settings/ onboarding/ toolbar/ themes/ i18n/ styles/
```

**边界规则**：`electron/agent/` 不得 import 任何 Electron API（`logger.ts` 是唯一例外依赖，它自身 import `app`——这是既有妥协，外提时需替换）。`src/` 不得 import `electron/` 下任何模块，跨进程一律走 IPC。

## 2. 进程与窗口

| 窗口 | 构造位置 | URL/参数 | 关键 webPreferences | 特征 |
|---|---|---|---|---|
| pet | `windows/petWindow.ts` | `?page=pet` | contextIsolation ✔ / nodeIntegration ✘ | 200×316、透明、无边框、置顶、skipTaskbar、`focusable:false`、默认 `setIgnoreMouseEvents(true,{forward:true})` |
| chat | `windows/chatWindow.ts` | 无 page 参数 | 同上 | 380×520、无边框、相对 pet 定位 |
| settings | `windows/settingsWindow.ts` | `?page=settings` | 同上 | 600×500、不可缩放 |
| onboarding | `windows/onboardingWindow.ts` | `?page=onboarding` | 同上 | 640×720、有边框、居中 |
| history | **`main.ts` 内联** | `?page=history` | 同上 | 400×600、无边框、可缩放 |

启动流程（`app.whenReady`）：注册 `res://` 协议 → 打包态注入 CSP → `setupIpcHandlers()` → `needsOnboarding(settings)`（**只看** `onboarding.completed` 是否为 false；G1 起连接凭据不再作为引导门禁，引导页可「稍后配置」跳过连接步骤）→ 是则开 onboarding 窗口，`onboarding:complete` 后再 `launchMainApp()`；否则直接 `launchMainApp()`。

`launchMainApp()`：建 petWindow（读取 `pet.positionX/Y`，`moved` 事件 500ms 防抖回写）→ `setupTray()` → 用 settings 快照构造 `SoulLinkAgent`（`maxTotalTokens:8000 / systemPromptBudget:2000 / outputReserve:500`；`cpa` 三字段缺失时以 `''` 兜底）。**LLM 未配置时照常构造并 `initialize()`**，仅记一条 warn，由 Agent 在 `sendMessage` 入口拦截 → `initialize()` 成功后置 `agentReady=true` 并向 petWindow 推 `agent:ready` → 建 `CompanionScheduler`，`companion.enabled` 时 `start()`。

## 3. IPC 契约

已在 `electron/ipc.ts` 常量表中：

| 通道 | 方向/机制 | 载荷类型 | 接收/发起窗口 |
|---|---|---|---|
| `agent:ready` | main→renderer (send) | `{ ready: boolean; character: string; llmConfigured: boolean }` | **仅 petWindow**（`useAgent`） |
| `agent:waiting` | main→renderer | `{ messageId: string }` | **仅 petWindow**（`ChatBubbleFeedback`） |
| `agent:delta` | main→renderer | `{ messageId: string; delta: string }` — **delta = 累计全文** | **仅 petWindow** |
| `agent:final` | main→renderer | `{ messageId: string; text: string }` | **仅 petWindow**（气泡 + `useAgent`） |
| `agent:error` | main→renderer | `{ messageId: string; error: string }` | 仅 petWindow；**当前无监听者** |
| `agent:message-saved` | main→renderer | `{ message: ChatMessage }` | **仅 historyWindow**（`ChatHistory`） |
| `agent:send` | renderer→main (send) | `{ message: string }` | `PetApp`/`CompactInput`、`useChat` |
| `agent:get-history` | invoke | `() => ChatMessage[]` | `ChatHistory` |
| `agent:reset` | renderer→main (send) | `void` | handler 存在，**无调用者** |
| `agent:test-connection` | invoke | `({baseUrl,apiKey,model}) => { success: boolean; error?: string }` | `ConnectionStep`、`ConnectionSection` |
| `agent:get-status` | invoke | `() => { ready: boolean; character: string; llmConfigured: boolean }`（`agent` 为 null 时 `llmConfigured:false`） | `useAgent`（任意窗口；chat 窗口靠它拿 `llmConfigured`） |
| `settings:get` | invoke | `() => SoulLinkSettings` | `App.tsx`、`SettingsPanel`、`OnboardingWizard` |
| `settings:set` | invoke | `(Partial<SoulLinkSettings>) => void`，成功后向**所有窗口**广播 `settings:changed` | 4 个 settings section + onboarding |
| `settings:changed` | main→renderer (广播) | `SoulLinkSettings`（全量） | `App.tsx`（仅用 `ui.theme`） |
| `pet:mouse-enter` / `pet:mouse-leave` | renderer→main (send) | `void` | `PetApp` |
| `companion:nudge` | main→petWindow | `{ message: string }` | **无监听者** |
| `companion:status` | invoke | `() => { running: boolean }` | **无调用者** |
| `window:toggle-chat` | renderer→main (send) | `void` | `Toolbar` |
| `window:open-settings` | renderer→main (send) | `void` | `Toolbar` |
| `window:open-history` | **invoke**（handler 无返回值） | `void` | `Toolbar` |
| `onboarding:complete` | renderer→main (send) | `void` | `OnboardingWizard` |
| `app:relaunch` | renderer→main (send) | `void` | `ConnectionSection`、`AboutSection` |
| `app:get-version` | invoke | `() => string` | `AboutSection` |
| `cards:list` | invoke | `() => Array<{id,name,description,avatarDataUrl?}>` | `CharacterStep` |

**裸字符串通道（不在 `ipc.ts` 中，共 12 个）**：

| 通道 | 机制 | 载荷 | 状态 |
|---|---|---|---|
| `chat:open` | send | `void` | handler 存在；仅 `ChatBubble.tsx` 使用，而该组件**无任何 import 方** |
| `settings:open` | send | `void` | handler 存在，**无调用者** |
| `window:close` | send | `void` | `App.tsx`、`SettingsPanel` |
| `window:close-history` | send | `void` | `ChatHistory` |
| `pet:move-window` | send | `{ deltaX: number; deltaY: number }` | `PetApp` |
| `pet:save-position` | send | `void`（主进程 500ms 防抖写 settings） | `PetApp` |
| `pet:resize-window` | send | `{ width?: number; height: number }` | `PetApp` |
| `pet:set-clickthrough` | send | `{ enabled: boolean }` | `PetApp` |
| `pet:set-focusable` | send | `{ focusable: boolean }` | `PetApp` |
| `pet:drag-start` | send | `{ x: number; y: number }` | **死通道：`PetCanvas` 发送，主进程无 handler** |
| `pet:drag-move` | send | `{ x: number; y: number }` | **死通道** |
| `pet:drag-end` | send | `void` | **死通道** |

**规则**：新增通道必须同时（a）加入 `ipc.ts` 常量表，（b）在 `preload.ts` 顶部注释块登记载荷类型。存量裸字符串不回改，补齐见 §9 backlog。

## 4. 数据流

```
用户输入（PetApp/CompactInput 或 ChatWindow）
   └─ send('agent:send', { message })
        │
        ▼  main.ts AGENT_SEND handler
   SoulLinkAgent.sendMessage(text, callbacks)
        ├─ !isLlmConfigured() → onError('', 'LLM not configured') 后返回（G1；早于 onWaiting / saveMessage，不写库、不抛错）
        ├─ crypto.randomUUID() → messageId ─────────► onWaiting  ──► petWindow  agent:waiting
        ├─ sessionStore.saveMessage(user)
        ├─ memoryStore.getMemoriesForPrompt() + sessionStore.getSessionSummary()
        ├─ characterEngine.buildSystemPrompt(card, memories, summary)
        ├─ contextManager.buildMessages({system, mes_example, history, newUser})
        └─ 循环 attempt 0..2：
             llmClient.streamChat  ──SSE──►  每个 chunk: fullText += delta
                                              └─► onDelta(messageId, fullText) ──► petWindow  agent:delta
             checkOutOfCharacter(finalText)
               ├─ 命中且 attempt<2 → 追加 system「Please stay in character…」重来
               └─ 否则 → sessionStore.saveMessage(assistant)
                          ├─ onFinal ──► petWindow    agent:final
                          ├─ onSaved ──► historyWindow agent:message-saved
                          ├─ convLog.logTurn(...)
                          └─ postProcess()（不阻塞）：memoryStore.extractAndSave；
                                消息数 >30 → compressor.compress(前半) → sessions.summary
```

渲染端两条消费路径（都只在 **pet 窗口**内生效）：

- **路径 A（主链路，气泡）** `ChatBubbleFeedback` 直接订阅 `agent:waiting/delta/final`。`delta` 走 `stripPartialTag()` 后进打字机（30ms/字）；`final` 走 `processResponse()`＝`isSystemMessage`（命中则整条抑制）→ `checkOutOfCharacter`（仅记日志）→ `extractEmotionTag`，随后 `petStore.setAnimationFromEmotion()` + `petStore.addFV()`。
- **路径 B（旁路，会话列表）** `useAgent` 订阅 `agent:ready` / `agent:final`，`final` 走 `responseParser.parseResponse()` → `chatStore.addAssistantMessage()` + `emotionMapper` → `petStore`。两条路径对同一 `agent:final` **各自独立解析一次**，且各用一套解析器（`protocolFilter` vs `responseParser`），是既有重复。

**`agent:delta` 的 delta 语义（必须记住）**：`agent/index.ts` 的 `streamOnce` 内为 `callbacks.onDelta?.(messageId, fullText)` —— 字段名叫 `delta`，值是**从流开始到当前的累计全文**，消费端应当**整体替换**而非追加。`llm-client.ts` 内部回调 `onDelta(delta)` 才是真增量，二者不要混淆。

旁路：`companion:nudge` 由 `CompanionScheduler` 定时（`idleMinutes` 分钟的固定 `setInterval`，**不是真正的 idle 检测**）从 `NUDGE_MESSAGES` 随机取一条固定文案推给 petWindow，**不经过 Agent，且渲染端无监听者** → 当前完全无效果。

## 5. 持久化

| 数据 | 载体 | 位置 | 说明 |
|---|---|---|---|
| 设置 | electron-store `settings.json` | **始终** `app.getPath('userData')`（开发态即 Electron 默认 userData，**不是 `data/`**） | 含 `0.2.0` migration：`openclaw.authToken → cpa.apiKey`、`openclaw.defaultCard → character.cardName`、删除 `openclaw` 键。**这是全仓唯一合法出现 `openclaw` 的位置，删除它会导致老用户配置丢失** |
| 会话与记忆 | sql.js(WASM) SQLite 单文件 | `getDBPath()`：开发 `data/soul-link.db`；打包 `userData/soul-link.db` | 表 `sessions(id,character_name,created_at,updated_at,summary)`、`messages(id,session_id,role,content,created_at,metadata)`、`memories(id,character_id,category,key,value,confidence,created_at,updated_at, UNIQUE(character_id,category,key))`。`summary` 列通过 `ALTER TABLE … catch` 做幂等迁移 |
| 日志 | JSONL（ops/api/conv） | `getDataPath()/logs`：开发 `<repo>/data/logs`；打包 `<userData>/logs` | 由 `main.ts` 在 `whenReady` 首条语句调用 `initLogging()` 接通（`4095cbc`），`will-quit` 调 `shutdownLogging()`。按日轮转，ops/api 保留 7 天、conv 保留 30 天 |
| 静态资源 | `res/`（cards / sprites / icons） | 开发 `<repo>/res`；打包 `process.resourcesPath/res`（`extraResources`） | 由 `SOUL_LINK_RES_BASE` 环境变量与 `res://` 自定义协议统一寻址 |

`SessionStore` 与 `MemoryStore` 的每次写入都执行 `db.export()` + `fs.writeFileSync(整库)`，即**每条消息全量重写数据库文件**。当前数据量下可接受，长会话下是已知性能上限（§9）。

`SoulLinkAgent` 在 `launchMainApp()` 时用 settings **快照**构造；`settings:set` 不会重建 Agent、也不会调用 `companion.updateConfig()` 或 `agent.switchCharacter()`——所以改 `cpa.*` / `companion.*` / 角色必须重启应用（UI 已有 restart banner 兜底 `cpa`）。

## 6. Key Interfaces to Preserve

<!-- 以下整节将逐字复制进 .claude/agents/architect.md，替换旧的 bridge lifecycle 内容 -->

- **Agent 事件契约**（`electron/ipc.ts` 常量 → petWindow）。载荷类型定义在 `electron/agent/types.ts`，改名或改形状需同步 `preload.ts` 顶部注释块：
  - `agent:ready` `{ ready: boolean; character: string; llmConfigured: boolean }` —— `ready` 表示数据库与角色卡就绪；`llmConfigured` 表示 Agent 构造时 `baseUrl`/`apiKey`/`model` 在 `trim()` 后均非空（缺失按空处理，只含空白也算未配置），**不代表网关可达**。渲染端每次收到都要更新，不得只取首次（C1 广播与热更新依赖这一点）。`agent:get-status` 返回同一形状（类型 `AgentStatus`）
  - `agent:waiting` `{ messageId: string }`
  - `agent:delta` `{ messageId: string; delta: string }` — **`delta` 是累计全文，不是增量**；消费端整体替换。修改此语义会同时破坏 `ChatBubbleFeedback` 的打字机与 runId 去重。
  - `agent:final` `{ messageId: string; text: string }`
  - `agent:error` `{ messageId: string; error: string }`
  - `agent:message-saved` `{ message: ChatMessage }` — 仅发 history window
  - 上行：`agent:send` `{ message: string }`（send）；`agent:get-history` / `agent:get-status` / `agent:test-connection`（invoke）
- **`SoulLinkAgent` 生命周期**：`new SoulLinkAgent(AgentConfig)` → `await initialize()`（初始化 sql.js、载入角色卡、`getOrCreateSession`）→ `sendMessage(text, StreamCallbacks)`（可多次；内部含 ≤2 次 OOC 重试与异步 postProcess）→ `dispose()`（关闭 DB）。`sendMessage` 在 `initialize()` 之前调用会抛错——**例外**：LLM 未配置时它在入口即以 `onError('', LLM_NOT_CONFIGURED_ERROR)` 返回，不抛错、不写库、不触发 `onWaiting`。
- **`electron/agent/` 的零 Electron 依赖约束**：该目录设计为可整体外提为独立服务，除既有的 `logger.ts` 妥协外，不得引入 `ipcMain` / `BrowserWindow` / `electron-store` / `app`。所有 Electron 集成只发生在 `main.ts`。
- **Settings schema**（`electron/store/settings.ts` `SoulLinkSettings`）六段：`cpa{baseUrl,apiKey,model}`、`character{cardName}`、`companion{enabled,idleMinutes,mode:'balanced'|'checkin'|'question'|'report'}`、`pet{character,positionX,positionY,scale}`、`ui{language,theme}`、`onboarding{completed,completedAt?}`。**`0.2.0` migration（`openclaw` → `cpa`/`character`）不可删除**——它是老用户配置的唯一迁移路径，也是全仓唯一合法出现 `openclaw` 的地方。
- **持久化路径**：`utils/paths.ts` 的 `getResourcePath()` / `getDBPath()` 是资源与数据库寻址的唯一入口，不得在别处硬编码 `process.resourcesPath` 或 `userData`（`main.ts` 设置 `SOUL_LINK_RES_BASE` 的那处除外）。
- **打包依赖**：`electron-builder.yml` 的 `asarUnpack: "**/sql.js/**"` 是 `session-store.ts` 通过 `require.resolve('sql.js')` 定位 `sql-wasm.wasm` 的前提；移除会导致打包版 Agent 初始化失败。

## 7. 安全评估

- **进程隔离**：全部 5 个窗口均为 `contextIsolation: true` + `nodeIntegration: false`，无 `remote`、无 `webSecurity:false`、无 `allowRunningInsecureContent`。**合格**。
- **未启用 `sandbox: true`**：preload 仍具备完整 Node 能力。当前 preload 只做透传，风险有限；若未来 preload 增加文件/进程操作，应同时开启 sandbox。P2。
- **preload 无 allowlist**：见 R5，接受现状。约束条件是「不得注册接受路径/命令字符串的 handler」——当前全部 handler 满足。
- **CSP 仅在打包态注入**（`app.isPackaged` 分支）：`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: file: res:; connect-src 'self' http: https:`。两点待办：
  1. **`connect-src` 未包含 `res:`**，而 `PetApp.tsx:41` 与 `PetCanvas.tsx:33` 用 `fetch('res://sprites/…/manifest.json')` 读清单 → 打包态该 fetch 很可能被 CSP 拦截，桌宠退化为占位框。开发态无 CSP 所以观察不到。**需在真实打包产物上验证**，属 P1 backlog。
  2. `connect-src http: https:` 过宽；渲染端实际不需要外网（LLM 调用全在主进程），可收紧为 `'self' res:`。P2。
- **API key**：`cpa.apiKey` 明文存于 `settings.json`，且通过 `settings:get` 全量下发到**每个**渲染窗口。桌面单用户场景下可接受，但 `settings:get` 应考虑对非 settings 窗口脱敏。P2。
- **卡片解析**：`cards:list` 解析 `res/cards/` 下任意 PNG 的 tEXt chunk 并 `JSON.parse`，已包裹 try/catch；`extractPngTextChunk` 用 `readUInt32BE` 逐块推进，畸形长度字段可致循环提前结束但不会越界（`buf.slice` 自动截断）。可接受。
- **无远程内容加载**，无 `will-navigate` / `setWindowOpenHandler` 防护——因为不存在外链入口；若未来引入外链需补齐。

## 8. 跨平台注意事项

- `setIgnoreMouseEvents(true, { forward: true })` 的 `forward` 选项**仅 Windows 与 macOS 支持**；Linux 上穿透后无法再收到 `mouse-enter`，`PetApp` 的悬停工具栏会失效。项目当前只声明 Windows/macOS 目标，Linux 属未支持。
- `petWindow` 用 `focusable:false` + 运行时 `setFocusable(true)` + 50ms 延迟 `focus()` 的组合来让输入框可打字，这是平台相关的时序 hack；改动 `pet:set-focusable` 逻辑必须在 Windows 与 macOS 双端回归。
- 托盘：`res/icons/` 下**只有 README.md**，`getResourcePath('icons','tray.png')` 必定落空，`setupTray` 回退到 `nativeImage.createEmpty()` → 托盘图标为空白。macOS 上空图标托盘几乎不可见。
- `electron-builder.yml` 的 `mac.icon` 与 `win.icon` 均被注释掉 → 打包产物使用 Electron 默认图标。
- `window-all-closed` 在非 darwin 下 `app.quit()`；macOS 保留进程并由 `activate` 重新 `launchMainApp()`——该路径**跳过 `needsOnboarding` 判定**，未完成引导时从 dock 唤醒会直接进主应用。边缘缺陷，P2。
- `res://` 协议处理用 `getResourcePath(url.hostname, url.pathname)`，`pathname` 带前导 `/`，`path.join` 会正确归一化，Windows 盘符路径亦安全。
- sql.js 为 WASM，无原生模块编译，跨平台/跨架构无 rebuild 负担——这是相对 `better-sqlite3`（设计稿方案）的实际优势，`asarUnpack` 见 §6。

## 9. 已知架构偏差与 backlog

**A. 文档如实记录即可（不改代码）**

1. `agent:*` 事件只推 petWindow；chat window 收不到（详见 R4 的后果描述）。
2. 12 个裸字符串通道未进 `ipc.ts`，其中 `pet:drag-start/move/end` 为死通道，`settings:open` 无调用者，`chat:open` 的唯一调用方 `ChatBubble.tsx` 本身无引用方。
3. `agent:reset`、`companion:status` 有 handler 无调用者；`agent:error`、`companion:nudge` 有发送无监听者。
4. `agent:final` 被两套解析器各解析一次（`protocolFilter` / `responseParser`），FV 与动画可能被重复触发。
5. `settings:set` 不重建 Agent、不调 `companion.updateConfig()`、不调 `agent.switchCharacter()`——`switchCharacter()` 全仓无调用者；改配置需重启。
6. `LlmClient.testConnection()` 无调用者；`main.ts` 的 `agent:test-connection` handler 用裸 `fetch` 重新实现了一遍（10s 超时 vs 30s，无重试），两处逻辑已分叉。
7. `utils/paths.ts` 的 `getCardPath` / `getSpritePath` 与 `store/settings.ts` 的 `getCpaConfig` / `updateCpaConfig` 均无调用者（`getDataPath` 已于 `4095cbc` 被日志接线启用）。
8. `CompanionScheduler` 是固定间隔 `setInterval`，不是 idle 检测；`companion/triggers.ts` 的 `shouldTrigger()` 无调用者。
9. 返回值风格不统一：仅 `agent:test-connection` 用 `{ success, error? }`，`settings:get` / `agent:get-status` / `cards:list` / `agent:get-history` 直接返回值。**定为目标态，存量不回改**。
10. `res/sprites/baiyuan/frames/` 为空目录（全仓 sprites 下只有 1 个文件 `manifest.json`），manifest 声明 11 组动画约 26 帧 → 桌宠恒定走占位渲染。
11. `src/stores/settingsStore.ts` 为死代码，字段仍是 `gatewayWsUrl` / `authToken` / `sessionKey`（含硬编码 IP）。
12. `src/i18n/zh-CN.json` / `en.json` 第 18/89/131 行仍有「OpenClaw 网关」用户可见文案；`src/utils/emotionMapper.ts:5,10`、`src/pet/expressions/ExpressionRenderer.ts:4`、`src/App.tsx:14` 注释仍提 OpenClaw / useBridge。
13. `tests/` 根目录 6 个 legacy 文件（57 用例）不在 `npm test`（= `jest tests/unit/`）范围内，需 `npm run test:all`；`tests/integration/` 需 `CPA_API_KEY` 且须 `--runInBand`。
14. 仓库无 ESLint 配置、无 eslint 依赖（R8）。
15. `PetApp`/`PetCanvas` 硬编码 `res://sprites/baiyuan/...`，未读 `pet.character` 设置。
16. `docs/2604/AGENT_ARCHITECTURE.md` 与实现的偏差（sql.js vs better-sqlite3、bridge 保留 vs 已删、messages 表列集）；`docs/current/TODO-0407.md` 同样写 better-sqlite3。

**B. 需另立需求改代码（各自走完整 5 阶段）**

| 优先级 | 项 | 来源 |
|---|---|---|
| P1 | `agent:*` 广播到 pet + chat 两窗口，修复 chat window 永久 loading | R4 |
| P1 | 打包态 CSP `connect-src` 补 `res:`，并在真实安装包上验证桌宠清单加载 | §7 |
| P1 | 补齐 sprite 帧资源 | §9-A10 |
| P2 | companion nudge 接入 Agent（`main.ts:466` 的 TODO）并在渲染端加监听者 | §4 |
| P2 | 12 个裸字符串通道补入 `ipc.ts`，删除 3 个死通道 | R6 |
| P2 | 引入 preload channel allowlist + 类型化 API | R5 |
| P2 | 统一 `agent:final` 解析路径，二选一保留 | §9-A4 |
| **P1** | `settings:set` 后热更新 Agent（消除强制重启）—— **已造成用户可见的假阳性**：设置页「测试连接」走 `main.ts:189` 的裸 fetch、用**表单里的值**，而 Agent 用 `launchMainApp()` 时的 settings 快照（`main.ts:444`），`settings:set`（`main.ts:134`）只写库+广播不重建 Agent。结果是面板显示「连接成功 ✓」而对话 `HTTP 401: Invalid API key`（2026-09-15 实测） | §5 · §9-A5/A6 |
| P1 | 短期缓解：测试成功时若表单值 ≠ 已保存值，文案应为「连接成功（尚未保存）」，不要让绿勾暗示当前会话可用 | 同上 |
| P2 | `agent:test-connection` 复用 `LlmClient.testConnection()`，消除两套已分叉的逻辑 | §9-A6 |
| P2 | i18n OpenClaw 文案替换；删除 `settingsStore.ts` 死代码 | §9-A11/12 |
| P2 | legacy 测试迁入 `tests/unit/` 或扩大 `npm test` 范围；引入 ESLint 工具链 | R8 |
| P1 | `postProcess` / `extractAndSave` 与 `dispose()` 竞态：二者均不等待，`dispose()` 立刻关库，在途的记忆抽取写入必然失败且被 `void` + `.catch(()=>{})` 吞掉。测试中记忆抽取大概率从未落库（F1 实证，相隔 1ms）；生产中「发完消息立刻退出」同样丢数据 | `v0.3.0/F1-BASELINE.md` |
| ~~P0~~ | ~~`<think>` 必须在 `saveMessage` 之前剥离~~ **已解决（C0，`2eb304c` + `a206559`，2026-09-16）**。三层实现：请求带 `reasoning_split: true`（源头分离，实测三个 MiniMax 模型均生效）；`stripThinking()` 在 `index.ts` 入库前兜底；`chatCompletion()` 统一剥离，覆盖摘要与记忆抽取两条旁路。剥离早于 OOC 检测。实机验收后 `messages` 表 28 条 assistant 记录零污染 | `v0.3.0/SPEC-C0-THINKING.md` |
| ~~P1~~ | ~~剥离必须早于 OOC 检测~~ 同上，`index.ts:111-117` 的顺序已锁定并有单测 | 同上 |
| P3 | SessionStore 全量重写改为增量持久化（长会话性能） | §5 |
