# Soul Link Desktop — Chat Bubble Feedback Implementation

> **For Claude Code. Based on actual gateway log data analysis.**

---

## 1. Gateway Message Protocol (from logs)

### Message Lifecycle

When user sends a message, the gateway responds with this sequence:

```
1. ACK        → {"type":"res","id":"<reqId>","ok":true,"payload":{"runId":"<idem>","status":"started"}}
2. DELTA (×N) → {"type":"event","event":"chat","payload":{"state":"delta","message":{"content":[{"type":"text","text":"partial..."}]}}}
3. FINAL      → {"type":"event","event":"chat","payload":{"state":"final","message":{"content":[{"type":"text","text":"full response"}]}}}
```

### Key Fields

- `state: "delta"` — incremental text chunk. The `text` field contains the FULL accumulated text so far (not just the new chunk).
- `state: "final"` — complete response. Same text as last delta but with `stopReason` and `usage` fields added.
- `message.content` is an array: `[{"type":"text","text":"..."}]`
- Text extraction: `payload.message.content[0].text`

### Delta Behavior (Important)

Each delta `text` field contains the FULL response accumulated so far, NOT just the new characters.

Example from logs:
```
delta seq=2: "柏源抬起头，嘴角噙着一抹笑意。他"
delta seq=3: "柏源抬起头，嘴角噙着一抹笑意。他放下手中的事，走到你面前..."
delta seq=4: "柏源抬起头，嘴角噙着一抹笑意。他放下手中的事，走到你面前...早上好..."
delta seq=5: (full accumulated text continues growing)
final seq=7: (complete text, same as last delta)
```

To get the NEW characters for typewriter effect:
```typescript
const newChars = currentDeltaText.slice(previousDeltaText.length);
```

### Timing (from logs)

- ACK arrives ~120ms after send
- First delta arrives ~7-8 seconds after send (LLM thinking time)
- Subsequent deltas arrive every ~400-500ms
- Final arrives ~50ms after last delta
- Total response time: ~9-10 seconds

---

## 2. Bubble State Machine

```
         send message
              │
              ▼
    ┌─────────────────┐
    │    WAITING       │  Bubble visible, shows animated "..."
    │                  │  Triggered by: user sends message (ACK received)
    │  Display: •••    │  Duration: until first delta arrives
    └────────┬────────┘
             │ first delta received
             ▼
    ┌─────────────────┐
    │   STREAMING      │  Typewriter effect, chars appear one by one
    │                  │  New delta arrives → append new chars to buffer
    │  Display: text   │  Typewriter renders from buffer
    │  typing...       │  Duration: until final received
    └────────┬────────┘
             │ final received
             ▼
    ┌─────────────────┐
    │   DISPLAYED      │  Full text shown, start dismiss timer
    │                  │  Mouse over bubble → pause timer
    │  Display: text   │  Mouse leave bubble → start 20s countdown
    │  (complete)      │  Timer expires → transition to IDLE
    └────────┬────────┘
             │ 20s after mouse leave
             ▼
    ┌─────────────────┐
    │   IDLE           │  Bubble hidden (fade out)
    │                  │  Ready for next message
    │  Display: none   │
    └─────────────────┘

Interrupts:
- New message sent while STREAMING or DISPLAYED → reset to WAITING
- User clicks bubble → immediately go to IDLE (dismiss)
```

---

## 3. Implementation

### 3.1 IPC Events (Main → Renderer)

The bridge client.ts must forward chat events to the renderer. Three event types needed:

```typescript
// electron/ipc.ts — add these channels if not present
CHAT_ACK: 'chat:ack',           // { runId: string }
CHAT_DELTA: 'chat:delta',       // { runId: string, text: string }
CHAT_FINAL: 'chat:final',       // { runId: string, text: string }
```

In `electron/bridge/client.ts`, when processing incoming frames:

```typescript
// When chat event received:
if (data.type === 'event' && data.event === 'chat') {
  const payload = data.payload;
  const text = payload.message?.content?.[0]?.text || '';
  const runId = payload.runId;

  if (payload.state === 'delta') {
    this.mainWindow.webContents.send('chat:delta', { runId, text });
  } else if (payload.state === 'final') {
    this.mainWindow.webContents.send('chat:final', { runId, text });
  }
}

// When ACK received (response to chat.send):
if (data.type === 'res' && data.ok && data.payload?.status === 'started') {
  this.mainWindow.webContents.send('chat:ack', { runId: data.payload.runId });
}
```

Add these channels to preload.ts `on` allowed list.

### 3.2 ChatBubbleFeedback Component

```
src/pet/ChatBubbleFeedback.tsx
```

```typescript
/**
 * Chat bubble that floats above the pet sprite.
 * Renders inside the pet window (same BrowserWindow).
 *
 * Props: none — subscribes to IPC events directly via useBridge hook
 *
 * State:
 *   phase: 'idle' | 'waiting' | 'streaming' | 'displayed'
 *   displayText: string — text currently shown (typewriter partial)
 *   fullText: string — complete text received so far from deltas
 *   typewriterIndex: number — current position in fullText for typewriter
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './chatBubble.module.css';

type Phase = 'idle' | 'waiting' | 'streaming' | 'displayed';

export function ChatBubbleFeedback() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [fullText, setFullText] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [isMouseOver, setIsMouseOver] = useState(false);
  const dismissTimer = useRef<NodeJS.Timeout | null>(null);
  const typewriterTimer = useRef<NodeJS.Timeout | null>(null);
  const typewriterIndex = useRef(0);
  const currentRunId = useRef<string>('');

  // --- IPC Listeners ---

  useEffect(() => {
    const onAck = (_: any, data: { runId: string }) => {
      currentRunId.current = data.runId;
      setPhase('waiting');
      setFullText('');
      setDisplayText('');
      typewriterIndex.current = 0;
      clearDismissTimer();
      clearTypewriter();
    };

    const onDelta = (_: any, data: { runId: string; text: string }) => {
      if (data.runId !== currentRunId.current) return;
      setFullText(data.text);
      if (phase === 'waiting') {
        setPhase('streaming');
      }
    };

    const onFinal = (_: any, data: { runId: string; text: string }) => {
      if (data.runId !== currentRunId.current) return;
      setFullText(data.text);
      // Typewriter will continue until it catches up to fullText
      // Phase transitions to 'displayed' when typewriter finishes
    };

    window.electronAPI.on('chat:ack', onAck);
    window.electronAPI.on('chat:delta', onDelta);
    window.electronAPI.on('chat:final', onFinal);

    return () => {
      window.electronAPI.off('chat:ack', onAck);
      window.electronAPI.off('chat:delta', onDelta);
      window.electronAPI.off('chat:final', onFinal);
    };
  }, []);

  // --- Typewriter Effect ---

  useEffect(() => {
    if (phase !== 'streaming' && phase !== 'displayed') return;
    if (typewriterIndex.current >= fullText.length) {
      // Typewriter caught up to fullText
      if (phase === 'streaming') {
        // Still receiving deltas — wait for more
      } else {
        // Final received and typewriter done — transition to displayed
        setPhase('displayed');
        startDismissTimer();
      }
      return;
    }

    // Type next character
    typewriterTimer.current = setTimeout(() => {
      typewriterIndex.current += 1;
      setDisplayText(fullText.slice(0, typewriterIndex.current));
    }, 30); // 30ms per character ≈ 33 chars/sec

    return () => clearTypewriter();
  }, [displayText, fullText, phase]);

  // When fullText updates (new delta), check if typewriter needs to catch up
  useEffect(() => {
    if (phase === 'streaming' && typewriterIndex.current < fullText.length) {
      // Trigger typewriter to continue
      setDisplayText(fullText.slice(0, typewriterIndex.current));
    }
  }, [fullText]);

  // Detect when final is received and typewriter is done
  useEffect(() => {
    if (phase === 'streaming' && typewriterIndex.current >= fullText.length) {
      // Check if we already got final — if so, transition
      // This is handled by checking if final was received
    }
  }, [displayText]);

  // --- Dismiss Timer (20s after mouse leave) ---

  const startDismissTimer = useCallback(() => {
    if (isMouseOver) return; // Don't start if mouse is over
    clearDismissTimer();
    dismissTimer.current = setTimeout(() => {
      setPhase('idle');
    }, 20000); // 20 seconds
  }, [isMouseOver]);

  const clearDismissTimer = () => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  };

  const clearTypewriter = () => {
    if (typewriterTimer.current) {
      clearTimeout(typewriterTimer.current);
      typewriterTimer.current = null;
    }
  };

  // --- Mouse Hover: pause/resume dismiss timer ---

  const handleMouseEnter = () => {
    setIsMouseOver(true);
    clearDismissTimer(); // Pause: stop countdown
  };

  const handleMouseLeave = () => {
    setIsMouseOver(false);
    if (phase === 'displayed') {
      startDismissTimer(); // Resume: start 20s countdown
    }
  };

  // --- Click to dismiss ---

  const handleClick = () => {
    setPhase('idle');
    clearDismissTimer();
    clearTypewriter();
  };

  // --- Render ---

  if (phase === 'idle') return null;

  return (
    <div
      className={`${styles.bubble} ${styles.visible}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {phase === 'waiting' && (
        <span className={styles.waitingDots}>
          <span>.</span><span>.</span><span>.</span>
        </span>
      )}
      {(phase === 'streaming' || phase === 'displayed') && (
        <BubbleContent text={displayText} />
      )}
    </div>
  );
}
```

### 3.3 BubbleContent — Text Rendering with Action/Dialogue Parsing

```typescript
/**
 * Renders bubble text with formatting:
 * - *text between asterisks* → italic, secondary color (action descriptions)
 * - "text in quotes" or 「」→ normal weight (dialogue)
 * - Everything else → normal text
 *
 * IMPORTANT: This is the MVP renderer. Keep parsing logic SEPARATE
 * from this component so it can be swapped later for response filtering
 * and protocol constraints.
 */

interface BubbleContentProps {
  text: string;
}

function BubbleContent({ text }: BubbleContentProps) {
  // Use the shared response parser utility
  const segments = parseBubbleText(text);

  return (
    <div className={styles.bubbleText}>
      {segments.map((seg, i) => {
        if (seg.type === 'action') {
          return <span key={i} className={styles.action}>{seg.text}</span>;
        }
        if (seg.type === 'dialogue') {
          return <span key={i} className={styles.dialogue}>{seg.text}</span>;
        }
        return <span key={i}>{seg.text}</span>;
      })}
    </div>
  );
}
```

### 3.4 Parsing Utility (keep separate for future extensibility)

```typescript
/**
 * src/utils/bubbleParser.ts
 *
 * Parses raw AI response text into styled segments.
 *
 * DESIGN NOTE: This parser is intentionally separate from responseParser.ts.
 * responseParser.ts extracts structured data (emotions, media URLs, etc.)
 * bubbleParser.ts handles DISPLAY formatting only.
 *
 * This separation allows future response filtering and protocol constraints
 * to be inserted between the bridge output and the bubble display
 * without touching the display logic.
 *
 * Future pipeline:
 *   bridge response → protocol filter → response parser → bubble parser → render
 *                     ^^^^^^^^^^^^^^^^^
 *                     (insert here later)
 */

interface TextSegment {
  type: 'action' | 'dialogue' | 'text';
  text: string;
}

export function parseBubbleText(raw: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // Regex to match *action* and "dialogue" / \u201c dialogue \u201d
  const pattern = /(\*[^*]+\*)|(\u201c[^\u201d]*\u201d)|("[^"]*")/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      const before = raw.slice(lastIndex, match.index).trim();
      if (before) segments.push({ type: 'text', text: before });
    }

    const matched = match[0];
    if (matched.startsWith('*') && matched.endsWith('*')) {
      // Action: remove asterisks
      segments.push({ type: 'action', text: matched.slice(1, -1) });
    } else {
      // Dialogue: keep quotes
      segments.push({ type: 'dialogue', text: matched });
    }

    lastIndex = match.index + matched.length;
  }

  // Remaining text
  if (lastIndex < raw.length) {
    const remaining = raw.slice(lastIndex).trim();
    if (remaining) segments.push({ type: 'text', text: remaining });
  }

  return segments;
}
```

### 3.5 Bubble CSS

```css
/* src/pet/chatBubble.module.css */

.bubble {
  position: absolute;
  bottom: calc(100% + 8px);    /* Float above pet container */
  left: 50%;
  transform: translateX(-50%) translateY(8px);
  max-width: 300px;
  min-width: 120px;
  padding: 12px 16px;

  background: var(--chat-bubble-assistant);
  border: 1px solid var(--chat-bubble-border);
  border-radius: 16px 16px 16px 4px;
  box-shadow: 0 4px 16px var(--shadow);

  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary);
  cursor: pointer;

  /* Animation */
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;

  /* Must not trigger window drag */
  -webkit-app-region: no-drag;
  pointer-events: auto;
  z-index: 100;
}

.bubble.visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* Waiting dots animation */
.waitingDots {
  display: inline-flex;
  gap: 2px;
  font-size: 24px;
  line-height: 1;
  color: var(--text-muted);
}

.waitingDots span {
  animation: dotPulse 1.4s ease-in-out infinite;
}

.waitingDots span:nth-child(2) {
  animation-delay: 0.2s;
}

.waitingDots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes dotPulse {
  0%, 80%, 100% {
    opacity: 0.2;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}

/* Text content */
.bubbleText {
  word-break: break-word;
  white-space: pre-wrap;
}

/* Action text: italic, lighter color */
.action {
  font-style: italic;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 4px;
}

/* Dialogue text: normal weight */
.dialogue {
  display: block;
  margin-bottom: 4px;
}

/* Scrollbar for long content */
.bubble {
  max-height: 200px;
  overflow-y: auto;
}

.bubble::-webkit-scrollbar {
  width: 4px;
}

.bubble::-webkit-scrollbar-thumb {
  background: var(--text-muted);
  border-radius: 2px;
}
```

### 3.6 Pet App Integration

Update the pet window root component to include ChatBubbleFeedback:

```tsx
function PetApp() {
  const [hovered, setHovered] = useState(false);
  const [inputVisible, setInputVisible] = useState(false);

  return (
    <div
      className={styles.petContainer}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Bubble floats above everything, absolute positioned */}
      <ChatBubbleFeedback />

      {/* Sprite / placeholder — draggable area */}
      <div className={styles.petCanvasArea} onMouseDown={handleDragStart}>
        <PetCanvas />
      </div>

      {/* Toolbar — hover show/hide */}
      <Toolbar visible={hovered} onChatClick={handleChatToggle} />

      {/* Compact input — toggle from toolbar */}
      <CompactInput visible={inputVisible} onSend={handleSend} />
    </div>
  );
}
```

---

## 4. Data Pipeline (Extensibility)

Current MVP pipeline:

```
Gateway WebSocket
  → client.ts (parse frame, extract text)
    → IPC: chat:ack / chat:delta / chat:final
      → ChatBubbleFeedback (display with typewriter)
        → bubbleParser.ts (format *action* and "dialogue")
```

Future pipeline with protocol filter:

```
Gateway WebSocket
  → client.ts (parse frame, extract text)
    → protocolFilter.ts (NEW — filter/transform/validate)  ← insert here
      → IPC: chat:ack / chat:delta / chat:final
        → ChatBubbleFeedback (display with typewriter)
          → bubbleParser.ts (format *action* and "dialogue")
```

To prepare for this, keep these boundaries clean:
1. `client.ts` only extracts raw text from gateway frames — no formatting
2. `bubbleParser.ts` only handles display formatting — no business logic
3. Future `protocolFilter.ts` will sit between client and IPC emission
4. All text processing functions take string in, structured data out — pure functions, easy to test

---

## 5. Chat History Store Integration

The bubble only shows the LATEST message. But all messages must be stored for the history window.

In `chatStore.ts` (Zustand store), on every `chat:final` event:

```typescript
// Add to message history (for history window)
addMessage({
  id: runId,
  role: 'assistant',
  content: text,
  timestamp: Date.now(),
});
```

User messages should also be stored when sent:

```typescript
// When user sends via compact input or preset:
addMessage({
  id: crypto.randomUUID(),
  role: 'user',
  content: messageText,
  timestamp: Date.now(),
});
```

The bubble component reads from IPC events directly (real-time).
The history window reads from chatStore (persisted array).
These are two separate data paths by design.

---

## 6. Verification Checklist

- [ ] Send message → bubble appears with animated "..." dots
- [ ] After ~7-8s, first text appears with typewriter effect (chars appear one by one)
- [ ] Text continues to grow as more deltas arrive
- [ ] After final received, typewriter finishes, full text displayed
- [ ] *Action text* renders in italic with secondary color
- [ ] "Dialogue text" renders in normal weight
- [ ] Mouse over bubble → bubble stays visible indefinitely
- [ ] Mouse leave bubble → 20 second countdown starts
- [ ] After 20s → bubble fades out
- [ ] Mouse re-enters during countdown → countdown pauses
- [ ] Click bubble → immediately dismisses
- [ ] Send new message while bubble visible → resets to "..." waiting state
- [ ] Long response → bubble has max-height with scroll
- [ ] Bubble does not trigger window drag
- [ ] Bubble position: above pet sprite, centered horizontally
- [ ] All messages stored in chatStore for history window
