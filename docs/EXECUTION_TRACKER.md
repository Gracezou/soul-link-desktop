# Execution Tracker — 0.2.0 / 0.3.0 / 0.4.0

> Last updated: 2026-09-11
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
| 0.2.0 | Visible desk pet | **No** | 1 | 9 | `TODO` — unblocked |
| 0.3.0 | Conversations that work | Yes | 0 | 13 | `TODO` — unblocked |
| 0.4.0 | Proactive companion | Yes | 0 | 13 | `TODO` |

Group A (documentation and agent metadata) is complete and is **not** a release — it was a preflight gate for the train.

## Current External Blockers

1. ~~Local Codex CLI cannot complete an implementation run.~~ **Resolved 2026-09-12 by removing the dependency.** The mandatory delegated-edit workflow has been dropped: `electron-dev` and `frontend-dev` now edit source directly. The five-phase workflow (pm-planner → architect → implement → code-reviewer → test-build) is unchanged; only the executor changed. **All implementation tasks are unblocked.**
2. ~~CPA LLM gateway is being rebuilt.~~ **Resolved 2026-09-12** — gateway is back up. Verification tasks that only need a live gateway are unblocked; those that also need unshipped implementation stay blocked on the Codex CLI.
   - **F1 can run right now** against the current `3081f80` source and produce the first post-outage integration baseline. It needs no implementation work and no Codex CLI.
   - The gateway is a single self-hosted instance that was down for five months. Treat its availability as a dependency that will fail again — that is the standing argument for G1.

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

Exit criteria need **no LLM gateway**. This is the only release that can proceed during the CPA outage.

| ID | Priority | Task | Owner | Depends On | Parallel | Status | Updated | Evidence |
|---|---|---|---|---|---|---|---|---|
| B1 | P0 | Wire `initLogging()` at startup and `shutdownLogging()` at exit | electron-dev | None | Yes | `TODO` | 2026-09-12 | **Now blocks model selection**: F1 showed every conclusion had to be reverse-engineered from console output because no JSONL is written. `oocRetryCount` / `emotionTag` / token stats needed for the M2.7-vs-M2-her comparison all live in `conv-*.jsonl` |
| D1 | P0 | Produce and validate eight initial sprite frames | asset agent | None | Yes | `TODO` | 2026-09-11 | Not started — does not require Codex CLI |
| G1 | P0 | Replace the hard onboarding gate with a "configure later" path | architect, electron-dev, frontend-dev | None | No | `TODO` | 2026-09-11 | Not started — blocks exit criterion 2 |
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
| E1 | P0 | Rebuild chat bubble state, clock, filtering, errors, dismissal, layout, tests | frontend-dev | 0.2.0 shipped | Yes | `TODO` | 2026-09-12 | Unblocked |
| F1 | P0 | Run live Agent integration tests | test-build | CPA restored | No | `TODO` | 2026-09-11 | Gateway restored; can run now against current source for a baseline |
| F2 | P0 | Verify onboarding, first conversation, restart, session persistence | test-build | F1 | No | `TODO` | 2026-09-11 | Depends on F1 only |
| F3 | P0 | Verify streaming bubble behavior and emotion-tag filtering | test-build | F1, E1 | No | `TODO` | 2026-09-12 | Waits on E1 only |
| F4 | P1 | Verify OOC detection and at most two retries | test-build | F1 | No | `TODO` | 2026-09-11 | Depends on F1 only |
| F5 | P1 | Verify compression after more than 30 messages | test-build | F1 | No | `TODO` | 2026-09-11 | Depends on F1 only |
| F6 | P1 | Verify cross-session memory recall | test-build | F1 | No | `TODO` | 2026-09-11 | Depends on F1 only |
| F7 | P0 | Verify network, credential, and waiting-timeout error paths | test-build | F1, E1 | No | `TODO` | 2026-09-12 | Waits on E1 only |

## Release 0.4.0 — Proactive Companion

| ID | Priority | Task | Owner | Depends On | Parallel | Status | Updated | Evidence |
|---|---|---|---|---|---|---|---|---|
| C3-0 | P0 | Architect the nudge contract across main and renderer | architect | 0.3.0 shipped | No | `TODO` | 2026-09-11 | Phase 2 mandatory — cross-directory change |
| C3-1 | P0 | Replace the fixed interval with real idle detection | electron-dev | C3-0 | No | `TODO` | 2026-09-11 | `triggers.shouldTrigger()` currently has no caller |
| C3-2 | P0 | Generate nudges through the Agent instead of fixed strings | electron-dev | C3-0 | No | `TODO` | 2026-09-11 | `main.ts:466` TODO still present |
| C3-3 | P0 | Listen for `companion:nudge` and reuse the bubble path | frontend-dev | C3-0, C3-2 | No | `TODO` | 2026-09-11 | No renderer listener exists today |

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
