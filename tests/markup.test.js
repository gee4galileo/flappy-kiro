// tests/markup.test.js — unit tests for index.html mobile markup
// Requirements: 6.1, 6.4, 6.5

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

describe('index.html mobile markup', () => {
  it('viewport meta tag includes viewport-fit=cover (Req 6.1)', () => {
    assert.ok(
      html.includes('viewport-fit=cover'),
      'Expected viewport meta tag to contain viewport-fit=cover'
    );
  });

  it('canvas CSS rule includes touch-action: none (Req 6.4)', () => {
    assert.ok(
      html.includes('touch-action: none'),
      'Expected CSS to contain touch-action: none on canvas'
    );
  });

  it('body CSS rule includes env(safe-area-inset-bottom) (Req 6.5)', () => {
    assert.ok(
      html.includes('env(safe-area-inset-bottom)'),
      'Expected CSS to contain env(safe-area-inset-bottom)'
    );
  });
});
