'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const common = require('node:path').resolve(__dirname, '../../../../homegames-common');
const { createProject, exportArchive, importArchive } = require(common + '/portable-project');
const { loadTrustedGame } = require(common + '/portable-runtime');
const squish = require(common + '/node_modules/squish-142');
const options = { supportedRuntimes: ['142'] };
(async () => {
 const guide = fs.readFileSync(common + '/docs/homegames-context.md', 'utf8');
 for (const [heading, capacity] of [['14.1 Single-player', 1], ['14.2 Multiplayer', 8]]) {
   const section = guide.slice(guide.indexOf('### ' + heading));
   const source = section.match(/```js\n([\s\S]*?)\n```/)[1];
   const project = await createProject({ 'index.js': source }, options);
   assert.equal(project.manifest.formatVersion, 2);
   assert.equal(project.metadata.maxPlayers, capacity);
   const archive = await exportArchive(project);
   const roundTrip = await importArchive(archive, options);
   assert.equal(roundTrip.revision, project.revision);
   const GameClass = loadTrustedGame(project, { '142': squish }, { trusted: true });
   const game = new GameClass({});
   if (capacity === 1) {
     game.button.node.handleClick(7, 50, 50);
     assert.equal(game.score, 1);
   } else {
     game.handleNewPlayer({ playerId: 7, info: { name: 'Tester' } });
     game.handleNewPlayer({ playerId: 12, info: { name: 'Other' } });
     assert.equal(Object.keys(game.base.getChildren()).length, 4);
     game.handleKeyDown(7, 'ArrowRight');
     game.tick();
     assert.equal(game.players[7].node.node.coordinates2d[0][0], 48);
     assert.equal(game.players[12].node.node.coordinates2d[0][0], 47);
     game.handleKeyUp(7, 'ArrowRight');
     game.handlePlayerDisconnect(7);
     game.handlePlayerDisconnect(12);
     assert.equal(Object.keys(game.base.getChildren()).length, 0);
   }
   game.close();
   console.log(heading + ': v2 import/export round-trip, constructor, input, lifecycle passed');
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
