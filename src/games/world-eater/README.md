# World Eater

**Become the thing the stars are afraid of.** A complete cooperative cosmic
campaign for one to six pilots, built with native Squish geometry and original
synthesized sound. Your drones escort a vast living ark carrying the last of
your species. Feed it worlds, grow its body, fight five celestial guardians,
and carry your people beyond the final sun.

The crew shares one ark, cargo hold, campaign, and upgrade tree. Each pilot has
their own drone, role, hull, and private status display. The ark follows the
crew; drones cannot abandon it across the system. Destroyed drones rebuild,
but losing the ark ends the voyage.

## The voyage

Explore eight worlds in each system. Ore feeds construction, crystal powers
evolution, and garden worlds carry living populations. Hold harvest near a
world to carve it away visibly. Rescue inhabited worlds instead to bring their
people aboard; either choice advances the system quota. Rescue costs 20 ark
energy and saves the world's surviving population, so harvesting first reduces
the lives you can save. Rescued lives supply LIFE cargo for the Living Choir
upgrade and additional forge repairs. The rescue statistic counts people, while
the system quota counts resolved worlds. Saving lives also changes the ending.

| System | Worlds to resolve | Guardian |
| --- | --- | --- |
| The Pale Nursery | 3 | The Watcher |
| Crown of Ash | 3 | Cinder Regent |
| The Choir of Glass | 4 | The Mirror Choir |
| Grave of Titans | 4 | The Hollow Mother |
| The Last Light | 5 | Sol Invictus |

Meeting the quota summons a guardian. Dodge its telegraphed beams, fight its
reinforcements, and destroy it to unlock the Black Forge. Spend shared cargo on
permanent modules before jumping to the next system. The final guardian ends
the campaign. Consuming an inhabited world raises threat, immediately summons
retaliating scouts, strengthens later enemies, and speeds up reinforcements.
Enemy waves continue arriving until that system's guardian is defeated.
An edge marker points toward an offscreen guardian, or the nearest unresolved
world before a guardian appears, and shows its name and range from the ark.

## Controls

| Action | Keyboard | Controller |
| --- | --- | --- |
| Move drone | WASD / arrow keys | Left stick |
| Aim | Automatic nearby-target aim | Right stick, or automatic aim |
| Fire | Space | Right trigger |
| Harvest | E | Left trigger |
| Boost | Shift | Bottom face / A / Cross |
| Nova at full charge | Q | Left face / X / Square |
| Rescue a nearby living world | R | Top face / Y / Triangle |
| Cycle role | Tab | Left shoulder |
| Star map | M | Right shoulder |
| Enter forge after a guardian | F | Right shoulder when cleared |
| Jump from the forge | J | Select the jump button and confirm |
| Menu selection | Arrows / WASD | D-pad / left stick |
| Confirm | Enter | Bottom face / A / Cross |
| Pause / resume | P / Escape | Start / Options |
| Flight manual | H | Select / View |
| Sound | N | Pause menu |
| Reduced effects | V | Pause menu |

Mouse and touch: hold or drag in the world to fly, automatically fire, and
harvest nearby worlds. Release to stop. Tap the on-screen buttons for nova,
rescue, role, map, and menus. The star map accepts the same navigation gesture.
Keyboard movement and pointer flight can be used together. Controller input
must be exposed to the browser by pressing a controller button first.

## Roles and evolution

Pilots can change roles during a voyage:

- **Vanguard** deals 40% more weapon damage.
- **Harvester** extracts worlds 65% faster.
- **Warden** has reinforced drone hull and repairs the ark nearby.

All six upgrade paths have three levels and grow visible orbital modules:

- **Star Fangs:** stronger drone weapons and a stronger, faster ark cannon.
- **Void Carapace:** more ark hull and shield.
- **World Siphon:** faster extraction and more reach.
- **Second Heart:** faster nova charging and shield restoration.
- **Solar Wings:** faster movement and better boosts.
- **Living Choir:** spend rescued LIFE cargo on more hull and passive regeneration.

Nova damages nearby hostiles and clears hostile projectiles. Its charge grows
through play; save it for a crowded fight or an emergency.

## Play locally

From `homegames-core`:

```sh
node tools/world-eater/serve.cjs
# Open http://127.0.0.1:9894/

node tools/world-eater/build.cjs
# Open tools/world-eater/world-eater.html for self-contained solo play.

node testRunner.js ./test/games/WorldEaterEngine.test.js ./test/games/WorldEater.test.js
```

The launcher uses the actual Homegames browser client and LocalSession runtime,
including its controller, save, and RTC sharing paths. **Share** invites other
pilots while the host browser runs the simulation. Co-op sharing requires the
Homegames signaling service; the generated HTML can play solo offline.

The core game loader discovers `src/games/world-eater` for hosted Node sessions.
Node sessions and browser sessions run the same game implementation.

Campaign checkpoints and sound/effects preferences use Homegames save data.
The game saves periodically, on campaign actions, pause, and disconnect. Use
**Continue Expedition** to resume a valid checkpoint; **New Voyage** starts
over. The host owns the shared campaign save. Closing a standalone preview does
not require any account to retain that browser's local save.

For development checks, open `http://127.0.0.1:9894/?qa=1`. The QA panel provides
**Fresh title**, **Start game**, **Forge scene**, **Final boss scene**, **Run
campaign**, **Pause bot**, **Unlock audio**, and **Local crew invite**. Scene
buttons explicitly force test states; the campaign bot sends ordinary gamepad
and keyboard inputs at normal speed. QA uses a separate save slot and shows
frame size, node counts, audio decoding, and campaign diagnostics.
The **RTC: use inline / worker** toggle switches the transport mode; RTC
diagnostics show ICE state, SDP state, candidates, and candidate pairs.

In QA mode, sharing uses the preview server's local `/rtc` signaling endpoint,
with invitations opening another local launcher tab. This checks RTC host/guest
transport without the public signaling service. The server binds to loopback;
these invitations are for browser tabs on the same computer. Normal **Share**
uses public Homegames signaling. The QA harness is omitted from the standalone
HTML build.

During local QA in the Codex in-app browser, both peers reached stable SDP and
reported two host ICE candidates, but no candidate pairs formed. Connections
timed out in both worker and inline modes. Successful browser co-op transport
remains unverified in that environment.

## Implementation

- `index.js` adapts the simulation to Homegames players, input, lifecycle,
  private status nodes, persistence, and audio assets.
- `engine.js` contains the seeded simulation, five-system progression, enemy
  behavior, combat, extraction, rescue, forge, and validated checkpoints.
  Fixed 30 Hz ticks use bounded substeps and swept projectile collision.
- `painter.js` provides persistent native Squish node pools in a 160 × 90 design
  space. It clips polygons before serialization, caps their vertex count, and
  exposes only active nodes in drawing order. `end()` returns pool diagnostics.
- `scene.js` draws seeded stars, carved planets, the articulated ark and iris,
  modules, drones, enemy silhouettes, bosses, beams, rings, and particles. The
  tactical map uses an invertible camera transform over the same world.
- `ui.js` draws the shared cockpit, title, field manual, forge, pause, endings,
  and private pilot readouts.
- `audio.js` synthesizes PCM WAV effects and a shifting ambient score. All
  assets travel through Squish, so remote guests receive the same audio.

The game imports only its own modules and `squish-145`. It has no external image,
font, audio, or runtime downloads. Entity and effect counts are bounded; reduced
effects removes decorative particles and cuts background detail. Painter pools
retain node identities while serializing only the current frame's live nodes.

GPL-3.0. See `LICENSE`.
