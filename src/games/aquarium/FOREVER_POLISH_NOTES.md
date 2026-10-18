# Aquarium Forever — 60 Hz / Forever Polish Pass

## 60 Hz is now the authored tick rate
- `TICK_RATE` and literal `metadata().tickRate` are both `60`.
- Core movement, cameras, fish/alien acceleration, timers, AI cadence, and cooldowns remain expressed in seconds via `DT`.
- Three legacy ambient horizontal drift terms (water food, space food, bubbles) were authored as 30 Hz per-frame nudges. They are now normalized with `LEGACY_30HZ_FRAME_SCALE`, so doubling tick rate improves smoothness without doubling lateral motion.
- Manual feeding remains covered at 60 Hz.

## Progression communication
- Horizon monument unlocks now show a short top-center celebration to every connected player, even with the shop closed.
- Completing an Era gets a distinct Era celebration with the exact next permanent multiplier.
- The newly unlocked Horizon monument pulses briefly when visible.
- The Tank/Horizon shop now shows the *next* monument and percent progress toward that milestone rather than only total Era earnings.
- Prestige UI previews the exact multiplier change (for example `x1.75 → x3.06`).
- Multiplier formatting preserves useful decimals instead of truncating `1.75x` to `1x`.

## Long-run scaling
- Era goals no longer arbitrarily stop increasing after the old fixed exponent cutoff. They compound until they reach the economy's safe cap; after that, later Eras intentionally become faster victory laps as the permanent reward multiplier continues to grow.

## Validation
- `node --check` passes.
- Mock runtime smoke: join + 60 Hz ticking + Horizon unlock + celebration + Era reset.
- 8-player 60 Hz smoke passes.
- Manual feeding regression passes at 60 Hz.
