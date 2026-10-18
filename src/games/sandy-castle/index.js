const { Game, GameNode, Shapes } = require('squish-150');
const { BeachAudio } = require('./audio');

const ASPECT = 1.5, TAU = Math.PI * 2;
const HIDDEN = [[0, 0], [0, 0], [0, 0]];
const C = {
    sky: [208, 240, 240, 255], sea: [96, 190, 195, 255], seaLight: [151, 220, 214, 255],
    white: [255, 253, 237, 255], sand: [249, 222, 171, 255], damp: [226, 184, 121, 255],
    castle: [246, 205, 139, 255], shade: [218, 173, 106, 255], ink: [62, 92, 100, 255],
    muted: [105, 129, 123, 255], coral: [237, 133, 113, 255], mint: [118, 185, 150, 255],
    purple: [164, 145, 197, 255], yellow: [253, 199, 94, 255], blue: [86, 168, 192, 255],
};
const FLAG_COLORS = [C.coral, C.mint, C.purple];
const SLOTS = [{ x: 76, y: 75, height: 18 }, { x: 96, y: 75, height: 28 }, { x: 116, y: 75, height: 21 }];
const MOLDS = [{ name: 'castle', height: 18 }, { name: 'dome', height: 27 }, { name: 'pointy', height: 22 }];
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, p) => a + (b - a) * p;
const ease = p => { p = clamp(p, 0, 1); return p * p * (3 - 2 * p); };
const closed = p => [...p, p[0]];
const rect = (x, y, w, h) => closed([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
const oval = (x, y, rx, ry = rx, n = 24) => Array.from({ length: n + 1 }, (_, i) => [x + Math.cos(i * TAU / n) * rx, y + Math.sin(i * TAU / n) * ry]);
const star = (x, y, r) => closed(Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + i * Math.PI / 5, length = i % 2 ? r * .48 : r;
    return [x + Math.cos(a) * length, y + Math.sin(a) * length];
}));
const line = (a, b, width) => {
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]), x = Math.sin(angle) * width / 2, y = Math.cos(angle) * width / 2;
    return closed([[a[0] + x, a[1] - y], [b[0] + x, b[1] - y], [b[0] - x, b[1] + y], [a[0] - x, a[1] + y]]);
};

class SandyCastle extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Sandy Castle',
            author: "Joseph Garcia",
            createdBy: "Joseph Garcia",
            description: 'Scoop, pat, and build a sunny sandcastle. Add flags and shells, then send a gentle wave. No hurry and no losing.',
            aspectRatio: { x: 3, y: 2 },
            tickRate: 30,
            maxPlayers: 1,
            assets: {},
            gameId: "448af41f-29de-5f52-a505-d9f33196e605"
        };
    }
    constructor({ addAsset } = {}) {
        super(); this.addAsset = addAsset; this.players = new Map(); this.time = 0; this.phase = 'scoop'; this.phaseStarted = 0;
        this.towersBuilt = 0; this.round = 0; this.sound = true; this.decorationCount = 0; this.shellSlot = 0;
        this.slots = SLOTS.map(s => ({ ...s })); this.towerMolds = [null, null, null]; this.mold = 0; this.pendingSlot = 0;
        this.crabHop = 0; this.decorating = null; this.selectedDecoration = null;
        this.base = this.shape(rect(0, 0, 150, 100), C.sky);
        this.scenery = this.group(this.base); this.castleLayer = this.group(this.base); this.toolLayer = this.group(this.base);
        this.decorLayer = this.group(this.base); this.creatureLayer = this.group(this.base); this.waveLayer = this.group(this.base);
        this.hud = this.group(this.base); this.highlightLayer = this.group(this.base); this.audioRoot = this.group(this.base);
        this.audio = new BeachAudio(this.audioRoot);
        this.buildScenery(); this.buildCastle(); this.buildTools(); this.buildCrab(); this.buildHud();
        this.highlight = this.put(this.highlightLayer, this.shape(HIDDEN, C.yellow));
        this.spotRings = SLOTS.map(() => this.put(this.highlightLayer, this.shape(HIDDEN, C.yellow)));
        this.choiceRing = this.put(this.highlightLayer, this.shape(HIDDEN, C.yellow));
        this.wave = this.put(this.waveLayer, this.shape(HIDDEN, C.seaLight));
        this.waveFoam = this.put(this.waveLayer, this.shape(HIDDEN, C.white));
        this.draw(); this.updateHud();
        const touch = this.put(this.base, this.shape(rect(0, 0, 150, 100), null, { onClick: (id, x, y) => this.pointerDown(id, x, y) }));
        touch.node.offClick = id => { const player = this.players.get(id); if (player) player.pointer = false; };
    }
    getLayers() { return [{ root: this.base }]; }
    getAssets() { return this.audio.assets; }
    coords(points) { return points.map(([x, y]) => [clamp(x / ASPECT), clamp(y)]); }
    shape(points, fill, options = {}) { return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: this.coords(points), ...(fill ? { fill } : {}), ...options }); }
    put(parent, node) { parent.addChild(node, false); return node; }
    group(parent) { return this.put(parent, this.shape(HIDDEN)); }
    polygon(parent, points, color) { return this.put(parent, this.shape(points, color)); }
    disk(parent, x, y, rx, ry, color) { return this.polygon(parent, oval(x, y, rx, ry), color); }
    text(parent, text, x, y, size, color = C.ink) { return this.put(parent, new GameNode.Text({ textInfo: { text, x: x / ASPECT, y, size: size / (ASPECT * Math.SQRT2), color, align: 'center', font: 'Trebuchet MS, sans-serif' } })); }
    setText(node, text) { node.node.text = { ...node.node.text, text }; }
    object(parent) { return { root: this.group(parent), parts: [] }; }
    part(object, points, color) { const node = this.polygon(object.root, points, color); object.parts.push({ node, points }); return node; }
    place(object, x, y, scale = 1, angle = 0) {
        const ca = Math.cos(angle), sa = Math.sin(angle);
        for (const part of object.parts) part.node.node.coordinates2d = this.coords(part.points.map(([px, py]) => [x + (px * ca - py * sa) * scale, y + (px * sa + py * ca) * scale]));
    }
    hide(object) { for (const part of object.parts) part.node.node.coordinates2d = HIDDEN; }
    buildScenery() {
        this.disk(this.scenery, 21, 28, 7, 7, C.yellow);
        for (let i = 0; i < 10; i++) {
            const a = i * TAU / 10;
            this.polygon(this.scenery, line([21 + Math.cos(a) * 9, 28 + Math.sin(a) * 9], [21 + Math.cos(a) * 10.7, 28 + Math.sin(a) * 10.7], .7), C.yellow);
        }
        this.disk(this.scenery, 19, 27, .4, .6, C.ink); this.disk(this.scenery, 23, 27, .4, .6, C.ink);
        this.polygon(this.scenery, line([19.4, 30], [21, 30.7], .5), C.ink); this.polygon(this.scenery, line([21, 30.7], [22.6, 30], .5), C.ink);
        [[54, 30, 5], [123, 22, 4]].forEach(([x, y, s]) => {
            this.disk(this.scenery, x, y, s * 2, s * .6, C.white);
            this.disk(this.scenery, x - s * .7, y - s * .4, s * .9, s * .9, C.white);
            this.disk(this.scenery, x + s * .5, y - s * .6, s, s, C.white);
        });
        this.polygon(this.scenery, rect(0, 42, 150, 22), C.sea);
        this.polygon(this.scenery, closed([[0, 49], [19, 48], [38, 50], [60, 48], [83, 50], [108, 48], [131, 50], [150, 48], [150, 65], [0, 65]]), C.seaLight);
        this.polygon(this.scenery, closed([[0, 58], [22, 55], [47, 58], [71, 55], [101, 57], [127, 55], [150, 58], [150, 100], [0, 100]]), C.white);
        this.polygon(this.scenery, closed([[0, 61], [22, 58], [47, 61], [71, 58], [101, 60], [127, 58], [150, 61], [150, 100], [0, 100]]), C.sand);
        [[8, 76], [61, 84], [137, 84], [35, 84], [56, 59]].forEach(([x, y]) => {
            this.disk(this.scenery, x, y, .42, .28, C.damp); this.disk(this.scenery, x + 1.6, y + 1, .3, .2, C.damp);
        });
        this.disk(this.scenery, 97, 77, 34, 3.5, C.damp);
        this.polygon(this.scenery, line([85, 35], [85, 39.5], .5), C.white);
        this.polygon(this.scenery, closed([[84.3, 34], [84.3, 39], [79.5, 39]]), C.white);
        this.polygon(this.scenery, closed([[79, 40], [89, 40], [86.5, 42], [81.5, 42]]), C.coral);
    }
    buildCastle() {
        this.wall = this.object(this.castleLayer);
        this.part(this.wall, rect(76, 66, 40, 9), C.castle);
        for (let i = 0; i < 7; i++) this.part(this.wall, rect(77 + i * 5.8, 64.5, 3.2, 3), C.castle);
        this.part(this.wall, rect(82, 68, 28, 1), C.white);
        this.towers = SLOTS.map(() => {
            const tower = this.object(this.castleLayer);
            [C.castle, C.shade, C.castle, C.castle, C.castle, C.castle, C.white, C.shade, C.shade, C.shade, C.shade].forEach(color => this.part(tower, HIDDEN, color));
            return tower;
        });
        this.flags = SLOTS.map(() => this.makeFlag(this.decorLayer, C.coral));
        this.shells = SLOTS.map(() => this.makeShell(this.decorLayer));
        this.flagValues = [null, null, null]; this.shellValues = [false, false, false];
        this.shellPositions = SLOTS.map(s => ({ x: s.x, y: 77 }));
    }
    moldGeometry(mold) {
        const h = MOLDS[mold].height, dome = mold === 1, pointy = mold === 2;
        const top = dome ? h - 6 : pointy ? h - 9 : h;
        return [closed([[-8, 0], [-6.5, -top], [6.5, -top], [8, 0]]),
            closed([[4.6, -top], [6.5, -top], [8, 0], [5.5, 0]]),
            dome ? oval(0, -top, 6.5, 6) : pointy ? closed([[-8, -top], [0, -h], [8, -top]]) : rect(-6.9, -h - 1, 13.8, 3.1),
            ...[-5.2, 0, 5.2].map(x => mold === 0 ? rect(x - 1.7, -h - 3.4, 3.4, 4) : HIDDEN),
            rect(-5.7, -top + 3, 11.3, .8), oval(0, -top + 8, 2.4, 2.8), rect(-2.4, -top + 8, 4.8, 2),
            oval(0, -3.4, 3, 4.3), rect(-3, -3.5, 6, 3.5)];
    }
    applyMold(slot, mold) {
        const geometry = this.moldGeometry(mold);
        this.towers[slot].parts.forEach((part, i) => { part.points = geometry[i]; });
        this.slots[slot].height = MOLDS[mold].height + (mold === 0 ? 3.4 : 0);
    }
    makeFlag(parent, color) {
        const flag = this.object(parent);
        this.part(flag, rect(-.45, -12, .9, 12.5), C.ink);
        flag.fabric = this.part(flag, closed([[0, -12], [8.3, -10.6], [5.8, -7.8], [0, -8.5]]), color);
        this.part(flag, oval(0, -12, .8, .8), C.white); return flag;
    }
    makeShell(parent) {
        const shell = this.object(parent);
        const points = [[-4.1, 1.5], [-5, -1], [-4.4, -3], [-2.7, -4.2], [0, -4.8], [2.7, -4.2], [4.4, -3], [5, -1], [4.1, 1.5], [1.7, 2.2], [-1.7, 2.2]];
        this.part(shell, closed(points), C.coral);
        this.part(shell, closed(points.map(([x, y]) => [x * .83, y * .8 - .3])), C.white);
        [-3, 0, 3].forEach(x => this.part(shell, line([0, 1.4], [x, -3], .45), C.coral));
        return shell;
    }
    buildTools() {
        this.pile = this.object(this.toolLayer);
        this.part(this.pile, oval(0, 0, 13, 4.7), C.damp);
        this.part(this.pile, oval(-1, -1.2, 10.5, 4.2), C.castle);
        [[-6, -2], [2, -3], [5, 0]].forEach(([x, y]) => this.part(this.pile, oval(x, y, .45, .3), C.shade));
        this.shovel = this.object(this.toolLayer);
        this.part(this.shovel, rect(-1.1, -14, 2.2, 15), C.coral);
        this.part(this.shovel, oval(0, -14, 3.7, 3.1), C.coral);
        this.part(this.shovel, oval(0, -14, 1.7, 1.3), C.sky);
        this.part(this.shovel, closed([[-5.2, -1], [5.2, -1], [4.4, 6], [0, 8], [-4.4, 6]]), C.blue);
        this.part(this.shovel, line([0, 1], [0, 5.8], .7), C.white);
        this.shovelSand = this.part(this.shovel, HIDDEN, C.castle);
        this.bucket = this.object(this.toolLayer);
        this.part(this.bucket, oval(0, -10, 7.3, 7), C.coral);
        this.part(this.bucket, oval(0, -10, 5.8, 5.5), C.sky);
        this.part(this.bucket, closed([[-8, -9], [8, -9], [6.2, 5], [-6.2, 5]]), C.mint);
        this.part(this.bucket, closed([[4.4, -8], [7.2, -8], [5.7, 4.5], [3.3, 4.5]]), C.sea);
        this.part(this.bucket, oval(0, -9, 8.4, 2.3), C.white);
        this.part(this.bucket, oval(0, -9, 6.9, 1.4), C.sea);
        this.bucketSand = this.part(this.bucket, HIDDEN, C.castle);
        this.part(this.bucket, star(0, -1.5, 3), C.white);
        this.spill = this.polygon(this.toolLayer, HIDDEN, C.castle);
        this.buildChoices();
        this.moldChoices = MOLDS.map((mold, i) => {
            const object = this.object(this.toolLayer);
            this.part(object, oval(0, 0, 9, 7.4), C.white);
            this.moldGeometry(i).slice(0, 7).forEach((points, j) => this.part(object, points.map(([x, y]) => [x * .4, y * .4 + 5]), j === 1 ? C.shade : j === 6 ? C.white : C.castle));
            return { x: 17 + i * 20, y: 45, object };
        });
    }
    buildChoices() {
        this.choices = [];
        [[19, 58, 'flag', 0], [43, 58, 'flag', 1], [19, 76, 'flag', 2], [43, 76, 'shell', 0]].forEach(([x, y, kind, color]) => {
            const object = this.object(this.toolLayer);
            this.part(object, oval(0, 0, 9.5, 7.5), C.white);
            if (kind === 'flag') {
                this.part(object, line([-2.6, -4.5], [-2.6, 4.5], .65), C.ink);
                this.part(object, closed([[-2.3, -4.4], [4.7, -3.5], [2.7, 0], [-2.3, -.7]]), FLAG_COLORS[color]);
            } else {
                this.part(object, oval(0, -.3, 4.5, 3.4), C.coral);
                [-2.5, 0, 2.5].forEach(px => this.part(object, line([0, 2], [px, -2.8], .55), C.white));
            }
            this.choices.push({ x, y, kind, color, object });
        });
    }
    buildCrab() {
        this.crab = this.object(this.creatureLayer);
        [-1, 1].forEach(sign => {
            [-1.2, 1.2, 3.2].forEach(y => this.part(this.crab, line([sign * 3.2, y], [sign * 7, y + 1.3], .8), C.coral));
            this.part(this.crab, line([sign * 4, -1], [sign * 6.5, -5], 1.2), C.coral);
            this.part(this.crab, oval(sign * 7, -5.5, 2.2, 2.6), C.coral);
            this.part(this.crab, closed([[sign * 7, -8.3], [sign * 7, -5], [sign * 9.2, -7.3]]), C.sand);
            this.part(this.crab, line([sign * 2.3, -2], [sign * 2.3, -5], 1), C.coral);
            this.part(this.crab, oval(sign * 2.3, -5, 1.3, 1.5), C.white);
            this.part(this.crab, oval(sign * 2.3, -5, .5, .7), C.ink);
        });
        this.part(this.crab, oval(0, 0, 5.6, 3.7), C.coral);
        this.part(this.crab, line([-1.6, .6], [0, 1.5], .5), C.ink);
        this.part(this.crab, line([0, 1.5], [1.6, .6], .5), C.ink);
    }
    buildHud() {

        this.disk(this.hud, 135, 9, 11, 4.4, C.white);
        this.soundLabel = this.text(this.hud, 'sound on', 135, 7.8, 2.1);
        this.polygon(this.hud, rect(6, 87, 138, 10), C.white);
        this.disk(this.hud, 6, 92, 5, 5, C.white); this.disk(this.hud, 144, 92, 5, 5, C.white);
        this.message = this.text(this.hud, '', 78, 89, 3.5);
        this.progress = [0, 1, 2].map(i => this.disk(this.hud, 10 + i * 5, 92, 1.7, 1.7, C.sand));
        this.waveButton = this.object(this.hud);
        this.part(this.waveButton, oval(0, 0, 15, 6), C.white);
        this.waveLabel = this.text(this.hud, '', 129, 31, 2.5);
        this.decorLabel = this.text(this.hud, '', 31, 44.2, 2.7);
    }
    get activeTarget() {
        let target;
        if (this.phase === 'scoop') target = { x: 25, y: 68, rx: 11, ry: 13 };
        if (this.phase === 'fill') target = { x: 48, y: 67, rx: 12, ry: 13 };
        if (this.phase === 'flip') target = { x: this.slots[this.towerMolds.indexOf(null)].x, y: 70, rx: 9.5, ry: 10 };
        return target ? { x: target.x / ASPECT, y: target.y, radiusX: (target.rx + 2.5) / ASPECT, radiusY: target.ry + 2.5, ...{ world: target } } : null;
    }
    updateHud() {
        const labels = { scoop: 'Pick a shape. Scoop some sand!', scooping: 'Scritch, scritch, scoop!', fill: 'Tap the bucket. Pat the sand!', filling: 'Pat, pat, pat!', flip: 'Pick a spot for your tower!', flipping: 'Lift the bucket… ta-da!', decorate: this.selectedDecoration ? this.selectedDecoration.kind === 'flag' ? 'Tap a tower. Put your flag on top!' : 'Tap the sand to place your shell!' : 'Choose a flag or shell. Make it yours!', decorating: 'A lovely little decoration!', washing: 'Whoooosh! See you, castle!' };
        this.setText(this.message, labels[this.phase]);
        this.setText(this.soundLabel, this.sound ? 'sound on' : 'sound off');
        this.setText(this.waveLabel, this.phase === 'decorate' ? 'wave!' : '');
        this.setText(this.decorLabel, ['decorate', 'decorating'].includes(this.phase) ? 'Decorate!' : '');
        this.progress.forEach((node, i) => { node.node.fill = i < this.towersBuilt ? FLAG_COLORS[i] : C.sand; });
    }
    enter(phase) { this.phase = phase; this.phaseStarted = this.time; this.updateHud(); }
    play(name) { if (this.sound) this.audio.play(name); }
    activate() {
        if (this.phase === 'scoop') { this.enter('scooping'); this.play('scoop'); }
        else if (this.phase === 'fill') { this.enter('filling'); this.play('pat'); }
        else if (this.phase === 'flip') { this.applyMold(this.pendingSlot, this.mold); this.flipSoundPlayed = false; this.enter('flipping'); }
    }
    decorate(choice, x, y) {
        const slot = choice.kind === 'flag' ? this.slots.reduce((best, s, i) => Math.abs(s.x - x) < Math.abs(this.slots[best].x - x) ? i : best, 0) : this.shellSlot++ % 3;
        if (choice.kind === 'flag') this.flagValues[slot] = choice.color;
        else { this.shellValues[slot] = true; this.shellPositions[slot] = { x: clamp(x, 66, 125), y: clamp(y, 70, 82) }; }
        this.decorationCount++; this.decorating = { kind: choice.kind, slot, x: choice.x, y: choice.y };
        this.enter('decorating'); this.play(choice.kind); this.crabHop = .7;
    }
    reset() {
        this.towersBuilt = 0; this.round++; this.flagValues.fill(null); this.shellValues.fill(false);
        this.towerMolds.fill(null); this.mold = this.round % MOLDS.length; this.pendingSlot = 0;
        this.shellSlot = 0; this.decorationCount = 0; this.decorating = null; this.selectedDecoration = null; this.enter('scoop');
    }
    draw() {
        const elapsed = this.time - this.phaseStarted, p = ease(elapsed / .9), decorating = ['decorate', 'decorating'].includes(this.phase);
        const wash = this.phase === 'washing' ? Math.sin(clamp(elapsed / 2.4, 0, 1) * Math.PI) : 0;
        const washed = this.phase === 'washing' && elapsed > 1.15;
        if (this.towersBuilt >= 2 && !washed) this.place(this.wall, 0, 0); else this.hide(this.wall);
        this.towers.forEach((tower, i) => {
            const slot = this.slots[i];
            if (this.towerMolds[i] !== null && !washed) this.place(tower, slot.x, slot.y);
            else if (this.phase === 'flipping' && i === this.pendingSlot && p > .55) this.place(tower, slot.x, slot.y, ease((p - .55) / .45));
            else this.hide(tower);
        });
        this.flags.forEach((flag, i) => {
            if (this.flagValues[i] === null || washed) { this.hide(flag); return; }
            flag.fabric.node.fill = FLAG_COLORS[this.flagValues[i]];
            const active = this.phase === 'decorating' && this.decorating.kind === 'flag' && this.decorating.slot === i;
            this.place(flag, this.slots[i].x, this.slots[i].y - this.slots[i].height - (active ? (1 - p) * 10 : 0), active ? .7 + .3 * p : 1, Math.sin(this.time * 2 + i) * .03);
        });
        this.shells.forEach((shell, i) => {
            if (!this.shellValues[i] || washed) { this.hide(shell); return; }
            const active = this.phase === 'decorating' && this.decorating.kind === 'shell' && this.decorating.slot === i;
            const spot = this.shellPositions[i];
            this.place(shell, spot.x, spot.y - (active ? (1 - p) * 12 : 0), .65 + (active ? .2 * Math.sin(p * Math.PI) : 0));
        });
        if (decorating || this.phase === 'washing') { this.hide(this.shovel); this.hide(this.bucket); this.hide(this.pile); }
        else {
            this.place(this.pile, 25, 78);
            let sx = 25, sy = 69, sa = -.22, bx = 48, by = 72, ba = 0;
            if (this.phase === 'scooping') { sy += Math.sin(p * Math.PI) * 3; sa -= Math.sin(p * Math.PI) * .45; }
            if (['fill', 'filling'].includes(this.phase)) { sy = 65; sa = -.35; }
            if (this.phase === 'filling') { sx = mix(25, 47, p); sy = 65 - Math.sin(p * Math.PI) * 13; sa = mix(-.35, 1.2, p); }
            const sandLoaded = this.phase === 'fill' || this.phase === 'scooping' && p > .5 || this.phase === 'filling' && p < .68;
            this.shovel.parts.find(part => part.node === this.shovelSand).points = sandLoaded ? oval(0, 2.8, 4, 2.3) : HIDDEN;
            this.bucket.parts.find(part => part.node === this.bucketSand).points = ['flip', 'flipping'].includes(this.phase) || this.phase === 'filling' && p > .68 ? oval(0, -9.3, 6.8, 1.4) : HIDDEN;
            if (this.phase === 'flipping') {
                const slot = this.slots[this.pendingSlot], move = ease(p / .55);
                bx = mix(48, slot.x, move); by = mix(72, slot.y - 9, move) - Math.sin(move * Math.PI) * 12;
                ba = Math.PI * move;
                if (p > .6) by -= (p - .6) * 55;
            }
            this.place(this.shovel, sx, sy, .9, sa); this.place(this.bucket, bx, by, 1, ba);
        }
        if (this.phase === 'filling' && p > .45 && p < .82) this.spill.node.coordinates2d = this.coords(line([46, 58], [48, 63], 1.8));
        else this.spill.node.coordinates2d = HIDDEN;
        this.choices.forEach(choice => decorating ? this.place(choice.object, choice.x, choice.y) : this.hide(choice.object));
        this.moldChoices.forEach(choice => !decorating && this.phase !== 'washing' ? this.place(choice.object, choice.x, choice.y) : this.hide(choice.object));
        if (this.phase === 'decorate') this.place(this.waveButton, 129, 33); else this.hide(this.waveButton);
        this.place(this.crab, 136, 76 - Math.sin(clamp(this.crabHop / .7, 0, 1) * Math.PI) * 5, 1, Math.sin(this.time * 2) * .035);
        const target = this.activeTarget;
        if (target && this.phase !== 'flip') {
            const { x, y, rx, ry } = target.world, pulse = .5 * Math.sin(this.time * 4);
            this.highlight.node.coordinates2d = this.coords([...oval(x, y, rx + pulse, ry + pulse, 32), ...oval(x, y, rx - 1.05 + pulse, ry - 1.05 + pulse, 32).reverse()]);
        } else this.highlight.node.coordinates2d = HIDDEN;
        const ringAt = (x, y, rx, ry, width = .7) => this.coords([...oval(x, y, rx, ry, 28), ...oval(x, y, rx - width, ry - width, 28).reverse()]);
        this.spotRings.forEach((node, i) => {
            const slot = this.slots[i];
            if (this.phase === 'flip' && this.towerMolds[i] === null) node.node.coordinates2d = ringAt(slot.x, 73, 8.7, 4 + Math.sin(this.time * 4) * .4);
            else if (this.phase === 'decorate' && this.selectedDecoration?.kind === 'flag') node.node.coordinates2d = ringAt(slot.x, slot.y - slot.height, 6.5, 4);
            else node.node.coordinates2d = HIDDEN;
        });
        if (this.phase === 'decorate' && this.selectedDecoration?.kind === 'shell') this.highlight.node.coordinates2d = ringAt(96, 77, 30, 6);
        const selected = decorating ? this.selectedDecoration : this.phase !== 'washing' ? this.moldChoices[this.mold] : null;
        this.choiceRing.node.coordinates2d = selected ? ringAt(selected.x, selected.y, 10, 8) : HIDDEN;
        if (wash > 0) {
            const edge = 58 + wash * 27;
            this.wave.node.coordinates2d = this.coords(closed([[0, 55], [150, 55], [150, edge - 2], [127, edge], [105, edge - 1.5], [80, edge], [56, edge - 2], [30, edge], [0, edge - 1]]));
            this.waveFoam.node.coordinates2d = this.coords(closed([[0, edge - 1], [30, edge], [56, edge - 2], [80, edge], [105, edge - 1.5], [127, edge], [150, edge - 2], [150, edge], [127, edge + 2], [105, edge + .5], [80, edge + 2], [56, edge], [30, edge + 2], [0, edge + 1]]));
        } else { this.wave.node.coordinates2d = HIDDEN; this.waveFoam.node.coordinates2d = HIDDEN; }
    }
    tap(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) return;
        const wx = x * ASPECT;
        if (wx > 123 && y < 15) { this.sound = !this.sound; if (!this.sound) this.audio.mute(); this.updateHud(); }
        else if (wx > 126 && y > 66 && y < 84 && this.phase !== 'washing') { this.crabHop = .7; this.play('crab'); }
        else if (this.phase === 'decorate') {
            const choice = this.choices.find(c => ((wx - c.x) / 11) ** 2 + ((y - c.y) / 9) ** 2 <= 1);
            if (choice) { this.selectedDecoration = choice; this.updateHud(); }
            else if (((wx - 129) / 17) ** 2 + ((y - 33) / 8) ** 2 <= 1) { this.enter('washing'); this.play('wave'); }
            else if (this.selectedDecoration && wx >= 64 && wx <= 126 && y >= (this.selectedDecoration.kind === 'flag' ? 34 : 67) && y <= 84) this.decorate(this.selectedDecoration, wx, y);
        } else {
            const mold = this.moldChoices.findIndex(c => ((wx - c.x) / 9.8) ** 2 + ((y - c.y) / 8) ** 2 <= 1);
            if (mold >= 0 && ['scoop', 'fill', 'flip'].includes(this.phase)) { this.mold = mold; this.play('pat'); }
            else if (this.phase === 'flip') {
                const slot = this.slots.findIndex((s, i) => this.towerMolds[i] === null && Math.abs(wx - s.x) <= 10 && y >= 59 && y <= 84);
                if (slot >= 0) { this.pendingSlot = slot; this.activate(); }
            } else {
                const target = this.activeTarget;
                if (target && ((x - target.x) / target.radiusX) ** 2 + ((y - target.y) / target.radiusY) ** 2 <= 1) this.activate();
            }
        }
        this.draw(); this.base.node.onStateChange();
    }
    pointerDown(id, x, y) { const p = this.players.get(id); if (!p || p.pointer) return; p.pointer = true; this.tap(x, y); }
    handleMouseUp(id, position) { const p = this.players.get(id); if (!p) return; if (!p.pointer && position) this.tap(position.x, position.y); p.pointer = false; }
    handleKeyDown() {}
    handleKeyUp() {}
    handleNewPlayer({ playerId }) {
        this.players.set(playerId, { pointer: false });
        if (!this.assetsRegistered && typeof this.addAsset === 'function') {
            this.assetsRegistered = true;
            for (const [key, asset] of Object.entries(this.getAssets())) {
                try { this.addAsset(key, asset)?.catch(() => {}); } catch (_) { /* Silent play remains available. */ }
            }
        }
    }
    handlePlayerDisconnect(id) { this.players.delete(id); }
    tick() {
        if (!this.players.size) return;
        const dt = 1 / 30; this.time += dt; this.audio.tick(dt); this.crabHop = Math.max(0, this.crabHop - dt);
        const elapsed = this.time - this.phaseStarted;
        if (this.phase === 'flipping' && elapsed >= .5 && !this.flipSoundPlayed) { this.play('plop'); this.flipSoundPlayed = true; }
        if (this.phase === 'scooping' && elapsed >= .9) this.enter('fill');
        else if (this.phase === 'filling' && elapsed >= .9) this.enter('flip');
        else if (this.phase === 'flipping' && elapsed >= 1.15) {
            this.towerMolds[this.pendingSlot] = this.mold; this.towersBuilt++; this.mold = (this.mold + 1) % MOLDS.length;
            this.crabHop = .7; this.enter(this.towersBuilt === 3 ? 'decorate' : 'scoop');
        }
        else if (this.phase === 'decorating' && elapsed >= .7) { this.decorating = null; this.enter('decorate'); }
        else if (this.phase === 'washing' && elapsed >= 2.4) this.reset();
        this.draw(); this.base.node.onStateChange();
    }
    close() { this.audio.close(); this.players.clear(); super.close(); }
}

module.exports = SandyCastle;
