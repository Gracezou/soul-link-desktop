# v0.2.0 — 准入证据与 Evidence 规范

> 落盘位置：`docs/v0.2.0/PREFLIGHT.md`
> 本文件回应 2026-09-10 的仓库状态核验：`RELEASE_PLAN.md` 声称的「tsc 双端通过 / 67 条单测通过」缺少可复现凭据。
> 以下为补录的准入证据，含命令、结果、提交号、日期。

## 1. 准入证据（2026-09-10）

**环境**

| 项 | 值 |
|---|---|
| 检出路径 | `/Users/zhaoshian/code/github/soul-link-desktop`（**权威工作树**，master） |
| 提交号 | `3081f80dce0523603a949255c746623b21b9a7d8`（`3081f80`） |
| 分支 | `master` |
| 日期 | 2026-09-10T18:17Z |
| Node / npm | v22.23.2 / 10.9.8 |
| `node_modules` | present |
| 源码工作树 | `git status --porcelain -- electron src tests package.json tsconfig*.json` → **0 个改动**，即以下结果等同于在 `3081f80` 干净检出上取得 |

**命令与结果**

| # | 命令 | 结果 | 耗时 |
|---|---|---|---|
| 1 | `npx tsc -p tsconfig.json --noEmit` | exit 0，无 error（renderer） | 1.19s |
| 2 | `npx tsc -p tsconfig.node.json --noEmit` | exit 0，无 error（main） | 0.92s |
| 3 | `npx jest tests/unit/` | **7 suites / 67 tests passed**，0 failed | 2.66s |

未跑：`npm run test:integration`（需 `CPA_API_KEY`，网关重建中，🔴 阻塞）；`npm run build`（打包验证属 F 组退出标准，非准入项）。

## 2. 为什么核验方复现不了

核验在 `/Users/zhaoshian/.codex/worktrees/4653/soul-link-desktop` 执行。该路径有两个问题：

1. **`node_modules` 不存在** —— git worktree 不共享依赖目录，必须在该 worktree 内单独 `npm install` 才能跑 tsc / jest。这解释了「TypeScript/Jest 均不可用」。
2. **该 worktree 已失效** —— `git worktree list` 显示它处于 `3081f80 (detached HEAD) prunable`，且目录**已不在磁盘上**。它停在 A 组改动之前的提交。

结论：核验方的 tooling 结论（无法复现）成立且合理，**准入结论（声称不实）不成立**——是环境差异，不是数据造假。规避办法见 §4。

## 3. 核验结论逐条比对

以权威工作树为准：

| 项 | 核验结论 | 实际 | 判定 |
|---|---|---|---|
| A4 `architect.md` | 仍是旧 OpenClaw/Bridge 内容 | 已重写，`Key Interfaces to Preserve` 已替换为 `ARCHITECTURE.md` §6 逐字内容；A5–A7 同批完成（8 文件 +712/−658）。核验当时**未提交**，故其它工作树看不到；**现已提交为 `027eada`** | ⚠️ 核验当时对该 worktree 成立，对 master 工作树不成立；现已消除分歧 |
| B1 `initLogging` | 未接线 | `electron/` 内除 `logger.ts` 自身定义外无任何调用 | ✅ 一致 |
| C1 agent 事件广播 | 仍只发 pet window | `main.ts` 有 6 处 `petWindow?.webContents.send`，无 `broadcastToWindows` | ✅ 一致 |
| C2 CSP | 仍为 `connect-src 'self' http: https:` | `main.ts:487` 确认 | ✅ 一致 |
| C3 companion | TODO 仍在，发固定文案 | `main.ts:466` TODO 确认 | ✅ 一致 |
| D1/D2/D3 | 帧 0、图标 0、builder 图标注释 | frames=0，`res/icons/` 无图片文件，`electron-builder.yml` 生效的 `icon:` 行 0 处 | ✅ 一致 |
| E1 气泡 | 无 `bubbleMachine.ts` / rAF / 8 条测试 | 三者均不存在 | ✅ 一致 |
| F8 版本号 | 仍 `0.1.0` | `package.json` 确认 | ✅ 一致（按 `RELEASE_PLAN.md` 属设计：发布日才 bump） |

**残留 `openclaw` 命中核对**：`CLAUDE.md:149`、`AGENTS.md:149`、`architect.md:70` 各 1 处，均为说明 electron-store `0.2.0` legacy migration 的合法例外，符合 `PLAN-CLAUDE-MD-REWRITE.md` §5 验收标准第 1 条。

**根因**：A 组改动只落在权威工作树且未提交。未提交的改动对其它 worktree、其它 agent、CI 一律不可见。这不是核验方的问题，是交付纪律的问题。

## 4. Evidence 规范（此后强制）

**适用对象：[`EXECUTION_TRACKER.md`](../EXECUTION_TRACKER.md)** —— 它是任务状态的唯一来源。
`TODO.md` 是需求与验收标准文档，其复选框仅作阅读索引；两者冲突以 tracker 为准。

### 4.1 状态定义

| 状态 | 含义 | 进入条件 |
|---|---|---|
| `TODO` | 未开工 | — |
| `IN_PROGRESS` | 已开工 | Evidence **必须**写明执行任务 ID 或工作分支 / worktree 路径。**禁止写 `Pending`、`进行中` 等无信息值** |
| `REVIEW` | 改动已成为**提交** | Evidence 必须含提交号。改动只在工作树里 ⇒ 仍是 `IN_PROGRESS`，不得进 `REVIEW` |
| `DONE` | 已合入 master 且 Phase 4/5 通过 | Evidence 必须含**四要素**：命令 / 结果 / 提交号 / 日期(UTC) |

### 4.2 四要素模板

```
Evidence: npx jest tests/unit/ → 7 suites / 67 tests passed
          @ 3081f80 · 2026-09-10T18:17Z
```

### 4.3 三条硬规则

1. **状态以 master 上的提交为准。** 任何工作树里的未提交改动，一律记 `IN_PROGRESS`，Evidence 写工作树路径。
2. **跨检出核验前先对齐提交号。** 核验方应先 `git rev-parse HEAD` 并与被核验方声明的提交号比对；不一致时先说明差异，再下结论。
3. **worktree 必须自带 `node_modules`。** 需要跑 tsc / jest 的核验，在该 worktree 内先 `npm ci`；否则只做静态核验（grep / 文件存在性），并在报告中标注「未执行动态验证」。

## 5. 处置（2026-09-11）

- [x] **A 组改动已提交到 master** —— `027eada`，8 文件 +712/−658。这是让核验分歧消失的唯一动作；此后任意 worktree / CI `git fetch` 后均可见
- [x] `git worktree prune` 清掉已失效的 `4653`（`git worktree list` 现仅剩权威工作树）
- [x] 明确 `EXECUTION_TRACKER.md` 为唯一状态源，`TODO.md` 降为需求与验收标准文档（此前两处并存，正是本次分歧重演的土壤）
- [x] tracker 回填 change log：A 组提交号 `027eada`
- [ ] `git push origin master` —— **尚未推送**，`origin` 为 `git@github.com:Gracezou/soul-link-desktop.git`。推送后远端核验方才能看到

## 6. 本次分歧的真正教训

`EXECUTION_TRACKER.md` 把 A4–A8 标成 `DONE` 时，Evidence 只写了「review 通过 / test-build 通过」，
**没有提交号**，而改动当时尚未提交。于是任何在另一个 worktree（`3081f80`）上做的核验，
都必然看到旧内容并判为「未完成」—— 双方都没错，但结论相反。

**`DONE` 若无提交号，就没有可验证的锚点。** §4.3 第 1 条即为此而设。

## 7. 待处理的外部阻塞

`../EXECUTION_TRACKER.md` 记录 B1 因本地 Codex CLI `0.136.0` 无法完成实现运行而 `BLOCKED`：
默认配置无法解码较新的 `max` reasoning 值，`--ignore-user-config -m gpt-5.5` 重试又反复丢失采样连接。

由于仓库的强制委派工作流要求 `electron-dev` / `frontend-dev` 只能经 `codex exec` 写代码，
**这条阻塞会连带卡住 B、C、E 三组的全部实现工作**，影响面大于 CPA 网关下线。
`ARCHITECTURE.md` R7 已建议删除 agent 定义里写死的 `--model`，把模型选择交回 Codex 侧配置；
若 CLI 本身不可用，则需在恢复前临时放宽委派约束，或改用其它实现代理。
