const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');

const TICK_RATE = 15;

const MAX_PLAYERS = 8;

const PALETTE = [
    { name: 'CORAL', color: [255, 111, 97, 255] },
    { name: 'TEAL', color: [64, 224, 208, 255] },
    { name: 'AMBER', color: [255, 191, 0, 255] },
    { name: 'LAVENDER', color: [181, 126, 220, 255] },
    { name: 'MINT', color: [152, 255, 152, 255] },
    { name: 'PINK', color: [255, 105, 180, 255] },
    { name: 'SKY', color: [135, 206, 250, 255] },
    { name: 'LIME', color: [190, 255, 80, 255] }
];

const STROOP_COLORS = [
    { name: 'RED', color: [235, 70, 70, 255] },
    { name: 'BLUE', color: [80, 130, 255, 255] },
    { name: 'GREEN', color: [80, 220, 120, 255] },
    { name: 'YELLOW', color: [250, 220, 70, 255] }
];

// Retro arcade theme: deep CRT teal with hot yellow/orange accents
const BG = [7, 42, 46, 255];
const CARD = [13, 64, 68, 255];
const ACCENT = [255, 205, 60, 255];
const HOT = [255, 150, 40, 255];
const INK = [235, 250, 245, 255];
const FAINT = [115, 170, 165, 255];
const GOLD = [255, 210, 90, 255];

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });
const light = (color, f) => [
    Math.round(color[0] + (255 - color[0]) * f),
    Math.round(color[1] + (255 - color[1]) * f),
    Math.round(color[2] + (255 - color[2]) * f),
    255
];

const shuffled = (list) => {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

const GAMES = [
    { key: 'odd', title: 'ODD ONE OUT', hint: 'TAP THE TILE THAT DOES NOT MATCH' },
    { key: 'draw', title: 'QUICK DRAW', hint: 'WAIT FOR GREEN... THEN TAP FAST' },
    { key: 'stroop', title: 'MIND GAMES', hint: 'TAP THE INK COLOR - NOT THE WORD' },
    { key: 'memory', title: 'ECHO', hint: 'WATCH THE PATTERN - REPEAT IT' },
    { key: 'count', title: 'FLASH COUNT', hint: 'COUNT THE TRIANGLES - THEY VANISH' }
];

class MicroMayhem extends Game {
    static metadata() {
        return {
            aspectRatio: { x: 1, y: 1 },
            squishVersion: '142',
            services: ['multiplayer'],
            author: 'Joseph Garcia',
            name: 'Micro Mayhem',
            description: 'A rapid-fire gauntlet of 15-second minigames: odd-one-out, quick draw, mind games, memory, and more. Fastest fingers take the podium.',
            tickRate: TICK_RATE
        };
    }

    constructor() {
        super();

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: BG
        });

        this.scoreStrip = this.makeContainer();
        this.arena = this.makeContainer();
        this.confettiLayer = this.makeContainer();
        this.flashLayer = this.makeContainer();
        this.base.addChildren(this.scoreStrip, this.arena, this.confettiLayer, this.flashLayer);

        this.players = {};
        this.playerColors = {};
        this.joined = [];
        this.pendingJoins = [];
        this.scores = {};
        this.transients = [];
        this.confetti = [];
        this.tickCount = 0;

        this.showLobby();
    }

    makeContainer() {
        // Zero-size rect: full-screen containers swallow clicks for everything
        // drawn beneath them (the server hit-test picks the topmost containing
        // node whether or not it is clickable).
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
    }

    makeGlowText(text, x, y, size, color, glowColor, playerIds) {
        const gc = glowColor || color;
        const offsets = [[-0.25, 0], [0.25, 0], [0, -0.25], [0, 0.25]];
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

    makeButton(label, x, y, w, h, color, onClick, playerIds, size) {
        const textSize = size || 2.4;
        const button = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill: CARD,
            color,
            border: 8,
            effects: glow(color, 8),
            onClick,
            playerIds
        });
        button.addChild(new GameNode.Text({
            textInfo: { x: x + w / 2, y: y + (h - textSize) / 2, text: label, size: textSize, align: 'center', font: 'monospace', color },
            playerIds
        }), false);
        return button;
    }

    setNodePlayerIds(node, playerIds) {
        node.node.playerIds = playerIds;
        node.node.children.forEach(child => this.setNodePlayerIds(child, playerIds));
    }

    addTransient(nodes, ticks, playerless) {
        nodes.forEach(n => this.flashLayer.addChild(n, false));
        this.transients.push({ nodes, ticks });
    }

    playerName(playerId) {
        return String((this.players[playerId] && this.players[playerId].name) || ('PLAYER ' + playerId)).toUpperCase().slice(0, 8);
    }

    colorOf(playerId) {
        return this.playerColors[playerId] || PALETTE[0];
    }

    // --- lobby ---

    showLobby() {
        this.phase = 'lobby';
        this.joined = this.joined.filter(pid => this.players[pid]);
        this.arena.clearChildren();
        this.confettiLayer.clearChildren();
        this.confetti = [];
        this.renderScoreStrip();

        const title = this.makeGlowText('MICRO MAYHEM', 50, 12, 6, INK, HOT);
        this.titleHalos = title.slice(0, 4);
        title.forEach(n => this.arena.addChild(n, false));

        this.arena.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 21, text: '5 TINY GAMES - FASTEST FINGERS WIN', size: 2, align: 'center', font: 'monospace', color: FAINT }
        }), false);

        this.lobbyRow = this.makeContainer();
        this.arena.addChild(this.lobbyRow, false);

        this.joinButton = this.makeButton('JOIN', 20, 58, 60, 8, ACCENT, (playerId) => {
            if (this.phase !== 'lobby' || this.joined.indexOf(playerId) >= 0 || this.joined.length >= MAX_PLAYERS) {
                return;
            }
            this.joined.push(playerId);
            const used = new Set(Object.values(this.playerColors).map(c => c.name));
            this.playerColors[playerId] = PALETTE.find(c => !used.has(c.name)) || PALETTE[0];
            this.updateLobbyUi();
        });
        this.startButton = this.makeButton('START', 20, 69, 60, 8, [190, 255, 80, 255], (playerId) => {
            if (this.phase !== 'lobby' || this.joined.indexOf(playerId) < 0) {
                return;
            }
            this.startGauntlet();
        });
        this.arena.addChildren(this.joinButton, this.startButton);

        this.arena.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 82, text: 'PLAYS GREAT SOLO OR WITH A CROWD - TAPS ONLY', size: 1.5, align: 'center', font: 'monospace', color: FAINT }
        }), false);

        this.updateLobbyUi();
    }

    updateLobbyUi() {
        if (this.phase !== 'lobby') {
            return;
        }
        this.lobbyRow.clearChildren();
        if (this.joined.length === 0) {
            this.lobbyRow.addChild(new GameNode.Text({
                textInfo: { x: 50, y: 40, text: 'TAP JOIN TO GET IN', size: 2, align: 'center', font: 'monospace', color: FAINT }
            }), false);
        } else {
            this.joined.forEach((pid, i) => {
                const col = i % 4;
                const row = Math.floor(i / 4);
                const x = 14 + col * 20;
                const y = 36 + row * 9;
                const c = this.colorOf(pid);
                this.lobbyRow.addChild(new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(x, y, 4, 4),
                    fill: c.color,
                    color: [255, 255, 255, 255],
                    effects: glow(c.color, 8)
                }), false);
                this.lobbyRow.addChild(new GameNode.Text({
                    textInfo: { x: x + 2, y: y + 5, text: this.playerName(pid), size: 1.4, align: 'center', font: 'monospace', color: INK }
                }), false);
                this.lobbyRow.addChild(new GameNode.Text({
                    textInfo: { x: x + 2, y: y + 7, text: 'YOU', size: 1.2, align: 'center', font: 'monospace', color: GOLD },
                    playerIds: [pid]
                }), false);
            });
        }

        const connected = Object.keys(this.players).map(Number);
        const unjoined = connected.filter(pid => this.joined.indexOf(pid) === -1);
        this.setNodePlayerIds(this.joinButton, unjoined.length ? unjoined : [0]);
        this.setNodePlayerIds(this.startButton, this.joined.length ? this.joined.slice() : [0]);
        this.base.node.onStateChange();
    }

    // --- gauntlet flow ---

    startGauntlet() {
        this.pendingJoins.forEach(pid => {
            if (this.players[pid] && this.joined.indexOf(pid) === -1 && this.joined.length < MAX_PLAYERS) {
                this.joined.push(pid);
                const used = new Set(Object.values(this.playerColors).map(c => c.name));
                this.playerColors[pid] = PALETTE.find(c => !used.has(c.name)) || PALETTE[0];
            }
        });
        this.pendingJoins = [];
        this.joined = this.joined.filter(pid => this.players[pid]);
        if (!this.joined.length) {
            this.showLobby();
            return;
        }

        this.scores = {};
        this.joined.forEach(pid => {
            this.scores[pid] = 0;
        });
        this.gauntlet = shuffled(GAMES);
        this.stageIndex = -1;
        this.nextStage();
    }

    nextStage() {
        this.stageIndex++;
        if (this.stageIndex >= this.gauntlet.length) {
            this.showPodium();
            return;
        }
        this.phase = 'intro';
        this.stageTicks = Math.round(2.2 * TICK_RATE);
        this.renderScoreStrip();
        this.arena.clearChildren();

        const spec = this.gauntlet[this.stageIndex];
        this.arena.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 26, text: 'GAME ' + (this.stageIndex + 1) + '/' + this.gauntlet.length, size: 2, align: 'center', font: 'monospace', color: FAINT }
        }), false);
        this.makeGlowText(spec.title, 50, 36, 5, INK, HOT)
            .forEach(n => this.arena.addChild(n, false));
        this.arena.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 50, text: spec.hint, size: 2, align: 'center', font: 'monospace', color: GOLD }
        }), false);
        this.base.node.onStateChange();
    }

    startPlay() {
        this.phase = 'play';
        this.arena.clearChildren();
        this.arrivals = 0;
        const key = this.gauntlet[this.stageIndex].key;
        if (key === 'odd') {
            this.setupOdd();
        } else if (key === 'draw') {
            this.setupDraw();
        } else if (key === 'stroop') {
            this.setupStroop();
        } else if (key === 'memory') {
            this.setupMemory();
        } else {
            this.setupCount();
        }
        this.base.node.onStateChange();
    }

    endStage(delaySeconds) {
        this.phase = 'stageScore';
        this.stageTicks = Math.round((delaySeconds || 2) * TICK_RATE);
        this.renderScoreStrip();
    }

    addScore(playerId, points, label) {
        this.scores[playerId] = (this.scores[playerId] || 0) + points;
        const c = this.colorOf(playerId);
        const text = (points >= 0 ? '+' : '') + points + (label ? ' ' + label : '');
        this.addTransient(this.makeGlowText(text, 50, 14, 2.2, points >= 0 ? light(c.color, 0.3) : [255, 110, 110, 255], c.color, [playerId]), TICK_RATE);
        this.renderScoreStrip();
    }

    awardArrival(playerId, label) {
        this.arrivals++;
        const points = Math.max(1, 4 - this.arrivals);
        this.addScore(playerId, points, label);
        return points;
    }

    renderScoreStrip() {
        this.scoreStrip.clearChildren();
        if (this.phase === 'lobby') {
            return;
        }
        this.joined.forEach((pid, i) => {
            const x = 2 + i * 12.2;
            const c = this.colorOf(pid);
            this.scoreStrip.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, 2, 1.8, 1.8),
                fill: c.color,
                color: [255, 255, 255, 255]
            }), false);
            this.scoreStrip.addChild(new GameNode.Text({
                textInfo: { x: x + 2.6, y: 1.6, text: this.playerName(pid).slice(0, 6), size: 1.2, font: 'monospace', color: INK }
            }), false);
            this.scoreStrip.addChild(new GameNode.Text({
                textInfo: { x: x + 2.6, y: 3.6, text: String(this.scores[pid] || 0), size: 1.5, font: 'monospace', color: GOLD }
            }), false);
            // frameless sessions have no chrome showing your name, so each
            // player gets a private marker on their own entry
            this.scoreStrip.addChild(new GameNode.Text({
                textInfo: { x: x + 5.4, y: 3.8, text: 'YOU', size: 1, font: 'monospace', color: GOLD },
                playerIds: [pid]
            }), false);
        });
    }

    // --- minigame: odd one out ---

    setupOdd() {
        this.oddBoard = 0;
        this.startOddBoard();
    }

    startOddBoard() {
        this.oddBoard++;
        this.oddAnswered = new Set();
        this.arrivals = 0;
        this.stageTicks = 6 * TICK_RATE;
        this.arena.clearChildren();

        this.arena.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 9, text: 'BOARD ' + this.oddBoard + '/3 - TAP THE ODD TILE', size: 1.8, align: 'center', font: 'monospace', color: FAINT }
        }), false);

        const base = [40 + Math.floor(Math.random() * 160), 40 + Math.floor(Math.random() * 160), 40 + Math.floor(Math.random() * 160), 255];
        const delta = [26, 18, 12][this.oddBoard - 1];
        const shift = Math.random() < 0.5 ? delta : -delta;
        const channel = Math.floor(Math.random() * 3);
        const odd = base.slice();
        odd[channel] = Math.max(15, Math.min(240, odd[channel] + shift));

        const size = 5;
        const oddIndex = Math.floor(Math.random() * size * size);
        const cell = 13;
        const gap = 1.6;
        const x0 = 50 - (size * cell + (size - 1) * gap) / 2;
        const y0 = 16;

        for (let i = 0; i < size * size; i++) {
            const col = i % size;
            const row = Math.floor(i / size);
            const isOdd = i === oddIndex;
            this.arena.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x0 + col * (cell + gap), y0 + row * (cell + gap), cell, cell),
                fill: isOdd ? odd : base,
                color: [255, 255, 255, 255],
                onClick: (playerId) => this.handleOddTap(playerId, isOdd)
            }), false);
        }
    }

    handleOddTap(playerId, isOdd) {
        if (this.phase !== 'play' || this.joined.indexOf(playerId) < 0 || this.oddAnswered.has(playerId)) {
            return;
        }
        this.oddAnswered.add(playerId);
        if (isOdd) {
            this.awardArrival(playerId);
        } else {
            this.addScore(playerId, -1, 'WRONG TILE');
        }
        if (this.oddAnswered.size >= this.joined.length) {
            this.advanceOdd();
        }
        this.base.node.onStateChange();
    }

    advanceOdd() {
        if (this.oddBoard >= 3) {
            this.endStage();
        } else {
            this.startOddBoard();
        }
    }

    // --- minigame: quick draw ---

    setupDraw() {
        this.drawState = 'wait';
        this.drawLocked = new Set();
        this.drawDone = new Set();
        this.stageTicks = Math.round((1.5 + Math.random() * 3) * TICK_RATE);

        this.drawPanel = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(10, 14, 80, 74),
            fill: [120, 40, 50, 255],
            color: [255, 255, 255, 255],
            onClick: (playerId) => this.handleDrawTap(playerId)
        });
        this.drawText = new GameNode.Text({
            textInfo: { x: 50, y: 47, text: 'WAIT FOR IT...', size: 4, align: 'center', font: 'monospace', color: INK }
        });
        this.arena.addChildren(this.drawPanel, this.drawText);
    }

    handleDrawTap(playerId) {
        if (this.phase !== 'play' || this.joined.indexOf(playerId) < 0 ||
            this.drawLocked.has(playerId) || this.drawDone.has(playerId)) {
            return;
        }
        if (this.drawState === 'wait') {
            this.drawLocked.add(playerId);
            this.addScore(playerId, -1, 'TOO SOON');
        } else {
            this.drawDone.add(playerId);
            this.awardArrival(playerId);
        }
        const everyone = this.joined.filter(pid => !this.drawLocked.has(pid));
        if (this.drawState === 'go' && everyone.every(pid => this.drawDone.has(pid))) {
            this.endStage();
        }
        this.base.node.onStateChange();
    }

    // --- minigame: stroop ---

    setupStroop() {
        this.stroopPrompt = 0;
        this.startStroopPrompt();
    }

    startStroopPrompt() {
        this.stroopPrompt++;
        this.stroopAnswered = new Set();
        this.arrivals = 0;
        this.stageTicks = 5 * TICK_RATE;
        this.arena.clearChildren();

        const word = STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
        let ink = STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
        if (Math.random() < 0.75) {
            while (ink.name === word.name) {
                ink = STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
            }
        }
        this.stroopInk = ink.name;

        this.arena.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 10, text: this.stroopPrompt + '/4 - TAP THE INK COLOR', size: 1.8, align: 'center', font: 'monospace', color: FAINT }
        }), false);
        this.makeGlowText(word.name, 50, 25, 8, ink.color)
            .forEach(n => this.arena.addChild(n, false));

        shuffled(STROOP_COLORS).forEach((option, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const x = 12 + col * 40;
            const y = 48 + row * 16;
            const button = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, y, 36, 12),
                fill: option.color,
                color: [255, 255, 255, 255],
                onClick: (playerId) => this.handleStroopTap(playerId, option.name)
            });
            this.arena.addChild(button, false);
        });
    }

    handleStroopTap(playerId, colorName) {
        if (this.phase !== 'play' || this.joined.indexOf(playerId) < 0 || this.stroopAnswered.has(playerId)) {
            return;
        }
        this.stroopAnswered.add(playerId);
        if (colorName === this.stroopInk) {
            this.awardArrival(playerId);
        } else {
            this.addScore(playerId, -1, 'THE WORD LIED');
        }
        if (this.stroopAnswered.size >= this.joined.length) {
            this.advanceStroop();
        }
        this.base.node.onStateChange();
    }

    advanceStroop() {
        if (this.stroopPrompt >= 4) {
            this.endStage();
        } else {
            this.startStroopPrompt();
        }
    }

    // --- minigame: memory ---

    setupMemory() {
        this.memorySequence = [];
        for (let i = 0; i < 5; i++) {
            this.memorySequence.push(Math.floor(Math.random() * 4));
        }
        this.memoryShown = 0;
        this.memoryState = 'show';
        this.memoryProgress = {};
        this.memoryLocked = new Set();
        this.memoryDone = new Set();
        this.stageTicks = Math.round(0.8 * TICK_RATE);

        this.arena.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 9, text: 'WATCH THE PATTERN', size: 2, align: 'center', font: 'monospace', color: FAINT }
        }), false);
        this.memoryStatus = new GameNode.Text({
            textInfo: { x: 50, y: 90, text: '', size: 1.8, align: 'center', font: 'monospace', color: GOLD }
        });
        this.arena.addChild(this.memoryStatus, false);

        const tileColors = [PALETTE[0].color, PALETTE[1].color, PALETTE[2].color, PALETTE[3].color];
        this.memoryTiles = [];
        for (let i = 0; i < 4; i++) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const x = 15 + col * 37;
            const y = 16 + row * 37;
            const tile = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, y, 33, 33),
                fill: [tileColors[i][0] * 0.35, tileColors[i][1] * 0.35, tileColors[i][2] * 0.35, 255].map(Math.round),
                color: [255, 255, 255, 255],
                onClick: (playerId) => this.handleMemoryTap(playerId, i)
            });
            tile._baseColor = tileColors[i];
            this.memoryTiles.push(tile);
            this.arena.addChild(tile, false);
        }
    }

    litTile(index, on) {
        const tile = this.memoryTiles[index];
        const c = tile._baseColor;
        tile.node.fill = on ? light(c, 0.25) : [Math.round(c[0] * 0.35), Math.round(c[1] * 0.35), Math.round(c[2] * 0.35), 255];
        tile.node.effects = on ? glow(c, 16) : null;
    }

    handleMemoryTap(playerId, tileIndex) {
        if (this.phase !== 'play' || this.memoryState !== 'input' || this.joined.indexOf(playerId) < 0 ||
            this.memoryLocked.has(playerId) || this.memoryDone.has(playerId)) {
            return;
        }
        const progress = this.memoryProgress[playerId] || 0;
        if (this.memorySequence[progress] === tileIndex) {
            this.memoryProgress[playerId] = progress + 1;
            if (this.memoryProgress[playerId] >= this.memorySequence.length) {
                this.memoryDone.add(playerId);
                this.awardArrival(playerId, 'PERFECT ECHO');
            } else {
                this.addTransient(this.makeGlowText(String(this.memoryProgress[playerId]), 50, 47, 3, INK, null, [playerId]), Math.round(TICK_RATE / 2));
            }
        } else {
            this.memoryLocked.add(playerId);
            this.addScore(playerId, -1, 'LOST THE ECHO');
        }
        const active = this.joined.filter(pid => !this.memoryLocked.has(pid));
        if (active.every(pid => this.memoryDone.has(pid))) {
            this.endStage();
        }
        this.base.node.onStateChange();
    }

    // --- minigame: flash count ---

    setupCount() {
        this.countState = 'show';
        this.countAnswered = new Set();
        this.stageTicks = Math.round(2.6 * TICK_RATE);
        this.countTarget = 5 + Math.floor(Math.random() * 8);

        this.arena.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 8, text: 'COUNT THE TRIANGLES', size: 2, align: 'center', font: 'monospace', color: FAINT }
        }), false);

        const decoys = 8 + Math.floor(Math.random() * 8);
        const shapes = [];
        for (let i = 0; i < this.countTarget; i++) {
            shapes.push(true);
        }
        for (let i = 0; i < decoys; i++) {
            shapes.push(false);
        }
        shuffled(shapes).forEach(isTriangle => {
            const x = 8 + Math.random() * 80;
            const y = 15 + Math.random() * 68;
            const s = 4 + Math.random() * 3;
            const c = PALETTE[Math.floor(Math.random() * PALETTE.length)].color;
            const coordinates = isTriangle
                ? [[x, y + s], [x + s / 2, y], [x + s, y + s], [x, y + s]]
                : ShapeUtils.rectangle(x, y, s, s);
            this.arena.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: coordinates,
                fill: c,
                color: [255, 255, 255, 255]
            }), false);
        });
    }

    showCountQuestion() {
        this.countState = 'ask';
        this.stageTicks = 6 * TICK_RATE;
        this.arena.clearChildren();
        this.arrivals = 0;

        this.makeGlowText('HOW MANY TRIANGLES?', 50, 22, 3.2, INK, [255, 191, 0, 255])
            .forEach(n => this.arena.addChild(n, false));

        const answers = new Set([this.countTarget]);
        while (answers.size < 4) {
            const offset = Math.ceil(Math.random() * 3) * (Math.random() < 0.5 ? -1 : 1);
            const candidate = this.countTarget + offset;
            if (candidate > 0) {
                answers.add(candidate);
            }
        }
        shuffled(Array.from(answers)).forEach((value, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const x = 14 + col * 40;
            const y = 40 + row * 16;
            this.arena.addChild(this.makeButton(String(value), x, y, 32, 12, [64, 224, 208, 255], (playerId) => {
                if (this.phase !== 'play' || this.countState !== 'ask' ||
                    this.joined.indexOf(playerId) < 0 || this.countAnswered.has(playerId)) {
                    return;
                }
                this.countAnswered.add(playerId);
                if (value === this.countTarget) {
                    this.awardArrival(playerId, 'SHARP EYES');
                } else {
                    this.addScore(playerId, -1, 'IT WAS ' + this.countTarget);
                }
                if (this.countAnswered.size >= this.joined.length) {
                    this.endStage();
                }
            }, null, 3.2), false);
        });
        this.base.node.onStateChange();
    }

    // --- podium ---

    showPodium() {
        this.phase = 'podium';
        this.arena.clearChildren();
        this.renderScoreStrip();

        const standings = this.joined.slice().sort((a, b) => (this.scores[b] || 0) - (this.scores[a] || 0));
        const winner = standings[0];

        this.makeGlowText('FINAL PODIUM', 50, 10, 4, INK, GOLD)
            .forEach(n => this.arena.addChild(n, false));

        const heights = [26, 18, 12];
        const slots = [{ x: 38, rank: 0 }, { x: 14, rank: 1 }, { x: 62, rank: 2 }];
        slots.forEach(slot => {
            const pid = standings[slot.rank];
            if (pid === undefined) {
                return;
            }
            const c = this.colorOf(pid);
            const h = heights[slot.rank];
            this.arena.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(slot.x, 62 - h, 24, h),
                fill: CARD,
                color: c.color,
                border: 6,
                effects: glow(c.color, slot.rank === 0 ? 16 : 6)
            }), false);
            this.arena.addChild(new GameNode.Text({
                textInfo: { x: slot.x + 12, y: 64 - h - 6.5, text: this.playerName(pid), size: 1.8, align: 'center', font: 'monospace', color: c.color }
            }), false);
            this.arena.addChild(new GameNode.Text({
                textInfo: { x: slot.x + 12, y: 64 - h - 3.4, text: (slot.rank + 1) + (['ST', 'ND', 'RD'][slot.rank]) + ' - ' + (this.scores[pid] || 0), size: 1.6, align: 'center', font: 'monospace', color: GOLD }
            }), false);
        });

        standings.slice(3).forEach((pid, i) => {
            this.arena.addChild(new GameNode.Text({
                textInfo: { x: 50, y: 68 + i * 3, text: (i + 4) + 'TH ' + this.playerName(pid) + ' - ' + (this.scores[pid] || 0), size: 1.5, align: 'center', font: 'monospace', color: FAINT }
            }), false);
        });

        this.arena.addChild(this.makeButton('PLAY AGAIN', 25, 84, 50, 8, ACCENT, (playerId) => {
            if (this.phase === 'podium' && this.joined.indexOf(playerId) >= 0) {
                this.startGauntlet();
            }
        }), false);

        if (winner !== undefined) {
            const winColor = this.colorOf(winner).color;
            for (let i = 0; i < 36; i++) {
                const color = Math.random() < 0.5 ? winColor : PALETTE[Math.floor(Math.random() * PALETTE.length)].color;
                const piece = {
                    x: 5 + Math.random() * 90,
                    y: -2 - Math.random() * 10,
                    vx: (Math.random() - 0.5) * 0.7,
                    vy: 0.4 + Math.random() * 0.8,
                    w: 0.9 + Math.random() * 0.8,
                    color
                };
                piece.node = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(piece.x, Math.max(0, piece.y), piece.w, piece.w),
                    fill: color,
                    color: [color[0], color[1], color[2], 255]
                });
                this.confetti.push(piece);
                this.confettiLayer.addChild(piece.node, false);
            }
        }
        this.base.node.onStateChange();
    }

    // --- simulation ---

    tick() {
        this.tickCount++;

        if (this.phase === 'lobby' && this.titleHalos) {
            const alpha = 110 + Math.round(60 * Math.sin(this.tickCount / 4));
            this.titleHalos.forEach(halo => {
                halo.node.text.color = [HOT[0], HOT[1], HOT[2], alpha];
            });
        } else if (this.phase === 'intro') {
            if (--this.stageTicks <= 0) {
                this.startPlay();
            }
        } else if (this.phase === 'stageScore') {
            if (--this.stageTicks <= 0) {
                this.nextStage();
            }
        } else if (this.phase === 'podium') {
            this.updateConfetti();
        } else if (this.phase === 'play') {
            this.tickMinigame();
        }

        this.updateTransients();
        this.base.node.onStateChange();
    }

    tickMinigame() {
        const key = this.gauntlet[this.stageIndex].key;
        this.stageTicks--;

        if (key === 'odd') {
            if (this.stageTicks <= 0) {
                this.advanceOdd();
            }
        } else if (key === 'draw') {
            if (this.drawState === 'wait' && this.stageTicks <= 0) {
                this.drawState = 'go';
                this.stageTicks = 3 * TICK_RATE;
                this.drawPanel.node.fill = [60, 190, 90, 255];
                this.drawPanel.node.effects = glow([80, 220, 120, 255], 20);
                this.drawText.node.text.text = 'TAP NOW!';
            } else if (this.drawState === 'go' && this.stageTicks <= 0) {
                this.endStage();
            }
        } else if (key === 'stroop') {
            if (this.stageTicks <= 0) {
                this.advanceStroop();
            }
        } else if (key === 'memory') {
            this.tickMemory();
        } else if (key === 'count') {
            if (this.countState === 'show' && this.stageTicks <= 0) {
                this.showCountQuestion();
            } else if (this.countState === 'ask' && this.stageTicks <= 0) {
                this.endStage();
            }
        }
    }

    tickMemory() {
        if (this.memoryState === 'show') {
            if (this.stageTicks <= 0) {
                if (this.memoryLit !== undefined && this.memoryLit !== null) {
                    this.litTile(this.memoryLit, false);
                    this.memoryLit = null;
                    this.stageTicks = Math.round(0.25 * TICK_RATE);
                    if (this.memoryShown >= this.memorySequence.length) {
                        this.memoryState = 'input';
                        this.stageTicks = 12 * TICK_RATE;
                        this.memoryStatus.node.text.text = 'YOUR TURN - REPEAT THE PATTERN';
                    }
                } else {
                    this.memoryLit = this.memorySequence[this.memoryShown];
                    this.memoryShown++;
                    this.litTile(this.memoryLit, true);
                    this.stageTicks = Math.round(0.55 * TICK_RATE);
                }
            }
        } else if (this.memoryState === 'input' && this.stageTicks <= 0) {
            this.endStage();
        }
    }

    updateConfetti() {
        for (let i = this.confetti.length - 1; i >= 0; i--) {
            const p = this.confetti[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.03;
            if (p.y > 101 || p.x < -2 || p.x > 102) {
                this.confettiLayer.removeChild(p.node.id, false);
                this.confetti.splice(i, 1);
            } else {
                p.node.node.coordinates2d = ShapeUtils.rectangle(Math.max(0, Math.min(98, p.x)), Math.max(0, p.y), p.w, p.w);
            }
        }
    }

    updateTransients() {
        for (let i = this.transients.length - 1; i >= 0; i--) {
            const t = this.transients[i];
            t.ticks--;
            if (t.ticks <= 0) {
                t.nodes.forEach(n => this.flashLayer.removeChild(n.id, false));
                this.transients.splice(i, 1);
            }
        }
    }

    // --- platform hooks ---

    handleNewPlayer({ playerId, info }) {
        this.players[playerId] = { name: (info && info.name) || ('PLAYER ' + playerId) };
        if (this.phase === 'lobby') {
            this.updateLobbyUi();
        } else if (this.joined.indexOf(playerId) === -1 && this.pendingJoins.indexOf(playerId) === -1) {
            this.pendingJoins.push(playerId);
            this.addTransient(this.makeGlowText('YOU ARE IN THE NEXT GAUNTLET', 50, 60, 2, INK, ACCENT, [playerId]), 3 * TICK_RATE);
            this.base.node.onStateChange();
        }
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
        delete this.playerColors[playerId];
        delete this.scores[playerId];
        this.pendingJoins = this.pendingJoins.filter(pid => pid !== playerId);
        this.joined = this.joined.filter(pid => pid !== playerId);

        if (Object.keys(this.players).length === 0 || this.joined.length === 0) {
            this.showLobby();
            return;
        }

        if (this.phase === 'lobby') {
            this.updateLobbyUi();
        } else {
            this.renderScoreStrip();
            this.base.node.onStateChange();
        }
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = MicroMayhem;
