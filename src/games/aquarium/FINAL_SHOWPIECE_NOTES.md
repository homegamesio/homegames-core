# Aquarium Forever — Ultimate Showpiece Pass

This pass is built on the 60 Hz gameplay-rewards version. The exported `index.js` remains a single `AquariumForever extends ViewableGame` class and keeps the visibility-streamed, per-player manual-projection architecture.

## New showpiece systems

### Creature individuality
- Every fish and alien has a stable generated name.
- Logical lifetime stats: age, bites eaten, lifetime value produced, and last player who fed it.
- At close zoom, clicking a creature still feeds it **and** opens a temporary inspection card. There is no separate inspect mode to fight the clicker loop.
- Maximum camera zoom increased from 5x to 8x for true creature-level inspection.

### Rare mutations
Normal purchased/spawned creatures can very rarely be:
- GIANT
- TINY
- NEON
- ROYAL
- ANCIENT
- PRISM

Mutations alter scale/palette and have real reward multipliers. Mutants are isolated from far-zoom clustering and receive high detailed-LOD priority so the interesting creature is not visually swallowed by its school.

### Three new permanent WORLD upgrades
- **GENE GARDEN** — visible glowing genetics sanctuary; increases mutation chance and mutant value.
- **WORLD ENGINE** — visible deep-space machine; makes world events arrive sooner and increases their economic power.
- **MIGRATION GATE** — colossal aquarium arch; increases fish cap and massively amplifies Great Migration rewards.

Like the existing permanent WORLD systems, all three survive New Era resets.

### World Event Director
A single sparse event can periodically transform the shared world. The first event of an Era is scheduled soon enough to be demo-visible; later events are rarer.

Events:
- **FEEDING FRENZY** — fish hunger surges; water bite rewards spike.
- **BIOLUMINESCENT BLOOM** — electric underwater presentation plus boosted water rewards.
- **THE GREAT MIGRATION** — the fish population visibly moves together across the tank; boosted migration rewards.
- **TREASURE TIDE** — high-value golden food rains into the aquarium.
- **METEOR SHOWER** — cosmic food and visible meteor streaks flood space.

Events reuse existing creature/food simulation and small fixed render pools rather than introducing permanent new populations.

### Better multiplayer presence
Manual food remembers its player. Creature inspection shows the last player who fed that creature, and golden jackpots credit the feeder by name in the global celebration.

### New Era ceremony
After a successful New Era vote/reset, every connected player is briefly shown the newest preserved Era Gate on the Horizon. After the preservation moment, cameras are released back toward the fresh aquarium. This makes prestige visibly connect the permanent history world to the new run.

### Demo-friendly rarity
- The first golden visitor of an Era arrives substantially sooner than repeat golden visitors.
- The first world event of an Era likewise arrives sooner than subsequent events.
- Repeat cadence remains rare enough that both systems still feel special.

## Performance constraints preserved
- Authored tick rate remains **60 Hz**.
- Per-player scene graphs remain visibility-capped.
- Mutations/identity add logical fields, not one node per creature.
- Inspection is one tiny per-player overlay.
- World events reuse existing food/creature populations plus tiny effect pools.
- Mutants are rare and only add a handful of extra singleton representatives at wide zoom.
- Existing spatial indexing, detached slot reuse, LOD, fish clustering, feeding fixes, Horizon pooling, and biome unification remain intact.

## Validation performed
The local SquishJS runtime stub suite covers:
- aquarium join/ticks at 60 Hz
- all previous WORLD numerical bonuses
- golden fish and golden alien payout paths
- permanent WORLD persistence through New Era
- 8-player spectacle stress
- named/mutated creature creation and economic multipliers
- inspection overlay and feeder attribution
- mutation survival through overview clustering
- event frequency/power upgrades
- Great Migration simulation behavior
- water event presentation pools
- Meteor Shower cosmic-food and streak rendering
- 8-player active-Great-Migration stress
- New Era Horizon ceremony and automatic camera release home

`node --check index.js` passes.
