import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './onboarding.module.css'

interface CharacterInfo {
  id: string
  name: string
  description: string
  imageUrl?: string
}

interface CharacterStepProps {
  selectedCard: string
  onSelect: (cardId: string) => void
  onNext: () => void
  onBack: () => void
}

export function CharacterStep({
  selectedCard,
  onSelect,
  onNext,
  onBack,
}: CharacterStepProps): React.ReactElement {
  const { t } = useTranslation()
  const [characters, setCharacters] = useState<CharacterInfo[]>([])

  useEffect(() => {
    async function loadCards() {
      const result = await window.electronAPI?.invoke('cards:list') as CharacterInfo[] | undefined
      const loaded = result ?? []
      setCharacters(loaded)
      if (loaded.length > 0 && !selectedCard) {
        onSelect(loaded[0].id)
      }
    }

    void loadCards()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <h1 className={styles.stepTitle}>{t('onboarding.character.title')}</h1>
      <p className={styles.stepSubtitle}>{t('onboarding.character.subtitle')}</p>

      {characters.length === 0 ? (
        <p className={styles.emptyCards}>{t('onboarding.character.noCards')}</p>
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
        <button className={styles.btnSecondary} onClick={onBack}>{t('common.back')}</button>
        <button
          className={styles.btnPrimary}
          onClick={onNext}
          disabled={characters.length > 0 && !selectedCard}
        >
          {t('common.next')}
        </button>
      </div>
    </>
  )
}
