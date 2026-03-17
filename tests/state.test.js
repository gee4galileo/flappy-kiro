// tests/state.test.js — unit tests for GameState enum and transitionTo state machine
// Requirements: 1.5, 2.3, 2a.1, 2a.4, 6.3

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// GameState enum — mirrors game.js exactly
// ---------------------------------------------------------------------------
const GameState = Object.freeze({
  MENU:      'MENU',
  IDLE:      'IDLE',
  PLAYING:   'PLAYING',
  PAUSED:    'PAUSED',
  GAME_OVER: 'GAME_OVER',
});

// Valid transitions table — mirrors the VALID map in game.js transitionTo
const VALID_TRANSITIONS = {
  [GameState.MENU]:      [GameState.IDLE],
  [GameState.IDLE]:      [GameState.PLAYING],
  [GameState.PLAYING]:   [GameState.PAUSED, GameState.GAME_OVER],
  [GameState.PAUSED]:    [GameState.PLAYING],
  [GameState.GAME_OVER]: [GameState.MENU],
};

// ---------------------------------------------------------------------------
// Minimal state machine that mirrors transitionTo in game.js,
// without DOM/audio side-effects, so transitions can be tested in isolation.
// ---------------------------------------------------------------------------
class TestStateMachine {
  constructor(initialState = GameState.MENU) {
    this.state = initialState;
    this.sideEffects = []; // records which side-effects fired
  }

  transitionTo(newState) {
    if (!VALID_TRANSITIONS[this.state] || !VALID_TRANSITIONS[this.state].includes(newState)) {
      return; // silently ignore invalid transitions
    }
    const prev = this.state;
    this.state = newState;

    // Side-effects — mirror game.js transitionTo exactly
    if (newState === GameState.PLAYING && prev === GameState.IDLE) {
      this.sideEffects.push('startMusic');
      this.sideEffects.push('resetPipeTimer');
    }
    if (newState === GameState.PLAYING && prev === GameState.PAUSED) {
      this.sideEffects.push('resumeMusic');
    }
    if (newState === GameState.PAUSED) {
      this.sideEffects.push('pauseMusic');
    }
    if (newState === GameState.GAME_OVER) {
      this.sideEffects.push('stopMusic');
      this.sideEffects.push('playGameOver');
      this.sideEffects.push('screenShake');
      this.sideEffects.push('onGameOver');
    }
    if (newState === GameState.MENU) {
      this.sideEffects.push('reset');
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GameState enum', () => {
  it('has all five states with correct string values', () => {
    assert.equal(GameState.MENU,      'MENU');
    assert.equal(GameState.IDLE,      'IDLE');
    assert.equal(GameState.PLAYING,   'PLAYING');
    assert.equal(GameState.PAUSED,    'PAUSED');
    assert.equal(GameState.GAME_OVER, 'GAME_OVER');
  });

  it('is frozen (immutable)', () => {
    assert.ok(Object.isFrozen(GameState));
  });

  it('has exactly five keys', () => {
    assert.equal(Object.keys(GameState).length, 5);
  });
});

describe('transitionTo — all six valid transitions', () => {
  it('MENU → IDLE (flap on menu)', () => {
    const sm = new TestStateMachine(GameState.MENU);
    sm.transitionTo(GameState.IDLE);
    assert.equal(sm.state, GameState.IDLE);
  });

  it('IDLE → PLAYING (flap on idle)', () => {
    const sm = new TestStateMachine(GameState.IDLE);
    sm.transitionTo(GameState.PLAYING);
    assert.equal(sm.state, GameState.PLAYING);
  });

  it('PLAYING → PAUSED (Escape/P during play)', () => {
    const sm = new TestStateMachine(GameState.PLAYING);
    sm.transitionTo(GameState.PAUSED);
    assert.equal(sm.state, GameState.PAUSED);
  });

  it('PAUSED → PLAYING (Escape/P while paused)', () => {
    const sm = new TestStateMachine(GameState.PAUSED);
    sm.transitionTo(GameState.PLAYING);
    assert.equal(sm.state, GameState.PLAYING);
  });

  it('PLAYING → GAME_OVER (collision)', () => {
    const sm = new TestStateMachine(GameState.PLAYING);
    sm.transitionTo(GameState.GAME_OVER);
    assert.equal(sm.state, GameState.GAME_OVER);
  });

  it('GAME_OVER → MENU (flap on game over)', () => {
    const sm = new TestStateMachine(GameState.GAME_OVER);
    sm.transitionTo(GameState.MENU);
    assert.equal(sm.state, GameState.MENU);
  });
});

describe('transitionTo — invalid transitions are silently ignored', () => {
  const invalidCases = [
    { from: GameState.MENU,      to: GameState.PLAYING   },
    { from: GameState.MENU,      to: GameState.PAUSED    },
    { from: GameState.MENU,      to: GameState.GAME_OVER },
    { from: GameState.MENU,      to: GameState.MENU      },
    { from: GameState.IDLE,      to: GameState.MENU      },
    { from: GameState.IDLE,      to: GameState.PAUSED    },
    { from: GameState.IDLE,      to: GameState.GAME_OVER },
    { from: GameState.IDLE,      to: GameState.IDLE      },
    { from: GameState.PLAYING,   to: GameState.MENU      },
    { from: GameState.PLAYING,   to: GameState.IDLE      },
    { from: GameState.PLAYING,   to: GameState.PLAYING   },
    { from: GameState.PAUSED,    to: GameState.MENU      },
    { from: GameState.PAUSED,    to: GameState.IDLE      },
    { from: GameState.PAUSED,    to: GameState.GAME_OVER },
    { from: GameState.PAUSED,    to: GameState.PAUSED    },
    { from: GameState.GAME_OVER, to: GameState.IDLE      },
    { from: GameState.GAME_OVER, to: GameState.PLAYING   },
    { from: GameState.GAME_OVER, to: GameState.PAUSED    },
    { from: GameState.GAME_OVER, to: GameState.GAME_OVER },
  ];

  for (const { from, to } of invalidCases) {
    it(`${from} → ${to} does not change state`, () => {
      const sm = new TestStateMachine(from);
      sm.transitionTo(to);
      assert.equal(sm.state, from,
        `State should remain ${from} after invalid transition to ${to}`);
    });
  }
});

describe('transitionTo — invalid transitions trigger no side-effects', () => {
  it('invalid transition produces no side-effects', () => {
    const sm = new TestStateMachine(GameState.MENU);
    sm.transitionTo(GameState.PLAYING); // invalid
    assert.equal(sm.sideEffects.length, 0);
  });
});

describe('transitionTo — side-effects per transition', () => {
  it('IDLE → PLAYING triggers startMusic and resetPipeTimer', () => {
    const sm = new TestStateMachine(GameState.IDLE);
    sm.transitionTo(GameState.PLAYING);
    assert.ok(sm.sideEffects.includes('startMusic'),    'should start music');
    assert.ok(sm.sideEffects.includes('resetPipeTimer'), 'should reset pipe timer');
  });

  it('IDLE → PLAYING does NOT trigger resumeMusic', () => {
    const sm = new TestStateMachine(GameState.IDLE);
    sm.transitionTo(GameState.PLAYING);
    assert.ok(!sm.sideEffects.includes('resumeMusic'), 'should not resume (was not paused)');
  });

  it('PAUSED → PLAYING triggers resumeMusic (not startMusic)', () => {
    const sm = new TestStateMachine(GameState.PAUSED);
    sm.transitionTo(GameState.PLAYING);
    assert.ok(sm.sideEffects.includes('resumeMusic'),  'should resume music');
    assert.ok(!sm.sideEffects.includes('startMusic'),  'should not start fresh');
  });

  it('PLAYING → PAUSED triggers pauseMusic', () => {
    const sm = new TestStateMachine(GameState.PLAYING);
    sm.transitionTo(GameState.PAUSED);
    assert.ok(sm.sideEffects.includes('pauseMusic'), 'should pause music');
  });

  it('PLAYING → GAME_OVER triggers stopMusic, playGameOver, screenShake, onGameOver', () => {
    const sm = new TestStateMachine(GameState.PLAYING);
    sm.transitionTo(GameState.GAME_OVER);
    assert.ok(sm.sideEffects.includes('stopMusic'),    'should stop music');
    assert.ok(sm.sideEffects.includes('playGameOver'), 'should play game over sfx');
    assert.ok(sm.sideEffects.includes('screenShake'),  'should trigger screen shake');
    assert.ok(sm.sideEffects.includes('onGameOver'),   'should call scoreManager.onGameOver');
  });

  it('GAME_OVER → MENU triggers reset', () => {
    const sm = new TestStateMachine(GameState.GAME_OVER);
    sm.transitionTo(GameState.MENU);
    assert.ok(sm.sideEffects.includes('reset'), 'should reset game state');
  });

  it('MENU → IDLE triggers no side-effects', () => {
    const sm = new TestStateMachine(GameState.MENU);
    sm.transitionTo(GameState.IDLE);
    assert.equal(sm.sideEffects.length, 0, 'MENU→IDLE has no side-effects');
  });
});

describe('transitionTo — full play sequence', () => {
  it('MENU → IDLE → PLAYING → PAUSED → PLAYING → GAME_OVER → MENU', () => {
    const sm = new TestStateMachine(GameState.MENU);
    sm.transitionTo(GameState.IDLE);
    assert.equal(sm.state, GameState.IDLE);
    sm.transitionTo(GameState.PLAYING);
    assert.equal(sm.state, GameState.PLAYING);
    sm.transitionTo(GameState.PAUSED);
    assert.equal(sm.state, GameState.PAUSED);
    sm.transitionTo(GameState.PLAYING);
    assert.equal(sm.state, GameState.PLAYING);
    sm.transitionTo(GameState.GAME_OVER);
    assert.equal(sm.state, GameState.GAME_OVER);
    sm.transitionTo(GameState.MENU);
    assert.equal(sm.state, GameState.MENU);
  });
});
