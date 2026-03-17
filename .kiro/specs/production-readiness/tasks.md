# Implementation Plan: Production Readiness

## Overview

Targeted modifications to `game.js`, `index.html`, and a new `build.js` script. No structural changes to the class hierarchy — all changes are in-place within existing classes plus a new `ObjectPool` helper added inside the IIFE.

## Tasks

- [x] 1. Update `index.html` for mobile responsiveness
  - Replace the existing `<meta name="viewport">` tag with `content="width=device-width, initial-scale=1.0, viewport-fit=cover"`
  - Add `touch-action: none` to the `canvas` CSS rule
  - Add `padding-bottom: env(safe-area-inset-bottom)` to the `body` CSS rule
  - _Requirements: 6.1, 6.2, 6.4, 6.5_

- [x] 1.1 Write unit tests for `index.html` mobile markup
  - Test that viewport meta tag has `viewport-fit=cover`
  - Test that `touch-action: none` is present in CSS
  - Test that `env(safe-area-inset-bottom)` is present in CSS
  - _Requirements: 6.1, 6.4, 6.5_

- [x] 2. Update `Renderer` constructor — optimized context initialization
  - Change `canvas.getContext('2d')` to `canvas.getContext('2d', { alpha: false, willReadFrequently: false })`
  - Store the context on `this.ctx` — never call `getContext` again after construction
  - _Requirements: 2.1, 2.3_

- [x] 2.1 Write unit tests for context initialization
  - Test that `getContext` is called with `{ alpha: false, willReadFrequently: false }`
  - Test that `getContext` is called exactly once during a session
  - _Requirements: 2.1, 2.3_

- [x] 3. Update `Game._resize()` for HiDPI/Retina canvas sizing
  - Read `window.devicePixelRatio || 1` into a local `dpr` variable
  - Set `canvas.width = Math.round(logicalW * dpr)` and `canvas.height = Math.round(logicalH * dpr)`
  - Set `canvas.style.width = logicalW + 'px'` and `canvas.style.height = logicalH + 'px'`
  - Call `this._renderer.resize()` after updating canvas dimensions (already present — verify it passes `dpr`)
  - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [x] 3.1 Update `Renderer.resize()` to apply DPR scale transform
  - Cache `_dpr` on the renderer from `window.devicePixelRatio || 1`
  - In `resize()`, call `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` (or fall back to `ctx.scale`) so all draw calls use CSS-pixel coordinates
  - In `draw()`, reapply `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` at the start to prevent transform accumulation
  - _Requirements: 1.3, 1.5_

- [x] 3.2 Write property test for canvas physical dimensions (Property 1)
  - **Property 1: Canvas physical dimensions equal logical dimensions × DPR**
  - **Validates: Requirements 1.1, 1.2, 1.4**
  - Use `fc.integer` for logical size, `fc.double` for DPR ≥ 1
  - Add to `tests/renderer.test.js`

- [x] 4. Update `Renderer._drawBackground()` — deterministic background cache
  - Add a `seededRandom(seed)` LCG helper inside the IIFE (seed = `canvas.width * 31 + canvas.height`)
  - Replace `Math.random()` calls in the background texture loop with the seeded generator
  - Size the offscreen canvas to `canvas.width × canvas.height` (physical pixels)
  - Invalidate the cache when `canvas.width` or `canvas.height` changes (physical dimensions)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]* 4.1 Write property test for background cache lifecycle (Property 2)
  - **Property 2: Background cache is rebuilt exactly when canvas dimensions change**
  - **Validates: Requirements 3.1, 3.2, 3.3**
  - Use `fc.array` of resize/draw event sequences
  - Add to `tests/renderer.test.js`

- [ ]* 4.2 Write property test for background cache dimensions (Property 3)
  - **Property 3: Background cache dimensions match physical canvas size**
  - **Validates: Requirements 3.4**
  - Use `fc.integer` for canvas physical size
  - Add to `tests/renderer.test.js`

- [ ]* 4.3 Write property test for deterministic background texture (Property 4)
  - **Property 4: Background texture is deterministic across rebuilds**
  - **Validates: Requirements 3.5**
  - Rebuild cache twice for same canvas size, compare pixel data
  - Add to `tests/renderer.test.js`

- [x] 5. Fix shadow state bleed in `Renderer._drawPipes()`
  - Before `ctx.restore()` at the end of `_drawPipes()`, explicitly set `ctx.shadowBlur = 0` and `ctx.shadowColor = 'transparent'`
  - Ensure this runs even when the pipes array is empty
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 5.1 Write property test for shadow state reset (Property 5)
  - **Property 5: Shadow state is reset after pipe draw pass**
  - **Validates: Requirements 4.1, 4.2, 4.3**
  - Use `fc.array` of pipe objects (including empty array)
  - Add to `tests/renderer.test.js`

- [x] 6. Add coordinate rounding to all `Renderer` draw calls
  - In `_drawGhosty`: wrap destination x/y in `Math.round()` for `ctx.drawImage`
  - In `_drawPipes` / `_drawPipeRect`: wrap all four arguments to `ctx.fillRect` and `ctx.strokeRect` in `Math.round()`
  - In `_drawClouds`: wrap all coordinates passed to `ctx.roundRect` (or `ctx.rect`) in `Math.round()`
  - Do NOT mutate `x`, `y`, `width`, or `height` on any game object — round at draw time only
  - _Requirements: 8.3, 9.1, 9.2, 9.3, 9.4_

- [x] 6.1 Write property test for coordinate rounding no mutation (Property 8)
  - **Property 8: Coordinate rounding does not mutate game objects**
  - **Validates: Requirements 8.3, 9.1, 9.2, 9.3, 9.4**
  - Use `fc.double` for floating-point coordinates on pipe, cloud, and ghosty objects
  - Add to `tests/renderer.test.js`

- [x] 7. Checkpoint — Ensure all renderer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Add `ObjectPool` class inside the IIFE in `game.js`
  - Implement `ObjectPool` with `constructor(factory, capacity)`, `acquire()`, `release(obj)`, and `activeCount` getter as specified in the design
  - `acquire()` returns `null` (not a new object) when pool is exhausted
  - _Requirements: 5.1, 5.4, 5.7_

- [x] 8.1 Write property test for pool acquire/release round-trip (Property 6)
  - **Property 6: Object pool acquire/release round-trip**
  - **Validates: Requirements 5.2, 5.3, 5.5, 5.6**
  - Use `fc.integer` for emission count within capacity
  - Add to `tests/effects.test.js`

- [x] 8.2 Write property test for pool exhaustion silent (Property 7)
  - **Property 7: Pool exhaustion is silent — no heap fallback**
  - **Validates: Requirements 5.7**
  - Fill pool to capacity, request one more, assert `null` returned and `activeCount` unchanged
  - Add to `tests/effects.test.js`

- [x] 9. Wire `ObjectPool` into particle and popup emission in `game.js`
  - Initialize `this._particlePool = new ObjectPool(() => ({}), 60)` and `this._popupPool = new ObjectPool(() => ({}), 10)` in `Game` constructor
  - Update `emitParticle` to call `this._particlePool.acquire()`, reset fields on the returned object, and skip emission if `null`
  - Update `createScorePopup` to call `this._popupPool.acquire()`, reset fields, and skip if `null`
  - Update the expiry logic in `updateEffects` to call `pool.release(obj)` instead of `splice`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 10. Update `Game._loop()` for frame stability
  - Add a `visibilitychange` listener in the `Game` constructor that sets `this._lastTimestamp = performance.now()` when `!document.hidden`
  - Verify the delta-time clamp `const dtSec = Math.min(elapsed, CONFIG.physics.maxDeltaTime) / 1000` is applied before any physics update
  - Cache `const cw = this._canvas.width; const ch = this._canvas.height;` at the top of `_loop()` and pass them to methods instead of reading `canvas.width/height` inside loops
  - _Requirements: 8.1, 8.4, 8.5_

- [ ]* 10.1 Write unit test for `visibilitychange` timestamp reset
  - Test that `_lastTimestamp` is updated to `performance.now()` when tab becomes visible
  - _Requirements: 8.4_

- [ ]* 10.2 Write property test for delta-time clamping (Property 9)
  - **Property 9: Delta-time clamping**
  - **Validates: Requirements 8.5**
  - Use `fc.double` for elapsed including values far exceeding `CONFIG.physics.maxDeltaTime`
  - Add to `tests/physics.test.js`

- [x] 11. Checkpoint — Ensure all game logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Create `build.js` — asset bundling and minification script
  - Read `config.js` and `game.js`, concatenate them in order
  - Run `terser` via `child_process.execSync` on the concatenated source, writing output to `dist/game.min.js`
  - Read `index.html`, replace `<script src="config.js">` and `<script src="game.js">` tags with a single `<script src="game.min.js">`, write to `dist/index.html`
  - Copy `assets/ghosty.png`, `assets/jump.wav`, `assets/game_over.wav` to `dist/assets/` preserving filenames
  - After all copies, verify each output file exists and has non-zero size; exit with non-zero code and descriptive message if any check fails
  - Print file sizes of `dist/game.min.js` and each asset to stdout on success
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 10.1, 10.2, 10.3_

- [x] 13. Update `package.json` with build script and `terser` dependency
  - Add `"build": "node build.js"` to the `"scripts"` section
  - Add `"terser": "^5.0.0"` to `"devDependencies"`
  - _Requirements: 7.4, 10.4_

- [x] 14. Add `dist/` to `.gitignore`
  - Append `dist/` to `.gitignore` so build artifacts are not committed
  - _Requirements: 7.6_

- [x] 14.1 Write unit tests for build script verification (`tests/build.test.js`)
  - Test that `dist/game.min.js` exists and is ≥30% smaller than concatenated source after `npm run build`
  - Test that `dist/assets/ghosty.png`, `dist/assets/jump.wav`, `dist/assets/game_over.wav` all exist
  - Test that `dist/index.html` references `game.min.js` and not the source files
  - Test that `package.json` has a `"build"` script entry
  - _Requirements: 7.5, 7.7, 10.1, 10.2, 10.3, 10.4_

- [x] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use `fast-check` (already a dev dependency) with `{ numRuns: 100 }`
- Tag format for new tests: `// Feature: production-readiness, Property N: <property text>`
- The build test (`tests/build.test.js`) requires `npm run build` to have been run first
- All renderer changes must preserve the existing draw order: background → clouds → pipes → ghosty → particles → laser beams → popups → HUD → overlay
