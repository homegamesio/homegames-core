# Mouth House

A portrait dinner party for the very unreasonable creature living in your phone.
Play alone or with up to four people. Five courses, six shared burps, no timer.

Read its food rules and find the one snack satisfying all of them. Flick a card
upward with a short thumb gesture, or tap a card and then tap the mouth. Each good
course gives the house another ridiculous body part. On later courses it develops
opinions about the food's personality, and starts asking for things it *doesn't*
want. A rejected snack stays crossed out for that course.

With friends, the house whispers different rules to each screen. Talk about them
or tap **Share my clue** to reveal your rules to the whole table. People can join
or leave during dinner; rules redistribute immediately. Alone, all rules are
visible. Any diner can feed the shared house, but only one snack is judged at a
time. Press **Next course** when everyone is ready to move on.

The 9:19 canvas uses six large bottom-screen cards, release-to-feed gestures,
lifted previews, and safe top/bottom margins. Cancelled touches return the snack.
On desktop, 1–6 selects a snack, Enter feeds/continues, S shares, Escape cancels.

Completed dinners save your best remaining burps and a collection of nine weird
roommate titles. The complete project, sounds, and drawing code work offline;
multiplayer uses the standard Homegames invitation flow.

From homegames-core:

```sh
node --test test/games/MouthHouse.test.cjs
node test/mouth-house-browser.cjs
node test/mouth-house-browser.cjs --serve
node tools/portable-game.cjs pack src/games/mouth-house /tmp/mouth-house.zip
node tools/portable-game.cjs html src/games/mouth-house /tmp/mouth-house.html --trusted
```

All art is drawn by the game. Sound effects are original synthesized PCM audio;
regenerate them with `node tools/mouth-house-assets.cjs`. The catalog thumbnail
is a screenshot of the real game, written by the browser acceptance test.
