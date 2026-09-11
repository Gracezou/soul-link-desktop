# v0.4.0 — 任务清单

> 主题：**主动来找你** · 范围见 [`RELEASE_PLAN.md`](./RELEASE_PLAN.md)
> 状态源 [`../EXECUTION_TRACKER.md`](../EXECUTION_TRACKER.md) · Evidence 规范 [`../v0.2.0/PREFLIGHT.md`](../v0.2.0/PREFLIGHT.md) §4
> ⛓️ 前置：`0.3.0` 的 C1 + E1 必须先完成

## C · 主动互动

- [ ] **C3-0** architect 定接口契约（跨 `electron/` + `src/`，Phase 2 强制）
  - 产出：nudge 事件载荷类型、idle 判定的触发条件、失败时的降级行为（LLM 不可用时是否回退固定文案）
- [ ] **C3-1** `CompanionScheduler` 改用真 idle 检测
  - 现状：固定 `setInterval(idleMinutes)`，与用户是否在交互无关；`companion/triggers.ts` 的 `shouldTrigger()` 写好了却无人调用
  - 目标 `electron/companion/` · 代理 `electron-dev`
- [ ] **C3-2** nudge 经 `SoulLinkAgent` 生成
  - 现状 `main.ts:466` TODO 仍在，推的是 `NUDGE_MESSAGES` 固定文案
  - 需考虑：主动消息是否写入会话历史、是否参与压缩与记忆抽取、`companion.mode`（balanced/checkin/question/report）如何映射为 prompt
  - 目标 `electron/main.ts` + `electron/companion/scheduler.ts` · 代理 `electron-dev`
- [ ] **C3-3** 渲染端监听 `companion:nudge` 并复用气泡链路
  - 现状**无任何监听者**
  - 目标 `src/chat/` · 代理 `frontend-dev`

## F · 验证与发布

- [ ] **F-a** 开启主动互动、间隔设最小值 → 到点桌宠自己开口
- [ ] **F-b** 多次触发内容不重复（证明经过 Agent）
- [ ] **F-c** 期间持续交互则不触发（证明是真 idle 判定）
- [ ] **F-d** 主动消息与用户发起对话共用气泡链路，表现一致
- [ ] **F-e** 关闭开关后不再触发
- [ ] **F-f** 回归：tsc 双端 + `npm test`
- [ ] **F10** 双平台实机验证
- [ ] **F10.5** `CHANGELOG.md` 定版 `0.4.0`
- [ ] **F11** tag `v0.4.0`
