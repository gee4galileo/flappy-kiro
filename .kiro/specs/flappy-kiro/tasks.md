# Implementation Plan: Flappy Kiro

## Overview

Implement Flappy Kiro as three plain ES2020 files (`index.html`, `config.js`, `game.js`) with a `tests/` directory. Each task builds on the previous, ending with all components wired together. Tests use `fast-check` for property-based tests and Node.js built-in `node:test` for unit tests.

## Tasks

- [x] 1. Project scaffolding and CONFIG
  - Create `index.html` with a full-viewport `<canvas>`, inline CSS (body margin 0, overflow hidden, background #000), and `<script src="config.js">` + `<script src="game.js">` tags
  - Create `config.js` with the frozen `CONFIG` object containing all constants: `physics` (gravity, flapVelocity, terminalVelocity, maxDeltaTime), `pipes` (speed, width, gapHeight, spawnInterval), `clouds` (speed, minInterval, maxInterval), `effects` (shakeIntensity, shakeDuration, particleMaxAge, popupMaxAge, popupRiseDistance), `audio` (musicVolume, sfxVolume)
  - Create `game.js` as an empty module scaffold (IIFE or top-level) with placeholder stubs for each class
  - Create `tests/` directory with a `helpers.js` exporting `makeGhosty`, `makePipe`, `makeCloud` factory functions used across all test files
  - _Requirements: 1.1, 10.1, 10.3_

- [x] 2. GameState enum and Game class skeleton
  - Define the `GameState` frozen enum (`MENU`, `IDLE`, `PLAYING`, `PAUSED`, `GAME_OVER`) in `game.js`
  - Implement the `Game` class with `state`, `lastTimestamp`, `loop(timestamp)`, `update(dt)`, `transitionTo(state)`, and `reset()` stubs
  - Wire `requestAnimationFrame` to `Game.loop` on `DOMContentLoaded`
  - Implement `transitionTo` with all valid state transitions from the state machine diagram
  - _Requirements: 1.3, 2.3, 2.6, 6.3_

  - [x] 2.1 Write unit tests for state transitions
    - Test all six transitions: Menu→Idle, Idle→Playing, Playing→Paused, Paused→Playing, Playing→GameOver, GameOver→Menu
    - Verify invalid transitions do not change state
    - _Requirements: 1.5, 2.3, 2a.1, 2a.4, 6.3_

- [x] 3. PhysicsEngine
  - Implement `PhysicsEngine` class with `update(ghosty, dt)` and `flap(ghosty)` methods
  - `flap` sets `ghosty.vy = CONFIG.physics.flapVelocity` unconditionally
  - `update` applies `gravity * dt` to `vy`, clamps to `terminalVelocity`, then adds `vy * dt` to `ghosty.y`
  - Guard: `update` is a no-op when game state is `PAUSED`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 2a.2_

  - [x] 3.1 Write property test P1: Flap sets velocity to FLAP_VELOCITY
    - **Property 1: Flap sets velocity to FLAP_VELOCITY**
    - **Validates: Requirements 2.4, 3.2**

  - [x] 3.2 Write property test P2: Physics halted while Paused
    - **Property 2: Physics halted while Paused**
    - **Validates: Requirements 2a.2**

  - [x] 3.3 Write property test P3: Flap ignored while Paused
    - **Property 3: Flap ignored while Paused**
    - **Validates: Requirements 2a.5**

  - [x] 3.4 Write property test P4: Gravity accumulates velocity each frame
    - **Property 4: Gravity accumulates velocity each frame**
    - **Validates: Requirements 3.1**

  - [x] 3.5 Write property test P5: Position updated by velocity each frame
    - **Property 5: Position updated by velocity each frame**
    - **Validates: Requirements 3.3, 3.5**

  - [x] 3.6 Write property test P6: Terminal velocity is enforced
    - **Property 6: Terminal velocity is enforced**
    - **Validates: Requirements 3.4**

  - [x] 3.7 Write property test P7: Delta-time proportionality
    - **Property 7: Delta-time proportionality**
    - **Validates: Requirements 3.6**

- [x] 4. InputHandler
  - Implement `InputHandler` class with `pendingFlap`, `pendingPause` flags, `attach(canvas)`, and `flush()` methods
  - `attach` registers `keydown` (Space flap; Escape/P/p pause), `click`, and `touchstart` listeners on the canvas
  - `flush` returns `{ flap, pause }` and resets both flags to `false`
  - Flap actions are suppressed (not queued) when game state is `PAUSED`
  - _Requirements: 2.1, 2.2, 2a.1, 2a.4, 2a.5_

  - [x] 4.1 Write unit tests for InputHandler
    - Test spacebar, click, and touchstart each set `pendingFlap`
    - Test Escape and P set `pendingPause`
    - Test `flush` clears flags after returning them
    - Test flap is suppressed in PAUSED state
    - _Requirements: 2.1, 2.2, 2a.5_

- [x] 5. Pipe and cloud spawning and scrolling
  - Implement pipe spawning: `spawnPipe(canvasWidth, canvasHeight)` creates a `Pipe` object with randomized `gapY` within safe bounds, fixed `gapHeight`, `width`, `speed` from CONFIG, `scored: false`
  - Implement cloud spawning: `spawnCloud(canvasWidth, canvasHeight)` creates a `Cloud` with random `y`, `width`, `height`, and `speed` from CONFIG
  - Implement `updateObstacles(pipes, clouds, dt, canvasWidth)`: scrolls each obstacle left by `speed * dt`, removes any with `x + width <= 0`
  - Wire pipe spawn timer (CONFIG.pipes.spawnInterval) and cloud spawn timer (random between CONFIG.clouds.minInterval/maxInterval) into `Game.update`
  - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 5.1, 5.2, 5.4_

  - [x] 5.1 Write property test P8: Obstacles scroll left each frame
    - **Property 8: Obstacles scroll left each frame**
    - **Validates: Requirements 4.2, 5.2**

  - [x] 5.2 Write property test P9: Off-screen obstacles are removed
    - **Property 9: Off-screen obstacles are removed**
    - **Validates: Requirements 4.4, 5.4**

  - [x] 5.3 Write property test P10: Gap bounds invariant
    - **Property 10: Gap bounds invariant**
    - **Validates: Requirements 4.5, 4.6**

- [x] 6. CollisionDetector
  - Implement `CollisionDetector` class with `check(ghosty, pipes, clouds, canvasHeight)` returning `boolean`
  - AABB hitbox: inset ghosty bounds to 80% of sprite dimensions (centered)
  - Check top/bottom boundary: `ghosty.y <= 0` or `ghosty.y + ghosty.height >= canvasHeight`
  - Check each pipe: overlap with top pipe rect (`x, 0, width, gapY`) and bottom pipe rect (`x, gapY+gapHeight, width, canvasHeight`)
  - Check each cloud: AABB overlap with cloud rect
  - _Requirements: 6.1, 6.2, 5.5_

  - [x] 6.1 Write property test P11: Pipe collision detection
    - **Property 11: Pipe collision detection**
    - **Validates: Requirements 6.1**

  - [x] 6.2 Write property test P12: Boundary collision detection
    - **Property 12: Boundary collision detection**
    - **Validates: Requirements 6.2**

  - [x] 6.3 Write property test P13: Cloud collision detection
    - **Property 13: Cloud collision detection**
    - **Validates: Requirements 5.5**

- [x] 7. ScoreManager
  - Implement `ScoreManager` class with `score`, `highScore`, `load()`, `checkPipes(pipes, ghosty)`, `onGameOver()`, `reset()`
  - `load` reads `localStorage.getItem('flappyKiroHighScore')` in a `try/catch`; defaults to `0` on failure
  - `checkPipes` increments `score` by 1 for each pipe where `pipe.x + pipe.width < ghosty.x && !pipe.scored`, sets `pipe.scored = true`
  - `onGameOver` updates `highScore` if `score > highScore` and persists via `localStorage.setItem` in a `try/catch`
  - `reset` sets `score = 0`
  - _Requirements: 7.1, 7.2, 7.4, 7.5, 6.6, 6.7_

  - [x] 7.1 Write property test P14: High score persistence round-trip
    - **Property 14: High score persistence round-trip**
    - **Validates: Requirements 6.6, 6.7, 7.2, 7.5**

  - [x] 7.2 Write property test P15: Score increments on pipe pass
    - **Property 15: Score increments on pipe pass**
    - **Validates: Requirements 7.1**

  - [x] 7.3 Write property test P16: Score resets to zero on game reset
    - **Property 16: Score resets to zero on game reset**
    - **Validates: Requirements 7.4**

  - [x] 7.4 Write unit tests for ScoreManager edge cases
    - Test score does not double-increment for the same pipe (`pipe.scored` guard)
    - Test high score is not overwritten when current score is lower
    - Test localStorage fallback: ScoreManager behaves correctly when localStorage throws
    - _Requirements: 7.1, 7.2, 7.5_

- [x] 8. Checkpoint — core logic complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Visual effects (particles, screen shake, score popups)
  - Implement particle emission: each `PLAYING` frame, push a `Particle` `{ x, y, vx, vy, opacity:1, age:0, maxAge: CONFIG.effects.particleMaxAge }` from Ghosty's tail
  - Implement `ScreenShake` creation on collision: `{ elapsed:0, duration: CONFIG.effects.shakeDuration, intensity: CONFIG.effects.shakeIntensity }`
  - Implement `ScorePopup` creation on score increment: `{ x: pipe.x, y: gapCenterY, offsetY:0, opacity:1, age:0, maxAge: CONFIG.effects.popupMaxAge }`
  - Implement `updateEffects(particles, popups, shake, dt)`: advance `age` by `dt * 16.67`, interpolate opacity 1→0, remove expired entries, advance `shake.elapsed`
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 9.1 Write property test P17: Screen shake created on collision
    - **Property 17: Screen shake created on collision**
    - **Validates: Requirements 11.1**

  - [x] 9.2 Write property test P18: Particle emitted each Playing frame
    - **Property 18: Particle emitted each Playing frame**
    - **Validates: Requirements 11.2**

  - [x] 9.3 Write property test P19: Score popup created on score increment
    - **Property 19: Score popup created on score increment**
    - **Validates: Requirements 11.3**

  - [x] 9.4 Write property test P20: Expired effects are removed each frame
    - **Property 20: Expired effects are removed each frame**
    - **Validates: Requirements 11.4**

- [x] 10. AudioManager
  - Implement `AudioManager` class; `AudioContext` created lazily on first user gesture
  - `playFlap()`: reset `currentTime = 0` on `jump.wav` Audio element and call `play()`, catch rejected promise silently
  - `playGameOver()`: same pattern for `game_over.wav`
  - `playScore()`: generate a short beep via a one-shot `OscillatorNode` on the lazy `AudioContext`
  - `startMusic()` / `pauseMusic()` / `resumeMusic()` / `stopMusic()`: manage a looping two-oscillator (square + triangle) melody sequence via scheduled `OscillatorNode`s; no-op if `AudioContext` not yet created
  - Wrap `AudioContext` construction in `try/catch`; disable audio for session on failure
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

- [x] 11. Renderer
  - Implement `Renderer` class with `canvas`, `ctx`, and all draw methods
  - `drawBackground()`: fill light-blue rect, add sketchy texture via short random `ctx.strokeRect` offsets with low opacity
  - `drawGhosty(ghosty)`: draw `ghosty.img` at `(ghosty.x, ghosty.y, ghosty.width, ghosty.height)`; fallback to white circle if image not loaded
  - `drawPipes(pipes)`: for each pipe draw top and bottom green filled rects with `ctx.shadowBlur` sketchy outline and `lineJoin = 'round'`
  - `drawClouds(clouds)`: draw white rounded rectangles (`ctx.roundRect`) with sketchy outline
  - `drawParticles(particles)`: draw each as a small semi-transparent white circle using `particle.opacity`
  - `drawScorePopups(popups)`: draw "+1" text at `(popup.x, popup.y - popup.offsetY)` with `popup.opacity`
  - `drawHUD(score, highScore)`: fill dark bar at canvas bottom, draw "Score: X | Best: X" in retro font
  - `drawOverlay(state)`: draw semi-transparent overlay with appropriate text for MENU, IDLE, PAUSED, GAME_OVER states
  - `applyShake(shake)`: if shake active, `ctx.translate(randomOffset, randomOffset)` before drawing
  - `draw(gameState, ghosty, obstacles, effects, score)`: orchestrate all draw calls in correct z-order
  - Handle `ghosty.png` load failure via `img.onerror` fallback flag
  - _Requirements: 1.3, 1.4, 1.5, 1.6, 2a.3, 4.2, 4.3, 5.2, 5.3, 6.5, 7.3, 8.1, 8.2, 8.3, 8.4, 8.5, 11.1, 11.2, 11.3_

  - [x] 11.1 Write unit test for asset fallback rendering
    - Test that Renderer draws without throwing when `ghosty.img` has failed to load (onerror path)
    - _Requirements: 8.2_

- [x] 12. Wire all components into Game
  - Instantiate `Renderer`, `PhysicsEngine`, `InputHandler`, `CollisionDetector`, `ScoreManager`, `AudioManager` inside `Game`
  - Implement `Game.update(dt)`: call `InputHandler.flush()`, dispatch flap/pause actions to state machine, call `PhysicsEngine.update`, `updateObstacles`, `CollisionDetector.check`, `ScoreManager.checkPipes`, `updateEffects` — all gated on current state
  - Implement `Game.reset()`: reset Ghosty position, clear pipes/clouds/particles/popups, call `ScoreManager.reset()`
  - Implement `Game.transitionTo` side-effects: start/pause/resume/stop music, play SFX, trigger screen shake, call `ScoreManager.onGameOver`
  - Add `window.addEventListener('resize', ...)` to update canvas dimensions and recalculate Ghosty's fixed x-position
  - Clamp `deltaTime` to `CONFIG.physics.maxDeltaTime` in the game loop
  - _Requirements: 1.1, 1.2, 2.3, 2.4, 2.5, 2.6, 2a.1, 2a.2, 2a.4, 6.3, 6.4, 9.4, 9.5, 9.6, 9.7, 10.4_

- [x] 13. Final checkpoint — full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests (P1–P20) each map 1:1 to a correctness property in the design document
- Run tests with: `node --test tests/**/*.test.js`
- Install fast-check before running tests: `npm install --save-dev fast-check`
- Test files: `tests/physics.test.js` (P1–P7), `tests/obstacles.test.js` (P8–P10), `tests/collision.test.js` (P11–P13), `tests/score.test.js` (P14–P16), `tests/effects.test.js` (P17–P20), `tests/state.test.js`, `tests/input.test.js`
