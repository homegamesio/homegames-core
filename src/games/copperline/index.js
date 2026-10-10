const { Game, GameNode, Shapes, ShapeUtils } = require('squish-145');
const { Frontier } = require('./engine');
const { FrontierScene } = require('./scene');
const { FrontierAudio } = require('./audio');
const { WEAPONS, UPGRADES, OUTFITS, PROPERTIES, MISSIONS, PERKS, BOUNTIES } = require('./content');

const INK = [24, 36, 40, 255], CREAM = [252, 235, 199, 255], GOLD = [240, 184, 89, 255];
const MUTED = [183, 180, 157, 255], TEAL = [103, 200, 175, 255], RED = [229, 107, 86, 255];
const PANEL = [22, 36, 40, 248], PAPER = [226, 195, 147, 255];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ring = (x, y, rx, ry, sides = 8) => Array.from({ length: sides }, (_, i) => [x + Math.cos(i * Math.PI * 2 / sides) * rx, y + Math.sin(i * Math.PI * 2 / sides) * ry]);

class Copperline extends Game {
    static metadata() {
        return {
            name: 'COPPERLINE', author: 'Joseph Garcia', squishVersion: '145',
            description: 'A West worth saving. Ride a colorful polygonal frontier, fight the Copperline railroad, build a home, and turn a battered six-shooter into a legend. A complete single-player action RPG.',
            aspectRatio: { x: 16, y: 10 }, tickRate: 20, maxPlayers: 1, assets: {},
            gamepadBindings: { w: ['DIRECTION_UP', 'STICK_1_UP'], s: ['DIRECTION_DOWN', 'STICK_1_DOWN'],
                a: ['DIRECTION_LEFT', 'STICK_1_LEFT'], d: ['DIRECTION_RIGHT', 'STICK_1_RIGHT'],
                ' ': 'FACE_1', e: 'FACE_2', x: 'FACE_3', h: 'FACE_4', r: 'LEFT_SHOULDER',
                q: 'RIGHT_SHOULDER', c: 'START', m: 'SELECT' },
        };
    }
    constructor({ saveGame, saveData, addAsset } = {}) {
        super(); this.saveGame = saveGame; this.engine = new Frontier(saveData); this.owner = null;
        this.keys = new Set(); this.pressed = new Set(); this.touch = { x: 0, y: 0 }; this.fire = false; this.aim = null;
        this.menu = null; this.kitTab = 'arsenal'; this.shopSelection = null; this.soundEnabled = true; this.waypoint = null; this.elapsed = 0;
        this.base = this.rect(0, 0, 100, 100, INK); this.world = this.group(); this.base.addChild(this.world, false);
        this.scene = new FrontierScene(this.world); this.ui = this.group(); this.base.addChild(this.ui, false);
        this.overlay = this.group(); this.base.addChild(this.overlay, false); this.audioRoot = this.group(); this.base.addChild(this.audioRoot, false);
        this.audio = new FrontierAudio(this.audioRoot, addAsset); this.buttons = []; this.hud = {};
        this.rebuild(); this.draw();
    }
    getLayers() { return [{ root: this.base }]; }
    getAssets() { return this.audio.assets; }
    group() { return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: [[0, 0], [0, 0], [0, 0]] }); }
    rect(x, y, w, h, fill, extra = {}) {
        return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(x, y, w, h), fill, color: fill, ...extra });
    }
    box(parent, x, y, w, h, fill, extra = {}) { const node = this.rect(x, y, w, h, fill, extra); parent.addChild(node, false); return node; }
    poly(parent, points, color) { const node = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: [...points, points[0]], fill: color, color }); parent.addChild(node, false); return node; }
    text(parent, text, x, y, size = 1.25, color = CREAM, align = 'left', font = 'sans-serif') {
        const node = new GameNode.Text({ textInfo: { text: String(text).slice(0, 125), x, y, size, color, align, font } }); parent.addChild(node, false); return node;
    }
    set(node, text) { if (node) node.node.text = { ...node.node.text, text: String(text).slice(0, 125) }; }
    lines(parent, value, x, y, width = 42, size = 1.3, color = MUTED, max = 9) {
        const count = Math.floor(width / (size * .58)), words = String(value || '').split(/\s+/); let row = 0, line = '';
        for (const word of words) {
            if (line && (line + ' ' + word).length > count) { this.text(parent, line, x, y + row++ * size * 2.05, size, color); line = ''; if (row >= max) return row; }
            line += (line ? ' ' : '') + word;
        }
        if (line) this.text(parent, line, x, y + row++ * size * 2.05, size, color); return row;
    }
    button(parent, label, x, y, w, h, action, options = {}) {
        const node = this.box(parent, x, y, w, h, options.color || [42, 59, 59, 255], {
            onClick: (id, px, py) => { if (id === this.owner) action?.(px, py); },
            offClick: options.release ? id => { if (id === this.owner) options.release(); } : undefined,
            border: options.border ? 2 : undefined, color: options.border ? GOLD : options.color || [42, 59, 59, 255],
        });
        this.text(node, label, x + w / 2, y + h / 2 - (options.size || 1.12) * .8, options.size || 1.12, options.ink || CREAM, 'center');
        this.buttons.push({ label, x, y, w, h, node }); return node;
    }
    handleNewPlayer({ playerId }) {
        if (this.owner !== null && this.owner !== playerId) return;
        this.owner = playerId; this.audio.register(); this.rebuild(); this.draw();
    }
    handlePlayerDisconnect(id) {
        if (id !== this.owner) return; this.persist(); this.owner = null; this.clearInput(); this.pressed.clear(); this.audio.silence(); this.base.node.onStateChange();
    }
    clearInput() { this.keys.clear(); this.fire = false; this.aim = null; this.aimScreen = null; this.touch = { x: 0, y: 0 }; }
    start(id = this.owner) {
        if (id !== this.owner || this.owner === null) return;
        this.engine.begin(); this.menu = null; this.clearInput(); this.persist(); this.rebuild(); this.draw();
    }
    openMenu(name) {
        if (this.engine.phase === 'title') return;
        this.menu = this.menu === name ? null : name; this.clearInput(); this.audio.silence();
        if (!['dialogue', 'shop', 'property', 'camp', 'train'].includes(name)) this.engine.closeDialogue?.();
        this.rebuild(); this.draw();
    }
    closeMenu() { this.menu = null; this.engine.closeDialogue?.(); if (this.engine.phase === 'ending') { this.engine.begin(); this.persist(); } this.clearInput(); this.rebuild(); this.draw(); }
    interact() {
        if (this.menu || this.engine.phase !== 'play') return;
        const context = this.engine.interact();
        if (context) { this.menu = context.kind || 'dialogue'; this.clearInput(); this.audio.silence(); }
        this.persistIfDirty(); this.rebuild(); this.draw();
    }
    choose(id) {
        this.engine.choose(id); this.menu = this.engine.dialogue ? this.engine.dialogue.kind || 'dialogue' : null;
        this.persistIfDirty(); this.rebuild(); this.draw();
    }
    purchase(id) { this.engine.buy(id); this.persistIfDirty(); this.rebuild(); this.draw(); }
    equip(id) { this.engine.equip(id); this.persistIfDirty(); this.rebuild(); this.draw(); }
    act(name) {
        if (this.menu || this.engine.phase !== 'play') return;
        if (typeof this.engine[name] === 'function') this.engine[name](); this.persistIfDirty(); this.draw();
    }
    handleKeyDown(id, raw) {
        if (id !== this.owner || typeof raw !== 'string') return;
        const key = raw.length === 1 ? raw.toLowerCase() : raw, repeat = this.pressed.has(key); this.keys.add(key); this.pressed.add(key);
        if (repeat) return;
        if (this.engine.phase === 'title') { if (key === 'Enter' || key === ' ') this.start(id); return; }
        if (this.engine.phase === 'ending' && ['c', 'Escape', 'Enter', ' '].includes(key)) { this.closeMenu(); return; }
        if (key === 'c' || key === 'Escape') { if (this.menu) this.closeMenu(); else this.openMenu('pause'); return; }
        if (key === 'm') { this.openMenu('map'); return; }
        if (key === 'i') { this.openMenu('kit'); return; }
        if (key === 'j') { this.openMenu('journal'); return; }
        if (key === '?') { this.openMenu('help'); return; }
        if (this.menu) return;
        if (key === 'e') this.interact();
        else if (key === 'h') this.act('mount');
        else if (key === 'r') this.act('reload');
        else if (key === 'f') this.act('heal');
        else if (key === 'q') this.act('focus');
        else if (key === 'x' || key === 'Shift') this.act('dodge');
        else if (/^[1-4]$/.test(key)) { const w = WEAPONS[Number(key) - 1]; if (w) this.equip(w.id); }
    }
    handleKeyUp(id, raw) { if (id === this.owner && typeof raw === 'string') { const key = raw.length === 1 ? raw.toLowerCase() : raw; this.keys.delete(key); this.pressed.delete(key); } }
    pointerAim(x, y) {
        // Target the visible torso, including riders on the train roof. Projecting
        // a torso click straight onto the ground would shoot behind the actor.
        let nearest = null, best = 4.2;
        for (const enemy of this.engine.enemies) {
            if (enemy.hp <= 0) continue;
            const point = this.scene.project(enemy.x, enemy.y, (enemy.trainOffset === undefined ? 0 : 8) + 3.5);
            const d = Math.hypot(point[0] - x, (point[1] - y) / 1.6);
            if (d < best) { nearest = enemy; best = d; }
        }
        return nearest ? { x: nearest.x, y: nearest.y } : this.scene.unproject(x, y + 3);
    }
    worldPress(x, y) { if (this.menu || this.engine.phase !== 'play') return; this.aimScreen = { x, y }; this.aim = this.pointerAim(x, y); this.fire = true; }
    handleMouseMove(id, { x, y }) { if (id === this.owner && this.fire && !this.menu && y > 12 && y < 88) { this.aimScreen = { x, y }; this.aim = this.pointerAim(x, y); } }
    handleMouseUp(id) { if (id === this.owner) { this.fire = false; this.aim = null; this.aimScreen = null; this.touch = { x: 0, y: 0 }; } }
    persist() {
        if (!this.saveGame || this.engine.phase === 'title') return;
        try {
            const saved = this.saveGame(this.engine.serialize()); this.engine.dirty = false;
            saved?.catch(() => { if (!this.closed) { this.saveError = 'Save unavailable. Keep this session open.'; this.draw(); } });
        } catch (_) { this.saveError = 'Save unavailable. Keep this session open.'; }
    }
    persistIfDirty() { if (this.engine.dirty) this.persist(); }
    tick() {
        if (this.closed || this.owner === null || this.engine.phase === 'title') return;
        if (this.menu || this.engine.phase === 'ending') {
            if (this.audio.tick(this.engine.events, .05, this.soundEnabled, false)) this.base.node.onStateChange();
            return;
        }
        const e = this.engine, previous = e.phase;
        if (this.fire && this.aimScreen) this.aim = this.pointerAim(this.aimScreen.x, this.aimScreen.y);
        const dx = (this.keys.has('d') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('a') || this.keys.has('ArrowLeft') ? 1 : 0) + this.touch.x;
        const dy = (this.keys.has('s') || this.keys.has('ArrowDown') ? 1 : 0) - (this.keys.has('w') || this.keys.has('ArrowUp') ? 1 : 0) + this.touch.y;
        e.tick(.05, { x: (dx + dy) * .7071, y: (dy - dx) * .7071, fire: this.fire || this.keys.has(' '), aim: this.fire ? this.aim : null, sprint: this.keys.has('v') || this.keys.has('Control') });
        this.elapsed += .05;
        this.audio.tick(e.events, .05, this.soundEnabled, true);
        if (e.phase !== previous) { this.clearInput(); this.rebuild(); }
        if (e.dirty || this.elapsed >= 20) { this.persist(); this.elapsed = 0; }
        this.draw();
    }
    rebuild() {
        this.ui.clearChildren(); this.overlay.clearChildren(); this.buttons = []; this.hud = {};
        if (this.engine.phase === 'title') this.title();
        else { this.playHud(); if (this.engine.phase === 'ending') this.ending(); else if (this.menu) this.menuView(); }
    }
    draw() {
        this.scene.render(this.engine, this.engine.phase === 'title');
        if (this.engine.phase !== 'title') this.updateHud();
        this.base.node.onStateChange();
    }
    title() {
        const r = this.ui;
        this.box(r, 4, 10, 46, 78, [22, 36, 40, 245]); this.box(r, 4, 10, .35, 78, GOLD);
        this.text(r, 'A WEST WORTH SAVING', 8, 15, 1.12, TEAL);
        this.text(r, 'COPPER', 7.6, 21, 6.35, CREAM, 'left', 'Georgia');
        this.text(r, 'LINE', 7.6, 30.5, 6.35, CREAM, 'left', 'Georgia');
        this.box(r, 8, 43, 36, .16, [197, 157, 93, 150]);
        this.lines(r, 'You came home to bury your mother. The railroad came to bury your town.', 8, 46, 35.5, 1.55, CREAM);
        this.lines(r, 'One six-shooter. A borrowed horse. A valley that still remembers your name.', 8, 55, 35.5, 1.17, MUTED);
        this.button(r, this.engine.hasSave ? 'CONTINUE YOUR STORY' : 'RIDE INTO COPPERLINE', 8, 65, 37.5, 8.5, () => this.start(), { color: GOLD, ink: INK, size: 1.28 });
        this.text(r, 'SINGLE PLAYER  /  SAVES AUTOMATICALLY', 8, 77.4, .86, MUTED);
        this.text(r, 'WASD move   SPACE fire   E interact', 8, 81.5, 1, CREAM);
        this.text(r, 'THE SUN GOES DOWN. YOU KEEP RIDING.', 96, 94.5, .95, CREAM, 'right');
        this.text(r, 'EST. 1889', 93, 7, 1.2, CREAM, 'right', 'Georgia');
    }
    playHud() {
        const r = this.ui;
        this.box(r, 0, 12, 100, 77, [0, 0, 0, 0], { onClick: (id, x, y) => { if (id === this.owner) this.worldPress(x, y); }, offClick: id => this.handleMouseUp(id) });
        this.box(r, 0, 0, 100, 11.8, [22, 36, 40, 244]); this.box(r, 0, 11.7, 100, .22, GOLD);
        this.text(r, 'COPPERLINE', 2.5, 1.6, 1.75, CREAM, 'left', 'Georgia');
        this.hud.region = this.text(r, '', 2.5, 6.1, .91, MUTED);
        this.hud.objective = this.text(r, '', 21, 2, 1.13, GOLD);
        this.hud.progress = this.text(r, '', 21, 6.3, .96, CREAM);
        this.button(r, 'M  MAP', 67, 2.1, 9.5, 7.3, () => this.openMenu('map'), { size: 1 });
        this.button(r, 'I  KIT', 77.5, 2.1, 8.7, 7.3, () => this.openMenu('kit'), { size: 1 });
        this.button(r, 'J  STORY', 87.2, 2.1, 10.3, 7.3, () => this.openMenu('journal'), { size: 1 });
        this.hud.message = this.text(r, '', 50, 14, 1.17, CREAM, 'center');
        this.hud.navigation = this.poly(r, [[0, 0], [0, 0], [0, 0]], GOLD);
        this.hud.navigationLabel = this.text(r, '', 50, 22, .84, GOLD, 'center');
        this.hud.hintBg = this.box(r, 27, 81.5, 49, 5.5, [22, 36, 40, 210]);
        this.hud.hint = this.text(r, '', 51.5, 83, 1.08, CREAM, 'center');
        this.box(r, 0, 89, 100, 11, [22, 36, 40, 250]);
        this.text(r, 'W / A / S / D', 10.5, 94.8, .7, MUTED, 'center');
        const arrows = [['^', 8, 79.8, 0, -1], ['<', 2.2, 86, -1, 0], ['v', 8, 86, 0, 1], ['>', 13.8, 86, 1, 0]];
        for (const [label, x, y, dx, dy] of arrows) this.button(r, label, x, y, 5.4, 6, () => { if (!this.menu) this.touch = { x: dx, y: dy }; }, { color: [33, 51, 54, 238], size: 1.45, release: () => { this.touch = { x: 0, y: 0 }; } });
        this.hud.weapon = this.text(r, '', 22, 90.1, 1.13, CREAM);
        this.hud.ammo = this.text(r, '', 22, 93.6, 1.01, GOLD);
        this.hud.money = this.text(r, '', 46, 90.1, 1.1, GOLD, 'right');
        this.hud.health = this.box(r, 22, 97.3, 14, .7, RED); this.box(r, 22, 97.3, 14, .7, [0, 0, 0, 0]);
        this.hud.stamina = this.box(r, 37, 97.3, 5, .7, TEAL); this.hud.focus = this.box(r, 43, 97.3, 4, .7, GOLD);
        const btns = [['SPACE  FIRE', 49, 12.5, () => { if (!this.menu) { this.fire = true; this.aim = null; this.aimScreen = null; } }],
            ['E  INTERACT', 62.5, 13, () => this.interact()], ['H  RIDE', 76.5, 10.5, () => this.act('mount')], ['... MORE', 88, 10, () => this.openMenu('actions')]];
        for (const [label, x, w, action] of btns) this.button(r, label, x, 91, w, 7, action, { size: .91, color: x === 49 ? [157, 83, 52, 255] : [42, 59, 59, 255], release: x === 49 ? () => { this.fire = false; } : undefined });
    }
    updateHud() {
        const e = this.engine, p = e.player, o = e.objective(), w = WEAPONS.find(w => w.id === p.weapon) || WEAPONS[0];
        const region = e.world.regions.reduce((a, b) => distance(p, a) < distance(p, b) ? a : b);
        this.set(this.hud.region, `${region.name.toUpperCase()}  /  LV ${p.level}`);
        this.set(this.hud.objective, o.title?.toUpperCase() || 'THE OPEN FRONTIER');
        this.set(this.hud.progress, `${o.progress || ''}  /  ${Math.round(distance(p, o))} paces`);
        this.set(this.hud.weapon, w.name.toUpperCase());
        this.set(this.hud.ammo, p.reloading > 0 ? 'RELOADING...' : `${p.ammo} / ${p.reserve} ROUNDS   |   ${p.medkits} TONICS`);
        this.set(this.hud.money, `$${Math.floor(p.money)}`);
        if (this.hud.health) this.hud.health.node.coordinates2d = ShapeUtils.rectangle(22, 97.3, 14 * clamp(p.hp / p.maxHp, 0, 1), .7);
        if (this.hud.stamina) this.hud.stamina.node.coordinates2d = ShapeUtils.rectangle(37, 97.3, 5 * clamp(p.stamina / 100, 0, 1), .7);
        if (this.hud.focus) this.hud.focus.node.coordinates2d = ShapeUtils.rectangle(43, 97.3, 4 * clamp(p.focus / 100, 0, 1), .7);
        this.set(this.hud.message, this.saveError || (e.time < e.messageUntil ? e.message : ''));
        let hint = 'SPACE fire  /  X dodge  /  Q deadeye  /  R reload';
        const npc = e.world.npcs.find(n => distance(p, n) < 10);
        const b = e.world.buildings.find(b => distance(p, { x: b.x, y: b.y + b.d / 2 + 2 }) < 11);
        if (p.aboard) hint = 'E jump off the Copperline Express';
        else if (npc) hint = `E speak with ${npc.name}`;
        else if (b) hint = `E visit ${b.name}`;
        else if (distance(p, e.horse) < 10 && !p.mounted) hint = 'H saddle up  /  Your horse: Comet';
        else if (p.mounted) hint = 'H dismount  /  You can shoot from the saddle';
        if (this.waypoint && !npc && !b) hint = `WAYPOINT  ${Math.round(distance(p, this.waypoint))} paces  /  M chart`;
        this.set(this.hud.hint, hint);
        const target = this.waypoint && distance(p, this.waypoint) > 8 ? this.waypoint : o;
        if (this.waypoint && distance(p, this.waypoint) <= 8) this.waypoint = null;
        if (Number.isFinite(target.x) && Number.isFinite(target.y) && distance(p, target) > 18) {
            const q = this.scene.project(target.x, target.y, 0), dx = q[0] - 50, dy = q[1] - 53;
            const f = Math.min(1, 39 / Math.max(Math.abs(dx), .001), 25 / Math.max(Math.abs(dy), .001));
            const x = 50 + dx * f, y = 53 + dy * f, a = Math.atan2(dy, dx), color = this.waypoint ? TEAL : GOLD;
            const points = [[x + Math.cos(a) * 1.3, y + Math.sin(a) * 1.9], [x + Math.cos(a + 2.45) * 1.3, y + Math.sin(a + 2.45) * 1.9], [x + Math.cos(a - 2.45) * 1.3, y + Math.sin(a - 2.45) * 1.9]];
            this.hud.navigation.node.coordinates2d = [...points, points[0]]; this.hud.navigation.node.fill = color;
            this.hud.navigationLabel.node.text = { ...this.hud.navigationLabel.node.text, text: `${this.waypoint ? 'ROUTE' : 'STORY'} ${Math.round(distance(p, target))}`, x, y: y + 2.5, color };
        } else { this.hud.navigation.node.coordinates2d = [[0, 0], [0, 0], [0, 0]]; this.set(this.hud.navigationLabel, ''); }
    }
    shell(title, kicker) {
        const r = this.overlay;
        this.box(r, 0, 11.9, 100, 77.1, [15, 26, 32, 120], { onClick: () => {} });
        this.box(r, 5, 16, 90, 69, PANEL); this.box(r, 5, 16, .3, 69, GOLD);
        this.text(r, kicker || 'COPPERLINE / FIELD NOTES', 8, 19, .85, TEAL);
        this.text(r, title, 8, 23, title.length > 34 ? 2.0 : 2.8, CREAM, 'left', 'Georgia');
        this.button(r, 'CLOSE  [C]', 79, 19, 13, 6, () => this.closeMenu(), { size: .9 });
        this.box(r, 8, 30, 84, .13, [94, 104, 91, 255]); return r;
    }
    menuView() {
        if (this.menu === 'map') return this.mapView();
        if (this.menu === 'kit') return this.kitView();
        if (this.menu === 'journal') return this.journalView();
        if (this.menu === 'help' || this.menu === 'pause' || this.menu === 'actions') return this.helpView();
        if (this.engine.dialogue) return this.contextView();
        this.menu = null;
    }
    mapView() {
        const r = this.shell('The whole wide valley', 'TERRITORY OF COPPERLINE / 1889');
        const ox = 9, oy = 34, sx = .18, sy = .184;
        this.box(r, ox, oy, 57.6, 44.16, PAPER, { onClick: (id, x, y) => { if (id !== this.owner) return; this.waypoint = { x: clamp((x - ox) / sx, 0, 320), y: clamp((y - oy) / sy, 0, 240) }; this.rebuild(); this.draw(); } });
        for (let i = 1; i < 8; i++) this.box(r, ox + i * 7.2, oy, .05, 44.16, [98, 83, 64, 40]);
        for (let i = 1; i < 6; i++) this.box(r, ox, oy + i * 7.36, 57.6, .05, [98, 83, 64, 40]);
        this.poly(r, [[ox + 24, oy], [ox + 28, oy + 10], [ox + 25, oy + 23], [ox + 31, oy + 35], [ox + 33, oy + 44], [ox + 34.4, oy + 44], [ox + 32.5, oy + 35], [ox + 27, oy + 23], [ox + 29.5, oy + 10], [ox + 25.5, oy]], [81, 141, 145, 170]);
        this.box(r, ox + 1.5, oy + 92 * sy, 54.5, .3, [82, 67, 59, 255]);
        for (let i = 0; i < 37; i++) this.box(r, ox + 1.5 + i * 1.5, oy + 92 * sy - .35, .12, 1, [82, 67, 59, 255]);
        for (const region of this.engine.world.regions) {
            const x = ox + region.x * sx, y = oy + region.y * sy;
            this.poly(r, ring(x, y, .5, .8, 4), [111, 68, 47, 255]);
            this.text(r, region.name.toUpperCase(), clamp(x, 16, 57), y + 1.6, .72, INK, 'center');
        }
        for (const b of this.engine.world.buildings) this.box(r, ox + b.x * sx - .32, oy + b.y * sy - .3, .64, .6, this.engine.player.properties.includes(b.id) ? [31, 108, 92, 255] : [127, 78, 53, 210]);
        for (const bounty of this.engine.bounties.filter(b => b.status === 'active')) {
            const b = BOUNTIES.find(v => v.id === bounty.id), x = ox + b.x * sx, y = oy + b.y * sy;
            this.poly(r, ring(x, y, .7, 1.1, 4), [64, 104, 87, 255]);
            this.text(r, b.name, x, y + 1.5, .63, INK, 'center');
        }
        const o = this.engine.objective();
        if (Number.isFinite(o.x) && Number.isFinite(o.y)) this.poly(r, ring(ox + o.x * sx, oy + o.y * sy, 1, 1.6, 4), [183, 65, 46, 255]);
        const p = this.engine.player; this.poly(r, ring(ox + p.x * sx, oy + p.y * sy, .75, 1.2, 8), [20, 60, 58, 255]);
        this.text(r, 'YOU', ox + p.x * sx, oy + p.y * sy - 3.2, .72, INK, 'center');
        if (this.waypoint) { const x = ox + this.waypoint.x * sx, y = oy + this.waypoint.y * sy; this.poly(r, [[x, y], [x, y - 3.5], [x + 2, y - 2.6], [x, y - 1.7]], [243, 246, 217, 255]); }
        this.text(r, 'YOUR NEXT CHAPTER', 70, 34, .95, GOLD);
        this.lines(r, o.title, 70, 38, 20, 1.45, CREAM, 3);
        this.lines(r, o.text, 70, 47, 20, 1.08, MUTED, 6);
        this.text(r, 'RED DIAMOND / objective', 70, 65, .83, RED);
        this.text(r, 'DARK DOT / your boots', 70, 68, .83, TEAL);
        this.lines(r, 'Tap the chart to mark a route. Green marks are bounties. Ride Comet or catch the train.', 70, 72, 21, .96, MUTED, 4);
        this.text(r, 'N', 64, 35, 1.4, INK, 'center', 'Georgia');
        this.text(r, 'EVERY ROAD LEADS SOMEWHERE.', 9, 80, .87, MUTED);
    }
    kitView() {
        const p = this.engine.player, r = this.shell('What you carry. What you become.', `THE RIDER / LEVEL ${p.level} / $${Math.floor(p.money)}`);
        const tabs = [['arsenal', 'ARSENAL'], ['wardrobe', 'WARDROBE'], ['property', 'DEEDS'], ['perks', 'ABILITIES']];
        tabs.forEach(([key, label], i) => this.button(r, label, 8 + i * 21.4, 32, 20, 5.2, () => { this.kitTab = key; this.rebuild(); this.draw(); }, { size: .94, color: this.kitTab === key ? [111, 88, 55, 255] : [42, 59, 59, 255] }));
        this.box(r, 8, 39, 31, 40, [31, 49, 51, 255]);
        this.paperDoll(r, 23.5, 56, p);
        this.text(r, 'THE RIDER', 23.5, 40.5, .88, MUTED, 'center');
        this.text(r, `${Math.ceil(p.hp)} / ${p.maxHp} VITALITY`, 23.5, 75, .9, TEAL, 'center');
        if (this.kitTab === 'arsenal') {
            WEAPONS.forEach((w, i) => {
                const y = 39 + i * 7.5, owns = p.weapons.includes(w.id), selected = p.weapon === w.id;
                this.button(r, `${selected ? '> ' : ''}${w.name}${owns ? '' : '  /  $' + w.price}`, 42, y, 48, 6.5, () => { if (owns) this.equip(w.id); }, { size: 1.08, color: selected ? [112, 81, 49, 255] : [38, 53, 56, 255], ink: owns ? CREAM : MUTED });
            });
            this.text(r, 'FITTED HARDWARE', 42, 70.7, .83, GOLD);
            const mods = UPGRADES.filter(u => p.mods.includes(u.id));
            this.lines(r, mods.length ? mods.map(m => m.name).join(' / ') : 'Stock iron. Visit Inez at the gunsmith for visible barrel, cylinder and coil upgrades.', 42, 74.3, 47, 1.0, MUTED, 3);
        } else if (this.kitTab === 'wardrobe') {
            OUTFITS.forEach((o, i) => {
                const y = 39 + i * 12.5, owns = p.outfits.includes(o.id);
                this.button(r, `${p.outfit === o.id ? '> ' : ''}${o.name}${owns ? '  /  WEAR' : '  /  $' + o.price}`, 42, y, 48, 6, () => { if (owns) this.equip(o.id); }, { size: 1.05, ink: owns ? CREAM : MUTED });
                this.lines(r, o.description, 43, y + 7, 45, .95, MUTED, 2);
            });
        } else if (this.kitTab === 'property') {
            PROPERTIES.forEach((prop, i) => {
                const y = 40 + i * 12.5, owns = p.properties.includes(prop.id);
                this.text(r, `${owns ? 'OWNED' : '$' + prop.price} / ${prop.name}`, 42, y, 1.3, owns ? TEAL : CREAM);
                this.lines(r, prop.description, 42, y + 4, 46, 1, MUTED, 3);
            });
        } else {
            this.text(r, `${p.perkPoints || 0} ABILITY POINTS AVAILABLE`, 42, 40, 1.13, GOLD);
            (PERKS || []).forEach((perk, i) => {
                const y = 45 + i * 10.8, owned = p.perks.includes(perk.id);
                this.button(r, `${perk.name}  /  ${owned ? 'LEARNED' : '1 POINT'}`, 42, y, 48, 5.3, () => this.purchase('perk_' + perk.id), { size: 1.0, ink: owned ? TEAL : CREAM });
                this.lines(r, perk.description, 43, y + 6, 46, .92, MUTED, 2);
            });
        }
    }
    paperDoll(r, x, y, p) {
        const coat = p.outfit === 'redponcho' ? [231, 89, 75, 255] : p.outfit === 'duster' ? [107, 72, 148, 255] : [68, 114, 159, 255];
        this.poly(r, ring(x, y + 15.5, 9, 1.5), [13, 27, 31, 160]);
        this.poly(r, [[x - 4, y + 4], [x + 4, y + 4], [x + 3.4, y + 15], [x + .5, y + 15], [x, y + 8], [x - 1, y + 15], [x - 4.3, y + 15]], [53, 56, 59, 255]);
        this.box(r, x - 4.5, y + 14.5, 3.5, 1.7, [29, 36, 39, 255]); this.box(r, x + .6, y + 14.5, 3.5, 1.7, [29, 36, 39, 255]);
        this.poly(r, [[x - 3, y - 4], [x + 3, y - 4], [x + 5, y + 8], [x + 1, y + 7], [x, y + 3], [x - 1, y + 8], [x - 5, y + 8]], coat);
        this.poly(r, [[x - 3, y - 4], [x - 6, y - 1], [x - 7, y + 5], [x - 4.5, y + 5], [x - 2, y]], coat);
        this.poly(r, [[x + 3, y - 4], [x + 6, y - 1], [x + 6.5, y + 4], [x + 4.5, y + 5], [x + 2, y]], coat);
        this.poly(r, [[x - 1.5, y - 4], [x + 1.8, y - 4], [x + 2, y + 3], [x - 1, y + 3]], [230, 194, 133, 255]);
        this.box(r, x - 3.4, y + 3, 7, .9, [75, 49, 38, 255]); this.box(r, x - .6, y + 2.8, 1.4, 1.4, GOLD);
        this.poly(r, [[x - 2, y - 10], [x + 2, y - 10], [x + 1.7, y - 5], [x, y - 3.9], [x - 1.8, y - 5]], [231, 162, 113, 255]);
        this.poly(r, [[x - 2.2, y - 12], [x + 2.3, y - 12], [x + 3.1, y - 8.8], [x - 3, y - 8.8]], p.outfit === 'trailcoat' ? [226, 207, 164, 255] : [35, 43, 51, 255]);
        this.poly(r, [[x - 5.2, y - 9], [x + 4.4, y - 9], [x + 5.2, y - 8], [x - 4.6, y - 7.3]], p.outfit === 'trailcoat' ? [251, 226, 181, 255] : [55, 61, 66, 255]);
        this.poly(r, [[x - 1, y - 4.5], [x + 2, y - 4.5], [x + 1, y - 1.4]], [176, 62, 48, 255]);
        for (let i = 0; i < 5; i++) this.box(r, x - 2.7 + i * .5, y - 2 + i * .7, .32, .8, GOLD);
        this.weaponArt(r, x + 3.2, y + 2, .7, p.weapon, p.mods);
    }
    weaponArt(r, x, y, s, weapon, mods = []) {
        const bx = (dx, dy, w, h, color) => this.box(r, x + dx * s, y + dy * s, w * s, h * s, color);
        const length = (weapon === 'repeater' ? 14 : weapon === 'scattergun' ? 10 : weapon === 'voltaic' ? 11 : 8) + (mods.includes('longbarrel') ? 3 : 0);
        bx(0, 0, length, 1, [194, 210, 201, 255]); bx(1.3, -.8, 3.7, 2.3, [95, 111, 108, 255]);
        bx(.5, 1, 2.2, 3.3, [174, 97, 58, 255]); bx(length - 1, -.5, .5, .5, GOLD);
        if (weapon === 'scattergun') bx(4, 1, length - 4, .75, [117, 132, 127, 255]);
        if (weapon === 'repeater') bx(6, .9, 4, 1.1, [180, 107, 59, 255]);
        if (mods.includes('drummag')) this.poly(r, ring(x + 3.5 * s, y + 2 * s, 1.8 * s, 2.6 * s, 8), [230, 174, 78, 255]);
        if (mods.includes('brasscoil') || weapon === 'voltaic') for (let i = 0; i < 4; i++) bx(5.2 + i * 1.1, -.6, .45, 2.3, i % 2 ? GOLD : TEAL);
        if (mods.includes('longbarrel')) { bx(length - 3, -.25, 2.8, 1.5, [217, 161, 70, 255]); bx(5, -1.1, 4, .4, [183, 200, 189, 255]); }
    }
    journalView() {
        const r = this.shell('A debt written in dust', 'THE RIDER / STORY JOURNAL'), e = this.engine;
        const missions = MISSIONS || [], row = Math.min(4.9, 43 / Math.max(1, missions.length));
        missions.forEach((m, i) => { this.text(r, `${i < e.mission ? '+' : i === e.mission ? '>' : '.'}  ${m.title}`, 9, 34 + i * row, 1.0, i < e.mission ? TEAL : i === e.mission ? GOLD : MUTED); });
        this.box(r, 49, 34, .1, 43, [94, 104, 91, 255]);
        const o = e.objective(); this.text(r, 'THE CURRENT CHAPTER', 53, 34, .9, GOLD);
        this.lines(r, o.title, 53, 38, 35, 1.9, CREAM, 2);
        this.lines(r, MISSIONS[e.mission]?.description || 'The company lost its grip. You have not lost your home. Ride the open valley, settle the remaining bounties, and build a life worth keeping.', 53, 47, 36, 1.23, MUTED, 6);
        this.lines(r, o.text, 53, 67, 36, 1.06, TEAL, 3);
        this.text(r, 'ACTIONS CHANGE THE VALLEY. EVERY CHAPTER IS SAVED.', 9, 79, .84, MUTED);
    }
    helpView() {
        const r = this.shell(this.menu === 'pause' ? 'Take a breath, rider.' : 'A few things to stay alive.', 'THE WORLD IS PAUSED');
        const controls = [['MOVE', 'WASD / arrows / V sprint'], ['FIRE', 'Hold SPACE to auto-aim, or hold a target'], ['INTERACT', 'E / talk, shop, rest, board the train'], ['RIDE', 'H / mount Comet or dismount'], ['SURVIVE', 'X dodge / Q deadeye / F tonic'], ['EQUIPMENT', 'R reload / 1-4 weapons / C pause']];
        controls.forEach(([a, b], i) => { this.text(r, a, 9, 35 + i * 6.6, .99, GOLD); this.text(r, b, 23, 35 + i * 6.6, 1.06, CREAM); });
        this.button(r, 'RELOAD', 70, 35, 20, 6, () => { this.closeMenu(); this.act('reload'); });
        this.button(r, 'DRINK TONIC', 70, 43, 20, 6, () => { this.closeMenu(); this.act('heal'); });
        this.button(r, 'DEADEYE', 70, 51, 20, 6, () => { this.closeMenu(); this.act('focus'); });
        this.button(r, 'DODGE', 70, 59, 20, 6, () => { this.closeMenu(); this.act('dodge'); });
        this.button(r, this.soundEnabled ? 'SOUND: ON' : 'SOUND: OFF', 70, 67, 20, 6, () => { this.soundEnabled = !this.soundEnabled; this.audio.silence(); this.rebuild(); this.draw(); });
        this.button(r, 'BACK TO THE FRONTIER', 9, 76, 54, 6, () => this.closeMenu(), { color: [133, 84, 46, 255] });
        this.text(r, 'Autosaves at milestones and every 20 seconds.', 70, 78, .7, MUTED, 'center');
    }
    contextView() {
        const e = this.engine, c = e.dialogue, r = this.shell(c.title || 'A word in the dust', c.kind === 'shop' ? 'LOCAL TRADE / CASH ON THE COUNTER' : 'PEOPLE OF COPPERLINE');
        if (!c.items?.length) this.lines(r, c.text, 9, 34, 77, 1.3, CREAM, 8);
        if (c.items?.length) {
            this.text(r, `YOUR PURSE / $${Math.floor(e.player.money)}`, 45, 33, 1.08, GOLD);
            const items = [...WEAPONS, ...UPGRADES, ...OUTFITS, ...PROPERTIES,
                { id: 'ammo', name: '48 cartridges', price: 8, description: 'A fresh box of cartridges. Adds 48 rounds to your leather ammunition satchel.' },
                { id: 'medicine', name: 'Medicine tin', price: 10, description: 'A tonic for the road. Press F to recover health when a firefight goes sideways.' }];
            if (!c.items.includes(this.shopSelection)) this.shopSelection = c.items[0];
            const selected = items.find(item => item.id === this.shopSelection);
            if (selected) {
                const owned = [...e.player.weapons, ...e.player.mods, ...e.player.outfits, ...e.player.properties].includes(selected.id);
                this.lines(r, selected.name, 9, 34, 32, 1.8, GOLD, 2);
                this.lines(r, selected.description, 9, 43, 31.5, 1.04, CREAM, 5);
                if (WEAPONS.includes(selected) || UPGRADES.includes(selected)) {
                    this.weaponArt(r, 15, 60, 1.15, WEAPONS.includes(selected) ? selected.id : e.player.weapon, [...e.player.mods, ...(UPGRADES.includes(selected) ? [selected.id] : [])]);
                    if (WEAPONS.includes(selected)) this.text(r, `${selected.damage} DMG / ${selected.clip} ROUNDS / ${selected.range} RANGE`, 9, 66, .81, MUTED);
                    else this.text(r, 'VISIBLE ON EVERY WEAPON YOU OWN', 9, 66, .78, TEAL);
                } else if (OUTFITS.includes(selected)) {
                    const color = [...selected.color, 255];
                    this.poly(r, [[21, 57], [26, 57], [30, 62], [27, 66], [23.5, 64], [20, 66], [17, 62]], color);
                    this.text(r, `${Math.round(selected.armor * 100)}% DAMAGE RESISTANCE`, 9, 66, .84, TEAL);
                }
                const affordable = e.player.money >= selected.price;
                this.button(r, owned ? 'ALREADY YOURS' : affordable ? `BUY FOR $${selected.price}` : `NEED $${selected.price - e.player.money} MORE`, 9, 69, 31, 5.5, () => this.purchase(selected.id), { size: 1.04, color: owned || !affordable ? [42, 59, 59, 255] : GOLD, ink: owned ? TEAL : affordable ? INK : MUTED });
            }
            c.items.slice(0, 7).forEach((id, i) => {
                const item = items.find(item => item.id === id) || { id, name: id === 'ammo' ? '48 cartridges' : 'Medicine tin', price: id === 'ammo' ? 8 : 10 };
                const owned = [...e.player.weapons, ...e.player.mods, ...e.player.outfits, ...e.player.properties].includes(id);
                this.button(r, `${item.name}  /  ${owned ? 'OWNED' : '$' + item.price}`, 44, 38 + i * 5.65, 46, 4.8, () => { this.shopSelection = id; this.rebuild(); this.draw(); }, { size: .99, ink: owned ? TEAL : CREAM, color: this.shopSelection === id ? [112, 81, 49, 255] : [42, 59, 59, 255] });
            });
        }
        const options = (c.options || []).slice(0, 5);
        if (c.items?.length) {
            options.forEach((option, i) => this.button(r, option.label, 9 + i * 42, 76.5, 40, 6, () => this.choose(option.id), { size: 1.03, color: i === 0 ? [132, 82, 46, 255] : [42, 59, 59, 255] }));
        } else {
            const top = 82 - options.length * 5.8;
            options.forEach((option, i) => this.button(r, option.label, 9, top + i * 5.8, 81, 5, () => this.choose(option.id), { size: 1.03, color: i === 0 ? [132, 82, 46, 255] : [42, 59, 59, 255] }));
        }
    }
    ending() {
        const r = this.shell('The valley remembers.', 'COPPERLINE / THE END OF ONE STORY');
        this.lines(r, 'There are mornings when a place belongs to the people who wake up in it. This is one of those mornings.', 10, 36, 77, 1.8, CREAM, 3);
        this.lines(r, this.engine.endingText || 'June opens the doors. Inez banks the forge. Comet waits in the sun. You came home with a debt. You stayed long enough to give the valley a future.', 10, 49, 75, 1.1, MUTED, 8);
        this.text(r, 'THE ROAD IS STILL YOURS.', 10, 69, 1.05, TEAL);
        this.button(r, 'KEEP RIDING / FREE ROAM', 10, 74, 48, 7, () => { this.engine.begin(); this.menu = null; this.persist(); this.rebuild(); this.draw(); }, { color: GOLD, ink: INK, size: 1.2 });
        this.text(r, `${this.engine.player.properties.length} DEEDS / LEVEL ${this.engine.player.level}`, 88, 76, 1.15, GOLD, 'right');
    }
    close() { this.persist(); this.closed = true; this.audio.silence(); this.clearInput(); this.pressed.clear(); super.close?.(); }
}
module.exports = Copperline;
