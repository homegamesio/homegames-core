# Home Run

One button. Big little hits.

A native Homegames baseball game for one player. Choose **Classic**, **Halloween**,
or **Christmas**, then play a ten-ball round. Pitches arrive automatically. Tap
the field or the big **SWING** button when the baseball reaches the ring. Space,
Enter, or a gamepad's primary button also swings. The ring brightens and the
button changes when the ball can be hit; timing never relies on color alone.

The contact window is a generous 0.84 seconds. Swing timing determines direction
and power: early hits go left, late hits go right, and centered hits travel farthest.
Ballistic flight determines the distance. Singles earn one point, doubles two,
triples three, and hits beyond the 90-meter fence earn four. An early empty swing
can be tried again on the same ball after a short cooldown. Missed balls move on
with encouragement. There are no strikes, outs, running controls, or eliminations.
Holding a pointer, keyboard key, or gamepad button never repeatedly swings.

Classic has a sunny neighborhood field. Halloween adds pumpkins, friendly ghosts,
flying bats, a crescent moon, and a witch hat. Christmas brings falling snow,
decorated trees, presents, fence lights, and a Santa hat. The same gentle pitch
speed and scoring apply at every park.

- **Pause** or Escape/P: pause/resume; the pause panel can return to park selection.
- **Sound** or M: mute/unmute the original, locally synthesized effects.
- **Left/right arrows** or gamepad D-pad: choose a park between rounds.
- **Gamepad Start**: pause/resume. Secondary button: sound.

Each park remembers its best completed score through `saveGame`/`saveData`.
Theme and sound preferences persist too. Unfinished rounds are not saved. A failed
save offers a retry on the results card. A disconnected player resets the round;
the next player can start fresh. Pausing stops the ball, and gaps longer than
half a second between host ticks discard that gap so a suspended tab does not
silently consume pitches. There is no wall-clock time limit.

All art is Squish geometry and all audio is bundled locally. There are no network,
font, image service, or other game-folder dependencies. The normal Core library
scan discovers the game from its metadata. No public-site configuration is changed.

From homegames-core:

```sh
START_PATH=./src/games/home-run npm start
node --test test/games/HomeRun.test.cjs
node test/home-run-browser.cjs --serve
```

The preview runs at http://127.0.0.1:4201 (override with `HOME_RUN_PORT`). Run the
browser script without `--serve` for acceptance checks using the real portable
loader, client, input, renderer, and save store. It plays an entire ten-pitch round
with mouse/keyboard, then checks emulated phone touch batting in both seasonal
parks, pause, mute, and records/preferences after reload. The script accepts
`PLAYWRIGHT_MODULE` and `CHROME_PATH`. Node 24 and local Chrome are recommended.
Screenshots and results go to a printed temporary directory. No game state or
clock is injected by that browser check. Physical-device and child playtesting
remain useful for judging comfort and difficulty.

- `engine.js`: timing, ballistic hits, ten-pitch round and score.
- `themes.js`: three park palettes and bounded save data.
- `art.js`: retained geometric ballparks, players, ball, effects and interface.
- `index.js`: Homegames lifecycle, controls, pause, sound and persistence.
- `assets/`: original PCM effects and an actual gameplay thumbnail.

MIT; see LICENSE.
