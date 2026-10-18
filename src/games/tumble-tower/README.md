# Tumble Tower

Set up the blocks and knock them over.

Choose a ready-built tower, bridge, or domino row; pick a ball; then tap exactly where you want to hit. There are no lives, timers, or failure screens. Three stars celebrate how much of the structure has moved, and **rebuild** restores it immediately.

- **Bounce:** a light rubber ball that rebounds and rolls.
- **Heavy:** a dense ball with less bounce and more momentum.
- **Pop:** a star ball that makes one soft radial blast on contact. Nearby pieces receive stronger impulses than distant ones.
- **Build yours / your build:** choose a brick, cube, or plank and tap anywhere in the open play area to drop it there. **Turn** rotates the next block. Up to 24 pieces remain fully physical while building: they fall, balance, slide, and wobble; there are no lanes, snapping, or fixed supports. **PLAY** changes the tool tray to balls without moving or stopping the blocks. Rebuild restores the arrangement recorded at PLAY. **Clear** empties the building area. Your latest custom design is saved automatically when placing blocks, starting play, leaving the session, or when the blocks finish settling. Playing with a preset preserves it; **your build** recalls it. Destruction does not replace the rebuild layout. Reloading starts with the tower preset; your saved build is available in its tray button. Saved builds restore position and rotation, without projectiles or motion.

Touch and mouse use large picture buttons. Landscape is recommended on phones; portrait remains playable with a smaller stage. Keyboard: arrows move the aim/drop marker; 1/2/3 choose a ball or shape; Space throws/drops; Enter starts play; X turns the next block; R rebuilds/clears; B recalls your custom build, Q/E cycle tools, and V cycles presets. Held inputs never repeat; brief rate limits keep rapid taps bounded. Sound can be muted instantly and its setting survives reloads. Failed saves show a retry control.

Controller: D-pad or left stick moves the aim/drop marker; shoulders cycle tools. Bottom face button throws/drops, right face rebuilds/clears, left face recalls your build, top face turns the next block, Start begins play, and Select cycles presets. Direction changes act once per press, so release the stick or D-pad to move the marker again.

## Physical behavior

The portable solver uses 120 Hz substeps, circle/box and box/box contacts, clipped contact manifolds, coupled face impulses, mass, inertia, angular response, friction, restitution, and sleeping support islands. Blocks topple from actual projectile contact; the game never assigns a canned scatter animation. A nudge can propagate through eleven dominoes. Removing an expired projectile wakes any sleeping blocks that depended on it for support. Factory presets start at rest; free builds always begin awake. Walls keep toys inside the stage and clear of the tool tray.

Impact sounds follow actual material and contact speed: wood clacks, rubber boings, heavy thuds, rolling textures, launch whooshes, and a soft pop-boom. Thirty original quiet PCM WAVs are generated locally, with a four-voice cap and no external downloads. Scene pools cap projectiles at four, sparks at 26, ripples at three, and blocks at 24. Simulation uses elapsed time with at most 100 ms of catch-up per tick and fixed 120 Hz physics substeps. A long host stall pauses excess simulation time. Settled scenes avoid repeated drawing while audio finishes independently.

Run the game, physics, material-audio, structure, held-input, and production GameSession-frame checks:

```sh
node --test test/games/TumbleTowerLaunch.test.cjs test/games/TumbleTowerSave.test.cjs
node testRunner.js ./test/games/TumbleTower.test.js ./test/games/TumbleTowerPhysics.test.js ./test/games/TumbleTowerAudio.test.js ./test/games/TumbleTowerStructures.test.js
```

Squish 1.5.0, single player, 3:2 landscape. All source and assets travel in the portable game bundle. Browser checks: `node test/tumble-tower-browser.cjs` and, after rebuilding homegamesio, `node test/tumble-tower-package-browser.cjs`. Local performance diagnostic: `node tools/tumble-tower-performance.cjs`. Physical phone/controller comfort and real-player enjoyment still need acceptance. MIT; see LICENSE.
