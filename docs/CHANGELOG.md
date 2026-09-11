# Changelog

本项目在 1.0 之前遵循「新功能 / 行为变更 / schema 变更 → minor，纯修复 → patch」的约定，详见 [`v0.2.0/RELEASE_PLAN.md`](./v0.2.0/RELEASE_PLAN.md)。

## [Unreleased] — 0.2.0

开发中。目标：让 README 承诺的功能全部真正可用，并产出第一个可分发安装包。任务清单见 [`v0.2.0/TODO.md`](./v0.2.0/TODO.md)。

## [0.1.0] — 未发布

代码完成度到此为止，但从未在真实安装包上端到端验证过，也未打 tag。

**基础设施** OpenClaw + rp-plugin 部署与 Telegram 验证（该路线已废弃）· MiniMax-M2 接入 · DyberPet MVP 端到端验证

**Agent 迁移（OpenClaw → 自建，2026-04）** 三级上下文设计 · `electron/agent/` 11 模块 · SSE 流式 LLM 客户端 · SillyTavern V2 角色卡 → system prompt · sql.js 会话与记忆存储 · LLM 摘要压缩（>30 条触发）· OOC 检测与 ≤2 次自动重试 · `bridge:*` → `agent:*` IPC 迁移 · settings `openclaw` → `cpa`（含 `0.2.0` migration，**在版本 bump 前不会执行**）· `electron/bridge/` 删除、`ws` 卸载

**Electron 应用** 项目脚手架（Electron 29 + React 18 + TS 5 + Vite + Zustand）· 首启 onboarding 四步向导与窗口串行化 · 桌宠窗口（透明、拖拽、位置持久化、点击穿透）· 悬浮工具栏 · 气泡打字机与状态机 · 紧凑输入面板与快捷回复 · 历史窗口 · 主题系统（Sakura Pink / Sunshine）· i18n（zh-CN / en）· 三路 JSONL 日志模块（**已实现但未接线**）· 单元 + 集成测试框架 · electron-builder 打包配置 · 启动期 LLM 配置守卫

**角色卡** 白鸢 V2 卡 · `[emotion:xxx]` 标签约束写入 `post_history_instructions` · 11 表情 × 2–3 帧的生成提示词

**已知未完成**（构成 0.2.0 范围）：日志从未落盘 · chat 窗口收不到 agent 事件 · 打包态 CSP 可能拦截精灵清单加载 · 桌宠无精灵帧 · 主动互动不经过 Agent · 托盘与应用图标缺失
