import { create } from 'zustand'
import type { Emotion } from '../utils/responseParser'

interface PetState {
  animationName: string
  fvLevel: number
  isDragging: boolean
  positionX: number
  positionY: number
  setAnimation: (name: string) => void
  setAnimationFromEmotion: (emotion: Emotion) => void
  addFV: (delta: number) => void
  setDragging: (dragging: boolean) => void
  setPosition: (x: number, y: number) => void
}

const EMOTION_ANIMATION_MAP: Record<Emotion, string> = {
  happy: 'happy',
  intimate: 'intimate',
  concerned: 'concerned',
  sad: 'sad',
  playful: 'playful',
  protective: 'protective',
  cooking: 'cooking',
  talk: 'talk',
}

export const usePetStore = create<PetState>((set) => ({
  animationName: 'idle',
  fvLevel: 50,
  isDragging: false,
  positionX: 100,
  positionY: 100,

  setAnimation: (name) => set({ animationName: name }),

  setAnimationFromEmotion: (emotion) => {
    const anim = EMOTION_ANIMATION_MAP[emotion] ?? 'talk'
    set({ animationName: anim })
  },

  addFV: (delta) => set(state => ({
    fvLevel: Math.max(0, Math.min(100, state.fvLevel + delta)),
  })),

  setDragging: (dragging) => set({ isDragging: dragging }),

  setPosition: (x, y) => set({ positionX: x, positionY: y }),
}))
