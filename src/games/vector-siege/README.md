# Vector Siege · v03

A single-player Homegames twin-stick roguelike: break enemy formations, collect geoms, build a weapon, and conquer a generated sector. Optional operations alter the Citadel's actual defenses. Captured production also supports your ship.

**New: Living Sector.** A continuous RTS on twelve generated outposts, with fleet purchases, construction, a rival economy, neutral territory, and optional direct intervention in persistent battles. The entire run can be won from the map. Choose **LIVING SECTOR / RTS** on the title screen. See [Living Sector controls and mechanics](LIVING-SECTOR.md) for the new mode. The sections below describe **Classic Siege**, which remains available alongside Flight School.

The sector interface centers on **Send / Build / Dive in**. Purchases, standing orders, pilot upgrades, and site details open when requested; the map starts paused without a mandatory tutorial.

## Play

Installed in `homegames-core/src/games/vector-siege`. Restart the Homegames dashboard to discover **Vector Siege**, then choose local play. The same game class supports hosted sessions. Desktop keyboard and mouse are the intended controls; touch controls are not implemented.

From the core repository:

```
node tools/vector-siege/serve.cjs
```

Open `http://127.0.0.1:9876`. This uses the real Homegames LocalSession and Squish 144 runtime. `node tools/vector-siege/build.cjs` builds the self-contained `tools/vector-siege/vector-siege.html`, which also works offline.

| Input | Action |
| --- | --- |
| WASD | Move; diagonals normalized |
| Hold mouse button and point | Aim and fire |
| Arrow keys | Aim and fire in eight directions |
| Space | Dash strike; absorb nearby enemy bullets for flux |
| Q | Activate Overload at 100 flux |
| H | Illustrated enemy field manual; pauses the fight |
| 1–3 on loadout | Equip Needle, Scatter or Lance |
| 1–3 in Flight School | Switch weapons immediately |
| 1–4 on map, Enter | Select a target, then capture/assault |
| F on map | Raid the selected support site |
| R / B on map | Repair hull / buy a module draft |
| 1–3 on upgrade screen | Install a module |
| R on upgrade screen | Reroll once for 15 salvage |
| P | Pause; paused menu can abandon the run |
| M / V | Toggle synthesized sound / reduced motion |
| Enter / R on results | New sector / retry the same seed |

**Flight School** cycles through enemy roles, disables hull damage, and passively charges Overload. Death ends a real run. Personal best and sound/motion preferences save through Homegames; unfinished runs do not.

## Combat

Pick **Needle** for sustained precision, **Scatter** for close-range volleys, or **Lance** for penetrating armor and aligned targets. The initial weapon remains your weapon for that run. All three share responsive steering, swept projectile collision, two dash charges, and independent aim.

Dash through enemies for 2 armor-ignoring damage and a short stun. Each enemy takes one hit per dash. Dash through hostile bullets to absorb them for 3 flux each. Invulnerability covers the dash and a short exit window.

Kills, geoms and dash strikes generate **flux**. At 100, Q clears hostile bullets and hazards, detonates a local blast, and gives five seconds of faster fire, extra penetration and stronger geom attraction. Overload does not recharge while active. Save it for an emergency or spend it early to break a formation and collect the rewards.

Geoms are physical pickups. Each grants salvage, flux, score, and multiplier progress. The multiplier reaches x20; kills and pickups renew its five-second timer. It then decays, and hull damage halves it. Killing enemies within 1.1 seconds of each other also builds a separate kill chain and score bonus. Orange fuel cells can be shot to trigger friendly explosions and chain reactions.

| Enemy | Role and counter |
| --- | --- |
| Seeker | Direct pursuit; keep moving and sweep the pack |
| Fractal → Shards | Splits into fast fragments; follow through after the first kill |
| Sentry | Orbits and fires; approach or cross its firing angle |
| Bastion | Front armor cuts direct damage by 70%; flank for bonus damage, dash, or use Lance |
| Lancer | Marks a lane, commits to a charge, then recovers; sidestep and punish |
| Rail Eye | Locks a warning beam before firing; move across it early or kill the shooter |
| Warden | Cuts nearby allies' direct damage by 65%; kill it to collapse shields and stun the group |
| Mineweaver | Predicts movement and plants delayed area blasts; watch the rings and change direction |
| Scavenger | Steals dropped geoms; recover its haul before it escapes and adds enemy reserves |
| Cargo | Crosses the arena with a real delivery; destroy it to deny reserves and earn salvage |

Gold outlines mark elites: tougher, faster enemies that award extra salvage. Enemy geometry, attack windups, directional armor, shield links, laser warnings and mine countdowns communicate their state.

## The sector

A seed changes site order, map positions, arena layouts, contracts, deployments and upgrade drafts. All targets are available immediately. Planning screens pause the economy.

| Site | Enemy production removed by capture | Permanent friendly support |
| --- | --- | --- |
| Ion Array | Fortress shield energy and its future production | +2 flux per combat second |
| Hex Foundry | Stored heavy defenders and future production | Autonomous combat wingman |
| Transit Relay | Reserve waves and cargo traffic | +1 hull on each deployment |
| Citadel | Destroy the command core to win | — |

**Capture:** destroy all three uplinks, defeat the site's elite guard and counterattack, then hold the center for four uncontested seconds. Ion Array uplinks also pulse warning fields; destroying one stuns nearby defenders. Capture stops production, removes that resource's stock and in-flight deliveries, grants support, repairs one hull, awards 20 salvage and offers a module draft. It increases sector alert by 12.

**Raid:** destroy the gold-marked uplink and hold the south extraction beacon for 1.5 seconds. Surviving extraction halves the corresponding stored resource and awards 25 salvage. Production continues, territory remains hostile, and alert increases by 6. Each site can be raided once and captured later. Remaining in the arena to intercept cargo or collect geoms is a choice.

Each support operation has an optional **+25 salvage contract**: no hull damage, finish within 55 seconds, destroy cargo, or reach x5 multiplier. The map states the requirement. Interdiction becomes Clean Breach if the relay is already captured, so contracts remain possible. Completion animations do not consume the time bonus.

Salvage is spent between operations: **20 repairs two hull**, **60 buys a three-option module draft**, and **15 rerolls a draft once**. Higher alert increases the garrison budget and deployment rate and introduces additional elites. Spending more time in hostile arenas also gives production more time to reach the fortress.

Uncaptured reactors and foundries dispatch every 16 combat seconds. Deliveries take ten seconds; the map shows actual in-flight shipment positions while paused. Relay cargo appears as a shootable carrier in support missions and adds three reserves if it escapes. Capturing its source cancels its future contribution. The Citadel locks its defender budget when entered and consumes its finite heavy/reserve stock as it deploys.

The **Citadel has three combat phases**: radial fire and aimed bursts, then telegraphed rail attacks below 67% hull, then denser rings and three rail lanes below 33%. Phase transitions clear bullets and briefly protect the core. Shield pylons, heavy defenders, and reserve waves depend on the sector you leave behind.

## Building a run

Fourteen modules cover penetration, lightning, kill explosions, cryo, ricochets, dash damage, faster dash recharge, stronger/longer Overload, pickup healing, geom attraction, fire rate, extra projectiles, damage, and hull repair. Most are unique; Core Amplifier stacks three times and Second Wind can repeat, with maximum hull capped at ten.

Some combinations to discover:

- **Lance + Phase Rounds + Arc Conductor:** line up bodies and arc through grouped defenders.
- **Scatter + Detonation + Gravity Well:** commit to close range, burst a pack, pull in the rewards.
- **Razor Wake + Afterimage + Capacitor:** turn aggressive dashes into damage and frequent Overloads.
- **Reclamation + Gravity Well + Cryo Rounds:** slow the formation and sustain through pickups.

Forked Light scales the original volley by 50%, rounding up, then reduces per-projectile damage to 80%. It improves total volley damage for all three weapons.

## Implementation and assets

60 visual ticks and 120 simulation substeps per second. Exponential steering, short stopping distance, recoil springs, engine trails, hit flashes, knockback, enemy-only impact slowdown, shield collapse, lightning, chain blasts, grid shock ripples, and short result transitions. Reduced motion disables camera shake and grid displacement.

All visual assets are procedural Squish polygon/text nodes. All sound effects are synthesized PCM WAV buffers registered through the native asset interface, with independent buffers for overlapping voices. There is no external image pipeline, image download, or remote asset dependency.

- `engine.js`: deterministic run state, movement, missions, economy and rewards.
- `combat.js`: weapon behavior, armor, shields, abilities, hazards and specialized enemy AI.
- `settings.js`: tuning, weapon/enemy catalogs, modules and contracts.
- `scene.js`: presentation through the bounded native painter.
- `index.js`: persistent Squish nodes, Homegames input, saving and game metadata.
- `sound.js`: original procedural audio and voice playback.

Simulation and visual randomness use separate generators. Combat entities and effects have fixed pools; frame rendering mutates existing nodes. Repeated shield decorations and expendable particles are bounded so player and HUD remain visible even with every pool full. Game files use no browser globals or server-only modules.

## Verification

```
node testRunner.js ./test/games/VectorSiege.test.js ./test/games/VectorSiegeDepth.test.js
node tools/vector-siege/verify.cjs
```

Tests exercise native wire serialization, movement, input, collisions, all new combat interactions, guard capture, raids, contracts, purchases, source ownership and boss phases. The verification script runs 27 automated approaches across three weapons, three routes and three seeds, then benchmarks 1,800 native frames and saturates all combat pools. Pilots are balance probes, not evidence of human difficulty. Timing covers simulation, scene updates and serialization, excluding browser paint and device-dependent input latency.

Classic Siege is one sector per run: three support sites and one boss, with three arena arrangements. Living Sector adds persistent friendly and rival fleets and a generated twelve-outpost RTS. Neither mode currently has a multi-sector campaign, resumable runs, touch controls or gamepad support. `DESIGN.md` describes the Classic Siege decisions; `LIVING-SECTOR.md` documents the new RTS.

GPL-3.0; see LICENSE.
