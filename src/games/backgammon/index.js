const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { COLORS } = Colors;

const RED = 0;
const WHITE = 1;
const SIDE_NAMES = ['Red', 'White'];
const SIDE_COLORS = [[165, 67, 62, 255], [241, 232, 210, 255]];
const BOARD = [126, 88, 57, 255];
const BOARD_EDGE = [75, 50, 34, 255];
const POINT_A = [185, 105, 73, 255];
const POINT_B = [222, 188, 132, 255];
const SELECTED = [181, 145, 74, 255];
const TARGET = [103, 132, 91, 255];
const circle = (x, y, radius) => Array.from({ length: 25 }, (_, i) => {
    const angle = i * Math.PI / 12;
    return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
});

class Backgammon extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Backgammon',
            author: "Joseph Garcia",
            description: 'Classic backgammon with hits, bar entry, doubles, forced dice usage, and bearing off.',
            aspectRatio: { x: 1, y: 1 },
            maxPlayers: 2,
            gameId: "978cdfe3-4a3d-598a-a755-5d62e5433176"
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [33, 28, 23, 255]
        });
        this.tableSurface = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(3, 3, 94, 94),
            fill: [48, 76, 57, 255],
            color: [130, 94, 66, 255],
            border: 6
        });
        this.base.addChild(this.tableSurface);
        this.boardBack = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(4, 18, 92, 59),
            fill: BOARD, color: BOARD_EDGE, border: 8
        });
        this.base.addChild(this.boardBack);

        this.state = this.makeStartingState();
        this.turn = RED;
        this.phase = 'waiting';
        this.openingRolls = [null, null];
        this.rolled = false;
        this.rolledDice = [];
        this.remainingDice = [];
        this.turnSequences = [];
        this.selectedSource = null;
        this.legalDests = [];
        this.lastMove = null;
        this.lastEvent = '';
        this.matchScores = [0, 0];
        this.winPoints = 0;
        this.winType = '';
        this.winnerSide = null;
        this.cubeValue = 1;
        this.cubeOwner = null;
        this.doubleOffer = null;
        this.players = {};
        this.seats = [
            { playerId: null, isBot: false, name: 'Open seat' },
            { playerId: null, isBot: true, name: 'Computer' }
        ];
        this.botToken = 0;
        this.botPending = false;
        this.animating = false;

        this.statusText = this.makeText('Welcome to the table', 50, 8.5, 1.9, [244, 237, 216, 255]);
        this.scoreText = this.makeText('Red 0   —   0 White', 50, 12.5, 1.3, [224, 216, 193, 255]);
        this.diceText = this.makeText('—  —', 50, 43.5, 3.8, COLORS.WHITE);
        this.hintText = this.makeText('Bring all 15 checkers home, then collect them', 50, 94, 1.15, [224, 216, 193, 255]);
        this.leftSeatText = this.makeText('Red · Open seat', 22, 90, 1.2, SIDE_COLORS[RED]);
        this.rightSeatText = this.makeText('White · Computer', 78, 90, 1.2, SIDE_COLORS[WHITE]);

        this.pointNodes = [];
        this.checkerNodes = [];
        this.countNodes = [];
        for (let p = 0; p < 24; p++) {
            const geom = this.pointGeometry(p);
            const point = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: geom.coords,
                fill: p % 2 ? POINT_A : POINT_B,
                onClick: (playerId) => this.handlePointClick(playerId, p)
            });
            this.pointNodes[p] = point;
            this.checkerNodes[p] = [];
            this.base.addChild(point);
            for (let i = 0; i < 5; i++) {
                const node = this.makeChecker();
                this.checkerNodes[p].push(node);
                this.base.addChild(node);
            }
            const count = this.makeText('', geom.cx, geom.countY, 1.25, COLORS.WHITE);
            this.countNodes[p] = count;
            this.base.addChild(count);
        }

        this.barNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(46, 18, 8, 59),
            fill: [85, 57, 39, 255],
            color: BOARD_EDGE,
            border: 4,
            onClick: (playerId) => this.handleBarClick(playerId)
        });
        this.barRedText = this.makeText('', 50, 31, 2.0, SIDE_COLORS[RED]);
        this.barWhiteText = this.makeText('', 50, 61, 2.0, SIDE_COLORS[WHITE]);
        this.offRedText = this.makeText('Red off 0', 16, 80, 1.2, SIDE_COLORS[RED]);
        this.offWhiteText = this.makeText('White off 0', 84, 80, 1.2, SIDE_COLORS[WHITE]);
        this.cubeText = this.makeText('Cube 1', 50, 38.5, 1.25, [226, 205, 163, 255]);
        this.base.addChildren(this.barNode, this.barRedText, this.barWhiteText, this.offRedText, this.offWhiteText, this.cubeText);
        this.motionChecker = this.makeChecker();
        this.base.addChild(this.motionChecker);

        this.rollButton = this.makeButton(36, 81.5, 28, 5.5, 'Roll dice', [116, 82, 53, 255], (pid) => this.handleRoll(pid));
        this.offButton = this.makeButton(68, 81.5, 18, 5.5, 'Collect', COLORS.SUCCESS_GREEN, (pid) => this.handleOffClick(pid));
        this.rematchButton = this.makeButton(36, 81.5, 28, 5.5, 'Play again', [116, 82, 53, 255], () => { if (this.phase === 'over') this.resetRound(); });
        this.doubleButton = this.makeButton(8, 81.5, 20, 5.5, 'Double', [126, 91, 58, 255], (pid) => this.offerDouble(pid));
        this.takeButton = this.makeButton(31, 81.5, 18, 5.5, 'Accept', [87, 122, 84, 255], (pid) => this.answerDouble(pid, true));
        this.dropButton = this.makeButton(52, 81.5, 18, 5.5, 'Decline', [130, 72, 63, 255], (pid) => this.answerDouble(pid, false));
        this.rollButton.node.playerIds = [0];
        this.offButton.node.playerIds = [0];
        this.rematchButton.node.playerIds = [0];
        this.doubleButton.node.playerIds = [0];
        this.takeButton.node.playerIds = [0];
        this.dropButton.node.playerIds = [0];
        this.base.addChildren(this.statusText, this.scoreText, this.diceText, this.hintText, this.leftSeatText, this.rightSeatText, this.rollButton, this.offButton, this.rematchButton, this.doubleButton, this.takeButton, this.dropButton);
        this.render();
    }

    getLayers() { return [{ root: this.base }]; }

    makeText(text, x, y, size, color, playerIds) {
        return new GameNode.Text({ textInfo: { text, x, y, size, align: 'center', color, font: 'default' }, playerIds });
    }

    makeButton(x, y, w, h, label, fill, onClick) {
        const bg = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(x,y,w,h), fill, color: COLORS.WHITE, border: 3, onClick });
        bg.addChild(this.makeText(label, x + w / 2, y + 1.2, 1.8, COLORS.WHITE));
        return bg;
    }

    makeStartingState() {
        const points = new Array(24).fill(0);
        points[0] = 2;
        points[11] = 5;
        points[16] = 3;
        points[18] = 5;
        points[23] = -2;
        points[12] = -5;
        points[7] = -3;
        points[5] = -5;
        return { points, bar: [0, 0], off: [0, 0] };
    }

    cloneState(state) { return { points: state.points.slice(), bar: state.bar.slice(), off: state.off.slice() }; }
    ownCount(state, side, point) { return side === RED ? Math.max(0, state.points[point]) : Math.max(0, -state.points[point]); }
    oppCount(state, side, point) { return side === RED ? Math.max(0, -state.points[point]) : Math.max(0, state.points[point]); }

    pointGeometry(p) {
        let cx, top;
        if (p <= 5) { cx = 91 - p * 7; top = false; }
        else if (p <= 11) { cx = 43 - (p - 6) * 7; top = false; }
        else if (p <= 17) { cx = 8 + (p - 12) * 7; top = true; }
        else { cx = 56 + (p - 18) * 7; top = true; }
        const half = 3.1;
        const coords = top
            ? [[cx-half,19],[cx+half,19],[cx,46],[cx-half,19]]
            : [[cx-half,76],[cx+half,76],[cx,49],[cx-half,76]];
        return {
            cx, coords,
            stackStart: top ? 22 : 72,
            stackStep: top ? 4.4 : -4.4,
            countY: top ? 42.5 : 53
        };
    }

    handleNewPlayer({ playerId, info }) {
        if (this.players[playerId]) return;
        const name = info && info.name ? String(info.name).trim().slice(0, 14) : `Player ${playerId}`;
        let seat = -1;
        if (this.seats[RED].playerId === null) seat = RED;
        else if (this.seats[WHITE].isBot) { seat = WHITE; this.invalidateBot(); }
        if (seat < 0) return;
        this.seats[seat] = { playerId, isBot: false, name };
        const youText = this.makeText(`You: ${SIDE_NAMES[seat]}`, 50, 15.3, 1.8, [244, 237, 216, 255], [playerId]);
        this.players[playerId] = { seat, youText };
        this.base.addChild(youText);
        if (this.phase === 'waiting') { this.phase = 'opening'; this.openingRolls = [null, null]; }
        this.render();
        this.scheduleBotIfNeeded();
    }

    handlePlayerDisconnect(playerId) {
        const p = this.players[playerId];
        if (!p) return;
        this.base.removeChild(p.youText.id);
        delete this.players[playerId];
        this.seats[p.seat] = { playerId: null, isBot: true, name: 'Computer' };
        this.selectedSource = null;
        this.legalDests = [];

        // A cube offer is a real turn decision. If the recipient leaves, the
        // replacement computer answers it; if the offering player leaves,
        // cancel their outstanding offer and let the computer continue the turn.
        if (this.phase === 'doubling' && this.doubleOffer) {
            if (this.doubleOffer.to === p.seat) {
                const take = this.shouldBotTakeDouble(p.seat);
                this.resolveDoubleOffer(take);
                return;
            }
            if (this.doubleOffer.from === p.seat) {
                this.doubleOffer = null;
                this.phase = 'playing';
                this.lastEvent = 'Cube offer withdrawn';
            }
        }

        this.render();
        this.scheduleBotIfNeeded();
    }

    canOfferDouble(side) {
        return this.phase === 'playing' && !this.animating && !this.rolled && this.doubleOffer === null && (this.cubeOwner === null || this.cubeOwner === side) && this.cubeValue < 64;
    }

    offerDouble(playerId) {
        if (!this.canOfferDouble(this.turn) || this.seats[this.turn].isBot) return;
        const p = this.players[playerId];
        if (!p || p.seat !== this.turn) return;
        this.beginDoubleOffer(this.turn);
    }

    beginDoubleOffer(side) {
        if (!this.canOfferDouble(side)) return false;
        this.doubleOffer = { from: side, to: 1 - side };
        this.phase = 'doubling';
        this.lastEvent = `${this.seats[side].name} offers ${this.cubeValue * 2}`;
        this.render();
        if (this.seats[1 - side].isBot) {
            const token = ++this.botToken;
            this.setTimeout(() => {
                if (token !== this.botToken || this.phase !== 'doubling' || !this.doubleOffer) return;
                this.resolveDoubleOffer(this.shouldBotTakeDouble(1 - side));
            }, 360);
        }
        return true;
    }

    answerDouble(playerId, take) {
        if (this.phase !== 'doubling' || !this.doubleOffer) return;
        const p = this.players[playerId];
        if (!p || p.seat !== this.doubleOffer.to) return;
        this.resolveDoubleOffer(!!take);
    }

    shouldBotTakeDouble(side) {
        const mine = this.pipCount(this.state, side);
        const theirs = this.pipCount(this.state, 1 - side);
        if (this.state.off[side] > this.state.off[1 - side] + 4) return true;
        return mine <= theirs * 1.28;
    }

    shouldBotOfferDouble(side) {
        if (!this.canOfferDouble(side)) return false;
        const mine = this.pipCount(this.state, side);
        const theirs = this.pipCount(this.state, 1 - side);
        return this.state.off[side] >= this.state.off[1 - side] + 3 || mine < theirs * 0.82;
    }

    resolveDoubleOffer(take) {
        if (this.phase !== 'doubling' || !this.doubleOffer) return;
        const offer = this.doubleOffer;
        this.doubleOffer = null;
        if (!take) {
            this.phase = 'over';
            this.winPoints = this.cubeValue;
            this.winType = 'Drop';
            this.winnerSide = offer.from;
            this.matchScores[offer.from] += this.cubeValue;
            this.lastEvent = `${this.seats[offer.to].name} drops`;
            this.invalidateBot();
            this.render();
            return;
        }
        this.cubeValue *= 2;
        this.cubeOwner = offer.to;
        this.phase = 'playing';
        this.lastEvent = `${this.seats[offer.to].name} takes · cube ${this.cubeValue}`;
        this.render();
        this.scheduleBotIfNeeded();
    }

    handleRoll(playerId) {
        const p = this.players[playerId];
        if (!p) return;
        if (this.phase === 'opening') {
            if (p.seat < 0 || this.seats[p.seat].isBot || this.openingRolls[p.seat] !== null) return;
            this.rollOpeningDie(p.seat);
            return;
        }
        if (this.phase !== 'playing' || this.rolled || this.seats[this.turn].isBot) return;
        if (p.seat !== this.turn) return;
        this.rollForTurn(this.turn);
    }

    rollOpeningDie(side) {
        if (this.phase !== 'opening' || this.openingRolls[side] !== null) return false;
        this.openingRolls[side] = 1 + Math.floor(Math.random() * 6);
        this.lastEvent = `${this.seats[side].name} rolled ${this.openingRolls[side]}`;
        this.render();
        this.finishOpeningRollIfReady();
        this.scheduleBotIfNeeded();
        return true;
    }

    finishOpeningRollIfReady() {
        if (this.phase !== 'opening' || this.openingRolls.some(v => v === null)) return;
        const [redDie, whiteDie] = this.openingRolls;
        if (redDie === whiteDie) {
            this.lastEvent = `Tie on ${redDie} · roll again`;
            const token = ++this.botToken;
            this.setTimeout(() => {
                if (token !== this.botToken || this.phase !== 'opening') return;
                this.openingRolls = [null, null];
                this.render();
                this.scheduleBotIfNeeded();
            }, 450);
            return;
        }
        this.turn = redDie > whiteDie ? RED : WHITE;
        this.phase = 'playing';
        this.rolledDice = [redDie, whiteDie];
        this.remainingDice = this.rolledDice.slice();
        this.rolled = true;
        this.turnSequences = this.generateTurnSequences(this.state, this.turn, this.rolledDice);
        this.lastEvent = `${this.seats[this.turn].name} starts with ${redDie} and ${whiteDie}`;
        this.render();
        if (!this.turnSequences.length || this.turnSequences[0].length === 0) this.endTurn(this.turn);
        else this.scheduleBotIfNeeded();
    }

    rollForTurn(side) {
        if (this.phase !== 'playing' || this.turn !== side || this.rolled) return false;
        const d1 = 1 + Math.floor(Math.random() * 6);
        const d2 = 1 + Math.floor(Math.random() * 6);
        this.rolledDice = d1 === d2 ? [d1,d1,d1,d1] : [d1,d2];
        this.remainingDice = this.rolledDice.slice();
        this.rolled = true;
        this.selectedSource = null;
        this.legalDests = [];
        this.turnSequences = this.generateTurnSequences(this.state, side, this.rolledDice);
        this.lastEvent = `${SIDE_NAMES[side]} ROLLED ${d1}${d1 === d2 ? ` DOUBLES` : ` + ${d2}`}`;
        this.render();
        if (!this.turnSequences.length || this.turnSequences[0].length === 0) {
            const token = ++this.botToken;
            this.setTimeout(() => {
                if (token !== this.botToken || this.phase !== 'playing' || this.turn !== side) return;
                this.lastEvent = 'No legal moves';
                this.endTurn(side);
            }, 500);
        }
        return true;
    }

    legalSingleMoves(state, side, die) {
        const moves = [];
        const dir = side === RED ? 1 : -1;
        if (state.bar[side] > 0) {
            const dest = side === RED ? die - 1 : 24 - die;
            if (this.oppCount(state, side, dest) < 2) moves.push({ source: 'bar', dest, die });
            return moves;
        }

        const canBear = this.canBearOff(state, side);
        for (let p = 0; p < 24; p++) {
            if (this.ownCount(state, side, p) <= 0) continue;
            const dest = p + dir * die;
            if (dest >= 0 && dest < 24) {
                if (this.oppCount(state, side, dest) < 2) moves.push({ source: p, dest, die });
            } else if (canBear && this.canBearFrom(state, side, p, die)) {
                moves.push({ source: p, dest: 'off', die });
            }
        }
        return moves;
    }

    canBearOff(state, side) {
        if (state.bar[side] > 0) return false;
        if (side === RED) {
            for (let p = 0; p < 18; p++) if (this.ownCount(state, side, p) > 0) return false;
        } else {
            for (let p = 6; p < 24; p++) if (this.ownCount(state, side, p) > 0) return false;
        }
        return true;
    }

    canBearFrom(state, side, point, die) {
        if (side === RED) {
            const distance = 24 - point;
            if (die === distance) return true;
            if (die < distance) return false;
            for (let p = 18; p < point; p++) if (this.ownCount(state, side, p) > 0) return false;
            return true;
        }
        const distance = point + 1;
        if (die === distance) return true;
        if (die < distance) return false;
        for (let p = point + 1; p <= 5; p++) if (this.ownCount(state, side, p) > 0) return false;
        return true;
    }

    applySingleMove(state, side, move) {
        if (move.source === 'bar') state.bar[side] -= 1;
        else state.points[move.source] += side === RED ? -1 : 1;

        if (move.dest === 'off') {
            state.off[side] += 1;
            return;
        }
        if (this.oppCount(state, side, move.dest) === 1) {
            state.points[move.dest] = 0;
            state.bar[1 - side] += 1;
        }
        state.points[move.dest] += side === RED ? 1 : -1;
    }

    generateTurnSequences(state, side, dice) {
        const out = [];
        const walk = (cur, remaining, seq) => {
            let extended = false;
            const seenDice = new Set();
            for (let i = 0; i < remaining.length; i++) {
                const die = remaining[i];
                if (seenDice.has(die)) continue;
                seenDice.add(die);
                const moves = this.legalSingleMoves(cur, side, die);
                for (const move of moves) {
                    extended = true;
                    const next = this.cloneState(cur);
                    this.applySingleMove(next, side, move);
                    const rest = remaining.slice();
                    rest.splice(i, 1);
                    walk(next, rest, seq.concat([move]));
                }
            }
            if (!extended) out.push(seq);
        };
        walk(this.cloneState(state), dice.slice(), []);
        if (!out.length) return [];
        const maxLen = Math.max(...out.map(s => s.length));
        let best = out.filter(s => s.length === maxLen);
        if (maxLen === 1 && dice.length === 2 && dice[0] !== dice[1]) {
            const high = Math.max(...best.map(s => s[0].die));
            best = best.filter(s => s[0].die === high);
        }
        const unique = [];
        const seen = new Set();
        for (const seq of best) {
            const key = seq.map(m => `${m.source}>${m.dest}@${m.die}`).join('|');
            if (!seen.has(key)) { seen.add(key); unique.push(seq); }
        }
        return unique;
    }

    availableNextMoves() {
        const out = [];
        const seen = new Set();
        for (const seq of this.turnSequences) {
            if (!seq.length) continue;
            const m = seq[0];
            const key = `${m.source}>${m.dest}@${m.die}`;
            if (!seen.has(key)) { seen.add(key); out.push(m); }
        }
        return out;
    }

    handlePointClick(playerId, point) {
        if (this.phase !== 'playing' || !this.rolled || this.animating || this.seats[this.turn].isBot) return;
        const p = this.players[playerId];
        if (!p || p.seat !== this.turn) return;
        if (this.selectedSource !== null) {
            const move = this.legalDests.find(m => m.dest === point);
            if (move) { this.commitStep(move, p.seat); return; }
        }
        this.selectSource(point);
    }

    handleBarClick(playerId) {
        if (this.phase !== 'playing' || !this.rolled || this.animating || this.seats[this.turn].isBot) return;
        const p = this.players[playerId];
        if (!p || p.seat !== this.turn) return;
        this.selectSource('bar');
    }

    handleOffClick(playerId) {
        if (this.phase !== 'playing' || !this.rolled || this.animating || this.seats[this.turn].isBot || this.selectedSource === null) return;
        const p = this.players[playerId];
        if (!p || p.seat !== this.turn) return;
        const move = this.legalDests.find(m => m.dest === 'off');
        if (move) this.commitStep(move, p.seat);
    }

    selectSource(source) {
        const moves = this.availableNextMoves().filter(m => m.source === source);
        if (!moves.length) {
            this.selectedSource = null;
            this.legalDests = [];
        } else if (this.selectedSource === source) {
            this.selectedSource = null;
            this.legalDests = [];
        } else {
            this.selectedSource = source;
            this.legalDests = moves;
        }
        this.render();
    }

    sameStep(a, b) { return a.source === b.source && a.dest === b.dest && a.die === b.die; }

    finishGame(side) {
        const loser = 1 - side;
        let points = 1;
        let type = 'Single game';
        if (this.state.off[loser] === 0) {
            points = 2;
            type = 'Gammon';
            const winnerHome = side === RED ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
            const loserInWinnerHome = winnerHome.some(p => this.ownCount(this.state, loser, p) > 0);
            if (this.state.bar[loser] > 0 || loserInWinnerHome) {
                points = 3;
                type = 'Backgammon';
            }
        }
        points *= this.cubeValue;
        this.phase = 'over';
        this.winPoints = points;
        this.winType = type;
        this.winnerSide = side;
        this.matchScores[side] += points;
        this.invalidateBot();
        this.render();
    }

    commitStep(move, side) {
        if (this.phase !== 'playing' || side !== this.turn || this.animating) return false;
        const valid = this.availableNextMoves().find(m => this.sameStep(m, move));
        if (!valid) return false;
        this.selectedSource = null;
        this.legalDests = [];
        this.render();
        this.animateCheckerMove(valid, side, () => this.finishCommittedStep(valid, side));
        return true;
    }

    finishCommittedStep(valid, side) {
        if (this.phase !== 'playing' || side !== this.turn) return;
        this.applySingleMove(this.state, side, valid);
        this.lastMove = { side, ...valid };
        const idx = this.remainingDice.indexOf(valid.die);
        if (idx >= 0) this.remainingDice.splice(idx, 1);
        this.turnSequences = this.turnSequences.filter(seq => seq.length && this.sameStep(seq[0], valid)).map(seq => seq.slice(1));
        if (this.state.off[side] >= 15) {
            this.finishGame(side);
            return;
        }
        if (!this.turnSequences.length || this.turnSequences.every(seq => seq.length === 0)) this.endTurn(side);
        else this.render();
    }

    makeChecker() {
        return new GameNode.Shape({ shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0), fill: SIDE_COLORS[RED],
            color: [44, 31, 27, 255], border: 7, playerIds: [0] });
    }

    drawChecker(node, x, y, side, visible = true) {
        node.node.coordinates2d = circle(x, y + 1.5, 2.1);
        node.node.fill = SIDE_COLORS[side];
        node.node.playerIds = visible ? [] : [0];
    }

    checkerMotionPosition(place, side, arriving) {
        if (place === 'bar') return { x: 50, y: side === RED ? 31 : 61 };
        if (place === 'off') return { x: side === RED ? 16 : 84, y: 80 };
        const geom = this.pointGeometry(place);
        const count = this.ownCount(this.state, side, place);
        const index = arriving ? Math.min(count, 4) : Math.max(0, Math.min(count, 5) - 1);
        return { x: geom.cx, y: geom.stackStart + geom.stackStep * index };
    }

    previewCheckerLift(source, side) {
        if (source === 'bar') {
            const left = Math.max(0, this.state.bar[side] - 1);
            if (side === RED) this.barRedText.node.text = { text: left ? `Red bar ×${left}` : '', x: 50, y: 31, size: 2.0, align: 'center', color: SIDE_COLORS[RED], font: 'default' };
            else this.barWhiteText.node.text = { text: left ? `White bar ×${left}` : '', x: 50, y: 61, size: 2.0, align: 'center', color: SIDE_COLORS[WHITE], font: 'default' };
            return;
        }
        if (source === 'off') return;
        const geom = this.pointGeometry(source);
        const left = Math.max(0, this.ownCount(this.state, side, source) - 1);
        for (let i = 0; i < 5; i++) {
            const node = this.checkerNodes[source][i];
            this.drawChecker(node, geom.cx, geom.stackStart + geom.stackStep * i, side, i < Math.min(left, 5));
        }
        this.countNodes[source].node.text = { text: left > 5 ? `×${left}` : '', x: geom.cx, y: geom.countY, size: 1.25, align: 'center', color: SIDE_COLORS[side], font: 'default' };
    }

    animateCheckerMove(move, side, onDone) {
        if (this.animating) return;
        this.animating = true;
        const from = this.checkerMotionPosition(move.source, side, false);
        const to = this.checkerMotionPosition(move.dest, side, true);
        this.previewCheckerLift(move.source, side);
        this.motionChecker.node.playerIds = [];
        const frames = 8;
        const step = (frame) => {
            if (!this.animating) return;
            const t = frame / frames;
            const eased = t * t * (3 - 2 * t);
            const lift = Math.sin(Math.PI * t) * 2.2;
            this.drawChecker(this.motionChecker, from.x + (to.x - from.x) * eased, from.y + (to.y - from.y) * eased - lift, side);
            this.base.node.onStateChange();
            if (frame >= frames) {
                this.motionChecker.node.playerIds = [0];
                this.animating = false;
                if (onDone) onDone();
            } else this.setTimeout(() => step(frame + 1), 22);
        };
        step(0);
    }

    endTurn(side) {
        if (this.phase !== 'playing' || this.turn !== side) return;
        this.turn = 1 - side;
        this.rolled = false;
        this.rolledDice = [];
        this.remainingDice = [];
        this.turnSequences = [];
        this.selectedSource = null;
        this.legalDests = [];
        this.render();
        this.scheduleBotIfNeeded();
    }

    pipCount(state, side) {
        let total = state.bar[side] * 25;
        for (let p = 0; p < 24; p++) {
            const n = this.ownCount(state, side, p);
            const dist = side === RED ? 24 - p : p + 1;
            total += n * dist;
        }
        return total;
    }

    evaluateSequence(side, seq) {
        const test = this.cloneState(this.state);
        const oppBarBefore = test.bar[1 - side];
        for (const move of seq) this.applySingleMove(test, side, move);
        return test.off[side] * 1000 - this.pipCount(test, side) + (test.bar[1-side] - oppBarBefore) * 65 - test.bar[side] * 50;
    }

    scheduleBotIfNeeded() {
        if (this.botPending || this.animating || !this.hasHuman()) return;
        if (this.phase === 'opening') {
            const side = this.openingRolls.findIndex((v, i) => v === null && this.seats[i].isBot);
            if (side < 0) return;
            this.botPending = true;
            const token = ++this.botToken;
            this.setTimeout(() => {
                if (token !== this.botToken) return;
                this.botPending = false;
                if (this.phase !== 'opening' || !this.seats[side].isBot || this.openingRolls[side] !== null) return;
                this.rollOpeningDie(side);
            }, 300);
            return;
        }
        if (this.phase !== 'playing') return;
        const seat = this.seats[this.turn];
        if (!seat || !seat.isBot) return;
        this.botPending = true;
        const side = this.turn;
        const token = ++this.botToken;
        this.setTimeout(() => {
            if (token !== this.botToken) return;
            this.botPending = false;
            if (this.phase !== 'playing' || this.turn !== side || !this.seats[side].isBot) return;
            if (!this.rolled && this.shouldBotOfferDouble(side)) { this.beginDoubleOffer(side); return; }
            if (!this.rolled) this.rollForTurn(side);
            if (this.phase !== 'playing' || this.turn !== side || !this.turnSequences.length || !this.turnSequences[0].length) return;
            let best = -Infinity;
            let choices = [];
            for (const seq of this.turnSequences) {
                const score = this.evaluateSequence(side, seq);
                if (score > best) { best = score; choices = [seq]; }
                else if (score === best) choices.push(seq);
            }
            const seq = choices[Math.floor(Math.random() * choices.length)];
            this.playBotSequence(side, seq, 0, token);
        }, 380);
    }

    playBotSequence(side, seq, index, token) {
        if (token !== this.botToken || this.phase !== 'playing' || this.turn !== side || this.animating) return;
        if (index >= seq.length) { this.endTurn(side); return; }
        const move = seq[index];
        this.animateCheckerMove(move, side, () => {
            if (token !== this.botToken || this.phase !== 'playing' || this.turn !== side) return;
            this.applySingleMove(this.state, side, move);
            this.lastMove = { side, ...move };
            const di = this.remainingDice.indexOf(move.die);
            if (di >= 0) this.remainingDice.splice(di, 1);
            if (this.state.off[side] >= 15) { this.finishGame(side); return; }
            this.render();
            this.setTimeout(() => this.playBotSequence(side, seq, index + 1, token), 100);
        });
    }

    invalidateBot() { this.botToken += 1; this.botPending = false; }
    hasHuman() { return Object.keys(this.players).length > 0; }

    resetRound() {
        this.invalidateBot();
        this.state = this.makeStartingState();
        this.turn = RED;
        this.phase = this.hasHuman() ? 'opening' : 'waiting';
        this.openingRolls = [null, null];
        this.rolled = false;
        this.rolledDice = [];
        this.remainingDice = [];
        this.turnSequences = [];
        this.selectedSource = null;
        this.legalDests = [];
        this.lastMove = null;
        this.lastEvent = '';
        this.winPoints = 0;
        this.winType = '';
        this.winnerSide = null;
        this.cubeValue = 1;
        this.cubeOwner = null;
        this.doubleOffer = null;
        this.animating = false;
        if (this.motionChecker) this.motionChecker.node.playerIds = [0];
        this.render();
        this.scheduleBotIfNeeded();
    }

    render() {
        const next = this.phase === 'playing' && this.rolled ? this.availableNextMoves() : [];
        const starts = new Set(next.map(m => String(m.source)));
        const dests = new Set(this.legalDests.filter(m => m.dest !== 'off').map(m => String(m.dest)));
        for (let p = 0; p < 24; p++) {
            const point = this.pointNodes[p];
            if (String(this.selectedSource) === String(p)) point.node.fill = SELECTED;
            else if (dests.has(String(p))) point.node.fill = TARGET;
            else if (starts.has(String(p))) point.node.fill = p % 2 ? [199, 119, 82, 255] : [235, 202, 143, 255];
            else point.node.fill = p % 2 ? POINT_A : POINT_B;

            point.node.color = [250, 241, 219, 255];
            point.node.border = String(this.selectedSource) === String(p) ? 12 : dests.has(String(p)) ? 9 : starts.has(String(p)) ? 7 : undefined;
            const raw = this.state.points[p];
            const count = Math.abs(raw);
            const side = raw > 0 ? RED : WHITE;
            for (let i = 0; i < 5; i++) {
                const node = this.checkerNodes[p][i];
                const geom = this.pointGeometry(p);
                this.drawChecker(node, geom.cx, geom.stackStart + geom.stackStep * i, side, i < Math.min(count, 5));
            }
            const geom = this.pointGeometry(p);
            this.countNodes[p].node.text = { text: count > 5 ? `×${count}` : '', x: geom.cx, y: geom.countY, size: 1.25, align: 'center', color: count ? SIDE_COLORS[side] : COLORS.WHITE, font: 'default' };
        }

        const barSelectable = starts.has('bar');
        this.barNode.node.fill = this.selectedSource === 'bar' ? SELECTED : (barSelectable ? [111, 83, 54, 255] : [85, 57, 39, 255]);
        this.barRedText.node.text = { text: this.state.bar[RED] ? `Red bar ×${this.state.bar[RED]}` : '', x: 50, y: 31, size: 2.0, align: 'center', color: SIDE_COLORS[RED], font: 'default' };
        this.barWhiteText.node.text = { text: this.state.bar[WHITE] ? `White bar ×${this.state.bar[WHITE]}` : '', x: 50, y: 61, size: 2.0, align: 'center', color: SIDE_COLORS[WHITE], font: 'default' };
        this.offRedText.node.text = { text: `Red collected ${this.state.off[RED]}`, x: 16, y: 80, size: 1.6, align: 'center', color: [244, 237, 216, 255], font: 'default' };
        this.offWhiteText.node.text = { text: `White collected ${this.state.off[WHITE]}`, x: 84, y: 80, size: 1.6, align: 'center', color: [244, 237, 216, 255], font: 'default' };

        let status = 'Welcome to the table';
        let hint = 'Bring all 15 checkers home, then collect them';
        if (this.phase === 'opening') {
            status = 'Roll dice · Higher roll starts';
            const red = this.openingRolls[RED] === null ? '—' : this.openingRolls[RED];
            const white = this.openingRolls[WHITE] === null ? '—' : this.openingRolls[WHITE];
            hint = `${this.seats[RED].name} ${red}   ·   ${white} ${this.seats[WHITE].name}`;
        } else if (this.phase === 'playing') {
            const seat = this.seats[this.turn];
            status = seat.isBot ? 'Computer is thinking…' : `${SIDE_NAMES[this.turn]} · ${seat.name}'s turn`;
            if (!this.rolled || seat.isBot) hint = '';
            else if (this.selectedSource !== null) hint = 'Choose a highlighted point';
            else if (this.state.bar[this.turn] > 0) hint = 'Move a captured checker first';
            else hint = 'Choose a checker';
        } else if (this.phase === 'doubling' && this.doubleOffer) {
            status = `${this.seats[this.doubleOffer.from].name} offers the cube`;
            hint = `Accept: play for ${this.cubeValue * 2} points · Decline: lose ${this.cubeValue}`;
        } else if (this.phase === 'over') {
            const winner = this.winnerSide === null ? (this.state.off[RED] >= 15 ? RED : WHITE) : this.winnerSide;
            status = `${this.seats[winner].name} wins`;
            hint = `${this.winType} · ${this.winPoints} point${this.winPoints === 1 ? '' : 's'}`;
        }

        const diceDisplay = this.rolled ? this.remainingDice.map(d => `[${d}]`).join(' ') : '—  —';
        this.statusText.node.text = { text: status, x: 50, y: 8.5, size: 2.6, align: 'center', color: [244, 237, 216, 255], font: 'default' };
        this.scoreText.node.text = { text: `Red ${this.matchScores[RED]}   —   ${this.matchScores[WHITE]} White`, x: 50, y: 12.5, size: 1.9, align: 'center', color: [224, 216, 193, 255], font: 'default' };
        this.scoreText.node.playerIds = this.matchScores.some(score => score > 0) ? [] : [0];
        this.diceText.node.text = { text: diceDisplay, x: 50, y: 43.5, size: 3.8, align: 'center', color: COLORS.WHITE, font: 'default' };
        this.hintText.node.text = { text: hint, x: 50, y: 94, size: 2.0, align: 'center', color: this.phase === 'over' ? [244, 237, 216, 255] : [224, 216, 193, 255], font: 'default' };
        this.leftSeatText.node.text = { text: `Red · ${this.seats[RED].name}`, x: 22, y: 90, size: 1.8, align: 'center', color: [244, 237, 216, 255], font: 'default' };
        this.rightSeatText.node.text = { text: `White · ${this.seats[WHITE].name}`, x: 78, y: 90, size: 1.8, align: 'center', color: [244, 237, 216, 255], font: 'default' };
        this.cubeText.node.text = { text: `Cube ${this.cubeValue}${this.cubeOwner === null ? '' : ` · ${SIDE_NAMES[this.cubeOwner]}`}`, x: 50, y: 38.5, size: 1.25, align: 'center', color: [226, 205, 163, 255], font: 'default' };

        const currentPid = this.phase === 'playing' ? this.seats[this.turn].playerId : null;
        if (this.phase === 'opening') {
            const waitingHuman = [RED, WHITE].find(side => this.openingRolls[side] === null && !this.seats[side].isBot && this.seats[side].playerId !== null);
            this.rollButton.node.playerIds = waitingHuman === undefined ? [0] : [this.seats[waitingHuman].playerId];
        } else this.rollButton.node.playerIds = this.phase === 'playing' && !this.rolled && currentPid !== null ? [currentPid] : [0];
        this.offButton.node.playerIds = this.phase === 'playing' && currentPid !== null && this.legalDests.some(m => m.dest === 'off') ? [currentPid] : [0];
        this.doubleButton.node.playerIds = this.phase === 'playing' && currentPid !== null && this.canOfferDouble(this.turn) ? [currentPid] : [0];
        const offerPid = this.phase === 'doubling' && this.doubleOffer ? this.seats[this.doubleOffer.to].playerId : null;
        this.takeButton.node.playerIds = offerPid !== null ? [offerPid] : [0];
        this.dropButton.node.playerIds = offerPid !== null ? [offerPid] : [0];
        this.rematchButton.node.playerIds = this.phase === 'over' ? [] : [0];
        this.base.node.onStateChange();
    }
}

module.exports = Backgammon;
