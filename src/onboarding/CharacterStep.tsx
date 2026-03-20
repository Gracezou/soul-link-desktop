import React, { useEffect, useState } from 'react'
import styles from './onboarding.module.css'

interface CharacterInfo {
  id: string
  name: string
  description: string
  imageUrl?: string
}

interface CharacterStepProps {
  language: string
  selectedCard: string
  onSelect: (cardId: string) => void
  onNext: () => void
  onBack: () => void
}

export function CharacterStep({
  language,
  selectedCard,
  onSelect,
  onNext,
  onBack,
}: CharacterStepProps): React.ReactElement {
  const isCN = language === 'zh-CN'
  const [characters, setCharacters] = useState<CharacterInfo[]>([])

  useEffect(() => {
    // Scan res/cards/ for available character cards
    async function loadCards() {
      try {
        // Fetch manifest or try known cards
        const knownCards = ['baiyuan']
        const loaded: CharacterInfo[] = []

        for (const id of knownCards) {
          try {
            const resp = await fetch(`./res/cards/${id}_card.json`)
            if (resp.ok) {
              const json = await resp.json() as {
                name?: string
                data?: { name?: string; description?: string }
              }
              const name = json.data?.name ?? json.name ?? id
              const description = (json.data?.description ?? '').slice(0, 50)
              loaded.push({ id, name, description })
            }
          } catch {
            // skip
          }
        }

        setCharacters(loaded)
        if (loaded.length > 0 && !selectedCard) {
          onSelect(loaded[0].id)
        }
      } catch {
        // ignore
      }
    }

    void loadCards()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <h1 className={styles.stepTitle}>{isCN ? '选择角色' : 'Choose Character'}</h1>
      <p className={styles.stepSubtitle}>{isCN ? '选择你的桌面伴侣角色' : 'Pick your desktop companion'}</p>

      {characters.length === 0 ? (
        <p className={styles.emptyCards}>
          {isCN
            ? '暂无角色卡，请将角色卡文件放入 res/cards/ 目录'
            : 'No characters found. Place card files in res/cards/'}
        </p>
      ) : (
        <div className={styles.cardGrid}>
          {characters.map(char => (
            <div
              key={char.id}
              className={`${styles.characterCard} ${selectedCard === char.id ? styles.selected : ''}`}
              onClick={() => onSelect(char.id)}
            >
              {char.imageUrl ? (
                <img src={char.imageUrl} alt={char.name} className={styles.characterAvatar} />
              ) : (
                <div className={styles.characterAvatarPlaceholder}>🌸</div>
              )}
              <div className={styles.characterName}>{char.name}</div>
              {char.description && (
                <div className={styles.characterDesc}>{char.description}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={styles.navRow}>
        <button className={styles.btnSecondary} onClick={onBack}>{isCN ? '上一步' : 'Back'}</button>
        <button
          className={styles.btnPrimary}
          onClick={onNext}
          disabled={characters.length > 0 && !selectedCard}
        >
          {isCN ? '下一步' : 'Next'}
        </button>
      </div>
    </>
  )
}
