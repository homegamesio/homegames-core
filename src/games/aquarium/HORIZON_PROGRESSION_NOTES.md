# Aquarium Forever — Horizon / Era Progression Pass

## What changed

- The game still directly exports one `AquariumForever extends ViewableGame` class.
- Added the **Horizon**, a procedural achievement world extending east of the largest aquarium.
- Every Era contains **6 permanent monuments**:
  1. Beacon
  2. Palm Isle
  3. Ocean Arch
  4. Leviathan
  5. Skyline
  6. Era Gate
- Current-Era monuments unlock from total points earned during that Era. The Horizon only begins revealing after space has been unlocked.
- Completed Era monuments remain permanently visible after a reset, so the eastward world becomes a physical history of the session.
- Press **T** or use the new Horizon camera button to jump to the furthest unlocked monument.
- Horizontal camera bounds expand only as monuments unlock. Locked future world is not navigable/rendered.

## New Era / prestige loop

- Completing all six current-Era monuments unlocks **Begin a New Era** in the TANK shop tab.
- Solo sessions require a second confirmation click within four seconds.
- Multiplayer sessions use a strict majority vote, because an Era reset affects the shared aquarium.
- A New Era resets aquarium economy, tank tier, fish, aliens, decor, space unlocks, and transient simulation state.
- Completed Horizon monuments remain.
- Each completed Era permanently multiplies all feeding rewards by **1.75x** (compounding, with a safety cap).
- Era earning targets grow by **3x** until the numeric safety ceiling is reached, after which repeated Eras remain possible and get progressively faster from the permanent multiplier.

## Performance properties

- Horizon monuments are plain procedural data; there is no always-live Horizon simulation.
- Only monuments overlapping a player's current camera become render nodes.
- Visible Horizon markers are capped at 8 per player.
- Each visible marker uses a bounded 7-shape rig; labels disappear at distant zoom.
- Outside the Horizon, the feature adds essentially no render-tree work. Existing fish/alien spatial indexing and view caps are unchanged.
- The manual `ViewableGame` world plane is enlarged while the aquarium remains centered at world x=512, preserving existing aquarium coordinates/checkpoint geometry.

## Interaction fixes preserved

- Manual fish feeding still uses immediate close bites and hard chase reservations.
- Clicking in the Horizon no longer creates food clamped back into the aquarium; feeding is restricted to actual water/space biome bounds.

## Validation performed

- `node --check` passes.
- Mocked runtime join/tick smoke test passes.
- Horizon unlock/render test passes.
- Solo New Era double-confirm test passes.
- 3-player majority-vote New Era test passes.
- Era reset restores six starter fish and starter economy.
- Completed monuments remain renderable after reset.
- Manual close-drop feeding regression test passes after an Era reset.
- 8-player / 500-fish synthetic aquarium-only benchmark showed no measurable regression from adding the dormant Horizon system.

No `catalog.js` changes are required by this pass; keep using the existing game catalog alongside this `index.js`.
