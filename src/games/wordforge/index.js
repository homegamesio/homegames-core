const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');

// WORD FORGE — demo
// Type a word, press Enter: it becomes a neon platform you can stand on.
// Rising flood forces you to keep building upward.
//
// Mobile: on-screen move/jump + tap a preset word chip to forge without a keyboard.

const TUNING = {
    TICK_RATE: 30, // MUST match metadata().tickRate
    MAX_PLAYERS: 4, // MUST match metadata().maxPlayers

    PLAYER: {
        w: 4,
        h: 5.2,
        speedPerSecond: 28,
        jumpSpeedPerSecond: 52,
        gravityPerSecond2: 140,
        maxFallPerSecond: 70
    },
    PLATFORM: {
        height: 2.2,
        minWidth: 8,
        widthPerLetter: 3.2,
        maxWidth: 36,
        maxCount: 28,
        spawnAhead: 1.5,
        lifetimeSeconds: 28
    },
    FLOOD: {
        startY: 100,
        risePerSecond: 0.55,
        graceSeconds: 8,
        winAboveY: 8
    },
    UI: {
        menuMinReadSeconds: 1.6,
        inputDebounceSeconds: 0.25
    }
};

const TICK_RATE = TUNING.TICK_RATE;
const DT = 1 / TICK_RATE;
const ticksFor = (seconds) => Math.max(1, Math.round(seconds * TICK_RATE));

const KEY_STALE_MS = 400;
const REPEAT_DELAY_MS = 450;
const REPEAT_EVERY_MS = 55;

const BG = [18, 24, 40, 255];
const GROUND = [40, 50, 72, 255];
const FLOOD_FILL = [40, 130, 210, 255];
const NEON = [80, 255, 230, 255];
const NEON_DIM = [60, 160, 170, 255];
const WARNING = [255, 120, 90, 255];
const INK = [240, 248, 255, 255];
const FAINT = [170, 190, 210, 255];
const PANEL = [32, 42, 64, 255];
const ACCENT = [255, 220, 100, 255];
const BUTTON_FILL = [30, 110, 120, 255];
const CHIP_FILL = [28, 70, 90, 255];

const PRESET_WORDS = ['HI', 'BRIDGE', 'PLATFORM', 'WALL', 'RAMP', 'STEP'];

const PLAYER_COLORS = [
    [80, 255, 230, 255],
    [255, 150, 90, 255],
    [190, 130, 255, 255],
    [120, 230, 130, 255]
];

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));

class WordForge extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Wordforge',
            author: "Joseph Garcia",
            description: 'Type a word and it becomes a neon platform. Climb above the rising flood.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 30,
            maxPlayers: 4,
            gameId: "ea1f58a5-76e7-515e-a9cf-599c15145caa"
        };
    }

    constructor() {
        super();

        this._t = 0;
        this.dirty = false;
        this.phase = 'title'; // title | playing | dead | won
        this.phaseReadyAt = 0;
        this.players = {};
        this.colorIndex = 0;

        this.floodY = TUNING.FLOOD.startY;
        this.floodStartsAt = 0;
        this.groundY = 88;

        this.base = this.rect(0, 0, 100, 100, BG);

        this.skyLine = this.rect(0, 0, 100, 0.4, NEON_DIM, { effects: glow(NEON, 10) });
        this.ground = this.rect(0, this.groundY, 100, 100 - this.groundY, GROUND);
        this.flood = this.rect(0, 100, 100, 0, FLOOD_FILL, {
            color: [120, 200, 255, 180],
            effects: glow([40, 160, 255, 255], 18)
        });

        this.platformLayer = this.container();
        this.playerLayer = this.container();
        this.fxLayer = this.container();
        this.hudLayer = this.container();
        this.overlayLayer = this.container();
        this.mobileLayer = this.container();

        // Full-screen tap catcher under HUD/mobile buttons (for mobile forge chips later).
        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [0, 0, 0, 0],
            onClick: () => {}
        });

        this.subtitleText = this.text('Type a word  ·  Press Enter  ·  It becomes a platform', 50, 40, 1.6, INK, 'center');
        this.hintText = this.text('WASD / arrows to move  ·  Space / W / Up to jump', 50, 48, 1.3, FAINT, 'center');
        this.startBtn = this.makeButton({
            x: 35, y: 58, w: 30, h: 10,
            label: 'PLAY',
            size: 2.4,
            fill: BUTTON_FILL,
            onClick: (playerId) => this.startRun(playerId)
        });

        this.bufferText = this.text('', 50, 6, 2.2, ACCENT, 'center');
        this.statusText = this.text('', 50, 11, 1.5, FAINT, 'center');
        this.floodText = this.text('', 96, 6, 1.4, WARNING, 'right');
        this.forgeFlash = this.text('', 50, 18, 2.4, NEON, 'center');
        this.forgeFlashUntil = 0;

        this.base.addChildren(
            this.skyLine,
            this.ground,
            this.flood,
            this.platformLayer,
            this.playerLayer,
            this.fxLayer,
            this.tapCatcher,
            this.hudLayer,
            this.mobileLayer,
            this.overlayLayer
        );

        this.platforms = [];
        for (let i = 0; i < TUNING.PLATFORM.maxCount; i++) {
            const node = this.rect(0, 0, 0, 0, [0, 0, 0, 0], {
                effects: null,
                color: [255, 255, 255, 255]
            });
            const label = this.text('', 0, 0, 1.2, INK, 'center');
            node.addChild(label);
            this.platformLayer.addChild(node);
            this.platforms.push({
                active: false,
                x: 0,
                y: 0,
                w: 0,
                h: TUNING.PLATFORM.height,
                kind: 'platform',
                word: '',
                expiresAt: 0,
                bounce: false,
                node,
                label
            });
        }

        this.sparks = [];
        for (let i = 0; i < 36; i++) {
            const node = this.rect(0, 0, 0, 0, [0, 0, 0, 0], { color: [255, 255, 255, 0] });
            this.fxLayer.addChild(node);
            this.sparks.push({
                active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, fill: NEON, node
            });
        }

        this.showTitle(true);
    }

    getLayers() {
        return [{ root: this.base }];
    }

    // ---- node helpers ----

    container() {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
    }

    rect(x, y, w, h, fill, opts = {}) {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill,
            ...opts
        });
    }

    text(str, x, y, size, color, align = 'left') {
        return new GameNode.Text({
            textInfo: { text: str, x, y, size, align, font: 'monospace', color }
        });
    }

    setText(node, str, extra = {}) {
        const cur = node.node.text;
        if (cur.text === str && !Object.keys(extra).length) return;
        node.node.text = { ...cur, text: str, ...extra };
        this.dirty = true;
    }

    makeButton({ x, y, w, h, label, size, fill, onClick, playerIds }) {
        const bg = this.rect(x, y, w, h, fill, {
            border: 4,
            color: NEON,
            onClick,
            effects: glow(NEON, 8),
            ...(playerIds ? { playerIds } : {})
        });
        const labelNode = this.text(label, x + w / 2, y + (h - size * (16 / 9)) / 2, size, INK, 'center');
        if (playerIds) labelNode.node.playerIds = playerIds.slice();
        bg.addChild(labelNode);
        return bg;
    }

    // ---- lifecycle ----

    handleNewPlayer({ playerId, info }) {
        const pid = Number(playerId);
        if (this.players[pid] || Object.keys(this.players).length >= TUNING.MAX_PLAYERS) return;

        const color = PLAYER_COLORS[this.colorIndex++ % PLAYER_COLORS.length];
        const name = ((info && info.name) || `P${pid}`).toUpperCase().slice(0, 10);

        // Privacy anchor so private HUD never leaks in frameless sessions.
        const anchor = this.rect(0, 0, 0, 0, [0, 0, 0, 0], { playerIds: [pid] });
        this.base.addChild(anchor);

        const body = this.rect(0, 0, 0, 0, color, { effects: glow(color, 12) });
        this.playerLayer.addChild(body);

        const you = this.text('YOU', 0, 0, 1.1, color, 'center');
        you.node.playerIds = [pid];
        this.playerLayer.addChild(you);

        this.players[pid] = {
            name,
            color,
            x: 20 + (Object.keys(this.players).length % 4) * 12,
            y: this.groundY - TUNING.PLAYER.h,
            vx: 0,
            vy: 0,
            facing: 1,
            onGround: true,
            alive: true,
            buffer: '',
            keys: {},
            moveX: 0,
            jumpHeld: false,
            body,
            you,
            anchor
        };

        this.placePlayer(this.players[pid]);
        this.rebuildMobileControls();
        // Demo convenience: first joiner auto-starts so the forge loop is immediate.
        if (this.phase === 'title' && Object.keys(this.players).length === 1) {
            this.setTimeout(() => {
                if (this.phase === 'title' && this.players[pid]) this.startRun(pid);
            }, 400);
        }
        this.dirty = true;
    }

    handlePlayerDisconnect(playerId) {
        const pid = Number(playerId);
        const p = this.players[pid];
        if (!p) return;
        this.playerLayer.removeChild(p.body.node.id);
        this.playerLayer.removeChild(p.you.node.id);
        this.base.removeChild(p.anchor.node.id);
        delete this.players[pid];
        this.rebuildMobileControls();
        if (!Object.keys(this.players).length && this.phase !== 'title') {
            this.resetWorld();
            this.showTitle();
        }
        this.dirty = true;
    }

    // ---- phases ----

    showTitle(immediate = false) {
        this.phase = 'title';
        this.phaseReadyAt = immediate ? this._t : this._t + ticksFor(TUNING.UI.inputDebounceSeconds);
        this.overlayLayer.clearChildren();
        this.overlayLayer.addChildren(
            this.subtitleText,
            this.hintText,
            this.startBtn
        );
        this.hudLayer.clearChildren();
        this.hideAllPlatforms();
        this.floodY = TUNING.FLOOD.startY;
        this.drawFlood();
        this.dirty = true;
    }

    startRun(playerId) {
        if (this.phase !== 'title' && this.phase !== 'dead' && this.phase !== 'won') return;
        if (!this.players[Number(playerId)]) return;
        if (this._t < this.phaseReadyAt) return;

        this.resetWorld();
        this.phase = 'playing';
        this.floodStartsAt = this._t + ticksFor(TUNING.FLOOD.graceSeconds);
        this.overlayLayer.clearChildren();
        this.hudLayer.clearChildren();
        this.hudLayer.addChildren(this.bufferText, this.statusText, this.floodText, this.forgeFlash);
        this.setText(this.statusText, 'Type any word + Enter, or tap a chip below — then jump on it');
        this.setText(this.forgeFlash, '');
        this.rebuildMobileControls();

        // Seed one obvious forged platform so the mechanic is visible immediately.
        const p = this.players[Number(playerId)];
        if (p) {
            p.x = 20;
            p.y = this.groundY - TUNING.PLAYER.h;
            p.facing = 1;
            this.placePlayer(p);
            this.forgeWord(p, 'BRIDGE');
        }
        this.dirty = true;
    }

    resetWorld() {
        this.floodY = TUNING.FLOOD.startY;
        this.drawFlood();
        this.hideAllPlatforms();
        Object.values(this.players).forEach((p, i) => {
            p.x = 18 + i * 10;
            p.y = this.groundY - TUNING.PLAYER.h;
            p.vx = 0;
            p.vy = 0;
            p.facing = 1;
            p.onGround = true;
            p.alive = true;
            p.buffer = '';
            p.keys = {};
            p.moveX = 0;
            p.jumpHeld = false;
            this.placePlayer(p);
        });
        this.setText(this.bufferText, '');
        this.forgeFlashUntil = 0;
    }

    endRun(won) {
        this.phase = won ? 'won' : 'dead';
        this.phaseReadyAt = this._t + ticksFor(TUNING.UI.menuMinReadSeconds);
        this.overlayLayer.clearChildren();
        const title = won ? 'ABOVE THE FLOOD' : 'SWEPT AWAY';
        const sub = won
            ? 'You climbed high enough. Forge again?'
            : 'The flood caught you. Build higher next time.';
        this.overlayLayer.addChildren(
            this.text(title, 50, 30, 4, won ? NEON : WARNING, 'center'),
            this.text(sub, 50, 42, 1.5, INK, 'center'),
            this.makeButton({
                x: 35, y: 55, w: 30, h: 10,
                label: 'AGAIN',
                size: 2.2,
                fill: BUTTON_FILL,
                onClick: (playerId) => this.startRun(playerId)
            })
        );
        this.dirty = true;
    }

    // ---- input ----

    handleKeyDown(playerId, key) {
        const p = this.players[Number(playerId)];
        if (!p) return;

        if (this.phase === 'title' && (key === 'Enter' || key === ' ')) {
            if (this._t >= this.phaseReadyAt) this.startRun(playerId);
            return;
        }
        if ((this.phase === 'dead' || this.phase === 'won') && key === 'Enter') {
            if (this._t >= this.phaseReadyAt) this.startRun(playerId);
            return;
        }
        if (this.phase !== 'playing' || !p.alive) return;

        if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
            p.moveX = -1;
            p.facing = -1;
            return;
        }
        if (key === 'ArrowRight' || key === 'd' || key === 'D') {
            p.moveX = 1;
            p.facing = 1;
            return;
        }
        if (key === 'ArrowUp' || key === 'w' || key === 'W' || key === ' ') {
            if (!p.jumpHeld && p.onGround) {
                p.vy = -TUNING.PLAYER.jumpSpeedPerSecond;
                p.onGround = false;
            }
            p.jumpHeld = true;
            return;
        }

        // Typing path (OS-style repeat gating from the reference / Typewriter).
        if (key !== 'Backspace' && key !== 'Enter' && key.length !== 1) return;
        const now = Date.now();
        const state = p.keys[key];
        if (!state || now - state.lastSeen > KEY_STALE_MS) {
            p.keys[key] = { lastSeen: now, repeatAt: now + REPEAT_DELAY_MS };
            this.applyTypeKey(p, key);
            return;
        }
        state.lastSeen = now;
        if (now >= state.repeatAt) {
            state.repeatAt = now + REPEAT_EVERY_MS;
            this.applyTypeKey(p, key);
        }
    }

    handleKeyUp(playerId, key) {
        const p = this.players[Number(playerId)];
        if (!p) return;
        if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
            if (p.moveX < 0) p.moveX = 0;
        } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
            if (p.moveX > 0) p.moveX = 0;
        } else if (key === 'ArrowUp' || key === 'w' || key === 'W' || key === ' ') {
            p.jumpHeld = false;
        }
        delete p.keys[key];
    }

    applyTypeKey(p, key) {
        if (key === 'Enter') {
            this.forgeWord(p);
            return;
        }
        if (key === 'Backspace') {
            p.buffer = p.buffer.slice(0, -1);
            this.refreshBufferHud();
            return;
        }
        if (key === ' ') return; // space is jump
        if (!/[a-zA-Z]/.test(key)) return;
        if (p.buffer.length >= 12) return;
        p.buffer += key.toUpperCase();
        this.refreshBufferHud();
    }

    refreshBufferHud() {
        // Show the first alive player's buffer for the shared demo HUD.
        // (Private per-player buffers still forge independently.)
        const focus = Object.values(this.players).find(p => p.alive) || Object.values(this.players)[0];
        if (!focus) {
            this.setText(this.bufferText, '');
            return;
        }
        const shown = focus.buffer.length ? `> ${focus.buffer}▌` : '> ▌  (type a word)';
        this.setText(this.bufferText, shown);
    }

    // ---- forging (the whole point) ----

    forgeWord(p, forcedWord) {
        if (this.phase !== 'playing' || !p.alive) return;
        const raw = (forcedWord || p.buffer || '').trim().toUpperCase();
        p.buffer = '';
        this.refreshBufferHud();
        if (!raw) {
            this.setText(this.statusText, 'Type letters first, then Enter');
            return;
        }

        const kind = this.wordKind(raw);
        const slot = this.platforms.find(pl => !pl.active);
        if (!slot) {
            this.setText(this.statusText, 'Too many platforms — older ones will fade');
            // Expire the oldest and reuse.
            let oldest = this.platforms[0];
            for (const pl of this.platforms) {
                if (pl.active && pl.expiresAt < oldest.expiresAt) oldest = pl;
            }
            this.deactivatePlatform(oldest);
            return this.forgeWord(p, raw);
        }

        const geo = this.geometryForWord(raw, kind, p);
        slot.active = true;
        slot.kind = kind;
        slot.word = raw;
        slot.x = geo.x;
        slot.y = geo.y;
        slot.w = geo.w;
        slot.h = geo.h;
        slot.bounce = kind === 'boost';
        slot.expiresAt = this._t + ticksFor(TUNING.PLATFORM.lifetimeSeconds);
        slot.verts = geo.verts || null;

        this.drawPlatform(slot);
        this.burst(geo.x + geo.w / 2, geo.y + geo.h / 2, p.color);
        this.setText(this.forgeFlash, `FORGED  “${raw}”  →  ${kind.toUpperCase()}`);
        this.forgeFlashUntil = this._t + ticksFor(1.4);
        this.setText(this.statusText, this.hintForKind(kind, raw));
        this.dirty = true;
    }

    wordKind(word) {
        if (word === 'WALL') return 'wall';
        if (word === 'RAMP') return 'ramp';
        if (word === 'BOOST' || word === 'JUMP') return 'boost';
        if (word === 'STEP') return 'step';
        return 'platform';
    }

    hintForKind(kind, word) {
        if (kind === 'wall') return 'WALL is a tall barrier — climb beside it';
        if (kind === 'ramp') return 'RAMP is a diagonal slope';
        if (kind === 'boost') return 'BOOST launches you upward';
        if (kind === 'step') return 'STEP is a short foothold';
        return `“${word}” → platform  (${word.length} letters wide)`;
    }

    geometryForWord(word, kind, p) {
        const ahead = TUNING.PLATFORM.spawnAhead;
        const face = p.facing >= 0 ? 1 : -1;
        const baseX = p.x + (face > 0 ? TUNING.PLAYER.w + ahead : -ahead);
        const footY = p.y + TUNING.PLAYER.h;

        if (kind === 'wall') {
            const w = 2.4;
            const h = 14;
            const x = face > 0 ? baseX : baseX - w;
            const y = clamp(footY - h, 4, this.groundY - h);
            return { x, y, w, h };
        }
        if (kind === 'ramp') {
            const w = 16;
            const h = 8;
            const x = face > 0 ? baseX : baseX - w;
            const y = clamp(footY - 2 - h, 4, this.groundY - h);
            // Triangle ramp facing outward.
            const verts = face > 0
                ? [[x, y + h], [x + w, y], [x + w, y + h], [x, y + h]]
                : [[x, y], [x + w, y + h], [x, y + h], [x, y]];
            return { x, y, w, h, verts };
        }
        if (kind === 'boost') {
            const w = 8;
            const h = 2;
            const x = face > 0 ? baseX : baseX - w;
            const y = clamp(footY - 1, 4, this.groundY - h);
            return { x, y, w, h };
        }
        if (kind === 'step') {
            const w = 7;
            const h = TUNING.PLATFORM.height;
            const x = face > 0 ? baseX : baseX - w;
            const y = clamp(footY - 6, 4, this.groundY - h);
            return { x, y, w, h };
        }

        // Default: horizontal platform sized by word length.
        const w = clamp(
            TUNING.PLATFORM.minWidth + (word.length - 1) * TUNING.PLATFORM.widthPerLetter,
            TUNING.PLATFORM.minWidth,
            TUNING.PLATFORM.maxWidth
        );
        const h = TUNING.PLATFORM.height;
        const x = face > 0 ? baseX : baseX - w;
        // Spawn roughly at chest / jump height so you can hop onto it.
        const y = clamp(footY - 7, 4, this.groundY - h);
        return {
            x: clamp(x, 1, 99 - w),
            y,
            w,
            h
        };
    }

    drawPlatform(slot) {
        const fill = slot.kind === 'boost' ? ACCENT
            : slot.kind === 'wall' ? [255, 120, 180, 255]
            : slot.kind === 'ramp' ? [130, 180, 255, 255]
            : NEON;
        if (slot.verts) {
            slot.node.node.coordinates2d = slot.verts;
        } else {
            slot.node.node.coordinates2d = ShapeUtils.rectangle(slot.x, slot.y, slot.w, slot.h);
        }
        slot.node.node.fill = fill;
        slot.node.node.effects = glow(fill, 14);
        slot.node.node.color = [255, 255, 255, 255];
        const labelY = slot.y + Math.max(0.2, (slot.h - 1.2 * (16 / 9)) / 2);
        slot.label.node.text = {
            text: slot.word,
            x: slot.x + slot.w / 2,
            y: labelY,
            size: Math.min(1.6, Math.max(0.9, slot.w / (slot.word.length * 1.1))),
            align: 'center',
            font: 'monospace',
            color: BG
        };
        this.dirty = true;
    }

    deactivatePlatform(slot) {
        slot.active = false;
        slot.verts = null;
        slot.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        slot.node.node.fill = [0, 0, 0, 0];
        slot.node.node.effects = null;
        slot.label.node.text = { ...slot.label.node.text, text: '' };
        this.dirty = true;
    }

    hideAllPlatforms() {
        for (const slot of this.platforms) this.deactivatePlatform(slot);
    }

    // ---- mobile / tap controls ----

    rebuildMobileControls() {
        this.mobileLayer.clearChildren();
        // Shared on-screen controls (tap-first). Scoped? No — anyone can use them in this demo.
        const left = this.makeButton({
            x: 2, y: 78, w: 12, h: 10, label: '◀', size: 2.2, fill: PANEL,
            onClick: (pid) => this.tapMove(pid, -1)
        });
        const right = this.makeButton({
            x: 16, y: 78, w: 12, h: 10, label: '▶', size: 2.2, fill: PANEL,
            onClick: (pid) => this.tapMove(pid, 1)
        });
        const jump = this.makeButton({
            x: 86, y: 78, w: 12, h: 10, label: 'JUMP', size: 1.4, fill: PANEL,
            onClick: (pid) => this.tapJump(pid)
        });

        this.mobileLayer.addChildren(left, right, jump);

        // Preset word chips — tap to forge without typing.
        PRESET_WORDS.forEach((word, i) => {
            const x = 2 + (i % 6) * 16.2;
            const y = 90;
            this.mobileLayer.addChild(this.makeButton({
                x, y, w: 15.5, h: 7,
                label: word,
                size: 1.2,
                fill: CHIP_FILL,
                onClick: (pid) => this.tapForge(pid, word)
            }));
        });
        this.dirty = true;
    }

    tapMove(playerId, dir) {
        const p = this.players[Number(playerId)];
        if (!p || this.phase !== 'playing' || !p.alive) return;
        p.moveX = dir;
        p.facing = dir;
        // Auto-stop shortly after a tap so mobile doesn't drift forever.
        this.setTimeout(() => {
            if (p.moveX === dir) p.moveX = 0;
        }, 220);
    }

    tapJump(playerId) {
        const p = this.players[Number(playerId)];
        if (!p || this.phase !== 'playing' || !p.alive) return;
        if (p.onGround) {
            p.vy = -TUNING.PLAYER.jumpSpeedPerSecond;
            p.onGround = false;
        }
    }

    tapForge(playerId, word) {
        const p = this.players[Number(playerId)];
        if (!p) return;
        if (this.phase === 'title' || this.phase === 'dead' || this.phase === 'won') {
            if (this._t >= this.phaseReadyAt) this.startRun(playerId);
            return;
        }
        if (this.phase !== 'playing' || !p.alive) return;
        this.forgeWord(p, word);
    }

    // ---- simulation ----

    tick() {
        this._t++;
        let changed = false;

        if (this.phase === 'playing') {
            changed = this.tickPlaying() || changed;
        }

        // Spark FX always tick so bursts finish on menus too.
        changed = this.tickSparks() || changed;

        if (this.forgeFlashUntil && this._t >= this.forgeFlashUntil) {
            this.forgeFlashUntil = 0;
            this.setText(this.forgeFlash, '');
            changed = true;
        }

        if (changed || this.dirty) {
            this.base.node.onStateChange();
            this.dirty = false;
        }
    }

    tickPlaying() {
        let changed = false;

        // Flood rises after a short grace period.
        if (this._t >= this.floodStartsAt) {
            this.floodY -= TUNING.FLOOD.risePerSecond * DT;
            this.drawFlood();
            this.setText(this.floodText, 'FLOOD');
        } else {
            const left = Math.ceil((this.floodStartsAt - this._t) / TICK_RATE);
            this.setText(this.floodText, `FLOOD IN ${left}s`);
        }
        changed = true;

        // Expire platforms.
        for (const slot of this.platforms) {
            if (!slot.active) continue;
            const left = slot.expiresAt - this._t;
            if (left <= 0) {
                this.deactivatePlatform(slot);
                changed = true;
                continue;
            }
            // Fade via color alpha in the last 3 seconds.
            const fadeTicks = ticksFor(3);
            if (left < fadeTicks) {
                const a = clampByte(255 * (left / fadeTicks));
                slot.node.node.color = [255, 255, 255, a];
                changed = true;
            }
        }

        const living = [];
        for (const pid of Object.keys(this.players)) {
            const p = this.players[pid];
            if (!p.alive) continue;
            this.integratePlayer(p);
            this.placePlayer(p);
            living.push(p);
            changed = true;

            // Flood contact (feet in water).
            if (p.y + TUNING.PLAYER.h >= this.floodY) {
                p.alive = false;
                this.hidePlayer(p);
                this.burst(p.x + TUNING.PLAYER.w / 2, p.y + TUNING.PLAYER.h / 2, FLOOD_FILL);
            } else if (p.y <= TUNING.FLOOD.winAboveY) {
                this.endRun(true);
                return true;
            }
        }

        if (!living.length && Object.keys(this.players).length) {
            this.endRun(false);
            return true;
        }

        this.refreshBufferHud();
        return changed;
    }

    integratePlayer(p) {
        p.vx = p.moveX * TUNING.PLAYER.speedPerSecond;
        p.vy += TUNING.PLAYER.gravityPerSecond2 * DT;
        p.vy = Math.min(p.vy, TUNING.PLAYER.maxFallPerSecond);

        let nx = p.x + p.vx * DT;
        let ny = p.y + p.vy * DT;
        nx = clamp(nx, 0, 100 - TUNING.PLAYER.w);

        p.onGround = false;

        // Ground.
        if (ny + TUNING.PLAYER.h >= this.groundY && p.vy >= 0) {
            ny = this.groundY - TUNING.PLAYER.h;
            p.vy = 0;
            p.onGround = true;
        }

        // Platforms (AABB feet check).
        const feetY = ny + TUNING.PLAYER.h;
        const prevFeet = p.y + TUNING.PLAYER.h;
        for (const slot of this.platforms) {
            if (!slot.active) continue;

            if (slot.kind === 'wall') {
                // Simple side blockers.
                const overlapsY = ny + TUNING.PLAYER.h > slot.y && ny < slot.y + slot.h;
                if (!overlapsY) continue;
                const right = p.x + TUNING.PLAYER.w;
                if (p.vx > 0 && right <= slot.x + 0.2 && right + p.vx * DT >= slot.x) {
                    nx = slot.x - TUNING.PLAYER.w;
                } else if (p.vx < 0 && p.x >= slot.x + slot.w - 0.2 && p.x + p.vx * DT <= slot.x + slot.w) {
                    nx = slot.x + slot.w;
                }
                continue;
            }

            if (slot.kind === 'ramp' && slot.verts) {
                const rampTop = faceRampTop(slot, nx + TUNING.PLAYER.w / 2);
                if (
                    nx + TUNING.PLAYER.w > slot.x && nx < slot.x + slot.w &&
                    p.vy >= 0 && prevFeet <= rampTop + 0.6 && feetY >= rampTop
                ) {
                    ny = rampTop - TUNING.PLAYER.h;
                    p.vy = 0;
                    p.onGround = true;
                }
                continue;
            }

            // Flat platforms / steps / boosts: land on top when falling through.
            if (
                nx + TUNING.PLAYER.w > slot.x && nx < slot.x + slot.w &&
                p.vy >= 0 &&
                prevFeet <= slot.y + 0.8 &&
                feetY >= slot.y
            ) {
                ny = slot.y - TUNING.PLAYER.h;
                p.vy = 0;
                p.onGround = true;
                if (slot.bounce) {
                    p.vy = -TUNING.PLAYER.jumpSpeedPerSecond * 1.35;
                    p.onGround = false;
                    this.burst(slot.x + slot.w / 2, slot.y, ACCENT);
                }
            }
        }

        p.x = nx;
        p.y = clamp(ny, 0, 100 - TUNING.PLAYER.h);
    }

    placePlayer(p) {
        if (!p.alive) {
            this.hidePlayer(p);
            return;
        }
        p.body.node.coordinates2d = ShapeUtils.rectangle(p.x, p.y, TUNING.PLAYER.w, TUNING.PLAYER.h);
        p.body.node.fill = p.color;
        p.you.node.text = {
            text: 'YOU',
            x: p.x + TUNING.PLAYER.w / 2,
            y: p.y - 2.2,
            size: 1.1,
            align: 'center',
            font: 'monospace',
            color: p.color
        };
    }

    hidePlayer(p) {
        p.body.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        p.body.node.fill = [0, 0, 0, 0];
        p.you.node.text = { ...p.you.node.text, text: '' };
    }

    drawFlood() {
        const y = clamp(this.floodY, 0, 100);
        this.flood.node.coordinates2d = ShapeUtils.rectangle(0, y, 100, Math.max(0.01, 100 - y));
        this.flood.node.fill = FLOOD_FILL;
    }

    // ---- FX ----

    burst(x, y, fill) {
        let n = 10;
        for (const s of this.sparks) {
            if (n <= 0) break;
            if (s.active) continue;
            n--;
            s.active = true;
            s.x = x;
            s.y = y;
            const ang = Math.random() * Math.PI * 2;
            const spd = 18 + Math.random() * 28;
            s.vx = Math.cos(ang) * spd;
            s.vy = Math.sin(ang) * spd;
            s.life = 0.35 + Math.random() * 0.25;
            s.max = s.life;
            s.fill = fill;
        }
    }

    tickSparks() {
        let changed = false;
        for (const s of this.sparks) {
            if (!s.active) continue;
            changed = true;
            s.life -= DT;
            if (s.life <= 0) {
                s.active = false;
                s.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                s.node.node.fill = [0, 0, 0, 0];
                s.node.node.color = [255, 255, 255, 0];
                continue;
            }
            s.x += s.vx * DT;
            s.y += s.vy * DT;
            s.vy += 40 * DT;
            const k = s.life / s.max;
            s.node.node.coordinates2d = ShapeUtils.rectangle(s.x, s.y, 0.7, 0.7);
            s.node.node.fill = [s.fill[0], s.fill[1], s.fill[2], 255];
            s.node.node.color = [255, 255, 255, clampByte(255 * k)];
        }
        return changed;
    }
}

function faceRampTop(slot, px) {
    // Interpolate the top edge of the ramp triangle between the two non-base points.
    // verts are [lowLeft-ish, high, base corner...] depending on facing.
    const a = slot.verts[0];
    const b = slot.verts[1];
    const t = clamp((px - Math.min(a[0], b[0])) / Math.max(0.001, Math.abs(b[0] - a[0])), 0, 1);
    return a[1] + (b[1] - a[1]) * (a[0] <= b[0] ? t : 1 - t);
}

module.exports = WordForge;
