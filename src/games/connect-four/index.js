const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { COLORS } = Colors;

const ROWS = 6;
const COLS = 7;
const EMPTY = -1;
const RED = 0;
const YELLOW = 1;
const SIDE_NAMES = ['Red', 'Gold'];
const SIDE_COLORS = [[230, 105, 85, 255], [249, 204, 92, 255]];
const SIDE_MARKS = ['●', '○'];

const polyCircle = (cx, cy, r, sides = 18) => {
    const pts = [];
    for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
};

class ConnectFour extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Connect Four',
            author: "Joseph Garcia",
            description: 'Drop four in a row before your opponent does.',
            aspectRatio: { x: 1, y: 1 },
            maxPlayers: 2,
            gameId: "748764a5-e977-57cc-a2a3-101f319832ad"
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

        this.board = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
        this.turn = RED;
        this.phase = 'waiting';
        this.winningCells = [];
        this.lastDrop = null;
        this.scores = [0, 0];
        this.players = {};
        this.heldKeys = {};
        this.seats = [
            { playerId: null, isBot: false, name: 'Open seat' },
            { playerId: null, isBot: true, name: 'Computer' }
        ];
        this.botToken = 0;
        this.botPending = false;
        this.animating = false;
        this.dropAnimationToken = 0;
        this.boardStartX = 17;
        this.boardStartY = 26;
        this.boardXGap = 11;
        this.boardYGap = 9.5;

        this.statusText = this.makeText('Welcome to the table', 50, 10.8, 2.1, [244, 237, 216, 255]);
        this.scoreText = this.makeText('Red 0   —   0 Gold', 50, 15.5, 1.55, [224, 216, 193, 255]);
        this.leftSeatText = this.makeText('Red · Open seat', 23, 92, 1.4, SIDE_COLORS[RED]);
        this.rightSeatText = this.makeText('Gold · Computer', 77, 92, 1.4, SIDE_COLORS[YELLOW]);
        this.hintText = this.makeText('Drop four in a row', 50, 84.2, 1.35, [224, 216, 193, 255]);

        this.boardBack = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(11, 20, 78, 61),
            fill: [48, 100, 124, 255],
            color: [151, 197, 208, 255],
            border: 8
        });
        this.base.addChild(this.boardBack);

        // The whole column is a target, including the spaces between slots.
        this.columnLabels = [];
        for (let col = 0; col < COLS; col++) {
            this.base.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(this.boardStartX + col * this.boardXGap - 5.5, 20, 11, 61),
                fill: [0, 0, 0, 0],
                onClick: (pid) => this.handleColumnClick(pid, col)
            }));
            const label = this.makeText(String(col + 1), this.boardStartX + col * this.boardXGap, 20.4, 1.8, COLORS.WHITE);
            this.columnLabels.push(label);
            this.base.addChild(label);
        }
        this.slotNodes = [];
        this.discMarks = [];
        for (let row = 0; row < ROWS; row++) {
            this.slotNodes[row] = [];
            this.discMarks[row] = [];
            for (let col = 0; col < COLS; col++) {
                const cx = this.boardStartX + col * this.boardXGap;
                const cy = this.boardStartY + row * this.boardYGap;
                const slot = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: polyCircle(cx, cy, 3.8),
                    fill: [25, 51, 65, 255],
                    color: [61, 43, 32, 255],
                    border: 3,
                    onClick: (playerId) => this.handleColumnClick(playerId, col)
                });
                this.slotNodes[row][col] = slot;
                const mark = this.makeText('', cx, cy - 1.7, 3.2, [49, 39, 31, 255]);
                this.discMarks[row][col] = mark;
                this.base.addChildren(slot, mark);
            }
        }

        this.fallingDisc = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: [0, 0, 0, 0],
            color: [61, 43, 32, 255],
            border: 3,
            playerIds: [0]
        });
        this.base.addChild(this.fallingDisc);

        this.rematchButton = this.makeButton(35, 85.6, 30, 6, 'Play again', [116, 82, 53, 255], () => {
            if (this.phase === 'over') this.resetRound();
        });
        this.rematchButton.node.playerIds = [0];
        this.base.addChildren(this.statusText, this.scoreText, this.leftSeatText, this.rightSeatText, this.hintText, this.rematchButton);
        this.render();
    }

    getLayers() {
        return [{ root: this.base }];
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
        if (this.seats[RED].playerId === null) seat = RED;
        else if (this.seats[YELLOW].isBot) {
            seat = YELLOW;
            this.invalidateBot();
        }
        if (seat < 0) return;

        this.seats[seat] = { playerId, isBot: false, name };
        const youText = this.makeText(`You: ${SIDE_NAMES[seat]}`, 50, 95, 1.8, [244, 237, 216, 255], [playerId]);
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

    handleColumnClick(playerId, col) {
        if (this.phase !== 'playing' || this.animating) return;
        const player = this.players[playerId];
        if (!player || player.seat !== this.turn) return;
        this.dropDisc(col, player.seat);
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
        if (/^[1-7]$/.test(key)) this.handleColumnClick(playerId, Number(key) - 1);
        if (key === 'Enter' && this.players[playerId] && this.phase === 'over') this.resetRound();
    }

    dropDisc(col, side) {
        if (this.phase !== 'playing' || side !== this.turn || this.animating || !Number.isInteger(col) || col < 0 || col >= COLS) return false;
        const row = this.lowestOpenRow(this.board, col);
        if (row < 0) return false;

        this.animateDiscDrop(col, row, side, () => {
            this.board[row][col] = side;
            this.lastDrop = { row, col, side };
            const winner = this.findWinner(this.board);
            if (winner) {
                this.phase = 'over';
                this.winningCells = winner.cells;
                this.scores[winner.side] += 1;
                this.invalidateBot();
            } else if (this.isFull(this.board)) {
                this.phase = 'over';
                this.winningCells = [];
                this.lastDrop = null;
                this.invalidateBot();
            } else {
                this.turn = 1 - this.turn;
            }

            this.render();
            this.scheduleBotIfNeeded();
        });
        return true;
    }

    animateDiscDrop(col, row, side, onDone) {
        const token = ++this.dropAnimationToken;
        this.animating = true;
        this.render();
        const startX = this.boardStartX + col * this.boardXGap;
        const startY = 18;
        const endY = this.boardStartY + row * this.boardYGap;
        const frames = 10 + row * 2;
        const delayMs = 16;
        const bounce = row > 0 ? Math.min(2.4, 0.7 + row * 0.22) : 0;

        this.fallingDisc.node.fill = SIDE_COLORS[side];
        this.fallingDisc.node.color = [61, 43, 32, 255];
        this.fallingDisc.node.border = 3;
        this.fallingDisc.node.playerIds = [];

        const stepFrame = (frame) => {
            if (token !== this.dropAnimationToken) return;
            const t = frame / frames;
            let cy;
            if (t < 0.82) {
                const eased = 1 - ((1 - (t / 0.82)) * (1 - (t / 0.82)));
                cy = startY + (endY - startY + bounce) * eased;
            } else {
                const settle = (t - 0.82) / 0.18;
                cy = endY + bounce * (1 - settle);
            }
            this.fallingDisc.node.coordinates2d = polyCircle(startX, cy, 3.8);
            this.base.node.onStateChange();
            if (frame >= frames) {
                this.fallingDisc.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                this.fallingDisc.node.fill = [0, 0, 0, 0];
                this.fallingDisc.node.playerIds = [0];
                this.animating = false;
                this.base.node.onStateChange();
                onDone();
                return;
            }
            this.setTimeout(() => stepFrame(frame + 1), delayMs);
        };

        stepFrame(0);
    }

    lowestOpenRow(board, col) {
        for (let row = ROWS - 1; row >= 0; row--) if (board[row][col] === EMPTY) return row;
        return -1;
    }

    isFull(board) {
        for (let col = 0; col < COLS; col++) if (board[0][col] === EMPTY) return false;
        return true;
    }

    findWinner(board) {
        const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const side = board[row][col];
                if (side === EMPTY) continue;
                for (const [dr, dc] of dirs) {
                    const cells = [];
                    for (let k = 0; k < 4; k++) {
                        const r = row + dr * k;
                        const c = col + dc * k;
                        if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== side) break;
                        cells.push([r, c]);
                    }
                    if (cells.length === 4) return { side, cells };
                }
            }
        }
        return null;
    }

    cloneBoard(board) {
        return board.map(row => row.slice());
    }

    validColumns(board) {
        const cols = [];
        for (let col = 0; col < COLS; col++) if (board[0][col] === EMPTY) cols.push(col);
        return cols;
    }

    simulateDrop(board, col, side) {
        const row = this.lowestOpenRow(board, col);
        if (row >= 0) board[row][col] = side;
        return row;
    }

    chooseBotColumn() {
        const legal = this.validColumns(this.board);
        if (!legal.length) return -1;

        for (const col of legal) {
            const test = this.cloneBoard(this.board);
            this.simulateDrop(test, col, YELLOW);
            const winner = this.findWinner(test);
            if (winner && winner.side === YELLOW) return col;
        }
        for (const col of legal) {
            const test = this.cloneBoard(this.board);
            this.simulateDrop(test, col, RED);
            const winner = this.findWinner(test);
            if (winner && winner.side === RED) return col;
        }

        let bestScore = -Infinity;
        let bestCols = [];
        for (const col of legal) {
            const test = this.cloneBoard(this.board);
            this.simulateDrop(test, col, YELLOW);
            const score = this.minimax(test, 4, false, -Infinity, Infinity);
            if (score > bestScore) {
                bestScore = score;
                bestCols = [col];
            } else if (score === bestScore) {
                bestCols.push(col);
            }
        }
        return bestCols[Math.floor(Math.random() * bestCols.length)];
    }

    minimax(board, depth, maximizing, alpha, beta) {
        const winner = this.findWinner(board);
        if (winner) return winner.side === YELLOW ? 100000 + depth : -100000 - depth;
        if (depth === 0 || this.isFull(board)) return this.evaluateBoard(board, YELLOW);

        const legal = this.validColumns(board);
        if (maximizing) {
            let value = -Infinity;
            for (const col of legal) {
                const test = this.cloneBoard(board);
                this.simulateDrop(test, col, YELLOW);
                value = Math.max(value, this.minimax(test, depth - 1, false, alpha, beta));
                alpha = Math.max(alpha, value);
                if (alpha >= beta) break;
            }
            return value;
        }

        let value = Infinity;
        for (const col of legal) {
            const test = this.cloneBoard(board);
            this.simulateDrop(test, col, RED);
            value = Math.min(value, this.minimax(test, depth - 1, true, alpha, beta));
            beta = Math.min(beta, value);
            if (alpha >= beta) break;
        }
        return value;
    }

    evaluateBoard(board, side) {
        let score = 0;
        const center = Math.floor(COLS / 2);
        for (let row = 0; row < ROWS; row++) if (board[row][center] === side) score += 5;

        const windows = [];
        for (let row = 0; row < ROWS; row++) for (let col = 0; col <= COLS - 4; col++) windows.push([[row,col],[row,col+1],[row,col+2],[row,col+3]]);
        for (let col = 0; col < COLS; col++) for (let row = 0; row <= ROWS - 4; row++) windows.push([[row,col],[row+1,col],[row+2,col],[row+3,col]]);
        for (let row = 0; row <= ROWS - 4; row++) for (let col = 0; col <= COLS - 4; col++) windows.push([[row,col],[row+1,col+1],[row+2,col+2],[row+3,col+3]]);
        for (let row = 0; row <= ROWS - 4; row++) for (let col = 3; col < COLS; col++) windows.push([[row,col],[row+1,col-1],[row+2,col-2],[row+3,col-3]]);

        const opponent = 1 - side;
        for (const segment of windows) {
            let own = 0;
            let opp = 0;
            let empty = 0;
            for (const [r, c] of segment) {
                if (board[r][c] === side) own++;
                else if (board[r][c] === opponent) opp++;
                else empty++;
            }
            if (own === 3 && empty === 1) score += 30;
            else if (own === 2 && empty === 2) score += 6;
            if (opp === 3 && empty === 1) score -= 36;
            else if (opp === 2 && empty === 2) score -= 5;
        }
        return score;
    }

    scheduleBotIfNeeded() {
        if (this.phase !== 'playing' || this.botPending || this.animating || !this.hasHuman()) return;
        const seat = this.seats[this.turn];
        if (!seat || !seat.isBot) return;
        this.botPending = true;
        const token = ++this.botToken;
        this.setTimeout(() => {
            if (token !== this.botToken) return;
            this.botPending = false;
            if (this.phase !== 'playing' || !this.seats[this.turn].isBot) return;
            const col = this.turn === YELLOW ? this.chooseBotColumn() : this.chooseFallbackColumn();
            if (col >= 0) this.dropDisc(col, this.turn);
        }, 330);
    }

    chooseFallbackColumn() {
        const legal = this.validColumns(this.board);
        return legal.length ? legal[Math.floor(Math.random() * legal.length)] : -1;
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
        for (let row = 0; row < ROWS; row++) this.board[row].fill(EMPTY);
        this.turn = RED;
        this.phase = this.hasHuman() ? 'playing' : 'waiting';
        this.winningCells = [];
        this.lastDrop = null;
        this.animating = false;
        this.dropAnimationToken += 1;
        this.fallingDisc.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        this.fallingDisc.node.fill = [0, 0, 0, 0];
        this.fallingDisc.node.playerIds = [0];
        this.render();
        this.scheduleBotIfNeeded();
    }

    render() {
        const winning = new Set(this.winningCells.map(([r, c]) => `${r},${c}`));
        const winner = this.findWinner(this.board);
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const side = this.board[row][col];
                const slot = this.slotNodes[row][col];
                const key = `${row},${col}`;
                const isLast = this.lastDrop && this.lastDrop.row === row && this.lastDrop.col === col;
                slot.node.fill = side === EMPTY ? [25, 51, 65, 255] : SIDE_COLORS[side];
                this.discMarks[row][col].node.text.text = side === EMPTY ? '' : SIDE_MARKS[side];
                slot.node.color = winning.has(key) || isLast ? COLORS.WHITE : [61, 43, 32, 255];
                slot.node.border = winning.has(key) ? 10 : (isLast ? 6 : 3);
            }
        }

        let status = 'Welcome to the table';
        let hint = 'Drop four in a row';
        if (this.phase === 'playing') {
            const seat = this.seats[this.turn];
            status = this.animating ? 'Disc dropping…' : (seat && seat.isBot ? 'Computer is choosing…' : `${SIDE_NAMES[this.turn]} · ${seat.name}'s turn`);
            hint = this.lastDrop || this.animating || (seat && seat.isBot) ? '' : 'Tap a column';
        } else if (this.phase === 'over') {
            status = winner ? `${SIDE_NAMES[winner.side]} wins` : 'Draw';
            hint = winner ? `${this.seats[winner.side].name} connects four` : 'Board full · no winner';
        }

        this.statusText.node.text = { text: status, x: 50, y: 10.8, size: 2.6, align: 'center', color: [244, 237, 216, 255], font: 'default' };
        this.scoreText.node.text = { text: `Red ● ${this.scores[RED]}   —   ${this.scores[YELLOW]} Gold ○`, x: 50, y: 15.5, size: 1.9, align: 'center', color: [224, 216, 193, 255], font: 'default' };
        this.scoreText.node.playerIds = this.scores.some(score => score > 0) ? [] : [0];
        this.leftSeatText.node.text = { text: `Red ● · ${this.seats[RED].name}`, x: 25, y: 92, size: 1.8, align: 'center', color: [244, 237, 216, 255], font: 'default' };
        this.rightSeatText.node.text = { text: `Gold ○ · ${this.seats[YELLOW].name}`, x: 75, y: 92, size: 1.8, align: 'center', color: [244, 237, 216, 255], font: 'default' };
        this.hintText.node.text = { text: hint, x: 50, y: 82.3, size: 2.0, align: 'center', color: [244, 237, 216, 255], font: 'default' };
        this.columnLabels.forEach((label, col) => { label.node.text.text = this.board[0][col] === EMPTY ? String(col + 1) : '×'; });
        this.rematchButton.node.playerIds = this.phase === 'over' ? [] : [0];
        this.base.node.onStateChange();
    }
}

module.exports = ConnectFour;
