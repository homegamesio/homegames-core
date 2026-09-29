# Living Sector · RTS proof of concept

Choose **LIVING SECTOR / RTS** on the title screen. Classic Siege and Flight School remain available. This mode is a complete, short strategy run on twelve generated outposts, with one rival commander and neutral garrisons. You can win without entering the shooter.

## First run

1. The map opens paused at **HAVEN**, with five ships and a turret. Select **Start** when ready. There is no introductory screen to dismiss.
2. Each outpost offers **Send**, **Build**, and **Dive in** when available. **Build** opens ship purchases; its **Defenses** tab opens turret purchases and three placement slots. An empty slot is selected automatically.
3. Select **Send**, choose **Half** or **All**, then click a glowing destination. Only reachable destinations are selectable. Fleet paths may cross friendly territory; they stop to fight at hostile territory.
4. Watch actual ships travel, fight, die, and damage the outpost core. Destroying its core changes ownership. Both sides can recapture territory.
5. Select **Dive in** or press **E** to travel there and enter its existing battle. This resumes the simulation. **G** returns to the map. Your fleet keeps fighting.
6. Capture the red **CITADEL** command core to win. Losing your **HAVEN** command core ends the run.

**P pauses the whole simulation**, while map purchases and orders remain available. **X cycles 1×, 2× and 4× map speed.** Entering a battle returns to 1×. The preview also pauses when it loses focus.

The map shows ownership, mobile ship counts, travelling fleets, damage bars when needed, and build progress rings. Select a site to see its name and type; **i** opens its bonuses and core details. **Orders** holds auto-build and rally controls. The **Pilot** button opens weapons, repairs, and upgrades. **?** opens an optional visual guide. Fresh alerts disappear after five simulation seconds.

## Controls

| Where | Input | Effect |
| --- | --- | --- |
| Map | Click outpost | Select and inspect |
| Map | Send → Half / All → destination | Move a real portion of the selected garrison |
| Map or friendly arena | Build / B | Open contextual construction choices |
| Map | 1 / 2 / 3 | Queue Seeker / Bastion / Warden |
| Map or friendly arena | 4 / 5 | Queue Pulse / Rail turret in the selected socket |
| Build → Defenses | Click an empty hex | Select a defense slot; a free slot is selected after each purchase |
| Arena, while building defenses | Click an empty hex in the field | Select that defense slot; queued defenses show progress |
| Map → Orders | Auto Seekers | Maintain up to eight mobile ships by buying Seekers, while keeping a geom reserve |
| Map → Orders | Set rally point, then destination | Automatically dispatch groups of three when available |
| Map → Orders | Clear rally point | Stop that standing order; fleets already dispatched keep their orders |
| Map | E | Travel to the selected outpost and dive in on arrival |
| Arena | WASD / mouse or arrows | Move / fire |
| Arena | Space / Q | Dash strike / charged Overload |
| Arena | G | Return to command view; combat persists |
| Either | P / H | Global pause / how to play |
| Map | X / C | Cycle speed / cancel destination selection or close the drawer |
| Either | M / V | Sound / reduced motion |

## Economy and production

Geoms are the common currency. Both factions begin with 100 and earn income from their owned, uncontested outposts. Purchases deduct the same published prices for either faction. The rival has no free reinforcement spawner.

| Unit | Geoms | Base build time | Purpose |
| --- | --- | --- | --- |
| Seeker | 14 | 3 seconds | Cheap mobile firepower |
| Bastion | 42 | 7 seconds | Durable front armor; stronger, slower shots |
| Warden | 32 | 5 seconds | Shields nearby allies against direct fire |
| Pulse turret | 32 | 5 seconds | Sustained fixed defense |
| Rail turret | 48 | 7 seconds | Long-range armor-piercing defense |

Construction is sequential, with five queue slots. Each outpost has three defense sockets. Turrets stay at their site; mobile ships travel in fleets. Construction runs at half speed under attack, while resource production is interrupted. Destroyed turrets free their sockets. Capturing a site cancels its previous owner's unfinished construction; surviving defenders remain hostile and continue fighting.

A first capture pays a finite bounty of 20 geoms, plus any cache bonus. Recapturing the same site does not repeat that bounty. Pilot-collected geoms also enter the faction treasury. A pilot module costs 70, and a repair of three pilot hull costs 20 at friendly territory. There is no paid entry fee for manual combat.

## Generated geography and site traits

Each seed changes positions, routes, site types, traits and the rival's expansion preference. All twelve sites are connected. The map is fully visible in this proof of concept.

- **Command:** the faction's vital core and a useful source of income.
- **Refinery:** high geom income.
- **Foundry:** construction takes 35% less time.
- **Relay:** departing fleets and the pilot take 40% less travel time.
- **Ion Array:** provides +2 flux per second to the active pilot.
- **Bastion:** stronger core; defensive turrets cost 20% less.

One extra trait per site adds rich veins, reinforced core hull, faster assembly, faster travel, or a first-capture cache. Bonuses apply to whichever faction owns that site. A remote refinery can become a valuable target; an exposed foundry can support a forward push; a relay can shorten the reinforcement trip.

The rival purchases units, prefers reachable targets it can contest, reinforces its front from rear sites, and competes for the same neutral territory. Its generated preference is expansion or aggression. Both can attack, capture and lose sites.

## Direct intervention

Every outpost has one persistent battlefield. Fleet units retain identity and remaining hull when transferred. Positions, core damage, turrets and projectiles remain when changing views. There is no separate random auto-resolution roll.

The pilot travels along routes to the selected node. In the arena, friendly troops fight autonomously, using the same armor, shield and projectile rules as offscreen troops. The pilot retains the established movement, weapons, dash strikes, geom multiplier, Overload and module combinations. Other outposts continue simulating while the pilot fights.

The command view keeps the pilot on standby; it does not supply offscreen pilot damage. Returning to the same location does not refill hull, dash charges or entry immunity. Leaving does not evacuate the army. Projectiles already fired continue traveling. Peaceful cores repair gradually after combat; troop hull stays damaged.

Losing the pilot costs up to 20 geoms and 18 seconds of reconstruction at HAVEN. You can issue army orders while the pilot rebuilds. The run only ends when a command core falls. Weapon changes are available through the Pilot drawer at friendly territory; module purchases offer a paused draft.

## Verification and scope

```
node testRunner.js ./test/games/VectorSiege.test.js ./test/games/VectorSiegeDepth.test.js ./test/games/VectorSiegeWar.test.js
node tools/vector-siege/verify-war.cjs
node tools/vector-siege/build.cjs
```

The verifier runs complete map-only campaigns on three seeds, requires a strategic victory, and compares the same under-resourced attack with and without a pilot. It also checks native rendering with 480 units spread across twelve simultaneous battles. This is a functional and performance probe, not a human difficulty estimate or a browser frame-rate guarantee.

This prototype uses the same battlefield rules at every outpost; inactive battlefields are not drawn. Rendering and simulation have fixed local pools/caps. A full destination can hold arriving reinforcements outside until space opens. Fleet routes stop if an intermediate site becomes hostile.

Current limits: one rival faction, twelve outposts, three mobile unit types, two turret types, fixed defense sockets, fully visible map, and no saved in-progress campaigns. Fleets meet and fight at nodes rather than intercepting each other on route edges. The arena has no solid terrain. More factions, fog of war, edge interceptions, custom unit formations and free placement are not implemented in this slice.

Implementation: `war.js` owns the sector economy, travel, construction and rival orders; `war-battle.js` reuses the shooter engine for persistent local battles; `war-settings.js` holds balance data; `war-scene.js` renders the strategy controls and command HUD through native Squish. No new external assets or framework changes are required.
