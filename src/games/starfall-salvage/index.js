const { Game, GameNode, Shapes, ShapeUtils } = require('squish-145');
const { Salvage } = require('./engine');
const { SalvageScene } = require('./scene');
const { SalvageAudio } = require('./audio');
const { SECTORS, MODULES, CREW, MISSIONS, CONTRACTS, SUPPLIES } = require('./content');

const C = { ink: [12, 19, 40, 255], panel: [16, 27, 49, 250], raised: [30, 45, 67, 255], line: [53, 75, 91, 255],
    cream: [244, 240, 216, 255], mint: [103, 233, 210, 255], coral: [255, 139, 107, 255], lavender: [163, 152, 246, 255],
    muted: [149, 177, 188, 255], gold: [255, 213, 120, 255], red: [244, 91, 117, 255] };
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ring = (x, y, rx, ry, n = 12) => Array.from({ length: n }, (_, i) => [x + Math.cos(i * Math.PI * 2 / n) * rx, y + Math.sin(i * Math.PI * 2 / n) * ry]);
const SLOTS = ['weapon', 'port', 'starboard', 'drive', 'hull'];
const SLOT_NAMES = { weapon: 'WEAPONS', port: 'PORT', starboard: 'STARBOARD', drive: 'ENGINES', hull: 'HULLS' };

class StarfallSalvage extends Game {
    static metadata() {
        return { name: 'STARFALL SALVAGE', author: 'Joseph Garcia', squishVersion: '145',
            description: 'Make a home out of the end of the world. Build a visibly modular salvage ship, explore six brilliant sectors, board haunted wrecks, find your crew, and decide the fate of a living moon. A complete single-player space adventure.',
            aspectRatio: { x: 16, y: 10 }, tickRate: 20, maxPlayers: 1, assets: {},
            gamepadBindings: { w: ['DIRECTION_UP', 'STICK_1_UP'], s: ['DIRECTION_DOWN', 'STICK_1_DOWN'], a: ['DIRECTION_LEFT', 'STICK_1_LEFT'], d: ['DIRECTION_RIGHT', 'STICK_1_RIGHT'],
                ' ': 'FACE_1', e: 'FACE_2', x: 'FACE_3', q: 'FACE_4', f: 'LEFT_SHOULDER', v: 'RIGHT_SHOULDER', c: 'START', m: 'SELECT' } };
    }
    constructor({ saveGame, saveData, addAsset } = {}) {
        super(); this.saveGame = saveGame; this.engine = new Salvage(saveData); this.owner = null;
        this.keys = new Set(); this.pressed = new Set(); this.touch = { x: 0, y: 0 }; this.fire = false; this.aimScreen = null;
        this.menu = null; this.outfitSlot = 'weapon'; this.selectedModule = null; this.selectedSector = this.engine.sector;
        this.journalPage = 0; this.dialogueChoice = 0; this.soundEnabled = true; this.saveClock = 0; this.waypoint = null;
        this.base = this.rect(0, 0, 100, 100, C.ink); this.world = this.group(this.base); this.ui = this.group(this.base); this.overlay = this.group(this.base); this.audioRoot = this.group(this.base);
        this.scene = new SalvageScene(this.world); this.audio = new SalvageAudio(this.audioRoot, addAsset);
        this.buttons = []; this.hud = {}; this.rebuild(); this.draw();
    }
    getLayers() { return [{ root: this.base }]; }
    getAssets() { return this.audio.assets; }
    group(parent) { const node = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: [[0, 0], [0, 0], [0, 0]] }); if (parent) parent.addChild(node, false); return node; }
    rect(x, y, w, h, fill, options = {}) { return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(x, y, w, h), fill, color: fill, ...options }); }
    box(parent, x, y, w, h, fill, options = {}) { const node = this.rect(x, y, w, h, fill, options); parent.addChild(node, false); return node; }
    poly(parent, points, fill) { const node = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: [...points, points[0]], fill, color: fill }); parent.addChild(node, false); return node; }
    text(parent, text, x, y, size = 1.15, color = C.cream, align = 'left', font = 'sans-serif') {
        const node = new GameNode.Text({ textInfo: { text: String(text).slice(0, 124), x, y, size, color, align, font } }); parent.addChild(node, false); return node;
    }
    set(node, text) { if (node) node.node.text = { ...node.node.text, text: String(text).slice(0, 124) }; }
    lines(parent, text, x, y, width = 40, size = 1.25, color = C.muted, maxLines = 8) {
        const count = Math.floor(width / (size * .59)), words = String(text || '').split(/\s+/); let row = 0, line = '';
        for (const word of words) {
            if (line && (line + ' ' + word).length > count) { this.text(parent, line, x, y + row++ * size * 2.12, size, color); line = ''; if (row >= maxLines) return row; }
            line += (line ? ' ' : '') + word;
        }
        if (line) this.text(parent, line, x, y + row++ * size * 2.12, size, color); return row;
    }
    button(parent, label, x, y, w, h, action, options = {}) {
        const fill = options.disabled ? [28, 38, 53, 255] : options.fill || C.raised;
        const node = this.box(parent, x, y, w, h, fill, { onClick: (id, px, py) => { if (id === this.owner && !options.disabled) action?.(px, py); }, offClick: options.release ? id => { if (id === this.owner) options.release(); } : undefined });
        if (options.active) this.box(node, x, y, .28, h, options.accent || C.mint);
        const size = options.size || 1.04;
        this.text(node, label, options.align === 'left' ? x + 1.6 : x + w / 2, y + (h - size * 1.6) / 2 - .15, size, options.disabled ? C.muted : options.ink || C.cream, options.align === 'left' ? 'left' : 'center');
        this.buttons.push({ label, x, y, w, h, node }); return node;
    }
    rule(parent, x, y, w, color = C.line) { this.box(parent, x, y, w, .12, color); }
    handleNewPlayer({ playerId }) { if (this.owner !== null && this.owner !== playerId) return; this.owner = playerId; this.audio.register(); this.rebuild(); this.draw(); }
    handlePlayerDisconnect(id) { if (id !== this.owner) return; this.persist(); this.owner = null; this.clearInput(); this.pressed.clear(); this.audio.silence(); this.base.node.onStateChange(); }
    clearInput() { this.keys.clear(); this.fire = false; this.aimScreen = null; this.touch = { x: 0, y: 0 }; }
    start(id = this.owner) { if (id !== this.owner || this.owner === null) return; this.engine.begin(); this.menu = null; this.clearInput(); this.persist(); this.rebuild(); this.draw(); }
    openMenu(name) {
        if (this.engine.phase === 'title') return;
        if (this.menu === name) { this.closeMenu(); return; }
        this.menu = name; this.clearInput(); this.audio.silence();
        if (name === 'chart') this.selectedSector = this.engine.sector;
        if (name === 'outfit' && !this.selectedModule) this.selectedModule = this.engine.loadout.weapon;
        this.rebuild(); this.draw();
    }
    closeMenu() {
        this.menu = null; this.engine.closeDialogue(); this.clearInput();
        if (this.engine.phase === 'ending') { this.engine.begin(); this.persist(); }
        this.rebuild(); this.draw();
    }
    dialogueMenu() { return this.engine.dialogue ? this.engine.dialogue.kind === 'dock' ? 'dock' : 'dialogue' : null; }
    interact() {
        if (this.menu || this.engine.phase !== 'play') return;
        const oldMode = this.engine.mode; this.engine.interact(); this.menu = this.dialogueMenu(); this.dialogueChoice = 0;
        if (this.menu || oldMode !== this.engine.mode) { this.clearInput(); this.audio.silence(); this.waypoint = null; }
        this.persistIfDirty(); this.rebuild(); this.draw();
    }
    choose(id) { this.engine.choose(id); this.menu = this.dialogueMenu(); this.dialogueChoice = 0; this.clearInput(); this.persistIfDirty(); this.rebuild(); this.draw(); }
    selectModule(id) { this.selectedModule = id; this.rebuild(); this.draw(); }
    purchase(id) { this.engine.buy(id); this.persistIfDirty(); this.rebuild(); this.draw(); }
    equip(id) { this.engine.equip(id); this.persistIfDirty(); this.rebuild(); this.draw(); }
    travel(index) {
        const before = this.engine.sector; this.engine.travel(index);
        if (this.engine.sector !== before) { this.menu = null; this.engine.closeDialogue(); this.waypoint = null; this.clearInput(); }
        this.persistIfDirty(); this.rebuild(); this.draw();
    }
    act(name) { if (this.menu || this.engine.phase !== 'play') return; if (typeof this.engine[name] === 'function') this.engine[name](); this.persistIfDirty(); this.draw(); }
    handleKeyDown(id, raw) {
        if (id !== this.owner || typeof raw !== 'string') return;
        const key = raw.length === 1 ? raw.toLowerCase() : raw, repeat = this.pressed.has(key); this.pressed.add(key); this.keys.add(key);
        if (repeat) return;
        if (this.engine.phase === 'title') { if (key === ' ' || key === 'Enter') this.start(id); return; }
        if (this.engine.phase === 'ending' && ['c', 'Enter', ' ', 'Escape'].includes(key)) { this.closeMenu(); return; }
        if (key === 'c' || key === 'Escape') { if (this.menu) this.closeMenu(); else this.openMenu('pause'); return; }
        if (key === 'm') { this.openMenu('chart'); return; }
        if (key === 'i') { this.openMenu('outfit'); return; }
        if (key === 'j') { this.openMenu('journal'); return; }
        if (key === '?') { this.openMenu('help'); return; }
        if (this.menu) { this.menuKey(key); return; }
        if (key === 'e') this.interact(); else if (key === 'x') this.act('dash'); else if (key === 'q') this.act('pulse'); else if (key === 'f') this.act('heal');
    }
    handleKeyUp(id, raw) { if (id === this.owner && typeof raw === 'string') { const key = raw.length === 1 ? raw.toLowerCase() : raw; this.keys.delete(key); this.pressed.delete(key); } }
    dialogueChoices() {
        const choices = [...(this.engine.dialogue?.choices || [])];
        if (this.engine.dialogue?.kind === 'dock') choices.unshift({ id: '__outfit', label: 'OUTFIT THE KESTREL' }, { id: '__supplies', label: 'STOCK REPAIR KITS & CRYSTALS' });
        return choices;
    }
    chooseScreenChoice(index) {
        const choice = this.dialogueChoices()[index]; if (!choice) return;
        if (choice.id === '__outfit') this.openMenu('outfit'); else if (choice.id === '__supplies') this.openMenu('supplies'); else this.choose(choice.id);
    }
    menuKey(key) {
        const next = ['s', 'ArrowDown'].includes(key), prev = ['w', 'ArrowUp'].includes(key), confirm = ['e', 'Enter', ' '].includes(key);
        if (this.menu === 'dialogue' || this.menu === 'dock') {
            const choices = this.dialogueChoices();
            if (/^[1-8]$/.test(key)) { this.chooseScreenChoice(Number(key) - 1); return; }
            if (confirm) { this.chooseScreenChoice(this.dialogueChoice); return; }
            if (next || prev) this.dialogueChoice = clamp(this.dialogueChoice + (next ? 1 : -1), 0, choices.length - 1);
            else return;
        } else if (this.menu === 'outfit') {
            if (['a', 'ArrowLeft', 'd', 'ArrowRight'].includes(key)) {
                this.outfitSlot = SLOTS[(SLOTS.indexOf(this.outfitSlot) + (['a', 'ArrowLeft'].includes(key) ? 4 : 1)) % SLOTS.length]; this.selectedModule = this.engine.loadout[this.outfitSlot];
            } else if (next || prev) {
                const modules = MODULES.filter(m => m.slot === this.outfitSlot), index = Math.max(0, modules.findIndex(m => m.id === this.selectedModule));
                this.selectedModule = modules[(index + (next ? 1 : modules.length - 1)) % modules.length].id;
            } else if (confirm) { if (this.engine.owned.includes(this.selectedModule)) this.equip(this.selectedModule); else this.purchase(this.selectedModule); return; }
            else return;
        } else if (this.menu === 'supplies') {
            if (next || prev) this.selectedSupply = this.selectedSupply === 1 ? 0 : 1;
            else if (/^[12]$/.test(key)) { this.purchase(SUPPLIES[Number(key) - 1].id); return; }
            else if (confirm) { this.purchase(SUPPLIES[this.selectedSupply || 0].id); return; }
            else return;
        } else if (this.menu === 'chart') {
            if (/^[1-6]$/.test(key)) this.selectedSector = Number(key) - 1;
            else if (next || prev) this.selectedSector = (this.selectedSector + (next ? 1 : SECTORS.length - 1)) % SECTORS.length;
            else if (confirm) { if (this.selectedSector === this.engine.sector) this.closeMenu(); else this.travel(this.selectedSector); return; }
            else return;
        } else return;
        this.rebuild(); this.draw();
    }
    worldPress(x, y) { if (this.menu || this.engine.phase !== 'play') return; this.fire = true; this.aimScreen = { x, y }; }
    handleMouseMove(id, { x, y }) { if (id === this.owner && this.fire && !this.menu && y > 12 && y < 89) this.aimScreen = { x, y }; }
    handleMouseUp(id) { if (id === this.owner) { this.fire = false; this.aimScreen = null; this.touch = { x: 0, y: 0 }; } }
    pointerAim(x, y) {
        let target = null, best = 3.7;
        for (const enemy of this.engine.enemies) { if (enemy.hp <= 0) continue; const q = this.scene.project(enemy.x, enemy.y), d = Math.hypot(q[0] - x, (q[1] - y) / 1.6); if (d < best) { target = enemy; best = d; } }
        return target ? { x: target.x, y: target.y } : this.scene.unproject(x, y);
    }
    persist() {
        if (!this.saveGame || this.engine.phase === 'title') return;
        try { const result = this.saveGame(this.engine.serialize()); this.engine.dirty = false; result?.catch(() => { if (!this.closed) { this.saveError = 'Save unavailable. Keep this voyage open.'; this.draw(); } }); }
        catch (_) { this.saveError = 'Save unavailable. Keep this voyage open.'; }
    }
    persistIfDirty() { if (this.engine.dirty) this.persist(); }
    tick() {
        if (this.closed || this.owner === null || this.engine.phase === 'title') return;
        const e = this.engine;
        if (this.menu || e.phase === 'ending') { if (this.audio.tick(e.events, .05, this.soundEnabled, false)) this.base.node.onStateChange(); return; }
        const before = `${e.phase}|${e.mode}|${e.sector}`, dialogue = e.dialogue;
        const x = (this.keys.has('d') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('a') || this.keys.has('ArrowLeft') ? 1 : 0) + this.touch.x;
        const y = (this.keys.has('s') || this.keys.has('ArrowDown') ? 1 : 0) - (this.keys.has('w') || this.keys.has('ArrowUp') ? 1 : 0) + this.touch.y;
        e.tick(.05, { x, y, fire: this.fire || this.keys.has(' '), aim: this.fire && this.aimScreen ? this.pointerAim(this.aimScreen.x, this.aimScreen.y) : null, boost: this.keys.has('v') });
        this.audio.tick(e.events, .05, this.soundEnabled, true, e.enemies.some(enemy => enemy.hp > 0 && distance(enemy, e.player) < 55));
        this.saveClock += .05;
        if (e.dialogue && e.dialogue !== dialogue) { this.menu = this.dialogueMenu(); this.clearInput(); this.rebuild(); }
        if (`${e.phase}|${e.mode}|${e.sector}` !== before) { this.clearInput(); this.waypoint = null; this.rebuild(); }
        if (e.dirty || this.saveClock >= 15) { this.persist(); this.saveClock = 0; }
        this.draw();
    }
    rebuild() {
        this.ui.clearChildren(); this.overlay.clearChildren(); this.buttons = []; this.hud = {};
        if (this.engine.phase === 'title') this.title();
        else { this.playHud(); if (this.engine.phase === 'ending') this.ending(); else if (this.menu) this.menuView(); }
    }
    draw() { this.scene.render(this.engine, this.engine.phase === 'title'); if (this.engine.phase !== 'title') this.updateHud(); this.base.node.onStateChange(); }
    title() {
        const r = this.ui;
        this.box(r, 4, 9, 47, 81, [12, 22, 41, 242]); this.box(r, 4, 9, .4, 81, C.mint);
        this.text(r, 'A LITTLE SHIP. A VERY BIG TOMORROW.', 8, 14, .92, C.mint);
        this.text(r, 'STARFALL', 7.6, 23, 5.45, C.cream, 'left', 'Georgia');
        this.text(r, 'S A L V A G E', 8.3, 34, 2.35, C.coral);
        this.rule(r, 8, 43, 38);
        this.lines(r, 'The moon broke. We kept the pieces.', 8, 47, 37, 1.65, C.cream, 2);
        this.lines(r, 'Build a ship from the wreckage. Find a crew in the quiet. Bring something worth saving home.', 8, 55, 36, 1.15, C.muted, 4);
        this.button(r, this.engine.hasSave ? 'CONTINUE VOYAGE' : 'LAUNCH THE KESTREL', 8, 70, 38, 8.2, () => this.start(), { fill: C.mint, ink: C.ink, size: 1.16 });
        this.text(r, 'WASD fly   SPACE fire   E dock / board', 8, 82, .94, C.cream);
        this.text(r, 'SINGLE PLAYER  /  SAVES AUTOMATICALLY', 8, 86, .72, C.muted);
        this.text(r, 'KESTREL / SALVAGE CLASS', 94, 6, .85, C.mint, 'right');
        this.text(r, 'NOT EVERYTHING BROKEN IS LOST.', 95, 94, 1.05, C.cream, 'right');
    }
    playHud() {
        const r = this.ui;
        this.box(r, 0, 12, 100, 77, [0, 0, 0, 0], { onClick: (id, x, y) => { if (id === this.owner) this.worldPress(x, y); }, offClick: id => this.handleMouseUp(id) });
        this.box(r, 0, 0, 100, 11.8, C.panel); this.rule(r, 0, 11.7, 100, C.mint);
        this.text(r, 'STARFALL', 2.3, 1.3, 1.8, C.cream, 'left', 'Georgia');
        this.hud.region = this.text(r, '', 2.4, 6.4, .8, C.mint);
        this.hud.objective = this.text(r, '', 21.5, 1.9, 1.12, C.gold);
        this.hud.progress = this.text(r, '', 21.5, 6.6, .87, C.muted);
        this.button(r, 'M  CHART', 68, 2.1, 9.3, 7.4, () => this.openMenu('chart'), { size: .94 });
        this.button(r, 'I  SHIP', 78.2, 2.1, 9.3, 7.4, () => this.openMenu('outfit'), { size: .94 });
        this.button(r, 'J  LOG', 88.4, 2.1, 9.3, 7.4, () => this.openMenu('journal'), { size: .94 });
        this.hud.message = this.text(r, '', 50, 14.3, 1.1, C.cream, 'center');
        this.hud.systems = this.text(r, '', 97, 19, .74, C.muted, 'right');
        this.hud.beacon = this.poly(r, [[0, 0], [0, 0], [0, 0]], C.gold);
        this.hud.beaconText = this.text(r, '', 50, 20, .82, C.gold, 'center');
        this.hud.hintBg = this.box(r, 23, 81.8, 53, 5.4, [12, 22, 41, 224]);
        this.hud.hint = this.text(r, '', 49.5, 83.2, .98, C.cream, 'center');
        this.box(r, 0, 89, 100, 11, C.panel); this.rule(r, 0, 89, 100);
        const arrows = [['^', 8.1, 79.2, 0, -1], ['<', 2.1, 85.8, -1, 0], ['v', 8.1, 85.8, 0, 1], ['>', 14.1, 85.8, 1, 0]];
        for (const [label, x, y, dx, dy] of arrows) this.button(r, label, x, y, 5.4, 6.2, () => { if (!this.menu) this.touch = { x: dx, y: dy }; }, { size: 1.3, release: () => { this.touch = { x: 0, y: 0 }; } });
        this.text(r, 'W / A / S / D', 10.8, 95.1, .72, C.muted, 'center');
        this.hud.status = this.text(r, '', 22.5, 90.7, .85, C.cream);
        this.hud.resources = this.text(r, '', 47.3, 92.8, .72, C.gold, 'right');
        this.box(r, 22.5, 95.1, 10.8, .85, C.line); this.hud.health = this.box(r, 22.5, 95.1, 10.8, .85, C.coral);
        this.box(r, 34.3, 95.1, 6.4, .85, C.line); this.hud.shield = this.box(r, 34.3, 95.1, 6.4, .85, C.mint);
        this.box(r, 41.7, 95.1, 5.6, .85, C.line); this.hud.energy = this.box(r, 41.7, 95.1, 5.6, .85, C.lavender);
        this.hud.meters = this.text(r, '', 22.5, 97, .65, C.muted);
        this.button(r, 'SPACE  FIRE', 49.2, 91.1, 12.8, 7, () => { if (!this.menu) { this.fire = true; this.aimScreen = null; } }, { fill: [126, 64, 71, 255], size: .89, release: () => { this.fire = false; this.aimScreen = null; } });
        this.button(r, 'E  INTERACT', 63, 91.1, 13.5, 7, () => this.interact(), { size: .88 });
        this.button(r, 'X  DASH', 77.5, 91.1, 10.6, 7, () => this.act('dash'), { size: .88 });
        this.button(r, 'MORE', 89.1, 91.1, 8.6, 7, () => this.openMenu('actions'), { size: .88 });
    }
    updateHud() {
        const e = this.engine, space = e.mode === 'space', p = e.player, o = e.objective(), inventory = e.inventory;
        this.set(this.hud.region, (space ? e.world.name : e.interior?.name || 'AWAY TEAM').toUpperCase().slice(0, 26));
        this.set(this.hud.objective, (o.title || 'OPEN SKIES').toUpperCase().slice(0, 52));
        this.set(this.hud.progress, (o.progress || o.text || '').slice(0, 62));
        this.set(this.hud.message, this.saveError || (e.time < e.messageUntil ? e.message : ''));
        this.set(this.hud.systems, space ? `HEAT ${Math.round(p.heat)}%  /  BOOST ${Math.round(p.boost)}%  /  ${inventory.medkits} KITS` : `CUTTER READY  /  ${inventory.medkits} MEDICAL KITS`);
        const hint = e.hint?.() || (space ? 'SPACE fire  /  E dock or board  /  V boost' : 'SPACE fire  /  E use terminal  /  X dash');
        this.set(this.hud.hint, ((/^(Dock|Board|Inspect|Return|Open)/i.test(hint) ? 'E  /  ' : '') + hint).slice(0, 80));
        const hull = space ? p.hull : p.hp, maxHull = space ? p.maxHull : p.maxHp;
        this.set(this.hud.status, `${space ? 'KESTREL' : 'AWAY TEAM'}  ${Math.ceil(hull)} / ${maxHull}`);
        this.set(this.hud.resources, `${Math.floor(inventory.credits)} CR   ${Math.floor(inventory.scrap)} SCR   ${Math.floor(inventory.crystal)} GEM`);
        this.hud.health.node.coordinates2d = ShapeUtils.rectangle(22.5, 95.1, 10.8 * clamp(hull / maxHull, 0, 1), .85);
        this.hud.shield.node.coordinates2d = ShapeUtils.rectangle(34.3, 95.1, 6.4 * clamp(space ? p.shield / Math.max(1, p.maxShield) : p.oxygen / 100, 0, 1), .85);
        this.hud.energy.node.coordinates2d = ShapeUtils.rectangle(41.7, 95.1, 5.6 * clamp(space ? p.energy / 100 : 1 - (p.dash || 0), 0, 1), .85);
        this.set(this.hud.meters, space ? `HULL                SHIELD ${Math.ceil(p.shield)}           ENERGY ${Math.floor(p.energy)}` : `SUIT                OXYGEN ${Math.ceil(p.oxygen)}%         ${inventory.medkits} KITS`);
        const target = this.waypoint && this.waypoint.sector === e.sector && space ? this.waypoint : o;
        const valid = Number.isFinite(target.x) && Number.isFinite(target.y) && (target.sector === undefined || target.sector === e.sector);
        if (this.waypoint && distance(p, this.waypoint) < 8) this.waypoint = null;
        if (valid && distance(p, target) > (space ? 15 : 5)) {
            const point = this.scene.project(target.x, target.y), dx = point[0] - 50, dy = point[1] - 52;
            const factor = Math.min(1, 39 / Math.max(1, Math.abs(dx)), 28 / Math.max(1, Math.abs(dy))), x = 50 + dx * factor, y = 52 + dy * factor;
            const a = Math.atan2(dy / 1.6, dx), v = (r, angle) => [x + Math.cos(angle) * r, y + Math.sin(angle) * r * 1.6];
            this.hud.beacon.node.coordinates2d = [v(1.4, a), v(1, a + 2.3), v(.35, a + Math.PI), v(1, a - 2.3), v(1.4, a)];
            this.hud.beaconText.node.text = { ...this.hud.beaconText.node.text, x: clamp(x, 9, 91), y: clamp(y + 2.5, 20, 79), text: `${Math.round(distance(p, target))}m` };
        } else { this.hud.beacon.node.coordinates2d = [[0, 0], [0, 0], [0, 0]]; this.set(this.hud.beaconText, ''); }
    }
    panel(title, eyebrow = 'KESTREL / SHIP SYSTEMS') {
        const r = this.overlay;
        this.box(r, 0, 0, 100, 100, [5, 12, 28, 202], { onClick: () => {} });
        this.box(r, 5, 13, 90, 76, C.panel); this.box(r, 5, 13, .32, 76, C.mint);
        this.text(r, eyebrow, 8, 16, .72, C.mint);
        this.text(r, title, 8, 20, 2.35, C.cream, 'left', 'Georgia');
        this.button(r, 'C  CLOSE', 81, 16, 11, 6.5, () => this.closeMenu(), { size: .85 });
        this.rule(r, 8, 26.7, 84); return r;
    }
    menuView() {
        if (this.menu === 'chart') this.chart();
        else if (this.menu === 'outfit') this.outfit();
        else if (this.menu === 'supplies') this.supplies();
        else if (this.menu === 'journal') this.journal();
        else if (this.menu === 'crew') this.crewView();
        else if (this.menu === 'crew-detail') this.crewDetail();
        else if (this.menu === 'dialogue' || this.menu === 'dock') this.dialogueView();
        else if (this.menu === 'help') this.help();
        else if (this.menu === 'actions') this.actions();
        else this.pause();
    }
    chart() {
        const e = this.engine, r = this.panel('THE SHATTERED REACH', 'NAVIGATION / SIX PLACES WORTH COMING HOME TO'), unlocked = e.unlockedSectors();
        const positions = [[16, 40], [33, 32], [50, 43], [17, 66], [35, 75], [51, 64]];
        this.box(r, 8, 29, 49, 54, [10, 19, 38, 255]);
        const line = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1, w = .085; this.poly(r, [[a[0] - dy / n * w, a[1] + dx / n * w], [b[0] - dy / n * w, b[1] + dx / n * w], [b[0] + dy / n * w, b[1] - dx / n * w], [a[0] + dy / n * w, a[1] - dx / n * w]], C.line); };
        for (let i = 0; i < positions.length - 1; i++) line(positions[i], positions[i + 1]); line(positions[0], positions[3]); line(positions[1], positions[4]);
        for (let i = 0; i < 31; i++) { const x = 9 + ((i * 17.17) % 47), y = 30 + ((i * 11.13) % 51); this.box(r, x, y, .12, .19, i % 3 ? C.line : C.muted); }
        SECTORS.forEach((sector, i) => {
            const [x, y] = positions[i], available = unlocked.includes(i), selected = this.selectedSector === i;
            if (selected) this.poly(r, ring(x, y, 4, 6.4, 6), C.muted);
            this.poly(r, ring(x, y, 3.65, 5.84, 6), selected ? C.raised : C.ink);
            this.poly(r, ring(x, y, 2.75, 4.4, 6), available ? sector.color || C.mint : C.line);
            this.button(r, available ? String(i + 1).padStart(2, '0') : '?', x - 3, y - 4.2, 6, 8.4, () => { this.selectedSector = i; this.rebuild(); this.draw(); }, { fill: [0, 0, 0, 0], ink: available ? C.ink : C.muted, size: 1.2 });
            this.text(r, sector.name.toUpperCase().slice(0, 23), x, y + 6.5, .69, available ? C.cream : C.muted, 'center');
            if ((e.contracts || []).some(c => c.status === 'active' && CONTRACTS.find(data => data.id === c.id)?.sector === i)) this.poly(r, ring(x + 3.5, y - 5, .7, 1.12, 4), C.lavender);
            if (e.sector === i) this.text(r, 'YOU ARE HERE', x, y - 8, .58, C.mint, 'center');
        });
        const i = clamp(this.selectedSector, 0, SECTORS.length - 1), sector = SECTORS[i], available = unlocked.includes(i), o = e.objective();
        this.text(r, 'SECTOR ' + String(i + 1).padStart(2, '0'), 61, 29.7, .79, C.mint);
        this.lines(r, sector.name, 61, 34, 30, 1.8, C.cream, 2);
        this.lines(r, sector.subtitle || sector.description || 'A corner of the Reach with a story of its own.', 61, 42, 30, 1.01, C.muted, 3);
        const current = i === e.sector;
        this.text(r, current ? 'LOCAL SCAN / TAP A DESTINATION' : available ? 'CHARTED DESTINATIONS' : 'AWAITING NAVIGATION KEY', 61, 52.3, .68, current ? C.mint : C.muted);
        this.box(r, 61, 56, 31, 21, [9, 19, 34, 255]);
        if (available) {
            const map = (x, y) => [62 + x / (sector.width || 240) * 29, 57 + y / (sector.height || 180) * 18.5];
            for (const poi of sector.pois || []) {
                const [x, y] = map(poi.x, poi.y), target = o.sector === i && distance(poi, o) < 20;
                this.poly(r, ring(x, y, target ? .7 : .45, target ? 1.12 : .72, 4), target ? C.gold : poi.kind === 'station' ? C.mint : C.coral);
            }
            for (const contract of e.contracts || []) {
                if (contract.status !== 'active') continue;
                const data = CONTRACTS.find(c => c.id === contract.id); if (!data || data.sector !== i) continue;
                const [x, y] = map(data.x, data.y); this.poly(r, ring(x, y, .65, 1.04, 6), C.lavender);
            }
            if (current && e.mode === 'space') { const [x, y] = map(e.ship.x, e.ship.y); this.poly(r, ring(x, y, .58, .92, 3), C.cream); }
            if (current && e.mode === 'space') this.box(r, 61, 56, 31, 21, [0, 0, 0, 0], { onClick: (id, x, y) => { if (id !== this.owner) return; this.waypoint = { sector: i, x: clamp((x - 62) / 29 * (sector.width || 240), 5, (sector.width || 240) - 5), y: clamp((y - 57) / 18.5 * (sector.height || 180), 5, (sector.height || 180) - 5) }; this.closeMenu(); } });
        } else this.lines(r, 'Follow your current signal to open this route.', 65, 62, 24, 1.03, C.muted, 3);
        this.text(r, current ? (e.mode === 'board' ? 'Return to your ship to jump.' : 'Mint: dock   Gold: story   Violet: contract') : available ? 'Jump drive ready. No fuel required.' : 'Complete the current chapter to chart more.', 61, 78.5, .68, C.muted);
        this.button(r, current ? 'RETURN TO FLIGHT' : available ? 'JUMP TO SECTOR ' + (i + 1) : 'ROUTE LOCKED', 61, 82, 31, 5.4, () => current ? this.closeMenu() : this.travel(i), { fill: C.mint, ink: C.ink, size: .92, disabled: !available || (!current && e.mode !== 'space') });
        this.text(r, e.time < e.messageUntil ? e.message : 'Explore at your pace. Gold marks the next story signal.', 8, 85.4, .79, C.gold);
    }
    outfit() {
        const e = this.engine, r = this.panel('YOUR SHIP. YOUR SIGNATURE.', 'KESTREL / MODULAR SALVAGE VESSEL'), canFit = e.canFit?.() || false;
        SLOTS.forEach((slot, i) => this.button(r, SLOT_NAMES[slot], 8 + i * 7.9, 29, 7.2, 5.4, () => { this.outfitSlot = slot; this.selectedModule = e.loadout[slot]; this.rebuild(); this.draw(); }, { active: this.outfitSlot === slot, size: .69 }));
        const list = MODULES.filter(m => m.slot === this.outfitSlot);
        let selected = MODULES.find(m => m.id === this.selectedModule && m.slot === this.outfitSlot) || list[0];
        if (!selected) return;
        this.selectedModule = selected.id;
        list.slice(0, 5).forEach((module, i) => {
            const installed = e.loadout[module.slot] === module.id, owned = e.owned.includes(module.id), y = 37 + i * 5.5;
            this.button(r, module.name.toUpperCase(), 8, y, 39, 4.8, () => this.selectModule(module.id), { active: selected.id === module.id, size: .91, align: 'left' });
            this.text(r, installed ? 'FITTED' : owned ? 'OWNED' : `${module.price || 0} CR`, 45.5, y + 1.4, .68, installed ? C.mint : owned ? C.lavender : C.gold, 'right');
        });
        this.box(r, 53, 29, 39, 36, [9, 19, 34, 255]);
        for (let i = 0; i < 6; i++) { this.box(r, 54, 32 + i * 5.5, 37, .04, C.line); this.box(r, 57 + i * 6, 30, .04, 34, C.line); }
        const preview = Object.create(e); preview.loadout = { ...e.loadout, [selected.slot]: selected.id };
        this.scene.previewShip?.(this.group(r), preview, 72.5, 47, 1.15);
        const stats = preview.shipStats();
        this.text(r, `HULL ${stats.maxHull}   SHIELD ${stats.maxShield}   SPEED ${stats.speed}   HIT ${stats.damage}`, 8, 65, .69, C.mint);
        this.text(r, 'FITTING PREVIEW', 55, 31, .64, C.mint);
        this.text(r, selected.slot.toUpperCase() + ' / ' + (e.loadout[selected.slot] === selected.id ? 'INSTALLED' : 'PROPOSED'), 90, 62, .64, C.muted, 'right');
        this.rule(r, 8, 67.1, 84);
        this.text(r, selected.name.toUpperCase(), 8, 69.2, 1.4, C.cream);
        this.lines(r, selected.description, 8, 73.6, 80, 1.04, C.muted, 2);
        const owned = e.owned.includes(selected.id), installed = e.loadout[selected.slot] === selected.id;
        this.text(r, owned ? 'PROPERTY OF THE KESTREL' : `${selected.price || 0} CREDITS  /  ${selected.scrap || 0} SCRAP  /  ${selected.crystal || 0} CRYSTAL`, 8, 81.2, .91, C.gold);
        this.text(r, canFit ? `${Math.floor(e.inventory.credits)} CR   ${Math.floor(e.inventory.scrap)} SCRAP   ${Math.floor(e.inventory.crystal)} CRYSTAL` : 'Dock at a station to buy and fit modules.', 8, 85.3, .82, C.muted);
        const affordable = e.inventory.credits >= (selected.price || 0) && e.inventory.scrap >= (selected.scrap || 0) && e.inventory.crystal >= (selected.crystal || 0);
        const label = installed ? 'INSTALLED' : !canFit ? 'DOCK TO OUTFIT' : owned ? 'FIT MODULE' : affordable ? 'BUY MODULE' : 'MORE SALVAGE NEEDED';
        this.button(r, label, 68, 81, 24, 6.2, () => owned ? this.equip(selected.id) : this.purchase(selected.id), { fill: C.mint, ink: C.ink, size: .92, disabled: installed || !canFit || (!owned && !affordable) });
        if (e.time < e.messageUntil) this.text(r, e.message, 50, 91.5, .96, C.gold, 'center');
    }
    supplies() {
        const e = this.engine, r = this.panel('A LITTLE INSURANCE.', 'STATION STORES / SMALL THINGS THAT GET YOU HOME');
        SUPPLIES.forEach((item, i) => {
            const x = 8 + i * 44, cx = x + 20;
            this.box(r, x, 30, 40, 52, [9, 19, 34, 255]);
            this.text(r, item.name.toUpperCase(), cx, 33, 1.3, C.cream, 'center');
            if (item.id === 'medkit') {
                this.poly(r, [[cx - 5, 42], [cx - 3, 39], [cx + 4, 39], [cx + 6, 42], [cx + 6, 52], [cx - 5, 52]], C.mint);
                this.box(r, cx - 4, 42, 9, 9, [45, 100, 114, 255]); this.box(r, cx - 1, 43, 2, 7, C.cream); this.box(r, cx - 3, 45.5, 6, 2, C.cream);
                this.box(r, cx - 2.5, 37.7, 5, 1.4, C.cream);
            } else {
                for (let j = 0; j < 3; j++) {
                    const xx = cx - 4 + j * 4, yy = 43 + (j === 1 ? -2 : 1);
                    this.poly(r, [[xx, yy - 4], [xx + 2, yy], [xx + 1.5, yy + 7], [xx - 1.5, yy + 7], [xx - 2.2, yy]], C.lavender);
                    this.poly(r, [[xx, yy - 4], [xx + .5, yy + 1], [xx, yy + 7], [xx - 1.5, yy + 7], [xx - 2.2, yy]], C.mint);
                }
            }
            this.lines(r, item.description, x + 3, 56, 34, 1.04, C.muted, 3);
            this.text(r, `${item.price} CREDITS / ${item.scrap} SCRAP`, cx, 68, 1.05, C.gold, 'center');
            const affordable = e.inventory.credits >= item.price && e.inventory.scrap >= item.scrap && e.inventory.crystal >= item.crystal;
            const full = item.id === 'medkit' && e.inventory.medkits >= 30;
            this.button(r, !e.canFit() ? 'DOCK TO RESUPPLY' : full ? 'KITS FULL' : affordable ? 'BUY ' + item.name.toUpperCase() : 'MORE SALVAGE NEEDED', x + 3, 74, 34, 6.5, () => this.purchase(item.id), { disabled: !e.canFit() || !affordable || full, active: (this.selectedSupply || 0) === i, fill: C.mint, ink: C.ink, accent: C.coral, size: .92 });
        });
        this.text(r, `${e.inventory.medkits} KITS ABOARD  /  ${Math.floor(e.inventory.credits)} CR  /  ${Math.floor(e.inventory.scrap)} SCRAP  /  ${Math.floor(e.inventory.crystal)} CRYSTALS`, 8, 85, .83, C.muted);
        if (e.time < e.messageUntil) this.text(r, e.message, 50, 91.5, .96, C.gold, 'center');
    }
    dialogueView() {
        const e = this.engine, d = e.dialogue;
        if (!d) { this.menu = null; return; }
        const r = this.panel(d.title || 'A SIGNAL IN THE QUIET', d.kind === 'dock' ? 'STATION UPLINK / SAFE HARBOR' : 'INCOMING / CREW CHANNEL');
        const speaker = CREW.find(c => c.id === d.speaker || c.name === d.speaker);
        this.box(r, 8, 30, 17, 23, C.raised);
        this.scene.portrait?.(this.group(r), speaker?.id || (d.speaker === 'mara' ? 'mara' : d.speaker === 'heart' ? 'heart' : 'signal'), 16.5, 39, 9);
        this.text(r, 'LIVE', 16.5, 49.5, .68, C.mint, 'center');
        this.text(r, String(speaker?.name || d.speaker || 'KESTREL').toUpperCase(), 28, 30, 1.2, C.mint);
        this.lines(r, d.text, 28, 35, 61, 1.21, C.cream, 7);
        const choices = this.dialogueChoices();
        choices.slice(0, 8).forEach((choice, i) => this.button(r, choice.label, 8 + (i % 2) * 43, 59 + Math.floor(i / 2) * 6.7, 41, 5.8, () => this.chooseScreenChoice(i), { size: .91, align: 'left', active: i === this.dialogueChoice, fill: i === this.dialogueChoice ? [40, 82, 84, 255] : C.raised }));
        if (!choices.length) this.button(r, 'CONTINUE', 66, 79, 26, 7, () => this.closeMenu(), { fill: C.mint, ink: C.ink });
        this.text(r, 'W/S select  /  E confirm  /  1–8 quick choice', 8, 86.5, .74, C.muted);
    }
    journal() {
        const e = this.engine, r = this.panel("THE CAPTAIN'S LOG", 'THE REACH / WHAT WE HAVE FOUND'), o = e.objective();
        this.text(r, 'CURRENT SIGNAL', 8, 30, .76, C.mint);
        this.lines(r, o.title || 'The open Reach', 8, 34, 39, 1.65, C.cream, 2);
        this.lines(r, o.text || MISSIONS[e.mission]?.description || 'There are still people to help and wrecks to explore.', 8, 42, 39, 1.12, C.muted, 5);
        this.lines(r, o.progress, 8, 59, 39, 1.1, C.gold, 3);
        this.rule(r, 8, 69, 39);
        this.text(r, 'CHAPTER ' + Math.min(e.mission + 1, MISSIONS.length) + ' / ' + MISSIONS.length, 8, 72, .84, C.mint);
        this.text(r, `${e.crew.length} CREW ABOARD / ${e.owned.length} MODULES OWNED`, 8, 76, .83, C.muted);
        this.button(r, 'MEET YOUR CREW', 8, 81, 39, 6, () => this.openMenu('crew'), { fill: [40, 82, 84, 255], size: .95 });
        this.box(r, 51, 29, 41, 50, [9, 19, 34, 255]);
        const entries = (e.log || []).slice().reverse(), pages = Math.max(1, Math.ceil(entries.length / 4)); this.journalPage = clamp(this.journalPage, 0, pages - 1);
        this.text(r, 'TRANSMISSIONS / NEWEST FIRST', 54, 32, .72, C.mint);
        if (!entries.length) this.lines(r, 'Your story starts at the station. Someone has left a light on for you.', 54, 39, 34, 1.11, C.muted, 5);
        entries.slice(this.journalPage * 4, this.journalPage * 4 + 4).forEach((entry, i) => {
            this.text(r, String(entries.length - this.journalPage * 4 - i).padStart(2, '0'), 54, 38 + i * 9.8, .72, C.coral);
            this.lines(r, typeof entry === 'string' ? entry : entry.text || entry.title || '', 57, 38 + i * 9.8, 32, 1.01, C.cream, 3);
        });
        this.button(r, '< NEWER', 51, 81, 13, 6, () => { this.journalPage--; this.rebuild(); this.draw(); }, { disabled: this.journalPage <= 0, size: .83 });
        this.text(r, `${this.journalPage + 1} / ${pages}`, 71.5, 83, .9, C.muted, 'center');
        this.button(r, 'OLDER >', 79, 81, 13, 6, () => { this.journalPage++; this.rebuild(); this.draw(); }, { disabled: this.journalPage >= pages - 1, size: .83 });
    }
    crewView() {
        const e = this.engine, r = this.panel('A SHIP IS ITS PEOPLE.', 'KESTREL / THE ONES WHO STAYED');
        CREW.slice(0, 3).forEach((person, i) => {
            const x = 8 + i * 28.5, aboard = e.crew.includes(person.id);
            this.box(r, x, 30, 26.5, 48, [9, 19, 34, 255]); this.box(r, x, 30, 26.5, .22, aboard ? person.color || C.mint : C.line);
            this.scene.portrait?.(this.group(r), aboard ? person.id : 'unknown', x + 13.25, 42, 12);
            this.text(r, aboard ? person.name.toUpperCase() : 'AN EMPTY BUNK', x + 13.25, 55, 1.15, aboard ? C.cream : C.muted, 'center');
            this.text(r, aboard ? person.role.toUpperCase() : 'SOMEWHERE OUT THERE', x + 13.25, 59.8, .76, C.mint, 'center');
            this.lines(r, aboard ? person.description : 'Keep listening. The Reach is full of people who need a ride.', x + 2, 64, 22.5, 1.02, C.muted, 4);
            this.button(r, aboard ? 'PERSONAL LOG' : 'AWAITING A SIGNAL', x + 1.5, 81, 23.5, 5.6, () => { this.selectedCrew = person.id; this.openMenu('crew-detail'); }, { disabled: !aboard, size: .84 });
        });
    }
    crewDetail() {
        const person = CREW.find(c => c.id === this.selectedCrew) || CREW[0], r = this.panel(person.name.toUpperCase(), 'CREW RECORD / ' + person.role.toUpperCase());
        this.box(r, 8, 30, 30, 45, [9, 19, 34, 255]);
        this.scene.portrait?.(this.group(r), person.id, 23, 50, 19);
        this.text(r, 'A PLACE ON THE KESTREL', 23, 70, .68, C.mint, 'center');
        this.lines(r, person.story, 43, 32, 46, 1.42, C.cream, 7);
        this.rule(r, 43, 57, 46);
        this.text(r, 'WHAT THEY BRING ABOARD', 43, 61, .74, C.mint);
        this.lines(r, person.description, 43, 65, 46, 1.12, C.muted, 5);
        this.text(r, 'A borrowed hull becomes a home, one rescue at a time.', 8, 82.5, .93, C.cream);
        this.button(r, 'BACK TO CREW', 73, 81, 19, 6, () => this.openMenu('crew'), { size: .9 });
    }
    pause() {
        const r = this.panel('TAKE A BREATH.', 'FLIGHT PAUSED / THE STARS CAN WAIT');
        this.lines(r, 'Your voyage is saved automatically. Every module, recovered signal, and crewmate stays with you.', 10, 33, 42, 1.35, C.cream, 4);
        this.button(r, 'RESUME VOYAGE', 10, 51, 38, 8, () => this.closeMenu(), { fill: C.mint, ink: C.ink, size: 1.1 });
        this.button(r, 'HOW TO FLY', 10, 62, 38, 7, () => this.openMenu('help'));
        this.button(r, 'MUSIC & SOUND: ' + (this.soundEnabled ? 'ON' : 'OFF'), 10, 72, 38, 7, () => { this.soundEnabled = !this.soundEnabled; this.audio.silence(); this.rebuild(); this.draw(); });
        this.scene.previewShip?.(this.group(r), this.engine, 72, 51, 1.55);
        this.text(r, 'KESTREL', 72, 79, 1.7, C.mint, 'center', 'Georgia');
    }
    help() {
        const r = this.panel('FLIGHT SCHOOL', 'QUICK REFERENCE / BUILT FOR GETTING LOST');
        const controls = [['W A S D / ARROWS', 'Fly or walk. Movement follows the screen.'], ['SPACE / HOLD POINTER', 'Fire. Space aims at the nearest threat.'], ['E', 'Dock, board, talk, or use a terminal.'], ['X / V', 'Burst dash / hold V to boost the ship.'], ['Q / F', 'EMP pulse / use a repair or medical kit.'], ['M / I / J / C', 'Star chart / shipyard / log / pause & close.']];
        controls.forEach(([key, detail], i) => { this.text(r, key, 9, 31 + i * 7.1, .97, C.mint); this.text(r, detail, 33, 31 + i * 7.1, .97, C.cream); });
        this.rule(r, 9, 76, 81);
        this.lines(r, 'Collect floating salvage and break asteroids for parts. Dock for free repairs, shop supplies, and fit modules. Follow gold signals. The star chart opens new routes as your story unfolds.', 9, 79, 80, 1, C.muted, 3);
    }
    actions() {
        const r = this.panel('AT YOUR COMMAND', 'KESTREL / QUICK ACTIONS');
        const list = [['Q  EMP PULSE', () => { this.closeMenu(); this.act('pulse'); }], ['F  USE REPAIR KIT', () => { this.closeMenu(); this.act('heal'); }], ['SHIPYARD / EQUIPMENT', () => this.openMenu('outfit')], ['MEET THE CREW', () => this.openMenu('crew')], ['FLIGHT SCHOOL', () => this.openMenu('help')], ['C  PAUSE', () => this.openMenu('pause')]];
        list.forEach(([label, action], i) => this.button(r, label, 10 + (i % 2) * 42, 33 + Math.floor(i / 2) * 13, 38, 10, action, { size: 1.02 }));
        this.button(r, 'EMERGENCY TOW TO STATION', 10, 76, 80, 8, () => { this.closeMenu(); this.engine.recall(); this.persistIfDirty(); this.rebuild(); this.draw(); }, { fill: [85, 45, 61, 255], size: .99 });
    }
    ending() {
        const e = this.engine, r = this.overlay;
        this.box(r, 0, 0, 100, 100, [5, 12, 28, 225], { onClick: () => {} }); this.box(r, 9, 10, 82, 80, C.panel);
        this.text(r, 'A VOYAGE COMPLETED. A HOME BEGUN.', 50, 16, .9, C.mint, 'center');
        this.text(r, 'THE LIGHT WE KEEP', 50, 24, 3.4, C.cream, 'center', 'Georgia');
        this.rule(r, 22, 35, 56, C.coral);
        const ending = Array.isArray(e.endingText) ? e.endingText.join(' ') : e.endingText;
        this.lines(r, ending || 'The Reach is still broken. But the lights are coming back, one little ship at a time. The Kestrel has a crew now. And there are stars you have not seen.', 18, 40, 64, 1.35, C.cream, 8);
        this.text(r, `${e.crew.length} CREW BROUGHT HOME   /   ${e.owned.length} MODULES COLLECTED`, 50, 69, .97, C.mint, 'center');
        this.button(r, 'KEEP EXPLORING THE REACH', 25, 77, 50, 8, () => this.closeMenu(), { fill: C.mint, ink: C.ink, size: 1.14 });
        this.text(r, 'Your ship, your crew, and the open sky are still yours.', 50, 87, .81, C.muted, 'center');
    }
    close() { this.closed = true; this.persist(); this.clearInput(); this.pressed.clear(); this.audio.silence(); super.close?.(); }
}
module.exports = StarfallSalvage;
