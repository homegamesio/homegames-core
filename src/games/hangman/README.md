# Hangman

Classic hangman

For one to eight players. Choose **Play** for the original character, or **Draw your own** to create six cumulative stages. Each stage adds to the previous drawing; Undo and Clear affect the current stage. Use original leaves the editor without saving a custom character.

Tap a letter or press A–Z to guess. Five wrong letters end the round. Players take turns entering a secret phrase; the setter cannot guess their own answer. Solo play uses random puzzles, and multiplayer also includes a CPU turn. Random word and the 30-second entry deadline choose from 492 familiar words and phrases. Custom artwork remains available in solo play and when its author chooses Random word.

Custom phrases allow 1–60 printable ASCII characters, including at least one A–Z letter. Whitespace is normalized and curly apostrophes become straight apostrophes. Punctuation and digits are visible without guessing. The secret input belongs only to the setter; other participants receive masked letters until the round ends. The hosting browser necessarily owns the game state, including the answer.

The result retains R.I.P and killed-by attribution, followed by the Score / Kills table. Scores count each player's correct and incorrect guesses separately; the fifth incorrect guess adds a kill. Scores and Next round allow immediate continuation; otherwise results advance after three seconds and scores after five. A fresh game resets scores; no persistent save is needed for these short rounds.

The original character images, fonts and scribble sounds are retained. The description is Joseph Garcia's supplied text; keeping the drawing feature and existing results, and using familiar random puzzles, are maintainer decisions.

## Maintenance

- Round callbacks validate phase, participant and round identity. Absolute deadlines replace queued actions; accepted answers cannot be overwritten by old entry timers.
- Departures remove private UI, drawing data and input hooks. A departing setter or last guesser cannot leave a stuck round.
- Drawing is bounded to 55 points per stroke, 32 strokes and 600 points per stage. Six cumulative stages remain bounded in memory and serialization.
- Although ticks run at 60 Hz, unchanged scenes do not generate game frames. Only input and deadline changes mark the scene dirty.
- Tests: `node --test test/games/Hangman.test.cjs`, `node test/hangman-launch-browser.cjs`, and, after building the website, `node test/hangman-package-browser.cjs`.

Physical phone drawing, group pacing and public-network/TURN acceptance remain part of the launch checklist.
