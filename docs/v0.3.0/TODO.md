# v0.3.0 — 任务清单

> 主题：**好好说话** · 范围见 [`RELEASE_PLAN.md`](./RELEASE_PLAN.md)
> 状态源 [`../EXECUTION_TRACKER.md`](../EXECUTION_TRACKER.md) · Evidence 规范 [`../v0.2.0/PREFLIGHT.md`](../v0.2.0/PREFLIGHT.md) §4
> 🔴 单一阻塞：Codex CLI 不可用（挡实现）。CPA 网关已于 2026-09-12 恢复，验收侧不再受阻

## C · 功能接线

- [ ] **C1** `agent:*` 广播到 pet + chat 双窗口
  - 现状：`main.ts` 6 处 `petWindow?.webContents.send(...)`；chat 窗口是独立 renderer，`useAgent` 订阅不到 `agent:final` ⇒ `chatStore.addUserMessage` 置 `isLoading=true` 后无人复位，**输入框与发送按钮永久禁用**
  - 改法：提取 `broadcastToWindows(channel, payload)`，向 petWindow + chat 窗口广播 `agent:waiting/delta/final/error`；`agent:message-saved` 维持只发 historyWindow
  - 目标 `electron/main.ts` · 代理 `electron-dev`

## E · 气泡体验

- [ ] **E1** 按 [`CHAT_BUBBLE_REDESIGN.md`](./CHAT_BUBBLE_REDESIGN.md) 重做
  - 12 个缺陷 B1–B12（均带行号证据）；新增 `src/chat/bubbleMachine.ts` 纯状态机、`useBubbleClock.ts` rAF 时钟、`protocolFilter.renderText()` 统一文本入口
  - 关键约束：**屏幕文本必须始终是权威文本的前缀**（B1 根治）；`agent:delta` 的 `delta` 是**累计全文**不是增量
  - 气泡不再触碰 `petStore`，情绪/FV 唯一归属 `useAgent`（B2）
  - 目标 `src/chat/` + `src/utils/protocolFilter.ts` · 代理 `frontend-dev`
  - 4 月的临时补丁已回滚，原 diff 见 [`../archive/patches/2604-chat-bubble-dismiss-timer.patch`](../archive/patches/2604-chat-bubble-dismiss-timer.patch)

## F · 验证与发布

- [ ] **F1** `npm run test:integration` 通过（需 `CPA_API_KEY`）
- [ ] **F2** 全新安装 → 首次对话 → 重启后会话保持
- [ ] **F3** 流式打字机：`agent:delta` 驱动气泡无跳字、无越界、无 `[emotion` 残留
- [ ] **F4** OOC 检测与 ≤2 次自动重试实际触发（查 conv 日志 `oocRetryCount`）
- [ ] **F5** 压缩：>30 条消息触发摘要，上下文保持在 token 预算内
- [ ] **F6** 记忆抽取：用户信息跨会话可召回
- [ ] **F7** 错误路径：断网 / 错误 key → 气泡 45s 内给提示并消失
- [ ] **F-d** 回归：tsc 双端 + `npm test`（含新增 8 条状态机用例）
- [ ] **F10** 双平台实机验证
- [ ] **F10.5** `CHANGELOG.md` 定版 `0.3.0`
- [ ] **F11** tag `v0.3.0`

## 建议顺序

```
0  等 Codex CLI 恢复（CPA 已恢复）
1  C1 广播（小改动，先落地，让 chat 窗口可用）
2  E1 气泡重做（最大的一块前端工作）
3  F1 → F2–F7 → F10 → F11
```
