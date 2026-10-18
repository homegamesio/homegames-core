# STARFALL SALVAGE

**The moon broke. We kept the pieces.**

A complete single-player space salvage adventure built for Homegames and Squish 145. Fly the patched-together **Kestrel** through six authored sectors, fight scavenger drones and a privateer guild, explore five derelicts on foot, assemble a visibly different ship, and bring a crew home. The campaign has ten chapters, two major bosses, consequential archive and finale choices, and continued exploration after the ending.

Everything is rendered as original polygon geometry. The game uses no external images, network calls, browser APIs, or services. Its original soundtrack and effects are synthesized into PCM audio assets and delivered through Homegames. It runs in hosted sessions and local browser play using the same game code.

## Start playing

Find **STARFALL SALVAGE** in the Homegames library, or use the local-game key `StarfallSalvage` in the dashboard's `?localGame=` launch URL. Choose **Launch the Kestrel**. Approach Lantern Anchorage and press **E** to speak with station keeper Mara. Gold beacons mark your next story objective.

You can explore before accepting a mission. Docking is safe, station repairs are free, and jumping between unlocked sectors does not consume fuel. If you become lost or stuck, **More → Emergency tow to station** returns you to safety.

| Control | Action |
| --- | --- |
| WASD / arrow keys | Fly or walk in screen directions |
| Space | Fire toward the nearest threat |
| Hold pointer on the world | Aim and fire at that point |
| E | Dock, board a wreck, use a terminal, or leave through an airlock |
| X | Ship burst dash / suit dodge |
| Hold V | Ship boost |
| Q | EMP pulse |
| F | Use a repair / medical kit |
| M | Star chart and local navigation |
| I | Shipyard and module previews |
| J | Captain's log and crew |
| C | Pause / close the current screen |

On-screen movement and action buttons support touch. **More** exposes pulse, kits, crew, help, pause, and emergency tow. Gamepad controls map the left stick / D-pad to movement; face buttons to fire, interact, dash, and pulse; shoulders to healing and boost; Select to the chart; and Start to pause.

Dialogue supports **W/S** to select, **E** to confirm, and **1–8** for immediate choices. In the shipyard, **A/D** changes the fitting slot, **W/S** browses modules, and **E** buys or fits the selection. On the chart, **W/S** or **1–6** selects a sector and **E** jumps there.

## The Reach

- **Lantern Anchorage:** a safe harbor beneath the fractured moon; Mara and the Sable's impossible cargo.
- **Orchard of Hulls:** a field of retired ships and a navigator who dreams in maps.
- **Prismwake Belt:** crystal gardens, three harmonic relays, and the last lifeboat of the Mercy.
- **Choirgrave:** the Needle Queen and a memory ark carrying the breakfast recipes and histories of a lost civilization.
- **Red Meridian:** a salvage guild's blockade, Stormgate's weapons grid, and the command carrier Sunward.
- **Heart of Dawn:** a living star engine, its last Warden, and a decision about the shape of tomorrow.

Boardable ships are small authored combat spaces connected by corridors. Their rooms, obstacles, enemies, loot, consoles, and objectives are actual simulation objects. Your ship waits outside; stepping into the airlock brings you back to the sector you left.

## Making the Kestrel yours

The ship has five physical fitting positions: **weapon, port, starboard, drive, and hull**. Seventeen modules include starter components and twelve purchasable replacements. Each changes the rendered silhouette or equipment, with functional effects on weapons, defense, movement, or salvage recovery.

Choose piercing **Prism Lance** bolts, the **Petal Cannon** spread, guided **Firefly Launcher** missiles, or the heavy **Dawn Needle**. Add a **Magpie Tractor**, **Storm Orchard** capacitors, **Lantern Shield**, or **Pocket Meteor** launchers. Fit faster engines, a larger cargo body, or layered Aurora armor. The shipyard previews the selected module before you buy or install it. Purchases use credits, scrap, and crystal; owned modules can be refitted at a station.

Floating salvage is collected nearby, with a larger collection radius when the tractor is installed. Asteroids can be broken for parts. Story rewards and repeatable station contracts provide additional resources. Crew members provide real passive bonuses:

- **Moth**, navigator: more shields and faster boost recovery.
- **Oru Venn**, engineer: hull repair outside combat and improved shield recharge.
- **Pip Nine**, archivist and cook: better salvage yields and lower oxygen consumption.

The journal records recovered transmissions and current objectives. The chart shows unlocked routes and a local scan; tapping the local scan sets a waypoint. Opening a menu pauses the simulation.

## Persistence and implementation

Progress saves at meaningful checkpoints and during play through the platform's `saveGame` API. Saves retain campaign choices, crew, resources, fitted and owned modules, sector progress, and partial boarding encounters. Untrusted save data is normalized before it enters the simulation. Disconnecting freezes the game; only the seated player can control it.

- `content.js`: modules, crew, missions, sectors, interiors, and tuning.
- `engine.js`: deterministic simulation, combat, progression, interactions, and persistence.
- `scene.js`: pooled polygon renderer, ship construction, portraits, and effects.
- `index.js`: Homegames lifecycle, controls, HUD, shipyard, navigation, story interfaces.
- `audio.js`: original PCM synthesis and bounded sound voices.

The renderer clips geometry to Squish's coordinate range and keeps only the current scene in its node tree. Gameplay runs at 20 ticks per second. Menus do not keep advancing combat or repeatedly rebuilding static frames.

## Validation

From the `homegames-core` repository:

```sh
node testRunner.js ./test/games/StarfallSalvage.test.js
```

A real-client browser acceptance harness is included in `test/starfall-browser.cjs`. Supply `PLAYWRIGHT_MODULE` and, if necessary, `CHROME_PATH` for your local installation. It launches an isolated local session, exercises keyboard and touch controls, and writes representative screenshots to `/tmp/starfall-*.png`.

Licensed under MIT; see `LICENSE`.
