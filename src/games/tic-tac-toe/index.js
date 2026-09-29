const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');
const { COLORS } = Colors;

const EMPTY = -1;
const X = 0;
const O = 1;
const SIDE_NAMES = ['X', 'O'];
const SIDE_COLORS = [[152, 210, 227, 255], [249, 207, 105, 255]];
const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

class TicTacToe extends Game {
    static metadata() {
        return {
            squishVersion: '142',
            name: 'Tic-Tac-Toe',
            author: 'Homegames',
            description: 'Classic three-in-a-row for one or two players.',
            aspectRatio: { x: 1, y: 1 },
            maxPlayers: 2,
            services: ['multiplayer']
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

        this.board = new Array(9).fill(EMPTY);
        this.turn = X;
        this.phase = 'waiting';
        this.winLine = [];
        this.scores = [0, 0];
        this.round = 1;
        this.lastMove = -1;
        this.botToken = 0;
        this.botPending = false;
        this.players = {};
        this.heldKeys = {};
        this.seats = [
            { playerId: null, isBot: false, name: 'Open seat' },
            { playerId: null, isBot: true, name: 'Computer' }
        ];

        this.titleText = this.makeText('Tic-Tac-Toe', 50, 5, 4.2, [244, 237, 216, 255]);
        this.statusText = this.makeText('Welcome to the table', 50, 12, 2.2, [244, 237, 216, 255]);
        this.scoreText = this.makeText('X 0   —   0 O', 50, 17, 1.7, [224, 216, 193, 255]);
        this.leftSeatText = this.makeText('X · Open seat', 24, 92, 1.45, SIDE_COLORS[X]);
        this.rightSeatText = this.makeText('O · Computer', 76, 92, 1.45, SIDE_COLORS[O]);
        this.hintText = this.makeText('First to three in a row', 50, 82.5, 1.45, [224, 216, 193, 255]);

        this.cellNodes = [];
        this.markNodes = [];
        const boardX = 23;
        const boardY = 24;
        const cell = 18;
        const gap = 1.6;

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const index = row * 3 + col;
                const x = boardX + col * (cell + gap);
                const y = boardY + row * (cell + gap);
                const cellNode = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(x, y, cell, cell),
                    fill: [66, 50, 40, 255],
                    color: [126, 91, 64, 255],
                    border: 4,
                    onClick: (playerId) => this.handleCellClick(playerId, index)
                });
                const markNode = this.makeText('', x + cell / 2, y + 2.5, 10, COLORS.WHITE);
                cellNode.addChild(markNode);
                this.cellNodes.push(cellNode);
                this.markNodes.push(markNode);
                this.base.addChild(cellNode);
            }
        }

        this.rematchButton = this.makeButton(35, 85.5, 30, 6, 'Play again', [116, 82, 53, 255], () => {
            if (this.phase === 'over') this.resetRound();
        });
        this.rematchButton.node.playerIds = [0];

        this.base.addChildren(this.titleText, this.statusText, this.scoreText, this.leftSeatText, this.rightSeatText, this.hintText, this.rematchButton);
        this.render();
    }

    getLayers() {
        return [{ root: this.base }];
    }

    handleKeyUp(playerId, key) {
        if (this.heldKeys[playerId]) this.heldKeys[playerId].delete(key);
    }

    handleKeyDown(playerId, key) {
        if (/^[1-9]$/.test(key) || key === 'Enter') {
            if (!this.heldKeys[playerId]) this.heldKeys[playerId] = new Set();
            if (this.heldKeys[playerId].has(key)) return;
            this.heldKeys[playerId].add(key);
        }
        if (/^[1-9]$/.test(key)) this.handleCellClick(playerId, Number(key) - 1);
        if (key === 'Enter' && this.players[playerId] && this.phase === 'over') this.resetRound();
    }

    makeText(text, x, y, size, color, playerIds) {
        return new GameNode.Text({
            textInfo: { text, x, y, size, align: 'center', color, font: 'default' },
            playerIds
        });
    }

    makeButton(x, y, w, h, label, fill, onClick) {
        const bg = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill,
            color: COLORS.WHITE,
            border: 3,
            onClick
        });
        bg.addChild(this.makeText(label, x + w / 2, y + 2.1, 2.1, COLORS.WHITE));
        return bg;
    }

    handleNewPlayer({ playerId, info }) {
        if (this.players[playerId]) return;
        const name = info && info.name ? String(info.name).trim().slice(0, 14) : `Player ${playerId}`;
        let seat = -1;

        if (this.seats[X].playerId === null) {
            seat = X;
        } else if (this.seats[O].isBot) {
            seat = O;
            this.invalidateBot();
        }
        if (seat < 0) return;

        this.seats[seat] = { playerId, isBot: false, name };
        const youText = this.makeText(`Playing as ${SIDE_NAMES[seat]}`, 50, 95, 1.8, [244, 237, 216, 255], [playerId]);
        this.players[playerId] = { seat, youText };
        this.base.addChild(youText);

        if (this.phase === 'waiting') this.phase = 'playing';
        this.render();
        this.scheduleBotIfNeeded();
    }

    handlePlayerDisconnect(playerId) {
        const player = this.players[playerId];
        if (!player) return;
        const seat = player.seat;
        this.base.removeChild(player.youText.id);
        delete this.players[playerId];
        delete this.heldKeys[playerId];
        this.seats[seat] = { playerId: null, isBot: true, name: 'Computer' };
        this.render();
        this.scheduleBotIfNeeded();
    }

    handleCellClick(playerId, index) {
        if (this.phase !== 'playing') return;
        const player = this.players[playerId];
        if (!player || player.seat !== this.turn) return;
        if (this.board[index] !== EMPTY) return;

        this.playMove(index, player.seat);
    }

    playMove(index, side) {
        if (this.phase !== 'playing' || side !== this.turn || this.board[index] !== EMPTY) return false;
        this.board[index] = side;
        this.lastMove = index;

        const winner = this.findWinner(this.board);
        if (winner !== null) {
            this.phase = 'over';
            this.winLine = winner.line;
            this.scores[winner.side] += 1;
            this.invalidateBot();
        } else if (this.board.every(v => v !== EMPTY)) {
            this.phase = 'over';
            this.winLine = [];
            this.invalidateBot();
        } else {
            this.turn = 1 - this.turn;
        }

        this.render();
        this.animateMark(index, side);
        this.scheduleBotIfNeeded();
        return true;
    }

    animateMark(index, side) {
        const node = this.markNodes[index];
        const sizes = [4.5, 8.2, 10.6, 10];
        const apply = (step) => {
            if (this.board[index] !== side || !node.node.text) return;
            const t = node.node.text;
            node.node.text = { text: SIDE_NAMES[side], x: t.x, y: t.y, size: sizes[step], align: 'center', color: SIDE_COLORS[side], font: 'default' };
            this.base.node.onStateChange();
            if (step + 1 < sizes.length) this.setTimeout(() => apply(step + 1), 45);
        };
        apply(0);
    }

    findWinner(board) {
        for (const line of WIN_LINES) {
            const side = board[line[0]];
            if (side !== EMPTY && board[line[1]] === side && board[line[2]] === side) {
                return { side, line };
            }
        }
        return null;
    }

    chooseBotMove() {
        let bestScore = -Infinity;
        let bestMoves = [];
        for (let i = 0; i < 9; i++) {
            if (this.board[i] !== EMPTY) continue;
            this.board[i] = O;
            const score = this.minimax(this.board, X, 0);
            this.board[i] = EMPTY;
            if (score > bestScore) {
                bestScore = score;
                bestMoves = [i];
            } else if (score === bestScore) {
                bestMoves.push(i);
            }
        }
        return bestMoves.length ? bestMoves[Math.floor(Math.random() * bestMoves.length)] : -1;
    }

    minimax(board, side, depth) {
        const winner = this.findWinner(board);
        if (winner) return winner.side === O ? 10 - depth : depth - 10;
        if (board.every(v => v !== EMPTY)) return 0;

        if (side === O) {
            let best = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] !== EMPTY) continue;
                board[i] = O;
                best = Math.max(best, this.minimax(board, X, depth + 1));
                board[i] = EMPTY;
            }
            return best;
        }

        let best = Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] !== EMPTY) continue;
            board[i] = X;
            best = Math.min(best, this.minimax(board, O, depth + 1));
            board[i] = EMPTY;
        }
        return best;
    }

    scheduleBotIfNeeded() {
        if (this.phase !== 'playing' || this.botPending || !this.hasHuman()) return;
        const seat = this.seats[this.turn];
        if (!seat || !seat.isBot) return;

        this.botPending = true;
        const token = ++this.botToken;
        this.setTimeout(() => {
            if (token !== this.botToken) return;
            this.botPending = false;
            if (this.phase !== 'playing' || !this.seats[this.turn].isBot) return;
            const move = this.turn === O ? this.chooseBotMove() : this.chooseFallbackMove();
            if (move >= 0) this.playMove(move, this.turn);
        }, 280);
    }

    chooseFallbackMove() {
        const open = [];
        for (let i = 0; i < 9; i++) if (this.board[i] === EMPTY) open.push(i);
        return open.length ? open[Math.floor(Math.random() * open.length)] : -1;
    }

    invalidateBot() {
        this.botToken += 1;
        this.botPending = false;
    }

    hasHuman() {
        return Object.keys(this.players).length > 0;
    }

    resetRound() {
        this.invalidateBot();
        this.board.fill(EMPTY);
        this.turn = X;
        this.phase = this.hasHuman() ? 'playing' : 'waiting';
        this.winLine = [];
        this.lastMove = -1;
        this.round += 1;
        this.render();
        this.scheduleBotIfNeeded();
    }

    render() {
        const won = new Set(this.winLine);
        const winner = this.findWinner(this.board);
        for (let i = 0; i < 9; i++) {
            const side = this.board[i];
            const cellNode = this.cellNodes[i];
            const isLast = i === this.lastMove;
            if (won.has(i)) cellNode.node.fill = [55, 89, 72, 255];
            else if (this.phase === 'playing' && side === EMPTY) cellNode.node.fill = [77, 60, 47, 255];
            else cellNode.node.fill = [66, 50, 40, 255];
            cellNode.node.color = won.has(i) || isLast ? COLORS.WHITE : [126, 91, 64, 255];
            cellNode.node.border = won.has(i) ? 6 : (isLast ? 5 : 4);
            this.markNodes[i].node.text = {
                text: side === EMPTY ? String(i + 1) : SIDE_NAMES[side],
                x: this.markNodes[i].node.text.x,
                y: cellNode.node.coordinates2d[0][1] + (side === EMPTY ? 6 : 2.5),
                size: side === EMPTY ? 3 : 10,
                align: 'center',
                color: side === EMPTY ? COLORS.WHITE : SIDE_COLORS[side],
                font: 'default'
            };
        }

        let status = 'Welcome to the table';
        let hint = 'First to three in a row';
        if (this.phase === 'playing') {
            const seat = this.seats[this.turn];
            const seatName = seat ? seat.name : SIDE_NAMES[this.turn];
            status = seat && seat.isBot ? 'Computer is thinking…' : `${SIDE_NAMES[this.turn]} · ${seatName}'s turn`;
            hint = seat && seat.isBot ? 'Make a line of 3: across, up, or diagonal' : 'Tap a square or press 1–9 · Make a line of 3';
        } else if (this.phase === 'over') {
            status = winner ? `${SIDE_NAMES[winner.side]} wins` : 'Draw';
            hint = winner ? `${this.seats[winner.side].name} takes the round` : 'Full board · no winner';
        }

        this.statusText.node.text = { text: status, x: 50, y: 12, size: 2.6, align: 'center', color: [244, 237, 216, 255], font: 'default' };
        this.scoreText.node.text = { text: `X ${this.scores[X]}   —   ${this.scores[O]} O`, x: 50, y: 17, size: 1.9, align: 'center', color: [224, 216, 193, 255], font: 'default' };
        this.leftSeatText.node.text = { text: `X · ${this.seats[X].name}`, x: 24, y: 92, size: 1.8, align: 'center', color: [244, 237, 216, 255], font: 'default' };
        this.rightSeatText.node.text = { text: `O · ${this.seats[O].name}`, x: 76, y: 92, size: 1.8, align: 'center', color: [244, 237, 216, 255], font: 'default' };
        this.hintText.node.text = { text: hint, x: 50, y: 82.5, size: 2.0, align: 'center', color: this.phase === 'over' ? [244, 237, 216, 255] : [224, 216, 193, 255], font: 'default' };
        this.rematchButton.node.playerIds = this.phase === 'over' ? [] : [0];
        this.base.node.onStateChange();
    }
}

module.exports = TicTacToe;
