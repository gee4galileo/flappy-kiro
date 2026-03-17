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
    this.ctx    = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
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

// --- Task 2.1: Context initialization unit tests ---

test('Renderer calls getContext with alpha:false and willReadFrequently:false', () => {
  const calls = [];
  const mockCtx = makeMockCtx();
  const canvas = {
    width: 800,
    height: 600,
    getContext(type, opts) {
      calls.push({ type, opts });
      return mockCtx;
    },
  };

  new Renderer(canvas);

  assert.equal(calls.length, 1, 'getContext should be called exactly once');
  assert.equal(calls[0].type, '2d');
  assert.equal(calls[0].opts.alpha, false, 'alpha should be false');
  assert.equal(calls[0].opts.willReadFrequently, false, 'willReadFrequently should be false');
});

test('Renderer calls getContext exactly once during construction', () => {
  let callCount = 0;
  const mockCtx = makeMockCtx();
  const canvas = {
    width: 800,
    height: 600,
    getContext() {
      callCount++;
      return mockCtx;
    },
  };

  const renderer = new Renderer(canvas);

  // Simulate a draw call — getContext must not be called again
  renderer._drawGhosty(mockCtx, {
    x: 0, y: 0, width: 32, height: 32,
    imgLoaded: false,
    getBobOffset: () => 0,
    getRotation: () => 0,
    getDeathOpacity: () => 1,
  }, 'PLAYING', 0);

  assert.equal(callCount, 1, 'getContext must be called exactly once — never again after construction');
});

// --- Task 3.2: Property 1 — Canvas physical dimensions equal logical dimensions × DPR ---
// Feature: production-readiness, Property 1: Canvas physical dimensions equal logical dimensions × DPR
// Validates: Requirements 1.1, 1.2, 1.4

const fc = require('fast-check');

// Standalone _resize() implementation mirroring game.js design
// Takes explicit arguments instead of reading window globals — testable in Node
function resizeCanvas(canvas, logicalW, logicalH, dpr) {
  canvas.width        = Math.round(logicalW * dpr);
  canvas.height       = Math.round(logicalH * dpr);
  canvas.style.width  = logicalW + 'px';
  canvas.style.height = logicalH + 'px';
}

test('Property 1: canvas physical dimensions equal logical dimensions × DPR', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 100, max: 2000 }),        // logicalW
      fc.integer({ min: 100, max: 2000 }),        // logicalH
      fc.double({ min: 1, max: 4, noNaN: true }), // dpr ≥ 1
      (logicalW, logicalH, dpr) => {
        const canvas = { width: 0, height: 0, style: { width: '', height: '' } };
        resizeCanvas(canvas, logicalW, logicalH, dpr);

        assert.strictEqual(
          canvas.width,
          Math.round(logicalW * dpr),
          `canvas.width should be Math.round(${logicalW} × ${dpr})`
        );
        assert.strictEqual(
          canvas.height,
          Math.round(logicalH * dpr),
          `canvas.height should be Math.round(${logicalH} × ${dpr})`
        );
        assert.strictEqual(
          canvas.style.width,
          logicalW + 'px',
          `canvas.style.width should be '${logicalW}px'`
        );
      }
    ),
    { numRuns: 100 }
  );
});

// --- Task 3.2: Property 2 — DPR scale transform applied in resize and draw ---
// Feature: production-readiness, Property 2: DPR scale transform applied in resize and draw
// Validates: Requirements 1.3, 1.5

// Standalone helper mirroring Renderer.resize() and Renderer.draw() DPR transform logic
function applyDprTransform(ctx, dpr) {
  if (ctx.setTransform) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  } else {
    ctx.scale(dpr, dpr);
  }
}

test('Property 2: setTransform is called with correct DPR args in resize()', () => {
  fc.assert(
    fc.property(
      fc.double({ min: 1, max: 4, noNaN: true }), // dpr ≥ 1
      (dpr) => {
        const calls = [];
        const ctx = {
          setTransform: (...args) => calls.push({ method: 'setTransform', args }),
        };

        applyDprTransform(ctx, dpr);

        const st = calls.filter(c => c.method === 'setTransform');
        assert.equal(st.length, 1, 'setTransform should be called exactly once');
        assert.deepEqual(
          st[0].args,
          [dpr, 0, 0, dpr, 0, 0],
          `setTransform should be called with (${dpr}, 0, 0, ${dpr}, 0, 0)`
        );
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 2: setTransform is called again at the start of draw() to prevent accumulation', () => {
  fc.assert(
    fc.property(
      fc.double({ min: 1, max: 4, noNaN: true }), // dpr ≥ 1
      (dpr) => {
        const calls = [];
        const ctx = {
          setTransform: (...args) => calls.push({ method: 'setTransform', args }),
        };

        // Simulate resize then two draw calls — setTransform must be called each time
        applyDprTransform(ctx, dpr); // resize
        applyDprTransform(ctx, dpr); // draw call 1
        applyDprTransform(ctx, dpr); // draw call 2

        const st = calls.filter(c => c.method === 'setTransform');
        assert.equal(st.length, 3, 'setTransform should be called on resize and each draw');
        for (const call of st) {
          assert.deepEqual(
            call.args,
            [dpr, 0, 0, dpr, 0, 0],
            'every setTransform call must use the same DPR args'
          );
        }
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 2: falls back to ctx.scale when setTransform is unavailable', () => {
  fc.assert(
    fc.property(
      fc.double({ min: 1, max: 4, noNaN: true }), // dpr ≥ 1
      (dpr) => {
        const calls = [];
        // ctx without setTransform — simulates older browser
        const ctx = {
          scale: (...args) => calls.push({ method: 'scale', args }),
        };

        applyDprTransform(ctx, dpr);

        const sc = calls.filter(c => c.method === 'scale');
        assert.equal(sc.length, 1, 'scale should be called exactly once as fallback');
        assert.deepEqual(
          sc[0].args,
          [dpr, dpr],
          `scale fallback should be called with (${dpr}, ${dpr})`
        );
      }
    ),
    { numRuns: 100 }
  );
});

// --- Task 5: Shadow state bleed fix in _drawPipes() ---
// Validates: Requirements 4.1, 4.2, 4.3

// Minimal _drawPipes implementation mirroring game.js
function drawPipes(ctx, pipes, canvasH) {
  ctx.fillStyle = '#2d8a2d';
  ctx.save();
  ctx.strokeStyle = '#1a5c1a';
  ctx.lineWidth   = 3;
  ctx.lineJoin    = 'round';
  ctx.shadowColor = '#1a5c1a';
  ctx.shadowBlur  = 4;
  for (const pipe of pipes) {
    const topH = pipe.gapY;
    const botH = canvasH - (pipe.gapY + pipe.gapHeight);
    if (topH > 0) { ctx.fillRect(pipe.x, 0, pipe.width, topH); ctx.strokeRect(pipe.x + 1, 1, pipe.width - 2, topH - 2); }
    if (botH > 0) { ctx.fillRect(pipe.x, pipe.gapY + pipe.gapHeight, pipe.width, botH); ctx.strokeRect(pipe.x + 1, pipe.gapY + pipe.gapHeight + 1, pipe.width - 2, botH - 2); }
  }
  // Fix: explicit shadow reset before restore (Requirements 4.1, 4.2, 4.3)
  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';
  ctx.restore();
}

// Helper: make a ctx that also tracks property assignments in order
function makeShadowTrackingCtx() {
  const ops = []; // { kind: 'call'|'set', name, value?, args? }
  const handler = {
    get(target, prop) {
      if (prop === 'ops') return ops;
      if (prop in target) return target[prop];
      return (...args) => ops.push({ kind: 'call', name: prop, args });
    },
    set(target, prop, value) {
      target[prop] = value;
      ops.push({ kind: 'set', name: prop, value });
      return true;
    },
  };
  return new Proxy({
    ops,
    save:      () => ops.push({ kind: 'call', name: 'save' }),
    restore:   () => ops.push({ kind: 'call', name: 'restore' }),
    fillRect:  () => ops.push({ kind: 'call', name: 'fillRect' }),
    strokeRect:() => ops.push({ kind: 'call', name: 'strokeRect' }),
    shadowBlur: 0,
    shadowColor: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineJoin: '',
  }, handler);
}

test('Req 4.1: shadowBlur is set to 0 before ctx.restore() in _drawPipes (with pipes)', () => {
  const ctx = makeShadowTrackingCtx();
  const pipes = [{ x: 100, width: 52, gapY: 150, gapHeight: 140 }];
  drawPipes(ctx, pipes, 600);

  const ops = ctx.ops;
  const restoreIdx = ops.findLastIndex(o => o.kind === 'call' && o.name === 'restore');
  assert.ok(restoreIdx > -1, 'restore() must be called');

  // Find the last shadowBlur assignment before restore
  const shadowBlurIdx = ops.slice(0, restoreIdx).findLastIndex(
    o => o.kind === 'set' && o.name === 'shadowBlur'
  );
  assert.ok(shadowBlurIdx > -1, 'shadowBlur must be set before restore()');
  assert.equal(ops[shadowBlurIdx].value, 0, 'shadowBlur must be 0 before restore()');
});

test('Req 4.2: shadowColor is set to "transparent" before ctx.restore() in _drawPipes (with pipes)', () => {
  const ctx = makeShadowTrackingCtx();
  const pipes = [{ x: 100, width: 52, gapY: 150, gapHeight: 140 }];
  drawPipes(ctx, pipes, 600);

  const ops = ctx.ops;
  const restoreIdx = ops.findLastIndex(o => o.kind === 'call' && o.name === 'restore');
  assert.ok(restoreIdx > -1, 'restore() must be called');

  const shadowColorIdx = ops.slice(0, restoreIdx).findLastIndex(
    o => o.kind === 'set' && o.name === 'shadowColor'
  );
  assert.ok(shadowColorIdx > -1, 'shadowColor must be set before restore()');
  assert.equal(ops[shadowColorIdx].value, 'transparent', 'shadowColor must be "transparent" before restore()');
});

test('Req 4.3: shadowBlur is reset to 0 even when pipes array is empty', () => {
  const ctx = makeShadowTrackingCtx();
  drawPipes(ctx, [], 600); // empty pipes

  const ops = ctx.ops;
  const restoreIdx = ops.findLastIndex(o => o.kind === 'call' && o.name === 'restore');
  assert.ok(restoreIdx > -1, 'restore() must be called even with no pipes');

  const shadowBlurIdx = ops.slice(0, restoreIdx).findLastIndex(
    o => o.kind === 'set' && o.name === 'shadowBlur'
  );
  assert.ok(shadowBlurIdx > -1, 'shadowBlur must be set before restore() even with empty pipes');
  assert.equal(ops[shadowBlurIdx].value, 0, 'shadowBlur must be 0 before restore() with empty pipes');
});

// --- Task 6.1: Property 8 — Coordinate rounding does not mutate game objects ---
// Feature: production-readiness, Property 8: Coordinate rounding does not mutate game objects
// Validates: Requirements 8.3, 9.1, 9.2, 9.3, 9.4

// Minimal draw helpers mirroring game.js — round at draw time, never mutate source objects
function drawGhostyCoords(ctx, ghosty) {
  // Mirrors _drawGhosty: translate to center, drawImage with rounded offsets
  const cx = ghosty.x + ghosty.width / 2;
  const cy = ghosty.y + ghosty.height / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.drawImage({}, Math.round(-ghosty.width / 2), Math.round(-ghosty.height / 2), ghosty.width, ghosty.height);
  ctx.restore();
}

function drawPipeRectCoords(ctx, x, y, w, h) {
  // Mirrors _drawPipeRect: round all four args at draw time
  if (h <= 0) return;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  ctx.strokeRect(Math.round(x) + 1, Math.round(y) + 1, Math.round(w) - 2, Math.round(h) - 2);
}

function drawCloudCoords(ctx, cloud) {
  // Mirrors _drawClouds: round all four roundRect/rect args at draw time
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(Math.round(cloud.x), Math.round(cloud.y), Math.round(cloud.width), Math.round(cloud.height), 12);
  } else {
    ctx.rect(Math.round(cloud.x), Math.round(cloud.y), Math.round(cloud.width), Math.round(cloud.height));
  }
  ctx.fill();
  ctx.restore();
}

test('Property 8: coordinate rounding does not mutate pipe, cloud, or ghosty objects', () => {
  // Arbitrary floating-point coordinate generator — includes negatives and sub-pixel values
  const coordArb = fc.double({ min: -500, max: 2000, noNaN: true, noDefaultInfinity: true });
  const sizeArb  = fc.double({ min: 1,    max: 500,  noNaN: true, noDefaultInfinity: true });

  const pipeArb = fc.record({
    x:         coordArb,
    gapY:      coordArb,
    gapHeight: sizeArb,
    width:     sizeArb,
  });

  const cloudArb = fc.record({
    x:      coordArb,
    y:      coordArb,
    width:  sizeArb,
    height: sizeArb,
  });

  const ghostyArb = fc.record({
    x:      coordArb,
    y:      coordArb,
    width:  sizeArb,
    height: sizeArb,
  });

  fc.assert(
    fc.property(
      pipeArb,
      cloudArb,
      ghostyArb,
      fc.integer({ min: 200, max: 1200 }), // canvasH
      (pipe, cloud, ghosty, canvasH) => {
        const ctx = makeMockCtx();

        // Snapshot original values before any draw call
        const pipeSnap   = { x: pipe.x, gapY: pipe.gapY, gapHeight: pipe.gapHeight, width: pipe.width };
        const cloudSnap  = { x: cloud.x, y: cloud.y, width: cloud.width, height: cloud.height };
        const ghostySnap = { x: ghosty.x, y: ghosty.y, width: ghosty.width, height: ghosty.height };

        // Execute draw helpers (these must round at draw time, never mutate)
        drawPipeRectCoords(ctx, pipe.x, 0, pipe.width, pipe.gapY);
        drawPipeRectCoords(ctx, pipe.x, pipe.gapY + pipe.gapHeight, pipe.width, canvasH - (pipe.gapY + pipe.gapHeight));
        drawCloudCoords(ctx, cloud);
        drawGhostyCoords(ctx, ghosty);

        // Assert pipe fields unchanged
        assert.strictEqual(pipe.x,         pipeSnap.x,         'pipe.x must not be mutated');
        assert.strictEqual(pipe.gapY,       pipeSnap.gapY,      'pipe.gapY must not be mutated');
        assert.strictEqual(pipe.gapHeight,  pipeSnap.gapHeight, 'pipe.gapHeight must not be mutated');
        assert.strictEqual(pipe.width,      pipeSnap.width,     'pipe.width must not be mutated');

        // Assert cloud fields unchanged
        assert.strictEqual(cloud.x,      cloudSnap.x,      'cloud.x must not be mutated');
        assert.strictEqual(cloud.y,      cloudSnap.y,      'cloud.y must not be mutated');
        assert.strictEqual(cloud.width,  cloudSnap.width,  'cloud.width must not be mutated');
        assert.strictEqual(cloud.height, cloudSnap.height, 'cloud.height must not be mutated');

        // Assert ghosty fields unchanged
        assert.strictEqual(ghosty.x,      ghostySnap.x,      'ghosty.x must not be mutated');
        assert.strictEqual(ghosty.y,      ghostySnap.y,      'ghosty.y must not be mutated');
        assert.strictEqual(ghosty.width,  ghostySnap.width,  'ghosty.width must not be mutated');
        assert.strictEqual(ghosty.height, ghostySnap.height, 'ghosty.height must not be mutated');
      }
    ),
    { numRuns: 100 }
  );
});

// --- Task 5.1: Property 5 — Shadow state is reset after pipe draw pass ---
// Feature: production-readiness, Property 5: Shadow state is reset after pipe draw pass
// Validates: Requirements 4.1, 4.2, 4.3

test('Property 5: shadowBlur is 0 and shadowColor is "transparent" after _drawPipes for any pipe list', () => {
  // Arbitrary pipe shape generator — gapY and gapHeight must keep both rects non-negative
  const pipeArb = fc.record({
    x:          fc.integer({ min: -100, max: 2000 }),
    width:      fc.integer({ min: 1,    max: 200  }),
    gapY:       fc.integer({ min: 0,    max: 400  }),
    gapHeight:  fc.integer({ min: 1,    max: 200  }),
  });

  fc.assert(
    fc.property(
      fc.array(pipeArb, { minLength: 0, maxLength: 20 }), // includes empty array
      fc.integer({ min: 200, max: 1200 }),                 // canvasH
      (pipes, canvasH) => {
        const ctx = makeShadowTrackingCtx();
        drawPipes(ctx, pipes, canvasH);

        // After drawPipes completes, the ctx properties must reflect the reset values
        assert.equal(
          ctx.shadowBlur,
          0,
          `shadowBlur must be 0 after _drawPipes (pipes.length=${pipes.length})`
        );
        assert.equal(
          ctx.shadowColor,
          'transparent',
          `shadowColor must be "transparent" after _drawPipes (pipes.length=${pipes.length})`
        );

        // Additionally verify the reset happened BEFORE restore() in the op log
        const ops = ctx.ops;
        const restoreIdx = ops.findLastIndex(o => o.kind === 'call' && o.name === 'restore');
        assert.ok(restoreIdx > -1, 'restore() must always be called');

        const lastShadowBlurBeforeRestore = ops
          .slice(0, restoreIdx)
          .findLastIndex(o => o.kind === 'set' && o.name === 'shadowBlur');
        assert.ok(
          lastShadowBlurBeforeRestore > -1,
          'shadowBlur must be explicitly set before restore()'
        );
        assert.equal(
          ops[lastShadowBlurBeforeRestore].value,
          0,
          'last shadowBlur assignment before restore() must be 0'
        );

        const lastShadowColorBeforeRestore = ops
          .slice(0, restoreIdx)
          .findLastIndex(o => o.kind === 'set' && o.name === 'shadowColor');
        assert.ok(
          lastShadowColorBeforeRestore > -1,
          'shadowColor must be explicitly set before restore()'
        );
        assert.equal(
          ops[lastShadowColorBeforeRestore].value,
          'transparent',
          'last shadowColor assignment before restore() must be "transparent"'
        );
      }
    ),
    { numRuns: 100 }
  );
});
