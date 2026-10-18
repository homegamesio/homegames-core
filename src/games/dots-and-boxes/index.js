const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { COLORS } = Colors;

const BOXES = 4;
const P0 = 0;
const P1 = 1;
const SIDE_NAMES = ['Blue', 'Gold'];
const SIDE_COLORS = [[90, 122, 137, 255], [199, 159, 77, 255]];
const BG = [42, 65, 50, 255];
const DOT = [238, 228, 205, 255];
const EDGE_IDLE = [110, 94, 72, 255];
const BOX_IDLE = [47, 70, 54, 255];

class DotsAndBoxes extends Game {
    static metadata() {
        return {
            isTest: true, // Showcase review: docs/game-curation.json.
            thumbnail: './assets/thumbnail.png',
            squishVersion: '150',
            name: 'Dots & Boxes',
            author: "Joseph Garcia",
            description: 'Claim more boxes than your opponent by drawing the final edge.',
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

        this.hEdges = Array.from({ length: BOXES + 1 }, () => new Array(BOXES).fill(-1));
        this.vEdges = Array.from({ length: BOXES }, () => new Array(BOXES + 1).fill(-1));
        this.boxOwners = Array.from({ length: BOXES }, () => new Array(BOXES).fill(-1));
        this.turn = P0;
        this.phase = 'waiting';
        this.roundScores = [0, 0];
        this.matchScores = [0, 0];
        this.lastEdge = null;
        this.players = {};
        this.seats = [
            { playerId: null, isBot: false, name: 'Open seat' },
            { playerId: null, isBot: true, name: 'Computer' }
        ];
        this.botToken = 0;
        this.botPending = false;
        this.animating = false;
        this.animationToken = 0;

        this.statusText = this.makeText('Take a seat to begin', 50, 10, 1.9, [244, 237, 216, 255]);
        this.scoreText = this.makeText('Blue 0   —   0 Gold', 50, 14, 1.4, [188, 174, 148, 255]);
        this.hintText = this.makeText('Complete a box to play again', 50, 84, 1.25, [188, 174, 148, 255]);
        this.leftSeatText = this.makeText('Blue · Open seat', 22, 89, 1.25, SIDE_COLORS[P0]);
        this.rightSeatText = this.makeText('Gold · Computer', 78, 89, 1.25, SIDE_COLORS[P1]);

        this.originX = 21;
        this.originY = 22;
        this.gap = 14.5;
        this.edgeThickness = 2.2;
        this.boxNodes = [];
        this.hEdgeNodes = [];
        this.vEdgeNodes = [];
        this.dotNodes = [];

        for (let row = 0; row < BOXES; row++) {
            this.boxNodes[row] = [];
            for (let col = 0; col < BOXES; col++) {
                const x = this.originX + col * this.gap + 1.8;
                const y = this.originY + row * this.gap + 1.8;
                const box = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(x, y, this.gap - 3.6, this.gap - 3.6),
                    fill: BOX_IDLE
                });
                this.boxNodes[row][col] = box;
                this.base.addChild(box);
            }
        }

        for (let row = 0; row <= BOXES; row++) {
            this.hEdgeNodes[row] = [];
            for (let col = 0; col < BOXES; col++) {
                const x = this.originX + col * this.gap + 1.2;
                const y = this.originY + row * this.gap - this.edgeThickness / 2;
                const edge = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(x, y, this.gap - 2.4, this.edgeThickness),
                    fill: EDGE_IDLE,
                    onClick: (playerId) => this.handleEdgeClick(playerId, 'h', row, col)
                });
                this.hEdgeNodes[row][col] = edge;
                this.base.addChild(edge);
            }
        }

        for (let row = 0; row < BOXES; row++) {
            this.vEdgeNodes[row] = [];
            for (let col = 0; col <= BOXES; col++) {
                const x = this.originX + col * this.gap - this.edgeThickness / 2;
                const y = this.originY + row * this.gap + 1.2;
                const edge = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(x, y, this.edgeThickness, this.gap - 2.4),
                    fill: EDGE_IDLE,
                    onClick: (playerId) => this.handleEdgeClick(playerId, 'v', row, col)
                });
                this.vEdgeNodes[row][col] = edge;
                this.base.addChild(edge);
            }
        }

        for (let row = 0; row <= BOXES; row++) {
            for (let col = 0; col <= BOXES; col++) {
                const x = this.originX + col * this.gap;
                const y = this.originY + row * this.gap;
                const dot = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(x - 1.3, y - 1.3, 2.6, 2.6),
                    fill: DOT
                });
                this.dotNodes.push(dot);
                this.base.addChild(dot);
            }
        }

        this.rematchButton = this.makeButton(35, 93, 30, 5, 'Play again', [116, 82, 53, 255], () => {
            if (this.phase === 'over') this.resetRound();
        });
        this.rematchButton.node.playerIds = [0];
        this.base.addChildren(this.statusText, this.scoreText, this.hintText, this.leftSeatText, this.rightSeatText, this.rematchButton);
        this.render();
    }

    getLayers() { return [{ root: this.base }]; }
    makeText(text, x, y, size, color, playerIds) {
        return new GameNode.Text({ textInfo: { text, x, y, size, align: 'center', color, font: 'default' }, playerIds });
    }
    makeButton(x, y, w, h, label, fill, onClick) {
        const bg = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(x,y,w,h), fill, color: COLORS.WHITE, border: 3, onClick });
        bg.addChild(this.makeText(label, x+w/2, y+1, 1.55, COLORS.WHITE));
        return bg;
    }

    handleNewPlayer({ playerId, info }) {
        if (this.players[playerId]) return;
        const name = info && info.name ? String(info.name).trim().slice(0, 14) : `Player ${playerId}`;
        let seat = -1;
        if (this.seats[P0].playerId === null) seat = P0;
        else if (this.seats[P1].isBot) { seat = P1; this.invalidateBot(); }
        if (seat < 0) return;
        this.seats[seat] = { playerId, isBot: false, name };
        const youText = this.makeText(`Playing as ${SIDE_NAMES[seat]}`, 50, 98, 1.15, SIDE_COLORS[seat], [playerId]);
        this.players[playerId] = { seat, youText };
        this.base.addChild(youText);
        if (this.phase === 'waiting') this.phase = 'playing';
        this.render();
        this.scheduleBotIfNeeded();
    }

    handlePlayerDisconnect(playerId) {
        const p = this.players[playerId];
        if (!p) return;
        this.base.removeChild(p.youText.id);
        delete this.players[playerId];
        this.seats[p.seat] = { playerId: null, isBot: true, name: 'Computer' };
        this.render();
        this.scheduleBotIfNeeded();
    }

    handleEdgeClick(playerId, kind, row, col) {
        if (this.phase !== 'playing' || this.animating) return;
        const p = this.players[playerId];
        if (!p || p.seat !== this.turn || this.seats[this.turn].isBot) return;
        this.claimEdge(kind, row, col, p.seat);
    }

    edgeOwner(kind, row, col) {
        return kind === 'h' ? this.hEdges[row][col] : this.vEdges[row][col];
    }

    setEdgeOwner(kind, row, col, side) {
        if (kind === 'h') this.hEdges[row][col] = side;
        else this.vEdges[row][col] = side;
    }

    adjacentBoxes(kind, row, col) {
        const boxes = [];
        if (kind === 'h') {
            if (row > 0) boxes.push([row - 1, col]);
            if (row < BOXES) boxes.push([row, col]);
        } else {
            if (col > 0) boxes.push([row, col - 1]);
            if (col < BOXES) boxes.push([row, col]);
        }
        return boxes;
    }

    boxComplete(row, col) {
        return this.hEdges[row][col] !== -1 && this.hEdges[row + 1][col] !== -1 && this.vEdges[row][col] !== -1 && this.vEdges[row][col + 1] !== -1;
    }

    claimEdge(kind, row, col, side) {
        if (this.phase !== 'playing' || this.animating || side !== this.turn || this.edgeOwner(kind,row,col) !== -1) return false;
        this.setEdgeOwner(kind,row,col,side);
        this.lastEdge = { kind, row, col, side };
        this.animating = true;
        this.render();
        this.animateEdge(kind, row, col, side, () => this.finishEdgeClaim(kind, row, col, side));
        return true;
    }

    edgeCoordinates(kind, row, col, progress = 1) {
        const k = Math.max(0.05, Math.min(1, progress));
        if (kind === 'h') {
            const x = this.originX + col * this.gap + 1.2;
            const y = this.originY + row * this.gap - this.edgeThickness / 2;
            return ShapeUtils.rectangle(x, y, (this.gap - 2.4) * k, this.edgeThickness);
        }
        const x = this.originX + col * this.gap - this.edgeThickness / 2;
        const y = this.originY + row * this.gap + 1.2;
        return ShapeUtils.rectangle(x, y, this.edgeThickness, (this.gap - 2.4) * k);
    }

    animateEdge(kind, row, col, side, onDone) {
        const token = ++this.animationToken;
        const node = kind === 'h' ? this.hEdgeNodes[row][col] : this.vEdgeNodes[row][col];
        const frames = 5;
        const step = (frame) => {
            if (token !== this.animationToken) return;
            node.node.coordinates2d = this.edgeCoordinates(kind, row, col, frame / frames);
            node.node.fill = SIDE_COLORS[side];
            this.base.node.onStateChange();
            if (frame >= frames) {
                this.animating = false;
                onDone();
                return;
            }
            this.setTimeout(() => step(frame + 1), 24);
        };
        step(1);
    }

    finishEdgeClaim(kind, row, col, side) {
        let completed = 0;
        for (const [br,bc] of this.adjacentBoxes(kind,row,col)) {
            if (this.boxOwners[br][bc] === -1 && this.boxComplete(br,bc)) {
                this.boxOwners[br][bc] = side;
                this.roundScores[side] += 1;
                completed += 1;
            }
        }
        if (this.roundScores[P0] + this.roundScores[P1] === BOXES * BOXES) {
            this.phase = 'over';
            if (this.roundScores[P0] > this.roundScores[P1]) this.matchScores[P0] += 1;
            else if (this.roundScores[P1] > this.roundScores[P0]) this.matchScores[P1] += 1;
            this.invalidateBot();
        } else if (!completed) {
            this.turn = 1 - this.turn;
        }
        this.render();
        this.scheduleBotIfNeeded();
    }

    allOpenEdges() {
        const out = [];
        for (let r=0;r<=BOXES;r++) for (let c=0;c<BOXES;c++) if (this.hEdges[r][c] === -1) out.push({kind:'h',row:r,col:c});
        for (let r=0;r<BOXES;r++) for (let c=0;c<=BOXES;c++) if (this.vEdges[r][c] === -1) out.push({kind:'v',row:r,col:c});
        return out;
    }

    edgesAroundBox(row,col) {
        return [
            {kind:'h',row,col}, {kind:'h',row:row+1,col},
            {kind:'v',row,col}, {kind:'v',row,col:col+1}
        ];
    }

    openEdgesAroundBox(row,col) {
        return this.edgesAroundBox(row,col).filter(e => this.edgeOwner(e.kind,e.row,e.col) === -1);
    }

    chooseBotEdge() {
        const open = this.allOpenEdges();
        if (!open.length) return null;

        // Always take a box if one is available.
        for (let r=0;r<BOXES;r++) for (let c=0;c<BOXES;c++) {
            if (this.boxOwners[r][c] !== -1) continue;
            const gaps = this.openEdgesAroundBox(r,c);
            if (gaps.length === 1) return gaps[0];
        }

        // Prefer edges that do not create a three-sided box for the opponent.
        const safe = [];
        for (const edge of open) {
            let dangerous = false;
            for (const [br,bc] of this.adjacentBoxes(edge.kind,edge.row,edge.col)) {
                if (this.boxOwners[br][bc] !== -1) continue;
                const gaps = this.openEdgesAroundBox(br,bc);
                if (gaps.length === 2) dangerous = true;
            }
            if (!dangerous) safe.push(edge);
        }
        const pool = safe.length ? safe : open;
        return pool[Math.floor(Math.random()*pool.length)];
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
            const edge = this.chooseBotEdge();
            if (edge) this.claimEdge(edge.kind,edge.row,edge.col,side);
        }, 300);
    }

    invalidateBot(){ this.botToken += 1; this.botPending = false; }
    hasHuman(){ return Object.keys(this.players).length > 0; }
    resetRound(){
        this.invalidateBot();
        this.hEdges = Array.from({ length: BOXES + 1 }, () => new Array(BOXES).fill(-1));
        this.vEdges = Array.from({ length: BOXES }, () => new Array(BOXES + 1).fill(-1));
        this.boxOwners = Array.from({ length: BOXES }, () => new Array(BOXES).fill(-1));
        this.roundScores = [0,0];
        this.turn = P0;
        this.phase = this.hasHuman() ? 'playing' : 'waiting';
        this.lastEdge = null;
        this.animating = false;
        this.animationToken += 1;
        for (let r=0;r<=BOXES;r++) for (let c=0;c<BOXES;c++) this.hEdgeNodes[r][c].node.coordinates2d = this.edgeCoordinates('h', r, c, 1);
        for (let r=0;r<BOXES;r++) for (let c=0;c<=BOXES;c++) this.vEdgeNodes[r][c].node.coordinates2d = this.edgeCoordinates('v', r, c, 1);
        this.render();
        this.scheduleBotIfNeeded();
    }

    render() {
        for (let r=0;r<BOXES;r++) for (let c=0;c<BOXES;c++) {
            const owner = this.boxOwners[r][c];
            this.boxNodes[r][c].node.fill = owner === -1 ? BOX_IDLE : [SIDE_COLORS[owner][0], SIDE_COLORS[owner][1], SIDE_COLORS[owner][2], 255];
            this.boxNodes[r][c].node.color = owner === -1 ? [0,0,0,0] : COLORS.WHITE;
        }
        for (let r=0;r<=BOXES;r++) for (let c=0;c<BOXES;c++) {
            const owner = this.hEdges[r][c];
            const last = this.lastEdge && this.lastEdge.kind==='h' && this.lastEdge.row===r && this.lastEdge.col===c;
            this.hEdgeNodes[r][c].node.fill = owner === -1 ? EDGE_IDLE : SIDE_COLORS[owner];
            this.hEdgeNodes[r][c].node.color = last ? COLORS.WHITE : this.hEdgeNodes[r][c].node.fill;
            this.hEdgeNodes[r][c].node.border = last ? 5 : 0;
        }
        for (let r=0;r<BOXES;r++) for (let c=0;c<=BOXES;c++) {
            const owner = this.vEdges[r][c];
            const last = this.lastEdge && this.lastEdge.kind==='v' && this.lastEdge.row===r && this.lastEdge.col===c;
            this.vEdgeNodes[r][c].node.fill = owner === -1 ? EDGE_IDLE : SIDE_COLORS[owner];
            this.vEdgeNodes[r][c].node.color = last ? COLORS.WHITE : this.vEdgeNodes[r][c].node.fill;
            this.vEdgeNodes[r][c].node.border = last ? 5 : 0;
        }

        let status='Take a seat to begin';
        let hint='Complete a box to play again';
        if (this.phase==='playing') {
            const seat=this.seats[this.turn];
            if (this.animating) { status='Drawing the line…'; hint=''; }
            else { status=seat.isBot?'Computer is thinking…':`${seat.name}'s turn`; hint=seat.isBot?'':'Complete a box to keep your turn'; }
        } else if (this.phase==='over') {
            if (this.roundScores[P0] > this.roundScores[P1]) { status=`${this.seats[P0].name} wins`; hint=`${this.roundScores[P0]} boxes claimed`; }
            else if (this.roundScores[P1] > this.roundScores[P0]) { status=`${this.seats[P1].name} wins`; hint=`${this.roundScores[P1]} boxes claimed`; }
            else { status='Draw'; hint='The grid ends even'; }
        }
        this.statusText.node.text={text:status,x:50,y:10,size:1.9,align:'center',color:[244, 237, 216, 255],font:'default'};
        this.scoreText.node.text={text:`Blue ${this.roundScores[P0]}   —   ${this.roundScores[P1]} Gold`,x:50,y:14,size:1.4,align:'center',color:[188, 174, 148, 255],font:'default'};
        this.hintText.node.text={text:hint,x:50,y:84,size:1.25,align:'center',color:this.phase==='over'?[244, 237, 216, 255]:[188, 174, 148, 255],font:'default'};
        this.leftSeatText.node.text={text:`Blue · ${this.seats[P0].name} · ${this.matchScores[P0]}`,x:22,y:89,size:1.25,align:'center',color:SIDE_COLORS[P0],font:'default'};
        this.rightSeatText.node.text={text:`Gold · ${this.seats[P1].name} · ${this.matchScores[P1]}`,x:78,y:89,size:1.25,align:'center',color:SIDE_COLORS[P1],font:'default'};
        this.rematchButton.node.playerIds=this.phase==='over'?[]:[0];
        this.base.node.onStateChange();
    }
}
module.exports = DotsAndBoxes;
