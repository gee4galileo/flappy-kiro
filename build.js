'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function die(msg) {
  console.error(`\n[build] ERROR: ${msg}`);
  process.exit(1);
}

function verify(filePath) {
  if (!fs.existsSync(filePath)) die(`Expected output not found: ${filePath}`);
  const size = fs.statSync(filePath).size;
  if (size === 0) die(`Output file is empty: ${filePath}`);
  return size;
}

function printSize(label, filePath) {
  const bytes = fs.statSync(filePath).size;
  console.log(`  ${label}: ${bytes.toLocaleString()} bytes`);
}

// ---------------------------------------------------------------------------
// 1. Concatenate config.js + game.js
// ---------------------------------------------------------------------------

console.log('[build] Concatenating config.js + game.js…');
const src = fs.readFileSync('config.js', 'utf8') + '\n' + fs.readFileSync('game.js', 'utf8');

// ---------------------------------------------------------------------------
// 2. Minify with terser (programmatic API)
// ---------------------------------------------------------------------------

console.log('[build] Minifying with terser…');

let terser;
try {
  terser = require('terser');
} catch (_) {
  die('terser is not installed. Run: npm install --save-dev terser');
}

fs.mkdirSync('dist', { recursive: true });

// terser.minify is async in terser v5+
(async () => {
  const result = await terser.minify(src, {
    compress: true,
    mangle:   true,
  });

  if (result.error) die(`terser failed: ${result.error}`);

  fs.writeFileSync('dist/game.min.js', result.code, 'utf8');

  // ---------------------------------------------------------------------------
  // 3. Update index.html — replace the two script tags with one
  // ---------------------------------------------------------------------------

  console.log('[build] Processing index.html…');
  let html = fs.readFileSync('index.html', 'utf8');

  // Replace both script tags (order: config.js then game.js) with a single tag
  html = html
    .replace(/<script src="config\.js"><\/script>\s*/g, '')
    .replace(/<script src="game\.js"><\/script>/g, '<script src="game.min.js"></script>');

  fs.writeFileSync('dist/index.html', html, 'utf8');

  // ---------------------------------------------------------------------------
  // 4. Copy assets
  // ---------------------------------------------------------------------------

  console.log('[build] Copying assets…');
  fs.mkdirSync('dist/assets', { recursive: true });

  const assets = ['ghosty.png', 'jump.wav', 'game_over.wav'];
  for (const file of assets) {
    fs.copyFileSync(path.join('assets', file), path.join('dist', 'assets', file));
  }

  // Copy _headers into dist/ for Netlify
  if (fs.existsSync('_headers')) {
    fs.copyFileSync('_headers', 'dist/_headers');
  }

  // ---------------------------------------------------------------------------
  // 5. Verify all outputs exist and are non-zero
  // ---------------------------------------------------------------------------

  console.log('[build] Verifying outputs…');
  verify('dist/game.min.js');
  verify('dist/index.html');
  for (const file of assets) {
    verify(path.join('dist', 'assets', file));
  }

  // ---------------------------------------------------------------------------
  // 6. Print file sizes
  // ---------------------------------------------------------------------------

  console.log('\n[build] Build succeeded. Output sizes:');
  printSize('dist/game.min.js', 'dist/game.min.js');
  for (const file of assets) {
    printSize(`dist/assets/${file}`, path.join('dist', 'assets', file));
  }

  console.log('');
})().catch(err => die(err.message || String(err)));
