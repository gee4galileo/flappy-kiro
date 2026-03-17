// tests/score.test.js — ScoreManager property tests (P14–P16) and unit tests
'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const fc       = require('fast-check');

// ---------------------------------------------------------------------------
// Mock localStorage for Node.js testing
// ---------------------------------------------------------------------------
let _store = {};
const mockLocalStorage = {
  getItem:    (k)    => _store[k] !== undefined ? _store[k] : null,
  setItem:    (k, v) => { _store[k] = String(v); },
  clear:      ()     => { _store = {}; },
  removeItem: (k)    => { delete _store[k]; },
};

function resetStore() { _store = {}; }

// ---------------------------------------------------------------------------
// Standalone ScoreManager (mirrors game.js implementation, injectable storage)
// ---------------------------------------------------------------------------
class ScoreManager {
  constructor(storage = mockLocalStorage) {
    this.score     = 0;
    this.highScore = 0;
    this._storage  = storage;
  }

  load() {
    try {
      const val = this._storage.getItem('flappyKiroHighScore');
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

  reset() { this.score = 0; }

  _persist() {
    try {
      this._storage.setItem('flappyKiroHighScore', String(this.highScore));
    } catch (_) {}
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeGhosty({ x = 100, width = 32 } = {}) {
  return { x, width };
}

function makePipe({ x = 0, width = 60, scored = false } = {}) {
  return { x, width, scored };
}

// ---------------------------------------------------------------------------
// P14: High score persistence round-trip
// Feature: flappy-kiro, Property 14: High score persistence round-trip
// Validates: Requirements 6.6, 6.7, 7.2, 7.5
// ---------------------------------------------------------------------------
test('P14: High score persistence round-trip', () => {
  fc.assert(fc.property(
    fc.integer({ min: 1, max: 1000 }),   // score to set
    fc.integer({ min: 0, max: 0 }),      // initial highScore (start at 0)
    (score) => {
      resetStore();
      const sm = new ScoreManager(mockLocalStorage);
      sm.score     = score;
      sm.highScore = 0; // ensure score > highScore
      sm.onGameOver();

      // New manager loads from storage — should see the persisted high score
      const sm2 = new ScoreManager(mockLocalStorage);
      sm2.load();
      return sm2.highScore === score;
    }
  ), { numRuns: 100 });
});

// ---------------------------------------------------------------------------
// P15: Score increments on pipe pass
// Feature: flappy-kiro, Property 15: Score increments on pipe pass
// Validates: Requirements 7.1
// ---------------------------------------------------------------------------
test('P15: Score increments on pipe pass', () => {
  fc.assert(fc.property(
    fc.integer({ min: 0, max: 500 }),    // ghosty.x
    fc.integer({ min: 32, max: 32 }),    // ghosty.width (fixed)
    fc.integer({ min: 0, max: 400 }),    // pipe.x
    fc.integer({ min: 10, max: 60 }),    // pipe.width
    (gx, gw, px, pw) => {
      // Only test the case where ghosty center x > pipe.x + pipe.width
      const ghostyCenterX = gx + gw / 2;
      const pipeRight     = px + pw;
      if (ghostyCenterX <= pipeRight) return true; // skip non-passing case

      resetStore();
      const sm    = new ScoreManager(mockLocalStorage);
      const pipe  = makePipe({ x: px, width: pw, scored: false });
      const ghosty = makeGhosty({ x: gx, width: gw });

      const before = sm.score;
      const result = sm.checkPipes([pipe], ghosty);

      return result === true && sm.score === before + 1 && pipe.scored === true;
    }
  ), { numRuns: 100 });
});

// ---------------------------------------------------------------------------
// P16: Score resets to zero on game reset
// Feature: flappy-kiro, Property 16: Score resets to zero on game reset
// Validates: Requirements 7.4
// ---------------------------------------------------------------------------
test('P16: Score resets to zero on game reset', () => {
  fc.assert(fc.property(
    fc.integer({ min: 0, max: 10000 }),  // any score value
    (score) => {
      resetStore();
      const sm = new ScoreManager(mockLocalStorage);
      sm.score = score;
      sm.reset();
      return sm.score === 0;
    }
  ), { numRuns: 100 });
});

// ---------------------------------------------------------------------------
// Unit tests (7.4)
// ---------------------------------------------------------------------------

test('score does not double-increment for the same pipe (pipe.scored guard)', () => {
  resetStore();
  const sm     = new ScoreManager(mockLocalStorage);
  // Ghosty center x = 100 + 16 = 116; pipe right = 0 + 60 = 60 → passes
  const pipe   = makePipe({ x: 0, width: 60, scored: false });
  const ghosty = makeGhosty({ x: 100, width: 32 });

  sm.checkPipes([pipe], ghosty);
  assert.equal(sm.score, 1);
  assert.equal(pipe.scored, true);

  // Call again — pipe.scored is now true, should not increment
  sm.checkPipes([pipe], ghosty);
  assert.equal(sm.score, 1);
});

test('high score is not overwritten when current score is lower', () => {
  resetStore();
  const sm = new ScoreManager(mockLocalStorage);
  sm.highScore = 10;
  sm.score     = 5;
  sm.onGameOver();
  assert.equal(sm.highScore, 10); // unchanged
});

test('localStorage fallback: ScoreManager behaves correctly when localStorage throws', () => {
  const throwingStorage = {
    getItem:  () => { throw new Error('storage unavailable'); },
    setItem:  () => { throw new Error('storage unavailable'); },
  };

  const sm = new ScoreManager(throwingStorage);
  // load() should default to 0 on error
  sm.load();
  assert.equal(sm.highScore, 0);

  // _persist() should be silent on error — no throw
  sm.score     = 5;
  sm.highScore = 0;
  assert.doesNotThrow(() => sm.onGameOver());
  assert.equal(sm.highScore, 5); // in-memory update still happens
});
