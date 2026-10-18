# Little Scoop Shop

A gentle, native Homegames game for little hands. Build an ice cream treat and share it with a smiling bunny. There are no timers, scores, wrong combinations, or reading requirements.

- Choose the big cone or cup on the left. Changing the container keeps the current scoops and toppings.
- Tap any flavor tub along the bottom: vanilla, chocolate, strawberry, mint chip, blueberry, or mango.
- Mix up to three scoops. Picking another flavor when the treat is full replaces its top scoop.
- Add or remove sprinkles and a cherry with the two picture buttons on the right.
- The bunny's picture bubble shows a changing wish: a cone or cup, favorite flavors, and sometimes a topping. The first wishes have one scoop; later visits mix two or three. Matching the flavors in either stacking order earns bigger hops and a shower of hearts.
- Tap the glowing bunny to share any treat with at least one scoop. After a short thank-you celebration, a fresh container is ready.
- Free creations are always welcome and get a happy thank-you. The wish is optional, with no wrong answers or time pressure.
- The top-left sound switch mutes immediately. Flavors and controls wait during their short animations; holding or rapidly tapping cannot queue more actions.

The wide 3:2 parlor uses original code-drawn vector artwork with large touch areas and a plain background. Sprinkles, scoops, and the cherry travel into place, and the finished treat moves to the friend. Original, quiet PCM effects provide scooping, soft plops, sprinkle rattles, a cherry tap, and a happy serving chime. WAV bytes are synthesized deterministically inside the game and registered as native Squish assets; no network audio files, API keys, browser APIs, or external game imports are needed. Audio has a four-voice limit, short asset lifetimes, and silent sample edges.

The scene retains a fixed pool of celebration particles; only the three current scoop objects and bounded wish picture are rebuilt. All authored coordinates use a 150-by-100 drawing space and are projected onto Squish's normalized axes. Polygon and text records stay below the native codec's limits.

Run its focused tests from the repository root:

```sh
node testRunner.js ./test/games/LittleScoopShop.test.js
```

Tests cover changing pictured wishes, optional matching and extra delight, all flavors and both containers, mixing/replacing scoops, toggling toppings, explicit serving, held/repeated/malformed/disconnected input, muting, WAV headers and peak levels, bounded audio/scenes, and native `playerFrame` serialization through twelve full servings.

MIT; see `LICENSE`.
