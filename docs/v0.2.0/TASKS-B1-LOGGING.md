# B1 日志系统接线任务清单

> 状态来源：[`../EXECUTION_TRACKER.md`](../EXECUTION_TRACKER.md) 的 B1 行  
> 实现依据：[`SPEC-B1-LOGGING.md`](./SPEC-B1-LOGGING.md)  
> 执行流程：`electron-dev` -> `code-reviewer` -> `test-build`

> 当前进度（2026-09-14）：**29 / 43 完成，状态 `IN_PROGRESS`**。实现、复审和自动验证已完成；尚缺提交、开发态/打包态手工验收及最终文档回填。

## 任务边界

本任务只接通现有日志生命周期，不修改日志格式、调用点、级别、保留期或
`FileWriter` 实现。

允许修改：

- `electron/main.ts`
- `electron/logger.ts`（仅允许修复初始化失败后残留无效 `logsDir` 的审查发现）
- `tests/unit/logger.test.ts`（新增）
- 完成后的状态与事实文档

明确不做：

- Agent 异步后处理与 `dispose()` 的竞态修复
- `FileWriter.close()` 的同步刷盘改造
- 任何现有日志调用点重构
- `src/` 改动

## Phase 3：实现

- [x] **B1-I1** 在 `electron/main.ts` 从 `./logger` 导入 `initLogging` 和
      `shutdownLogging`，保留 `createLogger`。
- [x] **B1-I2** 从 `./utils/paths` 导入 `getDataPath`，不得直接使用
      `app.getPath('userData')` 作为初始化参数。
- [x] **B1-I3** 将日志初始化放在现有
      `app.whenReady().then(async () => {` 回调的第一条语句。
- [x] **B1-I4** 使用 `try/catch` 包裹 `initLogging(getDataPath())`；失败时通过
      `console.error` 报告并继续启动应用，不得改用尚未初始化的文件日志。
- [x] **B1-I5** 注册应用级 `will-quit` 监听并调用 `shutdownLogging()`。
- [x] **B1-I6** 确认关闭逻辑不放入 `window-all-closed`，避免 macOS 关闭最后一个
      窗口但进程继续驻留时提前关闭日志。
- [x] **B1-I7** 检查源码差异，确认未修改现有日志调用点或 `src/`；`logger.ts`
      仅包含审查批准的 fail-safe 修复：目录创建与清理成功后才提交 `logsDir`。

## Phase 3：单元测试

- [x] **B1-T1** 新增 `tests/unit/logger.test.ts`，每个用例使用独立临时目录。
- [x] **B1-T2** 验证 `initLogging(tmpDir)` 后 ops 日志写入 `info`、`prefix`、
      `msg` 和结构化 `data`。
- [x] **B1-T3** 验证 API request 写入 `api-*.jsonl`，且 `type === 'request'`。
- [x] **B1-T4** 验证 conversation turn 写入 `conv-*.jsonl`，并保留完整嵌套结构。
- [x] **B1-T5** 验证未初始化时三类写入均静默跳过且不抛异常。
- [x] **B1-T6** 验证 `shutdownLogging()` 后可再次初始化并继续写入。
- [x] **B1-T7** 使用 `jest.resetModules()` 或隔离模块实例保证“未初始化”用例不受
      前序用例的模块级 `logsDir` 状态污染。
- [x] **B1-T8** `afterEach` 调用 `shutdownLogging()`，等待真实 WriteStream 关闭后
      删除临时目录；超时则保留目录并报错。
- [x] **B1-T9** 断言前等待异步 WriteStream 完成；由于当前 API 不返回 `finish`
      Promise，测试应采用有上限的轮询读取，不能用固定的脆弱短延时。
- [x] **B1-T10** 验证 `initLogging()` 因无效路径失败后不残留可写状态，随后调用
      ops/api/conv 均不创建 WriteStream 且不产生异步错误。

## Phase 4：代码审查

- [x] **B1-R1** `code-reviewer` 确认初始化确为 `whenReady` 回调第一条语句。
- [x] **B1-R2** 确认开发态路径为 `<repo>/data/logs/`，打包态路径为
      `<userData>/logs/`。
- [x] **B1-R3** 确认 `will-quit` 能覆盖托盘退出、重启后的退出和非 macOS
      `window-all-closed` 退出，同时不破坏 macOS `activate`。
- [x] **B1-R4** 确认初始化失败不会中断应用启动或留下无效日志状态。
- [x] **B1-R5** 确认没有夹带 Agent 竞态修复、刷盘机制变更或其它重构。
- [ ] **B1-R6** 创建实现提交，并以提交号把 Tracker 状态更新为 `REVIEW`。

复审证据：任务 `01a0994f-5eb1-7e93-b46a-151697377b79`，结论
`P0=0 / P1=0 / P2=0`，准入 Phase 5。

## Phase 5：自动验证

- [x] **B1-V1** `npx tsc -p tsconfig.json --noEmit` 通过。
- [x] **B1-V2** `npx tsc -p tsconfig.node.json --noEmit` 通过。
- [x] **B1-V3** `npx jest tests/unit/logger.test.ts --runInBand --detectOpenHandles`
      通过：1 suite / 6 tests。
- [x] **B1-V4** `npm test -- --runInBand` 通过：8 suites / 73 tests。
- [x] **B1-V5** `npm run build:renderer` 通过：115 modules。
- [x] **B1-V6** `npm run build:main` 通过。
- [x] **B1-V7** `git diff --check` 通过。

验证证据：任务 `01a09954-4f37-7013-bd66-84e8f9ba9faa`，2026-09-13，
`7 PASS / 0 FAIL`。未执行安装包构建或手工运行验收。

## 手工验收

- [ ] **B1-M1** 开发态启动并完成一轮对话，确认 `data/logs/` 生成当天的 ops、api、
      conv 三个 JSONL 文件。
- [ ] **B1-M2** 逐行解析 JSONL，确认每行合法且首字段为 `ts`。
- [ ] **B1-M3** 确认 conv 记录包含规范要求的 analysis、context、timing 字段且值非占位。
- [ ] **B1-M4** 确认 api 日志同时包含 request 与 streaming，且 streaming 的
      `latencyMs`、`deltaCount` 有值。
- [ ] **B1-M5** 正常退出后检查尾部记录；若有丢行，只记录为已知限制，不在 B1
      临时修改刷盘机制。
- [ ] **B1-M6** 放入过期日志并重启，确认过期 ops/conv 文件被清理、当天文件保留。
- [ ] **B1-M7** 打包并安装，完成一轮对话，确认 `<userData>/logs/` 生成三类日志。

## 文档与状态回填

- [ ] **B1-D1** 修正 `README.md` 中“日志尚未接线/不会落盘”的描述。
- [ ] **B1-D2** 更新 `docs/ARCHITECTURE.md` §5 的日志持久化现状。
- [ ] **B1-D3** 从 `docs/ARCHITECTURE.md` §9-B 移除“`initLogging` 从未调用”条目。
- [ ] **B1-D4** 勾选 `docs/v0.2.0/TODO.md` 的 B1，并确保摘要使用
      `initLogging(getDataPath())`。
- [ ] **B1-D5** 在 `docs/EXECUTION_TRACKER.md` 回填状态和 Evidence。
- [ ] **B1-D6** 将 `FileWriter.close()` 可能丢失最后若干行的问题保留在 backlog，
      不得因 B1 完成而删除。

## 完成证据

B1 只有在实现提交已合入、Phase 4/5 通过并完成必要手工验收后才能标记 `DONE`。
Evidence 必须包含：

```text
Commit: <commit-id>
UTC date: <YYYY-MM-DDTHH:mm:ssZ>
Review: code-reviewer P0=0
Checks: renderer tsc PASS; main tsc PASS; logger test PASS; unit suite PASS;
        renderer build PASS; main build PASS; git diff --check PASS
Manual: dev JSONL PASS; retention PASS; packaged JSONL PASS
Known limitation: async stream shutdown tail-loss observation: <observed/not observed>
```

## 执行顺序

```text
B1-I1..I7
  -> B1-T1..T10
  -> implementation commit
  -> B1-R1..R6
  -> B1-V1..V7
  -> B1-M1..M7
  -> B1-D1..D6
  -> final documentation/status commit
  -> Tracker DONE
```
