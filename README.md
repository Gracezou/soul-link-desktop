# Soul Link Desktop

可以绑定乙女游戏中特定角色人设进行互动的 AI 桌面情感伴侣。角色以桌宠精灵的形式常驻桌面，支持实时对话、情绪动画联动和主动打招呼。

## 功能

- **角色桌宠** — 透明悬浮窗展示精灵动画，支持拖拽和物理效果
- **AI 对话** — 通过 OpenClaw 网关接入角色人设，对话内容驱动表情与动作
- **情绪联动** — 解析 AI 回复中的动作/情绪标记，实时触发对应动画
- **主动互动** — 空闲时自动发送问候或关心消息
- **角色管理** — 支持 SillyTavern V2 格式角色卡导入

## 技术栈

- **Electron** + **React 18** + **TypeScript 5**
- **Zustand** 状态管理
- **Canvas 2D** 精灵渲染
- **WebSocket** 连接 OpenClaw AI 网关
- **electron-store** 持久化配置

## 开发

**前置要求**：Node.js 18+，已运行中的 OpenClaw 网关服务

```bash
npm install
npm run dev       # 启动开发服务器（Vite + Electron 热重载）
npm test          # 运行测试
npm run build     # 打包（生成 Windows .exe / macOS .dmg）
```

## 配置

首次启动后在设置面板中填写：

| 项目 | 说明 |
|------|------|
| 网关地址 | OpenClaw WebSocket 地址，如 `ws://localhost:8080` |
| Auth Token | 网关鉴权令牌 |
| 角色卡 | 选择或导入角色卡（SillyTavern V2 PNG/JSON 格式） |

运行时配置保存在 `data/settings.json`（不纳入版本控制）。

## 添加角色

1. 将精灵帧图片放入 `res/sprites/<角色名>/frames/`
2. 在 `res/sprites/<角色名>/manifest.json` 中定义动画配置
3. 将角色卡（JSON）放入 `res/cards/`

DyberPet 格式精灵可用 `tools/sprite_converter.py` 转换：

```bash
python tools/sprite_converter.py <act_conf.json> <输出目录>
```
