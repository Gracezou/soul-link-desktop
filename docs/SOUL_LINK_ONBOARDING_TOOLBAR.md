# Soul Link Desktop — Supplement: Onboarding & Toolbar

> **Supplements SOUL_LINK_MIGRATION.md. For Claude Code to implement after Phase 5.**
> Two features: First-Run Onboarding Wizard + Floating Toolbar (Pet Dock)

---

## 1. First-Run Onboarding Wizard

### 1.1 When to Show

On app launch, check `data/settings.json` for `onboarding.completed === true`.
If missing or false → show onboarding wizard instead of main app.
After wizard completes → write `onboarding.completed: true` and reload main app.

### 1.2 Wizard Steps (4 steps, one screen each)

#### Step 1: Welcome + Language
- Welcome message: "欢迎来到 Soul Link ✨" / "Welcome to Soul Link ✨"
- Language selector: 简体中文 / English
- Selected language applies immediately to the rest of the wizard
- Save to `settings.ui.language`

#### Step 2: OpenClaw Connection
- Input field: Gateway WebSocket URL (default: `ws://localhost:18789/`)
- Input field: Auth Token (password-masked, with show/hide toggle)
- "Test Connection" button → attempts WebSocket handshake
  - Success: green checkmark + "连接成功"
  - Fail: red X + error message
- Must pass connection test to proceed to next step
- Save to `settings.openclaw.gatewayWsUrl` and `settings.openclaw.authToken`

#### Step 3: Character Selection
- Scan `res/cards/` directory for `.json` and `.png` files
- Display available characters as cards with:
  - Character name (from card JSON `data.name` or `name`)
  - Preview image (if PNG card, show the image; if JSON only, show placeholder)
  - Brief description (first 50 chars of `data.description`)
- User selects one character (radio/highlight selection)
- If no cards found: show message "暂无角色卡，请将角色卡文件放入 res/cards/ 目录"
- Save to `settings.openclaw.defaultCard` and `settings.pet.character`

#### Step 4: Companion Settings + Finish
- Toggle switch: "启用待机主动对话" (Companion proactive interaction)
- If enabled: idle time slider (15min / 30min / 1hr / 2hr)
- Warning text: "⚠️ 启用后角色会在空闲时主动与你对话，会产生少量 Token 消耗"
- "完成设置" button → save all settings, mark onboarding complete, launch main app
- Save to `settings.companion.enabled` and `settings.companion.idleMinutes`

### 1.3 Implementation

#### Files to Create

```
src/onboarding/
├── OnboardingWizard.tsx       # Main wizard container (step state machine)
├── WelcomeStep.tsx            # Step 1: language selection
├── ConnectionStep.tsx         # Step 2: gateway config + test
├── CharacterStep.tsx          # Step 3: card selection
├── CompanionStep.tsx          # Step 4: companion toggle + finish
└── onboarding.module.css      # Wizard styling
```

#### Routing Logic in App.tsx

```typescript
function App() {
  const onboardingCompleted = useSettingsStore(s => s.onboardingCompleted)

  if (!onboardingCompleted) {
    return <OnboardingWizard onComplete={() => {
      // Save settings, mark complete, reload
    }} />
  }

  return <MainApp />  // Pet + Chat + Toolbar
}
```

#### Settings Schema Addition

```typescript
interface SoulLinkSettings {
  // ... existing fields ...
  onboarding: {
    completed: boolean;     // default: false
    completedAt?: string;   // ISO timestamp
  };
}
```

#### IPC for Connection Test

Add new IPC channel:

```typescript
// electron/ipc.ts
BRIDGE_TEST_CONNECTION: 'bridge:test-connection'  
// Renderer sends: { gatewayWsUrl, authToken }
// Main responds: { success: boolean, error?: string }
```

Main process handler: create a temporary WebSocket, attempt handshake, return result, close connection.

### 1.4 Design Guidelines

- Full-screen overlay window (or dedicated BrowserWindow)
- Clean, minimal UI with generous whitespace
- Step indicator at top (dots or progress bar): ● ● ○ ○
- "上一步" / "下一步" navigation buttons
- Subtle animation transitions between steps
- Color scheme: soft warm tones (fits otome game aesthetic)

---

## 2. Floating Toolbar (Pet Dock)

### 2.1 Concept

A small icon toolbar floating beside the pet sprite, similar to a miniature macOS Dock.
Always visible when the pet is on screen. Moves with the pet when dragged.

```
                    ┌─────────┐
                    │  Pet     │
                    │  Sprite  │
                    │          │
                    └─────────┘
                    ┌─┬─┬─┬─┐
                    │💬│⚙│🎭│⋯│   ← Toolbar (small icons)
                    └─┴─┴─┴─┘
```

### 2.2 Toolbar Items

| Icon | Action | Description |
|------|--------|-------------|
| 💬 (chat) | Open/toggle chat window | Primary action |
| ⚙️ (settings) | Open settings window | Configuration |
| 🎭 (character) | Switch character | Quick character change (future, placeholder for now) |
| 📷 (photo) | Generate image | Trigger `/rp image` (future, placeholder for now) |

MVP: only 💬 and ⚙️ are functional. 🎭 and 📷 show "coming soon" tooltip.

### 2.3 Implementation

#### Files to Create

```
src/toolbar/
├── Toolbar.tsx                # Main toolbar component
├── ToolbarItem.tsx            # Single icon button with tooltip
└── toolbar.module.css         # Styling
```

#### Toolbar.tsx Specification

```typescript
/**
 * Floating toolbar rendered inside the pet window (same BrowserWindow).
 * Positioned below the pet canvas, centered horizontally.
 *
 * Layout: horizontal row of circular icon buttons (32x32 or 36x36)
 * Background: semi-transparent frosted glass (backdrop-filter: blur)
 * Border-radius: pill shape
 * Gap between icons: 4-6px
 * Padding: 4px
 *
 * Positioning:
 * - Absolute positioned within pet window
 * - Anchored to bottom-center of pet sprite
 * - Moves with pet (same window, no separate positioning needed)
 *
 * Interactions:
 * - Hover icon: show tooltip with label
 * - Click 💬: ipcRenderer.invoke('window:toggle-chat')
 * - Click ⚙️: ipcRenderer.invoke('window:open-settings')
 * - Click 🎭: show tooltip "即将推出" / toast notification
 * - Click 📷: show tooltip "即将推出" / toast notification
 *
 * Mouse behavior:
 * - Toolbar area must NOT be click-through (override pet window's setIgnoreMouseEvents)
 * - When mouse enters toolbar, set setIgnoreMouseEvents(false)
 * - When mouse leaves toolbar AND pet sprite, restore click-through
 */
```

#### IPC Channels for Window Management

```typescript
// Add to electron/ipc.ts
WINDOW_TOGGLE_CHAT: 'window:toggle-chat',
WINDOW_OPEN_SETTINGS: 'window:open-settings',
WINDOW_OPEN_CHARACTER: 'window:open-character',  // future
```

#### Pet Window Integration

The toolbar lives inside the same BrowserWindow as the pet canvas.
The pet window layout becomes:

```typescript
// In the pet window renderer entry
function PetApp() {
  return (
    <div className="pet-container">
      <PetCanvas />          {/* Sprite animation */}
      <Toolbar />            {/* Floating dock below */}
    </div>
  )
}
```

The pet window's size must account for both the canvas and toolbar height.
For example, if sprite is 256x256 and toolbar is 40px tall:
- Window size: 256 x 296 (transparent everywhere except sprite + toolbar)

#### Styling Requirements

```css
/* toolbar.module.css */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  /* Position centered below pet sprite */
  margin: 4px auto 0;
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
}

.toolbarItem:hover {
  transform: scale(1.15);
  background: rgba(255, 255, 255, 0.25);
}

.toolbarItem:active {
  transform: scale(0.95);
}

/* Tooltip */
.tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  background: rgba(0, 0, 0, 0.75);
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
}
```

### 2.4 Click-Through Handling

This is the trickiest part. The pet window is transparent and click-through,
but the toolbar must be clickable.

Solution:
1. Pet window default: `setIgnoreMouseEvents(true, { forward: true })`
2. Renderer detects mouse position:
   - Over sprite pixels OR over toolbar → IPC to main → `setIgnoreMouseEvents(false)`
   - Over transparent area → IPC to main → `setIgnoreMouseEvents(true, { forward: true })`
3. Use `mousemove` event on the window to detect which region the cursor is in.

```typescript
// In pet window renderer
document.addEventListener('mousemove', (e) => {
  const overSprite = checkIfOverSprite(e.x, e.y)  // check canvas pixel alpha
  const overToolbar = checkIfOverToolbar(e.x, e.y) // check toolbar element bounds
  const shouldCapture = overSprite || overToolbar

  // Only send IPC when state changes to avoid flooding
  if (shouldCapture !== lastCaptureState) {
    ipcRenderer.send('pet:set-clickthrough', !shouldCapture)
    lastCaptureState = shouldCapture
  }
})
```

---

## 3. Settings Panel Enhancements

The settings window should reflect all configurable options from onboarding,
plus additional runtime options.

### 3.1 Settings Tabs

| Tab | Content |
|-----|---------|
| 连接 (Connection) | Gateway URL, Token, connection status, test button, reconnect button |
| 角色 (Character) | Current character display, card list from res/cards/, switch button |
| 伴侣 (Companion) | Enable/disable toggle, idle time, mode selector (balanced/checkin/question/report) |
| 关于 (About) | Version, links, reset onboarding button |

### 3.2 Reset Onboarding

Add a button in the About tab:
"重新运行初始化引导" → sets `onboarding.completed = false` → restarts app

---

## 4. Implementation Order

After the main migration phases (1-5) are complete:

1. **Toolbar** — Create `src/toolbar/`, wire to pet window, implement chat + settings buttons
2. **Onboarding** — Create `src/onboarding/`, implement 4-step wizard, wire to settings store
3. **Settings Panel** — Enhance existing settings with tabs matching onboarding fields

Test verification:
- Fresh install (no settings.json) → onboarding wizard appears
- Complete wizard → main app loads with pet + toolbar
- Click 💬 → chat window opens
- Click ⚙️ → settings window opens
- Restart app → onboarding does NOT appear again (completed flag set)
