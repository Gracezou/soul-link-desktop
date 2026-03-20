# Soul Link Desktop — Claude Code Guide

## Project Overview
AI-powered desktop companion app built with Electron + React + TypeScript.

## Directory Rules
- `electron/` — Main process (Node.js, CommonJS, compiled to dist-electron/)
- `src/` — Renderer process (React, ESM, compiled to dist/)
- `res/` — Static assets (sprites, icons, cards)
- `tools/` — Dev utilities (Python scripts)
- `data/` — Runtime data (gitignored)

## Key Commands
- `npm run dev` — Start dev server (Vite + electronmon)
- `npm run build` — Build for production
- `npm test` — Run tests

## Architecture
See docs/SOUL_LINK_MIGRATION.md for full architecture and implementation guide.
