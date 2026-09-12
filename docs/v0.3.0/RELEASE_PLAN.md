# v0.3.0 — 好好说话

> **一句话**：两个入口都能正常对话，长回复读得完，出错有提示。

## 在发布列车中的位置

| 版本 | 主题 | 依赖 CPA |
|---|---|---|
| [0.2.0](../v0.2.0/RELEASE_PLAN.md) | 看得见的桌宠 | ❌ |
| **0.3.0** | **好好说话** | ✅ **依赖** |
| [0.4.0](../v0.4.0/RELEASE_PLAN.md) | 主动来找你 | ✅ |

版本号与推进约定见 [`../v0.2.0/RELEASE_PLAN.md`](../v0.2.0/RELEASE_PLAN.md)；状态定义与 Evidence 规范见 [`../v0.2.0/PREFLIGHT.md`](../v0.2.0/PREFLIGHT.md) §4。

## 为什么是这个范围

`0.2.0` 让用户看见桌宠，但点下去说话的体验是坏的：

- **chat 窗口发一条消息后输入框永久禁用** —— `agent:*` 事件只推 petWindow，chat 窗口的 `useAgent` 收不到 `agent:final`，`chatStore.isLoading` 永不复位
- **气泡有 12 个已确认缺陷** —— 终态文本比流式短时屏幕残留半截 `[emotion:` 标签；驻留固定 20s 与内容长度无关；`agent:error` 无人监听导致出错后气泡永远转「···」；FV 被重复计数

这两件事都只影响「对话」这一个动作，合成一个版本；且都必须有活的 LLM 网关才能验收，所以整组等 CPA。

## 范围

### ✅ 纳入

| ID | 内容 |
|---|---|
| C1 | `agent:*` 广播到 pet + chat 双窗口，修 chat 窗口永久 loading |
| E1 | 气泡重做：纯状态机 `bubbleMachine.ts` + rAF 时钟 + 统一文本入口 + 错误/超时出口 + 驻留按长度 + FV 去重 |
| F1–F7 | 对话链路端到端验证（流式、OOC 重试、压缩、记忆、错误路径） |

设计文档：[`CHAT_BUBBLE_REDESIGN.md`](./CHAT_BUBBLE_REDESIGN.md)（12 个缺陷 B1–B12、8 条状态机单测、验收清单）

### ❌ 不纳入

- 解析器统一（`protocolFilter` vs `responseParser` 两套并存）→ [`../BACKLOG.md`](../BACKLOG.md)
  E1 只消除 FV 重复计数，不动解析器本身
- 气泡富文本流式跳变（未闭合 `*` 先按普通文本渲染）→ BACKLOG

## 退出标准

1. [`TODO.md`](./TODO.md) 无未完成 P0/P1
2. 桌宠气泡与 chat 窗口**两个入口都能连续对话**，chat 窗口不再卡死
3. 一条 >200 字的回复能读完才消失；一条 8 字的回复不会干等 20s
4. 回复含 `[emotion:xxx]` 时，气泡任何时刻都看不到 `[emotion` 字样
5. 断网 / 错误 API key 时气泡在 45s 内给出提示并自行消失
6. 单条回复 FV 只增加一次
7. `tests/unit/bubble-machine.test.ts` 8 条用例通过
8. 双平台实机验证 → `CHANGELOG.md` 定版 → tag `v0.3.0`

## 阻塞

- 🔴 本地 Codex CLI 不可用（见 [`../v0.2.0/PREFLIGHT.md`](../v0.2.0/PREFLIGHT.md) §7）
- ✅ CPA 网关已于 2026-09-12 恢复 —— 退出标准第 2–6 条现在只等实现落地
