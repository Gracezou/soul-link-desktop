# v0.2.0 — 任务清单

> 范围与准入退出标准见 [`RELEASE_PLAN.md`](./RELEASE_PLAN.md) · 缺陷证据见 [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §9
> 未纳入本版本的中长期项见 [`../BACKLOG.md`](../BACKLOG.md)
> **本文件是需求与验收标准，不是状态源。** 任务状态以 [`EXECUTION_TRACKER.md`](./EXECUTION_TRACKER.md) 为唯一来源；
> 状态定义与 Evidence 规范见 [`PREFLIGHT.md`](./PREFLIGHT.md) §4。下方复选框仅作阅读索引，与 tracker 冲突时以 tracker 为准。
> 🔴 CPA LLM 网关下线重建中 —— 阻塞 F 组与 C3 实测，A/B/D/E 可并行推进

## 进度

| 组 | 内容 | 进度 |
|---|---|---|
| A | 文档与 agent 元数据 | 8 / 8 |
| B | 可观测性 | 0 / 1 |
| C | 功能接线 | 0 / 3 |
| D | 资源 | 0 / 3 |
| E | 气泡体验 | 0 / 1 |
| F | 验证与发布 | 0 / 12 |

---

## A · 文档与 agent 元数据

> 拆解与验收标准见 [`PLAN-CLAUDE-MD-REWRITE.md`](./PLAN-CLAUDE-MD-REWRITE.md)（T1–T16）

- [x] **A1** Phase 1 pm-planner 产出重写计划
- [x] **A2** Phase 2 architect 产出 `docs/ARCHITECTURE.md`（R1–R8 全部裁决）
- [x] **A3** 文档归档合并、新 README、版本目录约定
- [x] **A4** 重写 `.claude/agents/architect.md`（T8，P0）— Key Interfaces 替换为 `ARCHITECTURE.md` §6 逐字内容
- [x] **A5** 重写 `CLAUDE.md`（T1–T6）
- [x] **A6** 同步 `AGENTS.md`（T7），修回 `.Codex/agents/` 笔误
- [x] **A7** 重写其余五份 agent 定义（T9–T13）
- [x] **A8** 收尾（T16）— `archive/TODO-2604.md` 的 better-sqlite3 笔误

已提交：`027eada`（2026-09-11，8 文件 +712/−658）。`docs/archive/2604/` 下的历史设计文档仍含 better-sqlite3 字样，属归档留痕，不在 T16 范围。

**验收**：`grep -rni "openclaw\|bridgeworker\|usebridge\|bridge:message\|electron/bridge" CLAUDE.md AGENTS.md .claude/agents/` 仅剩 3 处 legacy migration 说明（已于 `027eada` 核对）；所有文档中的仓库路径可 `ls` 命中；文档中不再出现 `npx eslint`。

## B · 可观测性

- [ ] **B1** `initLogging()` 接线 — 目前全仓无调用者，三路 JSONL（ops / api / conv）一个字节都没落盘，打包态连 console 都被抑制 ⇒ 当前零可观测性。在 `app.whenReady` 首行调用 `initLogging(app.getPath('userData'))`，退出时 `shutdownLogging()`
  - 目标：`electron/main.ts` · 代理：`electron-dev`
  - 验收：开发与打包两种模式下 `<userData>/logs/` 出现 `ops-*.jsonl`、`api-*.jsonl`、`conv-*.jsonl`，且一轮对话后 conv 日志含 OOC 检测、emotion tag、上下文统计三段

> B1 应当**最先做**：后面 C、E、F 组的排查全都依赖它。现在出问题只能靠 console 猜。

## C · 功能接线

- [ ] **C1** `agent:*` 广播到 pet + chat 双窗口 — 现在只推 petWindow，chat 窗口的 `useAgent` 收不到 `agent:final`，`chatStore.isLoading` 永不复位 ⇒ **chat 窗口发一条消息后输入框永久禁用**。在 `main.ts` 提取 `broadcastToWindows(channel, payload)`；`agent:message-saved` 维持只发 historyWindow
  - 目标：`electron/main.ts` · 代理：`electron-dev`
- [ ] **C2** 打包态 CSP `connect-src` 补 `res:` — `PetApp`/`PetCanvas` 用 `fetch('res://sprites/.../manifest.json')` 读清单，现有 CSP 未放行 ⇒ 打包后桌宠很可能退化为占位框（开发态无 CSP 所以看不出来）。顺带把过宽的 `http: https:` 收紧为 `'self' res:`
  - 目标：`electron/main.ts` · 代理：`electron-dev` · **必须在真实安装包上验证，不能只看代码**
- [ ] **C3** companion nudge 接入 Agent — `main.ts:466` 的 TODO；现在 `CompanionScheduler` 只把 `NUDGE_MESSAGES` 里的固定文案推给 petWindow，不经过 Agent，且渲染端没有监听者 ⇒ README 承诺的「主动打招呼」完全无效果。改为经 Agent 生成，并在气泡侧加监听
  - 目标：`electron/main.ts` + `electron/companion/scheduler.ts` + `src/chat/`（跨目录 → 先走 architect 定接口）· 代理：`electron-dev` + `frontend-dev`
  - 注：`companion/triggers.ts` 的 `shouldTrigger()` 目前无调用者，`setInterval` 也不是真 idle 检测，本项一并处理

## D · 资源

- [ ] **D1** 桌宠精灵帧 — `res/sprites/baiyuan/frames/` 为空，manifest 声明 11 组动画约 26 帧。提示词见 `../archive/2604/SPRITE_PROMPTS.md`
  - **先只做 `idle×3 + talk×3 + happy×2` 八帧**跑通动画引擎，不要一次做满 26 帧
  - 生产建议：单图 sheet 一次生成保证一致性 → 脚本切格 → 眨眼/呼吸帧机械生成
- [ ] **D2** 托盘图标 — `res/icons/` 目前只有 README，`setupTray` 回退 `nativeImage.createEmpty()`，macOS 上几乎不可见
- [ ] **D3** 应用图标 — `electron-builder.yml` 的 `mac.icon` / `win.icon` / `nsis.*Icon` 仍为注释状态，产物用的是 Electron 默认图标
- [ ] **D0**（可选工具）`tools/sprite_sheet_slicer.py` 切格+抠底+统一画布、`tools/sprite_check.py` 尺寸与锚点一致性校验 — 帧锚点不齐会让桌宠肉眼可见地抖

## E · 气泡体验

- [ ] **E1** 按 [`CHAT_BUBBLE_REDESIGN.md`](./CHAT_BUBBLE_REDESIGN.md) 重做 — 12 个缺陷（B1–B12）、新增 `bubbleMachine.ts` 纯状态机与 8 条单测、rAF 时钟、统一文本入口、错误与超时出口、驻留时长按长度计算、FV 去重
  - 目标：`src/chat/` + `src/utils/protocolFilter.ts` · 代理：`frontend-dev`
  - 4 月的临时补丁已回滚，原 diff 存于 `../archive/patches/2604-chat-bubble-dismiss-timer.patch`

## F · 验证与发布

### 端到端验证（依赖 🔴 CPA 恢复）

- [ ] **F1** `npm run test:integration` 通过（需 `CPA_API_KEY`），拿到恢复后的第一份基线
- [ ] **F2** 全新安装流程：onboarding → 首次对话 → 重启后会话保持
- [ ] **F3** 流式打字机：`agent:delta`（**累计全文语义**）驱动气泡，无跳字、无越界、无 `[emotion` 残留
- [ ] **F4** OOC 检测与 ≤2 次自动重试实际触发（查 conv 日志的 `oocRetryCount`）
- [ ] **F5** 压缩：>30 条消息触发摘要，上下文保持在 token 预算内
- [ ] **F6** 记忆抽取：用户信息跨会话可召回
- [ ] **F7** 错误路径：断网 / 错误 API key 时气泡在 45s 内给出提示并自行消失，不会永远转「···」

### 发布

- [ ] **F8** `package.json` version → `0.2.0`
- [ ] **F9** **验证 `0.2.0` migration**：构造一份含 `openclaw` 段的旧 `settings.json` → 启动 → 确认迁移成 `cpa` + `character` 且 `openclaw` 键被删除。⚠️ 这段迁移在版本停在 `0.1.0` 时**从不执行**，bump 的那一刻才首次生效，属首次上线代码
- [ ] **F10** 双平台实机验证：macOS `.dmg`（x64 + arm64）、Windows `.exe` 安装 → 启动 → 桌宠渲染 → 对话 → DB 与日志落盘 → 重启保持
- [ ] **F10.5** 更新 `CHANGELOG.md`：把 Unreleased 段落定版为 `0.2.0`，补本版本实际变更
- [ ] **F11** `git tag v0.2.0 && git push --tags`

---

## 建议推进顺序

```
现在（不依赖 CPA）
  ✅ A4–A7 已提交 027eada，待 Phase 4/5 复核
  B1 日志接线            ← 下一个，后续排查全靠它
  D1 八帧精灵 → D2 → D3
  C1、C2                 ← 独立小改动
  E1 气泡重做            ← 最大的一块前端工作
  C3 companion（跨目录，先 architect 定接口）
  A8 收尾

CPA 恢复后
  F1 → F2–F7 逐条
  F8 → F9 → F10 → F11
```

每项按 `CLAUDE.md` 的 5 阶段流程走；仅改 `*.md` / `docs/` / `res/` 的任务不需要 Phase 3 实现代理。
