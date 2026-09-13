# B1 — 日志系统接线（实现需求书）

> 交付对象：`electron-dev` · Phase 3 · 2026-09-13
> 上游依据：[`../ARCHITECTURE.md`](../ARCHITECTURE.md) §5 / §9-B · [`../v0.3.0/F1-BASELINE.md`](../v0.3.0/F1-BASELINE.md)
> 目标文件：`electron/main.ts`（唯一需改的源文件）+ 一个新单测

## 1. 问题陈述

`electron/logger.ts` 完整实现了三路 JSONL 日志（ops / api / conv）、按日轮转、保留期清理，
**但 `initLogging()` 全仓没有任何调用者**。

后果链条（`logger.ts:85-101`）：`logsDir` 为 `null` → `getOpsWriter()` / `getApiWriter()` /
`getConvWriter()` 全部返回 `null` → 所有 `writer?.write(...)` 静默变成空操作。
即**三路日志一个字节都没落过盘**，而 `createLogger` 的 `log` / `info` 还在
`app.isPackaged` 时连 console 都不打——打包版等于零可观测性。

这已经不只是欠账。F1 基线里三个结论全靠 console 反推：

- 有一轮耗时 **15.28s**（其余 3~5s），无法判断是思维链变长还是 `streamChat` 的静默重试
- 模型 A/B 需要的 `oocRetryCount` / `emotionTag` / token 统计，全在未落盘的 conv 日志里

**B1 不做，15 秒长尾查不了、模型选型量化不了。**

## 2. 范围

### 要做

1. 启动时调用 `initLogging(<日志根目录>)`
2. 退出时调用 `shutdownLogging()`
3. 一个覆盖「初始化 → 写入 → 关闭」的单元测试

### 不做（各自独立任务，不要顺手改）

- `postProcess` / `extractAndSave` 与 `dispose()` 的竞态（`ARCHITECTURE.md` §9-B，P1）——
  它会改到同一个关机路径，但设计上要先经 architect，本任务只留出位置不动它
- 不新增、不删除、不改写任何现有日志调用点
- 不改日志格式、级别、保留期策略
- 不改 `logger.ts` 内部实现（§6 的已知限制除外，那是后续任务）

## 3. 实现要求

### 3.1 初始化位置

`initLogging(...)` 必须是 `app.whenReady().then(async () => {` 内的**第一条语句**，
早于 CSP 注入、`protocol.handle('res')`、`setupIpcHandlers()` 与 `launchMainApp()`。

理由：`logsDir` 为空期间的所有日志调用会被静默丢弃，没有补写机制。

已核对：`main.ts` 中 `mainLogger` 虽在模块作用域创建（L27），但所有实际调用点
（L97 / L350 / L354 / L436 / L461）都在 `whenReady` 之后的函数体内，**不存在早于初始化的日志调用**。

### 3.2 日志根目录：走 `paths.ts`，不要硬编码

```ts
import { getDataPath } from './utils/paths'
// ...
initLogging(getDataPath())
```

- 开发态 → `<repo>/data/logs/`（`data/` 已在 `.gitignore` 第 217 行）
- 打包态 → `<userData>/logs/`

理由：与 `getDBPath()` 的分环境约定一致，开发时日志就在手边；且 `ARCHITECTURE.md` §6 规定
`utils/paths.ts` 是路径寻址的唯一入口，不得在别处硬编码 `userData`。

**不要**写成 `initLogging(app.getPath('userData'))` —— 那会让开发态日志落到系统目录里，
与数据库分处两地，排查时要来回找。

附带收益：`getDataPath()` 此前是无调用者的死代码（`ARCHITECTURE.md` §9-A7），本任务给它第一个真实调用方。

### 3.3 关闭位置

新增：

```ts
app.on('will-quit', () => {
  shutdownLogging()
})
```

必须是 `will-quit` 而非 `window-all-closed`：后者在 macOS 上不退出进程，且当前还在里面
调用 `agent?.dispose()`；在那里关日志会导致 `activate` 重新拉起后的一段时间里日志错乱。

`will-quit` 晚于 `before-quit`，也晚于 `window-all-closed` 里的 `agent?.dispose()`，
能保证 dispose 自身的日志先落盘。

### 3.4 不要吞异常，但也不要因此崩溃

`initLogging` 内部有 `fs.mkdirSync`，磁盘只读或权限异常时会抛。启动流程不应因为日志
初始化失败而中断：

```ts
try {
  initLogging(getDataPath())
} catch (err) {
  console.error('[Main] initLogging failed, continuing without file logs:', err)
}
```

用 `console.error` 而非 `mainLogger.error`——此刻日志系统本身就是坏的。

## 4. 验收标准

### 4.1 开发态

1. `npm run dev`，与桌宠对话一轮
2. `<repo>/data/logs/` 下出现三个文件：`ops-YYYY-MM-DD.jsonl`、`api-YYYY-MM-DD.jsonl`、`conv-YYYY-MM-DD.jsonl`
3. 每行都是合法 JSON，且首字段为 `ts`
4. `conv-*.jsonl` 中该轮记录包含全部字段，且值非占位：
   - `analysis.oocDetected` / `analysis.oocPattern` / `analysis.oocRetryCount` / `analysis.emotionTag`
   - `context.historyLength` / `context.tokenEstimate` / `context.hasSummary` / `context.memoryCount`
   - `timing.latencyMs` / `timing.deltaCount`
5. `api-*.jsonl` 含 `type: "request"` 与 `type: "streaming"` 记录，`streaming.latencyMs` 与
   `deltaCount` 有值——**这两个字段是排查 15 秒长尾的直接依据**
6. 正常退出应用后，上述文件内容完整（见 §6 已知限制）

### 4.2 打包态

7. `npm run build` 后安装启动，对话一轮，`<userData>/logs/` 下同样出现三个文件
   （macOS：`~/Library/Application Support/Soul Link Desktop/logs/`）

### 4.3 保留期清理

8. 在日志目录手工放入 `ops-2020-01-01.jsonl` 与 `conv-2020-01-01.jsonl`，重启应用后两者均被删除
9. 放入当天日期的文件，重启后保留

### 4.4 单元测试

新增 `tests/unit/logger.test.ts`（`tests/__mocks__/electron.ts` 已提供 `app.isPackaged: false`）：

- `initLogging(tmpDir)` 后，`createLogger('X').info('hi', { a: 1 })` 会在
  `tmpDir/logs/ops-<今天>.jsonl` 写入一行，解析后 `level==='info'`、`prefix==='X'`、
  `msg==='hi'`、`data.a===1`
- `createApiLogger().request({...})` 写入 `api-*.jsonl` 且 `type==='request'`
- `createConvLogger().logTurn({...})` 写入 `conv-*.jsonl` 且字段结构完整
- **未调用 `initLogging` 时**，上述写入全部静默跳过且不抛异常（锁住当前的 fail-safe 行为）
- `shutdownLogging()` 后可再次 `initLogging` 并继续写入（macOS `activate` 复活路径）

测试需在 `afterEach` 清理临时目录。注意 `FileWriter` 用的是异步 `WriteStream`，
断言文件内容前要先 `shutdownLogging()` 并等待流关闭（见 §6）。

### 4.5 回归

10. `npx tsc -p tsconfig.json --noEmit`、`npx tsc -p tsconfig.node.json --noEmit`、`npm test` 全绿
11. `git status` 只显示 `electron/main.ts` 与新增测试文件——不得夹带其它改动

## 5. 完成后必须回填

- `docs/EXECUTION_TRACKER.md` 的 B1 行：状态改 `REVIEW`，Evidence **必须含提交号**
  （见 [`PREFLIGHT.md`](./PREFLIGHT.md) §4，`DONE` 还需四要素）
- `README.md` 中「日志模块已实现但尚未接线，当前不会落盘」那段注记需要删除或改写
- `ARCHITECTURE.md` §5 持久化表格里日志一行的「`initLogging()` 全仓无调用者 → 文件日志实际从未落盘」需更新
- `ARCHITECTURE.md` §9-B 的 P1「initLogging 从未被调用」条目移除

## 6. 已知限制（本任务不修，记入 backlog）

`FileWriter` 基于 `fs.createWriteStream`，`close()` 调用的 `stream.end()` **不做同步刷盘**。
`will-quit` 之后进程可能在缓冲区落盘前退出，导致**最后若干行日志丢失**。

对低频日志影响有限，但排查崩溃类问题时恰恰最需要最后几行。后续可评估改为
`fs.appendFileSync`（低频场景下开销可接受，且天然同步），或在 `will-quit` 中
`event.preventDefault()` 等待流 `finish` 后再 `app.quit()`。

**本任务按现状交付，但验收项 6 若观察到尾部丢行，如实记录，不要临时加 hack。**

## 7. 交付路径

Phase 3 `electron-dev` 直接编辑源码 → Phase 4 `code-reviewer` → Phase 5 `test-build`。
改动仅涉及 `electron/`，无需 architect 预先定接口。
