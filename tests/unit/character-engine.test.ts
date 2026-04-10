import { CharacterEngine } from '../../electron/agent/character-engine'
import path from 'path'

// resBase should be the directory containing 'cards/' subdirectory
const resBase = path.join(__dirname, '../fixtures')

describe('CharacterEngine', () => {
  // The fixture is at tests/fixtures/baiyuan_card.json
  // CharacterEngine.loadCard looks for <resBase>/cards/<cardName>_card.json
  // So we need resBase one level up: tests/fixtures with cards/ subfolder
  // Let's create a symlink or adjust. Actually, loadCard does:
  //   path.join(this.resBase, 'cards', `${cardName}_card.json`)
  // Our fixture is at tests/fixtures/baiyuan_card.json
  // So resBase should be tests/ and cardName file would be at tests/cards/baiyuan_card.json
  // We need to use the real res/ directory instead.
  const realResBase = path.join(__dirname, '../../res')

  test('loads card JSON without error', () => {
    const engine = new CharacterEngine(realResBase)
    const card = engine.loadCard('baiyuan')
    expect(card).toBeTruthy()
    expect(card.name).toBeTruthy()
  })

  test('card has expected fields', () => {
    const engine = new CharacterEngine(realResBase)
    const card = engine.loadCard('baiyuan')
    expect(card.name).toBeTruthy()
    expect(typeof card.description).toBe('string')
    expect(typeof card.personality).toBe('string')
    expect(typeof card.scenario).toBe('string')
    expect(typeof card.first_mes).toBe('string')
    expect(typeof card.system_prompt).toBe('string')
    expect(typeof card.post_history_instructions).toBe('string')
  })

  test('buildSystemPrompt contains card content', () => {
    const engine = new CharacterEngine(realResBase)
    const card = engine.loadCard('baiyuan')
    const prompt = engine.buildSystemPrompt(card)
    if (card.system_prompt) expect(prompt).toContain(card.system_prompt.slice(0, 20))
  })

  test('buildSystemPrompt injects summary when present', () => {
    const engine = new CharacterEngine(realResBase)
    const card = engine.loadCard('baiyuan')
    const prompt = engine.buildSystemPrompt(card, undefined, '用户聊了工作压力')
    expect(prompt).toContain('用户聊了工作压力')
  })

  test('buildSystemPrompt injects memories when present', () => {
    const engine = new CharacterEngine(realResBase)
    const card = engine.loadCard('baiyuan')
    const prompt = engine.buildSystemPrompt(card, '生日: 3月15日\n爱好: 烘焙')
    expect(prompt).toContain('3月15日')
    expect(prompt).toContain('烘焙')
  })

  test('getFirstMessage returns first message', () => {
    const engine = new CharacterEngine(realResBase)
    const card = engine.loadCard('baiyuan')
    const firstMes = engine.getFirstMessage(card)
    expect(typeof firstMes).toBe('string')
  })

  test('getMesExample returns example dialogue', () => {
    const engine = new CharacterEngine(realResBase)
    const card = engine.loadCard('baiyuan')
    const mesExample = engine.getMesExample(card)
    expect(typeof mesExample).toBe('string')
  })

  test('replacePlaceholders substitutes {{user}} and {{char}}', () => {
    const engine = new CharacterEngine(realResBase)
    engine.loadCard('baiyuan') // sets currentCardName
    const result = engine.replacePlaceholders('{{user}}对{{char}}说你好')
    expect(result).not.toContain('{{user}}')
    expect(result).not.toContain('{{char}}')
  })

  test('throws for nonexistent card', () => {
    const engine = new CharacterEngine(realResBase)
    expect(() => engine.loadCard('nonexistent_character')).toThrow('Character card not found')
  })
})
