# Family board game night: classic games pass

The pass covers the seven board classics and five card classics in `src/games`. It preserves the wood-and-felt table aesthetic and existing rules, with clearer actions, larger supporting text, and visible turn feedback.

| Game | Changes |
| --- | --- |
| Battleship | Portrait table, one large private grid with Fleet / Their waters tabs, ship lengths and placement progress, explicit hit/miss/sunk symbols, shot coordinates, ships remaining, one placement/rotation per press. |
| Connect Four | Blue board, brighter marked discs, whole-column hit areas, column numbers and 1–7 keys, consistent Gold naming, protected drop animation when another person joins. |
| Checkers | Outlined movable pieces, destination dots, instructions for required jumps and kings, private keyboard cursor with arrows and Enter/Space, stable selection during a held press. |
| Chess | Readable outlined/solid pieces on lighter squares, destination dots and capture outlines, plain-language check guidance, promotion buttons with full piece names below the board. |
| Mancala | Colored stones and outlined playable pits, labeled store directions, larger counts/supporting text, clear goal and extra-turn guidance. |
| Backgammon | Bordered checker shapes replace small glyphs, outlined move points, clearer opening-roll and collection instructions, explained doubling choices. |
| Tic-Tac-Toe | Higher-contrast X/O marks, numbered empty squares and 1–9 keys, clearer objective and win outlines. |
| Crazy Eights | Marked playable cards, explicit matching instructions, higher-contrast suit and hand labels. |
| Hearts | Clear goal and passing instructions, marked choices, readable completed-trick pause, no fifth card while a trick is resolving. |
| Spades | Partnership and bidding explanations, legal-card markers, readable completed-trick pause, no fifth card while a trick is resolving. |
| Go Fish | Explain sets of four, guide card-then-person selection, visible pond count, clamp hand pages after a set is removed. |
| Blackjack | Explain the goal and Hit/Stand actions, clarify play chips, readable action-button colors. |

The five card games keep their local `theme.js` files so each game folder remains independently portable. Card ranks, suits, choice markers, and button labels now inherit their parent visibility; hiding a card/control can no longer leave its label visible.

## Validation

- Actual Homegames browser client: all 12 games inspected at a desktop viewport; Battleship also inspected at 390 × 844, including ship placement. Its portrait grid uses 80% of the canvas width (previously each of the two grids used 40%).
- `node testRunner.js ./test/games/Classics.test.js`: 26 focused lifecycle, input, animation, per-player serialized-frame privacy, completed-trick, and pagination checks.
- Full suite with the existing client dependencies on `NODE_PATH`: 235 passed, two failures in untouched Clicktionary tests (`full game playthrough with 3 players` and `ink cap and clear`, both accessing an undefined `.length`). The runner kept timer handles open after its final test and was stopped.
- No external assets or new package dependencies.

## Remaining accessibility work

This is a visual and interaction pass, not an accessibility certification. The client still renders boards and instructions into canvas: a semantic screen-reader interface, comprehensive keyboard navigation for every classic, zoom/large-text controls, and reduced-motion settings need a platform-level follow-up. The dense Backgammon and four-player card tables also warrant dedicated phone layouts and family playtesting. Very short pointer taps can be missed by the current client's frame-polled input handler; that client behavior is outside these game-folder changes.
