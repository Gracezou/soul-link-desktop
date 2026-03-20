export interface PhysicsState {
  x: number
  y: number
  vx: number
  vy: number
  isDragging: boolean
}

export interface ScreenBounds {
  width: number
  height: number
}

const GRAVITY = 0.5        // px per frame²
const BOUNCE = 0.4         // coefficient of restitution
const FRICTION = 0.85      // horizontal friction on bounce
const PET_SIZE = 200       // px

export class PhysicsEngine {
  private state: PhysicsState
  private bounds: ScreenBounds
  private dragOffsetX = 0
  private dragOffsetY = 0
  private onPositionChange: (x: number, y: number) => void

  constructor(
    initialX: number,
    initialY: number,
    bounds: ScreenBounds,
    onPositionChange: (x: number, y: number) => void
  ) {
    this.state = { x: initialX, y: initialY, vx: 0, vy: 0, isDragging: false }
    this.bounds = bounds
    this.onPositionChange = onPositionChange
  }

  startDrag(mouseX: number, mouseY: number): void {
    this.state.isDragging = true
    this.dragOffsetX = mouseX - this.state.x
    this.dragOffsetY = mouseY - this.state.y
    this.state.vx = 0
    this.state.vy = 0
  }

  updateDrag(mouseX: number, mouseY: number): void {
    if (!this.state.isDragging) return
    this.state.x = mouseX - this.dragOffsetX
    this.state.y = mouseY - this.dragOffsetY
    this.onPositionChange(this.state.x, this.state.y)
  }

  endDrag(vx = 0, vy = 0): void {
    this.state.isDragging = false
    this.state.vx = vx
    this.state.vy = vy
  }

  /**
   * Update physics simulation. Call each frame.
   * Returns true if still in motion.
   */
  update(): boolean {
    if (this.state.isDragging) return false

    // Apply gravity
    this.state.vy += GRAVITY

    // Update position
    this.state.x += this.state.vx
    this.state.y += this.state.vy

    let inMotion = false

    // Bounce off bottom
    const maxY = this.bounds.height - PET_SIZE
    if (this.state.y >= maxY) {
      this.state.y = maxY
      this.state.vy = -this.state.vy * BOUNCE
      this.state.vx *= FRICTION
      if (Math.abs(this.state.vy) < 1) {
        this.state.vy = 0
      }
    } else {
      inMotion = true
    }

    // Clamp horizontal
    if (this.state.x < 0) {
      this.state.x = 0
      this.state.vx = Math.abs(this.state.vx) * BOUNCE
    } else if (this.state.x > this.bounds.width - PET_SIZE) {
      this.state.x = this.bounds.width - PET_SIZE
      this.state.vx = -Math.abs(this.state.vx) * BOUNCE
    }

    if (Math.abs(this.state.vx) > 0.1 || Math.abs(this.state.vy) > 0.1) {
      inMotion = true
    }

    this.onPositionChange(this.state.x, this.state.y)
    return inMotion
  }

  get position(): { x: number; y: number } {
    return { x: this.state.x, y: this.state.y }
  }

  updateBounds(bounds: ScreenBounds): void {
    this.bounds = bounds
  }
}
