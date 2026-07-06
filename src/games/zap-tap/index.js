const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');
const { COLORS } = Colors;

const TICK_RATE = 15;
const ROUND_SECONDS = 45;
const INTERMISSION_SECONDS = 6;
const ROUND_TICKS = ROUND_SECONDS * TICK_RATE;

const GRID_COLS = 4;
const GRID_ROWS = 3;
const GRID_X = 24;
const GRID_Y = 22;
const GRID_W = 72;
const GRID_H = 74;
const GAP = 2;
const TILE_W = (GRID_W - (GRID_COLS - 1) * GAP) / GRID_COLS;
const TILE_H = (GRID_H - (GRID_ROWS - 1) * GAP) / GRID_ROWS;

const BG_COLOR = [46, 26, 24, 255];
const TILE_DARK = [72, 42, 38, 255];
const TILE_LIT = [255, 196, 40, 255];
const CREAM = [255, 240, 214, 255];
const LIT_GLOW = { shadow: { color: [255, 170, 30, 255], blur: 16 } };

class ZapTap extends Game {
    static metadata() {
        return {
            squishVersion: '142',
            name: 'Zap Tap',
            author: 'Homegames',
            description: 'Tiles light up. Tap them before they go dark. Most zaps wins the round.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: TICK_RATE
        };
    }

    constructor() {
        super();
        this.players = {};
        this._t = 0;
        this.phase = 'play';
        this.roundStart = 0;
        this.nextSpawnAt = TICK_RATE;
        this.overUntil = 0;
        this.lastSecondsLeft = null;

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: BG_COLOR
        });

        this.base.addChild(new GameNode.Text({
            textInfo: { text: 'ZAP TAP', x: 11, y: 4, size: 2.2, align: 'center', color: TILE_LIT }
        }));

        this.timerText = new GameNode.Text({
            textInfo: { text: `${ROUND_SECONDS}s`, x: 11, y: 11, size: 1.8, align: 'center', color: CREAM }
        });
        this.base.addChild(this.timerText);

        this.tiles = [];
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const x = GRID_X + col * (TILE_W + GAP);
                const y = GRID_Y + row * (TILE_H + GAP);
                const tile = { active: false, expiresAt: 0, flashUntil: 0, x, y };
                tile.node = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(x, y, TILE_W, TILE_H),
                    fill: TILE_DARK,
                    onClick: (playerId) => this.handleTileTap(playerId, tile)
                });
                this.tiles.push(tile);
                this.base.addChild(tile.node);
            }
        }

        // zero-size containers so they never swallow clicks
        this.scoreboard = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
        this.banner = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
        this.base.addChildren(this.scoreboard, this.banner);
    }

    getLayers() {
        return [{ root: this.base }];
    }

    handleNewPlayer({ playerId, info }) {
        const name = ((info && info.name) || `PLAYER ${playerId}`).toUpperCase().slice(0, 10);
        this.players[playerId] = {
            name,
            color: Colors.randomColor(['BLACK', 'ALMOST_BLACK', 'HG_BLACK', 'CHARCOAL', 'WHITE']),
            score: 0
        };
        this.renderScoreboard();
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
        this.renderScoreboard();
    }

    handleTileTap(playerId, tile) {
        const player = this.players[playerId];
        if (this.phase !== 'play' || !tile.active || !player) {
            return;
        }
        tile.active = false;
        tile.flashUntil = this._t + Math.round(0.4 * TICK_RATE);
        tile.node.node.fill = player.color;
        tile.node.node.effects = null;
        player.score += 1;
        this.renderScoreboard();
        this.base.node.onStateChange();
    }

    renderScoreboard() {
        this.scoreboard.clearChildren();
        const entries = Object.entries(this.players)
            .sort(([, a], [, b]) => b.score - a.score);
        entries.forEach(([playerId, player], i) => {
            const y = 22 + i * 7;
            if (y > 90) {
                return;
            }
            this.scoreboard.addChild(new GameNode.Text({
                textInfo: { text: `${player.name}  ${player.score}`, x: 3, y, size: 1.3, align: 'left', color: player.color }
            }));
            // only this player sees the marker next to their own entry
            this.scoreboard.addChild(new GameNode.Text({
                textInfo: { text: '►', x: 1, y, size: 1.3, align: 'left', color: CREAM },
                playerIds: [Number(playerId)]
            }));
        });
    }

    lightRandomTile() {
        const dark = this.tiles.filter(t => !t.active);
        if (dark.length === 0) {
            return;
        }
        const progress = (this._t - this.roundStart) / ROUND_TICKS;
        const tile = dark[Math.floor(Math.random() * dark.length)];
        tile.active = true;
        tile.expiresAt = this._t + Math.round((2 - progress) * TICK_RATE);
        tile.flashUntil = 0;
        tile.node.node.fill = TILE_LIT;
        tile.node.node.effects = LIT_GLOW;
    }

    endRound() {
        this.phase = 'over';
        this.overUntil = this._t + INTERMISSION_SECONDS * TICK_RATE;
        for (const tile of this.tiles) {
            tile.active = false;
            tile.flashUntil = 0;
            tile.node.node.fill = TILE_DARK;
            tile.node.node.effects = null;
        }
        const players = Object.values(this.players);
        const topScore = Math.max(0, ...players.map(p => p.score));
        const winners = players.filter(p => p.score === topScore && topScore > 0);
        const title = winners.length === 0 ? 'TIME UP!'
            : winners.length === 1 ? `${winners[0].name} WINS!`
            : 'TIE GAME!';
        this.banner.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(20, 38, 60, 24),
            fill: [20, 10, 9, 255],
            color: TILE_LIT,
            border: 4
        }));
        this.banner.addChild(new GameNode.Text({
            textInfo: { text: title, x: 50, y: 43, size: 3, align: 'center', color: TILE_LIT }
        }));
        this.banner.addChild(new GameNode.Text({
            textInfo: { text: `next round in ${INTERMISSION_SECONDS}s`, x: 50, y: 52, size: 1.5, align: 'center', color: CREAM }
        }));
    }

    startRound() {
        this.phase = 'play';
        this.roundStart = this._t;
        this.nextSpawnAt = this._t + TICK_RATE;
        this.banner.clearChildren();
        for (const player of Object.values(this.players)) {
            player.score = 0;
        }
        this.renderScoreboard();
    }

    tick() {
        this._t++;
        let changed = false;

        if (this.phase === 'play') {
            const elapsed = this._t - this.roundStart;
            const progress = Math.min(1, elapsed / ROUND_TICKS);

            if (this._t >= this.nextSpawnAt) {
                this.lightRandomTile();
                // spawn interval shrinks from 1.2s to 0.5s over the round
                this.nextSpawnAt = this._t + Math.round((1.2 - 0.7 * progress) * TICK_RATE);
                changed = true;
            }

            for (const tile of this.tiles) {
                if (tile.active && this._t >= tile.expiresAt) {
                    tile.active = false;
                    tile.node.node.fill = TILE_DARK;
                    tile.node.node.effects = null;
                    changed = true;
                } else if (!tile.active && tile.flashUntil && this._t >= tile.flashUntil) {
                    tile.flashUntil = 0;
                    tile.node.node.fill = TILE_DARK;
                    changed = true;
                }
            }

            const secondsLeft = Math.max(0, ROUND_SECONDS - Math.floor(elapsed / TICK_RATE));
            if (secondsLeft !== this.lastSecondsLeft) {
                this.lastSecondsLeft = secondsLeft;
                this.timerText.node.text = { text: `${secondsLeft}s`, x: 11, y: 11, size: 1.8, align: 'center', color: secondsLeft <= 5 ? TILE_LIT : CREAM };
                changed = true;
            }

            if (elapsed >= ROUND_TICKS) {
                this.endRound();
                changed = true;
            }
        } else if (this._t >= this.overUntil) {
            this.startRound();
            changed = true;
        }

        if (changed) {
            this.base.node.onStateChange();
        }
    }
}

module.exports = ZapTap;
