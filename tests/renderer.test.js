'use strict';
const { test } = require('node:test');
const assert   = require('node:assert/strict');

// Minimal canvas context mock — records calls, never throws
function makeMockCtx() {
  const calls = [];
  const handler = {
    get(target, prop) {
      if (prop === 'calls') return calls;
      if (prop in target) return target[prop];
      // Return a no-op function for any unknown method
      return (...args) => { calls.push({ method: prop, args }); };
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  };
  const ctx = new Proxy({
    calls,
    save: () => calls.push({ method: 'save' }),
    restore: () => calls.push({ method: 'restore' }),
    clearRect: () => calls.push({ method: 'clearRect' }),
    fillRect: () => calls.push({ method: 'fillRect' }),
    strokeRect: () => calls.push({ method: 'strokeRect' }),
    beginPath: () => calls.push({ method: 'beginPath' }),
    arc: () => calls.push({ method: 'arc' }),
    fill: () => calls.push({ method: 'fill' }),
    stroke: () => calls.push({ method: 'stroke' }),
    moveTo: () => calls.push({ method: 'moveTo' }),
    lineTo: () => calls.push({ method: 'lineTo' }),
    fillText: () => calls.push({ method: 'fillText' }),
    translate: () => calls.push({ method: 'translate' }),
    rotate: () => calls.push({ method: 'rotate' }),
    drawImage: () => calls.push({ method: 'drawImage' }),
    roundRect: () => calls.push({ method: 'roundRect' }),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineJoin: '',
    shadowColor: '',
    shadowBlur: 0,
    font: '',
    textAlign: '',
  }, handler);
  return ctx;
}

// Minimal Renderer for testing (mirrors game.js implementation)
// Only _drawGhosty is needed for the fallback test
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this._w     = canvas.width;
    this._h     = canvas.height;
  }

  _drawGhosty(ctx, ghosty, gameState, timestamp) {
    const cx = ghosty.x + ghosty.width / 2;
    let   cy = ghosty.y + ghosty.height / 2;
    if (gameState === 'MENU' || gameState === 'IDLE') {
      cy += ghosty.getBobOffset ? ghosty.getBobOffset(timestamp) : 0;
    }
    const rotation = ghosty.getRotation ? ghosty.getRotation(gameState, timestamp) : 0;
    const opacity  = ghosty.getDeathOpacity ? ghosty.getDeathOpacity() : 1;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    if (ghosty.imgLoaded) {
      ctx.drawImage(ghosty.img, -ghosty.width / 2, -ghosty.height / 2, ghosty.width, ghosty.height);
    } else {
      // Fallback: white circle
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    ctx.restore();
  }
}

test('Renderer draws fallback circle when ghosty.imgLoaded is false (onerror path)', () => {
  const mockCtx = makeMockCtx();
  const canvas  = { width: 800, height: 600, getContext: () => mockCtx };
  const renderer = new Renderer(canvas);

  const ghosty = {
    x: 100, y: 200, width: 32, height: 32,
    imgLoaded: false,
    img: null,
    getBobOffset: () => 0,
    getRotation: () => 0,
    getDeathOpacity: () => 1,
  };

  // Should not throw even though imgLoaded is false and img is null
  assert.doesNotThrow(() => {
    renderer._drawGhosty(mockCtx, ghosty, 'PLAYING', 1000);
  });

  // Should have called arc (fallback circle) and NOT called drawImage
  const methodNames = mockCtx.calls.map(c => c.method);
  assert.ok(methodNames.includes('arc'),       'should draw fallback arc');
  assert.ok(!methodNames.includes('drawImage'), 'should NOT call drawImage when imgLoaded is false');
});

test('Renderer calls drawImage when ghosty.imgLoaded is true', () => {
  const mockCtx = makeMockCtx();
  const canvas  = { width: 800, height: 600, getContext: () => mockCtx };
  const renderer = new Renderer(canvas);

  const ghosty = {
    x: 100, y: 200, width: 32, height: 32,
    imgLoaded: true,
    img: {},  // mock image object
    getBobOffset: () => 0,
    getRotation: () => 0,
    getDeathOpacity: () => 1,
  };

  assert.doesNotThrow(() => {
    renderer._drawGhosty(mockCtx, ghosty, 'PLAYING', 1000);
  });

  const methodNames = mockCtx.calls.map(c => c.method);
  assert.ok(methodNames.includes('drawImage'), 'should call drawImage when imgLoaded is true');
  assert.ok(!methodNames.includes('arc'),      'should NOT draw fallback arc when imgLoaded is true');
});
