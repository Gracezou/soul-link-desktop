# v0.2.0 — 任务清单

> 主题：**看得见的桌宠** · 范围与退出标准见 [`RELEASE_PLAN.md`](./RELEASE_PLAN.md)
> **本文件是需求与验收标准，不是状态源。** 状态以 [`../EXECUTION_TRACKER.md`](../EXECUTION_TRACKER.md) 为唯一来源，
> 状态定义与 Evidence 规范见 [`PREFLIGHT.md`](./PREFLIGHT.md) §4（`DONE` 必须带提交号）
> 缺陷证据见 [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §9
> 🔴 当前唯一阻塞：本地 Codex CLI 不可用，B1 / C2 / G1 无法开工（见 `PREFLIGHT.md` §7）
> ✅ CPA 网关 2026-09-12 已恢复

## 前置（已完成）

- [x] **A1–A8** 文档与 agent 元数据对齐 —— `027eada`（8 文件 +712/−658）、`e6a26e7`（文档树重构）
      拆解见 [`PLAN-CLAUDE-MD-REWRITE.md`](./PLAN-CLAUDE-MD-REWRITE.md)，准入证据见 [`PREFLIGHT.md`](./PREFLIGHT.md)

## B · 可观测性

- [ ] **B1** `initLogging()` 接线
  - 现状：`electron/logger.ts` 导出了 `initLogging` / `shutdownLogging`，**全仓无调用者**；三路 JSONL（ops / api / conv）一字节未落盘，打包态 console 也被抑制 ⇒ 零可观测性
  - 改法：`app.whenReady` 首行 `initLogging(app.getPath('userData'))`，退出时 `shutdownLogging()`
  - 目标 `electron/main.ts` · 代理 `electron-dev`
  - 验收：开发与打包两种模式下 `<userData>/logs/` 出现 `ops-*.jsonl`、`api-*.jsonl`
  - **最先做**：C2 / G1 / D1 的排查全靠它，现在出问题只能靠 console 猜

## C · 功能接线（本版本只含 C2）

- [ ] **C2** 打包态 CSP 放行 `res:`
  - 现状 `electron/main.ts:487` 为 `connect-src 'self' http: https:`，而 `PetApp.tsx:41` / `PetCanvas.tsx:33` 用 `fetch('res://sprites/.../manifest.json')` 读动画清单 ⇒ 打包后大概率被拦，桌宠退化为占位框。开发态无 CSP 所以看不出来
  - 顺带把过宽的 `http: https:` 收紧为 `'self' res:`（渲染端不需要外网，LLM 调用全在主进程）
  - 目标 `electron/main.ts` · 代理 `electron-dev`
  - 验收：**必须在真实安装包上验证**，不能只看代码。D1 完成后才能真正验证

## D · 资源

- [ ] **D1** 八帧精灵：`idle×3 + talk×3 + happy×2`
  - 现状 `res/sprites/baiyuan/frames/` 为空（0 文件），`manifest.json` 声明 11 组动画约 26 帧
  - **本版本只做八帧**，先跑通动画引擎，不要一次做满 26 帧
  - 提示词见 [`../archive/2604/SPRITE_PROMPTS.md`](../archive/2604/SPRITE_PROMPTS.md)
  - 生产建议：单图 sheet 一次生成保证角色一致性 → 脚本切格 → 眨眼/呼吸帧机械生成（26 张真图的需求实际只有 11 张）
  - 验收：所有帧同尺寸、透明底、角色包围盒锚点对齐（否则桌宠肉眼可见地抖）
- [ ] **D2** 托盘图标
  - 现状 `res/icons/` 只有 README.md，`setupTray` 回退 `nativeImage.createEmpty()`，macOS 上几乎不可见
- [ ] **D3** 应用图标 + `electron-builder.yml` 解注释 `mac.icon` / `win.icon` / `nsis.*Icon`
  - 现状全部注释，产物用 Electron 默认图标
- [x] **D0** 精灵工具链 —— `tools/sprite_sheet_slicer.py` + `tools/sprite_check.py`
  - slicer：网格切片、边界 flood fill 抠底（不会挖穿角色内部的同色区域）、**共享裁剪框 + 底部对齐**（逐帧各自 trim 会破坏相对运动，正是桌宠抖动的成因）
  - check：清单与磁盘一致性、画布尺寸统一、透明通道、边缘裁切、逐帧与逐动画的锚点漂移；失败退出码 1，可作构建门禁
  - 仅依赖 Pillow。已用合成 sheet 端到端验证：正常用例 clean，注入错位/丢透明/缺帧/多余文件四类问题后全部捕获

## G · 引导流程

- [ ] **G1** onboarding 硬门禁改软门禁 —— 健壮性修复（原为验收阻塞项，CPA 恢复后降级，见 RELEASE_PLAN）
  - 现状 `src/onboarding/ConnectionStep.tsx:53` `canProceed = testResult?.success === true`，配合 `onboardingGuard.needsOnboarding()`（`cpa.baseUrl` 或 `apiKey` 为空即强制引导）⇒ **连接测试不通过就永远出不了引导页**
  - 后果一（2026-09-12 已缓解）：网关下线期间全新安装走不到桌宠界面。CPA 已恢复，当下不再阻塞验收
  - 后果二：网关一挂，所有新用户被永久挡在门外，连桌宠长什么样都看不到
  - 改法：引导页加「稍后配置」出口 → 进主界面；桌宠可见可拖，聊天入口给「未配置」提示；`needsOnboarding()` 改为只看 `onboarding.completed`
  - 跨 `electron/` + `src/` ⇒ 先走 architect 定接口 · 代理 `electron-dev` + `frontend-dev`

## F · 验证与发布

- [ ] **F-a** 全新安装（清空 userData）→ 点「稍后配置」→ 进主界面 → **桌宠可见且在播 idle 动画**
- [ ] **F-b** 托盘图标在 macOS 与 Windows 均可见
- [ ] **F-c** `<userData>/logs/` 出现 ops / api 两类 JSONL
- [ ] **F-d** 回归：`npx tsc -p tsconfig.json --noEmit`、`npx tsc -p tsconfig.node.json --noEmit`、`npm test`
- [ ] **F8** `package.json` version → `0.2.0`
- [ ] **F9** 验证 legacy migration：构造含 `openclaw` 段的旧 `settings.json` → 启动 → 确认迁移为 `cpa` + `character` 且 `openclaw` 键被删
      ⚠️ 该迁移在版本停在 `0.1.0` 时**从不执行**，bump 那一刻才首次生效，属首次上线代码
- [ ] **F10** 双平台实机：macOS `.dmg`（x64 + arm64）、Windows `.exe` 安装 → 启动 → 桌宠渲染 → 日志落盘
- [ ] **F10.5** `CHANGELOG.md` 定版为 `0.2.0`
- [ ] **F11** `git tag v0.2.0 && git push --tags`

**本版本所有验证项均不需要 LLM 网关**（这条设计保持不变，网关恢复只是让它从必需变成冗余保障）。

### 可立即执行（不依赖 Codex CLI）

- [ ] **F1-baseline** 网关恢复后对**当前源码**跑一次集成测试，拿到停更后的第一份基线：
      `CPA_API_KEY=<key> npm run test:integration`
      归属 0.3.0 的 F1，但现在就能跑，且能验证 LLM 客户端、SSE 流式、压缩、记忆四条链路是否还活着
      ⚠️ **网关地址与 API key 都不要写进仓库**：地址是自建实例的公网 IP，仓库可能公开；key 只走环境变量与本机 settings

## 建议顺序

```
0  解 Codex CLI 阻塞        ← 不解则 B1/C2/G1 一行都写不了
1  B1 日志接线              ← 后续排查基座
2  D1 八帧精灵（可与 1 并行，不走 codex）
3  G1 软门禁 → 才能验收「全新安装看见桌宠」
4  C2 CSP（需 D1 产出才能真正验证）
5  D2 → D3 图标
6  F-a…F11
```
