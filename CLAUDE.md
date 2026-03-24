# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Subagent Orchestration

This project has 6 specialized subagents defined in `.claude/agents/`. When implementing features, refactoring, or executing design documents, **you MUST delegate to the appropriate subagents** instead of doing all the work in the main conversation.

### Routing Rules

| Trigger | Subagent | Purpose |
|---------|----------|---------|
| Design doc / PRD / feature spec received | `pm-planner` | Analyze requirements, break down tasks, define acceptance criteria |
| Module boundaries, IPC protocol, new window/process design | `architect` | Evaluate architecture impact, define interface contracts |
| Changes under `electron/` | `electron-dev` | Main process, IPC handlers, window management, preload scripts |
| Changes under `src/` | `frontend-dev` | React components, hooks, stores, styles |
| After code changes are complete | `code-reviewer` | Review code quality, security, cross-platform compatibility |
| Build/test verification needed | `test-build` | Run tsc, lint, jest, electron-builder |

### Execution Pipeline

For multi-module feature work (e.g. design documents), dispatch subagents in this order:

```
1. pm-planner    → Requirement analysis, task breakdown
2. architect     → Architecture review, interface design (if needed)
3. electron-dev  → Main process changes (via codex exec)
4. frontend-dev  → Renderer process changes (via codex exec)
5. code-reviewer → Review all changes
6. test-build    → Compile check, test run
```

Skip any step that does not apply (e.g. pure frontend work skips `electron-dev`).

### Parallelism

- `electron-dev` and `frontend-dev` MAY run in parallel once interface contracts are finalized by `architect`
- `code-reviewer` MUST wait until all code changes are complete

### Single-Module Shortcuts

When changes touch only one directory:
- `electron/` only → dispatch `electron-dev`, then `code-reviewer`
- `src/` only → dispatch `frontend-dev`, then `code-reviewer`
- Scope unclear → dispatch `architect` first to assess impact

### Code Modification Policy

- `electron-dev` and `frontend-dev` **MUST use `codex exec` to modify code** — direct file writes are forbidden
- `pm-planner`, `architect`, `code-reviewer` are read-only — they do NOT modify source files
- `test-build` only runs check commands — it does NOT modify source files