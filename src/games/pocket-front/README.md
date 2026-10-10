# Pocket Front

A colorful, single-player RTS built from procedural shapes, custom image cursors, and small synthesized sound effects. Defend HQ through six short waves, defeat the Dreadnought, then start a fresh run or keep pushing in endless mode.

## Play

- Drag a box around troops to select them. Click a troop to select it; Shift adds to the selection. **A** selects everyone.
- Click the battlefield to move your selected troops in formation. Click an enemy to focus fire. Troops also fight automatically. With no troops selected, clicking sets the rally point for recruits.
- Recruit Rangers, Tanks, or Medics from the right panel (**1–3**). Rangers are inexpensive; tanks fire splash shells; medics heal nearby troops.
- Select Gun Turret, Mortar, or Mint (**4–6**) and click open ground to build. Escape cancels placement. Mints earn credits during battle.
- Stand near a flag to capture it. Each owned flag adds battle income. Gold crates grant a one-time supply boost.
- Upgrade HQ for more armor, income, and army capacity, or repair it between attacks.
- Press **Space** to launch the next wave. Choose one of three free upgrades after each of the first five waves (**1–3**).
- **P** pauses, **H** opens the guide, **M** toggles sound. Escape closes the guide, cancels construction, or pauses.

Preparation lets you position troops and construct defenses without enemy pressure. Passive income runs only during battle. Best completed wave, best kill count, and sound preference use Homegames saves.

## Run locally

From `homegames-core`:

```sh
START_PATH=src/games/pocket-front node index.js
```

The game runs in the shared Homegames session runtime. The session explicitly selects the arrow, command, attack, and construction cursors; the browser only displays the requested asset.

## Checks

```sh
node testRunner.js ./test/games/PocketFrontEngine.test.js ./test/games/PocketFront.test.js
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_PATH=/path/to/chrome node test/pocket-front-browser.cjs
```

`engine.js` owns deterministic simulation and balance; `scene.js` paints the field and menus; `feedback.js` generates cursor images and sound; `index.js` connects Homegames input, saves, and the bounded node painter.
