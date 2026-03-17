# Flappy Kiro — Domain Reference

## Game States

States are defined as a frozen enum. Never use raw strings for state comparisons.

```js
const GameState = Object.freeze({
  MENU:      'MENU',
  IDLE:      'IDLE',
  PLAYING:   'PLAYING',
  PAUSED:    'PAUSED',
  GAME_OVER: 'GAME_OVER',
});
```

### Valid Transitions

| From | To | Trigger |
|---|---|---|
| MENU | IDLE | Flap action |
| IDLE | PLAYING | Flap action |
| PLAYING | PAUSED | Escape / P key |
| PAUSED | PLAYING | Escape / P key |
| PLAYING | GAME_OVER | Collision detected |
| GAME_OVER | MENU | Flap action |

All other transitions are invalid and must be silently ignored in `transitionTo`.

### Side-Effects per Transition

Handle these exclusively inside `transitionTo(newState)`:

| Transition | Side-effects |
|---|---|
| → PLAYING (from IDLE) | Start background music, begin pipe spawn timer |
| → PLAYING (from PAUSED) | Resume background music |
| → PAUSED | Pause background music |
| → GAME_OVER | Stop background music, play game_over.wav, trigger screen shake, call `scoreManager.onGameOver()` |
| → MENU | Reset game (clear obstacles, reset Ghosty position, reset score) |

```js
transitionTo(newState) {
  // guard invalid transitions
  if (!isValidTransition(this.state, newState)) return;
  this.state = newState;
  // side-effects
  if (newState === GameState.PLAYING && this._prevState === GameState.IDLE) {
    this._audioManager.startMusic();
    this._pipeTimer = 0;
  }
  if (newState === GameState.PLAYING && this._prevState === GameState.PAUSED) {
    this._audioManager.resumeMusic();
  }
  if (newState === GameState.PAUSED)    this._audioManager.pauseMusic();
  if (newState === GameState.GAME_OVER) {
    this._audioManager.stopMusic();
    this._audioManager.playGameOver();
    this._shake = { elapsed: 0, duration: CONFIG.effects.shakeDuration, intensity: CONFIG.effects.shakeIntensity };
    this._scoreManager.onGameOver();
  }
  if (newState === GameState.MENU) this.reset();
}
```

## Score Persistence

High score is stored in `localStorage` under the key `'flappyKiroHighScore'`.

```js
const LS_KEY = 'flappyKiroHighScore';

// Load on init
load() {
  try {
    const val = localStorage.getItem(LS_KEY);
    this.highScore = val ? parseInt(val, 10) : 0;
  } catch (_) {
    this.highScore = 0; // private mode or quota exceeded
  }
}

// Persist whenever high score is beaten
_persist() {
  try {
    localStorage.setItem(LS_KEY, String(this.highScore));
  } catch (_) { /* silent — in-memory only for this session */ }
}

// Called on every score increment
checkPipes(pipes, ghosty) {
  for (const pipe of pipes) {
    if (!pipe.scored && ghosty.x + ghosty.width / 2 > pipe.x + pipe.width) {
      pipe.scored = true;
      this.score += 1;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        this._persist();
      }
      return true; // signal to caller: score changed this frame
    }
  }
  return false;
}

reset() { this.score = 0; }
```

## Difficulty Progression

The current spec uses fixed difficulty (no progression). Do not add difficulty scaling
unless explicitly requested. The relevant constants for future tuning are:

| Parameter | CONFIG key | Effect if increased |
|---|---|---|
| Pipe speed | `CONFIG.pipes.speed` | Faster scrolling, harder |
| Gap height | `CONFIG.pipes.gapHeight` | Smaller gap, harder |
| Pipe spacing | `CONFIG.pipes.spacing` | Less time between pipes, harder |
| Spawn interval | `CONFIG.pipes.spawnInterval` | More frequent pipes, harder |
| Gravity | `CONFIG.physics.gravity` | Faster fall, harder |

If difficulty progression is added in future, implement it as a multiplier applied to
these CONFIG values based on score milestones — never mutate CONFIG directly.

```js
// Example pattern for future use — NOT currently active
function getDifficultyMultiplier(score) {
  return 1 + Math.floor(score / 10) * 0.05; // +5% every 10 pipes
}
```

## Pipe Spawn Timing

Track elapsed time since last spawn; spawn when threshold is reached:

```js
// In Game.update(dtSec) while state === PLAYING
this._pipeTimer += elapsed; // elapsed in ms
if (this._pipeTimer >= CONFIG.pipes.spawnInterval) {
  this._pipes.push(spawnPipe(this._canvas.width, this._canvas.height));
  this._pipeTimer = 0;
}
```

## Input Handling Rules

- Flap is consumed once per frame via `InputHandler.flush()` — never process the same flap twice
- Flap during PAUSED state is suppressed (does not queue)
- Pause toggle (Escape/P) is only valid in PLAYING and PAUSED states — ignored in all others
- On GAME_OVER, flap transitions to MENU (not directly back to PLAYING)
- On MENU or IDLE, flap advances the state — does NOT also trigger a physics flap

```js
// In Game.update
const { flap, pause } = this._inputHandler.flush();

if (pause) {
  if (this.state === GameState.PLAYING) this.transitionTo(GameState.PAUSED);
  else if (this.state === GameState.PAUSED) this.transitionTo(GameState.PLAYING);
}

if (flap) {
  if (this.state === GameState.MENU)      this.transitionTo(GameState.IDLE);
  else if (this.state === GameState.IDLE) this.transitionTo(GameState.PLAYING);
  else if (this.state === GameState.PLAYING) {
    this._physicsEngine.flap(this._ghosty);
    this._audioManager.playFlap();
  }
  else if (this.state === GameState.GAME_OVER) this.transitionTo(GameState.MENU);
}
```

## Game Reset

`reset()` is called when transitioning to MENU. It must restore all mutable game state:

```js
reset() {
  // Ghosty position
  this._ghosty.x = this._canvas.width * 0.25;
  this._ghosty.y = this._canvas.height / 2 - 16;
  this._ghosty.vy = 0;
  // Clear obstacles and effects
  this._pipes.length = 0;
  this._clouds.length = 0;
  this._particles.length = 0;
  this._popups.length = 0;
  this._shake = null;
  // Timers
  this._pipeTimer = 0;
  this._cloudTimer = 0;
  // Score
  this._scoreManager.reset();
}
```
