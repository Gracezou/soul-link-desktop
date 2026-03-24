# Soul Link Desktop — Fix Drag, Layout & Toolbar

> **For Claude Code. Three issues to fix. Execute in order.**

---

## Issue 1: Pet Window Drag Not Working

### Problem
CSS `-webkit-app-region: drag` does not work on transparent Electron windows. Pet window cannot be moved.

### Solution
Replace CSS drag with JavaScript mouse-event-based dragging.

### Implementation

**Remove all `-webkit-app-region: drag` CSS.** Delete every occurrence from all CSS/module.css files. This approach does not work reliably in transparent frameless windows.

**Add mouse drag handlers to PetCanvas area (renderer side):**

Track mousedown on sprite area, then mousemove on document to calculate delta, send IPC to move window.

```typescript
// In PetCanvas.tsx or the pet container component

const [dragging, setDragging] = useState(false);
const dragStart = useRef({ x: 0, y: 0 });

const onMouseDown = (e: React.MouseEvent) => {
  // Only start drag on left button, and not on toolbar/input elements
  if (e.button !== 0) return;
  setDragging(true);
  dragStart.current = { x: e.screenX, y: e.screenY };
};

useEffect(() => {
  if (!dragging) return;

  const onMouseMove = (e: MouseEvent) => {
    const deltaX = e.screenX - dragStart.current.x;
    const deltaY = e.screenY - dragStart.current.y;
    dragStart.current = { x: e.screenX, y: e.screenY };
    window.electronAPI.send('pet:move-window', { deltaX, deltaY });
  };

  const onMouseUp = () => {
    setDragging(false);
    window.electronAPI.send('pet:save-position');
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  return () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
}, [dragging]);
```

Apply `onMouseDown` to the sprite canvas area element only. Do NOT apply it to toolbar, input, or buttons.

```tsx
<div
  className={styles.petCanvasArea}
  onMouseDown={onMouseDown}
  style={{ cursor: dragging ? 'grabbing' : 'grab' }}
>
  {/* PetCanvas or placeholder */}
</div>
```

**Main process IPC handlers (electron/main.ts or petWindow.ts):**

```typescript
ipcMain.on('pet:move-window', (_, { deltaX, deltaY }) => {
  if (!petWindow || petWindow.isDestroyed()) return;
  const [x, y] = petWindow.getPosition();
  petWindow.setPosition(x + deltaX, y + deltaY);
});

let savePositionTimeout: NodeJS.Timeout | null = null;

ipcMain.on('pet:save-position', () => {
  if (!petWindow || petWindow.isDestroyed()) return;
  if (savePositionTimeout) clearTimeout(savePositionTimeout);
  savePositionTimeout = setTimeout(() => {
    const [x, y] = petWindow.getPosition();
    settingsStore.set('pet.positionX', x);
    settingsStore.set('pet.positionY', y);
  }, 500);
});
```

**Preload — expose these IPC channels:**

```typescript
// electron/preload.ts — add to allowed send channels
'pet:move-window',
'pet:save-position',
```

**Restore position on startup (petWindow.ts):**

```typescript
function createPetWindow() {
  const savedX = settingsStore.get('pet.positionX');
  const savedY = settingsStore.get('pet.positionY');

  const win = new BrowserWindow({
    x: typeof savedX === 'number' ? savedX : undefined,
    y: typeof savedY === 'number' ? savedY : undefined,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    movable: true,
    resizable: false,
    // ...other options
  });
  return win;
}
```

**Disable physics gravity if present:**

Check `src/pet/PhysicsEngine.ts`. If it has gravity or falling logic, disable it:

```typescript
const physicsConfig = {
  gravity: false,
  bounceEnabled: false,
};
```

### Verification
- Drag on sprite/placeholder area: window moves with cursor
- Release: window stays at drop position
- Click toolbar buttons: does NOT trigger drag
- Click input field: does NOT trigger drag
- Restart app: window appears at last saved position

---

## Issue 2: Layout Restructure — No Scrollbar, Dynamic Window Height

### Problem
When compact input opens, content overflows the pet window causing a scrollbar. The input field is pushed out of view.

### Root Cause
Sprite, toolbar, and input are all inside a fixed-height window. When input expands, total height exceeds window size.

### Solution
Three independent layers. Window resizes dynamically when input opens/closes.

### Target Layout

```
+----------------------------+
|    Chat Bubble Feedback    |  <- absolute positioned, floats ABOVE window
+----------------------------+     does not affect layout flow
|                            |
|      Sprite / Placeholder  |  <- fixed height (e.g. 256px)
|      (draggable area)      |     mouse drag moves window
|                            |
+----------------------------+
|  [chat] [history] [settings] [char] [photo]  |  <- toolbar, fixed height ~44px
+----------------------------+                     hover to show/hide
|  [input field ........] [>]|  <- compact input, ONLY when visible
|  [preset1] [preset2] [p3] |     slides open with animation
+----------------------------+
```

### Implementation

**Pet container — no scrollbar, ever:**

```css
/* Global rule for pet window */
html, body {
  margin: 0;
  padding: 0;
  overflow: hidden;    /* NEVER show scrollbar */
  background: transparent;
}

.petContainer {
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  width: 100%;
  position: relative;  /* for absolute-positioned bubble */
}
```

**Chat bubble feedback — absolute positioned, outside normal flow:**

```css
.chatBubbleFeedback {
  position: absolute;
  bottom: 100%;          /* above the container */
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  pointer-events: auto;
  /* does NOT affect container height */
}
```

**Height constants:**

```typescript
const SPRITE_HEIGHT = 256;
const TOOLBAR_HEIGHT = 44;
const PADDING = 16;
const INPUT_PANEL_HEIGHT = 110;

const BASE_HEIGHT = SPRITE_HEIGHT + TOOLBAR_HEIGHT + PADDING;
const EXPANDED_HEIGHT = BASE_HEIGHT + INPUT_PANEL_HEIGHT;
```

**Dynamic window resize when input toggles:**

```typescript
// In pet app component
const handleChatToggle = () => {
  const willBeVisible = !inputVisible;
  setInputVisible(willBeVisible);

  // Resize pet window to fit content
  window.electronAPI.send('pet:resize-window', {
    height: willBeVisible ? EXPANDED_HEIGHT : BASE_HEIGHT
  });
};
```

**Main process handler:**

```typescript
ipcMain.on('pet:resize-window', (_, { height }) => {
  if (!petWindow || petWindow.isDestroyed()) return;
  const [width] = petWindow.getSize();
  petWindow.setSize(width, height, true);  // true = animate transition
});
```

**Add to preload allowed channels:**

```typescript
'pet:resize-window',
```

**Compact input expand animation:**

```css
.compactInput {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  padding: 0 12px;
  transition: max-height 0.3s ease, opacity 0.25s ease, padding 0.3s ease;
}

.compactInput.visible {
  max-height: 120px;
  opacity: 1;
  padding: 8px 12px;
}
```

**Initial pet window size (petWindow.ts):**

Set initial window height to BASE_HEIGHT (no input visible on startup):

```typescript
const win = new BrowserWindow({
  width: 300,                // or configured width
  height: BASE_HEIGHT,       // sprite + toolbar + padding, NO input
  // ...
});
```

### Verification
- App starts: pet window shows sprite + toolbar only, correct height, no scrollbar
- Click chat button: input slides open with animation, window grows taller smoothly
- Click chat button again: input slides closed, window shrinks back
- At no point does a scrollbar appear
- All three areas (sprite, toolbar, input) are fully visible and not overlapping

---

## Issue 3: Add Chat History Button to Toolbar

### Problem
Chat history button is inside the compact input panel. It should be a toolbar icon instead.

### Solution
Add a history icon to the toolbar. Remove the history link from CompactInput.

### New Toolbar Layout

Five icons in order:

| Position | Icon | Label Key | Action | Status |
|----------|------|-----------|--------|--------|
| 1 | 💬 | toolbar.chat | Toggle compact input | Functional |
| 2 | 📜 | toolbar.history | Open chat history window | Functional |
| 3 | ⚙️ | toolbar.settings | Open settings window | Functional |
| 4 | 🎭 | toolbar.character | Switch character | Placeholder (disabled) |
| 5 | 📷 | toolbar.photo | Generate image | Placeholder (disabled) |

### Implementation

**Update Toolbar.tsx:**

```tsx
function Toolbar({ visible, onChatClick }: ToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className={`${styles.toolbar} ${visible ? styles.visible : ''}`}>
      <ToolbarItem
        icon="💬"
        label={t('toolbar.chat')}
        onClick={onChatClick}
      />
      <ToolbarItem
        icon="📜"
        label={t('toolbar.history')}
        onClick={() => window.electronAPI.invoke('window:open-history')}
      />
      <ToolbarItem
        icon="⚙️"
        label={t('toolbar.settings')}
        onClick={() => window.electronAPI.invoke('window:open-settings')}
      />
      <ToolbarItem
        icon="🎭"
        label={t('toolbar.character')}
        disabled
      />
      <ToolbarItem
        icon="📷"
        label={t('toolbar.photo')}
        disabled
      />
    </div>
  );
}
```

**Add IPC channel (if not present):**

```typescript
// electron/ipc.ts
WINDOW_OPEN_HISTORY: 'window:open-history',
```

**Add IPC handler in main process (if not present):**

```typescript
let historyWindow: BrowserWindow | null = null;

ipcMain.handle('window:open-history', () => {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.focus();
    return;
  }

  historyWindow = new BrowserWindow({
    width: 400,
    height: 600,
    minWidth: 350,
    minHeight: 400,
    frame: false,
    transparent: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  // Load renderer with history route
  // e.g. historyWindow.loadURL(`${rendererURL}#/history`)
  // or historyWindow.loadURL(`${rendererURL}?view=history`)

  historyWindow.on('closed', () => {
    historyWindow = null;
  });
});
```

**Add to preload allowed invoke channels:**

```typescript
'window:open-history',
```

**Remove history link from CompactInput:**

If CompactInput has a "view chat history" link or button at the bottom, remove it. History is now accessed via the toolbar icon.

**Add i18n key:**

In zh-CN.json:
```json
{
  "toolbar": {
    "history": "聊天记录"
  }
}
```

In en.json:
```json
{
  "toolbar": {
    "history": "Chat History"
  }
}
```

### Verification
- Toolbar shows 5 icons: chat, history, settings, character, photo
- Click history icon: opens chat history window (or focuses if already open)
- History icon has correct tooltip on hover
- Character and photo icons show "coming soon" tooltip and are visually dimmed

---

## Implementation Order

1. **Issue 1: Drag** — JS mouse events + IPC window move + position save
2. **Issue 2: Layout** — restructure CSS + dynamic window resize + input animation
3. **Issue 3: Toolbar** — add history icon + wire IPC
4. **Full test**: drag pet around, open/close input, open history, verify no scrollbar
