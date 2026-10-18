# Little Slugger

An aim-and-swing baseball game for little hands. Choose one of the three colored outfield stars, tap **PITCH**, then **SWING** (or Teddy/the ball) to hit toward it. Each different star fills its matching sticker; collecting all three starts a new star team with gently moving targets. Repeated hits are welcome, but they cannot fill a different sticker.

Pitching is the default. The upper-left ball/tee control switches to patient tee practice, where hits bounce along the grass. Tap **PITCH**, then watch the ball travel from the outfield friend to Teddy. The large contact ring and swing button turn green for a generous swing window. A swing during that window makes a big sky hit. An early or late swing is saved until the next contact window and becomes an assisted line drive. Pitches keep repeating patiently until the child swings. There are no strikes, countdowns, or losing.

The child chooses the aim and whether to use a stationary tee or a moving pitch. The three hit styles have distinct ball paths; each completed collection brings moving targets. Extra taps on scenery or during an outgoing hit do not advance the game, and a held pointer or key cannot start the next swing.

Keyboard/gamepad: Space or Enter pitches/swings, arrows choose a target, 1/2/3 choose a star directly, and P switches tee/pitch. Gamepad primary button swings, secondary button switches mode, and left/right choose the aim. Quiet original sounds can be muted in the upper right.

Native Homegames game using Squish 1.5.0; one player; all art and audio generated in this game folder. Touch, mouse, keyboard and gamepad supported. No network requests or external assets are required.

Run the focused checks from homegames-core with `node testRunner.js ./test/games/LittleSlugger.test.js`. Checks cover aiming and collection rules, pitch timing and assistance, held input, sound/disconnect behavior, and bounded frames through the production GameSession serializer.

MIT; see LICENSE.
