# Flappy Kiro — Game Mechanics Reference

## Physics Constants

All values live in `game-config.json` and are loaded into `CONFIG` via `config.js`.
Never hardcode these values in `game.js`.

| Constant | Value | Unit | CONFIG key |
|---|---|---|---|
| Gravity | 800 | px/s² | `CONFIG.physics.gravity` |
| Jump velocity | -300 | px/s | `CONFIG.physics.jumpVelocity` |
| Terminal velocity | 600 | px/s | `CONFIG.physics.terminalVelocity` |
| Max delta-time | 50 | ms | `CONFIG.physics.maxDeltaTime` |
| Pipe speed | 120 | px/s | `CONFIG.pipes.speed` |
| Gap height | 140 | px | `CONFIG.pipes.gapHeight` |
| Pipe spacing | 350 | px | `CONFIG.pipes.spacing` |
| Cloud speed | 60 | px/s | `CONFIG.clouds.speed` |

## Delta-Time Scaling

All physics values are in px/s or px/s². Convert to per-frame using `dt`:

```js
// dt is a dimensionless multiplier relative to 60fps (16.67ms = 1.0)
// elapsed is clamped to CONFIG.physics.maxDeltaTime before dividing
const dt = Math.min(elapsed, CONFIG.physics.maxDeltaTime) / 16.67;

// Convert px/s² → px/frame²: divide by (1000/16.67)² = 3600
// Simpler: work in px/s and multiply by (elapsed/1000) directly
const dtSec = Math.min(elapsed, CONFIG.physics.maxDeltaTime) / 1000;
```

Use `dtSec` (seconds) for physics updates — it maps directly to px/s values:

```js
ghosty.vy += CONFIG.physics.gravity * dtSec;          // px/s
ghosty.vy = Math.min(ghosty.vy, CONFIG.physics.terminalVelocity);
ghosty.y  += ghosty.vy * dtSec;                       // px
```

## Movement Algorithms

### Ghosty Vertical Movement

```js
// PhysicsEngine.update(ghosty, dtSec)
function update(ghosty, dtSec) {
  // Apply gravity
  ghosty.vy += CONFIG.physics.gravity * dtSec;
  // Clamp to terminal velocity
  ghosty.vy = Math.min(ghosty.vy, CONFIG.physics.terminalVelocity);
  // Update position
  ghosty.y += ghosty.vy * dtSec;
}

// PhysicsEngine.flap(ghosty)
function flap(ghosty) {
  ghosty.vy = CONFIG.physics.jumpVelocity; // overrides current velocity
}
```

### Ghosty Visual Rotation (canvas transform)

```js
// Tilt nose-down proportional to downward velocity
const t = Math.max(0, ghosty.vy / CONFIG.physics.terminalVelocity); // 0→1
const rotation = t * (Math.PI / 6); // 0 → 30 degrees nose-down

// On flap: snap to -20deg, ease back over 150ms
const flapTilt = -Math.PI / 9; // -20 degrees
```

### Ghosty Idle Bob

```js
// Sinusoidal vertical bob in MENU and IDLE states
const bobOffset = Math.sin(timestamp * 0.003) * 4; // ±4px, ~2s cycle
ghosty.renderY = ghosty.y + bobOffset;
```

### Obstacle Scrolling

```js
// updateObstacles(obstacles, dtSec)
for (const obs of obstacles) {
  obs.x -= obs.speed * dtSec;
}
// Remove off-screen (iterate backwards)
for (let i = obstacles.length - 1; i >= 0; i--) {
  if (obstacles[i].x + obstacles[i].width <= 0) obstacles.splice(i, 1);
}
```

## Pipe Spawning

```js
function spawnPipe(canvasWidth, canvasHeight) {
  const margin = 60; // min distance from top/bottom edge
  const maxGapY = canvasHeight - CONFIG.pipes.gapHeight - margin;
  const gapY = margin + Math.random() * (maxGapY - margin);
  return {
    x: canvasWidth,
    width: CONFIG.pipes.width,
    gapY,
    gapHeight: CONFIG.pipes.gapHeight,
    speed: CONFIG.pipes.speed,
    scored: false,
  };
}
```

Spawn timer: track elapsed time, spawn when `elapsed >= CONFIG.pipes.spawnInterval`.
Reset timer after each spawn.

## Collision Detection

### Ghosty Hitbox

Ghosty uses a circular hitbox (radius 12px) centered on the sprite:

```js
const hx = ghosty.x + ghosty.width / 2;   // hitbox center x
const hy = ghosty.y + ghosty.height / 2;  // hitbox center y
const hr = 12;                             // hitbox radius (px)
```

### AABB vs Circle — Pipe Collision

Test the circle against the top pipe rect and bottom pipe rect:

```js
function circleOverlapsRect(cx, cy, r, rx, ry, rw, rh) {
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearX;
  const dy = cy - nearY;
  return dx * dx + dy * dy < r * r;
}

// Top pipe rect: (pipe.x, 0, pipe.width, pipe.gapY)
// Bottom pipe rect: (pipe.x, pipe.gapY + pipe.gapHeight, pipe.width, canvasHeight)
function checkPipeCollision(ghosty, pipe, canvasHeight) {
  const cx = ghosty.x + ghosty.width / 2;
  const cy = ghosty.y + ghosty.height / 2;
  const r = 12;
  return (
    circleOverlapsRect(cx, cy, r, pipe.x, 0, pipe.width, pipe.gapY) ||
    circleOverlapsRect(cx, cy, r, pipe.x, pipe.gapY + pipe.gapHeight, pipe.width, canvasHeight)
  );
}
```

### Circle vs AABB — Cloud Collision

Same `circleOverlapsRect` helper:

```js
function checkCloudCollision(ghosty, cloud) {
  return circleOverlapsRect(
    ghosty.x + ghosty.width / 2,
    ghosty.y + ghosty.height / 2,
    12,
    cloud.x, cloud.y, cloud.width, cloud.height
  );
}
```

### Boundary Collision

```js
function checkBoundary(ghosty, canvasHeight) {
  const cy = ghosty.y + ghosty.height / 2;
  return cy - 12 <= 0 || cy + 12 >= canvasHeight;
}
```

## Scoring

A pipe is scored when Ghosty's center x passes the pipe's right edge and it hasn't been counted yet:

```js
function checkPipeScored(ghosty, pipe) {
  const cx = ghosty.x + ghosty.width / 2;
  if (!pipe.scored && cx > pipe.x + pipe.width) {
    pipe.scored = true;
    return true;
  }
  return false;
}
```

## Visual Effects Algorithms

### Particle Trail

Emit one particle per frame from Ghosty's tail (left-center of sprite):

```js
{
  x: ghosty.x,
  y: ghosty.y + ghosty.height / 2,
  vx: -30 + Math.random() * 20,  // px/s, drifts left
  vy: -20 + Math.random() * 40,  // px/s, slight vertical spread
  opacity: 1,
  age: 0,
  maxAge: CONFIG.effects.particleMaxAge,
}
```

Update each frame: `age += elapsed`, `opacity = 1 - age / maxAge`, `x += vx * dtSec`, `y += vy * dtSec`.

### Screen Shake

Apply a random canvas translation before drawing, decaying over time:

```js
function applyShake(ctx, shake, elapsed) {
  shake.elapsed += elapsed;
  if (shake.elapsed >= shake.duration) return;
  const progress = shake.elapsed / shake.duration;
  const intensity = CONFIG.effects.shakeIntensity * (1 - progress); // decays to 0
  const ox = (Math.random() * 2 - 1) * intensity;
  const oy = (Math.random() * 2 - 1) * intensity;
  ctx.translate(ox, oy);
}
```

### Score Popup

```js
// Created on score increment at gap center
{
  x: pipe.x + pipe.width / 2,
  y: pipe.gapY + pipe.gapHeight / 2,
  offsetY: 0,
  opacity: 1,
  age: 0,
  maxAge: CONFIG.effects.popupMaxAge,
}
// Update: offsetY increases toward popupRiseDistance, opacity fades
popup.offsetY = (popup.age / popup.maxAge) * CONFIG.effects.popupRiseDistance;
popup.opacity = 1 - popup.age / popup.maxAge;
```
