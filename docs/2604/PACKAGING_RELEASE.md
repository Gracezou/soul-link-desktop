# Soul Link Desktop — Packaging & Release

> **For Claude Code. Configure electron-builder for Windows (.exe) and macOS (.dmg).**
> **Goal: `npm run build` produces installable packages for both platforms.**

---

## 1. Dependencies

### Install
```bash
npm install -D electron-builder
```

### Verify Existing
Ensure these are already in devDependencies (should be from project scaffold):
- `electron`
- `vite`
- `typescript`

---

## 2. electron-builder.yml

Create `electron-builder.yml` in project root:

```yaml
appId: com.soullink.desktop
productName: Soul Link Desktop
copyright: Copyright © 2026

# Directories
directories:
  output: release/${version}
  buildResources: build

# Files to include in the package
files:
  - dist-electron/**/*
  - dist/**/*
  - res/**/*
  - package.json

# Extra resources copied outside asar (for SQLite native modules, cards, sprites)
extraResources:
  - from: res/
    to: res/
    filter:
      - "**/*"

# macOS configuration
mac:
  category: public.app-category.entertainment
  icon: build/icon.icns
  target:
    - target: dmg
      arch:
        - x64
        - arm64
  darkModeSupport: true
  hardenedRuntime: true
  gatekeeperAssess: false

dmg:
  contents:
    - x: 130
      y: 220
    - x: 410
      y: 220
      type: link
      path: /Applications
  window:
    width: 540
    height: 380

# Windows configuration
win:
  icon: build/icon.ico
  target:
    - target: nsis
      arch:
        - x64

nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  deleteAppDataOnUninstall: false
  installerIcon: build/icon.ico
  uninstallerIcon: build/icon.ico
  installerHeaderIcon: build/icon.ico
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: Soul Link Desktop

# Linux configuration (future, optional)
# linux:
#   icon: build/icon.png
#   target:
#     - AppImage
#   category: Game

# Auto-update (future, disabled for now)
# publish:
#   provider: github
#   owner: your-username
#   repo: soul-link-desktop

# asar packaging
asar: true
asarUnpack:
  - "**/*.node"
  - "**/sql.js/**"
  - "**/better-sqlite3/**"
```

---

## 3. App Icons

### Required Files

Create `build/` directory in project root with icon files:

```
build/
├── icon.icns          # macOS (1024x1024, Apple icon format)
├── icon.ico           # Windows (256x256, multi-size ICO)
├── icon.png           # Source PNG (1024x1024, used for Linux + icon generation)
└── background.png     # Optional: DMG background image (540x380)
```

### Generate Icons

If you only have a PNG source image:

```bash
# Install icon generator
npm install -D electron-icon-maker

# Generate all formats from a 1024x1024 PNG
npx electron-icon-maker --input=build/icon.png --output=build/
```

Or use an online converter to create .icns and .ico from the source PNG.

### Placeholder Icon

If no custom icon is ready yet, create a simple placeholder:

```typescript
// Claude Code: create a simple SVG icon, convert to PNG
// Or use the character card image as temporary icon
// Copy from res/cards/ if available
```

For MVP, the app can ship without a custom icon (Electron default icon will be used).
Add `icon` fields to electron-builder.yml only when icon files exist.
If icon files don't exist, comment out all `icon:` lines to avoid build errors.

---

## 4. Package.json Scripts

Update `package.json` scripts section:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:vite\" \"npm run dev:electron\"",
    "dev:vite": "vite",
    "dev:electron": "wait-on http://localhost:5173 && electronmon .",

    "build": "npm run build:renderer && npm run build:main && npm run build:package",
    "build:renderer": "vite build",
    "build:main": "tsc -p tsconfig.node.json",
    "build:package": "electron-builder",

    "build:win": "npm run build:renderer && npm run build:main && electron-builder --win",
    "build:mac": "npm run build:renderer && npm run build:main && electron-builder --mac",

    "test": "jest tests/unit/",
    "test:unit": "jest tests/unit/",
    "test:integration": "jest tests/integration/ --runInBand",
    "test:all": "jest --runInBand"
  },
  "main": "dist-electron/main.js"
}
```

### Build Commands

```bash
# Build for current platform
npm run build

# Build for specific platform
npm run build:win      # Windows .exe installer
npm run build:mac      # macOS .dmg

# Output goes to release/<version>/
```

---

## 5. Main Process Entry Point

Verify `package.json` has correct `main` field:

```json
{
  "main": "dist-electron/main.js"
}
```

Verify `electron/main.ts` handles both dev and production paths:

```typescript
import { app, BrowserWindow } from 'electron';
import * as path from 'path';

const isDev = !app.isPackaged;

function getRendererURL(): string {
  if (isDev) {
    return 'http://localhost:5173';
  }
  // Production: load from built files
  return `file://${path.join(__dirname, '../dist/index.html')}`;
}

// For loading preload script
function getPreloadPath(): string {
  return path.join(__dirname, 'preload.js');
}
```

---

## 6. Resource Paths in Production

### Problem
In development, `res/` is accessed relative to project root.
In production (packaged), `res/` is in `extraResources` and accessed differently.

### Solution

Update `electron/utils/paths.ts`:

```typescript
import { app } from 'electron';
import * as path from 'path';

const isDev = !app.isPackaged;

/**
 * Get path to res/ directory.
 * - Dev: <project_root>/res/
 * - Production: <app_resources>/res/
 */
export function getResourcePath(...segments: string[]): string {
  if (isDev) {
    return path.join(process.cwd(), 'res', ...segments);
  }
  return path.join(process.resourcesPath, 'res', ...segments);
}

/**
 * Get path to data/ directory (user data, writable).
 * - Dev: <project_root>/data/
 * - Production: <app_data>/soul-link/
 */
export function getDataPath(...segments: string[]): string {
  if (isDev) {
    return path.join(process.cwd(), 'data', ...segments);
  }
  return path.join(app.getPath('userData'), ...segments);
}

/**
 * Get SQLite database path.
 */
export function getDBPath(): string {
  return getDataPath('soul-link.db');
}

/**
 * Get character card path.
 */
export function getCardPath(cardName: string): string {
  return getResourcePath('cards', `${cardName}_card.json`);
}

/**
 * Get sprite directory path.
 */
export function getSpritePath(character: string): string {
  return getResourcePath('sprites', character);
}
```

### Update All Path References

Search the codebase for hardcoded `res/` or `data/` paths and replace with these helper functions:

```typescript
// BEFORE
const cardPath = `res/cards/${cardName}_card.json`;
const dbPath = 'data/soul-link.db';

// AFTER
import { getCardPath, getDBPath } from './utils/paths';
const cardPath = getCardPath(cardName);
const dbPath = getDBPath();
```

Files to check and update:
- `electron/main.ts` — agent config initialization
- `electron/agent/index.ts` — if it reads card path directly
- `electron/store/settings.ts` — settings file path
- Any renderer code that references `res/` for sprites or icons

---

## 7. SQLite in Production (Critical)

### Problem
`better-sqlite3` is a native Node.js module. It needs to be compiled for the target platform.
If the project uses `sql.js` (WASM-based), this is simpler — no native compilation needed.

### If Using sql.js (WASM) — No Special Config Needed
sql.js is pure JavaScript + WASM, works everywhere without native compilation.
Just ensure the WASM file is included in the package:

```yaml
# electron-builder.yml — already covered by files: dist-electron/**/*
# sql.js WASM file should be in node_modules/sql.js/dist/
# electron-builder handles this automatically with asar
```

### If Using better-sqlite3 (Native) — Need Extra Config

```yaml
# electron-builder.yml
asarUnpack:
  - "**/better-sqlite3/**"
  - "**/*.node"

# Add rebuild config
npmRebuild: true
```

And in `package.json`:
```json
{
  "build": {
    "npmRebuild": true
  }
}
```

### Check Which SQLite Library Is Used

```bash
grep -r "sql.js\|better-sqlite3" package.json
```

Based on the test output mentioning "sql.js WASM", the project likely uses sql.js.
If so, no native module concerns — WASM works cross-platform out of the box.

---

## 8. Electron Security for Production

Add these to all BrowserWindow webPreferences:

```typescript
webPreferences: {
  preload: getPreloadPath(),
  contextIsolation: true,       // MUST be true
  nodeIntegration: false,       // MUST be false
  sandbox: true,                // Enable sandbox
  webSecurity: true,            // Enable web security
}
```

In `electron/main.ts`, add Content Security Policy:

```typescript
import { session } from 'electron';

app.whenReady().then(() => {
  // Set CSP for production
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: file:",
            "connect-src 'self' http: https:",  // Allow CPA API calls
          ].join('; '),
        },
      });
    });
  }
});
```

---

## 9. Version Management

### package.json Version
```json
{
  "version": "0.1.0"
}
```

### Display Version in App

In settings "About" tab, show app version:

```typescript
// Renderer: get version via IPC
ipcMain.handle('app:get-version', () => {
  return app.getVersion();
});

// In SettingsPanel About section:
const version = await window.electronAPI.invoke('app:get-version');
// Display: "Soul Link Desktop v0.1.0"
```

---

## 10. Build Verification Checklist

### Before Building

```bash
# 1. Ensure clean state
rm -rf dist/ dist-electron/ release/

# 2. Run tests
npm run test:unit

# 3. Check for TypeScript errors
npx tsc --noEmit -p tsconfig.node.json

# 4. Verify dev mode works
npm run dev
# Test: onboarding → chat → quit
```

### Build & Test

```bash
# Build for current platform
npm run build

# Output location
ls release/0.1.0/
# macOS: Soul Link Desktop-0.1.0.dmg
#        Soul Link Desktop-0.1.0-arm64.dmg
# Windows: Soul Link Desktop Setup 0.1.0.exe
```

### Post-Build Verification

**macOS:**
```
1. Open .dmg → drag to Applications
2. Launch from Applications
3. First launch: onboarding wizard appears (macOS may show Gatekeeper warning — expected for unsigned app)
4. Complete onboarding → pet window appears
5. Send message → receive response
6. Quit → relaunch → settings persisted, session resumes
7. Check: res/ files accessible (character card loads)
8. Check: data/ files created in ~/Library/Application Support/Soul Link Desktop/
```

**Windows:**
```
1. Run .exe installer → follow installation wizard
2. Launch from Start Menu or Desktop shortcut
3. First launch: onboarding wizard appears
4. Complete onboarding → pet window appears
5. Send message → receive response
6. Quit → relaunch → settings persisted
7. Check: res/ files accessible
8. Check: data/ files in %APPDATA%/Soul Link Desktop/
```

### Common Build Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Icon not showing | Icon file missing or wrong format | Add icon files to build/ or comment out icon lines |
| App crashes on launch | Path resolution wrong in production | Use `app.isPackaged` + `process.resourcesPath` |
| SQLite error | Native module not rebuilt | Use sql.js (WASM) instead, or configure asarUnpack |
| White screen | Renderer URL wrong in production | Check `file://` path to `dist/index.html` |
| Settings lost | Wrong userData path | Use `app.getPath('userData')` for production |
| Card not found | res/ path hardcoded | Use `getResourcePath()` helper |
| CSP blocks API | connect-src too restrictive | Add CPA domain to CSP |

---

## 11. Implementation Order

1. **Install electron-builder** (`npm install -D electron-builder`)
2. **Create electron-builder.yml** (copy from Section 2, comment out icon lines if no icon yet)
3. **Update package.json scripts** (build, build:win, build:mac)
4. **Create/update paths.ts** (dev vs production path resolution)
5. **Update all hardcoded paths** in main.ts, agent/, store/
6. **Verify dev mode still works** (`npm run dev`)
7. **Run build** (`npm run build`)
8. **Fix any build errors** (path issues, missing files, native modules)
9. **Test the packaged app** (install, onboarding, chat, restart)
10. **Add app icon** (when available from Nano Banana or custom design)
