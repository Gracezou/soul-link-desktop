# Soul Link Desktop — Drag Fix + Chat UI Redesign

> **For Claude Code. Two parts: fix pet window drag, then redesign chat interaction.**

---

## Part 1: Pet Window Drag — Free Position

### Current Problem
Pet window cannot be dragged/moved by the user.

### Behavior
- User drags the sprite/placeholder area → entire pet window moves
- Release → window stays at drop position (no gravity, no falling)
- Toolbar and buttons must NOT trigger drag

### Implementation

**CSS drag regions** — in pet window renderer styles:

```css
/* Sprite/placeholder area — draggable */
.pet-canvas-area {
  -webkit-app-region: drag;
  cursor: grab;
}
.pet-canvas-area:active {
  cursor: grabbing;
}

/* All interactive elements must opt out */
.toolbar,
.toolbar button,
.chat-bubble-container,
button,
input,
a,
textarea {
  -webkit-app-region: no-drag;
}
```

**Pet window config** — confirm in `electron/windows/petWindow.ts`:
```typescript
new BrowserWindow({
  transparent: true,
  frame: false,
  alwaysOnTop: true,
  movable: true,        // MUST be true
  resizable: false,
  // ...
})
```

**Disable gravity** — if PhysicsEngine.ts has gravity/falling logic, disable it:
```typescript
const physicsConfig = {
  gravity: false,
  bounceEnabled: false,
};
```

**Persist window position** — save on move, restore on startup:

```typescript
// electron/windows/petWindow.ts

let saveTimeout: NodeJS.Timeout | null = null;

petWindow.on('moved', () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const [x, y] = petWindow.getPosition();
    settingsStore.set('pet.positionX', x);
    settingsStore.set('pet.positionY', y);
  }, 500);
});

// On create:
const savedX = settingsStore.get('pet.positionX');
const savedY = settingsStore.get('pet.positionY');
const win = new BrowserWindow({
  x: savedX ?? undefined,
  y: savedY ?? undefined,
  // ...
});
```

### Verification
- Drag sprite area → window follows cursor
- Release → stays at position
- Toolbar clicks do NOT trigger drag
- Restart → window at last saved position

---

## Part 2: Chat UI Redesign

### Overview

The chat interaction is redesigned into three layers:

```
Layer 1: Chat Bubble (on pet sprite)
  ← AI responses appear as floating bubbles near the pet, auto-dismiss

Layer 2: Compact Input (click 💬 on toolbar)
  ← Small input bar + 3 preset quick-reply buttons, NOT a full window

Layer 3: Chat History Window (dedicated button or gesture)
  ← Full scrollable chat history in a separate window
```

### New File Structure

```
src/chat/
├── ChatBubbleFeedback.tsx    # Layer 1: floating response bubble on pet
├── CompactInput.tsx          # Layer 2: small input bar + presets
├── ChatHistory.tsx           # Layer 3: full history window content
├── MessageBubble.tsx         # Shared: single message component
├── PresetButtons.tsx         # Quick reply preset buttons
└── chat.module.css           # All chat styles
```

---

### Layer 1: Chat Bubble Feedback (Response Display)

AI responses appear as a floating speech bubble near the pet sprite, NOT in a separate window.

**ChatBubbleFeedback.tsx:**

```
  ┌──────────────────────┐
  │ *柏源笑了笑*         │  ← Semi-transparent bubble
  │ "早安，睡好了吗？"    │     Positioned above/beside pet sprite
  │                      │     Auto-dismiss after 8-10 seconds
  └──────────────────────┘     Or click to dismiss
          ▼
    ┌──────────┐
    │  Pet     │
    │  Sprite  │
    └──────────┘
```

```typescript
/**
 * Renders inside the PET WINDOW (same BrowserWindow as PetCanvas + Toolbar).
 * NOT a separate window.
 *
 * Props:
 *   message: string | null — current message to display
 *   onDismiss: () => void
 *
 * Behavior:
 * - When bridge:message IPC arrives with new AI response:
 *   → Show bubble with response text above the pet sprite
 *   → Parse *action* text in italic, "dialogue" in normal weight
 *   → Auto-dismiss after 8 seconds (configurable)
 *   → Click bubble to dismiss immediately
 *   → If new message arrives while bubble visible, replace content + reset timer
 *
 * - Bubble appears with fade-in + slide-up animation
 * - Bubble disappears with fade-out animation
 *
 * - Long text: max 3 lines with ellipsis, click to expand or open history
 *
 * Positioning:
 * - Above pet sprite, centered horizontally
 * - Max width: 280px
 * - If near screen top edge, show below pet instead
 */
```

**Styling:**
```css
.chatBubble {
  position: absolute;
  bottom: calc(100%);     /* Above pet canvas */
  left: 50%;
  transform: translateX(-50%);
  max-width: 280px;
  padding: 12px 16px;
  background: var(--chat-bubble-assistant);
  border: 1px solid var(--chat-bubble-border);
  border-radius: 16px 16px 16px 4px;    /* Speech bubble shape */
  box-shadow: 0 4px 12px var(--shadow);
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);

  /* Animation */
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
  transition: opacity 0.3s ease, transform 0.3s ease;

  /* Text overflow */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;

  /* Must not trigger drag */
  -webkit-app-region: no-drag;
  cursor: pointer;
}

.chatBubble.visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* Action text styling */
.chatBubble .action {
  font-style: italic;
  color: var(--text-secondary);
}
```

**Pet window layout update:**
```tsx
function PetApp() {
  const [hovered, setHovered] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);

  // Listen for AI responses via IPC
  useEffect(() => {
    const handler = (_: any, data: { text: string }) => {
      setCurrentMessage(data.text);
    };
    window.electronAPI.on('bridge:message', handler);
    return () => window.electronAPI.off('bridge:message', handler);
  }, []);

  return (
    <div
      className="pet-container"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <ChatBubbleFeedback
        message={currentMessage}
        onDismiss={() => setCurrentMessage(null)}
      />
      <PetCanvas />
      <Toolbar visible={hovered} />
    </div>
  );
}
```

---

### Layer 2: Compact Input (Toolbar 💬 Click)

Clicking the 💬 toolbar button opens a compact input bar below the toolbar, NOT a full chat window.

**CompactInput.tsx:**

```
    ┌──────────┐
    │  Pet     │
    │  Sprite  │
    └──────────┘
    ┌─┬─┬─┬─┐
    │💬│⚙│🎭│📷│   ← Toolbar
    └─┴─┴─┴─┘
    ┌─────────────────────────────┐
    │ 想说点什么...          [➤]  │  ← Text input
    ├─────────────────────────────┤
    │ [早上好👋] [想你了❤] [在忙吗] │  ← 3 preset quick replies
    └─────────────────────────────┘
```

```typescript
/**
 * Compact input panel shown below toolbar when 💬 is clicked.
 * Renders inside the PET WINDOW (same BrowserWindow).
 * Toggle: click 💬 again to hide.
 *
 * Components:
 * 1. Text input field + send button
 *    - Placeholder: t('chat.inputPlaceholder')
 *    - Enter to send, Shift+Enter for newline (single line default)
 *    - Send button: arrow icon
 *    - After send: clear input, keep panel open
 *
 * 2. Three preset quick-reply buttons below input
 *    - Configurable presets (stored in settings or per-character config)
 *    - Default presets:
 *      - "早上好 👋"
 *      - "想你了 ❤"
 *      - "在忙什么？"
 *    - Click → immediately send as message (same as typing + enter)
 *    - i18n keys: chat.presets.greeting, chat.presets.miss, chat.presets.whatsDoing
 *
 * 3. "查看聊天记录" link/button at bottom
 *    - Opens the full chat history window (Layer 3)
 *    - Small text, underline style
 *
 * Animation: slide down from toolbar with 0.2s ease
 *
 * Width: same as toolbar or slightly wider (max 300px)
 */
```

**PresetButtons.tsx:**
```typescript
interface PresetButtonsProps {
  onSend: (message: string) => void;
}

// Presets can be loaded from:
// 1. Character card extensions (future)
// 2. Settings (user customizable, future)
// 3. Hardcoded defaults (MVP)

const defaultPresets = [
  { key: 'greeting', icon: '👋' },
  { key: 'miss', icon: '❤' },
  { key: 'whatsDoing', icon: '💭' },
];

// Each button shows: t(`chat.presets.${key}`) + icon
// Click → onSend(t(`chat.presets.${key}`))
```

**Styling:**
```css
.compactInput {
  width: 280px;
  margin: 4px auto 0;
  background: var(--bg-secondary);
  border-radius: 16px;
  border: 1px solid var(--divider);
  box-shadow: 0 4px 16px var(--shadow);
  overflow: hidden;

  /* Slide animation */
  opacity: 0;
  transform: translateY(-8px);
  max-height: 0;
  transition: opacity 0.2s ease, transform 0.2s ease, max-height 0.2s ease;

  -webkit-app-region: no-drag;
}

.compactInput.visible {
  opacity: 1;
  transform: translateY(0);
  max-height: 200px;
}

.inputRow {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  gap: 8px;
}

.inputField {
  flex: 1;
  border: none;
  outline: none;
  background: var(--chat-input-bg);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--text-primary);
}

.inputField::placeholder {
  color: var(--text-muted);
}

.sendButton {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: var(--primary);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: transform 0.1s ease;
}

.sendButton:hover {
  transform: scale(1.1);
}

.sendButton:active {
  transform: scale(0.95);
}

.presetRow {
  display: flex;
  gap: 6px;
  padding: 0 12px 8px;
}

.presetButton {
  flex: 1;
  padding: 6px 8px;
  border-radius: 12px;
  border: 1px solid var(--divider);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.presetButton:hover {
  background: var(--primary-soft);
  color: var(--primary);
  border-color: var(--primary-light);
}

.historyLink {
  display: block;
  text-align: center;
  padding: 6px;
  font-size: 12px;
  color: var(--text-muted);
  text-decoration: underline;
  cursor: pointer;
  border-top: 1px solid var(--divider);
}

.historyLink:hover {
  color: var(--primary);
}
```

**Toolbar 💬 button behavior change:**
```typescript
// OLD: ipcRenderer.invoke('window:toggle-chat')  → opens a separate chat window
// NEW: toggle CompactInput visibility within pet window

function PetApp() {
  const [inputVisible, setInputVisible] = useState(false);

  const handleChatToggle = () => {
    setInputVisible(prev => !prev);
  };

  return (
    <div className="pet-container" ...>
      <ChatBubbleFeedback ... />
      <PetCanvas />
      <Toolbar visible={hovered} onChatClick={handleChatToggle} />
      <CompactInput
        visible={inputVisible}
        onSend={handleSend}
        onOpenHistory={openHistoryWindow}
      />
    </div>
  );
}
```

---

### Layer 3: Chat History Window (Separate Window)

A dedicated window showing full chat history. Opened from:
- CompactInput "查看聊天记录" link
- Future: keyboard shortcut or toolbar long-press

**ChatHistory.tsx:**

```
┌──────────────────────────────────┐
│  📜 聊天记录          [柏源]  ✕ │  ← Header with character name
├──────────────────────────────────┤
│                                  │
│  ┌──────────────────┐            │
│  │ *柏源轻轻推开门*  │  09:51    │  ← AI message (left aligned)
│  │ "醒了？趁热喝。"  │           │
│  └──────────────────┘            │
│                                  │
│            ┌──────────┐          │
│            │ 早上好    │  09:51   │  ← User message (right aligned)
│            └──────────┘          │
│                                  │
│  ┌──────────────────┐            │
│  │ *柏源抬起头*      │  09:51    │
│  │ "睡好了？"        │           │
│  └──────────────────┘            │
│                                  │
│  ......更多消息......             │
│                                  │
├──────────────────────────────────┤
│  💬 想说点什么...           [➤]  │  ← Also has input at bottom
└──────────────────────────────────┘
```

```typescript
/**
 * Full chat history in a SEPARATE BrowserWindow.
 * Created via IPC: 'window:open-history'
 *
 * Window config:
 *   width: 400, height: 600
 *   resizable: true (min 350x400)
 *   frame: false (custom titlebar)
 *   transparent: false
 *
 * Features:
 * - Scrollable message list (newest at bottom)
 * - Auto-scroll to bottom on new message
 * - User messages: right-aligned, themed bubble
 * - AI messages: left-aligned, themed bubble
 *   - *action text* rendered in italic
 *   - "dialogue" rendered in normal weight
 *   - Images (MEDIA:url) rendered inline
 * - Timestamp on each message (HH:MM format)
 * - Input bar at bottom (same as CompactInput but without presets)
 * - Messages synced with chatStore (same data source)
 *
 * Message data comes from chatStore via IPC:
 * - On open: request full history via 'chat:get-history'
 * - Live updates: listen to 'bridge:message' for new messages
 * - User sends from this window: same 'bridge:send' IPC
 */
```

**MessageBubble.tsx (shared component):**
```typescript
/**
 * Renders a single chat message. Used in both ChatBubbleFeedback and ChatHistory.
 *
 * Props:
 *   role: 'user' | 'assistant'
 *   content: string
 *   timestamp?: number
 *
 * Rendering rules:
 *   - Text between *asterisks* → <span class="action"> (italic, secondary color)
 *   - Text between "quotes" or 「」→ <span class="dialogue"> (normal weight)
 *   - MEDIA:url → <img src={url} /> (if enabled)
 *   - Rest → normal text
 *
 * Styles:
 *   - User: right-aligned, background var(--chat-bubble-user)
 *   - Assistant: left-aligned, background var(--chat-bubble-assistant)
 *   - Border: var(--chat-bubble-border)
 *   - Border-radius: 16px (with pointed corner toward sender side)
 *   - Timestamp: small text, var(--text-muted), below bubble
 */
```

**IPC channels to add:**
```typescript
// electron/ipc.ts
WINDOW_OPEN_HISTORY: 'window:open-history',
CHAT_GET_HISTORY: 'chat:get-history',       // Returns message array
CHAT_ON_MESSAGE: 'chat:on-message',         // Push new messages to history window
```

**electron/main.ts handler:**
```typescript
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
    // Load renderer with ?route=history or hash route
  });
});
```

---

### i18n Keys to Add

```json
{
  "chat": {
    "presets": {
      "greeting": "早上好 👋",
      "miss": "想你了 ❤",
      "whatsDoing": "在忙什么？"
    },
    "viewHistory": "查看聊天记录",
    "historyTitle": "聊天记录",
    "emptyHistory": "还没有聊天记录，打个招呼吧~"
  }
}
```

English:
```json
{
  "chat": {
    "presets": {
      "greeting": "Good morning 👋",
      "miss": "Miss you ❤",
      "whatsDoing": "What are you up to?"
    },
    "viewHistory": "View chat history",
    "historyTitle": "Chat History",
    "emptyHistory": "No messages yet. Say hi~"
  }
}
```

---

### Migration from Old Chat Window

The old `ChatWindow.tsx` (full window that auto-opened) is replaced by these three layers. Steps:

1. **Remove** the old `window:toggle-chat` IPC handler that creates a full chat window
2. **Remove** auto-creation of chat window on startup
3. **ChatBubbleFeedback** takes over response display (in pet window)
4. **CompactInput** takes over message sending (in pet window)
5. **ChatHistory** replaces the old chat window (only opened on demand)
6. **Keep** `chatStore.ts` as the single source of truth for all messages
7. **Keep** `responseParser.ts` and `emotionMapper.ts` unchanged

---

## Implementation Order

1. **Drag fix** (Part 1) — CSS + position persistence
2. **ChatBubbleFeedback** — response bubbles on pet sprite
3. **CompactInput + PresetButtons** — replace old chat window trigger
4. **ChatHistory window** — full history view
5. **Wire everything** — remove old chat window, connect new components
6. **Test full flow**: type in compact input → AI responds → bubble shows on pet → open history to see all messages
