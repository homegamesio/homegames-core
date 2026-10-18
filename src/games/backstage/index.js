'use strict';
const { Game, GameNode, Asset, ShapeUtils } = require('squish-150');
const { C, UI, clamp, polygon, rect, group, robot, setText } = require('./ui');
const lessons = require('./lessons');
const Lookout = require('./lookout');

const RATE = 20;
const colors = [C.gold, C.mint, C.coral, C.blue, C.purple, C.gold, C.coral, C.mint];
const symbols = ['SUN', 'MOON', 'STAR'];
const cleanName = value => String(value || 'Pip').replace(/[\x00-\x1f]/g, '').trim().slice(0, 18) || 'Pip';
function design(value = {}) {
    return { name: cleanName(value?.name), shape: [0, 1, 2].includes(value?.shape) ? value.shape : 0,
        color: [0, 1, 2].includes(value?.color) ? value.color : 0,
        size: Number.isFinite(value?.size) ? clamp(value.size, 5, 10) : 7, glow: value?.glow === true };
}
function checkpointData(value) {
    const ids = list => [...new Set(Array.isArray(list) ? list.filter(i => Number.isInteger(i) && i >= 0 && i < 8) : [])];
    return { schema: 1, design: design(value?.design), done: ids(value?.done), visited: ids(value?.visited) };
}
function exportedDesign(files) {
    try { return JSON.parse(new TextDecoder().decode(files?.['backstage-design.json'])); } catch (_) { return null; }
}
const bytes = value => new TextEncoder().encode(value);
const xml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

class Backstage extends Game {
    static metadata() {
        return {
            isTest: true,
            name: 'Homegames Backstage',
            author: "Joseph Garcia",
            description: 'Build a little toy and discover how Homegames works. Eight playable experiments with inputs, cameras, multiplayer, media, live streams, saves and exports. Explore solo or bring friends.',
            thumbnail: './assets/thumbnail.png',
            aspectRatio: { x: 16, y: 10 },
            tickRate: 20,
            maxPlayers: 6,
            assets: {
                postcard: new Asset({ path: './assets/postcard.png', type: 'image' }),
                chime: new Asset({ path: './assets/chime.wav', type: 'audio' }),
            },
            gameId: "c601dd38-feb7-435b-9d17-6a714887d64c"
        };
    }

    constructor(options = {}) {
        super();
        this.options = options;
        this.saved = checkpointData(options.saveData?.schema === 1 ? options.saveData : {});
        if (options.saveData?.schema !== 1 && exportedDesign(options.userExports)) this.saved.design = design(exportedDesign(options.userExports));
        this.players = new Map(); this.time = 0; this.serial = 0; this.charges = 0;
        this.base = rect(0, 0, 100, 100, C.ink);
        new UI(this.base).text('HOMEGAMES BACKSTAGE · Join to start exploring', 50, 46, 2.6, C.paper, 'center');
        this.lookout = new Lookout((id, beacon) => this.beacon(id, beacon));
        this.unsubscribe = options.media?.onChange?.(event => {
            if (event.state !== 'ended') return;
            for (const p of this.players.values()) if (p.stream?.id === event.id) {
                p.stream = null;
                if (p.station === 6) { p.notice = 'Broadcast ended. Your device is released.'; this.render(p); }
            }
            this.refreshBroadcasts();
        });
    }

    getLayers() { return [{ root: this.base }]; }
    canAddPlayer() { return this.players.size < 6; }
    handleNewPlayer({ playerId, info, clientInfo }) {
        if (this.players.has(playerId) || !this.canAddPlayer() || this.closed) return;
        const seat = [0, 1, 2, 3, 4, 5].find(index => ![...this.players.values()].some(person => person.seat === index));
        this.serial++;
        const p = { id: playerId, seat, name: cleanName(info?.name || 'Visitor ' + (seat + 1)),
            device: String(clientInfo?.deviceType || 'browser'), root: group(playerId), station: -1,
            design: design(this.saved.design), done: new Set(this.saved.done), visited: new Set(this.saved.visited),
            visit: 0, notice: '', keys: {}, refs: {}, inspected: false, named: false,
            x: 16, y: 43, plugged: false, moved: false, plug: { x: 17, y: 62 }, dragging: false,
            rhythm: 0, catches: 0, speed: 1, paused: false, beacons: new Set(),
            secret: seat % 3, sent: false, mediaKey: null, mediaKind: null, stream: null, pending: false,
        };
        this.players.set(playerId, p); this.base.addChild(p.root); this.lookout.join(playerId);
        this.render(p); this.refreshTogether();
    }
    handlePlayerDisconnect(id) {
        const p = this.players.get(id); if (!p) return;
        p.visit++; this.releaseMedia(p); this.players.delete(id);
        this.lookout.leave(id); this.base.removeChild(p.root.id); this.refreshTogether();
    }
    // Every private callback checks identity AND the current station. playerIds
    // controls presentation; it is never used as an authorization check.
    action(p, fn) {
        const station = p.station, visit = p.visit;
        return (id, ...args) => {
            if (!this.closed && this.players.get(id) === p && p.station === station && p.visit === visit && !p.inspected) return fn(...args);
        };
    }
    navigate(id, station) {
        const p = this.players.get(id);
        if (!p || !Number.isInteger(station) || station < -1 || station > 8) return;
        p.visit++; this.releaseMedia(p); p.pending = false; p.keys = {}; p.dragging = false;
        p.station = station; p.inspected = false; p.notice = '';
        if (station >= 0 && station < 8) p.visited.add(station);
        if (station === 8) { p.roundTime = 30; p.score = 0; p.target = 0; p.finished = false; }
        this.render(p);
    }
    stamp(p, station) {
        if (p.done.has(station)) return;
        p.done.add(station); p.notice = 'STAMP EARNED · ' + lessons[station].short;
        this.render(p); this.sound(p);
    }
    note(p, text) { p.notice = String(text).slice(0, 105); setText(p.refs.notice, p.notice); }

    render(p) {
        p.root.clearChildren(); p.refs = {};
        const u = new UI(p.root);
        u.rect(0, 0, 100, 100, C.ink);
        if (p.station === -1) return this.renderMap(p, u);
        if (p.station === 8) return this.renderFinale(p, u);
        const lesson = lessons[p.station];
        // Navigation remains usable while inspecting code.
        u.button('Workshop', 4, 4, 15, id => { if (id === p.id) this.navigate(id, -1); }, C.paper, 6);
        u.text(lesson.tag, 22, 5.4, 1.35, colors[p.station]);
        u.button(p.inspected ? 'Back to the toy' : 'How it works', 77, 4, 19, id => {
            if (id !== p.id) return;
            p.inspected = !p.inspected; p.keys = {}; p.dragging = false;
            if (p.inspected) { p.visit++; this.releaseMedia(p); p.pending = false; }
            this.render(p);
        }, C.paper, 6);
        u.text(lesson.title, 4, 14, 3.2);
        u.rect(4, 25, 62, 55, C.panel);
        u.rect(69, 25, 27, 55, C.panel);
        if (p.inspected) {
            u.text('THE ACTUAL BUILDING BLOCKS', 7, 28, 1.25, C.gold);
            u.lines(lesson.code, 7, 34, 1.24, C.paper, 3.15);
            u.lines(lesson.detail, 71, 29, 1.27, C.muted, 5.1);
        } else {
            u.text('TRY THIS', 71, 28, 1.25, C.gold);
            u.lines(lesson.goal, 71, 34, 1.35, C.paper, 3.9);
            u.rect(71, 51.5, 23, .25, C.line);
            u.lines(lesson.intro, 71, 55, 1.26, C.muted, 3.9);
            [this.renderShapes, this.renderInputs, this.renderRhythm, this.renderLookout,
                this.renderTogether, this.renderFiles, this.renderLive, this.renderExports][p.station].call(this, p, u);
        }
        p.refs.notice = u.text(p.notice || (p.done.has(p.station) ? 'STAMP EARNED · Keep experimenting, or try another station.' : 'Experiment at your own pace. Nothing here can break your game.'), 4, 83, 1.35, C.mint);
        u.text(lesson.reference, 4, 88, 1.13, C.muted);
        u.text(p.done.size + ' / 8 stamps', 4, 95, 1.45, C.gold);
        u.button(p.station === 7 ? 'Launch your toy' : 'Next experiment →', 72, 91, 24,
            id => { if (id === p.id) this.navigate(id, p.station + 1); }, colors[p.station]);
    }

    renderMap(p, u) {

        u.text('Choose an experiment', 5, 22, 3.2);
        robot(p.root, 83, 22, 6.3, p.design);
        lessons.forEach((lesson, i) => {
            const x = 5 + (i % 4) * 23.2, y = 42 + Math.floor(i / 4) * 20;
            const card = u.rect(x, y, 21.4, 17, C.panel, { onClick: this.action(p, () => this.navigate(p.id, i)),
                onHover: this.action(p, () => card.update({ fill: C.line })), offHover: this.action(p, () => card.update({ fill: C.panel })) });
            const c = new UI(card);
            c.text(p.done.has(i) ? '✓' : String(i + 1).padStart(2, '0'), x + 2, y + 2, 2.5, colors[i]);
            c.text(lesson.short, x + 2, y + 8, 1.55);
            if (i === 6) c.text('Optional devices', x + 2, y + 13, .95, C.muted);
        });
        u.text(p.done.size + ' / 8 stamps  ·  ' + this.players.size + ' in the workshop', 5, 86, 1.4, C.muted);

        u.button('Launch your toy →', 71, 85, 24, this.action(p, () => this.navigate(p.id, 8)), C.gold, 9);
    }

    renderShapes(p, u) {
        u.text('MEET ' + p.design.name.toUpperCase(), 9, 29, 1.3, C.muted);
        robot(p.root, 35, 48, p.design.size, p.design);
        const edit = fn => this.action(p, () => {
            fn(); this.render(p);
            if (p.design.shape === 1 && p.design.color === 1 && p.design.glow) this.stamp(p, 0);
        });
        u.button(['Square', 'Triangle', 'Circle'][p.design.shape], 8, 66, 16, edit(() => { p.design.shape = (p.design.shape + 1) % 3; }), C.paper);
        u.button(['Gold', 'Mint', 'Coral'][p.design.color], 27, 66, 16, edit(() => { p.design.color = (p.design.color + 1) % 3; }), [C.gold, C.mint, C.coral][p.design.color]);
        u.button(p.design.glow ? 'Glow: ON' : 'Glow: off', 46, 66, 16, edit(() => { p.design.glow = !p.design.glow; }), C.blue);
        u.button('−', 8, 46, 7, edit(() => { p.design.size = clamp(p.design.size - 1, 5, 10); }), C.paper);
        u.button('+', 55, 46, 7, edit(() => { p.design.size = clamp(p.design.size + 1, 5, 10); }), C.paper);
    }

    renderInputs(p, u) {
        const rename = this.action(p, value => {
            p.design.name = cleanName(value); p.named = true; this.render(p); this.checkInputs(p);
        });
        u.button('Name: ' + p.design.name, 8, 28, 29, null, C.paper, 6, { input: { type: 'text', oninput: rename } });
        p.refs.inputLabel = u.text(p.inputSource || 'TAP FLOOR / WASD / CONTROLLER', 40, 30, .95, C.muted);
        u.rect(8, 37, 54, 17, C.ink);
        u.rect(49, 39, 11, 13, C.mint); u.text('SOCKET', 54.5, 43, .95, C.ink, 'center');
        p.refs.mover = group(); p.root.addChild(p.refs.mover); this.drawMover(p);
        // Squish hit testing uses the topmost shape, including decoration.
        // A transparent control above the toy/socket makes the whole floor tap.
        u.rect(8, 37, 54, 17, [0, 0, 0, 0], { onClick: this.action(p, (x, y) => this.moveToy(p, x, y, 'TAP / TOUCH')) });
        u.rect(8, 57, 54, 11, C.ink);
        u.rect(49, 58, 11, 9, C.mint); u.text('DOCK', 54.5, 61, .95, C.ink, 'center');
        p.refs.plug = u.rect(p.plug.x - 3, p.plug.y - 3, 6, 6, p.plugged ? C.mint : C.gold, {
            onClick: this.action(p, () => { p.dragging = true; }),
            onDrag: this.action(p, (x, y) => this.dragPlug(p, x, y)),
            offClick: this.action(p, (x, y) => this.releasePlug(p, x, y)),
            onHover: this.action(p, () => p.refs.plug.update({ color: C.paper, border: 3 })),
            offHover: this.action(p, () => p.refs.plug.update({ border: 0 })),
        });
        u.button('←', 8, 71, 10, this.action(p, () => this.moveToy(p, p.x - 6, p.y, 'BUTTON')), C.paper, 6);
        u.button('→', 20, 71, 10, this.action(p, () => this.moveToy(p, p.x + 6, p.y, 'BUTTON')), C.paper, 6);
        u.button('↑', 32, 71, 10, this.action(p, () => this.moveToy(p, p.x, p.y - 4, 'BUTTON')), C.paper, 6);
        u.button('↓', 44, 71, 10, this.action(p, () => this.moveToy(p, p.x, p.y + 4, 'BUTTON')), C.paper, 6);
    }
    drawMover(p) { if (p.refs.mover) { p.refs.mover.clearChildren(); robot(p.refs.mover, p.x, p.y, 2.4, p.design); } }
    moveToy(p, x, y, source) {
        if (p.station !== 1 || p.inspected || !Number.isFinite(x) || !Number.isFinite(y)) return;
        p.x = clamp(x, 11, 58); p.y = clamp(y, 41, 50); p.inputSource = source;
        setText(p.refs.inputLabel, source);
        if (p.x >= 49) p.moved = true;
        this.drawMover(p); this.checkInputs(p);
    }
    dragPlug(p, x, y) {
        if (!p.dragging || !Number.isFinite(x) || !Number.isFinite(y)) return;
        p.plug.x = clamp(x, 11, 59); p.plug.y = clamp(y, 60, 65);
        p.refs.plug.update({ coordinates2d: ShapeUtils.rectangle(p.plug.x - 3, p.plug.y - 3, 6, 6) });
    }
    releasePlug(p, x, y) {
        if (!p.dragging) return;
        // The final pointer position can arrive only on release for a quick
        // drag. offClick supplies game-space coordinates in framed hosts too.
        this.dragPlug(p, x, y);
        p.dragging = false; p.plugged = p.plug.x >= 49;
        if (p.plugged) { p.plug = { x: 54, y: 62 }; this.render(p); }
        this.checkInputs(p);
    }
    checkInputs(p) { if (p.named && p.moved && p.plugged) this.stamp(p, 1); }

    renderRhythm(p, u) {
        u.text('CATCH THE BEAT', 35, 29, 1.4, C.muted, 'center');
        u.rect(8, 44, 54, 4, C.ink); u.rect(29, 39, 12, 14, C.mint);
        p.refs.spark = u.shape(polygon(35, 46, 2.5, 4), C.gold);
        p.refs.rhythmLabel = u.text(p.catches + ' / 3 beats caught', 35, 57, 1.5, C.paper, 'center');
        u.button(p.paused ? 'Resume' : 'Pause', 8, 68, 14, this.action(p, () => { p.paused = !p.paused; this.render(p); }), C.paper);
        u.button('CATCH', 25, 67, 20, this.action(p, () => this.catchBeat(p)), C.mint, 9);
        u.button(p.speed === 1 ? 'Speed 1×' : 'Speed ½×', 48, 68, 14, this.action(p, () => { p.speed = p.speed === 1 ? .5 : 1; this.render(p); }), C.paper);
        this.updateRhythm(p);
    }
    catchBeat(p) {
        if (p.paused) return this.note(p, 'Resume the heartbeat to catch a spark.');
        if (Math.abs(Math.sin(p.rhythm * 1.8)) < .25 && p.rhythm - (p.lastCatch ?? -10) > .5) {
            p.lastCatch = p.rhythm; p.catches++; this.sound(p);
            setText(p.refs.rhythmLabel, p.catches + ' / 3 beats caught');
            this.note(p, 'Nice timing! The input changed state; the scene and sound responded.');
            if (p.catches >= 3) this.stamp(p, 2);
        } else this.note(p, 'Almost! Catch when the spark is inside the mint zone. Try half speed.');
    }
    updateRhythm(p) {
        p.refs.spark?.update({ coordinates2d: polygon(35 + Math.sin(p.rhythm * 1.8) * 24, 46, 2.5, 4) });
    }

    renderLookout(p, u) {
        p.refs.world = group(p.id); p.root.addChild(p.refs.world); this.updateView(p);
        const pan = (dx, dy) => this.action(p, () => { this.lookout.pan(p.id, dx, dy); this.updateView(p); });
        u.button('←', 7, 71, 8, pan(-24, 0), C.paper, 6);
        u.button('→', 17, 71, 8, pan(24, 0), C.paper, 6);
        u.button('↑', 27, 71, 8, pan(0, -24), C.paper, 6);
        u.button('↓', 37, 71, 8, pan(0, 24), C.paper, 6);
        u.button('Zoom', 47, 71, 15, this.action(p, () => { this.lookout.zoom(p.id); this.updateView(p); }), C.blue, 6);
        p.refs.cameraLabel = u.text('', 7, 26, 1.12, C.muted); this.updateView(p);
    }
    updateView(p) {
        if (!p.refs.world) return;
        p.refs.world.clearChildren(); p.refs.world.addChild(this.lookout.slice(p.id, p.beacons));
        const v = this.lookout.views.get(p.id);
        setText(p.refs.cameraLabel, 'CAMERA ' + Math.round(v.x) + ', ' + Math.round(v.y) + ' · ' + v.w + ' wide · BEACONS ' + p.beacons.size + '/3');
    }
    beacon(id, index) {
        const p = this.players.get(id); if (!p || p.station !== 3 || p.inspected) return;
        const v = this.lookout.views.get(id), [x, y] = this.lookout.beacons[index];
        if (x < v.x || x > v.x + v.w || y < v.y || y > v.y + v.h) return;
        p.beacons.add(index); this.sound(p); this.updateView(p);
        this.note(p, 'Beacon ' + (index + 1) + ' lit. Others are at (154, 46) and (150, 160).');
        if (p.beacons.size === 3) this.stamp(p, 3);
    }

    renderTogether(p, u) {
        u.text('ONLY YOUR SCREEN SAYS', 35, 29, 1.25, C.muted, 'center');
        u.text(symbols[p.secret], 35, 35, 4, C.gold, 'center');
        u.text(this.charges + ' signals in the shared machine', 35, 46, 1.5, C.paper, 'center');
        symbols.forEach((symbol, i) => u.button(symbol, 8 + i * 19, 54, 16, this.action(p, () => this.sendSignal(p, i)), colors[i]));
        u.button('Ask the solo helper', 8, 66, 27, this.action(p, () => {
            if (!p.sent) return this.note(p, 'Send your own symbol first, then the helper can answer.');
            if (!p.helperUsed) { p.helperUsed = true; this.charges++; }
            this.stamp(p, 4); this.note(p, 'The helper answered. It is a bot; invite a friend to try two real screens.'); this.refreshTogether();
        }), C.paper);
        u.text(this.players.size + ' real player' + (this.players.size === 1 ? '' : 's'), 39, 68, 1.3, C.muted);
        u.text('Use Share in the player menu to invite another screen.', 8, 76, 1.05, C.muted);
    }
    sendSignal(p, symbol) {
        if (symbol !== p.secret) return this.note(p, 'That is not your symbol. Your private card tells you which one to send.');
        if (!p.sent) { p.sent = true; this.charges++; this.sound(p); }
        this.note(p, 'Your signal is in. A second player or the solo helper can answer.');
        const senders = [...this.players.values()].filter(person => person.sent);
        if (senders.length >= 2) for (const person of senders) this.stamp(person, 4);
        this.refreshTogether();
    }
    refreshTogether() {
        for (const p of this.players.values()) if (p.station === 4 || p.station === -1) this.render(p);
    }

    mediaNode(root, key, kind, x = 12, y = 33, w = 46, h = 30) {
        root.addChild(new GameNode.Asset({ coordinates2d: kind === 'audio' ? ShapeUtils.rectangle(0, 0, 0, 0) : ShapeUtils.rectangle(x, y, w, h),
            assetInfo: { [key]: { pos: { x, y }, size: { x: kind === 'audio' ? 0 : w, y: kind === 'audio' ? 0 : h }, startTime: 0 } } }));
    }
    sound(p) {
        if (this.closed) return;
        if (!p.refs.audio) { p.refs.audio = group(p.id); p.root.addChild(p.refs.audio); }
        p.refs.audio.clearChildren(); this.mediaNode(p.refs.audio, 'chime', 'audio'); p.soundUntil = this.time + 1;
    }
    renderFiles(p, u) {
        u.text(p.mediaKind ? p.mediaKind.toUpperCase() + ' · SESSION ASSET' : 'BUNDLED POSTCARD', 35, 28, 1.25, C.muted, 'center');
        if (p.mediaKind === 'audio') { robot(p.root, 35, 48, 6, p.design); u.text('Your audio plays here', 35, 61, 1.4, C.mint, 'center'); }
        this.mediaNode(p.root, p.mediaKey || 'postcard', p.mediaKind || 'image');
        u.button('Play bundled', 8, 69, 17, this.action(p, () => {
            p.mediaKey = null; p.mediaKind = null; this.stamp(p, 5); this.render(p); this.sound(p);
        }), C.mint);
        u.button(p.pending ? 'Loading…' : 'Choose a file', 27, 69, 19, null, C.paper, 7, {
            input: { type: 'file', oninput: this.action(p, (data, meta) => this.upload(p, data, meta)) },
        });
        u.button('Replay', 48, 69, 14, this.action(p, () => { this.render(p); if (!p.mediaKey) this.sound(p); }), C.blue);
    }
    async upload(p, data, meta) {
        if (p.pending) return;
        const visit = p.visit; p.pending = true;
        this.note(p, 'Loading your file into this session…');
        try {
            if (!this.options.handleFileUpload) throw new Error('This host does not provide uploads. Try the bundled postcard.');
            const asset = await this.options.handleFileUpload(p.id, data, meta, { slot: 'backstage-media-' + p.seat });
            if (!this.current(p, visit)) return;
            p.mediaKey = asset.key; p.mediaKind = asset.info.type;
            p.mediaOrigin = p.station === 6 ? 'recording' : 'upload';
            this.stamp(p, p.station === 6 ? 6 : 5); this.render(p);
            this.note(p, 'Your ' + p.mediaKind + ' is ready. Uploads are session assets; they are not saved automatically.');
        } catch (error) { if (this.current(p, visit)) this.note(p, error.message); }
        finally { if (this.current(p, visit)) { p.pending = false; this.render(p); } }
    }
    current(p, visit) { return !this.closed && this.players.get(p.id) === p && p.visit === visit; }

    renderLive(p, u) {
        const streams = [...this.players.values()].filter(person => person.stream);
        const hasClip = p.mediaOrigin === 'recording' && p.mediaKey;
        u.text(streams.length ? 'LIVE · ' + streams.length + ' SOURCE(S)' : hasClip ? 'RECORDED CLIP · PLAYBACK' : 'THE STAGE IS YOURS', 35, 28, 1.25, C.coral, 'center');
        if (streams.length) {
            streams.forEach((person, i) => {
                const x = 8 + (i % 3) * 18, y = 34 + Math.floor(i / 3) * 14;
                u.rect(x, y, 17, 12, C.ink);
                p.root.addChild(new GameNode.Stream({ streamId: person.stream.id,
                    pos: { x, y }, size: { x: person.stream.video ? 17 : 0, y: person.stream.video ? 12 : 0 }, audio: true }));
                u.text(person.id === p.id ? 'YOU · muted locally' : person.name.slice(0, 14), x + 8.5, y + 10, .8, C.paper, 'center');
            });
        } else if (hasClip) this.mediaNode(p.root, p.mediaKey, p.mediaKind, 13, 33, 44, 22);
        else { robot(p.root, 35, 44, 4.8, p.design); u.text('Devices are always opt-in.', 35, 54, 1.2, C.muted, 'center'); }
        u.button(p.pending ? 'Waiting…' : 'Microphone', 8, 61, 16, this.action(p, () => this.capture(p, false)), C.mint, 6);
        u.button('Camera + mic', 27, 61, 17, this.action(p, () => this.capture(p, true)), C.blue, 6);
        u.button('Stop', 47, 61, 15, this.action(p, () => { p.visit++; this.releaseMedia(p); p.pending = false; this.note(p, 'Capture stopped. Your device is released.'); this.render(p); }), C.coral, 6);
        u.button('Record 3s clip', 8, 71, 24, this.action(p, () => this.record(p)), C.paper, 6);
        u.button('No-device route', 35, 71, 27, this.action(p, () => {
            p.visit++; this.releaseMedia(p); p.pending = false; p.skippedLive = true;
            this.note(p, 'Explored without devices. No live-media stamp claimed; your tour can still finish.'); this.render(p);
        }), C.paper, 6);
    }
    async capture(p, video) {
        if (p.pending || p.stream) return this.note(p, 'Stop the current capture before starting another.');
        const visit = p.visit; p.pending = true; this.note(p, 'Confirm in the player permission dialog to start.');
        try {
            if (!this.options.media?.request) throw new Error('Live capture is unavailable here. Use browser RTC play or take the no-device route.');
            const stream = await this.options.media.request(p.id, { audio: true, video, transmitting: true });
            if (!this.current(p, visit)) { this.options.media.stop(stream.id); return; }
            p.stream = stream; this.stamp(p, 6); this.refreshBroadcasts();
        } catch (error) { if (this.current(p, visit)) this.note(p, error.message); }
        finally { if (this.current(p, visit)) { p.pending = false; this.render(p); } }
    }
    async record(p) {
        if (p.pending || p.stream) return this.note(p, 'Stop live capture before recording.');
        const visit = p.visit; p.pending = true; this.note(p, 'Use the recording dialog to make a three-second clip.');
        try {
            if (!this.options.media?.record) throw new Error('Recording is unavailable here. You can still explore without devices.');
            const result = await this.options.media.record(p.id, { durationSeconds: 3, maxBytes: 2 * 1024 * 1024, prompt: 'Say hello to your toy. This clip is shared with this session.' });
            if (!this.current(p, visit)) return;
            p.pending = false; await this.upload(p, result.bytes, result.meta);
        } catch (error) { if (this.current(p, visit)) this.note(p, error.message); }
        finally { if (this.current(p, visit)) { p.pending = false; this.render(p); } }
    }
    releaseMedia(p) {
        if (p.stream) { const id = p.stream.id; p.stream = null; this.options.media?.stop?.(id); }
        this.options.media?.cancelRecording?.(p.id);
        this.refreshBroadcasts();
    }
    refreshBroadcasts() { if (!this.closed) for (const p of this.players.values()) if (p.station === 6 && !p.inspected) this.render(p); }

    renderExports(p, u) {
        robot(p.root, 35, 44, 6, p.design);
        u.text(p.design.name + ' · ' + p.done.size + ' stamps collected', 35, 56, 1.5, C.paper, 'center');
        u.button('Save checkpoint', 8, 63, 25, this.action(p, () => this.checkpoint(p)), C.mint);
        u.button('Restore checkpoint', 36, 63, 26, this.action(p, () => this.restore(p)), C.paper);
        u.button('Export toy + passport', 8, 72, 54, this.action(p, () => this.exportToy(p)), C.gold, 6);
    }
    snapshot(p) { return checkpointData({ design: p.design, done: [...p.done], visited: [...p.visited] }); }
    async checkpoint(p) {
        if (p.saving) return;
        p.saving = true; const visit = p.visit, data = this.snapshot(p);
        try {
            if (!this.options.saveGame) throw new Error('This host has no save service. Export your toy to keep it instead.');
            await this.options.saveGame(data); this.saved = data;
            if (this.current(p, visit)) { p.savedOnce = true; this.note(p, 'Checkpoint saved. Restore resets your toy and stamps to this moment.'); }
        } catch (error) { if (this.current(p, visit)) this.note(p, 'Save failed: ' + error.message); }
        finally { p.saving = false; }
    }
    restore(p) {
        p.design = design(this.saved.design); p.done = new Set(this.saved.done); p.visited = new Set(this.saved.visited);
        this.render(p); this.note(p, 'Checkpoint restored. Exported files are separate and remain in View exports.');
    }
    async exportToy(p) {
        if (p.exporting) return;
        p.exporting = true; const visit = p.visit, toy = design(p.design), done = new Set(p.done);
        if (p.savedOnce) done.add(7);
        const passport = ['HOMEGAMES BACKSTAGE — ' + toy.name, '', ...lessons.map((lesson, i) =>
            (done.has(i) ? '[STAMPED] ' : p.visited.has(i) ? '[EXPLORED] ' : '[TO TRY] ') + lesson.short), '',
        'Open the game ZIP in Studio to inspect and remix its source.', 'The game HTML includes code, bundled assets and exports for offline play.',
        'Live streams and uploaded session media are not included.', 'Your design is backstage-design.json. Your postcard is backstage-postcard.svg.'].join('\n');
        const color = ['#ffc75b', '#81deb8', '#ff8870'][toy.color];
        const body = toy.shape === 1 ? '<polygon points="400,108 525,315 275,315"' : toy.shape === 2
            ? '<circle cx="400" cy="230" r="105"' : '<rect x="295" y="125" width="210" height="210" rx="12"';
        const postcard = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">' +
            '<rect width="800" height="500" fill="#121f28"/><text x="40" y="55" fill="#81deb8" font-family="sans-serif" font-size="17">HOMEGAMES / MADE BACKSTAGE</text>' +
            body + ' fill="' + color + '"/><path d="M365 215v20m70-20v20M380 268h40" stroke="#121f28" stroke-width="14"/>' +
            '<text x="400" y="405" text-anchor="middle" fill="#f8f2dc" font-family="sans-serif" font-size="36">' + xml(toy.name) + '</text>' +
            '<text x="400" y="451" text-anchor="middle" fill="#a9bebb" font-family="sans-serif" font-size="18">' + done.size + ' experiments stamped · a little toy with a big world</text></svg>';
        try {
            if (!this.options.createExport) throw new Error('This host does not provide file exports. Try browser play.');
            await this.options.createExport('backstage-design.json', bytes(JSON.stringify(toy, null, 2)));
            await this.options.createExport('backstage-passport.txt', bytes(passport));
            await this.options.createExport('backstage-postcard.svg', bytes(postcard));
            if (!this.current(p, visit)) return;
            if (p.savedOnce) this.stamp(p, 7);
            this.note(p, 'Three files ready in View exports. Game ZIP / HTML downloads include these files too.');
        } catch (error) { if (this.current(p, visit)) this.note(p, 'Export failed: ' + error.message); }
        finally { p.exporting = false; }
    }

    renderFinale(p, u) {
        u.button('Workshop', 4, 4, 15, this.action(p, () => this.navigate(p.id, -1)), C.paper, 6);
        u.text('THE LITTLE LAUNCH', 23, 5.5, 1.3, C.mint);
        u.text(p.finished ? p.design.name + ' is alive!' : 'Catch a little wonder.', 5, 15, 3.7);
        u.text(p.finished ? 'You made the scene, the inputs and the magic behind it.' : 'Tap the flying gold spark. Feed your toy eight sparks before the clock runs out.', 5, 25, 1.45, C.muted);
        u.rect(5, 34, 90, 44, C.panel);
        robot(p.root, 50, 57, 9, p.design);
        if (!p.finished) {
            p.refs.target = u.shape(polygon(25, 50, 3.5, 4), C.gold, { onClick: this.action(p, () => {
                p.score++; p.target++; this.sound(p); this.updateFinale(p);
                if (p.score >= 8) { p.finished = true; this.render(p); }
            }) });
            p.refs.score = u.text('', 8, 84, 1.8, C.gold);
            this.updateFinale(p);
        } else {
            u.text(p.score >= 8 ? 'LIFTOFF! You caught all eight.' : 'Time flew! You caught ' + p.score + ' / 8.', 50, 83, 2, C.gold, 'center');
            u.button('Play again', 5, 91, 23, this.action(p, () => this.navigate(p.id, 8)), C.mint);
        }
        u.button('Keep this toy', 72, 91, 23, this.action(p, () => this.navigate(p.id, 7)), C.gold);
        u.text('Shapes + input + state + time + sound = a game.', 5, 88, 1.1, C.muted);
    }
    updateFinale(p) {
        const a = this.time * .85 + p.target * 2.1;
        p.refs.target?.update({ coordinates2d: polygon(50 + Math.cos(a) * 32, 55 + Math.sin(a * 1.3) * 14, 3.5, 4) });
        setText(p.refs.score, p.score + ' / 8 sparks · ' + Math.ceil(p.roundTime) + ' seconds');
    }
    handleKeyDown(id, key) {
        const p = this.players.get(id); if (!p || p.inspected || typeof key !== 'string') return;
        const normalized = key.toLowerCase();
        if (p.station === 2 && (normalized === ' ' || normalized === 'enter') && p.keys[normalized] === undefined) this.catchBeat(p);
        p.keys[normalized] = this.time;
    }
    handleKeyUp(id, key) { const p = this.players.get(id); if (p && typeof key === 'string') delete p.keys[key.toLowerCase()]; }
    handleGamepadInput(id, state) {
        const p = this.players.get(id); if (!p || p.inspected) return;
        const sticks = state?.input?.sticks;
        const x = Number(sticks?.STICK_1_X?.value), y = Number(sticks?.STICK_1_Y?.value);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const dt = clamp(Number(state.deltaTime) || 1 / 60, 0, .1);
        if (p.station === 1) this.moveToy(p, p.x + clamp(x, -1, 1) * 35 * dt, p.y + clamp(y, -1, 1) * 35 * dt, 'CONTROLLER');
        if (p.station === 3) { this.lookout.pan(id, clamp(x, -1, 1) * 70 * dt, clamp(y, -1, 1) * 70 * dt); this.updateView(p); }
    }
    tick() {
        if (this.closed) return;
        this.time += 1 / RATE;
        for (const p of this.players.values()) {
            if (p.soundUntil && this.time >= p.soundUntil) { p.refs.audio?.clearChildren(); p.soundUntil = 0; }
            if (p.inspected) continue;
            const down = key => this.time - (p.keys[key] ?? -100) < .25;
            const dx = Number(down('d') || down('arrowright')) - Number(down('a') || down('arrowleft'));
            const dy = Number(down('s') || down('arrowdown')) - Number(down('w') || down('arrowup'));
            if (p.station === 1 && (dx || dy)) this.moveToy(p, p.x + dx * 1.8, p.y + dy * 1.8, 'KEYBOARD');
            if (p.station === 2) { if (!p.paused) p.rhythm += p.speed / RATE; this.updateRhythm(p); }
            if (p.station === 3 && (dx || dy)) { this.lookout.pan(p.id, dx * 3, dy * 3); this.updateView(p); }
            if (p.station === 8 && !p.finished) {
                p.roundTime = Math.max(0, p.roundTime - 1 / RATE); this.updateFinale(p);
                if (p.roundTime === 0) { p.finished = true; this.render(p); }
            }
        }
    }
    close() {
        this.closed = true; this.unsubscribe?.();
        for (const p of this.players.values()) { p.visit++; this.releaseMedia(p); }
        this.lookout.close(); super.close();
    }
}
module.exports = Backstage;
