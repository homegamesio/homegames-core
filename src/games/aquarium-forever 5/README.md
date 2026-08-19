# Aquarium Forever

A shared, long-running Homegames aquarium clicker based on the original polygon aquarium.

## Core loop

- Click or tap anywhere in the water to drop a pellet.
- Each pellet remembers which player dropped it.
- When a fish eats that pellet, its owner earns points.
- Different fish species pay different point values.
- Spend personal points in the shop to add shared fish and aquarium accessories.
- The aquarium has no ending, fish never die, and all pools are fixed so the session can remain active for days.

## Multiplayer

The aquarium is shared, while points and upgrades are personal.

- Food pellets use the feeding player's color.
- The player whose pellet gets eaten receives the points.
- Purchased fish and decorations appear for everyone.
- Bubblers continue dropping bonus food for the player who bought them, even if they temporarily disconnect from the session.

The game also works normally as a solo local session.

## Shop

### Fish

- Guppy — inexpensive, worth 1 point per normal pellet value.
- Clownfish — worth 3.
- Blue Tang — worth 8.
- Angelfish — worth 22.
- Puffer — worth 65.

Fish prices increase for the player each time they buy that species.

### Decorations and upgrades

- Seaweed — increases every feeding reward by 2%.
- Coral — increases every feeding reward by 5%.
- Bubbler — periodically drops a double-value pellet credited to its buyer.
- Castle — increases its buyer's feeding rewards by 15%.
- Better Flakes — endlessly upgradeable; adds 1 to the value of every pellet dropped by that player.

## Controls

- Click/tap water: drop food
- F or Space: drop food near the center
- S or Tab: open/close the shop
- 1: fish shop
- 2: decoration shop

## Long-session design

- 72 persistent fish slots
- 144 persistent food slots
- 32 persistent accessory slots
- Fixed bubble and floating-number pools
- No gameplay node creation or removal after player UI setup
- Points and prices are clamped below JavaScript's unsafe integer range
- `exportCheckpoint()` produces a data-only snapshot for a future Homegames persistence integration

Session state lasts as long as the hosted game instance. Permanent cross-session persistence still requires the platform to store and restore the exported checkpoint.

## Fixed build note

This revision preserves the full SquishJS text-info object whenever score, shop, status, or floating-point text changes. It fixes the startup/runtime error `Cannot read properties of undefined (reading 'length')` from the original package.

## Fish visibility fix

The production renderer retains a shape's `color` value between pooled uses. The hide helper now collapses geometry and clears only `fill`; it no longer leaves active fish parts with a transparent color override.
