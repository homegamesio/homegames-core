'use strict';
const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');
const { NOTES, normalize, readExport, soundsAt, Transport, clamp } = require('./arrangement');
const { SoundBank, renderLoop } = require('./sound');
const { UI, C, COLORS, circle } = require('./ui');
const TABS = ['DRUMS', 'BASS', 'FX', 'ROOM'];
const validId = id => ['number', 'string'].includes(typeof id) && Number.isSafeInteger(Number(id)) && Number(id) > 0;
const GROUP = [[0, 0], [0, 0], [0, 0]];
const nameOf = (name, id) => String(name || 'Player ' + id).replace(/[\x00-\x1f]/g, '').slice(0, 24);

class HouseBand extends Game {
    static metadata() {
        return {
            name: 'House Band',
            author: "Joseph Garcia",
            thumbnail: './assets/thumbnail.png',
            description: 'Make music by yourself or with friends',
            aspectRatio: { x: 1, y: 1 },
            tickRate: 60,
            maxPlayers: 8,
            gameId: "629a4d3d-7b26-4ef5-9e37-b3adbca4b720"
        };
    }
    constructor(options = {}) {
        super(); this.options = options; this.now = options.now || Date.now;
        this.arrangement = normalize(options.saveData?.schema === 1 ? options.saveData : readExport(options.userExports));
        this.transport = new Transport(); this.people = new Map(); this.views = new Map();
        this.clock = this.now(); this.lastDraw = 0; this.energy = [0, 0, 0, 0];
        this.lastAction = ''; this.saveStatus = '';
        this.saveRevision = 0; this.saveTail = Promise.resolve(); this.closed = false;
        this.editSequence = 0; this.cellRevisions = new Map();
        this.base = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100), fill: C.ink });
        this.audioRoot = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: GROUP });
        this.base.addChild(this.audioRoot, false); this.audio = new SoundBank(this.audioRoot);
    }
    getLayers() { return [{ root: this.base }]; }
    getAssets() { return this.audio.assets; }
    canAddPlayer() { return !this.closed && this.people.size < 8; }
    dirty() { this.base.node.onStateChange(); }
    handleNewPlayer({ playerId, info } = {}) {
        if (!validId(playerId)) return;
        playerId = Number(playerId);
        if (this.people.has(playerId) || !this.canAddPlayer()) return;
        this.people.set(playerId, { name: nameOf(info?.name, playerId), tab: this.people.size % 3, bank: 0, pitch: 0, dragging: false, pointerHeld: false, suppressRelease: false, sound: this.people.size === 0, keys: new Set(), undo: [], confirm: false });
        this.rebuild();
    }
    handlePlayerUpdate(id, { info } = {}) {
        const person = this.people.get(id); if (!person || typeof info?.name !== 'string') return;
        person.name = nameOf(info.name, id); this.rebuild();
    }
    handlePlayerDisconnect(id) {
        if (!this.people.has(id)) return;
        const view = this.views.get(id);
        if (view) this.base.removeChild(view.root.node.id, false);
        this.people.delete(id); this.views.delete(id); this.audio.stopFor(id);
        if (!this.people.size) { this.transport.stop(); this.audio.stop(); this.energy.fill(0); }
        this.rebuild();
    }
    audioListeners() { return [...this.people].filter(([, person]) => person.sound).map(([id]) => id); }
    toggleSound(id) {
        const person = this.people.get(id); if (!person) return;
        person.sound = !person.sound;
        if (!person.sound) this.audio.stopFor(id);
        this.draw();
    }
    cancelConfirmations() { for (const person of this.people.values()) person.confirm = false; }
    notice(id, message) { this.lastAction = `${this.people.get(id)?.name || 'Someone'} ${message}`; }
    persist() {
        if (this.closed) return this.saveTail;
        const revision = ++this.saveRevision, snapshot = normalize(this.arrangement);
        const bytes = new TextEncoder().encode(JSON.stringify(snapshot, null, 2));
        this.saveStatus = 'Saving arrangement…';
        // Queue immediately so Download's export snapshot waits for this edit.
        // Both storage calls own immutable copies; an older ack cannot hide a
        // newer write failure. Rejected writes remain visible and retryable.
        const attempt = fn => { try { return Promise.resolve(fn()); } catch (error) { return Promise.reject(error); } };
        this.saveTail = Promise.all([
            attempt(() => this.options.saveGame?.(snapshot)),
            attempt(() => this.options.createExport?.('house-band.json', bytes)),
        ]).then(() => {
            if (revision === this.saveRevision) this.saveStatus = this.options.saveGame && this.options.createExport ? 'Saved · travels with your download' : 'Session only · saving unavailable';
            if (!this.closed) this.draw();
        }, () => {
            if (revision === this.saveRevision) this.saveStatus = 'Save failed · retry in ROOM';
            if (!this.closed) this.draw();
        });
        return this.saveTail;
    }
    // An undo belongs to its author. Undo only applies when its target still
    // has that author's value, so it cannot erase another musician's edit.
    editCell(id, kind, row, step) {
        const person = this.people.get(id);
        if (!person || !Number.isInteger(step) || step < 0 || step >= 16) return;
        if (kind === 'drum' && (!Number.isInteger(row) || row < 0 || row >= 3)) return;
        if (!['drum', 'bass'].includes(kind)) return;
        const cells = kind === 'drum' ? this.arrangement.drums[row] : this.arrangement.bass;
        const before = cells[step], after = kind === 'drum' ? 1 - before : before === person.pitch ? -1 : person.pitch;
        this.cancelConfirmations(); cells[step] = after;
        const key = `${kind}:${row}:${step}`, previousRevision = this.cellRevisions.get(key);
        const revision = ++this.editSequence; this.cellRevisions.set(key, revision);
        person.undo.push({ kind, row, step, before, after, key, revision, previousRevision }); if (person.undo.length > 32) person.undo.shift();
        this.notice(id, kind === 'drum' ? 'changed the drums' : 'changed the bass');
        if (!this.transport.playing && after !== (kind === 'drum' ? 0 : -1)) this.audition(id, kind === 'drum' ? ['kick', 'snare', 'hat'][row] : 'bass' + after);
        this.persist(); this.draw();
    }
    undo(id) {
        const person = this.people.get(id); if (!person) return;
        const change = person.undo.pop(); if (!change) { this.lastAction = 'No edits to undo on this device.'; this.draw(); return; }
        const cells = change.kind === 'drum' ? this.arrangement.drums[change.row] : this.arrangement.bass;
        if (this.cellRevisions.get(change.key) !== change.revision) { this.lastAction = 'That step changed again. Keeping the newer edit.'; this.draw(); return; }
        this.cancelConfirmations(); cells[change.step] = change.before; this.cellRevisions.set(change.key, change.previousRevision);
        this.notice(id, 'undid a step'); this.persist(); this.draw();
    }
    tab(id, tab) {
        const person = this.people.get(id); if (!person || !Number.isInteger(tab) || tab < 0 || tab > 3) return;
        person.tab = tab; person.dragging = false; person.confirm = false; this.rebuildPerson(id); this.draw();
    }
    bank(id, bank) { const person = this.people.get(id); if (!person) return; person.bank = bank === 1 ? 1 : 0; this.rebuildPerson(id); this.draw(); }
    pitch(id, pitch) { const person = this.people.get(id); if (!person || !Number.isInteger(pitch) || pitch < 0 || pitch > 4) return; person.pitch = pitch; this.audition(id, 'bass' + person.pitch); this.draw(); }
    audition(id, name) {
        if (!this.people.has(id) || !['kick','snare','hat','bass0','bass1','bass2','bass3','bass4'].includes(name)) return;
        const now = this.now(); this.audio.play(name, this.arrangement, now, this.audioListeners()); this.audio.update(now); this.dirty();
    }
    playStep(step, now) {
        for (const name of soundsAt(this.arrangement, step)) {
            this.audio.play(name, this.arrangement, now, this.audioListeners());
            this.energy[name.startsWith('bass') ? 3 : ['kick', 'snare', 'hat'].indexOf(name)] = 1;
        }
        this.audio.update(now); this.dirty();
    }
    toggle(id) {
        if (!this.people.has(id)) return;
        if (this.transport.playing) { this.transport.stop(); this.audio.stop(); this.notice(id, 'paused the loop'); }
        else { const now = this.now(); this.playStep(this.transport.start(now), now); this.notice(id, 'started the loop'); }
        this.draw();
    }
    tempo(id, delta) {
        if (!this.people.has(id) || ![-4, 4].includes(delta)) return;
        const now = this.now(), step = this.transport.advance(now, this.arrangement.bpm);
        if (step !== null) this.playStep(step, now);
        this.cancelConfirmations(); this.arrangement.bpm = clamp(this.arrangement.bpm + delta, 60, 160);
        this.notice(id, 'set the tempo'); this.persist(); this.draw();
    }
    mute(id, track) {
        if (!this.people.has(id) || !Number.isInteger(track) || track < 0 || track > 3) return;
        this.cancelConfirmations(); this.arrangement.muted[track] = !this.arrangement.muted[track]; this.notice(id, 'changed the mix'); this.persist(); this.draw();
    }
    effects(id, x, y) {
        const person = this.people.get(id); if (!person || !Number.isFinite(x) || !Number.isFinite(y)) return;
        const tone = clamp(Math.floor((x - 6) / 18), 0, 2), space = 2 - clamp(Math.floor((y - 55) / 11), 0, 2);
        if (tone === this.arrangement.tone && space === this.arrangement.space) return;
        this.cancelConfirmations(); this.arrangement.tone = tone; this.arrangement.space = space;
        this.notice(id, 'shaped the sound'); this.persist(); this.draw();
    }
    validPoint(point) { return point && Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x < 100 && point.y >= 0 && point.y < 100; }
    pointerDown(id, x, y) {
        const person = this.people.get(id), view = this.views.get(id);
        if (!person || !view || person.pointerHeld || !this.validPoint({x,y})) return;
        person.pointerHeld = true; person.suppressRelease = false;
        const hit = [...view.u.hits].reverse().find(h => x >= h.x && x < h.x+h.w && y >= h.y && y < h.y+h.h);
        if (hit?.effects) { person.dragging = true; this.effects(id, x, y); }
        else hit?.action(id);
    }
    cancelPointer(id, keepHeld = false) {
        const person = this.people.get(id); if (!person) return;
        if (person.pointerHeld) person.suppressRelease = true;
        person.pointerHeld = keepHeld && person.pointerHeld; person.dragging = false;
    }
    handleMouseMove(id, point) {
        if (this.people.get(id)?.dragging && this.validPoint(point)) this.effects(id, point.x, point.y);
    }
    handleMouseUp(id, point) {
        const person = this.people.get(id); if (!person) return;
        if (person.dragging && this.validPoint(point)) this.effects(id, point.x, point.y);
        else if (!person.pointerHeld && !person.suppressRelease && this.validPoint(point)) this.pointerDown(id, point.x, point.y);
        person.pointerHeld = false; person.dragging = false; person.suppressRelease = false;
    }
    clear(id) {
        const person = this.people.get(id); if (!person || id !== this.people.keys().next().value) return;
        if (!person.confirm) { person.confirm = true; this.rebuildPerson(id); this.draw(); return; }
        this.cellRevisions.clear();
        this.arrangement.drums.forEach(row => row.fill(0)); this.arrangement.bass.fill(-1);
        for (const p of this.people.values()) { p.undo = []; p.confirm = false; }
        this.notice(id, 'cleared the pattern'); this.persist(); this.rebuild();
    }
    async exportWav(id) {
        const person = this.people.get(id); if (!person || this.exporting) return;
        if (!this.options.createExport) { this.lastAction = 'Audio export is unavailable on this host.'; this.draw(); return; }
        const snapshot = normalize(this.arrangement);
        this.exporting = true; this.lastAction = 'Rendering four bars…'; this.draw();
        try {
            await this.persist();
            if (this.closed) return;
            await this.options.createExport('house-band-loop.wav', renderLoop(snapshot));
            this.lastAction = 'WAV ready · open View exports above';
        } catch (_) { this.lastAction = 'Could not export audio. Try again.'; }
        finally { this.exporting = false; if (!this.closed) this.draw(); }
    }
    handleKeyDown(id, key) {
        const person = this.people.get(id);
        if (!person || typeof key !== 'string') return;
        key = key.toLowerCase();
        if (![' ', '1', '2', '3', '4', 'z', 'm'].includes(key) || person.keys.has(key)) return;
        person.keys.add(key); this.cancelPointer(id, true);
        if (key === ' ') this.toggle(id);
        else if ('1234'.includes(key)) this.tab(id, Number(key) - 1);
        else if (key === 'z') this.undo(id);
        else if (key === 'm') this.toggleSound(id);
    }
    handleKeyUp(id, key) { if (typeof key === 'string') this.people.get(id)?.keys.delete(key.toLowerCase()); }
    rebuild() { for (const id of this.people.keys()) this.rebuildPerson(id); this.draw(); }
    rebuildPerson(id) {
        const person = this.people.get(id); if (!person) return;
        const old = this.views.get(id);
        // Keep the input capture attached while controls change underneath it.
        const root = old?.root || new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: GROUP, playerIds: [id] });
        if (!old) this.base.addChild(root, false);
        const scene = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: GROUP });
        const input = old?.input || new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(0,0,100,100),
            onClick: (who,x,y) => { if(who===id) this.pointerDown(id,x,y); }, offClick: who => { if(who===id) this.cancelPointer(id); } });
        root.node.children = [scene, input];
        const u = new UI(scene), v = { root, input, u, cells: [], trackButtons: [], pitches: [], fx: [] }; this.views.set(id, v);
        const action = fn => who => { if (who === id && this.views.get(id) === v) fn(); };
        v.sound = u.button('', 5, 4, 40, 8, action(() => this.toggleSound(id)), C.panel, 2.4);
        u.shape(circle(87, 7.5, 1), C.mint); u.text(this.people.size + ' / 8', 90, 6.5, 2.3, C.mint);
        v.play = u.button('PLAY', 5, 15, 28, 8, action(() => this.toggle(id)), C.mint, 3);
        u.button('−', 36, 15, 9, 8, action(() => this.tempo(id, -4)), C.panel, 3.5);
        v.tempo = u.text('', 56, 15.9, 3.2, C.white, 'center'); u.text('BPM', 56, 20.9, 1.3, C.muted, 'center');
        u.button('+', 67, 15, 9, 8, action(() => this.tempo(id, 4)), C.panel, 3.5);
        u.button('UNDO', 79, 15, 16, 8, action(() => this.undo(id)), C.panel, 2);
        u.rect(5, 26, 90, 11, C.panel);
        v.bars = Array.from({ length: 16 }, (_, i) => u.rect(7 + i * 5.4, 31, 2.3, .8, COLORS[Math.floor(i / 4)]));
        v.beat = u.text('', 95, 38, 1.5, C.muted, 'right');
        for (let i = 0; i < TABS.length; i++) u.button(TABS[i], 5 + i * 23, 41, 21, 8, action(() => this.tab(id, i)), person.tab === i ? COLORS[i] : C.panel, 2.5);
        if (person.tab === 0 || person.tab === 1) {
            u.button('1–8', 65, 51, 14, 6, action(() => this.bank(id, 0)), person.bank === 0 ? C.white : C.panel, 2);
            u.button('9–16', 81, 51, 14, 6, action(() => this.bank(id, 1)), person.bank === 1 ? C.white : C.panel, 2);
            if (person.tab === 0) this.drums(id, v, action); else this.bass(id, v, action);
        } else if (person.tab === 2) this.fx(id, v); else this.room(id, v, action);
        v.activity = u.text('', 5, 94, 1.65, C.white);
        v.saved = u.text('', 5, 97, 1.55, C.muted);
    }
    drums(id, v, action) {
        const { u } = v, person = this.people.get(id);
        for (let s = 0; s < 8; s++) u.text(s + 1 + person.bank * 8, 23 + s * 9.5, 59, 1.8, s % 4 === 0 ? C.white : C.muted, 'center');
        for (let row = 0; row < 3; row++) {
            const y = 63 + row * 9.5;
            u.button(['KICK', 'SNARE', 'HAT'][row], 5, y, 12, 8, action(() => this.audition(id, ['kick', 'snare', 'hat'][row])), C.panel, 1.8);
            for (let s = 0; s < 8; s++) {
                const step = s + person.bank * 8, x = 19 + s * 9.5;
                const button = u.button('', x, y, 8, 8, action(() => this.editCell(id, 'drum', row, step)), C.panel, 0);
                const lamp = u.rect(x + 2.5, y + 2.5, 3, 3, C.line, {}, button);
                v.cells.push({ row, step, button, lamp });
            }
        }
        v.firstBeatHint = u.text('', 5, 91, 1.65, C.muted);
    }
    bass(id, v, action) {
        const { u } = v, person = this.people.get(id);
        for (let note = 0; note < 5; note++) v.pitches.push(u.button(NOTES[note], 5 + note * 18.5, 59, 16, 9, action(() => this.pitch(id, note)), C.panel, 3));
        u.text('Pick a note, then a beat', 5, 70, 1.7, C.muted);
        for (let s = 0; s < 8; s++) {
            const step = s + person.bank * 8, x = 5 + s * 11.5;
            const button = u.button('', x, 75, 9.5, 13, action(() => this.editCell(id, 'bass', 0, step)), C.panel, 3);
            const lamp = u.rect(x + 1, 75.8, 7.5, .7, C.line, {}, button);
            u.text(step + 1, x + 4.75, 88.8, 1.5, C.muted, 'center');
            v.cells.push({ step, button, lamp });
        }
    }
    fx(id, v) {
        const { u } = v;
        u.hits.push({x:6,y:55,w:54,h:33,effects:true});
        const pad = u.rect(6, 55, 54, 33, C.panel);
        for (let space = 0; space < 3; space++) for (let tone = 0; tone < 3; tone++) {
            const x = 6 + tone * 18, y = 55 + (2 - space) * 11;
            const color = [65 + tone * 32, 62 + space * 22, 99 + tone * 20, 255];
            u.rect(x + .4, y + .4, 17.2, 10.2, color, {}, pad);
        }
        v.puck = u.shape(circle(33, 82, 2.4), C.white, {}, pad);
        u.text('WARM', 6, 89, 1.8, C.muted); u.text('BRIGHT', 60, 89, 1.8, C.muted, 'right');
        u.text('COLOR', 67, 58, 1.8, C.muted); v.tone = u.text('', 67, 62, 3.2, C.white);
        u.text('SPACE', 67, 70, 1.8, C.muted); v.space = u.text('', 67, 74, 3.2, C.violet);
        u.text('↑ More echo', 67, 84, 1.7, C.muted);
    }
    room(id, v, action) {
        const { u } = v, first = this.people.keys().next().value;

        u.text('Sound is controlled on each device.', 5, 51, 1.8, C.muted);
        [...this.people.entries()].forEach(([key, person], index) => {
            const name = person.name.length > 12 ? person.name.slice(0, 11) + '…' : person.name;
            u.text(name + (key === id ? ' (you)' : ''), 5 + (index % 2) * 47, 55 + Math.floor(index / 2) * 3.6, 1.9, C.white);
        });
        for (let track = 0; track < 4; track++) v.trackButtons.push(u.button('', 5 + track * 23, 72, 21, 7, action(() => this.mute(id, track)), C.panel, 1.9));
        u.button('EXPORT WAV', 5, 82, 32, 8, action(() => this.exportWav(id)), C.gold, 2.1);
        u.button('SAVE AGAIN', 40, 82, 27, 8, action(() => this.persist()), C.panel, 1.8);
        if (id === first) v.clear = u.button(this.people.get(id).confirm ? 'CLEAR? TAP' : 'CLEAR', 70, 82, 25, 8, action(() => this.clear(id)), this.people.get(id).confirm ? C.coral : C.panel, 1.9);
        u.text('Download HTML / ZIP above to keep and share this instrument.', 5, 91, 1.6, C.muted);
    }
    draw() {
        if (this.closed) return;
        const a = this.arrangement, playing = this.transport.playing, step = this.transport.step;
        for (const [id, v] of this.views) {
            const person = this.people.get(id); if (!person) continue;
            UI.set(v.sound.label, person.sound ? 'SOUND ON' : 'SOUND OFF');
            v.sound.node.fill = person.sound ? C.mint : C.panel; v.sound.label.node.text.color = person.sound ? C.ink : C.white;
            if (v.clear) { UI.set(v.clear.label, person.confirm ? 'CLEAR? TAP' : 'CLEAR'); v.clear.node.fill = person.confirm ? C.coral : C.panel; }
            UI.set(v.play.label, playing ? 'PAUSE' : 'PLAY'); v.play.node.fill = playing ? C.white : C.mint;
            UI.set(v.tempo, a.bpm); UI.set(v.beat, playing ? `${step + 1} / 16` : '');
            for (let i = 0; i < v.bars.length; i++) {
                const energy = this.energy[Math.floor(i / 4)], height = .8 + energy * (2.3 + 5 * Math.abs(Math.sin(i * 1.1 + this.clock / 160)));
                UI.move(v.bars[i], 7 + i * 5.4, 31.5 - height / 2, 2.3, height);
            }
            for (const cell of v.cells) {
                const drum = person.tab === 0, note = drum ? a.drums[cell.row][cell.step] : a.bass[cell.step];
                const on = drum ? note === 1 : note >= 0, color = drum ? COLORS[cell.row] : C.mint;
                cell.button.node.fill = on ? color : C.panel;
                cell.lamp.node.fill = playing && step === cell.step ? C.white : on ? C.ink : C.line;
                if (!drum) { UI.set(cell.button.label, on ? NOTES[note] : '·'); cell.button.label.node.text.color = on ? C.ink : C.muted; }
            }
            v.pitches.forEach((button, index) => { button.node.fill = person.pitch === index ? C.mint : C.panel; button.label.node.text.color = person.pitch === index ? C.ink : C.white; });
            if (v.puck) {
                v.puck.node.coordinates2d = circle(15 + a.tone * 18, 60.5 + (2 - a.space) * 11, 2.4);
                UI.set(v.tone, ['Warm', 'Glow', 'Bright'][a.tone]); UI.set(v.space, ['Dry', 'Room', 'Echo'][a.space]);
            }
            v.trackButtons.forEach((button, track) => {
                UI.set(button.label, ['KICK', 'SNARE', 'HAT', 'BASS'][track] + (a.muted[track] ? ' OFF' : ' ON'));
                button.node.fill = a.muted[track] ? C.panel : COLORS[track]; button.label.node.text.color = a.muted[track] ? C.muted : C.ink;
            });
            UI.set(v.activity, this.lastAction.length > 66 ? this.lastAction.slice(0, 63) + '…' : this.lastAction);
            if (v.firstBeatHint) UI.set(v.firstBeatHint, this.cellRevisions.size ? '' : 'Tap a pad to add a beat');
            UI.set(v.saved, this.saveStatus);
        }
        this.dirty();
    }
    tick(now = this.now()) {
        if (this.closed || !this.people.size || !Number.isFinite(now)) return;
        const elapsed = Math.min(.2, Math.max(0, (now - this.clock) / 1000)); this.clock = Math.max(now, this.clock);
        const step = this.transport.advance(now, this.arrangement.bpm);
        if (step !== null) this.playStep(step, now);
        const audioChanged = this.audio.update(now), animating = this.energy.some(energy => energy > 0);
        this.energy = this.energy.map(energy => Math.max(0, energy - elapsed * 3.8));
        if (step !== null || (animating && (now - this.lastDraw >= 1000 / 30 || this.energy.every(energy => energy === 0)))) { this.lastDraw = now; this.draw(); }
        else if (step !== null || audioChanged) this.dirty();
    }
    close() {
        if (this.closed) return this.saveTail;
        this.closed = true; this.transport.stop(); this.audio.stop(); this.people.clear(); this.views.clear(); this.base.clearChildren();
        super.close(); return this.saveTail;
    }

}
module.exports = HouseBand;
