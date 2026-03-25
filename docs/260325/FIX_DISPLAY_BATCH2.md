# Soul Link Desktop — Fix Display Issues Batch 2

> **For Claude Code. Three issues. Execute in order.**

---

## Issue 1: Auto-Collapse Input When Dragging

### Problem
When user starts dragging the pet sprite, the compact input panel stays open. It should automatically close when drag begins.

### Solution
When mousedown triggers drag on the sprite area, collapse the input panel and resize the window back to base height.

### Implementation

In the pet app component where drag state and input visibility are managed:

```typescript
const onMouseDown = (e: React.MouseEvent) => {
  if (e.button !== 0) return;
  setDragging(true);
  dragStart.current = { x: e.screenX, y: e.screenY };

  // Auto-collapse input when drag starts
  if (inputVisible) {
    setInputVisible(false);
    window.electronAPI.send('pet:resize-window', { height: BASE_HEIGHT });
  }
};
```

This ensures:
- Drag starts → input collapses immediately (no animation needed, instant)
- Window shrinks to base height so there is no empty space below toolbar
- When user releases drag, input stays collapsed (user must click chat button to reopen)

### Verification
- Open input panel → start dragging sprite → input collapses instantly
- Window height shrinks during drag
- After drag release, input remains collapsed
- Click chat button to reopen input — works normally

---

## Issue 2: Input Panel Hidden Behind Container — Make Background Transparent

### Problem
The compact input panel is visually clipped or hidden behind the pet window container. The parent container has an opaque or semi-opaque background color that covers the input area.

### Solution
The pet window and ALL its parent containers must have fully transparent backgrounds. Only the individual UI elements (toolbar, input panel, chat bubble) should have their own styled backgrounds.

### Implementation

**Global styles for pet window (global.css or pet window entry CSS):**

```css
html {
  margin: 0;
  padding: 0;
  background: transparent !important;
}

body {
  margin: 0;
  padding: 0;
  background: transparent !important;
  overflow: hidden;
}

#root {
  background: transparent !important;
}
```

**Pet container:**

```css
.petContainer {
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: visible;         /* NOT hidden — allow input to render below */
  width: 100%;
  height: 100%;
  background: transparent;   /* fully transparent */
  position: relative;
}
```

**Sprite area:**

```css
.petCanvasArea {
  background: transparent;   /* transparent — sprite has its own pixels */
  width: 256px;
  height: 256px;
  cursor: grab;
}

.petCanvasArea.dragging {
  cursor: grabbing;
}
```

**Check every wrapper/container element** between the root and the input panel. Every single one must have `background: transparent` or no background set. Search for any of these in CSS files:

```
background: #
background: rgb
background: rgba(
background-color:
background: var(--bg
```

Any background on a parent container of the input panel will clip or hide it. Only these elements should have visible backgrounds:
- `.toolbar` — frosted glass background
- `.compactInput` — card-style background
- `.chatBubbleFeedback` — bubble background

**Pet window BrowserWindow config — confirm transparency:**

```typescript
new BrowserWindow({
  transparent: true,
  backgroundColor: '#00000000',   // fully transparent
  hasShadow: false,
  // ...
})
```

### Verification
- Input panel is fully visible when expanded
- No clipping, no overlay, no color block hiding the input
- Desktop wallpaper visible through all transparent areas around the sprite
- Only sprite, toolbar, and input panel have visible backgrounds
- Chat bubble feedback also renders correctly above the sprite

---

## Issue 3: Chat History Window — Remove Input + Fix Close Button

### Problem
1. The chat history window has an input field at the bottom — it should NOT have one. Users send messages through the compact input on the pet window, not from history.
2. The close button (X) in the history window title bar does not work.

### Solution

**Remove input from history window:**

In `ChatHistory.tsx` (or whatever component renders the history window content):
- Remove the input field and send button at the bottom
- History window is READ-ONLY — it only displays past messages
- The layout should be: header + scrollable message list, nothing else

```
+----------------------------------+
|  Chat History        [character] X |  <- header with close button
+----------------------------------+
|                                    |
|  [AI message bubble]    09:51      |
|                                    |
|            [User message]  09:51   |
|                                    |
|  [AI message bubble]    09:52      |
|                                    |
|  ...scrollable...                  |
|                                    |
+----------------------------------+
   (no input field here)
```

**Fix close button:**

The close button must send IPC to close the history window. Check which of these scenarios applies:

**Scenario A: Custom titlebar with close button (frameless window)**

If the history window is `frame: false` with a custom titlebar component:

```tsx
// In ChatHistory.tsx header
<button
  className={styles.closeButton}
  onClick={() => window.electronAPI.send('window:close-history')}
>
  X
</button>
```

Main process handler:

```typescript
ipcMain.on('window:close-history', () => {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.close();
  }
});
```

Add to preload allowed send channels:

```typescript
'window:close-history',
```

**Scenario B: The close button exists but the click handler is wrong or missing**

Check the onClick handler of the close button. Common bugs:
- Handler calls `window.close()` — this does not work in Electron renderer with contextIsolation
- Handler is not bound or missing
- IPC channel is not registered in preload

The correct approach is always: renderer sends IPC → main process closes the window.

**Scenario C: Use frame: true instead of custom titlebar**

If custom titlebar is causing issues, simplest fix is to use a native frame:

```typescript
historyWindow = new BrowserWindow({
  width: 400,
  height: 600,
  frame: true,           // Use native OS window frame with built-in close button
  transparent: false,
  resizable: true,
  // ...
});
```

This gives you a working close button for free. Consider this if the custom titlebar is not essential for the history window.

### Verification
- Open history window: shows message list only, NO input field at bottom
- Click X button: window closes
- Reopen via toolbar history button: works, shows same history
- History window is scrollable when many messages
- History window can be resized (min 350x400)

---

## Implementation Order

1. **Issue 2** (container transparency) — do this FIRST, fixes visibility
2. **Issue 1** (auto-collapse on drag) — small code change in drag handler
3. **Issue 3** (history window cleanup) — remove input + fix close button
