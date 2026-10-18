'use strict';
// Reproduce the existing 32-game launch selection without editing newer games.
// HOMEGAMES_CLIENT_BUNDLE selects the unpublished touch-focus fix when needed.
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const {readConfig}=require(path.join(root,'../homegamesio/scripts/build-game-library'));
const {buildSite}=require(path.join(root,'../homegamesio/scripts/build-site'));
const keep=require(path.join(root,'docs/launch-catalog-review-2026-10-17.json')).games.filter(g=>g.decision==='keep').map(g=>path.join(root,'src/games',g.id));
buildSite(readConfig(['--games',...keep]),{output:process.env.HOMEGAMES_REVIEW_OUTPUT||'/tmp/homegames-fleetfall-reviewed-site'}).then(({output,collection})=>console.log(`Built ${collection.games.length} reviewed games (${collection.featuredGames.length} featured) at ${output}`)).catch(e=>{console.error(e);process.exitCode=1;});
