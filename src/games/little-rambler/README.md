# Little Rambler

A native Homegames game about one curious companion and the little house you make together. The first version connects two short outings to care, growth, and three useful home projects.

## Play locally

From `homegames-core`, with this repository's dependencies and the sibling `homegames-client/dist/homegames-client.js` available:

```sh
node tools/little-rambler/serve.cjs
```

Open <http://127.0.0.1:9901>. The preview runs the real Homegames LocalSession, Squish codec, renderer, input dispatcher, audio assets, and local save service. `LITTLE_RAMBLER_PORT` changes the port. The server listens only on loopback.

To build a single HTML file that plays offline:

```sh
node tools/little-rambler/build.cjs
```

Open `tools/little-rambler/little-rambler.html` in a browser. The build embeds both the client and game modules; no external media or network connection is needed. The preview and offline file have separate browser storage origins. Saves remain in the browser/profile where you play, under the game's `little-rambler-v1` namespace; native hosted sessions use Homegames' supplied save callback.

## The first loop

- **Get to know Pip.** Pet your companion, share unlimited oat bites or a berry, discover a favorite flavor, and choose a name and coat in Field notes. There is no hunger penalty or lost progress while away.
- **Forage in the giant garden.** Run and hop over stepping leaves to find berries and seeds. The homeward gate gives a seed bonus, and the ground route can fund the first planter. Higher paths reward jumping.
- **Salvage in the junk lagoon.** Aim a magnet through a field of floating scrap and lily bumpers. Trajectory, rebound, and collection use a fixed-step physics simulation.
- **Bring discoveries home.** A planter costs two seeds and grows a berry after 45 active home seconds; a bell costs four scrap; a hammock costs one seed and seven scrap. Pip visits each finished project independently. Click a ripe berry to harvest it.
- **Grow together.** Care, outings, and projects contribute to growth. The first growth stage improves hopping, and the next adds a lagoon cast. Field notes record milestones.

Both outings have a Head home button, finite timers, and a results screen. Collected supplies are banked once, including when an active session is closed or disconnected. The first version includes one garden course, one lagoon layout, three projects, four growth stages, and three coats.

## Controls

| Place | Controls |
| --- | --- |
| Home and menus | Click/tap; arrows to select an action, Enter or Space to choose |
| Home shortcuts | F: oat bites, V: berry, H: pet, E: outings, C: projects, J: field notes |
| Garden | Left/right or A/D; Space, Up, or W to hop; on-screen movement and Hop buttons |
| Lagoon | Drag from the magnet toward a desired launch direction and release; or arrows to aim and Space/Enter to cast |
| Outings | P or Escape to pause; on-screen Head home banks discoveries |
| Audio | M or Music button; separate sound toggle in Field notes |
| Naming | Click the name field for native text entry, or edit with keyboard and save |

Homegames gamepad bindings map the directional controls, primary button, back, and pause actions. Landscape is the intended layout for small touch screens.

Custom cursors use Homegames' native per-player cursor API: a leaf pointer, soft petting hand with a brief pat pose, oat and berry snacks, a picking hand over ripe fruit, and a magnet that changes while aiming and casting. Hovered buttons highlight. Cursor assets and their editable vector sources live in `cursors/`; touch and keyboard controls do not depend on hover.

## Implementation and assets

`index.js` is the native Squish 142 entry point, with literal metadata, a single player, a 16:9 scene, and 30 game ticks per second. `engine.js` owns saved state, care, home behavior, collision, and the 120 Hz simulation. `scene.js`, `painter.js`, and `creature.js` reuse a bounded scene graph to draw active scenes and expressive character poses. The game itself uses no browser globals, DOM, filesystem, timers, or network requests.

`audio.js` synthesizes three original musical arrangements and short effect cues as native PCM assets, with bounded playback voices. Background artwork was generated for this project with the built-in image generation tool. Original PNGs, compressed JPEGs, embedded asset modules, and the exact final prompts are preserved in [art/README.md](art/README.md). Pip, furniture, resources, and the interface are procedural Squish geometry. No Crunchling Adventure art, music, names, or assets are included.

## Verification

```sh
node testRunner.js ./test/games/LittleRambler.test.js ./test/games/LittleRamblerEngine.test.js
```

The 23 focused tests cover state validation, care cooldowns, growth, a complete reward-to-project loop, platform collisions and buffered jumps, deterministic salvage physics, one-time rewards, real input dispatch, quick taps, held controls, focus navigation, overlapping harvest targets, cursor selection and animation, scene resets, pause, saving, ownership, and native Squish serialization across every screen.

`tools/little-rambler/browser-smoke.cjs` checks native boot, desktop and landscape-phone rendering, and offline loading. `tools/little-rambler/browser-play.cjs` plays through care, naming, the garden, planter construction, a dragged magnet cast, bell construction/use, and save reload with real pointer and keyboard inputs. `tools/little-rambler/browser-touch.cjs` verifies touch care, the native name prompt, a quick hop, held movement, and casting. These optional browser helpers require Playwright and Chromium; `PLAYWRIGHT_MODULE` and `CHROME_PATH` can point to existing installations. Browser QA uses fresh profiles and ephemeral ports, separate from the player's save.
