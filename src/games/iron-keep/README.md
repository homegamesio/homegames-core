# Iron Keep — asset generation guide

The game is fully playable with placeholder ids (walls render as stretched
placeholder pixels), but it comes alive when the real assets land. Replace the
ids in `ASSET_IDS` at the top of `index.js`.

**The grid layouts below are load-bearing.** The crop math in the game assumes
exactly these arrangements — a 4x1 strip means 4 equal tiles side by side with
no padding, margins, or gutters between them. Any resolution works (percent
crops), but keep tiles equal-sized and edge-to-edge.

## Images

### `wall-sheet` — 4x1 strip, e.g. 2048x512 (each tile 512x512)
Four square wall textures side by side, in this exact order:
1. **stone block** — gray castle masonry, chunky mortar lines
2. **wood plank** — dark vertical timber with iron studs
3. **royal banner** — a crimson heraldic banner hanging on stone
4. **iron door** — riveted iron double door in a stone arch

Prompt sketch: *"retro FPS wall texture sheet, 4 square tiles side by side in
one row: castle stone blocks, dark wood planks with iron studs, crimson
heraldic banner on stone, riveted iron door. Pixel-art / Wolfenstein 3D style,
seamless within each tile, no borders between tiles, flat lighting."*

Tip: each tile should tile horizontally with itself (the left and right edges
of a tile meet on adjacent wall cells).

### `enemy-sheet` — 4 cols x 3 rows, transparent background, e.g. 1024x1152 (256x384 cells)
One knight character, full body, facing the viewer, centered in each cell with
feet on the cell's bottom edge:
- **row 0**: walk cycle, 4 frames
- **row 1**: attack (raising and firing a crossbow), 4 frames
- **row 2**: pain/flash (staggering, hit sparks), 4 frames

Prompt sketch: *"retro FPS enemy spritesheet, armored knight with crossbow,
4 columns x 3 rows on transparent background: top row walking toward viewer,
middle row aiming and firing crossbow, bottom row recoiling in pain. Doom/
Wolfenstein sprite style, consistent scale and centering across all frames,
feet aligned to bottom of each cell."*

Keep the helmet plume area neutral (gray/steel) — the game draws a colored
plume marker above the sprite for player identity.

### `hands` — 2x1 strip, transparent background, e.g. 1024x512
First-person crossbow held in two gauntleted hands, seen from the wielder's
chest, in this order: **[0] idle**, **[1] firing** (string released, bolt
gone, slight muzzle spark). Bottom edge of the image should be the bottom of
the frame (it sits flush with the bottom of the screen).

### `face-sheet` — 3x1 strip, e.g. 768x256
Doom-style status face of your knight (visor up), front-facing, in this
order: **[0] healthy** (confident), **[1] hurt** (gritted teeth, dented
helmet), **[2] near death** (bloodied, one eye shut). Solid dark background
is fine — it renders as a small HUD portrait.

### `sky` — wide panorama, e.g. 2048x512
Twilight sky over distant castle battlements and mountains, torchlit clouds.
Only a 35%-wide window is visible at once and it pans as the player turns, so
avoid a single centered landmark; spread interest across the width. The bottom
edge meets the horizon line.

## Audio

- `music` — instrumental loop, medieval-tension (taiko, low strings, war
  horns). Default loop length is **75 seconds** — if yours differs, set
  `MUSIC_LOOP_SECONDS` in `index.js` to match, or the track will restart
  early/late.
- `shoot` — crossbow twang + bolt whoosh, < 1s
- `hit` — armored impact grunt, < 1s
- `fanfare` — victory horns, ~3s (plays once at match end)

## Tuning knobs (top of index.js)

- `COLS` (40) — wall slices per player view; more = sharper + more bandwidth
- `TICK_RATE` (10) — frames/sec; 10–14 reads intentionally retro
- `HP_MAX` (3), `TARGET_SLAYS` (5), `MATCH_SECONDS` (180)
- `BOT_*` — bot fairness (telegraph time, cooldown, engage range)
