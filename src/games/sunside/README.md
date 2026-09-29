# Sunside — character studio

An asset-free Homegames character showcase and volleyball timing game. Mika is a 25-year-old volleyball captain, rendered entirely from procedural polygons: character, facial details, hair, outfits, accessories, ball and beach.

## Play

Open the included `sunside.html` for offline play, or install this `sunside` folder in `homegames-core/src/games/`. Keep all seven JavaScript modules together. The native entry point targets Squish 142, runs at 20 ticks per second and supports one player.

| Control | Action | Keyboard |
| --- | --- | --- |
| Look | Cycle Coast swim set, Court uniform and Summer dress | O |
| Color swatches | Change outfit color | Pointer |
| Golden Hour / Daylight | Change scene lighting | Pointer |
| Wave / Free View | Wave, or leave a rally | W |
| Dance / Stretch / Idle | Select a looping animation | M / R / I |
| Full / 3/4 / Face | Select a camera preset | V for 3/4; P for Face |
| Auto | Toggle slow automatic orbit | T |
| Drag scene | Turn the camera; stops Auto | A/D or arrow keys |
| Plus / minus | Zoom between full view and portrait | + / − |
| Start a Rally / HIT / Play Again | Start, return the ball, retry | Space / Enter |

Return the ball when the marker reaches green. Twelve returns win; close timing earns a perfect. Holding the input does not automatically play the round. Best score, outfit, color and lighting save through Homegames. Existing version-one best scores migrate automatically.

## Modules

| File | Responsibility |
| --- | --- |
| `index.js` | Literal metadata, Homegames scene graph, UI, input, rally state and saves |
| `settings.js` | Brand copy, palettes, camera presets and gameplay tuning |
| `geometry.js` | Vectors, polygon mesh construction, ellipsoids, tubes and rings |
| `animation.js` | Joint pose sampling, arm solver, pose blending and secondary hair motion |
| `character.js` | Character geometry, face, hair, accessories and ball |
| `wardrobe.js` | Outfit catalog and procedural garment geometry |
| `projection.js` | Software camera, clipping, shading and depth sorting |

Geometry uses meters with Y up and +Z forward. `buildCharacter` returns polygon faces. The renderer projects those faces into ordinary Homegames `GameNode.Shape` nodes. No WebGL, textures, imported models, images, custom fonts or sound assets are needed.

The development ZIP also includes the browser runtime, an offline build script, verification script and `HANDOFF.md`. Run `node tools/build.cjs` in the unpacked kit to rebuild the HTML after editing game modules.

## Current limits

This is a desktop-first prototype. The square layout fits phone screens, but the secondary controls and labels are small. Depth sorting uses average polygon depth rather than a depth buffer; intersecting surfaces can still show artifacts. The arms use a two-bone solver, while pose transitions interpolate joint positions and the feet use authored procedural positions. Hair and fabric have bounded secondary motion; this is not a general cloth simulator.

The scene reuses an 800-face pool. The verification sweep observed at most 657 visible faces and a largest sampled master frame of 54,647 bytes before transport overhead. Offline play is the main showcase path; hosted bandwidth and low-end device performance need measurement. Sound is deferred.

GPL-3.0; see `LICENSE`.
