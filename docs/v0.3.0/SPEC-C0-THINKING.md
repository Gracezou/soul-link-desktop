# C0 — 思维链不得进入正文、数据库与上下文（实现需求书）

> 交付对象：`electron-dev` · Phase 3 · 2026-09-15
> 上游证据：[`F1-BASELINE.md`](./F1-BASELINE.md) 补充实测 · [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §9-B（P0）
> 目标文件：`electron/agent/llm-client.ts`、`electron/agent/index.ts`（+ 单测）

## 0. 归属版本 —— 已定：0.2.0（Grace，2026-09-16）

C0 纳入 **0.2.0**，理由即下文：防止发布版损坏用户数据。任务跟踪见
[`EXECUTION_TRACKER.md`](../EXECUTION_TRACKER.md) 的 0.2.0 表。本文件路径保持在 `v0.3.0/` 不动，
避免改链接；以跟踪表为准。

> 以下为拍板前的原始论证，保留备查。

### 0.1 原始论证

按主题它属于 **0.3.0「好好说话」**。但它不是体验问题，是**数据完整性**问题：
修复前的每一轮对话都会把思维链写进 `messages` 表，并在之后每一轮回灌给模型。
0.2.0 发布的安装包只要有人配了网关聊天，库就会被污染，且**污染不可逆**（只能清库）。

**建议纳入 0.2.0**，理由是「防止发布版损坏用户数据」而非新增能力——
这不是范围发散，是不让 0.2.0 带着会污染数据的缺陷出门。
若坚持 0.2.0 只做「看得见的桌宠」，则应置于 0.3.0 队首，且 0.2.0 的发布说明必须写明
「此版本聊天记录会混入模型思维链，0.3.0 修复后需清库」。

## 1. 问题

`MiniMax-M2.x` 的思维链**关不掉**（官方契约：`thinking:{type:"disabled"}` 被接受但无效），
默认以 `<think>…</think>` 混在 `content` 里返回。当前代码把这段原始全文一路带到底：

| 位置 | 现状 |
|---|---|
| `index.ts:245-249` | `onDelta` 推的是累计 `fullText`，**含 `<think>`** → 气泡直接显示 |
| `index.ts:121` | `saveMessage(session.id, 'assistant', finalText)` 存的是原始全文 → **入库** |
| `context-manager.ts:118` | 把库里的 `item.content` 原样塞回下一轮 → **回灌** |
| `index.ts:~117` | `checkOutOfCharacter(finalText)` 对含思维链的文本做出戏检测 → **误判风险** |

实测代价（2026-09-15，`token-counter` 估算）：单条思维链 286 token、可见正文 276 token，
**思维链占 51%**；`historyLength` 仅 10 时 `tokenEstimate` 已达 **4445 / 8000**。
压缩阈值是 30 条消息，**token 预算会远早于压缩触顶**。

## 2. 已验证的解法

探针第 4 步实测（2026-09-15）：请求体带 `reasoning_split: true` 后

```
PASS  content 已干净  1904ms  "收到"
      思维链已分离到 reasoning_content
```

**从源头解决。** 但仍需入库前兜底，理由见 §3.2。

## 3. 实现要求

### 3.1 请求侧：`llm-client.ts` 带上 `reasoning_split`

三处请求体都要加（`chatCompletion` L64、`testConnection` L85、`streamChatOnce` L133）：

```ts
reasoning_split: true,
```

⚠️ **仍要做降级处理，但按 2026-09-16 的实测调整定位**：

八次实测（`MiniMax-M2.7-highspeed` / `MiniMax-M3` / `MiniMax-M2.5-highspeed` / `glm-5.3`，
带与不带该参数各一次）**全部 HTTP 200，没有任何模型拒绝该字段**。
三个 MiniMax 模型带上它都返回干净 `content`，思维链进 `reasoning_content`；不带则全部内联 `<think>`。

因此 4xx 降级路径**当前无法在本网关上被触发，属纯防御代码**。仍然要写（换供应商即可能需要），
但不要为验证它去构造假场景，验收也不再要求实测触发。

Grace 已确认：生产与 A/B 都只用 MiniMax 系列，不切 GLM。

另记一个**不同形态的失败**：`glm-5.3` 带上该参数时返回了**空 `content`** 而 `reasoning_content` 有 631 字符
（当时 `max_tokens: 200`，很可能只是预算截断，未确认）。它不是 4xx，4xx 降级挡不住它。
若将来真要接 GLM，降级判据需要加上「`content` 为空但 `reasoning_content` 非空」。

**要求**：`request()` 收到 4xx 且响应体提到该参数名（或任何 `invalid/unknown parameter` 类措辞）时，
**去掉该字段重试一次**，并记一条 `warn` 日志（`reasoning_split unsupported, retried without`）。
只降级一次，不要进入重试循环；降级结果应在该 `LlmClient` 实例内记忆，避免每次都多打一轮。

不要引入新的 settings 字段——这是模型能力差异，应由客户端自适应，不该让用户配。

### 3.2 入库前：`index.ts` 剥离 `<think>`

即使 §3.1 生效也要做，因为：模型可能忽略参数；换模型后行为可能变；流式分片里仍可能出现标签。
**防御性剥离是数据完整性的最后一道闸。**

新增纯函数（建议放 `electron/agent/tag-utils.ts`，与 `extractEmotionFromResponse` 同处）：

```ts
export function stripThinking(text: string): string
```

要求：

- 移除完整的 `<think>…</think>`（大小写不敏感，允许标签内跨行、含空白）
- 同时处理 `<thinking>…</thinking>`
- **未闭合的情况**：文本以 `<think>` 开头但没有闭合标签时，整段视为思维链返回空串
  （比截断后吐半截推理给用户更安全）
- 不含标签时**原样返回**（不要 trim 掉正常内容的首尾结构，`*动作*` 依赖前后空白）
- 纯函数，不依赖 Electron

### 3.3 调用顺序（关键）

在 `index.ts` 的 `sendMessage` 循环里，拿到 `result.fullText` 之后、**做任何其它事之前**先剥离：

```
finalText = stripThinking(result.fullText).trim()
  → checkOutOfCharacter(finalText)        // OOC 检测必须看干净文本
  → saveMessage(..., finalText)            // 入库必须干净
  → callbacks.onFinal(messageId, finalText)
  → convLog.logTurn({ turn: { assistantMessage: finalText,
                              rawResponse: result.fullText } })   // raw 保留原文
```

**OOC 检测必须在剥离之后**：思维链里出现「作为…模型」「as an assistant」会命中
`ooc-detector` 的模式，触发最多 2 次重试 —— 同一条消息付三遍钱。

`rawResponse` 字段**继续存原始全文**，那是排查用的，不进上下文。

### 3.4 流式侧：`onDelta`

`index.ts:249` 推的是累计 `fullText`。`reasoning_split` 生效时 delta 本就干净；
不生效时气泡会先显示 `<think>`。

**本任务只做一件事**：对 `onDelta` 推出的累计文本也过一遍 `stripThinking`。
未闭合时返回空串，表现为「思维链期间气泡停在等待态，正文开始才出字」——这正是期望行为。

流式过程中半截标签的精细处理归 E1（`CHAT_BUBBLE_REDESIGN.md`），本任务不做。

## 4. 验收标准

1. `tests/unit/tag-utils.test.ts`（或同等位置）覆盖 `stripThinking`：
   完整标签、`<thinking>` 变体、未闭合（返回空串）、无标签原样返回、
   标签前后有正文、多段标签、大小写混合
2. 跑一轮真实对话后，`data/logs/conv-*.jsonl` 中：
   - `turn.assistantMessage` **不含** `<think>`
   - `turn.rawResponse` **仍含**原文（排查能力不丢）
3. `soul-link.db` 的 `messages` 表中 assistant 记录不含 `<think>`
   （可用 `sqlite3` 或加一条临时脚本核验）
4. 同等对话轮次下 `context.tokenEstimate` 显著下降（对照基线：10 条消息 4445）
5. 把 `CPA_MODEL` 依次切到 `MiniMax-M3` 与 `MiniMax-M2.5-highspeed` 各跑一轮对话，
   确认正文干净、无降级 warn（这两个模型实测支持该参数）。
   **不再要求用 `glm-5.3` 实测降级** —— 本网关上没有模型会返回 4xx，理由见 §3.1。
   降级逻辑改为用单测覆盖：构造一个返回 4xx 且响应体含 `unknown parameter` 的假 `fetch`，
   断言「去掉字段重试一次、只重试一次、记一条 warn、同实例后续请求不再带该字段」
6. `npx tsc` ×3、`npm test`、`npm run build:main` 全绿
7. `git status` 只显示预期文件

## 5. 完成后回填

- `EXECUTION_TRACKER.md` 新增 C0 行，Evidence 带提交号
- `ARCHITECTURE.md` §9-B 的 P0「`<think>` 必须在 saveMessage 之前剥离」条目移除；
  §4 数据流补充 `reasoning_split` 与剥离位置
- `F1-BASELINE.md` 补一组修复后的 `tokenEstimate` 对照数字

## 6. 遗留数据

修复前产生的会话数据已被污染，且会持续回灌。修复后建议清一次 `soul-link.db`
（开发态 `<repo>/data/soul-link.db`）。是否为已发布用户提供迁移/清理，属产品决定，不在本任务。
