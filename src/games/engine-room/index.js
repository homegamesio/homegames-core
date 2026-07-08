const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');

const TICK_RATE = 10;
const MAX_PLAYERS = 8;

const CONTROLS_PER_PLAYER = 4;
const SECTOR_GOAL = 8;
const SECTOR_COUNT = 3;
const WIN_TOTAL = SECTOR_GOAL * SECTOR_COUNT;
const ORDER_SECONDS = { 1: 16, 2: 12, 3: 9 };
const HULL_MAX = 6;
const SECTOR_HULL_BONUS = 2;
const LABEL_MAX = 20;

// Text height in y-units at 16:9
const TEXT_H = (size) => size * 16 / 9;

// Engine-room palette: gunmetal with warning amber
const BG = [24, 28, 36, 255];
const CARD = [38, 45, 56, 255];
const CARD_EDGE = [92, 106, 128, 255];
const AMBER = [255, 190, 80, 255];
const INK = [228, 235, 242, 255];
const FAINT = [138, 150, 168, 255];
const GOOD = [120, 220, 150, 255];
const BAD = [235, 100, 90, 255];
const BAR_BG = [16, 19, 25, 255];

const ADJECTIVES = [
    'QUANTUM', 'SYNERGY', 'BACKUP', 'INVERTED', 'ARTISANAL', 'TURBO',
    'PASSIVE', 'AGILE', 'LEGACY', 'LUKEWARM', 'QUARTERLY', 'HYDRAULIC',
    'DECAF', 'PLASMA', 'HAUNTED', 'OFFSITE', 'COSMIC', 'MANDATORY',
    'EMOTIONAL', 'GLUTEN-FREE', 'WIRELESS', 'PRIMARY', 'FORBIDDEN', 'MOIST'
];
const NOUNS = [
    'FLANGE', 'VALVE', 'SPROCKET', 'PISTON', 'DYNAMO', 'WINCH',
    'GASKET', 'FUNNEL', 'NOZZLE', 'ROTOR', 'DAMPER', 'COUPLER',
    'SIPHON', 'KLAXON', 'BAFFLE', 'CRANK', 'BELLOWS', 'GIMBAL',
    'SPIGOT', 'THRUSTER', 'DONGLE', 'PLUNGER', 'MANIFOLD', 'TOGGLER'
];

const shuffled = (list) => {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

class EngineRoom extends Game {
    static metadata() {
        return {
            squishVersion: '142',
            name: 'Engine Room',
            author: 'Joseph Garcia',
            description: 'The ship is falling apart and the repair orders are on the wrong screens. Shout "SET THE QUARTERLY FLANGE TO 3" at your crew before the hull gives out. Loud, fast, and nobody\'s fault in particular.',
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
        this.controls = [];
        this.orders = {};
        this.hull = HULL_MAX;
        this.sector = 1;
        this.completedTotal = 0;
        this.fixes = {};
        this.relays = {};
        this.victory = false;
        this.feed = [];
        this.toastUntil = {};
        this.lobbyMsg = null;

        this.base = this.rect(0, 0, 100, 100, BG);

        this.titleLabel = this.text('ENGINE ROOM', 2, 1.5, 1.2, FAINT);
        this.hullLabel = this.text('', 2, 4.6, 1.2, AMBER);
        this.sectorLabel = this.text('', 50, 1.5, 1.5, INK, 'center');
        this.progressLabel = this.text('', 50, 4.8, 1.1, FAINT, 'center');
        this.feedNodes = [0, 1, 2].map(i => this.text('', 98, 1.5 + i * 2.4, 0.85, FAINT, 'right'));

        this.mainLayer = this.container();
        this.playerLayer = this.container();

        this.base.addChildren(
            this.titleLabel, this.hullLabel, this.sectorLabel, this.progressLabel,
            ...this.feedNodes,
            this.mainLayer, this.playerLayer
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

    makeButton({ x, y, w, h, label, size, fill, onClick }) {
        const bg = this.rect(x, y, w, h, fill, { border: 4, color: [14, 17, 22, 255], onClick });
        bg.addChild(this.text(label, x + w / 2, y + (h - TEXT_H(size)) / 2, size, INK, 'center'));
        return bg;
    }

    // ---- players ----

    handleNewPlayer({ playerId, info }) {
        const pid = Number(playerId);
        if (this.players[pid] || Object.keys(this.players).length >= MAX_PLAYERS) {
            return;
        }
        const name = ((info && info.name) || `CREW ${pid}`).toUpperCase().slice(0, 10);
        const root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds: [pid]
        });
        this.players[pid] = { name, root, toastNode: null, barNode: null };
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
        if (this.phase === 'playing' && this.roster.includes(pid)) {
            this.roster = this.roster.filter(id => id !== pid);
            delete this.orders[pid];
            const lostIds = new Set(this.controls.filter(c => c.owner === pid).map(c => c.id));
            this.controls = this.controls.filter(c => c.owner !== pid);
            if (this.roster.length < 2) {
                return this.abortToLobby('GAME ENDED - NOT ENOUGH CREW');
            }
            Object.keys(this.orders).forEach(opid => {
                if (lostIds.has(this.orders[opid].controlId)) {
                    this.issueOrder(Number(opid));
                }
            });
            this.pushFeed(`${p.name} WAS SUCKED INTO SPACE`);
        }
        this.refresh();
    }

    toastFor(pid, msg) {
        const p = this.players[pid];
        if (p && p.toastNode) {
            this.setText(p.toastNode, msg);
            this.toastUntil[pid] = this._t + 25;
        }
    }

    pushFeed(msg) {
        this.feed.unshift(msg.slice(0, 38));
        this.feed = this.feed.slice(0, 3);
        this.feedNodes.forEach((node, i) => this.setText(node, this.feed[i] || ''));
    }

    // ---- flow ----

    startGame(pid) {
        if (this.phase !== 'lobby' || !this.players[pid]) {
            return;
        }
        this.roster = Object.keys(this.players).map(Number);
        if (this.roster.length < 2) {
            return;
        }
        this.hull = HULL_MAX;
        this.sector = 1;
        this.completedTotal = 0;
        this.victory = false;
        this.fixes = {};
        this.relays = {};
        this.feed = [];
        this.orders = {};
        this.lobbyMsg = null;
        this.buildControls();
        this.phase = 'playing';
        this.roster.forEach(rpid => this.issueOrder(rpid));
        this.pushFeed('SECTOR 1 - GOOD LUCK OUT THERE');
        this.refresh();
    }

    buildControls() {
        const combos = [];
        ADJECTIVES.forEach(adj => {
            NOUNS.forEach(noun => {
                const label = `${adj} ${noun}`;
                if (label.length <= LABEL_MAX) {
                    combos.push(label);
                }
            });
        });
        const labels = shuffled(combos);
        this.controls = [];
        let id = 0;
        this.roster.forEach(pid => {
            const types = ['button', 'button', 'toggle', 'dial'];
            shuffled(types).forEach(type => {
                this.controls.push({
                    id: id++,
                    owner: pid,
                    type,
                    label: labels.pop(),
                    state: type === 'dial' ? 1 + Math.floor(Math.random() * 4) : Math.random() < 0.5
                });
            });
        });
    }

    orderTicks() {
        return ORDER_SECONDS[this.sector] * TICK_RATE;
    }

    issueOrder(pid) {
        if (!this.players[pid] || !this.roster.includes(pid)) {
            return;
        }
        const targeted = new Set(
            Object.keys(this.orders)
                .filter(opid => Number(opid) !== pid)
                .map(opid => this.orders[opid].controlId)
        );
        let pool = this.controls.filter(c => !targeted.has(c.id));
        if (!pool.length) {
            pool = this.controls;
        }
        const others = pool.filter(c => c.owner !== pid);
        const from = (others.length && Math.random() < 0.8) ? others : pool;
        const control = from[Math.floor(Math.random() * from.length)];
        let target = null;
        if (control.type === 'toggle') {
            target = !control.state;
        } else if (control.type === 'dial') {
            const options = [1, 2, 3, 4].filter(n => n !== control.state);
            target = options[Math.floor(Math.random() * options.length)];
        }
        this.orders[pid] = {
            controlId: control.id,
            type: control.type,
            target,
            deadline: this._t + this.orderTicks(),
            total: this.orderTicks()
        };
    }

    orderFrac(order) {
        return Math.max(0, Math.min(1, (order.deadline - this._t) / (order.total || this.orderTicks())));
    }

    orderText(order) {
        const control = this.controls.find(c => c.id === order.controlId);
        if (!control) {
            return '';
        }
        if (control.type === 'button') {
            return `ENGAGE THE ${control.label}`;
        }
        if (control.type === 'toggle') {
            return `TURN THE ${control.label} ${order.target ? 'ON' : 'OFF'}`;
        }
        return `SET THE ${control.label} TO ${order.target}`;
    }

    // ---- input ----

    operateControl(pid, controlId) {
        if (this.phase !== 'playing') {
            return;
        }
        const control = this.controls.find(c => c.id === controlId);
        if (!control || control.owner !== pid) {
            return;
        }
        let pressed = false;
        if (control.type === 'button') {
            pressed = true;
            this.toastFor(pid, `${control.label} ENGAGED`);
        } else if (control.type === 'toggle') {
            control.state = !control.state;
            this.toastFor(pid, `${control.label} IS NOW ${control.state ? 'ON' : 'OFF'}`);
        } else {
            control.state = control.state % 4 + 1;
            this.toastFor(pid, `${control.label} SET TO ${control.state}`);
        }
        this.checkOrders(control, pressed);
        this.refresh();
    }

    checkOrders(control, pressed) {
        const matches = Object.keys(this.orders).map(Number).filter(opid => {
            const order = this.orders[opid];
            if (order.controlId !== control.id) {
                return false;
            }
            return control.type === 'button' ? pressed : control.state === order.target;
        });
        matches.forEach(opid => {
            delete this.orders[opid];
            this.completedTotal++;
            this.fixes[control.owner] = (this.fixes[control.owner] || 0) + 1;
            this.relays[opid] = (this.relays[opid] || 0) + 1;
            this.pushFeed(`${control.label} FIXED`);
            this.toastFor(opid, 'YOUR ORDER GOT FILLED!');
        });
        if (!matches.length) {
            return;
        }
        if (this.completedTotal >= WIN_TOTAL) {
            return this.endGame(true);
        }
        const newSector = Math.min(SECTOR_COUNT, Math.floor(this.completedTotal / SECTOR_GOAL) + 1);
        if (newSector > this.sector) {
            this.sector = newSector;
            this.hull = Math.min(HULL_MAX, this.hull + SECTOR_HULL_BONUS);
            this.pushFeed(`SECTOR ${this.sector} - ORDERS COME FASTER`);
        }
        matches.forEach(opid => this.issueOrder(opid));
    }

    endGame(victory) {
        this.victory = victory;
        this.orders = {};
        this.phase = 'debrief';
        this.refresh();
    }

    playAgain(pid) {
        if (this.phase !== 'debrief' || !this.players[pid]) {
            return;
        }
        this.abortToLobby(null);
    }

    abortToLobby(msg) {
        this.phase = 'lobby';
        this.orders = {};
        this.lobbyMsg = msg;
        this.refresh();
    }

    // ---- game loop ----

    tick() {
        this._t++;
        if (this.phase === 'playing') {
            const expired = Object.keys(this.orders).map(Number)
                .filter(pid => this._t >= this.orders[pid].deadline);
            expired.forEach(pid => {
                const order = this.orders[pid];
                const control = this.controls.find(c => c.id === order.controlId);
                delete this.orders[pid];
                this.hull--;
                this.pushFeed(`${control ? control.label : 'AN ORDER'} MISSED - HULL HIT`);
                this.toastFor(pid, 'TOO SLOW! THE HULL TOOK A HIT.');
            });
            if (this.hull <= 0) {
                this.endGame(false);
            } else if (expired.length) {
                expired.forEach(pid => this.issueOrder(pid));
                this.refresh();
            }
            if (this.phase === 'playing') {
                this.roster.forEach(pid => {
                    const p = this.players[pid];
                    const order = this.orders[pid];
                    if (!p || !p.barNode || !order) {
                        return;
                    }
                    p.barNode.node.coordinates2d = ShapeUtils.rectangle(20, 15.8, 60 * this.orderFrac(order), 1.8);
                });
                this.dirty = true;
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
        if (this.phase === 'playing') {
            this.setText(this.hullLabel, `HULL [${'#'.repeat(this.hull)}${'-'.repeat(HULL_MAX - this.hull)}]`);
            this.setText(this.sectorLabel, `SECTOR ${this.sector}/${SECTOR_COUNT}`);
            this.setText(this.progressLabel, `REPAIRS ${this.completedTotal}/${WIN_TOTAL}`);
        } else {
            this.setText(this.hullLabel, '');
            this.setText(this.sectorLabel, '');
            this.setText(this.progressLabel, '');
            this.feed = [];
            this.feedNodes.forEach(node => this.setText(node, ''));
        }
        this.rebuildMain();
        Object.keys(this.players).forEach(pid => this.rebuildPlayerRoot(Number(pid)));
        this.base.node.onStateChange();
    }

    rebuildMain() {
        this.mainLayer.clearChildren();
        if (this.phase === 'lobby') {
            this.buildLobby();
        } else if (this.phase === 'debrief') {
            this.buildDebrief();
        }
    }

    buildLobby() {
        const s = this.mainLayer;
        s.addChild(this.text('ENGINE ROOM', 50.4, 8.4, 5, [0, 0, 0, 130], 'center'));
        s.addChild(this.text('ENGINE ROOM', 50, 8, 5, AMBER, 'center'));
        s.addChild(this.text('THE SHIP IS FALLING APART. THE REPAIR ORDERS ARE ON THE WRONG SCREENS.', 50, 22, 1.2, INK, 'center'));
        s.addChild(this.text('READ YOUR ORDER OUT LOUD. SOMEONE ELSE HAS THAT CONTROL.', 50, 26, 1.2, FAINT, 'center'));
        s.addChild(this.text(`SURVIVE ${SECTOR_COUNT} SECTORS. MISSED ORDERS COST HULL. SHOUTING HELPS.`, 50, 30, 1.2, FAINT, 'center'));
        if (this.lobbyMsg) {
            s.addChild(this.text(this.lobbyMsg, 50, 35, 1.3, BAD, 'center'));
        }
        const ids = Object.keys(this.players).map(Number);
        s.addChild(this.text(`CREW (${ids.length}/${MAX_PLAYERS})`, 40, 41, 1.2, FAINT));
        ids.forEach((pid, i) => {
            s.addChild(this.text(this.players[pid].name, 40, 45.5 + i * 4, 1.35, INK));
        });
        if (ids.length >= 2) {
            s.addChild(this.makeButton({
                x: 38, y: 82, w: 24, h: 8, label: 'LAUNCH', size: 1.6, fill: [170, 90, 45, 255],
                onClick: (playerId) => this.startGame(Number(playerId))
            }));
        } else {
            s.addChild(this.text('NEED AT LEAST 2 CREW (BEST WITH 3+)', 50, 84, 1.2, FAINT, 'center'));
        }
    }

    buildDebrief() {
        const s = this.mainLayer;
        s.addChild(this.text(
            this.victory ? 'THE SHIP SURVIVES ANOTHER QUARTER' : 'THE SHIP EXPLODED',
            50, 10, 2.8, this.victory ? GOOD : BAD, 'center'
        ));
        s.addChild(this.text(
            this.victory
                ? 'ALL SECTORS CLEARED. HR WILL HEAR ABOUT THE SHOUTING.'
                : `MADE IT TO SECTOR ${this.sector} WITH ${this.completedTotal} REPAIRS. GOOD MEETING, EVERYONE.`,
            50, 16, 1.3, FAINT, 'center'
        ));

        const ids = Object.keys(this.players).map(Number).filter(pid => this.roster.includes(pid));
        const best = (byPid) => {
            let top = null;
            ids.forEach(pid => {
                if ((byPid[pid] || 0) > 0 && (!top || byPid[pid] > byPid[top])) {
                    top = pid;
                }
            });
            return top;
        };
        const goldenHands = best(this.fixes);
        const clearestComms = best(this.relays);
        let y = 25;
        if (goldenHands) {
            s.addChild(this.text(`GOLDEN HANDS: ${this.players[goldenHands].name} (${this.fixes[goldenHands]} FIXES)`, 50, y, 1.5, AMBER, 'center'));
            y += 5;
        }
        if (clearestComms) {
            s.addChild(this.text(`CLEAREST COMMS: ${this.players[clearestComms].name} (${this.relays[clearestComms]} ORDERS FILLED)`, 50, y, 1.5, AMBER, 'center'));
            y += 5;
        }

        y += 3;
        s.addChild(this.text('CREW  /  FIXES  /  ORDERS FILLED', 50, y, 1.1, FAINT, 'center'));
        y += 4;
        ids.sort((a, b) => (this.fixes[b] || 0) - (this.fixes[a] || 0)).forEach(pid => {
            s.addChild(this.text(
                `${this.players[pid].name}  ${this.fixes[pid] || 0}  /  ${this.relays[pid] || 0}`,
                50, y, 1.3, INK, 'center'
            ));
            y += 3.8;
        });

        s.addChild(this.makeButton({
            x: 37, y: 84, w: 26, h: 8, label: 'PLAY AGAIN', size: 1.6, fill: [170, 90, 45, 255],
            onClick: (playerId) => this.playAgain(Number(playerId))
        }));
    }

    rebuildPlayerRoot(pid) {
        const p = this.players[pid];
        if (!p) {
            return;
        }
        p.root.clearChildren();
        p.toastNode = null;
        p.barNode = null;
        if (this.phase === 'lobby') {
            const ids = Object.keys(this.players).map(Number);
            p.root.addChild(this.text('< YOU', 58, 45.5 + ids.indexOf(pid) * 4, 1.2, AMBER));
            return;
        }
        if (this.phase !== 'playing') {
            return;
        }
        if (!this.roster.includes(pid)) {
            p.root.addChild(this.text('YOU JOIN THE NEXT SHIFT - ENJOY THE CHAOS.', 50, 50, 1.4, FAINT, 'center'));
            return;
        }

        p.toastNode = this.text('', 50, 97.2, 1.1, AMBER, 'center');
        p.root.addChild(p.toastNode);

        const order = this.orders[pid];
        if (order) {
            const control = this.controls.find(c => c.id === order.controlId);
            const mine = control && control.owner === pid;
            p.root.addChild(this.text(this.orderText(order), 50, 9.2, 1.7, INK, 'center'));
            p.root.addChild(this.text(
                mine ? "IT'S ON YOUR CONSOLE - DO IT!" : "SHOUT IT OUT - IT'S ON SOMEONE ELSE'S CONSOLE",
                50, 13, 1, FAINT, 'center'
            ));
            p.root.addChild(this.rect(20, 15.8, 60, 1.8, BAR_BG));
            p.barNode = this.rect(20, 15.8, 60 * this.orderFrac(order), 1.8, AMBER);
            p.root.addChild(p.barNode);
        }

        const mine = this.controls.filter(c => c.owner === pid);
        mine.forEach((control, i) => {
            const x = 4 + (i % 2) * 48;
            const y = 21 + Math.floor(i / 2) * 37;
            const card = this.rect(x, y, 44, 34, CARD, {
                border: 4, color: CARD_EDGE,
                onClick: (playerId) => this.operateControl(Number(playerId), control.id)
            });
            card.addChild(this.text(control.label, x + 22, y + 2.2, 1.15, AMBER, 'center'));
            if (control.type === 'button') {
                card.addChild(this.text('[ ENGAGE ]', x + 22, y + 13, 2.2, BAD, 'center'));
                card.addChild(this.text('TAP TO ENGAGE', x + 22, y + 29, 0.9, FAINT, 'center'));
            } else if (control.type === 'toggle') {
                card.addChild(this.text(control.state ? 'ON' : 'OFF', x + 22, y + 11.5, 3, control.state ? GOOD : FAINT, 'center'));
                card.addChild(this.text('TAP TO FLIP', x + 22, y + 29, 0.9, FAINT, 'center'));
            } else {
                card.addChild(this.text(String(control.state), x + 22, y + 10.5, 3.4, INK, 'center'));
                card.addChild(this.text(`POSITION ${control.state} OF 4`, x + 22, y + 24.5, 1, FAINT, 'center'));
                card.addChild(this.text('TAP TO CYCLE', x + 22, y + 29, 0.9, FAINT, 'center'));
            }
            p.root.addChild(card);
        });
    }
}

module.exports = EngineRoom;
