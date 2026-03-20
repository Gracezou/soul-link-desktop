import type { ParsedResponse, Emotion } from './responseParser'

export interface AnimationCommand {
  animationName: string
  // TODO: redesign when integrating OpenClaw image generation
  fvDelta: number
  durationMs: number
}

// TODO: This mapping will be redesigned when integrating OpenClaw image generation.
// Current version is MVP placeholder.
const EMOTION_MAP: Record<Emotion, { animation: string; fvDelta: number }> = {
  happy:      { animation: 'happy',      fvDelta: 5 },
  intimate:   { animation: 'intimate',   fvDelta: 8 },
  concerned:  { animation: 'concerned',  fvDelta: 3 },
  sad:        { animation: 'sad',        fvDelta: 0 },
  playful:    { animation: 'playful',    fvDelta: 5 },
  protective: { animation: 'protective', fvDelta: 8 },
  cooking:    { animation: 'cooking',    fvDelta: 5 },
  talk:       { animation: 'talk',       fvDelta: 2 },
}

export function mapEmotionToAnimation(response: ParsedResponse): AnimationCommand {
  const primaryEmotion = response.emotions[0] ?? 'talk'
  const mapping = EMOTION_MAP[primaryEmotion] ?? EMOTION_MAP.talk

  return {
    animationName: mapping.animation,
    fvDelta: mapping.fvDelta,
    durationMs: 3000,
  }
}
