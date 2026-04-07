# Soul Link Desktop — TODO List

> **Last Updated: 2026-03-22**

---

## Current: UI Polish

- [ ] Sprite assets — waiting for Nano Banana image generation, place into `res/sprites/baiyuan/`
- [ ] Character card tuning — iterate system_prompt, dialogue examples, character_book based on user feedback

## Feature Expansion (Design Required)

- [ ] Animation / Expression system — integrate OpenClaw image generation for dynamic character expressions
- [ ] Character card decoupling & multi-character — support switching between multiple characters, card selection UI
- [ ] Response filtering & protocol — delta streaming optimization, potential rp-plugin modifications
- [ ] Item / Gift system — character requests items during idle, configurable on/off to manage token cost

## Milestones

- [ ] M3: Multi-user support — server-side session isolation per user
- [ ] M4: Companion Agent — Generative Agents style proactive care (Memory Stream → Reflection → Planning)
- [ ] Web UI — reuse React components for remote users without desktop app
- [ ] Packaging & Release — electron-builder for Windows (.exe) + macOS (.dmg)

---

## Completed ✅

### Infrastructure
- [x] OpenClaw + rp-plugin deployment (Telegram channel verified)
- [x] WebSocket communication (handshake protocol, message send/receive)
- [x] MiniMax-M2 model integration (via CPA proxy)
- [x] DyberPet MVP end-to-end verification

### Character Card
- [x] Baiyuan character card creation (V2 spec, card_gen tool)
- [x] Card auto-detect / import / session start on launch
- [x] "already exists" response handling in startup flow

### Electron Migration
- [x] soul-link-desktop project scaffold (Electron + React + TypeScript + Vite)
- [x] OpenClaw bridge rewrite (Python → TypeScript WebSocket client)
- [x] IPC channel design (main ↔ renderer)

### Onboarding
- [x] First-run onboarding wizard (4 steps: language → connection → character → companion)
- [x] Window serialization (onboarding completes before pet window opens)

### Pet Window
- [x] Sprite placeholder (dashed border + text when no sprite assets)
- [x] JS-based window drag (position persistence across restarts)
- [x] Drag auto-collapses input panel
- [x] Pet window full transparency (no background overlay)

### Toolbar
- [x] Floating toolbar (hover show/hide with fade animation)
- [x] Toolbar items: 💬 chat, 📜 history, ⚙️ settings, 🎭 character, 📷 photo
- [x] Click-through handling (toolbar clickable, transparent areas pass through)

### Chat System
- [x] Chat bubble feedback (AI response floats above pet sprite, auto-dismiss)
- [x] Compact input panel (text input + send button, slides open from toolbar)
- [x] Preset quick-reply buttons (3 configurable presets, functional)
- [x] Input field focus and typing works
- [x] Chat history window (separate window, read-only, scrollable)
- [x] History window close button works

### Theme & i18n
- [x] Theme system (Sakura Pink / Sunshine, CSS variables, settings toggle)
- [x] Internationalization (react-i18next, zh-CN + en, all hardcoded strings replaced)

### Dev Experience
- [x] Hot reload fix (single instance lock, electronmon watches main process only)
