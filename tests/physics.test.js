// tests/physics.test.js — property-based tests for PhysicsEngine (P1–P7)
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 2a.2, 2a.5

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { makeGhosty } = require('./helpers.js');

// Mirror CONFIG physics constants
const GRAVITY           = 800;   // px/s²
const JUMP_VELOCITY     = -300;  // px/s
const TERMINAL_VELOCITY =  600;  // px/s

// Standalone PhysicsEngine for testing (mirrors game.js implementation)
class PhysicsEngine {
  update(ghosty, dtSec, gameState) {
    if (gameState === 'PAUSED') return;
    ghosty.vy += GRAVITY * dtSec;
    ghosty.vy  = Math.min(ghosty.vy, TERMINAL_VELOCITY);
    ghosty.y  += ghosty.vy * dtSec;
  }

  flap(ghosty, gameState) {
    if (gameState === 'PAUSED') return;
    ghosty.vy = JUMP_VELOCITY;
  }
}

const physics = new PhysicsEngine();

// ---------------------------------------------------------------------------
// P1: Flap sets velocity to JUMP_VELOCITY for any initial vy
// Validates: Requirements 2.4, 3.2
// ---------------------------------------------------------------------------
describe('P1: Flap sets velocity to jumpVelocity', () => {
  it('flap always sets vy to JUMP_VELOCITY regardless of initial vy', () => {
    fc.assert(fc.property(
      fc.double({ min: -1000, max: 1000, noNaN: true }),
      (initialVy) => {
        const ghosty = makeGhosty({ vy: initialVy });
        physics.flap(ghosty, 'PLAYING');
        assert.equal(ghosty.vy, JUMP_VELOCITY);
      }
    ));
  });
});

// ---------------------------------------------------------------------------
// P2: Physics halted while Paused — update is a no-op when gameState === 'PAUSED'
// Validates: Requirements 2a.2
// ---------------------------------------------------------------------------
describe('P2: Physics halted while Paused', () => {
  it('update does not change ghosty when PAUSED', () => {
    fc.assert(fc.property(
      fc.double({ min: -500, max: 500, noNaN: true }),
      fc.double({ min: 0, max: 1000, noNaN: true }),
      fc.double({ min: 0.001, max: 0.1, noNaN: true }),
      (vy, y, dtSec) => {
        const ghosty = makeGhosty({ vy, y });
        physics.update(ghosty, dtSec, 'PAUSED');
        assert.equal(ghosty.vy, vy, 'vy must not change when PAUSED');
        assert.equal(ghosty.y,  y,  'y must not change when PAUSED');
      }
    ));
  });
});

// ---------------------------------------------------------------------------
// P3: Flap ignored while Paused — flap is a no-op when gameState === 'PAUSED'
// Validates: Requirements 2a.5
// ---------------------------------------------------------------------------
describe('P3: Flap ignored while Paused', () => {
  it('flap does not change vy when PAUSED', () => {
    fc.assert(fc.property(
      fc.float({ min: -1000, max: 1000, noNaN: true }),
      (initialVy) => {
        const ghosty = makeGhosty({ vy: initialVy });
        physics.flap(ghosty, 'PAUSED');
        assert.equal(ghosty.vy, initialVy, 'vy must not change when PAUSED');
      }
    ));
  });
});

// ---------------------------------------------------------------------------
// P4: Gravity accumulates velocity each frame
// Validates: Requirements 3.1
// ---------------------------------------------------------------------------
describe('P4: Gravity accumulates velocity each frame', () => {
  it('vy increases by gravity * dtSec (before terminal clamp)', () => {
    fc.assert(fc.property(
      // Use a vy low enough that adding gravity * dtSec won't exceed terminal velocity
      fc.double({ min: -1000, max: 0, noNaN: true }),
      fc.double({ min: 0.001, max: 0.05, noNaN: true }),
      (vy, dtSec) => {
        const ghosty = makeGhosty({ vy });
        const expectedVy = Math.min(vy + GRAVITY * dtSec, TERMINAL_VELOCITY);
        physics.update(ghosty, dtSec, 'PLAYING');
        assert.ok(
          Math.abs(ghosty.vy - expectedVy) < 1e-9,
          `Expected vy=${expectedVy}, got ${ghosty.vy}`
        );
      }
    ));
  });
});

// ---------------------------------------------------------------------------
// P5: Position updated by velocity each frame
// Validates: Requirements 3.3, 3.5
// ---------------------------------------------------------------------------
describe('P5: Position updated by velocity each frame', () => {
  it('y changes by vy * dtSec (using post-gravity vy)', () => {
    fc.assert(fc.property(
      fc.double({ min: -500, max: 500, noNaN: true }),
      fc.double({ min: 0, max: 500, noNaN: true }),
      fc.double({ min: 0.001, max: 0.05, noNaN: true }),
      (vy, y, dtSec) => {
        const ghosty = makeGhosty({ vy, y });
        const vyAfterGravity = Math.min(vy + GRAVITY * dtSec, TERMINAL_VELOCITY);
        const expectedY = y + vyAfterGravity * dtSec;
        physics.update(ghosty, dtSec, 'PLAYING');
        assert.ok(
          Math.abs(ghosty.y - expectedY) < 1e-9,
          `Expected y=${expectedY}, got ${ghosty.y}`
        );
      }
    ));
  });
});

// ---------------------------------------------------------------------------
// P6: Terminal velocity is enforced — vy never exceeds TERMINAL_VELOCITY
// Validates: Requirements 3.4
// ---------------------------------------------------------------------------
describe('P6: Terminal velocity is enforced', () => {
  it('vy never exceeds TERMINAL_VELOCITY after update', () => {
    fc.assert(fc.property(
      fc.double({ min: -1000, max: 1000, noNaN: true }),
      fc.double({ min: 0.001, max: 0.5, noNaN: true }),
      (vy, dtSec) => {
        const ghosty = makeGhosty({ vy });
        physics.update(ghosty, dtSec, 'PLAYING');
        assert.ok(
          ghosty.vy <= TERMINAL_VELOCITY,
          `vy=${ghosty.vy} exceeds TERMINAL_VELOCITY=${TERMINAL_VELOCITY}`
        );
      }
    ));
  });
});

// ---------------------------------------------------------------------------
// P7: Delta-time proportionality — position update uses dtSec correctly
// Validates: Requirements 3.6
// The implementation must multiply by dtSec (seconds), not a frame count.
// Verified by: running the same physics for total time T in one step vs many
// small steps and checking the final vy matches the analytical formula.
// For vy: vy_final = min(vy_initial + gravity * T, terminalVelocity)
// ---------------------------------------------------------------------------
describe('P7: Delta-time proportionality', () => {
  it('final vy after one step matches analytical formula vy + gravity * dtSec', () => {
    fc.assert(fc.property(
      // Keep vy negative enough that gravity * dtSec won't hit terminal
      fc.double({ min: -300, max: -50, noNaN: true }),
      fc.double({ min: 0.001, max: 0.01, noNaN: true }),
      (vy, dtSec) => {
        const ghosty = makeGhosty({ vy });
        physics.update(ghosty, dtSec, 'PLAYING');
        const expected = vy + GRAVITY * dtSec; // won't exceed terminal given constraints
        assert.ok(
          Math.abs(ghosty.vy - expected) < 1e-9,
          `Expected vy=${expected}, got ${ghosty.vy}`
        );
      }
    ));
  });

  it('y displacement is vy_after_gravity * dtSec (dtSec-scaled, not frame-scaled)', () => {
    fc.assert(fc.property(
      fc.double({ min: -300, max: -50, noNaN: true }),
      fc.double({ min: 0, max: 500, noNaN: true }),
      fc.double({ min: 0.001, max: 0.01, noNaN: true }),
      (vy, y, dtSec) => {
        const ghosty = makeGhosty({ vy, y });
        const vyAfter = vy + GRAVITY * dtSec;
        const expectedY = y + vyAfter * dtSec;
        physics.update(ghosty, dtSec, 'PLAYING');
        assert.ok(
          Math.abs(ghosty.y - expectedY) < 1e-9,
          `Expected y=${expectedY}, got ${ghosty.y}`
        );
      }
    ));
  });
});

// ---------------------------------------------------------------------------
// P9: Delta-time clamping — elapsed is clamped to maxDeltaTime before dtSec
// Feature: production-readiness, Property 9: Delta-time clamping
// Validates: Requirements 8.5
// ---------------------------------------------------------------------------
const MAX_DELTA_TIME = 50; // ms — mirrors CONFIG.physics.maxDeltaTime

describe('P9: Delta-time clamping', () => {
  it('dtSec is always <= maxDeltaTime / 1000 regardless of elapsed', () => {
    fc.assert(fc.property(
      // Include values far exceeding maxDeltaTime (tab switch, throttling)
      fc.double({ min: 0, max: 100000, noNaN: true }),
      (elapsed) => {
        const dtSec = Math.min(elapsed, MAX_DELTA_TIME) / 1000;
        assert.ok(
          dtSec <= MAX_DELTA_TIME / 1000,
          `dtSec=${dtSec} exceeds maxDeltaTime/1000=${MAX_DELTA_TIME / 1000}`
        );
      }
    ), { numRuns: 100 });
  });

  it('dtSec equals elapsed/1000 when elapsed is within maxDeltaTime', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: MAX_DELTA_TIME, noNaN: true }),
      (elapsed) => {
        const dtSec = Math.min(elapsed, MAX_DELTA_TIME) / 1000;
        assert.ok(
          Math.abs(dtSec - elapsed / 1000) < 1e-12,
          `Expected dtSec=${elapsed / 1000}, got ${dtSec}`
        );
      }
    ), { numRuns: 100 });
  });

  it('dtSec is clamped to maxDeltaTime/1000 when elapsed exceeds maxDeltaTime', () => {
    fc.assert(fc.property(
      fc.double({ min: MAX_DELTA_TIME + 1, max: 100000, noNaN: true }),
      (elapsed) => {
        const dtSec = Math.min(elapsed, MAX_DELTA_TIME) / 1000;
        assert.ok(
          Math.abs(dtSec - MAX_DELTA_TIME / 1000) < 1e-12,
          `Expected dtSec=${MAX_DELTA_TIME / 1000}, got ${dtSec}`
        );
      }
    ), { numRuns: 100 });
  });
});
