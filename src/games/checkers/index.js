const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { COLORS } = Colors;

const SIZE = 8;
const EMPTY = null;
const RED = 0;
const WHITE = 1;
const SIDE_NAMES = ['Red', 'White'];
const SIDE_COLORS = [[221, 95, 77, 255], [250, 241, 219, 255]];
const LIGHT_SQUARE = [207, 190, 156, 255];
const DARK_SQUARE = [92, 69, 55, 255];
const SELECTED_SQUARE = [176, 140, 72, 255];
const TARGET_SQUARE = [104, 132, 92, 255];

const polyCircle = (cx, cy, r, sides = 18) => {
    const pts = [];
    for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
};

class Checkers extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Checkers',
            author: "Joseph Garcia",
            description: 'American checkers with mandatory captures, multi-jumps, and kings.',
            aspectRatio: { x: 1, y: 1 },
            assets: {
                'pointer-grab': new Asset({ path: './assets/cursor-grab.png', type: 'image' }),
                'pointer-hold': new Asset({ path: './assets/cursor-hold.png', type: 'image' })
            },
            maxPlayers: 2,
            gameId: "9f1666a3-e2ff-5eef-a511-9c14194032d6"
        };
    }

    constructor({ setCursor } = {}) {
        super();
        this.setCursor = setCursor;
        this.drag = null;

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

        this.board = this.makeStartingBoard();
        this.turn = RED;
        this.phase = 'waiting';
        this.selected = null;
        this.forcedFrom = null;
        this.legalTargets = [];
        this.lastTurnPath = [];
        this.scores = [0, 0];
        this.players = {};
        this.pressedPlayers = new Set();
        this.heldKeys = {};
        this.seats = [
            { playerId: null, isBot: false, name: 'Open seat' },
            { playerId: null, isBot: true, name: 'Computer' }
        ];
        this.botToken = 0;
        this.botPending = false;
        this.animating = false;

        this.statusText = this.makeText('Welcome to the table', 50, 9.5, 2.05, [244, 237, 216, 255]);
        this.scoreText = this.makeText('Red 0   —   0 White', 50, 14, 1.5, [224, 216, 193, 255]);
        this.leftSeatText = this.makeText('Red · Open seat', 24, 87.2, 1.18, SIDE_COLORS[RED]);
        this.rightSeatText = this.makeText('White · Computer', 76, 87.2, 1.18, SIDE_COLORS[WHITE]);
        this.hintText = this.makeText('Captures are mandatory', 50, 83.2, 1.2, [224, 216, 193, 255]);

        this.squareNodes = [];
        this.pieceNodes = [];
        this.kingNodes = [];
        this.targetNodes = [];
        this.boardX = 18;
        this.boardY = 17;
        this.cell = 8;

        for (let row = 0; row < SIZE; row++) {
            this.squareNodes[row] = [];
            this.pieceNodes[row] = [];
            this.kingNodes[row] = [];
            this.targetNodes[row] = [];
            for (let col = 0; col < SIZE; col++) {
                const x = this.boardX + col * this.cell;
                const y = this.boardY + row * this.cell;
                const square = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(x, y, this.cell, this.cell),
                    fill: (row + col) % 2 === 0 ? LIGHT_SQUARE : DARK_SQUARE,
                    onClick: (pid, x, y) => this.pressOnce(pid, () => this.beginPieceDrag(pid, row, col, x, y)),
                    onHover: pid => this.hoverPiece(pid, row, col),
                    offHover: pid => { if (!this.drag) this.pointerCursor(pid, null); }
                });
                const piece = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                    fill: [0, 0, 0, 0],
                    color: COLORS.BLACK,
                    border: 4,
                    onClick: (pid, x, y) => this.pressOnce(pid, () => this.beginPieceDrag(pid, row, col, x, y)),
                    onHover: pid => this.hoverPiece(pid, row, col),
                    offHover: pid => { if (!this.drag) this.pointerCursor(pid, null); },
                    playerIds: [0]
                });
                const king = this.makeText('', x + this.cell / 2, y + 2.25, 3.6, COLORS.GOLD);
                const target = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: polyCircle(x + this.cell / 2, y + this.cell / 2, 1.1),
                    fill: [250, 241, 219, 255], playerIds: [0],
                    onClick: (pid, px, py) => this.pressOnce(pid, () => this.beginPieceDrag(pid, row, col, px, py))
                });
                this.squareNodes[row][col] = square;
                this.pieceNodes[row][col] = piece;
                this.kingNodes[row][col] = king;
                this.targetNodes[row][col] = target;
                this.base.addChildren(square, target, piece, king);
            }
        }

        this.motionPiece = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: [0, 0, 0, 0], color: COLORS.BLACK, border: 4, playerIds: [0]
        });
        this.motionKing = this.makeText('', 0, 0, 3.6, COLORS.GOLD, [0]);
        this.base.addChildren(this.motionPiece, this.motionKing);

        this.dragPiece = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: [[0,0],[0,0],[0,0]], fill: SIDE_COLORS[0], color: COLORS.WHITE, border: 6, playerIds: [0] });
        this.dragKing = this.makeText('', 0, 0, 3.2, COLORS.GOLD, [0]);
        this.base.addChildren(this.dragPiece, this.dragKing);

        this.rematchButton = this.makeButton(37, 92.2, 26, 5.2, 'Play again', [116, 82, 53, 255], () => {
            if (this.phase === 'over') this.resetRound();
        });
        this.rematchButton.node.playerIds = [0];
        this.keyboardText = this.makeText('', 50, 95, 1.6, [244, 237, 216, 255]);
        this.base.addChild(this.keyboardText);
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
        bg.addChild(this.makeText(label, x + w / 2, y + 1.45, 1.8, COLORS.WHITE));
        return bg;
    }

    makeStartingBoard() {
        const board = Array.from({ length: SIZE }, () => new Array(SIZE).fill(EMPTY));
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < SIZE; col++) {
                if ((row + col) % 2 === 1) board[row][col] = { side: RED, king: false };
            }
        }
        for (let row = 5; row < SIZE; row++) {
            for (let col = 0; col < SIZE; col++) {
                if ((row + col) % 2 === 1) board[row][col] = { side: WHITE, king: false };
            }
        }
        return board;
    }

    cloneBoard(board) {
        return board.map(row => row.map(piece => piece ? { side: piece.side, king: piece.king } : EMPTY));
    }

    handleNewPlayer({ playerId, info }) {
        if (this.players[playerId]) return;
        const name = info && info.name ? String(info.name).trim().slice(0, 14) : `Player ${playerId}`;
        let seat = -1;
        if (this.seats[RED].playerId === null) seat = RED;
        else if (this.seats[WHITE].isBot) {
            seat = WHITE;
            this.invalidateBot();
        }
        if (seat < 0) return;

        this.seats[seat] = { playerId, isBot: false, name };
        const youText = this.makeText(`You: ${SIDE_NAMES[seat]}`, 50, 90.2, 1.8, [244, 237, 216, 255], [playerId]);
        const focus = new GameNode.Shape({
            shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: [0, 0, 0, 0], color: COLORS.WHITE, border: 12, playerIds: [playerId]
        });
        this.players[playerId] = { seat, youText, focus, cursor: { row: seat === RED ? 2 : 5, col: seat === RED ? 1 : 0 } };
        this.base.addChildren(youText, focus);
        if (this.phase === 'waiting') this.phase = 'playing';
        this.render();
        this.scheduleBotIfNeeded();
    }

    handlePlayerDisconnect(playerId) {
        this.cancelPieceDrag(playerId);
        this.pointerCursor(playerId, null);
        const player = this.players[playerId];
        if (!player) return;
        const seat = player.seat;
        this.base.removeChild(player.youText.id);
        this.base.removeChild(player.focus.id);
        delete this.players[playerId];
        this.pressedPlayers.delete(playerId);
        delete this.heldKeys[playerId];
        this.seats[seat] = { playerId: null, isBot: true, name: 'Computer' };
        this.selected = null;
        this.legalTargets = [];
        this.lastTurnPath = [];
        this.forcedFrom = null;
        this.render();
        this.scheduleBotIfNeeded();
    }

    handleKeyUp(playerId, key) {
        if (this.heldKeys[playerId]) this.heldKeys[playerId].delete(key);
    }

    handleKeyDown(playerId, key) {
        if (key === 'Escape') { this.cancelPieceDrag(playerId); this.render(); return; }
        if (key === 'Enter' || key === ' ') {
            if (!this.heldKeys[playerId]) this.heldKeys[playerId] = new Set();
            if (this.heldKeys[playerId].has(key)) return;
            this.heldKeys[playerId].add(key);
        }
        const player = this.players[playerId];
        if (!player) return;
        if (key === 'Enter' && this.phase === 'over') { this.resetRound(); return; }
        if (this.phase !== 'playing' || player.seat !== this.turn || this.animating) return;
        const delta = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[key];
        if (delta) {
            player.cursor.row = Math.max(0, Math.min(7, player.cursor.row + delta[0]));
            player.cursor.col = Math.max(0, Math.min(7, player.cursor.col + delta[1]));
        } else if (key === 'Enter' || key === ' ') {
            this.handleSquareClick(playerId, player.cursor.row, player.cursor.col);
        } else return;
        player.focus.node.coordinates2d = ShapeUtils.rectangle(this.boardX + player.cursor.col * this.cell + 0.4, this.boardY + player.cursor.row * this.cell + 0.4, this.cell - 0.8, this.cell - 0.8);
        this.base.node.onStateChange();
    }

    // Older clients resend onClick while a pointer is held.
    pressOnce(playerId, action) {
        if (this.pressedPlayers.has(playerId)) return;
        this.pressedPlayers.add(playerId);
        action();
    }

    pointerCursor(id, mode) {
        if (typeof this.setCursor === 'function') this.setCursor(id, mode ? {
            assetKey: 'pointer-' + mode, size: { width: 32, height: 32 }, hotspot: { x: 16, y: 16 }
        } : null);
    }

    hoverPiece(id, row, col) {
        if (this.drag) return;
        const piece = this.board[row][col];
        const canMove = this.phase === 'playing' && !this.animating && !this.pendingPromotion
            && this.players[id]?.seat === this.turn && piece?.side === this.turn;
        this.pointerCursor(id, canMove ? 'grab' : null);
    }

    beginPieceDrag(id, row, col, x, y) {
        if (this.drag) return;
        const alreadySelected = this.selected?.row === row && this.selected?.col === col;
        if (!alreadySelected) this.handleSquareClick(id, row, col);
        if (this.phase !== 'playing' || this.animating || this.pendingPromotion
            || this.players[id]?.seat !== this.turn || this.selected?.row !== row || this.selected?.col !== col) return;
        this.drag = { id, row, col, x, y, moved: false };
        this.pointerCursor(id, 'hold');
    }

    handleMouseMove(id, pos) {
        const d = this.drag;
        if (!d || d.id !== id || !pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;
        if (Math.hypot(pos.x - d.x, pos.y - d.y) < 1 && !d.moved) return;
        d.moved = true;
        const piece = this.board[d.row][d.col];
        if (!piece) return;
        this.dragPiece.node.playerIds = [];
        this.pieceNodes[d.row][d.col].node.playerIds = [0];
        this.kingNodes[d.row][d.col].node.text = { ...this.kingNodes[d.row][d.col].node.text, text: '' };
        this.dragPiece.node.coordinates2d = polyCircle(pos.x, pos.y, 3.25);
        this.dragPiece.node.fill = SIDE_COLORS[piece.side];
        this.dragKing.node.playerIds = [];
        this.dragKing.node.text = { ...this.dragKing.node.text, text: piece.king ? '★' : '', x: pos.x, y: pos.y - 2 };
        this.base.node.onStateChange();
    }

    cancelPieceDrag(id) {
        if (!this.drag || (id !== undefined && this.drag.id !== id)) return;
        const owner = this.drag.id;
        this.drag = null;
        this.dragPiece.node.playerIds = [0];
        this.dragKing.node.playerIds = [0];
        this.pointerCursor(owner, null);
    }

    handleMouseUp(id, pos) {
        this.pressedPlayers.delete(id);
        const d = this.drag;
        if (!d || d.id !== id) return;
        this.cancelPieceDrag(id);
        this.render();
        if (!d.moved || !pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;
        const row = Math.floor((pos.y - this.boardY) / this.cell);
        const col = Math.floor((pos.x - this.boardX) / this.cell);
        if (this.legalTargets.some(m => m.to.row === row && m.to.col === col)) this.handleSquareClick(id, row, col);
    }


    handleSquareClick(playerId, row, col) {
        if (this.phase !== 'playing' || this.animating) return;
        const player = this.players[playerId];
        if (!player || player.seat !== this.turn) return;
        if (this.seats[this.turn].isBot) return;

        if (this.selected) {
            const move = this.legalTargets.find(m => m.to.row === row && m.to.col === col);
            if (move) {
                this.applyHumanStep(move);
                return;
            }
        }

        const piece = this.board[row][col];

        if (this.forcedFrom) {
            if (piece && piece.side === this.turn && row === this.forcedFrom.row && col === this.forcedFrom.col) {
                this.selected = { row, col };
                this.legalTargets = this.captureStepsFrom(this.board, row, col);
                this.render();
            }
            return;
        }

        if (!piece || piece.side !== this.turn) {
            if (this.selected) {
                this.selected = null;
                this.legalTargets = [];
                this.lastTurnPath = [];
                this.render();
            }
            return;
        }

        if (this.selected && this.selected.row === row && this.selected.col === col) {
            this.selected = null;
            this.legalTargets = [];
            this.lastTurnPath = [];
            this.render();
            return;
        }

        const allMoves = this.generateStepMoves(this.board, this.turn);
        const moves = allMoves.filter(m => m.from.row === row && m.from.col === col);
        if (!moves.length) {
            if (this.selected) {
                this.selected = null;
                this.legalTargets = [];
                this.lastTurnPath = [];
                this.render();
            }
            return;
        }

        this.selected = { row, col };
        this.legalTargets = moves;
        this.render();
    }

    applyHumanStep(move) {
        if (this.animating) return;
        const side = this.turn;
        const piece = this.board[move.from.row][move.from.col];
        if (!piece || piece.side !== side) return;

        this.lastTurnPath = [move.from, move.to];
        this.board[move.from.row][move.from.col] = EMPTY;
        this.board[move.to.row][move.to.col] = piece;
        if (move.capture) this.board[move.capture.row][move.capture.col] = EMPTY;

        const reachedKingRow = !piece.king && ((piece.side === RED && move.to.row === SIZE - 1) || (piece.side === WHITE && move.to.row === 0));
        if (reachedKingRow) piece.king = true;

        let continues = false;
        if (move.capture && !reachedKingRow) {
            const nextCaptures = this.captureStepsFrom(this.board, move.to.row, move.to.col);
            if (nextCaptures.length) {
                continues = true;
                this.forcedFrom = { row: move.to.row, col: move.to.col };
                this.selected = { row: move.to.row, col: move.to.col };
                this.legalTargets = nextCaptures;
            }
        }
        if (!continues) {
            this.selected = null;
            this.forcedFrom = null;
            this.legalTargets = [];
        }
        this.render();
        this.animateCheckerPath([move.from, move.to], side, piece.king, () => {
            if (continues) this.render();
            else this.finishTurn(side);
        });
    }

    animateCheckerPath(points, side, king, onDone) {
        if (!points || points.length < 2) { if (onDone) onDone(); return; }
        this.animating = true;
        const final = points[points.length - 1];
        this.pieceNodes[final.row][final.col].node.playerIds = [0];
        this.kingNodes[final.row][final.col].node.text = { text: '', x: 0, y: 0, size: 3.6, align: 'center', color: COLORS.GOLD, font: 'default' };
        this.motionPiece.node.fill = SIDE_COLORS[side];
        this.motionPiece.node.color = side === RED ? [92, 16, 22, 255] : [95, 95, 95, 255];
        this.motionPiece.node.border = 4;
        this.motionPiece.node.playerIds = [];
        this.motionKing.node.playerIds = king ? [] : [0];

        const runSegment = (seg, frame) => {
            if (!this.animating) return;
            if (seg >= points.length - 1) {
                this.motionPiece.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                this.motionPiece.node.playerIds = [0];
                this.motionKing.node.playerIds = [0];
                this.animating = false;
                if (onDone) onDone();
                return;
            }
            const a = points[seg], b = points[seg + 1];
            const frames = 6;
            const t = frame / frames;
            const ax = this.boardX + a.col * this.cell + this.cell / 2;
            const ay = this.boardY + a.row * this.cell + this.cell / 2;
            const bx = this.boardX + b.col * this.cell + this.cell / 2;
            const by = this.boardY + b.row * this.cell + this.cell / 2;
            const cx = ax + (bx - ax) * t;
            const cy = ay + (by - ay) * t - Math.sin(Math.PI * t) * 1.1;
            this.motionPiece.node.coordinates2d = polyCircle(cx, cy, 3.35);
            if (king) this.motionKing.node.text = { text: '★', x: cx, y: cy - 2.25, size: 3.6, align: 'center', color: side === RED ? COLORS.GOLD : COLORS.BLACK, font: 'default' };
            this.base.node.onStateChange();
            if (frame >= frames) this.setTimeout(() => runSegment(seg + 1, 0), 22);
            else this.setTimeout(() => runSegment(seg, frame + 1), 24);
        };
        runSegment(0, 0);
    }

    finishTurn(sideThatMoved) {
        const opponent = 1 - sideThatMoved;
        if (!this.hasAnyPiece(this.board, opponent) || this.generateStepMoves(this.board, opponent).length === 0) {
            this.phase = 'over';
            this.scores[sideThatMoved] += 1;
            this.invalidateBot();
        } else {
            this.turn = opponent;
        }
        this.render();
        this.scheduleBotIfNeeded();
    }

    directionsFor(piece) {
        if (piece.king) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        const dr = piece.side === RED ? 1 : -1;
        return [[dr, -1], [dr, 1]];
    }

    inBounds(row, col) {
        return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
    }

    captureStepsFrom(board, row, col) {
        const piece = board[row][col];
        if (!piece) return [];
        const moves = [];
        for (const [dr, dc] of this.directionsFor(piece)) {
            const midRow = row + dr;
            const midCol = col + dc;
            const toRow = row + dr * 2;
            const toCol = col + dc * 2;
            if (!this.inBounds(toRow, toCol) || !this.inBounds(midRow, midCol)) continue;
            const jumped = board[midRow][midCol];
            if (jumped && jumped.side !== piece.side && board[toRow][toCol] === EMPTY) {
                moves.push({
                    from: { row, col },
                    to: { row: toRow, col: toCol },
                    capture: { row: midRow, col: midCol }
                });
            }
        }
        return moves;
    }

    simpleStepsFrom(board, row, col) {
        const piece = board[row][col];
        if (!piece) return [];
        const moves = [];
        for (const [dr, dc] of this.directionsFor(piece)) {
            const toRow = row + dr;
            const toCol = col + dc;
            if (this.inBounds(toRow, toCol) && board[toRow][toCol] === EMPTY) {
                moves.push({ from: { row, col }, to: { row: toRow, col: toCol }, capture: null });
            }
        }
        return moves;
    }

    generateStepMoves(board, side) {
        const captures = [];
        for (let row = 0; row < SIZE; row++) {
            for (let col = 0; col < SIZE; col++) {
                const piece = board[row][col];
                if (piece && piece.side === side) captures.push(...this.captureStepsFrom(board, row, col));
            }
        }
        if (captures.length) return captures;

        const moves = [];
        for (let row = 0; row < SIZE; row++) {
            for (let col = 0; col < SIZE; col++) {
                const piece = board[row][col];
                if (piece && piece.side === side) moves.push(...this.simpleStepsFrom(board, row, col));
            }
        }
        return moves;
    }

    generateTurnMoves(board, side) {
        const captureTurns = [];
        for (let row = 0; row < SIZE; row++) {
            for (let col = 0; col < SIZE; col++) {
                const piece = board[row][col];
                if (!piece || piece.side !== side) continue;
                const first = this.captureStepsFrom(board, row, col);
                for (const step of first) this.expandCaptureTurn(board, step, [step], captureTurns);
            }
        }
        if (captureTurns.length) return captureTurns;
        return this.generateStepMoves(board, side).map(step => [step]);
    }

    expandCaptureTurn(board, step, path, out) {
        const nextBoard = this.cloneBoard(board);
        const piece = nextBoard[step.from.row][step.from.col];
        nextBoard[step.from.row][step.from.col] = EMPTY;
        nextBoard[step.to.row][step.to.col] = piece;
        nextBoard[step.capture.row][step.capture.col] = EMPTY;

        const reachedKingRow = !piece.king && ((piece.side === RED && step.to.row === SIZE - 1) || (piece.side === WHITE && step.to.row === 0));
        if (reachedKingRow) {
            piece.king = true;
            out.push(path);
            return;
        }

        const next = this.captureStepsFrom(nextBoard, step.to.row, step.to.col);
        if (!next.length) {
            out.push(path);
            return;
        }
        for (const following of next) this.expandCaptureTurn(nextBoard, following, path.concat([following]), out);
    }

    applyTurnMoveToBoard(board, turnMove) {
        for (const step of turnMove) {
            const piece = board[step.from.row][step.from.col];
            board[step.from.row][step.from.col] = EMPTY;
            board[step.to.row][step.to.col] = piece;
            if (step.capture) board[step.capture.row][step.capture.col] = EMPTY;
            if (!piece.king && ((piece.side === RED && step.to.row === SIZE - 1) || (piece.side === WHITE && step.to.row === 0))) {
                piece.king = true;
                break;
            }
        }
    }

    chooseBotTurn(side) {
        const moves = this.generateTurnMoves(this.board, side);
        if (!moves.length) return null;
        let best = -Infinity;
        let bestMoves = [];
        for (const move of moves) {
            const board = this.cloneBoard(this.board);
            this.applyTurnMoveToBoard(board, move);
            const score = this.minimax(board, 3, 1 - side, side, -Infinity, Infinity);
            if (score > best) {
                best = score;
                bestMoves = [move];
            } else if (score === best) {
                bestMoves.push(move);
            }
        }
        return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }

    minimax(board, depth, sideToMove, botSide, alpha, beta) {
        const moves = this.generateTurnMoves(board, sideToMove);
        if (depth === 0 || !moves.length) {
            if (!moves.length) return sideToMove === botSide ? -100000 - depth : 100000 + depth;
            return this.evaluateBoard(board, botSide);
        }

        if (sideToMove === botSide) {
            let value = -Infinity;
            for (const move of moves) {
                const test = this.cloneBoard(board);
                this.applyTurnMoveToBoard(test, move);
                value = Math.max(value, this.minimax(test, depth - 1, 1 - sideToMove, botSide, alpha, beta));
                alpha = Math.max(alpha, value);
                if (alpha >= beta) break;
            }
            return value;
        }

        let value = Infinity;
        for (const move of moves) {
            const test = this.cloneBoard(board);
            this.applyTurnMoveToBoard(test, move);
            value = Math.min(value, this.minimax(test, depth - 1, 1 - sideToMove, botSide, alpha, beta));
            beta = Math.min(beta, value);
            if (alpha >= beta) break;
        }
        return value;
    }

    evaluateBoard(board, botSide) {
        let score = 0;
        for (let row = 0; row < SIZE; row++) {
            for (let col = 0; col < SIZE; col++) {
                const piece = board[row][col];
                if (!piece) continue;
                let value = piece.king ? 18 : 10;
                if (!piece.king) {
                    const progress = piece.side === RED ? row : (SIZE - 1 - row);
                    value += progress * 0.7;
                }
                if (col >= 2 && col <= 5) value += 0.5;
                score += piece.side === botSide ? value : -value;
            }
        }
        return score;
    }

    applyBotTurn(turnMove, side) {
        if (!turnMove || this.phase !== 'playing' || this.turn !== side || this.animating) return;
        const path = [];
        for (const step of turnMove) {
            if (!path.length) path.push(step.from);
            path.push(step.to);
        }
        this.lastTurnPath = path.slice();
        this.applyTurnMoveToBoard(this.board, turnMove);
        this.selected = null;
        this.forcedFrom = null;
        this.legalTargets = [];
        const final = path[path.length - 1];
        const piece = final ? this.board[final.row][final.col] : null;
        this.render();
        this.animateCheckerPath(path, side, !!(piece && piece.king), () => this.finishTurn(side));
    }

    hasAnyPiece(board, side) {
        for (let row = 0; row < SIZE; row++) {
            for (let col = 0; col < SIZE; col++) {
                if (board[row][col] && board[row][col].side === side) return true;
            }
        }
        return false;
    }

    scheduleBotIfNeeded() {
        if (this.phase !== 'playing' || this.botPending || this.animating || !this.hasHuman()) return;
        const seat = this.seats[this.turn];
        if (!seat || !seat.isBot) return;

        this.botPending = true;
        const token = ++this.botToken;
        const side = this.turn;
        this.setTimeout(() => {
            if (token !== this.botToken) return;
            this.botPending = false;
            if (this.phase !== 'playing' || this.turn !== side || !this.seats[side].isBot) return;
            const move = this.chooseBotTurn(side);
            if (!move) {
                this.phase = 'over';
                this.scores[1 - side] += 1;
                this.render();
                return;
            }
            this.applyBotTurn(move, side);
        }, 380);
    }

    invalidateBot() {
        this.botToken += 1;
        this.botPending = false;
    }

    hasHuman() {
        return Object.keys(this.players).length > 0;
    }

    resetRound() {
        this.cancelPieceDrag();
        this.invalidateBot();
        this.board = this.makeStartingBoard();
        this.turn = RED;
        this.phase = this.hasHuman() ? 'playing' : 'waiting';
        this.selected = null;
        this.forcedFrom = null;
        this.legalTargets = [];
        this.lastTurnPath = [];
        this.animating = false;
        this.motionPiece.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        this.motionPiece.node.playerIds = [0];
        this.motionKing.node.playerIds = [0];
        this.render();
        this.scheduleBotIfNeeded();
    }

    render() {
        const allMoves = this.phase === 'playing' ? this.generateStepMoves(this.board, this.turn) : [];
        const targets = new Set(this.legalTargets.map(m => `${m.to.row},${m.to.col}`));
        const legalStarts = new Set(allMoves.map(m => `${m.from.row},${m.from.col}`));
        const captureStarts = new Set(allMoves.filter(m => !!m.capture).map(m => `${m.from.row},${m.from.col}`));
        const lastPath = new Set(this.lastTurnPath.map(p => `${p.row},${p.col}`));
        for (let row = 0; row < SIZE; row++) {
            for (let col = 0; col < SIZE; col++) {
                const square = this.squareNodes[row][col];
                const key = `${row},${col}`;
                const selected = this.selected && this.selected.row === row && this.selected.col === col;
                this.targetNodes[row][col].node.playerIds = targets.has(key) && !this.animating ? [] : [0];
                square.node.color = [250, 241, 219, 255];
                square.node.border = selected ? 12 : (legalStarts.has(key) && !this.animating ? 7 : undefined);
                if (selected) square.node.fill = SELECTED_SQUARE;
                else if (targets.has(key)) square.node.fill = TARGET_SQUARE;
                else if (captureStarts.has(key)) square.node.fill = [128, 90, 62, 255];
                else if (legalStarts.has(key)) square.node.fill = (row + col) % 2 === 0 ? [218, 202, 166, 255] : [104, 80, 63, 255];
                else if (lastPath.has(key)) square.node.fill = (row + col) % 2 === 0 ? [196, 205, 167, 255] : [90, 105, 77, 255];
                else square.node.fill = (row + col) % 2 === 0 ? LIGHT_SQUARE : DARK_SQUARE;

                const piece = this.board[row][col];
                const pieceNode = this.pieceNodes[row][col];
                const kingNode = this.kingNodes[row][col];
                const x = this.boardX + col * this.cell;
                const y = this.boardY + row * this.cell;

                if (piece) {
                    pieceNode.node.coordinates2d = polyCircle(x + this.cell / 2, y + this.cell / 2, 2.95);
                    pieceNode.node.fill = SIDE_COLORS[piece.side];
                    pieceNode.node.color = selected ? COLORS.WHITE : (piece.side === RED ? [92, 16, 22, 255] : [95, 95, 95, 255]);
                    pieceNode.node.border = selected ? 6 : 4;
                    pieceNode.node.playerIds = [];
                    kingNode.node.text = {
                        text: piece.king ? '★' : '',
                        x: x + this.cell / 2,
                        y: y + 2.0,
                        size: 3.2,
                        align: 'center',
                        color: piece.side === RED ? COLORS.GOLD : COLORS.BLACK,
                        font: 'default'
                    };
                } else {
                    pieceNode.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                    pieceNode.node.fill = [0, 0, 0, 0];
                    pieceNode.node.playerIds = [0];
                    kingNode.node.text = { text: '', x: x + this.cell / 2, y: y + 2.0, size: 3.2, align: 'center', color: COLORS.GOLD, font: 'default' };
                }
            }
        }

        let status = 'Welcome to the table';
        let hint = 'Captures are mandatory';
        if (this.phase === 'playing') {
            const seat = this.seats[this.turn];
            const mustCapture = allMoves.some(m => !!m.capture);
            status = seat && seat.isBot ? 'Computer is thinking…' : `${SIDE_NAMES[this.turn]} · ${seat.name}'s turn`;
            if (this.animating || (seat && seat.isBot)) hint = '';
            else if (this.forcedFrom) hint = 'Jump again';
            else if (mustCapture) hint = 'Jump required';
            else hint = this.lastTurnPath.length ? '' : 'Move an outlined piece';
        } else if (this.phase === 'over') {
            const redMoves = this.hasAnyPiece(this.board, RED) ? this.generateStepMoves(this.board, RED).length : 0;
            const whiteMoves = this.hasAnyPiece(this.board, WHITE) ? this.generateStepMoves(this.board, WHITE).length : 0;
            let winner = null;
            if (!redMoves) winner = WHITE;
            else if (!whiteMoves) winner = RED;
            status = winner === null ? 'Game over' : `${SIDE_NAMES[winner]} wins`;
            hint = winner === null ? 'No legal moves' : `${this.seats[winner].name} takes the round`;
        }

        this.statusText.node.text = { text: status, x: 50, y: 9.5, size: 2.6, align: 'center', color: [244, 237, 216, 255], font: 'default' };
        this.scoreText.node.text = { text: `RED ${this.scores[RED]}   —   ${this.scores[WHITE]} WHITE`, x: 50, y: 14, size: 1.9, align: 'center', color: [224, 216, 193, 255], font: 'default' };
        this.scoreText.node.playerIds = this.scores.some(score => score > 0) ? [] : [0];
        this.leftSeatText.node.text = { text: `RED · ${this.seats[RED].name}`, x: 24, y: 87.2, size: 1.8, align: 'center', color: [244, 237, 216, 255], font: 'default' };
        this.rightSeatText.node.text = { text: `WHITE · ${this.seats[WHITE].name}`, x: 76, y: 87.2, size: 1.8, align: 'center', color: [244, 237, 216, 255], font: 'default' };
        this.hintText.node.text = { text: hint, x: 50, y: 83.2, size: 2.0, align: 'center', color: this.phase === 'over' ? [244, 237, 216, 255] : [224, 216, 193, 255], font: 'default' };
        this.rematchButton.node.playerIds = this.phase === 'over' ? [] : [0];
        this.keyboardText.node.playerIds = this.phase === 'over' ? [0] : [];
        this.base.node.onStateChange();
    }
}

module.exports = Checkers;
