# Soul Link Desktop — Test Plan: Unit + Lightweight Integration

> **For Claude Code. Implement all tests using Jest (already configured in project).**
> **Two categories: unit tests (pure functions, zero cost) + integration tests (real CPA, flagged).**

---

## 0. Test Infrastructure

### Existing Setup
Project already has Jest configured (`npm test`, `ts-jest` preset, `tests/` directory).

### Directory Structure
```
tests/
├── unit/
│   ├── token-counter.test.ts
│   ├── context-manager.test.ts
│   ├── ooc-detector.test.ts
│   ├── tag-extractor.test.ts
│   ├── character-engine.test.ts
│   ├── session-store.test.ts
│   └── memory-store.test.ts
│
├── integration/
│   ├── llm-client.test.ts
│   ├── agent-pipeline.test.ts
│   └── compression.test.ts
│
├── fixtures/
│   ├── baiyuan_card.json          # Copy of character card for tests
│   └── sample-messages.ts         # Reusable test message fixtures
│
└── __mocks__/
    └── electron.ts                # Existing Electron mock
```

### package.json Scripts
```json
{
  "scripts": {
    "test": "jest tests/unit/",
    "test:unit": "jest tests/unit/",
    "test:integration": "jest tests/integration/ --runInBand",
    "test:all": "jest --runInBand"
  }
}
```

### Integration Test Config

Integration tests need CPA connection. Use environment variables:

```typescript
// tests/integration/helpers.ts

export function getCPAConfig() {
  return {
    baseUrl: process.env.CPA_BASE_URL || 'http://188.239.18.173:8317/v1',
    apiKey: process.env.CPA_API_KEY || '',
    model: process.env.CPA_MODEL || 'MiniMax-M2',
  };
}

export function skipIfNoCPA() {
  if (!process.env.CPA_API_KEY) {
    console.warn('Skipping integration test: CPA_API_KEY not set');
    return true;
  }
  return false;
}
```

Run integration tests:
```bash
CPA_API_KEY=your-key npm run test:integration
```

### Shared Fixtures

```typescript
// tests/fixtures/sample-messages.ts

import { ChatMessage } from '../../electron/agent/types';

export const sampleMessages: ChatMessage[] = [
  {
    id: 'msg-001',
    session_id: 'session-001',
    role: 'user',
    content: '早上好',
    token_count: 5,
    created_at: 1700000000000,
  },
  {
    id: 'msg-002',
    session_id: 'session-001',
    role: 'assistant',
    content: '*柏源抬起头，嘴角噙着一抹笑意。* "早上好。" [emotion:happy]',
    raw_content: '*柏源抬起头，嘴角噙着一抹笑意。* "早上好。" [emotion:happy]',
    emotion: 'happy',
    token_count: 40,
    created_at: 1700000010000,
  },
  {
    id: 'msg-003',
    session_id: 'session-001',
    role: 'user',
    content: '今天想吃什么？',
    token_count: 8,
    created_at: 1700000020000,
  },
  {
    id: 'msg-004',
    session_id: 'session-001',
    role: 'assistant',
    content: '*柏源想了想，走向厨房。* "你想吃清淡的还是重口的？我都可以做。" [emotion:cooking]',
    raw_content: '*柏源想了想，走向厨房。* "你想吃清淡的还是重口的？我都可以做。" [emotion:cooking]',
    emotion: 'cooking',
    token_count: 55,
    created_at: 1700000030000,
  },
];

// Generate N messages for stress tests
export function generateMessages(count: number, sessionId = 'session-001'): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${String(i).padStart(4, '0')}`,
    session_id: sessionId,
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: i % 2 === 0
      ? `用户消息第${i / 2 + 1}轮，这是测试对话内容。`
      : `*柏源点了点头。* "好的，我明白了。" [emotion:talk]`,
    token_count: i % 2 === 0 ? 20 : 35,
    created_at: 1700000000000 + i * 10000,
  }));
}
```

---

## 1. Unit Tests

### 1.1 token-counter.test.ts

```typescript
import { estimateTokens } from '../../electron/agent/token-counter';

describe('estimateTokens', () => {
  test('empty string returns 0', () => {
    expect(estimateTokens('')).toBe(0);
  });

  test('pure Chinese text', () => {
    const text = '柏源抬起头看着你';  // 8 Chinese chars
    const tokens = estimateTokens(text);
    // 8 chars × ~1.5 = ~12 tokens
    expect(tokens).toBeGreaterThanOrEqual(10);
    expect(tokens).toBeLessThanOrEqual(16);
  });

  test('pure English text', () => {
    const text = 'Good morning, how are you today?';
    const tokens = estimateTokens(text);
    // ~7 words × ~1.3 = ~9 tokens
    expect(tokens).toBeGreaterThanOrEqual(6);
    expect(tokens).toBeLessThanOrEqual(15);
  });

  test('mixed Chinese and English', () => {
    const text = '*柏源笑了笑。* "Good morning."';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
    // Should handle mixed content without crashing
  });

  test('long text returns proportionally more tokens', () => {
    const short = '你好';
    const long = '你好'.repeat(100);
    expect(estimateTokens(long)).toBeGreaterThan(estimateTokens(short) * 50);
  });

  test('special characters and emojis', () => {
    const text = '早上好 👋 [emotion:happy]';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
  });
});
```

### 1.2 ooc-detector.test.ts

```typescript
import { checkOutOfCharacter } from '../../electron/agent/ooc-detector';

describe('checkOutOfCharacter', () => {
  describe('should detect OOC (Chinese)', () => {
    const oocTexts = [
      '我是一个AI助手，很高兴为你服务。',
      '作为AI，我无法真正感受情感。',
      '我是一个语言模型，不具备真实的感情。',
      '我只是一个程序，无法理解人类的感受。',
      '作为大模型，我可以帮你解答问题。',
    ];

    oocTexts.forEach((text) => {
      test(`detects: "${text.slice(0, 30)}..."`, () => {
        expect(checkOutOfCharacter(text).detected).toBe(true);
      });
    });
  });

  describe('should detect OOC (English)', () => {
    const oocTexts = [
      "I'm an AI language model, I can help you.",
      "As an artificial intelligence, I don't have feelings.",
      "I am just a program designed to assist you.",
    ];

    oocTexts.forEach((text) => {
      test(`detects: "${text.slice(0, 40)}..."`, () => {
        expect(checkOutOfCharacter(text).detected).toBe(true);
      });
    });
  });

  describe('should NOT detect OOC (valid character dialogue)', () => {
    const validTexts = [
      '*柏源笑了笑。* "早上好，睡好了吗？"',
      '*他看着你手机上的AI新闻。* "这些AI技术发展真快。"',
      '"你觉得AI会取代人类吗？" *柏源思考了一下。*',
      '*柏源端着咖啡走过来。* "今天你看起来心情不错。"',
      '"我给你做了你喜欢的三明治。"',
      '*他揉了揉你的头。* "别想太多了。"',
    ];

    validTexts.forEach((text) => {
      test(`passes: "${text.slice(0, 30)}..."`, () => {
        expect(checkOutOfCharacter(text).detected).toBe(false);
      });
    });
  });
});
```

### 1.3 tag-extractor.test.ts

```typescript
import { extractEmotionTag } from '../../electron/agent/tag-extractor';
// Note: if tag extraction is inside context-manager or a separate util,
// adjust the import path accordingly.

describe('extractEmotionTag', () => {
  test('extracts valid emotion tag at end', () => {
    const result = extractEmotionTag('*笑了笑。* "你好。" [emotion:happy]');
    expect(result.cleanText).toBe('*笑了笑。* "你好。"');
    expect(result.emotion).toBe('happy');
  });

  test('extracts tag with trailing newline', () => {
    const result = extractEmotionTag('"好的。" [emotion:talk]\n');
    expect(result.cleanText).toBe('"好的。"');
    expect(result.emotion).toBe('talk');
  });

  test('extracts tag with space after colon', () => {
    const result = extractEmotionTag('"嗯。" [emotion: intimate]');
    expect(result.cleanText).toBe('"嗯。"');
    expect(result.emotion).toBe('intimate');
  });

  test('all valid emotions are accepted', () => {
    const validEmotions = [
      'happy', 'intimate', 'concerned', 'sad',
      'playful', 'protective', 'cooking', 'talk',
    ];
    validEmotions.forEach((emo) => {
      const result = extractEmotionTag(`"test" [emotion:${emo}]`);
      expect(result.emotion).toBe(emo);
    });
  });

  test('returns null emotion for invalid tag', () => {
    const result = extractEmotionTag('"嗯。" [emotion:angry]');
    expect(result.emotion).toBeNull();
  });

  test('returns null emotion when no tag present', () => {
    const result = extractEmotionTag('*点了点头。* "嗯。"');
    expect(result.cleanText).toBe('*点了点头。* "嗯。"');
    expect(result.emotion).toBeNull();
  });

  test('does not extract tag from middle of text', () => {
    const result = extractEmotionTag('[emotion:happy] 这是开头的标签');
    // Tag not at end — should not extract
    expect(result.emotion).toBeNull();
  });

  test('handles empty string', () => {
    const result = extractEmotionTag('');
    expect(result.cleanText).toBe('');
    expect(result.emotion).toBeNull();
  });
});
```

### 1.4 context-manager.test.ts

```typescript
import { ContextManager } from '../../electron/agent/context-manager';
// Adjust import based on actual export pattern

import { generateMessages } from '../fixtures/sample-messages';

describe('ContextManager', () => {
  describe('sliding window', () => {
    test('returns all messages when within budget', () => {
      const messages = generateMessages(6);  // 3 rounds, ~165 tokens
      const context = new ContextManager({
        maxTotalTokens: 8192,
        systemPromptBudget: 2000,
        outputReserve: 1200,
        maxActiveMessages: 20,
        compressionThreshold: 30,
      });

      const active = context.buildActiveMessages(messages, 5000);
      expect(active.length).toBe(6);
    });

    test('trims old messages when exceeding budget', () => {
      const messages = generateMessages(40);  // 20 rounds, ~1100 tokens
      const context = new ContextManager({
        maxTotalTokens: 8192,
        systemPromptBudget: 2000,
        outputReserve: 1200,
        maxActiveMessages: 20,
        compressionThreshold: 30,
      });

      const active = context.buildActiveMessages(messages, 500);
      // Should trim to fit within 500 token budget
      expect(active.length).toBeLessThan(40);
      // Most recent message should always be included
      expect(active[active.length - 1].id).toBe(messages[messages.length - 1].id);
    });

    test('always includes at least the last message', () => {
      const messages = generateMessages(2);
      const context = new ContextManager({
        maxTotalTokens: 8192,
        systemPromptBudget: 2000,
        outputReserve: 1200,
        maxActiveMessages: 20,
        compressionThreshold: 30,
      });

      const active = context.buildActiveMessages(messages, 1);
      // Even with tiny budget, last message is included
      expect(active.length).toBeGreaterThanOrEqual(1);
    });

    test('respects maxActiveMessages hard cap', () => {
      const messages = generateMessages(50);
      const context = new ContextManager({
        maxTotalTokens: 99999,
        systemPromptBudget: 100,
        outputReserve: 100,
        maxActiveMessages: 10,
        compressionThreshold: 30,
      });

      const active = context.buildActiveMessages(messages, 99999);
      expect(active.length).toBeLessThanOrEqual(10);
    });
  });

  describe('system prompt assembly', () => {
    test('includes card content', () => {
      const context = new ContextManager({
        maxTotalTokens: 8192,
        systemPromptBudget: 2000,
        outputReserve: 1200,
        maxActiveMessages: 20,
        compressionThreshold: 30,
      });

      const prompt = context.buildSystemPrompt({
        systemPrompt: '你是柏源',
        personality: '温柔',
        scenario: '现代都市',
        postHistoryInstructions: '[emotion:xxx]规则',
        summary: null,
        memories: [],
      });

      expect(prompt).toContain('你是柏源');
      expect(prompt).toContain('温柔');
      expect(prompt).toContain('现代都市');
      expect(prompt).toContain('[emotion:xxx]规则');
    });

    test('injects summary when present', () => {
      const context = new ContextManager({
        maxTotalTokens: 8192,
        systemPromptBudget: 2000,
        outputReserve: 1200,
        maxActiveMessages: 20,
        compressionThreshold: 30,
      });

      const prompt = context.buildSystemPrompt({
        systemPrompt: '你是柏源',
        personality: '',
        scenario: '',
        postHistoryInstructions: '',
        summary: '用户聊了工作压力，柏源做了晚饭安慰她',
        memories: [],
      });

      expect(prompt).toContain('用户聊了工作压力');
    });

    test('injects memories when present', () => {
      const context = new ContextManager({
        maxTotalTokens: 8192,
        systemPromptBudget: 2000,
        outputReserve: 1200,
        maxActiveMessages: 20,
        compressionThreshold: 30,
      });

      const prompt = context.buildSystemPrompt({
        systemPrompt: '你是柏源',
        personality: '',
        scenario: '',
        postHistoryInstructions: '',
        summary: null,
        memories: [
          { key: '生日', value: '3月15日' },
          { key: '爱好', value: '烘焙' },
        ],
      });

      expect(prompt).toContain('3月15日');
      expect(prompt).toContain('烘焙');
    });
  });
});
```

### 1.5 character-engine.test.ts

```typescript
import { CharacterEngine } from '../../electron/agent/character-engine';
import * as path from 'path';

describe('CharacterEngine', () => {
  const cardPath = path.join(__dirname, '../fixtures/baiyuan_card.json');

  test('loads V2 card JSON without error', () => {
    const engine = new CharacterEngine(cardPath);
    expect(engine.getCardName()).toBeTruthy();
  });

  test('extracts system_prompt', () => {
    const engine = new CharacterEngine(cardPath);
    const systemPrompt = engine.getSystemPrompt();
    expect(systemPrompt).toContain('柏源');
  });

  test('extracts personality', () => {
    const engine = new CharacterEngine(cardPath);
    expect(engine.getPersonality()).toBeTruthy();
  });

  test('extracts first_mes', () => {
    const engine = new CharacterEngine(cardPath);
    const firstMes = engine.getFirstMessage();
    expect(firstMes).toBeTruthy();
    expect(firstMes.length).toBeGreaterThan(0);
  });

  test('extracts post_history_instructions', () => {
    const engine = new CharacterEngine(cardPath);
    const phi = engine.getPostHistoryInstructions();
    expect(phi).toContain('emotion');
  });

  test('handles missing optional fields gracefully', () => {
    // Create a minimal card with only required fields
    const minimalCard = {
      spec: 'chara_card_v2',
      data: {
        name: 'test',
        description: 'test character',
        personality: '',
        scenario: '',
        first_mes: 'hello',
        mes_example: '',
        system_prompt: 'you are test',
        post_history_instructions: '',
      },
    };

    // Test that engine handles minimal card
    // Implementation: either write to temp file or accept JSON object
    expect(() => {
      // Test based on actual constructor signature
    }).not.toThrow();
  });
});
```

### 1.6 session-store.test.ts

```typescript
import { SessionStore } from '../../electron/agent/session-store';

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    // Use in-memory SQLite for tests — no disk I/O
    store = new SessionStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  test('creates session', () => {
    const session = store.createSession('baiyuan');
    expect(session.id).toBeTruthy();
    expect(session.character_id).toBe('baiyuan');
    expect(session.message_count).toBe(0);
  });

  test('gets active session', () => {
    store.createSession('baiyuan');
    const active = store.getActiveSession('baiyuan');
    expect(active).not.toBeNull();
    expect(active!.character_id).toBe('baiyuan');
  });

  test('returns null for no active session', () => {
    const active = store.getActiveSession('nonexistent');
    expect(active).toBeNull();
  });

  test('adds and retrieves messages', () => {
    const session = store.createSession('baiyuan');
    store.addMessage({
      id: 'msg-001',
      session_id: session.id,
      role: 'user',
      content: '你好',
      token_count: 5,
      created_at: Date.now(),
    });

    const messages = store.getMessages(session.id);
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe('你好');
  });

  test('messages ordered by created_at', () => {
    const session = store.createSession('baiyuan');
    const now = Date.now();

    store.addMessage({
      id: 'msg-002', session_id: session.id, role: 'assistant',
      content: 'second', token_count: 5, created_at: now + 1000,
    });
    store.addMessage({
      id: 'msg-001', session_id: session.id, role: 'user',
      content: 'first', token_count: 5, created_at: now,
    });

    const messages = store.getMessages(session.id);
    expect(messages[0].content).toBe('first');
    expect(messages[1].content).toBe('second');
  });

  test('getMessages respects limit', () => {
    const session = store.createSession('baiyuan');
    for (let i = 0; i < 20; i++) {
      store.addMessage({
        id: `msg-${i}`, session_id: session.id, role: 'user',
        content: `message ${i}`, token_count: 5, created_at: Date.now() + i,
      });
    }

    const messages = store.getMessages(session.id, 5);
    expect(messages.length).toBe(5);
  });

  test('getMessageCount returns correct count', () => {
    const session = store.createSession('baiyuan');
    expect(store.getMessageCount(session.id)).toBe(0);

    store.addMessage({
      id: 'msg-001', session_id: session.id, role: 'user',
      content: 'test', token_count: 5, created_at: Date.now(),
    });

    expect(store.getMessageCount(session.id)).toBe(1);
  });

  test('updateSessionSummary stores summary', () => {
    const session = store.createSession('baiyuan');
    store.updateSessionSummary(session.id, '用户聊了工作压力');

    const updated = store.getActiveSession('baiyuan');
    expect(updated!.summary).toBe('用户聊了工作压力');
  });

  test('deleteSession removes session and messages', () => {
    const session = store.createSession('baiyuan');
    store.addMessage({
      id: 'msg-001', session_id: session.id, role: 'user',
      content: 'test', token_count: 5, created_at: Date.now(),
    });

    store.deleteSession(session.id);
    expect(store.getActiveSession('baiyuan')).toBeNull();
    expect(store.getMessages(session.id).length).toBe(0);
  });
});
```

### 1.7 memory-store.test.ts

```typescript
import { MemoryStore } from '../../electron/agent/memory-store';

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  test('adds and retrieves memory', () => {
    store.upsertMemory({
      character_id: 'baiyuan',
      category: 'user_info',
      key: 'birthday',
      value: '3月15日',
    });

    const memories = store.getMemories('baiyuan');
    expect(memories.length).toBe(1);
    expect(memories[0].key).toBe('birthday');
    expect(memories[0].value).toBe('3月15日');
  });

  test('upsert updates existing memory', () => {
    store.upsertMemory({
      character_id: 'baiyuan',
      category: 'user_info',
      key: 'birthday',
      value: '3月15日',
    });

    store.upsertMemory({
      character_id: 'baiyuan',
      category: 'user_info',
      key: 'birthday',
      value: '3月20日',
    });

    const memories = store.getMemories('baiyuan');
    expect(memories.length).toBe(1);
    expect(memories[0].value).toBe('3月20日');
  });

  test('memories are per-character', () => {
    store.upsertMemory({
      character_id: 'baiyuan',
      category: 'user_info',
      key: 'birthday',
      value: '3月15日',
    });

    const otherMemories = store.getMemories('other-character');
    expect(otherMemories.length).toBe(0);
  });

  test('getMemoriesForPrompt formats correctly', () => {
    store.upsertMemory({
      character_id: 'baiyuan',
      category: 'user_info',
      key: '生日',
      value: '3月15日',
    });
    store.upsertMemory({
      character_id: 'baiyuan',
      category: 'preference',
      key: '爱好',
      value: '烘焙',
    });

    const prompt = store.getMemoriesForPrompt('baiyuan');
    expect(prompt).toContain('生日');
    expect(prompt).toContain('3月15日');
    expect(prompt).toContain('烘焙');
  });

  test('returns empty string when no memories', () => {
    const prompt = store.getMemoriesForPrompt('baiyuan');
    expect(prompt).toBe('');
  });
});
```

---

## 2. Integration Tests

### 2.1 llm-client.test.ts

```typescript
import { LLMClient } from '../../electron/agent/llm-client';
import { getCPAConfig, skipIfNoCPA } from './helpers';

describe('LLMClient (integration)', () => {
  const config = getCPAConfig();
  let client: LLMClient;

  beforeAll(() => {
    if (skipIfNoCPA()) return;
    client = new LLMClient(config);
  });

  test('non-streaming completion returns response', async () => {
    if (skipIfNoCPA()) return;

    const response = await client.complete({
      messages: [
        { role: 'system', content: '你是柏源，用温柔的语气回复。' },
        { role: 'user', content: '你好' },
      ],
      maxTokens: 100,
      stream: false,
    });

    expect(response.content).toBeTruthy();
    expect(response.content.length).toBeGreaterThan(0);
    expect(response.usage).toBeDefined();
    expect(response.usage.total_tokens).toBeGreaterThan(0);
  }, 30000); // 30s timeout for LLM response

  test('streaming completion emits deltas and final', async () => {
    if (skipIfNoCPA()) return;

    const deltas: string[] = [];
    let finalText = '';

    await client.completeStream({
      messages: [
        { role: 'system', content: '你是柏源，用温柔的语气回复。简短回复。' },
        { role: 'user', content: '你好' },
      ],
      maxTokens: 100,
      onDelta: (text) => deltas.push(text),
      onFinal: (text) => { finalText = text; },
    });

    expect(deltas.length).toBeGreaterThan(0);
    expect(finalText).toBeTruthy();
    // Final text should be >= last delta
    expect(finalText.length).toBeGreaterThanOrEqual(deltas[deltas.length - 1].length);
  }, 30000);

  test('returns error for invalid model', async () => {
    if (skipIfNoCPA()) return;

    const badClient = new LLMClient({
      ...config,
      model: 'nonexistent-model-xyz',
    });

    await expect(
      badClient.complete({
        messages: [{ role: 'user', content: 'hi' }],
        maxTokens: 5,
        stream: false,
      })
    ).rejects.toThrow();
  }, 10000);
});
```

### 2.2 agent-pipeline.test.ts

```typescript
import { SoulLinkAgent } from '../../electron/agent';
import { getCPAConfig, skipIfNoCPA } from './helpers';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('SoulLinkAgent pipeline (integration)', () => {
  let agent: SoulLinkAgent;
  let dbPath: string;

  beforeAll(async () => {
    if (skipIfNoCPA()) return;

    // Use temp directory for test DB
    dbPath = path.join(os.tmpdir(), `soul-link-test-${Date.now()}.db`);
    const cpaConfig = getCPAConfig();

    agent = new SoulLinkAgent({
      cpa: cpaConfig,
      character: {
        cardPath: path.join(__dirname, '../fixtures/baiyuan_card.json'),
        cardName: 'baiyuan',
      },
      context: {
        maxTotalTokens: 8192,
        systemPromptBudget: 2000,
        outputReserve: 1200,
        maxActiveMessages: 20,
        compressionThreshold: 30,
      },
      paths: { dbPath },
    });

    await agent.initialize();
  });

  afterAll(async () => {
    if (agent) await agent.dispose();
    // Clean up temp DB
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  test('sends message and receives character response', async () => {
    if (skipIfNoCPA()) return;

    let finalResponse: any = null;

    await agent.sendMessage('你好', {
      onDelta: () => {},
      onFinal: (response) => { finalResponse = response; },
      onError: (err) => { throw err; },
    });

    expect(finalResponse).not.toBeNull();
    expect(finalResponse.displayText).toBeTruthy();
    expect(finalResponse.displayText.length).toBeGreaterThan(0);
    // Should not contain raw emotion tag
    expect(finalResponse.displayText).not.toMatch(/\[emotion:\w+\]/);
  }, 30000);

  test('message is saved to history', async () => {
    if (skipIfNoCPA()) return;

    const history = await agent.getHistory(10);
    // Should have at least 2 messages (user + assistant from previous test)
    expect(history.length).toBeGreaterThanOrEqual(2);
    // First should be user
    expect(history.find(m => m.role === 'user')).toBeTruthy();
    // Should have assistant response
    expect(history.find(m => m.role === 'assistant')).toBeTruthy();
  });

  test('emotion is extracted when present', async () => {
    if (skipIfNoCPA()) return;

    let finalResponse: any = null;

    await agent.sendMessage('早上好，今天天气真好', {
      onDelta: () => {},
      onFinal: (response) => { finalResponse = response; },
      onError: (err) => { throw err; },
    });

    // Emotion may or may not be present depending on LLM compliance
    // Just verify it doesn't crash and returns valid structure
    expect(finalResponse).not.toBeNull();
    expect(typeof finalResponse.emotion === 'string' || finalResponse.emotion === null).toBe(true);
  }, 30000);

  test('resetSession clears messages but agent still works', async () => {
    if (skipIfNoCPA()) return;

    await agent.resetSession();
    const history = await agent.getHistory(10);
    expect(history.length).toBe(0);

    // Can still send messages after reset
    let finalResponse: any = null;
    await agent.sendMessage('重置后的第一条消息', {
      onDelta: () => {},
      onFinal: (response) => { finalResponse = response; },
      onError: (err) => { throw err; },
    });

    expect(finalResponse).not.toBeNull();
  }, 30000);
});
```

### 2.3 compression.test.ts

```typescript
import { SoulLinkAgent } from '../../electron/agent';
import { getCPAConfig, skipIfNoCPA } from './helpers';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('Compression (integration)', () => {
  test('summary is generated after many messages', async () => {
    if (skipIfNoCPA()) return;

    const dbPath = path.join(os.tmpdir(), `soul-link-compress-${Date.now()}.db`);

    const agent = new SoulLinkAgent({
      cpa: getCPAConfig(),
      character: {
        cardPath: path.join(__dirname, '../fixtures/baiyuan_card.json'),
        cardName: 'baiyuan',
      },
      context: {
        maxTotalTokens: 8192,
        systemPromptBudget: 2000,
        outputReserve: 1200,
        maxActiveMessages: 10,
        compressionThreshold: 5, // Low threshold for testing
      },
      paths: { dbPath },
    });

    await agent.initialize();

    // Send enough messages to trigger compression
    const prompts = [
      '你好',
      '今天天气怎么样？',
      '我最近工作很忙',
      '你会做什么菜？',
      '我想出去走走',
      '晚上一起看电影吗？',
    ];

    for (const prompt of prompts) {
      await agent.sendMessage(prompt, {
        onDelta: () => {},
        onFinal: () => {},
        onError: (err) => console.error(err),
      });
    }

    // Wait a moment for async compression to run
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check that history exists and is manageable
    const history = await agent.getHistory(100);
    expect(history.length).toBeGreaterThan(0);

    await agent.dispose();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  }, 120000); // 2 min timeout — multiple LLM calls
});
```

---

## 3. Running Tests

```bash
# Daily development — fast, no API cost
npm run test:unit

# Before commit / PR — verify API integration
CPA_API_KEY=your-key npm run test:integration

# Full suite
CPA_API_KEY=your-key npm run test:all
```

---

## 4. Fixtures Setup

Copy the character card to test fixtures:
```bash
cp res/cards/baiyuan_card.json tests/fixtures/baiyuan_card.json
```

---

## 5. Implementation Checklist

```
[ ] tests/fixtures/sample-messages.ts created
[ ] tests/fixtures/baiyuan_card.json copied
[ ] tests/integration/helpers.ts created
[ ] tests/unit/token-counter.test.ts — all pass
[ ] tests/unit/ooc-detector.test.ts — all pass
[ ] tests/unit/tag-extractor.test.ts — all pass
[ ] tests/unit/context-manager.test.ts — all pass
[ ] tests/unit/character-engine.test.ts — all pass
[ ] tests/unit/session-store.test.ts — all pass
[ ] tests/unit/memory-store.test.ts — all pass
[ ] tests/integration/llm-client.test.ts — passes with CPA_API_KEY
[ ] tests/integration/agent-pipeline.test.ts — passes with CPA_API_KEY
[ ] tests/integration/compression.test.ts — passes with CPA_API_KEY
[ ] npm run test:unit exits 0
[ ] package.json scripts updated
```
