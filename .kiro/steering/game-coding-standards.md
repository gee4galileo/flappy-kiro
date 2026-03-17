# Flappy Kiro — JavaScript Game Coding Standards

## Class Naming Conventions

- Use **PascalCase** for all classes: `PhysicsEngine`, `AudioManager`, `CollisionDetector`
- Use **camelCase** for instances: `const physicsEngine = new PhysicsEngine()`
- Use **SCREAMING_SNAKE_CASE** for true constants that never change at runtime: `const MAX_DELTA_TIME = 50`
- Use **camelCase** for CONFIG keys: `CONFIG.physics.flapVelocity`
- Prefix private-by-convention properties with `_`: `this._audioCtx`, `this._particles`
- Name boolean flags as questions: `isPlaying`, `hasScored`, `pendingFlap`

## File and Module Structure

- One class per logical responsibility — do not merge unrelated concerns into one class
- All classes defined in `game.js` inside an IIFE to avoid polluting global scope
- `config.js` loaded before `game.js` via script tag order — `CONFIG` is a global frozen object
- No ES module `import/export` — plain script tags, compatible with `file://` protocol

```
(function () {
  'use strict';
  // GameState, CONFIG usage, all classes, game bootstrap here
})();
```

## Game Loop Pattern

- Always use `requestAnimationFrame` — never `setInterval` for the game loop
- Cap delta-time to `CONFIG.physics.maxDeltaTime` (ms) to prevent tunneling on tab switch
- Compute `dt` as a dimensionless multiplier: `dt = Math.min(elapsed, maxDeltaTime) / 16.67`
- Pass `dt` explicitly to every `update()` method — never read time inside components

```js
loop(timestamp) {
  const elapsed = timestamp - this._lastTimestamp;
  this._lastTimestamp = timestamp;
  const dt = Math.min(elapsed, CONFIG.physics.maxDeltaTime) / 16.67;
  this.update(dt);
  this.renderer.draw(...);
  requestAnimationFrame(t => this.loop(t));
}
```

## State Machine Pattern

- Game state is a single string enum value on the `Game` instance
- All state transitions go through `transitionTo(newState)` — never set `this.state` directly elsewhere
- `transitionTo` is the only place side-effects of state changes are triggered (audio, resets, etc.)
- Guard all component updates with state checks: `if (this.state !== GameState.PLAYING) return`

## Component Design

- Components are classes that receive what they need via method arguments — no global reads inside methods
- `Renderer` is stateless with respect to game logic — it only draws what it's given
- `CollisionDetector.check()` is a pure function — same inputs always produce same output
- `InputHandler.flush()` clears flags after returning them — call once per frame, use the result

## Canvas Rendering Patterns

- Always wrap transforms in `ctx.save()` / `ctx.restore()`
- Clear the full canvas at the start of each frame: `ctx.clearRect(0, 0, canvas.width, canvas.height)`
- Draw in z-order: background → obstacles → Ghosty → effects → HUD → overlays
- Use `ctx.globalAlpha` for opacity on transient effects; reset to `1` after each draw call
- Avoid `ctx.shadowBlur` in tight loops — apply only to static/infrequent draws (pipe outlines)

## Performance Guidelines

- **Object pooling**: reuse particle and popup objects where possible — avoid `new` allocations in the hot path
- **Array cleanup**: iterate backwards when splicing expired effects to avoid index shifting bugs
- **Avoid layout thrash**: never read `canvas.width/height` inside the render loop — cache on resize
- **Image caching**: load `ghosty.png` once on init, store on the `ghosty` object — never reload mid-game
- **No DOM queries in the loop**: cache all element references at startup
- **Batch similar draws**: draw all pipes in one loop, all clouds in one loop — minimise state changes on `ctx`

```js
// Good — iterate backwards when removing expired items
for (let i = particles.length - 1; i >= 0; i--) {
  if (particles[i].age >= particles[i].maxAge) particles.splice(i, 1);
}
```

## Error Handling Conventions

- Wrap all `localStorage` calls in `try/catch` — storage may be unavailable in private mode
- Catch rejected `Audio.play()` promises silently — never let audio errors crash the game
- Wrap `new AudioContext()` in `try/catch` — disable audio for the session on failure
- Use `img.onerror` to set a fallback flag — render a white circle if sprite fails to load
- Never `throw` inside the game loop — catch and log to console, keep the loop running

## Code Style

- `'use strict'` at the top of the IIFE
- Prefer `const` over `let`; never use `var`
- Use template literals for string interpolation: `` `Score: ${score}` ``
- Keep functions under 30 lines — extract helpers if longer
- Comment non-obvious math: explain delta-time formulas, hitbox inset calculations
