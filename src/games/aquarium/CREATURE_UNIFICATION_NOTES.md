# Aquarium Forever — Creature / Biome Unification

This build preserves the direct `AquariumForever extends ViewableGame` structure, the 30 Hz performance pass, and the manual-feeding fix.

## What changed

- Added a shared creature-biome registry for `water` and `space`.
- Fish now carry `biome: 'water'` / `kind: 'fish'`; aliens carry `biome: 'space'` / `kind: 'alien'`.
- Replaced separate fish/alien render-index plumbing with one per-biome spatial-index registry. Legacy `_renderFishGrid` / `_renderAlienGrid` aliases remain for debug compatibility.
- Added a common `renderCreaturePopulation()` pipeline that handles:
  - singleton/detail selection
  - lightweight/detail pools
  - stable slot binding
  - renderer dispatch
  - feed hit targets
- Added a reusable simple creature clustering helper. Space aliens use it now; future biomes can use the same path without creating another parallel renderer.
- Fish keep their specialized stabilized clustering because it solves real flicker/identity problems at aquarium scale.
- Added generic biome-aware click/food routing (`biomeAtWorldPosition()` + `dropFoodForBiome()`).
- Feed targets now carry first-class `biome` and `kind` identity.

## Intentionally not unified yet

Fish and alien **simulation behavior remains separate**. Fish schooling, caves, currents, etc. and alien gravity/wormhole behavior are meaningful biome-specific gameplay, not duplicate infrastructure. Future behavior sharing can happen selectively without forcing all creatures into one AI model.

## Validation

- `node --check` passes.
- Aquarium multiplayer mock join/tick smoke test passes.
- Populated-space multiplayer mock join/tick smoke test passes.
- Creature/biome regression test passes for:
  - water feed targets
  - space feed targets
  - biome tags/routing
  - immediate manual feeding
  - manual chase feeding
- 8-player / 1000-fish synthetic CPU benchmark is effectively neutral-to-slightly-faster versus the feeding-fix build; the refactor does not reintroduce the pre-performance-pass full-population scans.
