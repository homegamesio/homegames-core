const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { COLORS } = Colors;

const GRID_COLS = 3;
const GRID_ROWS = 4;
const SLOT_COUNT = GRID_COLS * GRID_ROWS;

// A portrait canvas keeps the painting large on a phone or desktop.
const PAINT_X = 12;
const PAINT_Y = 14;
const PAINT_W = 76;
const PAINT_H = 72;
const TILE_W = PAINT_W / GRID_COLS;
const TILE_H = PAINT_H / GRID_ROWS;
const SEAM = 0.15;

const SHUFFLE_MOVES = 24;
const PAINTINGS = [{ key: 'painting', name: 'La Dame' }, { key: 'night-ferry', name: 'Night Ferry' }, { key: 'sunroom', name: 'Sunroom' }];
const PEEK_SECONDS = 2;


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
            thumbnail: './assets/thumbnail.png',
            name: 'Masterpiece',
            author: "Joseph Garcia",
            description: 'Restore three original paintings. Drag tiles into the gap, peek when you need a hint, and open the next work when it is complete.',
            aspectRatio: { x: 3, y: 4 },
            assets: {
                'pointer-grab': new Asset({ path: './assets/cursor-grab.png', type: 'image' }),
                'pointer-hold': new Asset({ path: './assets/cursor-hold.png', type: 'image' }),
                'night-ferry': new Asset({ path: './assets/night-ferry.svg', type: 'image' }),
                'sunroom': new Asset({ path: './assets/sunroom.svg', type: 'image' }),
                'painting': new Asset({
                    path: './assets/la-dame.svg',
                    type: 'image'
                })
            },
            gameId: "996a0cfe-d512-5f7b-a32a-7baf84f30c46",
            maxPlayers: 1
        };
    }

    constructor({ setCursor } = {}) {
        super();
        this.setCursor = setCursor;
        this.drag = null;
        this.paintingIndex = 0;
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
        const frameY = frameX * 3 / 4;
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
            coordinates2d: ShapeUtils.rectangle(25, 93, 50, 5.5),
            fill: GOLD,
            color: GOLD_DARK,
            border: 2
        });
        this.plaqueText = new GameNode.Text({ textInfo: { text: PAINTINGS[0].name, x: 50, y: 94.2, size: 1.5, align: 'center', color: MAT } });
        plaque.addChild(this.plaqueText);
        this.base.addChild(plaque);

        // Compact controls above the painting

        this.movesText = new GameNode.Text({
            textInfo: { text: '0', x: 25, y: 4, size: 2.2, align: 'center', color: GOLD }
        });
        this.base.addChild(this.movesText);

        this.peekButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(68, 2, 24, 8),
            fill: MAT,
            color: GOLD,
            border: 3,
            onClick: (playerId) => this.phase === 'over' ? this.nextPainting() : this.handlePeek(playerId)
        });
        this.peekText = new GameNode.Text({ textInfo: { text: 'PEEK', x: 80, y: 4.2, size: 1.9, align: 'center', color: CREAM } });
        this.peekButton.addChild(this.peekText);
        this.base.addChild(this.peekButton);

        this.base.addChild(new GameNode.Text({ textInfo: { text: 'Drag a tile into the gap', x: 50, y: 88, size: 1.8, align: 'center', color: CREAM } }));

        // the sliding tiles — one Asset node per tile, cropped to its home region.
        // bottom-right slot starts empty.
        this.tiles = [];
        this.blankSlot = SLOT_COUNT - 1;
        for (let home = 0; home < SLOT_COUNT - 1; home++) {
            const tile = { home, slot: home };
            tile.node = new GameNode.Asset({
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                assetInfo: {
                    [PAINTINGS[this.paintingIndex].key]: {
                        pos: { x: 0, y: 0 },
                        size: { x: TILE_W - 2 * SEAM, y: TILE_H - 2 * SEAM },
                        ...tileCrop(home)
                    }
                },
                onClick: (id, x, y) => this.beginTileDrag(id, tile, x, y),
                onHover: id => { if (!this.drag) this.pointerCursor(id, this.phase === 'play' && !this.peeking && this.isAdjacent(tile.slot, this.blankSlot) ? 'grab' : null); },
                offHover: id => { if (!this.drag) this.pointerCursor(id, null); }
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

    placeTile(tile, pos = slotPos(tile.slot)) {
        const { x, y } = pos;
        tile.node.node.coordinates2d = ShapeUtils.rectangle(x, y, TILE_W, TILE_H);
        tile.node.node.asset = {
            [PAINTINGS[this.paintingIndex].key]: {
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
        for (let i = 0; i < SHUFFLE_MOVES + this.paintingIndex * 20; i++) {
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
        this.setMovesText(String(this.moves));
        if (this.isSolved()) {
            this.handleVictory();
        }
        this.base.node.onStateChange();
    }

    setMovesText(text) {
        this.movesText.node.text = { text, x: 25, y: 4, size: 2.2, align: 'center', color: GOLD };
    }

    fullPainting(effects) {
        return new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(PAINT_X, PAINT_Y, PAINT_W, PAINT_H),
            assetInfo: {
                [PAINTINGS[this.paintingIndex].key]: {
                    pos: { x: PAINT_X, y: PAINT_Y },
                    size: { x: PAINT_W, y: PAINT_H }
                }
            },
            effects
        });
    }

    handlePeek(playerId) {
        if (this.phase !== 'play' || this.peeking || this.drag) {
            return;
        }
        this.peeking = true;
        this.overlay.addChild(this.fullPainting());
        this.setTimeout(() => {
            this.peeking = false;
            this.overlay.clearChildren();
        }, PEEK_SECONDS * 1000);
    }

    pointerCursor(id, mode) {
        if (typeof this.setCursor === 'function') this.setCursor(id, mode ? { assetKey: 'pointer-' + mode, size: { width: 32, height: 32 }, hotspot: { x: 16, y: 16 } } : null);
    }

    beginTileDrag(id, tile, x, y) {
        if (this.drag || this.peeking || this.phase !== 'play' || !this.isAdjacent(tile.slot, this.blankSlot)) return;
        this.drag = { id, tile, x, y, from: slotPos(tile.slot), to: slotPos(this.blankSlot), progress: 0, moved: false };
        this.pointerCursor(id, 'hold');
    }

    handleMouseMove(id, pos) {
        const d = this.drag;
        if (!d || d.id !== id || !pos || ![pos.x,pos.y].every(Number.isFinite)) return;
        const dx = d.to.x - d.from.x, dy = d.to.y - d.from.y;
        d.moved ||= Math.hypot(pos.x-d.x,pos.y-d.y)>1;
        d.progress = Math.max(0, Math.min(1, ((pos.x-d.x)*dx+(pos.y-d.y)*dy)/(dx*dx+dy*dy)));
        this.placeTile(d.tile, { x: d.from.x+dx*d.progress, y: d.from.y+dy*d.progress });
        this.base.node.onStateChange();
    }

    handleMouseUp(id, pos) {
        const d = this.drag;
        if (!d || d.id !== id) return;
        if (pos) this.handleMouseMove(id, pos);
        this.drag = null; this.pointerCursor(id, null); this.placeTile(d.tile);
        if (!d.moved || d.progress > .25) this.handleTileTap(d.tile);
        this.base.node.onStateChange();
    }

    handlePlayerDisconnect(id) {
        if (this.drag?.id === id) { this.placeTile(this.drag.tile); this.drag = null; this.base.node.onStateChange(); }
        this.pointerCursor(id, null);
    }

    handleKeyDown(id, key) { if (key === 'Escape') this.handlePlayerDisconnect(id); }

    handleVictory() {
        this.phase = 'over';
        this.overlay.addChild(this.fullPainting(GOLD_GLOW));
        this.plaqueText.node.text = { ...this.plaqueText.node.text, text: PAINTINGS[this.paintingIndex].name + ' · Restored' };
        this.peekText.node.text = { ...this.peekText.node.text, text: 'NEXT →' };
    }

    nextPainting() {
        if (this.phase !== 'over') return;
        this.paintingIndex = (this.paintingIndex + 1) % PAINTINGS.length;
        this.overlay.clearChildren(); this.moves = 0; this.phase = 'play'; this.setMovesText('0');
        this.plaqueText.node.text = { ...this.plaqueText.node.text, text: PAINTINGS[this.paintingIndex].name };
        this.peekText.node.text = { ...this.peekText.node.text, text: 'PEEK' };
        this.tiles.forEach(tile => { tile.slot = tile.home; this.placeTile(tile); }); this.blankSlot = SLOT_COUNT-1;
        this.shuffle();
    }

}

module.exports = Masterpiece;
