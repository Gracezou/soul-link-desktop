# Soul Link Desktop

可以绑定乙女游戏中特定角色人设进行互动的 AI 桌面情感伴侣。角色以桌宠精灵的形式常驻桌面，支持实时对话、情绪动画联动和主动打招呼。

## 功能

- **角色桌宠** — 透明悬浮窗展示精灵动画，支持拖拽和物理效果
- **AI 对话** — 接入 OpenAI 兼容 LLM，角色人设驱动对话、表情与动作
- **情绪联动** — 解析 AI 回复中的动作/情绪标记，实时触发对应动画
- **长期记忆** — 本地 SQLite 存储会话与提炼的用户记忆
- **主动互动** — 空闲时自动发送问候或关心消息
- **角色管理** — 支持 SillyTavern V2 格式角色卡导入

## 技术栈

- **Electron 29** + **React 18** + **TypeScript 5**
- **Vite** 渲染进程构建
- **Zustand** 状态管理
- **Canvas 2D** 精灵渲染
- **sql.js** (WASM SQLite) 会话 / 记忆持久化
- **electron-store** 配置持久化
- 自建 Agent 系统（character engine / context manager / memory store / compressor）接入 OpenAI 兼容 API

## 目录结构

```
electron/            主进程（CommonJS，编译到 dist-electron/）
  agent/             自建 Agent：LLM 客户端、上下文、记忆、角色引擎
  windows/           pet/chat/settings/onboarding 各窗口
  bridge/            （历史遗留，可忽略）
  store/             electron-store 设置持久化
  utils/paths.ts     开发 / 打包双模式路径解析
src/                 渲染进程（React + ESM，编译到 dist/）
  pet/               桌宠 Canvas 渲染与动画引擎
  settings/          设置面板与 About 区块
  stores/            Zustand 状态
res/                 角色卡 / 精灵帧 / 图标（运行时资源，打包后通过 extraResources 落盘）
tests/               Jest 单元与集成测试
tools/               Python 开发辅助脚本（精灵转换等）
docs/                设计文档与实施规范
```

## 开发

### 前置要求

- **Node.js 18+**
- **npm 9+**
- 一个 OpenAI 兼容的 LLM 网关（任选其一）：
  - MiniMax Chat API
  - DeepSeek / 阿里百炼 / 火山方舟 等国内厂商
  - 自部署 vLLM / ollama / LM Studio
  - 任何符合 `/v1/chat/completions` 协议的服务

### 安装依赖

```bash
npm install
```

首次安装会同时拉取 Electron 二进制（约 100MB），请确保网络畅通。

### 启动开发模式

```bash
npm run dev
```

该命令通过 `concurrently` 并行启动三个进程：

| 子命令 | 作用 |
|--------|------|
| `dev:vite` | Vite 开发服务器，`http://localhost:5173`，热更新 renderer |
| `dev:tsc` | `tsc -p tsconfig.node.json --watch`，主进程 TS → `dist-electron/` 增量编译 |
| `dev:electron` | 等待 Vite + dist-electron 就绪后启动 `electronmon`，主进程文件变更自动重启 |

启动后：

1. 桌宠窗口悬浮在屏幕右侧，系统托盘出现图标
2. 首次启动会弹出 onboarding 向导，填写 LLM 网关信息
3. 左键点击桌宠弹出 chat 窗口，右键托盘图标打开设置

### 常用调试手段

- **主进程日志**：开发模式直接输出到终端；打包后落在 `<userData>/logs/ops-*.jsonl`
- **渲染器 DevTools**：chat/settings 窗口按 `Cmd/Ctrl+Option+I` 打开
- **对话记录**：`<userData>/logs/conv-*.jsonl`，每轮含 OOC 检测、emotion tag、上下文统计
- **API 调用日志**：`<userData>/logs/api-*.jsonl`，含 latency、token 估算、流式 delta 计数

`<userData>` 的实际位置：

- macOS: `~/Library/Application Support/Soul Link Desktop/`
- Windows: `%APPDATA%/Soul Link Desktop/`
- 开发模式: `<repo>/data/`

### 测试

```bash
npm test                 # 单元测试（默认，tests/unit/**）
npm run test:unit        # 同上
npm run test:integration # 集成测试（需要 CPA_API_KEY 环境变量，访问真实 LLM）
npm run test:all         # 全量
```

集成测试依赖真实 LLM 网关，未设置 `CPA_API_KEY` 时会自动 skip。

单次跑一个测试文件：

```bash
npx jest tests/unit/ooc-detector.test.ts
```

## 构建打包

### 脚本一览

| 脚本 | 作用 | 产出 |
|------|------|------|
| `npm run build` | 渲染器 + 主进程 + 当前平台打包 | `release/<version>/` |
| `npm run build:renderer` | 仅 Vite 构建 renderer | `dist/` |
| `npm run build:main` | 仅 tsc 构建主进程 | `dist-electron/` |
| `npm run build:package` | 仅 electron-builder 打包（不重新构建源码） | `release/<version>/` |
| `npm run build:win` | 构建 renderer + 主进程 + Windows NSIS 安装器 | `release/<version>/Soul Link Desktop Setup <ver>.exe` |
| `npm run build:mac` | 构建 renderer + 主进程 + macOS DMG（x64 + arm64） | `release/<version>/Soul Link Desktop-<ver>{,-arm64}.dmg` |

### 完整打包当前平台

```bash
# 清理旧产物（可选）
rm -rf dist/ dist-electron/ release/

# 打包
npm run build
```

产物位于 `release/<version>/`，其中 `<version>` 取自 `package.json` 的 `version` 字段（当前 `0.1.0`）。

### 分平台打包

```bash
npm run build:mac    # 仅 macOS（在 macOS 主机上运行）
npm run build:win    # 仅 Windows（建议在 Windows 主机上运行；macOS/Linux 上需 Wine）
```

**跨平台注意**：

- **macOS → Windows**：electron-builder 会尝试用 Wine 打包 NSIS 安装器，需本机已装 Wine；否则建议在 Windows 主机直接跑 `npm run build:win`
- **Windows → macOS**：macOS DMG 必须在 macOS 主机上构建
- **CI**：推荐在 GitHub Actions 上分别用 `macos-latest` 和 `windows-latest` runner 独立打包

### 首次打包常见问题

| 现象 | 原因 | 解决 |
|------|------|------|
| `electron-v29.x.x-*.zip` 下载损坏 | GitHub Releases CDN 瞬时问题 | 重跑；或手动下载后放入 `~/Library/Caches/electron/` (macOS) / `%LOCALAPPDATA%/electron/Cache/` (Windows) |
| `icon.icns is not a valid icon file` | 图标未配置 | 本项目当前**已注释所有图标行**，不应出现此错误；如需自定义图标见下节 |
| `app is not signed` (macOS) | 未配置代码签名 | 当前 `hardenedRuntime: false`、无签名是 MVP 预期行为，首次启动 macOS Gatekeeper 会警告，右键"打开"可放行 |
| sql.js WASM 加载失败 | asar 打包路径问题 | `electron-builder.yml` 已配置 `asarUnpack: ["**/sql.js/**"]`，如仍报错请检查产物中 `app.asar.unpacked/node_modules/sql.js/dist/sql-wasm.wasm` 是否存在 |

### 产物结构（macOS 示例）

```
release/0.1.0/
├── mac/
│   └── Soul Link Desktop.app/       # x64
│       └── Contents/
│           ├── MacOS/Soul Link Desktop
│           ├── Resources/
│           │   ├── app.asar
│           │   ├── app.asar.unpacked/node_modules/sql.js/
│           │   └── res/             # 角色卡 / 精灵 / 图标（经 extraResources）
│           └── ...
├── mac-arm64/
│   └── Soul Link Desktop.app/       # Apple Silicon
├── Soul Link Desktop-0.1.0.dmg
└── Soul Link Desktop-0.1.0-arm64.dmg
```

### 添加自定义图标

当前 `electron-builder.yml` 中所有 `icon` 行均已注释以避免缺图标报错。若需自定义图标：

1. 在仓库根新建 `build/` 目录
2. 放入 `icon.icns`（macOS，1024×1024）、`icon.ico`（Windows，256×256 多尺寸）、`icon.png`（源图，1024×1024）
3. 在 `electron-builder.yml` 取消 `mac.icon`、`win.icon`、`nsis.installerIcon`、`nsis.uninstallerIcon`、`nsis.installerHeaderIcon` 行的注释
4. 重新 `npm run build`

图标生成工具参考：

```bash
npm install -D electron-icon-maker
npx electron-icon-maker --input=build/icon.png --output=build/
```

### 发布流程建议

1. 更新 `package.json` 的 `version` 字段
2. 更新 `CHANGELOG`（若有）
3. `npm run test:unit && npm run test:all`（后者需有 `CPA_API_KEY`）
4. `npm run build` 本地验证产物可启动
5. 提交 tag：`git tag v0.x.y && git push --tags`
6. （可选）推送到 CI 分平台打包

## 配置

首次启动通过 onboarding 向导填写，也可在设置面板修改：

| 项目 | 说明 |
|------|------|
| Base URL | LLM 网关 `/v1` 基址，如 `https://api.minimax.chat/v1` |
| API Key | 网关鉴权密钥 |
| Model | 模型名称，默认 `MiniMax-M2` |
| 角色卡 | 从 `res/cards/` 选择或导入（SillyTavern V2 JSON） |
| 主动互动 | 开关 / 间隔分钟数 / 模式（balanced/checkin/question/report） |
| 桌宠 | 角色、位置、缩放比例 |
| 界面 | 语言（中/英）、主题 |

运行时配置保存位置：

- 开发: `<repo>/data/settings.json`
- 打包: `<userData>/config.json`（由 electron-store 管理）

均不纳入版本控制。

## 添加角色

1. 将精灵帧图片放入 `res/sprites/<角色名>/frames/`
2. 在 `res/sprites/<角色名>/manifest.json` 中定义动画配置（参考 `res/sprites/baiyuan/manifest.json`）
3. 将角色卡（SillyTavern V2 JSON）放入 `res/cards/<角色名>_card.json`
4. 在设置面板切换角色

DyberPet 格式精灵可用 `tools/sprite_converter.py` 转换：

```bash
python tools/sprite_converter.py <act_conf.json> <输出目录>
```

## 文档

- `CLAUDE.md` — Claude Code subagent 协作规则与架构总览
- `docs/2604/` — 最新设计文档与实施规范（打包发布、测试计划、Agent 迁移等）
- `docs/SOUL_LINK_MIGRATION.md` — 历史架构迁移记录（OpenClaw → 自建 Agent）

## License

MIT
