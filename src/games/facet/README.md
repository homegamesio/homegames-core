# Facet

A native Homegames match-three game set in a luminous crystal observatory.
Swap neighboring jewels to make matches, build special combinations, and let
the cascades sing. Every jewel has a distinct silhouette as well as a color.

## Play modes

- **Journey:** 30 seeded stages across the Luminous Atelier, Verdant Grotto,
  and Aurora Spire. Goals mix score, color collection, special creation, and
  single or double layers of frost. Each realm has original artwork, its own
  musical arrangement, and a keepsake awarded after its tenth stage.
- **Zen:** endless, untimed play with automatic reshuffles, personal bests,
  and resumable boards. No move limit or frost objectives.
- **Rush:** a two-minute score challenge. The final accepted move finishes its
  entire cascade before the result. Pausing freezes the clock. Retry plays the
  same starting seed; a new run starts fresh.

## The satisfying bits

Four gems in a line create a **Ray**. A T or L creates a **Nova**. Five in a
line create a **Prism**. Specials activate when matched or caught in another
special's effect. Swap two neighboring specials even without a color match:

| Combination | Effect |
| --- | --- |
| Ray + Ray | A full row and column |
| Ray + Nova | Three rows and three columns |
| Nova + Nova | A larger area blast |
| Prism + ordinary jewel | Clear every jewel of that color |
| Prism + Ray or Nova | Turn that color into specials and trigger the chain |
| Prism + Prism | Clear the whole board |

Cascades raise the score multiplier and the musical pitch. Matches fill
**Radiance**; a full meter empowers the next three successful swaps with
double scoring, including their cascades. Invalid swaps return to their
original places and spend no move or Radiance charge. Hints are free.

Frost belongs to the tile beneath a jewel. Matches and special effects remove
one layer per clear wave. Newly created specials also crack frost on their
tile. Dead boards reshuffle automatically while preserving earned specials.

Journey goals must all be complete when the full cascade settles. Remaining
moves then award **400 points each**. Win for one star, reach the displayed
par score for two, and reach 1.6 times par for three. There are **90 stars,
three keepsakes, and 12 achievements**. Replays can improve records and never
reduce them.

## Controls

| Action | Mouse / touch | Keyboard | Controller |
| --- | --- | --- | --- |
| Swap | Tap two neighbors or drag one toward another | Arrows / WASD to move the cursor, Enter / Space to select each gem | Stick / D-pad and A / Cross |
| Hint | Hint button | H | X / Square |
| Pause | Pause button | P / Escape | Start |
| Back / deselect | On-screen controls | Escape | B / Circle |
| Menus | Click / tap | Arrows and Enter / Space | Directions and A / Cross |
| Realm tabs | Click / tap | Q / E | Shoulders |
| Sound / music / reduced effects | Pause menu | M / N / V | Pause menu |
| Instructions | Help / How to play | ? | Help button |

Drag outside the board to cancel. Repeated held pointer events cannot select
or swap extra gems. Only the active player's input controls the board; a
disconnect pauses it until the next player resumes.

## Progress and portability

Scores, stars, achievements, preferences, and the last stable board use the
Homegames save API. The local preview stores them in the browser under `facet`.
The **Continue** button restores an unfinished board, including its jewels,
specials, frost, goals, remaining moves, Radiance, and refill seed. Closing
during a cascade resumes from the last completed move. Restored statistics
are not credited twice. The original Facet had no persistent save format.

The game streams native Squish 142 geometry at 30 frames per second while its
simulation runs in fixed 120 Hz steps. Drawing clips falling gems to the board,
reuses bounded node pools, and stays below the native 64 KiB frame limit.
Background PNGs and original synthesized audio are embedded, with no runtime
filesystem or network dependencies. See [art/prompts.md](art/prompts.md) for
the saved artwork and built-in image generation prompts.

## Development

Run the local preview with `node tools/facet/serve.cjs` and visit
`http://127.0.0.1:9899/`. `/qa` has explicit developer scene controls and uses
the separate `facet-qa` save key. It is never included in the offline export.

Build a portable HTML copy with `node tools/facet/build.cjs /tmp/facet.html`.
The preview uses the actual Homegames browser-local loader, input router,
asset system, and renderer.

Run the regression suite:

```sh
node testRunner.js ./test/games/FacetEngine.test.js ./test/games/Facet.test.js ./test/games/FacetPlaythroughs.test.js ./test/games/FacetScene.test.js ./test/games/FacetSound.test.js
```

The playthrough fixtures clear all 30 stages through legal swaps and ordinary
refills. Engine tests cover special chains, last-move wins, Rush timing,
determinism, saving, Radiance, and long-play invariants. Adapter tests exercise
the real mouse, touch, keyboard, and Homepad routes. Scene tests serialize and
decode every stage and peak effects through Squish; sound tests check PCM,
mix headroom, voice bounds, and realm transitions.
