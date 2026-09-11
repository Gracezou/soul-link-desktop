# Soul Link Desktop

可以绑定乙女游戏角色人设进行互动的 AI 桌面情感伴侣。角色以桌宠精灵的形式常驻桌面，支持实时对话、情绪联动和主动打招呼。

> **状态：`0.1.0` 已完成但从未发布。** 后续工作已切分为三个可发布版本：
> [`0.2.0` 看得见的桌宠](docs/v0.2.0/RELEASE_PLAN.md)（不依赖 LLM 网关）→
> [`0.3.0` 好好说话](docs/v0.3.0/RELEASE_PLAN.md) →
> [`0.4.0` 主动来找你](docs/v0.4.0/RELEASE_PLAN.md)。
> 任务状态见 [`docs/EXECUTION_TRACKER.md`](docs/EXECUTION_TRACKER.md)。桌宠精灵帧资源缺失，端到端链路尚未验证。

## 功能

- **角色桌宠** — 透明悬浮窗，Canvas 2D 精灵动画，支持拖拽与物理效果
- **AI 对话** — 进程内自建 Agent 直连 OpenAI 兼容网关，角色人设驱动对话与情绪
- **长期记忆** — 本地 SQLite 存储会话，超长对话自动摘要压缩，跨会话记忆抽取
- **出戏兜底** — 检测到 AI 自曝身份时自动重试（≤2 次）
- **角色管理** — 支持 SillyTavern V2 格式角色卡

## 技术栈

Electron 29 · React 18 · TypeScript 5 · Vite · Zustand · Canvas 2D · sql.js (WASM SQLite) · electron-store

AI 侧为**自建 Agent**（`electron/agent/`，零 Electron 依赖，可外提为独立服务），通过 HTTP + SSE 直连任意 `/v1/chat/completions` 兼容网关。

## 目录结构

```
electron/       主进程（CommonJS → dist-electron/）
  agent/        自建 Agent：LLM 客户端、上下文、记忆、压缩、角色引擎、OOC 检测
  windows/      pet / chat / settings / onboarding 窗口
  store/        electron-store 设置持久化
  utils/        开发/打包双模式路径解析
src/            渲染进程（React + ESM → dist/）
  pet/          桌宠 Canvas 渲染与动画引擎
  chat/         气泡、输入面板、历史窗口
  utils/        响应过滤与协议解析
res/            角色卡 / 精灵帧 / 图标（打包后经 extraResources 落盘）
tests/          Jest 单元与集成测试
docs/           架构文档、版本计划与待办、历史归档
```

## 快速开始

前置：Node.js 18+、npm 9+、一个 OpenAI 兼容的 LLM 网关（MiniMax / DeepSeek / 百炼 / 火山方舟 / 自部署 vLLM、ollama、LM Studio 均可）。

```bash
npm install     # 首次会拉取 Electron 二进制（约 100MB）
npm run dev
```

`npm run dev` 并行启动 Vite（`:5173`，热更新 renderer）、`tsc --watch`（主进程增量编译）、`electronmon`（主进程自动重启）。

启动后：桌宠悬浮在屏幕右侧，托盘出现图标；首次启动弹出 onboarding 向导填写网关信息；左键点击桌宠唤出输入面板，右键托盘打开设置。

## 测试

```bash
npm test                 # 单元测试（tests/unit/，67 用例）
npm run test:all         # 含 tests/ 根目录的 legacy 测试与集成测试
npm run test:integration # 集成测试，需 CPA_API_KEY，未设置则自动 skip
npx jest tests/unit/ooc-detector.test.ts   # 单文件
```

类型检查：`npx tsc -p tsconfig.json --noEmit`（renderer）+ `npx tsc -p tsconfig.node.json --noEmit`（主进程）。仓库暂无 ESLint 配置。

## 构建打包

```bash
npm run build        # renderer + 主进程 + 当前平台安装包 → release/<version>/
npm run build:mac    # 仅 macOS dmg（须在 macOS 主机）
npm run build:win    # 仅 Windows NSIS（建议在 Windows 主机）
```

跨平台注意、图标配置、常见打包问题（Electron 二进制下载损坏、sql.js WASM 路径、macOS 未签名告警）见 [`docs/archive/2604/PACKAGING_RELEASE.md`](docs/archive/2604/PACKAGING_RELEASE.md)。

## 配置

首次启动由 onboarding 向导填写，之后在设置面板修改：Base URL、API Key、Model（默认 `MiniMax-M2`）、角色卡、主动互动开关与间隔、桌宠位置与缩放、语言与主题。

**改动 LLM 配置、主动互动或角色后需重启应用生效**（设置面板已有重启提示）。

运行时数据位置：

| 数据 | 开发 | 打包 |
|---|---|---|
| 设置 | `<userData>/settings.json` | `<userData>/settings.json` |
| 会话与记忆 DB | `<repo>/data/soul-link.db` | `<userData>/soul-link.db` |

`<userData>` 在 macOS 为 `~/Library/Application Support/Soul Link Desktop/`，Windows 为 `%APPDATA%/Soul Link Desktop/`。

> 注：日志模块（`electron/logger.ts`，ops / conv / api 三路 JSONL）已实现但**尚未接线**，当前不会落盘。见 `docs/v0.2.0/TODO.md` B1。

## 添加角色

1. 精灵帧放入 `res/sprites/<角色名>/frames/`
2. 在 `res/sprites/<角色名>/manifest.json` 定义动画（参考 `baiyuan`）
3. 角色卡（SillyTavern V2 JSON）放入 `res/cards/<角色名>_card.json`
4. 设置面板切换角色

DyberPet 格式精灵可用 `python tools/sprite_converter.py <act_conf.json> <输出目录>` 转换。

## 文档

| 文件 | 内容 |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | **架构唯一事实来源** — 模块地图、IPC 契约、数据流、持久化、安全与跨平台评估、已知偏差 |
| [`docs/EXECUTION_TRACKER.md`](docs/EXECUTION_TRACKER.md) | **任务状态唯一来源**，三个版本统一台账；含 Evidence 规范与当前阻塞 |
| [`docs/v0.2.0/`](docs/v0.2.0/) | 看得见的桌宠 —— RELEASE_PLAN / TODO / PREFLIGHT（准入证据）|
| [`docs/v0.3.0/`](docs/v0.3.0/) | 好好说话 —— RELEASE_PLAN / TODO / 气泡重设计方案 |
| [`docs/v0.4.0/`](docs/v0.4.0/) | 主动来找你 —— RELEASE_PLAN / TODO |
| [`docs/BACKLOG.md`](docs/BACKLOG.md) | 已确认但推后到 0.5.0+ 的事项 |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | 版本变更记录 |
| `CLAUDE.md` / `AGENTS.md` | Claude Code / Codex 协作规则与 subagent 工作流 |
| `docs/archive/` | 历史设计文档留痕（2603 / 2604 / 旧 TODO / 已回滚的 patch），内容多已被实现取代，仅供追溯 |

## License

MIT
