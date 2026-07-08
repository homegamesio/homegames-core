const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');
const FACTS = require('./facts');

const TICK_RATE = 10;
const MAX_PLAYERS = 8;
const ROUNDS_PER_GAME = 6;

const WRITE_TICKS = 60 * TICK_RATE;
const VOTE_TICKS = 35 * TICK_RATE;
const REVEAL_TICKS = 10 * TICK_RATE;

const TRUTH_PTS = 100;
const FOOL_PTS = 50;
const CLOSE_PTS = 75;

// Text height in y-units at 16:9
const TEXT_H = (size) => size * 16 / 9;

// Game-show palette: deep plum with gold
const BG = [42, 32, 52, 255];
const CARD_BG = [58, 46, 72, 255];
const CARD_EDGE = [110, 90, 140, 255];
const GOLD = [255, 200, 80, 255];
const INK = [238, 232, 245, 255];
const FAINT = [160, 145, 180, 255];
const GOOD = [110, 220, 140, 255];
const BAD = [235, 100, 90, 255];

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

const wrapText = (str, max) => {
    const lines = [];
    let line = '';
    str.split(' ').forEach(word => {
        if ((line + ' ' + word).trim().length > max) {
            lines.push(line.trim());
            line = word;
        } else {
            line += ' ' + word;
        }
    });
    if (line.trim()) {
        lines.push(line.trim());
    }
    return lines;
};

class Fakeout extends Game {
    static metadata() {
        return {
            squishVersion: '142',
            name: 'Fakeout',
            author: 'Joseph Garcia',
            description: 'Bluffing trivia. Everyone writes a fake answer to a weird true fact, then votes for the truth. Fool your friends, find the facts.',
            aspectRatio: { x: 16, y: 9 },
            services: ['multiplayer'],
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
        this.roster = [];
        this.facts = [];
        this.roundIdx = 0;
        this.fact = null;
        this.lies = {};
        this.tooClose = new Set();
        this.cards = [];
        this.votesBy = {};
        this.deadline = 0;
        this.toastUntil = {};
        this.lobbyMsg = null;

        this.base = this.rect(0, 0, 100, 100, BG);

        this.roundLabel = this.text('', 1.5, 2, 1.4, FAINT);
        this.timerNode = this.text('', 93, 1.3, 3, GOLD, 'center');

        this.promptLayer = this.container();
        this.mainLayer = this.container();
        this.sideLayer = this.container();
        this.playerLayer = this.container();

        this.base.addChildren(
            this.roundLabel, this.timerNode,
            this.promptLayer, this.mainLayer, this.sideLayer, this.playerLayer
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
        if (node.node.text.text !== str) {
            node.node.text = { ...node.node.text, text: str };
            this.dirty = true;
        }
    }

    makeButton({ x, y, w, h, label, size, fill, textColor, onClick }) {
        const bg = this.rect(x, y, w, h, fill, { border: 4, color: [25, 18, 32, 255], onClick });
        bg.addChild(this.text(label, x + w / 2, y + (h - TEXT_H(size)) / 2, size, textColor || INK, 'center'));
        return bg;
    }

    // ---- players ----

    handleNewPlayer({ playerId, info }) {
        const pid = Number(playerId);
        if (this.players[pid] || Object.keys(this.players).length >= MAX_PLAYERS) {
            return;
        }
        const name = ((info && info.name) || `PLAYER ${pid}`).toUpperCase().slice(0, 10);
        const root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds: [pid]
        });
        this.players[pid] = { name, score: 0, root, toastNode: null };
        this.playerLayer.addChild(root);
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
        this.roster = this.roster.filter(id => id !== pid);
        const inRound = this.phase === 'writing' || this.phase === 'voting' || this.phase === 'reveal';
        if (inRound && Object.keys(this.players).length < 2) {
            return this.abortToLobby('GAME ENDED - NOT ENOUGH PLAYERS');
        }
        if (this.phase === 'writing') {
            delete this.lies[pid];
            this.tooClose.delete(pid);
            this.checkAllWritten();
        } else if (this.phase === 'voting') {
            delete this.votesBy[pid];
            this.checkAllVoted();
        }
        this.refresh();
    }

    toastFor(pid, msg) {
        const p = this.players[pid];
        if (p && p.toastNode) {
            this.setText(p.toastNode, msg);
            this.toastUntil[pid] = this._t + 30;
            this.dirty = true;
        }
    }

    // ---- flow ----

    startGame(pid) {
        if (this.phase !== 'lobby' || !this.players[pid]) {
            return;
        }
        if (Object.keys(this.players).length < 2) {
            return;
        }
        Object.values(this.players).forEach(p => {
            p.score = 0;
        });
        this.facts = shuffled(FACTS).slice(0, ROUNDS_PER_GAME);
        this.roundIdx = 0;
        this.lobbyMsg = null;
        this.startRound();
    }

    startRound() {
        this.fact = this.facts[this.roundIdx];
        this.roster = Object.keys(this.players).map(Number);
        this.lies = {};
        this.tooClose = new Set();
        this.cards = [];
        this.votesBy = {};
        this.phase = 'writing';
        this.deadline = this._t + WRITE_TICKS;
        this.refresh();
    }

    submitLie(pid, value) {
        if (this.phase !== 'writing' || !this.roster.includes(pid) || this.lies[pid] !== undefined || this.tooClose.has(pid)) {
            return;
        }
        const lie = (value || '').toString().trim().replace(/\s+/g, ' ').slice(0, 24).toUpperCase();
        if (!lie) {
            return;
        }
        const truth = this.fact.a.toLowerCase();
        const guess = lie.toLowerCase();
        const closeEnough = guess === truth
            || guess.includes(truth)
            || levenshtein(guess, truth) <= (truth.length >= 6 ? 2 : 1);
        if (closeEnough) {
            this.tooClose.add(pid);
            this.players[pid].score += CLOSE_PTS;
            this.toastFor(pid, `TOO CLOSE TO THE TRUTH! +${CLOSE_PTS}`);
        } else {
            this.lies[pid] = lie;
        }
        this.checkAllWritten();
        this.refresh();
    }

    checkAllWritten() {
        if (this.phase !== 'writing') {
            return;
        }
        const done = this.roster.every(pid => !this.players[pid] || this.lies[pid] !== undefined || this.tooClose.has(pid));
        if (done) {
            this.startVoting();
        }
    }

    startVoting() {
        const byText = {};
        Object.keys(this.lies).forEach(pid => {
            const t = this.lies[pid];
            if (!byText[t]) {
                byText[t] = [];
            }
            byText[t].push(Number(pid));
        });
        const lieCards = Object.keys(byText).map(t => ({ text: t, authors: byText[t], isTruth: false, votes: [] }));
        const truthCard = { text: this.fact.a, authors: [], isTruth: true, votes: [] };
        this.cards = shuffled([...lieCards, truthCard]);
        this.phase = 'voting';
        this.deadline = this._t + VOTE_TICKS;
        this.refresh();
    }

    vote(pid, cardIdx) {
        if (this.phase !== 'voting' || !this.roster.includes(pid) || !this.players[pid] || this.votesBy[pid] !== undefined) {
            return;
        }
        const card = this.cards[cardIdx];
        if (!card) {
            return;
        }
        if (card.authors.includes(pid)) {
            return this.toastFor(pid, 'THAT ONE IS YOURS.');
        }
        this.votesBy[pid] = cardIdx;
        card.votes.push(pid);
        this.checkAllVoted();
        this.refresh();
    }

    checkAllVoted() {
        if (this.phase !== 'voting') {
            return;
        }
        const done = this.roster.every(pid => !this.players[pid] || this.votesBy[pid] !== undefined);
        if (done) {
            this.startReveal();
        }
    }

    startReveal() {
        this.cards.forEach(card => {
            if (card.isTruth) {
                card.votes.forEach(pid => {
                    if (this.players[pid]) {
                        this.players[pid].score += TRUTH_PTS;
                    }
                });
            } else {
                card.authors.forEach(author => {
                    if (this.players[author]) {
                        this.players[author].score += card.votes.length * FOOL_PTS;
                    }
                });
            }
        });
        this.phase = 'reveal';
        this.deadline = this._t + REVEAL_TICKS;
        this.refresh();
    }

    nextRound() {
        this.roundIdx++;
        if (this.roundIdx >= this.facts.length) {
            this.phase = 'podium';
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
        this.refresh();
    }

    // ---- game loop ----

    tick() {
        this._t++;
        if (this.phase === 'writing' || this.phase === 'voting' || this.phase === 'reveal') {
            const sec = Math.max(0, Math.ceil((this.deadline - this._t) / TICK_RATE));
            this.setText(this.timerNode, String(sec));
            if (this._t >= this.deadline) {
                if (this.phase === 'writing') {
                    this.startVoting();
                } else if (this.phase === 'voting') {
                    this.startReveal();
                } else {
                    this.nextRound();
                }
            }
        }
        Object.keys(this.toastUntil).forEach(pid => {
            if (this._t >= this.toastUntil[pid]) {
                delete this.toastUntil[pid];
                const p = this.players[pid];
                if (p && p.toastNode) {
                    this.setText(p.toastNode, '');
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
        const inRound = this.phase === 'writing' || this.phase === 'voting' || this.phase === 'reveal';
        this.setText(this.roundLabel, inRound ? `ROUND ${this.roundIdx + 1}/${this.facts.length}` : '');
        if (!inRound) {
            this.setText(this.timerNode, '');
        }
        this.rebuildPrompt();
        this.rebuildMain();
        this.rebuildSide();
        Object.keys(this.players).forEach(pid => this.rebuildPlayerRoot(Number(pid)));
        this.base.node.onStateChange();
    }

    rebuildPrompt() {
        this.promptLayer.clearChildren();
        if (this.phase !== 'writing' && this.phase !== 'voting' && this.phase !== 'reveal') {
            return;
        }
        const lines = wrapText(this.fact.p, 44);
        lines.forEach((line, i) => {
            this.promptLayer.addChild(this.text(line, 40, 7 + i * 4.5, 1.9, GOLD, 'center'));
        });
    }

    rebuildMain() {
        this.mainLayer.clearChildren();
        if (this.phase === 'lobby') {
            this.buildLobby();
        } else if (this.phase === 'writing') {
            const submitted = this.roster.filter(pid => this.lies[pid] !== undefined || this.tooClose.has(pid)).length;
            this.mainLayer.addChild(this.text('EVERYONE: WRITE A CONVINCING FAKE ANSWER', 40, 24, 1.4, INK, 'center'));
            this.mainLayer.addChild(this.text(`LIES LOCKED IN: ${submitted}/${this.roster.length}`, 40, 78, 1.4, FAINT, 'center'));
        } else if (this.phase === 'voting' || this.phase === 'reveal') {
            this.buildCards();
        } else if (this.phase === 'podium') {
            this.buildPodium();
        }
    }

    buildCards() {
        const revealing = this.phase === 'reveal';
        if (!revealing) {
            this.mainLayer.addChild(this.text('WHICH ONE IS THE TRUTH?', 40, 21, 1.4, INK, 'center'));
        }
        this.cards.forEach((card, i) => {
            const x = 3 + (i % 2) * 39;
            const y = 26 + Math.floor(i / 2) * 13.5;
            const edge = revealing && card.isTruth ? GOOD : CARD_EDGE;
            const cardNode = this.rect(x, y, 37, 8, CARD_BG, {
                border: revealing && card.isTruth ? 8 : 4,
                color: edge,
                onClick: (playerId) => this.vote(Number(playerId), i)
            });
            cardNode.addChild(this.text(card.text.slice(0, 30), x + 18.5, y + (8 - TEXT_H(1.3)) / 2, 1.3, revealing && card.isTruth ? GOOD : INK, 'center'));
            this.mainLayer.addChild(cardNode);
            if (revealing) {
                const names = (pids) => pids.map(pid => (this.players[pid] || {}).name || '?').join(', ');
                let note;
                if (card.isTruth) {
                    note = card.votes.length ? `THE TRUTH! BELIEVED BY ${names(card.votes)} (+${TRUTH_PTS})` : 'THE TRUTH! NOBODY BELIEVED IT';
                } else {
                    note = `BY ${names(card.authors)}` + (card.votes.length ? ` - FOOLED ${names(card.votes)} (+${card.votes.length * FOOL_PTS})` : '');
                }
                this.mainLayer.addChild(this.text(note.slice(0, 52), x + 1, y + 8.6, 0.95, card.isTruth ? GOOD : FAINT));
            }
        });
    }

    buildLobby() {
        const s = this.mainLayer;
        s.addChild(this.text('FAKEOUT', 50.4, 8.4, 5, [0, 0, 0, 130], 'center'));
        s.addChild(this.text('FAKEOUT', 50, 8, 5, GOLD, 'center'));
        s.addChild(this.text('A WEIRD TRUE FACT, MISSING A PIECE.', 50, 22, 1.4, INK, 'center'));
        s.addChild(this.text('WRITE A FAKE ANSWER. FIND THE REAL ONE. FOOL YOUR COWORKERS.', 50, 26, 1.2, FAINT, 'center'));
        s.addChild(this.text(`TRUTH +${TRUTH_PTS} / EACH PERSON FOOLED +${FOOL_PTS}`, 50, 30, 1.2, FAINT, 'center'));
        if (this.lobbyMsg) {
            s.addChild(this.text(this.lobbyMsg, 50, 35, 1.3, BAD, 'center'));
        }
        const ids = Object.keys(this.players).map(Number);
        s.addChild(this.text(`PLAYERS (${ids.length}/${MAX_PLAYERS})`, 40, 41, 1.2, FAINT));
        ids.forEach((pid, i) => {
            s.addChild(this.text(this.players[pid].name, 40, 45.5 + i * 4, 1.35, INK));
        });
        if (ids.length >= 2) {
            s.addChild(this.makeButton({
                x: 40, y: 82, w: 20, h: 8, label: 'START', size: 1.6, fill: [110, 70, 160, 255],
                onClick: (playerId) => this.startGame(Number(playerId))
            }));
        } else {
            s.addChild(this.text('NEED AT LEAST 2 PLAYERS (BEST WITH 3+)', 50, 84, 1.2, FAINT, 'center'));
        }
    }

    buildPodium() {
        const s = this.mainLayer;
        const ids = Object.keys(this.players).map(Number)
            .sort((a, b) => this.players[b].score - this.players[a].score);
        s.addChild(this.text('FINAL SCORES', 50, 12, 3, GOLD, 'center'));
        ids.forEach((pid, i) => {
            const p = this.players[pid];
            s.addChild(this.text(
                `${i + 1}. ${p.name}  ${p.score}`,
                50, i === 0 ? 26 : 33 + i * 5, i === 0 ? 2.2 : 1.5,
                i === 0 ? INK : FAINT, 'center'
            ));
        });
        s.addChild(this.makeButton({
            x: 37, y: 80, w: 26, h: 8, label: 'PLAY AGAIN', size: 1.6, fill: [110, 70, 160, 255],
            onClick: (playerId) => this.playAgain(Number(playerId))
        }));
    }

    rebuildSide() {
        this.sideLayer.clearChildren();
        if (this.phase === 'lobby' || this.phase === 'podium') {
            return;
        }
        this.sideLayer.addChild(this.text('SCORES', 82, 22, 1.1, FAINT));
        const ids = Object.keys(this.players).map(Number)
            .sort((a, b) => this.players[b].score - this.players[a].score);
        ids.forEach((pid, i) => {
            const p = this.players[pid];
            this.sideLayer.addChild(this.text(p.name.slice(0, 9), 82, 26 + i * 6, 1.05, INK));
            this.sideLayer.addChild(this.text(String(p.score), 82, 26 + i * 6 + 2.4, 1.05, GOLD));
        });
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
            p.root.addChild(this.text('< YOU', 58, 45.5 + ids.indexOf(pid) * 4, 1.2, GOLD));
            return;
        }
        if (this.phase === 'podium') {
            return;
        }
        p.toastNode = this.text('', 40, 94, 1.2, GOLD, 'center');
        p.root.addChild(p.toastNode);
        if (!this.roster.includes(pid)) {
            p.root.addChild(this.text('YOU JOIN THE NEXT ROUND - ENJOY THE LIES.', 40, 88, 1.2, FAINT, 'center'));
            return;
        }
        if (this.phase === 'writing') {
            if (this.tooClose.has(pid)) {
                p.root.addChild(this.text('YOU GUESSED THE TRUTH! SIT BACK.', 40, 50, 1.5, GOOD, 'center'));
            } else if (this.lies[pid] !== undefined) {
                p.root.addChild(this.text('LIE LOCKED IN. LOOK INNOCENT.', 40, 50, 1.5, GOOD, 'center'));
            } else {
                const box = this.rect(25, 46, 30, 8, [30, 24, 40, 255], {
                    border: 5, color: GOLD,
                    input: {
                        type: 'text',
                        oninput: (playerId, value) => this.submitLie(Number(playerId), value)
                    }
                });
                box.addChild(this.text('TAP TO WRITE YOUR LIE', 40, 46 + (8 - TEXT_H(1.3)) / 2, 1.3, GOLD, 'center'));
                p.root.addChild(box);
            }
        } else if (this.phase === 'voting') {
            if (this.votesBy[pid] !== undefined) {
                const y = 26 + Math.floor(this.votesBy[pid] / 2) * 13.5;
                const x = 3 + (this.votesBy[pid] % 2) * 39;
                p.root.addChild(this.text('YOUR VOTE >', x - 0.5, y + 2.8, 1, GOLD, 'right'));
                p.root.addChild(this.text('VOTE LOCKED IN.', 40, 88, 1.2, FAINT, 'center'));
            } else {
                p.root.addChild(this.text('TAP THE ANSWER YOU THINK IS TRUE', 40, 88, 1.2, GOLD, 'center'));
            }
        }
    }
}

module.exports = Fakeout;
