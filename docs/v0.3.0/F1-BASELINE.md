# F1 — 停更后首次集成基线

> 2026-09-12 · 模型 `MiniMax-M2.7-highspeed` 经 CPA · 源码 `3081f80`（源码零改动）
> **这是 2026-04 自建 Agent 迁移以来第一次端到端跑通。**

## 结果

**3 suites / 9 tests 全部通过，总耗时 50.6s。**

| 用例 | 结果 | 覆盖 |
|---|---|---|
| `llm-client.test.ts` | ✅ PASS 8.08s | chatCompletion / streamChat 流式 / testConnection 成功与失败 |
| `agent-pipeline.test.ts` | ✅ PASS 15.29s | 发消息收回复 / 落库 / 上下文保持 / `resetSession` |
| `compression.test.ts` | ✅ PASS 27.12s | **名不副实，见下** |

### ⚠️ `compression.test.ts` 根本没有测压缩

该文件只有一条用例，发 **4 条**消息，断言 `history.length >= 8`。而
`COMPRESSION_THRESHOLD = 30` —— 日志里确实**没有出现过 `postProcess:compression`**。

**它 PASS 不代表压缩能用。F5（>30 条触发摘要、上下文保持在预算内）目前零覆盖。**
文件名与测试名（`agent handles multiple rounds of conversation`）不一致，造成了虚假的安全感。

补法建议：另起一条跑满 31+ 轮的用例，用环境变量（如 `CPA_SLOW_TESTS=1`）单独开关——
默认套件保持 50 秒量级，不让每次回归都烧几分钟和一把 token。

## 单轮耗时（完整 Agent 管线，含 system prompt + 历史）

`agent-pipeline`（session 103ecd95）：

| 轮次 | 耗时 |
|---|---|
| 第 1 条（2 字） | 5.65s |
| 第 2 条（8 字） | 4.15s |
| 第 3 条（9 字） | 4.85s |

`compression`（session e92c4c18）：

| 轮次 | 输入 | 耗时 |
|---|---|---|
| 1 | `你好` | 3.27s |
| 2 | `今天天气怎么样？` | 3.70s |
| 3 | `我最近工作很忙` | **15.28s** ⚠️ |
| 4 | `你会做什么菜？` | 4.80s |

**第 3 条 15.28s，是其余轮次的 3~4 倍。** 注意它是唯一一句带情绪陈述的输入，
角色需要共情回应，思维链可能特别长；也可能是 `streamChat` 内部的网络重试（≤2 次）
静默发生了。**无法判断——因为 `api-*.jsonl` 没落盘。** 又一次指向 B1。

按现有节奏，桌宠的正常响应是 3~5 秒，但**存在 15 秒级的长尾**。对陪伴产品来说，
15 秒的「···」基本等于卡死，这个长尾必须查清楚。

对照裸接口探针：非流式往返 2.78s、流式首字 1.25s。**多出来的 1.4–2.9s 是 system prompt
与历史带来的输入增量以及随之变长的思维链。** 桌宠场景下用户感知的是「点完等 4~6 秒」。

## 两个实证结论

### 1. 思维链没有触发 OOC 重试 —— 但这是运气，不是设计

日志中三轮均为 `sendMessage → sendMessage:complete`，**没有一次 `sendMessage:oocRetry`**。
原因是 `ooc-detector.ts` 的模式只匹配自曝身份的句式（`I'm an AI`、`as an AI/language model/assistant`、
`作为.*模型` 等），而本次思维链是第三人称分析（`The user says "..."`），不命中。

**风险依然存在**：`/as an? (AI|language model|assistant)/i` 会匹配 `as an assistant`——
思维链在分析角色扮演任务时出现这类措辞的概率并不低。一旦命中：

- 触发最多 2 次重试 → 同一条消息付三遍钱
- 每次重试都要再等一轮 4~6 秒

所以 `<think>` 剥离不能只当成显示问题：**它在过滤管线里的位置必须早于 OOC 检测**。

### 2. 记忆抽取有输入门槛，4 条只触发 1 次

`memory-store.ts:84`：

```js
const shouldExtract = /我|我的|my|mine/i.test(userMessage) || userMessage.length > 20
```

四条输入里只有 `我最近工作很忙` 含「我」，所以 `[MemoryStore] extractAndSave` 全程只打印一次
（`userMessageLength: 7`，正是这句）。门槛本身是合理的成本控制，但要知道：
**记忆覆盖面取决于用户是否说「我」**。陪伴场景下这个频率不低，可以接受，但不是全覆盖。

### 3. ⚠️ 记忆抽取与 `dispose()` 存在竞态

日志相邻两行：

```
19:19:47.986  [Agent] postProcess:memoryExtraction { sessionId: 0955d204... }
19:19:47.987  [Agent] dispose
```

相隔 **1ms**。而调用链是：

- `index.ts:144` `this.postProcess(...).catch(() => {})` —— 不 await
- `index.ts:158` `void this.memoryStore.extractAndSave(...)` —— 再一层不等待
- `extractAndSave` 先发一次 LLM 调用（数秒）**再**写库
- `dispose()` 立刻 `sessionStore.close()`

即：LLM 还在路上，DB 已经关了；等它回来写入时必然失败，且被 `void` + `.catch(() => {})`
两层吞掉，测试照样 PASS。

两次运行的实际窗口：

| 套件 | `extractAndSave` → `dispose` 间隔 | 判断 |
|---|---|---|
| `agent-pipeline` | **1ms** | LLM 调用需数秒，写入必然失败 |
| `compression` | **4.8s** | 边缘——可能刚好赶上，也可能没有 |

**后果**：
- 记忆抽取能否落库取决于时序运气 —— **F6（跨会话记忆召回）目前验证不了真东西**
- 生产同理：用户发完消息立刻退出应用，这条记忆就丢了，且无任何日志

**归属**：`electron/agent/` 的生命周期缺陷，与 0.3.0 的对话质量无关，记入 backlog。
修法方向：`dispose()` 等待在途的 postProcess，或引入可取消的任务队列。

## 未采集到的证据

`conv-*.jsonl` / `api-*.jsonl` 全部没有落盘 —— `initLogging()` 至今无调用者（B1）。
本次所有结论都是从 console 输出反推的。**模型 A/B 需要的 `oocRetryCount`、`emotionTag`、
token 统计都在 conv 日志里**，B1 不做就没法量化比较 M2.7 与 M2-her。

这是 B1 从「可观测性欠账」升级为「阻塞模型选型」的实证。

## 下一步

1. 跑 `node tools/cpa_probe.mjs` 第 4 步，确认 `reasoning_split: true` 能否清干净 content
2. **B1 日志接线** —— 15 秒长尾、OOC 重试、token 统计、模型 A/B，全都要它
3. 补一条真正跑满 31+ 轮的压缩用例（env 开关，默认不跑）
4. 修 `dispose()` 竞态

---

## 补充实测（2026-09-15，B1 接线后第一条 conv 日志）

B1 落盘后拿到的第一条真实记录立刻暴露了一个此前只当成「显示问题」的东西的真实严重性。

### 思维链被**写进了数据库**，并作为上下文回灌

日志里 `turn.assistantMessage` 的内容是：

```
<think>
用户连续发了几次"早上好"…… 我应该用柏源的角色来回应，保持温柔和开心的语气。
</think>

*柏源正在做早餐……* "早。" …… [emotion:happy]
```

`agent/index.ts:141` 存库的是 `finalText`（未经任何过滤的原始全文），
`context-manager.ts:118` 又把库里的 `item.content` 原样塞回下一轮上下文。于是：

| 影响 | 说明 |
|---|---|
| **持久化污染** | `messages` 表里每条 assistant 记录都夹着思维链，历史记录窗口也会显示 |
| **上下文回灌** | 每一轮都把过去所有轮次的思维链重新发给模型——模型读到自己的草稿纸当成对话 |
| **成本** | 用项目自己的 `token-counter` 估算本条：思维链 143 CJK 字 ≈ 286 token，可见正文 138 字 ≈ 276 token，**思维链占 51%** |
| **预算** | 本条 `tokenEstimate` 已达 **4445 / 8000（56%）**，而 `historyLength` 只有 10。压缩阈值是 30 条，**token 预算会远早于压缩阈值触顶** |

**结论：`<think>` 的处理位置错了。** 之前记的是「E1 气泡重做时加过滤」——那只治显示。
真正的修法在 **Agent 层、`saveMessage` 之前**，让脏数据根本不进库。

优先级顺序：

1. **请求侧**：探针第 4 步若确认 `reasoning_split: true` 有效，加进 `llm-client.ts` 请求体 —— 从源头不返回，最干净
2. **入库前**：`agent/index.ts` 在 `saveMessage` 前剥离 `<think>…</think>`，作为兜底（模型可能忽略参数）
3. **显示侧**：E1 只需处理流式过程中的半截标签

⚠️ 在 1/2 落地之前产生的会话数据都已被污染，切模型或修复后建议清一次 `soul-link.db`。

### 其余字段（B1 验收用）

`oocDetected:false` / `oocPattern:null` / `oocRetryCount:0` / `emotionTag:"happy"` /
`historyLength:10` / `tokenEstimate:4445` / `hasSummary:false` / `memoryCount:0` /
`latencyMs:7079` / `deltaCount:13` —— 全部有真实值，B1 验收通过。

`memoryCount:0` 与 §「记忆抽取有输入门槛」一致：`早上好 👋` 不含「我」，不触发抽取。
