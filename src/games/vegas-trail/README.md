# Vegas Trail

Travel from Tucson to Las Vegas and conquer foes along the way

For 1–8 players, with shared supplies and one shared trip. Select **Embark** to start. The trip takes about 15 minutes and ends at Las Vegas. **Play again** starts a fresh trip with the connected players after either a win or a loss. Reloading starts over; this game does not save progress.

## Controls

Use the five icons across the top to switch activities. Each player chooses their own view; the trip, driving hazards and illness continue while other activities are open.

- Map: track the party, tap landmarks, or call Mr. Stick's shop with the shop icon. The drone opens a separate shop for each requester. Pick an item, then Buy. Arrows change pages; X closes it.
- Drive: tap a horizontal position to steer. Dodge obstacles and collect scrap. Missed scrap earns nothing. Car damage consumes spare wheels when its health runs out.
- Hunt: tap to aim a throw. Weapons have a cooldown and use shared ammo. Defeated creatures drop scrap; rock and biscuit upgrades penetrate targets.
- Fight: tap the left or right half to punch when the bug leans to that side. Missed defenses cause sickness; antibiotics are consumed when sickness health runs out.
- Talk: meet a stranger. Encounters refresh at most every three seconds, and promised resources go into the shared supplies.

Food is consumed every twelve seconds for each connected player. A purchase gives the displayed bundle: 40 food, 100 ammo, one wheel or four antibiotics at the configured prices. Late joins enter the current trip; departed players stop consuming food. Phones can use touch throughout; landscape gives the original wide artwork more room.

## Credits

Game and artwork: Joseph Garcia. Music: **@nytan on Bandcamp**, as credited in the original game. Existing story and dialogue retained with the maintainer's approval. Keep the accompanying LICENSE and asset provenance notices with copies.

## Verification

From the Core repository, use Node 24:

```sh
node --test test/games/VegasTrail.test.cjs
node tools/vegas-trail-simulation.cjs
node test/vegas-trail-launch-browser.cjs
node test/vegas-trail-package-browser.cjs
```

The simulation uses scripted players and an accelerated clock with normal starting supplies and paid purchases. Browser checks cover real RTC input/media and offline HTML, with explicit seeded arrival/failure scenarios. Human group pacing, physical phones and constrained networks still need acceptance. See `docs/review-evidence/vegas-trail-polish-2026-10-17/README.md` in the Core repository.
