'use strict';
const { ENEMIES, THEMES, ORDER, DECOR, fieldFor, clone } = require('./content');
const { blankLevel } = require('./levels');

const finite = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const integer = (v, lo, hi) => Number.isInteger(v) && finite(v, lo, hi);
const point = (p, field) => Array.isArray(p) && p.length === 2 && finite(p[0], field.x, field.x + field.w - 3) && finite(p[1], field.y + 2, field.y + field.h - 2);
const length = path => path.slice(1).reduce((n, p, i) => n + Math.hypot(p[0] - path[i][0], p[1] - path[i][1]), 0);
const MAX_MAPS = 60, MAX_PACK_BYTES = 4 * 1024 * 1024;
const MAP_SIZES = [
    { name: 'TOWN', w: 116, h: 62 }, { name: 'WIDE', w: 208, h: 86 },
    { name: 'TALL', w: 132, h: 146 }, { name: 'LARGE', w: 208, h: 146 }, { name: 'VAST', w: 260, h: 180 },
];
// Host saves allow 1 MiB. Leave room for the draft, a complete checkpoint,
// progress and strings even when the workshop holds unusually dense maps.
const MAX_LIBRARY_BYTES = 768 * 1024;
const libraryError = levels => levels.length > MAX_MAPS ? `A frontier pack holds up to ${MAX_MAPS} maps.` : new TextEncoder().encode(JSON.stringify(levels)).length > MAX_LIBRARY_BYTES ? 'This pack is too large. Export a set of maps before adding more.' : null;

function validateLevel(raw, { draft = false } = {}) {
    const fail = message => ({ error: message });
    if (!raw || raw.version !== 1) return fail('This map needs format version 1.');
    if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 32) return fail('Give the map a name, up to 32 characters.');
    if (!integer(raw.theme, 0, THEMES.length - 1) || !integer(raw.cash, 70, 3000) || !integer(raw.gold, 1, 100)) return fail('Check the starting cash, gold and landscape.');
    const hasBounds = Object.hasOwn(raw, 'bounds');
    if (hasBounds && (!raw.bounds || Array.isArray(raw.bounds) || typeof raw.bounds !== 'object' || !integer(raw.bounds.w, 116, 260) || !integer(raw.bounds.h, 62, 180))) return fail('Map size must be 116–260 wide and 62–180 high, in whole units.');
    const field = fieldFor(hasBounds ? raw : null);
    if (!Array.isArray(raw.paths) || !raw.paths.length || raw.paths.length > 2) return fail('Draw one or two trails.');
    let end;
    for (const path of raw.paths) {
        if (!Array.isArray(path) || path.length < 2 || path.length > 24 || !path.every(p => point(p, field))) return fail('Each trail needs 2–24 points inside the field.');
        if (!draft && path.slice(1).some((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]) < 3)) return fail('Trail corners need a little more space.');
        if (!draft && (length(path) < 70 || length(path) > 600)) return fail('Trails must be 70–600 units long.');
        const last = path[path.length - 1];
        if (!draft && end && Math.hypot(last[0] - end[0], last[1] - end[1]) > .01) return fail('Both trails must finish at the same saloon.');
        end = last;
    }
    if (!Array.isArray(raw.decor) || raw.decor.length > 60 || raw.decor.some(d => !d || !DECOR.includes(d.kind) || !point([d.x, d.y], field))) return fail('Use at most 60 scenery pieces inside the field.');
    if (!Array.isArray(raw.unlocked) || !raw.unlocked.length || raw.unlocked.length > ORDER.length || raw.unlocked.some(k => !ORDER.includes(k)) || raw.unlocked.every(k => k === 'banjo')) return fail('Allow at least one attacking tower.');
    if (!Array.isArray(raw.waves) || raw.waves.length < 1 || raw.waves.length > 24) return fail('Make between 1 and 24 waves.');
    for (const [i, wave] of raw.waves.entries()) {
        if (!Array.isArray(wave) || !wave.length || wave.length > 8) return fail('Wave ' + (i + 1) + ' needs 1–8 groups.');
        let total = 0;
        for (const g of wave) {
            if (!g || !Object.hasOwn(ENEMIES, g.kind) || !integer(g.count, 1, 80) || !finite(g.gap, .2, 5) || !finite(g.delay, 0, 60) || !integer(g.route, 0, raw.paths.length - 1)) return fail('Check the groups in wave ' + (i + 1) + '.');
            total += g.count;
        }
        if (!draft && total > 240) return fail('Keep each wave under 241 bandits.');
    }
    // Rebuild the schema, excluding executable content, prototypes and baggage.
    return { level: { version: 1, id: typeof raw.id === 'string' ? raw.id.slice(0, 40) : 'custom', name: raw.name.trim(), theme: raw.theme,
        ...(hasBounds ? { bounds: { w: raw.bounds.w, h: raw.bounds.h } } : {}),
        paths: raw.paths.map(p => p.map(q => q.slice())), decor: raw.decor.map(d => ({ kind: d.kind, x: d.x, y: d.y })),
        cash: raw.cash, gold: raw.gold, unlocked: [...new Set(raw.unlocked)],
        waves: raw.waves.map(w => w.map(g => ({ kind: g.kind, count: g.count, gap: g.gap, delay: g.delay, route: g.route }))) } };
}
function decodePack(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length > MAX_PACK_BYTES) return { error: 'Choose a frontier JSON file under 4 MiB.' };
    try {
        const raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        const levels = raw.format === 'gold-and-grit' && raw.version === 1 ? raw.levels : [raw];
        if (!Array.isArray(levels) || levels.length > MAX_MAPS) return { error: `A frontier pack holds up to ${MAX_MAPS} maps.` };
        const result = [];
        for (const item of levels) { const checked = validateLevel(item); if (checked.error) return checked; result.push(checked.level); }
        const error = libraryError(result); return error ? { error } : { levels: result };
    } catch (_) { return { error: 'That file is not a valid frontier map.' }; }
}
const encodePack = levels => new TextEncoder().encode(JSON.stringify({ format: 'gold-and-grit', version: 1, levels }, null, 2));
function waveSummary(wave) {
    return wave.reduce((s, g) => ({ count: s.count + g.count, bounty: s.bounty + g.count * ENEMIES[g.kind].bounty,
        loot: s.loot + g.count * ENEMIES[g.kind].loot, end: Math.max(s.end, g.delay + (g.count - 1) * g.gap) }), { count: 0, bounty: 0, loot: 0, end: 0 });
}

class Editor {
    constructor(level) { this.level = clone(level || blankLevel()); this.undoStack = []; this.redoStack = []; this.tab = 'trail'; this.route = 0; this.wave = 0; this.group = 0; this.timeline = false; this.tool = 'move'; this.stamp = 'cactus'; this.revision = 0; }
    change(action) { this.checkpoint(); action(this.level); this.revision++; }
    checkpoint() { this.undoStack.push(clone(this.level)); if (this.undoStack.length > 50) this.undoStack.shift(); this.redoStack = []; }
    undo() { if (!this.undoStack.length) return; this.redoStack.push(clone(this.level)); this.level = this.undoStack.pop(); this.revision++; this.clampSelection(); }
    redo() { if (!this.redoStack.length) return; this.undoStack.push(clone(this.level)); this.level = this.redoStack.pop(); this.revision++; this.clampSelection(); }
    clampSelection() { this.route = Math.min(this.route, this.level.paths.length - 1); this.wave = Math.min(this.wave, this.level.waves.length - 1); this.group = Math.min(this.group, this.level.waves[this.wave].length - 1); }
    validate() { return validateLevel(this.level); }
}
module.exports = { validateLevel, decodePack, encodePack, Editor, length, waveSummary, libraryError, MAP_SIZES, MAX_MAPS, MAX_PACK_BYTES, MAX_LIBRARY_BYTES };
