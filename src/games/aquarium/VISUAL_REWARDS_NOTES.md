# Visual Rewards + Golden Visitors

## Golden visitors
- One rare golden visitor can exist at a time.
- Event interval: roughly 85–155 seconds while players are connected.
- Before space unlocks, the visitor is a golden fish. After space unlocks, the event can also be a golden alien.
- The visitor remains for 32 seconds.
- The first food it eats pays exactly 50× that creature's normal bite value (after the normal tank/Era/decor multipliers), triggers a jackpot celebration, then the visitor leaves.
- Golden visitors are forced into singleton LOD representation and absolute detail priority so clustering/culling cannot hide the event.
- Rare visitors do not count against owned fish/alien caps and are removed from logical collections after claim/expiry.

## WORLD shop
The old TANK help/tutorial rows were removed. The third tab is now labeled WORLD and pages like LIFE/DECOR.

WORLD contains real actions only:
- Tank expansion / Break the Surface
- Visit Horizon
- Begin New Era
- Permanent visual spectacle upgrades

## Permanent spectacle upgrades
These persist through New Era resets.

1. SUN SHAFTS — up to 4 levels; moving light columns through the aquarium.
2. GIANT KELP — up to 5 levels; tall swaying kelp groves.
3. CROWN REEF — up to 4 levels; large coral crown structures.
4. NEBULA CLOUDS — up to 4 levels; translucent deep-space color blooms.
5. ORBITAL SANCTUARY — up to 4 levels; a growing orbital station.
6. HORIZON LIGHTS — up to 5 levels; pulsing beacons above earned monuments.
7. AURORA WHALES — up to 3 levels; enormous translucent creatures crossing the upper void, unlocked in Era 2.
8. WORLD CROWN — up to 3 levels; a colossal orbital crown, unlocked in Era 3.

All spectacle systems are presentation-only and strictly capped. They add no AI or gameplay simulation.

## Performance / validation
- `node --check index.js` passes.
- Mock runtime smoke covers: player join/ticking, WORLD menu, spectacle purchase/render, golden fish 50× payout, golden alien 50× payout, rare cleanup, and New Era persistence.
- Synthetic 8-player stress with ~280 fish + 80 aliens + all spectacle renderers enabled ran 120 ticks successfully in the local mock harness.
