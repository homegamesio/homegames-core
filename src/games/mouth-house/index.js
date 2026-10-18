'use strict';

const { Game, GameNode, Shapes, ShapeUtils, Asset } = require('squish-150');
const { makeCourse, matches, privateRules, readSave, TITLES, GOOD, BAD } = require('./content');
const { View, cardAt } = require('./view');

class MouthHouse extends Game {
    static metadata() {
        return {
            name: 'Mouth House',
            author: "Joseph Garcia",
            description: 'There is a very unreasonable creature in your phone. Trade its secret food rules, flick it a snack, and raise a gloriously weird roommate. Solo or together.',
            aspectRatio: { x: 9, y: 19 },
            tickRate: 30,
            maxPlayers: 4,
            thumbnail: './assets/thumbnail.png',
            assets: { gulp: new Asset({ path: './assets/gulp.wav', type: 'audio' }),
                burp: new Asset({ path: './assets/burp.wav', type: 'audio' }),
                dinner: new Asset({ path: './assets/dinner.wav', type: 'audio' }) },
            gameId: "d3a82741-c0a5-446b-8ba9-379f4ae86680"
        };
    }
    constructor(options = {}) {
        super(); this.options = options; this.random = options.random || Math.random;
        this.records = readSave(options.saveData); this.players = new Map(); this.phase = 'welcome';
        this.course = null; this.courseNumber = 0; this.burps = 6; this.eaten = []; this.time = 0;
        this.revision = 0; this.motion = null; this.feedback = ''; this.soundUntil = 0;
        this.base = new GameNode.Shape({ shapeType: Shapes.POLYGON, fill: [27, 35, 32, 255], coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100) });
        this.view = new View(this);
        this.audio = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: [[0, 0], [0, 0], [0, 0]] });
        this.base.addChild(this.audio);
        // Captured input lives above the mutable presentation. A single final
        // release commits; cancelled/backgrounded touches never feed anything.
        this.surface = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            onClick: (id, x, y) => this.press(id, x, y), onDrag: (id, x, y) => this.move(id, x, y) });
        this.base.addChild(this.surface); this.refresh();
    }
    getLayers() { return [{ root: this.base }]; }
    handleNewPlayer({ playerId }) {
        if (this.closed || this.players.has(playerId) || this.players.size >= 4) return;
        this.players.set(playerId, { drag: null, selected: -1 }); this.view.join(playerId); this.refresh();
    }
    handlePlayerDisconnect(id) {
        this.players.delete(id); this.view.leave(id);
        // Repartition whispers so a departed player can never strand a clue.
        this.refresh();
    }
    ownRules(id) { return this.course ? privateRules(this.course, [...this.players.keys()], id) : []; }
    start(id) {
        if (!this.players.has(id) || !['welcome', 'won', 'lost'].includes(this.phase)) return false;
        this.courseNumber = 0; this.burps = 6; this.eaten = []; this.motion = null; this.nextCourse(); return true;
    }
    nextCourse() {
        this.course = makeCourse(this.courseNumber, this.random); this.phase = 'choosing'; this.feedback = '';
        this.revision++; this.clearHands(); this.refresh();
    }
    clearHands() { for (const p of this.players.values()) { p.drag = null; p.selected = -1; } }
    share(id) {
        if (this.phase !== 'choosing' || !this.players.has(id)) return;
        this.course.shared = [...new Set([...this.course.shared, ...this.ownRules(id)])]; this.refresh();
    }
    press(id, x, y) {
        const p = this.players.get(id);
        if (!p || !Number.isFinite(x) || !Number.isFinite(y) || this.closed) return;
        if (['welcome', 'won', 'lost'].includes(this.phase)) {
            if (x >= 8 && x <= 92 && y >= 79 && y <= 88) this.start(id);
            else if (this.saveFailed && y >= 90 && y <= 98) this.persist();
            return;
        }
        if (this.phase === 'feedback') {
            if (y >= 79 && y <= 88 && x >= 8 && x <= 92) this.continue(id);
            return;
        }
        if (this.phase !== 'choosing') return;
        if (y >= 59.5 && y <= 65 && x >= 55 && x <= 96) { this.share(id); return; }
        // Tap a card, then the mouth, is an equivalent low-motion alternative.
        if (y >= 22 && y <= 42 && x >= 17 && x <= 83 && p.selected >= 0) {
            this.feed(id, p.selected, this.revision); return;
        }
        const index = cardAt(x, y);
        if (index < 0 || this.course.rejected.includes(index)) return;
        p.selected = index; p.drag = { index, startX: x, startY: y, x, y, revision: this.revision, moved: false };
        this.refresh();
    }
    move(id, x, y) {
        const d = this.players.get(id)?.drag;
        if (!d || !Number.isFinite(x) || !Number.isFinite(y)) return;
        d.x = Math.max(0, Math.min(100, x)); d.y = Math.max(0, Math.min(100, y));
        d.moved = d.moved || Math.hypot((x - d.startX) * 9 / 19, y - d.startY) > 2;
    }
    handleMouseUp(id, point) {
        const p = this.players.get(id); if (!p?.drag) return;
        const d = p.drag;
        if (point?.cancelled || !Number.isFinite(point?.x) || !Number.isFinite(point?.y) ||
            point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100) {
            p.drag = null; p.selected = -1; this.refresh(); return;
        }
        this.move(id, point.x, point.y); p.drag = null;
        // A short upward thumb flick works from either row; no trek to the top.
        const upward = d.startY - d.y >= 7 && Math.abs(d.x - d.startX) < 35;
        const inMouth = d.y >= 22 && d.y <= 42 && d.x >= 17 && d.x <= 83;
        if (d.moved && (upward || inMouth)) this.feed(id, d.index, d.revision);
        else { if (d.moved) p.selected = -1; this.refresh(); }
    }
    handleKeyDown(id, key) {
        const p = this.players.get(id); if (!p) return;
        if (key === 'Escape') { p.drag = null; p.selected = -1; this.refresh(); }
        if (/^[1-6]$/.test(key) && this.phase === 'choosing' && !this.course.rejected.includes(Number(key) - 1)) {
            p.selected = Number(key) - 1; this.refresh();
        }
        if (key === 'Enter') {
            if (this.phase === 'choosing' && p.selected >= 0) this.feed(id, p.selected, this.revision);
            else if (this.phase === 'feedback') this.continue(id); else this.start(id);
        }
        if (key.toLowerCase() === 's') this.share(id);
    }
    feed(id, index, revision) {
        if (!this.players.has(id) || this.phase !== 'choosing' || revision !== this.revision ||
            !Number.isInteger(index) || index < 0 || index >= 6 || this.course.rejected.includes(index)) return false;
        const food = this.course.deck[index], good = matches(food, this.course.rules);
        this.phase = 'swallowing'; this.clearHands();
        this.motion = { food, index, good, age: 0 };
        this.refresh(); return true;
    }
    resolve() {
        const { food, index, good } = this.motion;
        if (good) {
            this.eaten.push(food); this.feedback = GOOD[this.courseNumber]; this.sound('gulp');
            this.phase = 'feedback';
            if (this.eaten.length === 5) {
                this.phase = 'won'; this.titleIndex = this.eaten.reduce((n, f) => n + f.place * 7 + f.thing * 3 + f.mood, 0) % TITLES.length;
                this.records.dinners++; this.records.best = Math.max(this.records.best, this.burps);
                this.records.collection = [...new Set([...this.records.collection, this.titleIndex])];
                this.sound('dinner'); this.persist();
            }
        } else {
            this.burps--; this.course.rejected.push(index); this.feedback = BAD[(6 - this.burps - 1) % BAD.length];
            this.sound('burp'); this.phase = this.burps > 0 ? 'choosing' : 'lost';
        }
        this.refresh();
    }
    continue(id) {
        if (!this.players.has(id) || this.phase !== 'feedback') return false;
        this.courseNumber++; this.motion = null; this.nextCourse(); return true;
    }
    persist() {
        const revision = this.saveRevision = (this.saveRevision || 0) + 1;
        const snapshot = readSave(this.records);
        try { this.saveTail = Promise.resolve(this.options.saveGame?.(snapshot)); }
        catch (error) { this.saveTail = Promise.reject(error); }
        this.saveTail = this.saveTail.then(() => { if (revision === this.saveRevision) this.saveFailed = false; },
            () => { if (revision === this.saveRevision) this.saveFailed = true; }).then(() => { if (!this.closed) this.refresh(); });
        return this.saveTail;
    }
    sound(key) {
        this.audio.clearChildren(); this.audio.addChild(new GameNode.Asset({ coordinates2d: [[0, 0], [0, 0], [0, 0]],
            assetInfo: { [key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0, loop: false } } }));
        this.soundUntil = this.time + 1.8;
    }
    refresh() { this.view.ui(); this.view.animate(); this.base.node.onStateChange(); }
    tick() {
        if (this.closed || !this.players.size) return;
        this.time += 1 / 30;
        if (this.motion) {
            this.motion.age += 1 / 30;
            if (this.phase === 'swallowing' && this.motion.age >= .65) this.resolve();
        }
        if (this.soundUntil && this.time >= this.soundUntil) { this.audio.clearChildren(); this.soundUntil = 0; }
        this.view.animate(); this.base.node.onStateChange();
    }
    close() { this.closed = true; this.clearHands(); this.audio.clearChildren(); super.close(); }
}
module.exports = MouthHouse;
