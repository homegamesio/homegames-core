const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');
const { TruckWorld, terrainHeight, terrainPoints, courseLength, ramps } = require('./engine');
const { truckParts } = require('./truck');
const { TruckAudio } = require('./audio');

const C = { sky: '#e0f1ed', paper: '#fff7df', ink: '#334e51', muted: '#708b80',
    red: '#d9403d', gold: '#f3c76b', green: '#629a79', soil: '#d9b77e', road: '#f3d79e',
    grass: '#8aaf7c', mountain: '#c3d8bd', ridge: '#a5c7ac', trunk: '#9b9270' };
const HIDDEN = [[0, 0], [0, 0], [0, 0]], TAU = Math.PI * 2;
const rect = (x, y, w, h) => ShapeUtils.rectangle(x, y, w, h);
const closed = points => [...points, points[0]];
const oval = (x, y, rx, ry = rx, n = 24) => Array.from({ length: n + 1 }, (_, i) => [x + Math.cos(i * TAU / n) * rx, y + Math.sin(i * TAU / n) * ry]);
const rgb = value => Array.isArray(value) ? value : [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16)).concat(255);
const star = (x, y, r) => closed(Array.from({ length: 10 }, (_, i) => {
    const a = i * Math.PI / 5 - Math.PI / 2, radius = i % 2 ? r * .45 : r;
    return [x + Math.cos(a) * radius, y + Math.sin(a) * radius];
}));

class RedTruckRamble extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Red Truck Ramble',
            author: "Joseph Garcia",
            createdBy: "Joseph Garcia",
            description: 'Cruise a big red pickup over hills and ramps. Tap for a happy flip, toot the horn, and keep exploring!',
            aspectRatio: { x: 3, y: 2 },
            tickRate: 30,
            maxPlayers: 1,
            assets: {},
            gamepadBindings: { Enter: ['FACE_1'], ' ': ['FACE_2'], r: ['FACE_3'], h: ['FACE_4'], ArrowLeft: ['DPAD_LEFT'], ArrowRight: ['DPAD_RIGHT'] },
            gameId: "9619cba4-a2a0-520c-a72e-f9f46518fc79"
        };
    }
    constructor({ addAsset } = {}) {
        super(); this.addAsset = addAsset; this.players = new Map(); this.world = new TruckWorld();
        this.time = 0; this.cruise = 0; this.flipPending = false; this.flipQueued = false; this.sound = true; this.camera = this.world.x - 54; this.cameraY = 0;
        this.messageUntil = 0; this.message = ''; this.lastDust = -1; this.lastHorn = -1; this.sparkAt = -10;
        this.base = this.shape(rect(0, 0, 150, 100), C.sky);
        this.scenery = this.group(this.base); this.groundLayer = this.group(this.base); this.dustLayer = this.group(this.base);
        this.truckLayer = this.group(this.base); this.sparkLayer = this.group(this.base); this.hud = this.group(this.base); this.audioRoot = this.group(this.base);
        for (const layer of [this.scenery, this.groundLayer, this.dustLayer, this.truckLayer, this.sparkLayer]) layer.worldSpace = true;
        this.audio = new TruckAudio(this.audioRoot);
        this.buildLandscape(); this.buildTruck(); this.buildHud(); this.draw();
        const touch = this.put(this.base, this.shape(rect(0, 0, 150, 100), null, { onClick: (id, x, y) => this.pointerDown(id, x, y) }));
        touch.node.offClick = id => { const p = this.players.get(id); if (p) p.pointer = false; };
    }
    getLayers() { return [{ root: this.base }]; }
    getAssets() { return this.audio.assets; }
    project(points) { return points.map(([x, y]) => [Math.max(0, Math.min(100, x / 1.5)), Math.max(0, Math.min(100, y))]); }
    shape(points, fill, options = {}) { return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: this.project(points), ...(fill ? { fill: rgb(fill) } : {}), ...options }); }
    put(parent, node) { node.worldSpace = !!parent.worldSpace; parent.addChild(node, false); return node; }
    group(parent) { return this.put(parent, this.shape(HIDDEN)); }
    poly(parent, points, fill) { return this.put(parent, this.shape(points, fill)); }
    disk(parent, x, y, rx, ry, fill) { return this.poly(parent, oval(x, y, rx, ry), fill); }
    coords(node, points) { node.node.coordinates2d = this.project(node.worldSpace ? points.map(([x, y]) => [x, y + this.cameraY]) : points); }
    text(parent, text, x, y, size, color = C.ink) { return this.put(parent, new GameNode.Text({ textInfo: {
        text, x: x / 1.5, y, size: size / (1.5 * Math.SQRT2), color: rgb(color), align: 'center', font: 'Trebuchet MS, sans-serif' } })); }
    setText(node, text) { if (node.node.text.text !== text) node.node.text = { ...node.node.text, text }; }
    pill(parent, x, y, width, height, fill) {
        const r = height / 2;
        return [this.disk(parent, x - width / 2 + r, y, r, r, fill), this.disk(parent, x + width / 2 - r, y, r, r, fill),
            this.poly(parent, rect(x - width / 2 + r, y - r, width - height, height), fill)];
    }
    buildLandscape() {
        this.disk(this.scenery, 125, 27, 6, 6, C.gold);
        this.clouds = Array.from({ length: 3 }, (_, i) => [this.poly(this.scenery, HIDDEN, C.paper), this.poly(this.scenery, HIDDEN, C.paper)]);
        this.mountains = Array.from({ length: 4 }, () => this.poly(this.scenery, HIDDEN, C.mountain));
        this.ridges = Array.from({ length: 3 }, () => this.poly(this.scenery, HIDDEN, C.ridge));
        this.trees = Array.from({ length: 7 }, () => ({ trunk: this.poly(this.scenery, HIDDEN, C.trunk),
            bottom: this.poly(this.scenery, HIDDEN, '#709c80'), top: this.poly(this.scenery, HIDDEN, '#83af8e') }));
        this.earth = this.poly(this.groundLayer, HIDDEN, C.soil);
        this.grass = this.poly(this.groundLayer, HIDDEN, C.grass);
        this.trail = this.poly(this.groundLayer, HIDDEN, C.road);
        this.pebbles = Array.from({ length: 12 }, () => this.poly(this.groundLayer, HIDDEN, '#c09c6c'));
        this.flags = Array.from({ length: 4 }, () => ({ pole: this.poly(this.groundLayer, HIDDEN, C.ink), flag: this.poly(this.groundLayer, HIDDEN, C.red),
            sign: this.poly(this.groundLayer, HIDDEN, C.gold), arrow: this.poly(this.groundLayer, HIDDEN, C.ink) }));
        this.dust = Array.from({ length: 8 }, () => ({ node: this.poly(this.dustLayer, HIDDEN, '#f9e4b7'), born: -10, x: 0, y: 0 }));
        this.shadow = this.poly(this.dustLayer, HIDDEN, '#bd9c70');
        this.sparks = Array.from({ length: 5 }, () => this.poly(this.sparkLayer, HIDDEN, C.gold));
    }
    buildTruck() {
        const art = truckParts();
        this.bodyParts = art.body.map(part => ({ points: part.points.map(p => [p.x, p.y]), node: this.poly(this.truckLayer, HIDDEN, part.fill) }));
        this.wheels = art.wheels.map(wheel => ({ ...wheel, parts: art.wheelParts.map(part => ({
            points: part.points.map(p => [p.x, p.y]), node: this.poly(this.truckLayer, HIDDEN, part.fill) })) }));
    }
    buildHud() {

        this.messageLabel = this.text(this.hud, 'Find a ramp', 75, 12, 2.6, C.muted);
        this.pill(this.hud, 14, 7, 23, 8, C.paper); this.soundLabel = this.text(this.hud, 'sound on', 14, 5.7, 2);
        this.pill(this.hud, 136, 7, 23, 8, C.paper); this.text(this.hud, 'help ↻', 136, 5.5, 2.3);
        this.poly(this.hud, rect(0, 83, 150, 17), C.paper);
        this.pill(this.hud, 26, 91, 36, 12, '#a5c7b5'); this.backLabel = this.text(this.hud, 'back', 29, 89.1, 3.5);
        this.poly(this.hud, closed([[13, 91], [18, 88], [18, 94]]), C.ink);
        this.goPill = this.pill(this.hud, 75, 91, 45, 13, C.green); this.goLabel = this.text(this.hud, 'GO!', 78, 88.8, 4, C.paper);
        this.goIcon = this.poly(this.hud, HIDDEN, C.paper);
        this.flipPill = this.pill(this.hud, 125, 91, 36, 12, '#e4d9b9'); this.flipLabel = this.text(this.hud, 'flip!', 128, 89.1, 3.5);
        this.text(this.hud, '↻', 114, 87.8, 5);

    }
    controls() {
        let left = false, right = false;
        for (const p of this.players.values()) { left ||= p.keys.has('ArrowLeft') || p.keys.has('a'); right ||= p.keys.has('ArrowRight') || p.keys.has('d'); }
        return { drive: left !== right ? (right ? 1 : -1) : left ? 0 : this.cruise, flip: this.flipPending };
    }
    say(text, seconds = 1.6) { this.message = text; this.messageUntil = this.time + seconds; }
    toggleCruise(direction) { this.cruise = this.cruise === direction ? 0 : direction; this.say(this.cruise ? 'Here we go!' : 'A little pit stop.'); this.draw(); this.dirty(); }
    requestFlip() {
        if (this.world.canFlip) this.flipPending = true;
        else if (this.world.grounded) { this.flipQueued = true; this.say('Next ramp: a big flip!'); }
        this.draw(); this.dirty();
    }
    horn() { if (this.time - this.lastHorn < .8) return; this.lastHorn = this.time; this.audio.play('horn'); this.say('Toot toot!'); this.dirty(); }
    help() { this.world.reset(); this.cruise = 0; this.flipPending = false; this.flipQueued = false; this.camera = this.world.x - 54; this.cameraY = 0; this.say('Back on our wheels!'); this.draw(); this.dirty(); }
    tap(x, y) {
        if (![x, y].every(Number.isFinite) || x < 0 || x > 100 || y < 0 || y > 100) return;
        const wx = x * 1.5;
        if (y < 14 && wx < 28) { this.sound = !this.sound; this.audio.setEnabled(this.sound); this.setText(this.soundLabel, this.sound ? 'sound on' : 'sound off'); }
        else if (y < 14 && wx > 123) this.help();
        else if (y >= 83) {
            if (wx >= 7 && wx <= 45) this.toggleCruise(-1);
            else if (wx >= 50 && wx <= 99) this.toggleCruise(1);
            else if (wx >= 106 && wx <= 145) this.requestFlip();
        } else if (Math.abs(wx - (this.world.x - this.camera)) <= 27 && Math.abs(y - this.world.y - this.cameraY) <= 19) this.horn();
        this.dirty();
    }
    pointerDown(id, x, y) { const p = this.players.get(id); if (!p || p.pointer) return; p.pointer = true; this.tap(x, y); }
    handleMouseUp(id, position) { const p = this.players.get(id); if (!p) return; if (!p.pointer && position) this.tap(position.x, position.y); p.pointer = false; }
    handleKeyDown(id, key) {
        const p = this.players.get(id); if (!p || p.keys.has(key)) return;
        if (!['ArrowLeft', 'ArrowRight', 'a', 'd', ' ', 'ArrowUp', 'Enter', 'r', 'h'].includes(key)) return;
        p.keys.add(key);
        if (key === ' ' || key === 'ArrowUp') this.requestFlip();
        else if (key === 'Enter') this.toggleCruise(1);
        else if (key === 'r') this.help();
        else if (key === 'h') this.horn();
    }
    handleKeyUp(id, key) { this.players.get(id)?.keys.delete(key); }
    handleNewPlayer({ playerId }) {
        this.players.set(playerId, { pointer: false, keys: new Set() });
        this.audio.setEnabled(this.sound);
        if (!this.assetsRegistered && typeof this.addAsset === 'function') {
            this.assetsRegistered = true;
            for (const [key, asset] of Object.entries(this.audio.assets)) try { this.addAsset(key, asset)?.catch(() => {}); } catch (_) { /* The trail stays playable quietly. */ }
        }
    }
    handlePlayerDisconnect(id) { this.players.delete(id); if (!this.players.size) { this.cruise = 0; this.flipPending = false; this.flipQueued = false; this.audio.mute(); } }
    drawLandscape() {
        const camera = this.camera;
        this.clouds.forEach((nodes, i) => {
            const x = ((i * 68 + 18 - camera * .06) % 205 + 205) % 205 - 27, y = 22 + (i % 2) * 7;
            this.coords(nodes[0], oval(x, y, 13, 3)); this.coords(nodes[1], oval(x - 3, y - 2, 5, 4));
        });
        this.mountains.forEach((node, i) => {
            const x = ((i * 65 - camera * .13) % 260 + 260) % 260 - 65;
            this.coords(node, closed([[x - 25, 64], [x + 15, 29 + (i % 2) * 4], [x + 61, 64]]));
        });
        this.ridges.forEach((node, i) => {
            const x = ((i * 83 - camera * .24) % 249 + 249) % 249 - 70;
            this.coords(node, closed([[x - 30, 71], [x + 10, 45], [x + 40, 42], [x + 87, 71]]));
        });
        const treeStart = Math.floor(camera / 31) - 1;
        this.trees.forEach((tree, i) => {
            const wx = (treeStart + i) * 31 + 9, x = wx - camera, y = terrainHeight(wx) - 3;
            const height = 13 + (((treeStart + i) % 3 + 3) % 3) * 3;
            this.coords(tree.trunk, rect(x - .8, y - 10, 1.6, 11));
            this.coords(tree.bottom, closed([[x - 7, y - 4], [x, y - height], [x + 7, y - 4]]));
            this.coords(tree.top, closed([[x - 5.5, y - 9], [x, y - height - 5], [x + 5.5, y - 9]]));
        });
        const top = terrainPoints(camera - 4, camera + 154, 5).map(([x, y]) => [x - camera, y]);
        this.coords(this.earth, closed([...top, [154, 84], [-4, 84]]));
        this.coords(this.grass, closed([...top, ...top.slice().reverse().map(([x, y]) => [x, y + 2.3])]));
        this.coords(this.trail, closed([...top.map(([x, y]) => [x, y + .8]), ...top.slice().reverse().map(([x, y]) => [x, y + 1.6])]));
        const pebbleStart = Math.floor(camera / 15) - 1;
        this.pebbles.forEach((node, i) => {
            const wx = (pebbleStart + i) * 15 + 6, x = wx - camera, y = terrainHeight(wx) + 5 + (i % 3) * 2;
            this.coords(node, oval(x, y, .7 + (i % 3) * .3, .4, 8));
        });
        const visible = [];
        for (let lap = Math.floor(camera / courseLength) - 1; lap <= Math.floor((camera + 160) / courseLength); lap++) for (const ramp of ramps) {
            const x = ramp.crest + lap * courseLength - camera;
            if (x > -15 && x < 166) visible.push({ x, y: terrainHeight(ramp.crest) });
        }
        this.flags.forEach((flag, i) => {
            const f = visible[i];
            if (!f) { for (const node of Object.values(flag)) this.coords(node, HIDDEN); return; }
            this.coords(flag.pole, rect(f.x, f.y - 12, .7, 12));
            this.coords(flag.flag, closed([[f.x + .7, f.y - 12], [f.x + 8, f.y - 10], [f.x + .7, f.y - 7.5]]));
            this.coords(flag.sign, closed([[f.x - 24, f.y + 4], [f.x - 20, f.y], [f.x - 16, f.y + 4], [f.x - 20, f.y + 8]]));
            this.coords(flag.arrow, closed([[f.x - 22, f.y + 4.3], [f.x - 19.3, f.y + 1.7], [f.x - 19.3, f.y + 4], [f.x - 17.5, f.y + 4], [f.x - 20.3, f.y + 6.3], [f.x - 20.3, f.y + 4.3]]));
        });
    }
    draw() {
        const w = this.world, x = w.x - this.camera, c = Math.cos(w.angle), s = Math.sin(w.angle);
        // Follow high flips upward while keeping the fixed header readable.
        const truckTop = w.y - Math.abs(c) * 13 - Math.abs(s) * 22.5;
        this.cameraY = Math.max(0, 22 - truckTop, this.cameraY * .9);
        this.drawLandscape();
        const transform = (points, centerX = 0, centerY = 0, rotation = 0) => {
            const rc = Math.cos(rotation), rs = Math.sin(rotation);
            return points.map(([px, py]) => {
                const tx = centerX + px * rc - py * rs, ty = centerY + px * rs + py * rc;
                return [x + tx * c - ty * s, w.y + tx * s + ty * c];
            });
        };
        for (const part of this.bodyParts) this.coords(part.node, transform(part.points));
        for (const wheel of this.wheels) for (const part of wheel.parts) this.coords(part.node, transform(part.points, wheel.x, wheel.y - w.suspension * .65, w.wheelAngle));
        const elevation = Math.max(0, terrainHeight(w.x) - w.y - 9.3);
        this.coords(this.shadow, oval(0, 0, Math.max(8, 20 - elevation * .25), .8).map(([dx, dy]) => [x + dx, terrainHeight(w.x + dx) + .6 + dy]));
        for (const puff of this.dust) {
            const age = this.time - puff.born, alive = age >= 0 && age < .65;
            this.coords(puff.node, alive ? oval(puff.x - this.camera, puff.y - age * 4, (1.1 + age * 3) * (1 - age / .65), .7 + age * .4, 14) : HIDDEN);
        }
        this.sparks.forEach((node, i) => {
            const t = this.time - this.sparkAt, live = t >= 0 && t < 1;
            this.coords(node, live ? star(x + Math.cos(i * TAU / 5) * (14 + t * 13), w.y + Math.sin(i * TAU / 5) * (10 + t * 10), 1.8 * (1 - t)) : HIDDEN);
        });
        const drive = this.controls().drive, airborne = !w.grounded;
        this.goPill.forEach(node => { node.node.fill = rgb(drive === 1 ? C.red : C.green); });
        this.flipPill.forEach(node => { node.node.fill = rgb(w.canFlip || this.flipQueued ? C.gold : '#e4d9b9'); });
        this.setText(this.flipLabel, this.flipQueued ? 'ready!' : 'flip!');
        this.setText(this.goLabel, drive === 1 ? 'stop' : 'GO!'); this.setText(this.backLabel, drive === -1 ? 'stop' : 'back');
        this.coords(this.goIcon, drive === 1 ? rect(59.5, 88.5, 5, 5) : closed([[60, 88], [65.5, 91], [60, 94]]));
        this.setText(this.messageLabel, this.time < this.messageUntil ? this.message : this.flipQueued ? 'Ready to flip at the next ramp!' : airborne ? (w.canFlip ? 'Wheee! Tap FLIP!' : 'Round we go!') : drive ? 'Over the hills and off we go!' : 'Find a ramp');
    }
    dirty() { this.base.node.onStateChange(); }
    tick() {
        if (!this.players.size) return;
        const dt = 1 / 30; this.time += dt;
        if (this.flipQueued && this.world.canFlip) { this.flipPending = true; this.flipQueued = false; }
        const controls = this.controls(); this.world.step(dt, controls); this.flipPending = false;
        this.camera += (this.world.x - 54 - this.camera) * .13;
        this.audio.tick(dt, { driving: controls.drive !== 0, speed: this.world.vx, grounded: this.world.grounded });
        for (const event of this.world.events) {
            if (event.type === 'land') this.audio.play('land');
            else if (event.type === 'flipStart') this.audio.play('flip');
            else if (event.type === 'flip') { this.say('A big happy flip!', 1.6); this.sparkAt = this.time; }
            else if (event.type === 'reset') this.say('Back on our wheels!');
        }
        if (this.world.grounded && Math.abs(this.world.vx) > 5 && this.time - this.lastDust > .14) {
            this.lastDust = this.time; const puff = this.dust.find(p => this.time - p.born > .65);
            if (puff) { puff.born = this.time; puff.x = this.world.x - Math.sign(this.world.vx) * 12; puff.y = terrainHeight(puff.x); }
        }
        this.draw(); this.dirty();
    }
    close() { this.audio.close(); this.players.clear(); super.close(); }
}

module.exports = RedTruckRamble;
