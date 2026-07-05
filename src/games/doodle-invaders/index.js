const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');

// DOODLE INVADERS — Space Invaders where every sprite and sound came out of
// the Homegames studio's own asset tools: 32x32 five-color doodles from the
// draw tool, mouth SFX from the recorder, jingles from the one-octave synth.
//
// Every asset is OPTIONAL. Placeholder ids are detected and skipped: sprites
// fall back to shapes in the draw tool's palette and sounds fall back to
// silence, so the game is fully playable before anything is drawn — and each
// real id you paste in visibly upgrades it.

const ASSET_IDS = {
    'ship': 'REPLACE_SHIP_ID',              // draw: your ship, facing up
    'invader-a': 'REPLACE_INVADER_A_ID',    // draw: the alien, pose A
    'invader-b': 'REPLACE_INVADER_B_ID',    // draw: same alien, pose B (optional shuffle frame)
    'boss': 'REPLACE_BOSS_ID',              // draw: anything — it gets rendered huge
    'bullet': 'REPLACE_BULLET_ID',          // draw: a tiny bolt (optional)
    'pew': 'REPLACE_PEW_ID',                // record: your mouth saying pew
    'boom': 'REPLACE_BOOM_ID',              // record: an explosion noise
    'ouch': 'REPLACE_OUCH_ID',              // record: a yelp — plays when any ship dies
    'wave-clear': 'REPLACE_WAVE_CLEAR_ID',  // keyboard: a happy 3-8 note jingle
    'game-over': 'REPLACE_GAME_OVER_ID'     // keyboard: a sad one
};
const AUDIO_KEYS = ['pew', 'boom', 'ouch', 'wave-clear', 'game-over'];
const hasAsset = (key) => ASSET_IDS[key] && !ASSET_IDS[key].startsWith('REPLACE');

const TICK_RATE = 15;
const TEXT_H = 16 / 9;

const MAX_PLAYERS = 4;
const LIVES_PER_PLAYER = 2;           // shared pool: 2 + 2 per pilot
const BOSS_EVERY = 3;                 // every Nth wave is a boss

const GRID_COLS = 8;
const GRID_ROWS = 4;
const INVADER_W = 4.4;
const INVADER_H = INVADER_W * TEXT_H; // physically square at 16:9
const COL_SPACING = 7.2;
const ROW_SPACING = 9.5;
const SWARM_MIN_X = 3;
const SWARM_MAX_X = 97;
const SWARM_DROP = 2.4;
const INVASION_Y = 72;                // swarm reaching this line ends the game

const SHIP_W = 5.2;
const SHIP_H = SHIP_W * TEXT_H;
const SHIP_Y = 78;
const SHIP_SPEED = 1.6;
const FIRE_COOLDOWN = Math.round(0.45 * TICK_RATE);
const MAX_BOLTS_PER_PLAYER = 2;
const BOLT_SPEED = 3.6;
const BOMB_BASE_SPEED = 1.5;
const RESPAWN_TICKS = Math.round(1.5 * TICK_RATE);
const INVULN_TICKS = Math.round(2 * TICK_RATE);

const BOSS_W = 20;
const BOSS_H = 30;
const BOSS_Y = 14;

const SFX_TICKS = Math.round(1.5 * TICK_RATE);

// The draw tool's exact palette — the fallback art style IS the studio style.
const DOODLE_DARK = [26, 26, 46, 255];    // #1a1a2e
const DOODLE_RED = [231, 76, 60, 255];    // #e74c3c
const DOODLE_BLUE = [52, 152, 219, 255];  // #3498db
const DOODLE_GREEN = [46, 204, 113, 255]; // #2ecc71
const DOODLE_YELLOW = [241, 196, 15, 255];// #f1c40f
const BG = [18, 18, 31, 255];
const INK = [240, 240, 250, 255];
const FAINT = [140, 140, 170, 255];
const WHITE = [255, 255, 255, 255];

const PLAYER_PALETTE = [
    { name: 'RED', color: DOODLE_RED },
    { name: 'BLUE', color: DOODLE_BLUE },
    { name: 'GREEN', color: DOODLE_GREEN },
    { name: 'YELLOW', color: DOODLE_YELLOW }
];

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });

class DoodleInvaders extends Game {
    static metadata() {
        return {
            aspectRatio: { x: 16, y: 9 },
            squishVersion: '142',
            author: 'Homegames',
            name: 'Doodle Invaders',
            description: 'Space Invaders, except you drew the aliens and recorded the pew. Made entirely with studio assets.',
            tickRate: TICK_RATE,
            assets: Object.keys(ASSET_IDS).filter(hasAsset).reduce((assets, key) => {
                assets[key] = new Asset({
                    id: ASSET_IDS[key],
                    type: AUDIO_KEYS.indexOf(key) >= 0 ? 'audio' : 'image'
                });
                return assets;
            }, {})
        };
    }

    constructor() {
        super();

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: BG
        });

        this.swarmLayer = this.makeContainer();
        this.bossLayer = this.makeContainer();
        this.bulletLayer = this.makeContainer();
        this.shipLayer = this.makeContainer();
        this.hud = this.makeContainer();
        this.tapLayer = this.makeContainer();
        this.buttonLayer = this.makeContainer();
        this.overlay = this.makeContainer();
        this.audioLayer = this.makeContainer();
        this.base.addChildren(
            this.swarmLayer, this.bossLayer, this.bulletLayer, this.shipLayer,
            this.hud, this.tapLayer, this.buttonLayer, this.overlay, this.audioLayer);

        this.players = {};      // connected: playerId -> { name }
        this.ships = {};        // joined: playerId -> ship state
        this.invaders = [];
        this.bolts = [];
        this.bombs = [];
        this.boss = null;
        this.transients = [];
        this.sfx = [];
        this.tickCount = 0;
        this.wave = 0;
        this.lives = 2 + LIVES_PER_PLAYER;
        this.frameFlip = false;

        this.showLobby();
    }

    makeContainer() {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
    }

    makeButton(label, x, y, w, h, color, onClick, playerIds, size) {
        const textSize = size || 2;
        const button = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill: DOODLE_DARK,
            color,
            border: 8,
            effects: glow(color, 8),
            onClick,
            playerIds
        });
        button.addChild(new GameNode.Text({
            textInfo: { x: x + w / 2, y: y + (h - textSize * TEXT_H) / 2, text: label, size: textSize, align: 'center', font: 'monospace', color },
            playerIds
        }), false);
        return button;
    }

    setNodePlayerIds(node, playerIds) {
        node.node.playerIds = playerIds;
        node.node.children.forEach(child => this.setNodePlayerIds(child, playerIds));
    }

    addTransient(nodes, ticks) {
        nodes.forEach(n => this.overlay.addChild(n, false));
        this.transients.push({ nodes, ticks });
    }

    banner(text, y, size, color, playerIds) {
        return [new GameNode.Text({
            textInfo: { x: 50, y, text, size, align: 'center', font: 'monospace', color },
            playerIds
        })];
    }

    playerName(playerId) {
        return String((this.players[playerId] && this.players[playerId].name) || ('PLAYER ' + playerId)).toUpperCase().slice(0, 8);
    }

    // --- studio-asset sprites with shape fallbacks ---

    // A sprite renders as an Asset node when the id is real, otherwise as a
    // Shape in the doodle palette. place() moves either kind.
    makeSprite(key, fallback) {
        if (hasAsset(key)) {
            return {
                key,
                isAsset: true,
                node: new GameNode.Asset({
                    coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                    assetInfo: { [key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 } } }
                })
            };
        }
        return {
            key,
            isAsset: false,
            shape: fallback.shape || 'rect',
            fills: fallback.fills,
            node: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                fill: fallback.fills[0],
                color: WHITE
            })
        };
    }

    place(sprite, x, y, w, h, frame) {
        if (sprite.isAsset) {
            const key = (frame === 1 && sprite.key === 'invader-a' && hasAsset('invader-b')) ? 'invader-b' : sprite.key;
            sprite.node.node.coordinates2d = ShapeUtils.rectangle(x, y, w, h);
            sprite.node.node.asset = { [key]: { pos: { x, y }, size: { x: w, y: h } } };
        } else {
            sprite.node.node.coordinates2d = sprite.shape === 'triangle'
                ? ShapeUtils.triangle(x + w / 2, y, x, y + h, x + w, y + h)
                : ShapeUtils.rectangle(x, y, w, h);
            sprite.node.node.fill = sprite.fills[(frame || 0) % sprite.fills.length];
        }
    }

    // --- studio-asset audio (silent when the id is a placeholder) ---

    playSound(key, playerIds) {
        if (!hasAsset(key)) return;
        const node = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            assetInfo: { [key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } },
            playerIds
        });
        this.audioLayer.addChild(node, false);
        this.sfx.push({ node, ticks: SFX_TICKS });
    }

    updateAudio() {
        for (let i = this.sfx.length - 1; i >= 0; i--) {
            const s = this.sfx[i];
            s.ticks--;
            if (s.ticks <= 0) {
                this.audioLayer.removeChild(s.node.id, false);
                this.sfx.splice(i, 1);
            }
        }
    }

    // --- lobby ---

    showLobby() {
        this.phase = 'lobby';
        this.clearBattlefield();
        Object.keys(this.ships).forEach(pid => this.removeShip(Number(pid)));
        this.hud.clearChildren();
        this.overlay.clearChildren();
        this.transients = [];

        this.titleText = new GameNode.Text({
            textInfo: { x: 50, y: 10, text: 'DOODLE INVADERS', size: 5.5, align: 'center', font: 'monospace', color: DOODLE_GREEN }
        });
        this.overlay.addChild(this.titleText, false);

        const loaded = Object.keys(ASSET_IDS).filter(hasAsset).length;
        this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 22, text: 'THE FRIDGE DOODLES ARE ATTACKING', size: 1.8, align: 'center', font: 'monospace', color: FAINT }
        }), false);
        this.overlay.addChild(new GameNode.Text({
            textInfo: {
                x: 50, y: 26.5,
                text: loaded + '/' + Object.keys(ASSET_IDS).length + ' STUDIO ASSETS LOADED' + (loaded === 0 ? ' - DRAW SOME IN THE STUDIO!' : ''),
                size: 1.3, align: 'center', font: 'monospace', color: loaded === 0 ? DOODLE_YELLOW : DOODLE_GREEN
            }
        }), false);

        this.lobbyRow = this.makeContainer();
        this.overlay.addChild(this.lobbyRow, false);

        this.joinButton = this.makeButton('JOIN', 30, 52, 18, 9, DOODLE_YELLOW, (playerId) => {
            if (this.phase !== 'lobby' || this.ships[playerId]) return;
            if (Object.keys(this.ships).length >= MAX_PLAYERS) {
                this.addTransient(this.banner('SQUAD FULL - ' + MAX_PLAYERS + ' MAX', 44, 1.8, DOODLE_YELLOW, [playerId]), 2 * TICK_RATE);
                return;
            }
            this.addShip(playerId);
            this.updateLobbyUi();
        });
        this.startButton = this.makeButton('START', 52, 52, 18, 9, DOODLE_GREEN, (playerId) => {
            if (this.phase !== 'lobby' || !this.ships[playerId]) return;
            this.startGame();
        });
        this.overlay.addChildren(this.joinButton, this.startButton);

        const lines = [
            'MOVE: ARROWS/A+D OR TAP WHERE YOU WANT YOUR SHIP TO GO',
            'FIRE: SPACE OR THE FIRE BUTTON - LIVES ARE SHARED, MORE PILOTS = MORE LIVES',
            'EVERY ' + BOSS_EVERY + 'RD WAVE THE BIG DOODLE SHOWS UP'
        ];
        lines.forEach((text, i) => this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 70 + i * 4, text, size: 1.3, align: 'center', font: 'monospace', color: FAINT }
        }), false));

        this.updateLobbyUi();
    }

    updateLobbyUi() {
        if (this.phase !== 'lobby') return;
        this.lobbyRow.clearChildren();
        const shipIds = Object.keys(this.ships).map(Number);
        if (shipIds.length === 0) {
            this.lobbyRow.addChild(new GameNode.Text({
                textInfo: { x: 50, y: 38, text: 'NO PILOTS YET - TAP JOIN', size: 1.6, align: 'center', font: 'monospace', color: FAINT }
            }), false);
        } else {
            const startX = 50 - shipIds.length * 7;
            shipIds.forEach((pid, i) => {
                const ship = this.ships[pid];
                const x = startX + i * 14;
                this.lobbyRow.addChild(new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.triangle(x + 6, 33, x + 4, 37, x + 8, 37),
                    fill: ship.color,
                    color: WHITE,
                    effects: glow(ship.color, 8)
                }), false);
                this.lobbyRow.addChild(new GameNode.Text({
                    textInfo: { x: x + 6, y: 38.5, text: ship.name, size: 1.2, align: 'center', font: 'monospace', color: INK }
                }), false);
                this.lobbyRow.addChild(new GameNode.Text({
                    textInfo: { x: x + 6, y: 41.3, text: 'YOU', size: 1, align: 'center', font: 'monospace', color: DOODLE_YELLOW },
                    playerIds: [pid]
                }), false);
            });
        }

        const connected = Object.keys(this.players).map(Number);
        const unjoined = connected.filter(pid => !this.ships[pid]);
        this.setNodePlayerIds(this.joinButton, unjoined.length ? unjoined : [0]);
        this.setNodePlayerIds(this.startButton, shipIds.length ? shipIds : [0]);
        this.base.node.onStateChange();
    }

    // --- ships ---

    addShip(playerId) {
        const used = new Set(Object.values(this.ships).map(s => s.colorIndex));
        const colorIndex = PLAYER_PALETTE.findIndex((c, i) => !used.has(i));
        const count = Object.keys(this.ships).length;
        const x = 20 + count * 20;

        const root = this.makeContainer();
        const sprite = this.makeSprite('ship', { shape: 'triangle', fills: [PLAYER_PALETTE[colorIndex].color] });
        root.addChild(sprite.node, false);
        const underline = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: PLAYER_PALETTE[colorIndex].color,
            color: WHITE,
            effects: glow(PLAYER_PALETTE[colorIndex].color, 6)
        });
        root.addChild(underline, false);
        const youMarker = new GameNode.Text({
            textInfo: { x: 0, y: 0, text: 'YOU', size: 0.9, align: 'center', font: 'monospace', color: WHITE },
            playerIds: [playerId]
        });
        root.addChild(youMarker, false);
        this.shipLayer.addChild(root, false);

        const catcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            playerIds: [playerId],
            onClick: (pid, tx) => {
                const ship = this.ships[pid];
                if (ship && this.phase !== 'lobby' && this.phase !== 'gameover') {
                    ship.targetX = Math.max(2, Math.min(98 - SHIP_W, tx - SHIP_W / 2));
                }
            }
        });
        this.tapLayer.addChild(catcher, false);

        const fireButton = this.makeButton('FIRE', 42, 88, 16, 9, DOODLE_RED, (pid) => {
            if (pid === playerId) this.tryFire(this.ships[playerId]);
        }, [playerId], 2);
        this.buttonLayer.addChild(fireButton, false);

        this.ships[playerId] = {
            playerId,
            colorIndex,
            color: PLAYER_PALETTE[colorIndex].color,
            name: this.playerName(playerId),
            x,
            targetX: x,
            score: 0,
            cooldown: 0,
            alive: true,
            respawnAt: 0,
            invuln: 0,
            root, sprite, underline, youMarker, catcher, fireButton
        };
        this.placeShip(this.ships[playerId]);
        return this.ships[playerId];
    }

    removeShip(playerId) {
        const ship = this.ships[playerId];
        if (!ship) return;
        this.shipLayer.removeChild(ship.root.id, false);
        this.tapLayer.removeChild(ship.catcher.id, false);
        this.buttonLayer.removeChild(ship.fireButton.id, false);
        delete this.ships[playerId];
    }

    placeShip(ship) {
        this.place(ship.sprite, ship.x, SHIP_Y, SHIP_W, SHIP_H);
        ship.underline.node.coordinates2d = ShapeUtils.rectangle(ship.x - 0.4, SHIP_Y + SHIP_H + 0.8, SHIP_W + 0.8, 1);
        ship.youMarker.node.text = {
            x: ship.x + SHIP_W / 2, y: SHIP_Y + SHIP_H + 2.4, text: 'YOU', size: 0.9, align: 'center', font: 'monospace', color: WHITE
        };
    }

    // --- game flow ---

    startGame() {
        this.overlay.clearChildren();
        this.transients = [];
        this.wave = 0;
        this.lives = 2 + LIVES_PER_PLAYER * Object.keys(this.ships).length;
        Object.values(this.ships).forEach(ship => {
            ship.score = 0;
            ship.alive = true;
            ship.invuln = INVULN_TICKS;
        });
        this.buildHud();
        this.nextWave();
    }

    nextWave() {
        this.wave++;
        this.clearBattlefield();
        this.phase = 'intro';
        this.introTicks = Math.round(1.5 * TICK_RATE);
        const isBoss = this.wave % BOSS_EVERY === 0;
        this.addTransient(this.banner(
            isBoss ? 'THE BIG DOODLE APPROACHES' : 'WAVE ' + this.wave,
            40, 3.5, isBoss ? DOODLE_RED : INK), this.introTicks);
        this.base.node.onStateChange();
    }

    clearBattlefield() {
        this.swarmLayer.clearChildren();
        this.bossLayer.clearChildren();
        this.bulletLayer.clearChildren();
        this.invaders = [];
        this.bolts = [];
        this.bombs = [];
        this.boss = null;
    }

    spawnWave() {
        this.phase = 'playing';
        if (this.wave % BOSS_EVERY === 0) {
            this.spawnBoss();
            return;
        }

        this.swarmX = 12;
        this.swarmY = 10;
        this.swarmDir = 1;
        this.frameFlip = false;
        this.marchInterval = Math.max(3, 10 - this.wave);
        this.marchTimer = this.marchInterval;
        this.bombTimer = this.bombInterval();

        for (let gy = 0; gy < GRID_ROWS; gy++) {
            for (let gx = 0; gx < GRID_COLS; gx++) {
                const sprite = this.makeSprite('invader-a', { fills: [DOODLE_GREEN, DOODLE_YELLOW] });
                this.swarmLayer.addChild(sprite.node, false);
                this.invaders.push({ gx, gy, alive: true, sprite });
            }
        }
        this.layoutSwarm();
    }

    spawnBoss() {
        const hp = 16 + 8 * Math.max(1, Object.keys(this.ships).length) + 4 * Math.floor(this.wave / BOSS_EVERY);
        const sprite = this.makeSprite('boss', { fills: [DOODLE_RED] });
        if (!sprite.isAsset) {
            sprite.node.node.border = 6;
            sprite.node.node.effects = glow(DOODLE_RED, 16);
        }
        this.bossLayer.addChild(sprite.node, false);

        const barBg = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(30, 9.5, 40, 2),
            fill: DOODLE_DARK,
            color: WHITE,
            border: 2
        });
        const barFill = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(30.3, 9.8, 39.4, 1.4),
            fill: DOODLE_RED
        });
        this.bossLayer.addChildren(barBg, barFill);

        this.boss = { x: 40, hp, maxHp: hp, sprite, barFill, bombTimer: TICK_RATE };
        this.bombTimer = 9999;   // boss handles its own bombs
    }

    layoutSwarm() {
        this.invaders.forEach(inv => {
            if (!inv.alive) return;
            this.place(inv.sprite,
                Math.round((this.swarmX + inv.gx * COL_SPACING) * 100) / 100,
                Math.round((this.swarmY + inv.gy * ROW_SPACING) * 100) / 100,
                INVADER_W, INVADER_H,
                this.frameFlip ? 1 : 0);
        });
    }

    aliveInvaders() {
        return this.invaders.filter(inv => inv.alive);
    }

    bombInterval() {
        return Math.max(8, 32 - this.wave * 2 - Object.keys(this.ships).length * 2);
    }

    // --- combat ---

    tryFire(ship) {
        if (!ship || this.phase !== 'playing' || !ship.alive || ship.cooldown > 0) return;
        if (this.bolts.filter(b => b.owner === ship).length >= MAX_BOLTS_PER_PLAYER) return;
        ship.cooldown = FIRE_COOLDOWN;

        const sprite = this.makeSprite('bullet', { fills: [DOODLE_YELLOW] });
        this.bulletLayer.addChild(sprite.node, false);
        const bolt = { x: ship.x + SHIP_W / 2 - 0.5, y: SHIP_Y - 3, owner: ship, sprite };
        this.place(sprite, bolt.x, bolt.y, 1, 3);
        this.bolts.push(bolt);
        this.playSound('pew', [ship.playerId]);
    }

    dropBomb(x, y, speed) {
        const node = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, 1.3, 3),
            fill: DOODLE_RED,
            color: WHITE
        });
        this.bulletLayer.addChild(node, false);
        this.bombs.push({ x, y, speed, node });
    }

    killInvader(inv, shooter) {
        inv.alive = false;
        this.swarmLayer.removeChild(inv.sprite.node.id, false);
        shooter.score += 10;
        this.updateScores();
        this.playSound('boom');
        if (this.aliveInvaders().length === 0) {
            this.waveCleared();
        }
    }

    waveCleared() {
        this.phase = 'cleared';
        this.clearedTicks = 2 * TICK_RATE;
        this.playSound('wave-clear');
        this.addTransient(this.banner('WAVE ' + this.wave + ' CLEARED!', 40, 3, DOODLE_GREEN), this.clearedTicks);
    }

    hitShip(ship) {
        if (!ship.alive || ship.invuln > 0) return;
        ship.alive = false;
        ship.respawnAt = this.tickCount + RESPAWN_TICKS;
        this.setNodePlayerIds(ship.root, [0]);   // hide while dead
        this.lives--;
        this.updateLives();
        this.playSound('boom');
        this.playSound('ouch');
        if (this.lives < 0) {
            this.gameOver('THE DOODLES WIN');
        }
    }

    gameOver(reason) {
        this.phase = 'gameover';
        this.overlay.clearChildren();
        this.transients = [];
        this.playSound('game-over');

        this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 22, text: reason, size: 4, align: 'center', font: 'monospace', color: DOODLE_RED }
        }), false);
        this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 30, text: 'YOU SURVIVED ' + (this.wave - 1) + ' WAVE' + (this.wave - 1 === 1 ? '' : 'S'), size: 1.8, align: 'center', font: 'monospace', color: FAINT }
        }), false);

        const standings = Object.values(this.ships).sort((a, b) => b.score - a.score);
        standings.forEach((ship, i) => {
            this.overlay.addChild(new GameNode.Text({
                textInfo: { x: 50, y: 40 + i * 4.5, text: (i + 1) + '. ' + ship.name + ' - ' + ship.score, size: 1.8, align: 'center', font: 'monospace', color: ship.color }
            }), false);
            this.overlay.addChild(new GameNode.Text({
                textInfo: { x: 66, y: 40 + i * 4.5, text: '< YOU', size: 1.2, align: 'left', font: 'monospace', color: DOODLE_YELLOW },
                playerIds: [ship.playerId]
            }), false);
        });

        this.overlay.addChild(this.makeButton('RUN IT BACK', 36, 74, 28, 9, DOODLE_GREEN, (playerId) => {
            if (this.phase === 'gameover' && this.ships[playerId]) {
                this.startGame();
            }
        }), false);
        this.base.node.onStateChange();
    }

    // --- HUD ---

    buildHud() {
        this.hud.clearChildren();
        this.scoreTexts = {};
        Object.values(this.ships).forEach((ship, i) => {
            const x = 2 + i * 16;
            this.hud.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.triangle(x + 0.7, 2, x, 3.8, x + 1.4, 3.8),
                fill: ship.color,
                color: WHITE
            }), false);
            const score = new GameNode.Text({
                textInfo: { x: x + 2.2, y: 1.8, text: ship.name + ' 0', size: 1.1, font: 'monospace', color: ship.color }
            });
            this.scoreTexts[ship.playerId] = score;
            this.hud.addChild(score, false);
            this.hud.addChild(new GameNode.Text({
                textInfo: { x: x + 2.2, y: 4.2, text: 'YOU', size: 0.9, font: 'monospace', color: DOODLE_YELLOW },
                playerIds: [ship.playerId]
            }), false);
        });

        this.waveText = new GameNode.Text({
            textInfo: { x: 50, y: 1.8, text: 'WAVE 1', size: 1.4, align: 'center', font: 'monospace', color: INK }
        });
        this.hud.addChild(this.waveText, false);

        this.livesRow = this.makeContainer();
        this.hud.addChild(this.livesRow, false);
        this.updateLives();
    }

    updateScores() {
        Object.values(this.ships).forEach(ship => {
            const t = this.scoreTexts && this.scoreTexts[ship.playerId];
            if (t) t.node.text.text = ship.name + ' ' + ship.score;
        });
    }

    updateLives() {
        if (!this.livesRow) return;
        this.livesRow.clearChildren();
        for (let i = 0; i < Math.max(0, this.lives); i++) {
            this.livesRow.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.triangle(96.5 - i * 2.6, 2, 95.5 - i * 2.6, 4.2, 97.5 - i * 2.6, 4.2),
                fill: INK,
                color: WHITE
            }), false);
        }
    }

    // --- simulation ---

    tick() {
        this.tickCount++;

        if (this.phase === 'lobby') {
            if (this.titleText && this.tickCount % 8 === 0) {
                const palette = [DOODLE_GREEN, DOODLE_YELLOW, DOODLE_BLUE, DOODLE_RED];
                this.titleText.node.text.color = palette[Math.floor(this.tickCount / 8) % palette.length];
            }
        } else if (this.phase === 'intro') {
            this.moveShips();
            if (--this.introTicks <= 0) this.spawnWave();
        } else if (this.phase === 'playing') {
            this.moveShips();
            this.moveBullets();
            if (this.boss) this.tickBoss();
            else this.tickSwarm();
            if (this.waveText) this.waveText.node.text.text = 'WAVE ' + this.wave;
        } else if (this.phase === 'cleared') {
            this.moveShips();
            this.moveBullets();
            if (--this.clearedTicks <= 0) this.nextWave();
        }

        this.updateTransients();
        this.updateAudio();
        this.base.node.onStateChange();
    }

    moveShips() {
        Object.values(this.ships).forEach(ship => {
            if (ship.cooldown > 0) ship.cooldown--;

            if (!ship.alive) {
                if (this.tickCount >= ship.respawnAt && this.lives >= 0 && this.phase !== 'gameover') {
                    ship.alive = true;
                    ship.invuln = INVULN_TICKS;
                    this.setNodePlayerIds(ship.root, []);
                }
                return;
            }

            if (ship.invuln > 0) {
                ship.invuln--;
                // respawn blink: flicker visibility every couple of ticks
                this.setNodePlayerIds(ship.root, (ship.invuln > 0 && this.tickCount % 4 < 2) ? [0] : []);
            }

            const dx = ship.targetX - ship.x;
            if (Math.abs(dx) > SHIP_SPEED) {
                ship.x += Math.sign(dx) * SHIP_SPEED;
                this.placeShip(ship);
            } else if (Math.abs(dx) > 0.05) {
                ship.x = ship.targetX;
                this.placeShip(ship);
            }
        });
    }

    moveBullets() {
        for (let i = this.bolts.length - 1; i >= 0; i--) {
            const bolt = this.bolts[i];
            bolt.y -= BOLT_SPEED;
            if (bolt.y < 6) {
                this.bulletLayer.removeChild(bolt.sprite.node.id, false);
                this.bolts.splice(i, 1);
                continue;
            }
            this.place(bolt.sprite, bolt.x, bolt.y, 1, 3);

            if (this.boss && this.phase === 'playing') {
                if (bolt.x + 1 > this.boss.x && bolt.x < this.boss.x + BOSS_W &&
                    bolt.y < BOSS_Y + BOSS_H && bolt.y + 3 > BOSS_Y) {
                    this.bulletLayer.removeChild(bolt.sprite.node.id, false);
                    this.bolts.splice(i, 1);
                    this.hitBoss(bolt.owner);
                    continue;
                }
            }

            const hit = this.aliveInvaders().find(inv => {
                const ix = this.swarmX + inv.gx * COL_SPACING;
                const iy = this.swarmY + inv.gy * ROW_SPACING;
                return bolt.x + 1 > ix && bolt.x < ix + INVADER_W && bolt.y < iy + INVADER_H && bolt.y + 3 > iy;
            });
            if (hit) {
                this.bulletLayer.removeChild(bolt.sprite.node.id, false);
                this.bolts.splice(i, 1);
                this.killInvader(hit, bolt.owner);
            }
        }

        for (let i = this.bombs.length - 1; i >= 0; i--) {
            const bomb = this.bombs[i];
            bomb.y += bomb.speed;
            if (bomb.y > 96) {
                this.bulletLayer.removeChild(bomb.node.id, false);
                this.bombs.splice(i, 1);
                continue;
            }
            bomb.node.node.coordinates2d = ShapeUtils.rectangle(bomb.x, bomb.y, 1.3, 3);

            const victim = Object.values(this.ships).find(ship => ship.alive && ship.invuln <= 0 &&
                bomb.x + 1.3 > ship.x && bomb.x < ship.x + SHIP_W &&
                bomb.y + 3 > SHIP_Y && bomb.y < SHIP_Y + SHIP_H);
            if (victim) {
                this.bulletLayer.removeChild(bomb.node.id, false);
                this.bombs.splice(i, 1);
                this.hitShip(victim);
            }
        }
    }

    tickSwarm() {
        const alive = this.aliveInvaders();
        if (alive.length === 0) return;

        if (--this.marchTimer <= 0) {
            // speed scales with wave and with how thinned-out the swarm is
            const thinning = 1 - alive.length / (GRID_COLS * GRID_ROWS);
            this.marchTimer = Math.max(2, Math.round(this.marchInterval - thinning * 6));

            const minGx = Math.min(...alive.map(inv => inv.gx));
            const maxGx = Math.max(...alive.map(inv => inv.gx));
            const left = this.swarmX + minGx * COL_SPACING;
            const right = this.swarmX + maxGx * COL_SPACING + INVADER_W;
            const step = 1.4;

            if ((this.swarmDir > 0 && right + step > SWARM_MAX_X) || (this.swarmDir < 0 && left - step < SWARM_MIN_X)) {
                this.swarmDir *= -1;
                this.swarmY += SWARM_DROP;
            } else {
                this.swarmX += this.swarmDir * step;
            }
            this.frameFlip = !this.frameFlip;
            this.layoutSwarm();

            const maxGy = Math.max(...alive.map(inv => inv.gy));
            if (this.swarmY + maxGy * ROW_SPACING + INVADER_H >= INVASION_Y) {
                this.gameOver('THE DOODLES LANDED');
                return;
            }
        }

        if (--this.bombTimer <= 0) {
            this.bombTimer = this.bombInterval();
            // bottom-most invader of a random occupied column drops the bomb
            const cols = {};
            this.aliveInvaders().forEach(inv => {
                if (!cols[inv.gx] || inv.gy > cols[inv.gx].gy) cols[inv.gx] = inv;
            });
            const shooters = Object.values(cols);
            const inv = shooters[Math.floor(Math.random() * shooters.length)];
            this.dropBomb(
                this.swarmX + inv.gx * COL_SPACING + INVADER_W / 2,
                this.swarmY + inv.gy * ROW_SPACING + INVADER_H,
                BOMB_BASE_SPEED + this.wave * 0.08);
        }
    }

    tickBoss() {
        const boss = this.boss;
        boss.x = 40 + Math.sin(this.tickCount / 14) * 32;
        const bobY = BOSS_Y + Math.sin(this.tickCount / 9) * 1.5;
        this.place(boss.sprite, Math.round(boss.x * 100) / 100, Math.round(bobY * 100) / 100, BOSS_W, BOSS_H);

        if (--boss.bombTimer <= 0) {
            boss.bombTimer = Math.max(6, 14 - Math.floor(this.wave / BOSS_EVERY) * 2);
            const targets = Object.values(this.ships).filter(ship => ship.alive);
            const aimX = targets.length
                ? targets[Math.floor(Math.random() * targets.length)].x + SHIP_W / 2 + (Math.random() - 0.5) * 14
                : 20 + Math.random() * 60;
            const originX = Math.max(2, Math.min(97, boss.x + BOSS_W / 2 + (aimX - boss.x - BOSS_W / 2) * 0.25));
            this.dropBomb(originX, bobY + BOSS_H, BOMB_BASE_SPEED + 0.4 + this.wave * 0.05);
        }
    }

    hitBoss(shooter) {
        const boss = this.boss;
        boss.hp--;
        shooter.score += 5;
        boss.barFill.node.coordinates2d = ShapeUtils.rectangle(30.3, 9.8, Math.max(0.1, 39.4 * boss.hp / boss.maxHp), 1.4);
        this.updateScores();
        if (boss.hp <= 0) {
            shooter.score += 100;
            this.updateScores();
            this.playSound('boom');
            this.bossLayer.clearChildren();
            this.boss = null;
            this.waveCleared();
        }
    }

    updateTransients() {
        for (let i = this.transients.length - 1; i >= 0; i--) {
            const t = this.transients[i];
            t.ticks--;
            if (t.ticks <= 0) {
                t.nodes.forEach(n => this.overlay.removeChild(n.id, false));
                this.transients.splice(i, 1);
            }
        }
    }

    // --- input ---

    handleKeyDown(playerId, key) {
        const ship = this.ships[playerId];
        if (!ship || this.phase === 'lobby' || this.phase === 'gameover') return;
        if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
            ship.targetX = Math.max(2, ship.x - SHIP_SPEED * 1.6);
        } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
            ship.targetX = Math.min(98 - SHIP_W, ship.x + SHIP_SPEED * 1.6);
        } else if (key === ' ' || key === 'Enter' || key === 'ArrowUp' || key === 'w' || key === 'W') {
            this.tryFire(ship);
        }
    }

    // --- platform hooks ---

    handleNewPlayer({ playerId, info }) {
        this.players[playerId] = { name: (info && info.name) || ('PLAYER ' + playerId) };
        if (this.phase === 'lobby') {
            this.updateLobbyUi();
            return;
        }
        if (!this.ships[playerId] && Object.keys(this.ships).length < MAX_PLAYERS && this.phase !== 'gameover') {
            const ship = this.addShip(playerId);
            ship.invuln = INVULN_TICKS;
            this.buildHud();
            this.updateScores();
            this.addTransient(this.banner(ship.name + ' JOINED THE SQUAD', 10, 1.8, DOODLE_GREEN), 2 * TICK_RATE);
        }
        this.base.node.onStateChange();
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
        this.removeShip(playerId);

        if (Object.keys(this.players).length === 0) {
            this.showLobby();
        } else if (this.phase === 'lobby') {
            this.updateLobbyUi();
        } else if (this.phase !== 'gameover') {
            this.buildHud();
            this.updateScores();
            if (Object.keys(this.ships).length === 0) {
                this.gameOver('ALL PILOTS FLED');
            }
        }
        this.base.node.onStateChange();
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = DoodleInvaders;
