import fs from 'fs'
import path from 'path'

import type { CharacterCard } from './types'

type PartialCard = Partial<Record<keyof CharacterCard, unknown>> & {
  data?: unknown
  char_name?: unknown
}

export class CharacterEngine {
  private readonly resBase: string
  private currentCardName = ''

  constructor(resBase: string) {
    this.resBase = resBase
  }

  loadCard(cardName: string): CharacterCard {
    const cardPath = path.join(this.resBase, 'cards', `${cardName}_card.json`)

    let rawText: string
    try {
      rawText = fs.readFileSync(cardPath, 'utf-8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Character card not found: ${cardPath}`)
      }
      throw error
    }

    const parsed = JSON.parse(rawText) as PartialCard
    const source = this.getCardSource(parsed)
    const normalized = this.normalizeCard(source, cardName)

    this.currentCardName = normalized.name
    return normalized
  }

  buildSystemPrompt(card: CharacterCard, memories?: string, summary?: string): string {
    this.currentCardName = card.name

    const sections: string[] = []
    this.appendSection(sections, '## 系统提示词', card.system_prompt)
    this.appendSection(sections, '## 角色描述', card.description)
    this.appendSection(sections, '## 性格', card.personality)
    this.appendSection(sections, '## 场景', card.scenario)
    if (memories) this.appendSection(sections, '## 记忆', memories)
    if (summary) this.appendSection(sections, '## 之前的对话摘要', summary)
    this.appendSection(sections, '## 历史后指令', card.post_history_instructions)

    return sections.join('\n\n').trim()
  }

  getFirstMessage(card: CharacterCard): string {
    this.currentCardName = card.name
    return this.replacePlaceholders(card.first_mes)
  }

  getMesExample(card: CharacterCard): string {
    this.currentCardName = card.name
    return this.replacePlaceholders(card.mes_example)
  }

  replacePlaceholders(text: string, userName = '你'): string {
    if (!text) {
      return ''
    }

    return text
      .replace(/{{\s*user\s*}}/g, userName)
      .replace(/{{\s*char\s*}}/g, this.currentCardName)
  }

  private getCardSource(parsed: PartialCard): PartialCard {
    const maybeData = parsed.data
    if (maybeData && typeof maybeData === 'object' && !Array.isArray(maybeData)) {
      return maybeData as PartialCard
    }
    return parsed
  }

  private normalizeCard(source: PartialCard, fallbackName: string): CharacterCard {
    return {
      name: this.toStringValue(source.name) || this.toStringValue(source.char_name) || fallbackName,
      description: this.toStringValue(source.description),
      personality: this.toStringValue(source.personality),
      scenario: this.toStringValue(source.scenario),
      first_mes: this.toStringValue(source.first_mes),
      mes_example: this.toStringValue(source.mes_example),
      system_prompt: this.toStringValue(source.system_prompt),
      post_history_instructions: this.toStringValue(source.post_history_instructions),
      tags: this.toStringArray(source.tags),
      creator: this.toStringValue(source.creator)
    }
  }

  private appendSection(parts: string[], header: string, body: string): void {
    const content = body.trim()
    if (!content) {
      return
    }
    parts.push(`${header}\n${this.replacePlaceholders(content)}`)
  }

  private toStringValue(value: unknown): string {
    return typeof value === 'string' ? value : ''
  }

  private toStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
      return undefined
    }

    const items = value.filter((item): item is string => typeof item === 'string')
    return items.length > 0 ? items : undefined
  }
}
