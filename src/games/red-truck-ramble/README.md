# Red Truck Ramble

A relaxed off-road toy for little hands, featuring an original red extended-cab pickup inspired by the boxy early-2000s Ford F-250. A bear rides along in the cab. Cruise a woodland trail with hills, three launch ramps, chunky rotating tires, springy suspension, dust, and friendly assisted flips. The trail loops endlessly without a timer, fuel, score, or failure.

- Tap **GO!** once to keep cruising. Tap **stop** to take a break. Held fingers do not repeatedly toggle the button.
- Tap **back** to cruise in reverse; tap again to stop.
- **flip!** turns gold in the air. Tap it for one full assisted flip; it gives a little lift so a late tap still has time to land happily. Tap early on the ground and it says **ready!**, saving one flip for the next ramp. No precise timing is needed.
- Tap the truck to toot its two-note horn.
- **help ↻** parks the truck upright in a nearby clearing. **sound on/off** controls all audio.
- Keyboard: hold Right/D or Left/A to drive; Enter toggles cruising; Space/Up flips; H toots; R helps. Gamepad face buttons support cruise, flip, help and horn.

The native Squish 1.5.0 game uses a 3:2 landscape canvas. Its small deterministic vehicle engine uses fixed 120 Hz steps, gravity, terrain following, suspension and forgiving landing assistance. It is a playful driving model for toddlers, not a vehicle simulator. The world scrolls continuously rather than teleporting at the end of a lap.

All artwork is original vector geometry. Original quiet PCM sounds model diesel grumbling, gravel, air, suspension thumps and a horn. Engine textures change with speed and airtime, stop with the drive control, and respect mute. A bounded four-voice pool prevents sound buildup. No downloaded assets, external services or dependencies beyond Squish are needed.

From homegames-core, run:

```sh
node testRunner.js ./test/games/RedTruckRambleEngine.test.js ./test/games/RedTruckRambleAudio.test.js ./test/games/RedTruckRamble.test.js
```

The suites cover long drives, ramps and full flips, input guards, replay and reconnect, quiet bounded audio, and complete production GameSession frame encoding.
