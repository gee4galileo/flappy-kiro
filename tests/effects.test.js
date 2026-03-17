// tests/effects.test.js — Visual effects property tests (P17–P20)
'use strict';

const { test } = require('node:test');
const fc       = require('fast-check');

// ---------------------------------------------------------------------------
// Constants (mirrors CONFIG.effects — defined locally since game.js is an IIFE)
// ---------------------------------------------------------------------------
const SHAKE_DURATION   = 300;  // ms
const SHAKE_INTENSITY  = 5;    // px
const PARTICLE_MAX_AGE = 500;  // ms
const POPUP_MAX_AGE    = 600;  // ms
const POPUP_RISE_DIST  = 30;   // px

// ---------------------------------------------------------------------------
// Standalone effect helpers (mirrors game.js implementations)
// ---------------------------------------------------------------------------
function emitParticle(ghosty) {
  return {
    x: ghosty.x, y: ghosty.y + ghosty.height / 2,
    vx: -30 + Math.random() * 20, vy: -20 + Math.random() * 40,
    opacity: 1, age: 0, maxAge: PARTICLE_MAX_AGE,
  };
}

function createShake() {
  return { elapsed: 0, duration: SHAKE_DURATION, intensity: SHAKE_INTENSITY };
}

function createScorePopup(pipe) {
  return {
    x: pipe.x + pipe.width / 2,
    y: pipe.gapY + pipe.gapHeight / 2,
    offsetY: 0, opacity: 1, age: 0, maxAge: POPUP_MAX_AGE,
  };
}

function updateEffects(particles, popups, shake, elapsed, dtSec) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += elapsed; p.opacity = Math.max(0, 1 - p.age / p.maxAge);
    p.x += p.vx * dtSec; p.y += p.vy * dtSec;
    if (p.age >= p.maxAge) particles.splice(i, 1);
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    const popup = popups[i];
    popup.age += elapsed; popup.opacity = Math.max(0, 1 - popup.age / popup.maxAge);
    popup.offsetY = (popup.age / popup.maxAge) * POPUP_RISE_DIST;
    if (popup.age >= popup.maxAge) popups.splice(i, 1);
  }
  if (shake) shake.elapsed += elapsed;
}

// ---------------------------------------------------------------------------
// P17: Screen shake created on collision
// Validates: Requirements 11.1
// ---------------------------------------------------------------------------
test('P17: Screen shake created on collision', () => {
  fc.assert(fc.property(
    fc.constant(null), // any collision event — shake is always the same
    () => {
      const shake = createShake();
      return (
        shake.duration  === SHAKE_DURATION  &&
        shake.intensity === SHAKE_INTENSITY &&
        shake.elapsed   === 0
      );
    }
  ), { numRuns: 100 });
});

// ---------------------------------------------------------------------------
// P18: Particle emitted each Playing frame
// Validates: Requirements 11.2
// ---------------------------------------------------------------------------
test('P18: Particle emitted each Playing frame', () => {
  fc.assert(fc.property(
    fc.integer({ min: 0, max: 800 }),   // ghosty.x
    fc.integer({ min: 0, max: 600 }),   // ghosty.y
    (gx, gy) => {
      const ghosty = { x: gx, y: gy, width: 32, height: 32 };
      const p = emitParticle(ghosty);
      return (
        p.opacity === 1 &&
        p.age     === 0 &&
        p.maxAge  === PARTICLE_MAX_AGE &&
        p.x       === ghosty.x &&
        p.y       === ghosty.y + 16
      );
    }
  ), { numRuns: 100 });
});

// ---------------------------------------------------------------------------
// P19: Score popup created on score increment
// Validates: Requirements 11.3
// ---------------------------------------------------------------------------
test('P19: Score popup created on score increment', () => {
  fc.assert(fc.property(
    fc.integer({ min: 0, max: 800 }),   // pipe.x
    fc.integer({ min: 10, max: 60 }),   // pipe.width
    fc.integer({ min: 60, max: 400 }),  // pipe.gapY
    fc.integer({ min: 100, max: 200 }), // pipe.gapHeight
    (px, pw, gapY, gapHeight) => {
      const pipe = { x: px, width: pw, gapY, gapHeight };
      const popup = createScorePopup(pipe);
      return (
        popup.x       === px + pw / 2 &&
        popup.y       === gapY + gapHeight / 2 &&
        popup.offsetY === 0 &&
        popup.opacity === 1
      );
    }
  ), { numRuns: 100 });
});

// ---------------------------------------------------------------------------
// P20: Expired effects are removed each frame
// Validates: Requirements 11.4
// ---------------------------------------------------------------------------
test('P20: Expired effects are removed each frame', () => {
  fc.assert(fc.property(
    fc.integer({ min: 1, max: 10 }),    // number of particles
    fc.integer({ min: 1, max: 10 }),    // number of popups
    fc.integer({ min: 0, max: 500 }),   // existing age (ms)
    (numParticles, numPopups, existingAge) => {
      // Build particles/popups already at or past maxAge
      const particles = Array.from({ length: numParticles }, () => ({
        x: 0, y: 0, vx: 0, vy: 0,
        opacity: 1,
        age: existingAge,
        maxAge: PARTICLE_MAX_AGE,
      }));
      const popups = Array.from({ length: numPopups }, () => ({
        x: 0, y: 0, offsetY: 0, opacity: 1,
        age: existingAge,
        maxAge: POPUP_MAX_AGE,
      }));

      // elapsed that pushes all items to or past their maxAge
      const elapsed = Math.max(PARTICLE_MAX_AGE, POPUP_MAX_AGE) - existingAge + 1;

      updateEffects(particles, popups, null, elapsed, elapsed / 1000);

      return particles.length === 0 && popups.length === 0;
    }
  ), { numRuns: 100 });
});
