// tests/build.test.js — Build script verification unit tests
// Feature: production-readiness
// Requirements: 7.5, 7.7, 10.1, 10.2, 10.3, 10.4
//
// NOTE: These tests require `npm run build` to have been run first.
// Run: npm run build && node --test tests/build.test.js
'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const fs       = require('fs');
const path     = require('path');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT      = path.resolve(__dirname, '..');
const DIST      = path.join(ROOT, 'dist');
const BUNDLE    = path.join(DIST, 'game.min.js');
const DIST_HTML = path.join(DIST, 'index.html');

function distExists(relPath) {
  return fs.existsSync(path.join(DIST, relPath));
}

// ---------------------------------------------------------------------------
// Requirement 10.1 / 7.5: dist/game.min.js exists and is ≥30% smaller
// ---------------------------------------------------------------------------

test('dist/game.min.js exists and has non-zero size', () => {
  assert.ok(fs.existsSync(BUNDLE), 'dist/game.min.js should exist — run npm run build first');
  const size = fs.statSync(BUNDLE).size;
  assert.ok(size > 0, 'dist/game.min.js should not be empty');
});

test('dist/game.min.js is at least 30% smaller than concatenated source', () => {
  assert.ok(fs.existsSync(BUNDLE), 'dist/game.min.js should exist — run npm run build first');

  const configSrc = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
  const gameSrc   = fs.readFileSync(path.join(ROOT, 'game.js'),   'utf8');
  const sourceSize = Buffer.byteLength(configSrc + '\n' + gameSrc, 'utf8');
  const bundleSize = fs.statSync(BUNDLE).size;

  // Must be at least 30% smaller: bundleSize < sourceSize * 0.70
  const ratio = bundleSize / sourceSize;
  assert.ok(
    ratio < 0.70,
    `dist/game.min.js (${bundleSize} bytes) should be ≥30% smaller than source (${sourceSize} bytes), ` +
    `but is only ${Math.round((1 - ratio) * 100)}% smaller`
  );
});

// ---------------------------------------------------------------------------
// Requirement 10.2: All asset files exist in dist/assets/
// ---------------------------------------------------------------------------

const REQUIRED_ASSETS = [
  'assets/ghosty.png',
  'assets/jump.wav',
  'assets/game_over.wav',
];

for (const asset of REQUIRED_ASSETS) {
  test(`dist/${asset} exists`, () => {
    assert.ok(
      distExists(asset),
      `dist/${asset} should exist — run npm run build first`
    );
  });
}

// ---------------------------------------------------------------------------
// Requirement 10.3 / 7.7: dist/index.html references game.min.js, not source files
// ---------------------------------------------------------------------------

test('dist/index.html exists', () => {
  assert.ok(fs.existsSync(DIST_HTML), 'dist/index.html should exist — run npm run build first');
});

test('dist/index.html references game.min.js', () => {
  assert.ok(fs.existsSync(DIST_HTML), 'dist/index.html should exist — run npm run build first');
  const html = fs.readFileSync(DIST_HTML, 'utf8');
  assert.ok(
    html.includes('game.min.js'),
    'dist/index.html should contain a reference to game.min.js'
  );
});

test('dist/index.html does not reference config.js', () => {
  assert.ok(fs.existsSync(DIST_HTML), 'dist/index.html should exist — run npm run build first');
  const html = fs.readFileSync(DIST_HTML, 'utf8');
  assert.ok(
    !html.includes('src="config.js"'),
    'dist/index.html should not reference config.js (it is bundled into game.min.js)'
  );
});

test('dist/index.html does not reference game.js as a separate script', () => {
  assert.ok(fs.existsSync(DIST_HTML), 'dist/index.html should exist — run npm run build first');
  const html = fs.readFileSync(DIST_HTML, 'utf8');
  assert.ok(
    !html.includes('src="game.js"'),
    'dist/index.html should not reference game.js (it is bundled into game.min.js)'
  );
});

// ---------------------------------------------------------------------------
// Requirement 10.4: package.json has a "build" script entry
// ---------------------------------------------------------------------------

test('package.json has a "build" script entry', () => {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assert.ok(
    pkg.scripts && typeof pkg.scripts.build === 'string',
    'package.json should have a "build" entry in "scripts"'
  );
  assert.match(
    pkg.scripts.build,
    /build\.js/,
    '"build" script should invoke build.js'
  );
});
