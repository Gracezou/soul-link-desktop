# Soul Link Desktop — Drag, Toolbar Hover & Theme System

> **For Claude Code. Three tasks: fix drag, add toolbar hover animation, implement theme system.**

---

## 1. Pet Window Drag — Free Position

### Behavior
User drags the sprite/placeholder area to move the pet window. Release → window stays at drop position. No gravity, no falling, no bouncing.

### Implementation

**CSS drag region** — in the pet window renderer:

```css
/* Pet canvas or placeholder area — draggable */
.pet-canvas-area {
  -webkit-app-region: drag;
  cursor: grab;
}
.pet-canvas-area:active {
  cursor: grabbing;
}

/* Everything interactive must opt OUT of drag */
.toolbar,
.toolbar button,
button,
input,
a {
  -webkit-app-region: no-drag;
}
```

**Pet window config** — confirm in `electron/windows/petWindow.ts`:
```typescript
new BrowserWindow({
  transparent: true,
  frame: false,
  alwaysOnTop: true,
  movable: true,          // must be true (default)
  resizable: false,
  // ...
})
```

**Disable physics gravity** — in `src/pet/PhysicsEngine.ts` (if exists):
```typescript
// MVP config: no gravity, no bounce
const physicsConfig = {
  gravity: false,
  bounceEnabled: false,
};
// If PhysicsEngine has a gravity loop or requestAnimationFrame for falling,
// disable it or gate it behind this config flag.
```

**Persist window position** — save position on move, restore on startup:

```typescript
// electron/windows/petWindow.ts

// After creating petWindow:
let savePositionTimeout: NodeJS.Timeout | null = null;

petWindow.on('moved', () => {
  // Debounce: save 500ms after last move event
  if (savePositionTimeout) clearTimeout(savePositionTimeout);
  savePositionTimeout = setTimeout(() => {
    const [x, y] = petWindow.getPosition();
    settingsStore.set('pet.positionX', x);
    settingsStore.set('pet.positionY', y);
  }, 500);
});

// On create, restore saved position:
function createPetWindow() {
  const savedX = settingsStore.get('pet.positionX');
  const savedY = settingsStore.get('pet.positionY');

  const win = new BrowserWindow({
    x: savedX ?? undefined,      // undefined = let OS decide
    y: savedY ?? undefined,
    // ...other options
  });
  return win;
}
```

### Verification
- Drag sprite area → window moves smoothly
- Release → stays at drop position (no falling)
- Click toolbar buttons → does NOT trigger drag
- Restart app → window appears at last saved position
- First launch (no saved position) → OS default position

---

## 2. Toolbar Hover Show/Hide

### Behavior
- Default: toolbar hidden (opacity 0, no pointer events)
- Mouse enters pet container area → toolbar fades in (0.25s ease)
- Mouse leaves pet container area → toolbar fades out (0.25s ease)
- While toolbar is visible and mouse is over it → stays visible (does not flicker)

### Implementation

**Pet container component** (PetApp.tsx or equivalent):

```tsx
import { useState } from 'react';

function PetApp() {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="pet-container"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <PetCanvas />
      <Toolbar visible={hovered} />
    </div>
  );
}
```

**Toolbar component** — accept `visible` prop:

```tsx
// src/toolbar/Toolbar.tsx
interface ToolbarProps {
  visible: boolean;
}

function Toolbar({ visible }: ToolbarProps) {
  return (
    <div className={`${styles.toolbar} ${visible ? styles.visible : ''}`}>
      <ToolbarItem icon="💬" label={t('toolbar.chat')} onClick={toggleChat} />
      <ToolbarItem icon="⚙️" label={t('toolbar.settings')} onClick={openSettings} />
      <ToolbarItem icon="🎭" label={t('toolbar.character')} disabled />
      <ToolbarItem icon="📷" label={t('toolbar.photo')} disabled />
    </div>
  );
}
```

**Toolbar CSS** — `src/toolbar/toolbar.module.css`:

```css
.toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 4px 10px;
  margin: 4px auto 0;

  background: var(--toolbar-bg, rgba(255, 255, 255, 0.15));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 20px;
  border: 1px solid var(--toolbar-border, rgba(255, 255, 255, 0.2));

  /* Hidden by default */
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.25s ease, transform 0.25s ease;
  pointer-events: none;

  /* Must not trigger window drag */
  -webkit-app-region: no-drag;
}

.visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.toolbarItem {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease;
  background: transparent;
  border: none;
  font-size: 16px;
  position: relative;
  -webkit-app-region: no-drag;
}

.toolbarItem:hover {
  transform: scale(1.15);
  background: var(--toolbar-hover, rgba(255, 255, 255, 0.25));
}

.toolbarItem:active {
  transform: scale(0.95);
}

.toolbarItem.disabled {
  opacity: 0.5;
  cursor: default;
}

.tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.75);
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.toolbarItem:hover .tooltip {
  opacity: 1;
}
```

**Click-through coordination** — toolbar hidden state must not block desktop clicks:

```typescript
// In pet window renderer, the click-through logic:
// When toolbar is hidden (pointer-events: none), transparent areas pass through.
// When toolbar is visible (pointer-events: auto), toolbar captures clicks.
//
// If using setIgnoreMouseEvents, coordinate with hover state:
// - mouse outside pet container → setIgnoreMouseEvents(true, { forward: true })
// - mouse inside pet container → setIgnoreMouseEvents(false)
//
// The onMouseEnter/onMouseLeave on pet-container handles this naturally
// because the forward: true option lets mouse events reach the renderer
// to trigger the enter/leave detection.
```

### Verification
- Mouse away from pet → toolbar invisible, clicks pass to desktop
- Mouse over pet sprite → toolbar fades in smoothly
- Mouse moves to toolbar → stays visible, buttons clickable
- Mouse leaves both sprite and toolbar → toolbar fades out
- Click 💬 → chat window opens (toolbar does not trigger drag)

---

## 3. Theme System

### Architecture

CSS variables approach: define all colors as CSS custom properties on `:root`.
Components reference `var(--color-name)` instead of hardcoded colors.
Theme switch = update all CSS variables at once.

### File Structure

```
src/themes/
├── index.ts              # Theme manager: registry, apply, switch
├── types.ts              # Theme type definitions
├── warm-pink.ts          # Theme 1: Sakura Pink (matches onboarding)
└── sunshine.ts           # Theme 2: Sunshine Warm
```

### src/themes/types.ts

```typescript
export interface ThemeColors {
  // Primary
  primary: string;
  primaryLight: string;
  primarySoft: string;

  // Backgrounds
  bgPrimary: string;
  bgSecondary: string;
  bgGradientStart: string;
  bgGradientEnd: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Chat
  chatBubbleUser: string;
  chatBubbleAssistant: string;
  chatBubbleBorder: string;
  chatInputBg: string;
  chatHeaderBg: string;

  // Toolbar
  toolbarBg: string;
  toolbarBorder: string;
  toolbarHover: string;

  // Status
  success: string;
  warning: string;
  error: string;

  // Other
  divider: string;
  shadow: string;
}

export interface Theme {
  name: string;
  label: string;        // Chinese label
  labelEn: string;      // English label
  colors: ThemeColors;
}

export type ThemeName = 'warm-pink' | 'sunshine';
```

### src/themes/warm-pink.ts

```typescript
import { Theme } from './types';

export const warmPink: Theme = {
  name: 'warm-pink',
  label: '樱花粉',
  labelEn: 'Sakura Pink',
  colors: {
    primary: '#E91E8C',
    primaryLight: '#F472B6',
    primarySoft: '#FDF2F8',

    bgPrimary: '#FFF5F9',
    bgSecondary: '#FFFFFF',
    bgGradientStart: '#FFF0F5',
    bgGradientEnd: '#FFFFFF',

    textPrimary: '#4A1942',
    textSecondary: '#9B6B8E',
    textMuted: '#C9A0B8',

    chatBubbleUser: '#FCE4EC',
    chatBubbleAssistant: '#FFFFFF',
    chatBubbleBorder: '#F8BBD0',
    chatInputBg: '#FFFFFF',
    chatHeaderBg: '#FDF2F8',

    toolbarBg: 'rgba(255, 240, 245, 0.85)',
    toolbarBorder: 'rgba(233, 30, 140, 0.15)',
    toolbarHover: 'rgba(233, 30, 140, 0.1)',

    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',

    divider: '#FCE4EC',
    shadow: 'rgba(233, 30, 140, 0.08)',
  },
};
```

### src/themes/sunshine.ts

```typescript
import { Theme } from './types';

export const sunshine: Theme = {
  name: 'sunshine',
  label: '暖阳',
  labelEn: 'Sunshine',
  colors: {
    primary: '#F59E0B',
    primaryLight: '#FCD34D',
    primarySoft: '#FFFBEB',

    bgPrimary: '#FFFDF5',
    bgSecondary: '#FFFFFF',
    bgGradientStart: '#FFF8E7',
    bgGradientEnd: '#FFFFFF',

    textPrimary: '#451A03',
    textSecondary: '#92600A',
    textMuted: '#C4A35A',

    chatBubbleUser: '#FEF3C7',
    chatBubbleAssistant: '#FFFFFF',
    chatBubbleBorder: '#FDE68A',
    chatInputBg: '#FFFFFF',
    chatHeaderBg: '#FFFBEB',

    toolbarBg: 'rgba(255, 251, 235, 0.85)',
    toolbarBorder: 'rgba(245, 158, 11, 0.15)',
    toolbarHover: 'rgba(245, 158, 11, 0.1)',

    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',

    divider: '#FEF3C7',
    shadow: 'rgba(245, 158, 11, 0.08)',
  },
};
```

### src/themes/index.ts

```typescript
import { warmPink } from './warm-pink';
import { sunshine } from './sunshine';
import { Theme, ThemeName } from './types';

export const themes: Record<ThemeName, Theme> = {
  'warm-pink': warmPink,
  'sunshine': sunshine,
};

/**
 * Apply theme by setting CSS variables on document root.
 * Call this on app startup and when user switches theme.
 */
export function applyTheme(name: ThemeName): void {
  const theme = themes[name];
  if (!theme) {
    console.warn(`Unknown theme: ${name}, falling back to warm-pink`);
    applyTheme('warm-pink');
    return;
  }

  const root = document.documentElement;

  Object.entries(theme.colors).forEach(([key, value]) => {
    // camelCase to kebab-case: bgPrimary → --bg-primary
    const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
    root.style.setProperty(cssVar, value as string);
  });
}

export function getThemeList(): Array<{ name: ThemeName; label: string; labelEn: string }> {
  return Object.values(themes).map(t => ({
    name: t.name as ThemeName,
    label: t.label,
    labelEn: t.labelEn,
  }));
}

export { ThemeName, Theme } from './types';
```

### Apply Theme on Startup

In `src/App.tsx` or the top-level renderer entry:

```typescript
import { applyTheme } from './themes';
import { useSettingsStore } from './stores/settingsStore';
import { useEffect } from 'react';

function App() {
  const theme = useSettingsStore(s => s.theme);

  useEffect(() => {
    applyTheme(theme || 'warm-pink');
  }, [theme]);

  // ... rest of app
}
```

### Settings Schema Update

```typescript
// Add to SoulLinkSettings.ui:
ui: {
  language: string;
  theme: ThemeName;    // 'warm-pink' | 'sunshine', default: 'warm-pink'
}
```

### Replace ALL Hardcoded Colors

**This is the most important step.** Scan every CSS file and replace hardcoded colors with CSS variables.

Mapping reference:

| CSS Variable | Usage |
|---|---|
| `var(--primary)` | Buttons, active states, links, accents |
| `var(--primary-light)` | Hover states, selected items |
| `var(--primary-soft)` | Subtle highlights, badges |
| `var(--bg-primary)` | Page/window backgrounds |
| `var(--bg-secondary)` | Cards, panels, modals |
| `var(--bg-gradient-start)` | Background gradients start |
| `var(--bg-gradient-end)` | Background gradients end |
| `var(--text-primary)` | Main text, headings |
| `var(--text-secondary)` | Descriptions, labels |
| `var(--text-muted)` | Hints, timestamps, disabled text |
| `var(--chat-bubble-user)` | User message bubble background |
| `var(--chat-bubble-assistant)` | Character message bubble background |
| `var(--chat-bubble-border)` | Bubble border color |
| `var(--chat-input-bg)` | Chat input field background |
| `var(--chat-header-bg)` | Chat window header |
| `var(--toolbar-bg)` | Toolbar background |
| `var(--toolbar-border)` | Toolbar border |
| `var(--toolbar-hover)` | Toolbar icon hover |
| `var(--success)` | Success status (green dot) |
| `var(--warning)` | Warning status |
| `var(--error)` | Error status |
| `var(--divider)` | Divider lines, borders |
| `var(--shadow)` | Box shadows |

Example conversions:

```css
/* ❌ BEFORE */
.chatWindow {
  background: #1a1a2e;
  color: white;
}
.userBubble {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.sendButton {
  background: #e91e8c;
}

/* ✅ AFTER */
.chatWindow {
  background: var(--bg-primary);
  color: var(--text-primary);
}
.userBubble {
  background: var(--chat-bubble-user);
  border: 1px solid var(--chat-bubble-border);
}
.sendButton {
  background: var(--primary);
}
```

**Files to scan and update** (every .css and .module.css file in src/):
- src/chat/*.module.css (or *.css)
- src/pet/*.module.css
- src/toolbar/*.module.css
- src/settings/*.module.css
- src/onboarding/*.module.css
- src/styles/global.css
- Any inline styles in .tsx files that use hardcoded colors

### Theme Switcher in Settings

Add an appearance section to the settings panel:

```tsx
// src/settings/AppearanceSection.tsx

import { getThemeList, applyTheme, ThemeName } from '../themes';
import { useTranslation } from 'react-i18next';

function AppearanceSection() {
  const { t, i18n } = useTranslation();
  const currentTheme = useSettingsStore(s => s.theme);
  const setTheme = useSettingsStore(s => s.setTheme);

  const themes = getThemeList();

  const handleThemeChange = (name: ThemeName) => {
    applyTheme(name);
    setTheme(name);
    // Persist via IPC
    ipcRenderer.invoke('settings:set', { key: 'ui.theme', value: name });
  };

  return (
    <section>
      <h3>{t('settings.appearance.theme')}</h3>
      <div className={styles.themeGrid}>
        {themes.map(theme => (
          <button
            key={theme.name}
            className={`${styles.themeCard} ${currentTheme === theme.name ? styles.active : ''}`}
            onClick={() => handleThemeChange(theme.name)}
          >
            {/* Preview color circles */}
            <div className={styles.themePreview}>
              <span style={{ background: themes[theme.name].colors.primary }} />
              <span style={{ background: themes[theme.name].colors.bgPrimary }} />
              <span style={{ background: themes[theme.name].colors.chatBubbleUser }} />
            </div>
            <span>{i18n.language === 'en' ? theme.labelEn : theme.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
```

### Theme in Onboarding

In the Welcome step (Step 1), add theme selection alongside language:

```tsx
// Language selection (existing)
// + Theme selection (new, below language)
<h4>{t('onboarding.selectTheme')}</h4>
<div className={styles.themeOptions}>
  <button onClick={() => handleThemeChange('warm-pink')}>
    🌸 {t('themes.warmPink')}
  </button>
  <button onClick={() => handleThemeChange('sunshine')}>
    ☀️ {t('themes.sunshine')}
  </button>
</div>
```

Add i18n keys:
```json
{
  "onboarding": {
    "selectTheme": "选择主题"
  },
  "themes": {
    "warmPink": "樱花粉",
    "sunshine": "暖阳"
  },
  "settings": {
    "appearance": {
      "theme": "主题风格"
    }
  }
}
```

### Verification
- App starts with warm-pink theme by default → all UI elements use pink color scheme
- Switch to sunshine in settings → all colors update immediately (no restart needed)
- Chat window, toolbar, onboarding, settings all reflect the active theme
- No hardcoded color values remain in any CSS file (search for `#` hex codes and `rgb`)
- Restart app → theme preference persists
- Onboarding step 1 allows theme selection, choice carries into main app

---

## Implementation Order

1. **Drag fix** — CSS changes + position persistence (quick)
2. **Toolbar hover** — CSS transition + state management (quick)
3. **Theme system** — Create theme files → apply function → replace all hardcoded colors → add settings UI (largest task)
