# Lemonade Tycoon: Night of the Lemons

Fight lemons in the night and profit during the day

Play solo or with up to six people. The team shares its wallet, pantry, tools and upgrades; purchases and opening the shop require a majority vote.

Progress saves at the start of each morning. Reopening the same installation resumes that morning, including its forecast; purchases and combat after the checkpoint are replayed. Losing ends the run. On the resume screen, New run asks for a second click before replacing the save. The footer shows saving failures, which retry without replacing the checkpoint with mid-day state. Games copied to a new installation start fresh; Download save / Load save transfers progress explicitly.

## Controls

- Move with WASD, arrow keys, or a tap/click on the world.
- Attacks fire automatically at nearby enemies, then sugar cane.
- Space or Shift dodges with a brief invulnerability window. The DODGE button does the same on touchscreens.
- E or the charged-move button spends a full zest meter. Hits, kills and chopping cane build zest.
- During sales, move your dancer and collect lemonade mugs to bring in a customer rush. Dancing is optional.
- The sound button mutes the short synthesized effects.

## Weapons and rewards

The axe cleaves a broad arc, knocks enemies back and fells cane in one swing. Its charged move is a full-circle whirlwind. The bow shoots through three targets; its charged move sends out a piercing fan. The cannon explodes on impact or at the end of its flight; its charged shot has double damage and a wider blast. The axe and bow each cost the starting $18, so either can be your first tool.

Juice Power increases damage (+2 for the cannon, +1 for other tools). Quick Hands shortens attack cooldowns, with a 55% reduction cap. Other upgrades improve health, movement, the stand, defenses or customer tastes. Owned weapons can be re-equipped for free during prep.

KOs earn carried bounty money and lemons. Kills within five seconds build a streak that yields extra lemons. Return to the stand to bank your haul; a delivery of at least 12 ingredients also restores one heart. Bank the night's water/sugar target for a one-time $12 team bonus. Turret kills bank lemons directly. Unbanked loot is lost on death or at dawn. A defeated boss pays 1.8 times the challenge fee, grants a Juice Power level and starts a stronger era.

## The little business

Morning prep keeps the recipe, price and available cup count together. Open the separate Shop for gear, stand decorations, upgrades, restocking or a boss challenge; Back returns to the same recipe. Weather gives a short taste cue, while individual customers have their own preferences and budgets. Stand decorations change reputation, turnout, price tolerance or tips. A daily sales/dancing goal pays a bonus, and the closing report shows revenue and tips before the 75-second night begins. Restocking adds 20 of every ingredient for $8.

The additional vendor, mug, walking and dancing drawings are preserved from the supplied cutouts. `assets/sources.json` records their original filenames and hashes. Effects are original synthesized WAVs; all media is local. Each sprite retains its original aspect ratio.

## Verification and preview

Run `node --test test/games/LemonadeTycoon*.test.cjs` from the repository root. `test/lemonade-browser.cjs` checks actual desktop and touch controls, local assets, sales and all three weapons in Chrome; pass `--serve` for a local preview on port 4211. It uses the bundled Node/Playwright runtime, or `PLAYWRIGHT_MODULE` and `CHROME_PATH` overrides. `test/lemonade-launch-browser.cjs` plays a complete timed day/night with a separate RTC guest and reopens the saved morning. `test/lemonade-package-browser.cjs` checks the built website package and downloaded offline HTML. `tools/lemonade-performance.cjs` measures local frame costs with and without hidden-node filtering.

The focused tests cover mechanics, voting, rewards and serialization. Automated gathering/combat runs inform pacing; they do not establish a final difficulty balance for every team size or late-game era.

Consolidated from `lemonade-stand-main.zip`. Game code and authored media live in this folder. Original `LICENSE` is preserved.

Catalog: Included in the curated collection.

Enable `TESTS_ENABLED` to try hidden games. Remove `isTest: true` from metadata to restore a game to the default catalog.

See [the consolidation review](../../../docs/game-consolidation.md) for archive decisions, screenshots and verification limits.
