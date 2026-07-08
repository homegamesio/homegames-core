const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');
const WORD_BANK = require('./words');

const TICK_RATE = 8;

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 8;
const DISCUSS_TICKS = 90 * TICK_RATE;
const GUESS_TICKS = 30 * TICK_RATE;

// Portrait canvas: coordinates are 0-100 on both axes but text size scales with
// canvas WIDTH, so a size-s line is roughly s * (9/16) tall in y units.
const TEXT_H = 9 / 16;

// Light theme: warm cream "party card game" look — the one bright game in the
// catalog, so player colors are deepened to stay readable on the pale background.
const PALETTE = [
    { name: 'CORAL', color: [230, 75, 60, 255] },
    { name: 'TEAL', color: [0, 150, 136, 255] },
    { name: 'AMBER', color: [225, 145, 10, 255] },
    { name: 'LAVENDER', color: [125, 85, 200, 255] },
    { name: 'MINT', color: [45, 165, 90, 255] },
    { name: 'PINK', color: [215, 55, 130, 255] },
    { name: 'SKY', color: [40, 120, 210, 255] },
    { name: 'LIME', color: [120, 160, 10, 255] }
];

const BG = [243, 236, 221, 255];
const CARD = [255, 252, 244, 255];
const INK = [45, 42, 66, 255];
const FAINT = [125, 118, 145, 255];
const GOLD = [200, 148, 22, 255];

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });
const lerpColor = (a, b, t) => [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
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

class Imposter extends Game {
    static metadata() {
        return {
            aspectRatio: { x: 9, y: 16 },
            squishVersion: '142',
            services: ['multiplayer'],
            author: 'Joseph Garcia',
            name: 'Imposter',
            description: 'A phone-first party game. Everyone sees the secret word except one imposter. Talk it out, vote, and catch the faker before they blend in.',
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

        this.screen = this.makeContainer();
        this.confettiLayer = this.makeContainer();
        this.flashLayer = this.makeContainer();
        // Privacy anchors: a player with no nodes scoped to them receives the
        // UNFILTERED state (including the secret-word highlight), so every
        // connected player gets a persistent zero-size scoped node.
        this.anchorLayer = this.makeContainer();
        this.anchors = {};
        this.base.addChildren(this.screen, this.confettiLayer, this.flashLayer, this.anchorLayer);

        this.players = {};
        this.playerColors = {};
        this.scores = {};
        this.joined = [];
        this.pendingJoins = [];
        this.participants = [];
        this.transients = [];
        this.confetti = [];
        this.roundNumber = 0;
        this.lastCategory = null;
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

    // --- shared UI helpers ---

    makeGlowText(text, x, y, size, color, glowColor, playerIds) {
        const gc = glowColor || color;
        const offsets = [[-0.3, 0], [0.3, 0], [0, -0.2], [0, 0.2]];
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

    centeredTextY(y, h, size) {
        return y + (h - size * TEXT_H) / 2;
    }

    makeButton(label, x, y, w, h, color, onClick, playerIds) {
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
            textInfo: { x: x + w / 2, y: this.centeredTextY(y, h, 2.6), text: label, size: 2.6, align: 'center', font: 'monospace', color },
            playerIds
        }), false);
        return button;
    }

    setNodePlayerIds(node, playerIds) {
        node.node.playerIds = playerIds;
        node.node.children.forEach(child => this.setNodePlayerIds(child, playerIds));
    }

    addFlash(text, ticks, playerIds, color) {
        const nodes = this.makeGlowText(text, 50, 47, 2.6, color || INK, color || [0, 150, 136, 255], playerIds);
        nodes.forEach(n => this.flashLayer.addChild(n, false));
        this.transients.push({ nodes, ticks });
        this.base.node.onStateChange();
    }

    playerName(playerId) {
        return String((this.players[playerId] && this.players[playerId].name) || ('PLAYER ' + playerId)).toUpperCase().slice(0, 10);
    }

    colorOf(playerId) {
        return this.playerColors[playerId] || PALETTE[0];
    }

    assignColor(playerId) {
        const used = new Set(Object.values(this.playerColors).map(c => c.name));
        this.playerColors[playerId] = PALETTE.find(c => !used.has(c.name)) || PALETTE[0];
    }

    // --- lobby ---

    showLobby() {
        this.phase = 'lobby';
        this.joined = this.joined.filter(pid => this.players[pid]);
        this.renderLobby();
    }

    renderLobby() {
        this.screen.clearChildren();
        this.confettiLayer.clearChildren();
        this.confetti = [];

        const title = this.makeGlowText('IMPOSTER', 50, 8, 6.5, INK, [215, 55, 130, 255]);
        this.titleHalos = title.slice(0, 4);
        title.forEach(n => this.screen.addChild(n, false));

        this.screen.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 14, text: 'ONE OF YOU IS FAKING IT', size: 1.9, align: 'center', font: 'monospace', color: FAINT }
        }), false);

        const howTo = [
            'EVERYONE SEES THE SECRET WORD',
            'EXCEPT THE IMPOSTER',
            'SAY ONE CLUE OUT LOUD EACH',
            'THEN VOTE OUT THE FAKER'
        ];
        howTo.forEach((line, i) => this.screen.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 20 + i * 3.2, text: line, size: 1.7, align: 'center', font: 'monospace', color: [120, 112, 140, 255] }
        }), false));

        this.lobbyRow = this.makeContainer();
        this.screen.addChild(this.lobbyRow, false);

        this.joinButton = this.makeButton('JOIN', 20, 62, 60, 7, [0, 150, 136, 255], (playerId) => {
            if (this.phase !== 'lobby' || this.joined.indexOf(playerId) >= 0 || this.joined.length >= MAX_PLAYERS) {
                return;
            }
            this.joined.push(playerId);
            this.assignColor(playerId);
            if (this.scores[playerId] === undefined) {
                this.scores[playerId] = 0;
            }
            this.updateLobbyUi();
        });

        this.startButton = this.makeButton('START', 20, 72, 60, 7, [120, 160, 10, 255], (playerId) => {
            if (this.phase !== 'lobby' || this.joined.indexOf(playerId) < 0) {
                return;
            }
            if (this.joined.length < MIN_PLAYERS) {
                this.addFlash('NEED ' + MIN_PLAYERS + ' PLAYERS TO START', 3 * TICK_RATE, [playerId], GOLD);
                return;
            }
            this.startRound();
        });

        this.screen.addChildren(this.joinButton, this.startButton);

        this.screen.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 83, text: MIN_PLAYERS + ' TO ' + MAX_PLAYERS + ' PLAYERS - PHONES UP', size: 1.5, align: 'center', font: 'monospace', color: FAINT }
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
                textInfo: { x: 50, y: 45, text: 'NOBODY IN YET - TAP JOIN', size: 1.7, align: 'center', font: 'monospace', color: FAINT }
            }), false);
        } else {
            this.joined.forEach((pid, i) => {
                const col = i % 2;
                const row = Math.floor(i / 2);
                const x = 8 + col * 46;
                const y = 36 + row * 5.6;
                const c = this.colorOf(pid);
                this.lobbyRow.addChild(new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(x, y, 3.4, 3.4 * TEXT_H * 3.2),
                    fill: c.color,
                    color: [255, 255, 255, 255],
                    effects: glow(c.color, 8)
                }), false);
                this.lobbyRow.addChild(new GameNode.Text({
                    textInfo: { x: x + 5, y: y + 0.3, text: this.playerName(pid), size: 1.8, font: 'monospace', color: INK }
                }), false);
                this.lobbyRow.addChild(new GameNode.Text({
                    textInfo: { x: x + 5, y: y + 2.6, text: '★ ' + (this.scores[pid] || 0), size: 1.4, font: 'monospace', color: GOLD }
                }), false);
                // frameless sessions have no chrome showing your name, so each
                // player gets a private marker on their own entry
                this.lobbyRow.addChild(new GameNode.Text({
                    textInfo: { x: x + 24, y: y + 0.4, text: 'YOU', size: 1.4, font: 'monospace', color: GOLD },
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

    // --- round setup ---

    startRound() {
        this.pendingJoins.forEach(pid => {
            if (this.players[pid] && this.joined.indexOf(pid) === -1) {
                this.joined.push(pid);
                this.assignColor(pid);
                if (this.scores[pid] === undefined) {
                    this.scores[pid] = 0;
                }
            }
        });
        this.pendingJoins = [];
        this.joined = this.joined.filter(pid => this.players[pid]);

        if (this.joined.length < MIN_PLAYERS) {
            this.showLobby();
            return;
        }

        this.participants = this.joined.slice(0, MAX_PLAYERS);
        this.roundNumber++;

        const options = WORD_BANK.filter(c => c.category !== this.lastCategory);
        const pick = options[Math.floor(Math.random() * options.length)];
        this.lastCategory = pick.category;
        this.category = pick.category;
        this.gridWords = shuffled(pick.words).slice(0, 16);
        this.secretIndex = Math.floor(Math.random() * 16);
        this.imposterId = this.participants[Math.floor(Math.random() * this.participants.length)];

        this.ready = new Set();
        this.votes = {};
        this.voteMarks = {};
        this.speakingOrder = shuffled(this.participants);

        this.phase = 'reveal';
        this.renderReveal();
    }

    crewIds() {
        return this.participants.filter(pid => pid !== this.imposterId);
    }

    renderHeader() {
        this.screen.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 3, text: 'ROUND ' + this.roundNumber + ' - ' + this.category, size: 2, align: 'center', font: 'monospace', color: GOLD }
        }), false);
    }

    renderWordGrid(y0, highlightPlayerIds, onCellTap) {
        const cellW = 22.6;
        const cellH = 6.4;
        const gapX = 0.9;
        const gapY = 1.1;
        const x0 = 50 - (cellW * 4 + gapX * 3) / 2;

        this.guessCells = {};

        this.gridWords.forEach((word, i) => {
            const col = i % 4;
            const row = Math.floor(i / 4);
            const x = x0 + col * (cellW + gapX);
            const y = y0 + row * (cellH + gapY);

            const cell = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, y, cellW, cellH),
                fill: CARD,
                color: [175, 165, 145, 255],
                border: 3,
                onClick: onCellTap ? (playerId) => onCellTap(playerId, i) : undefined
            });
            const size = word.length > 9 ? 1.4 : 1.8;
            cell.addChild(new GameNode.Text({
                textInfo: { x: x + cellW / 2, y: this.centeredTextY(y, cellH, size), text: word, size, align: 'center', font: 'monospace', color: INK }
            }), false);
            this.screen.addChild(cell, false);
            this.guessCells[word] = cell;

            if (highlightPlayerIds && i === this.secretIndex) {
                this.highlightNode = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(x - 0.5, y - 0.4, cellW + 1, cellH + 0.8),
                    color: GOLD,
                    border: 8,
                    effects: glow(GOLD, 12),
                    playerIds: highlightPlayerIds
                });
                this.screen.addChild(this.highlightNode, false);
            }
        });

        return y0 + 4 * cellH + 3 * gapY;
    }

    // --- reveal phase ---

    renderReveal() {
        this.screen.clearChildren();
        this.renderHeader();

        const crew = this.crewIds();

        this.makeGlowText('YOU KNOW THE WORD', 50, 8, 2.8, [35, 150, 80, 255], null, crew)
            .forEach(n => this.screen.addChild(n, false));
        this.screen.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 12, text: 'IT GLOWS GOLD BELOW - KEEP IT SECRET', size: 1.6, align: 'center', font: 'monospace', color: FAINT, },
            playerIds: crew
        }), false);

        this.makeGlowText('YOU ARE THE IMPOSTER', 50, 8, 2.8, [215, 60, 45, 255], null, [this.imposterId])
            .forEach(n => this.screen.addChild(n, false));
        this.screen.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 12, text: 'NO WORD FOR YOU - BLEND IN', size: 1.6, align: 'center', font: 'monospace', color: FAINT },
            playerIds: [this.imposterId]
        }), false);

        this.renderWordGrid(17, crew, null);

        this.readyButton = this.makeButton('GOT IT', 20, 52, 60, 7, [0, 150, 136, 255], (playerId) => this.markReady(playerId),
            this.participants.slice());
        this.screen.addChild(this.readyButton, false);

        this.readyProgress = new GameNode.Text({
            textInfo: { x: 50, y: 61, text: 'READY 0/' + this.participants.length, size: 1.7, align: 'center', font: 'monospace', color: FAINT }
        });
        this.screen.addChild(this.readyProgress, false);

        this.base.node.onStateChange();
    }

    markReady(playerId) {
        if (this.phase !== 'reveal' || this.participants.indexOf(playerId) < 0) {
            return;
        }
        this.ready.add(playerId);
        this.readyProgress.node.text.text = 'READY ' + this.ready.size + '/' + this.participants.length;
        const waiting = this.participants.filter(pid => !this.ready.has(pid));
        this.setNodePlayerIds(this.readyButton, waiting.length ? waiting : [0]);
        if (waiting.length === 0) {
            this.startDiscuss();
        }
        this.base.node.onStateChange();
    }

    // --- discuss phase ---

    startDiscuss() {
        this.phase = 'discuss';
        this.discussTicksLeft = DISCUSS_TICKS;
        this.renderDiscuss();
    }

    renderDiscuss() {
        this.screen.clearChildren();
        this.renderHeader();

        this.screen.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 7, text: 'SAY ONE CLUE ABOUT THE WORD', size: 1.9, align: 'center', font: 'monospace', color: INK }
        }), false);
        this.screen.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 10.5, text: 'OUT LOUD - IN THIS ORDER', size: 1.6, align: 'center', font: 'monospace', color: FAINT }
        }), false);

        this.renderWordGrid(15, this.crewIds(), null);

        this.speakingOrder.forEach((pid, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const x = 10 + col * 45;
            const y = 50 + row * 3.4;
            const c = this.colorOf(pid);
            this.screen.addChild(new GameNode.Text({
                textInfo: { x, y, text: (i + 1) + '. ' + this.playerName(pid), size: 1.7, font: 'monospace', color: c.color }
            }), false);
            this.screen.addChild(new GameNode.Text({
                textInfo: { x: x + 26, y, text: '< YOU', size: 1.4, font: 'monospace', color: GOLD },
                playerIds: [pid]
            }), false);
        });

        this.screen.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(10, 66, 80, 1.6),
            fill: [215, 205, 185, 255]
        }), false);
        this.timerBar = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(10, 66, 80, 1.6),
            fill: [60, 175, 90, 255],
            color: [255, 255, 255, 255]
        });
        this.screen.addChild(this.timerBar, false);

        this.callVoteButton = this.makeButton('CALL THE VOTE', 20, 71, 60, 7, [215, 55, 130, 255],
            () => this.startVote(), this.participants.slice());
        this.screen.addChild(this.callVoteButton, false);

        this.base.node.onStateChange();
    }

    updateTimerBar() {
        const frac = Math.max(0, this.discussTicksLeft / DISCUSS_TICKS);
        const width = Math.max(0.2, 80 * frac);
        this.timerBar.node.coordinates2d = ShapeUtils.rectangle(10, 66, width, 1.6);
        this.timerBar.node.fill = frac > 0.5
            ? lerpColor([225, 145, 10, 255], [60, 175, 90, 255], (frac - 0.5) * 2)
            : lerpColor([240, 80, 80, 255], [225, 145, 10, 255], frac * 2);
    }

    // --- vote phase ---

    startVote() {
        if (this.phase !== 'discuss') {
            return;
        }
        this.phase = 'vote';
        this.votes = {};
        this.voteMarks = {};
        this.renderVote();
    }

    renderVote() {
        this.screen.clearChildren();
        this.renderHeader();

        this.makeGlowText('WHO IS THE IMPOSTER?', 50, 8, 3, INK, [215, 55, 130, 255])
            .forEach(n => this.screen.addChild(n, false));
        this.screen.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 13, text: 'TAP A NAME - YOU CAN CHANGE YOUR MIND', size: 1.5, align: 'center', font: 'monospace', color: FAINT }
        }), false);

        this.voteButtonY = {};
        this.participants.forEach((pid, i) => {
            const y = 17 + i * 8.6;
            this.voteButtonY[pid] = y;
            const c = this.colorOf(pid);
            const voters = this.participants.filter(other => other !== pid);
            const button = this.makeButton(this.playerName(pid), 14, y, 72, 7, c.color,
                (voterId) => this.castVote(voterId, pid), voters);
            this.screen.addChild(button, false);
        });

        this.voteProgress = new GameNode.Text({
            textInfo: {
                x: 50, y: 17 + this.participants.length * 8.6 + 1.5,
                text: 'LOCKED 0/' + this.participants.length, size: 1.8, align: 'center', font: 'monospace', color: FAINT
            }
        });
        this.screen.addChild(this.voteProgress, false);

        this.base.node.onStateChange();
    }

    castVote(voterId, targetId) {
        if (this.phase !== 'vote' || this.participants.indexOf(voterId) < 0 ||
            this.participants.indexOf(targetId) < 0 || voterId === targetId) {
            return;
        }

        this.votes[voterId] = targetId;

        if (this.voteMarks[voterId]) {
            this.screen.removeChild(this.voteMarks[voterId].id, false);
        }
        const mark = new GameNode.Text({
            textInfo: { x: 10, y: this.centeredTextY(this.voteButtonY[targetId], 7, 2.4), text: '✓', size: 2.4, font: 'monospace', color: [35, 150, 80, 255] },
            playerIds: [voterId]
        });
        this.voteMarks[voterId] = mark;
        this.screen.addChild(mark, false);

        const locked = Object.keys(this.votes).length;
        this.voteProgress.node.text.text = 'LOCKED ' + locked + '/' + this.participants.length;
        this.base.node.onStateChange();

        if (locked >= this.participants.length) {
            this.tallyVotes();
        }
    }

    tallyVotes() {
        const counts = {};
        Object.values(this.votes).forEach(target => {
            counts[target] = (counts[target] || 0) + 1;
        });

        let accused = null;
        let best = 0;
        let tie = false;
        Object.keys(counts).map(Number).forEach(pid => {
            if (counts[pid] > best) {
                accused = pid;
                best = counts[pid];
                tie = false;
            } else if (counts[pid] === best) {
                tie = true;
            }
        });

        if (tie || accused !== this.imposterId) {
            this.finishRound('escaped', accused, tie);
        } else {
            this.startGuess();
        }
    }

    // --- guess phase ---

    startGuess() {
        this.phase = 'guess';
        this.guessTicksLeft = GUESS_TICKS;
        this.renderGuess();
    }

    renderGuess() {
        this.screen.clearChildren();
        this.renderHeader();

        this.makeGlowText('CAUGHT!', 50, 6, 3.4, [215, 60, 45, 255])
            .forEach(n => this.screen.addChild(n, false));
        this.screen.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 11, text: this.playerName(this.imposterId) + ' IS THE IMPOSTER', size: 1.9, align: 'center', font: 'monospace', color: INK }
        }), false);

        this.screen.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 15, text: 'TAP THE SECRET WORD TO STEAL THE WIN', size: 1.6, align: 'center', font: 'monospace', color: GOLD },
            playerIds: [this.imposterId]
        }), false);
        this.screen.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 15, text: 'THE IMPOSTER GETS ONE GUESS...', size: 1.6, align: 'center', font: 'monospace', color: FAINT },
            playerIds: this.crewIds()
        }), false);

        const gridBottom = this.renderWordGrid(19, null, (playerId, cellIndex) => {
            if (this.phase === 'guess' && playerId === this.imposterId) {
                this.finishRound(cellIndex === this.secretIndex ? 'stolen' : 'held');
            }
        });

        this.guessTimerText = new GameNode.Text({
            textInfo: { x: 50, y: gridBottom + 3, text: '30', size: 2.6, align: 'center', font: 'monospace', color: [225, 145, 10, 255] }
        });
        this.screen.addChild(this.guessTimerText, false);

        this.base.node.onStateChange();
    }

    // --- results ---

    finishRound(outcome, accused, tie) {
        const secretWord = this.gridWords[this.secretIndex];
        const imposterName = this.playerName(this.imposterId);
        const crew = this.crewIds();
        let headline;
        let detail;
        let headlineColor;
        let winners;

        if (outcome === 'escaped') {
            this.scores[this.imposterId] = (this.scores[this.imposterId] || 0) + 3;
            headline = 'THE IMPOSTER ESCAPED';
            detail = tie ? 'THE VOTE TIED - ' + imposterName + ' WALKS (+3)'
                : (accused !== null && accused !== undefined ? this.playerName(accused) + ' TOOK THE FALL - ' + imposterName + ' +3' : imposterName + ' +3');
            headlineColor = [215, 60, 45, 255];
            winners = [this.imposterId];
        } else if (outcome === 'stolen') {
            this.scores[this.imposterId] = (this.scores[this.imposterId] || 0) + 2;
            headline = 'WIN STOLEN!';
            detail = imposterName + ' GUESSED THE WORD (+2)';
            headlineColor = GOLD;
            winners = [this.imposterId];
        } else if (outcome === 'held') {
            crew.forEach(pid => {
                this.scores[pid] = (this.scores[pid] || 0) + 2;
            });
            headline = 'CREW WINS';
            detail = imposterName + ' GUESSED WRONG - CREW +2 EACH';
            headlineColor = [35, 150, 80, 255];
            winners = crew;
        } else {
            headline = 'ROUND VOIDED';
            detail = outcome;
            headlineColor = FAINT;
            winners = [];
        }

        this.phase = 'results';
        this.roundResult = { headline, detail, headlineColor, secretWord, imposterName };
        this.renderResults();
        if (winners.length) {
            this.spawnConfetti(winners);
        }
    }

    renderResults() {
        this.screen.clearChildren();
        this.renderHeader();

        const r = this.roundResult;
        this.makeGlowText(r.headline, 50, 8, 3.4, r.headlineColor)
            .forEach(n => this.screen.addChild(n, false));
        this.screen.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 13.5, text: r.detail, size: 1.5, align: 'center', font: 'monospace', color: INK }
        }), false);

        this.screen.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 19, text: 'THE WORD WAS', size: 1.6, align: 'center', font: 'monospace', color: FAINT }
        }), false);
        this.makeGlowText(r.secretWord, 50, 22.5, 3.4, GOLD)
            .forEach(n => this.screen.addChild(n, false));
        this.screen.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 28.5, text: 'THE IMPOSTER WAS ' + r.imposterName, size: 1.7, align: 'center', font: 'monospace', color: [215, 60, 45, 255] }
        }), false);

        const standings = this.joined.filter(pid => this.players[pid])
            .sort((a, b) => (this.scores[b] || 0) - (this.scores[a] || 0));
        this.screen.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 35, text: 'STANDINGS', size: 1.9, align: 'center', font: 'monospace', color: INK }
        }), false);
        standings.forEach((pid, i) => {
            const y = 39.5 + i * 4;
            const c = this.colorOf(pid);
            this.screen.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(22, y, 2.6, 2.6 * TEXT_H * 3.2),
                fill: c.color,
                color: [255, 255, 255, 255]
            }), false);
            this.screen.addChild(new GameNode.Text({
                textInfo: { x: 27, y: y + 0.1, text: this.playerName(pid), size: 1.8, font: 'monospace', color: INK }
            }), false);
            this.screen.addChild(new GameNode.Text({
                textInfo: { x: 78, y: y + 0.1, text: '★ ' + (this.scores[pid] || 0), size: 1.8, align: 'right', font: 'monospace', color: GOLD }
            }), false);
            this.screen.addChild(new GameNode.Text({
                textInfo: { x: 20.5, y: y + 0.1, text: 'YOU', size: 1.3, align: 'right', font: 'monospace', color: GOLD },
                playerIds: [pid]
            }), false);
        });

        this.nextRoundButton = this.makeButton('NEXT ROUND', 20, 78, 60, 7, [0, 150, 136, 255], (playerId) => {
            if (this.phase !== 'results' || this.joined.indexOf(playerId) < 0) {
                return;
            }
            if (this.joined.filter(pid => this.players[pid]).length < MIN_PLAYERS) {
                this.showLobby();
            } else {
                this.startRound();
            }
        });
        this.screen.addChild(this.nextRoundButton, false);

        this.base.node.onStateChange();
    }

    spawnConfetti(winnerIds) {
        const colors = winnerIds.map(pid => this.colorOf(pid).color);
        colors.push(GOLD);
        for (let i = 0; i < 36; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            const piece = {
                x: 5 + Math.random() * 90,
                y: -2 - Math.random() * 10,
                vx: (Math.random() - 0.5) * 0.7,
                vy: 0.4 + Math.random() * 0.8,
                w: 0.9 + Math.random() * 0.8,
                node: null,
                color
            };
            piece.node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(piece.x, Math.max(0, piece.y), piece.w, piece.w * TEXT_H * 1.6),
                fill: color,
                color: [color[0], color[1], color[2], 255]
            });
            this.confetti.push(piece);
            this.confettiLayer.addChild(piece.node, false);
        }
        this.base.node.onStateChange();
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
                p.node.node.coordinates2d = ShapeUtils.rectangle(
                    Math.max(0, Math.min(98, p.x)), Math.max(0, p.y), p.w, p.w * TEXT_H * 1.6);
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

    // --- simulation ---

    tick() {
        this.tickCount++;

        if (this.phase === 'lobby' && this.titleHalos) {
            const alpha = 110 + Math.round(60 * Math.sin(this.tickCount / 4));
            this.titleHalos.forEach(halo => {
                halo.node.text.color = [255, 105, 180, alpha];
            });
        } else if (this.phase === 'reveal' && this.highlightNode) {
            const alpha = 190 + Math.round(65 * Math.sin(this.tickCount / 2.5));
            this.highlightNode.node.color = [GOLD[0], GOLD[1], GOLD[2], alpha];
        } else if (this.phase === 'discuss') {
            this.discussTicksLeft--;
            this.updateTimerBar();
            if (this.discussTicksLeft <= 0) {
                this.startVote();
            }
        } else if (this.phase === 'guess') {
            this.guessTicksLeft--;
            this.guessTimerText.node.text.text = String(Math.ceil(this.guessTicksLeft / TICK_RATE));
            if (this.guessTicksLeft <= 0) {
                this.finishRound('held');
            }
        } else if (this.phase === 'results') {
            this.updateConfetti();
        }

        this.updateTransients();
        this.base.node.onStateChange();
    }

    // --- platform hooks ---

    handleNewPlayer({ playerId, info }) {
        this.players[playerId] = { name: (info && info.name) || ('PLAYER ' + playerId) };
        if (!this.anchors[playerId]) {
            this.anchors[playerId] = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                playerIds: [playerId]
            });
            this.anchorLayer.addChild(this.anchors[playerId], false);
        }
        if (this.phase === 'lobby') {
            this.updateLobbyUi();
        } else {
            if (this.pendingJoins.indexOf(playerId) === -1 && this.joined.indexOf(playerId) === -1) {
                this.pendingJoins.push(playerId);
            }
            this.addFlash('YOU ARE IN NEXT ROUND', 3 * TICK_RATE, [playerId], [0, 150, 136, 255]);
        }
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
        delete this.playerColors[playerId];
        delete this.scores[playerId];
        if (this.anchors[playerId]) {
            this.anchorLayer.removeChild(this.anchors[playerId].id, false);
            delete this.anchors[playerId];
        }
        this.pendingJoins = this.pendingJoins.filter(pid => pid !== playerId);
        this.joined = this.joined.filter(pid => pid !== playerId);

        if (Object.keys(this.players).length === 0) {
            this.scores = {};
            this.roundNumber = 0;
            this.showLobby();
            return;
        }

        if (this.phase === 'lobby') {
            this.updateLobbyUi();
            return;
        }

        if (this.phase === 'results') {
            this.renderResults();
            return;
        }

        const wasParticipant = this.participants.indexOf(playerId) >= 0;
        if (!wasParticipant) {
            return;
        }

        this.participants = this.participants.filter(pid => pid !== playerId);

        if (playerId === this.imposterId) {
            this.finishRound('THE IMPOSTER FLED THE GAME');
            return;
        }
        if (this.participants.length < MIN_PLAYERS) {
            this.finishRound('NOT ENOUGH PLAYERS LEFT');
            return;
        }

        if (this.phase === 'reveal') {
            this.ready.delete(playerId);
            this.speakingOrder = this.speakingOrder.filter(pid => pid !== playerId);
            this.renderReveal();
            this.readyProgress.node.text.text = 'READY ' + this.ready.size + '/' + this.participants.length;
            const waiting = this.participants.filter(pid => !this.ready.has(pid));
            this.setNodePlayerIds(this.readyButton, waiting.length ? waiting : [0]);
            if (waiting.length === 0) {
                this.startDiscuss();
            }
        } else if (this.phase === 'discuss') {
            this.speakingOrder = this.speakingOrder.filter(pid => pid !== playerId);
            this.renderDiscuss();
        } else if (this.phase === 'vote') {
            delete this.votes[playerId];
            Object.keys(this.votes).map(Number).forEach(voter => {
                if (this.votes[voter] === playerId) {
                    delete this.votes[voter];
                }
            });
            this.renderVote();
            Object.keys(this.votes).map(Number).forEach(voter => {
                const target = this.votes[voter];
                const mark = new GameNode.Text({
                    textInfo: { x: 10, y: this.centeredTextY(this.voteButtonY[target], 7, 2.4), text: '✓', size: 2.4, font: 'monospace', color: [35, 150, 80, 255] },
                    playerIds: [voter]
                });
                this.voteMarks[voter] = mark;
                this.screen.addChild(mark, false);
            });
            this.voteProgress.node.text.text = 'LOCKED ' + Object.keys(this.votes).length + '/' + this.participants.length;
            if (Object.keys(this.votes).length >= this.participants.length) {
                this.tallyVotes();
            }
        }
        this.base.node.onStateChange();
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = Imposter;
