# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview
AI-powered desktop companion app (乙女游戏角色情感伴侣). Built with Electron + React + TypeScript. Connects to an OpenClaw AI gateway over WebSocket to drive an animated pet sprite and chat interface.

## Commands
- `npm run dev` — Start dev server (Vite on port 5173 + electronmon for hot-reload)
- `npm run build` — TypeScript compile electron/ → dist-electron/, Vite build → dist/, then electron-builder package
- `npm test` — Run Jest tests (node environment, ts-jest preset)
- Run a single test file: `npx jest tests/responseParser.test.ts`

## Directory Rules
- `electron/` — Main process (Node.js, **CommonJS**), compiled to `dist-electron/`
- `src/` — Renderer process (React, **ESM**), compiled to `dist/`
- `res/` — Static assets: sprites, character cards, tray icon
- `tools/` — Python dev utilities (sprite converter, card generator)
- `tests/` — Jest tests; `tests/__mocks__/electron.ts` mocks the Electron module
- `data/` — Runtime data including `settings.json` (gitignored)

## Architecture

### Process Separation
Electron main process and React renderer run in separate Node.js/browser contexts and communicate **only via IPC**. Channel names are defined as constants in `electron/ipc.ts`.

### OpenClaw Bridge (Main Process)
`electron/bridge/` — WebSocket JSON-RPC-like client to the AI gateway:
- `client.ts` — Low-level WebSocket client; handles handshake (challenge/nonce), send/receive
- `worker.ts` — High-level session lifecycle: connect → list cards → import card → start roleplay
- `config.ts` — `BridgeConfig` interface and defaults
- `types.ts` — Gateway protocol TypeScript types

Startup flow: `main.ts` instantiates `BridgeWorker`, which drives the bridge through the session lifecycle and fires IPC events to the renderer.

### IPC Channels (`electron/ipc.ts`)
Key channels:
- `bridge:message` — AI response text pushed to renderer `{ runId, text }`
- `bridge:session` — Session ready status `{ ready, card }`
- `bridge:send` — Renderer sends user message `{ message }`
- `settings:get` / `settings:set` — Settings read/write
- `companion:nudge` — Companion scheduler triggers proactive message

### Renderer State (Zustand stores in `src/stores/`)
- `chatStore.ts` — Messages array + session/loading state
- `petStore.ts` — Animation state, FV (favorability) level, physics state
- `settingsStore.ts` — Gateway config, character selection

### Response Pipeline
```
User input → ChatWindow → invoke('bridge:send')
  → BridgeWorker → OpenClaw WebSocket
  → bridge:message IPC event
  → useBridge hook → responseParser.ts (extracts actions/dialogues/emotions)
  → chatStore (append message) + petStore (trigger animation via emotionMapper.ts)
```

### Animation System (`src/pet/`)
- `AnimationEngine.ts` — Probability-based action selection, FV-gated animations, frame sequencing
- `SpriteSheet.ts` — Frame image loader and cache
- `PetCanvas.tsx` — Canvas 2D renderer; reads `res/sprites/<character>/manifest.json`
- `PhysicsEngine.ts` — Drag, fall, bounce physics

**Sprite manifest format**: `res/sprites/<character>/manifest.json` — defines `character`, `defaultAnimation`, `frameRate`, and `animations[]` array. Tool `tools/sprite_converter.py` converts DyberPet `act_conf.json` to this format.

### Settings Persistence
`electron/store/settings.ts` wraps `electron-store`. Schema (`SoulLinkSettings`):
```typescript
{ openclaw: { gatewayWsUrl, authToken, sessionKey, defaultCard, ... },
  companion: { enabled, idleMinutes, mode },
  pet: { character, positionX, positionY, scale },
  ui: { language } }
```

### Windows
- **Pet window** (`electron/windows/petWindow.ts`) — Transparent, frameless, always-on-top, click-through; hosts `PetCanvas`
- **Chat window** (`electron/windows/chatWindow.ts`) — Standard popup; opened when `ChatBubble` is clicked
- **Settings window** (`electron/windows/settingsWindow.ts`) — Tabbed settings UI

### Companion Scheduler
`electron/companion/scheduler.ts` fires `companion:nudge` IPC events on idle intervals; trigger conditions defined in `electron/companion/triggers.ts`.

## Packaging
`electron-builder.yml` targets Windows (NSIS `.exe`) and macOS (`.dmg`). Run `npm run build` to produce installers.

## Full Architecture Reference
`docs/SOUL_LINK_MIGRATION.md` — comprehensive spec (746 lines) covering gateway protocol, IPC design, animation manifest format, settings schema, and the original 7-phase implementation plan.

---

## Subagent Orchestration — MANDATORY

This project has 6 specialized subagents defined in `.Codex/agents/`.

### ⚠️ CRITICAL: No Direct Code Changes in Main Conversation

**You MUST NOT directly create, edit, or delete files under `electron/` or `src/` in the main conversation.**
ALL code changes MUST be delegated to the appropriate subagent.
Modifying source files directly is a violation of the project workflow.

The main conversation is for coordination only: reading code, dispatching subagents, reviewing results, and communicating with the user. The main conversation does NOT write code.

### Development Workflow

This project follows a strict 5-phase development workflow. Every feature, bug fix, or refactor MUST go through these phases in order. No phase may be skipped unless it is genuinely not applicable.

```
Phase 1: Requirement Analysis    → pm-planner
Phase 2: Architecture Design     → architect
Phase 3: Implementation          → electron-dev / frontend-dev
Phase 4: Code Review             → code-reviewer
Phase 5: Test & Verification     → test-build
```

**Phase 1 — Requirement Analysis** (`pm-planner`, Opus, read-only)
- Triggered by: design doc, PRD, feature spec, or any non-trivial task
- Output: task breakdown with priorities, dependencies, and acceptance criteria
- MUST run before any code changes begin
- Skip ONLY for trivial single-file fixes (typos, one-line config changes)

**Phase 2 — Architecture Design** (`architect`, Opus, read-only)
- Triggered by: new IPC channels, new windows/processes, module boundary changes, or cross-directory work
- Output: interface contracts, data flow design, security assessment
- MUST run when changes touch both `electron/` and `src/`
- Skip when changes are isolated to a single module with no new interfaces

**Phase 3 — Implementation** (`electron-dev` / `frontend-dev`, Sonnet, via Codex CLI)
- `electron-dev` — ALL changes under `electron/` (main process, IPC, windows, bridge, store)
- `frontend-dev` — ALL changes under `src/` (React components, hooks, stores, styles, animations)
- These agents write code exclusively through `codex exec` — no other method is permitted
- MAY run in parallel once Phase 2 has finalized interface contracts
- If changes span both directories, BOTH agents must be dispatched

**Phase 4 — Code Review** (`code-reviewer`, Opus, read-only + bash checks)
- MUST run after ALL implementation is complete — never before or during
- Reviews: code quality, Electron security, TypeScript types, cross-platform compatibility
- Output: categorized findings (P0 must-fix / P1 should-improve / P2 optional)
- If P0 issues found → dispatch the relevant implementation agent to fix, then re-review

**Phase 5 — Test & Verification** (`test-build`, Sonnet, read-only + bash checks)
- Runs: `npx tsc --noEmit`, `npx eslint .`, `npm test`, `npm run build`
- Output: pass/fail status for each check with error details
- If failures found → dispatch the relevant implementation agent to fix, then re-verify

### Routing Rules

| Trigger | Subagent | Phase |
|---------|----------|-------|
| Design doc / PRD / feature spec received | `pm-planner` | 1 |
| Module boundaries, IPC protocol, new window/process | `architect` | 2 |
| ANY changes under `electron/` | `electron-dev` | 3 |
| ANY changes under `src/` | `frontend-dev` | 3 |
| After ALL code changes are complete | `code-reviewer` | 4 |
| Build/test verification needed | `test-build` | 5 |

### Single-Module Shortcuts

For changes touching only one directory, the workflow compresses but phases are NOT skipped:
- `electron/` only → Phase 1 (if non-trivial) → `electron-dev` → `code-reviewer` → `test-build`
- `src/` only → Phase 1 (if non-trivial) → `frontend-dev` → `code-reviewer` → `test-build`
- Scope unclear → dispatch `architect` first to assess impact before implementation

### Code Modification Policy

- `electron-dev` and `frontend-dev` **MUST use `codex exec` to modify code**
- They MUST NOT use Write, Edit, `echo >`, `cat >`, `sed -i`, `tee`, or any other direct file write method
- `pm-planner`, `architect`, `code-reviewer` are strictly read-only — they do NOT modify source files
- `test-build` only runs check commands — it does NOT modify source files
- The main conversation MUST NOT modify source files under `electron/` or `src/` — delegation is mandatory