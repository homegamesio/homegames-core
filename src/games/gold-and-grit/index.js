'use strict';
const { ViewableGame, GameNode, Shapes, Asset } = require('squish-150');
const { Defense } = require('./engine');
const { LEVELS, BASE_COUNT, unlockedIndex, blankLevel, group } = require('./levels');
const { Editor, validateLevel, decodePack, encodePack, libraryError, MAP_SIZES, MAX_MAPS } = require('./design');
const { ORDER, ENEMY_ORDER, THEMES, fieldFor, clone, clamp } = require('./content');
const { VIEWPORT, createCamera, clampCamera, screenToWorld, zoomCamera, panCamera, fitCamera, fitZoom, worldBounds } = require('./camera');
const { Painter } = require('./art');
const { draw } = require('./view');
const HIDDEN = [[0, 0], [0, 0], [0, 0]];
const shape = () => new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
const coordinates = (x, y, w, h) => [[x / 1.6, y], [(x + w) / 1.6, y], [(x + w) / 1.6, y + h], [x / 1.6, y + h], [x / 1.6, y]];
const NUMBER_FIELDS = {
    count: { tab: 'waves', box: [138, 41, 9, 5], min: 1, max: 80, integer: true },
    gap: { tab: 'waves', box: [138, 49.5, 9, 5], min: .2, max: 5 },
    delay: { tab: 'waves', box: [138, 58, 9, 5], min: 0, max: 60 },
    cash: { tab: 'rules', box: [51, 43, 27, 7], min: 70, max: 3000, integer: true },
    gold: { tab: 'rules', box: [51, 55, 27, 7], min: 1, max: 100, integer: true },
    width: { tab: 'size', box: [138, 31, 10, 7], min: 116, max: 260, integer: true },
    height: { tab: 'size', box: [138, 49, 10, 7], min: 62, max: 180, integer: true },
};

class GoldAndGrit extends ViewableGame {
    static metadata() {
        return {
            name: 'Gold & Grit',
            description: 'Keep the bandits out of your saloon. A colorful western tower defense with a sprawling authored campaign, a secret frontier, branching cowboy upgrades and a portable frontier workshop.',
            author: "Joseph Garcia",
            aspectRatio: { x: 16, y: 10 },
            tickRate: 30,
            maxPlayers: 1,
            thumbnail: './assets/thumbnail.png',
            assets: {
                shot: new Asset({ path: './assets/shot.wav', type: 'audio' }), pop: new Asset({ path: './assets/pop.wav', type: 'audio' }),
                boom: new Asset({ path: './assets/boom.wav', type: 'audio' }), coin: new Asset({ path: './assets/coin.wav', type: 'audio' }),
                bell: new Asset({ path: './assets/bell.wav', type: 'audio' }), win: new Asset({ path: './assets/win.wav', type: 'audio' }),
                lose: new Asset({ path: './assets/lose.wav', type: 'audio' }), hurt: new Asset({ path: './assets/hurt.wav', type: 'audio' }),
                build: new Asset({ path: './assets/build.wav', type: 'audio' }), rope: new Asset({ path: './assets/rope.wav', type: 'audio' }),
                throw: new Asset({ path: './assets/throw.wav', type: 'audio' }),
            },
            gameId: "eccb16da-43b1-4c91-876e-2b420c403fc2"
        };
    }
    constructor(options = {}) {
        super(320); this.options = options; this.owner = null; this.closed = false; this.clock = 0; this.screen = 'home'; this.notice = ''; this.saveTail = Promise.resolve();
        const saved = options.saveData?.version === 1 ? options.saveData : {};
        this.progress = { stars: LEVELS.map((_, i) => Number.isInteger(saved.stars?.[i]) ? clamp(saved.stars[i], 0, 3) : 0), unlocked: 0 };
        this.progress.unlocked = unlockedIndex(this.progress.stars);
        this.campaignPage = this.badlandsUnlocked ? 1 : 0;
        this.muted = saved.muted === true; this.custom = []; this.libraryPage = 0;
        for (const level of (Array.isArray(saved.custom) ? saved.custom : []).slice(0, MAX_MAPS)) { const checked = validateLevel(level); if (checked.level && !libraryError([...this.custom, checked.level])) this.custom.push(checked.level); }
        const exported = options.userExports?.['frontier.json'];
        if (exported && !Array.isArray(saved.custom)) { const pack = decodePack(exported); if (pack.levels) this.custom = pack.levels; else this.notice = pack.error; }
        const draft = validateLevel(saved.draft, { draft: true }); this.editor = draft.level ? new Editor(draft.level) : null;
        this.resume = null;
        if (saved.resume && Number.isInteger(saved.resume.index) && saved.resume.index >= -1 && saved.resume.index <= this.progress.unlocked) {
            const restored = Defense.restore(saved.resume.state);
            // A saved run keeps its authored terrain when the campaign is revised.
            if (restored && (saved.resume.index === -1 || restored.level.id === LEVELS[saved.resume.index].id)) this.resume = { index: saved.resume.index, state: restored.snapshot() };
        }
        this.run = null; this.levelIndex = -1; this.testing = false; this.selected = null; this.buildKind = null; this.hover = { x: 22, y: 48 };
        this.playCamera = createCamera(LEVELS[0]); this.editorCamera = createCamera(this.editor?.level || LEVELS[0]); this.camera = this.playCamera;
        this.cameraPan = false; this.panDrag = null; this.minimap = null; this.minimapDrag = false; this.editorMinimap = true; this.hoverVisible = true;
        this.keys = new Set(); this.held = false; this.drag = null; this.buttons = []; this.voices = []; this.lastSound = {};
        this.base = this.getViewRoot(); this.visual = shape(); this.audioRoot = shape(); this.surface = new GameNode.Shape({ shapeType: Shapes.POLYGON,
            coordinates2d: coordinates(0, 0, 159.98, 99.98), fill: [0, 0, 0, 0], color: [0, 0, 0, 0],
            onClick: (id, x, y) => this.press(id, x * 1.6, y), onDrag: (id, x, y) => this.move(id, x * 1.6, y), offClick: (id, x, y) => this.release(id, x * 1.6, y) });
        this.nameInput = shape(); this.importInput = shape();
        this.nameInput.node.input = { type: 'text', oninput: (id, value) => { if (!this.owns(id) || this.screen !== 'editor' || this.editor.tab !== 'rules') return; const name = String(value || '').trim().slice(0, 32); if (name) this.edit(l => { l.name = name; }); } };
        this.importInput.node.input = { type: 'file', oninput: (id, bytes) => { if (this.owns(id) && this.screen === 'library') this.importMaps(bytes); } };
        this.numberInputs = Object.fromEntries(Object.keys(NUMBER_FIELDS).map(field => { const node = shape(); node.node.input = { type: 'text', oninput: (id, value) => { if (this.owns(id)) this.setEditorNumber(field, value); } }; return [field, node]; }));
        this.base.addChildren(this.visual, this.audioRoot, this.surface, this.nameInput, this.importInput, ...Object.values(this.numberInputs));
        this.painter = new Painter(this.visual); this.draw();
    }
    getLayers() { return [{ root: this.base }]; }
    get badlandsUnlocked() { return this.progress.unlocked >= BASE_COUNT; }
    canAddPlayer() { return this.owner === null; }
    owns(id) { return this.owner !== null && Number(id) === this.owner; }
    handleNewPlayer({ playerId }) { if (this.owner === null) this.owner = Number(playerId); this.draw(); }
    handlePlayerDisconnect(id) { if (!this.owns(id)) return; this.owner = null; this.keys.clear(); this.held = false; this.finishDrag(); if (this.run) this.run.paused = true; this.persist(); }
    syncInputs() {
        this.nameInput.node.coordinates2d = this.screen === 'editor' && this.editor.tab === 'rules' ? coordinates(12, 32, 102, 8) : HIDDEN;
        this.importInput.node.coordinates2d = this.screen === 'library' ? coordinates(82, 25, 32, 8) : HIDDEN;
        for (const [field, node] of Object.entries(this.numberInputs)) { const spec = NUMBER_FIELDS[field]; node.node.coordinates2d = this.screen === 'editor' && this.editor.tab === spec.tab ? coordinates(...spec.box) : HIDDEN; }
    }
    navigationLevel() { return this.screen === 'editor' ? this.editor?.level : this.screen === 'play' ? this.run?.level : null; }
    mapScreen() { return this.screen === 'play' || this.screen === 'editor' && ['trail', 'scenery'].includes(this.editor.tab); }
    inField(x, y) { return x >= VIEWPORT.x && x < VIEWPORT.x + VIEWPORT.w && y >= VIEWPORT.y && y < VIEWPORT.y + VIEWPORT.h; }
    draw() {
        if (this.closed) return;
        const level = this.navigationLevel();
        if (level) { this.camera = this.screen === 'editor' ? this.editorCamera : this.playCamera; clampCamera(this.camera, level); const bounds = worldBounds(level); this.updatePlaneSize(Math.max(bounds.w, bounds.y + bounds.h)); }
        draw(this);
    }
    jumpMap(x, y) {
        const map = this.minimap, level = this.navigationLevel(); if (!map || !level) return;
        if (this.camera.zoom <= fitZoom(level) + .001) this.camera.zoom = 1;
        this.camera.x = map.bounds.x + (x - map.ox) / map.scale; this.camera.y = map.bounds.y + (y - map.oy) / map.scale;
        clampCamera(this.camera, level); this.hoverVisible = false;
    }
    cameraAction(kind) {
        const level = this.navigationLevel(); if (!level) return;
        if (kind === 'camera-pan') { this.cameraPan = !this.cameraPan; this.buildKind = null; }
        else if (kind === 'camera-map' && this.screen === 'editor') this.editorMinimap = !this.editorMinimap;
        else if (kind === 'camera-fit') fitCamera(this.camera, level);
        else if (kind === 'camera-in' || kind === 'camera-out') zoomCamera(this.camera, level, kind === 'camera-in' ? 1.3 : 1 / 1.3);
        else if (kind === 'minimap') this.jumpMap(this.pressPoint.x, this.pressPoint.y);
        this.hoverVisible = false;
    }
    persist() {
        if (this.run && !this.testing && ['build', 'wave'].includes(this.run.phase)) this.resume = { index: this.levelIndex, state: this.run.phase === 'build' ? this.run.snapshot() : clone(this.run.checkpoint) };
        const data = { version: 1, stars: this.progress.stars.slice(), muted: this.muted, custom: clone(this.custom), draft: this.editor ? clone(this.editor.level) : null, resume: clone(this.resume) };
        this.saveTail = this.saveTail.catch(() => {}).then(() => this.options.saveGame?.(data)).catch(() => { if (!this.closed) { this.notice = 'Save failed. Keep this game open and try again.'; this.draw(); } });
        return this.saveTail;
    }
    sound(kind) {
        if (this.muted || this.voices.length >= 8 || this.clock - (this.lastSound[kind] ?? -100) < (kind === 'shot' ? .13 : .1)) return;
        this.lastSound[kind] = this.clock;
        const node = new GameNode.Asset({ coordinates2d: HIDDEN, assetInfo: { [kind]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } } });
        this.voices.push({ node, until: this.clock + (kind === 'win' ? 1.6 : .7) }); this.audioRoot.node.children = this.voices.map(v => v.node);
    }
    start(level, index = -1, testing = false) {
        this.run = new Defense(level); this.levelIndex = index; this.testing = testing; this.screen = 'play'; this.resultRecorded = false;
        this.playCamera = createCamera(level); this.cameraPan = false; this.panDrag = null; this.hoverVisible = false;
        this.selected = null; this.buildKind = null; this.hover = { x: 22, y: 48 }; this.notice = ''; this.persist(); this.draw();
    }
    changeScreen(screen) {
        if (this.run && this.screen === 'play') this.run.paused = true;
        this.finishDrag(); this.persist(); this.screen = screen; this.copyPicker = false; this.draw();
    }
    edit(action) { this.editor.change(action); this.notice = ''; this.persist(); this.draw(); }
    resizeMap(bounds) {
        const l = this.editor.level, f = fieldFor(l);
        if (f.w === bounds.w && f.h === bounds.h) return true;
        const checked = validateLevel({ ...l, bounds }, { draft: true });
        if (checked.error) { this.notice = 'Move the trail and scenery inside the smaller map first.'; this.draw(); return false; }
        this.editor.change(l => { l.bounds = { w: bounds.w, h: bounds.h }; });
        fitCamera(this.editorCamera, this.editor.level); this.cameraPan = false; this.hoverVisible = false;
        this.notice = ''; this.persist(); this.draw(); return true;
    }
    setEditorNumber(field, raw) {
        const spec = NUMBER_FIELDS[field];
        if (!spec || this.screen !== 'editor' || this.editor.tab !== spec.tab) return false;
        const text = String(raw ?? '').trim(), value = Number(text);
        if (!text || !Number.isFinite(value) || value < spec.min || value > spec.max || spec.integer && !Number.isInteger(value)) {
            this.notice = `${field.toUpperCase()}: ${spec.min}–${spec.max}${spec.integer ? ', whole numbers' : ''}.`; this.draw(); return false;
        }
        if (field === 'width' || field === 'height') {
            const f = fieldFor(this.editor.level), bounds = { w: f.w, h: f.h, [field === 'width' ? 'w' : 'h']: value };
            return this.resizeMap(bounds);
        } else this.edit(l => { if (spec.tab === 'waves') l.waves[this.editor.wave][this.editor.group][field] = Math.round(value * 100) / 100; else l[field] = value; });
        return true;
    }
    saveMap(exporting = false) {
        const valid = this.editor.validate(); if (valid.error) { this.notice = valid.error; this.draw(); return false; }
        const at = this.custom.findIndex(l => l.id === valid.level.id);
        const next = this.custom.slice(); if (at < 0) next.push(valid.level); else next[at] = valid.level;
        const error = libraryError(next); if (error) { this.notice = error; this.draw(); return false; }
        if (at < 0) this.custom.push(valid.level); else this.custom[at] = valid.level;
        this.libraryPage = Math.floor((at < 0 ? this.custom.length - 1 : at) / 12);
        this.notice = this.options.saveGame ? 'Map saved.' : 'Map kept in this session.'; this.persist();
        if (this.options.createExport || exporting) this.exportPack(!exporting); this.draw(); return true;
    }
    exportPack(quiet = false) {
        if (!this.options.createExport) { this.notice = 'This host does not provide file exports.'; this.draw(); return; }
        const bytes = encodePack(this.custom);
        this.saveTail = this.saveTail.catch(() => {}).then(() => this.options.createExport('frontier.json', bytes)).then(() => { if (!quiet) this.notice = 'frontier.json is ready in Files. Copies include your maps.'; this.draw(); }).catch(() => { this.notice = 'Export failed. Try EXPORT again.'; this.draw(); });
    }
    importMaps(bytes) {
        const pack = decodePack(bytes); if (pack.error) { this.notice = pack.error; this.draw(); return false; }
        const incoming = pack.levels.map((l, i) => ({ ...l, id: this.newId(i) }));
        const error = libraryError([...this.custom, ...incoming]); if (error) { this.notice = error; this.draw(); return false; }
        this.libraryPage = Math.floor(this.custom.length / 12);
        this.custom.push(...incoming); this.notice = incoming.length + ' map' + (incoming.length > 1 ? 's' : '') + ' imported.'; this.persist(); if (this.options.createExport) this.exportPack(true); this.draw(); return true;
    }
    newId(suffix = 0) { return 'frontier-' + Date.now().toString(36) + '-' + (this.nextMapId = (this.nextMapId || 0) + 1) + '-' + suffix; }
    openEditor(level, fresh = false) {
        this.editor = new Editor(level); if (fresh) this.editor.level.id = this.newId();
        this.editorCamera = createCamera(level); this.cameraPan = false;
        this.screen = 'editor'; this.testing = false; this.notice = ''; this.persist(); this.draw();
    }
    action(id) {
        const [kind, value] = id.split(':');
        if (kind.startsWith('camera-') || kind === 'minimap') this.cameraAction(kind);
        else if (id === 'sound') { this.muted = !this.muted; this.voices = []; this.audioRoot.node.children = []; this.persist(); }
        else if (id === 'home') this.changeScreen('home');
        else if (id === 'library') this.changeScreen('library');
        else if (kind === 'library-page' && (value === 'prev' || value === 'next')) this.libraryPage = clamp(this.libraryPage + (value === 'next' ? 1 : -1), 0, Math.max(0, Math.ceil(this.custom.length / 12) - 1));
        else if (id === 'campaign') { this.campaignPage = this.levelIndex >= BASE_COUNT && this.badlandsUnlocked ? 1 : 0; this.changeScreen('campaign'); }
        else if (kind === 'campaign-page' && this.badlandsUnlocked && (value === '0' || value === '1')) this.campaignPage = Number(value);
        else if (id === 'badlands' && this.badlandsUnlocked) { this.campaignPage = 1; this.changeScreen('campaign'); }
        else if (id === 'continue') this.start(LEVELS[this.progress.unlocked], this.progress.unlocked);
        else if (id === 'resume' && this.resume) {
            const r = Defense.restore(this.resume.state); if (r) { this.run = r; this.playCamera = createCamera(r.level); this.cameraPan = false; this.levelIndex = this.resume.index; this.testing = false; this.screen = 'play'; this.selected = null; this.buildKind = null; this.resultRecorded = false; }
        } else if (kind === 'level') { const i = Number(value); if (!Number.isInteger(i) || !LEVELS[i] || i >= BASE_COUNT && !this.badlandsUnlocked) return; if (this.copyPicker) this.openEditor(LEVELS[i], true); else if (i <= this.progress.unlocked) this.start(LEVELS[i], i); }
        else if (id === 'copy-campaign') { this.screen = 'campaign'; this.campaignPage = 0; this.copyPicker = true; }
        else if (id === 'new-map') { this.openEditor(blankLevel(), true); this.editor.tab = 'size'; }
        else if (id === 'edit-draft') { this.screen = 'editor'; this.testing = false; }
        else if (kind === 'edit-map') { if (this.custom[Number(value)]) this.openEditor(this.custom[Number(value)]); }
        else if (kind === 'play-map') { if (this.custom[Number(value)]) this.start(this.custom[Number(value)]); }
        else if (kind === 'delete-map') {
            const i = Number(value); if (this.custom[i]) { this.removedMap = this.custom.splice(i, 1)[0]; this.notice = 'Map removed. Undo is available below.'; this.persist(); if (this.options.createExport) this.exportPack(true); }
        }
        else if (id === 'restore-map' && this.removedMap) { const error = libraryError([...this.custom, this.removedMap]); if (error) this.notice = error; else { this.custom.push(this.removedMap); this.removedMap = null; this.libraryPage = Math.floor((this.custom.length - 1) / 12); this.notice = 'Map restored.'; this.persist(); if (this.options.createExport) this.exportPack(true); } }
        else if (id === 'export-pack') this.exportPack();
        else if (this.screen === 'editor') this.editorAction(kind, value);
        else if (this.screen === 'play') this.playAction(kind, value);
        this.draw();
    }
    playAction(kind, value) {
        const e = this.run;
        if (kind === 'back-editor') { this.screen = 'editor'; this.testing = false; this.run = null; return; }
        if (kind === 'retry') { this.start(e.level, this.levelIndex, this.testing); return; }
        if (kind === 'next' && !this.testing && e.phase === 'won' && this.levelIndex >= 0 && this.levelIndex + 1 < LEVELS.length && this.levelIndex + 1 <= this.progress.unlocked) { this.start(LEVELS[this.levelIndex + 1], this.levelIndex + 1); return; }
        if (!['build', 'wave'].includes(e.phase)) return;
        if (kind === 'tower' && e.level.unlocked.includes(value)) { this.buildKind = this.buildKind === value ? null : value; this.selected = null; this.cameraPan = false; }
        else if (kind === 'cancel') { this.buildKind = null; this.selected = null; }
        else if (kind === 'speed') e.speed = e.speed === 1 ? 2 : 1;
        else if (kind === 'wave') { if (e.phase === 'build') e.startWave(); else e.paused = !e.paused; this.persist(); }
        else if (kind === 'upgrade') { if (e.upgrade(this.selected, Number(value))) this.persist(); }
        else if (kind === 'sell') { if (e.sell(this.selected)) { this.selected = null; this.persist(); } }
        else if (kind === 'target') { const t = e.towers.find(t => t.id === this.selected); if (t) { t.target = ['first', 'strong', 'last'][(['first', 'strong', 'last'].indexOf(t.target) + 1) % 3]; this.persist(); } }
    }
    editorAction(kind, value) {
        const ed = this.editor, l = ed.level;
        if (kind === 'tab') { ed.tab = value; this.notice = ''; }
        else if (kind === 'tool') { ed.tool = value; this.cameraPan = false; }
        else if (kind === 'stamp') { ed.stamp = value; ed.tool = 'stamp'; this.cameraPan = false; }
        else if (kind === 'route') ed.route = Number(value);
        else if (kind === 'undo' || kind === 'redo') {
            const before = fieldFor(ed.level); ed[kind](); const after = fieldFor(ed.level);
            if (before.w !== after.w || before.h !== after.h) fitCamera(this.editorCamera, ed.level);
            this.notice = ''; this.persist();
        }
        else if (kind === 'theme' && THEMES[Number(value)]) this.edit(l => { l.theme = Number(value); });
        else if (kind === 'add-route') this.edit(l => { const f = fieldFor(l); l.paths.push([[Math.round(f.x + f.w * .45), 20], [f.x + f.w - 16, 20], [f.x + f.w - 16, f.y + f.h - 8], clone(l.paths[0].at(-1))]); ed.route = 1; });
        else if (kind === 'remove-route') this.edit(l => { l.paths.splice(1); l.waves.forEach(w => w.forEach(g => { g.route = 0; })); ed.route = 0; });
        else if (kind === 'wave-prev') { ed.wave = Math.max(0, ed.wave - 1); ed.group = 0; }
        else if (kind === 'wave-next') { ed.wave = Math.min(l.waves.length - 1, ed.wave + 1); ed.group = 0; }
        else if (kind === 'wave-timeline') ed.timeline = !ed.timeline;
        else if (kind === 'wave-add' && l.waves.length < 24) this.edit(l => { l.waves.splice(ed.wave + 1, 0, clone(l.waves[ed.wave])); ed.wave++; ed.group = 0; });
        else if (kind === 'wave-blank' && l.waves.length < 24) this.edit(l => { l.waves.splice(ed.wave + 1, 0, [group('drifter', 10)]); ed.wave++; ed.group = 0; });
        else if (kind === 'wave-earlier' && ed.wave > 0 || kind === 'wave-later' && ed.wave < l.waves.length - 1) this.edit(l => { const at = ed.wave, next = at + (kind === 'wave-earlier' ? -1 : 1); [l.waves[at], l.waves[next]] = [l.waves[next], l.waves[at]]; ed.wave = next; });
        else if (kind === 'wave-delete' && l.waves.length > 1) this.edit(l => { l.waves.splice(ed.wave, 1); ed.wave = Math.min(ed.wave, l.waves.length - 1); ed.group = 0; });
        else if (kind === 'group') ed.group = Number(value);
        else if (kind === 'group-add' && l.waves[ed.wave].length < 8) this.edit(l => { l.waves[ed.wave].push(group('drifter', 10, .8, 3, 0)); ed.group = l.waves[ed.wave].length - 1; });
        else if (kind === 'group-copy' && l.waves[ed.wave].length < 8) this.edit(l => { l.waves[ed.wave].splice(ed.group + 1, 0, clone(l.waves[ed.wave][ed.group])); ed.group++; });
        else if (kind === 'group-delete' && l.waves[ed.wave].length > 1) this.edit(l => { l.waves[ed.wave].splice(ed.group, 1); ed.group = Math.max(0, ed.group - 1); });
        else if (kind === 'kind-prev' || kind === 'kind-next') this.edit(l => { const g = l.waves[ed.wave][ed.group]; g.kind = ENEMY_ORDER[(ENEMY_ORDER.indexOf(g.kind) + (kind === 'kind-next' ? 1 : 7)) % 8]; });
        else if (kind === 'inc' || kind === 'dec') this.edit(l => { const g = l.waves[ed.wave][ed.group], bounds = { count: [1, 80, 1], gap: [.2, 5, .1], delay: [0, 60, 1], route: [0, l.paths.length - 1, 1] }[value]; if (bounds) g[value] = Math.round(clamp(g[value] + (kind === 'inc' ? 1 : -1) * bounds[2], bounds[0], bounds[1]) * 100) / 100; });
        else if (kind === 'cash-down' || kind === 'cash-up') this.edit(l => { l.cash = clamp(l.cash + (kind === 'cash-up' ? 25 : -25), 70, 3000); });
        else if (kind === 'gold-down' || kind === 'gold-up') this.edit(l => { l.gold = clamp(l.gold + (kind === 'gold-up' ? 5 : -5), 1, 100); });
        else if (kind === 'size-preset' && ed.tab === 'size' && MAP_SIZES[Number(value)]) this.resizeMap(MAP_SIZES[Number(value)]);
        else if ((kind === 'size-grow' || kind === 'size-shrink') && ed.tab === 'size' && ['width', 'height'].includes(value)) {
            const f = fieldFor(l), spec = NUMBER_FIELDS[value], current = value === 'width' ? f.w : f.h;
            this.setEditorNumber(value, clamp(current + (kind === 'size-grow' ? 10 : -10), spec.min, spec.max));
        }
        else if (kind === 'allow' && ORDER.includes(value)) this.edit(l => { if (l.unlocked.includes(value)) { if (l.unlocked.filter(k => k !== value && k !== 'banjo').length) l.unlocked = l.unlocked.filter(k => k !== value); } else l.unlocked.push(value); });
        else if (kind === 'save-map' || kind === 'export-map') this.saveMap(kind === 'export-map');
        else if (kind === 'test') { const valid = ed.validate(); if (valid.error) this.notice = valid.error; else { this.persist(); this.start(valid.level, -1, true); } }
    }
    press(id, x, y) {
        if (!this.owns(id) || this.held || !Number.isFinite(x) || !Number.isFinite(y)) return;
        this.held = true; this.pressPoint = { x, y }; this.pressScreen = this.screen;
        const button = [...this.buttons].reverse().find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
        if (button) { if (button.enabled) { this.action(button.id); this.dragFromCard = button.id.startsWith('tower:'); this.minimapDrag = button.id === 'minimap'; } return; }
        if (!this.mapScreen() || !this.inField(x, y)) return;
        const world = screenToWorld(this.camera, x, y); this.hover = world; this.hoverVisible = true;
        const beginPan = () => { this.panDrag = { x, y, cx: this.camera.x, cy: this.camera.y, moved: false }; };
        if (this.cameraPan || this.keys.has('Shift')) beginPan();
        else if (this.screen === 'play' && ['build', 'wave'].includes(this.run.phase)) {
            const tower = this.run.towers.find(t => Math.hypot(t.x - world.x, t.y - 2 - world.y) < Math.max(4, 2.8 / this.camera.zoom));
            if (tower && !this.buildKind) { this.selected = tower.id; }
            else if (this.buildKind) { this.placeAt(world.x, world.y); this.placedOnPress = true; }
            else this.selected = null;
            if (!this.placedOnPress) beginPan();
        } else if (this.screen === 'editor') {
            const f = fieldFor(this.editor.level);
            if (world.x >= f.x && world.x <= f.x + f.w - 3 && world.y >= f.y + 2 && world.y <= f.y + f.h - 2) this.editorPress(world.x, world.y);
            if (!this.drag && this.editor.tab === 'trail' && this.editor.tool === 'move') beginPan();
        }
        this.draw();
    }
    placeAt(x, y) {
        const result = this.run.place(this.buildKind, x, y);
        if (result.tower) { this.selected = result.tower.id; this.buildKind = null; this.persist(); }
        else { this.invalid = { x, y, until: this.clock + .7 }; this.sound('rope'); }
    }
    editorPress(x, y) {
        const ed = this.editor, l = ed.level;
        if (ed.tab === 'trail') {
            const path = l.paths[ed.route], index = path.findIndex(p => Math.hypot(p[0] - x, p[1] - y) < 3.2 / this.camera.zoom);
            if (ed.tool === 'erase') { if (index > 0 && index < path.length - 1 && path.length > 2) this.edit(() => path.splice(index, 1)); }
            else if (ed.tool === 'add') { if (path.length < 24 && !path.some(p => Math.hypot(p[0] - x, p[1] - y) < 3)) this.edit(() => path.splice(path.length - 1, 0, [Math.round(x), Math.round(y)])); }
            else if (index >= 0) { ed.checkpoint(); this.drag = { route: ed.route, index, endpoint: index === path.length - 1 }; }
        } else if (ed.tab === 'scenery') {
            if (ed.tool === 'erase') { const i = l.decor.findIndex(d => Math.hypot(d.x - x, d.y - 2 - y) < 4); if (i >= 0) this.edit(l => l.decor.splice(i, 1)); }
            else if (l.decor.length < 60) this.edit(l => l.decor.push({ kind: ed.stamp, x: Math.round(x), y: Math.round(y) }));
        }
    }
    move(id, x, y) {
        if (!this.owns(id) || !this.held || !Number.isFinite(x) || !Number.isFinite(y)) return;
        if (this.pressScreen !== this.screen) return;
        if (this.minimapDrag) { this.jumpMap(x, y); this.draw(); return; }
        if (this.panDrag) {
            const drag = this.panDrag;
            if (drag.moved || Math.hypot(x - drag.x, y - drag.y) > 1.5) {
                drag.moved = true; this.camera.x = drag.cx - (x - drag.x) / this.camera.zoom; this.camera.y = drag.cy - (y - drag.y) / this.camera.zoom;
                clampCamera(this.camera, this.navigationLevel()); this.hoverVisible = false;
            }
            this.draw(); return;
        }
        const world = screenToWorld(this.camera, x, y); this.hover = world; this.hoverVisible = this.inField(x, y);
        if (this.drag && this.screen === 'editor') {
            const l = this.editor.level, f = fieldFor(l), p = [clamp(Math.round(world.x), f.x, f.x + f.w - 3), clamp(Math.round(world.y), f.y + 2, f.y + f.h - 2)];
            if (this.drag.endpoint) l.paths.forEach(path => { path[path.length - 1] = p.slice(); });
            else l.paths[this.drag.route][this.drag.index] = p;
        }
        this.draw();
    }
    finishDrag() { this.panDrag = null; this.minimapDrag = false; if (this.drag) { this.editor.revision++; this.drag = null; this.persist(); } }
    release(id, x, y) {
        if (!this.owns(id)) return;
        if (this.held && this.dragFromCard && !this.placedOnPress && this.screen === 'play' && this.buildKind && Number.isFinite(x) && Number.isFinite(y) && this.inField(x, y) && !this.buttons.some(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)) { const world = screenToWorld(this.camera, x, y); this.placeAt(world.x, world.y); }
        this.held = false; this.dragFromCard = false; this.placedOnPress = false; this.finishDrag(); this.draw();
    }
    handleMouseUp(id, data) { this.release(id, data?.x * 1.6, data?.y); }
    handleKeyDown(id, key) {
        if (!this.owns(id) || typeof key !== 'string' || this.keys.has(key)) return; this.keys.add(key);
        if (this.mapScreen()) {
            if (key === '+' || key === '=') this.action('camera-in');
            if (key === '-' || key === '_') this.action('camera-out');
            if (key === '0') this.action('camera-fit');
        }
        if (key === 'Escape') { this.buildKind = null; this.selected = null; if (this.screen === 'play' && this.run.phase === 'wave') this.run.paused = !this.run.paused; this.draw(); }
        if (this.screen === 'play') { if (key === ' ' || key === 'Enter') this.action('wave'); if (key.toLowerCase() === 'f') this.action('speed'); if (/^[1-6]$/.test(key)) this.action('tower:' + ORDER[Number(key) - 1]); }
        if (this.screen === 'editor') { if (key.toLowerCase() === 'z') this.action('undo'); if (key.toLowerCase() === 'y') this.action('redo'); }
    }
    handleKeyUp(id, key) { if (this.owns(id)) this.keys.delete(key); }
    tick() {
        this.clock += 1 / 30;
        if (this.owner !== null && this.mapScreen() && !this.drag && !this.panDrag) {
            const down = (...keys) => keys.some(k => this.keys.has(k));
            const dx = Number(down('ArrowRight', 'd', 'D')) - Number(down('ArrowLeft', 'a', 'A')), dy = Number(down('ArrowDown', 's', 'S')) - Number(down('ArrowUp', 'w', 'W'));
            if (dx || dy) { panCamera(this.camera, this.navigationLevel(), dx * 1.8 / this.camera.zoom, dy * 1.8 / this.camera.zoom); this.hoverVisible = false; }
        }
        this.voices = this.voices.filter(v => v.until > this.clock); this.audioRoot.node.children = this.voices.map(v => v.node);
        if (this.screen === 'play' && this.owner !== null) {
            const phase = this.run.phase; this.run.tick(1 / 30);
            for (const sound of this.run.events.splice(0)) this.sound(sound);
            if (phase !== this.run.phase) {
                if (this.run.phase === 'won' && !this.testing && !this.resultRecorded) {
                    this.resultRecorded = true;
                    if (this.levelIndex >= 0) { this.progress.stars[this.levelIndex] = Math.max(this.progress.stars[this.levelIndex], this.run.stars()); this.progress.unlocked = unlockedIndex(this.progress.stars); }
                    this.resume = null;
                } else if (this.run.phase === 'lost' && !this.testing) this.resume = { index: this.levelIndex, state: clone(this.run.checkpoint) };
                this.persist();
            }
        }
        this.draw();
    }
    close() { if (this.closed) return; this.persist(); this.closed = true; this.voices = []; this.audioRoot.node.children = []; super.close(); }
}
module.exports = GoldAndGrit;
