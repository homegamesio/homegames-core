const { Game, GameNode, Shapes, ShapeUtils } = require('squish-142');

// A first-person endless temple runner built on the prism-3d rendering ideas,
// simplified: the world is one endless corridor, so wall columns come from an
// analytic ray-vs-line intersection instead of a grid DDA. One player runs;
// everyone else connected watches the same shared view.

const TICK_RATE = 15;

const COLS = 56;
const COL_W = 100 / COLS;
const FOV_PLANE = 0.66;
const HEIGHT_K = 80;                     // projection scale
const MAX_DEPTH = 18;

const CORRIDOR_W = 3;                    // three 1-unit lanes
const LANES = [0.5, 1.5, 2.5];

const STAND_Z = 0.45;                    // camera height while running
const DUCK_Z = 0.26;
const JUMP_V = 0.085;
const GRAVITY = 0.013;
const CLEAR_JUMP_Z = 0.52;               // airborne enough to clear a low bar
const DUCK_TICKS = Math.round(0.6 * TICK_RATE);

const BASE_SPEED = 0.14;
const MAX_EXTRA_SPEED = 0.17;

const TEXT_H = 16 / 9;

// Gilded temple palette.
const CEILING = [18, 11, 9, 255];
const FLOOR = [54, 39, 26, 255];
const WALL_A = [176, 134, 82];
const WALL_B = [128, 94, 56];
const RUNE = [64, 224, 208];
const FOG = [10, 7, 6];
const GOLD = [255, 210, 80, 255];
const INK = [255, 244, 220, 255];
const FAINT = [180, 150, 120, 255];
const JUMP_COLOR = [214, 68, 56, 255];   // low bars: jump (red)
const DUCK_COLOR = [255, 170, 60, 255];  // hanging beams: duck (amber)
const BLOCK_COLOR = [118, 116, 128, 255];// full blocks: change lane (stone)

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });

class RelicRush extends Game {
    static metadata() {
        return {
            aspectRatio: { x: 16, y: 9 },
            squishVersion: '142',
            author: 'Joseph Garcia',
            name: 'Relic Rush',
            description: 'A first-person endless temple run rendered in real 3D. Dodge, jump, and slide through a procedurally generated corridor - friends spectate your run live.',
            tickRate: TICK_RATE
        };
    }

    constructor() {
        super();

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: CEILING
        });
        this.base.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 50, 100, 50),
            fill: FLOOR
        }), false);

        // Wall slices: created once, mutated every tick. Unscoped — spectators
        // watch the runner's view.
        this.slices = [];
        const sliceLayer = this.makeContainer();
        for (let i = 0; i < COLS; i++) {
            const slice = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(i * COL_W, 49, COL_W + 0.05, 2),
                fill: [0, 0, 0, 255]
            });
            this.slices.push(slice);
            sliceLayer.addChild(slice, false);
        }
        this.base.addChild(sliceLayer, false);

        this.sceneBox = this.makeContainer();   // obstacles/coins/floor stripes, painter-sorted
        this.hud = this.makeContainer();
        this.flash = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [255, 60, 40, 255],
            color: [255, 60, 40, 0]
        });
        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            onClick: (playerId, x, y) => this.handleTap(playerId, x, y)
        });
        this.overlay = this.makeContainer();
        this.base.addChildren(this.sceneBox, this.hud, this.flash, this.tapCatcher, this.overlay);

        this.players = {};
        this.runnerPid = null;
        this.best = 0;
        this.transients = [];
        this.tickCount = 0;

        this.showLobby();
    }

    makeContainer() {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
    }

    makeGlowText(text, x, y, size, color, glowColor, playerIds) {
        const gc = glowColor || color;
        const offsets = [[-0.25, 0], [0.25, 0], [0, -0.15], [0, 0.15]];
        const nodes = offsets.map(o => new GameNode.Text({
            textInfo: { x: x + o[0], y: y + o[1], text, size, align: 'center', font: 'monospace', color: [gc[0], gc[1], gc[2], 140] },
            playerIds
        }));
        nodes.push(new GameNode.Text({
            textInfo: { x, y, text, size, align: 'center', font: 'monospace', color },
            playerIds
        }));
        return nodes;
    }

    makeButton(label, x, y, w, h, color, onClick) {
        const button = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill: [30, 20, 14, 255],
            color,
            border: 8,
            effects: glow(color, 8),
            onClick
        });
        button.addChild(new GameNode.Text({
            textInfo: { x: x + w / 2, y: y + (h - 2.2 * TEXT_H) / 2, text: label, size: 2.2, align: 'center', font: 'monospace', color }
        }), false);
        return button;
    }

    addTransient(nodes, ticks) {
        nodes.forEach(n => this.overlay.addChild(n, false));
        this.transients.push({ nodes, ticks });
    }

    playerName(playerId) {
        return String((this.players[playerId] && this.players[playerId].name) || ('PLAYER ' + playerId)).toUpperCase().slice(0, 8);
    }

    // --- run lifecycle ---

    showLobby() {
        this.phase = 'lobby';
        this.overlay.clearChildren();
        this.hud.clearChildren();
        this.sceneBox.clearChildren();
        this.transients = [];
        this.flash.node.color = [255, 60, 40, 0];

        this.resetRunState();
        this.generateAhead();

        const title = this.makeGlowText('RELIC RUSH', 50, 12, 6.5, INK, GOLD);
        this.titleHalos = title.slice(0, 4);
        title.forEach(n => this.overlay.addChild(n, false));

        this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 24, text: 'AN ENDLESS TEMPLE - IN FIRST PERSON', size: 1.8, align: 'center', font: 'monospace', color: FAINT }
        }), false);
        if (this.best > 0) {
            this.overlay.addChild(new GameNode.Text({
                textInfo: { x: 50, y: 29, text: 'BEST RUN: ' + this.best, size: 1.6, align: 'center', font: 'monospace', color: GOLD }
            }), false);
        }

        this.overlay.addChild(this.makeButton('RUN', 40, 46, 20, 10, GOLD, (playerId) => {
            if (this.phase === 'lobby' && this.players[playerId]) {
                this.startRun(playerId);
            }
        }), false);

        const lines = [
            'RED BARS: JUMP (SPACE / TAP TOP) - AMBER BEAMS: DUCK (DOWN / TAP BOTTOM)',
            'STONE BLOCKS: CHANGE LANE (LEFT + RIGHT / TAP SIDES) - GRAB EVERY COIN',
            'ONE RUNNER AT A TIME - EVERYONE ELSE RIDES ALONG'
        ];
        lines.forEach((text, i) => this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 66 + i * 4, text, size: 1.25, align: 'center', font: 'monospace', color: FAINT }
        }), false));

        this.renderFrame();
        this.base.node.onStateChange();
    }

    resetRunState() {
        this.px = 0;
        this.lane = 1;
        this.py = LANES[1];
        this.camZ = STAND_Z;
        this.vz = 0;
        this.airborne = false;
        this.duckTicks = 0;
        this.speed = BASE_SPEED;
        this.coins = 0;
        this.objects = [];
        this.genX = 8;                    // quiet start
    }

    startRun(playerId) {
        this.runnerPid = playerId;
        this.resetRunState();
        this.generateAhead();

        this.phase = 'running';
        this.overlay.clearChildren();
        this.transients = [];
        this.flash.node.color = [255, 60, 40, 0];
        this.buildHud();

        this.addTransient(this.makeGlowText('GO, ' + this.playerName(playerId) + '!', 50, 26, 4, INK, GOLD), TICK_RATE);
        Object.keys(this.players).map(Number).forEach(pid => {
            if (pid !== playerId) {
                this.addTransient(this.makeGlowText('SPECTATING ' + this.playerName(playerId), 50, 8, 1.5, FAINT, null, [pid]), 3 * TICK_RATE);
            }
        });
        this.base.node.onStateChange();
    }

    crash(reason) {
        this.phase = 'gameOver';
        const distance = Math.floor(this.px);
        const score = distance + this.coins * 10;
        this.best = Math.max(this.best, score);
        this.flash.node.color = [255, 60, 40, 150];

        this.overlay.clearChildren();
        this.transients = [];
        this.makeGlowText(reason, 50, 18, 3.2, [255, 110, 90, 255])
            .forEach(n => this.overlay.addChild(n, false));
        this.makeGlowText(String(score), 50, 30, 8, GOLD)
            .forEach(n => this.overlay.addChild(n, false));
        this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 47, text: distance + 'm  +  ' + this.coins + ' COINS × 10', size: 1.8, align: 'center', font: 'monospace', color: INK }
        }), false);
        this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 52, text: score >= this.best && this.best > 0 ? '★ NEW BEST RUN ★' : 'BEST: ' + this.best, size: 1.6, align: 'center', font: 'monospace', color: GOLD }
        }), false);

        this.overlay.addChild(this.makeButton('RUN AGAIN', 36, 62, 28, 10, GOLD, (playerId) => {
            if (this.phase === 'gameOver' && this.players[playerId]) {
                this.startRun(playerId);
            }
        }), false);
    }

    buildHud() {
        this.hud.clearChildren();
        this.distText = new GameNode.Text({
            textInfo: { x: 50, y: 2, text: '0m', size: 2.4, align: 'center', font: 'monospace', color: INK }
        });
        this.coinText = new GameNode.Text({
            textInfo: { x: 97, y: 2, text: '◆ 0', size: 2, align: 'right', font: 'monospace', color: GOLD }
        });
        this.bestText = new GameNode.Text({
            textInfo: { x: 3, y: 2, text: 'BEST ' + this.best, size: 1.4, font: 'monospace', color: FAINT }
        });
        this.hud.addChildren(this.distText, this.coinText, this.bestText);
    }

    // --- procedural generation ---

    generateAhead() {
        while (this.genX < this.px + 26) {
            this.spawnEvent(this.genX);
            const gap = 2.8 + this.speed * 13 + Math.random() * 2.5;
            this.genX += gap;
        }
        // drop what's behind us
        this.objects = this.objects.filter(o => o.x > this.px - 2);
    }

    spawnEvent(x) {
        const roll = Math.random();
        if (roll < 0.24) {
            // Low bar across 1-3 lanes: jump it. Coins arc over it.
            const lanes = this.randomLaneSet(3);
            this.objects.push({ x, kind: 'low', lanes });
            if (Math.random() < 0.7) {
                const coinLane = lanes.indexOf(true) >= 0 ? lanes.indexOf(true) : 1;
                this.objects.push({ x: x - 0.7, kind: 'coin', lane: coinLane, z: 0.5 });
                this.objects.push({ x, kind: 'coin', lane: coinLane, z: 0.68 });
                this.objects.push({ x: x + 0.7, kind: 'coin', lane: coinLane, z: 0.5 });
            }
        } else if (roll < 0.46) {
            // Hanging beam across everything: duck it.
            this.objects.push({ x, kind: 'high', lanes: [true, true, true] });
        } else if (roll < 0.72) {
            // Stone blocks on 1-2 lanes: change lane. Coins mark the open lane.
            const blocked = this.randomLaneSet(2);
            this.objects.push({ x, kind: 'block', lanes: blocked });
            const openLane = [0, 1, 2].find(l => !blocked[l]);
            if (Math.random() < 0.8 && openLane !== undefined) {
                this.objects.push({ x: x - 0.6, kind: 'coin', lane: openLane, z: 0.22 });
                this.objects.push({ x: x + 0.6, kind: 'coin', lane: openLane, z: 0.22 });
            }
        } else {
            // Pure coin run in one lane.
            const lane = Math.floor(Math.random() * 3);
            for (let i = 0; i < 4; i++) {
                this.objects.push({ x: x + i * 0.8, kind: 'coin', lane, z: 0.22 });
            }
        }
    }

    // A lane mask with 1..max lanes set, never all three for blocks.
    randomLaneSet(max) {
        const count = 1 + Math.floor(Math.random() * Math.min(max, 2 + (max > 2 ? 1 : 0)));
        const lanes = [false, false, false];
        const order = [0, 1, 2].sort(() => Math.random() - 0.5);
        for (let i = 0; i < Math.min(count, max === 2 ? 2 : 3); i++) {
            lanes[order[i]] = true;
        }
        if (max === 2 && lanes.every(Boolean)) lanes[order[2]] = false;
        return lanes;
    }

    // --- rendering ---

    renderFrame() {
        // Walls: analytic ray-vs-corridor-side intersection per column.
        for (let col = 0; col < COLS; col++) {
            const cameraX = (2 * col) / (COLS - 1) - 1;
            const rayY = FOV_PLANE * cameraX;

            let dist = MAX_DEPTH;
            let hitX = this.px + MAX_DEPTH;
            if (rayY > 0.0001) {
                dist = (CORRIDOR_W - this.py) / rayY;
            } else if (rayY < -0.0001) {
                dist = (0 - this.py) / rayY;
            }
            dist = Math.max(0.2, Math.min(MAX_DEPTH, dist));
            hitX = this.px + dist;

            const top = 50 - ((1 - this.camZ) * HEIGHT_K) / dist;
            const bottom = 50 + (this.camZ * HEIGHT_K) / dist;
            const shade = Math.max(0.08, Math.min(1, 1.25 / (1 + dist * 0.28)));

            // Stripe the walls by world cell so motion is visible; every 8th
            // cell is a glowing teal rune band.
            const cell = Math.floor(hitX);
            const isRune = ((cell % 8) + 8) % 8 === 0;
            const baseColor = dist >= MAX_DEPTH - 0.01 ? FOG : (isRune ? RUNE : (cell % 2 === 0 ? WALL_A : WALL_B));
            const boost = isRune ? 1.25 : 1;

            const slice = this.slices[col];
            slice.node.coordinates2d = ShapeUtils.rectangle(
                Math.round(col * COL_W * 100) / 100,
                Math.round(Math.max(0, top) * 100) / 100,
                COL_W + 0.05,
                Math.round(Math.max(0.5, Math.min(100, bottom - top)) * 100) / 100);
            slice.node.fill = [
                Math.min(255, Math.round(baseColor[0] * shade * boost)),
                Math.min(255, Math.round(baseColor[1] * shade * boost)),
                Math.min(255, Math.round(baseColor[2] * shade * boost)),
                255
            ];
        }

        // Everything inside the corridor: painter-sorted far-to-near rebuild.
        this.sceneBox.clearChildren();
        const drawables = [];

        // Floor stripes every 2 world units — the speed lines.
        const firstStripe = Math.ceil((this.px + 0.4) / 2) * 2;
        for (let sx = firstStripe; sx < this.px + 14; sx += 2) {
            drawables.push({ depth: sx - this.px, kind: 'stripe' });
        }
        this.objects.forEach(o => {
            const depth = o.x - this.px;
            if (depth > 0.25 && depth < 15) {
                drawables.push({ depth, kind: 'object', o });
            }
        });
        drawables.sort((a, b) => b.depth - a.depth);

        drawables.forEach(d => {
            if (d.kind === 'stripe') {
                const y = 50 + (this.camZ * HEIGHT_K) / d.depth;
                if (y > 50 && y < 100) {
                    const h = Math.min(2.5, 12 / (d.depth * d.depth));
                    this.sceneBox.addChild(new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        coordinates2d: ShapeUtils.rectangle(0, Math.round(y * 100) / 100, 100, Math.round(h * 100) / 100),
                        fill: [78, 57, 38, 255]
                    }), false);
                }
                return;
            }
            this.drawObject(d.o, d.depth);
        });
    }

    // Project a world-space vertical span [zLow, zHigh] in a lane to screen.
    drawObject(o, depth) {
        const project = (laneY, zLow, zHigh, width) => {
            const relY = laneY - this.py;
            const screenX = 50 * (1 + relY / (depth * FOV_PLANE));
            const w = (width / depth) * (50 / FOV_PLANE);
            const yTop = 50 + ((this.camZ - zHigh) * HEIGHT_K) / depth;
            const yBottom = 50 + ((this.camZ - zLow) * HEIGHT_K) / depth;
            return { x: screenX - w / 2, y: yTop, w, h: Math.max(0.4, yBottom - yTop) };
        };
        const shade = Math.max(0.25, Math.min(1, 1.3 / (1 + depth * 0.22)));
        const tint = (c) => [Math.round(c[0] * shade), Math.round(c[1] * shade), Math.round(c[2] * shade), 255];
        const clip = (r) => r.x + r.w > 0 && r.x < 100 && r.y < 100 && r.y + r.h > 0;

        if (o.kind === 'coin') {
            const r = project(LANES[o.lane], o.z - 0.09, o.z + 0.09, 0.26);
            if (!clip(r)) return;
            const cx = r.x + r.w / 2;
            const cy = r.y + r.h / 2;
            const s = Math.max(0.5, r.h / 2);
            this.sceneBox.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: [
                    [cx, cy - s], [cx + s * 0.62, cy], [cx, cy + s], [cx - s * 0.62, cy], [cx, cy - s]
                ].map(([x, y]) => [Math.round(Math.max(0, Math.min(100, x)) * 100) / 100, Math.round(Math.max(0, Math.min(100, y)) * 100) / 100]),
                fill: tint(GOLD),
                color: [255, 255, 255, 255],
                effects: depth < 7 ? glow(GOLD, 8) : null
            }), false);
            return;
        }

        const spans = { low: [0, 0.45], high: [0.55, 1], block: [0, 1] };
        const colors = { low: JUMP_COLOR, high: DUCK_COLOR, block: BLOCK_COLOR };
        const [zLow, zHigh] = spans[o.kind];
        o.lanes.forEach((occupied, lane) => {
            if (!occupied) return;
            const r = project(LANES[lane], zLow, zHigh, 0.96);
            if (!clip(r)) return;
            this.sceneBox.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(
                    Math.round(Math.max(-20, r.x) * 100) / 100,
                    Math.round(Math.max(0, r.y) * 100) / 100,
                    Math.round(Math.min(120, r.w) * 100) / 100,
                    Math.round(Math.min(100, r.h) * 100) / 100),
                fill: tint(colors[o.kind]),
                color: [255, 255, 255, 255],
                effects: o.kind !== 'block' && depth < 6 ? glow(colors[o.kind], 6) : null
            }), false);
        });
    }

    // --- simulation ---

    tick() {
        this.tickCount++;

        if (this.phase === 'lobby' && this.titleHalos) {
            const alpha = 110 + Math.round(60 * Math.sin(this.tickCount / 5));
            this.titleHalos.forEach(halo => {
                halo.node.text.color = [GOLD[0], GOLD[1], GOLD[2], alpha];
            });
        } else if (this.phase === 'running') {
            const prevX = this.px;
            this.speed = BASE_SPEED + Math.min(MAX_EXTRA_SPEED, this.px * 0.00012);
            this.px += this.speed;

            // lane lerp
            const targetY = LANES[this.lane];
            const dy = targetY - this.py;
            this.py += Math.max(-0.17, Math.min(0.17, dy));

            // jump / duck vertical
            if (this.airborne) {
                this.camZ += this.vz;
                this.vz -= GRAVITY;
                if (this.camZ <= STAND_Z) {
                    this.camZ = STAND_Z;
                    this.airborne = false;
                }
            } else if (this.duckTicks > 0) {
                this.duckTicks--;
                this.camZ = Math.max(DUCK_Z, this.camZ - 0.06);
            } else if (this.camZ < STAND_Z) {
                this.camZ = Math.min(STAND_Z, this.camZ + 0.06);
            }

            this.generateAhead();
            this.resolveCrossings(prevX);

            if (this.phase === 'running') {
                this.renderFrame();
                this.distText.node.text.text = Math.floor(this.px) + 'm';
                if (this.flash.node.color[3] > 0) {
                    this.flash.node.color = [255, 60, 40, Math.max(0, this.flash.node.color[3] - 40)];
                }
            }
        }

        this.updateTransients();
        this.base.node.onStateChange();
    }

    resolveCrossings(prevX) {
        const currentLane = Math.round((this.py - 0.5));
        for (const o of this.objects) {
            if (!(prevX < o.x - 0.15 && this.px >= o.x - 0.15)) continue;

            if (o.kind === 'coin') {
                if (o.collected || o.lane !== currentLane) continue;
                // Air coins need you airborne; ground coins need you grounded.
                const needsAir = o.z > 0.4;
                const hasAir = this.camZ > CLEAR_JUMP_Z;
                if (needsAir !== hasAir) continue;
                o.collected = true;
                o.x = -999;
                this.coins++;
                this.coinText.node.text.text = '◆ ' + this.coins;
                continue;
            }

            if (!o.lanes[currentLane]) continue;
            if (o.kind === 'low' && this.camZ > CLEAR_JUMP_Z) continue;
            if (o.kind === 'high' && this.duckTicks > 0) continue;

            const reasons = {
                low: 'TRIPPED ON A SPIKE BAR',
                high: 'CLOTHESLINED BY A BEAM',
                block: 'RAN INTO A STONE BLOCK'
            };
            this.crash(reasons[o.kind]);
            return;
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

    doJump(playerId) {
        if (playerId !== this.runnerPid || this.phase !== 'running') return;
        if (!this.airborne && this.duckTicks <= 0) {
            this.airborne = true;
            this.vz = JUMP_V;
        }
    }

    doDuck(playerId) {
        if (playerId !== this.runnerPid || this.phase !== 'running') return;
        if (!this.airborne) {
            this.duckTicks = DUCK_TICKS;    // held key repeats keep this topped up
        }
    }

    doLane(playerId, dir) {
        if (playerId !== this.runnerPid || this.phase !== 'running') return;
        this.lane = Math.max(0, Math.min(2, this.lane + dir));
    }

    handleKeyDown(playerId, key) {
        if (key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'W') this.doJump(playerId);
        else if (key === 'ArrowDown' || key === 's' || key === 'S') this.doDuck(playerId);
        else if (key === 'ArrowLeft' || key === 'a' || key === 'A') this.doLane(playerId, -1);
        else if (key === 'ArrowRight' || key === 'd' || key === 'D') this.doLane(playerId, 1);
    }

    handleTap(playerId, x, y) {
        if (x < 30) this.doLane(playerId, -1);
        else if (x > 70) this.doLane(playerId, 1);
        else if (y < 50) this.doJump(playerId);
        else this.doDuck(playerId);
    }

    // --- platform hooks ---

    handleNewPlayer({ playerId, info }) {
        this.players[playerId] = { name: (info && info.name) || ('PLAYER ' + playerId) };
        if (this.phase === 'running') {
            this.addTransient(this.makeGlowText('SPECTATING ' + this.playerName(this.runnerPid), 50, 8, 1.5, FAINT, null, [playerId]), 3 * TICK_RATE);
        }
        this.base.node.onStateChange();
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
        if (Object.keys(this.players).length === 0) {
            this.runnerPid = null;
            this.showLobby();
            return;
        }
        if (playerId === this.runnerPid && this.phase === 'running') {
            this.crash('THE RUNNER VANISHED');
        }
        this.base.node.onStateChange();
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = RelicRush;
