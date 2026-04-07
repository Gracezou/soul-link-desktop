# Soul Link Desktop — Critical Bug Fixes (Must Fix)

> **For Claude Code. Four bugs that MUST be fixed before any other work.**
> **For each bug: diagnose first, then fix. Do not guess — verify with DevTools.**

---

## Prerequisites: Enable DevTools for Debugging

Before fixing anything, add DevTools to the pet window so you can inspect elements.

In `electron/windows/petWindow.ts` (or wherever the pet BrowserWindow is created):

```typescript
// Add this line after creating the window, TEMPORARILY for debugging
petWindow.webContents.openDevTools({ mode: 'detach' });
```

This opens a separate DevTools window. Use the element inspector to examine every bug below.

---

## Bug 1: Input Panel Visually Hidden Behind Opaque Container

### Symptom
The compact input panel exists in the DOM but is visually blocked by a dark/opaque layer between the sprite area and the input.

### Root Cause Diagnosis (DO THIS FIRST)

1. Open DevTools on the pet window
2. Right-click on the dark area between sprite and input → Inspect
3. Walk up the DOM tree from the input element to `<html>`
4. For EACH ancestor element, check the Computed tab for:
   - `background` / `background-color` — must be `transparent` or `rgba(0,0,0,0)`
   - `opacity` — must be `1`
   - `overflow` — must NOT be `hidden` (this clips children)
   - `height` — if a parent has a fixed height smaller than its content, children get clipped

5. Record which exact element has the non-transparent background. Fix THAT element.

### Common Causes and Fixes

**Cause A: Vite injects default body styles**

Check `index.html` in the project root:
```html
<!-- Remove any background styling from body -->
<body style="background: transparent;">
```

Check if Vite or any CSS reset sets body background. Search ALL CSS files:
```bash
grep -rn "body" src/ --include="*.css" --include="*.module.css"
```

**Cause B: React root container has background**

```bash
grep -rn "root\|app\|#root\|#app" src/ --include="*.css" --include="*.module.css"
```

**Cause C: A wrapper component has background via CSS variable**

The theme system sets `var(--bg-primary)` which is NOT transparent.
If any pet window container uses `background: var(--bg-primary)`, that is the bug.

Pet window containers must NEVER use theme background variables. Only chat history window and settings window use themed backgrounds.

**The Fix — apply to ALL containers in the pet window render tree:**

Create or update a dedicated pet window CSS file:

```css
/* src/pet/petWindow.css — loaded ONLY in pet window */

/* Force transparent on every possible container */
html {
  background: transparent !important;
}

body {
  background: transparent !important;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

#root {
  background: transparent !important;
  width: 100%;
  height: 100%;
}

/* If there is an App wrapper or PetApp wrapper: */
.petAppWrapper {
  background: transparent !important;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
```

**Also verify BrowserWindow config:**

```typescript
const petWindow = new BrowserWindow({
  transparent: true,
  backgroundColor: '#00000000',
  hasShadow: false,
  frame: false,
  // ...
});
```

On macOS, also add:
```typescript
petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
```

### Verification
- Open DevTools → Elements tab → select `<html>` → Computed tab → background-color is `transparent`
- Do the same for `<body>`, `#root`, and every container up to the input panel
- Visually: desktop wallpaper visible between sprite and input panel
- No dark overlay anywhere in the pet window

---

## Bug 2: Chat History Window Close Button Not Working

### Symptom
Clicking the X button in the history window does nothing.

### Root Cause Diagnosis

1. Open DevTools on the history window
2. Click the X button
3. Check the Console tab for errors
4. Inspect the X button element — check if it has an onClick handler

### The Fix

This requires THREE things to all be correct. Check each one:

**Step A: Renderer — the button must call IPC send**

Find the close button in the history window component. It must use:

```typescript
// CORRECT — uses electronAPI.send
onClick={() => window.electronAPI.send('window:close-history')}
```

Common mistakes:
```typescript
// WRONG — window.close() does not work with contextIsolation
onClick={() => window.close()}

// WRONG — invoke expects a return value, send is fire-and-forget
onClick={() => window.electronAPI.invoke('window:close-history')}
```

**Step B: Preload — the channel must be in the allowed list**

In `electron/preload.ts`, find the send method. The channel `window:close-history` must be in the allowed array:

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: string, data?: any) => {
    const allowed = [
      'pet:move-window',
      'pet:save-position',
      'pet:resize-window',
      'window:close-history',   // <-- THIS MUST BE HERE
      // ... other channels
    ];
    if (allowed.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  // ...
});
```

If the channel is not in the allowed list, the send call is silently dropped. No error in console.

**Step C: Main process — the handler must be registered**

In `electron/main.ts`:

```typescript
ipcMain.on('window:close-history', () => {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.close();
    historyWindow = null;
  }
});
```

Make sure:
- The handler uses `ipcMain.on` (not `ipcMain.handle`) since renderer uses `send` (not `invoke`)
- `historyWindow` variable is accessible in this scope
- `historyWindow` is actually assigned when the window is created

**Alternative: If custom close button keeps failing, use native frame:**

```typescript
// When creating history window:
historyWindow = new BrowserWindow({
  frame: true,    // Native OS frame with built-in close button
  // ...
});
```

This bypasses the custom close button entirely.

### Verification
- Click X → history window closes
- Reopen via toolbar → works
- Check console: no errors on X click

---

## Bug 3: Input Field Cannot Be Typed Into

### Symptom
Clicking on the input field does not focus it. Typing does nothing.

### Root Cause Diagnosis

1. Open DevTools on the pet window
2. Inspect the input element
3. Check for:
   - `pointer-events: none` on the input or any parent
   - `disabled` attribute on the input
   - `-webkit-app-region: drag` on the input or a parent (this captures all mouse events)
   - `z-index` issues — another transparent element on top blocking clicks
   - `user-select: none` on a parent

### The Fix

**Check 1: Remove -webkit-app-region from input area**

If any `-webkit-app-region: drag` CSS still exists on parent containers, it will capture mouse events and prevent input focus. Remove ALL occurrences:

```bash
grep -rn "app-region" src/ --include="*.css" --include="*.module.css" --include="*.tsx"
```

Delete every `-webkit-app-region: drag` found. The JS drag implementation replaces CSS drag entirely.

**Check 2: pointer-events**

```bash
grep -rn "pointer-events" src/ --include="*.css" --include="*.module.css"
```

The input element and its parents must have `pointer-events: auto`. Only the toolbar in hidden state should have `pointer-events: none`.

**Check 3: Click-through (setIgnoreMouseEvents)**

If the pet window uses `setIgnoreMouseEvents(true)`, the input cannot receive clicks.

Check if there is logic that sets `setIgnoreMouseEvents(true)` and does not properly toggle it back to `false` when the input area is visible.

When the compact input is visible, `setIgnoreMouseEvents` MUST be `false` for the entire window:

```typescript
// When input panel opens:
window.electronAPI.send('pet:set-clickthrough', false);

// When input panel closes AND mouse is not over sprite/toolbar:
window.electronAPI.send('pet:set-clickthrough', true);
```

If `setIgnoreMouseEvents` logic exists, simplify it for MVP:

```typescript
// SIMPLEST APPROACH: when input is visible, NEVER ignore mouse events
// Only ignore when input is closed AND toolbar is hidden
const shouldIgnoreMouse = !inputVisible && !hovered;
window.electronAPI.send('pet:set-clickthrough', shouldIgnoreMouse);
```

**Check 4: z-index stacking**

Another transparent element might be on top of the input. In DevTools, hover over the input area and see if a different element highlights. If so, that element needs `pointer-events: none` or lower `z-index`.

**Check 5: Input element itself**

Make sure the input is a standard HTML element:
```tsx
<input
  type="text"
  value={inputValue}
  onChange={(e) => setInputValue(e.target.value)}
  placeholder={t('chat.inputPlaceholder')}
  autoFocus={inputVisible}    // auto-focus when panel opens
  disabled={false}
/>
```

### Verification
- Click input field → cursor appears, can type
- Type text → characters appear in input
- Press Enter → message sends
- Input auto-focuses when panel opens

---

## Bug 4: Preset Buttons Not Sending Content to Input

### Symptom
Clicking "早上好 👋" or other preset buttons does nothing. Expected: clicking a preset fills the input field with that text (or sends it directly).

### Desired Behavior (choose one, recommend Option A)

**Option A: Click preset → send immediately (no fill)**
```typescript
const handlePresetClick = (text: string) => {
  // Send directly, same as typing + pressing Enter
  window.electronAPI.send('bridge:send', { message: text });
};
```

**Option B: Click preset → fill input field (user presses Enter to send)**
```typescript
const handlePresetClick = (text: string) => {
  setInputValue(text);
  // Focus the input so user can edit or press Enter
  inputRef.current?.focus();
};
```

### Implementation

In `CompactInput.tsx` or `PresetButtons.tsx`:

```tsx
const inputRef = useRef<HTMLInputElement>(null);

// Preset button handler
const handlePreset = (presetKey: string) => {
  const text = t(`chat.presets.${presetKey}`);
  
  // Option A: send immediately
  window.electronAPI.send('bridge:send', { message: text });
  
  // OR Option B: fill input
  // setInputValue(text);
  // inputRef.current?.focus();
};

return (
  <div className={styles.compactInput}>
    <div className={styles.inputRow}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && inputValue.trim()) {
            window.electronAPI.send('bridge:send', { message: inputValue });
            setInputValue('');
          }
        }}
        placeholder={t('chat.inputPlaceholder')}
      />
      <button onClick={() => {
        if (inputValue.trim()) {
          window.electronAPI.send('bridge:send', { message: inputValue });
          setInputValue('');
        }
      }}>
        ➤
      </button>
    </div>
    <div className={styles.presetRow}>
      <button onClick={() => handlePreset('greeting')}>
        {t('chat.presets.greeting')}
      </button>
      <button onClick={() => handlePreset('miss')}>
        {t('chat.presets.miss')}
      </button>
      <button onClick={() => handlePreset('whatsDoing')}>
        {t('chat.presets.whatsDoing')}
      </button>
    </div>
  </div>
);
```

### Check IPC

Make sure `bridge:send` is handled in main process AND in preload allowed list:

Main process:
```typescript
ipcMain.on('bridge:send', (_, { message }) => {
  bridgeWorker.sendMessage(message);
});
```

Preload:
```typescript
// 'bridge:send' must be in allowed send channels
```

### Verification
- Click "早上好 👋" → message appears in chat bubble feedback (or is sent)
- Click "想你了 ❤" → same
- Click "在忙什么？" → same
- Type custom text + Enter → sends
- Type custom text + click ➤ → sends

---

## Execution Order

1. Enable DevTools on pet window (temporary, for debugging)
2. Fix Bug 1 (transparency) — use DevTools to find exact element
3. Fix Bug 3 (input not typeable) — check pointer-events and click-through
4. Fix Bug 4 (preset buttons) — wire onClick handlers
5. Fix Bug 2 (history close) — check all three layers (renderer, preload, main)
6. Remove DevTools line when all bugs are confirmed fixed
