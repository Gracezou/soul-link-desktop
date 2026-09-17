# G1 — 引导页软门禁：「稍后配置」（实现需求书）

> 交付对象：`electron-dev` + `frontend-dev` · Phase 2 architect 产出 · 2026-09-17
> 上游依据：[`RELEASE_PLAN.md`](./RELEASE_PLAN.md)「G1」· [`TODO.md`](./TODO.md)「G · 引导流程」·
> [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §2 / §3 / §5 / §6 / §9
> 修订 2026-09-17（实现审查后）：§4.2 缺字段容错、§5.2 `.skipHint`、§6.1 A4/A4b、§6.2 M8/M8b
> 目标文件：`electron/` 5 个、`src/` 9 个（含 1 个新组件与 2 个 i18n 文件）、`tests/unit/` 2 个，清单见 §5

## 0. 结论速览

| # | 设计点 | 决定 |
|---|---|---|
| 1 | 未配置时 Agent 要不要构造 | **照常构造、照常 `initialize()`**，由 Agent 自己在 `sendMessage()` 入口拦截，**在保存用户消息之前**报错返回 |
| 2 | 怎么告诉渲染端 | **不新增通道**。`agent:ready` 与 `agent:get-status` 的载荷各加一个字段 `llmConfigured: boolean`（只加不改） |
| 3 | 之后填了网关怎么生效 | **只靠现有的重启路径**，不做热更新。已逐步核对，「从未配置到已配置」这条路径能走通 |
| 4 | `completed: true` 但 key 为空的老用户 | **允许进主界面**，看到的「未配置」提示与「稍后配置」的用户完全相同 |
| 5 | legacy 迁移 | **代码上没有交互，迁移一行不改**。迁移后 `onboarding.completed` 保持原值（旧文件里没有这个键时取默认值 `false`）。F9 要补两条用例 |
| 6 | 「稍后配置」放哪 | **只放在 ConnectionStep**，只跳过这一步。CharacterStep、CompanionStep 照常走，完成时仍只由 `handleFinish` 一处写库 |

## 1. 问题

`ConnectionStep.tsx:53` 的 `canProceed = testResult?.success === true`，加上 `needsOnboarding()` 在
`baseUrl` 或 `apiKey` 为空时强制进入引导，结果是**连接测试不通过，用户就永远出不了引导页**。

### 1.1 对派工判断的补正：放行后的失败形态比「请求失败」更糟

派工简报说「用户一发消息就撞上请求失败」，实际核对到的情况更严重。如果只放宽门禁、不做任何拦截，会出现下面这条链：

1. `PetApp` 的 `CompactInput` **不检查** `sessionReady`，任何时候都能发出 `agent:send`
2. `SoulLinkAgent.sendMessage()` 先调 `onWaiting`，气泡进入「···」状态，**随后 `saveMessage(user)` 写入数据库**
3. `LlmClient` 请求 `fetch('' + '/chat/completions')`。相对 URL 在 Node 里会抛 `TypeError`，而
   `isNetworkError()` 把所有 `TypeError` 都当成网络错误，所以会**重试到上限**后才调用 `onError`
4. `agent:error` 发给了 pet 窗口，但 pet 窗口**没有任何监听者**（ARCHITECTURE §9-A3），气泡**一直停在「···」**
5. 被保存的用户消息没有配对的回复。等用户配好网关后，这些消息会作为连续的 user 消息**回灌进上下文**

所以拦截点必须在 `saveMessage` **之前**，只在渲染端拦截不够（第 4 步的竞态以及 chat 窗口都会漏过去）。这就是 D1 把拦截放进 Agent 的原因。

### 1.2 对派工判断的补正：「渲染端自己读 settings」不可行

Agent 用的是 `launchMainApp()` 时刻的 settings **快照**。用户在设置页保存后如果不重启，
`settings:get` 读到的是新值，而 Agent 里仍是旧值。渲染端据此判断「已配置」会和 Agent 的实际状态不一致。
另外 `src/` 不能 import `electron/`，判定逻辑得在两个进程里各写一份。见 D2。

## 2. 范围

### 要做

1. `needsOnboarding()` 只看 `onboarding.completed`
2. Agent 暴露「LLM 配置是否齐全」，未配置时在 `sendMessage()` 入口拒绝
3. `agent:ready` / `agent:get-status` 载荷加 `llmConfigured`
4. 引导页 ConnectionStep 加「稍后配置」按钮
5. pet 窗口的 `CompactInput` 和 chat 窗口的 `ChatWindow` 在未配置时显示提示，并提供「打开设置」按钮
6. 单测：门禁判定、Agent 拦截

### 明确不做（各自已有归属，不要顺手改）

| 不做 | 归属 |
|---|---|
| `settings:set` 后热更新 Agent，免去重启 | ARCHITECTURE §9-B P1 · `BACKLOG.md`「内部质量」 |
| `agent:*` 广播到 chat 窗口；本任务**不新增任何发往 `mainWindow` 的 send** | C1（0.3.0） |
| 设置页改版；ConnectionSection 的「连接成功（尚未保存）」文案缓解 | E2 · §9-B P1 |
| 气泡监听 `agent:error`；「已配置但网关不可达」时气泡卡在「···」 | E1（0.3.0，范围内已含 errors） |
| 修改 `0.2.0` migration、settings schema，或新增 `onboarding.skipped` 之类字段 | 不做。「已配置」由 `cpa` 三个字段推导，另存一个标志会与实际值漂移 |
| macOS `activate` 绕过 `needsOnboarding` | ARCHITECTURE §8 P2 |
| i18n 里的 OpenClaw 文案、`agent:test-connection` 复用 `LlmClient` | `BACKLOG.md` |
| CompanionScheduler 在未配置时的行为 | 保持不变。nudge 本来就没有监听者（C3，0.4.0） |
| 首次启动后弹窗提醒去配置 | 不做。聊天入口的提示已经够用 |

## 3. 设计决定

### D1 — Agent 照常构造，由 Agent 自己拦截

候选方案对比：

| 方案 | 问题 |
|---|---|
| 未配置时不构造（`agent = null`） | `agent:get-history` 返回 `[]`，清空过 key 的用户会看不到历史；`agent:ready` 不再发出；以后做热更新还要补一条「从无到有」的构造路径 |
| 构造，但只在 `main.ts` 的 `AGENT_SEND` 里拦截 | 能用，但拦截逻辑写在无单测的 `main.ts` 里；还得额外维护一份和 Agent 快照一致的判定变量 |
| **构造，Agent 自己拦截（选定）** | — |

选定理由：

- **Agent 的 `config` 本身就是快照**，由 Agent 判定就不存在「判定值与实际配置不一致」的问题
- `initialize()` 不访问网络，但会加载 sql.js WASM、读取角色卡。**0.2.0 的退出标准不依赖网关**，照常构造就能在没有网关的全新安装上继续验证打包态的 `asarUnpack` / sql.js 加载（ARCHITECTURE §6「打包依赖」）。跳过构造等于丢掉这条验证
- `agent:ready.ready` 的语义保持不变，仍表示「数据库和角色卡已就绪」。「LLM 可用」是另一个维度，用另一个字段表达（D2）
- 符合 `electron/agent/` 零 Electron 依赖、可整体外提的约束。配置校验本来就是服务自身的职责
- 可以直接沿用 `tests/unit/agent.test.ts` 现有的替换内部依赖写法做单测

**「已配置」的判定**：`baseUrl`、`apiKey`、`model` 三者 `trim()` 后都非空；**字段缺失（`undefined`）按空串处理**。
比旧门禁多检查了 `model`。原因是引导页和设置页的「测试连接」按钮在 `!model` 时都是禁用的，而空 model 的请求必然失败，判定条件应与按钮保持一致。
**它不表示网关可达**，本任务不做任何网络探测。

### D2 — 给现有载荷加字段，不新增通道

- **不选新通道**：「LLM 是否已配置」是 Agent 状态的一部分，已经有 `agent:ready`（推送）和 `agent:get-status`（查询）这对通道。新开通道还会再遇到一次「只发 pet 窗口」的问题
- **不选渲染端读 settings**：理由见 §1.2
- **chat 窗口不需要 C1 也能拿到这个值**：`agent:get-status` 是 invoke，任何窗口都能调。`useAgent` 挂载时已经会调一次，chat 窗口靠它就能显示提示。**本任务不往 chat 窗口推送任何事件**，与 C1 没有冲突
- **与 C1 和热更新向前兼容**：C1 广播 `agent:ready` 后，chat 窗口会多一个数据来源，字段形状不用变。热更新落地时只需在重建 Agent 后重新发一次 `agent:ready`。前提是渲染端遵守 §4.3，**每收到一次 `agent:ready` 都要更新这个值**，不能只取第一次

### D3 — 只靠重启路径

逐步核对（`ConnectionSection.tsx` / `main.ts` / `onboardingGuard.ts`）：

1. 用户通过「稍后配置」完成引导，`onboarding.completed = true`，`cpa` 为空
2. 启动后 `needsOnboarding()` 返回 false（G1 之后），进入 `launchMainApp()`，Agent 处于未配置状态
3. 在 pet 工具栏点 ⚙️（或在提示里点「打开设置」），设置窗口的**默认标签页就是 `connection`**（`SettingsPanel.tsx:14`）
4. 填写后保存：输入框从空变为有值，`changed` 为 true，出现重启横幅。点「立即重启」发出 `app:relaunch`，执行 `app.relaunch()` + `app.quit()`
5. 重启后 `completed` 为 true，直接进入 `launchMainApp()`，Agent 用新快照构造，`llmConfigured = true`

**能走通，G1 不需要热更新。** 已知的两个细节：

- 用户点了「稍后重启」时，提示会一直显示到重启为止。提示文案因此写明「保存后重启生效」（§5.2 i18n），不另做状态
- 开发态由 `electronmon` 托管，`app.relaunch()` 在这个环境下的行为没有验证过。**重启路径的手工验收以打包产物为准**（§6.2 M5）

### D4 — `completed: true` 但 key 为空时进主界面

会处于这个状态的只有三类用户，全部由同一套「未配置」提示覆盖，不需要特殊处理：

| 来源 | 说明 |
|---|---|
| 引导时点了「稍后配置」 | 本任务的设计目标 |
| 在设置页清空了 key 并重启 | 以前重启后会被踢回引导页，现在进主界面并显示提示 |
| legacy 迁移后的 0.1.x 开发机 | 见 D5 |

想重新走引导的用户仍然可以用「关于 → 重新运行初始化引导」（`AboutSection.tsx:19` 会把 `completed` 置回 false 并重启），这条路径不变。

### D5 — legacy 迁移：不改代码，F9 补两条用例

已核对 `conf@10.2.0`（`electron-store@8.2.0` 的底层实现）：

- 构造时先把 `defaults` 和文件内容做**顶层浅合并**（`Object.assign({}, defaults, fileStore)`），**然后**才执行 migration
- `'0.2.0'` migration 只在检测到 `openclaw` 时运行：**无条件写入 `cpa.baseUrl = ''`**，`apiKey` 取自 `authToken`，写入 `character` 并删除 `openclaw`。**不会碰 `onboarding`**
- 迁移在 `package.json` 版本 ≥ `0.2.0` 时才执行（F8 bump 之后）。全新安装也会执行一次，但因为没有 `openclaw` 键，实际什么都不做

迁移后的状态（`onboarding` 是在 `a27d75f` 才加进 schema 的，所以两类旧文件都可能存在）：

| 旧 `settings.json` | 迁移后 | G1 之前 | G1 之后 |
|---|---|---|---|
| 有 `openclaw`，且 `onboarding.completed: true` | `cpa{baseUrl:'', apiKey:<authToken>}`，`completed: true` | 引导页 | **主界面 + 未配置提示** |
| 有 `openclaw`，没有 `onboarding` 键（早于 `a27d75f`） | `completed: false`（取默认值） | 引导页 | 引导页（ConnectionStep 预填 `apiKey`，`baseUrl` 为空） |
| 没有 `openclaw` | 不变 | — | — |

两点说明：

- 迁移过来的 `apiKey` 是 OpenClaw 的 WebSocket token，不是 CPA 的 key。**`baseUrl` 必然为空，所以 `llmConfigured` 一定是 false**，这个过期 token 不会被发到任何地方。归为「未配置」是正确的
- `0.1.0` 从未发布过，这些情况只会出现在开发机上

**G1 不得修改 migration**（CLAUDE.md 的硬约束），F9 追加 §6.3 里的两条用例。

### D6 — 「稍后配置」只放在 ConnectionStep，只跳过这一步

- **放在哪**：ConnectionStep。Welcome 负责语言和主题，不依赖网关，没有理由跳过；Character 和 Companion 同样不依赖网关，也不需要跳过
- **点了之后**：进入 CharacterStep，**与「下一步」的去向相同**，只是不要求测试通过。`handleFinish` 仍是唯一的写库点，不另开一条「直接完成」的分支，不会写出两套 settings
- **已填的值保留**：点「稍后配置」时，表单里已经填了的值会照常由 `handleFinish` 保存。典型场景是网关宕机时用户已填好正确的地址和 key：保留这些值，网关恢复后重启就能直接用，不用再填一遍。代价见 §9 第 2 条
- **「下一步」不变**：仍要求 `testResult?.success === true`
- **对退出标准的影响**：RELEASE_PLAN 退出标准第 2 条的实际操作是「Welcome 下一步 → **稍后配置** → Character 下一步 → Companion 完成」，比原文多两次点击。建议改写原文，见 §9 第 1 条

## 4. 接口契约

### 4.1 IPC：不新增通道，只给两个载荷加字段

| 通道 | 方向 / 机制 | 变更前 | 变更后 | 发送方 / 接收方 |
|---|---|---|---|---|
| `agent:ready`（`IPC.AGENT_READY`） | main → renderer，send | `{ ready: boolean; character: string }` | `{ ready: boolean; character: string; llmConfigured: boolean }` | `launchMainApp()`、`AGENT_RESET_SESSION` handler → **仅 petWindow**（不变） |
| `agent:get-status`（`IPC.AGENT_GET_STATUS`） | renderer → main，invoke | `() => { ready; character }` | `() => { ready: boolean; character: string; llmConfigured: boolean }` | 任意窗口的 `useAgent` |

- `electron/ipc.ts`：**不改**
- 字段语义：`llmConfigured` 表示**当前 Agent 实例**构造时 `baseUrl`、`apiKey`、`model` 在 `trim()` 后都非空。`agent` 为 null 时（例如引导窗口里调用）取 `false`
- 所有新增字段都是追加，现有消费者忽略它们也不会出错

### 4.2 类型与导出（`electron/agent/`）

```ts
// types.ts —— 在现有 AgentStatus 上加字段；agent:ready 与 agent:get-status 两个载荷都用这个类型
export interface AgentStatus {
  ready: boolean
  character: string
  /** Agent 构造时 baseUrl/apiKey/model 均非空。不代表网关可达。 */
  llmConfigured: boolean
}

// index.ts
export const LLM_NOT_CONFIGURED_ERROR = 'LLM not configured'

class SoulLinkAgent {
  isLlmConfigured(): boolean   // 读 this.config，纯判定，不访问网络
}
```

**字段缺失时的容错（2026-09-17 修订，审查 P1）**：electron-store 只补**顶层**缺失的键（`conf` 的浅合并）。
`settings.json` 里 `cpa` 对象存在但缺某个嵌套字段时，该字段在运行时是 `undefined`。
初版 `isLlmConfigured()` 直接调 `.trim()`，会在 `launchMainApp()` 里抛错，此时 pet 窗口和托盘已建好，但 `initialize()`、`agent:ready`、companion、`activate` 监听全部不会发生。
渲染端 `get-status` 被 reject，`llmConfigured` 停在 `null`，界面显示正常输入框，发出的消息没有任何反应。两层都要兜底：

- `isLlmConfigured()` 自身写成 `(x ?? '').trim()`。它是公共方法，不依赖调用方兜底；字段为 `undefined` 时返回 `false`，**不抛异常**
- `main.ts` 构造 Agent 时三个字段都写成 `settings.cpa.x ?? ''`。这样也顺带避开了 `LlmClient` 构造函数对 `baseUrl` 调 `.replace()` 的同类问题（G1 之前就存在）

`sendMessage()` 的新前置行为：`isLlmConfigured()` 为 false 时，**这是函数的第一条逻辑**，排在 `ensureSession()`、`onWaiting`、`saveMessage` 之前：

- 记一条 `this.log.warn('sendMessage:llmNotConfigured')`（**日志里不得带 baseUrl 或 apiKey 的值**）
- 调用 `callbacks.onError?.('', LLM_NOT_CONFIGURED_ERROR)`。`messageId` 取空串，与 `main.ts` 中 `!agent` 分支的现有约定一致
- `return`，不抛异常。即使 Agent 还没完成 `initialize()` 也不抛（`main.ts` 用 `void` 调用，抛出会变成未处理的 rejection）

### 4.3 渲染端约定

- `chatStore.llmConfigured: boolean | null`，初始值为 `null`，表示还没拿到状态
- **只有 `=== false` 时才显示未配置提示**。`null` 按正常输入处理：这段窗口只有几毫秒（`launchMainApp()` 会先同步构造 Agent，渲染端才加载完成），即使期间误发，也会被 Agent 拦下
- 每次 `agent:ready` 以及 `agent:get-status` 的结果都要更新这个值（**不能只取第一次**，热更新和 C1 依赖这一点），并且**不以 `ready` 为前提**

### 4.4 `preload.ts` 契约注释

更新顶部注释中的两行：

```
//   agent:ready          — { ready: boolean, character: string, llmConfigured: boolean }
//   agent:get-status     — returns { ready: boolean, character: string, llmConfigured: boolean }
```

## 5. 改动清单

### 5.1 `electron/` —— `electron-dev`

| 文件 | 位置 | 改动 |
|---|---|---|
| `electron/utils/onboardingGuard.ts` | `needsOnboarding()` | 改为 `return !settings.onboarding.completed`；重写 JSDoc，说明 G1 之后凭据不再作为引导门禁，未配置状态由 Agent 的 `llmConfigured` 表达 |
| `electron/agent/types.ts` | `AgentStatus` | 按 §4.2 增加 `llmConfigured` |
| `electron/agent/index.ts` | 模块顶部 | 导出 `LLM_NOT_CONFIGURED_ERROR` |
| 同上 | `SoulLinkAgent.isLlmConfigured()`（新增 public） | 按 D1 判定 |
| 同上 | `sendMessage()` 开头 | 按 §4.2 增加前置拦截 |
| `electron/main.ts` | `launchMainApp()` | 构造 Agent 时 `cpa` 三字段均以 `?? ''` 兜底（§4.2）；构造后，若 `!agent.isLlmConfigured()`，记 `mainLogger.warn('LLM not configured; chat disabled until connection is saved and the app restarts')`；`AGENT_READY` 载荷加 `llmConfigured` |
| 同上 | `IPC.AGENT_GET_STATUS` handler | 返回值加 `llmConfigured: agent?.isLlmConfigured() ?? false` |
| 同上 | `IPC.AGENT_RESET_SESSION` handler | `AGENT_READY` 载荷加 `llmConfigured` |
| 同上 | 上面三处 | 载荷显式标注为 `AgentStatus`（`import type { AgentStatus } from './agent/types'`），**漏写字段时由 tsc 报错**。`character` 的取值保持各处现状，不借机统一 |
| `electron/preload.ts` | 顶部注释 | 按 §4.4 更新 |

**不改**：`electron/ipc.ts`、`electron/store/settings.ts`（含 migration）、`IPC.AGENT_SEND` handler、`llm-client.ts`、`companion/`。

### 5.2 `src/` —— `frontend-dev`

| 文件 | 位置 | 改动 |
|---|---|---|
| `src/stores/chatStore.ts` | `ChatState` | 新增 `llmConfigured: boolean \| null`（初始 `null`）和 `setLlmConfigured(v: boolean)`。**不修改 `setSessionStatus` 的签名** |
| `src/hooks/useAgent.ts` | `AgentReadyStatus`、`get-status` 的 then、`agent:ready` 监听 | 类型加 `llmConfigured?: boolean`；两处都在 `typeof status?.llmConfigured === 'boolean'` 时调用 `setLlmConfigured`，**放在 `if (ready)` 判断之外**；依赖数组同步更新 |
| `src/hooks/useChat.ts` | `sendMessage()` | 增加 `llmConfigured === false` 时直接 return（防止 chat 窗口的 `isLoading` 被置 true 后卡住）；返回值加 `llmConfigured` |
| `src/chat/NotConfiguredHint.tsx`（新建） | 组件 | 一行提示 `chat.notConfigured` 加一个按钮 `chat.openSettings`，点击发送 `window:open-settings`（沿用现有常量，不新增通道）。样式放在 `chat.module.css` |
| `src/chat/CompactInput.tsx` | 渲染分支 | 从 store 读取 `llmConfigured`。`=== false` 时**用 `NotConfiguredHint` 替换输入行和 `PresetButtons`**，外层容器与 `visible` 相关的 class 保持不变；聚焦 effect 在此分支下不执行。**内容高度不得超过 `PetApp` 的 `INPUT_PANEL_HEIGHT`（110px）**，不改 `PetApp.tsx` |
| `src/chat/ChatWindow.tsx` | 输入区 | `llmConfigured === false` 时：在输入区上方渲染 `NotConfiguredHint`；输入框和发送按钮 `disabled`；placeholder 用 `chat.inputPlaceholderNotConfigured`。头部连接状态不变 |
| `src/onboarding/ConnectionStep.tsx` | props、`navRow` | 新增 prop `onSkip: () => void`；`navRow` 按「返回 / 稍后配置 / 下一步」排列，「稍后配置」使用 `btnSecondary`、**始终可点**；`navRow` 上方加一行小字 `onboarding.connection.skipHint`，使用**新增的 `.skipHint` 类**（在 `onboarding.module.css` 的 `.navRow` 之前：`font-size: 12px; line-height: 1.5; color: var(--text-muted); text-align: center; margin: -12px 0 0;`），**不要复用 `stepSubtitle`**（那是 14px 的标题副文案）。**`canProceed` 不变** |
| `src/onboarding/OnboardingWizard.tsx` | `<ConnectionStep>` | 传入 `onSkip={next}`。`handleFinish` **不改** |
| `src/i18n/zh-CN.json` / `en.json` | 新增键 | 见下表。**不要改动现有的 OpenClaw 文案行**（属于 backlog） |

| 键 | zh-CN | en |
|---|---|---|
| `onboarding.connection.skipBtn` | 稍后配置 | Set up later |
| `onboarding.connection.skipHint` | 跳过后桌宠照常出现，但暂时不能聊天；之后可在「设置 → 连接」中补填 | You can skip this — your pet still appears, but chat stays off until you fill this in under Settings → Connection |
| `chat.notConfigured` | 还没有配置 AI 连接，暂时不能聊天。在设置中填写并保存，重启后生效 | AI connection isn't set up yet. Fill it in under Settings, save, then restart the app |
| `chat.openSettings` | 打开设置 | Open Settings |
| `chat.inputPlaceholderNotConfigured` | 未配置 AI 连接 | AI connection not set up |

**不改**：`PetApp.tsx`、`ChatBubbleFeedback.tsx`、`src/settings/*`、`settingsStore.ts`。

### 5.3 `tests/unit/` —— 由改动对应模块的实现代理负责（均为 `electron-dev`）

| 文件 | 改动 |
|---|---|
| `tests/unit/onboarding-guard.test.ts` | 把「completed 但 baseUrl 为空 → true」「completed 但 apiKey 为空 → true」两条**改为期望 false** 并改标题；新增「completed 且 cpa 全空 → false」 |
| `tests/unit/agent.test.ts` | 新增 `describe('SoulLinkAgent LLM configuration gate')`，覆盖 §6.1 的 A4–A6 |

### 5.4 提交粒度建议

两个提交，按顺序，**每个提交单独都能通过 tsc 和 `npm test`**：

1. `feat: Agent 在未配置 LLM 时拒绝发送并在状态中上报` —— §5.1 + §5.3
   （这个提交单独合入时，引导页仍然要求测试通过，行为上没有问题）
2. `feat: 引导页可「稍后配置」，未配置时聊天入口给出提示` —— §5.2

## 6. 验收标准

### 6.1 自动化（`npm test`）

| # | 断言 |
|---|---|
| A1 | `needsOnboarding({ onboarding:{completed:false}, cpa:{完整} })` 为 `true` |
| A2 | `needsOnboarding({ onboarding:{completed:true}, cpa:{baseUrl:'', apiKey:'', model:'m'} })` 为 `false` |
| A3 | `needsOnboarding({ onboarding:{completed:true}, cpa:{baseUrl:'', apiKey:'k', model:'m'} })` 为 `false` |
| A4 | `new SoulLinkAgent(cfg).isLlmConfigured()` 的表驱动测试：`baseUrl`、`apiKey`、`model` 任一为 `''` 或只含空白 → false；三者都非空 → true；`'  https://x  '`、`' k '`、`'m'` → true |
| A4b | 三个字段分别为 `undefined`（构造后覆盖内部 `config`；直接以 `undefined` 的 `baseUrl` 构造会先在 `LlmClient` 构造函数里抛错，那不是本用例要测的）：`isLlmConfigured()` **不抛异常**且返回 `false`；`model` 为 `undefined` 时 `sendMessage()` 仍走 A5 的未配置路径 |
| A5 | 未配置、**未 `initialize()`** 的 Agent，替换 `sessionStore.saveMessage` 和 `llmClient.streamChat` 为 spy 后，`await agent.sendMessage('hi', cbs)` **正常 resolve**，并且：`onError` 恰好被调用 1 次，参数为 `('', LLM_NOT_CONFIGURED_ERROR)`；`onWaiting`、`onDelta`、`onFinal`、`onSaved` 都未被调用；`saveMessage` 和 `streamChat` 调用次数为 0；`log.warn` 以 `'sendMessage:llmNotConfigured'` 被调用，且调用参数序列化后不包含 apiKey 的值 |
| A6 | 已配置的 Agent：现有用例 `reports a non-empty thinking-only response…` 无需修改即可通过（拦截不影响正常路径） |

### 6.2 GUI 手工验收

**「清空 userData」的具体做法**（macOS）。**用改名备份，不要删除**，以免丢掉 Grace 本机的真实配置：

```bash
# 先完全退出应用（托盘「退出」或 ⌘Q）
# 打包态：
mv "$HOME/Library/Application Support/Soul Link Desktop" "$HOME/Library/Application Support/Soul Link Desktop.bak-g1"
# 开发态（package.json 没有 productName，Electron 用 name）：
mv "$HOME/Library/Application Support/soul-link-desktop" "$HOME/Library/Application Support/soul-link-desktop.bak-g1"
mv data/soul-link.db data/soul-link.db.bak-g1   # 开发态数据库不在 userData 里；想完全模拟全新安装时再移走
# 验收结束后改名还原。如果目录名和上面不一致，以 app.getPath('userData') 为准
```

Windows 打包态对应的目录是 `%APPDATA%\Soul Link Desktop\`。

| # | 步骤 | 期望 |
|---|---|---|
| M1 | 清空 userData 后启动 → Welcome「下一步」→ Connection **不填任何内容**，点「稍后配置」→ Character「下一步」→ Companion「完成」 | 引导窗口关闭，**pet 窗口出现并且可以拖动**；有 D1 帧资源时播放 idle，没有时显示占位图（动画本身是 D1/C2 的验收项） |
| M2 | 查看 userData 下的 `settings.json` | `onboarding.completed` 为 `true`，`cpa.baseUrl` 为 `""` |
| M3 | 悬停 pet → 点 💬 | 输入面板里**没有输入框**，显示未配置提示和「打开设置」按钮，面板内容没有溢出或被截断 |
| M4 | 点「打开设置」 | 设置窗口打开，并停在「连接」标签页 |
| M5 | **在打包产物上**：填入可用的网关 → 保存 → 横幅里点「立即重启」 | 应用重启，**不再出现引导页**。点 💬 显示正常输入框，发一条消息后气泡有回复。**这是唯一需要网关的用例**，网关不可用时只验到「输入框出现」为止，并如实记录 |
| M6 | 在 M1 的状态下直接退出再启动 | 不出现引导页，直接显示 pet 和未配置提示（旧门禁会强制进入引导页） |
| M7 | 在未配置状态下，通过托盘「打开聊天」打开 chat 窗口 | 输入框和发送按钮都是禁用状态，显示未配置提示。**托盘图标在 D2 完成前是空白的**，macOS 上可能点不到；点不到时把本项标为「阻塞于 D2」，不算失败 |
| M8 | 手工编辑 `settings.json`，设置 `completed: true`，并**只把 `cpa.apiKey` 的值改成 `""`，不要删除键** → 启动 | 进主界面，显示未配置提示（D4） |
| M8b | 手工编辑 `settings.json`，保持 `completed: true`，**删除 `cpa.model` 键**（其余字段保留有效值）→ 启动 | 与 M8 相同：进主界面、显示未配置提示；工具栏正常、托盘可用；ops 日志有 `LLM not configured` warn，**stderr 无未处理的 rejection**。用于直接验证 §4.2 的缺字段容错。⚠️ 之后打开设置页，模型输入框会预填默认值 `MiniMax-M2`，此时直接点保存**不会出现重启横幅**（`changed` 比较用的也是同一默认值）；但文件已补上 `model`，手动重启即生效。**这不是失败**，不要据此判 M8b 不通过 |
| M9 | 「设置 → 关于 → 重新运行初始化引导」 | 应用重启后回到引导页，「稍后配置」按钮仍然可用 |
| M10 | 行为确认，**不判定通过或失败**：Connection 填入格式正确但网关不可达的值 → 测试失败 → 点「稍后配置」→ 完成 | 这些值被保存，`llmConfigured` 为 true，显示正常输入框；发出消息后气泡停在「···」。这是 E1 的已知范围（§9 第 2 条），**审查时不要把它当作 G1 的缺陷** |
| M11 | M1 之后查看 `ops-*.jsonl` | 有一条 `LLM not configured` warn，内容不含 key |

### 6.3 追加给 F9（bump 到 `0.2.0` 之后才能验，G1 阶段无法验证）

| # | 构造的旧 `settings.json` | 期望 |
|---|---|---|
| F9-a | `{ "openclaw": { "authToken": "t", "defaultCard": "baiyuan" }, "onboarding": { "completed": true } }` | 迁移为 `cpa.apiKey="t"`、`cpa.baseUrl=""`，`openclaw` 键被删除；启动后**直接进主界面并显示未配置提示** |
| F9-b | `{ "openclaw": { "authToken": "t" } }`（没有 `onboarding` 键） | 迁移同上，`completed` 为 false；启动后**进入引导页**，ConnectionStep 中 API Key 已预填为 `t` |

### 6.4 回归

1. `npx tsc -p tsconfig.json --noEmit`、`npx tsc -p tsconfig.node.json --noEmit`、`npm test` 全部通过
2. `npm run build:renderer && npm run build:main` 通过（不涉及打包配置，除 M5 的验收外不要求执行 `npm run build`）
3. `git diff --stat` 只包含 §5 列出的文件；`git diff <基线> -- electron/ipc.ts electron/store/settings.ts` **为空**

## 7. 完成后回填（由主控执行）

- `EXECUTION_TRACKER.md` 的 G1 行：更新状态，Evidence 附上两个提交号
- `ARCHITECTURE.md`：
  - §2 启动流程：`needsOnboarding` 改为只看 `onboarding.completed`
  - §3 表格和 §6 Key Interfaces：`agent:ready`、`agent:get-status` 的载荷加 `llmConfigured`
  - §4 数据流：`sendMessage` 开头增加「未配置时拦截，排在 `onWaiting` / `saveMessage` 之前」
- `CLAUDE.md`：「IPC Contract」中的 `agent:ready - { ready, character }`，以及「Windows And Companion」中关于 Onboarding 门禁的描述
- `RELEASE_PLAN.md` 退出标准第 2 条、`TODO.md` 的 F-a：按 §9 第 1 条的决定改写
- `TODO.md` 的 F9：追加 §6.3 的两条用例

## 8. 交付路径

Phase 3：`electron-dev`（§5.1、§5.3）→ `frontend-dev`（§5.2）→ Phase 4：`code-reviewer`（重点检查 §4.2 的拦截顺序和 §4.3 的「不能只取第一次」）→ Phase 5：`test-build`（§6.1、§6.4）→ GUI 手工验收（§6.2）。

两边的实现都以 §4 的契约为准，可以并行开发，但 `frontend-dev` 在 §5.1 合入之前拿不到真实的 `llmConfigured` 值。

## 9. 需要 Grace 拍板

1. **退出标准第 2 条的措辞。** 按 D6 的设计，「稍后配置」只跳过连接这一步，实际路径是「稍后配置 → 下一步 → 完成」。
   建议把原文改为「全新安装 → 引导页在连接步骤点『稍后配置』并完成引导 → 进入主界面 → 桌宠可见且在播 idle 动画」。
   如果 Grace 希望点一下「稍后配置」就直接进主界面，D6 需要改为跳到 `handleFinish`（改动很小，但会多出一条完成路径）
2. **「已配置但网关不可达」时气泡会卡在「···」，0.2.0 是否接受。** G1 没有引入这个问题：所有已配置的用户在网关宕机时现在就是这样。
   但 D6 保留表单值之后，「网关宕机时填好配置、点稍后配置」的新用户也会进入这个状态。
   可选的处理：(a) 接受，等 0.3.0 的 E1 修复（**推荐**，与 E1 的范围一致，G1 不扩范围）；
   (b) 把 E1 里「气泡监听 `agent:error`」这一小块提前到 0.2.0；
   (c) 改为「稍后配置」时丢弃表单值。这样能避开卡住的气泡，但网关恢复后用户需要重新填写
