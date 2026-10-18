# Aquarium Forever — Manual Feeding Fix

This build preserves the previous ViewableGame + multiplayer performance pass and fixes manual feeding responsiveness.

## Fixed

- Restored fish AI spatial-grid lookups after the performance pass changed bucket keys from strings to numeric keys.
- Very close manual food drops are consumed immediately so clicking beside a fish reliably produces a bite/reward.
- Slightly farther manual food reserves the nearest fish for a short period.
- Reserved fish tracks the moving pellet every 30 Hz simulation tick with a stronger feeding chase.
- Manual food falls slightly slower than automatic/system food.
- Reserved manual food uses a slightly more forgiving eat radius.

## Validation

- `node --check` passes.
- Manual-feeding regression test passes for immediate and chase feeding.
- Aquarium multiplayer mock join/tick smoke test passes.
- Space multiplayer mock join/tick smoke test passes.
