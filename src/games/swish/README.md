# Swish

made with squish

One to four players share a basketball court, a hoop, and a round clock. There
is no title screen or instruction copy. The wall shows each player's colored
score, remaining time, and the record for the selected theme and duration.

Before a round, the host chooses Classic, Halloween, or Christmas and 30 seconds,
1 minute, or 5 minutes. Those choices are locked while playing, including while
shots already in flight settle after the buzzer. Releasing a new shot after the
clock expires is rejected, even if the drag started earlier. The timer uses wall
clock time, so throttling a browser tab does not grant extra time.

Physics follows elapsed time, with at most 250 ms of catch-up in one tick. Long
host suspensions skip the remaining motion; results appear within five wall-clock
seconds after the buzzer when ticks resume. Keep the hosting tab active during a
round. Pointer cancellation and a replacement press discard the previous aim.
Physics ticks at 60 Hz; continuous scene updates run at the maintainer's chosen
30 Hz. Direct controls and lifecycle changes still draw immediately. Smaller
ellipse geometry and omitted empty visual slots reduce the per-frame payload;
the static between-round court does not repeatedly redraw.

Drag upward from **anywhere on the court** and release. Aim depends on the drag's
displacement, not its starting location or speed. Seven fading dots show only the
first 0.22 seconds of flight. There is no landing marker or full trajectory. A
tap, returning to the starting point, or Escape cancels. Misses return the ball.

The first three baskets introduce the game. Then each theme adds a different
physical obstacle; a second arrives after six total baskets:

| Theme | First obstacle | Second obstacle |
| --- | --- | --- |
| Classic | Rotating padded bar | Horizontally travelling circular bumper |
| Halloween | Bat sweeping sideways and vertically | Spider descending on a thread |
| Christmas | Ornament swinging on a pendulum | Present rising and falling |

These use different trajectories and collider geometry, not equivalent reskins.
The shared basket total advances the hoop and obstacles. Each player earns their
own score; balls in flight can collide and deflect each other. Resting balls stay
on their spots until their players shoot. A halo identifies your ball and aim
guides are private. New players can join mid-round, up to four total.

The top five individual round scores are saved independently for all nine
**theme × duration** combinations through the platform's `saveGame`/`saveData`
contract. They survive reloads on the host's device. Each multiplayer participant's
score enters the same table at round end; scores of departing players are retained
until that round ends. An abandoned session does not record a partial round.
Only the five best departed scores need retention; repeated visitors cannot grow
the round's score state without a bound.
Preferences persist too. These are local court records, not an online leaderboard.

All artwork is Squish geometry. Two locally synthesized WAV effects are bundled.
The game has no external asset or font dependencies. Multiplayer uses the existing
Homegames sharing/RTC transport.

From homegames-core:

```sh
START_PATH=./src/games/swish npm start
node --test test/games/Swish.test.cjs
node --test test/games/SwishLaunch.test.cjs
node test/swish-browser.cjs --serve
```

The last command serves the preview at http://127.0.0.1:4199. Its chain-link button
opens the standard Homegames invitation dialog. The preview uses public Homegames
signaling for invitations; ordinary solo play and local records need no network.
Run without `--serve` for browser acceptance, which starts its own local signaling
service and checks two real Chrome peers, including an emulated touch device.
Set `PLAYWRIGHT_MODULE` and `CHROME_PATH` when necessary.

After building the website, `node test/swish-package-browser.cjs` checks real
30-second rounds, saves and downloaded HTML offline through the visible controls.
`node tools/swish-performance.cjs` compares serialized four-player scenes. These
checks do not replace physical-phone, natural-group or WAN/TURN acceptance.

- `physics.js`: shared court, player balls, rim and obstacle collision, ball-to-ball impacts.
- `themes.js`: seasonal palettes and independent obstacle courses.
- `records.js`: bounded score tables, selection validation and serialization.
- `art.js`: retained scenery, balls, short guides and obstacle artwork.
- `interface.js`: wall scoreboard and the between-round selector.
- `index.js`: round clock, ownership, input, sounds and persistence.

The normal library scan reads the game class metadata. No shared platform files
are modified by this game.
