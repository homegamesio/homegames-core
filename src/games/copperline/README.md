# COPPERLINE

A West worth saving. A standalone single-player action RPG for Homegames, built
entirely from native Squish polygons and original procedural audio. No asset
downloads, network services, or additional packages are required by the game.

You are Rowan Wren, returning to the valley after your mother's death. Marshal
June Bell kept a letter for you. The Copperline railroad took everything else.
Follow nine chapters through stolen water deeds, Inez Rojas's dangerous invention,
a moving prison train, Blackglass Foundry, and a confrontation with Silas Vale.
Your decisions determine his fate and the valley's new charter. After the ending,
the world stays open for bounties, property ownership, and exploration.

## Playing

Choose **COPPERLINE** in the Homegames library. The class key for a direct local
play link is `Copperline`: `/?localGame=Copperline` on your running core server.
New source games are discovered by the normal library scan.

| Action | Keyboard / pointer |
| --- | --- |
| Move relative to the screen | WASD or arrows |
| Shoot the closest visible enemy | Hold Space |
| Aim and shoot | Hold the pointer on a target |
| Talk, shop, use a camp, board a train | E |
| Mount, summon, or dismount Comet | H |
| Dodge | X |
| Deadeye (slow enemies and their shots) | Q |
| Reload | R (also automatic when empty) |
| Use medicine | F |
| Sprint on foot | V |
| Equip an owned weapon | 1–4 |
| World map and custom waypoint | M |
| Arsenal, outfits, deeds, ability points | I |
| Story journal | J |
| Pause / close a menu | C |

Touch controls include a direction pad, fire, interact, ride, and a More menu
for reload, medicine, deadeye, and dodge. Gamepads use the left stick / D-pad,
face buttons, shoulders, Start, and Select. All menus pause the simulation.

The opening objective is June outside The Last Light. Gold arrows and the map
lead toward the current chapter. Speak to June or Ada for repeatable bounties;
active bounty camps appear as green marks on the map. The train runs along the
east–west track: approach any car and press E to board, then move along the cars.
Interact again to disembark. You can shoot from a horse or train roof.

## A world you can own

The 320×240 valley contains six districts, sixteen buildings, deterministic
desert scenery, campfires, railway stations, a reservoir, and a foundry.
Terracotta mesas, turquoise water, timber facades, drifting dust, lantern light,
and a changing day/night palette are all drawn with clipped, pooled polygons.

- **Four weapons:** Mercy No. 6, Choirbreaker, Sunspike Repeater, and the
  lightning-chaining Saint Elmo.
- **Three universal modifications:** the extended Copper Longbarrel, exposed
  Stormcoil Assembly, and Clockwork Drum. Each changes gun geometry on the
  character, in the equipment view, and in property racks as well as combat stats.
- **Three outfits:** indigo denim, coral serape, and a violet marshal's duster.
  Purchased clothing changes the character and hangs at owned properties.
- **Three properties:** Wren Homestead, The Last Light, and Painted Sky Ranch.
  Approaching an owned building reveals a furnished cutaway with your weapons,
  clothing, ammunition, medicine, cash box, deed, and campaign trophy. Rent
  accumulates every 95 seconds of play; visit the property to collect it.
- **Progression:** XP levels grant health and ability points. Iron Heart, Sure
  Hands, and Wind Rider improve survival, damage, or riding.

Shop rows preview the selected item and its effects before the Buy button spends
money. Basic rest and resupply at merchants or camps are free. Defeat returns
Rowan to the clinic with gear and campaign progress intact and a small cash loss.

## Persistence and implementation

The platform's `saveGame` / `saveData` API stores checkpoints, inventory,
properties and pending rent, quest choices, partial encounters, bounties, and
travel state. It works in hosted and local browser sessions. Saves are validated
before use. The game also saves on disconnect and local shutdown.

- `index.js`: Squish lifecycle, owner input, HUD, shops, map, journal, equipment,
  touch controls, and persistence.
- `engine.js`: renderer-independent simulation, combat, dialogue, campaign,
  economy, encounters, and validated snapshots.
- `content.js`: story, catalogs, tuning, and deterministic world layout.
- `scene.js`: clipped polygon renderer, faceted actors and scenery, animated
  train, physical equipment, and property furnishings.
- `audio.js`: original synthesized effects and a quiet plucked/whistled theme.

The game is an isometric action RPG. Buildings are solid exterior footprints;
owned interiors are visible cutaways accessed through porch interactions.
There is one protagonist and one save slot, managed by Homegames.

## Verification

From the homegames-core root:

```sh
node testRunner.js ./test/games/Copperline.test.js
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_PATH=/path/to/chrome node test/copperline-browser.cjs
```

Behavioral tests cover both campaign endings using actual combat and interactions,
commerce and rent, save safety, recovery, bounties, horse/train movement, partial
encounter restoration, input ownership and repeats, and native Squish frame
serialization. The browser acceptance test exercises real HomegamesClient input,
shopping, local persistence, and touch controls and captures screenshots in `/tmp`.

Licensed under MIT; see `LICENSE`.
