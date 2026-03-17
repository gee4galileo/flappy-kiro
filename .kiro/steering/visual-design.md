# Flappy Kiro — Visual Design Reference

## Color Palette

| Element | Value |
|---|---|
| Background | `#87CEEB` (light blue) |
| HUD bar | `#1a1a2e` |
| Overlay background | `rgba(0, 0, 0, 0.55–0.65)` |
| Pipes (fill) | `#2d8a2d` |
| Pipes (outline) | `#1a5c1a` |
| Clouds | `rgba(255, 255, 255, 0.85)` |
| Text | `#ffffff` |
| New Best text | `#FFD700` |
| Particles | `rgba(255, 255, 255, 0.6)` |

## Typography

Font stack: `'Courier New', 'Lucida Console', monospace` — retro feel, no external font needed.

| Element | Size |
|---|---|
| Game title | 36px |
| GAME OVER / PAUSED | 28–32px |
| Score / Best labels | 18–20px |
| Prompts / hints | 14–16px |
| HUD bar text | 18px |
| Score popup "+1" | 16px |

## Draw Order (z-order)

Always draw in this order each frame — never deviate:

1. Background (sketchy fill)
2. Clouds
3. Pipes
4. Ghosty sprite
5. Particle trail
6. Score popups
7. HUD bar
8. State overlay (Menu / Paused / Game Over) — topmost

## Sprite Rendering

### Ghosty

- Source: `assets/ghosty.png`, rendered at 32×32px
- Always use `ctx.save()` / `ctx.restore()` around Ghosty draw calls
- Rotation pivot is sprite center — translate to center, rotate, translate back:

```js
ctx.save();
ctx.translate(ghosty.x + 16, ghosty.y + 16);
ctx.rotate(rotation);
ctx.drawImage(ghosty.img, -16, -16, 32, 32);
ctx.restore();
```

- Fallback if `ghosty.img` failed to load: draw a white filled circle (radius 14px) at the same center

```js
if (!ghosty.imgLoaded) {
  ctx.beginPath();
  ctx.arc(ghosty.x + 16, ghosty.y + 16, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}
```

### Animation States via Canvas Transforms

| State | Transform |
|---|---|
| Idle / Menu | `y += Math.sin(timestamp * 0.003) * 4` (bob), no rotation |
| Flap | `rotation = -Math.PI / 9` (-20°), ease back over 150ms |
| Falling | `rotation = Math.max(0, vy / terminalVelocity) * (Math.PI / 6)` (0→30°) |
| Death | Rotate to `Math.PI / 2` (90°) over 400ms, fade opacity 1→0.3 |

Flap tilt easing:

```js
// Track flapTimer (ms since last flap)
const FLAP_TILT_DURATION = 150;
if (flapTimer < FLAP_TILT_DURATION) {
  const t = flapTimer / FLAP_TILT_DURATION;
  rotation = -Math.PI / 9 * (1 - t); // ease from -20° back to 0
}
```

## Sketchy / Hand-Drawn Aesthetic

### Background

Fill the canvas with the base color, then overlay faint random short strokes to simulate pencil texture:

```js
function drawBackground(ctx, w, h) {
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(0, 0, w, h);
  // Sketchy texture — draw once per frame with low opacity
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = '#5ba8d4';
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 40);
    ctx.stroke();
  }
  ctx.restore();
}
```

### Pipes

Draw filled rect first, then a slightly offset stroke for the sketchy outline:

```js
function drawPipe(ctx, x, y, w, h) {
  ctx.fillStyle = '#2d8a2d';
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.strokeStyle = '#1a5c1a';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#1a5c1a';
  ctx.shadowBlur = 4;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.restore();
}
```

### Clouds

Use `ctx.roundRect` (or manual arc path for older browsers):

```js
function drawCloud(ctx, cloud) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.strokeStyle = 'rgba(180,180,180,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cloud.x, cloud.y, cloud.width, cloud.height, 12);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
```

## Particle Trail

Emit one particle per frame from Ghosty's left-center (tail position):

```js
// Emission
particles.push({
  x: ghosty.x,
  y: ghosty.y + 16,
  vx: (-30 + Math.random() * 20),  // px/s
  vy: (-20 + Math.random() * 40),  // px/s
  opacity: 1,
  age: 0,
  maxAge: CONFIG.effects.particleMaxAge,
});

// Update (each frame, before draw)
for (let i = particles.length - 1; i >= 0; i--) {
  const p = particles[i];
  p.age += elapsed;
  p.opacity = Math.max(0, 1 - p.age / p.maxAge);
  p.x += p.vx * dtSec;
  p.y += p.vy * dtSec;
  if (p.age >= p.maxAge) particles.splice(i, 1);
}

// Draw
for (const p of particles) {
  ctx.save();
  ctx.globalAlpha = p.opacity * 0.6;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
```

## Score Popup

```js
// Draw
for (const popup of popups) {
  ctx.save();
  ctx.globalAlpha = popup.opacity;
  ctx.fillStyle = '#FFD700';
  ctx.font = '16px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('+1', popup.x, popup.y - popup.offsetY);
  ctx.restore();
}
```

## Screen Shake

Apply before all draw calls, inside `ctx.save()` / `ctx.restore()`:

```js
ctx.save();
if (shake && shake.elapsed < shake.duration) {
  const progress = shake.elapsed / shake.duration;
  const intensity = CONFIG.effects.shakeIntensity * (1 - progress);
  ctx.translate(
    (Math.random() * 2 - 1) * intensity,
    (Math.random() * 2 - 1) * intensity
  );
}
// ... all draw calls ...
ctx.restore();
```

## HUD Bar

```js
function drawHUD(ctx, canvas, score, highScore) {
  const barH = 40;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, canvas.height - barH, canvas.width, barH);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    `Score: ${score} | Best: ${highScore}`,
    canvas.width / 2,
    canvas.height - barH / 2 + 6
  );
}
```

## Overlays

All overlays use a centered rounded rect with semi-transparent dark fill:

```js
function drawOverlayBox(ctx, canvas, lines) {
  const boxW = 320, boxH = 40 + lines.length * 36;
  const bx = (canvas.width - boxW) / 2;
  const by = (canvas.height - boxH) / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(bx, by, boxW, boxH, 16);
  ctx.fill();
  lines.forEach(({ text, size, color, y }) => {
    ctx.font = `${size}px "Courier New", monospace`;
    ctx.fillStyle = color || '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, by + y);
  });
  ctx.restore();
}
```

Pulsing prompt opacity: `opacity = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(timestamp * 0.005))`.
