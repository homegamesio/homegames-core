# Aquarium

Manage an aquarium until it gets unreasonable

## Controls

- Click or tap the water to drop food. Feeding creatures earns points.
- Open **Shop** to buy life, decor and world upgrades. The aquarium and balance are shared; each player has their own camera and shop.
- Use the on-screen arrows and bottom camera buttons to pan, zoom, return to the tank, or visit unlocked areas.
- Keyboard: arrows or A/D/W/X to pan, Q/E or −/+ to zoom, F/Space to feed, S/Tab to open the shop, 1/2/3 for shop tabs, H/0 for the tank, G for the floor, R/V for space, T for the Horizon.
- At close zoom, tapping a creature also shows its name and feeding history.

## Progress and saves

The host saves automatically every ten seconds, after purchases and on orderly shutdown. Reopening the same game installation resumes it. Guests contribute to the host's aquarium. There is no offline earnings simulation.

Completing the Horizon unlocks a new era. This resets the current tank, money, creatures and decor; completed monuments, permanent world upgrades and era bonuses remain. Solo play requires a second confirmation click. Multiplayer requires a strict majority of connected players.

An unreadable save is preserved with autosave disabled. Failed writes retry while the game remains open. Browser storage can still be cleared; use the player's **Download save** action to keep a separate copy.

## Implementation and checks

Squish 1.5.0; one to eight players; 30 simulation ticks per second. Creature behavior runs at 5 Hz, with spatial indexes and bounded per-player rendering. Timers and movement use elapsed game time. The simulation can contain many more creatures than a given camera renders. All game visuals are local procedural shapes.

From the Core repository:

```sh
node --test test/games/Aquarium.test.cjs test/games/AquariumForeverSave.test.cjs
node test/aquarium-launch-browser.cjs
node test/aquarium-rtc-browser.cjs
node test/aquarium-package-browser.cjs
```

The package check requires a current website build. Browser checks use local Chrome and loopback signaling, with no production services. The performance fixture seeds late-game populations; it does not measure how long a person takes to reach them. See the repository's launch review for evidence and remaining device/network acceptance.
