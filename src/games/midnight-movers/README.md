# Midnight Movers

A cooperative stealth caper for one to four players. Steal one ridiculous exhibit,
load it into the van, and get the whole crew out. All visuals are original Squish
polygons; seven original synthesized sound cues live in `assets/`.

## Three jobs

- **The Golden Goose:** a small gallery teaches sight lines, carrying, and escape.
- **Prickly Business:** a conservatory adds a door, two patrols, and a bell lure.
- **Bone Voyage:** a dinosaur museum adds cycling lasers and a temporary cutoff switch.

Each job has three optional small treasures and three medals: escape with the big
exhibit, bring every extra, and never alert a guard. Completing a job unlocks the
next one. Best times, unlocks, and medals use Homegames' save backend; in a hosted
browser game the host owns that save. Replays preserve earned medals.

## Controls

Move with WASD/arrows, a controller's left stick, or by tapping a destination.
Tap a treasure, door, bell, switch, or the van to walk there and interact.
Use **E**, controller **A**, or the large contextual button to grab/drop/interact.
Use **Space**, controller **X**, or **PSST** to whistle. **P/Escape/Start** pauses
for the crew leader. **M** toggles your sound.

One mover can drag the big exhibit. Multiple movers can grab the same exhibit and
carry it faster when they move together. Small treasures fit in one pair of hands.
Walls block sight and guard light. Bushes hide movers whose hands are empty.
Detection builds briefly before a chase; break sight and guards investigate the
last place they saw you. A catch drops your loot and returns you to the van with
a short grace period. Three catches end the attempt, with an immediate retry.

## Maintenance

- `engine.js`: deterministic game rules, guard behavior, collisions, and navigation.
- `levels.js`: three authored layouts, patrols, and interactive props.
- `art.js`: procedural scenery, characters, exhibits, and drawing helpers.
- `index.js`: Homegames lifecycle, input, per-player UI/audio, save adapter.
- `test/games/MidnightMovers.test.js`: mission-route, stealth, cooperation, and lifecycle checks.
- `test/midnight-movers-preview.cjs`: local browser and RTC acceptance harness.

Run `node testRunner.js ./test/games/MidnightMovers.test.js` from the core root.
Run the preview harness and open its printed URL for manual playtesting. Its
external test strip can unlock jobs for inspection; that control is absent from
the shipped game.

Validation: 15 game checks cover all solo routes, all optional loot, crews of two
through four, sight/occlusion, recovery, lasers, controller input, host migration,
save round-trips, and the offline audio/thumbnail bundle. The focused library and
dashboard checks also pass (33 checks total). Browser review covered the title,
walking, pickup/delivery, capture recovery, shared-carry rendering, and a 390-pixel
game container. The screenshot uses actual simulated movement/grabs in the browser
renderer; the preview's capture button holds the simulation for a stable image.

The attempted two-browser RTC invitation failed to establish a peer connection
in the in-app browser test environment. Co-op rules and per-player input are
tested, but a successful live remote co-op session still needs verification.
The browser also logs the pre-existing caught Squish `process is not defined`
startup warnings; no game-specific runtime or missing-media errors were observed.

Licensed under MIT; see `LICENSE`. No hosted assets or third-party artwork.
