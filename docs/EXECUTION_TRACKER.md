# Execution Tracker — 0.2.0 / 0.3.0 / 0.4.0

> Last updated: 2026-09-16
> **Single source of truth for task status.** Product status source for `pm-planner` and implementation agents.
> Requirements and acceptance criteria live in each release's `TODO.md`; when the two disagree, this file wins.
> Release scope: [`v0.2.0`](./v0.2.0/RELEASE_PLAN.md) · [`v0.3.0`](./v0.3.0/RELEASE_PLAN.md) · [`v0.4.0`](./v0.4.0/RELEASE_PLAN.md)
> Evidence rules: [`v0.2.0/PREFLIGHT.md`](./v0.2.0/PREFLIGHT.md) §4

## Status Rules

| Status | Meaning |
|---|---|
| `TODO` | Ready or waiting on an internal dependency |
| `IN_PROGRESS` | Assigned and actively being worked. Evidence MUST name the executing task id or working branch — never `Pending` |
| `BLOCKED` | Cannot proceed without an external dependency |
| `REVIEW` | Implementation exists **as a commit**. Evidence MUST carry the commit id. Changes that live only in a working tree stay `IN_PROGRESS` |
| `DONE` | Merged, Phase 4/5 passed, Evidence carries all four elements: command / result / commit id / UTC date |

A task is not `DONE` until its acceptance criteria have objective evidence. **`DONE` without a commit id has no verifiable anchor** — that failure produced the 2026-09-11 cross-worktree audit conflict.

## Release Train

Releases are cut by *what a user can install and see*, not by work type. Each release ships an installer that is better than the previous one.

| Release | Theme | Needs CPA | Done | Total | Status |
|---|---|---|---:|---:|---|
| 0.2.0 | Visible desk pet | **No** (C0 excepted) | 3 | 10 | `IN_PROGRESS` |
| 0.3.0 | Conversations that work | Yes | 1 | 10 | `TODO` — unblocked |
| 0.4.0 | Proactive companion | Yes | 0 | 5 | `TODO` |

Counts equal the rows listed below. The earlier 9 / 14 / 13 figures came from a different grouping and no longer matched the tables.

Group A (documentation and agent metadata) is complete and is **not** a release — it was a preflight gate for the train.

## Current External Blockers

**None as of 2026-09-16.** Both historical blockers are resolved and the current workstation clears the constraints the previous VM imposed.

1. ~~Local Codex CLI cannot complete an implementation run.~~ Resolved 2026-09-12 by removing the dependency. Implementation agents edit source directly; the five-phase workflow is unchanged.
2. ~~CPA LLM gateway is being rebuilt.~~ Resolved 2026-09-12; re-verified 2026-09-16 — `GET /models` returns 200 with ten models.
3. ~~Linux VM cannot run `build:renderer`, reach the gateway, push, or start a GUI.~~ Resolved 2026-09-16 by moving to the macOS workstation: gateway reachable, `git push` verified (`1d61110..c45e171` on `release/0.2.0`), macOS rollup binary present. GUI and packaging remain unverified in this environment.

The gateway is still a single self-hosted instance that was down for five months. Treat its availability as a dependency that will fail again — that is the standing argument for G1.

## Preflight — Group A (complete)

| ID | Task | Owner | Status | Updated | Evidence |
|---|---|---|---|---|---|
| A1 | Phase 1 documentation rewrite plan | pm-planner | `DONE` | 2026-09-09 | `v0.2.0/PLAN-CLAUDE-MD-REWRITE.md` @ `e6a26e7` |
| A2 | Architecture source of truth | architect | `DONE` | 2026-09-09 | `ARCHITECTURE.md` with R1-R8 decisions @ `e6a26e7` |
| A3 | Archives, README, version docs structure | docs agent | `DONE` | 2026-09-11 | `e6a26e7` · docs tree restructured, all internal links resolve |
| A4 | Rewrite `.claude/agents/architect.md` | docs agent | `DONE` | 2026-09-11 | review + test-build passed · `027eada` (+61/-42) |
| A5 | Rewrite `CLAUDE.md` | docs agent | `DONE` | 2026-09-11 | review + test-build passed · `027eada` (+197/-133) |
| A6 | Synchronize `AGENTS.md` | docs agent | `DONE` | 2026-09-11 | diff vs CLAUDE.md limited to title and Claude/Codex wording · `027eada` (+197/-133) |
| A7 | Rewrite remaining five agent definitions | docs agent | `DONE` | 2026-09-11 | review P0/P1=0; stale terms and invalid commands absent · `027eada` |
| A8 | Correct archived `better-sqlite3` wording | docs agent | `DONE` | 2026-09-11 | `archive/TODO-2604.md` clean; `archive/2604/*` retains it as historical record · `e6a26e7` |

## Release 0.2.0 — Visible Desk Pet

Exit criteria need **no LLM gateway**, with one deliberate exception: C0 was pulled into this release on 2026-09-16 (Grace's call) because it is a data-integrity defect — shipping 0.2.0 without it means any user who configures a gateway writes thinking traces into `messages` irreversibly. Its verification does need the gateway; the other nine tasks do not.

| ID | Priority | Task | Owner | Depends On | Parallel | Status | Updated | Evidence |
|---|---|---|---|---|---|---|---|---|
| B1 | P0 | Wire `initLogging()` at startup and `shutdownLogging()` at exit | electron-dev | None | Yes | `DONE` | 2026-09-15 | `4095cbc` + `fa1c193` · `npx tsc` ×3 + `npx jest tests/unit/` → 8 suites / 74 tests + `npm run build:main` all green · dev-mode acceptance passed: `data/logs/conv-*.jsonl` written with real values (`oocRetryCount:0`, `emotionTag:"happy"`, `tokenEstimate:4445`, `latencyMs:7079`, `deltaCount:13`) · 2026-09-15 |
| C0 | **P0** | Keep thinking out of content, DB and context (`reasoning_split` + defensive strip) | electron-dev | None | No | `DONE` | 2026-09-16 | `2eb304c` + `bdb9a52` + `a206559` · all re-run by lead, not taken on report: `npx tsc` ×2 exit 0 · `npm test` 11 suites / 97 tests · `npm run build:main` exit 0 · `CPA_SLOW_TESTS=1 npx jest tests/integration/thinking-persistence.test.ts` 1/1 in 38.8s against the live gateway, both MiniMax models, zero downgrade warnings · `messages` holds 28 assistant rows, **0 containing `<think>`** · 2026-09-16 |
| D1 | P0 | Produce and validate sprite frames | Grace (image generation) + tools | None | Yes | `IN_PROGRESS` | 2026-09-16 | Grace delivered 26 frames + manifest to `docs/v0.2.0/SPRITE/` (uncommitted working copy). **Core 9 frames (idle/talk/happy) accepted** by visual review after manifest retiming. Remaining before `DONE`: Grace redraws 8 emotion frames, 1–2px fringe cleanup on all frames, single commit into `res/sprites/baiyuan/`. Audit: MissionCrew doc `reviews/d1-sprite-visual-audit.md` |
| G1 | P0 | Replace the hard onboarding gate with a "configure later" path | architect, electron-dev, frontend-dev | None | No | `IN_PROGRESS` | 2026-09-17 | MissionCrew task `t_853e91`. Phase 2 done: `v0.2.0/SPEC-G1-SOFT-GATE.md` @ `b9c0f7d` — no new IPC channel, `llmConfigured` added to `agent:ready` / `agent:get-status` payloads, Agent refuses to send **before** saving the user message. Phase 3 implementation in progress on `release/0.2.0` |
| C2 | P0 | Allow `res:` in packaged CSP; narrow renderer network sources | electron-dev | B1, D1 | Yes | `TODO` | 2026-09-11 | Not started — needs D1 output for real verification |
| D2 | P1 | Add a visible tray icon | asset agent | None | Yes | `TODO` | 2026-09-11 | Not started |
| D3 | P1 | Add application icons and enable builder icon configuration | asset/electron-dev | D2 | Yes | `TODO` | 2026-09-11 | Not started |
| D0 | P2 | Sprite sheet slicer and frame consistency checker under `tools/` | docs/tools agent | None | Yes | `DONE` | 2026-09-11 | End-to-end run on a synthetic sheet: clean pass, then 4 injected faults (9px anchor drift, lost alpha, missing frame, stray file) all caught, exit 1 |
| F8 | P0 | Set `package.json` version to `0.2.0` | release owner | B1, C2, D1-D3, G1 | No | `TODO` | 2026-09-11 | Gated on implementation completion |
| F9 | P0 | Verify the `0.2.0` legacy settings migration | test-build | F8 | No | `TODO` | 2026-09-11 | Migration never executes while version is `0.1.0`; first run happens at bump |

## Release 0.3.0 — Conversations That Work

| ID | Priority | Task | Owner | Depends On | Parallel | Status | Updated | Evidence |
|---|---|---|---|---|---|---|---|---|
| C1 | P0 | Broadcast Agent lifecycle events to pet and chat windows | electron-dev | 0.2.0 shipped | Yes | `TODO` | 2026-09-12 | Unblocked |
| E1 | P0 | Rebuild chat bubble state, clock, filtering, errors, dismissal, layout, tests | frontend-dev | 0.2.0 shipped | Yes | `TODO` | 2026-09-16 | Unblocked. **Bubble placement is wrong today (Grace, 2026-09-16)** — anchoring relative to the pet is now an explicit acceptance item of this task, not a separate fix |
| E2 | P1 | Rework the settings panel UI | architect, frontend-dev | None | Yes | `TODO` | 2026-09-16 | New 2026-09-16 on Grace's report that the panel needs visual and structural work. Scope undefined — needs `pm-planner` before implementation. Kept out of 0.2.0 to protect that release's scope; promote if Grace wants it in the first installer |
| F1 | P0 | Run live Agent integration tests | test-build | CPA restored | No | `DONE` | 2026-09-12 | 3 suites / 9 tests pass in 50.6s · baseline and five findings recorded in `v0.3.0/F1-BASELINE.md` · source at `3081f80` · 2026-09-12. Row said `TODO` until 2026-09-16 while the Change Log already recorded completion |
| F2 | P0 | Verify onboarding, first conversation, restart, session persistence | test-build | F1 | No | `TODO` | 2026-09-11 | Depends on F1 only |
| F3 | P0 | Verify streaming bubble behavior and emotion-tag filtering | test-build | F1, E1 | No | `TODO` | 2026-09-12 | Waits on E1 only |
| F4 | P1 | Verify OOC detection and at most two retries | test-build | F1 | No | `TODO` | 2026-09-11 | Depends on F1 only |
| F5 | P1 | Verify compression after more than 30 messages | test-build | F1 | No | `TODO` | 2026-09-16 | Zero real coverage today: `compression.test.ts` sends 4 messages against a 30-message threshold. Grace approved 2026-09-16: build it as a separate case behind `CPA_SLOW_TESTS=1`, run before a release, keeping the default suite at ~50s |
| F6 | P1 | Verify cross-session memory recall | test-build | F1 | No | `TODO` | 2026-09-11 | Depends on F1 only |
| F7 | P0 | Verify network, credential, and waiting-timeout error paths | test-build | F1, E1 | No | `TODO` | 2026-09-12 | Waits on E1 only |

## Release 0.4.0 — Proactive Companion

| ID | Priority | Task | Owner | Depends On | Parallel | Status | Updated | Evidence |
|---|---|---|---|---|---|---|---|---|
| C3-0 | P0 | Architect the nudge contract across main and renderer | architect | 0.3.0 shipped | No | `TODO` | 2026-09-11 | Phase 2 mandatory — cross-directory change |
| C3-1 | P0 | Replace the fixed interval with real idle detection | electron-dev | C3-0 | No | `TODO` | 2026-09-11 | `triggers.shouldTrigger()` currently has no caller |
| C3-2 | P0 | Generate nudges through the Agent instead of fixed strings | electron-dev | C3-0 | No | `TODO` | 2026-09-11 | `main.ts:466` TODO still present |
| C3-3 | P0 | Listen for `companion:nudge` and reuse the bubble path | frontend-dev | C3-0, C3-2 | No | `TODO` | 2026-09-11 | No renderer listener exists today |
| C3-4 | P2 | Wire the `sleep`, `wave` and `blush` animations | frontend-dev | C3-1, D1 | Yes | `TODO` | 2026-09-16 | Frames exist since D1, but nothing plays them: `AnimationEngine` only reads `trigger` to exclude an animation from random idle, so `idle_long` and `on_greeting` have no implementation, and `blush` has no `Emotion` type. `sleep` pairs naturally with C3-1 idle detection |

## Acceptance Gates

### Documentation Gate (passed)

- `CLAUDE.md`, `AGENTS.md`, `.claude/agents/` describe `electron/agent/`, not the deleted Bridge architecture
- Repository paths referenced by active documentation exist
- Active agent instructions do not require ESLint — this repository has no ESLint configuration
- Legacy `openclaw` wording remains only where the `0.2.0` settings migration is documented (3 occurrences, verified at `027eada`)

### Implementation Gate (every task)

- `npx tsc -p tsconfig.json --noEmit` · `npx tsc -p tsconfig.node.json --noEmit`
- `npm test` · `npm run build:renderer` · `npm run build:main`
- `code-reviewer` before `test-build`

### Release Gate (every release)

- No unchecked P0/P1 in that release's `TODO.md`
- Installers pass on macOS and Windows real hardware
- `CHANGELOG.md` finalized before the tag

## Change Log

| Date | Change |
|---|---|
| 2026-09-11 | Tracker created; A4 marked `IN_PROGRESS`; F group marked `BLOCKED` on CPA availability. |
| 2026-09-11 | A4-A8 completed and verified; documentation group entered review. |
| 2026-09-11 | Product monitor baseline audit applied: added A1-A3, normalized REVIEW status, clarified priorities and release dependencies. |
| 2026-09-11 | A4-A8 passed re-review and test-build: diff check, two type checks, 67 unit tests, renderer build, main build. Group A complete. |
| 2026-09-11 | B1 entered Phase 3 implementation, then blocked by local Codex CLI compatibility/connectivity; no source changes produced. |
| 2026-09-11 | Group A committed as `027eada`; docs restructure as `e6a26e7`. Prior `DONE` entries carried no commit id, so a cross-worktree audit at `3081f80` reported A4 as stale. Commit id is now required Evidence for `REVIEW`/`DONE`. See `v0.2.0/PREFLIGHT.md`. |
| 2026-09-11 | Single v0.2.0 release split into the 0.2.0 / 0.3.0 / 0.4.0 train, cut by installable user-visible value. Tracker moved to `docs/` and scoped across all three. Added G1 (onboarding soft gate) — without it 0.2.0 cannot be accepted while CPA is down. Both commits moved off `master` onto `release/0.2.0`. |
| 2026-09-11 | D0 sprite tooling landed under `tools/` (slicer + checker, Pillow only). Unblocks D1 asset production, which does not depend on the Codex CLI. |
| 2026-09-12 | CPA gateway restored. F1/F2/F4/F5/F6 unblocked (F1 runnable immediately for a baseline); F3/F7 remain blocked on E1. Codex CLI is now the **only** blocker holding implementation. Gateway URL deliberately kept out of the repository — see `v0.2.0/TODO.md` F1. |
| 2026-09-12 | Delegated-edit-via-Codex requirement removed from `CLAUDE.md`, `AGENTS.md`, `electron-dev.md`, `frontend-dev.md`. Implementation agents now edit source directly; phases unchanged. No blockers remain on implementation. |
| 2026-09-12 | Added V0 (gateway model selection) with `v0.3.0/MODEL_SELECTION.md`. Integration harness hardened: `tests/integration/helpers.ts` no longer carries a stale default base URL, and `tools/cpa_probe.mjs` checks reachability, auth, model availability and SSE streaming before the suite runs. |
| 2026-09-12 | V0 done: `MiniMax-M2.7-highspeed` configured via CPA. F1 partially run — `agent-pipeline` PASS, first end-to-end success since April. Two findings recorded in `v0.3.0/F1-BASELINE.md`: thinking did not trigger OOC retry (by luck, not design — the pattern `as an assistant` can still match reasoning text), and memory extraction races `dispose()` so it likely never lands in tests. |
| 2026-09-12 | F1 DONE — 3 suites / 9 tests pass in 50.6s. Three further findings: `compression.test.ts` never reaches the 30-message threshold so F5 has zero real coverage; memory extraction is gated on the user saying "我"/"my" (1 of 4 messages fired); one turn took 15.28s against a 3-5s norm with no way to attribute it because API logs are not written. |
| 2026-09-13 | B1 implementation checklist added at `v0.2.0/TASKS-B1-LOGGING.md`; TODO path and lifecycle summary aligned with the approved spec. Status remains TODO. |
| 2026-09-13 | B1 Phase 3 resumed in electron-dev task `01a08c3b-1b84-7291-93ed-38a2e7d5ef05` under the updated direct-edit workflow; status set to IN_PROGRESS. |
| 2026-09-13 | B1 moved to fresh electron-dev task `01a0994c-558c-7870-82cf-4aa570019ea3` after the prior task produced no output; this is the active implementation task. |
| 2026-09-15 | B1 implemented and committed as `4095cbc` (main.ts lifecycle wiring + a logger.ts fail-safe fix authorised by the spec's own acceptance item, + `tests/unit/logger.test.ts` which also converts the retention-window manual steps into assertions). Status `REVIEW`, not `DONE`: dev/packaged manual acceptance still pending, and `build:renderer` cannot run in the Linux VM because `node_modules` was installed on macOS (no Linux rollup native binary) — an environment limit, not a code issue. |
| 2026-09-15 | 实测到用户可见的假阳性：设置页「测试连接」显示成功、同一会话对话却 `HTTP 401: Invalid API key`。根因是测试走表单值的裸 fetch，而 Agent 用启动时的 settings 快照且 `settings:set` 不重建 Agent。「settings:set 后热更新 Agent」由 P2 提升为 P1，并新增短期文案缓解项，见 `ARCHITECTURE.md` §9-B。|
| 2026-09-15 | B1 `DONE` — dev-mode acceptance passed, conv/api JSONL now written with real values. The very first real log line paid for the task: it showed `<think>` blocks are stored into `messages.content` and fed back as context, not merely displayed. See `v0.3.0/F1-BASELINE.md`. |
| 2026-09-15 | Probe step 4: `reasoning_split: true` returns clean `content` with thinking moved to `reasoning_content` — the fix exists at the source. Added C0 spec. Gateway now also serves `glm-5.3`, `glm-5.3-flash`, `glm-5.2`, so the fallback path for that non-standard parameter is a requirement, not a nicety. |
| 2026-09-16 | Grace's calls: C0 moves into **0.2.0** (data integrity); G1 **stays in 0.2.0**; F5 becomes a separate `CPA_SLOW_TESTS=1` case. Blocker list cleared — work moved to the macOS workstation, where the gateway is reachable and `git push` works (`release/0.2.0` pushed to `c45e171`; `master` already in sync, contradicting the handoff's "20 commits unpushed"). F1 row corrected to `DONE`. Release counts recomputed to match the rows. Added E2 (settings panel UI); bubble placement folded into E1. |
| 2026-09-17 | G1 architecture spec committed as `b9c0f7d`. It corrected the brief on a point that widens the stakes: `src/` has **no `agent:error` listener anywhere**, so any send that fails leaves the bubble on "···" forever, and the user message is saved before the request goes out. Letting unconfigured users through without an Agent-side guard would have written unanswered messages that later replay into context. The spec therefore rejects before `saveMessage`. The general stuck-bubble defect for configured users with an unreachable gateway is pre-existing and stays with E1. |
| 2026-09-16 | D1 sprite delivery. Grace supplied 26 frames (not the planned 8) plus a revised manifest: `cooking` removed, `sleep`/`wave`/`blush` added, emotion animations set to `trigger: "emotion"`. The manifest is compatible with the current engine with no `src/` change — emotion animations are played by name, and a missing `cooking` falls back to `talk`. `tools/sprite_check.py` passes (anchor drift ≤1px), but **it cannot see scale drift** on bust-shot frames because every bottom edge touches the canvas; a head-width measurement found 7 frames 11–30% oversized (worst: `intimate_001` at 231px against a 171–186px baseline). Visual review blocked 0.2.0 on two playback defects — `idle_002` holding closed eyes for 333ms and `talk_002` flashing an arm for one frame. Both were closed **without redrawing**: the engine indexes frames and caches by filename, so repeated names in `frames` control dwell time. `frameRate` 3 → 8; `idle` now blinks for 125ms every ~4.1s; `talk` alternates `001`/`003`. Visual review confirmed both defects gone. Not committed: 8 emotion frames still need redrawing (the in-channel image tool could only emit RGB with a painted checkerboard, not real alpha), and all frames need fringe cleanup, so binaries enter git once, final. |
| 2026-09-16 | C0 `DONE` at `a206559`, which closed all four review findings: the downgrade trigger is now `/\breasoning_split\b/i` (so `max_tokens` and `top_p_x` errors no longer disable the parameter for the instance's lifetime), a response that is non-empty but empty after stripping goes to the error path instead of being saved, `chatCompletion` strips centrally so compressor summaries and extracted memories are covered, and orphaned `</think>` is handled. Verified independently by lead. `tokenEstimate` landed at 4365 — below the 4445 baseline — but per the entry below that comparison is not the load-bearing evidence; the clean database is. |
| 2026-09-16 | C0 live acceptance at `bdb9a52` (`tests/integration/thinking-persistence.test.ts`, behind `CPA_SLOW_TESTS=1`): `MiniMax-M3` ×6 turns + `MiniMax-M2.5-highspeed` ×1, all 14 assistant rows clean, zero `reasoning_split unsupported` warnings, cumulative-delta semantics intact. The polluted database is backed up under `data/`. **The spec's token acceptance item was itself wrong** and has been retired: `historyLength=10` is not equal context (baseline was 8 user + 2 assistant, the new run 5 + 5), so the estimate rose to 4671 without any regression. The isolating measure is a counterfactual on the same old data — thinking is 46.3% of assistant characters, total context `4445 → 3916` (-11.9%). |
| 2026-09-16 | C0 independent review: no P0. Four issues to act on — the fallback regex fires on unrelated parameter 4xx and then permanently disables `reasoning_split` (this project does send `max_tokens`); an empty-after-strip result is still saved and shown as an empty message when a stream dies mid-thinking; the unclosed-tag rule deviates from the spec with zero test coverage; and `compressor.ts:35` / `memory-store.ts:106` never strip, so summaries carrying thinking reach the system prompt on every turn. |
| 2026-09-16 | C0 implemented and committed as `2eb304c` (+249/-6 across `tag-utils.ts`, `llm-client.ts`, `index.ts` and two new unit test files); status `REVIEW`. Call order verified by reading `index.ts:111-130`: strip → OOC → save → callbacks → conv log, with `rawResponse` still carrying the original text. The dev database confirms the damage the fix prevents: **all 3 assistant rows contain `<think>`**, so it needs clearing before any before/after `tokenEstimate` comparison. |
| 2026-09-16 | Gateway model probe, 8 calls, all HTTP 200. `reasoning_split: true` returns clean content with reasoning separated on `MiniMax-M2.7-highspeed`, `MiniMax-M3` and `MiniMax-M2.5-highspeed`; without it, all three return `<think>` inline. **No model rejects the parameter**, so C0's 4xx fallback cannot be exercised against this gateway and stays defensive-only. `glm-5.3` accepts it but returned **empty content** with 631 chars of reasoning (`max_tokens: 200`, so truncation is the likely cause but is unconfirmed) — a silent-empty-bubble risk, not a 4xx. Grace confirmed production and A/B both stay on MiniMax. |
