const { Game, GameNode, Shapes, ShapeUtils } = require('squish-142');
const { T, text, button, card: makeCard, setCard, tableRoot } = require('./theme');

const BLUE = 0;
const YELLOW = 1;
const SIDE_COLORS = [T.soft, T.gold];
const SUITS = ['S', 'H', 'D', 'C'];
const SUIT_NAMES = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' };
const SUIT_SYMBOLS = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const CARD_WHITE = [243, 241, 232, 255];
const CARD_RED = [184, 39, 50, 255];
const CARD_BLACK = [28, 31, 36, 255];
const CARD_BACK = [47, 92, 126, 255];
const PLAYABLE = [103, 148, 101, 255];
const PAGE_SIZE = 12;

class CrazyEights extends Game {
    static metadata() {
        return {
            squishVersion: '142',
            name: 'Crazy Eights',
            author: 'Homegames',
            description: 'A relaxed Crazy Eights table with private hands and wild suit choices.',
            aspectRatio: { x: 1, y: 1 },
            maxPlayers: 2,
            services: ['multiplayer']
        };
    }

    constructor() {
        super();
        const table = tableRoot();
        this.base = table.root;
        this.titleText = text('Crazy Eights', 50, 5.5, 4.2, T.cream);
        this.statusText = text('Welcome to the table', 50, 12, 1.8, T.cream);
        this.scoreText = text('', 50, 16, 1.2, T.muted);
        this.activeText = text('Active suit · —', 50, 21, 1.3, T.soft);
        this.deckText = text('Draw pile', 70, 52, 1.1, T.muted);
        this.deckCountText = text('', 70, 37, 1.8, T.cream);
        this.turnInfoText = text('', 50, 60, 1.1, T.muted);
        this.discardCard = makeCard(31, 27, 16, 24);
        this.deckCard = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(62, 27, 16, 24),
            fill: [74, 92, 72, 255], color: T.gold, border: 5
        });
        this.base.addChildren(this.discardCard, this.deckCard, this.titleText, this.statusText, this.scoreText, this.activeText, this.deckText, this.deckCountText, this.turnInfoText);

        this.phase = 'waiting';
        this.turn = BLUE;
        this.activeSuit = null;
        this.pendingSuit = null;
        this.drawnThisTurn = false;
        this.passAllowed = false;
        this.lastEvent = '';
        this.matchScores = [0, 0];
        this.players = {};
        this.seats = [
            { playerId: null, isBot: false, name: 'Open seat' },
            { playerId: null, isBot: true, name: 'Computer' }
        ];
        this.botToken = 0;
        this.botPending = false;
        this.startCardState();
        this.render();
    }

    getLayers() { return [{ root: this.base }]; }

    makeText(value, x, y, size, color = T.cream, playerIds) {
        return text(value, x, y, size, color, playerIds);
    }

    makeButton(x, y, w, h, label, fill, onClick, playerIds) {
        return button(x, y, w, h, label, onClick, playerIds, fill || T.wood);
    }

    buildDeck() {
        const deck = [];
        for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank, symbol: SUIT_SYMBOLS[suit], id: `${rank}${suit}` });
        return deck;
    }

    shuffle(cards) {
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = cards[i]; cards[i] = cards[j]; cards[j] = t;
        }
        return cards;
    }

    startCardState() {
        this.deck = this.shuffle(this.buildDeck());
        this.hands = [[], []];
        for (let i = 0; i < 7; i++) {
            this.hands[BLUE].push(this.deck.pop());
            this.hands[YELLOW].push(this.deck.pop());
        }
        this.discard = [];
        let top = this.deck.pop();
        while (top.rank === '8' && this.deck.length) {
            this.deck.unshift(top);
            top = this.deck.pop();
        }
        this.discard.push(top);
        this.activeSuit = top.suit;
        this.turn = BLUE;
        this.pendingSuit = null;
        this.drawnThisTurn = false;
        this.passAllowed = false;
        this.lastEvent = '';
    }

    handleNewPlayer({ playerId, info }) {
        if (this.players[playerId]) return;
        const name = info && info.name ? String(info.name).trim().slice(0, 14) : `Player ${playerId}`;
        let seat = -1;
        if (this.seats[BLUE].playerId === null) seat = BLUE;
        else if (this.seats[YELLOW].isBot) { seat = YELLOW; this.invalidateBot(); }
        const view = seat >= 0 ? this.createPlayerView(playerId, seat) : this.createSpectatorView(playerId);
        this.players[playerId] = { seat, view, page: 0 };
        this.base.addChild(view.root);
        if (seat >= 0) {
            this.seats[seat] = { playerId, isBot: false, name };
            if (this.phase === 'waiting') this.phase = 'playing';
        }
        this.render();
        this.scheduleBotIfNeeded();
    }

    createSpectatorView(playerId) {
        const root = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(0,0,0,0), playerIds: [playerId] });
        root.addChild(this.makeText('Match in progress', 50, 82, 1.5, T.muted, [playerId]));
        return { root };
    }

    createPlayerView(playerId, seat) {
        const root = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(0,0,0,0), playerIds: [playerId] });
        const handText = this.makeText('Your hand', 50, 64, 1.35, SIDE_COLORS[seat], [playerId]);
        const hint = this.makeText('', 50, 67, 1.05, T.muted, [playerId]);
        const pageText = this.makeText('', 50, 92.5, 1.0, T.muted, [playerId]);
        const youText = this.makeText('', 50, 98, 1.1, SIDE_COLORS[seat], [playerId]);
        const slots = [];
        for (let i = 0; i < PAGE_SIZE; i++) {
            const row = Math.floor(i / 6);
            const col = i % 6;
            const x = 5.5 + col * 15.2;
            const y = 70 + row * 10.5;
            const shape = makeCard(x, y, 13.2, 8.6, (pid) => this.handleCardSlot(pid, i), [playerId]);
            slots.push({ shape });
            root.addChild(shape);
        }
        const prev = this.makeButton(5, 92, 16, 5, 'Back', T.wood, (pid) => this.changePage(pid, -1), [playerId]);
        const draw = this.makeButton(26, 92, 18, 5, 'Draw', T.wood, (pid) => this.handleDraw(pid), [playerId]);
        const pass = this.makeButton(48, 92, 18, 5, 'Pass', T.wood, (pid) => this.handlePass(pid), [playerId]);
        const next = this.makeButton(79, 92, 16, 5, 'More', T.wood, (pid) => this.changePage(pid, 1), [playerId]);
        const rematch = this.makeButton(36, 92, 28, 5, 'Play again', T.wood, (pid) => this.handleRematch(pid), [0]);
        const suitButtons = [];
        for (let i = 0; i < SUITS.length; i++) {
            const suit = SUITS[i];
            const btn = this.makeButton(25 + i * 13, 54, 11, 5, SUIT_SYMBOLS[suit], suit === 'H' || suit === 'D' ? [136, 49, 58, 255] : [51, 58, 69, 255], (pid) => this.chooseSuit(pid, suit), [0]);
            suitButtons.push(btn);
            root.addChild(btn);
        }
        root.addChildren(handText, hint, pageText, youText, prev, draw, pass, next, rematch);
        return { root, handText, hint, pageText, youText, slots, prev, draw, pass, next, rematch, suitButtons };
    }

    handlePlayerDisconnect(playerId) {
        const p = this.players[playerId];
        if (!p) return;
        this.base.removeChild(p.view.root.id);
        delete this.players[playerId];
        if (p.seat < 0) return;
        this.seats[p.seat] = { playerId: null, isBot: true, name: 'Computer' };
        if (this.pendingSuit === p.seat) this.chooseBotSuit(p.seat);
        this.render();
        this.scheduleBotIfNeeded();
    }

    topCard() { return this.discard[this.discard.length - 1]; }

    isPlayable(card) {
        const top = this.topCard();
        return card.rank === '8' || card.suit === this.activeSuit || card.rank === top.rank;
    }

    playableIndices(side) {
        const out = [];
        for (let i = 0; i < this.hands[side].length; i++) if (this.isPlayable(this.hands[side][i])) out.push(i);
        return out;
    }

    handleCardSlot(playerId, slot) {
        if (this.phase !== 'playing' || this.pendingSuit !== null) return;
        const p = this.players[playerId];
        if (!p || p.seat !== this.turn || this.seats[this.turn].isBot) return;
        const index = p.page * PAGE_SIZE + slot;
        if (index < 0 || index >= this.hands[p.seat].length) return;
        this.playCard(p.seat, index);
    }

    playCard(side, index) {
        if (this.phase !== 'playing' || side !== this.turn || this.pendingSuit !== null) return false;
        const card = this.hands[side][index];
        if (!card || !this.isPlayable(card)) return false;
        this.hands[side].splice(index, 1);
        this.discard.push(card);
        this.drawnThisTurn = false;
        this.passAllowed = false;
        this.lastEvent = `${this.seats[side].name} PLAYED ${this.cardLabel(card)}`;

        if (this.hands[side].length === 0) {
            this.phase = 'over';
            this.matchScores[side] += 1;
            this.invalidateBot();
            this.render();
            return true;
        }

        if (card.rank === '8') {
            this.pendingSuit = side;
            if (this.seats[side].isBot) {
                const token = ++this.botToken;
                this.render();
                this.setTimeout(() => {
                    if (token !== this.botToken || this.pendingSuit !== side) return;
                    this.chooseBotSuit(side);
                }, 260);
            } else {
                this.render();
            }
            return true;
        }

        this.activeSuit = card.suit;
        this.endTurn(side);
        return true;
    }

    cardLabel(card) { return `${card.rank}${SUIT_SYMBOLS[card.suit]}`; }
    cardColor(card) { return card.suit === 'H' || card.suit === 'D' ? CARD_RED : CARD_BLACK; }

    chooseSuit(playerId, suit) {
        if (!SUITS.includes(suit) || this.pendingSuit === null) return;
        const p = this.players[playerId];
        if (!p || p.seat !== this.pendingSuit) return;
        const side = this.pendingSuit;
        this.activeSuit = suit;
        this.pendingSuit = null;
        this.lastEvent = `${this.seats[side].name} CALLED ${SUIT_NAMES[suit]}`;
        this.endTurn(side);
    }

    chooseBotSuit(side) {
        if (this.pendingSuit !== side) return;
        let bestSuit = SUITS[0];
        let bestCount = -1;
        for (const suit of SUITS) {
            const count = this.hands[side].filter(c => c.suit === suit && c.rank !== '8').length;
            if (count > bestCount) { bestCount = count; bestSuit = suit; }
        }
        this.activeSuit = bestSuit;
        this.pendingSuit = null;
        this.lastEvent = `${this.seats[side].name} CALLED ${SUIT_NAMES[bestSuit]}`;
        this.endTurn(side);
    }

    ensureDeck() {
        if (this.deck.length) return true;
        if (this.discard.length <= 1) return false;
        const top = this.discard.pop();
        this.deck = this.shuffle(this.discard.splice(0));
        this.discard = [top];
        return this.deck.length > 0;
    }

    drawOne(side) {
        if (!this.ensureDeck()) return null;
        const card = this.deck.pop();
        this.hands[side].push(card);
        return card;
    }

    handleDraw(playerId) {
        if (this.phase !== 'playing' || this.pendingSuit !== null || this.seats[this.turn].isBot) return;
        const p = this.players[playerId];
        if (!p || p.seat !== this.turn || this.drawnThisTurn) return;
        if (this.playableIndices(p.seat).length) return;
        const card = this.drawOne(p.seat);
        if (!card) { this.lastEvent = 'No cards left to draw'; this.endTurn(p.seat); return; }
        this.drawnThisTurn = true;
        this.lastEvent = `${this.seats[p.seat].name} DREW A CARD`;
        if (this.isPlayable(card)) {
            this.passAllowed = true;
            p.page = Math.floor((this.hands[p.seat].length - 1) / PAGE_SIZE);
            this.render();
        } else {
            this.passAllowed = false;
            this.render();
            const side = p.seat;
            this.setTimeout(() => {
                if (this.phase === 'playing' && this.turn === side && this.drawnThisTurn) this.endTurn(side);
            }, 320);
        }
    }

    handlePass(playerId) {
        if (this.phase !== 'playing' || !this.passAllowed || this.pendingSuit !== null) return;
        const p = this.players[playerId];
        if (!p || p.seat !== this.turn) return;
        this.lastEvent = `${this.seats[p.seat].name} PASSED`;
        this.endTurn(p.seat);
    }

    endTurn(side) {
        if (this.phase !== 'playing' || this.turn !== side) return;
        this.turn = 1 - side;
        this.drawnThisTurn = false;
        this.passAllowed = false;
        this.render();
        this.scheduleBotIfNeeded();
    }

    chooseBotCard(side) {
        const playable = this.playableIndices(side);
        if (!playable.length) return -1;
        let best = -Infinity;
        let choices = [];
        for (const index of playable) {
            const card = this.hands[side][index];
            let score = card.rank === '8' ? 0 : 8;
            const remainingSameSuit = this.hands[side].filter((c, i) => i !== index && c.suit === card.suit).length;
            score += remainingSameSuit * 3;
            if (card.rank === this.topCard().rank) score += 2;
            if (score > best) { best = score; choices = [index]; }
            else if (score === best) choices.push(index);
        }
        return choices[Math.floor(Math.random() * choices.length)];
    }

    scheduleBotIfNeeded() {
        if (this.phase !== 'playing' || this.pendingSuit !== null || this.botPending || !this.hasHuman()) return;
        const seat = this.seats[this.turn];
        if (!seat || !seat.isBot) return;
        this.botPending = true;
        const side = this.turn;
        const token = ++this.botToken;
        this.setTimeout(() => {
            if (token !== this.botToken) return;
            this.botPending = false;
            if (this.phase !== 'playing' || this.turn !== side || !this.seats[side].isBot) return;
            let index = this.chooseBotCard(side);
            if (index >= 0) { this.playCard(side, index); return; }
            const card = this.drawOne(side);
            this.lastEvent = `${this.seats[side].name} DREW A CARD`;
            if (card && this.isPlayable(card)) {
                index = this.hands[side].length - 1;
                this.render();
                this.setTimeout(() => {
                    if (this.phase === 'playing' && this.turn === side && this.seats[side].isBot) this.playCard(side, index);
                }, 260);
            } else {
                this.render();
                this.setTimeout(() => {
                    if (this.phase === 'playing' && this.turn === side && this.seats[side].isBot) this.endTurn(side);
                }, 260);
            }
        }, 400);
    }

    changePage(playerId, delta) {
        const p = this.players[playerId];
        if (!p || p.seat < 0) return;
        const pages = Math.max(1, Math.ceil(this.hands[p.seat].length / PAGE_SIZE));
        p.page = Math.max(0, Math.min(pages - 1, p.page + delta));
        this.render();
    }

    handleRematch(playerId) {
        const p = this.players[playerId];
        if (!p || p.seat < 0 || this.phase !== 'over') return;
        this.resetRound();
    }

    invalidateBot() { this.botToken += 1; this.botPending = false; }
    hasHuman() { return Object.values(this.players).some(p => p.seat >= 0); }

    resetRound() {
        this.invalidateBot();
        this.startCardState();
        this.phase = this.hasHuman() ? 'playing' : 'waiting';
        for (const p of Object.values(this.players)) p.page = 0;
        this.render();
        this.scheduleBotIfNeeded();
    }

    render() {
        const top = this.topCard();
        let status = 'Welcome to the table';
        let publicInfo = '';
        if (this.phase === 'playing') {
            if (this.pendingSuit !== null) status = `${this.seats[this.pendingSuit].name}, choose a suit`;
            else status = this.seats[this.turn].isBot ? 'Computer is thinking…' : `${this.seats[this.turn].name}'s turn`;
            publicInfo = `${this.seats[BLUE].name} ${this.hands[BLUE].length} cards   ·   ${this.seats[YELLOW].name} ${this.hands[YELLOW].length} cards`;
        } else if (this.phase === 'over') {
            const winner = this.hands[BLUE].length === 0 ? BLUE : YELLOW;
            status = `${this.seats[winner].name} wins`;
            publicInfo = `${this.seats[winner].name} emptied their hand`;
        }
        this.statusText.node.text = { text: status, x: 50, y: 12, size:2.5, align: 'center', color: T.cream, font: 'default' };
        this.scoreText.node.text = { text: `${this.seats[BLUE].name} ${this.matchScores[BLUE]}   ·   ${this.matchScores[YELLOW]} ${this.seats[YELLOW].name}`, x: 50, y: 16, size:1.6, align: 'center', color: T.muted, font: 'default' };
        this.activeText.node.text = { text: `Active suit · ${this.activeSuit ? `${SUIT_SYMBOLS[this.activeSuit]} ${SUIT_NAMES[this.activeSuit]}` : '—'}`, x: 50, y: 20, size: 1.4, align: 'center', color: T.cream, font: 'default' };
        if (top) setCard(this.discardCard, top);
        this.deckCountText.node.text = { text: `${this.deck.length}`, x: 70, y: 35, size: 2.2, align: 'center', color: T.cream, font: 'default' };
        this.turnInfoText.node.text = { text: this.lastEvent ? `${this.lastEvent} · ${publicInfo}` : publicInfo, x: 50, y: 59, size: 1.2, align: 'center', color: T.muted, font: 'default' };

        for (const [pidString, p] of Object.entries(this.players)) {
            if (p.seat < 0) continue;
            const pid = Number(pidString);
            const side = p.seat;
            const view = p.view;
            const pages = Math.max(1, Math.ceil(this.hands[side].length / PAGE_SIZE));
            if (p.page >= pages) p.page = pages - 1;
            const playable = new Set(this.phase === 'playing' && this.turn === side && this.pendingSuit === null ? this.playableIndices(side) : []);
            for (let slot = 0; slot < PAGE_SIZE; slot++) {
                const index = p.page * PAGE_SIZE + slot;
                const item = view.slots[slot];
                const card = this.hands[side][index];
                if (!card) {
                    item.shape.node.playerIds = [0];
                    continue;
                }
                item.shape.node.playerIds = [pid];
                setCard(item.shape, card, playable.has(index), playable.has(index));
            }

            let hint = 'Match suit or rank · eights are wild';
            if (this.phase === 'playing' && this.turn === side) {
                if (this.pendingSuit === side) hint = 'You played an eight · choose the next suit';
                else if (playable.size) hint = 'Play a ✓ card · Match the suit, number, or play an 8';
                else if (!this.drawnThisTurn) hint = 'No playable card · draw one';
                else if (this.passAllowed) hint = 'Play the drawn card or pass';
                else hint = 'Drawn card cannot play · turn will pass';
            } else if (this.phase === 'playing') hint = `Waiting for ${this.seats[this.turn].name}`;
            else if (this.phase === 'over') hint = 'Round over · play again when ready';

            view.youText.node.text = { text: `You · ${this.seats[side].name}`, x: 50, y: 98, size: 1.1, align: 'center', color: T.cream, font: 'default' };
            view.handText.node.text = { text: `Your hand · ${this.hands[side].length} cards`, x: 50, y: 64, size:1.6, align: 'center', color: T.cream, font: 'default' };
            view.hint.node.text = { text: hint, x: 50, y: 67, size:1.9, align: 'center', color: this.phase === 'over' ? T.cream : T.muted, font: 'default' };
            view.pageText.node.text = { text: pages > 1 ? `${p.page + 1} / ${pages}` : '', x: 50, y: 92.5, size: 1.0, align: 'center', color: T.muted, font: 'default' };
            view.prev.node.playerIds = pages > 1 && p.page > 0 && this.phase !== 'over' ? [pid] : [0];
            view.next.node.playerIds = pages > 1 && p.page < pages - 1 && this.phase !== 'over' ? [pid] : [0];
            const canDraw = this.phase === 'playing' && this.turn === side && this.pendingSuit === null && !this.drawnThisTurn && playable.size === 0;
            view.draw.node.playerIds = canDraw ? [pid] : [0];
            view.pass.node.playerIds = this.phase === 'playing' && this.turn === side && this.passAllowed && this.pendingSuit === null ? [pid] : [0];
            view.rematch.node.playerIds = this.phase === 'over' ? [pid] : [0];
            for (let i = 0; i < SUITS.length; i++) view.suitButtons[i].node.playerIds = this.pendingSuit === side ? [pid] : [0];
        }
        this.base.node.onStateChange();
    }
}

module.exports = CrazyEights;
