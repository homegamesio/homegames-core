// DISCO OWL: FOWL PLAY — a rhythm-brawler for Homegames (squish-150).
// Dance on the beat to blast enemies with combo-powered shockwaves.
// Works with shape placeholders out of the box; flips to your uploaded
// spritesheets when you set SPRITES_ENABLED flags below.

const { Game, GameNode, Colors, Shapes, ShapeUtils, Asset } = require('squish-150');
const { COLORS } = Colors;

// ---------------------------------------------------------------- sprites
// After uploading assets via the studio:
// 1. Replace the REPLACE_ME_* ids in metadata() below with your asset ids.
// 2. Flip these flags to true. Each flag gates its whole group (§7.3.2).
const SPRITES_ENABLED = {
    owl: true,     // 4x2 spritesheet, 8 dance frames
    enemy: false,   // 4x2 spritesheet, row 0 = hop frames, row 1 = windup/lunge
    bg: false       // single background image
};

// ---------------------------------------------------------------- tuning
const TUNING = {
    DIFFICULTY: 1.0,
    TICK: 20,          // MUST match the tickRate literal in metadata()
    MAX_PLAYERS: 4,    // MUST match the maxPlayers literal in metadata()

    BEAT: { ticks: 20, window: 4, flashDecay: 6 },   // 1 beat/sec at TICK 20
    PLAYER: { hp: 3, speed: 1.15, size: 9, invulnTicks: 34, spawnProtect: 40 },
    COMBO: { max: 8, baseRadius: 11, radiusPer: 2.6 },
    ENEMIES: {
        poolMax: 12,           // hard cap (bandwidth budget, not a design knob)
        baseCount: 3, perWave: 1,
        hp: 2, hpWaveScale: 0.25,
        size: 7, speed: 0.42,
        engageRange: 30, telegraphTicks: 15, turnPerTick: 0.22,
        lungeSpeed: 2.1, lungeTicks: 11,
        cooldownTicks: 55, aimErrBase: 0.15, aimErrPer: 0.012,
        scanEvery: 9
    },
    WAVE: { seconds: 16 },
    FX: { particleMax: 40, ringMax: 6 },
    FLOOR: { cols: 6, rows: 6 }
};

const TICK = TUNING.TICK;
const BEAT = TUNING.BEAT.ticks;

// ---------------------------------------------------------------- helpers
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const c255 = v => clamp(Math.round(v), 0, 255);
const dimColor = (c, k) => [c255(c[0] * k), c255(c[1] * k), c255(c[2] * k), 255];
const rectAt = (x, y, w, h) => ShapeUtils.rectangle(x, y, w, h);

const polyCircle = (cx, cy, r, sides = 18) => {
    const pts = [];
    for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
};

const frameCrop = (col, row, cols, rows) => ({
    cropLeft: (col / cols) * 100,
    cropRight: ((cols - 1 - col) / cols) * 100,
    cropTop: (row / rows) * 100,
    cropBottom: ((rows - 1 - row) / rows) * 100
});

const SLOT_STYLES = [
    { name: 'CYAN', fill: COLORS.CYAN },
    { name: 'PINK', fill: COLORS.NEON_PINK },
    { name: 'YELLOW', fill: COLORS.HG_YELLOW },
    { name: 'GREEN', fill: COLORS.SOFT_GREEN }
];
const DISCO = [COLORS.DEEP_PURPLE, COLORS.NEON_PINK, COLORS.TURQUOISE, COLORS.HG_BLUE, COLORS.MAGENTA];
const SPAWN_SPOTS = [[30, 50], [70, 50], [50, 30], [50, 70]];

class DiscoOwl extends Game {
    static metadata() {
        return {
            isTest: true, // Showcase review: docs/game-curation.json.

            thumbnail: './assets/thumbnail.png',
            squishVersion: '150',
            name: 'Disco Owl: Fowl Play',
            author: "Joseph Garcia",
            description: 'Dance on the beat to blast pigeon waves with combo shockwaves.',
            aspectRatio: { x: 1, y: 1 },     // true circles: shockwaves must be round
            tickRate: 20,                    // keep in sync with TUNING.TICK (must stay a literal)
            maxPlayers: 4,                   // keep in sync with TUNING.MAX_PLAYERS (must stay a literal)
            services: ['multiplayer'],
            assets: {
                'owl-sheet': new Asset({ path: './assets/7b80d375671c0b4e6eff97e2978361cc.png', type: 'image' }),
                'enemy-sheet': new Asset({ path: './assets/7b80d375671c0b4e6eff97e2978361cc.png', type: 'image' }),
                'bg': new Asset({ path: './assets/7b80d375671c0b4e6eff97e2978361cc.png', type: 'image' })
            }
        };
    }

    // ------------------------------------------------------------ setup
    constructor() {
        super();
        this._t = 0;
        this.phase = 'lobby';                 // 'lobby' | 'playing' | 'gameover'
        this.score = 0;
        this.wave = 1;
        this.waveTicks = 0;
        this.spawnAt = 0;
        this.lampOn = false;
        this.tilesBright = false;
        this.hudScore = -1;                   // last-rendered values (update text only on change)
        this.hudWave = -1;
        this.hudCombo = -1;
        this.players = {};                    // playerId -> slot

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectAt(0, 0, 100, 100),
            fill: COLORS.ALMOST_BLACK
        });

        // -- background (sprite or nothing; the tile floor is the shape fallback)
        this.bgNode = this.mkSprite('bg', [0, 0, 0, 0], SPRITES_ENABLED.bg);
        if (this.bgNode._sprite) this.placeSprite(this.bgNode, 0, 0, 100, 100);

        // -- disco floor tiles (pool sized FROM tuning)
        this.floorLayer = this.mkContainer();
        this.tiles = [];
        const cols = TUNING.FLOOR.cols, rows = TUNING.FLOOR.rows;
        const tw = 100 / cols, th = 100 / rows;
        for (let r = 0; r < rows; r++) {
            for (let col = 0; col < cols; col++) {
                const baseColor = DISCO[(r + col) % DISCO.length];
                const node = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: rectAt(col * tw + 0.7, r * th + 0.7, tw - 1.4, th - 1.4),
                    fill: dimColor(baseColor, 0.22)
                });
                this.tiles.push({ node, baseColor });
                this.floorLayer.addChild(node);
            }
        }

        // -- entities
        this.entityLayer = this.mkContainer();

        this.enemies = [];
        for (let i = 0; i < TUNING.ENEMIES.poolMax; i++) {
            const e = {
                active: false, x: 0, y: 0, angle: 0, hp: 1,
                state: 'wander', readyAt: 0, aimTicks: 0, lungeTicks: 0,
                targetSlot: null, vx: 0, vy: 0,
                node: this.mkSprite('enemy-sheet', COLORS.CANDY_RED, SPRITES_ENABLED.enemy)
            };
            this.hideSprite(e.node);
            this.enemies.push(e);
            this.entityLayer.addChild(e.node);
        }

        this.slots = [];
        for (let i = 0; i < TUNING.MAX_PLAYERS; i++) {
            const style = SLOT_STYLES[i];
            const node = this.mkSprite('owl-sheet', style.fill, SPRITES_ENABLED.owl);
            node.node.effects = { shadow: { color: [style.fill[0], style.fill[1], style.fill[2], 255], blur: 12 } };
            this.hideSprite(node);
            this.slots.push({
                playerId: null, style, node, banner: null,
                cx: 50, cy: 50, vx: 0, vy: 0, moveTarget: null,
                alive: false, hp: 0, invuln: 0, combo: 0,
                danceHeld: false, hitBeat: -1
            });
            this.entityLayer.addChild(node);
        }

        // -- fx pools
        this.fxLayer = this.mkContainer();
        this.rings = [];
        for (let i = 0; i < TUNING.FX.ringMax; i++) {
            const ring = {
                active: false, x: 0, y: 0, r: 0, grow: 0, ttl: 0, max: 1, hue: COLORS.CYAN,
                node: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: rectAt(0, 0, 0, 0),
                    fill: [0, 0, 0, 0],
                    color: [255, 255, 255, 0],
                    border: 5
                })
            };
            this.rings.push(ring);
            this.fxLayer.addChild(ring.node);
        }
        this.particles = [];
        for (let i = 0; i < TUNING.FX.particleMax; i++) {
            const p = {
                active: false, x: 0, y: 0, vx: 0, vy: 0, ttl: 0, max: 1, hue: COLORS.WHITE,
                node: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: rectAt(0, 0, 0, 0),
                    fill: [0, 0, 0, 0],
                    color: [255, 255, 255, 0]
                })
            };
            this.particles.push(p);
            this.fxLayer.addChild(p.node);
        }

        // -- tap catcher (above playfield, below buttons — §9.1)
        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectAt(0, 0, 100, 100),
            onClick: (playerId, x, y) => this.handleTap(playerId, x, y)
        });

        // -- HUD
        this.hud = this.mkContainer();
        this.scoreText = new GameNode.Text({
            textInfo: { text: 'SCORE 0', x: 3, y: 2.5, size: 2, align: 'left', color: COLORS.WHITE, font: 'monospace' }
        });
        this.waveText = new GameNode.Text({
            textInfo: { text: 'WAVE 1', x: 97, y: 2.5, size: 2, align: 'right', color: COLORS.WHITE, font: 'monospace' }
        });
        this.comboText = new GameNode.Text({
            textInfo: { text: '', x: 50, y: 8.5, size: 2.2, align: 'center', color: COLORS.GOLD, font: 'monospace' }
        });
        this.grooveBg = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectAt(35, 5.5, 30, 2),
            fill: dimColor(COLORS.DEEP_PURPLE, 0.5)
        });
        this.grooveFill = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectAt(35, 5.5, 0, 2),
            fill: COLORS.GOLD
        });
        this.beatLamp = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: polyCircle(50, 3.2, 1.6, 14),
            fill: dimColor(COLORS.CYAN, 0.25)
        });
        this.danceBtn = this.mkButton({
            x: 76, y: 84, w: 21, h: 13, label: 'DANCE!', size: 2.6,
            fill: COLORS.NEON_PINK,
            onClick: (playerId) => this.dance(playerId)
        });
        this.hud.addChildren(this.scoreText, this.waveText, this.comboText,
            this.grooveBg, this.grooveFill, this.beatLamp, this.danceBtn);

        // -- lobby overlay
        this.lobby = this.mkContainer();

        const lines = [
            'Tap the floor to move. Arrows work too.',
            'Dance when the lamp flashes to blast enemies.',
            'Tap DANCE or press Space.'
        ];
        lines.forEach((text, i) => this.lobby.addChild(new GameNode.Text({
            textInfo: { text, x: 50, y: 46 + i * 4, size: 1.7, align: 'center', color: COLORS.WHITE }
        })));
        this.startBtn = this.mkButton({
            x: 36, y: 70, w: 28, h: 11, label: 'START', size: 3,
            fill: COLORS.SUCCESS_GREEN,
            onClick: () => this.resetGame()
        });
        this.lobby.addChild(this.startBtn);

        // -- game over overlay (hidden until needed)
        this.gameover = this.mkContainer();
        this.gameover.node.playerIds = [0];
        this.makeGlowText('FEATHERED OUT', 50, 30, 5, COLORS.WHITE, COLORS.CANDY_RED)
            .forEach(n => this.gameover.addChild(n));
        this.finalScoreText = new GameNode.Text({
            textInfo: { text: 'FINAL SCORE 0', x: 50, y: 42, size: 2.6, align: 'center', color: COLORS.GOLD, font: 'monospace' }
        });
        this.gameover.addChild(this.finalScoreText);
        this.againBtn = this.mkButton({
            x: 34, y: 54, w: 32, h: 11, label: 'PLAY AGAIN', size: 2.6,
            fill: COLORS.SUCCESS_GREEN,
            onClick: () => this.resetGame()
        });
        this.gameover.addChild(this.againBtn);

        // Draw order: bg, floor, entities, fx, TAP CATCHER, hud (buttons), overlays.
        this.base.addChildren(this.bgNode, this.floorLayer, this.entityLayer,
            this.fxLayer, this.tapCatcher, this.hud, this.lobby, this.gameover);
    }

    getLayers() { return [{ root: this.base }]; }

    // ------------------------------------------------------------ node factories
    mkContainer() {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectAt(0, 0, 0, 0)   // zero-size: never swallows clicks
        });
    }

    mkSprite(key, fallbackFill, ready) {
        let n;
        if (ready) {
            n = new GameNode.Asset({
                coordinates2d: rectAt(0, 0, 0, 0),
                assetInfo: { [key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 } } }
            });
            n._sprite = true;
        } else {
            n = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectAt(0, 0, 0, 0),
                fill: fallbackFill,
                color: [255, 255, 255, 255]
            });
            n._sprite = false;
        }
        n._key = key;
        n._fill = fallbackFill;
        return n;
    }

    placeSprite(n, x, y, w, h, crop, fillOverride) {
        n.node.coordinates2d = rectAt(x, y, w, h);
        if (n._sprite) {
            n.node.asset = { [n._key]: { pos: { x, y }, size: { x: w, y: h }, ...(crop || {}) } };
        } else {
            n.node.fill = fillOverride || n._fill;
        }
    }

    hideSprite(n) {
        n.node.coordinates2d = rectAt(0, 0, 0, 0);
        if (n._sprite) {
            n.node.asset = { [n._key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 } } };
        } else {
            n.node.fill = [0, 0, 0, 0];
        }
    }

    mkButton({ x, y, w, h, label, size, fill, onClick }) {
        const bg = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectAt(x, y, w, h),
            fill,
            color: [255, 255, 255, 255],
            border: 3,
            onClick
        });
        bg.addChild(new GameNode.Text({
            textInfo: {
                text: label, x: x + w / 2, y: y + h / 2 - size * 0.5,
                size, align: 'center', color: COLORS.WHITE, font: 'monospace'
            }
        }));
        return bg;
    }

    makeGlowText(text, x, y, size, color, glowColor) {
        const gc = glowColor || color;
        const offsets = [[-0.25, 0], [0.25, 0], [0, -0.25], [0, 0.25]];
        const nodes = offsets.map(o => new GameNode.Text({
            textInfo: { x: x + o[0], y: y + o[1], text, size, align: 'center', font: 'monospace', color: [gc[0], gc[1], gc[2], 140] }
        }));
        nodes.push(new GameNode.Text({
            textInfo: { x, y, text, size, align: 'center', font: 'monospace', color }
        }));
        return nodes;
    }

    // ------------------------------------------------------------ players
    handleNewPlayer({ playerId, info }) {
        const slot = this.slots.find(s => s.playerId === null);
        if (!slot) return;   // platform caps joins at maxPlayers anyway
        slot.playerId = playerId;
        this.players[playerId] = slot;

        slot.banner = new GameNode.Text({
            textInfo: {
                text: `YOU ARE THE ${slot.style.name} OWL`,
                x: 50, y: 96, size: 1.7, align: 'center',
                color: slot.style.fill, font: 'monospace'
            },
            playerIds: [playerId]   // private "YOU" marker; also the privacy anchor
        });
        this.hud.addChild(slot.banner);

        if (this.phase === 'playing') this.reviveSlot(slot);
        this.base.node.onStateChange();
    }

    handlePlayerDisconnect(playerId) {
        const slot = this.players && this.players[playerId];
        if (!slot) return;
        if (slot.banner) { this.hud.removeChild(slot.banner.id); slot.banner = null; }
        slot.playerId = null;
        slot.alive = false;
        this.hideSprite(slot.node);
        delete this.players[playerId];
        this.base.node.onStateChange();
    }

    reviveSlot(slot) {
        const idx = this.slots.indexOf(slot);
        const spot = SPAWN_SPOTS[idx % SPAWN_SPOTS.length];
        slot.cx = spot[0]; slot.cy = spot[1];
        slot.vx = 0; slot.vy = 0; slot.moveTarget = null;
        slot.hp = TUNING.PLAYER.hp;
        slot.alive = true;
        slot.invuln = TUNING.PLAYER.spawnProtect;
        slot.combo = 0;
        slot.hitBeat = -1;
    }

    // ------------------------------------------------------------ input
    handleKeyDown(playerId, key) {
        if ((this.phase === 'lobby' || this.phase === 'gameover') && key === 'Enter') {
            this.resetGame();
            return;
        }
        const slot = this.players && this.players[playerId];
        if (!slot) return;
        if (key === ' ') {
            if (!slot.danceHeld) {              // 33ms key re-sends must not spam dance
                slot.danceHeld = true;
                this.dance(playerId);
            }
            return;
        }
        let moved = false;
        if (key === 'ArrowUp' || key === 'w') { slot.vy = -1; moved = true; }
        else if (key === 'ArrowDown' || key === 's') { slot.vy = 1; moved = true; }
        else if (key === 'ArrowLeft' || key === 'a') { slot.vx = -1; moved = true; }
        else if (key === 'ArrowRight' || key === 'd') { slot.vx = 1; moved = true; }
        if (moved) slot.moveTarget = null;      // keys override tap steering
    }

    handleKeyUp(playerId, key) {
        const slot = this.players && this.players[playerId];
        if (!slot) return;
        if (key === ' ') { slot.danceHeld = false; return; }
        if (key === 'ArrowUp' || key === 'w' || key === 'ArrowDown' || key === 's') slot.vy = 0;
        if (key === 'ArrowLeft' || key === 'a' || key === 'ArrowRight' || key === 'd') slot.vx = 0;
    }

    handleTap(playerId, x, y) {
        if (this.phase !== 'playing') return;
        const slot = this.players && this.players[playerId];
        if (!slot || !slot.alive) return;
        slot.moveTarget = { x, y };
        slot.vx = 0; slot.vy = 0;
    }

    // ------------------------------------------------------------ the beat
    dance(playerId) {
        if (this.phase !== 'playing') return;
        const slot = this.players && this.players[playerId];
        if (!slot || !slot.alive) return;

        const bp = this._t % BEAT;
        const distTicks = Math.min(bp, BEAT - bp);
        const beatIdx = Math.round(this._t / BEAT);
        if (slot.hitBeat === beatIdx) return;   // one attempt per beat
        slot.hitBeat = beatIdx;

        if (distTicks <= TUNING.BEAT.window) {
            slot.combo = Math.min(TUNING.COMBO.max, slot.combo + 1);
            this.score += 1;
            const radius = TUNING.COMBO.baseRadius + slot.combo * TUNING.COMBO.radiusPer;
            this.emitRing(slot.cx, slot.cy, radius, slot.style.fill);
            this.emitBurst(slot.cx, slot.cy, slot.style.fill, 6);
            this.blastEnemies(slot, radius);
        } else {
            slot.combo = 0;
            this.emitBurst(slot.cx, slot.cy, COLORS.SMOKE, 3);
        }
        if (this.phase === 'playing') this.updateHud();   // a blast can end the game mid-call
        this.base.node.onStateChange();
    }

    blastEnemies(slot, radius) {
        const E = TUNING.ENEMIES;
        for (const e of this.enemies) {
            if (!e.active) continue;
            const dx = e.x - slot.cx, dy = e.y - slot.cy;
            const dist = Math.hypot(dx, dy);
            if (dist > radius) continue;
            e.hp -= 1;
            const a = Math.atan2(dy, dx);
            e.vx = Math.cos(a) * 1.6;            // knockback
            e.vy = Math.sin(a) * 1.6;
            if (e.hp <= 0) {
                e.active = false;
                this.hideSprite(e.node);
                this.score += 10 * Math.max(1, slot.combo);
                this.emitBurst(e.x, e.y, COLORS.ORANGE, 7);
                this.emitRing(e.x, e.y, E.size * 1.4, COLORS.ORANGE);
            } else {
                e.state = 'wander';               // interrupt telegraphs/lunges
                e.readyAt = this._t + Math.floor(E.cooldownTicks / 2);
                this.emitBurst(e.x, e.y, COLORS.WHITE, 3);
            }
        }
    }

    // ------------------------------------------------------------ fx pools
    emitRing(x, y, targetR, hue) {
        for (const ring of this.rings) {
            if (ring.active) continue;
            ring.active = true;
            ring.x = x; ring.y = y; ring.r = 2;
            ring.max = Math.ceil(targetR / 2.4);
            ring.ttl = ring.max;
            ring.grow = 2.4;
            ring.hue = hue;
            return;
        }
    }

    emitBurst(x, y, hue, count) {
        for (const p of this.particles) {
            if (count <= 0) break;
            if (p.active) continue;
            count--;
            p.active = true;
            p.x = x; p.y = y;
            const a = Math.random() * Math.PI * 2;
            const sp = 0.5 + Math.random() * 1.1;
            p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
            p.max = 12 + Math.floor(Math.random() * 6);
            p.ttl = p.max;
            p.hue = hue;
        }
    }

    updateFx() {
        for (const ring of this.rings) {
            if (!ring.active) continue;
            ring.ttl--;
            if (ring.ttl <= 0) {
                ring.active = false;
                ring.node.node.coordinates2d = rectAt(0, 0, 0, 0);
                ring.node.node.color = [255, 255, 255, 0];
                continue;
            }
            ring.r += ring.grow;
            const k = ring.ttl / ring.max;
            ring.node.node.coordinates2d = polyCircle(ring.x, ring.y, ring.r, 18);
            ring.node.node.color = [ring.hue[0], ring.hue[1], ring.hue[2], c255(220 * k)];
        }
        for (const p of this.particles) {
            if (!p.active) continue;
            p.ttl--;
            if (p.ttl <= 0) {
                p.active = false;
                p.node.node.coordinates2d = rectAt(0, 0, 0, 0);
                p.node.node.color = [255, 255, 255, 0];
                continue;
            }
            p.x = clamp(p.x + p.vx, 0, 99);
            p.y = clamp(p.y + p.vy, 0, 99);
            const k = p.ttl / p.max;
            p.node.node.coordinates2d = rectAt(p.x, p.y, 0.9, 0.9);
            p.node.node.fill = [p.hue[0], p.hue[1], p.hue[2], 255];
            p.node.node.color = [255, 255, 255, c255(230 * k)];
        }
    }

    // ------------------------------------------------------------ enemies
    spawnEnemy() {
        const E = TUNING.ENEMIES;
        const e = this.enemies.find(en => !en.active);
        if (!e) return;
        const side = Math.floor(Math.random() * 4);
        // Spawn AT the edge moving inward — negative coords pin to 0 (§6).
        if (side === 0) { e.x = 2; e.y = 10 + Math.random() * 80; }
        else if (side === 1) { e.x = 98; e.y = 10 + Math.random() * 80; }
        else if (side === 2) { e.x = 10 + Math.random() * 80; e.y = 2; }
        else { e.x = 10 + Math.random() * 80; e.y = 98; }
        e.angle = Math.atan2(50 - e.y, 50 - e.x);
        e.hp = Math.max(1, Math.round(
            (E.hp + (this.wave - 1) * E.hpWaveScale * E.hp) * TUNING.DIFFICULTY));
        e.state = 'wander';
        e.readyAt = this._t + Math.floor(Math.random() * E.cooldownTicks);
        e.aimTicks = 0; e.lungeTicks = 0; e.targetSlot = null;
        e.vx = 0; e.vy = 0;
        e.active = true;
    }

    enemyCap() {
        const E = TUNING.ENEMIES;
        return Math.min(E.poolMax, Math.max(1, Math.round(
            (E.baseCount + (this.wave - 1) * E.perWave) * TUNING.DIFFICULTY)));
    }

    updateEnemies() {
        const E = TUNING.ENEMIES;
        const alivePlayers = this.slots.filter(s => s.playerId !== null && s.alive);

        for (const e of this.enemies) {
            if (!e.active) continue;

            // knockback decay applies in every state
            e.x = clamp(e.x + e.vx, E.size / 2, 100 - E.size / 2);
            e.y = clamp(e.y + e.vy, E.size / 2, 100 - E.size / 2);
            e.vx *= 0.82; e.vy *= 0.82;

            if (e.state === 'wander') {
                if (Math.random() < 0.04) e.angle += (Math.random() - 0.5) * 1.2;
                let nx = e.x + Math.cos(e.angle) * E.speed;
                let ny = e.y + Math.sin(e.angle) * E.speed;
                if (nx < E.size / 2 || nx > 100 - E.size / 2 ||
                    ny < E.size / 2 || ny > 100 - E.size / 2) {
                    e.angle += Math.PI / 2 + (Math.random() - 0.5) * 0.8;
                    nx = e.x; ny = e.y;
                }
                e.x = clamp(nx, E.size / 2, 100 - E.size / 2);
                e.y = clamp(ny, E.size / 2, 100 - E.size / 2);

                // Acquire: scan a few times a second, only when off cooldown (§14.3).
                if (this._t >= e.readyAt && this._t % E.scanEvery === 0 && alivePlayers.length) {
                    let best = null, bestDist = E.engageRange;
                    for (const s of alivePlayers) {
                        if (s.invuln > 0) continue;               // respect protection windows
                        const d = Math.hypot(s.cx - e.x, s.cy - e.y);
                        if (d < bestDist) { best = s; bestDist = d; }
                    }
                    if (best) {
                        e.state = 'telegraph';                     // TELEGRAPH before firing
                        e.targetSlot = best;
                        e.aimTicks = E.telegraphTicks;
                    }
                }
            } else if (e.state === 'telegraph') {
                const t = e.targetSlot;
                const lost = !t || !t.alive || t.invuln > 0 ||
                    Math.hypot(t.cx - e.x, t.cy - e.y) > E.engageRange * 1.3;
                if (lost) {
                    e.state = 'wander';
                    e.targetSlot = null;
                } else {
                    // stop and visibly turn toward the target — the dodge window
                    const want = Math.atan2(t.cy - e.y, t.cx - e.x);
                    let diff = want - e.angle;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    e.angle += clamp(diff, -E.turnPerTick, E.turnPerTick);
                    e.aimTicks--;
                    if (e.aimTicks <= 0) {
                        const dist = Math.hypot(t.cx - e.x, t.cy - e.y);
                        const err = (Math.random() - 0.5) * (E.aimErrBase + dist * E.aimErrPer);
                        e.angle += err;                            // fire with distance-scaled error
                        e.state = 'lunge';
                        e.lungeTicks = E.lungeTicks;
                    }
                }
            } else if (e.state === 'lunge') {
                e.x = clamp(e.x + Math.cos(e.angle) * E.lungeSpeed, E.size / 2, 100 - E.size / 2);
                e.y = clamp(e.y + Math.sin(e.angle) * E.lungeSpeed, E.size / 2, 100 - E.size / 2);
                e.lungeTicks--;
                for (const s of alivePlayers) {
                    if (!s.alive || s.invuln > 0) continue;
                    const hitDist = (TUNING.PLAYER.size + E.size) / 2 * 0.8;
                    if (Math.hypot(s.cx - e.x, s.cy - e.y) < hitDist) {
                        e.lungeTicks = 0;
                        this.damagePlayer(s);
                        if (this.phase !== 'playing') return;      // gameOver mid-loop (§10)
                        break;
                    }
                }
                if (e.lungeTicks <= 0) {
                    e.state = 'wander';
                    e.targetSlot = null;
                    e.readyAt = this._t + E.cooldownTicks;         // long cooldown, no snap re-fire
                }
            }

            this.drawEnemy(e);
        }
    }

    drawEnemy(e) {
        const E = TUNING.ENEMIES;
        // Telegraph signal in BOTH render modes (§7.3.2): size puff always,
        // plus a tint in shape mode.
        const puff = e.state === 'telegraph' ? 1.25 : 1;
        const size = E.size * puff;
        let crop = null, fillOverride = null;
        if (e.node._sprite) {
            const col = e.state === 'wander' ? ((this._t >> 3) % 4)
                : e.state === 'telegraph' ? 0
                : 1 + ((this._t >> 2) % 3);
            const row = e.state === 'wander' ? 0 : 1;
            crop = frameCrop(col, row, 4, 2);
        } else if (e.state === 'telegraph') {
            fillOverride = COLORS.HG_YELLOW;
        }
        this.placeSprite(e.node, e.x - size / 2, e.y - size / 2, size, size, crop, fillOverride);
    }

    // ------------------------------------------------------------ players tick
    damagePlayer(slot) {
        if (!slot.alive || slot.invuln > 0) return;
        slot.hp -= 1;
        slot.invuln = TUNING.PLAYER.invulnTicks;
        slot.combo = 0;
        this.emitBurst(slot.cx, slot.cy, COLORS.CANDY_RED, 8);
        if (slot.hp <= 0) {
            slot.alive = false;
            this.hideSprite(slot.node);
            this.emitRing(slot.cx, slot.cy, 14, COLORS.CANDY_RED);
            const anyAlive = this.slots.some(s => s.playerId !== null && s.alive);
            if (!anyAlive) this.gameOver();
        }
    }

    updatePlayers() {
        const P = TUNING.PLAYER;
        for (const slot of this.slots) {
            if (slot.playerId === null || !slot.alive) continue;

            if (slot.moveTarget) {
                const dx = slot.moveTarget.x - slot.cx;
                const dy = slot.moveTarget.y - slot.cy;
                const d = Math.hypot(dx, dy);
                if (d < 1.2) {
                    slot.moveTarget = null;
                } else {
                    slot.cx += (dx / d) * P.speed;
                    slot.cy += (dy / d) * P.speed;
                }
            } else if (slot.vx !== 0 || slot.vy !== 0) {
                const norm = (slot.vx !== 0 && slot.vy !== 0) ? Math.SQRT1_2 : 1;
                slot.cx += slot.vx * P.speed * norm;
                slot.cy += slot.vy * P.speed * norm;
            }
            slot.cx = clamp(slot.cx, P.size / 2, 100 - P.size / 2);
            slot.cy = clamp(slot.cy, P.size / 2, 100 - P.size / 2);

            if (slot.invuln > 0) {
                slot.invuln--;
                if ((this._t >> 1) & 1) {          // blink works in both render modes
                    this.hideSprite(slot.node);
                    continue;
                }
            }
            const frame = Math.floor(((this._t % (BEAT * 2)) / (BEAT * 2)) * 8) % 8;
            const crop = slot.node._sprite ? frameCrop(frame % 4, Math.floor(frame / 4), 4, 2) : null;
            // shape mode dance: a subtle beat bounce
            const bounce = slot.node._sprite ? 0 : Math.sin((this._t % BEAT) / BEAT * Math.PI) * 0.8;
            this.placeSprite(slot.node,
                slot.cx - P.size / 2, slot.cy - P.size / 2 - bounce,
                P.size, P.size + bounce, crop);
        }
    }

    // ------------------------------------------------------------ beat + hud
    updateBeat() {
        const bp = this._t % BEAT;
        if (bp === 0) {
            for (const t of this.tiles) {
                const hue = DISCO[Math.floor(Math.random() * DISCO.length)];
                t.node.node.fill = dimColor(hue, 0.5);
            }
            this.tilesBright = true;
        } else if (bp === TUNING.BEAT.flashDecay && this.tilesBright) {
            for (const t of this.tiles) {
                t.node.node.fill = dimColor(t.baseColor, 0.22);
            }
            this.tilesBright = false;
        }
        const on = bp <= TUNING.BEAT.window || bp >= BEAT - TUNING.BEAT.window;
        if (on !== this.lampOn) {
            this.lampOn = on;
            this.beatLamp.node.fill = on ? COLORS.CYAN : dimColor(COLORS.CYAN, 0.25);
            this.beatLamp.node.effects = on
                ? { shadow: { color: [0, 255, 255, 255], blur: 16 } }
                : null;
        }
    }

    updateHud() {
        if (this.score !== this.hudScore) {
            this.hudScore = this.score;
            this.scoreText.node.text = { text: `SCORE ${this.score}`, x: 3, y: 2.5, size: 2, align: 'left', color: COLORS.WHITE, font: 'monospace' };
        }
        if (this.wave !== this.hudWave) {
            this.hudWave = this.wave;
            this.waveText.node.text = { text: `WAVE ${this.wave}`, x: 97, y: 2.5, size: 2, align: 'right', color: COLORS.WHITE, font: 'monospace' };
        }
        let maxCombo = 0;
        for (const s of this.slots) {
            if (s.playerId !== null && s.combo > maxCombo) maxCombo = s.combo;
        }
        if (maxCombo !== this.hudCombo) {
            this.hudCombo = maxCombo;
            this.comboText.node.text = {
                text: maxCombo > 1 ? `COMBO x${maxCombo}` : '',
                x: 50, y: 8.5, size: 2.2, align: 'center', color: COLORS.GOLD, font: 'monospace'
            };
            this.grooveFill.node.coordinates2d = rectAt(35, 5.5, 30 * (maxCombo / TUNING.COMBO.max), 2);
        }
    }

    updateWave() {
        this.waveTicks++;
        if (this.waveTicks >= TUNING.WAVE.seconds * TICK) {
            this.waveTicks = 0;
            this.wave++;
        }
        if (this._t >= this.spawnAt) {
            this.spawnAt = this._t + 30;
            const activeCount = this.enemies.filter(e => e.active).length;
            if (activeCount < this.enemyCap()) this.spawnEnemy();
        }
    }

    // ------------------------------------------------------------ phases
    resetGame() {
        this.phase = 'playing';
        this.score = 0;
        this.wave = 1;
        this.waveTicks = 0;
        this.spawnAt = 0;
        this.hudScore = -1; this.hudWave = -1; this.hudCombo = -1;
        for (const e of this.enemies) { e.active = false; this.hideSprite(e.node); }
        for (const ring of this.rings) { ring.active = false; ring.node.node.coordinates2d = rectAt(0, 0, 0, 0); ring.node.node.color = [255, 255, 255, 0]; }
        for (const p of this.particles) { p.active = false; p.node.node.coordinates2d = rectAt(0, 0, 0, 0); p.node.node.color = [255, 255, 255, 0]; }
        for (const slot of this.slots) {
            if (slot.playerId !== null) this.reviveSlot(slot);
        }
        this.lobby.node.playerIds = [0];
        this.gameover.node.playerIds = [0];
        this.updateHud();
        this.base.node.onStateChange();
    }

    gameOver() {
        this.phase = 'gameover';
        this.finalScoreText.node.text = {
            text: `FINAL SCORE ${this.score} — WAVE ${this.wave}`,
            x: 50, y: 42, size: 2.6, align: 'center', color: COLORS.GOLD, font: 'monospace'
        };
        this.gameover.node.playerIds = [];
        this.base.node.onStateChange();
    }

    // ------------------------------------------------------------ the loop
    tick() {
        this._t++;
        if (this.phase !== 'playing') return;   // menus are event-driven only

        this.updateBeat();
        this.updatePlayers();
        this.updateEnemies();
        if (this.phase !== 'playing') return;   // a lunge may have ended it (§10)
        this.updateFx();
        this.updateWave();
        this.updateHud();
        this.base.node.onStateChange();          // ONE notify per tick
    }
}

module.exports = DiscoOwl;
