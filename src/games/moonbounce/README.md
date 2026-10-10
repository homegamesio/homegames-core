# Moonbounce

An original celestial peg-bouncing arcade game for Homegames. Line up a shot,
send a moonball through a constellation of pegs, and enjoy the cascade. Clear
every orange peg to light the constellation and trigger the finale.

An adventure map connects **40 authored levels in five illustrated worlds**.
Each world has eight stages, a finale, an original musical arrangement, and
three unlockable mastery challenges. Levels introduce mechanics gradually:

| World | New possibilities | Finale reward |
| --- | --- | --- |
| Lunar Garden | Learn catches, green powers, bank shots and chains | Supernova |
| Sunforge Atoll | Springy sun bumpers launch lively ricochets | Gemini |
| Tideglass Isles | Paired portals carry a ball across the board | Cometkeeper |
| Clockwork Canopy | Moving and orbiting constellations reward timing | Dawnkeeper |
| Aurora Crown | Portals, bumpers and moving stars come together | Keeper of the Sky trophy |

Every hit raises the musical pitch and leaves a glowing peg in your chain. Bank
shots, long shots, and streaks earn celebratory style bonuses; the moving
catcher returns a ball when you land inside it, and score milestones earn more
shots. Choose an unlocked character from the crew before playing:
**Stargazer** reveals the bounce ahead; **Supernova** clears nearby pegs;
**Gemini** launches twin balls; **Cometkeeper** gently attracts powered balls
toward nearby orange stars; **Dawnkeeper** rescues one missed ball per powered
shot. Each board starts with two powered shots; green pegs recharge your ability.

| Action | Controls |
| --- | --- |
| Aim | Hold and drag mouse / finger, or left / right arrows |
| Fire | Release mouse / finger, or Space |
| Quick shot | Click or tap the board to aim and fire |
| Confirm menu / next board | Enter or Space, or the on-screen button |
| Navigate menus | Arrow keys, or click / tap a button |
| Select unlocked power | 1–5, or the crew screen |
| Visit another world | Q / E, or the world tabs |
| Select unlocked board | Choose its constellation on the adventure map |
| Back from a menu | Escape |
| Speed up a shot | Hold Space, or hold the board while the ball is in flight |
| Pause / resume | P, or the pause button |
| Toggle sound | M |
| Toggle background music | N |
| Toggle reduced effects | V |

Controllers work throughout: left stick / D-pad aims, A / Cross fires or confirms,
Start pauses, and B / Circle resumes. Hold A / Cross or the right trigger to
speed up a shot; shoulders browse worlds, directions choose menu options, and
B / Circle goes back. Hold
Shift on keyboard or the controller's left trigger for precise aiming. Drag
outside the board before releasing to cancel a pointer shot.

Clear every orange with the available balls to advance. Orange clears raise the
score multiplier up to 10×; streaks and violet pegs boost shot points. Crossing
10,000, 25,000 and 50,000 points within one shot each earns an extra ball. The
last orange triggers a slow-motion finish and five jackpot slots worth up to
50,000 points. Every unused ball adds 2,000 points when the board clears. Retry
restores the current board and its starting score. Close approaches to the last
orange slow down for a moment of anticipation, then the finale opens the jackpot
slots with a musical fanfare. Dramatic moments keep their pace while fast-forward
is held.

Clearing a board unlocks the next constellation and earns a star. Meet the board's
par score for two stars, or 1.6× par for three. Best scores and medals persist
across runs; replay any unlocked board with an unlocked character to improve them.
World completion returns to the map and reveals a new character and three
challenge boards. There are **120 adventure stars**, **45 challenge stars**, and
**12 permanent trophies** for exploration, catches, chains, and mastery.

The 15 challenges remix selected levels with score, catch, or style goals and
curated ball limits. Clear all orange stars **and** meet the displayed extra
goal. Challenge medals and best scores are separate from the adventure. The
objective meter stays visible during play; a missed goal gets an explicit result
and a quick retry. Some challenges select a particular character to teach its
strengths.

Best scores and preferences use Homegames save data; the local preview keeps
them in browser storage. Version 1 saves migrate to the adventure without losing
their six original medals, preferences, best score, or original three characters.
New profiles begin with Stargazer. Progress is recorded after each shot and
completed board; a failed replay never reduces a record.

The five illustrated worlds are embedded as PNGs; jewel
pegs, the expressive moon host, catcher, ball reservoir, fever meter, effects,
and menus are rendered with Squish primitives. Layered sound effects, a quiet
world-specific background arrangements, and the original celebration fanfare are synthesized PCM
audio. Music and all sound have separate controls. There are no external assets
or downloads during play. The illustration's prompt and provenance are in
[`art/README.md`](art/README.md) and [`art/adventure-prompts.md`](art/adventure-prompts.md).

## Play locally

From `homegames-core`:

```sh
node tools/moonbounce/serve.cjs
# Open http://127.0.0.1:9898/

node tools/moonbounce/build.cjs /tmp/moonbounce.html
# Open /tmp/moonbounce.html for a fully offline copy.
```

The preview uses the actual Homegames client and game module. The standalone
build bundles that same client, source, illustrations, and generated audio into
one HTML file.
The server binds only to this computer. Set `MOONBOUNCE_PORT` to change its port.
The build accepts an optional output path; without one it writes to
`tools/moonbounce/moonbounce.html`.

The core local-game loader discovers `src/games/moonbounce` directly. The game
imports `squish-142` and its own modules, with a fixed 16:9 playfield that scales
to the available screen.

Run the physics, campaign, input, save, sound, and serialization checks:

```sh
node testRunner.js ./test/games/MoonbounceEngine.test.js ./test/games/MoonbounceAdventureContent.test.js ./test/games/MoonbounceProgression.test.js ./test/games/Moonbounce.test.js ./test/games/MoonbounceNavigation.test.js ./test/games/MoonbouncePlaythroughs.test.js ./test/games/MoonbounceSound.test.js
```

GPL-3.0. See `LICENSE`.
