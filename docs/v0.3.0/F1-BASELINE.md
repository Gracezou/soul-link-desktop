# F1 — 停更后首次集成基线

> 2026-09-12 · 模型 `MiniMax-M2.7-highspeed` 经 CPA · 源码 `3081f80`（源码零改动）
> **这是 2026-04 自建 Agent 迁移以来第一次端到端跑通。**

## 结果

| 用例 | 结果 |
|---|---|
| `agent-pipeline.test.ts` | ✅ PASS（15.294s，4 条用例） |
| `compression.test.ts` | 待补 |
| `llm-client.test.ts` | 待补 |

`agent-pipeline` 覆盖：发消息并收到角色回复 / 消息落库 / 第二条消息保持上下文 / `resetSession` 后仍可用。

## 单轮耗时（完整 Agent 管线，含 system prompt + 历史）

| 轮次 | 耗时 |
|---|---|
| 第 1 条（2 字输入） | 5.65s |
| 第 2 条（8 字输入） | 4.15s |
| 第 3 条（9 字输入） | 4.85s |

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

### 2. ⚠️ 记忆抽取与 `dispose()` 存在竞态，测试中很可能从未真正落库

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

**后果**：
- 集成测试里记忆抽取大概率一次都没成功过 —— **F6（跨会话记忆召回）目前验证不了真东西**
- 生产同理：用户发完消息立刻退出应用，这条记忆就丢了，且无任何日志

**归属**：`electron/agent/` 的生命周期缺陷，与 0.3.0 的对话质量无关，记入 backlog。
修法方向：`dispose()` 等待在途的 postProcess，或引入可取消的任务队列。

## 未采集到的证据

`conv-*.jsonl` / `api-*.jsonl` 全部没有落盘 —— `initLogging()` 至今无调用者（B1）。
本次所有结论都是从 console 输出反推的。**模型 A/B 需要的 `oocRetryCount`、`emotionTag`、
token 统计都在 conv 日志里**，B1 不做就没法量化比较 M2.7 与 M2-her。

这是 B1 从「可观测性欠账」升级为「阻塞模型选型」的实证。

## 下一步

1. 补跑 `compression.test.ts` 与 `llm-client.test.ts`，填上表
2. 跑 `node tools/cpa_probe.mjs` 第 4 步，确认 `reasoning_split: true` 能否清干净 content
3. B1 日志接线 —— 之后所有对比才有数据支撑
