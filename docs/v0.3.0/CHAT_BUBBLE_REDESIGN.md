# 聊天气泡组件 — 重设计方案

> 2026-09-09 · 取代 `docs/archive/2603/CHAT_BUBBLE_IMPL.md`
> 目标文件：`src/chat/ChatBubbleFeedback.tsx`（255 行）及新增模块
> 前置：4 月的临时补丁已回滚，原始 diff 存于 `docs/archive/patches/2604-chat-bubble-dismiss-timer.patch`

## 1. 为什么重做而不是继续打补丁

被回滚的那个补丁做了两件事：按文本长度延长驻留时间、在 final 时把越界的打字机索引夹回去。两处都对，但都是在**症状层**修补——真正的问题是这个组件把「流式状态机」「打字机时钟」「文本过滤」「情绪副作用」「驻留计时」五件事揉在一个函数里，用 5 个 ref 影子变量绕过闭包陷阱，且**零测试覆盖**。再打第三个补丁的边际收益已经为负。

### 现存缺陷清单（均有代码位置）

| # | 缺陷 | 证据 |
|---|---|---|
| B1 | **流式与终态用两套过滤**：流式显示 `stripPartialTag(delta)`，终态换成 `processResponse().displayText`。后者更短，`typewriterIndex` 可能已经越过其长度，此后 `scheduleTypewriter` 的 `idx < text.length` 恒假 ⇒ 屏幕上**停留在含半截 `[emotion:` 标签的旧文本**上 | L139 vs L194–203 |
| B2 | **FV 与动画被重复触发**：pet 窗口内 `ChatBubbleFeedback`（L186–191）与 `useAgent`（`useAgent.ts` L53–60）对同一条 `agent:final` 各算一次 `addFV` + `setAnimationFromEmotion`，且分别用 `protocolFilter` 和 `responseParser` 两套解析器 | 两文件 |
| B3 | **无 `agent:error` 监听**：LLM 报错时主进程发 `agent:error`，全仓无人接 ⇒ 气泡卡在 `waiting` 的「···」**永远不消失**（`waiting` 阶段也没有超时兜底） | `ARCHITECTURE.md` §3 |
| B4 | **驻留时长与内容无关**：固定 20s。一条 300 字的回复读不完就消失；一条 8 字的回复干等 20s | L76 |
| B5 | **悬停后计时重置而非续期**：`handleMouseLeave` 重新 `setTimeout(20s)`，鼠标扫过一次就多留 20s | L218–221 |
| B6 | **整个气泡 `onClick` 即关闭**：无法选中复制文本，误触即丢失内容 | L223–227、L236 |
| B7 | **打字机是自链式 `setTimeout(30ms)`**：每字一个定时器，累计漂移；链一旦被 `clearTypewriter` 打断且新 delta 未到，就再也不会自愈 | L80–101 |
| B8 | **`parseBubbleText` 每 30ms 对全文重跑一次**，并在其中 `console.log`；`onDelta` 也每个 chunk 打日志 ⇒ 长回复时控制台刷屏、主线程无谓开销 | `bubbleParser.ts` L36、L138 |
| B9 | **runId 重置逻辑在 `onDelta` / `onFinal` 里复制了两份**（各 ~13 行，仅日志文案不同） | L124–136、L157–169 |
| B10 | **`updatePlacement()` 在每个 delta 上读 `window.screenX/outerWidth/screen.availWidth`**，强制同步布局 | L110、L123、L156 |
| B11 | **无高度上限**：长回复把气泡撑出桌宠窗口；`nearRight`/`nearBottom` 两种情况被压成一个 `flipToLeft` 布尔，实际只有左右翻转没有上下翻转 | L46–51、`chat.module.css` |
| B12 | **不可测**：状态全在组件闭包与 ref 里，`tests/` 下无任何气泡相关用例 | — |

## 2. 设计原则

1. **把状态机抽成纯函数**——时钟、IPC、React 全部留在外面，纯 reducer 可单测。
2. **单一文本真相**：任何时刻屏幕上显示的，必须是「当前权威文本」的**前缀**。权威文本只允许被替换成一个与已显示部分兼容的新值。
3. **副作用单一归属**：情绪 → 动画 → FV 只在一处发生。
4. **每个阶段都有出口**：包括错误与超时，不存在「永远停在这」的状态。

## 3. 模块拆分

```
src/chat/
  bubbleMachine.ts     ← 新增。纯状态机：(state, event) => state。无 React、无计时器、无 IPC
  useBubbleClock.ts    ← 新增。rAF 时钟：按 elapsed 推导应显示字数，替代 setTimeout 链
  ChatBubbleFeedback.tsx ← 瘦身为「IPC 订阅 + dispatch + 渲染」，目标 ≤120 行
  BubbleContent.tsx    ← 抽出。按 visibleCount 切分已解析的 segment，parse 结果 memo 化
src/utils/
  protocolFilter.ts    ← 扩展：新增 renderText(raw, { final }) 作为唯一文本入口
```

### 3.1 状态机

```ts
type Phase = 'idle' | 'waiting' | 'streaming' | 'settled' | 'error'

interface BubbleState {
  phase: Phase
  runId: string        // 当前消息 id，'' 表示无活动 run
  text: string         // 权威文本（已过滤）
  visible: number      // 已显示字符数
  emotion: EmotionTag | null
  startedAt: number    // 打字机计时起点（ms）
  errorText: string
}

type BubbleEvent =
  | { type: 'waiting'; runId: string; now: number }
  | { type: 'delta';   runId: string; raw: string; now: number }
  | { type: 'final';   runId: string; raw: string; now: number }
  | { type: 'error';   runId: string; message: string }
  | { type: 'tick';    now: number }      // 由 rAF 驱动
  | { type: 'timeout'; now: number }      // waiting 超时 / 驻留到期
  | { type: 'dismiss' }
```

**转移表**

| 当前 | 事件 | 下一状态 | 说明 |
|---|---|---|---|
| any | `waiting` | `waiting` | 新 run 无条件抢占：重置 text/visible/emotion，记 `runId` |
| `waiting` | `delta` | `streaming` | 首个 chunk 落地，`startedAt = now` |
| `streaming` | `delta` | `streaming` | 仅更新 `text`（见 §3.2 单调性约束） |
| `waiting`/`streaming` | `final` | `settled` | text 换成终态过滤结果，`emotion` 落定 |
| `waiting`/`streaming` | `final`（系统消息，过滤返回 null） | `idle` | 整条抑制 |
| any | `error` | `error` | 展示错误文案，走独立驻留时长 |
| `waiting` | `timeout`（> `WAITING_TIMEOUT`） | `error` | **修复 B3** |
| `settled` | `timeout`（驻留到期） | `idle` | |
| any | `dismiss` | `idle` | 用户主动关闭 |
| `streaming`/`settled` | `tick` | 同状态 | `visible = min(text.length, floor((now-startedAt)/CHAR_MS))` |

**runId 仲裁（修复 B9）**：只有 `waiting` 是抢占入口；`delta`/`final` 的 runId 与当前不符时，若当前处于 `idle`/`settled`/`error` 则视为「丢了 ACK 的新 run」，接管之；否则丢弃。这段逻辑在状态机里只写一次。

### 3.2 文本单调性（修复 B1）

`protocolFilter.ts` 新增唯一入口：

```ts
export function renderText(raw: string, opts: { final: boolean }):
  | { suppressed: true }
  | { suppressed: false; text: string; emotion: EmotionTag | null }
```

- `final: false` → `stripPartialTag(raw)`，`emotion: null`，**不做** `isSystemMessage` 判定（半截文本判系统消息不可靠）
- `final: true` → `isSystemMessage` → 命中则 `suppressed`；否则 `extractEmotionTag(raw)`

状态机在 `delta` / `final` 更新 `text` 时执行：

```
if (next.startsWith(prev))         → text = next            // 正常增长
else if (prev.startsWith(next))    → text = next; visible = min(visible, next.length)   // 终态更短（标签被剥离）
else                               → text = next; visible = 0; startedAt = now          // 不兼容，重打
```

这条约束是 B1 的根治：屏幕上永远不会残留不属于权威文本的字符。

### 3.3 时钟（修复 B7）

`useBubbleClock` 用 `requestAnimationFrame` 循环，每帧 dispatch `{type:'tick', now}`；字数由 `elapsed / CHAR_MS` **推导**而非累加，因此丢帧、后台标签页、被打断都能自愈，且不再存在「链断了就永远停住」。`phase` 进入 `idle`/`error` 或 `visible === text.length` 且已 `settled` 时停 rAF。

### 3.4 驻留策略（修复 B4 / B5）

```
DISMISS_MS = clamp(6000 + 60 * text.length, 8000, 45000)
```

- 仅在**打字机播完且处于 `settled`** 后开始计时（当前实现里 `streaming` 中途也可能启动，属隐患）
- 悬停：记录剩余时间并暂停；移出后**按剩余时间续期**，不重置
- 错误态：固定 `ERROR_DISMISS_MS = 10000`

### 3.5 交互与布局（修复 B6 / B10 / B11）

- 气泡右上角加常驻关闭按钮（`×`，8×8 命中区扩到 24×24）；**移除整体 `onClick` 关闭**，正文可自由选中复制
- 保留点击桌宠本体关闭气泡的路径（由 `PetApp` 触发 `dismiss`）
- `updatePlacement()` 改为仅在 `waiting` 与窗口 `resize`/`move` 时计算，不在 delta 上跑
- 翻转拆成两个独立布尔 `flipX` / `flipY`，四个角各自有样式
- 气泡 `max-height: 40vh; overflow-y: auto`；打字机推进时若已贴底则自动跟随滚动，用户手动上滚后停止跟随

### 3.6 副作用归属（修复 B2）

**气泡不再触碰 `petStore`。** 情绪 → 动画 → FV 的唯一归属是 `useAgent`，且 `useAgent` 内的 `responseParser` 换成 `protocolFilter.renderText(..., {final:true})`，与气泡共用同一份解析结果语义。气泡只负责显示。

> ⚠️ 此项跨出 `src/chat/`，触及 `src/hooks/useAgent.ts`。若希望本次改动面最小，可先只做「气泡侧移除 `addFV`/`setAnimationFromEmotion`」，解析器统一另开一张卡（对应 `ARCHITECTURE.md` §9-B 的 P2 项）。

### 3.7 日志（修复 B8）

`bubbleParser` 与气泡内的 `console.log` 全部移除或包在 `if (import.meta.env.DEV)` 之后；`parseBubbleText` 的结果按「权威文本」memo，即**每条消息的每个 chunk 解析一次**，而非每 30ms 一次。

## 4. 常量表

| 常量 | 值 | 说明 |
|---|---|---|
| `CHAR_MS` | 30 | 每字耗时，维持现有观感 |
| `WAITING_TIMEOUT_MS` | 45000 | 无任何 delta 时判定超时 → error |
| `DISMISS_BASE_MS` / `DISMISS_PER_CHAR_MS` | 6000 / 60 | 驻留 = base + perChar×字数 |
| `DISMISS_MIN_MS` / `DISMISS_MAX_MS` | 8000 / 45000 | 上下限 |
| `ERROR_DISMISS_MS` | 10000 | 错误气泡驻留 |

## 5. 测试计划

新增 `tests/unit/bubble-machine.test.ts`（纯函数，无需 DOM，与现有 ts-jest node 环境一致）：

1. `waiting → delta → final` 正常流，`visible` 随 tick 单调不减
2. **终态文本比流式短**（`[emotion:happy]` 被剥离）→ `visible` 被夹回，屏幕文本始终是权威文本前缀 —— **B1 的回归用例**
3. 系统消息在 final 被抑制 → 直接回 `idle`
4. 丢失 `waiting` ACK 的新 run 在 `settled` 状态下能被接管；在 `streaming` 状态下被丢弃
5. `waiting` 超过 `WAITING_TIMEOUT_MS` → `error`
6. `error` 事件在任意阶段都能进入 `error` 态
7. 驻留时长按文本长度计算并落在 `[MIN, MAX]` 内
8. 悬停暂停 → 移出续期，总驻留 = 原时长（不是翻倍）

组件层不做 DOM 测试（仓库无 jsdom/RTL 依赖，不为此引入）；手动验证清单见 §6。

## 6. 验收标准

- [ ] `bubbleMachine.ts` 为纯函数，不 import React / electron / store；§5 全部用例通过
- [ ] `ChatBubbleFeedback.tsx` ≤ 120 行，组件内不再有 `phaseRef` / `fullTextRef` / `typewriterIndex` 之类影子 ref
- [ ] 长回复（>200 字）读完不会中途消失；短回复不会干等 20s
- [ ] 回复带 `[emotion:xxx]` 时，气泡上任何时刻都看不到 `[emotion` 字样，终态无残留
- [ ] 断网/错误 key 时气泡在 45s 内给出错误提示并自行消失，不会永远转「···」
- [ ] 单条回复的 FV 只增加一次（`petStore.fv` 断点或日志验证）
- [ ] 正文可用鼠标选中复制；只有点 `×` 或点桌宠才关闭
- [ ] 长回复出现内部滚动条，气泡不超出桌宠窗口
- [ ] 流式过程中控制台无逐 chunk / 逐字日志
- [ ] `npx tsc -p tsconfig.json --noEmit` 与 `npm test` 通过

## 7. 不在本次范围

- 气泡的富文本渲染增强（`parseBubbleText` 的正则在流式中遇到未闭合 `*` 会先按普通文本渲染、闭合后再变成 action 样式，视觉上有一次跳变）——记为后续项
- `agent:*` 广播到 chat window（`ARCHITECTURE.md` R4，P1，独立需求）
- 情绪 → 精灵动画的实际播放（依赖缺失的 sprite 帧资源）

## 8. 交付路径

按 `CLAUDE.md` 的 5 阶段流程：本文件即 Phase 1+2 产出 → **Phase 3 `frontend-dev`（`src/` 单目录，经 `codex exec`）** → Phase 4 `code-reviewer` → Phase 5 `test-build`。
