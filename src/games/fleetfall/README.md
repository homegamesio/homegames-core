# Fleetfall

Conquer the galaxy and guide your dudes

## Play

- Choose a map and start with Enter or **Play**. The first connected player is the host. Solo maps introduce two to five rival AI commanders; the map card shows how many. Every commander starts with the same 70 ships and uses the same production and combat rules.
- Tap one of your planets, then any other planet to launch. Choose **25%**, **50%**, or **100%** of the source's ships. Friendly destinations receive reinforcements.
- Each launch opens a flight panel on the right. The galaxy remains interactive on the left. Up to **six active flights per commander** are allowed; a seventh order is rejected without deducting ships. Launch again when a slot is free.
- **Tap or click open space in a flight panel** to glide to that horizontal position. A small marker shows your destination. Each flight keeps its own destination, even when panels resize. There are no on-screen arrow controls.
- **Tap or click a rock to shoot it.** Shots aim from your ship toward the moving target, even across the panel; shooting does not change your movement destination. Rocks break with one hit; larger amber wrecks take two. The thin bar at the bottom shows the short firing cooldown. Shots only affect debris in that flight, and enemy fleet crossings still require dodging.
- Keyboard controls remain available: **1–6** select a flight, **Left/Right** or **A/D** steer, and holding **Space** fires straight ahead. Manual steering cancels that flight's tap destination. Escape clears planet selection.
- The number inside your ship is the surviving fleet strength. Rocks cost one ship, amber wrecks cost three, and enemy fleets cost one to four according to their strength.
- When two opposing fleets meet in space **at the same time**, each pilot sees the other as a moving hazard. Steering changes the hazard's mirrored position in the opponent's panel. A collision damages both fleets once; either pilot can prevent it by dodging.
- Only survivors attack or reinforce a planet. Arriving and destroyed flights close their panels automatically. The galaxy expands again when your last flight ends.
- Planets produce ships, with a small bonus from linked friendly neighbors. Eliminate all rival planets **and fleets** to win. Solo runs end when you lose your last planet and fleet; **Play again** returns to the lobby. Eliminated multiplayer commanders spectate until the match ends.
- Late arrivals spectate until the next match. Disconnected commanders are taken over by AI. Rejoining also spectates until the next match; connection IDs are reused and cannot establish returning identity.

## Maps and progression

There are **36 authored battlefields across six sectors**, with six map previews per page. The host uses the arrows to browse sectors. Every map is available immediately for solo play or one to six human players; there are no grind requirements or permanent stat upgrades.

| Sector | Maps | Character |
| --- | --- | --- |
| Home Reach | Orbit, Rift, Binary, Belt, Relay, Starwell | The original four maps plus relay races and a contested inner system. |
| Crossroads | Crosswind, Forked Signal, Causeway, Six Spokes, Switchback, Meridian | Branches, production chains, central races and crossing flights. |
| Shard March | Triptych, Chainlink, Broken Crown, Needle Eye, Fracture, Far Harbor | Islands, expensive bridges, broken rings and distant beachheads. |
| Tidal Expanse | Undertow, Whirlpool, Slipstream, Blue Shift, Long Arc, Maelstrom | Spirals, diagonal fronts and long flights through debris. |
| Iron Dominion | Anvil, Citadel, Trident, Iron Lattice, Crucible, Siege Ring | Fortified neutral systems, valuable links and crowded wars. |
| Last Light | Starless, Dead Reckon, Event Horizon, Last Beacon, Supernova, Fleetfall | Sparse outposts, heavy garrisons and up to five rival commanders. |

The map card previews its topology, solo rivals and flight conditions. **Open Skies** spaces debris farther apart; **Drift** keeps the original rhythm; **Wreckage** replaces every third obstacle with a two-hit wreck; **Debris Storm** sends obstacles more frequently. Speeds, damage, steering and weapon cooldowns remain consistent, and every pilot on the map faces the same conditions. Links boost allied production; fleets may still fly directly between any planets.

Solo wins earn a check mark and save the best completion time. **Next Map / Next Sector** advances directly after victory; **Continue** launches the first uncleared map. Clearing all 36 produces the **Galaxy Secured** ending. Multiplayer wins and victories by disconnected AI commanders do not count as solo clears. Multiplayer matches still use exactly the connected player roster, without adding campaign rivals.

The selected map and solo records are saved for later sessions. Existing map-only saves continue to work. Reloading always starts a fresh lobby; in-progress matches are not saved. A failed save retains the earned progress in memory and shows a host-only retry control.

## Local preview

From the homegames-core directory:

```sh
node tools/fleetfall-preview.cjs
```

Open http://127.0.0.1:8796. This standalone preview is local solo play; use the normal Homegames session flow for multiplayer. Fleetfall is also discoverable as its own game in the local catalog.

## Development

- `engine.js`: deterministic simulation, production, fleet travel, debris, AI, synchronized crossings, arrival and victory.
- `maps.js`: the original battlefield definitions, the complete map catalog and fresh planet state.
- `frontiers.js`: 32 new authored layouts, six sector palettes and four shared debris profiles.
- `view.js`: per-player rendering and responsive panel layout. Drawing nodes are pooled; private scenes are scoped to player IDs.
- `index.js`: game lifecycle, host rules and pointer/keyboard input. Tap destinations and debris targets bind to flight IDs through panel resizing.
- Static metadata in `index.js` owns portable identity and player capacity; no separate game manifest is required.

```sh
node --test test/games/Fleetfall*.test.cjs
node tools/fleetfall-campaign-verify.cjs --write
node tools/portable-game.cjs check src/games/fleetfall
# Requires Playwright and a Chrome installation (see the browser test env options).
node test/fleetfall-browser.cjs
node test/fleetfall-rtc-browser.cjs
# After rebuilding homegamesio/web:
node test/fleetfall-package-browser.cjs
node tools/fleetfall-performance.cjs
```

The interface keeps ship counts, flight destinations, timing, controls, and brief action errors; instructions live here instead of over the battlefield. The game uses procedural vector visuals and has no audio. Simulation advances at 30 Hz using elapsed time, with a 100 ms catch-up cap; long host stalls pause excess game time. Empty rooms reset, and idle lobbies/results do not redraw every tick. Flight distance controls travel time. The six-panel layout targets a landscape display; large screens make simultaneous piloting easier.

The campaign verification tool uses four ordinary resource-management strategies, legal launch fractions and the existing bot pilot helper at 30 Hz. Its report records source hashes, results and winning orders for all 36 maps, plus an idle comparison. This demonstrates automated winning routes; it does not certify human difficulty or completion time. Connectivity, readable spacing, fair initial resources, all player counts, save migration, sector navigation and completion transitions have regression coverage. Browser checks cover every sector, progress reloads, the ending and touch controls alongside the existing piloting and multiplayer checks.

The six-player, 36-flight diagnostic models roughly 27–30 Mbps of browser-host upload to five guests (about 5.4–6 Mbps per remote player), excluding transport overhead. This is a desktop measurement, not a phone or server-capacity guarantee. Physical devices, constrained networks and natural group pacing remain launch acceptance checks.

Licensed under MIT; see LICENSE.
