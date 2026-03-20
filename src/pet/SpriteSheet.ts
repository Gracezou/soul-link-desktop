export interface FrameInfo {
  image: HTMLImageElement
  width: number
  height: number
}

export class SpriteSheet {
  private cache = new Map<string, HTMLImageElement>()
  private basePath: string

  constructor(basePath: string) {
    this.basePath = basePath
  }

  async loadFrame(filename: string): Promise<HTMLImageElement> {
    const cached = this.cache.get(filename)
    if (cached) return cached

    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        this.cache.set(filename, img)
        resolve(img)
      }
      img.onerror = () => reject(new Error(`Failed to load frame: ${filename}`))
      img.src = `${this.basePath}/${filename}`
    })
  }

  async preloadFrames(filenames: string[]): Promise<void> {
    await Promise.all(filenames.map(f => this.loadFrame(f)))
  }

  getFrame(filename: string): HTMLImageElement | null {
    return this.cache.get(filename) ?? null
  }

  clearCache(): void {
    this.cache.clear()
  }
}
