# Orbit Breaker

**Their fire. Your ammunition.** A solo, controller-first twin-stick arcade game
for Homegames, written entirely with Squish vectors and original synthesized sound.

Steal enemy projectiles with a directional magnetic shield, keep them in orbit,
and return them as heavy ammunition. Catch within 220 ms of pulling the trigger
for a golden perfect round. Gold shots can be caught; red lasers must be dodged.
An empty orbit still fires a weaker pulse, so you can always fight back.

Clear the Glass Belt and Redline Array, install an upgrade after each, and destroy
the Heliophage. Its shield resists ordinary pulses but returned rounds penetrate
it. When the core opens, all damage increases. Consecutive catches and kills
increase your score multiplier; hull damage resets it. Nova charge comes from
catches and kills. Runs typically take two to four minutes depending on your pace.

Choose **Flight School** for a protected, interactive introduction. Menus,
upgrades, pause, sound, reduced effects, and restart all work with a controller.

| Action | Controller | Keyboard |
| --- | --- | --- |
| Move | Left stick | WASD |
| Aim ship / shield | Right stick | Arrow keys |
| Catch gold fire | Left trigger (LT / L2) | C |
| Return fire | Right trigger (RT / R2) | Space |
| Dash | Right shoulder (RB / R1), or bottom face (A / Cross) | E |
| Nova at 100% | Left shoulder (LB / L1), or left face (X / Square) | Q |
| Choose menu item | D-pad or left stick | Arrows / WASD |
| Confirm | Bottom face (A / Cross) | Enter |
| Pause / resume | Start / Options | P |
| Toggle sound / reduced effects | Pause menu | M / V |

Hold both triggers to catch and fire continuously. Release and repull LT just
before a gold round reaches the shield for perfect returns. Aim remains where
you last pointed when the right stick returns to center. Dash follows movement,
or aim if stationary. Nova clears hostile projectiles and lasers across the arena.

Five upgrades offer larger storage / shield, stronger piercing returns, faster
explosive dashes, a restorative nova, or reinforced hull. Only two can be chosen
per run. Best score, sound, and reduced effects use Homegames save data.

## Play locally

From `homegames-core`:

```sh
node tools/orbit-breaker/serve.cjs
# Open http://127.0.0.1:9889/

node tools/orbit-breaker/build.cjs
# Open tools/orbit-breaker/orbit-breaker.html for a fully offline copy.

node testRunner.js ./test/games/OrbitBreaker.test.js
```

Also registered in `homegames-web` as `?local=orbit-breaker`. The core local-game
loader discovers `src/games/orbit-breaker` directly. A browser supporting the
Gamepad API is needed for controller input. Press a controller button to expose
the device to the browser. Keyboard works without a controller. If the controller
disconnects or its input stream stalls, combat pauses and held inputs clear.
This is a desktop / controller game; touch-only combat is not supported.

## Authoring and integration

- `index.js` is the small Homegames adapter: player ownership, menus, input,
  lifecycle, save data, audio registration, and the scene root.
- `engine.js` is a seeded, pure simulation. Fixed 30 Hz updates use stored analog
  snapshots rather than moving once per incoming input packet. Fast projectiles
  use swept collision tests. Entity and effect counts are bounded.
- `painter.js` / `scene.js` project an undistorted 160 × 90 world onto Squish's
  100 × 100 plane with persistent node pools, rebuilt on screen changes.
- `sound.js` generates small PCM WAV assets, registered after a player joins.
  There are no downloads or external assets.
- The game imports only `squish-142` and its own files. Homepad is a dependency
  of the client / shared input layer, never of the game. Both local and hosted
  sessions use the same `handleGamepadInput` adapter.

The raw input handler uses canonical `STICK_1_X/Y`, `STICK_2_X/Y`,
`LEFT_TRIGGER`, `RIGHT_TRIGGER`, shoulder and face-button names. Continuous
values drive movement, aim, and triggers; `pressed` edges drive discrete actions.
The first active pad owns the ship until disconnection. A neutral secondary pad
cannot cancel the pilot's input. Games that only need keyboard equivalents can
use `metadata().gamepadBindings`; see the sibling `gamepad-test` example.

`tools/orbit-breaker/qa.js` provides a development-only virtual controller and
normal-input autopilot at `/qa` on the preview server. It traverses the real
browser Gamepad API → Homepad → client → dispatcher → game path. Fixture buttons
also expose boss and upgrade screens for visual checks. None of those controls
are shipped in the offline artifact or game source.

GPL-3.0. See `LICENSE`.
