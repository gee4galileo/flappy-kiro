(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // GameState enum
  // ---------------------------------------------------------------------------
  const GameState = Object.freeze({
    MENU:      'MENU',
    IDLE:      'IDLE',
    PLAYING:   'PLAYING',
    PAUSED:    'PAUSED',
    GAME_OVER: 'GAME_OVER',
  });

  // ---------------------------------------------------------------------------
  // Ghosty — character data + animation state
  // ---------------------------------------------------------------------------
  class Ghosty {
    constructor(canvasWidth, canvasHeight) {
      this.width  = CONFIG.ghosty.width;
      this.height = CONFIG.ghosty.height;
      this.x = canvasWidth * CONFIG.ghosty.startXRatio;
      this.y = canvasHeight / 2 - this.height / 2;
      this.vy = 0; // px/s

      // Animation state
      this.flapTimer   = 0;   // ms since last flap (for tilt easing)
      this.deathTimer  = 0;   // ms since death started
      this.isDead      = false;

      // Sprite
      this.img       = new Image();
      this.imgLoaded = false;
      this.img.onload  = () => { this.imgLoaded = true; };
      this.img.onerror = () => { this.imgLoaded = false; };
      this.img.src = 'assets/ghosty.png';
    }

    /** Circular hitbox center */
    get cx() { return this.x + this.width / 2; }
    get cy() { return this.y + this.height / 2; }
    get hitboxRadius() { return CONFIG.ghosty.hitboxRadius; }

    /** Visual rotation angle in radians based on current state */
    getRotation(gameState, timestamp) {
      if (gameState === GameState.MENU || gameState === GameState.IDLE) return 0;

      if (this.isDead) {
        // Tumble to 90° over 400ms
        const t = Math.min(this.deathTimer / 400, 1);
        return t * (Math.PI / 2);
      }

      // Flap tilt: snap to -20°, ease back over 150ms
      const FLAP_TILT_DURATION = 150;
      if (this.flapTimer < FLAP_TILT_DURATION) {
        const t = this.flapTimer / FLAP_TILT_DURATION;
        return (-Math.PI / 9) * (1 - t); // -20° → 0
      }

      // Falling tilt: 0° → 30° proportional to downward velocity
      const t = Math.max(0, this.vy / CONFIG.physics.terminalVelocity);
      return t * (Math.PI / 6);
    }

    /** Y offset for idle/menu bob animation */
    getBobOffset(timestamp) {
      return Math.sin(timestamp * 0.003) * 4;
    }

    /** Opacity for death fade (1 → 0.3 over 400ms) */
    getDeathOpacity() {
      if (!this.isDead) return 1;
      const t = Math.min(this.deathTimer / 400, 1);
      return 1 - t * 0.7;
    }

    /** Advance animation timers */
    updateTimers(elapsed) {
      this.flapTimer += elapsed;
      if (this.isDead) this.deathTimer += elapsed;
    }

    /** Called on flap — resets tilt timer */
    onFlap() {
      this.flapTimer = 0;
    }

    /** Called on death */
    onDeath() {
      this.isDead     = true;
      this.deathTimer = 0;
    }

    /** Reset to starting position */
    reset(canvasWidth, canvasHeight) {
      this.x  = canvasWidth * CONFIG.ghosty.startXRatio;
      this.y  = canvasHeight / 2 - this.height / 2;
      this.vy = 0;
      this.flapTimer  = 0;
      this.deathTimer = 0;
      this.isDead     = false;
    }
  }

  // ---------------------------------------------------------------------------
  // PhysicsEngine
  // ---------------------------------------------------------------------------
  class PhysicsEngine {
    /** Apply gravity, clamp to terminal velocity, update position. No-op when PAUSED. */
    update(ghosty, dtSec, gameState) {
      if (gameState === GameState.PAUSED) return;
      ghosty.vy += CONFIG.physics.gravity * dtSec;
      ghosty.vy = Math.min(ghosty.vy, CONFIG.physics.terminalVelocity);
      ghosty.y  += ghosty.vy * dtSec;
    }

    /** Set upward velocity impulse. No-op when PAUSED. */
    flap(ghosty, gameState) {
      if (gameState === GameState.PAUSED) return;
      ghosty.vy = CONFIG.physics.jumpVelocity;
    }
  }

  // ---------------------------------------------------------------------------
  // InputHandler
  // ---------------------------------------------------------------------------
  class InputHandler {
    constructor() {
      this.pendingFlap  = false;
      this.pendingPause = false;
      this._getState    = () => 'MENU'; // default before attach
    }

    attach(canvas, getState) {
      this._getState = getState;

      canvas.addEventListener('keydown', e => this._onKey(e));
      canvas.addEventListener('click',      () => this._onFlap());
      canvas.addEventListener('touchstart', () => this._onFlap(), { passive: true });
      // Also listen on window so keyboard works without canvas focus
      window.addEventListener('keydown', e => this._onKey(e));
    }

    _onKey(e) {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        this._onFlap();
      } else if (e.code === 'Escape' || e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        this.pendingPause = true;
      }
    }

    _onFlap() {
      if (this._getState() === 'PAUSED') return; // suppress flap when paused
      this.pendingFlap = true;
    }

    flush() {
      const result = { flap: this.pendingFlap, pause: this.pendingPause };
      this.pendingFlap  = false;
      this.pendingPause = false;
      return result;
    }
  }

  // ---------------------------------------------------------------------------
  // Obstacle helpers (Task 5)
  // ---------------------------------------------------------------------------

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

  function spawnCloud(canvasWidth, canvasHeight) {
    const width  = CONFIG.clouds.minWidth  + Math.random() * (CONFIG.clouds.maxWidth  - CONFIG.clouds.minWidth);
    const height = CONFIG.clouds.minHeight + Math.random() * (CONFIG.clouds.maxHeight - CONFIG.clouds.minHeight);
    const y = Math.random() * (canvasHeight - height);
    return {
      x: canvasWidth,
      y,
      width,
      height,
      speed: CONFIG.clouds.speed,
    };
  }

  function updateObstacles(pipes, clouds, dtSec) {
    // Scroll left
    for (const obs of pipes)  obs.x -= obs.speed * dtSec;
    for (const obs of clouds) obs.x -= obs.speed * dtSec;
    // Remove off-screen (iterate backwards)
    for (let i = pipes.length  - 1; i >= 0; i--) {
      if (pipes[i].x + pipes[i].width <= 0) pipes.splice(i, 1);
    }
    for (let i = clouds.length - 1; i >= 0; i--) {
      if (clouds[i].x + clouds[i].width <= 0) clouds.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Circle vs AABB helper — used by CollisionDetector
  // ---------------------------------------------------------------------------
  function circleOverlapsRect(cx, cy, r, rx, ry, rw, rh) {
    const nearX = Math.max(rx, Math.min(cx, rx + rw));
    const nearY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nearX;
    const dy = cy - nearY;
    return dx * dx + dy * dy < r * r;
  }

  // ---------------------------------------------------------------------------
  // CollisionDetector (Task 6)
  // Uses a circular hitbox (radius 12px) centered on the sprite.
  // ---------------------------------------------------------------------------
  class CollisionDetector {
    check(ghosty, pipes, clouds, canvasHeight) {
      const cx = ghosty.x + ghosty.width / 2;
      const cy = ghosty.y + ghosty.height / 2;
      const r  = ghosty.hitboxRadius || 12;

      // Boundary collision
      if (cy - r <= 0 || cy + r >= canvasHeight) return true;

      // Pipe collisions
      for (const pipe of pipes) {
        // Top pipe rect: (pipe.x, 0, pipe.width, pipe.gapY)
        if (circleOverlapsRect(cx, cy, r, pipe.x, 0, pipe.width, pipe.gapY)) return true;
        // Bottom pipe rect: (pipe.x, pipe.gapY + pipe.gapHeight, pipe.width, canvasHeight)
        if (circleOverlapsRect(cx, cy, r, pipe.x, pipe.gapY + pipe.gapHeight, pipe.width, canvasHeight)) return true;
      }

      // Cloud collisions
      for (const cloud of clouds) {
        if (circleOverlapsRect(cx, cy, r, cloud.x, cloud.y, cloud.width, cloud.height)) return true;
      }

      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // ScoreManager (Task 7)
  // ---------------------------------------------------------------------------
  class ScoreManager {
    constructor() {
      this.score     = 0;
      this.highScore = 0;
    }

    load() {
      try {
        const val = localStorage.getItem('flappyKiroHighScore');
        this.highScore = val ? parseInt(val, 10) : 0;
      } catch (_) {
        this.highScore = 0;
      }
    }

    checkPipes(pipes, ghosty) {
      for (const pipe of pipes) {
        if (!pipe.scored && ghosty.x + ghosty.width / 2 > pipe.x + pipe.width) {
          pipe.scored = true;
          this.score += 1;
          if (this.score > this.highScore) {
            this.highScore = this.score;
            this._persist();
          }
          return true;
        }
      }
      return false;
    }

    onGameOver() {
      if (this.score > this.highScore) {
        this.highScore = this.score;
        this._persist();
      }
    }

    reset() {
      this.score = 0;
    }

    _persist() {
      try {
        localStorage.setItem('flappyKiroHighScore', String(this.highScore));
      } catch (_) { /* silent */ }
    }
  }

  // ---------------------------------------------------------------------------
  // Visual effects helpers (Task 9)
  // ---------------------------------------------------------------------------

  // Emit one particle from Ghosty's tail (left-center)
  function emitParticle(ghosty) {
    return {
      x:      ghosty.x,
      y:      ghosty.y + ghosty.height / 2,
      vx:     -30 + Math.random() * 20,  // px/s, drifts left
      vy:     -20 + Math.random() * 40,  // px/s, slight vertical spread
      opacity: 1,
      age:     0,
      maxAge:  CONFIG.effects.particleMaxAge,
    };
  }

  // Create a screen shake object on collision
  function createShake() {
    return {
      elapsed:   0,
      duration:  CONFIG.effects.shakeDuration,
      intensity: CONFIG.effects.shakeIntensity,
    };
  }

  // Create a score popup at the gap center of a pipe
  function createScorePopup(pipe) {
    return {
      x:       pipe.x + pipe.width / 2,
      y:       pipe.gapY + pipe.gapHeight / 2,
      offsetY: 0,
      opacity: 1,
      age:     0,
      maxAge:  CONFIG.effects.popupMaxAge,
    };
  }

  // Update all effects each frame
  // elapsed: ms since last frame
  // dtSec: seconds since last frame
  function updateEffects(particles, popups, shake, elapsed, dtSec) {
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age     += elapsed;
      p.opacity  = Math.max(0, 1 - p.age / p.maxAge);
      p.x       += p.vx * dtSec;
      p.y       += p.vy * dtSec;
      if (p.age >= p.maxAge) particles.splice(i, 1);
    }

    // Update score popups
    for (let i = popups.length - 1; i >= 0; i--) {
      const popup = popups[i];
      popup.age     += elapsed;
      popup.opacity  = Math.max(0, 1 - popup.age / popup.maxAge);
      popup.offsetY  = (popup.age / popup.maxAge) * CONFIG.effects.popupRiseDistance;
      if (popup.age >= popup.maxAge) popups.splice(i, 1);
    }

    // Advance shake timer
    if (shake) shake.elapsed += elapsed;
  }

  // ---------------------------------------------------------------------------
  // AudioManager (Task 10)
  // ---------------------------------------------------------------------------
  class AudioManager {
    constructor() {
      this._ctx         = null;   // AudioContext — created lazily
      this._disabled    = false;  // true if AudioContext creation failed
      this._bgGain      = null;
      this._bgOscs      = [];     // active background oscillator nodes
      this._bgPaused    = false;
      this._bgStartTime = 0;      // AudioContext time when music started/resumed
      this._bgOffset    = 0;      // playback offset in seconds when paused
      this._bgTimer     = null;

      // Pre-load SFX elements
      this._flapAudio     = new Audio('assets/jump.wav');
      this._gameOverAudio = new Audio('assets/game_over.wav');
      this._flapAudio.volume     = CONFIG.audio.sfxVolume;
      this._gameOverAudio.volume = CONFIG.audio.sfxVolume;
    }

    /** Lazily create AudioContext on first call (satisfies autoplay policy). */
    _ensureCtx() {
      if (this._ctx || this._disabled) return;
      try {
        this._ctx    = new (window.AudioContext || window.webkitAudioContext)();
        this._bgGain = this._ctx.createGain();
        this._bgGain.gain.value = CONFIG.audio.musicVolume;
        this._bgGain.connect(this._ctx.destination);
      } catch (_) {
        this._disabled = true;
      }
    }

    playFlap() {
      this._ensureCtx();
      this._flapAudio.currentTime = 0;
      this._flapAudio.play().catch(() => {});
    }

    playGameOver() {
      this._ensureCtx();
      this._gameOverAudio.currentTime = 0;
      this._gameOverAudio.play().catch(() => {});
    }

    playScore() {
      this._ensureCtx();
      if (!this._ctx || this._disabled) return;
      try {
        const osc  = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type            = 'square';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, this._ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this._ctx.destination);
        osc.start(this._ctx.currentTime);
        osc.stop(this._ctx.currentTime + 0.15);
      } catch (_) {}
    }

    startMusic() {
      this._ensureCtx();
      if (!this._ctx || this._disabled) return;
      this._bgOffset = 0;
      this._bgPaused = false;
      this._playBgMusic();
    }

    pauseMusic() {
      if (!this._ctx || this._disabled || this._bgPaused) return;
      this._bgOffset = (this._ctx.currentTime - this._bgStartTime) % this._bgLoopDuration();
      this._bgPaused = true;
      clearTimeout(this._bgTimer);
      this._stopBgOscs();
    }

    resumeMusic() {
      if (!this._ctx || this._disabled || !this._bgPaused) return;
      this._bgPaused = false;
      this._playBgMusic();
    }

    stopMusic() {
      if (!this._ctx || this._disabled) return;
      this._bgPaused = false;
      this._bgOffset = 0;
      clearTimeout(this._bgTimer);
      this._stopBgOscs();
    }

    _stopBgOscs() {
      for (const osc of this._bgOscs) {
        try { osc.stop(); } catch (_) {}
      }
      this._bgOscs = [];
    }

    _bgLoopDuration() {
      return 2.0; // 2-second loop
    }

    /** Schedule a simple two-oscillator looping melody. */
    _playBgMusic() {
      if (!this._ctx || this._disabled) return;
      this._stopBgOscs();

      // Simple pentatonic melody: C4, E4, G4, A4, C5
      const notes = [261.63, 329.63, 392.00, 440.00, 523.25];
      const noteDur = 0.25; // seconds per note
      const loopDur = this._bgLoopDuration();
      const now     = this._ctx.currentTime;
      this._bgStartTime = now - this._bgOffset;

      // Schedule notes for the current loop window
      const startOffset = this._bgOffset % loopDur;
      const noteIndex   = Math.floor(startOffset / noteDur) % notes.length;

      for (let i = 0; i < Math.ceil(loopDur / noteDur) + 1; i++) {
        const idx  = (noteIndex + i) % notes.length;
        const freq = notes[idx];
        const t    = now + (i * noteDur) - (startOffset % noteDur);
        if (t < now - 0.01) continue; // skip past notes

        // Square wave oscillator
        const osc1  = this._ctx.createOscillator();
        const gain1 = this._ctx.createGain();
        osc1.type            = 'square';
        osc1.frequency.value = freq;
        gain1.gain.value     = 0.08;
        osc1.connect(gain1);
        gain1.connect(this._bgGain);
        osc1.start(t);
        osc1.stop(t + noteDur * 0.9);
        this._bgOscs.push(osc1);

        // Triangle wave an octave lower
        const osc2  = this._ctx.createOscillator();
        const gain2 = this._ctx.createGain();
        osc2.type            = 'triangle';
        osc2.frequency.value = freq / 2;
        gain2.gain.value     = 0.05;
        osc2.connect(gain2);
        gain2.connect(this._bgGain);
        osc2.start(t);
        osc2.stop(t + noteDur * 0.9);
        this._bgOscs.push(osc2);
      }

      // Schedule next loop
      const loopEnd = now + loopDur - (startOffset % loopDur);
      this._bgTimer = setTimeout(() => {
        if (!this._bgPaused && this._bgOscs.length > 0) {
          this._bgOffset = 0;
          this._playBgMusic();
        }
      }, (loopEnd - this._ctx.currentTime) * 1000);
    }
  }

  // ---------------------------------------------------------------------------
  // Renderer (Task 11)
  // ---------------------------------------------------------------------------
  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx    = canvas.getContext('2d');
      // Cache canvas dimensions — updated on resize via Game._resize
      this._w = canvas.width;
      this._h = canvas.height;
    }

    /** Call on resize to update cached dimensions. */
    resize() {
      this._w = this.canvas.width;
      this._h = this.canvas.height;
    }

    draw(gameState, ghosty, pipes, clouds, particles, popups, shake, score, highScore, timestamp) {
      const ctx = this.ctx;
      ctx.save();

      // Apply screen shake before all draws
      if (shake && shake.elapsed < shake.duration) {
        const progress  = shake.elapsed / shake.duration;
        const intensity = shake.intensity * (1 - progress);
        ctx.translate(
          (Math.random() * 2 - 1) * intensity,
          (Math.random() * 2 - 1) * intensity
        );
      }

      ctx.clearRect(0, 0, this._w, this._h);

      // 1. Background
      this._drawBackground(ctx);

      // 2. Clouds
      this._drawClouds(ctx, clouds);

      // 3. Pipes
      this._drawPipes(ctx, pipes);

      // 4. Ghosty
      this._drawGhosty(ctx, ghosty, gameState, timestamp);

      // 5. Particles
      this._drawParticles(ctx, particles);

      // 6. Score popups
      this._drawPopups(ctx, popups);

      // 7. HUD
      this._drawHUD(ctx, score, highScore);

      // 8. Overlay
      this._drawOverlay(ctx, gameState, score, highScore, timestamp);

      ctx.restore();
    }

    _drawBackground(ctx) {
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, this._w, this._h);
      // Sketchy texture
      ctx.save();
      ctx.globalAlpha = 0.04;
      ctx.strokeStyle = '#5ba8d4';
      ctx.lineWidth   = 1;
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * this._w;
        const y = Math.random() * this._h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 40);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawClouds(ctx, clouds) {
      for (const cloud of clouds) {
        ctx.save();
        ctx.fillStyle   = 'rgba(255,255,255,0.85)';
        ctx.strokeStyle = 'rgba(180,180,180,0.6)';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(cloud.x, cloud.y, cloud.width, cloud.height, 12);
        } else {
          // Fallback for older browsers
          ctx.rect(cloud.x, cloud.y, cloud.width, cloud.height);
        }
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    _drawPipes(ctx, pipes) {
      for (const pipe of pipes) {
        // Top pipe
        this._drawPipeRect(ctx, pipe.x, 0, pipe.width, pipe.gapY);
        // Bottom pipe
        this._drawPipeRect(ctx, pipe.x, pipe.gapY + pipe.gapHeight, pipe.width, this._h - (pipe.gapY + pipe.gapHeight));
      }
    }

    _drawPipeRect(ctx, x, y, w, h) {
      if (h <= 0) return;
      ctx.fillStyle = '#2d8a2d';
      ctx.fillRect(x, y, w, h);
      ctx.save();
      ctx.strokeStyle  = '#1a5c1a';
      ctx.lineWidth    = 3;
      ctx.lineJoin     = 'round';
      ctx.shadowColor  = '#1a5c1a';
      ctx.shadowBlur   = 4;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.restore();
    }

    _drawGhosty(ctx, ghosty, gameState, timestamp) {
      const cx = ghosty.x + ghosty.width / 2;
      let   cy = ghosty.y + ghosty.height / 2;

      // Bob in MENU/IDLE states
      if (gameState === 'MENU' || gameState === 'IDLE') {
        cy += ghosty.getBobOffset(timestamp);
      }

      const rotation = ghosty.getRotation(gameState, timestamp);
      const opacity  = ghosty.getDeathOpacity();

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(cx, cy);
      ctx.rotate(rotation);

      if (ghosty.imgLoaded) {
        ctx.drawImage(ghosty.img, -ghosty.width / 2, -ghosty.height / 2, ghosty.width, ghosty.height);
      } else {
        // Fallback: white circle
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      ctx.restore();
    }

    _drawParticles(ctx, particles) {
      for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.opacity * 0.6;
        ctx.fillStyle   = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    _drawPopups(ctx, popups) {
      for (const popup of popups) {
        ctx.save();
        ctx.globalAlpha = popup.opacity;
        ctx.fillStyle   = '#FFD700';
        ctx.font        = '16px "Courier New", monospace';
        ctx.textAlign   = 'center';
        ctx.fillText('+1', popup.x, popup.y - popup.offsetY);
        ctx.restore();
      }
    }

    _drawHUD(ctx, score, highScore) {
      const barH = 40;
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, this._h - barH, this._w, barH);
      ctx.fillStyle = '#ffffff';
      ctx.font      = '18px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `Score: ${score} | Best: ${highScore}`,
        this._w / 2,
        this._h - barH / 2 + 6
      );
    }

    _drawOverlay(ctx, gameState, score, highScore, timestamp) {
      const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(timestamp * 0.005));

      if (gameState === 'MENU') {
        this._drawOverlayBox(ctx, [
          { text: 'Flappy Kiro', size: 36, color: '#ffffff', y: 60 },
          { text: `Best: ${highScore}`, size: 20, color: '#ffffff', y: 100 },
          { text: 'Tap or press Space to start', size: 16, color: '#ffffff', y: 140, alpha: pulse },
        ]);
      } else if (gameState === 'IDLE') {
        this._drawOverlayBox(ctx, [
          { text: 'Tap or press Space to start', size: 16, color: '#ffffff', y: 50, alpha: pulse },
        ]);
      } else if (gameState === 'PAUSED') {
        this._drawOverlayBox(ctx, [
          { text: 'PAUSED', size: 32, color: '#ffffff', y: 55 },
          { text: 'Press P or Esc to resume', size: 16, color: '#ffffff', y: 95, alpha: pulse },
        ]);
      } else if (gameState === 'GAME_OVER') {
        this._drawOverlayBox(ctx, [
          { text: 'GAME OVER', size: 32, color: '#ffffff', y: 55 },
          { text: `Score: ${score}`, size: 20, color: '#ffffff', y: 95 },
          { text: `Best: ${highScore}`, size: 20, color: '#FFD700', y: 125 },
          { text: 'Tap or press Space to restart', size: 16, color: '#ffffff', y: 160, alpha: pulse },
        ]);
      }
    }

    _drawOverlayBox(ctx, lines) {
      const boxW = 340;
      const boxH = 40 + lines.length * 40;
      const bx   = (this._w - boxW) / 2;
      const by   = (this._h - boxH) / 2;

      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bx, by, boxW, boxH, 16);
      } else {
        ctx.rect(bx, by, boxW, boxH);
      }
      ctx.fill();

      for (const line of lines) {
        ctx.globalAlpha = line.alpha !== undefined ? line.alpha : 1;
        ctx.font        = `${line.size}px "Courier New", monospace`;
        ctx.fillStyle   = line.color || '#ffffff';
        ctx.textAlign   = 'center';
        ctx.fillText(line.text, this._w / 2, by + line.y);
      }
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------------------
  // Game — coordinator (Tasks 2 & 12)
  // ---------------------------------------------------------------------------
  class Game {
    constructor() {
      this._canvas = document.getElementById('gameCanvas');
      this._resize();
      window.addEventListener('resize', () => this._resize());

      this.state          = GameState.MENU;
      this._lastTimestamp = 0;

      this._ghosty            = new Ghosty(this._canvas.width, this._canvas.height);
      this._physicsEngine     = new PhysicsEngine();
      this._inputHandler      = new InputHandler();
      this._collisionDetector = new CollisionDetector();
      this._scoreManager      = new ScoreManager();
      this._audioManager      = new AudioManager();
      this._renderer          = new Renderer(this._canvas);

      this._pipes     = [];
      this._clouds    = [];
      this._particles = [];
      this._popups    = [];
      this._shake     = null;
      this._pipeTimer          = 0;
      this._cloudTimer         = 0;
      this._nextCloudInterval  = null;

      this._scoreManager.load();
      this._inputHandler.attach(this._canvas, () => this.state);
    }

    _resize() {
      this._canvas.width  = window.innerWidth;
      this._canvas.height = window.innerHeight;
      if (this._renderer) this._renderer.resize();
    }

    start() {
      requestAnimationFrame(t => this._loop(t));
    }

    _loop(timestamp) {
      const elapsed = this._lastTimestamp ? timestamp - this._lastTimestamp : 16.67;
      this._lastTimestamp = timestamp;
      const dtSec = Math.min(elapsed, CONFIG.physics.maxDeltaTime) / 1000;

      this._update(elapsed, dtSec, timestamp);
      this._renderer.draw(
        this.state,
        this._ghosty,
        this._pipes,
        this._clouds,
        this._particles,
        this._popups,
        this._shake,
        this._scoreManager.score,
        this._scoreManager.highScore,
        timestamp
      );

      requestAnimationFrame(t => this._loop(t));
    }

    _update(elapsed, dtSec, timestamp) {
      // Advance Ghosty animation timers every frame regardless of state
      this._ghosty.updateTimers(elapsed);

      // Consume input once per frame
      const { flap, pause } = this._inputHandler.flush();

      // Pause toggle — only valid in PLAYING / PAUSED
      if (pause) {
        if (this.state === GameState.PLAYING)      this.transitionTo(GameState.PAUSED);
        else if (this.state === GameState.PAUSED)  this.transitionTo(GameState.PLAYING);
      }

      // Flap / state transitions
      if (flap) {
        if (this.state === GameState.MENU)           this.transitionTo(GameState.IDLE);
        else if (this.state === GameState.IDLE)      this.transitionTo(GameState.PLAYING);
        else if (this.state === GameState.PLAYING) {
          this._physicsEngine.flap(this._ghosty, this.state);
          this._ghosty.onFlap();
          this._audioManager.playFlap();
        }
        else if (this.state === GameState.GAME_OVER) this.transitionTo(GameState.MENU);
      }

      // Everything below only runs while actively playing
      if (this.state !== GameState.PLAYING) return;

      // Physics
      this._physicsEngine.update(this._ghosty, dtSec, this.state);

      // Pipe spawn timer
      this._pipeTimer += elapsed;
      if (this._pipeTimer >= CONFIG.pipes.spawnInterval) {
        this._pipes.push(spawnPipe(this._canvas.width, this._canvas.height));
        this._pipeTimer = 0;
      }

      // Cloud spawn timer (random interval between min/max)
      if (!this._nextCloudInterval) {
        this._nextCloudInterval = CONFIG.clouds.minInterval +
          Math.random() * (CONFIG.clouds.maxInterval - CONFIG.clouds.minInterval);
      }
      this._cloudTimer += elapsed;
      if (this._cloudTimer >= this._nextCloudInterval) {
        this._clouds.push(spawnCloud(this._canvas.width, this._canvas.height));
        this._cloudTimer = 0;
        this._nextCloudInterval = CONFIG.clouds.minInterval +
          Math.random() * (CONFIG.clouds.maxInterval - CONFIG.clouds.minInterval);
      }

      // Scroll obstacles and remove off-screen ones
      updateObstacles(this._pipes, this._clouds, dtSec);

      // Collision detection — triggers game over
      if (this._collisionDetector.check(this._ghosty, this._pipes, this._clouds, this._canvas.height)) {
        this.transitionTo(GameState.GAME_OVER);
        return;
      }

      // Scoring — checkPipes returns true when a pipe is newly passed
      if (this._scoreManager.checkPipes(this._pipes, this._ghosty)) {
        // Find the pipe that was just scored to place the popup
        const scoredPipe = this._pipes.find(p => p.scored && p.x + p.width < this._ghosty.x);
        if (scoredPipe) this._popups.push(createScorePopup(scoredPipe));
        this._audioManager.playScore();
      }

      // Emit one particle per frame from Ghosty's tail
      this._particles.push(emitParticle(this._ghosty));

      // Advance all visual effects
      updateEffects(this._particles, this._popups, this._shake, elapsed, dtSec);
    }

    transitionTo(newState) {
      const VALID = {
        [GameState.MENU]:      [GameState.IDLE],
        [GameState.IDLE]:      [GameState.PLAYING],
        [GameState.PLAYING]:   [GameState.PAUSED, GameState.GAME_OVER],
        [GameState.PAUSED]:    [GameState.PLAYING],
        [GameState.GAME_OVER]: [GameState.MENU],
      };
      if (!VALID[this.state] || !VALID[this.state].includes(newState)) return;

      const prev = this.state;
      this.state = newState;

      // Side-effects
      if (newState === GameState.PLAYING && prev === GameState.IDLE) {
        this._audioManager.startMusic();
        this._pipeTimer = 0;
      }
      if (newState === GameState.PLAYING && prev === GameState.PAUSED) {
        this._audioManager.resumeMusic();
      }
      if (newState === GameState.PAUSED) {
        this._audioManager.pauseMusic();
      }
      if (newState === GameState.GAME_OVER) {
        this._audioManager.stopMusic();
        this._audioManager.playGameOver();
        this._shake = { elapsed: 0, duration: CONFIG.effects.shakeDuration, intensity: CONFIG.effects.shakeIntensity };
        this._ghosty.onDeath();
        this._scoreManager.onGameOver();
      }
      if (newState === GameState.MENU) {
        this.reset();
      }
    }

    reset() {
      this._ghosty.reset(this._canvas.width, this._canvas.height);
      this._pipes.length     = 0;
      this._clouds.length    = 0;
      this._particles.length = 0;
      this._popups.length    = 0;
      this._shake      = null;
      this._pipeTimer          = 0;
      this._cloudTimer         = 0;
      this._nextCloudInterval  = null;
      this._scoreManager.reset();
    }
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.start();
  });

})();
