// tests/helpers.js — shared factory functions for all test files

function makeGhosty({ x = 100, y = 200, vy = 0, width = 32, height = 32 } = {}) {
  return {
    x, y, vy, width, height,
    cx: x + width / 2,
    cy: y + height / 2,
    hitboxRadius: 12,
    imgLoaded: false,
    flapTimer: 0,
    deathTimer: 0,
    isDead: false,
    onFlap()  { this.flapTimer = 0; },
    onDeath() { this.isDead = true; this.deathTimer = 0; },
    reset(cw, ch) {
      this.x  = cw * 0.25;
      this.y  = ch / 2 - this.height / 2;
      this.vy = 0;
    },
    get cx() { return this.x + this.width / 2; },
    get cy() { return this.y + this.height / 2; },
  };
}

function makePipe({ x = 400, gapY = 150, gapHeight = 140, width = 60, speed = 120, scored = false } = {}) {
  return { x, gapY, gapHeight, width, speed, scored };
}

function makeCloud({ x = 400, y = 100, width = 100, height = 50, speed = 60 } = {}) {
  return { x, y, width, height, speed };
}

module.exports = { makeGhosty, makePipe, makeCloud };
