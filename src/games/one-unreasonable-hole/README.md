# One Hole, Absolutely Unreasonable

Build a tiny golf hole using walls, bumpers, fans, ramps and moving walls. Choose
a tool and tap the grass; Rotate changes the next obstacle's direction. Tee and
Cup relocate the start and finish. Erase, Undo and Clear make experiments easy.
There are at most fourteen obstacles. The first player edits; everyone can play.

Press Play, pull back from your ball, and release to putt. Alternatively tap a
target, adjust power with − / +, then press Putt. Each of up to four players gets
twelve strokes; balls don't collide with one another. Slow down near the cup.
The round ends when everyone finishes or exhausts their strokes. Edit course
returns to the workshop; Another round starts everyone at the tee again.

The default layout lives in `creation.js`. The game saves edits as `course.json`
bytes using `createExport`, and reads that name from constructor `userExports`.
The session stores it in `user-exports/` alongside unchanged game source, on both
Node and browser hosts. Download game and Share a copy include the saved course;
balls, scores and the current round are excluded. Edit the JSON file and restart
to try a mod. All source and graphics in this directory are MIT licensed.
