# Rainbow Pop

A gentle balloon garden for little hands. Tap six smiling balloons in any order to make a rainbow and celebrate with Bunny. After a short celebration, a fresh set appears automatically. There are no scores, losses, deadlines, or menus to read.

## Play

Find **Rainbow Pop** in the Homegames local library (game key `RainbowPop`) and choose browser play. If Homegames was already running when the game was added, refresh its library or restart it to discover the new game.

For a standalone preview, run `node tools/rainbow-pop-preview.cjs` from the homegames-core directory and open [Rainbow Pop](http://localhost:9897/?game=rainbow). The preview also includes the Little Playtime game picker. It uses the real Homegames browser client and does not require restarting the main server.

- **Touch or mouse:** tap a balloon. The generous hit area includes its edges; tapping anywhere else makes little stars and cheers Bunny.
- **Keyboard:** space, Enter, arrows, letters, or numbers pop the next balloon. A held key only pops once, until released.
- **Gamepad:** any face button pops the next balloon.
- **Sound:** the top-right sound button switches the soft musical notes on or off. Browser audio begins after an interaction; platform sound settings also apply.

The square playfield fits portrait and landscape screens. Balloons gently bob in place and wait for the child. The six colors have different note pitches, and popping a balloon briefly displays its color name. Text is optional to play.

## Implementation

`index.js` contains the game and original polygon illustrations; `audio.js` generates quiet PCM WAV notes and a short celebration melody. All assets are generated locally, with no external downloads. The same game runs in browser-local and hosted Homegames sessions using Squish 142. Particle and sound pools are bounded, and replay resets the current game in place.

Run the focused regression checks from the homegames-core directory:

```sh
node testRunner.js ./test/games/RainbowPop.test.js
```
