# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Soul Link Desktop is an AI desktop companion built with Electron, React, and
TypeScript. Its in-process Agent under `electron/agent/` connects to the CPA or
another OpenAI-compatible LLM gateway over HTTP and SSE (default model:
`MiniMax-M2`), maintains character context and local memory, and drives the
desktop pet chat experience.

`docs/ARCHITECTURE.md` is the architecture source of truth. Read it before
changing process boundaries, IPC, persistence, packaging, or Agent behavior.

## Commands

- `npm run dev` - Vite, main-process TypeScript watch, and Electron hot reload.
- `npm run build:renderer` - build `src/` into `dist/`.
- `npm run build:main` - compile `electron/` into `dist-electron/`.
- `npm run build` - build both processes and package the current platform.
- `npm test` or `npm run test:unit` - run `tests/unit/`.
- `npm run test:integration` - run live LLM tests serially; requires
  `CPA_API_KEY`, otherwise tests skip.
- `npm run test:all` - run all Jest suites serially.
- `npx jest tests/unit/ooc-detector.test.ts` - run one unit test file.
- `npx tsc -p tsconfig.json --noEmit` - check renderer types.
- `npx tsc -p tsconfig.node.json --noEmit` - check main-process types.

The repository has no ESLint dependency or configuration. Do not report a
missing lint command as a product failure.

## Directory Rules

- `electron/` - Electron main process, Node.js/CommonJS.
- `electron/agent/` - in-process Agent, LLM client, character engine, context,
  compression, memory, session persistence, OOC detection, and token utilities.
- `electron/logger.ts` - ops, API, and conversation JSONL logging.
- `electron/utils/` - runtime resource, database, and onboarding path/guard logic.
- `electron/windows/` - pet, chat, settings, and onboarding windows.
- `src/` - React renderer, browser ESM. It must not import `electron/` modules.
- `res/` - packaged cards, sprites, and icons.
- `tests/unit/` - default Jest suite; `tests/integration/` requires a live gateway.
- `tools/` - development utilities for sprite conversion and assets.
- `data/` - development database data such as `soul-link.db`; ignored by Git.
- `docs/ARCHITECTURE.md` - current architecture source of truth.
- `docs/v0.2.0/` - current release plan, execution tracker, and feature designs.
- `docs/archive/` - historical material; do not treat it as current architecture.

## Architecture

### Process Separation

Main and renderer communicate only through the preload IPC API. Main owns
Electron, network calls, settings, SQLite, resources, and lifecycle. Renderer
owns UI state and presentation. New IPC channels must be constants in
`electron/ipc.ts` and documented in the contract comment in `electron/preload.ts`.

### Agent

`SoulLinkAgent` in `electron/agent/index.ts` orchestrates the response lifecycle:

1. `initialize()` loads sql.js, the character card, and the current session.
2. `sendMessage()` builds context and streams an LLM response.
3. OOC output may be retried at most twice.
4. The final assistant message is saved before asynchronous memory extraction
   and, after more than 30 messages, summary compression.
5. `dispose()` closes persistence resources.

Important modules:

- `llm-client.ts` - OpenAI-compatible chat completions and SSE streaming, with
  timeout and network retry handling.
- `character-engine.ts` - SillyTavern V2 card to system prompt.
- `context-manager.ts` - token-budgeted conversation window.
- `compressor.ts` - summary generation for long sessions.
- `memory-store.ts` - long-term memories.
- `session-store.ts` - sql.js/WASM sessions and messages.
- `ooc-detector.ts`, `token-counter.ts`, `tag-utils.ts` - response safeguards and
  protocol helpers.

`launchMainApp()` constructs the Agent with total/system/output budgets of
8000/2000/500 tokens, calls `initialize()`, and sends `agent:ready` to the pet
window.

### IPC Contract

Agent events declared in `electron/ipc.ts`:

- `agent:ready` - `{ ready, character, llmConfigured }`; `llmConfigured` means the
  Agent's construction-time `baseUrl`/`apiKey`/`model` are all non-empty after trimming, with missing fields treated as empty (not
  that the gateway is reachable). Renderers update it on every event.
  `agent:get-status` returns the same shape.
- `agent:waiting` - `{ messageId }`
- `agent:delta` - `{ messageId, delta }`; `delta` is cumulative response text,
  not an incremental chunk. Consumers replace, not append.
- `agent:final` - `{ messageId, text }`
- `agent:error` - `{ messageId, error }`
- `agent:message-saved` - `{ message }`, sent to the history window.
- `agent:send`, `agent:get-history`, `agent:reset`, `agent:test-connection`, and
  `agent:get-status` are renderer-to-main commands or queries.

Other declared groups are `settings:get/set/changed`, `pet:mouse-enter/leave`,
`companion:nudge/status`, `window:toggle-chat/open-settings/open-history`,
`onboarding:complete`, `app:relaunch/get-version`, and `cards:list`.

Current legacy raw-string channels include `chat:open`, `settings:open`,
`window:close`, `window:close-history`, `pet:move-window`,
`pet:save-position`, `pet:resize-window`, `pet:set-clickthrough`,
`pet:set-focusable`, and the unused `pet:drag-start/move/end` senders. Existing
ones are backlog; new channels must use `electron/ipc.ts` constants.

Agent lifecycle events currently go only to the pet window. Broadcasting them to
the chat window is a v0.2.0 task because the chat renderer otherwise cannot
clear loading state.

### Renderer Data Flow

`useChat.sendMessage` or `CompactInput` sends `agent:send`. The Agent emits
waiting, cumulative delta, final, and error events.

- `ChatBubbleFeedback` consumes waiting/delta/final and uses protocol filters and
  `bubbleParser` for the typewriter bubble.
- `useAgent` consumes ready/final, updates `chatStore`, maps emotion, and updates
  `petStore`.

These paths currently duplicate final-response emotion/FV handling. The v0.2.0
bubble redesign removes the duplicate side effect.

### Renderer State

- `chatStore.ts` - messages, readiness, connection, and loading state.
- `petStore.ts` - animation, favorability, and physics state.
- `settingsStore.ts` - legacy unused store with obsolete gateway fields; do not
  extend it without an explicit cleanup decision.

### Settings And Persistence

`SoulLinkSettings` contains:

```typescript
{
  cpa: { baseUrl, apiKey, model },
  character: { cardName },
  companion: { enabled, idleMinutes, mode: 'balanced' | 'checkin' | 'question' | 'report' },
  pet: { character, positionX, positionY, scale },
  ui: { language, theme },
  onboarding: { completed, completedAt? }
}
```

The electron-store `0.2.0` legacy migration converts the former `openclaw`
settings into `cpa` and `character`. Do not remove this migration.

Settings live under Electron `userData`. The development database is
`data/soul-link.db`; packaged builds use `userData/soul-link.db`. Resource and DB
paths must use `electron/utils/paths.ts`. `sql.js` must remain unpacked from ASAR.

### Windows And Companion

- Pet: transparent, frameless, always-on-top renderer for `PetApp`.
- Chat: frameless popup positioned near the pet.
- Settings: fixed settings window.
- Onboarding: first-run configuration guarded by `utils/onboardingGuard.ts`,
  which checks only `onboarding.completed`. The connection step can be skipped
  ("configure later"); an unconfigured Agent is still constructed and
  initialized, and `sendMessage()` rejects before saving anything.
- History: resizable frameless window created in `main.ts`.

`CompanionScheduler` currently emits fixed `companion:nudge` messages, but the
renderer has no consumer and nudges do not pass through the Agent. Completing
that connection is part of v0.2.0.

## Known Gaps

- `res/sprites/baiyuan/frames/` is empty although
  `res/sprites/baiyuan/manifest.json` names animations;
  the pet currently falls back to placeholder rendering.
- Agent callbacks in `electron/main.ts` send lifecycle events only to petWindow,
  not the chat window.
- Packaged CSP in `electron/main.ts` does not yet allow the `res:` fetch scheme.
- `electron/main.ts` and `electron/companion/` emit fixed companion nudges that
  are neither Agent-generated nor consumed by `src/`.
- `src/i18n/`, `src/utils/emotionMapper.ts`,
  `src/pet/expressions/ExpressionRenderer.ts`, and `src/App.tsx` retain obsolete
  gateway wording in user text or comments.
- `src/stores/settingsStore.ts` is unused legacy code.
- Six legacy tests at `tests/` root are excluded by the default `npm test`.
- No ESLint toolchain is configured.
- Sprite frames, tray icon, and application icons are missing.

Track v0.2.0 work in `docs/v0.2.0/EXECUTION_TRACKER.md`; longer-term internal
cleanup belongs in `docs/BACKLOG.md`.

## Subagent Workflow

All source changes follow these phases:

1. `pm-planner` defines scope, dependencies, and acceptance criteria for
   non-trivial work.
2. `architect` defines contracts for IPC, new processes/windows, module-boundary
   changes, or work spanning `electron/` and `src/`.
3. `electron-dev` exclusively changes `electron/`; `frontend-dev` exclusively
   changes `src/`. Both edit source directly.
4. `code-reviewer` reviews completed implementation. P0 findings return to the
   relevant implementation agent before re-review.
5. `test-build` runs renderer/main type checks, unit tests, and renderer/main
   builds. Full packaging is required only for release or packaging changes.

The main conversation must not create, edit, or delete files under `electron/`
or `src/`. Documentation and asset-only work does not require a Phase 3 source
implementation agent. Preserve unrelated changes in a dirty worktree.

For a single-directory change, keep the same sequence with only the relevant
implementation agent. For unclear scope, use `architect` before implementation.

### Routing Rules

| Trigger | Required agent |
|---|---|
| Design document, PRD, feature specification, or non-trivial task | `pm-planner` |
| IPC contract, window/process, module boundary, or `electron/` + `src/` work | `architect` |
| Any source change under `electron/` | `electron-dev` |
| Any source change under `src/` | `frontend-dev` |
| Completed implementation | `code-reviewer` |
| Accepted review requiring checks/builds | `test-build` |

### Single-Module Shortcuts

- `electron/` only: `pm-planner` when non-trivial -> `electron-dev` ->
  `code-reviewer` -> `test-build`.
- `src/` only: `pm-planner` when non-trivial -> `frontend-dev` ->
  `code-reviewer` -> `test-build`.
- Both directories or a new interface: `pm-planner` -> `architect` -> both
  implementation agents as applicable -> `code-reviewer` -> `test-build`.
- Documentation/assets only: no Phase 3 source agent is required, but review and
  proportionate verification still apply.
