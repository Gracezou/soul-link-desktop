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

---

## 在 CPA 上配置 MiniMax

CPA 是 **CLIProxyAPI**（`router-for-me/CLIProxyAPI`）。确认方式：请求网关根路径会返回
`{"endpoints":[...],"message":"CLI Proxy API Server"}`；`GET /v1/models` 无鉴权时返回
`{"error":"Missing API key"}`，说明服务在跑且鉴权生效。

### 先理清两层密钥

这是最容易配错的地方——**有两个不同的 key**：

```
Soul Link Desktop ──(A)──▶  CPA  ──(B)──▶  MiniMax 开放平台
```

| | 是什么 | 配在哪 |
|---|---|---|
| **A** | 客户端调用 CPA 用的 key | CPA `config.yaml` 顶层的 `api-keys:` 列表；同时填进 app 的 `cpa.apiKey` / `CPA_API_KEY` |
| **B** | CPA 调用 MiniMax 用的 key | `config.yaml` 的 `openai-compatibility` 里那个 `api-key` |

A 是你自己定的（任意字符串），B 来自 MiniMax 开放平台。两者不要混用。

### config.yaml 片段

```yaml
port: 8317

# A：允许哪些客户端 key 调用本代理
api-keys:
  - "<你自己定的 key，填进 app 的 CPA_API_KEY>"

# B：上游供应商
openai-compatibility:
  - name: "minimax"
    disabled: false
    base-url: "https://api.minimaxi.com/v1"
    api-key-entries:
      - api-key: "<MiniMax 开放平台的 key>"
    models:
      - name: "<上游真实模型名>"     # 必须与 MiniMax 返回的 id 完全一致
        alias: "MiniMax-M2-her"      # 客户端 model 参数用这个名字
```

`alias` 就是应用侧 `cpa.model` / `CPA_MODEL` 要填的值。`name` 必须与上游一致，
否则请求会在 CPA 之后才失败，报错会很难读。

### base-url 分区别搞错

MiniMax 分区域，**key 与域名必须配对**，跨区用会直接鉴权失败：

| 账号来源 | base-url |
|---|---|
| `platform.minimaxi.com`（国内） | `https://api.minimaxi.com/v1` |
| `platform.minimax.io`（国际） | `https://api.minimax.io/v1` |

### ⚠️ 上游模型名必须实测，不要照抄

各家渠道的写法不一样（OpenRouter 上是 `minimax/minimax-m2-her`，MiniMax 自家接口
未必同名）。填之前先直接问 MiniMax：

```bash
curl -s https://api.minimaxi.com/v1/models \
  -H "Authorization: Bearer <MiniMax key>" | python3 -m json.tool | grep '"id"'
```

拿返回里的 id 原样填进 `models[].name`。

### 改完之后

1. CPA 支持热重载配置；不生效就重启服务
2. 验证别名已挂上（用 **A** 的 key）：
   ```bash
   curl -s http://<host>:<port>/v1/models -H "Authorization: Bearer <CPA key>"
   ```
   返回里应当出现 `MiniMax-M2-her`
3. 跑探针，三步全绿再跑集成测试：
   ```bash
   CPA_BASE_URL=http://<host>:<port>/v1 CPA_API_KEY=<CPA key> CPA_MODEL=MiniMax-M2-her \
     node tools/cpa_probe.mjs
   ```

### 用管理面板配（等价于改 YAML）

新版带 Web 管理面板（`Cli-Proxy-API-Management-Center`），在「AI 提供商 → OpenAI 兼容」
新建条目。面板字段与 `config.yaml` 一一对应：

| 面板字段 | YAML 键 | 说明 |
|---|---|---|
| 服务地址 | `base-url` | 必须与 key 的区域配对，见上 |
| 前缀 | `prefix` | **留空**。填了模型名会变成 `前缀/别名`，客户端的 `CPA_MODEL` 得跟着改 |
| 优先级 | `priority` | 多供应商时的路由顺序，单供应商留空 |
| API 密钥条目 | `api-key-entries` | 每条右侧有「测试」按钮 |
| 调度权重 | 权重 | 多 key 轮询用，单 key 保持 1 |
| **模型** | `models` | 在同一弹窗内、**API 密钥条目下方**（YAML 里 `models` 也排在 `api-key-entries` 之后） |

模型区支持**从上游 `/v1/models` 拉取并导入别名**——直接用这个，省掉手抄模型名，
也就不会踩「渠道写法不一致」的坑。拉不到再手填 `name`（上游真实 id）+ `alias`（客户端用名）。

「测试模型」下拉显示「自动(尚未添加模型)」就是因为模型列表还是空的，加完即可选。

**排查顺序**：先点密钥的「测试」。它过不了，说明是区域/密钥问题（最常见是国内 key 配了
`api.minimax.io`，或反过来），而不是面板问题；模型列表拉不到通常也是同一个原因。

### 关于「CPA 改版了」

新版 CLIProxyAPI 带了一个 Web 管理面板（配置项 `remote-management`，面板本体是
`Cli-Proxy-API-Management-Center`），默认 `allow-remote: false` 且需要 `secret-key`。
如果你记忆里的配置方式变了，多半是因为现在推荐走面板而不是手改 YAML——两条路等价，
面板改的也是同一份 `config.yaml`。`auth-dir` 默认 `~/.cli-proxy-api`。
