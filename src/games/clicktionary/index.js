const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');
const WORDS = require('./words');

const TICK_RATE = 10;
const MAX_PLAYERS = 8;

const PICK_SECONDS = 15;
const DRAW_SECONDS = 75;
const REVEAL_SECONDS = 6;
const INK_MAX = 450;

// Text height in y-units at 16:9 (text size is relative to canvas width)
const TEXT_H = (size) => size * 16 / 9;

// Warm paper-and-crayon palette
const BG = [244, 238, 224, 255];
const NAVY = [45, 50, 70, 255];
const CORAL = [255, 111, 97, 255];
const FAINT = [150, 145, 130, 255];
const PAPER_WHITE = [252, 252, 250, 255];
const GOOD = [60, 160, 90, 255];
const CARD = [236, 228, 210, 255];

const PALETTE = [
    [40, 45, 65, 255],     // ink navy
    [225, 70, 60, 255],    // red
    [60, 110, 230, 255],   // blue
    [70, 170, 90, 255],    // green
    [245, 150, 50, 255],   // orange
    [150, 90, 200, 255]    // purple
];

const BRUSH_SIZES = { S: 0.7, M: 1.3, L: 2.4 };

// Canvas bounds
const CANVAS = { x: 15, y: 11, w: 70, h: 78 };

const shuffled = (list) => {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

const levenshtein = (a, b) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return dp[a.length][b.length];
};

class Clicktionary extends Game {
    static metadata() {
        return {
            aspectRatio: { x: 16, y: 9 },
            description: 'Take turns drawing while everyone else races to guess the word. Fast guesses score big - the artist scores when you do.',
            author: 'Joseph Garcia',
            thumbnail: '4b5f169186bc542e14b5d001d25ce6bb',
            squishVersion: '142',
            services: ['multiplayer'],
            name: 'Clicktionary',
            maxPlayers: MAX_PLAYERS,
            tickRate: TICK_RATE
        };
    }

    constructor() {
        super();

        this._t = 0;
        this.dirty = false;
        this.phase = 'lobby';
        this.players = {};
        this.drawQueue = [];
        this.roundIdx = 0;
        this.drawerId = null;
        this.word = null;
        this.choices = [];
        this.usedWords = new Set();
        this.correct = new Set();
        this.feed = [];
        this.pending = [];
        this.inkUsed = 0;
        this.brush = { color: 0, size: 'M' };
        this.pickDeadline = 0;
        this.drawDeadline = 0;
        this.revealDeadline = 0;
        this.hintAt = [];
        this.hintIdx = 0;
        this.revealed = new Set();
        this.toastUntil = {};
        this.lobbyMsg = null;
        this.lastReveal = null;
        this.canvas = null;
        this.blanksNode = null;
        this.wordNode = null;
        this.inkNode = null;
        this.bubbles = [];
        this.bubbleTint = 0;

        this.base = this.rect(0, 0, 100, 100, BG);

        this.roundLabel = this.text('', 1, 2, 1.4, NAVY);
        this.drawerLine = this.text('', 1, 6, 1.1, FAINT);
        this.timerNode = this.text('', 92.5, 1.5, 3.4, CORAL, 'center');

        this.wordLayer = this.container();
        this.canvasLayer = this.container();
        this.bubblesLayer = this.container();
        this.sideLayer = this.container();
        this.centerLayer = this.container();
        this.playerLayer = this.container();

        this.base.addChildren(
            this.roundLabel, this.drawerLine, this.timerNode,
            this.wordLayer, this.canvasLayer, this.bubblesLayer,
            this.sideLayer, this.centerLayer, this.playerLayer
        );

        this.refresh();
    }

    getLayers() {
        return [{ root: this.base }];
    }

    canAddPlayer() {
        return Object.keys(this.players).length < MAX_PLAYERS;
    }

    // ---- node helpers ----

    container() {
        // Zero-size so the container can never swallow clicks
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

    setText(node, str) {
        node.node.text = { ...node.node.text, text: str };
    }

    makeButton({ x, y, w, h, label, size, fill, textColor, onClick }) {
        const bg = this.rect(x, y, w, h, fill, { border: 4, color: NAVY, onClick });
        bg.addChild(this.text(label, x + w / 2, y + (h - TEXT_H(size)) / 2, size, textColor || PAPER_WHITE, 'center'));
        return bg;
    }

    // ---- player lifecycle ----

    handleNewPlayer({ playerId, info }) {
        const pid = Number(playerId);
        if (this.players[pid] || Object.keys(this.players).length >= MAX_PLAYERS) {
            return;
        }
        const name = ((info && info.name) || `PLAYER ${pid}`).toUpperCase().slice(0, 10);
        // Scoped root doubles as the privacy anchor so the word stays secret
        const root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds: [pid]
        });
        this.players[pid] = { name, score: 0, root, toastNode: null };
        this.playerLayer.addChild(root);
        this.updateWordNodes();
        this.refresh();
    }

    handlePlayerDisconnect(playerId) {
        const pid = Number(playerId);
        const p = this.players[pid];
        if (!p) {
            return;
        }
        this.playerLayer.removeChild(p.root.node.id);
        delete this.players[pid];
        delete this.toastUntil[pid];
        this.correct.delete(pid);
        const inGame = this.phase !== 'lobby' && this.phase !== 'podium';
        if (inGame && Object.keys(this.players).length < 2) {
            return this.abortToLobby('GAME ENDED - NOT ENOUGH PLAYERS');
        }
        if (pid === this.drawerId) {
            if (this.phase === 'picking') {
                return this.nextRound();
            }
            if (this.phase === 'drawing') {
                return this.endDrawing('THE ARTIST VANISHED');
            }
        }
        if (this.phase === 'drawing') {
            this.checkAllGuessed();
        }
        this.updateWordNodes();
        this.refresh();
    }

    // ---- game flow ----

    startGame(pid) {
        if (this.phase !== 'lobby' || !this.players[pid]) {
            return;
        }
        const ids = Object.keys(this.players).map(Number);
        if (ids.length < 2) {
            return;
        }
        Object.values(this.players).forEach(p => {
            p.score = 0;
        });
        const order = shuffled(ids);
        const cycles = ids.length <= 5 ? 2 : 1;
        this.drawQueue = [];
        for (let c = 0; c < cycles; c++) {
            this.drawQueue.push(...order);
        }
        this.usedWords = new Set();
        this.lobbyMsg = null;
        this.roundIdx = 0;
        this.startRound();
    }

    startRound() {
        this.drawerId = this.drawQueue[this.roundIdx];
        this.phase = 'picking';
        this.word = null;
        this.choices = this.pickChoices();
        this.correct = new Set();
        this.feed = [];
        this.pending = [];
        this.inkUsed = 0;
        this.revealed = new Set();
        this.brush = { color: 0, size: 'M' };
        this.pickDeadline = this._t + PICK_SECONDS * TICK_RATE;
        this.canvas = null;
        this.inkNode = null;
        this.canvasLayer.clearChildren();
        this.wordLayer.clearChildren();
        this.clearBubbles();
        this.blanksNode = null;
        this.wordNode = null;
        this.refresh();
    }

    pickChoices() {
        const available = WORDS.filter(w => !this.usedWords.has(w));
        const pool = available.length >= 3 ? available : WORDS;
        return shuffled(pool).slice(0, 3);
    }

    pickWord(pid, choiceIdx) {
        if (this.phase !== 'picking' || pid !== this.drawerId) {
            return;
        }
        this.word = this.choices[choiceIdx % this.choices.length];
        this.usedWords.add(this.word);
        this.phase = 'drawing';
        this.drawDeadline = this._t + DRAW_SECONDS * TICK_RATE;
        this.hintAt = [this._t + 370, this._t + 560];
        this.hintIdx = 0;

        this.canvas = this.rect(CANVAS.x, CANVAS.y, CANVAS.w, CANVAS.h, PAPER_WHITE, {
            border: 3, color: NAVY,
            onClick: (playerId, x, y) => this.drawDot(Number(playerId), x, y)
        });
        this.canvasLayer.addChild(this.canvas);

        this.blanksNode = new GameNode.Text({
            textInfo: { text: '', x: 50, y: 2.5, size: 2.2, align: 'center', font: 'monospace', color: NAVY },
            playerIds: [0]
        });
        this.wordNode = new GameNode.Text({
            textInfo: { text: `DRAW: ${this.word.toUpperCase()}`, x: 50, y: 2.5, size: 2.2, align: 'center', font: 'monospace', color: CORAL },
            playerIds: [this.drawerId]
        });
        this.wordLayer.addChildren(this.blanksNode, this.wordNode);
        this.updateWordNodes();
        this.refresh();
    }

    endDrawing(reason) {
        if (this.phase !== 'drawing') {
            return;
        }
        this.phase = 'reveal';
        this.revealDeadline = this._t + REVEAL_SECONDS * TICK_RATE;
        const guessers = Object.keys(this.players).map(Number).filter(pid => pid !== this.drawerId);
        this.lastReveal = {
            word: this.word,
            got: this.correct.size,
            of: guessers.length,
            reason
        };
        if (this.blanksNode) {
            this.blanksNode.node.playerIds = [0];
        }
        if (this.wordNode) {
            this.wordNode.node.playerIds = [0];
        }
        this.refresh();
    }

    nextRound() {
        this.roundIdx++;
        while (this.roundIdx < this.drawQueue.length && !this.players[this.drawQueue[this.roundIdx]]) {
            this.roundIdx++;
        }
        if (this.roundIdx >= this.drawQueue.length) {
            this.phase = 'podium';
            this.canvasLayer.clearChildren();
            this.wordLayer.clearChildren();
            this.clearBubbles();
            this.blanksNode = null;
            this.wordNode = null;
            this.refresh();
        } else {
            this.startRound();
        }
    }

    playAgain(pid) {
        if (this.phase !== 'podium' || !this.players[pid]) {
            return;
        }
        this.abortToLobby(null);
    }

    abortToLobby(msg) {
        this.phase = 'lobby';
        this.lobbyMsg = msg;
        this.word = null;
        this.canvas = null;
        this.blanksNode = null;
        this.wordNode = null;
        this.canvasLayer.clearChildren();
        this.wordLayer.clearChildren();
        this.clearBubbles();
        this.refresh();
    }

    // ---- drawing ----

    drawDot(pid, x, y) {
        if (this.phase !== 'drawing' || pid !== this.drawerId) {
            return;
        }
        if (this.inkUsed >= INK_MAX) {
            return this.toastFor(pid, 'OUT OF INK - HIT CLEAR');
        }
        const w = BRUSH_SIZES[this.brush.size];
        const h = w * 16 / 9;
        const cx = Math.max(CANVAS.x + 0.3 + w / 2, Math.min(CANVAS.x + CANVAS.w - 0.3 - w / 2, x));
        const cy = Math.max(CANVAS.y + 0.3 + h / 2, Math.min(CANVAS.y + CANVAS.h - 0.3 - h / 2, y));
        this.pending.push({ x: cx - w / 2, y: cy - h / 2, w, h, color: PALETTE[this.brush.color] });
        this.inkUsed++;
    }

    clearCanvas(pid) {
        if (this.phase !== 'drawing' || pid !== this.drawerId || !this.canvas) {
            return;
        }
        this.canvas.clearChildren();
        this.pending = [];
        this.inkUsed = 0;
        if (this.inkNode) {
            this.setText(this.inkNode, `INK ${INK_MAX}`);
            this.dirty = true;
        }
    }

    setBrush(pid, patch) {
        if (this.phase !== 'drawing' || pid !== this.drawerId) {
            return;
        }
        this.brush = { ...this.brush, ...patch };
        this.rebuildPlayerRoot(pid);
    }

    // ---- guessing ----

    submitGuess(pid, value) {
        if (this.phase !== 'drawing' || pid === this.drawerId || !this.players[pid] || this.correct.has(pid)) {
            return;
        }
        const guess = (value || '').toString().trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 24);
        if (!guess) {
            return;
        }
        const hit = guess === this.word || (this.word.length >= 5 && guess.includes(this.word));
        if (hit) {
            this.correct.add(pid);
            const secLeft = Math.max(0, Math.ceil((this.drawDeadline - this._t) / TICK_RATE));
            const pts = 100 + secLeft;
            this.players[pid].score += pts;
            if (this.players[this.drawerId]) {
                this.players[this.drawerId].score += 40;
            }
            this.toastFor(pid, `CORRECT! +${pts}`);
            this.pushFeed(this.players[pid].name, 'GOT IT!', true);
            this.spawnBubble(`${this.players[pid].name} GOT IT!`, GOOD);
            this.updateWordNodes();
            this.rebuildPlayerRoot(pid);
            this.rebuildSide();
            this.checkAllGuessed();
        } else if (levenshtein(guess, this.word) <= (this.word.length >= 6 ? 2 : 1)) {
            // Near-misses stay private so the feed doesn't spoil the word
            this.toastFor(pid, 'SO CLOSE!');
        } else {
            this.pushFeed(this.players[pid].name, guess.toUpperCase(), false);
            this.spawnBubble(`${this.players[pid].name.slice(0, 8)}: ${guess.slice(0, 14).toUpperCase()}`);
            this.rebuildSide();
        }
    }

    checkAllGuessed() {
        if (this.phase !== 'drawing') {
            return;
        }
        const guessers = Object.keys(this.players).map(Number).filter(pid => pid !== this.drawerId);
        if (guessers.length && guessers.every(pid => this.correct.has(pid))) {
            this.endDrawing('EVERYONE GOT IT');
        }
    }

    pushFeed(name, text, good) {
        this.feed.push({ name, text, good });
        if (this.feed.length > 8) {
            this.feed.shift();
        }
    }

    // Floating guess callouts over the canvas. Text nodes only - a Shape
    // bubble would swallow the drawer's clicks underneath it.
    spawnBubble(label, color) {
        while (this.bubbles.length >= 6) {
            const old = this.bubbles.shift();
            this.bubblesLayer.removeChild(old.node.node.id);
        }
        const x = 25 + Math.random() * 50;
        const y = 25 + Math.random() * 48;
        const tint = color || PALETTE[this.bubbleTint++ % PALETTE.length];
        const node = this.text(label, x, y, 1.5, tint, 'center');
        this.bubblesLayer.addChild(node);
        this.bubbles.push({ node, y, until: this._t + 30 });
    }

    clearBubbles() {
        this.bubbles = [];
        this.bubblesLayer.clearChildren();
    }

    toastFor(pid, msg) {
        const p = this.players[pid];
        if (p && p.toastNode) {
            this.setText(p.toastNode, msg);
            this.toastUntil[pid] = this._t + 25;
            this.dirty = true;
        }
    }

    // ---- word visibility / hints ----

    blanksText() {
        return this.word.split('').map((c, i) => {
            if (c === ' ') return ' ';
            return this.revealed.has(i) ? c.toUpperCase() : '_';
        }).join(' ');
    }

    updateWordNodes() {
        if (!this.blanksNode || this.phase !== 'drawing') {
            return;
        }
        const guessers = Object.keys(this.players).map(Number).filter(pid => pid !== this.drawerId);
        const inTheDark = guessers.filter(pid => !this.correct.has(pid));
        // Empty playerIds means visible to EVERYONE - hide with [0] instead
        this.blanksNode.node.playerIds = inTheDark.length ? inTheDark : [0];
        this.blanksNode.node.text = { ...this.blanksNode.node.text, text: this.blanksText() };
        this.wordNode.node.playerIds = [this.drawerId, ...this.correct];
        this.dirty = true;
    }

    revealHint() {
        if (this.word.length < 4) {
            return;
        }
        const hidden = this.word.split('').map((c, i) => (c !== ' ' && !this.revealed.has(i) ? i : null)).filter(i => i !== null);
        if (hidden.length <= 2) {
            return;
        }
        this.revealed.add(hidden[Math.floor(Math.random() * hidden.length)]);
        this.updateWordNodes();
    }

    // ---- game loop ----

    tick() {
        this._t++;
        if (this.phase === 'picking' && this._t >= this.pickDeadline) {
            this.pickWord(this.drawerId, Math.floor(Math.random() * 3));
        }
        if (this.phase === 'drawing') {
            if (this._t >= this.drawDeadline) {
                this.endDrawing('TIME!');
            } else {
                const sec = Math.ceil((this.drawDeadline - this._t) / TICK_RATE);
                const timerText = String(sec);
                if (this.timerNode.node.text.text !== timerText) {
                    this.setText(this.timerNode, timerText);
                    this.dirty = true;
                }
                if (this.hintIdx < this.hintAt.length && this._t >= this.hintAt[this.hintIdx]) {
                    this.hintIdx++;
                    this.revealHint();
                }
                if (this.pending.length && this.canvas) {
                    const nodes = this.pending.map(d => this.rect(d.x, d.y, d.w, d.h, d.color));
                    this.canvas.addChildren(...nodes);
                    this.pending = [];
                    if (this.inkNode) {
                        this.setText(this.inkNode, `INK ${Math.max(0, INK_MAX - this.inkUsed)}`);
                    }
                }
            }
        }
        if (this.phase === 'reveal' && this._t >= this.revealDeadline) {
            this.nextRound();
        }
        if (this.bubbles.length) {
            const alive = [];
            this.bubbles.forEach(b => {
                if (this._t >= b.until) {
                    this.bubblesLayer.removeChild(b.node.node.id);
                } else {
                    b.y -= 0.08;
                    b.node.node.text = { ...b.node.node.text, y: b.y };
                    alive.push(b);
                }
            });
            this.bubbles = alive;
            this.dirty = true;
        }
        Object.keys(this.toastUntil).forEach(pid => {
            if (this._t >= this.toastUntil[pid]) {
                delete this.toastUntil[pid];
                const p = this.players[pid];
                if (p && p.toastNode) {
                    this.setText(p.toastNode, '');
                    this.dirty = true;
                }
            }
        });
        if (this.dirty) {
            this.dirty = false;
            this.base.node.onStateChange();
        }
    }

    // ---- views ----

    refresh() {
        this.updateTop();
        this.rebuildSide();
        this.rebuildCenter();
        Object.keys(this.players).forEach(pid => this.rebuildPlayerRoot(Number(pid)));
        this.base.node.onStateChange();
    }

    updateTop() {
        const inGame = this.phase !== 'lobby' && this.phase !== 'podium';
        this.setText(this.roundLabel, inGame ? `ROUND ${Math.min(this.roundIdx + 1, this.drawQueue.length)}/${this.drawQueue.length}` : '');
        const dName = (this.players[this.drawerId] || {}).name;
        let line = '';
        if (dName && this.phase === 'picking') line = `${dName} IS PICKING A WORD...`;
        if (dName && this.phase === 'drawing') line = `${dName} IS DRAWING`;
        this.setText(this.drawerLine, line);
        if (this.phase !== 'drawing') {
            this.setText(this.timerNode, '');
        }
    }

    rebuildSide() {
        this.sideLayer.clearChildren();
        if (this.phase === 'lobby' || this.phase === 'podium') {
            return;
        }
        this.sideLayer.addChild(this.text('SCORES', 1, 12, 1.1, FAINT));
        const ids = Object.keys(this.players).map(Number);
        ids.sort((a, b) => this.players[b].score - this.players[a].score);
        ids.forEach((pid, i) => {
            const p = this.players[pid];
            const marker = pid === this.drawerId ? '* ' : this.correct.has(pid) ? '+ ' : '  ';
            const color = pid === this.drawerId ? CORAL : this.correct.has(pid) ? GOOD : NAVY;
            const y = 15.5 + i * 5.2;
            this.sideLayer.addChild(this.text(`${marker}${p.name.slice(0, 8)}`, 1, y, 0.95, color));
            this.sideLayer.addChild(this.text(String(p.score), 3.2, y + 2.1, 0.95, FAINT));
        });
        this.sideLayer.addChild(this.text('GUESSES', 86.5, 12, 1.1, FAINT));
        this.feed.slice().reverse().forEach((entry, i) => {
            const label = entry.good ? `${entry.name} +` : `${entry.name}:`;
            this.sideLayer.addChild(this.text(label, 86.5, 15.5 + i * 6, 0.9, entry.good ? GOOD : FAINT));
            this.sideLayer.addChild(this.text(entry.text.slice(0, 14), 86.5, 15.5 + i * 6 + 2.2, 0.95, entry.good ? GOOD : NAVY));
        });
    }

    rebuildCenter() {
        this.centerLayer.clearChildren();
        if (this.phase === 'lobby') {
            this.buildLobbyCenter();
        } else if (this.phase === 'picking') {
            this.centerLayer.addChild(this.rect(20, 38, 60, 18, CARD, { border: 4, color: NAVY }));
            this.centerLayer.addChild(this.text(
                `${(this.players[this.drawerId] || {}).name || '...'} IS PICKING A WORD`,
                50, 44, 1.8, NAVY, 'center'
            ));
            this.centerLayer.addChild(this.text('GET YOUR GUESSING FINGERS READY', 50, 49.5, 1.1, FAINT, 'center'));
        } else if (this.phase === 'reveal' && this.lastReveal) {
            const r = this.lastReveal;
            this.centerLayer.addChild(this.rect(20, 34, 60, 24, CARD, { border: 4, color: CORAL }));
            this.centerLayer.addChild(this.text('THE WORD WAS', 50, 37.5, 1.3, FAINT, 'center'));
            this.centerLayer.addChild(this.text(r.word.toUpperCase(), 50, 41.5, 3, CORAL, 'center'));
            this.centerLayer.addChild(this.text(
                r.reason === 'EVERYONE GOT IT' || r.reason === 'TIME!'
                    ? `${r.got}/${r.of} GUESSED IT`
                    : r.reason,
                50, 50, 1.4, NAVY, 'center'
            ));
        } else if (this.phase === 'podium') {
            this.buildPodiumCenter();
        }
    }

    buildLobbyCenter() {
        const s = this.centerLayer;
        s.addChild(this.text('CLICKTIONARY', 50.4, 10.4, 4.5, [0, 0, 0, 120], 'center'));
        s.addChild(this.text('CLICKTIONARY', 50, 10, 4.5, CORAL, 'center'));
        s.addChild(this.text('TAKE TURNS DRAWING. EVERYONE ELSE RACES TO GUESS.', 50, 22, 1.3, NAVY, 'center'));
        s.addChild(this.text('FAST GUESSES SCORE BIG. THE ARTIST SCORES WHEN YOU DO.', 50, 26, 1.15, FAINT, 'center'));
        if (this.lobbyMsg) {
            s.addChild(this.text(this.lobbyMsg, 50, 31, 1.3, CORAL, 'center'));
        }
        const ids = Object.keys(this.players).map(Number);
        s.addChild(this.text(`PLAYERS (${ids.length}/${MAX_PLAYERS})`, 38, 38, 1.2, FAINT));
        ids.forEach((pid, i) => {
            s.addChild(this.text(this.players[pid].name, 38, 43 + i * 4, 1.35, NAVY));
        });
        if (ids.length >= 2) {
            s.addChild(this.makeButton({
                x: 40, y: 80, w: 20, h: 8, label: 'START', size: 1.7, fill: CORAL,
                onClick: (playerId) => this.startGame(Number(playerId))
            }));
        } else {
            s.addChild(this.text('NEED AT LEAST 2 PLAYERS', 50, 83, 1.25, FAINT, 'center'));
        }
    }

    buildPodiumCenter() {
        const s = this.centerLayer;
        const ids = Object.keys(this.players).map(Number)
            .sort((a, b) => this.players[b].score - this.players[a].score);
        s.addChild(this.text('FINAL SCORES', 50, 12, 3, CORAL, 'center'));
        ids.forEach((pid, i) => {
            const p = this.players[pid];
            const size = i === 0 ? 2.2 : 1.5;
            const y = i === 0 ? 26 : 33 + i * 5;
            s.addChild(this.text(
                `${i + 1}. ${p.name}  ${p.score}`,
                50, y, size, i === 0 ? NAVY : FAINT, 'center'
            ));
        });
        s.addChild(this.makeButton({
            x: 37, y: 80, w: 26, h: 8, label: 'PLAY AGAIN', size: 1.6, fill: CORAL,
            onClick: (playerId) => this.playAgain(Number(playerId))
        }));
    }

    rebuildPlayerRoot(pid) {
        const p = this.players[pid];
        if (!p) {
            return;
        }
        p.root.clearChildren();
        p.toastNode = null;
        if (this.phase === 'lobby') {
            const ids = Object.keys(this.players).map(Number);
            p.root.addChild(this.text('< YOU', 58, 43 + ids.indexOf(pid) * 4, 1.2, CORAL));
            return;
        }
        if (this.phase === 'picking' && pid === this.drawerId) {
            p.root.addChild(this.text('PICK A WORD TO DRAW', 50, 60, 1.5, NAVY, 'center'));
            this.choices.forEach((w, i) => {
                p.root.addChild(this.makeButton({
                    x: 20 + i * 21, y: 65, w: 19, h: 8, label: w.toUpperCase(), size: 1.2, fill: NAVY,
                    onClick: (playerId) => this.pickWord(Number(playerId), i)
                }));
            });
            return;
        }
        if (this.phase !== 'drawing') {
            return;
        }
        p.toastNode = this.text('', 50, 96.5, 1.2, GOOD, 'center');
        p.root.addChild(p.toastNode);
        if (pid === this.drawerId) {
            this.buildPaletteFor(p.root);
        } else if (this.correct.has(pid)) {
            p.root.addChild(this.text('YOU GOT IT! ENJOY THE SHOW.', 50, 92, 1.4, GOOD, 'center'));
        } else {
            const guessBox = this.rect(35, 90, 30, 6.5, PAPER_WHITE, {
                border: 4, color: NAVY,
                input: {
                    type: 'text',
                    oninput: (playerId, value) => this.submitGuess(Number(playerId), value)
                }
            });
            guessBox.addChild(this.text('TAP TO GUESS', 50, 90 + (6.5 - TEXT_H(1.4)) / 2, 1.4, NAVY, 'center'));
            p.root.addChild(guessBox);
        }
    }

    buildPaletteFor(root) {
        PALETTE.forEach((color, i) => {
            const selected = this.brush.color === i;
            root.addChild(this.rect(16 + i * 4.4, 90.5, 3.4, 6, color, {
                border: selected ? 8 : 3,
                color: selected ? CORAL : [70, 70, 70, 255],
                onClick: (playerId) => this.setBrush(Number(playerId), { color: i })
            }));
        });
        Object.keys(BRUSH_SIZES).forEach((key, i) => {
            const selected = this.brush.size === key;
            root.addChild(this.makeButton({
                x: 45 + i * 5.5, y: 90.5, w: 4.8, h: 6, label: key, size: 1.2,
                fill: selected ? CORAL : NAVY,
                onClick: (playerId) => this.setBrush(Number(playerId), { size: key })
            }));
        });
        root.addChild(this.makeButton({
            x: 63.5, y: 90.5, w: 9, h: 6, label: 'CLEAR', size: 1.1, fill: [140, 70, 60, 255],
            onClick: (playerId) => this.clearCanvas(Number(playerId))
        }));
        this.inkNode = this.text(`INK ${Math.max(0, INK_MAX - this.inkUsed)}`, 75, 92.5, 1, FAINT);
        root.addChild(this.inkNode);
    }
}

module.exports = Clicktionary;
