# v0.4.0 — 主动来找你

> **一句话**：闲置到点，桌宠自己开口，说的是角色生成的话而不是写死的文案。

## 在发布列车中的位置

| 版本 | 主题 | 依赖 CPA |
|---|---|---|
| [0.2.0](../v0.2.0/RELEASE_PLAN.md) | 看得见的桌宠 | ❌ |
| [0.3.0](../v0.3.0/RELEASE_PLAN.md) | 好好说话 | ✅ |
| **0.4.0** | **主动来找你** | ✅ **依赖** |

版本号与推进约定见 [`../v0.2.0/RELEASE_PLAN.md`](../v0.2.0/RELEASE_PLAN.md)。

## 为什么单独成版

README 从 `0.1.0` 起就承诺「主动互动 —— 空闲时自动发送问候或关心消息」，但实际：

- `electron/main.ts:466` 留着 `// TODO: wire companion nudge to agent once scheduler supports onNudge callback.`
- `CompanionScheduler` 只从 `NUDGE_MESSAGES` 随机取**固定文案**推给 petWindow，**不经过 Agent**
- 渲染端**没有任何 `companion:nudge` 监听者** ⇒ 推了也没人接，完全无效果
- `companion/triggers.ts` 的 `shouldTrigger()` 无调用者；`setInterval` 是固定间隔，**不是真正的 idle 检测**

这是一条完整的用户可感知功能，且跨 `electron/` + `src/` 三个模块，值得单独一版；也必须排在 `0.3.0` 之后——主动消息要通过气泡呈现，气泡得先是好的。

## 范围

### ✅ 纳入

| ID | 内容 |
|---|---|
| C3 | companion nudge 接入 Agent：真 idle 检测 → 经 `SoulLinkAgent` 生成 → 气泡呈现 |

拆三步：① `CompanionScheduler` 改用 `triggers.shouldTrigger()` 做真 idle 判定 ② nudge 经 Agent 生成而非固定文案 ③ 渲染端加 `companion:nudge` 监听并复用气泡链路。

跨 `electron/` + `src/` ⇒ **必须先走 architect 定接口契约**（Phase 2）。

### ❌ 不纳入

- **M4 Companion Agent**（Generative Agents 式 Memory Stream → Reflection → Planning）→ [`../BACKLOG.md`](../BACKLOG.md)
  本版本只是把定时 nudge 接上 Agent，不是那个里程碑，别混淆
- 道具 / 礼物系统 → BACKLOG

## 退出标准

1. [`TODO.md`](./TODO.md) 无未完成 P0/P1
2. 设置里开启主动互动、间隔设为最小值 → 到点桌宠**自己开口**
3. 开口内容**由角色卡驱动生成**，多次触发内容不重复（证明经过 Agent 而非固定文案）
4. 真正基于闲置判定：期间一直有交互则不触发
5. 主动消息与用户发起的对话共用同一条气泡链路，表现一致
6. 关闭开关后不再触发
7. 双平台实机验证 → `CHANGELOG.md` 定版 → tag `v0.4.0`

## 阻塞

- 🔴 本地 Codex CLI 不可用
- ⛓️ 依赖 `0.3.0` 的 E1（气泡）与 C1（广播）先完成
