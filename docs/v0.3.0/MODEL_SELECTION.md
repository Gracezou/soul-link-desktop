# 模型选型 — 2026-09

> 背景：CPA 网关恢复后尚未配置模型。现有默认值 `MiniMax-M2` 是 2026-04 选型的产物，
> 那是一个通用模型，且当时的选型依据已经过时五个月。
> 本文件是**建议**，不是已决事项。定下来后回填到 `settings.json` 的 `cpa.model` 与 `CPA_MODEL`。

## 结论：优先试 MiniMax **M2-her**

| | |
|---|---|
| 发布 | 2026-01-23 |
| 定位 | dialogue-first，专为角色扮演 / 角色驱动对话 / 陪伴场景训练 |
| 训练数据 | Talkie 与**星野**三年真实用户交互——星野正是 MiniMax 自家的二次元角色陪伴产品，与本项目同品类 |
| 评测 | Role-Play Bench 300 会话评测排名第一 |
| 长程稳定性 | 100 轮对话叙事质量衰减 **约 3%**；通用前沿模型约 **31%** |
| 上下文 | 65,536 token |
| 单次输出上限 | 2,048 token |
| 价格（OpenRouter） | 输入 $0.30 / 输出 $1.20 每百万 token |
| model id | OpenRouter 为 `minimax/minimax-m2-her`；走 MiniMax 官方接口时以开放平台文档的名称为准 |

选它的理由不是"最强"，而是**同品类**：长程人设不漂移正是桌宠陪伴产品的核心指标，
而这恰好是通用模型最先垮掉的地方。现有架构里那套 OOC 检测 + 最多两次重试，本质上是在
用工程手段补通用模型的出戏率；换成 RP 专用模型后，这条重试路径应该很少触发——
可以用 F1 基线里的 `oocRetryCount` 直接量化这个差别。

另一个加分项：你们已经买了 MiniMax，大概率只是换个模型名，不用重新走采购。

## ⚠️ 接入前必须知道的一个 bug

M2-her 的 chat completions 接口在 `messages` 含 MiniMax **高级角色**
（`user_system` / `group` / `sample_message_user` / `sample_message_ai`）时
**100% 返回 HTTP 500**（`unknown error, 999 (1000)`），官方文档却仍把这些角色列为支持特性。
只有标准的 `system` / `user` / `assistant` 可靠。

**对本项目是好消息**：`context-manager.ts` 本来就只发标准三角色，`character-engine.ts`
把角色卡与 `mes_example` 全部拍平进 `system`。也就是说现有实现天然规避了这个坑，
**但不要为了"结构更清晰"去改用高级角色**——那正是踩雷的方向。

## 与现有实现的契合点

- `maxTotalTokens` 目前是 **8000**，而 M2-her 有 64K。换模型后可以上调，
  少触发 `compressor` 的摘要压缩，长会话的人设连续性会更好。属独立调参，建议拿 F1 基线前后对比再改
- 单次输出上限 2048 与 `outputReserve: 500` 的关系需要复核
- 内容尺度：乙女向亲密描写在国内通用模型上容易触发拦截，而拦截响应会被
  `systemFilter` 判为系统消息**整条抑制**，用户看到的是"角色突然不说话"。
  M2-her 出自星野，对这类内容的容忍度是产品级的

## 备选（各有取舍）

| 模型 | 适合 | 代价 |
|---|---|---|
| DeepSeek 旗舰 | 中文性价比公认天花板，多轮便宜 | 通用模型，人设全靠 prompt 顶，长会话易漂 |
| Claude Sonnet | 中文表达最自然、心理描写深、审查相对宽松 | 最贵；国内访问需代理 |
| Gemini Pro | 上下文长且便宜，适合长篇叙事 | 中文角色语感弱于前两者 |
| 通义 / 豆包 / GLM / Kimi | 中文知识扎实，接入方便 | RP 社区里普遍是次选；内容审查会频繁触发上面说的"整条抑制" |

## 建议做法

1. 先把 `cpa.model` 配成 M2-her，跑 F1 拿基线
2. 保留模型可切换（`settings.json` 的 `cpa.model` 已经是配置项），别把模型名写死进代码
3. 用 `conv-*.jsonl` 里的 `oocDetected` / `oocRetryCount` / `emotionTag` 做 A/B：
   同一批话术分别打到 M2-her 与 DeepSeek，比出戏率与 emotion 标签遵循率
   —— 这正是 B1 日志接线的第一个实际用途
