const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');

const BLUE = 0;
const RED = 1;
const SIDE_NAMES = ['Blue', 'Red'];
const SIDE_COLORS = [[96, 151, 184, 255], [174, 74, 70, 255]];
const T = {
    wood: [91, 63, 45, 255], woodLight: [126, 91, 64, 255],
    felt: [43, 69, 52, 255], cream: [244, 237, 216, 255], soft: [216, 207, 184, 255],
    muted: [224, 216, 193, 255], gold: [188, 149, 78, 255], ink: [42, 38, 34, 255],
    water: [42, 79, 99, 255], waterAlt: [46, 86, 108, 255], ship: [119, 128, 130, 255],
    shipSelected: [176, 145, 84, 255], miss: [179, 196, 199, 255], hit: [190, 76, 68, 255], sunk: [105, 47, 45, 255],
    good: [63, 99, 70, 255]
};
const labelsForShip = i => ['Carrier', 'Battle', 'Cruiser', 'Sub', 'Destroyer'][i];
const UNKNOWN = -1;
const SHOT_MISS = 0;
const SHOT_HIT = 1;
const FLEET = [
    { name: 'Carrier', short: 'Carrier', length: 5 },
    { name: 'Battleship', short: 'Battle', length: 4 },
    { name: 'Cruiser', short: 'Cruiser', length: 3 },
    { name: 'Submarine', short: 'Sub', length: 3 },
    { name: 'Destroyer', short: 'Destroyer', length: 2 }
];

class Battleship extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Battleship',
            author: "Joseph Garcia",
            description: 'Place your fleet by hand, then hunt your opponent across two private ocean grids.',
            aspectRatio: { x: 5, y: 8 },
            maxPlayers: 2,
            gameId: "35839de1-f18c-5dba-ad5d-4905bcc40b5f"
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: T.wood
        });
        this.table = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(3, 3, 94, 94),
            fill: T.felt, color: T.woodLight, border: 6
        });
        this.base.addChild(this.table);

        this.publicText = this.makeText('Sink all 5 ships · X hit · o miss · # sunk', 50, 10.2, 1.3, T.muted);
        this.base.addChildren(this.publicText);

        this.phase = 'waiting';
        this.turn = BLUE;
        this.startingSide = BLUE;
        this.shotCount = 0;
        this.matchScores = [0, 0];
        this.players = {};
        this.pressedPlayers = new Set();
        this.seats = [
            { playerId: null, isBot: false, name: 'Open seat' },
            { playerId: null, isBot: true, name: 'Computer' }
        ];
        this.ready = [false, true];
        this.fleets = [this.emptyFleet(), this.emptyFleet()];
        this.shipAt = [this.emptyGrid(-1), this.emptyGrid(-1)];
        this.placement = [this.newPlacement(), this.newPlacement()];
        this.shotsAgainst = [this.emptyGrid(UNKNOWN), this.emptyGrid(UNKNOWN)];
        this.lastShot = null;
        this.botToken = 0;
        this.botPending = false;
        this.randomizeFleet(RED);
    }

    getLayers() { return [{ root: this.base }]; }
    emptyGrid(value) { return Array.from({ length: 10 }, () => new Array(10).fill(value)); }
    emptyFleet() { return FLEET.map(s => ({ name: s.name, length: s.length, cells: [] })); }
    newPlacement() { return { selectedShip: 0, horizontal: true, message: '' }; }

    makeText(text, x, y, size, color, playerIds, align = 'center') {
        return new GameNode.Text({ textInfo: { text, x, y, size, align, color, font: 'default' }, playerIds });
    }

    makeButton(x, y, w, h, label, fill, onClick, playerIds) {
        const bg = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill, color: T.woodLight, border: 4,
            onClick: pid => this.pressOnce(pid, () => onClick(pid)), playerIds
        });
        const labelNode = this.makeText(label, x + w / 2, y + h * 0.27, 2.5, T.cream);
        bg.addChild(labelNode);
        bg._label = labelNode;
        return bg;
    }

    handleNewPlayer({ playerId, info }) {
        if (this.players[playerId]) return;
        const name = info && info.name ? String(info.name).trim().slice(0, 14) : `Player ${playerId}`;
        let seat = -1;
        if (this.seats[BLUE].playerId === null) seat = BLUE;
        else if (this.seats[RED].isBot && this.shotCount === 0 && this.phase !== 'over') {
            seat = RED;
            this.invalidateBot();
        }

        if (seat >= 0) {
            this.seats[seat] = { playerId, isBot: false, name };
            this.resetHumanFleet(seat);
            this.ready[seat] = false;
            this.phase = 'placing';
        }
        const view = seat >= 0 ? this.createPlayerView(playerId, seat) : this.createSpectatorView(playerId);
        this.players[playerId] = { seat, view };
        this.base.addChild(view.root);
        this.render();
        this.maybeStartGame();
    }

    createSpectatorView(playerId) {
        const root = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0), playerIds: [playerId] });
        root.addChild(this.makeText('This match is already underway', 50, 50, 2.0, T.soft, [playerId]));
        return { root };
    }

    createPlayerView(playerId, seat) {
        const root = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0), playerIds: [playerId] });
        const status = this.makeText('Place your fleet', 50, 13.6, 1.85, T.cream, [playerId]);
        const score = this.makeText('', 50, 17.2, 1.15, T.muted, [playerId]);
        const ownLabel = this.makeText('Your fleet', 32, 22.4, 3.2, T.cream, [playerId]);
        const targetLabel = this.makeText('Their waters', 68, 22.4, 3.2, T.cream, [playerId]);
        const hint = this.makeText('', 50, 70.5, 1.15, T.soft, [playerId]);
        const fleetText = this.makeText('', 50, 74.5, 1.0, T.muted, [playerId]);
        const youText = this.makeText(`You are the ${SIDE_NAMES[seat]} captain`, 50, 96, 1.6, T.cream, [0]);
        const ownCells = [], targetCells = [];
        // One larger grid at a time; fleet positions remain private to this player.
        const cellX = 8, cellY = 5, ownX = 10, targetX = 10, y0 = 30;
        const ownTab = this.makeButton(17, 21, 30, 6, '', T.wood, pid => this.showGrid(pid, 'fleet'), [playerId]);
        const targetTab = this.makeButton(53, 21, 30, 6, '', T.wood, pid => this.showGrid(pid, 'target'), [playerId]);
        root.addChildren(ownTab, targetTab);

        const letters = 'ABCDEFGHIJ';
        for (let c = 0; c < 10; c++) {
            root.addChild(this.makeText(letters[c], ownX + c * cellX + cellX * 0.48, y0 - 2.2, 2.5, T.muted, [playerId]));
        }
        for (let r = 0; r < 10; r++) {
            root.addChild(this.makeText(String(r + 1), ownX - 2.5, y0 + r * cellY + 1.7, 2.5, T.muted, [playerId], 'right'));
        }

        for (let r = 0; r < 10; r++) {
            ownCells[r] = []; targetCells[r] = [];
            for (let c = 0; c < 10; c++) {
                const own = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(ownX + c * cellX, y0 + r * cellY, cellX - 0.2, cellY - 0.2),
                    fill: T.water,
                    onClick: pid => this.pressOnce(pid, () => this.handleOwnClick(pid, r, c)),
                    playerIds: [playerId]
                });
                const target = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(targetX + c * cellX, y0 + r * cellY, cellX - 0.2, cellY - 0.2),
                    fill: T.water,
                    onClick: pid => this.pressOnce(pid, () => this.handleTargetClick(pid, r, c)),
                    playerIds: [playerId]
                });
                own._mark = this.makeText('', ownX + c * cellX + cellX / 2, y0 + r * cellY + 1.0, 4.8, T.cream);
                target._mark = this.makeText('', targetX + c * cellX + cellX / 2, y0 + r * cellY + 1.0, 4.8, T.cream);
                own.addChild(own._mark); target.addChild(target._mark);
                ownCells[r][c] = own; targetCells[r][c] = target;
                root.addChildren(own, target);
            }
        }

        const shipButtons = [];
        const labels = ['Carrier', 'Battle', 'Cruiser', 'Sub', 'Destroyer'];
        for (let i = 0; i < 5; i++) {
            const b = this.makeButton(4 + i * 18.4, 84.8, 17, 5.8, labels[i], T.wood, (pid) => this.selectShip(pid, i), [playerId]);
            shipButtons.push(b); root.addChild(b);
        }
        const rotate = this.makeButton(18, 91.8, 29, 5.2, 'Rotate', T.wood, (pid) => this.rotateShip(pid), [playerId]);
        const ready = this.makeButton(53, 91.8, 29, 5.2, 'Ready', T.good, (pid) => this.handleReady(pid), [playerId]);
        const rematch = this.makeButton(35, 90, 30, 7, 'Play again', T.wood, (pid) => this.handleRematch(pid), [0]);
        root.addChildren(status, score, ownLabel, targetLabel, hint, fleetText, youText, rotate, ready, rematch);
        return { root, status, score, ownLabel, targetLabel, hint, fleetText, ownCells, targetCells, shipButtons, rotate, ready, rematch, youText, ownTab, targetTab, gridMode: 'fleet', lastPhase: null };
    }

    showGrid(playerId, mode) {
        const p = this.players[playerId];
        if (!p || p.seat < 0 || (mode !== 'fleet' && mode !== 'target')) return;
        p.view.gridMode = mode;
        this.render();
    }

    // Squish 1.4.2 repeats clicks while held. Place or rotate once per press.
    pressOnce(playerId, action) {
        if (this.pressedPlayers.has(playerId)) return;
        this.pressedPlayers.add(playerId);
        action();
    }

    handleMouseUp(playerId) {
        this.pressedPlayers.delete(playerId);
    }

    handlePlayerDisconnect(playerId) {
        const p = this.players[playerId];
        if (!p) return;
        this.base.removeChild(p.view.root.id);
        this.pressedPlayers.delete(playerId);
        delete this.players[playerId];
        if (p.seat < 0) return;
        this.seats[p.seat] = { playerId: null, isBot: true, name: 'Computer' };
        if (this.phase === 'placing') {
            this.randomizeFleet(p.seat);
            this.ready[p.seat] = true;
            this.maybeStartGame();
        }
        this.render();
        this.scheduleBotIfNeeded();
    }

    resetHumanFleet(side) {
        this.shipAt[side] = this.emptyGrid(-1);
        this.fleets[side] = this.emptyFleet();
        this.placement[side] = this.newPlacement();
    }

    randomizeFleet(side) {
        // Random setup is strictly a computer-player convenience. Human setup
        // always goes through the manual select / rotate / place interaction.
        if (!this.seats[side] || !this.seats[side].isBot) return false;
        for (let attempt = 0; attempt < 300; attempt++) {
            const map = this.emptyGrid(-1);
            const ships = this.emptyFleet();
            let ok = true;
            for (let index = 0; index < FLEET.length; index++) {
                const spec = FLEET[index];
                let placed = false;
                for (let tries = 0; tries < 200; tries++) {
                    const horizontal = Math.random() < 0.5;
                    const row = Math.floor(Math.random() * (horizontal ? 10 : (11 - spec.length)));
                    const col = Math.floor(Math.random() * (horizontal ? (11 - spec.length) : 10));
                    const cells = this.cellsForPlacement(index, row, col, horizontal);
                    if (!this.cellsClear(map, cells, index)) continue;
                    for (const cell of cells) map[cell.row][cell.col] = index;
                    ships[index].cells = cells;
                    placed = true; break;
                }
                if (!placed) { ok = false; break; }
            }
            if (ok) { this.shipAt[side] = map; this.fleets[side] = ships; return true; }
        }

        // Defensive fallback: five separated horizontal rows. A computer fleet
        // is therefore always complete even under pathological random sequences.
        const map = this.emptyGrid(-1);
        const ships = this.emptyFleet();
        for (let index = 0; index < FLEET.length; index++) {
            const cells = this.cellsForPlacement(index, index * 2, 0, true);
            for (const cell of cells) map[cell.row][cell.col] = index;
            ships[index].cells = cells;
        }
        this.shipAt[side] = map;
        this.fleets[side] = ships;
        return true;
    }

    cellsForPlacement(shipIndex, row, col, horizontal) {
        const len = FLEET[shipIndex].length;
        const startRow = horizontal ? row : Math.min(row, 10 - len);
        const startCol = horizontal ? Math.min(col, 10 - len) : col;
        const cells = [];
        for (let k = 0; k < len; k++) cells.push({ row: startRow + (horizontal ? 0 : k), col: startCol + (horizontal ? k : 0) });
        return cells;
    }

    cellsClear(map, cells, ignoreShip) {
        return cells.every(cell => map[cell.row][cell.col] < 0 || map[cell.row][cell.col] === ignoreShip);
    }

    removeShip(side, shipIndex) {
        const ship = this.fleets[side][shipIndex];
        for (const cell of ship.cells) if (this.shipAt[side][cell.row][cell.col] === shipIndex) this.shipAt[side][cell.row][cell.col] = -1;
        ship.cells = [];
    }

    placeShip(side, shipIndex, row, col) {
        const placement = this.placement[side];
        const oldCells = this.fleets[side][shipIndex].cells.slice();
        this.removeShip(side, shipIndex);
        const cells = this.cellsForPlacement(shipIndex, row, col, placement.horizontal);
        if (!this.cellsClear(this.shipAt[side], cells, shipIndex)) {
            for (const cell of oldCells) this.shipAt[side][cell.row][cell.col] = shipIndex;
            this.fleets[side][shipIndex].cells = oldCells;
            placement.message = 'That spot overlaps another ship';
            return false;
        }
        for (const cell of cells) this.shipAt[side][cell.row][cell.col] = shipIndex;
        this.fleets[side][shipIndex].cells = cells;
        placement.message = `${FLEET[shipIndex].name} placed`;
        const next = this.fleets[side].findIndex(s => s.cells.length === 0);
        if (next >= 0) placement.selectedShip = next;
        return true;
    }

    allShipsPlaced(side) { return this.fleets[side].every(ship => ship.cells.length === ship.length); }

    handleOwnClick(playerId, row, col) {
        const p = this.players[playerId];
        if (!p || p.seat < 0 || this.phase !== 'placing' || this.ready[p.seat]) return;
        const side = p.seat;
        const existing = this.shipAt[side][row][col];
        if (existing >= 0) {
            this.placement[side].selectedShip = existing;
            const cells = this.fleets[side][existing].cells;
            if (cells.length > 1) this.placement[side].horizontal = cells[0].row === cells[1].row;
            this.removeShip(side, existing);
            this.placement[side].message = `Move your ${FLEET[existing].name}`;
            this.render();
            return;
        }
        this.placeShip(side, this.placement[side].selectedShip, row, col);
        this.render();
    }

    selectShip(playerId, shipIndex) {
        const p = this.players[playerId];
        if (!p || p.seat < 0 || this.phase !== 'placing' || this.ready[p.seat]) return;
        this.placement[p.seat].selectedShip = shipIndex;
        this.placement[p.seat].message = this.fleets[p.seat][shipIndex].cells.length ? `Tap the ${FLEET[shipIndex].name} on the grid to move it` : `Place your ${FLEET[shipIndex].name}`;
        this.render();
    }

    rotateShip(playerId) {
        const p = this.players[playerId];
        if (!p || p.seat < 0 || this.phase !== 'placing' || this.ready[p.seat]) return;
        const placement = this.placement[p.seat];
        placement.horizontal = !placement.horizontal;
        placement.message = placement.horizontal ? 'Horizontal placement' : 'Vertical placement';
        this.render();
    }

    handleReady(playerId) {
        const p = this.players[playerId];
        if (!p || p.seat < 0 || this.phase !== 'placing' || !this.allShipsPlaced(p.seat)) return;
        this.ready[p.seat] = true;
        this.placement[p.seat].message = 'Fleet ready';
        this.render();
        this.maybeStartGame();
    }

    maybeStartGame() {
        if (this.ready[BLUE] && this.ready[RED] && this.hasHuman()) {
            this.phase = 'playing';
            this.turn = this.startingSide;
            this.render();
            this.scheduleBotIfNeeded();
        }
    }

    handleTargetClick(playerId, row, col) {
        if (this.phase !== 'playing') return;
        const p = this.players[playerId];
        if (!p || p.seat !== this.turn || this.seats[this.turn].isBot) return;
        this.fire(p.seat, row, col);
    }

    fire(side, row, col) {
        if (this.phase !== 'playing' || side !== this.turn) return false;
        const target = 1 - side;
        if (this.shotsAgainst[target][row][col] !== UNKNOWN) return false;
        const shipIndex = this.shipAt[target][row][col];
        const hit = shipIndex >= 0;
        this.shotsAgainst[target][row][col] = hit ? SHOT_HIT : SHOT_MISS;
        this.lastShot = { side, target, row, col, hit, sunk: hit ? this.isShipSunk(target, shipIndex) : false };
        this.shotCount += 1;
        if (this.allShipsSunk(target)) {
            this.phase = 'over';
            this.matchScores[side] += 1;
            this.invalidateBot();
        } else this.turn = target;
        this.render();
        this.scheduleBotIfNeeded();
        return true;
    }

    isShipSunk(side, shipIndex) {
        const ship = this.fleets[side][shipIndex];
        return ship.cells.length > 0 && ship.cells.every(cell => this.shotsAgainst[side][cell.row][cell.col] === SHOT_HIT);
    }
    allShipsSunk(side) { return this.fleets[side].every((_, i) => this.isShipSunk(side, i)); }
    fleetStatus(side) { return this.fleets[side].map((ship, i) => `${ship.name} ${this.isShipSunk(side, i) ? '×' : '•'}`).join('   '); }

    chooseBotShot(targetSide) {
        const candidates = [];
        for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
            if (this.shotsAgainst[targetSide][r][c] !== SHOT_HIT) continue;
            const shipIndex = this.shipAt[targetSide][r][c];
            if (shipIndex < 0 || this.isShipSunk(targetSide, shipIndex)) continue;
            for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                const rr = r + dr, cc = c + dc;
                if (rr >= 0 && rr < 10 && cc >= 0 && cc < 10 && this.shotsAgainst[targetSide][rr][cc] === UNKNOWN) candidates.push([rr, cc]);
            }
        }
        if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
        const parity = [], all = [];
        for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if (this.shotsAgainst[targetSide][r][c] === UNKNOWN) {
            all.push([r, c]); if ((r + c) % 2 === 0) parity.push([r, c]);
        }
        const pool = parity.length ? parity : all;
        return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    }

    scheduleBotIfNeeded() {
        if (this.phase !== 'playing' || this.botPending || !this.hasHuman()) return;
        const seat = this.seats[this.turn];
        if (!seat || !seat.isBot) return;
        this.botPending = true;
        const side = this.turn, token = ++this.botToken;
        this.setTimeout(() => {
            if (token !== this.botToken) return;
            this.botPending = false;
            if (this.phase !== 'playing' || this.turn !== side || !this.seats[side].isBot) return;
            const shot = this.chooseBotShot(1 - side);
            if (shot) this.fire(side, shot[0], shot[1]);
        }, 430);
    }

    invalidateBot() { this.botToken += 1; this.botPending = false; }
    hasHuman() { return Object.values(this.players).some(p => p.seat >= 0); }

    handleRematch(playerId) {
        const p = this.players[playerId];
        if (!p || p.seat < 0 || this.phase !== 'over') return;
        this.resetRound();
    }

    resetRound() {
        this.invalidateBot();
        this.shotsAgainst = [this.emptyGrid(UNKNOWN), this.emptyGrid(UNKNOWN)];
        this.lastShot = null;
        this.shotCount = 0;
        this.startingSide = 1 - this.startingSide;
        this.turn = this.startingSide;
        this.ready = [false, false];
        for (let side = 0; side < 2; side++) {
            if (this.seats[side].isBot) { this.randomizeFleet(side); this.ready[side] = true; }
            else { this.resetHumanFleet(side); this.ready[side] = false; }
        }
        this.phase = this.hasHuman() ? 'placing' : 'waiting';
        this.render();
        this.maybeStartGame();
    }

    render() {
        for (const p of Object.values(this.players)) {
            if (p.seat < 0) continue;
            const side = p.seat, opp = 1 - side, view = p.view, placement = this.placement[side];
            if (view.lastPhase !== this.phase) {
                view.gridMode = this.phase === 'placing' ? 'fleet' : 'target';
                view.lastPhase = this.phase;
            }
            const pid = Number(view.root.node.playerIds[0]);
            view.ownTab.node.border = view.gridMode === 'fleet' ? 10 : 3;
            view.targetTab.node.border = view.gridMode === 'target' ? 10 : 3;
            view.ownTab.node.color = view.gridMode === 'fleet' ? T.cream : T.woodLight;
            view.targetTab.node.color = view.gridMode === 'target' ? T.cream : T.woodLight;
            view.ownLabel.node.text.text = `${view.gridMode === 'fleet' ? '▸ ' : ''}Your fleet`;
            view.targetLabel.node.text.text = `${view.gridMode === 'target' ? '▸ ' : ''}Their waters`;
            for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
                const own = view.ownCells[r][c], target = view.targetCells[r][c];
                const ownShip = this.shipAt[side][r][c], incoming = this.shotsAgainst[side][r][c], outgoing = this.shotsAgainst[opp][r][c];
                own.node.fill = ownShip >= 0 ? (this.phase === 'placing' && ownShip === placement.selectedShip ? T.shipSelected : T.ship) : ((r + c) % 2 ? T.water : T.waterAlt);
                own.node.color = ownShip >= 0 && this.phase === 'placing' && ownShip === placement.selectedShip ? T.gold : T.waterAlt;
                own.node.border = ownShip >= 0 && this.phase === 'placing' && ownShip === placement.selectedShip ? 5 : 0;
                if (incoming === SHOT_MISS) own.node.fill = T.miss;
                else if (incoming === SHOT_HIT) own.node.fill = ownShip >= 0 && this.isShipSunk(side, ownShip) ? T.sunk : T.hit;

                own.node.playerIds = view.gridMode === 'fleet' ? [pid] : [0];
                target.node.playerIds = view.gridMode === 'target' ? [pid] : [0];
                own._mark.node.text.text = incoming === SHOT_MISS ? 'o' : incoming === SHOT_HIT ? (this.isShipSunk(side, ownShip) ? '#' : 'X') : ownShip >= 0 ? '■' : '';
                own._mark.node.text.color = incoming === SHOT_MISS || (incoming === UNKNOWN && ownShip >= 0) ? T.ink : T.cream;
                target._mark.node.text.text = outgoing === SHOT_MISS ? 'o' : outgoing === SHOT_HIT ? (this.isShipSunk(opp, this.shipAt[opp][r][c]) ? '#' : 'X') : '';
                target._mark.node.text.color = outgoing === SHOT_MISS ? T.ink : T.cream;
                target.node.fill = (r + c) % 2 ? T.water : T.waterAlt;
                if (outgoing === SHOT_MISS) target.node.fill = T.miss;
                else if (outgoing === SHOT_HIT) {
                    const idx = this.shipAt[opp][r][c];
                    target.node.fill = idx >= 0 && this.isShipSunk(opp, idx) ? T.sunk : T.hit;
                } else if (this.phase === 'over' && this.shipAt[opp][r][c] >= 0) target.node.fill = [80, 94, 95, 255];
                else if (this.phase === 'playing' && this.turn === side) target.node.fill = (r + c) % 2 ? [49, 91, 113, 255] : [54, 98, 120, 255];
                const isLast = this.lastShot && this.lastShot.row === r && this.lastShot.col === c && this.lastShot.side === side;
                target.node.color = isLast ? T.cream : T.waterAlt;
                target.node.border = isLast ? 5 : 0;
            }

            let status = 'Place your fleet';
            let hint = '';
            if (this.phase === 'placing') {
                if (this.ready[side]) { status = 'Fleet ready'; hint = 'Waiting for the other captain'; }
                else {
                    const selected = FLEET[placement.selectedShip];
                    status = this.allShipsPlaced(side) ? 'Fleet ready' : `Place ${selected.name} · ${selected.length} squares`;
                    hint = view.gridMode === 'target' ? 'Place ships in Your fleet' : (placement.message || 'Tap a starting square');
                }
            } else if (this.phase === 'playing') {
                status = this.turn === side ? (view.gridMode === 'target' ? 'Your turn · Tap a square to fire' : 'Your turn · Choose Their waters to fire') : `${this.seats[this.turn].name} is aiming`;
                if (this.lastShot) {
                    const result = this.lastShot.hit ? (this.lastShot.sunk ? 'sunk a ship' : 'hit') : 'missed';
                    hint = `${this.seats[this.lastShot.side].name}: ${'ABCDEFGHIJ'[this.lastShot.col]}${this.lastShot.row + 1} · ${result}`;
                }
            } else if (this.phase === 'over') {
                const winner = this.allShipsSunk(side) ? opp : side;
                status = winner === side ? 'You won the battle' : `${this.seats[winner].name} won the battle`;
                hint = 'Their fleet is revealed';
            }

            view.status.node.text = { text: status, x: 50, y: 13.6, size: 4.0, align: 'center', color: T.cream, font: 'default' };
            view.score.node.text = { text: this.matchScores.some(Boolean) ? `${SIDE_NAMES[BLUE]} ${this.matchScores[BLUE]}   ·   ${this.matchScores[RED]} ${SIDE_NAMES[RED]}` : '', x: 50, y: 17.2, size: 3.0, align: 'center', color: T.muted, font: 'default' };
            view.hint.node.text = { text: hint, x: 50, y: 82, size: 3.0, align: 'center', color: T.soft, font: 'default' };
            view.fleetText.node.text = { text: this.phase === 'playing' || this.phase === 'over' ? `Ships afloat · You ${this.fleets[side].filter((_, i) => !this.isShipSunk(side, i)).length} · Rival ${this.fleets[opp].filter((_, i) => !this.isShipSunk(opp, i)).length}` : '', x: 50, y: 85.5, size: 2.5, align: 'center', color: T.muted, font: 'default' };

            for (let i = 0; i < view.shipButtons.length; i++) {
                const visible = this.phase === 'placing' && !this.ready[side];
                view.shipButtons[i].node.playerIds = visible ? [Number(p.view.root.node.playerIds[0])] : [0];
                view.shipButtons[i]._label.node.text.text = `${labelsForShip(i)} ${this.fleets[side][i].cells.length ? '✓' : FLEET[i].length}`;
                view.shipButtons[i]._label.node.text.size = 2.1;
                view.shipButtons[i].node.border = i === placement.selectedShip ? 10 : 4;
                view.shipButtons[i]._label.node.text.color = i === placement.selectedShip ? T.ink : T.cream;
                view.shipButtons[i].node.fill = i === placement.selectedShip ? T.gold : (this.fleets[side][i].cells.length ? [80, 105, 78, 255] : T.wood);
            }
            view.rotate.node.playerIds = this.phase === 'placing' && !this.ready[side] ? [p.view.root.node.playerIds[0]] : [0];
            view.ready.node.playerIds = this.phase === 'placing' && !this.ready[side] ? [pid] : [0];
            const placed = this.fleets[side].filter(ship => ship.cells.length).length;
            view.ready._label.node.text.text = this.allShipsPlaced(side) ? 'Ready to play' : `${placed} / 5 ships placed`;
            view.ready.node.fill = this.allShipsPlaced(side) ? T.good : T.wood;
            view.rotate._label.node.text.text = `Rotate · ${placement.horizontal ? 'Across →' : 'Down ↓'}`;
            view.rematch.node.playerIds = this.phase === 'over' ? [p.view.root.node.playerIds[0]] : [0];
        }
        this.publicText.node.text = { text: 'Sink all 5 ships · X hit · o miss · # sunk', x: 50, y: 10.2, size: 2.7, align: 'center', color: T.muted, font: 'default' };
        this.base.node.onStateChange();
    }
}

module.exports = Battleship;
