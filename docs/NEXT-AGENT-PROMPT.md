# 下一个 agent 的启动提示词

> 直接把下面代码块里的内容发给新 agent 即可。
> 每完成一轮工作后，把「当前任务」那段换成新的，其余可复用。

```text
你接手 soul-link-desktop 的开发。这是一个 Electron + React 的 AI 桌面陪伴应用
（乙女向角色桌宠），停更五个月后刚恢复，上一轮会话把地基理顺并重新跑通了链路。

## 第一步：按顺序读这三份文档，不要跳

1. docs/HANDOFF-2026-09-15.md  —— 先读这份。现状、关键决策的理由、七个已经踩过的坑、
   环境边界（§6.1 写明了哪些事必须在 macOS 上做）。读完你就知道为什么代码是现在这样。
2. docs/EXECUTION_TRACKER.md   —— 任务状态的唯一来源。别的地方写的状态一律以它为准。
   顺带读它开头的 Status Rules，那是硬规则。
3. docs/ARCHITECTURE.md        —— 架构唯一事实来源。动任何代码之前必须读，
   尤其 §6「Key Interfaces to Preserve」和 §9「已知偏差与 backlog」。

不要因为着急跳过第 3 份。这个仓库有 45 条已知偏差，其中若干是「看起来像 bug 其实是
已知且有意保留的」，不读会白改。

## 第二步：确认你的执行环境

先搞清楚你能做什么。上一轮的环境是一个挂载仓库目录的 Linux VM，能跑 tsc/jest/build:main
和 git 提交，但**推不了代码、跑不了 build:renderer、连不上网关、起不了 Electron GUI**。
你的环境可能不同。用一条无副作用的命令实测，别假设。

凡是需要真机的（GUI 验收、打包、推送、连网关），如果你做不到，就明确告诉 Grace 让她做，
不要绕、不要自己造凭据。

## 当前任务：C0 —— 把思维链挡在正文、数据库和上下文之外

实现需求书：docs/v0.3.0/SPEC-C0-THINKING.md（照着做，验收标准在 §4）

背景一句话：MiniMax M2.x 的思维链关不掉，默认以 <think>…</think> 混在 content 里返回，
而现在的代码把这段原始全文一路存进 messages 表、又回灌进下一轮上下文。实测思维链占
assistant 消息 token 的 51%，historyLength 仅 10 时 tokenEstimate 已达 4445/8000。
这是数据完整性问题，不是显示问题 —— 修复前产生的会话数据不可逆地脏了。

探针第 4 步已实测确认 reasoning_split: true 能让 content 干净，所以源头有解，
但仍需入库前兜底。三层做法和调用顺序在需求书里写死了，特别注意：
**剥离必须早于 OOC 检测**，否则思维链里的「作为…模型」会触发最多两次重试，
同一条消息付三遍钱。

需求书 §0 有一个悬而未决的问题：C0 归 0.2.0 还是 0.3.0。
**不要因为这个卡住** —— 无论归哪个版本它都是下一个该做的事，先做；
回填 tracker 时再问 Grace 要一个答复。

## C0 之后的队列（都属 0.2.0「看得见的桌宠」）

按这个顺序，理由见 docs/v0.2.0/RELEASE_PLAN.md：

- D1 八帧精灵（idle×3 + talk×3 + happy×2）—— 0.2.0 的主角，不依赖网关也不依赖实现代码。
  工具已就绪：tools/sprite_sheet_slicer.py 切图、tools/sprite_check.py 校验锚点。
  提示词在 docs/archive/2604/SPRITE_PROMPTS.md。别一次做满 26 帧。
- G1 引导硬门禁改软门禁（跨 electron/ + src/，先走 architect 定接口）
- C2 打包态 CSP 放行 res:（必须在真实安装包上验证，看代码没用）
- D2 托盘图标 → D3 应用图标

## 工作流程（硬规则，不是建议）

- 五阶段：pm-planner → architect → 实现 → code-reviewer → test-build。
  仅改 *.md / docs/ / res/ 时不需要实现代理。跨 electron/ 与 src/ 时必须先过 architect。
- 实现代理直接编辑源码。「必须经 codex exec」的约束已于 6d549d1 取消。
- 状态只写进 EXECUTION_TRACKER.md。不要再建第二个记状态的地方 —— 这个项目已经
  因为双状态源吃过一次亏（详见 HANDOFF §5.1）。
- REVIEW 必须带提交号，DONE 必须带四要素（命令/结果/提交号/UTC 日期）。
  规范见 docs/v0.2.0/PREFLIGHT.md §4。**改动只躺在工作树里的一律算 IN_PROGRESS。**
- 做完一个任务就提交。不要攒着。上一轮因为攒着，跨 worktree 核验得出了完全相反的结论。

## 不要做的事

- 不要把范围外的事顺手做了。想做的先看 docs/BACKLOG.md 是不是已经明确推后了。
  0.1.0 停滞的教训是范围发散，不是质量不够。
- 不要在 .env.example 里填真实值（它受 git 跟踪），不要给 tests/integration/helpers.ts
  加 baseUrl 默认值（旧默认值曾让测试静默打到错误的服务器）。
- 不要改 docs/archive/ 里的历史文档，那是留痕。
- 不要把 postProcess/dispose() 竞态和别的任务混在一起做，它需要先过 architect。
- 网关地址和 API key 一律不入仓库。

## 报告方式

做完后告诉我：改了什么、验证命令与结果、提交号，以及你发现但没做的事。
发现与预期不符的地方直接说，不要替我圆场 —— 上一轮最有价值的几个发现
（日志从未落盘、compression 测试根本没测压缩、思维链进了数据库）都是这么来的。
```
