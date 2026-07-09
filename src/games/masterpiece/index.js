const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');
const { COLORS } = Colors;

const GRID_COLS = 3;
const GRID_ROWS = 4;
const SLOT_COUNT = GRID_COLS * GRID_ROWS;

// painting region — portrait-shaped on a 16:9 canvas (~3:4 physical)
const PAINT_X = 33;
const PAINT_Y = 12;
const PAINT_W = 34;
const PAINT_H = 72;
const TILE_W = PAINT_W / GRID_COLS;
const TILE_H = PAINT_H / GRID_ROWS;
const SEAM = 0.15;

const SHUFFLE_MOVES = 120;
const PEEK_SECONDS = 2;
const VICTORY_SECONDS = 8;

const WALL = [74, 30, 34, 255];
const MAT = [38, 24, 20, 255];
const GOLD = [201, 166, 90, 255];
const GOLD_DARK = [140, 110, 52, 255];
const CREAM = [244, 232, 208, 255];
const GOLD_GLOW = { shadow: { color: [255, 214, 120, 255], blur: 20 } };

const slotPos = (slot) => ({
    x: PAINT_X + (slot % GRID_COLS) * TILE_W,
    y: PAINT_Y + Math.floor(slot / GRID_COLS) * TILE_H
});

// crop the source image down to one tile of the grid
const tileCrop = (homeSlot) => {
    const col = homeSlot % GRID_COLS;
    const row = Math.floor(homeSlot / GRID_COLS);
    return {
        cropLeft: (col / GRID_COLS) * 100,
        cropRight: ((GRID_COLS - 1 - col) / GRID_COLS) * 100,
        cropTop: (row / GRID_ROWS) * 100,
        cropBottom: ((GRID_ROWS - 1 - row) / GRID_ROWS) * 100
    };
};

class Masterpiece extends Game {
    static metadata() {
        return {
            squishVersion: '142',
            name: 'Masterpiece',
            author: 'Homegames',
            description: 'A priceless painting has been scrambled. Slide the tiles to restore the masterpiece.',
            aspectRatio: { x: 16, y: 9 },
            assets: {
                // Asset ids must be inline string literals — local play parses
                // metadata() statically and can't follow variable references.
                // TODO: replace with the real asset id for the painting
                'painting': new Asset({
                    id: 'REPLACE_WITH_PAINTING_ASSET_ID',
                    type: 'image'
                })
            }
        };
    }

    constructor() {
        super();
        this.moves = 0;
        this.phase = 'play';
        this.peeking = false;

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: WALL
        });

        // gilded frame around the painting, with a dark mat behind the tiles
        const frameX = 1.8;
        const frameY = frameX * 16 / 9;
        this.base.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(PAINT_X - frameX, PAINT_Y - frameY, PAINT_W + 2 * frameX, PAINT_H + 2 * frameY),
            fill: GOLD,
            color: GOLD_DARK,
            border: 3,
            effects: { shadow: { color: [20, 10, 8, 255], blur: 14 } }
        }));
        this.base.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(PAINT_X, PAINT_Y, PAINT_W, PAINT_H),
            fill: MAT
        }));

        // brass plaque under the frame
        const plaque = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(41, 90, 18, 5.5),
            fill: GOLD,
            color: GOLD_DARK,
            border: 2
        });
        plaque.addChild(new GameNode.Text({
            textInfo: { text: 'La Dame, restored by you', x: 50, y: 91.6, size: 0.9, align: 'center', color: MAT }
        }));
        this.base.addChild(plaque);

        // left panel: title, move counter, peek button
        this.base.addChild(new GameNode.Text({
            textInfo: { text: 'THE GALLERY', x: 14, y: 8, size: 1.9, align: 'center', color: CREAM }
        }));
        this.movesText = new GameNode.Text({
            textInfo: { text: 'MOVES 0', x: 14, y: 15, size: 1.4, align: 'center', color: GOLD }
        });
        this.base.addChild(this.movesText);

        const peekButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(8, 70, 12, 9),
            fill: MAT,
            color: GOLD,
            border: 3,
            onClick: (playerId) => this.handlePeek(playerId)
        });
        peekButton.addChild(new GameNode.Text({
            textInfo: { text: 'PEEK', x: 14, y: 72.6, size: 1.4, align: 'center', color: CREAM }
        }));
        this.base.addChild(peekButton);

        // right panel: how to play
        this.base.addChild(new GameNode.Text({
            textInfo: { text: 'Tap a tile beside', x: 85, y: 44, size: 1.1, align: 'center', color: CREAM }
        }));
        this.base.addChild(new GameNode.Text({
            textInfo: { text: 'the gap to slide it', x: 85, y: 48, size: 1.1, align: 'center', color: CREAM }
        }));

        // the sliding tiles — one Asset node per tile, cropped to its home region.
        // bottom-right slot starts empty.
        this.tiles = [];
        this.blankSlot = SLOT_COUNT - 1;
        for (let home = 0; home < SLOT_COUNT - 1; home++) {
            const tile = { home, slot: home };
            tile.node = new GameNode.Asset({
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                assetInfo: {
                    'painting': {
                        pos: { x: 0, y: 0 },
                        size: { x: TILE_W - 2 * SEAM, y: TILE_H - 2 * SEAM },
                        ...tileCrop(home)
                    }
                },
                onClick: (playerId) => this.handleTileTap(tile)
            });
            this.placeTile(tile);
            this.tiles.push(tile);
            this.base.addChild(tile.node);
        }

        // zero-size overlay for the peek / victory reveal, last so it draws on top
        this.overlay = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
        this.base.addChild(this.overlay);

        this.shuffle();
    }

    getLayers() {
        return [{ root: this.base }];
    }

    placeTile(tile) {
        const { x, y } = slotPos(tile.slot);
        tile.node.node.coordinates2d = ShapeUtils.rectangle(x, y, TILE_W, TILE_H);
        tile.node.node.asset = {
            'painting': {
                pos: { x: x + SEAM, y: y + SEAM },
                size: { x: TILE_W - 2 * SEAM, y: TILE_H - 2 * SEAM },
                ...tileCrop(tile.home)
            }
        };
    }

    isAdjacent(slotA, slotB) {
        const colA = slotA % GRID_COLS, rowA = Math.floor(slotA / GRID_COLS);
        const colB = slotB % GRID_COLS, rowB = Math.floor(slotB / GRID_COLS);
        return Math.abs(colA - colB) + Math.abs(rowA - rowB) === 1;
    }

    slideTile(tile) {
        const from = tile.slot;
        tile.slot = this.blankSlot;
        this.blankSlot = from;
        this.placeTile(tile);
    }

    // shuffle by playing random legal moves backwards from solved — always solvable
    shuffle() {
        let lastMoved = null;
        for (let i = 0; i < SHUFFLE_MOVES; i++) {
            const candidates = this.tiles.filter(t => t !== lastMoved && this.isAdjacent(t.slot, this.blankSlot));
            const tile = candidates[Math.floor(Math.random() * candidates.length)];
            this.slideTile(tile);
            lastMoved = tile;
        }
        if (this.isSolved()) {
            this.slideTile(this.tiles.find(t => this.isAdjacent(t.slot, this.blankSlot)));
        }
        this.base.node.onStateChange();
    }

    isSolved() {
        return this.tiles.every(t => t.slot === t.home);
    }

    handleTileTap(tile) {
        if (this.phase !== 'play' || this.peeking || !this.isAdjacent(tile.slot, this.blankSlot)) {
            return;
        }
        this.slideTile(tile);
        this.moves += 1;
        this.setMovesText(`MOVES ${this.moves}`);
        if (this.isSolved()) {
            this.handleVictory();
        }
        this.base.node.onStateChange();
    }

    setMovesText(text) {
        this.movesText.node.text = { text, x: 14, y: 15, size: 1.4, align: 'center', color: GOLD };
    }

    fullPainting(effects) {
        return new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(PAINT_X, PAINT_Y, PAINT_W, PAINT_H),
            assetInfo: {
                'painting': {
                    pos: { x: PAINT_X, y: PAINT_Y },
                    size: { x: PAINT_W, y: PAINT_H }
                }
            },
            effects
        });
    }

    handlePeek(playerId) {
        if (this.phase !== 'play' || this.peeking) {
            return;
        }
        this.peeking = true;
        this.overlay.addChild(this.fullPainting());
        this.setTimeout(() => {
            this.peeking = false;
            this.overlay.clearChildren();
        }, PEEK_SECONDS * 1000);
    }

    handleVictory() {
        this.phase = 'over';
        this.overlay.addChild(this.fullPainting(GOLD_GLOW));
        this.overlay.addChild(new GameNode.Text({
            textInfo: { text: 'MASTERPIECE', x: 14, y: 38, size: 1.8, align: 'center', color: GOLD }
        }));
        this.overlay.addChild(new GameNode.Text({
            textInfo: { text: 'RESTORED', x: 14, y: 43, size: 1.8, align: 'center', color: GOLD }
        }));
        this.overlay.addChild(new GameNode.Text({
            textInfo: { text: `in ${this.moves} moves`, x: 14, y: 49, size: 1.2, align: 'center', color: CREAM }
        }));
        this.setTimeout(() => {
            this.overlay.clearChildren();
            this.moves = 0;
            this.setMovesText('MOVES 0');
            this.phase = 'play';
            this.shuffle();
        }, VICTORY_SECONDS * 1000);
    }
}

module.exports = Masterpiece;
