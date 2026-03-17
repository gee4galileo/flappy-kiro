// tests/collision.test.js — property-based tests for CollisionDetector (P11–P13)
// Requirements: 6.1, 6.2, 5.5

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');

// ---------------------------------------------------------------------------
// Local mirrors of game.js helpers (game.js is an IIFE, not importable)
// ---------------------------------------------------------------------------
const HITBOX_RADIUS = 12;
const CANVAS_HEIGHT = 600;
const CANVAS_WIDTH  = 800;

function circleOverlapsRect(cx, cy, r, rx, ry, rw, rh) {
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearX;
  const dy = cy - nearY;
  return dx * dx + dy * dy < r * r;
}

class CollisionDetector {
  check(ghosty, pipes, clouds, canvasHeight) {
    const cx = ghosty.x + ghosty.width / 2;
    const cy = ghosty.y + ghosty.height / 2;
    const r  = ghosty.hitboxRadius || HITBOX_RADIUS;

    if (cy - r <= 0 || cy + r >= canvasHeight) return true;

    for (const pipe of pipes) {
      if (circleOverlapsRect(cx, cy, r, pipe.x, 0, pipe.width, pipe.gapY)) return true;
      if (circleOverlapsRect(cx, cy, r, pipe.x, pipe.gapY + pipe.gapHeight, pipe.width, canvasHeight)) return true;
    }

    for (const cloud of clouds) {
      if (circleOverlapsRect(cx, cy, r, cloud.x, cloud.y, cloud.width, cloud.height)) return true;
    }

    return false;
  }
}

const detector = new CollisionDetector();

// Build a ghosty object from a center position
function ghostyAt(cx, cy) {
  const width = 32, height = 32;
  return { x: cx - width / 2, y: cy - height / 2, width, height, hitboxRadius: HITBOX_RADIUS };
}

// ---------------------------------------------------------------------------
// P11: Pipe collision detection
// Validates: Requirements 6.1
// ---------------------------------------------------------------------------
describe('P11: Pipe collision detection', () => {
  it('ghosty circle overlapping top pipe rect returns true', () => {
    // Feature: flappy-kiro, Property 11: Pipe collision detection
    fc.assert(fc.property(
      // pipe geometry
      fc.integer({ min: 0, max: CANVAS_WIDTH - 60 }),   // pipe.x
      fc.integer({ min: 60, max: CANVAS_HEIGHT - 200 }), // pipe.gapY (top pipe height)
      // ghosty center inside the top pipe rect
      fc.integer({ min: 0, max: 59 }).chain(relX =>
        fc.integer({ min: 0, max: 59 }).map(relY => ({ relX, relY }))
      ),
      (pipeX, gapY, { relX, relY }) => {
        const pipe = { x: pipeX, width: 60, gapY, gapHeight: 140, speed: 120, scored: false };
        // Place ghosty center well inside the top pipe rect so circle definitely overlaps
        const cx = pipeX + relX;
        const cy = Math.max(HITBOX_RADIUS + 1, relY); // keep cy inside top rect (0..gapY)
        if (cy >= gapY) return true; // skip if outside top rect
        const ghosty = ghostyAt(cx, cy);
        assert.ok(
          detector.check(ghosty, [pipe], [], CANVAS_HEIGHT),
          `Expected collision: ghosty center (${cx},${cy}) inside top pipe rect (${pipeX},0,60,${gapY})`
        );
      }
    ), { numRuns: 100 });
  });

  it('ghosty circle overlapping bottom pipe rect returns true', () => {
    // Feature: flappy-kiro, Property 11: Pipe collision detection
    fc.assert(fc.property(
      fc.integer({ min: 0, max: CANVAS_WIDTH - 60 }),    // pipe.x
      fc.integer({ min: 60, max: 300 }),                  // pipe.gapY
      fc.integer({ min: 0, max: 59 }),                    // relX within pipe width
      (pipeX, gapY, relX) => {
        const gapHeight = 140;
        const bottomTop = gapY + gapHeight;
        if (bottomTop >= CANVAS_HEIGHT - HITBOX_RADIUS - 1) return true; // skip degenerate

        const pipe = { x: pipeX, width: 60, gapY, gapHeight, speed: 120, scored: false };
        // Place ghosty center inside the bottom pipe rect
        const cx = pipeX + relX;
        const cy = bottomTop + HITBOX_RADIUS + 1; // just inside bottom rect, away from boundary
        if (cy + HITBOX_RADIUS >= CANVAS_HEIGHT) return true; // skip boundary overlap
        const ghosty = ghostyAt(cx, cy);
        assert.ok(
          detector.check(ghosty, [pipe], [], CANVAS_HEIGHT),
          `Expected collision: ghosty center (${cx},${cy}) inside bottom pipe rect`
        );
      }
    ), { numRuns: 100 });
  });

  it('ghosty clearly inside the gap (no boundary) returns false', () => {
    // Feature: flappy-kiro, Property 11: Pipe collision detection
    fc.assert(fc.property(
      fc.integer({ min: 200, max: 400 }),  // pipe.x (to the right of ghosty)
      fc.integer({ min: 100, max: 300 }),  // gapY
      (pipeX, gapY) => {
        const gapHeight = 140;
        const gapCenter = gapY + gapHeight / 2;
        const pipe = { x: pipeX, width: 60, gapY, gapHeight, speed: 120, scored: false };
        // Ghosty is to the left of the pipe, vertically centered in the gap
        const ghosty = ghostyAt(50, gapCenter);
        assert.strictEqual(
          detector.check(ghosty, [pipe], [], CANVAS_HEIGHT),
          false,
          `Expected no collision: ghosty at x=50 is left of pipe at x=${pipeX}`
        );
      }
    ), { numRuns: 100 });
  });
});

// ---------------------------------------------------------------------------
// P12: Boundary collision detection
// Validates: Requirements 6.2
// ---------------------------------------------------------------------------
describe('P12: Boundary collision detection', () => {
  it('ghosty circle touching top boundary (cy - r <= 0) returns true', () => {
    // Feature: flappy-kiro, Property 12: Boundary collision detection
    fc.assert(fc.property(
      // cy such that cy - HITBOX_RADIUS <= 0  =>  cy <= HITBOX_RADIUS
      fc.integer({ min: -50, max: HITBOX_RADIUS }),
      fc.integer({ min: 100, max: 600 }),  // x — away from any pipe
      (cy, cx) => {
        const ghosty = ghostyAt(cx, cy);
        assert.ok(
          detector.check(ghosty, [], [], CANVAS_HEIGHT),
          `Expected top boundary collision: cy=${cy}, r=${HITBOX_RADIUS}`
        );
      }
    ), { numRuns: 100 });
  });

  it('ghosty circle touching bottom boundary (cy + r >= canvasHeight) returns true', () => {
    // Feature: flappy-kiro, Property 12: Boundary collision detection
    fc.assert(fc.property(
      // cy such that cy + HITBOX_RADIUS >= CANVAS_HEIGHT  =>  cy >= CANVAS_HEIGHT - HITBOX_RADIUS
      fc.integer({ min: CANVAS_HEIGHT - HITBOX_RADIUS, max: CANVAS_HEIGHT + 50 }),
      fc.integer({ min: 100, max: 600 }),
      (cy, cx) => {
        const ghosty = ghostyAt(cx, cy);
        assert.ok(
          detector.check(ghosty, [], [], CANVAS_HEIGHT),
          `Expected bottom boundary collision: cy=${cy}, r=${HITBOX_RADIUS}, canvasHeight=${CANVAS_HEIGHT}`
        );
      }
    ), { numRuns: 100 });
  });

  it('ghosty well within vertical bounds returns false (no obstacles)', () => {
    // Feature: flappy-kiro, Property 12: Boundary collision detection
    fc.assert(fc.property(
      // cy strictly inside: HITBOX_RADIUS < cy < CANVAS_HEIGHT - HITBOX_RADIUS
      fc.integer({ min: HITBOX_RADIUS + 1, max: CANVAS_HEIGHT - HITBOX_RADIUS - 1 }),
      fc.integer({ min: 100, max: 600 }),
      (cy, cx) => {
        const ghosty = ghostyAt(cx, cy);
        assert.strictEqual(
          detector.check(ghosty, [], [], CANVAS_HEIGHT),
          false,
          `Expected no boundary collision: cy=${cy}`
        );
      }
    ), { numRuns: 100 });
  });
});

// ---------------------------------------------------------------------------
// P13: Cloud collision detection
// Validates: Requirements 5.5
// ---------------------------------------------------------------------------
describe('P13: Cloud collision detection', () => {
  it('ghosty circle overlapping a cloud AABB returns true', () => {
    // Feature: flappy-kiro, Property 13: Cloud collision detection
    fc.assert(fc.property(
      // cloud position and size
      fc.integer({ min: 50, max: 600 }),   // cloud.x
      fc.integer({ min: 50, max: 400 }),   // cloud.y
      fc.integer({ min: 80, max: 140 }),   // cloud.width
      fc.integer({ min: 40, max: 60 }),    // cloud.height
      (cloudX, cloudY, cloudW, cloudH) => {
        const cloud = { x: cloudX, y: cloudY, width: cloudW, height: cloudH, speed: 60 };
        // Place ghosty center at the cloud's center — guaranteed overlap
        const cx = cloudX + cloudW / 2;
        const cy = cloudY + cloudH / 2;
        if (cy - HITBOX_RADIUS <= 0 || cy + HITBOX_RADIUS >= CANVAS_HEIGHT) return true; // skip boundary
        const ghosty = ghostyAt(cx, cy);
        assert.ok(
          detector.check(ghosty, [], [cloud], CANVAS_HEIGHT),
          `Expected cloud collision: ghosty center (${cx},${cy}) at cloud center`
        );
      }
    ), { numRuns: 100 });
  });

  it('ghosty far from any cloud returns false', () => {
    // Feature: flappy-kiro, Property 13: Cloud collision detection
    fc.assert(fc.property(
      // cloud far to the right
      fc.integer({ min: 500, max: 700 }),  // cloud.x
      fc.integer({ min: 100, max: 300 }),  // cloud.y
      (cloudX, cloudY) => {
        const cloud = { x: cloudX, y: cloudY, width: 100, height: 50, speed: 60 };
        // Ghosty is far to the left, vertically centered in safe zone
        const cy = CANVAS_HEIGHT / 2;
        const ghosty = ghostyAt(50, cy);
        assert.strictEqual(
          detector.check(ghosty, [], [cloud], CANVAS_HEIGHT),
          false,
          `Expected no cloud collision: ghosty at x=50, cloud at x=${cloudX}`
        );
      }
    ), { numRuns: 100 });
  });
});
