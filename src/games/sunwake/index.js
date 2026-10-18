const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');
const { Voyage } = require('./engine');
const { SkyScene, tint } = require('./scene');
const { ShipAudio } = require('./audio');
const { ROLES, BIOMES, ROUTES, UPGRADES, KITS, clamp, distance } = require('./settings');
const INK = [245, 235, 211, 255], MUTED = [172, 189, 201, 255], GOLD = [255, 209, 137, 255], PANEL = [15, 24, 39, 245];

class Sunwake extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'SUNWAKE',
            author: "Joseph Garcia",
            createdBy: "Joseph Garcia",
            description: 'One impossible skyship. Six crewmates. Bring back the dawn. A cooperative expedition through a beautiful, broken world.',
            aspectRatio: { x: 16, y: 10 },
            maxPlayers: 6,
            tickRate: 20,
            gamepadBindings: { w: ['DIRECTION_UP', 'STICK_1_UP'], s: ['DIRECTION_DOWN', 'STICK_1_DOWN'],
                a: ['DIRECTION_LEFT', 'STICK_1_LEFT'], d: ['DIRECTION_RIGHT', 'STICK_1_RIGHT'],
                ' ': 'FACE_1', e: 'FACE_2', q: 'RIGHT_SHOULDER', h: 'START' },
            gameId: "8d39e013-e5c5-5148-a35c-95a10dd0e16a"
        };
    }
    constructor({ saveGame, saveData, media, handleFileUpload, addAsset } = {}) {
        super(); this.saveGame = saveGame; this.media = media; this.handleFileUpload = handleFileUpload; this.addAsset = addAsset;
        this.engine = new Voyage(Date.now(), saveData); this.people = new Map(); this.radioOwner = null;
        this.base = this.rect(0, 0, 100, 100, PANEL); this.world = this.group(); this.base.addChild(this.world);
        this.scene = new SkyScene(this.world); this.ui = this.group(); this.base.addChild(this.ui);
        this.personal = this.group(); this.base.addChild(this.personal); this.radioRoot = this.group(); this.base.addChild(this.radioRoot);
        this.audioRoot = this.group(); this.base.addChild(this.audioRoot); this.audio = new ShipAudio(this.audioRoot);
        this.ticks = 0;
        this.unsubscribe = media?.onChange(info => this.mediaChanged(info));
        this.rebuild(); this.draw();
    }
    getLayers() { return [{ root: this.base }]; }
    getAssets() { return this.audio.assets; }
    group(ids) { return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: [[0, 0], [0, 0], [0, 0]], playerIds: ids }); }
    rect(x, y, w, h, fill, options = {}) { return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(x, y, w, h), fill, color: [255, 255, 255, fill?.[3] ?? 255], ...options }); }
    text(parent, value, x, y, size = 1.5, color = INK, align = 'left') {
        const node = new GameNode.Text({ textInfo: { text: value, x, y, size, color, align } }); parent.addChild(node, false); return node;
    }
    set(node, value) { if (node) node.node.text = { ...node.node.text, text: String(value) }; }
    button(parent, label, x, y, w, h, action, { color = [41, 62, 77, 255], size = 1.5, offClick, input } = {}) {
        const node = this.rect(x, y, w, h, color, { onClick: action, offClick, input }); parent.addChild(node, false);
        node.label = this.text(node, label, x + w / 2, y + h / 2 - size * .8, size, INK, 'center'); return node;
    }
    lines(parent, value, x, y, width = 34, size = 1.4, color = MUTED) {
        const words = value.split(' '); let line = '', row = 0;
        for (const word of words) {
            if ((line + word).length > width && line) { this.text(parent, line.trim(), x, y + row++ * size * 2, size, color); line = ''; }
            line += word + ' ';
        }
        if (line) this.text(parent, line.trim(), x, y + row * size * 2, size, color);
    }
    handleNewPlayer({ playerId, info }) {
        if (!this.engine.addPlayer(playerId, info?.name)) return;
        this.people.set(playerId, { root: this.group([playerId]), sound: true, pressed: new Set(), radioStream: null, radioVideo: false, message: '', until: 0 });
        if (!this.assetsRegistered && this.addAsset) {
            this.assetsRegistered = true;
            for (const [key, asset] of Object.entries(this.audio.assets)) {
                try { this.addAsset(key, asset)?.catch(() => {}); } catch (_) { /* The voyage still works with sound off. */ }
            }
        }
        this.personal.addChild(this.people.get(playerId).root); this.rebuild(); this.draw();
    }
    handlePlayerDisconnect(id) {
        this.releaseRadio(id); const p = this.people.get(id);
        if (p) this.personal.removeChild(p.root.id); this.people.delete(id); this.engine.removePlayer(id); this.rebuild(); this.draw();
    }
    notice(id, text) { const p = this.people.get(id); if (p) { p.message = text; p.until = this.engine.time + 5; } }
    captain() { return this.engine.players.keys().next().value; }
    start(id) { if (this.engine.begin(id)) { this.rebuild(); this.draw(); } }
    takeRole(id, role) {
        if (!this.engine.role(id, role)) this.notice(id, 'The helm is occupied. Ask its pilot to switch stations.');
        else this.notice(id, ROLES.find(r => r.id === role).hint);
        this.rebuildPeople(); this.draw();
    }
    perform(id, special = false) {
        const p = this.engine.players.get(id); if (!p) return;
        if (!special && p.role === 'gunner') p.held = true;
        if (!this.engine.action(id, special)) this.notice(id, p.role === 'scout' && !special ? 'Get closer to a survivor or salvage crate.' : 'Recharging, or not needed yet.');
        this.draw();
    }
    worldPress(id, x, y) {
        if (y < 14 || y > 78) return;
        this.engine.aim(id, this.scene.unproject(x, y));
        const role = this.engine.players.get(id)?.role;
        if (role === 'scout') this.engine.action(id, false);
        this.draw();
    }
    handleMouseMove(id, { x, y }) { if (y >= 14 && y <= 78 && this.engine.players.get(id)?.held) this.engine.aim(id, this.scene.unproject(x, y)); }
    handleMouseUp(id) { const p = this.engine.players.get(id); if (p) p.held = false; this.releaseRadio(id); }
    handleKeyDown(id, key) {
        const p = this.engine.players.get(id); if (!p) return;
        const local = this.people.get(id), k = key.length === 1 ? key.toLowerCase() : key, repeat = local.pressed.has(k);
        local.pressed.add(k); p.keys.add(k);
        if (repeat) return;
        if (k === ' ') this.perform(id);
        else if (k === 'e') this.perform(id, true);
        else if (k === 'q') this.takeRole(id, ROLES[(ROLES.findIndex(r => r.id === p.role) + 1) % ROLES.length].id);
        else if ('1234'.includes(k) && k.length === 1) this.takeRole(id, ROLES[Number(k) - 1].id);
        else if (k === 'h') { const local = this.people.get(id); local.help = !local.help; this.rebuildPeople(); this.draw(); }
        else if (k === 'm') { local.sound = !local.sound; this.notice(id, local.sound ? 'Ship sounds enabled' : 'Ship sounds muted'); this.draw(); }
        else if (k === 'Enter' && this.engine.phase === 'harbor') this.start(id);
    }
    handleKeyUp(id, key) {
        const p = this.engine.players.get(id), k = key.length === 1 ? key.toLowerCase() : key;
        this.people.get(id)?.pressed.delete(k);
        if (p) { p.keys.delete(k); if (key === ' ') p.held = false; }
    }
    choose(id, index) { const phase = this.engine.phase; this.engine.vote(id, index); if (phase !== this.engine.phase) this.rebuild(); this.draw(); }
    rename(id, value) {
        if (this.engine.phase !== 'harbor' || typeof value !== 'string') return;
        if (id !== this.captain()) { this.notice(id, 'The first crewmate names the ship.'); this.draw(); return; }
        this.engine.save.name = value.replace(/[\x00-\x1f]/g, '').trim().slice(0, 22) || 'The Sunwake'; this.persist(); this.rebuild(); this.draw();
    }
    async upload(id, bytes, meta) {
        if (!this.people.has(id) || !this.handleFileUpload) return;
        try {
            if (meta?.kind && meta.kind !== 'image') throw new Error('Choose an image for your crew flag');
            const asset = await this.handleFileUpload(id, bytes, meta);
            if (this.closed || !this.people.has(id)) return;
            if (asset.info.type !== 'image') throw new Error('Choose an image for your crew flag');
            this.flag = asset.key; this.notice(id, 'Your crew flag is flying.'); this.draw();
        } catch (error) { this.notice(id, error.message || 'Unable to hoist that flag'); this.draw(); }
    }
    async enableRadio(id, video = false) {
        const p = this.people.get(id); if (!p || p.pending) return;
        if (p.radioStream) { this.radioPress(id); return; }
        p.pending = true;
        try {
            if (!this.media) throw new Error('Radio needs browser / RTC play');
            await this.media.request(id, { audio: true, video, transmitting: false, pushToTalk: true });
            this.notice(id, 'Radio ready. Hold RADIO to speak to the crew.');
        } catch (error) { this.notice(id, error.message); }
        finally { p.pending = false; if (!this.closed) this.draw(); }
    }
    radioPress(id) {
        const p = this.people.get(id); if (!p) return;
        if (!p.radioStream) { this.enableRadio(id); return; }
        if (this.radioOwner !== null && this.radioOwner !== id) { this.notice(id, 'Radio busy. Release and try again.'); return; }
        this.radioOwner = id; this.media.setTransmitting(p.radioStream, true); this.updateRadio(); this.draw();
    }
    releaseRadio(id) {
        if (this.radioOwner !== id) return;
        this.radioOwner = null; this.media?.setTransmitting(this.people.get(id)?.radioStream, false); this.updateRadio(); this.draw();
    }
    mediaChanged(info) {
        const p = this.people.get(info.playerId); if (!p) return;
        if (info.state === 'ended') p.radioStream = null;
        else { p.radioStream = info.id; p.radioVideo = info.video; }
        if ((!info.transmitting || info.state === 'ended') && this.radioOwner === info.playerId) this.radioOwner = null;
        this.updateRadio(); this.draw();
    }
    updateRadio() {
        const p = this.people.get(this.radioOwner), id = p?.radioStream;
        if (this.radioNodeKey === id) return;
        this.radioNodeKey = id; this.radioRoot.clearChildren();
        if (!id || !GameNode.Stream) return;
        if (p.radioVideo) this.radioRoot.addChild(this.rect(79, 16, 19, 20, PANEL));
        this.radioRoot.addChild(new GameNode.Stream({ streamId: id, pos: { x: 80, y: 17 },
            size: { x: p.radioVideo ? 17 : 0, y: p.radioVideo ? 15.3 : 0 }, audio: true }));
        this.text(this.radioRoot, this.engine.players.get(this.radioOwner)?.name || 'CREW RADIO', 88.5, p.radioVideo ? 33 : 17, 1.05, GOLD, 'center');
    }
    persist() {
        try { const result = this.saveGame?.({ ...this.engine.save }); result?.catch(() => { this.engine.announce('Could not save the logbook on this device.'); }); }
        catch (_) { this.engine.announce('Could not save the logbook on this device.'); }
    }
    rebuild() {
        this.ui.clearChildren(); const e = this.engine; this.phaseBuilt = e.phase;
        this.hud = {}; this.chartCounts = [];
        if (e.phase === 'harbor') this.harbor();
        else if (e.phase === 'chart') this.chart();
        else if (e.phase === 'sunrise') {
            this.text(this.ui, 'AND THEN, THERE WAS LIGHT.', 50, 9, 3.2, GOLD, 'center');
            this.text(this.ui, 'You did not cross the dark alone.', 50, 18, 1.5, INK, 'center');
        }
        else if (e.phase === 'won' || e.phase === 'lost') this.debrief();
        else this.flightHud();
        this.rebuildPeople();
    }
    harbor() {
        const e = this.engine;
        this.ui.addChild(this.rect(4, 32, 51, 45, [15, 24, 39, 236]), false);

        this.lines(this.ui, 'Light the beacons and bring your crew home.', 8, 39, 46, 1.35, MUTED);
        this.button(this.ui, 'PLAY', 8, 56, 43, 9, id => this.start(id), { color: [139, 89, 64, 255], size: 2 });
        this.button(this.ui, 'NAME THE SHIP', 8, 68, 22, 6, null, { size: 1.05, input: { type: 'text', oninput: (id, value) => this.rename(id, value) } });
        this.button(this.ui, 'HOIST YOUR FLAG', 32, 68, 19, 6, null, { size: 1.05, input: { type: 'file', oninput: (id, bytes, meta) => this.upload(id, bytes, meta) } });
        this.text(this.ui, e.save.name.toUpperCase(), 76, 51, 2, GOLD, 'center');
        this.text(this.ui, `LOGBOOK: ${e.save.renown} RENOWN / ${e.save.victories} DAWNS`, 76, 57, 1.05, MUTED, 'center');
        const kit = KITS.find(k => k.id === e.save.kit);
        this.button(this.ui, `SHIP: ${kit.name}  >`, 61, 62, 32, 7, id => {
            if (id !== this.captain()) { this.notice(id, 'The first crewmate chooses the ship.'); return; }
            const unlocked = KITS.filter(k => k.requirement <= e.save.renown);
            e.save.kit = unlocked[(unlocked.findIndex(k => k.id === e.save.kit) + 1) % unlocked.length].id;
            if (unlocked.length === 1) this.notice(id, 'Kestrel unlocks at 15 renown. Bastion at 35.');
            e.ship = e.makeShip(); this.persist(); this.rebuild(); this.draw();
        }, { size: 1.25 });
        this.text(this.ui, '1-6 CREW / DROP IN ANY TIME', 76, 72, 1.15, INK, 'center');
    }
    flightHud() {
        this.ui.addChild(this.rect(0, 0, 100, 13.5, PANEL), false);

        this.hud.objective = this.text(this.ui, '', 3, 6.2, 1.05, MUTED);
        const meters = [['hull', 33, [136, 224, 178, 255]], ['shield', 54, [137, 205, 239, 255]], ['energy', 75, GOLD]];
        for (const [key, x, color] of meters) {
            this.hud[key + 'Label'] = this.text(this.ui, '', x, 2.3, 1.1, INK);
            this.ui.addChild(this.rect(x, 7.2, 18, 1.5, [42, 53, 67, 255]), false);
            this.hud[key] = this.rect(x, 7.2, 18, 1.5, color); this.ui.addChild(this.hud[key], false);
        }
        const surface = this.rect(0, 13.5, 100, 65.5, [0, 0, 0, 0], { onClick: (id, x, y) => this.worldPress(id, x, y) }); this.ui.addChild(surface, false);
        this.hud.news = this.text(this.ui, '', 50, 15, 1.4, INK, 'center');
        this.hud.destination = this.text(this.ui, '', 50, 72.5, 1.35, GOLD, 'center');
        this.hud.progress = this.rect(27, 76, 0, .6, GOLD); this.ui.addChild(this.hud.progress, false);
    }
    chart() {
        const e = this.engine;
        this.ui.addChild(this.rect(2, 4, 96, 73, [15, 24, 39, 243]), false);
        this.text(this.ui, e.leg === 3 ? 'THE LAST PASSAGE' : 'A LIGHT IN THE DARK', 50, 8, 3.4, GOLD, 'center');
        this.text(this.ui, e.leg === 3 ? 'The Eclipse Engine waits. Choose your final refit.' : `Beacon ${e.leg} burns again. Choose a refit and your next route.`, 50, 16, 1.4, MUTED, 'center');
        ROUTES.forEach((route, i) => {
            const x = 5 + i * 31;
            this.button(this.ui, '', x, 25, 28, 42, id => this.choose(id, i), { color: [28 + i * 6, 43, 59, 255] });
            this.text(this.ui, UPGRADES[i].name, x + 2, 29, 1.6, UPGRADES[i].color);
            this.lines(this.ui, UPGRADES[i].detail, x + 2, 34, 28, 1.15, INK);
            this.text(this.ui, route.name, x + 2, 43, 1.05, GOLD);
            this.lines(this.ui, route.description, x + 2, 47, 29, 1.05, MUTED);
            this.chartCounts.push(this.text(this.ui, 'TAP TO VOTE', x + 14, 61, 1.3, INK, 'center'));
        });
        this.hud.voteTime = this.text(this.ui, '', 50, 71, 1.3, MUTED, 'center');
    }
    debrief() {
        const e = this.engine, won = e.phase === 'won';
        this.ui.addChild(this.rect(8, 8, 84, 68, [15, 24, 39, 237]), false);
        this.text(this.ui, won ? 'YOU BROUGHT BACK THE DAWN' : 'THE LIGHT IS NOT LOST', 50, 13, 3, GOLD, 'center');
        this.text(this.ui, won ? 'A broken world has a tomorrow. Because your crew stayed together.' : 'The ship fell. The logbook survived. There is another voyage in you.', 50, 23, 1.25, MUTED, 'center');
        this.text(this.ui, `${e.stats.beacons} BEACONS / ${e.stats.rescued} RESCUED / ${e.stats.leviathans ? 'SKYWHALE LIBERATED' : e.stats.kills + ' FOES BROKEN'}`, 50, 32, 1.6, INK, 'center');
        this.text(this.ui, `${e.score} SCORE    +${e.award} RENOWN`, 50, 40, 2.5, GOLD, 'center');
        const stars = [...e.players.values()].sort((a, b) => b.contribution - a.contribution);
        this.text(this.ui, stars.length ? `STEADY HANDS: ${stars[0].name.toUpperCase()}` : '', 50, 49, 1.35, MUTED, 'center');
        this.button(this.ui, 'ANOTHER VOYAGE', 17, 59, 31, 9, id => this.start(id), { color: [139, 89, 64, 255], size: 1.7 });
        this.button(this.ui, 'RETURN TO HARBOR', 52, 59, 31, 9, id => {
            if (!e.players.has(id)) return; e.phase = 'harbor'; e.ship = e.makeShip(); e.boss = null; e.enemies = []; e.loot = [];
            this.rebuild(); this.draw();
        }, { size: 1.5 });
    }
    rebuildPeople() {
        const e = this.engine;
        for (const [id, local] of this.people) {
            const person = e.players.get(id); if (!person) continue;
            local.root.clearChildren(); local.buttons = []; local.cooldown = null;
            local.root.addChild(this.rect(0, 79, 100, 21, [12, 21, 34, 255]), false);
            ROLES.forEach((role, i) => {
                const occupants = [...e.players.values()].filter(p => p.role === role.id);
                const selected = person.role === role.id;
                this.button(local.root, `${role.name}${selected ? ' / YOU' : occupants.length ? ' / ' + occupants.length : ' / AUTO'}`, 2 + i * 24.5, 80.5, 23, 6,
                    pid => { if (pid === id) this.takeRole(id, role.id); }, { color: selected ? tint(role.color, .36) : [28, 42, 57, 255], size: 1.3 });
            });
            const role = ROLES.find(r => r.id === person.role);
            local.hint = this.text(local.root, '', 3, 88.4, 1.05, MUTED);
            local.detail = this.text(local.root, '', 3, 93, 1.1, role.color);
            const harbor = e.phase === 'harbor';
            local.radio = this.button(local.root, 'RADIO', 42, 91, 13, 7, pid => { if (pid === id) this.radioPress(id); },
                { offClick: pid => this.releaseRadio(pid), size: 1.25, color: [50, 63, 73, 255] });
            if (harbor) {
                this.button(local.root, 'CAM RADIO', 57, 91, 18, 7, pid => { if (pid === id) this.enableRadio(id, true); }, { size: 1.1 });
                this.button(local.root, 'HOW TO PLAY', 77, 91, 21, 7, pid => { if (pid === id) { local.help = !local.help; this.rebuildPeople(); this.draw(); } }, { size: 1.1 });
            } else {
                local.primary = this.button(local.root, role.action, 57, 91, 19, 7, pid => { if (pid === id) this.perform(id); }, { size: 1.35, color: tint(role.color, .38), offClick: pid => this.handleMouseUp(pid) });
                local.special = this.button(local.root, role.special, 78, 91, 20, 7, pid => { if (pid === id) this.perform(id, true); }, { size: 1.2 });
                local.cooldown = this.rect(57, 97.7, 19, .3, role.color); local.root.addChild(local.cooldown, false);
            }
            if (local.help) this.help(id, local.root);
        }
    }
    help(id, root) {
        root.addChild(this.rect(10, 8, 80, 67, [12, 21, 34, 253]), false);
        this.text(root, 'EVERY STATION MATTERS', 50, 12, 2.5, GOLD, 'center');
        ROLES.forEach((r, i) => {
            this.text(root, r.name, 15, 22 + i * 9, 1.5, r.color);
            this.text(root, r.hint, 31, 22 + i * 9, 1.15, INK);
            this.text(root, r.keys, 31, 25.5 + i * 9, .9, MUTED);
        });
        this.text(root, 'Tap stations to switch. Empty stations use basic automation.', 50, 60, 1.2, MUTED, 'center');
        this.button(root, this.people.get(id).sound ? 'SOUND: ON' : 'SOUND: OFF', 15, 65, 24, 7, pid => {
            if (pid === id) { this.people.get(id).sound = !this.people.get(id).sound; this.rebuildPeople(); this.draw(); }
        }, { size: 1.25 });
        this.button(root, 'GOT IT', 53, 65, 30, 7, pid => { if (pid === id) { this.people.get(id).help = false; this.rebuildPeople(); this.draw(); } }, { size: 1.5 });
    }
    draw() {
        if (this.closed) return;
        const e = this.engine, s = e.ship;
        this.scene.render(e, e.phase === 'harbor');
        if (this.flag) {
            if (!this.flagNode || this.flagKey !== this.flag) { this.flagKey = this.flag; this.flagNode = new GameNode.Asset({ assetInfo: { [this.flag]: { pos: { x: 0, y: 0 }, size: { x: 4, y: 4.5 } } } }); }
            const at = this.scene.project(e.phase === 'harbor' ? 8 : s.x, e.phase === 'harbor' ? 0 : s.y, 28);
            this.flagNode.node.asset[this.flag].pos = { x: clamp(at[0], 0, 95), y: clamp(at[1], 14, 72) };
            this.world.node.children.push(this.flagNode);
        }
        if (this.hud.hull) {
            for (const [key, max, x] of [['hull', 'maxHull', 33], ['shield', 'maxShield', 54], ['energy', 'maxEnergy', 75]]) {
                this.set(this.hud[key + 'Label'], `${key.toUpperCase()} ${Math.ceil(s[key])}/${s[max]}`);
                this.hud[key].node.coordinates2d = ShapeUtils.rectangle(x, 7.2, 18 * clamp(s[key] / s[max], 0, 1), 1.5);
            }
            this.set(this.hud.objective, `${e.phase === 'finale' ? 'FINAL DAWN' : BIOMES[Math.min(2, e.leg)].name} / ${e.stats.rescued} RESCUED`);
            this.set(this.hud.news, e.news[0]?.text || '');
            const locked = e.enemies.some(enemy => enemy.kind === 'warden');
            this.set(this.hud.destination, e.phase === 'finale' ? `ECLIPSE ENGINE / ${Math.ceil(e.boss.hp / e.boss.maxHp * 100)}% / SCAN TO BREAK ITS ARMOR`
                : locked ? `BEACON ${e.leg + 1} / ${Math.ceil(distance(s, e.goal))}m / BREAK ITS WARDEN`
                : distance(s, e.goal) > 15 ? `WARDEN DOWN / APPROACH THE BEACON / ${Math.ceil(distance(s, e.goal))}m` : `RELIGHTING THE BEACON / ${Math.round(e.goal.charge * 100)}%`);
            const progress = e.phase === 'finale' ? 1 - e.boss.hp / e.boss.maxHp : e.goal.charge;
            this.hud.progress.node.coordinates2d = ShapeUtils.rectangle(27, 76, 46 * clamp(progress, 0, 1), .6);
        }
        if (e.phase === 'chart') {
            const tally = [0, 0, 0]; for (const vote of e.votes.values()) tally[vote]++;
            this.chartCounts.forEach((node, i) => this.set(node, `${tally[i]} ${tally[i] === 1 ? 'VOTE' : 'VOTES'} / TAP TO CHOOSE`));
            this.set(this.hud.voteTime, `Crew vote closes in ${Math.ceil(e.chartTime)}s. A tie takes the safer route.`);
        }
        for (const [id, local] of this.people) {
            const person = e.players.get(id), role = ROLES.find(r => r.id === person.role);
            this.set(local.hint, local.message && local.until > e.time ? local.message.slice(0, 85) : role.hint);
            const mode = ['BALANCED', 'ENGINES', 'WEAPONS', 'SHIELDS'][s.focus];
            this.set(local.detail, e.phase === 'harbor' ? `${person.name} / ${e.players.size} aboard` : `${mode} / HEAT ${Math.round(s.heat)}% / ${s.scrap} SCRAP`);
            local.detail.node.text.color = s.heat > 85 ? [255, 125, 139, 255] : role.color;
            this.set(local.radio?.label, this.radioOwner === id ? 'LIVE' : this.radioOwner !== null ? 'BUSY' : local.radioStream ? 'HOLD RADIO' : 'RADIO');
            if (local.cooldown && e.cooldowns) {
                const key = { helm: 'boost', gunner: 'fire', engineer: 'patch', scout: 'tractor' }[person.role];
                const total = { helm: 5, gunner: .8, engineer: 3, scout: .7 }[person.role];
                local.cooldown.node.coordinates2d = ShapeUtils.rectangle(57, 97.7, 19 * (1 - clamp(e.cooldowns[key] / total, 0, 1)), .3);
            }
        }
        this.base.node.onStateChange();
    }
    tick() {
        if (this.closed || !this.people.size) return;
        const e = this.engine, oldPhase = e.phase; this.ticks++;
        e.tick(.05);
        const sounding = this.audio.root.node.children.length > 0;
        this.audio.tick(e.events, .05, [...this.people].filter(([, p]) => p.sound).map(([id]) => id));
        if (this.phaseBuilt !== e.phase) { this.rebuild(); if (e.needsSave) { e.needsSave = false; this.persist(); } }
        if (['sail', 'finale', 'chart', 'sunrise'].includes(e.phase) || oldPhase !== e.phase || sounding) this.draw();
    }
    close() { this.closed = true; this.unsubscribe?.(); for (const p of this.people.values()) if (p.radioStream) this.media?.stop(p.radioStream); super.close(); }
}
module.exports = Sunwake;
