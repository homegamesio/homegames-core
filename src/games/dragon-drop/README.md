# Dragon Drop — drag ’n’ drop

A cozy, single-player physics puzzler. Pick up Ember, Clover, Nimbus, Sunny, Plum, or Dew; carry the dragon into the sanctuary; release to let it tumble. Three touching dragons of the same kind charge up and fly home, gently disturbing the pile and setting off new matches. Keep the pile below the cloudline.

## Controls

- Mouse or touch: drag one of the three dragons into the sanctuary. The held dragon stops above the pile; the guide shows the space below it. Release at the visible position with a little momentum, or hold still first for a straight drop.
- Tap a dragon, then tap the sky for the same action without holding a gesture. Keys 1–3 also select a dragon.
- Release outside the sanctuary or press Escape to cancel a drag without consuming the dragon. Browser blur, touch cancellation, and disconnection also cancel safely.
- Pause button or P / Escape: pause and resume. The pause menu offers a fresh sanctuary and gentle motion, which removes flying celebrations, particles, and squash/stretch while preserving gameplay.
- Sound button or M: toggle the soft plucks. Best score and these preferences use the Homegames save system. The current pile starts fresh when the game is reopened.

## Implementation

Uses Squish 1.4.6's one-press / move / release input contract. Simulation advances at 60 fixed steps per second; acceleration uses the squared timestep, with a spatial hash, iterative circle contacts, sleeping bodies, and support checks after matches. The normal opening contains 26 dragons, with a fixed budget of 96 bodies, 24 flyaway sprites and 64 particles. Stable bodies update their visual nodes only when their pose or expression changes. Physics and scoring do not depend on animation effects.

Sprites, scenery, and cover are authored SVGs, one image node per dragon, with six silhouettes/palettes and open, blinking, and happy expressions. No external media or network requests. Regenerate the SVGs and quiet WAV plucks with `node tools/dragon-drop/build-art.cjs` from the core repository. Set `SHARP_MODULE` to an installed `sharp` module path to also render `cover.png` for the catalog and app icons. Artwork generation does not run in the game.

Local preview: `node tools/dragon-drop/serve.cjs`, then visit `http://127.0.0.1:8797`. It loads the sibling client bundle. Rebuild the website/client with `npm run build:local` from `homegamesio` when changing shared input behavior.

Regression coverage includes actual mouse/touch input routing, cancelled drags, release placement, landing clearance, no free opening matches, repeated seeded play, matching/settling, pause/replay/saves, and serialized frame bounds. Hardware frame rate still depends on the browser and device.

Original `LICENSE` is preserved. Source originally consolidated from `dragon-drop-main.zip`.
