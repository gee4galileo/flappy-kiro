# UI Mockups — Flappy Kiro

All UI is rendered on the HTML5 Canvas. No DOM elements are used for game UI.
Overlays are drawn on top of the game canvas using `ctx` calls each frame.

---

## Canvas Layout

```
┌─────────────────────────────────────────┐
│                                         │  ← game area (full viewport)
│           [game content]                │
│                                         │
├─────────────────────────────────────────┤
│  Score: X  |  Best: X                   │  ← HUD bar (40px tall, bottom)
└─────────────────────────────────────────┘
```

- Canvas fills the full browser viewport
- HUD bar is always 40px tall, pinned to the bottom edge
- All overlays (menu, pause, game over) are centered in the game area above the HUD

---

## Screen 1 — Main Menu (MENU state)

```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│           👻  Flappy Kiro               │  ← title, large retro font, white
│                                         │
│              Best: 0                    │  ← high score, smaller font, white
│                                         │
│        Tap or press Space               │  ← prompt, pulsing opacity animation
│             to start                    │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│  Score: 0  |  Best: 0                   │
└─────────────────────────────────────────┘
```

- Background: light-blue sketchy fill
- Ghosty bobs gently (idle animation) at 25% x, vertically centered
- Title: 36px retro font, white, centered horizontally at ~35% canvas height
- Best score: 18px, white, centered, below title
- Prompt: 16px, white, centered, pulses between opacity 0.4–1.0 on a 1.2s cycle
- No buttons — any tap, click, or Space transitions to IDLE state

---

## Screen 2 — Idle (IDLE state)

```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│                                         │
│        Tap or press Space               │  ← prompt only, centered
│             to start                    │
│                                         │
│    👻                                   │  ← Ghosty bobbing, no pipes yet
│                                         │
│                                         │
├─────────────────────────────────────────┤
│  Score: 0  |  Best: X                   │
└─────────────────────────────────────────┘
```

- Same background, no obstacles moving
- Prompt remains visible until first flap
- First flap transitions to PLAYING and removes the prompt

---

## Screen 3 — In-Game HUD (PLAYING state)

```
┌─────────────────────────────────────────┐
│  ║║║║                        ║║║║       │  ← pipes
│  ║║║║                        ║║║║       │
│                                         │
│              👻                         │  ← Ghosty mid-flight
│                                         │
│  ║║║║                        ║║║║       │
│  ║║║║                        ║║║║       │
├─────────────────────────────────────────┤
│  Score: 3  |  Best: 7                   │  ← live score, updates each pipe pass
└─────────────────────────────────────────┘
```

- No overlay — full game view
- HUD bar: dark fill (#1a1a2e or similar), 40px tall
- HUD text: "Score: X | Best: X", 18px retro font, white, centered in bar
- Score popups: "+1" floats up from pipe gap center, fades over 600ms
- Particle trail: small white dots trail behind Ghosty

---

## Screen 4 — Paused (PAUSED state)

```
┌─────────────────────────────────────────┐
│                                         │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
│   ░░                                ░░  │  ← semi-transparent dark overlay
│   ░░           PAUSED               ░░  │  ← 28px retro font, white, centered
│   ░░                                ░░  │
│   ░░    Press Esc or P to resume    ░░  │  ← 14px, white, centered
│   ░░                                ░░  │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
│                                         │
├─────────────────────────────────────────┤
│  Score: 3  |  Best: 7                   │
└─────────────────────────────────────────┘
```

- Game frozen behind overlay (pipes, Ghosty, clouds all static)
- Overlay: rounded rect, rgba(0,0,0,0.55), centered, ~320x160px
- "PAUSED": 28px retro font, white
- Resume hint: 14px, white, below title

---

## Screen 5 — Game Over (GAME_OVER state)

```
┌─────────────────────────────────────────┐
│                                         │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
│   ░░                                ░░  │
│   ░░         GAME OVER              ░░  │  ← 32px retro font, white
│   ░░                                ░░  │
│   ░░          Score: 3              ░░  │  ← final score, 20px
│   ░░           Best: 7              ░░  │  ← high score, 16px
│   ░░                                ░░  │
│   ░░   Tap or Space to restart      ░░  │  ← 14px, pulsing
│   ░░                                ░░  │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
│                                         │
├─────────────────────────────────────────┤
│  Score: 3  |  Best: 7                   │
└─────────────────────────────────────────┘
```

- Screen shake plays first (~300ms), then overlay appears
- Ghosty tumbles and fades (death animation) behind overlay
- Overlay: rounded rect, rgba(0,0,0,0.65), centered, ~320x220px
- "GAME OVER": 32px retro font, white — if new high score, add "New Best!" in gold below
- Final score: 20px, white
- Best score: 16px, white (gold if new record)
- Restart prompt: 14px, white, pulsing opacity

---

## Typography

| Element | Size | Font | Color |
|---|---|---|---|
| Game title | 36px | retro/pixel (e.g. `'Courier New', monospace`) | white |
| GAME OVER / PAUSED | 28–32px | same | white |
| Score / Best labels | 18–20px | same | white |
| Prompts / hints | 14–16px | same | white |
| New Best indicator | 18px | same | gold (#FFD700) |
| HUD bar text | 18px | same | white |

---

## Colors

| Element | Value |
|---|---|
| Background | `#87CEEB` (light blue) with sketchy overlay |
| HUD bar | `#1a1a2e` |
| Overlay background | `rgba(0, 0, 0, 0.55–0.65)` |
| Pipes | `#2d8a2d` (green) with darker outline |
| Clouds | `rgba(255, 255, 255, 0.85)` |
| Text | `#ffffff` |
| New Best text | `#FFD700` |
| Particles | `rgba(255, 255, 255, 0.6)` |
