# Aquarium Forever validation

## Automated checks

Passed:

```text
Aquarium Forever static validation passed.
Aquarium Forever smoke test passed. Nodes: 1353
```

The smoke test used two joined players. The shared scene contains 1,289 nodes before private player UI. Each active player UI uses a fixed 32-node slot, so the eight-player maximum is approximately 1,545 nodes.

## Covered behavior

- Literal SquishJS 1.4.2 metadata
- Literal multiplayer service declaration
- Solo-compatible shared aquarium startup
- Real scene-graph click routing into the aquarium
- Food ownership and per-player scoring
- Two-player score isolation
- Private shop visibility and click isolation
- Fish purchases through rendered shop rows
- Decoration tab switching
- Bubbler purchase and automatic owner-attributed food
- Reuse of disconnected player UI slots without scene growth
- Stable scene graph during 5,000 randomized simulation ticks
- Finite polygon and text coordinates
- Safe point-number clamping
- Data-only checkpoint export

## Long-session properties

- Fish, food, accessories, bubbles, and score floaters are fixed pools.
- Normal gameplay does not add or remove render nodes.
- A full food pool reuses its oldest pellet instead of allocating.
- Disconnected player HUD/shop slots can be reassigned to later players.
- Fish never starve or die.
- Settled food expires after a bounded interval.
- Upgrade costs and points are clamped below JavaScript's unsafe integer range.

## Remaining real-runtime checks

The production `squish-142` renderer was unavailable in this environment. The first Homegames playtest should verify:

- Private shop filtering in both hosted and local/frameless modes
- Text layout at narrow browser sizes
- Fish visibility and movement at the real aspect ratio
- Eight-player feeding pressure and food-pool behavior
- CPU usage after several hours with the shop open and closed
- Hosted-session lifetime and any platform suspension behavior

Cross-session persistence is not claimed. `exportCheckpoint()` is available for a future Homegames save/restore integration, but the platform must invoke and restore that data.

## Runtime text-node fix

The initial package incorrectly replaced `GameNode.Text.node.text` with raw strings during HUD, shop, and floating-score updates. In SquishJS 1.4.2, `node.text` is the complete text-info object. Replacing it destroys fields required by serialization and can cause `Cannot read properties of undefined (reading 'length')`.

The fixed build mutates text through helpers that preserve the complete text-info object, including `x`, `y`, `size`, `align`, `color`, and `font`. The mock renderer was also corrected to match the production text-node structure, and the stress test now asserts that every text node retains a valid object and color.

## Fish visibility regression

The pooled-shape hide helper no longer writes a transparent `color` value. Starter fish are verified to contain at least five non-zero, opaque polygon parts after construction.
