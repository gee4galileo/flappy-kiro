# Requirements Document

## Introduction

This feature prepares Flappy Kiro for production deployment. The game currently runs as a vanilla JS browser game with no build tooling, a single monolithic `game.js` (~1100 lines), and raw asset files served without optimization. Production readiness covers four areas: optimized Canvas rendering (reducing per-frame CPU/GPU cost), asset bundling (minification and cache-friendly delivery), mobile responsiveness (touch-first layout and DPI-aware rendering), and performance tuning (frame-rate stability and memory management).

The game must continue to run correctly in Chrome, Firefox, and Safari without plugins, and must remain openable via `file://` or a local HTTP server with no build step required for development.

## Glossary

- **Game**: The Flappy Kiro browser application
- **Canvas**: The HTML5 `<canvas>` element on which the game is rendered
- **Renderer**: The component responsible for drawing all game elements to the Canvas each frame
- **Device_Pixel_Ratio**: The ratio of physical screen pixels to CSS pixels (`window.devicePixelRatio`), used to render crisp graphics on HiDPI/Retina displays
- **Logical_Size**: The CSS pixel dimensions of the Canvas element (`canvas.style.width/height`)
- **Physical_Size**: The actual pixel buffer dimensions of the Canvas (`canvas.width/height`), equal to Logical_Size × Device_Pixel_Ratio
- **Offscreen_Canvas**: A `<canvas>` element not attached to the DOM, used to pre-render static or infrequently-changing content so it can be blitted cheaply each frame
- **Background_Cache**: The Offscreen_Canvas holding the pre-rendered sky background texture, invalidated only on resize
- **Minified_Bundle**: A single JavaScript file produced by a minifier (e.g. `terser`) that removes whitespace, shortens identifiers, and reduces file size
- **Asset_Manifest**: A JSON file listing each production asset with its content-hash filename, enabling long-lived HTTP cache headers
- **Build_Script**: A Node.js script (`build.js`) that produces the production bundle without requiring a framework or bundler daemon
- **Viewport**: The visible area of the browser window
- **Safe_Area**: The region of the Viewport excluding OS-level UI chrome (notches, home indicators) on mobile devices, defined by CSS `env(safe-area-inset-*)` variables
- **Touch_Target**: A tappable region on screen; must be at least 44×44 CSS pixels per mobile UX guidelines
- **Frame_Budget**: The time available per frame at 60fps — 16.67ms
- **GC_Pressure**: Frequent JavaScript garbage collection caused by allocating short-lived objects in the hot render/update path
- **Object_Pool**: A fixed-size array of pre-allocated objects that are reused rather than allocated and discarded each frame, eliminating GC_Pressure for particles and popups
- **CONFIG**: The frozen configuration object defined in `config.js` containing all tunable game constants
- **HUD**: The score bar rendered at the bottom of the Canvas each frame

---

## Requirements

### Requirement 1: HiDPI / Retina Canvas Rendering

**User Story:** As a player on a HiDPI or Retina display, I want the game graphics to appear sharp and crisp, so that the game looks polished rather than blurry.

#### Acceptance Criteria

1. WHEN the Canvas is initialized or the browser window is resized, THE Renderer SHALL set `canvas.width` and `canvas.height` to `Math.round(logicalWidth * devicePixelRatio)` and `Math.round(logicalHeight * devicePixelRatio)`, where `logicalWidth` and `logicalHeight` are the CSS pixel dimensions of the Viewport.
2. WHEN the Canvas is initialized or resized, THE Renderer SHALL set `canvas.style.width` and `canvas.style.height` to the Logical_Size in CSS pixels so the element occupies the full Viewport without scaling artifacts.
3. WHEN the Canvas is initialized or resized, THE Renderer SHALL call `ctx.scale(devicePixelRatio, devicePixelRatio)` once after resizing the buffer so that all subsequent draw calls use CSS-pixel coordinates.
4. THE Renderer SHALL read `window.devicePixelRatio` at resize time and apply it to the Canvas buffer dimensions, so that the game renders at the full physical resolution of the display.
5. WHEN `window.devicePixelRatio` is `1` (standard display), THE Renderer SHALL behave identically to the current implementation with no visual or performance regression.

---

### Requirement 2: Optimized Canvas Context Initialization

**User Story:** As a player, I want the game to run at a stable 60fps, so that gameplay feels smooth and responsive.

#### Acceptance Criteria

1. THE Game SHALL obtain the 2D rendering context with `canvas.getContext('2d', { alpha: false, willReadFrequently: false })` exactly once at startup.
2. WHEN `alpha: false` is set on the context, THE Renderer SHALL always draw a fully opaque background on every frame so no transparency bleed occurs.
3. THE Game SHALL NOT call `canvas.getContext('2d')` more than once during a session; the context reference SHALL be cached and reused for the lifetime of the game.

---

### Requirement 3: Background Rendering Cache

**User Story:** As a player, I want the game to maintain a stable frame rate even on lower-powered devices, so that the experience is consistent.

#### Acceptance Criteria

1. THE Renderer SHALL pre-render the sky background (solid fill plus sketchy texture strokes) onto a Background_Cache Offscreen_Canvas once per unique canvas size.
2. WHEN the Canvas is resized, THE Renderer SHALL invalidate the Background_Cache and rebuild it at the new dimensions before the next frame is drawn.
3. WHILE the canvas size is unchanged, THE Renderer SHALL draw the background each frame by blitting the Background_Cache with a single `ctx.drawImage` call rather than re-executing the stroke loop.
4. THE Background_Cache SHALL be a plain `document.createElement('canvas')` element with the same Physical_Size as the main Canvas.
5. WHEN the Background_Cache is rebuilt, THE Renderer SHALL draw the sketchy texture strokes using a fixed random seed so the texture is deterministic and does not flicker between frames.

---

### Requirement 4: Shadow Blur Reset After Pipe Draw

**User Story:** As a player, I want visual effects to appear only where intended, so that the game looks correct and professional.

#### Acceptance Criteria

1. WHEN the Renderer finishes drawing all Pipe rectangles, THE Renderer SHALL set `ctx.shadowBlur` to `0` before drawing any subsequent element (particles, HUD, overlays).
2. THE Renderer SHALL set `ctx.shadowColor` to `'transparent'` immediately after the pipe draw pass to prevent shadow state from bleeding into unrelated draw calls.
3. WHEN no Pipes are present in the active obstacle list, THE Renderer SHALL still ensure `ctx.shadowBlur` is `0` before drawing particles and the HUD.

---

### Requirement 5: Particle and Popup Object Pooling

**User Story:** As a player, I want the game to run without frame-rate stutters caused by garbage collection, so that gameplay remains smooth during intense moments.

#### Acceptance Criteria

1. THE Game SHALL maintain a pre-allocated Object_Pool of particle objects with a fixed capacity of at least 60 entries (sufficient for 500ms lifetime at 60fps with one emission per frame).
2. WHEN a new particle is needed, THE Game SHALL acquire an idle object from the Object_Pool and reset its fields rather than allocating a new object with `{}` or `new`.
3. WHEN a particle's lifetime expires, THE Game SHALL return the particle object to the Object_Pool rather than discarding it.
4. THE Game SHALL maintain a pre-allocated Object_Pool of ScorePopup objects with a fixed capacity of at least 10 entries.
5. WHEN a new ScorePopup is needed, THE Game SHALL acquire an idle object from the ScorePopup Object_Pool and reset its fields.
6. WHEN a ScorePopup's lifetime expires, THE Game SHALL return the ScorePopup object to the Object_Pool.
7. IF the Object_Pool is exhausted (all objects are active), THE Game SHALL silently skip emitting the new particle or popup rather than falling back to heap allocation.

---

### Requirement 6: Mobile Viewport and Touch Responsiveness

**User Story:** As a mobile player, I want the game to fill my screen correctly and respond to taps reliably, so that I can play comfortably on a phone or tablet.

#### Acceptance Criteria

1. THE `index.html` SHALL include a `<meta name="viewport">` tag with `content="width=device-width, initial-scale=1.0, viewport-fit=cover"` to enable full-screen layout on mobile browsers including those with notches.
2. THE Canvas SHALL be sized to fill the full Viewport on mobile devices, with no scrollbars or overflow.
3. WHEN the device orientation changes, THE Game SHALL resize the Canvas to match the new Viewport dimensions within one animation frame.
4. THE `index.html` SHALL include CSS that sets `touch-action: none` on the Canvas element to prevent default browser scroll and zoom gestures from interfering with tap input.
5. THE `index.html` SHALL include CSS that accounts for Safe_Area insets using `env(safe-area-inset-bottom)` so the HUD bar is not obscured by the iOS home indicator or Android navigation bar.
6. WHEN a `touchstart` event is received on the Canvas, THE Input_Handler SHALL trigger a Flap action with no additional delay beyond the current frame's input flush.

---

### Requirement 7: Asset Bundling and Minification

**User Story:** As a developer deploying the game, I want a production build that minimizes load time and enables long-lived caching, so that players experience fast initial loads and efficient repeat visits.

#### Acceptance Criteria

1. THE Build_Script SHALL concatenate `config.js` and `game.js` into a single JavaScript file and minify the result using `terser` (or equivalent), producing a file named `dist/game.min.js`.
2. THE Build_Script SHALL copy `index.html` to `dist/index.html` and update the script references to point to `dist/game.min.js` rather than the source files.
3. THE Build_Script SHALL copy all files from `assets/` into `dist/assets/` preserving the directory structure and filenames.
4. THE Build_Script SHALL be invokable via `npm run build` and SHALL complete without errors on Node.js 18 or later.
5. THE minified `dist/game.min.js` SHALL be at least 30% smaller in bytes than the concatenated unminified source.
6. THE `dist/` directory SHALL be listed in `.gitignore` so build artifacts are not committed to version control.
7. WHEN `dist/index.html` is opened in a browser, THE Game SHALL function identically to the development version with no runtime errors.

---

### Requirement 8: Performance Tuning — Frame Rate Stability

**User Story:** As a player, I want the game to maintain 60fps during normal gameplay, so that the experience never feels laggy or inconsistent.

#### Acceptance Criteria

1. THE Game SHALL cache `canvas.width` and `canvas.height` in local variables at the start of each frame and SHALL NOT read these properties inside any inner draw loop.
2. THE Renderer SHALL batch all Pipe draw calls in a single loop pass and all Cloud draw calls in a single loop pass, minimizing `ctx` state changes between draws of the same type.
3. THE Renderer SHALL round all sprite and obstacle coordinates to the nearest integer using `Math.round()` before passing them to Canvas draw calls, preventing sub-pixel anti-aliasing overhead.
4. THE Game SHALL register a `visibilitychange` listener that resets `_lastTimestamp` to `performance.now()` when the tab becomes visible, preventing a large delta-time spike on the first frame after the tab is re-focused.
5. WHEN the computed `elapsed` time between frames exceeds `CONFIG.physics.maxDeltaTime` milliseconds, THE Game SHALL clamp `elapsed` to `CONFIG.physics.maxDeltaTime` before computing `dtSec`, preventing physics tunneling after tab switches or browser throttling.

---

### Requirement 9: Sprite Coordinate Rounding

**User Story:** As a player, I want Ghosty and all game elements to render without blurriness caused by sub-pixel positioning, so that the game looks sharp at all times.

#### Acceptance Criteria

1. WHEN the Renderer draws Ghosty's sprite using `ctx.drawImage`, THE Renderer SHALL pass `Math.round(x)` and `Math.round(y)` as the destination coordinates.
2. WHEN the Renderer draws Pipe rectangles using `ctx.fillRect` and `ctx.strokeRect`, THE Renderer SHALL pass `Math.round(x)`, `Math.round(y)`, `Math.round(w)`, and `Math.round(h)` as arguments.
3. WHEN the Renderer draws Cloud rectangles, THE Renderer SHALL pass rounded integer coordinates to all Canvas draw calls.
4. THE Renderer SHALL apply coordinate rounding at draw time only and SHALL NOT mutate the `x`, `y`, `width`, or `height` fields of any game object.

---

### Requirement 10: Production Build Verification

**User Story:** As a developer, I want automated checks that confirm the production build is correct, so that I can deploy with confidence.

#### Acceptance Criteria

1. THE Build_Script SHALL verify that `dist/game.min.js` exists and has a non-zero file size after the build completes, exiting with a non-zero status code if the file is missing or empty.
2. THE Build_Script SHALL verify that all required asset files (`dist/assets/ghosty.png`, `dist/assets/jump.wav`, `dist/assets/game_over.wav`) exist after the build completes, exiting with a non-zero status code if any are missing.
3. WHEN the build succeeds, THE Build_Script SHALL print the file sizes of `dist/game.min.js` and each asset file to stdout.
4. THE `package.json` SHALL include a `"build"` script entry that invokes the Build_Script via `node build.js`.
