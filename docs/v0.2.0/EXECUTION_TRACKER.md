# v0.2.0 Execution Tracker

> Last updated: 2026-09-11
> Product status source for `pm-planner` and implementation agents.
> Scope and release criteria: [`RELEASE_PLAN.md`](./RELEASE_PLAN.md)
> Detailed requirements: [`TODO.md`](./TODO.md)

## Status Rules

| Status | Meaning |
|---|---|
| `TODO` | Ready or waiting on an internal dependency |
| `IN_PROGRESS` | Assigned and actively being worked |
| `BLOCKED` | Cannot proceed without an external dependency |
| `REVIEW` | Implementation complete, awaiting code review or verification |
| `DONE` | Acceptance evidence recorded and all required checks passed |

Agents must update `Status`, `Updated`, and `Evidence` when a task changes state. A task is not `DONE` until its acceptance criteria have objective evidence.

## Release Summary

| Group | Scope | Done | Total | Status |
|---|---|---:|---:|---|
| A | Documentation and agent metadata | 8 | 8 | `DONE` |
| B | Observability | 0 | 1 | `BLOCKED` |
| C | Feature wiring | 0 | 3 | `TODO` |
| D | Runtime assets | 0 | 3 | `TODO` |
| E | Chat bubble redesign | 0 | 1 | `TODO` |
| F | Verification and release | 0 | 12 | `BLOCKED` |

Current external blockers:

- The local Codex CLI (`0.136.0`) cannot complete an implementation run: the default configuration fails to decode the newer `max` reasoning value, and the `--ignore-user-config -m gpt-5.5` retry repeatedly loses the sampling connection. This blocks B1 under the repository's mandatory delegated-edit workflow; no source changes were produced.
- The CPA LLM gateway is being rebuilt. This blocks live integration verification and release validation, but does not block groups A, C1, C2, D, or E once their internal dependencies are available.

## Active Queue

| ID | Priority | Task | Owner | Depends On | Parallel | Status | Updated | Evidence |
|---|---|---|---|---|---|---|---|---|
| A1 | P0 | Produce the Phase 1 documentation rewrite plan | pm-planner | None | No | `DONE` | 2026-09-09 | `PLAN-CLAUDE-MD-REWRITE.md` |
| A2 | P0 | Produce the current architecture source of truth | architect | A1 | No | `DONE` | 2026-09-09 | `docs/ARCHITECTURE.md` with R1-R8 decisions |
| A3 | P0 | Consolidate archives, README, and version documentation structure | docs agent | A1-A2 | No | `DONE` | 2026-09-09 | README and `docs/v0.2.0`, `docs/archive` structure present |
| A4 | P0 | Rewrite `.claude/agents/architect.md` for the self-built Agent architecture | docs agent | A1-A3 | No | `DONE` | 2026-09-11 | §6 copied verbatim; review and test-build passed |
| A5 | P0 | Rewrite `CLAUDE.md` using `docs/ARCHITECTURE.md` as source of truth | docs agent | A4 | No | `DONE` | 2026-09-11 | Facts/commands/paths reviewed; regression checks passed |
| A6 | P0 | Synchronize finalized `CLAUDE.md` into `AGENTS.md` | docs agent | A5 | No | `DONE` | 2026-09-11 | Diff contains only title and Claude/Codex wording |
| A7 | P0 | Rewrite the five remaining `.claude/agents/*.md` definitions | docs agent | A4 | Yes | `DONE` | 2026-09-11 | Review P0/P1=0; stale terms and invalid commands absent |
| A8 | P2 | Correct the archived `better-sqlite3` wording | docs agent | None | Yes | `DONE` | 2026-09-11 | sql.js/WASM wording verified by test-build |
| B1 | P0* | Wire `initLogging()` at startup and `shutdownLogging()` at exit | electron-dev | A4-A7 | Yes | `BLOCKED` | 2026-09-11 | CLI 0.136.0 failed on `max`; isolated gpt-5.5 retry lost sampling connection; confirmed no source diff |
| C1 | P0* | Broadcast Agent lifecycle events to pet and chat windows | electron-dev | B1 | Yes | `TODO` | 2026-09-11 | Pending |
| C2 | P0* | Allow `res:` in packaged CSP and remove unnecessary renderer network sources | electron-dev | B1 | Yes | `TODO` | 2026-09-11 | Pending |
| E1 | P0 | Rebuild chat bubble state, clock, filtering, errors, dismissal, layout, and tests | frontend-dev | A4-A7 | Yes | `TODO` | 2026-09-11 | Pending |
| D1 | P1 | Produce and validate eight initial sprite frames | asset agent | None | Yes | `TODO` | 2026-09-11 | Pending |
| D2 | P1 | Add a visible tray icon | asset agent | None | Yes | `TODO` | 2026-09-11 | Pending |
| D3 | P1 | Add application icons and enable builder icon configuration | asset/electron-dev | D2 | Yes | `TODO` | 2026-09-11 | Pending |
| C3 | P1* | Route companion nudges through the Agent and render the result | architect, electron-dev, frontend-dev | B1, C1, E1 | No | `TODO` | 2026-09-11 | Pending |

`*` Priorities marked with an asterisk are elevated inside the v0.2.0 release because they are required for a usable release. `docs/ARCHITECTURE.md` retains their longer-term architecture severity.

## Verification And Release Queue

| ID | Priority | Task | Owner | Depends On | Status | Evidence |
|---|---|---|---|---|---|---|
| F1 | P0 | Run live Agent integration tests | test-build | CPA restored, B-C-E | `BLOCKED` | CPA unavailable |
| F2 | P0 | Verify onboarding, first conversation, restart, and session persistence | test-build | F1 | `BLOCKED` | CPA unavailable |
| F3 | P0 | Verify streaming bubble behavior and emotion-tag filtering | test-build | F1, E1 | `BLOCKED` | CPA unavailable |
| F4 | P1 | Verify OOC detection and at most two retries | test-build | F1, B1 | `BLOCKED` | CPA unavailable |
| F5 | P1 | Verify compression after more than 30 messages | test-build | F1, B1 | `BLOCKED` | CPA unavailable |
| F6 | P1 | Verify cross-session memory recall | test-build | F1, B1 | `BLOCKED` | CPA unavailable |
| F7 | P0 | Verify network, credential, and waiting-timeout error paths | test-build | F1, E1 | `BLOCKED` | CPA unavailable |
| F8 | P0 | Set `package.json` version to `0.2.0` | release owner | F1-F7 | `BLOCKED` | CPA-backed prerequisite verification incomplete |
| F9 | P0 | Verify the `0.2.0` legacy settings migration | test-build | F8 | `BLOCKED` | Depends on version bump after CPA verification |
| F10 | P0 | Verify macOS x64/arm64 and Windows installers on real systems | test-build | F8-F9 | `BLOCKED` | Depends on CPA verification and migration check |
| F10.5 | P1 | Finalize `CHANGELOG.md` for `0.2.0` | release owner | F1-F10 | `TODO` | Draft may proceed; finalization waits for release evidence |
| F11 | P0 | Create and push tag `v0.2.0` | release owner | All other release tasks | `BLOCKED` | Depends on every other release gate |

## Acceptance Gates

### Documentation Gate

- `CLAUDE.md`, `AGENTS.md`, and `.claude/agents/` describe `electron/agent/`, not the deleted Bridge architecture.
- Repository paths referenced by active documentation exist.
- Active agent instructions do not require ESLint because this repository has no ESLint configuration.
- Legacy `openclaw` wording remains only where the `0.2.0` settings migration is documented.

### Implementation Gate

- Renderer check: `npx tsc -p tsconfig.json --noEmit`
- Main-process check: `npx tsc -p tsconfig.node.json --noEmit`
- Unit tests: `npm test`
- Renderer build: `npm run build:renderer`
- Main-process build: `npm run build:main`
- Every implementation task passes `code-reviewer` before `test-build` verification.

### Release Gate

- No unchecked P0/P1 task remains in [`TODO.md`](./TODO.md).
- CPA-backed integration and end-to-end checks pass.
- The legacy settings migration is tested after the version bump.
- macOS and Windows installers pass installation, conversation, persistence, resource, and logging checks.
- `CHANGELOG.md` is finalized before tag `v0.2.0` is created.

## Change Log

| Date | Change |
|---|---|
| 2026-09-11 | Tracker created; A4 marked `IN_PROGRESS`; F group marked `BLOCKED` on CPA availability. |
| 2026-09-11 | A4 completed and verified; A5 started. |
| 2026-09-11 | A5 completed and verified; A6 started. |
| 2026-09-11 | A6-A8 completed; documentation group entered review. |
| 2026-09-11 | Product monitor baseline audit applied: added A1-A3, normalized REVIEW status, clarified priorities and release dependencies. |
| 2026-09-11 | A4-A8 passed re-review and test-build: diff check, two type checks, 67 unit tests, renderer build, and main build. Group A complete. |
| 2026-09-11 | B1 entered Phase 3 implementation. |
| 2026-09-11 | B1 blocked by local Codex CLI compatibility/connectivity after one isolated retry; no source changes were produced. |
| 2026-09-11 | Group A committed to master as `027eada` (8 files, +712/-658). Prior `DONE` entries had no commit id, so a cross-worktree audit at `3081f80` reported A4 as stale; see `PREFLIGHT.md`. Commit id is now required Evidence for `REVIEW`/`DONE`. |
