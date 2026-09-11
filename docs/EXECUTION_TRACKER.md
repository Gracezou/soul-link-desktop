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
| 0.2.0 | Visible desk pet | **No** | 0 | 9 | `BLOCKED` (Codex CLI) |
| 0.3.0 | Conversations that work | Yes | 0 | 12 | `BLOCKED` (Codex CLI + CPA) |
| 0.4.0 | Proactive companion | Yes | 0 | 13 | `TODO` |

Group A (documentation and agent metadata) is complete and is **not** a release — it was a preflight gate for the train.

## Current External Blockers

1. **Local Codex CLI cannot complete an implementation run.** `0.136.0`: the default configuration fails to decode the newer `max` reasoning value; the `--ignore-user-config -m gpt-5.5` retry repeatedly loses the sampling connection. Under the repository's mandatory delegated-edit workflow this blocks **every** implementation task in 0.2.0, 0.3.0 and 0.4.0. **Highest-impact blocker — larger than the CPA outage.**
   - Repository side is already clean: the rewritten `electron-dev.md` / `frontend-dev.md` call `codex exec --sandbox workspace-write` with **no hardcoded `--model`** (architect R7 applied in `027eada`). The failure is in the user-level configuration or CLI version, not in repository instructions.
2. **CPA LLM gateway is being rebuilt.** Blocks 0.3.0 and 0.4.0 verification. **Does not block 0.2.0** — that release was scoped so none of its exit criteria need a live gateway.

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
| B1 | P0 | Wire `initLogging()` at startup and `shutdownLogging()` at exit | electron-dev | None | Yes | `BLOCKED` | 2026-09-11 | Codex CLI 0.136.0 failed on `max`; isolated gpt-5.5 retry lost sampling connection; confirmed no source diff |
| D1 | P0 | Produce and validate eight initial sprite frames | asset agent | None | Yes | `TODO` | 2026-09-11 | Not started — does not require Codex CLI |
| G1 | P0 | Replace the hard onboarding gate with a "configure later" path | architect, electron-dev, frontend-dev | None | No | `TODO` | 2026-09-11 | Not started — blocks exit criterion 2 |
| C2 | P0 | Allow `res:` in packaged CSP; narrow renderer network sources | electron-dev | B1, D1 | Yes | `TODO` | 2026-09-11 | Not started — needs D1 output for real verification |
| D2 | P1 | Add a visible tray icon | asset agent | None | Yes | `TODO` | 2026-09-11 | Not started |
| D3 | P1 | Add application icons and enable builder icon configuration | asset/electron-dev | D2 | Yes | `TODO` | 2026-09-11 | Not started |
| D0 | P2 | Sprite sheet slicer and frame consistency checker under `tools/` | docs/tools agent | None | Yes | `TODO` | 2026-09-11 | Optional; not subject to the delegated-edit rule |
| F8 | P0 | Set `package.json` version to `0.2.0` | release owner | B1, C2, D1-D3, G1 | No | `TODO` | 2026-09-11 | Gated on implementation completion |
| F9 | P0 | Verify the `0.2.0` legacy settings migration | test-build | F8 | No | `TODO` | 2026-09-11 | Migration never executes while version is `0.1.0`; first run happens at bump |

## Release 0.3.0 — Conversations That Work

| ID | Priority | Task | Owner | Depends On | Parallel | Status | Updated | Evidence |
|---|---|---|---|---|---|---|---|---|
| C1 | P0 | Broadcast Agent lifecycle events to pet and chat windows | electron-dev | 0.2.0 shipped | Yes | `BLOCKED` | 2026-09-11 | Codex CLI unavailable |
| E1 | P0 | Rebuild chat bubble state, clock, filtering, errors, dismissal, layout, tests | frontend-dev | 0.2.0 shipped | Yes | `BLOCKED` | 2026-09-11 | Codex CLI unavailable |
| F1 | P0 | Run live Agent integration tests | test-build | CPA restored | No | `BLOCKED` | 2026-09-11 | CPA unavailable |
| F2 | P0 | Verify onboarding, first conversation, restart, session persistence | test-build | F1 | No | `BLOCKED` | 2026-09-11 | CPA unavailable |
| F3 | P0 | Verify streaming bubble behavior and emotion-tag filtering | test-build | F1, E1 | No | `BLOCKED` | 2026-09-11 | CPA unavailable |
| F4 | P1 | Verify OOC detection and at most two retries | test-build | F1 | No | `BLOCKED` | 2026-09-11 | CPA unavailable |
| F5 | P1 | Verify compression after more than 30 messages | test-build | F1 | No | `BLOCKED` | 2026-09-11 | CPA unavailable |
| F6 | P1 | Verify cross-session memory recall | test-build | F1 | No | `BLOCKED` | 2026-09-11 | CPA unavailable |
| F7 | P0 | Verify network, credential, and waiting-timeout error paths | test-build | F1, E1 | No | `BLOCKED` | 2026-09-11 | CPA unavailable |

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
