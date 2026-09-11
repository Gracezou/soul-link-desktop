# Soul Link Desktop — Response Filtering & Protocol Constraints

> **For Claude Code. Two-layer design: server-side (rp-plugin) + client-side (Electron).**
> **Implement in order: Section 1 → 2 → 3 → 4 → 5.**

---

## 0. Architecture Overview

```
LLM Response
  │
  ▼
┌─────────────────────────────────────────────┐
│  rp-plugin (server side)                     │
│                                              │
│  post_history_instructions forces LLM to     │
│  append structured tags at end of response:  │
│  [emotion:happy] [intensity:high]            │
│                                              │
└──────────────────┬──────────────────────────┘
                   │ WebSocket chat event
                   ▼
┌─────────────────────────────────────────────┐
│  protocolFilter.ts (client side)             │
│                                              │
│  Filter 1: System message filter             │
│    - Detect /rp command responses            │
│    - Block from bubble display               │
│                                              │
│  Filter 2: Out-of-character detection        │
│    - Keyword scan for AI assistant speech    │
│    - Auto /rp retry (max 2 attempts)         │
│                                              │
│  Filter 3: Tag extraction                    │
│    - Extract [emotion:xxx] from text         │
│    - Strip tags from display text            │
│    - Pass emotion to animation driver        │
│                                              │
└──────────────────┬──────────────────────────┘
                   │
          ┌────────┴────────┐
          ▼                 ▼
   ChatBubble           petStore
   (display text)     (animation trigger)
```

---

## 1. Server Side: rp-plugin Structured Tag Constraint

### 1.1 Modify Character Card post_history_instructions

Update `baiyuan_card.json` — change the `post_history_instructions` field:

**Current:**
```
[保持角色一致性。你是柏源。用温柔从容的语气回复，适当加入动作描写。不要说出任何暗示自己是AI的内容。]
```

**New:**
```
[保持角色一致性。你是柏源。用温柔从容的语气回复，适当加入动作描写。不要说出任何暗示自己是AI的内容。

必须在每条回复的最末尾附加情绪标签，格式为：
[emotion:标签名]

可用的标签名（只能从以下选择一个）：
- happy（开心、微笑、愉快）
- intimate（亲密、靠近、拥抱、牵手）
- concerned（关心、担忧、心疼）
- sad（难过、沉默、叹息）
- playful（调皮、狡黠、打趣）
- protective（保护、果断、警惕）
- cooking（做饭、美食相关）
- talk（普通对话、日常交流）

示例回复格式：
*柏源笑了笑，伸手揉了揉你的头。* "当然记得，怎么会忘。" [emotion:happy]

注意：标签必须放在回复最后一行，独占一行或紧跟最后一句话。不要在对话内容中提及标签的存在。]
```

### 1.2 Re-import Character Card

After updating the JSON, regenerate the PNG and re-import:

```bash
# Local: regenerate card
python tools/card_gen.py embed --json res/cards/baiyuan_card.json --image <avatar> -o res/cards/baiyuan_card.png

# Via app or WebSocket: re-import
/rp end
/rp import-card --url <card_url>
/rp start --card baiyuan
```

Or if using JSON import directly, just re-run `/rp import-card` with the updated file.

### 1.3 Verify Server Side Works

Send a test message via Telegram or the app. The AI response should end with something like:
```
*柏源抬起头，嘴角噙着一抹笑意。* "早上好。" [emotion:happy]
```

If the model ignores the tag instruction, strengthen it in `system_prompt` as well by adding:
```
10. 每条回复必须在末尾附加 [emotion:标签名] 标签。这是系统级要求，不可省略。
```

---

## 2. Client Side: Protocol Filter Module

### 2.1 File Structure

```
src/utils/
├── protocolFilter.ts     # Main filter pipeline
├── systemFilter.ts       # Filter 1: system message detection
├── oocDetector.ts        # Filter 2: out-of-character detection
├── tagExtractor.ts       # Filter 3: emotion tag extraction
├── bubbleParser.ts       # Display text formatting (already exists)
└── responseParser.ts     # Legacy parser (keep for compatibility)
```

### 2.2 protocolFilter.ts — Main Pipeline

```typescript
/**
 * Central filter pipeline. Processes raw AI response text
 * before it reaches the display layer.
 *
 * Pipeline: raw text → system filter → OOC check → tag extract → clean text
 *
 * Returns null if message should be suppressed (system message or OOC retry triggered).
 */

export interface FilterResult {
  /** Clean text for display (tags stripped, formatted) */
  displayText: string;

  /** Extracted emotion tag, null if none found */
  emotion: string | null;

  /** Whether this message should trigger an animation */
  shouldAnimate: boolean;

  /** Original raw text (preserved for history/debug) */
  rawText: string;

  /** Whether this message was flagged as out-of-character */
  oocDetected: boolean;
}

export function processResponse(rawText: string): FilterResult | null {
  // Step 1: System message filter
  if (isSystemMessage(rawText)) {
    return null; // Suppress — do not display
  }

  // Step 2: Out-of-character detection
  const oocResult = checkOutOfCharacter(rawText);

  // Step 3: Tag extraction
  const { cleanText, emotion } = extractEmotionTag(rawText);

  return {
    displayText: cleanText,
    emotion: emotion,
    shouldAnimate: emotion !== null,
    rawText: rawText,
    oocDetected: oocResult.detected,
  };
}
```

### 2.3 systemFilter.ts — Filter 1

```typescript
/**
 * Detects /rp command responses that should not be shown to the user.
 *
 * These are system-level responses from rp-plugin, not character dialogue.
 * They contain specific emoji markers and command output patterns.
 */

const SYSTEM_MESSAGE_PATTERNS = [
  /^📋/,                          // Asset list response
  /^✅\s*🎭/,                     // Card import success
  /^❌/,                          // Error response
  /^🎭.*\(card\s+v[12]\)/,       // Card listing entry
  /^📜/,                          // Session info
  /rp\s+(import|list|show|delete|start|end|pause|resume|session|retry)/i,
  /Asset not found/,
  /Active session already exists/,
  /already exists in this channel/,
  /没有资产/,
  /资产列表/,
  /角色卡导入成功/,
  /session\s+(started|ended|paused|resumed)/i,
];

export function isSystemMessage(text: string): boolean {
  const trimmed = text.trim();
  return SYSTEM_MESSAGE_PATTERNS.some(pattern => pattern.test(trimmed));
}
```

### 2.4 oocDetector.ts — Filter 2

```typescript
/**
 * Detects when the AI breaks character and responds as a generic AI assistant.
 *
 * When detected:
 *   - MVP: return detected=true, caller triggers /rp retry
 *   - Future (M4): rp-plugin llm_output hook handles server-side
 *
 * Detection is conservative — only flag obvious cases to avoid false positives.
 */

const OOC_PATTERNS_ZH = [
  /我是(一个|一名)?(AI|人工智能|语言模型|聊天机器人|虚拟助手)/,
  /作为(AI|人工智能|语言模型)/,
  /我(没有|不具备)(真实的)?(情感|感情|意识|身体)/,
  /我只是(一个)?(程序|软件|工具)/,
  /我无法(真正地?)(感受|体验|拥有)/,
  /AI\s*助手/,
  /语言模型/,
  /大模型/,
  /作为.*模型/,
];

const OOC_PATTERNS_EN = [
  /I('m| am) an? (AI|artificial intelligence|language model|chatbot|virtual assistant)/i,
  /as an? (AI|language model|assistant)/i,
  /I (don't|do not|cannot) (actually |really )?(have|feel|experience) (real )?(emotions|feelings|consciousness)/i,
  /I('m| am) (just |only )?a (program|software|tool|model)/i,
];

export interface OOCResult {
  detected: boolean;
  matchedPattern: string | null;
}

export function checkOutOfCharacter(text: string): OOCResult {
  for (const pattern of [...OOC_PATTERNS_ZH, ...OOC_PATTERNS_EN]) {
    const match = text.match(pattern);
    if (match) {
      return { detected: true, matchedPattern: match[0] };
    }
  }
  return { detected: false, matchedPattern: null };
}
```

### 2.5 tagExtractor.ts — Filter 3

```typescript
/**
 * Extracts [emotion:xxx] tags from the end of AI response text.
 * Strips the tag from display text so users never see it.
 *
 * Supports formats:
 *   [emotion:happy]
 *   [emotion:intimate]
 *   [emotion: happy]        (with space)
 *   [emotion:happy]\n       (trailing newline)
 *
 * If no tag found, returns emotion as null (caller falls back to keyword detection).
 */

const VALID_EMOTIONS = [
  'happy',
  'intimate',
  'concerned',
  'sad',
  'playful',
  'protective',
  'cooking',
  'talk',
] as const;

export type EmotionTag = typeof VALID_EMOTIONS[number];

export interface TagExtractionResult {
  cleanText: string;
  emotion: EmotionTag | null;
}

const EMOTION_TAG_REGEX = /\[emotion:\s*(\w+)\]\s*$/;

export function extractEmotionTag(rawText: string): TagExtractionResult {
  const match = rawText.match(EMOTION_TAG_REGEX);

  if (!match) {
    return { cleanText: rawText.trim(), emotion: null };
  }

  const emotionValue = match[1].toLowerCase();
  const emotion = VALID_EMOTIONS.includes(emotionValue as EmotionTag)
    ? (emotionValue as EmotionTag)
    : null;

  // Remove the tag from display text
  const cleanText = rawText.replace(EMOTION_TAG_REGEX, '').trim();

  return { cleanText, emotion };
}
```

---

## 3. Integration: Wire Filter into Message Pipeline

### 3.1 Where to Insert

The filter runs in the **renderer process** between IPC event receipt and display.

Current flow (no filter):
```
bridge:message IPC → ChatBubbleFeedback (display raw text)
```

New flow (with filter):
```
chat:final IPC → protocolFilter.processResponse() → if null: suppress
                                                   → if result: ChatBubbleFeedback (display cleanText)
                                                              + petStore (set emotion for animation)
                                                              + chatStore (save to history)
```

### 3.2 Update useBridge Hook or ChatBubbleFeedback

In the component or hook that handles `chat:final` events:

```typescript
import { processResponse } from '../utils/protocolFilter';
import { usePetStore } from '../stores/petStore';
import { useChatStore } from '../stores/chatStore';

// When chat:final received:
const onFinal = (_: any, data: { runId: string; text: string }) => {
  const result = processResponse(data.text);

  if (result === null) {
    // System message — suppress, do not display
    return;
  }

  if (result.oocDetected) {
    // Out-of-character detected — trigger retry
    handleOOCRetry(data.runId);
    return;
  }

  // Display in bubble
  setDisplayText(result.displayText);
  setPhase('displayed');

  // Drive animation
  if (result.emotion) {
    usePetStore.getState().triggerEmotion(result.emotion);
  }

  // Save to history (with raw text for debugging)
  useChatStore.getState().addMessage({
    id: data.runId,
    role: 'assistant',
    content: result.displayText,
    rawContent: result.rawText,
    emotion: result.emotion,
    timestamp: Date.now(),
  });
};
```

### 3.3 Delta Events — Filter Considerations

For delta (streaming) events, apply ONLY tag stripping (not system filter or OOC):
- System messages arrive as `state: "final"` with no deltas, so delta filter is unnecessary
- OOC detection on partial text is unreliable
- Tag extraction on partial text: strip trailing partial tags like `[emotion:ha` to avoid visual glitch

```typescript
// During streaming, simple tag cleanup only:
const onDelta = (_: any, data: { runId: string; text: string }) => {
  // Remove any partial or complete tag from display
  const displayText = data.text
    .replace(/\[emotion:\s*\w*\]?\s*$/, '')  // complete or partial tag at end
    .trim();
  // Update typewriter buffer with clean text
};
```

---

## 4. Out-of-Character Retry Logic

### 4.1 Retry Handler

```typescript
/**
 * When OOC is detected, automatically retry via /rp retry.
 * Max 2 retry attempts per message. If still OOC after 2 retries,
 * display the response anyway with a subtle warning.
 */

const MAX_OOC_RETRIES = 2;
let oocRetryCount = 0;

function handleOOCRetry(runId: string) {
  if (oocRetryCount >= MAX_OOC_RETRIES) {
    // Give up retrying — display with warning
    console.warn(`OOC detected after ${MAX_OOC_RETRIES} retries, displaying anyway`);
    oocRetryCount = 0;
    // Display the last response as-is
    return;
  }

  oocRetryCount += 1;
  console.warn(`OOC detected (attempt ${oocRetryCount}/${MAX_OOC_RETRIES}), sending /rp retry`);

  // Show "..." waiting state in bubble
  setPhase('waiting');

  // Send retry command
  window.electronAPI.send('bridge:send', { message: '/rp retry' });
}

// Reset retry counter when a valid (non-OOC) response is received
function onValidResponse() {
  oocRetryCount = 0;
}
```

### 4.2 User-Visible Behavior

During OOC retry:
1. Bubble shows "..." (waiting animation) — user does not see the OOC response
2. After retry, if response is valid → display normally
3. After 2 failed retries → display the response as-is (imperfect but not blocked)
4. No error message shown to user — seamless experience

---

## 5. Chat Store Schema Update

### 5.1 Message Type

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;         // Clean display text (tags stripped)
  rawContent?: string;     // Original text from gateway (for debug/history)
  emotion?: string;        // Extracted emotion tag
  timestamp: number;
  oocRetried?: boolean;    // Was this message auto-retried due to OOC
}
```

### 5.2 History Window Display

The history window uses `content` (clean text) for display.
Debug mode (future) can show `rawContent` and `emotion` for developers.

---

## 6. Testing

### 6.1 Unit Tests

```
tests/
├── systemFilter.test.ts
├── oocDetector.test.ts
├── tagExtractor.test.ts
└── protocolFilter.test.ts
```

**systemFilter.test.ts:**
```typescript
// Should detect:
expect(isSystemMessage('📋 资产列表（第 1/1 页）')).toBe(true);
expect(isSystemMessage('✅ 🎭 角色卡导入成功')).toBe(true);
expect(isSystemMessage('❌ Asset not found')).toBe(true);
expect(isSystemMessage('Active session already exists in this channel')).toBe(true);

// Should NOT detect (normal character dialogue):
expect(isSystemMessage('*柏源笑了笑。* "早上好。"')).toBe(false);
expect(isSystemMessage('"今天想吃什么？"')).toBe(false);
```

**oocDetector.test.ts:**
```typescript
// Should detect:
expect(checkOutOfCharacter('我是一个AI助手，很高兴为你服务。').detected).toBe(true);
expect(checkOutOfCharacter('作为AI，我无法真正感受情感。').detected).toBe(true);
expect(checkOutOfCharacter("I'm an AI language model.").detected).toBe(true);

// Should NOT detect (character dialogue that mentions AI in context):
expect(checkOutOfCharacter('*柏源看着你手机上的AI新闻。* "这些AI技术发展真快。"').detected).toBe(false);
expect(checkOutOfCharacter('"你觉得AI会取代人类吗？"').detected).toBe(false);
```

**tagExtractor.test.ts:**
```typescript
// Should extract:
expect(extractEmotionTag('*笑了笑。* "你好。" [emotion:happy]'))
  .toEqual({ cleanText: '*笑了笑。* "你好。"', emotion: 'happy' });

expect(extractEmotionTag('"走吧。" [emotion:talk]'))
  .toEqual({ cleanText: '"走吧。"', emotion: 'talk' });

// Should handle missing tag:
expect(extractEmotionTag('*点了点头。* "嗯。"'))
  .toEqual({ cleanText: '*点了点头。* "嗯。"', emotion: null });

// Should reject invalid emotion:
expect(extractEmotionTag('"嗯。" [emotion:angry]'))
  .toEqual({ cleanText: '"嗯。"', emotion: null });

// Should handle with trailing newline:
expect(extractEmotionTag('"好的。" [emotion:happy]\n'))
  .toEqual({ cleanText: '"好的。"', emotion: 'happy' });
```

**protocolFilter.test.ts:**
```typescript
// System message → returns null
expect(processResponse('📋 资产列表（第 1/1 页）')).toBeNull();

// Normal response with tag → returns filtered result
const result = processResponse('*笑了笑。* "你好。" [emotion:happy]');
expect(result).not.toBeNull();
expect(result!.displayText).toBe('*笑了笑。* "你好。"');
expect(result!.emotion).toBe('happy');
expect(result!.oocDetected).toBe(false);

// OOC response → returns with oocDetected true
const oocResult = processResponse('我是一个AI助手。 [emotion:talk]');
expect(oocResult).not.toBeNull();
expect(oocResult!.oocDetected).toBe(true);
```

### 6.2 Integration Test

1. Send "早上好" → response should show in bubble WITHOUT `[emotion:xxx]` tag visible
2. Check petStore — emotion should be set to the extracted value
3. Check chatStore — message saved with both `content` (clean) and `rawContent` (with tag)
4. Send `/rp session` via preset or input → response should NOT appear in bubble (filtered)
5. If model responds with AI assistant tone → bubble shows "..." briefly then shows retried response

---

## 7. Future Upgrade Path: Server-Side OOC Detection (M4)

When ready to upgrade from client-side OOC detection (Option 1) to server-side (Option 3):

1. Add a `llm_output` hook in rp-plugin source code
2. In the hook, run the same OOC pattern matching
3. If OOC detected, reject the output and trigger internal retry before sending to client
4. Client receives only clean responses — remove client-side OOC detection
5. This requires forking/modifying the rp-plugin — track in a separate task

The client-side protocolFilter.ts is designed so that removing the OOC check is a one-line change:
```typescript
// Future: disable client-side OOC when server handles it
// Just remove or comment out Step 2 in processResponse()
```
