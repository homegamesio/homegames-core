const { performance } = require('perf_hooks');
const path = require('path');
const { Squisher } = require('squish-142');
const Game = require(process.argv[2] ? path.resolve(process.argv[2]) : '../../src/games/city-scanner');
const game = new Game();
// Exercise the real wire encoder with manually advanced ticks. Bypassing its
// constructor avoids starting an independent timer during measurements.
const codec = Object.create(Squisher.prototype);
codec.scale = {x: 1, y: 1}; codec.playerSettings = {};
codec.handleStateChange = () => {};
const stats = [];
for (const x of [1120, 270, 1900, 1120]) {
  game.camera.x = x; game.camera.targetX = x;
  let renderMs = 0, encodeMs = 0, bytes = 0, count = 0;
  const frames = Game.metadata().tickRate * 2;
  for (let i = 0; i < frames; i++) {
    const a = performance.now(); game.tick(); const b = performance.now();
    const frame = codec.squish(game.getLayers()); const c = performance.now();
    renderMs += b - a; encodeMs += c - b;
    bytes += frame.reduce((n, part) => n + part.length, 0); count += frame.length;
  }
  stats.push({x, renderMs: +(renderMs/frames).toFixed(2), encodeMs: +(encodeMs/frames).toFixed(2), shapes: Math.round(count/frames), bytes: Math.round(bytes/frames), bytesPerSecond: Math.round(bytes/frames * Game.metadata().tickRate)});
}
console.log(JSON.stringify(stats, null, 2)); game.close();
