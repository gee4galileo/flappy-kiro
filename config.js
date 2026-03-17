// config.js — all tunable game constants
// Edit values here to adjust game feel. Never hardcode these in game.js.
const CONFIG = Object.freeze({
  physics: Object.freeze({
    gravity:          800,  // px/s²
    jumpVelocity:    -300,  // px/s (upward)
    terminalVelocity: 600,  // px/s (downward)
    maxDeltaTime:      50,  // ms — cap to prevent tunneling on tab switch
  }),
  pipes: Object.freeze({
    speed:         120,   // px/s
    width:          60,   // px
    gapHeight:     140,   // px
    spacing:       350,   // px between pipe pairs
    spawnInterval: 1800,  // ms
  }),
  clouds: Object.freeze({
    speed:       60,    // px/s
    minInterval: 2000,  // ms
    maxInterval: 5000,  // ms
    minWidth:     80,   // px
    maxWidth:    140,   // px
    minHeight:    40,   // px
    maxHeight:    60,   // px
  }),
  effects: Object.freeze({
    shakeIntensity:    5,    // px max offset
    shakeDuration:   300,   // ms
    particleMaxAge:  500,   // ms
    popupMaxAge:     600,   // ms
    popupRiseDistance: 30,  // px
  }),
  audio: Object.freeze({
    musicVolume: 0.4,
    sfxVolume:   1.0,
  }),
  ghosty: Object.freeze({
    width:       32,  // px
    height:      32,  // px
    hitboxRadius: 12, // px (circular hitbox)
    startXRatio: 0.25, // fraction of canvas width
  }),
});
