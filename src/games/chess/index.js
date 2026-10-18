const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { COLORS } = Colors;

const WHITE = 0;
const BLACK = 1;
const SIDE_NAMES = ['White', 'Black'];
const SIDE_COLORS = [[244, 237, 216, 255], [178, 187, 204, 255]];
const LIGHT = [224, 214, 190, 255];
const DARK = [158, 176, 143, 255];
const SELECTED = [181, 145, 74, 255];
const TARGET = [104, 133, 92, 255];
const CAPTURE = [151, 82, 75, 255];
const CHECK = [168, 64, 64, 255];
const LAST = [177, 151, 91, 255];
const TYPES = ['p', 'n', 'b', 'r', 'q', 'k'];
const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
const GLYPHS = {
    0: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
    1: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

class Chess extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Chess',
            author: "Joseph Garcia",
            description: 'Full classic chess with castling, en passant, promotion, and draw rules.',
            aspectRatio: { x: 1, y: 1 },
            assets: {
                'pointer-grab': new Asset({ path: './assets/cursor-grab.png', type: 'image' }),
                'pointer-hold': new Asset({ path: './assets/cursor-hold.png', type: 'image' })
            },
            maxPlayers: 2,
            gameId: "f9b147ef-3d4c-58b7-aa73-b57691ce5b71"
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
        this.turn = WHITE;
        this.phase = 'waiting';
        this.selected = null;
        this.legalTargets = [];
        this.lastMove = null;
        this.pendingPromotion = null;
        this.halfmove = 0;
        this.fullmove = 1;
        this.endReason = '';
        this.winnerSide = null;
        this.positionCounts = {};
        this.matchScores = [0, 0];
        this.players = {};
        this.pressedPlayers = new Set();
        this.seats = [
            { playerId: null, isBot: false, name: 'Open seat' },
            { playerId: null, isBot: true, name: 'Computer' }
        ];
        this.botToken = 0;
        this.botPending = false;
        this.animating = false;
        this.recordPosition();

        this.statusText = this.makeText('Welcome to the table', 50, 8.5, 1.95, [244, 237, 216, 255]);
        this.scoreText = this.makeText('WHITE 0   —   0 BLACK', 50, 12.5, 1.35, [224, 216, 193, 255]);
        this.hintText = this.makeText('Checkmate the king', 50, 88, 1.25, [224, 216, 193, 255]);
        this.leftSeatText = this.makeText('WHITE · Open seat', 22, 92, 1.25, SIDE_COLORS[WHITE]);
        this.rightSeatText = this.makeText('BLACK · Computer', 78, 92, 1.25, SIDE_COLORS[BLACK]);
        this.moveText = this.makeText('MOVE 1', 50, 95, 1.1, [224, 216, 193, 255]);

        this.boardX = 18;
        this.boardY = 17;
        this.cell = 8;
        this.squareNodes = [];
        this.pieceNodes = [];
        this.targetNodes = [];

        for (let row = 0; row < 8; row++) {
            this.squareNodes[row] = [];
            this.pieceNodes[row] = [];
            this.targetNodes[row] = [];
            for (let col = 0; col < 8; col++) {
                const x = this.boardX + col * this.cell;
                const y = this.boardY + row * this.cell;
                const square = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(x, y, this.cell, this.cell),
                    fill: (row + col) % 2 === 0 ? LIGHT : DARK,
                    onClick: (pid, x, y) => this.pressOnce(pid, () => this.beginPieceDrag(pid, row, col, x, y)),
                    onHover: pid => this.hoverPiece(pid, row, col),
                    offHover: pid => { if (!this.drag) this.pointerCursor(pid, null); }
                });
                const piece = this.makeText('', x + this.cell / 2, y + 0.5, 6.8, COLORS.WHITE);
                this.squareNodes[row][col] = square;
                this.pieceNodes[row][col] = piece;
                const target = this.makeText('•', x + this.cell / 2, y + 1.2, 5, [32, 46, 38, 255], [0]);
                this.targetNodes[row][col] = target;
                this.base.addChildren(square, target, piece);
            }
        }

        this.motionPiece = this.makeText('', 0, 0, 6.8, [244, 237, 216, 255], [0]);
        this.motionPiece2 = this.makeText('', 0, 0, 6.8, [244, 237, 216, 255], [0]);
        this.base.addChildren(this.motionPiece, this.motionPiece2);

        this.dragPiece = this.makeText('', 0, 0, 6.8, [24, 28, 34, 255], [0]);
        this.base.addChild(this.dragPiece);

        this.promotionButtons = [];
        for (let i = 0; i < 4; i++) {
            const type = ['q', 'r', 'b', 'n'][i];
            const btn = this.makeButton(15 + i * 18, 81.8, 16, 5.5, ['Queen', 'Rook', 'Bishop', 'Knight'][i], [55, 69, 87, 255], (playerId) => this.choosePromotion(playerId, type));
            btn.node.playerIds = [0];
            this.promotionButtons.push(btn);
            this.base.addChild(btn);
        }

        this.rematchButton = this.makeButton(36, 81.8, 28, 5.5, 'Play again', [116, 82, 53, 255], () => {
            if (this.phase === 'over') this.resetRound();
        });
        this.moveText.node.playerIds = this.pendingPromotion || this.phase === 'over' ? [0] : [];
        this.rematchButton.node.playerIds = [0];
        this.base.addChildren(this.statusText, this.scoreText, this.hintText, this.leftSeatText, this.rightSeatText, this.moveText, this.rematchButton);
        this.render();
    }

    getLayers() { return [{ root: this.base }]; }

    makeText(text, x, y, size, color, playerIds) {
        return new GameNode.Text({ textInfo: { text, x, y, size, align: 'center', color, font: 'default' }, playerIds });
    }

    makeButton(x, y, w, h, label, fill, onClick) {
        const bg = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill, color: COLORS.WHITE, border: 3, onClick
        });
        bg.addChild(this.makeText(label, x + w / 2, y + 1.1, 1.5, COLORS.WHITE));
        return bg;
    }

    makePiece(side, type) { return { side, type, moved: false }; }

    makeStartingBoard() {
        const board = Array.from({ length: 8 }, () => new Array(8).fill(null));
        const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
        for (let col = 0; col < 8; col++) {
            board[0][col] = this.makePiece(BLACK, back[col]);
            board[1][col] = this.makePiece(BLACK, 'p');
            board[6][col] = this.makePiece(WHITE, 'p');
            board[7][col] = this.makePiece(WHITE, back[col]);
        }
        return board;
    }

    cloneBoard(board) {
        return board.map(row => row.map(p => p ? { side: p.side, type: p.type, moved: !!p.moved } : null));
    }

    inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

    handleNewPlayer({ playerId, info }) {
        if (this.players[playerId]) return;
        const name = info && info.name ? String(info.name).trim().slice(0, 14) : `Player ${playerId}`;
        let seat = -1;
        if (this.seats[WHITE].playerId === null) seat = WHITE;
        else if (this.seats[BLACK].isBot) { seat = BLACK; this.invalidateBot(); }
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
        this.cancelPieceDrag(playerId);
        this.pointerCursor(playerId, null);
        const p = this.players[playerId];
        if (!p) return;
        this.base.removeChild(p.youText.id);
        delete this.players[playerId];
        this.pressedPlayers.delete(playerId);
        this.seats[p.seat] = { playerId: null, isBot: true, name: 'Computer' };
        this.selected = null;
        this.legalTargets = [];
        if (this.pendingPromotion && this.pendingPromotion.side === p.seat) {
            this.completePromotion('q');
            return;
        }
        this.render();
        this.scheduleBotIfNeeded();
    }

    // Older clients resend onClick while a pointer is held.
    pressOnce(playerId, action) {
        if (this.pressedPlayers.has(playerId)) return;
        this.pressedPlayers.add(playerId);
        action();
    }

    handleKeyDown(id, key) { if (key === 'Escape') { this.cancelPieceDrag(id); this.render(); } }

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
        this.pieceNodes[d.row][d.col].node.text = { ...this.pieceNodes[d.row][d.col].node.text, text: '' };
        this.dragPiece.node.text = { ...this.dragPiece.node.text, text: GLYPHS[piece.side][piece.type], x: pos.x, y: pos.y - 3.5 };
        this.base.node.onStateChange();
    }

    cancelPieceDrag(id) {
        if (!this.drag || (id !== undefined && this.drag.id !== id)) return;
        const owner = this.drag.id;
        this.drag = null;
        this.dragPiece.node.playerIds = [0];

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
        if (this.phase !== 'playing' || this.pendingPromotion || this.animating) return;
        const p = this.players[playerId];
        if (!p || p.seat !== this.turn || this.seats[this.turn].isBot) return;

        if (this.selected) {
            const move = this.legalTargets.find(m => m.to.row === row && m.to.col === col);
            if (move) {
                this.makeMove(move, p.seat, true);
                return;
            }
        }

        const piece = this.board[row][col];
        if (!piece || piece.side !== this.turn) {
            if (this.selected) { this.selected = null; this.legalTargets = []; this.render(); }
            return;
        }

        if (this.selected && this.selected.row === row && this.selected.col === col) {
            this.selected = null;
            this.legalTargets = [];
            this.render();
            return;
        }

        const moves = this.legalMoves(this.board, this.turn).filter(m => m.from.row === row && m.from.col === col);
        if (!moves.length) return;
        this.selected = { row, col };
        this.legalTargets = moves;
        this.render();
    }

    pseudoMoves(board, side, options = {}) {
        const includeCastle = options.includeCastle !== false;
        const moves = [];
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p || p.side !== side) continue;
            const add = (tr, tc, extra = {}) => {
                if (!this.inBounds(tr, tc)) return;
                const dest = board[tr][tc];
                if (dest && dest.side === side) return;
                moves.push({ from: { row: r, col: c }, to: { row: tr, col: tc }, piece: p.type, capture: dest ? { row: tr, col: tc } : null, ...extra });
            };

            if (p.type === 'p') {
                const dir = side === WHITE ? -1 : 1;
                const start = side === WHITE ? 6 : 1;
                const promo = side === WHITE ? 0 : 7;
                if (this.inBounds(r + dir, c) && !board[r + dir][c]) {
                    add(r + dir, c, { promotion: r + dir === promo });
                    if (r === start && !board[r + dir * 2][c]) add(r + dir * 2, c, { doublePawn: true });
                }
                for (const dc of [-1, 1]) {
                    const tr = r + dir, tc = c + dc;
                    if (!this.inBounds(tr, tc)) continue;
                    const dest = board[tr][tc];
                    if (dest && dest.side !== side) add(tr, tc, { promotion: tr === promo });
                    else if (!dest && this.lastMove && this.lastMove.doublePawn && this.lastMove.side !== side && this.lastMove.to.row === r && this.lastMove.to.col === tc) {
                        const ep = board[r][tc];
                        if (ep && ep.side !== side && ep.type === 'p') add(tr, tc, { enPassant: { row: r, col: tc }, capture: { row: r, col: tc } });
                    }
                }
            } else if (p.type === 'n') {
                for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(r + dr, c + dc);
            } else if (p.type === 'k') {
                for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) add(r + dr, c + dc);
                if (includeCastle && !p.moved && !this.isSquareAttacked(board, r, c, 1 - side)) {
                    for (const rookCol of [0, 7]) {
                        const rook = board[r][rookCol];
                        if (!rook || rook.side !== side || rook.type !== 'r' || rook.moved) continue;
                        const dir = rookCol === 7 ? 1 : -1;
                        let clear = true;
                        for (let cc = c + dir; cc !== rookCol; cc += dir) if (board[r][cc]) { clear = false; break; }
                        if (!clear) continue;
                        const through = c + dir;
                        const dest = c + dir * 2;
                        if (this.isSquareAttacked(board, r, through, 1 - side) || this.isSquareAttacked(board, r, dest, 1 - side)) continue;
                        moves.push({ from: { row: r, col: c }, to: { row: r, col: dest }, piece: 'k', capture: null, castle: { rookFrom: rookCol, rookTo: c + dir } });
                    }
                }
            } else {
                const dirs = [];
                if (p.type === 'b' || p.type === 'q') dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
                if (p.type === 'r' || p.type === 'q') dirs.push([-1,0],[1,0],[0,-1],[0,1]);
                for (const [dr, dc] of dirs) {
                    let tr = r + dr, tc = c + dc;
                    while (this.inBounds(tr, tc)) {
                        const dest = board[tr][tc];
                        if (!dest) add(tr, tc);
                        else { if (dest.side !== side) add(tr, tc); break; }
                        tr += dr; tc += dc;
                    }
                }
            }
        }
        return moves;
    }

    isSquareAttacked(board, row, col, bySide) {
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p || p.side !== bySide) continue;
            if (p.type === 'p') {
                const dir = bySide === WHITE ? -1 : 1;
                if (r + dir === row && (c - 1 === col || c + 1 === col)) return true;
            } else if (p.type === 'n') {
                for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) if (r + dr === row && c + dc === col) return true;
            } else if (p.type === 'k') {
                if (Math.max(Math.abs(r - row), Math.abs(c - col)) === 1) return true;
            } else {
                const dirs = [];
                if (p.type === 'b' || p.type === 'q') dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
                if (p.type === 'r' || p.type === 'q') dirs.push([-1,0],[1,0],[0,-1],[0,1]);
                for (const [dr, dc] of dirs) {
                    let tr = r + dr, tc = c + dc;
                    while (this.inBounds(tr, tc)) {
                        if (tr === row && tc === col) return true;
                        if (board[tr][tc]) break;
                        tr += dr; tc += dc;
                    }
                }
            }
        }
        return false;
    }

    kingPos(board, side) {
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && p.side === side && p.type === 'k') return { row: r, col: c };
        }
        return null;
    }

    inCheck(board, side) {
        const king = this.kingPos(board, side);
        return !!king && this.isSquareAttacked(board, king.row, king.col, 1 - side);
    }

    applyMoveToBoard(board, move, promotionType = 'q') {
        const piece = board[move.from.row][move.from.col];
        if (!piece) return;
        board[move.from.row][move.from.col] = null;
        if (move.enPassant) board[move.enPassant.row][move.enPassant.col] = null;
        board[move.to.row][move.to.col] = piece;
        piece.moved = true;
        if (move.castle) {
            const rook = board[move.to.row][move.castle.rookFrom];
            board[move.to.row][move.castle.rookFrom] = null;
            board[move.to.row][move.castle.rookTo] = rook;
            if (rook) rook.moved = true;
        }
        if (move.promotion) piece.type = promotionType;
    }

    legalMoves(board, side) {
        const moves = this.pseudoMoves(board, side, { includeCastle: true });
        return moves.filter(move => {
            const test = this.cloneBoard(board);
            this.applyMoveToBoard(test, move, 'q');
            return !this.inCheck(test, side);
        });
    }

    makeMove(move, side, human) {
        if (this.phase !== 'playing' || side !== this.turn || this.pendingPromotion || this.animating) return false;
        const legal = this.legalMoves(this.board, side).find(m => this.sameMove(m, move));
        if (!legal) return false;
        const movingPiece = this.board[legal.from.row][legal.from.col];
        const captured = legal.capture ? this.board[legal.capture.row][legal.capture.col] : null;
        const glyph = movingPiece ? GLYPHS[side][movingPiece.type] : '';

        if (legal.promotion && human && !this.seats[side].isBot) {
            const pieceCopy = { side: movingPiece.side, type: movingPiece.type, moved: movingPiece.moved };
            this.board[legal.from.row][legal.from.col] = null;
            if (legal.enPassant) this.board[legal.enPassant.row][legal.enPassant.col] = null;
            this.board[legal.to.row][legal.to.col] = pieceCopy;
            pieceCopy.moved = true;
            this.pendingPromotion = { side, move: legal, captured: !!captured };
            this.selected = null;
            this.legalTargets = [];
            this.render();
            this.animateChessMove(legal, glyph, side, () => this.render());
            return true;
        }

        this.applyMoveToBoard(this.board, legal, 'q');
        this.render();
        this.animateChessMove(legal, glyph, side, () => this.finishMove(side, legal, !!captured));
        return true;
    }

    animateChessMove(move, glyph, side, onDone) {
        this.animating = true;
        const dest = this.pieceNodes[move.to.row][move.to.col];
        if (dest) dest.node.text = { text: '', x: dest.node.text.x, y: dest.node.text.y, size: 6, align: 'center', color: [24, 28, 34, 255], font: 'default' };
        const rookDest = move.castle ? this.pieceNodes[move.to.row][move.castle.rookTo] : null;
        if (rookDest) rookDest.node.text = { text: '', x: rookDest.node.text.x, y: rookDest.node.text.y, size: 6, align: 'center', color: [24, 28, 34, 255], font: 'default' };
        this.motionPiece.node.playerIds = [];
        if (move.castle) this.motionPiece2.node.playerIds = [];
        const frames = 7;
        const step = (frame) => {
            if (!this.animating) return;
            const t = frame / frames;
            const sx = this.boardX + move.from.col * this.cell + this.cell / 2;
            const sy = this.boardY + move.from.row * this.cell + 0.5;
            const ex = this.boardX + move.to.col * this.cell + this.cell / 2;
            const ey = this.boardY + move.to.row * this.cell + 0.5;
            const x = sx + (ex - sx) * t;
            const y = sy + (ey - sy) * t;
            this.motionPiece.node.text = { text: glyph, x, y, size: 6, align: 'center', color: [24, 28, 34, 255], font: 'default' };
            if (move.castle) {
                const rsx = this.boardX + move.castle.rookFrom * this.cell + this.cell / 2;
                const rex = this.boardX + move.castle.rookTo * this.cell + this.cell / 2;
                const ry = this.boardY + move.to.row * this.cell + 0.5;
                this.motionPiece2.node.text = { text: GLYPHS[side].r, x: rsx + (rex - rsx) * t, y: ry, size: 6, align: 'center', color: [24, 28, 34, 255], font: 'default' };
            }
            this.base.node.onStateChange();
            if (frame >= frames) {
                this.motionPiece.node.text = { text: '', x: 0, y: 0, size: 6, align: 'center', color: [24, 28, 34, 255], font: 'default' };
                this.motionPiece.node.playerIds = [0];
                this.motionPiece2.node.text = { text: '', x: 0, y: 0, size: 6, align: 'center', color: [24, 28, 34, 255], font: 'default' };
                this.motionPiece2.node.playerIds = [0];
                this.animating = false;
                if (onDone) onDone();
            } else this.setTimeout(() => step(frame + 1), 24);
        };
        step(0);
    }

    choosePromotion(playerId, type) {
        if (this.animating || !this.pendingPromotion || !TYPES.includes(type) || type === 'p' || type === 'k') return;
        const player = this.players[playerId];
        if (!player || player.seat !== this.pendingPromotion.side) return;
        this.completePromotion(type);
    }

    completePromotion(type) {
        if (!this.pendingPromotion) return;
        const pending = this.pendingPromotion;
        const piece = this.board[pending.move.to.row][pending.move.to.col];
        if (piece) piece.type = type;
        this.pendingPromotion = null;
        this.finishMove(pending.side, pending.move, pending.captured);
    }

    positionKey(board = this.board, turn = this.turn, lastMove = this.lastMove) {
        const placement = [];
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            placement.push(p ? `${p.side}${p.type}` : '--');
        }
        const rights = [];
        for (const side of [WHITE, BLACK]) {
            const row = side === WHITE ? 7 : 0;
            const king = board[row][4];
            rights.push(king && king.side === side && king.type === 'k' && !king.moved ? 'K' : '-');
            for (const col of [0, 7]) {
                const rook = board[row][col];
                rights.push(rook && rook.side === side && rook.type === 'r' && !rook.moved ? 'R' : '-');
            }
        }
        const ep = this.repetitionEnPassantKey(board, turn, lastMove);
        return `${placement.join('')}|${turn}|${rights.join('')}|${ep}`;
    }

    repetitionEnPassantKey(board, turn, lastMove) {
        if (!lastMove || !lastMove.doublePawn || lastMove.side === turn) return '-';
        const row = lastMove.to.row, col = lastMove.to.col;
        const moved = board[row] && board[row][col];
        if (!moved || moved.side === turn || moved.type !== 'p') return '-';
        const dir = turn === WHITE ? -1 : 1;
        const toRow = row + dir;
        if (!this.inBounds(toRow, col) || board[toRow][col]) return '-';
        for (const dc of [-1, 1]) {
            const fromCol = col + dc;
            if (!this.inBounds(row, fromCol)) continue;
            const pawn = board[row][fromCol];
            if (!pawn || pawn.side !== turn || pawn.type !== 'p') continue;
            const move = {
                from: { row, col: fromCol },
                to: { row: toRow, col },
                piece: 'p',
                capture: { row, col },
                enPassant: { row, col }
            };
            const test = this.cloneBoard(board);
            this.applyMoveToBoard(test, move, 'q');
            if (!this.inCheck(test, turn)) return `${row},${col}`;
        }
        return '-';
    }

    recordPosition() {
        const key = this.positionKey();
        this.positionCounts[key] = (this.positionCounts[key] || 0) + 1;
        return this.positionCounts[key];
    }

    insufficientMaterial(board = this.board) {
        const pieces = [];
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && p.type !== 'k') pieces.push({ ...p, row: r, col: c });
        }
        if (!pieces.length) return true;
        if (pieces.length === 1 && (pieces[0].type === 'b' || pieces[0].type === 'n')) return true;
        if (pieces.every(p => p.type === 'b')) {
            const colors = new Set(pieces.map(p => (p.row + p.col) % 2));
            return colors.size === 1;
        }
        return false;
    }

    finishMove(side, move, captured) {
        const piece = this.board[move.to.row][move.to.col];
        this.lastMove = { from: move.from, to: move.to, side, piece: piece ? piece.type : move.piece, doublePawn: !!move.doublePawn };
        this.halfmove = captured || move.piece === 'p' ? 0 : this.halfmove + 1;
        if (side === BLACK) this.fullmove += 1;
        this.turn = 1 - side;
        this.selected = null;
        this.legalTargets = [];

        const nextMoves = this.legalMoves(this.board, this.turn);
        if (!nextMoves.length) {
            this.phase = 'over';
            if (this.inCheck(this.board, this.turn)) {
                this.endReason = 'checkmate';
                this.winnerSide = side;
                this.matchScores[side] += 1;
            } else {
                this.endReason = 'stalemate';
                this.winnerSide = null;
            }
            this.invalidateBot();
        } else {
            const repetitions = this.recordPosition();
            if (this.halfmove >= 100) {
                this.phase = 'over';
                this.endReason = 'fifty-move';
                this.winnerSide = null;
                this.invalidateBot();
            } else if (repetitions >= 3) {
                this.phase = 'over';
                this.endReason = 'repetition';
                this.winnerSide = null;
                this.invalidateBot();
            } else if (this.insufficientMaterial(this.board)) {
                this.phase = 'over';
                this.endReason = 'insufficient';
                this.winnerSide = null;
                this.invalidateBot();
            }
        }
        this.render();
        this.scheduleBotIfNeeded();
    }

    sameMove(a, b) {
        return a.from.row === b.from.row && a.from.col === b.from.col && a.to.row === b.to.row && a.to.col === b.to.col;
    }

    moveLabel(move) {
        if (!move) return 'MOVE 1';
        const files = 'abcdefgh';
        const piece = move.piece === 'p' ? '' : move.piece.toUpperCase();
        return `${piece}${files[move.from.col]}${8 - move.from.row}→${files[move.to.col]}${8 - move.to.row}`;
    }

    evaluate(board, botSide) {
        let score = 0;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p) continue;
            let v = PIECE_VALUE[p.type];
            if (p.type === 'p') {
                const progress = p.side === WHITE ? 6 - r : r - 1;
                v += progress * 5;
            }
            if ((c === 3 || c === 4) && (r >= 2 && r <= 5)) v += 8;
            score += p.side === botSide ? v : -v;
        }
        const ownMoves = this.legalMoves(board, botSide).length;
        const oppMoves = this.legalMoves(board, 1 - botSide).length;
        score += (ownMoves - oppMoves) * 2;
        return score;
    }

    minimax(board, sideToMove, botSide, depth, alpha, beta) {
        const moves = this.legalMoves(board, sideToMove);
        if (!moves.length) {
            if (this.inCheck(board, sideToMove)) return sideToMove === botSide ? -999999 - depth : 999999 + depth;
            return 0;
        }
        if (depth === 0) return this.evaluate(board, botSide);

        if (sideToMove === botSide) {
            let best = -Infinity;
            for (const move of moves) {
                const test = this.cloneBoard(board);
                this.applyMoveToBoard(test, move, 'q');
                best = Math.max(best, this.minimax(test, 1 - sideToMove, botSide, depth - 1, alpha, beta));
                alpha = Math.max(alpha, best);
                if (alpha >= beta) break;
            }
            return best;
        }
        let best = Infinity;
        for (const move of moves) {
            const test = this.cloneBoard(board);
            this.applyMoveToBoard(test, move, 'q');
            best = Math.min(best, this.minimax(test, 1 - sideToMove, botSide, depth - 1, alpha, beta));
            beta = Math.min(beta, best);
            if (alpha >= beta) break;
        }
        return best;
    }

    chooseBotMove(side) {
        const moves = this.legalMoves(this.board, side);
        if (!moves.length) return null;
        let best = -Infinity;
        let choices = [];
        for (const move of moves) {
            const test = this.cloneBoard(this.board);
            const target = test[move.to.row][move.to.col];
            this.applyMoveToBoard(test, move, 'q');
            let score = this.minimax(test, 1 - side, side, 1, -Infinity, Infinity);
            if (target) score += PIECE_VALUE[target.type] * 0.05;
            if (score > best) { best = score; choices = [move]; }
            else if (score === best) choices.push(move);
        }
        return choices[Math.floor(Math.random() * choices.length)];
    }

    scheduleBotIfNeeded() {
        if (this.phase !== 'playing' || this.pendingPromotion || this.animating || this.botPending || !this.hasHuman()) return;
        const seat = this.seats[this.turn];
        if (!seat || !seat.isBot) return;
        this.botPending = true;
        const token = ++this.botToken;
        const side = this.turn;
        this.setTimeout(() => {
            if (token !== this.botToken) return;
            this.botPending = false;
            if (this.phase !== 'playing' || this.turn !== side || !this.seats[side].isBot) return;
            const move = this.chooseBotMove(side);
            if (move) this.makeMove(move, side, false);
        }, 420);
    }

    invalidateBot() { this.botToken += 1; this.botPending = false; }
    hasHuman() { return Object.keys(this.players).length > 0; }

    resetRound() {
        this.cancelPieceDrag();
        this.invalidateBot();
        this.board = this.makeStartingBoard();
        this.turn = WHITE;
        this.phase = this.hasHuman() ? 'playing' : 'waiting';
        this.selected = null;
        this.legalTargets = [];
        this.lastMove = null;
        this.pendingPromotion = null;
        this.halfmove = 0;
        this.fullmove = 1;
        this.endReason = '';
        this.winnerSide = null;
        this.animating = false;
        if (this.motionPiece) { this.motionPiece.node.playerIds = [0]; this.motionPiece.node.text = { text: '', x: 0, y: 0, size: 6, align: 'center', color: [244,237,216,255], font: 'default' }; }
        if (this.motionPiece2) { this.motionPiece2.node.playerIds = [0]; this.motionPiece2.node.text = { text: '', x: 0, y: 0, size: 6, align: 'center', color: [244,237,216,255], font: 'default' }; }
        this.positionCounts = {};
        this.render();
        this.scheduleBotIfNeeded();
    }

    render() {
        const legalAll = this.phase === 'playing' && !this.pendingPromotion ? this.legalMoves(this.board, this.turn) : [];
        const targetMap = new Map(this.legalTargets.map(m => [`${m.to.row},${m.to.col}`, m]));
        const legalStarts = new Set(legalAll.map(m => `${m.from.row},${m.from.col}`));
        const checkKing = this.inCheck(this.board, this.turn) ? this.kingPos(this.board, this.turn) : null;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const key = `${r},${c}`;
            const square = this.squareNodes[r][c];
            const selected = this.selected && this.selected.row === r && this.selected.col === c;
            const target = targetMap.get(key);
            const isLast = this.lastMove && ((this.lastMove.from.row === r && this.lastMove.from.col === c) || (this.lastMove.to.row === r && this.lastMove.to.col === c));
            const isCheck = checkKing && checkKing.row === r && checkKing.col === c;
            if (isCheck) square.node.fill = CHECK;
            else if (selected) square.node.fill = SELECTED;
            else if (target) square.node.fill = target.capture ? CAPTURE : TARGET;
            else if (isLast) square.node.fill = LAST;
            else if (legalStarts.has(key)) square.node.fill = (r + c) % 2 === 0 ? [233, 224, 196, 255] : [174, 194, 156, 255];
            else square.node.fill = (r + c) % 2 === 0 ? LIGHT : DARK;

            square.node.color = [250, 241, 219, 255];
            square.node.border = selected || isCheck ? 12 : target ? 8 : undefined;
            this.targetNodes[r][c].node.playerIds = target && !target.capture ? [] : [0];
            const piece = this.board[r][c];
            const node = this.pieceNodes[r][c];
            node.node.text = {
                text: piece ? GLYPHS[piece.side][piece.type] : '',
                x: this.boardX + c * this.cell + this.cell / 2,
                y: this.boardY + r * this.cell + 0.5,
                size: 6,
                align: 'center',
                color: [24, 28, 34, 255],
                font: 'default'
            };
        }

        let status = 'Welcome to the table';
        let hint = 'Checkmate the king';
        if (this.pendingPromotion) {
            status = `${SIDE_NAMES[this.pendingPromotion.side]} promotion`;
            hint = 'Choose a queen, rook, bishop, or knight';
        } else if (this.phase === 'playing') {
            const seat = this.seats[this.turn];
            status = seat.isBot ? 'Computer is thinking…' : `${SIDE_NAMES[this.turn]} · ${seat.name} to move`;
            hint = this.inCheck(this.board, this.turn) ? 'Check' : this.lastMove || seat.isBot ? '' : (this.selected ? 'Choose a highlighted square' : 'Drag a piece or tap to move');
        } else if (this.phase === 'over') {
            if (this.winnerSide !== null) {
                status = `${this.seats[this.winnerSide].name} wins by checkmate`;
                hint = `${this.seats[this.winnerSide].name} takes the round`;
            } else {
                const reasons = {
                    stalemate: 'Stalemate',
                    'fifty-move': '50-move rule',
                    repetition: 'Threefold repetition',
                    insufficient: 'Insufficient material'
                };
                status = `Draw · ${reasons[this.endReason] || 'Draw'}`;
                hint = 'The round ends without a winner';
            }
        }

        this.statusText.node.text = { text: status, x: 50, y: 8.5, size: 2.6, align: 'center', color: [244, 237, 216, 255], font: 'default' };
        this.scoreText.node.text = { text: `White ${this.matchScores[WHITE]}   —   ${this.matchScores[BLACK]} Black`, x: 50, y: 12.5, size: 1.9, align: 'center', color: [224, 216, 193, 255], font: 'default' };
        this.scoreText.node.playerIds = this.matchScores.some(score => score > 0) ? [] : [0];
        this.hintText.node.text = { text: hint, x: 50, y: 88, size: 2.0, align: 'center', color: this.phase === 'over' ? [244, 237, 216, 255] : [224, 216, 193, 255], font: 'default' };
        this.leftSeatText.node.text = { text: `White · ${this.seats[WHITE].name}`, x: 22, y: 92, size: 1.8, align: 'center', color: [244, 237, 216, 255], font: 'default' };
        this.rightSeatText.node.text = { text: `Black · ${this.seats[BLACK].name}`, x: 78, y: 92, size: 1.8, align: 'center', color: [244, 237, 216, 255], font: 'default' };
        this.moveText.node.text = { text: this.lastMove ? this.moveLabel(this.lastMove) : '', x: 50, y: 84, size: 1.6, align: 'center', color: [224, 216, 193, 255], font: 'default' };

        for (const btn of this.promotionButtons) btn.node.playerIds = [0];
        if (this.pendingPromotion && !this.animating) {
            const pid = this.seats[this.pendingPromotion.side].playerId;
            if (pid !== null) for (const btn of this.promotionButtons) btn.node.playerIds = [pid];
        }
        this.moveText.node.playerIds = this.pendingPromotion || this.phase === 'over' ? [0] : [];
        this.rematchButton.node.playerIds = this.phase === 'over' ? [] : [0];
        this.base.node.onStateChange();
    }
}

module.exports = Chess;
