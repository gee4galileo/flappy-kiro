# Ghosty Sprite Specification

## Source Asset

- File: `assets/ghosty.png`
- Type: Single static sprite (no spritesheet)
- Render dimensions: 32x32 px

## Hitbox

- Shape: Circle
- Radius: 12px
- Center: sprite center (16, 16) relative to sprite origin
- Used for: collision detection against pipes, clouds, and canvas boundaries

## Animation States

All animation is achieved via canvas 2D transforms applied to the single sprite.
No additional art assets are required.

### Idle (Menu / Idle game state)

- Transform: vertical bob using `Math.sin(time * 0.003) * 4` offset on the y-axis
- Rotation: none
- Scale: 1.0
- Frame rate: continuous (driven by game loop timestamp)

### Flap (Playing state — on jump input)

- Transform: rotate canvas by `-20deg` (upward tilt) for 150ms after a flap
- Rotation eases back to velocity-proportional tilt over the next 150ms
- Scale: 1.0

### Falling (Playing state — no recent flap)

- Transform: rotate canvas proportional to downward velocity
  - `rotation = clamp(vy / terminalVelocity, 0, 1) * 30deg`
  - Ghosty tilts progressively nose-down as velocity increases toward terminal
- Scale: 1.0

### Death (Game Over state)

- Transform: rotate canvas by `90deg` (tumbling) over 400ms transition
- Opacity: fade from 1.0 → 0.3 over 400ms
- Scale: 1.0
- Animation plays once on entering Game Over state, then holds final frame

## Rendering Notes

- All transforms are applied using `ctx.save()` / `ctx.restore()` around each draw call
- Rotation pivot is the sprite center: translate to `(ghosty.x + 16, ghosty.y + 16)`, rotate, translate back by `(-16, -16)` before drawing
- Hitbox circle center tracks with sprite position regardless of visual rotation
- Render size (32x32) is fixed and does not scale with canvas size
