# After Hours

A multiplayer first-person arena game built entirely from Homegames' Squish nodes,
asset crops, audio/video playback and WebRTC sessions. One browser runs the shared
simulation; every visitor receives their own camera view.

Explore an art museum, fight beneath a giant breakfast table, or cross neon
rooftops with up to eight human visitors. Spawn with a machine gun, collect a
shotgun, rocket launcher, railgun or plasma rifle, and find restoration/shield
pickups. The Pulse sidearm remains an unlimited-charge fallback. Practice docent
drones fill empty seats until four combatants are present.

## Maps and rounds

An 18-second voting lobby opens before the first match and after every round.
Choose a map from its layout thumbnail, choose a mode, then select **Ready**.
The match begins immediately once every human visitor is ready; otherwise the
countdown starts the selected match. Changing a vote clears that visitor's ready
status. Each round has a six-minute time limit.

| Map | Layout |
| --- | --- |
| After Hours Museum | The Tidal Archive, Verdant Room, Signal Hall and Dream Wing surround the Grand Atrium. Original paintings and video installations remain on display. |
| Tiny Kitchen | A miniature player's route through a giant refrigerator, range, sink, marble island and cereal pantry, with open space beneath table and chair legs. |
| Neon Heights | Two roof decks joined by three skybridges, with HVAC cover, antennas and illuminated signs. |
| Red Foundry | Furnaces, casting belts and loading bays around a central industrial crossing. |
| Frost Station | Four icy laboratories linked by a central junction and a complete outer ring. |

Every map has eight player spawns, four spawn locations per team, two flag bases
and three control points, with alternate routes between the bases. Lobby map
thumbnails are drawn from each map's actual wall grid.

| Mode | Objective |
| --- | --- |
| Free For All | First visitor to 12 eliminations wins. |
| Capture The Flag | Amber versus Cyan. Take the opposing flag back to your base while your own flag is home; first team to 3 captures wins. |
| Domination | Amber versus Cyan. Capture and hold A, B and C; first team to 180 points wins. |

In Capture The Flag, touching your dropped flag returns it; unattended flags
return after 20 seconds. In Domination, an uncontested capture takes three seconds
and each held, uncontested point scores once per second. The scoreboard and
objective indicators follow the selected mode.

## Play

Open the exported `after-hours.html` directly in a browser, or import
`after-hours.zip` into the updated local Homegames Studio and press Play. Choose
the entry button, then vote in the lobby. The downloaded HTML includes all media
and the runtime.

The updated Homegames server can also serve this game through its regular
library and `homegames.link`. Keep the `assets` directory alongside `index.js`:
both browser play and server-hosted sessions load these files from the game
directory. After updating the server, restart Homegames and open a fresh game
session so its cached manifest and asset bundle are rebuilt.

Use Share/QR to invite friends to the running host. Manual connection can pair
already-open players without Homegames signaling. NAT/firewall restrictions may
still require a relay. Keep the host tab open. Giving someone an independent copy
requires sending the HTML/ZIP separately from a session invitation.

| Action | Keyboard / pointer |
| --- | --- |
| Move / strafe | W A S D |
| Turn | Captured mouse, left/right arrows, Q/E, or drag the view |
| Release mouse | Escape |
| Forward/back | W/S or up/down arrows |
| Fire | Click or F |
| Jump | Space |
| Sprint | Shift while moving |
| Select a collected weapon | 1 machine gun / 2 shotgun / 3 rocket / 4 rail / 5 plasma / 6 Pulse |
| Cycle weapons | R, or tap the charge display |
| Arena map | M, or tap the location name |
| Help | H |

Menus, the lobby, help and the map use a custom gold arrow cursor and suspend
mouse capture. Click the entry button to begin; after a match starts, click the
active view to capture the desktop mouse for continuous aiming. Escape releases
it so you can use Share or other page controls. Opening help or the map also
releases it. Mouse capture is opt-in through `metadata.pointerLock`; browsers
that cannot capture retain drag aiming.
The canvas also has movement, turn and fire buttons for touch. Pickups collect
when walked over. Visitors reassemble after three seconds with brief protection.
Rounds and combat progress last for the running session; this game does not save
an unfinished match. Project source, art and media are fully included in the ZIP.

## Build from source

From `homegames-core`, with sibling client/common dependencies installed:

```sh
node tools/after-hours/build.cjs
node --test test/games/AfterHoursEngine.test.cjs
node --test test/games/AfterHoursGame.test.cjs
node --test test/games/AfterHoursMaps.test.cjs
node --test test/games/AfterHoursModes.test.cjs
AFTER_HOURS_HEADED=1 node test/after-hours-browser.cjs
node test/after-hours-menu-browser.cjs
node test/after-hours-arena-browser.cjs
node test/after-hours-home-server-browser.cjs
```

The build writes `portable-preview/after-hours/after-hours.html` and `.zip` using
the existing isolated portable builder. Use the rebuilt client containing authored
video validation. Browser tests use Playwright and Chrome; set `PLAYWRIGHT_MODULE`
and `CHROME_PATH` if they are outside normal resolution.
The native mouse-capture checks need a visible Chrome window on macOS; headless
Chrome rejects pointer lock there even when the document reports that it has focus.
The arena browser check captures all five maps and measures a host with seven RTC
guests. Set `AFTER_HOURS_GUESTS=0` for a quick visual-only run. On a test machine
whose multicast DNS discovery prevents local ICE pairing, the optional
`AFTER_HOURS_DIRECT_ICE=1` bypasses Chromium's mDNS candidate obfuscation for the
browser acceptance runs. This is a localhost test setting, not a game requirement
or a change to the normal RTC connection behavior.

The game uses Squish 145 for press/drag/release controls, 60 simulation ticks/sec,
and 80 wall columns per viewer. Raycasting, line of sight, collision and combat
remain in `engine.js`; the original museum is in `world.js`, other arena layouts
and their catalog are in `maps.js`, and projection is in `render.js`.
No new renderer, WebGL engine, socket protocol or direct DOM drawing is used.
The camera supports horizontal and vertical aiming plus real jumping, using a
pitched 2.5D projection with map-specific wall heights, including eight-unit
kitchen walls around a 1.8-unit player. The shared pointer
input delivers both axes; game code controls projection and aiming rules.

Combat is host-authoritative. Head hits deal twice the base damage; torso hits
deal full damage, and leg/foot hits deal 55%. Hitscan weapons test the actual
height of each body region, including during jumps. Shotgun pellets spread on
both axes; rail shots pierce visitors until a wall stops the beam. Rockets and
plasma bolts travel through the world with swept collision tests; rocket splash
respects walls and can damage and push its owner. Projectiles, trails and impacts
only produce nodes for visible portions of a player's view.

Ground movement accelerates quickly to 6 units/second, or 8 while sprinting.
Jumping adds bounded air steering; rockets can add knockback. Every weapon has
its own Squish viewmodel, mechanical animation, muzzle effect and sound. World
wall panels and directory tiles merge where their geometry/color permit it,
leaving rendering headroom for combat detail without replacing the renderer.

- World state stays in plain data; only current render views are attached.
- Each human has one root scoped to its runtime player ID. Camera projections,
  HUD, input targets and sounds inherit that scope.
- Still art uses existing image crops across raycast wall columns. Videos use one
  decoder per visible billboard monitor. The six-second videos restart through
  normal node replacement; playback clocks are local to each browser, not synced.
- Authored assets are ordinary project files referenced by relative paths. Shared
  changes admit classified video files to portable packages and add optional mouse
  capture to the existing input path. The type-4 media protocol/renderer already
  supported authored video.
- The home-server manifest includes path-based media; hosted sessions bind the
  same local files to existing Assets and send authored video as type 4. Images,
  video and audio do not need the hosted asset database.
- Menus reuse the existing player-scoped `setCursor` channel with the `menuCursor`
  image and optional `pointerLock: false`. Returning to active play clears that
  descriptor. Cursor state changes only on menu transitions, not every simulation
  tick; the game does not touch the browser DOM.

All art prompts and media provenance are in `assets/ATTRIBUTION.txt`. Original
procedural videos and audio can be regenerated with
`python3 tools/after-hours/media.py` (requires Pillow and ffmpeg).
