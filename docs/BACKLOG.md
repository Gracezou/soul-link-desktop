# Backlog — 未纳入当前版本

> 当前版本：`v0.2.0`（范围见 [`v0.2.0/RELEASE_PLAN.md`](./v0.2.0/RELEASE_PLAN.md)）
> 本文件收纳**已确认要做、但明确推后**的事项。缺陷证据一律见 [`ARCHITECTURE.md`](./ARCHITECTURE.md) §9。
> 规则：进入某个版本的条目从这里移入 `v<version>/TODO.md`，不要两处并存。

## 内部质量（候选 0.3.0）

这些改动用户看不见，但决定后续迭代速度。`0.1.0` 停滞的教训是范围发散，所以整组推后到功能可用之后。

- [ ] 12 个裸字符串 IPC 通道补入 `electron/ipc.ts` 常量表；删除死通道 `pet:drag-start` / `pet:drag-move` / `pet:drag-end`（`PetCanvas` 在发，主进程无 handler）
- [ ] 统一 `agent:final` 的两套解析器 —— `protocolFilter`（气泡）与 `responseParser`（`useAgent`）对同一条消息各解析一次。v0.2.0 的气泡重做只消除了 FV 重复计数，解析器本身仍是两套
- [ ] `settings:set` 后热更新 Agent / Companion / 角色，消除「改配置必须重启」
- [ ] 清理无调用者的死代码：`src/stores/settingsStore.ts`（仍含硬编码网关 IP）、`LlmClient.testConnection()`（`main.ts` 用裸 fetch 重实现了一遍且逻辑已分叉）、`utils/paths.ts` 的 `getDataPath`/`getCardPath`/`getSpritePath`、`store/settings.ts` 的 `getCpaConfig`/`updateCpaConfig`、`agent:reset`、`companion:status`
- [ ] i18n 与注释中的 OpenClaw 残留：`src/i18n/zh-CN.json`/`en.json` 三处**用户可见文案**、`emotionMapper.ts`、`ExpressionRenderer.ts`、`App.tsx` 注释
- [ ] `PetApp`/`PetCanvas` 硬编码 `baiyuan`，未读 `pet.character` 设置（多角色的前置）
- [ ] legacy 测试归位：`tests/` 根目录 6 个文件 57 用例不在 `npm test`（= `jest tests/unit/`）范围内，被静默跳过
- [ ] 引入 ESLint 工具链 —— 仓库现无配置、无依赖，因此各 agent 定义里的 `npx eslint .` 已被移除
- [ ] 统一 IPC 返回值风格为 `{ success, data?, error? }`（现仅 `agent:test-connection` 遵守；定为目标态，存量不回改）

## 安全硬化（候选 0.3.0）

- [ ] preload channel allowlist + 类型化 API（现为无 allowlist 的通用 `send`/`invoke`/`on`；当前威胁模型下可接受，见 `ARCHITECTURE.md` R5）
- [ ] `settings:get` 对非 settings 窗口脱敏 `cpa.apiKey`（现在明文全量下发到每个渲染窗口）
- [ ] 视 preload 演进情况开启 `sandbox: true`

## 性能

- [ ] `SessionStore` / `MemoryStore` 改增量持久化 —— 现在每写一条消息就 `db.export()` + 整库 `writeFileSync` 重写

## 功能扩展（需先出设计）

- [ ] 表情 / 动画系统：emotion tag → 精灵动画的完整联动，后续接图像生成
- [ ] 角色卡解耦与多角色切换 UI（`SoulLinkAgent.switchCharacter()` 已实现但无调用者）
- [ ] 道具 / 礼物系统：空闲时角色索要道具，可开关以控制 token 成本
- [ ] 气泡富文本：`parseBubbleText` 的正则在流式中遇到未闭合 `*` 会先按普通文本渲染、闭合后再变 action 样式，视觉上有一次跳变

## 里程碑

- [ ] **M3 多用户** — `electron/agent/` 外提为独立服务（目前已满足零 Electron 依赖约束，`logger.ts` 是唯一例外），加鉴权与计费
- [ ] **M4 Companion Agent** — Generative Agents 式主动关怀（Memory Stream → Reflection → Planning）。v0.2.0 的 C3 只是把定时 nudge 接上 Agent，不是这个
- [ ] **Web UI** — 复用 React 组件，`agent/` 作后端，服务无桌面端的远程用户
- [ ] **Linux 支持** — 当前未声明。`setIgnoreMouseEvents(..., { forward: true })` 的 forward 选项仅 Windows/macOS 支持，Linux 下穿透后收不到 `mouse-enter`，悬浮工具栏会失效
