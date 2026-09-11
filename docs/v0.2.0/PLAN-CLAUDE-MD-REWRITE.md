# CLAUDE.md 重写 — 需求分析与任务拆解
> Phase 1 · pm-planner · 2026-09-09

## 1. Summary

把 `CLAUDE.md` / `AGENTS.md` / `.claude/agents/*.md`（共 8 个 agent-facing 文档）从 OpenClaw WebSocket 时代的描述，重写为与 2026-04 自建 Agent 架构一致的事实描述；同时把「代码本身仍有缺口」的部分（sprite 资源缺失、companion nudge 未接线、i18n 遗留 OpenClaw 文案、legacy 测试未纳入 `npm test`、无 ESLint）如实标注为 TODO，而不是在文档里粉饰。

**本次改动范围全部位于 `electron/` 与 `src/` 之外（仅 `*.md`）**，因此不触发 CLAUDE.md 的「禁止主对话改代码」条款，Phase 3 不需要 `electron-dev` / `frontend-dev`。所有需要改代码的发现（见 §4 R4–R8）一律出 backlog，另走完整 5 阶段流程。

## 2. User Stories

- **US-1** 作为项目负责人，我希望任意 agent（Claude Code / Codex）读完 `CLAUDE.md` 后描述出的架构与 `electron/agent/` 真实代码一致，这样它不会去找一个已被删除的 `electron/bridge/`。
- **US-2** 作为 `architect` 的调用方，我希望 `architect.md` 里「必须保持的接口」列的是 `agent:*` 契约，而不是 bridge lifecycle，这样它不会建议我把删掉的 WebSocket 层重新加回来。
- **US-3** 作为 `test-build` 的调用方，我希望它跑的命令在本仓库真实存在，不会因为 `npx eslint .` 而报一个与代码质量无关的假失败。
- **US-4** 作为停更 5 个月后回归的开发者，我希望文档能直接告诉我「哪些是已完成的、哪些是明知未完成的」，不用逐个文件反推。
- **US-5** 作为使用 `codex exec` 的实现代理，我希望 `AGENTS.md`（Codex 读的文件）与 `CLAUDE.md` 同步，否则生成的代码会按 bridge 架构写。

## 3. 任务拆解

> 复杂度：small ≤1h / medium 1–2h / large 2–4h。
> ⚠️ `CLAUDE.md` 与 `AGENTS.md` 当前**除标题行外逐字节相同**（`diff` 仅 2 处差异，且 AGENTS.md 第 93 行被误替换成 `.Codex/agents/`）。因此 T1–T6 全部先在 `CLAUDE.md` 上做，T7 再整体同步。

### A 组：CLAUDE.md 主体（同一文件，**必须串行**）

| 编号 | 优先级 | 目标文件 | 复杂度 | 依赖 | 并行 | 说明 |
|---|---|---|---|---|---|---|
| **T1** | P0 | `CLAUDE.md` §Project Overview / §Commands / §Directory Rules | medium | 无 | ❌ | ① 删除 "Connects to an OpenClaw AI gateway over WebSocket"，改为「进程内自建 Agent（`electron/agent/`），通过 OpenAI 兼容 HTTP + SSE 直连 LLM 网关（CPA，默认模型 `MiniMax-M2`）」。② `npm test` 实为 `jest tests/unit/`；补 `npm run test:unit` / `test:integration`（需 `CPA_API_KEY`，否则 skip）/ `test:all`。③ 单文件示例 `npx jest tests/responseParser.test.ts` 改为 `npx jest tests/unit/ooc-detector.test.ts`（前者在 `tests/` 根目录，默认 `npm test` **不覆盖**）。④ Directory Rules 补 `electron/agent/`、`electron/logger.ts`、`electron/utils/`；`data/` 说明改为「开发期 `data/settings.json` + `data/soul-link.db`；打包后落在 `userData/`（`config.json`、`soul-link.db`、`logs/`）」。 |
| **T2** | P0 | `CLAUDE.md` §Architecture → 新 §Agent (Main Process) | large | T1 | ❌ | **整节删除** "### OpenClaw Bridge (Main Process)"（client.ts / worker.ts / config.ts / types.ts / BridgeWorker 启动流程）。替换为 `electron/agent/` 9 模块事实描述：`index.ts`（`SoulLinkAgent`：initialize → sendMessage → OOC 重试 ≤2 次 → 保存 → 异步 postProcess）、`llm-client.ts`（SSE 流式，30s 超时，网络重试 ≤2）、`character-engine.ts`（SillyTavern V2 卡 → system prompt）、`context-manager.ts`（滑动窗口 + token 预算）、`compressor.ts`（>30 条触发摘要）、`memory-store.ts`（长期记忆）、`session-store.ts`（**sql.js / WASM**，非 better-sqlite3）、`ooc-detector.ts`、`token-counter.ts`、`tag-utils.ts`。启动流程改为 `main.ts:launchMainApp()` 构造 `SoulLinkAgent`（`maxTotalTokens 8000 / systemPromptBudget 2000 / outputReserve 500`）→ `initialize()` → 向 petWindow 推 `agent:ready`。 |
| **T3** | P0 | `CLAUDE.md` §IPC Channels + §Response Pipeline | large | T2 | ❌ | ① IPC 列表按 `electron/ipc.ts` 逐条重列：`agent:ready/waiting/delta/final/error/message-saved`（main→renderer）、`agent:send/get-history/reset/test-connection/get-status`、`settings:get/set/changed`、`pet:mouse-enter/leave`、`companion:nudge/status`、`window:toggle-chat/open-settings/open-history`、`onboarding:complete`、`app:relaunch/get-version`、`cards:list`。② **必须写明两个易踩的事实**：(a) `agent:delta` 载荷的 `delta` 字段发送的是**累计全文**而非增量（`agent/index.ts` streamOnce 内 `callbacks.onDelta?.(messageId, fullText)`）；(b) `agent:*` 事件仅推送给 **petWindow**，chat window 不接收。③ 如实记录「未纳入 `IPC` 常量表的裸字符串通道」：`chat:open`、`settings:open`、`window:close`、`window:close-history`、`pet:move-window`、`pet:save-position`、`pet:resize-window`、`pet:set-clickthrough`、`pet:set-focusable`（`preload.ts` 注释里有，`ipc.ts` 里没有）。④ Response Pipeline 图重画为双消费者：`useChat.sendMessage → send('agent:send')` → Agent → `agent:waiting/delta/final` →（路径 A）`ChatBubbleFeedback` 订阅三事件 → `protocolFilter`(systemFilter + oocDetector + tagExtractor) + `bubbleParser` → 打字机气泡 + `petStore`；（路径 B）`useAgent` 订阅 `agent:ready/final` → `responseParser` → `chatStore` + `emotionMapper` → `petStore.addFV`。删除所有 `bridge:message` / `useBridge` 字样。 |
| **T4** | P0 | `CLAUDE.md` §Settings / §Windows / §Companion / §Full Architecture Reference | medium | T3 | ❌ | ① Settings schema 按 `electron/store/settings.ts` 改为 `{ cpa{baseUrl,apiKey,model}, character{cardName}, companion{enabled,idleMinutes,mode}, pet{character,positionX,positionY,scale}, ui{language,theme}, onboarding{completed,completedAt?} }`，并说明存在 `0.2.0` electron-store migration（`openclaw` → `cpa`，这是 `openclaw` 一词唯一合法的残留位置）。② Windows 补 `electron/windows/onboardingWindow.ts` 与首启判定 `utils/onboardingGuard.ts`。③ Renderer state 中 `settingsStore.ts` 的描述改为「遗留未使用（全仓无引用），字段仍是 gatewayWsUrl/authToken/sessionKey，见 TODO」。④ `docs/SOUL_LINK_MIGRATION.md` 路径错误 → 真实路径 `docs/2603/SOUL_LINK_MIGRATION.md`（745 行，**内容属 OpenClaw 时代，仅作历史留痕**）；权威架构指向按 §4 R1 结论填写。 |
| **T5** | P0 | `CLAUDE.md` 新增 §Known Gaps（代码缺口，非文档问题） | medium | T4 | ❌ | 新开一节，逐条列明并给出证据位置，**不得与「已实现」混写**：<br>① `res/sprites/baiyuan/frames/` 为空（0 文件），而 `manifest.json` 引用 11 组动画共约 26 帧 → 桌宠目前只能走占位渲染；<br>② `electron/main.ts:466` `// TODO: wire companion nudge to agent...` → `CompanionScheduler` 只向 petWindow 推固定文案（`NUDGE_MESSAGES`），**未经过 Agent**，且渲染端没有 `companion:nudge` 监听者；<br>③ `src/i18n/zh-CN.json` / `en.json` 第 18/89/131 行仍是「OpenClaw 网关」用户可见文案；<br>④ `src/utils/emotionMapper.ts:5,10` 与 `src/pet/expressions/ExpressionRenderer.ts:4` 仍写「integrate OpenClaw image generation」；<br>⑤ `src/App.tsx:14` 注释仍写 `useBridge`；<br>⑥ `src/stores/settingsStore.ts` 为死代码；<br>⑦ `tests/` 根目录 6 个 legacy 测试（emotionMapper / oocDetector / protocolFilter / responseParser / systemFilter / tagExtractor，共 57 用例）**被默认 `npm test` 静默跳过**；<br>⑧ 仓库无 ESLint 配置、无 eslint 依赖。 |
| **T6** | P0 | `CLAUDE.md` §Subagent Orchestration | medium | T5 | ❌ | **决策：保留，但精简 + 修正**（理由见 §4 R2 上方说明）。具体：保留「主对话禁止改 `electron/`、`src/`」与 5 阶段流程；删除与 `.claude/agents/*.md` 重复的职责描述（Phase 1–5 每段的 bullet 细节改为一行触发条件 + 一行产出）；Routing Rules 表与 Single-Module Shortcuts 保留；**修正 Phase 5 的 `npx eslint .`**（按 §4 R8 结论：改为 `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.node.json --noEmit`、`npm test`、`npm run build:renderer && npm run build:main`，ESLint 标注为 backlog）；补一句「仅改 `*.md` / `docs/` 时不需要 Phase 3 实现代理」。 |

### B 组：AGENTS.md 同步

| 编号 | 优先级 | 目标文件 | 复杂度 | 依赖 | 并行 | 说明 |
|---|---|---|---|---|---|---|
| **T7** | P0 | `AGENTS.md` | small | T1–T6 全部完成 | ❌ | 以最终 `CLAUDE.md` 为准整体同步，仅保留两处差异：标题 `# AGENTS.md`、首行「provides guidance to Codex」。**必须修回**当前第 93 行的 `.Codex/agents/` → `.claude/agents/`。优先级为 P0 而非 P2：`electron-dev` / `frontend-dev` 通过 `codex exec` 写代码，Codex 读的正是这份文件。 |

### C 组：6 个 subagent 定义（**彼此独立，可全部并行** ⚡）

| 编号 | 优先级 | 目标文件 | 复杂度 | 依赖 | 并行 | 说明 |
|---|---|---|---|---|---|---|
| **T8** | **P0** | `.claude/agents/architect.md` | medium | §4 R1/R3 结论 | ⚡ | 危害最大的一份。① Tech Stack "AI Backend: OpenClaw gateway via WebSocket (JSON-RPC-like protocol)" → 「进程内 Agent + OpenAI 兼容 HTTP/SSE」；Storage 补 `sql.js`(WASM) SQLite（路径由 `utils/paths.ts:getDBPath()` 决定）。② 原则 4 模块边界中的 `electron/bridge/` → `electron/agent/`。③ **整节重写 "Key Interfaces to Preserve"**——现有三条（`bridge:message → useBridge` 管线、"Bridge lifecycle: BridgeWorker manages connect → list cards → import → start roleplay. Do not break this sequence."、settings 含 `openclaw` 段）**会主动指使未来的 agent 重建已删除的代码**。替换为：`agent:*` 事件契约（含 delta = 累计全文语义）、`SoulLinkAgent` 生命周期（initialize → sendMessage → dispose）、settings 六段 schema（cpa/character/companion/pet/ui/onboarding）。④ Rules 末条 "maintain ... bridge lifecycle integrity" 同步替换。 |
| **T9** | P0 | `.claude/agents/code-reviewer.md` | medium | §4 R5/R6 结论 | ⚡ | ① "Project Architecture" checklist 三条全错（bridge:message → parser → stores / BridgeWorker lifecycle / settings 不得重构）→ 替换为 agent 版本。② "No direct `ipcRenderer.send()` — all calls go through preload bridge" 与现状冲突：`preload.ts` 暴露的是**无 allowlist 的通用 send/invoke/on**，渲染端到处直接写字符串通道 —— 需按 §4 R5 结论改写为可执行标准。③ "Error responses use `{ success, data?, error? }`" 与现状冲突：仅 `agent:test-connection` 遵守，`settings:get`、`agent:get-status`、`cards:list` 均直接返回值 —— 标注为「目标态，存量不回改」。④ Rules 末行 `npx eslint .` 按 R8 处理。 |
| **T10** | P1 | `.claude/agents/electron-dev.md` | medium | 无 | ⚡ | ① description 中 "BridgeWorker" 移除。② Project Context 文件清单：删 `bridge/client.ts` `bridge/worker.ts` `bridge/config.ts` `bridge/types.ts`，补 `agent/`（9 文件）、`logger.ts`、`utils/paths.ts`、`utils/onboardingGuard.ts`、`windows/onboardingWindow.ts`。③ IPC 示例常量 `BRIDGE_MESSAGE` / `BRIDGE_SEND` → `AGENT_FINAL` / `AGENT_SEND`。④ Allowed Bash 中的 eslint 按 R8 处理。⑤ `codex exec --model gpt-5.4-mini` 需 owner 确认（见 R7）。 |
| **T11** | P1 | `.claude/agents/frontend-dev.md` | medium | 无 | ⚡ | ① "`useBridge` hook — Listens to `bridge:message` IPC" → `useAgent`（`src/hooks/useAgent.ts`，订阅 `agent:ready` / `agent:final`）。② 数据流图改为 T3 的双消费者版本，补 `ChatBubbleFeedback` 直订阅 `agent:waiting/delta/final`。③ `settingsStore.ts — Gateway config` → 标注遗留未使用。④ 目录清单补 `src/utils/`（protocolFilter / systemFilter / tagExtractor / oocDetector / bubbleParser）、`src/onboarding/`、`src/toolbar/`、`src/themes/`、`src/i18n/`、`src/pet/expressions/`。⑤ eslint 同 R8。 |
| **T12** | P1 | `.claude/agents/pm-planner.md` | small | 无 | ⚡ | "connecting to an OpenClaw AI gateway over WebSocket" 与 Project Context 中 "BridgeWorker (OpenClaw WebSocket)" → agent 版本；`Assets (res/)` 一条补注「sprites frames 目前为空」。 |
| **T13** | P1 | `.claude/agents/test-build.md` | medium | §4 R8 结论 | ⚡ | ① "**Lint**: ESLint" 与两处 `npx eslint .` → 按 R8 结论移除或标 backlog。② "Tests: Jest ... → `tests/`" 改为「`npm test` 仅跑 `tests/unit/`；`tests/` 根目录 6 个 legacy 文件需 `npm run test:all`；`tests/integration/` 需 `CPA_API_KEY` 且须 `--runInBand`」。③ 单文件示例同 T1。④ Type check 拆成两个 tsconfig（`tsconfig.json` for src / `tsconfig.node.json` for electron）。⑤ Common Issues 补一条：`sql.js` 的 `sql-wasm.wasm` 依赖 `electron-builder.yml` 的 `asarUnpack: "**/sql.js/**"`，动此配置会导致打包后 Agent 初始化失败。 |

### D 组：文档一致性收尾

| 编号 | 优先级 | 目标文件 | 复杂度 | 依赖 | 并行 | 说明 |
|---|---|---|---|---|---|---|
| **T14** | P1 | `README.md` | small | T4 | ⚡（与 C 组并行） | 第 30 行目录树里的 `bridge/ （历史遗留，可忽略）` —— 该目录**已不存在**，删除；第 242 行 `docs/SOUL_LINK_MIGRATION.md` → `docs/2603/SOUL_LINK_MIGRATION.md`。 |
| **T15** | P2 | `docs/ARCHITECTURE.md`（新建） | large | §4 R1 结论为「外置」时才执行 | ❌ | 由 `docs/2604/AGENT_ARCHITECTURE.md`（536 行设计稿）提炼为「当前实现」版单一权威架构文档；`CLAUDE.md` 只留摘要 + 链接。若 R1 结论为「内联」则本任务取消。 |
| **T16** | P2 | `docs/current/TODO-0407.md` | small | T5 | ⚡ | 该文件写 "Session store — SQLite (**better-sqlite3**)"，实际实现是 `sql.js`；顺手修正，避免与新 CLAUDE.md 互相矛盾。 |

## 4. Technical Risks（需 architect 复核）

- **R1（必须先裁决）— 权威架构描述放哪里。** 候选：(a) `CLAUDE.md` 内联全部架构（现状，约 90 行）；(b) `CLAUDE.md` 只留「事实卡片」（目录/命令/IPC 常量表/settings schema，约 40 行）+ 指向新建 `docs/ARCHITECTURE.md`。**pm 倾向 (b)**：agent-facing 文件越短越不容易再次腐化，且 `docs/2604/AGENT_ARCHITECTURE.md` 是设计稿而非实现描述，不宜直接当权威。此决策直接决定 T4 的链接目标与 T15 是否执行。
- **R2 — `architect.md` 的 "Key Interfaces to Preserve" 是主动有害指令。** 现文明令 "Do not break this sequence" 保护 `BridgeWorker` 生命周期、并要求 settings 的 `openclaw` 段「只扩展不重构」。任何遵守它的 agent 都会拒绝 4 月那次迁移、甚至试图恢复 `electron/bridge/`。需 architect 给出替换后的「必须保持的接口」权威清单（建议至少含：`agent:*` 事件名与载荷、delta = 累计全文、`SoulLinkAgent` 三段生命周期、settings 六段 schema 与 0.2.0 migration 不可删）。
- **R3 — 同类有害指令还有 3 处**，需一并确认替换文案：`code-reviewer.md` 的 "BridgeWorker lifecycle not broken" 与 "Response pipeline integrity preserved (bridge:message → parser → stores)"；`architect.md` Rules 末条；`electron-dev.md` 的 bridge 文件清单（会让 Codex 去改不存在的文件，或凭空创建）。
- **R4 — `agent:*` 只发 petWindow。** 文档应如实描述；但 chat window（`src/chat/ChatWindow.tsx`）依赖 `chatStore`，而 `useAgent` 在 chat window 内订阅不到事件 —— 这是**功能缺陷还是有意设计**（气泡为唯一出口）需 architect 判定；判定结果决定是写进 §Known Gaps 还是写成正常架构。
- **R5 — preload 无 channel allowlist。** `preload.ts` 明确注释「渲染端是可信一方，故不做 allowlist」，与 `code-reviewer.md` 的 Electron 安全清单「Preload exposes only necessary APIs」直接冲突。请 architect 裁决：接受现状并改写审查条目，还是保留条目并出安全 backlog（涉及 `electron/` 改动，需另走流程）。
- **R6 — IPC 常量表不完整。** 9 个 `pet:*` / `window:close*` / `chat:open` / `settings:open` 通道是裸字符串，而两份 agent 文档都写「ALL channels MUST be constants in `electron/ipc.ts`」。文档必须二选一：如实标注为已知偏差，或把补齐常量列为 backlog。
- **R7 — Codex 调用参数是否仍有效。** `electron-dev.md` / `frontend-dev.md` 写死 `codex exec --approval-mode auto-edit --model gpt-5.4-mini`，停更 5 个月后需 owner 确认模型名与参数仍可用；否则 Phase 3 会直接失败。属配置风险，非文档事实错误。
- **R8 — ESLint 缺失的处理方式（二选一，需拍板）。** 已核实：仓库根无任何 eslint 配置文件，`package.json` 无 eslint 依赖，`node_modules` 无 eslint 包，`node_modules/.bin` 无 eslint 可执行。方案 A：从 `CLAUDE.md` Phase 5、`test-build.md`、`code-reviewer.md`、两个 dev agent 中移除 eslint 步骤，并在 §Known Gaps 记一条「无 lint 工具链」backlog（推荐，纯文档，本次可闭环）。方案 B：引入 ESLint 配置 —— 属代码/依赖改动，必须另开需求走完整 5 阶段，不在本次范围。

## 5. Acceptance Criteria

1. `grep -rni "openclaw\|bridgeworker\|usebridge\|bridge:message\|bridge:send\|bridge:session\|electron/bridge" CLAUDE.md AGENTS.md .claude/agents/` 结果为空，**唯一允许的例外**：`CLAUDE.md`/`AGENTS.md` settings 章节中说明 electron-store `0.2.0` migration 时提及的 `openclaw` 旧键（须明确标注「legacy migration only」）。
2. 三份文档中出现的每一个仓库路径都能 `ls` 命中；特别是 `docs/2603/SOUL_LINK_MIGRATION.md`（不是 `docs/SOUL_LINK_MIGRATION.md`）。
3. `CLAUDE.md` 的 IPC 章节与 `electron/ipc.ts` 的常量集合**逐条一一对应**（无遗漏、无多余），且裸字符串通道被单独列出。
4. `CLAUDE.md` 的 settings schema 与 `electron/store/settings.ts` 的 `SoulLinkSettings` 接口字段完全一致（六段、字段名、`companion.mode` 四个枚举值）。
5. `CLAUDE.md` §Commands 中每条命令都能在 `package.json` `scripts` 找到对应项；示例测试文件在默认 `npm test` 范围内真实存在。
6. 新增 §Known Gaps 至少覆盖 T5 列出的 8 条，每条带可验证证据（文件路径或 `file:line`）。
7. `diff CLAUDE.md AGENTS.md` 的差异仅剩标题行与首段「Claude Code / Codex」表述。
8. `.claude/agents/*.md` 中不再存在任何要求保持 bridge 生命周期 / bridge 响应管线的语句；`architect.md` 的「Key Interfaces to Preserve」全部指向真实存在的接口。
9. 所有文档中不再出现 `npx eslint`（若采纳 R8 方案 A）；`test-build.md` 的命令在仓库中实跑不报「找不到命令 / 找不到配置」。
10. 文档描述与代码状态的一致性检查通过 `code-reviewer` 复核（Phase 4，read-only 抽查 5 条事实即可）。
11. 未夹带任何 `electron/` / `src/` 下的文件改动（`git status` 仅显示 `*.md`）。

## 6. 建议执行顺序

```
Step 0  Phase 2 — architect 裁决 R1 / R2 / R3 / R4 / R5 / R8（一次性输出 6 条结论）
        ⤷ 阻塞 T4、T5、T6、T8、T9、T13；不阻塞 T1、T2、T3、T10、T11、T12、T14
Step 1  ⚡并行：A 组起步（T1 → T2 → T3，串行同文件）
        ⚡同时：T10、T11、T12、T14（不依赖裁决）
Step 2  裁决落地后：T4 → T5 → T6（串行，同文件）
        ⚡同时：T8、T9、T13（三份 agent 文件互不相干，可并行）
Step 3  T7（AGENTS.md 整体同步）— 必须等 A 组全部定稿
Step 4  T15（仅当 R1 结论为「外置」）、T16
Step 5  Phase 4 — code-reviewer 按 §5 的 11 条验收；Phase 5 — test-build 仅需确认无源码改动
        （本次不涉及编译产物变化，`npm run build` 可跳过，只跑 tsc + npm test 做回归）
```

**Backlog（不在本次范围，各自需重新走完整 5 阶段）**：sprite 帧资源补齐；companion nudge 接入 Agent（`main.ts:466`）；i18n OpenClaw 文案替换（`frontend-dev`）；删除死代码 `src/stores/settingsStore.ts`；legacy 测试迁入 `tests/unit/` 或改 `npm test` 覆盖范围；ESLint 工具链引入；IPC 裸字符串通道补入 `ipc.ts` 常量表。
