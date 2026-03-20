import type { SpriteSheet } from './SpriteSheet'

export interface AnimationDef {
  frames: string[]
  loop: boolean
  probability: number
  minFV: number
  next?: string
  trigger?: string
}

export interface Manifest {
  character: string
  defaultAnimation: string
  frameRate: number
  animations: Record<string, AnimationDef>
}

export interface AnimationState {
  name: string
  frameIndex: number
  elapsed: number
}

export class AnimationEngine {
  private manifest: Manifest
  private spriteSheet: SpriteSheet
  private current: AnimationState
  private fvLevel = 50
  private frameIntervalMs: number

  constructor(manifest: Manifest, spriteSheet: SpriteSheet) {
    this.manifest = manifest
    this.spriteSheet = spriteSheet
    this.frameIntervalMs = 1000 / manifest.frameRate
    this.current = {
      name: manifest.defaultAnimation,
      frameIndex: 0,
      elapsed: 0,
    }
  }

  get currentAnimation(): AnimationDef | null {
    return this.manifest.animations[this.current.name] ?? null
  }

  get currentFrame(): HTMLImageElement | null {
    const anim = this.currentAnimation
    if (!anim) return null
    const filename = anim.frames[this.current.frameIndex]
    return filename ? this.spriteSheet.getFrame(filename) : null
  }

  get animationName(): string {
    return this.current.name
  }

  setFV(level: number): void {
    this.fvLevel = Math.max(0, Math.min(100, level))
  }

  /**
   * Request a specific animation by name.
   * Falls back to 'talk', then defaultAnimation.
   */
  playAnimation(name: string): void {
    const anim = this.manifest.animations[name]
    if (anim && anim.minFV <= this.fvLevel) {
      this.current = { name, frameIndex: 0, elapsed: 0 }
      return
    }
    // Fallback chain
    if (name !== 'talk' && this.manifest.animations['talk']) {
      this.current = { name: 'talk', frameIndex: 0, elapsed: 0 }
      return
    }
    this.current = { name: this.manifest.defaultAnimation, frameIndex: 0, elapsed: 0 }
  }

  /**
   * Update animation state. Call this each frame with deltaTime in ms.
   */
  update(deltaMs: number): void {
    const anim = this.currentAnimation
    if (!anim || anim.frames.length === 0) return

    this.current.elapsed += deltaMs

    if (this.current.elapsed >= this.frameIntervalMs) {
      this.current.elapsed -= this.frameIntervalMs
      this.current.frameIndex++

      if (this.current.frameIndex >= anim.frames.length) {
        if (anim.loop) {
          this.current.frameIndex = 0
        } else {
          // Non-loop: transition to next or select random idle
          const nextName = anim.next ?? this.manifest.defaultAnimation
          this.current = { name: nextName, frameIndex: 0, elapsed: 0 }
          this.maybeSelectRandomIdle()
        }
      }
    }
  }

  /**
   * Randomly select next idle animation based on probability weights.
   */
  private maybeSelectRandomIdle(): void {
    const candidates = Object.entries(this.manifest.animations)
      .filter(([, def]) => def.probability > 0 && def.minFV <= this.fvLevel && !def.trigger)

    if (candidates.length === 0) return

    const totalWeight = candidates.reduce((sum, [, def]) => sum + def.probability, 0)
    let rand = Math.random() * totalWeight

    for (const [name, def] of candidates) {
      rand -= def.probability
      if (rand <= 0) {
        this.current = { name, frameIndex: 0, elapsed: 0 }
        return
      }
    }
  }

  async preloadAll(): Promise<void> {
    const allFrames = Object.values(this.manifest.animations)
      .flatMap(anim => anim.frames)
    await this.spriteSheet.preloadFrames(allFrames)
  }
}
