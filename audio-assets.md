# Audio Assets Specification

## Overview

Flappy Kiro uses a hybrid audio approach:
- **File-based SFX**: `jump.wav` and `game_over.wav` from the `assets/` folder
- **Procedural SFX**: score chime generated via Web Audio API (no file needed)
- **Procedural music**: looping background melody via Web Audio API (no file needed)

All audio is managed by `AudioManager`, which initialises lazily on the first user gesture
to comply with browser autoplay policies.

---

## Sound Effects

### Flap Sound

- **Trigger**: Every flap/jump input
- **Source**: `assets/jump.wav` (existing asset)
- **Character**: Short whoosh — upward sweep
- **Duration**: ~0.1s
- **Playback**: Reset `currentTime = 0` before each `play()` to allow rapid re-triggering
- **Volume**: `CONFIG.audio.sfxVolume` (default 1.0)

### Score Sound

- **Trigger**: Each time Ghosty passes a pipe pair
- **Source**: Procedural — generated via Web Audio API
- **Character**: Pleasant chime — two-tone ascending ding
- **Duration**: ~0.2s
- **Web Audio implementation**:
  ```js
  // Short ascending chime: C5 → E5
  function playScoreSound(ctx) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, t);       // C5
    osc.frequency.setValueAtTime(659.25, t + 0.08); // E5
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.start(t);
    osc.stop(t + 0.2);
  }
  ```

### Collision Sound

- **Trigger**: On collision (pipe, cloud, or boundary)
- **Source**: `assets/game_over.wav` (existing asset)
- **Character**: Soft thud — low impact
- **Duration**: ~0.3s
- **Playback**: Reset `currentTime = 0` before `play()`; catch rejected promise silently
- **Volume**: `CONFIG.audio.sfxVolume` (default 1.0)

---

## Background Music

- **Trigger**: Starts when game transitions to Playing state
- **Source**: Procedural — Web Audio API oscillator sequence
- **Character**: Simple looping chiptune melody, upbeat and retro
- **Duration**: Loops indefinitely while in Playing state
- **Behaviour**:
  - Pauses when game enters Paused state
  - Resumes from pause point when returning to Playing
  - Stops on Game Over
- **Volume**: `CONFIG.audio.musicVolume` (default 0.4)
- **Web Audio implementation**: Two oscillators (square wave melody + triangle wave bass),
  scheduled note sequence looped via recursive `setTimeout` or a pre-scheduled buffer

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `jump.wav` fails to load | `play()` promise rejection caught silently; game continues without flap sound |
| `game_over.wav` fails to load | Same — silent fallback |
| `AudioContext` creation throws | Audio disabled for session; no crash |
| First gesture not yet received | All `AudioManager` calls are no-ops until context is initialised |
| Tab hidden / focus lost | Browser throttles audio automatically; no special handling needed |
