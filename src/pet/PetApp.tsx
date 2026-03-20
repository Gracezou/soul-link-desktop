import React from 'react'
import { PetCanvas } from './PetCanvas'
import { ChatBubble } from '../chat/ChatBubble'
import { useBridge } from '../hooks/useBridge'
import styles from './pet.module.css'

export function PetApp(): React.ReactElement {
  useBridge()

  return (
    <div className={styles.petContainer}>
      <PetCanvas />
      <ChatBubble />
    </div>
  )
}
