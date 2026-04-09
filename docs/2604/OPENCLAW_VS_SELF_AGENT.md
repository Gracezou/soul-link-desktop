# Soul Link Desktop — OpenClaw vs 自建 Agent 对比分析

> **Decision Document. 用于决定是否从 OpenClaw 迁移到自建 Agent。**

---

## 1. 问题背景

当前架构：

```
Soul Link Desktop → WebSocket → OpenClaw Gateway → rp-plugin → CPA → MiniMax-M2
```

**核心痛点：**

1. **Token 浪费严重**
   - OpenClaw 的 heartbeat 系统每 30 分钟向 LLM 发送一次心跳请求，即使用户没有在对话，也在消耗 token
   - rp-plugin 每次请求都把完整的角色卡 system_prompt + 对话历史全量发送，没有做上下文压缩
   - OpenClaw agent 的 SOUL.md、工具描述等你不需要的内容也占用了 context window
   - 据分析，OpenClaw 使用 Claude Opus 时月成本可达数百美元，即便换成便宜的模型，heartbeat 的无谓消耗仍然存在

2. **上下文控制权不足**
   - 无法自定义对话历史的裁剪策略（哪些对话保留、哪些压缩、哪些丢弃）
   - 无法实现自定义记忆系统（如：记住用户的生日、喜好，跨 session 持久化）
   - 对话历史获取困难，API 不够灵活

3. **依赖 OpenClaw 生态**
   - WebSocket 握手协议复杂（已调试多天才跑通）
   - 升级 OpenClaw 可能引入 breaking changes
   - rp-plugin 是第三方插件，无法完全控制其行为

---

## 2. 方案对比

### 方案 A：继续使用 OpenClaw + 优化

保持现有架构，但针对 token 浪费做优化。

**优化措施：**
- 关闭 heartbeat（`heartbeat.enabled: false`）
- 减少 OpenClaw agent 的 SOUL.md 内容
- 在 rp-plugin 层面优化 context 长度（如果插件支持）
- 在客户端层面做上下文裁剪后再发送

**优点：**
- 改动最小，已经跑通的链路不需要重写
- rp-plugin 的角色卡管理、session、长记忆已经可用
- Telegram 通道复用
- 不需要自己实现复杂的对话历史管理

**缺点：**
- token 浪费只能缓解，不能根治（OpenClaw 的 context 构建逻辑不在你控制范围内）
- 上下文管理仍然不够灵活
- 继续依赖 OpenClaw 生态和 rp-plugin

**预估 Token 成本（MiniMax-M2，优化后）：**
- 关闭 heartbeat 后，成本纯粹取决于用户对话频率
- 日均 50 轮对话 × 平均 2K tokens/轮 = 100K tokens/天
- 月成本 ≈ 3M tokens × $0.30/M (input) + 1.5M × $1.20/M (output) ≈ $2.7/月
- 但如果 rp-plugin 的 context 构建每次发送大量历史，实际成本会高 3-5 倍

---

### 方案 B：自建 Agent（直连 LLM API）

去掉 OpenClaw，Electron 客户端直接调用 LLM API。

**架构：**

```
Soul Link Desktop (Electron)
  ├── agent/
  │   ├── llm-client.ts          # 直接调用 MiniMax / OpenRouter API
  │   ├── context-manager.ts     # 上下文管理（裁剪、压缩、记忆注入）
  │   ├── character-engine.ts    # 角色卡 system_prompt 注入
  │   ├── session-store.ts       # 本地 SQLite 对话历史
  │   ├── memory-store.ts        # 长期记忆（用户信息、偏好）
  │   └── ooc-detector.ts        # 出戏检测 + 自动重试
  │
  └── (直接 HTTP/REST)
        → CPA / OpenRouter / MiniMax API
          → MiniMax-M2 (LLM)
```

**你需要自己实现的功能：**

| 功能 | 复杂度 | 说明 |
|------|--------|------|
| LLM API 调用 | 低 | OpenAI-compatible HTTP POST，10 行代码 |
| 角色卡注入 | 低 | 把角色卡 JSON 解析为 system_prompt，拼接到 messages[0] |
| 对话历史管理 | 中 | 本地 SQLite 存储，按 session 隔离，启动时加载最近 N 轮 |
| 上下文窗口管理 | 中 | 控制发送给 LLM 的历史条数/token 数，超出时裁剪旧消息 |
| 上下文压缩 | 中高 | 旧对话用 LLM 生成摘要替代原文（可选，优化项） |
| 长期记忆 | 中 | 从对话中提取关键信息存入 memory_store，注入 system_prompt |
| 出戏检测 + 重试 | 低 | 已有 oocDetector.ts，直接复用 |
| 流式响应 | 低 | SSE/streaming fetch，前端已有 delta 处理逻辑 |
| Telegram 通道 | 高 | 如果需要保留 Telegram 接入，需要自建 bot 服务 |

**优点：**
- **完全控制 token 使用** — 精确控制每次请求发送多少历史、系统提示有多长
- **零浪费** — 没有 heartbeat，没有无用的工具描述，没有 SOUL.md
- **自定义记忆** — 可以实现"记住用户生日"、"记住上次聊天话题"等功能
- **灵活的上下文策略** — 可以实现滑动窗口、摘要压缩、重要对话置顶等
- **去除依赖** — 不依赖 OpenClaw 版本更新，不依赖 rp-plugin
- **直接 HTTP** — 比 WebSocket JSON-RPC 简单得多，调试容易
- **可离线存储** — 对话历史在本地 SQLite，不依赖服务端

**缺点：**
- **开发工作量**：预估 2-3 周实现核心功能
- **Telegram 通道丢失**：如果需要 Telegram 远程对话，需额外开发 bot 服务
- **长记忆需要设计**：rp-plugin 的长记忆功能比较成熟，自建需要从头设计
- **维护成本**：角色卡解析、context 管理等需要自己维护

**预估 Token 成本（MiniMax-M2，自建）：**
- 精确控制每次请求：system_prompt (~800 tokens) + 最近 10 轮对话 (~3K tokens) + 记忆摘要 (~500 tokens) = ~4.3K tokens/请求
- 日均 50 轮对话 × 4.3K tokens = 215K tokens/天
- 月成本 ≈ 6.5M × $0.30/M + 1.5M × $1.20/M ≈ $3.75/月
- 但可以进一步优化到 $1-2/月（减少历史轮数、压缩摘要）

---

### 方案 C：混合方案（推荐）

保留 CPA 做 API 代理（模型切换方便），但跳过 OpenClaw + rp-plugin，在 Electron 客户端自建 Agent 逻辑。

**架构：**

```
Soul Link Desktop (Electron)
  ├── agent/                      # 新建：自建 Agent 模块
  │   ├── llm-client.ts          # 通过 CPA 调用 LLM（HTTP REST）
  │   ├── context-manager.ts     # 上下文管理
  │   ├── character-engine.ts    # 角色卡引擎
  │   ├── session-store.ts       # 本地 SQLite
  │   ├── memory-store.ts        # 长期记忆
  │   └── ooc-detector.ts        # 出戏检测
  │
  ├── bridge/                     # 保留：可降级回 OpenClaw（可选）
  │   └── ...
  │
  └── (HTTP REST)
        → CPA (你已有的 API 代理)
          → MiniMax-M2 / 其他模型
```

**优点：**
- 继承方案 B 的所有优势
- CPA 已部署好，可以随时切换后端模型（MiniMax、Claude、DeepSeek 等）
- bridge/ 模块保留，未来可以切回 OpenClaw 或作为 Telegram 通道
- 渐进式迁移：先跑通自建 Agent，确认没问题后再关闭 OpenClaw

**Telegram 通道解决方案（未来）：**
- 选项 1：自建一个轻量 Telegram bot 服务（Node.js + telegraf），复用 agent/ 的逻辑
- 选项 2：继续用 OpenClaw 仅作为 Telegram 通道，桌面端走自建 Agent
- 选项 3：Web UI 替代 Telegram（你已经规划了 Web UI）

---

## 3. Token 消耗对比

| 场景 | OpenClaw (未优化) | OpenClaw (优化后) | 自建 Agent |
|------|------------------|------------------|-----------|
| Heartbeat (30min) | ~2K tokens/次 × 48次/天 = 96K/天 | 0（关闭） | 0（不存在） |
| System prompt | ~3K（角色卡 + SOUL.md + 工具描述） | ~2K（精简 SOUL.md） | ~800（纯角色卡） |
| 对话历史/请求 | 全量发送，不可控 | 不可控 | 精确控制，如最近 10 轮 |
| 每次请求总 tokens | ~8-15K | ~5-10K | ~4-5K |
| 日均 50 轮月成本 | $15-30 | $5-10 | $2-4 |

自建 Agent 在 token 效率上可以比 OpenClaw 省 60-80%。

---

## 4. 上下文管理策略设计（自建 Agent）

### 4.1 Context Window 组成

每次 LLM 请求的 messages 数组结构：

```typescript
[
  // [1] System Prompt — 固定内容（~800 tokens）
  {
    role: "system",
    content: characterCard.system_prompt
      + "\n\n" + characterCard.personality
      + "\n\n" + characterCard.scenario
      + "\n\n" + memoryStore.getSummary()     // 长期记忆注入
      + "\n\n" + characterCard.post_history_instructions
  },

  // [2] 示例对话 — 固定内容（可选，~500 tokens）
  // 从角色卡 example_dialogue 生成的 few-shot 示例

  // [3] 对话历史 — 动态，滑动窗口
  // 最近 N 轮对话（N 由 token budget 决定）
  ...recentMessages,

  // [4] 当前用户消息
  { role: "user", content: currentMessage }
]
```

### 4.2 Token Budget 管理

```typescript
const TOKEN_BUDGET = {
  maxTotal: 8192,          // MiniMax-M2 的安全上限（留 output 空间）
  systemPrompt: 1500,      // 角色卡 + 记忆摘要
  exampleDialogue: 500,    // 示例对话（可选）
  historyBudget: 5000,     // 对话历史的最大 token 数
  reserveForOutput: 1200,  // 留给模型输出的空间
};

// 对话历史裁剪策略：
// 1. 从最近一条开始往前数
// 2. 累计 token 数直到超出 historyBudget
// 3. 超出后的旧消息不发送
// 4. （可选）对被裁剪的旧消息生成摘要，注入 system_prompt
```

### 4.3 长期记忆系统

```
用户说 "明天是我生日"
  → memory-store 提取：{ type: "user_info", key: "birthday", value: "tomorrow", context: "..." }
  → 下次对话时注入 system_prompt：
    "用户信息：用户的生日是 XX月XX日。"
  → 柏源可以主动说："明天是你生日？我得准备点什么。"
```

---

## 5. 实现路线图

### Phase 1：核心链路（1 周）
1. `agent/llm-client.ts` — 通过 CPA 调 MiniMax-M2 的 OpenAI-compatible API
2. `agent/character-engine.ts` — 角色卡 JSON 解析 → system_prompt 构建
3. `agent/session-store.ts` — SQLite 存储对话历史（better-sqlite3 包）
4. `agent/context-manager.ts` — 滑动窗口 + token 计数 + 历史裁剪
5. 替换 bridge/ 的消息发送逻辑 → 改为走 agent/

### Phase 2：出戏检测 + 流式响应（3 天）
6. `agent/ooc-detector.ts` — 复用已有逻辑
7. 流式响应处理 — SSE/streaming 对接已有的 delta/final 管道
8. protocolFilter 对接新 agent

### Phase 3：长期记忆（1 周，可后续做）
9. `agent/memory-store.ts` — 关键信息提取 + SQLite 持久化
10. 记忆注入 system_prompt 的策略
11. 记忆自动更新（每轮对话后异步提取）

### Phase 4：清理（2 天）
12. bridge/ 模块标记为可选/deprecated
13. 移除 WebSocket 连接的硬依赖
14. 更新设置面板（CPA 地址替代 Gateway 地址）

---

## 6. 决策建议

**推荐方案 C（混合方案）**，理由：

1. **Token 节省显著** — 预估节省 60-80%，月成本从 $10-30 降到 $2-4
2. **开发量可控** — 核心功能（LLM 调用 + 角色卡注入 + 历史管理）1 周内完成
3. **CPA 复用** — 不需要重新配置 API 密钥和模型路由
4. **渐进迁移** — bridge/ 保留，随时可以切回 OpenClaw
5. **未来扩展** — 自定义记忆系统为 M4 Companion Agent 打基础
6. **HTTP 比 WebSocket 简单** — 减少调试成本，提高稳定性

**不推荐完全保留 OpenClaw 的理由：**
- heartbeat 即使关闭，OpenClaw 的 context 构建仍然不可控
- 你只用到了 rp-plugin 的 3 个功能（角色卡注入、session、出戏检测），为此维护一整套 OpenClaw 服务器不划算
- 每次 OpenClaw 升级都可能引入 breaking changes（你已经经历过 WebSocket 协议调试的痛苦）
