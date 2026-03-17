'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Standalone InputHandler for testing (mirrors game.js implementation)
class InputHandler {
  constructor() {
    this.pendingFlap  = false;
    this.pendingPause = false;
    this._getState    = () => 'MENU';
  }

  attach(canvas, getState) {
    this._getState = getState;
    // In tests we call _onKey/_onFlap directly
  }

  _onKey(e) {
    if (e.code === 'Space' || e.key === ' ') {
      this._onFlap();
    } else if (e.code === 'Escape' || e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      this.pendingPause = true;
    }
  }

  _onFlap() {
    if (this._getState() === 'PAUSED') return;
    this.pendingFlap = true;
  }

  flush() {
    const result = { flap: this.pendingFlap, pause: this.pendingPause };
    this.pendingFlap  = false;
    this.pendingPause = false;
    return result;
  }
}

describe('InputHandler', () => {
  it('spacebar (code: Space) sets pendingFlap', () => {
    const h = new InputHandler();
    h._onKey({ code: 'Space', key: 'Space' });
    assert.equal(h.pendingFlap, true);
  });

  it('space key (key: " ") sets pendingFlap', () => {
    const h = new InputHandler();
    h._onKey({ code: '', key: ' ' });
    assert.equal(h.pendingFlap, true);
  });

  it('click (_onFlap) sets pendingFlap', () => {
    const h = new InputHandler();
    h._onFlap();
    assert.equal(h.pendingFlap, true);
  });

  it('touchstart (_onFlap) sets pendingFlap', () => {
    const h = new InputHandler();
    h._onFlap();
    assert.equal(h.pendingFlap, true);
  });

  it('Escape key sets pendingPause', () => {
    const h = new InputHandler();
    h._onKey({ code: 'Escape', key: 'Escape' });
    assert.equal(h.pendingPause, true);
  });

  it('P key (lowercase) sets pendingPause', () => {
    const h = new InputHandler();
    h._onKey({ code: 'KeyP', key: 'p' });
    assert.equal(h.pendingPause, true);
  });

  it('P key (uppercase) sets pendingPause', () => {
    const h = new InputHandler();
    h._onKey({ code: 'KeyP', key: 'P' });
    assert.equal(h.pendingPause, true);
  });

  it('flush() returns correct flags and clears them', () => {
    const h = new InputHandler();
    h._onFlap();
    h._onKey({ code: 'Escape', key: 'Escape' });

    const result = h.flush();
    assert.equal(result.flap, true);
    assert.equal(result.pause, true);

    // Flags should be cleared after flush
    assert.equal(h.pendingFlap, false);
    assert.equal(h.pendingPause, false);
  });

  it('flush() returns false for both when nothing happened', () => {
    const h = new InputHandler();
    const result = h.flush();
    assert.equal(result.flap, false);
    assert.equal(result.pause, false);
  });

  it('flap is suppressed when state is PAUSED', () => {
    const h = new InputHandler();
    h.attach(null, () => 'PAUSED');
    h._onFlap();
    assert.equal(h.pendingFlap, false);
  });

  it('pause key still works when PAUSED (for unpausing)', () => {
    const h = new InputHandler();
    h.attach(null, () => 'PAUSED');
    h._onKey({ code: 'Escape', key: 'Escape' });
    assert.equal(h.pendingPause, true);
  });

  it('multiple flaps before flush — pendingFlap stays true (idempotent)', () => {
    const h = new InputHandler();
    h._onFlap();
    h._onFlap();
    h._onFlap();
    assert.equal(h.pendingFlap, true);

    const result = h.flush();
    assert.equal(result.flap, true);
    assert.equal(h.pendingFlap, false);
  });
});
