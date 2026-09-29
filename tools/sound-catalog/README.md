# Sound Catalog Generator

Synthesizes the Homegames stock sound library from scratch — no dependencies, no
samples, pure math. Because every sound is generated, the output is an original
work: safe to publish CC0 in the public asset catalog for anyone to use.

## Usage

```bash
node tools/sound-catalog/generate.js                    # writes everything to output/
node tools/sound-catalog/generate.js output ui-click    # regenerate a single sound
```

Output is deterministic (seeded RNG) — rerunning produces byte-identical files.

Listen on macOS:

```bash
afplay tools/sound-catalog/output/coin.wav
for f in tools/sound-catalog/output/*.wav; do echo $f; afplay $f; done
```

## What's in it

- **UI** (10): click, tick, select, back, error, notify, countdown beep/go, timer tick/tock
- **Feedback** (13): success chime, win fanfare, fail notes, lose womp, coin, point,
  powerup/powerdown, level-up, correct/wrong, streak riser
- **Action** (27): jump, land, hit, punch, lasers, zap, explosions, whoosh/swoosh,
  bounce, boing, billiards clack + pocket drop, splash, drip, pop, bubbles, sparkle,
  teleport, alarm, heartbeat, footstep, card flip, dice roll, gunshot, ricochet
- **Ambient loops** (9, seamless 24s stereo): calm pad, space drone, spooky, dungeon,
  desert wind, underwater, rain, ocean waves, tension pulse
- **Music loops** (3, seamless 24s stereo): chill (80bpm), upbeat chiptune (120bpm),
  mystery arpeggio (90bpm)

`output/manifest.json` lists every sound with name, description, tags, duration,
loop flag, and license — intended to drive catalog upload/metadata.

## Format notes

- 44.1kHz 16-bit PCM WAV. SFX are mono; loops are stereo.
- Loops are crossfade-wrapped so they repeat seamlessly.
- Loops are normalized to -5dB-ish peak (quieter than SFX) so background audio
  doesn't fight effects.
- To shrink loops (~4MB each) before upload: `afconvert -f mp4f -d aac <in>.wav <out>.m4a`
  or `ffmpeg -i <in>.wav -q:a 3 <out>.mp3` — check client codec support first.

## Fetching third-party CC0 collections

`fetch-cc0.js` downloads audio that is verified legal to re-host in the public
catalog (CC0 / public domain only — every source page is re-checked for the CC0
marker at fetch time before downloading):

```bash
node tools/sound-catalog/fetch-cc0.js --dry-run              # preview everything
node tools/sound-catalog/fetch-cc0.js                        # kenney + oga + freepd default genres (~1.1GB)
node tools/sound-catalog/fetch-cc0.js --sources kenney,oga   # just the SFX packs (~100MB)
node tools/sound-catalog/fetch-cc0.js --sources freepd --freepd-genres epic,horror,upbeat
```

Sources:

- **Kenney.nl audio** (CC0): ui-audio, rpg-audio, digital-audio, casino-audio,
  impact-sounds, sci-fi-sounds, interface-sounds, music-jingles, 2 voiceover packs
- **Kenney.nl 2D art** (CC0, `--sources kenney-images`): 23 packs of
  placeholder-friendly sprites/tiles/UI — prototype-textures, shape-characters,
  physics-assets, pixel/new platformer packs + characters + backgrounds,
  pixel-shmup (space shooters), tiny-dungeon/tiny-town/rpg-urban/roguelike-rpg,
  playing-cards + boardgame, animal + fish packs, ui-pack, game-icons,
  emotes-pack, particle-pack, puzzle-pack-2, sokoban, racing-pack
- **OpenGameArt** (CC0 packs only): Juhani Junkala's 512 retro SFX, rubberduck's
  100+100 general / 50+60 sci-fi / 80 creature SFX packs
- **FreePD music** via its archive.org mirror (freepd.com shut down in 2025; the
  files are CC0 forever): comedy, electronic, epic, featured, horror, romantic,
  scoring, upbeat, world genres by default. The item's root and `Page2/` are
  excluded — they contain unvetted strays. `misc` (950MB) is opt-in via
  `--freepd-genres all`.

Everything lands in `downloads/<source>/...` (gitignored) with
`downloads/sources-manifest.json` recording license, author, and source page per
collection — feed that into catalog upload metadata. Re-runs skip existing files.

Not fetched on purpose: Sonniss/Pixabay/ZapSplat/Mixkit ("royalty-free" but ban
redistribution) and CC-BY sources like Incompetech (would require carrying
per-track attribution through the catalog).

## Files

- `synth.js` — the synthesizer: oscillators, noise sources (white/pink/brown),
  filters (one-pole LP/HP, state-variable band-pass), envelopes, echo, seamless
  loop construction, WAV writer.
- `generate.js` — the catalog definitions and CLI.
- `fetch-cc0.js` — downloader for re-hostable third-party CC0 collections.
