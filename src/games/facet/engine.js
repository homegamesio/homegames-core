const GRID = 8, GEM_TYPES = 6, DT = 1 / 120;
const SPECIALS = ['row', 'col', 'burst', 'prism'];
const COLORS = [[246, 105, 132], [255, 191, 85], [108, 227, 164], [104, 175, 255], [198, 137, 255], [100, 231, 227]];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const key = (r, c) => r + ',' + c;
const cell = k => { const [row, col] = k.split(',').map(Number); return { row, col }; };
const inside = (r, c) => Number.isInteger(r) && Number.isInteger(c) && r >= 0 && c >= 0 && r < GRID && c < GRID;
const same = (a, b) => a && b && a.row === b.row && a.col === b.col;
const copy = value => JSON.parse(JSON.stringify(value));

// Pure, fixed-step match-three simulation. Coordinates are in grid units, with
// cell centers at .5; rendering, inputs, persistence and sound stay in the adapter.
class Engine {
    constructor(seed = 0xface7) {
        this.initialSeed = seed >>> 0; this.sound = true; this.reduced = false;
        this.start({ mode: 'zen' }); this.phase = 'title'; this.events = [];
    }
    random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
    effectRandom() { this.effectSeed = (Math.imul(this.effectSeed, 1664525) + 1013904223) >>> 0; return this.effectSeed / 4294967296; }
    emit(type, data) {
        if (this.events.length < 128) this.events.push(data ? { type, ...data } : { type });
    }
    start({ mode = 'journey', level = {} } = {}) {
        this.mode = ['journey', 'zen', 'rush'].includes(mode) ? mode : 'journey';
        this.level = { ...level, goals: (level.goals || []).map(g => ({ ...g })), frost: (level.frost || []).map(f => ({ ...f })) };
        this.seed = Number.isFinite(level.seed) ? level.seed >>> 0 : this.initialSeed;
        this.effectSeed = (this.seed ^ 0x9e3779b9) >>> 0;
        this.colors = clamp(Number.isInteger(level.colors) ? level.colors : GEM_TYPES, 4, GEM_TYPES);
        this.phase = 'ready'; this.paused = false; this.time = 0; this.uiTime = 0; this.accumulator = 0;
        this.score = 0; this.movesLeft = this.mode === 'journey' ? clamp(Math.floor(level.moves || 24), 1, 200) : 0;
        this.timeLeft = this.mode === 'rush' ? 120 : 0;
        this.cascade = 0; this.maxCascade = 0; this.bestCascade = 0;
        this.selected = null; this.hovered = null; this.hintPair = null; this.idleTime = 0;
        this.swap = null; this.pending = null; this.turnStart = null; this.shuffleResumeTurn = false; this.settledPending = false;
        this.phaseAge = 0; this.phaseDuration = 0;
        this.matchingKeys = new Set(); this.radiance = 0; this.radiantMoves = 0; this.radiantActive = false;
        this.stats = { gems: 0, moves: 0, specials: 0, combos: 0, bestCascade: 0, radiances: 0 };
        this.specialsCreated = 0; this.specialsActivated = 0; this.collected = Array(GEM_TYPES).fill(0);
        this.frost = Array.from({ length: GRID }, () => Array(GRID).fill(0));
        for (const f of this.level.frost) if (inside(f.row, f.col)) this.frost[f.row][f.col] = clamp(Math.floor(f.layers || 1), 1, 3);
        this.frostInitial = this.frost.flat().reduce((a, n) => a + n, 0); this.frostRemaining = this.frostInitial;
        this.goals = this.mode === 'journey' ? this.level.goals.map(g => ({ ...g,
            target: Number.isFinite(g.target) ? Math.max(0, g.target) : g.type === 'frost' ? this.frostInitial : 1 })) : [];
        if (this.mode === 'journey' && !this.goals.length) this.goals = [{ type: 'score', target: 5000 }];
        this.events = []; this.particles = []; this.rings = []; this.beams = []; this.popups = [];
        this.callout = { title: '', subtitle: '', life: 0, maxLife: 1, color: [255, 221, 139], priority: 0 };
        this.shake = 0; this.lastTurn = null; this.result = null; this.reshuffles = 0;
        this.board = Array.from({ length: GRID }, () => Array(GRID).fill(null));
        this.gems = Array.from({ length: GRID * GRID }, (_, id) => ({ id, active: true, type: 0, special: null,
            row: Math.floor(id / GRID), col: id % GRID, x: id % GRID + .5, y: Math.floor(id / GRID) + .5, anim: null, shatter: null }));
        for (const gem of this.gems) this.board[gem.row][gem.col] = gem;
        this.makeFreshBoard(); this.updateGoals(); return this;
    }
    retry() { this.start({ mode: this.mode, level: this.level }); }
    chooseType(row, col) {
        const allowed = [];
        for (let type = 0; type < this.colors; type++) {
            const h = col >= 2 && this.board[row][col - 1]?.type === type && this.board[row][col - 2]?.type === type;
            const v = row >= 2 && this.board[row - 1][col]?.type === type && this.board[row - 2][col]?.type === type;
            if (!h && !v) allowed.push(type);
        }
        return allowed[Math.floor(this.random() * allowed.length)];
    }
    makeFreshBoard() {
        for (let attempt = 0; attempt < 40; attempt++) {
            for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) this.board[r][c].type = this.chooseType(r, c);
            if (this.findValidMove()) return;
        }
        this.forcePlayable();
    }
    forcePlayable() {
        // No triples, and swapping (0,1) with (1,1) always makes a match.
        const offset = Math.floor(this.random() * this.colors);
        for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) this.board[r][c].type = (r * 2 + c + offset) % this.colors;
        for (const [r, c, type] of [[0, 0, 0], [0, 1, 1], [0, 2, 0], [1, 1, 0]]) this.board[r][c].type = (type + offset) % this.colors;
    }
    noteActivity() { this.idleTime = 0; this.hintPair = null; }
    select(row, col) {
        if (this.phase !== 'ready' || this.paused || !inside(row, col)) return false;
        this.noteActivity(); const target = { row, col };
        if (same(this.selected, target)) { this.selected = null; return true; }
        if (this.selected && Math.abs(this.selected.row - row) + Math.abs(this.selected.col - col) === 1) {
            const previous = this.selected; this.selected = null;
            return this.trySwap(previous.row, previous.col, row, col);
        }
        this.selected = target; this.emit('select'); return true;
    }
    animate(gem, kind, duration) {
        gem.anim = { kind, age: 0, duration, progress: 0, fromX: gem.x, fromY: gem.y, toX: gem.col + .5, toY: gem.row + .5 };
    }
    exchange(r1, c1, r2, c2, duration) {
        const a = this.board[r1][c1], b = this.board[r2][c2];
        this.board[r1][c1] = b; this.board[r2][c2] = a;
        a.row = r2; a.col = c2; b.row = r1; b.col = c1;
        this.animate(a, 'swap', duration); this.animate(b, 'swap', duration); return { a, b };
    }
    trySwap(r1, c1, r2, c2) {
        if (this.phase !== 'ready' || this.paused || !inside(r1, c1) || !inside(r2, c2) ||
            Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1 || !this.board[r1][c1] || !this.board[r2][c2] ||
            this.mode === 'rush' && this.timeLeft <= 0 || this.mode === 'journey' && this.movesLeft <= 0) return false;
        this.noteActivity(); this.selected = null;
        const gems = this.exchange(r1, c1, r2, c2, .17);
        this.swap = { ...gems, from: { row: r1, col: c1 }, to: { row: r2, col: c2 }, returning: false };
        this.phase = 'swapping'; this.emit('swap'); return true;
    }
    findMatches() {
        const groups = [], cells = new Set();
        for (const dir of ['h', 'v']) for (let line = 0; line < GRID; line++) {
            let cursor = 0;
            while (cursor < GRID) {
                const at = n => dir === 'h' ? this.board[line][n] : this.board[n][line];
                const first = at(cursor);
                if (!first || first.special === 'prism') { cursor++; continue; }
                let end = cursor + 1;
                while (end < GRID && at(end) && at(end).special !== 'prism' && at(end).type === first.type) end++;
                if (end - cursor >= 3) {
                    const run = [];
                    for (let i = cursor; i < end; i++) { const p = dir === 'h' ? { row: line, col: i } : { row: i, col: line }; run.push(p); cells.add(key(p.row, p.col)); }
                    groups.push({ dir, type: first.type, cells: run });
                }
                cursor = end;
            }
        }
        return { groups, cells };
    }
    pairWorks(a, b) { return !!a && !!b && (a.special === 'prism' || b.special === 'prism' || a.special && b.special); }
    moveValue(r1, c1, r2, c2) {
        const a = this.board[r1][c1], b = this.board[r2][c2]; if (!a || !b) return 0;
        if (this.pairWorks(a, b)) return a.special === 'prism' && b.special === 'prism' ? 100 : a.special && b.special ? 40 : 25;
        this.board[r1][c1] = b; this.board[r2][c2] = a;
        const matches = this.findMatches();
        this.board[r1][c1] = a; this.board[r2][c2] = b;
        if (!matches.cells.has(key(r1, c1)) && !matches.cells.has(key(r2, c2))) return 0;
        return matches.cells.size + matches.groups.reduce((sum, g) => sum + (g.cells.length >= 5 ? 12 : g.cells.length === 4 ? 5 : 0), 0);
    }
    wouldSwapWork(r1, c1, r2, c2) { return inside(r1, c1) && inside(r2, c2) && Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1 && this.moveValue(r1, c1, r2, c2) > 0; }
    findMoves() {
        const moves = [];
        for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
            if (!inside(r + dr, c + dc)) continue;
            const score = this.moveValue(r, c, r + dr, c + dc);
            if (score) moves.push({ from: { row: r, col: c }, to: { row: r + dr, col: c + dc }, score });
        }
        return moves.sort((a, b) => b.score - a.score);
    }
    findValidMove() { const best = this.findMoves()[0]; return best ? [best.from, best.to] : null; }
    hint() {
        if (this.phase !== 'ready' || this.paused) return null;
        this.hintPair = this.findValidMove(); this.idleTime = 0; this.emit('select'); return this.hintPair;
    }
    finishSwap() {
        if (this.swap.returning) { this.swap = null; this.phase = 'ready'; return; }
        const { a, b } = this.swap, matches = this.findMatches();
        if (!this.pairWorks(a, b) && !matches.cells.has(key(a.row, a.col)) && !matches.cells.has(key(b.row, b.col))) {
            this.exchange(this.swap.to.row, this.swap.to.col, this.swap.from.row, this.swap.from.col, .14);
            this.swap.returning = true; this.phase = 'swapBack'; this.emit('invalid'); return;
        }
        this.stats.moves++; if (this.mode === 'journey') this.movesLeft--;
        this.turnStart = { score: this.score, gems: this.stats.gems, specials: this.specialsCreated, activated: this.specialsActivated };
        this.radiantActive = this.radiantMoves > 0; if (this.radiantActive) this.radiantMoves--;
        this.cascade = 1; this.bestCascade = this.maxCascade = Math.max(this.maxCascade, 1); this.stats.bestCascade = Math.max(this.stats.bestCascade, 1);
        if (this.pairWorks(a, b)) this.prepareCombo(a, b);
        else this.prepareMatch(matches);
    }
    planSpecials(matches) {
        const components = [];
        for (const group of matches.groups) {
            const keys = new Set(group.cells.map(p => key(p.row, p.col)));
            const joins = components.filter(c => [...keys].some(k => c.keys.has(k)));
            const merged = { groups: [group], keys };
            for (const c of joins) { merged.groups.push(...c.groups); for (const k of c.keys) merged.keys.add(k); components.splice(components.indexOf(c), 1); }
            components.push(merged);
        }
        const plan = new Map();
        for (const component of components) {
            const longest = component.groups.reduce((a, g) => g.cells.length > a.cells.length ? g : a);
            const crossed = new Set(component.groups.map(g => g.dir)).size > 1;
            const special = longest.cells.length >= 5 ? 'prism' : crossed ? 'burst' : longest.cells.length === 4 ? longest.dir === 'h' ? 'row' : 'col' : null;
            if (!special) continue;
            const preferred = this.swap ? [key(this.swap.a.row, this.swap.a.col), key(this.swap.b.row, this.swap.b.col)] : [];
            const middle = longest.cells[Math.floor(longest.cells.length / 2)]; preferred.push(key(middle.row, middle.col));
            const anchor = [...preferred, ...component.keys].find(k => component.keys.has(k) && !this.board[cell(k).row][cell(k).col].special);
            if (anchor) plan.set(anchor, special);
        }
        return plan;
    }
    prepareMatch(matches) {
        const plan = this.planSpecials(matches), clear = new Set([...matches.cells].filter(k => !plan.has(k)));
        this.pending = { clear, plan, frost: new Set(matches.cells), consumed: new Set() };
        this.matchingKeys = new Set(matches.cells); this.phase = 'matching'; this.phaseAge = 0;
        this.phaseDuration = plan.size ? .15 : Math.max(.055, .1 - this.cascade * .006);
    }
    prepareCombo(a, b) {
        const clear = new Set(), consumed = new Set([key(a.row, a.col), key(b.row, b.col)]);
        const add = (r, c) => { if (inside(r, c)) clear.add(key(r, c)); };
        const prismCombo = a.special === 'prism' || b.special === 'prism';
        let title = 'PRISM SWEEP';
        if (prismCombo) {
            const other = a.special === 'prism' ? b : a;
            if (other.special === 'prism') {
                title = 'SPECTRUM SUPERNOVA';
                for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) add(r, c);
            } else {
                for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
                    const gem = this.board[r][c];
                    if (gem.type !== other.type || gem.special === 'prism') continue;
                    if (other.special) gem.special = other.special === 'burst' ? 'burst' : (r + c) % 2 ? 'row' : 'col';
                    add(r, c);
                }
                if (other.special) { consumed.delete(key(other.row, other.col)); title = other.special === 'burst' ? 'PRISM NOVA' : 'PRISM STORM'; }
            }
        } else if (a.special === 'burst' && b.special === 'burst') {
            title = 'DOUBLE NOVA'; for (let r = a.row - 2; r <= a.row + 2; r++) for (let c = a.col - 2; c <= a.col + 2; c++) add(r, c);
        } else if (a.special === 'burst' || b.special === 'burst') {
            title = 'STAR CROSS'; const center = a.special === 'burst' ? a : b;
            for (let n = 0; n < GRID; n++) for (let d = -1; d <= 1; d++) { add(center.row + d, n); add(n, center.col + d); }
        } else {
            title = 'CROSS FIRE'; for (let n = 0; n < GRID; n++) { add(a.row, n); add(n, a.col); }
        }
        add(a.row, a.col); add(b.row, b.col);
        for (const k of consumed) { const p = cell(k), gem = this.board[p.row][p.col]; if (gem.special) this.activateEffect(gem, p.row, p.col, prismCombo); }
        // A combined power has its own footprint; draw the same rows/columns
        // that actually clear, rather than the two gems' individual effects.
        if (!prismCombo) {
            const color = [238, 204, 255];
            if (a.special === 'burst' && b.special === 'burst') this.ring(a.col + .5, a.row + .5, color, 3, .65);
            else {
                const nova = a.special === 'burst' ? a : b.special === 'burst' ? b : null;
                const center = nova || a, radius = nova ? 1 : 0;
                for (let d = -radius; d <= radius; d++) {
                    if (inside(center.row + d, center.col)) this.beam(0, center.row + d + .5, 8, center.row + d + .5, color);
                    if (inside(center.row, center.col + d)) this.beam(center.col + d + .5, 0, center.col + d + .5, 8, color);
                }
            }
        }
        const pair = !!a.special && !!b.special;
        if (pair) { this.stats.combos++; this.emit('combo'); }
        this.announce(title, pair ? 'TWO POWERS. ONE BEAUTIFUL CHAIN.' : 'ONE COLOR. EVERYWHERE.', [225, 187, 255], 1.8, 3);
        this.pending = { clear, plan: new Map(), frost: new Set(clear), consumed };
        this.matchingKeys = new Set(clear); this.phase = 'matching'; this.phaseAge = 0; this.phaseDuration = pair ? .24 : .15;
    }
    mostCommonType(excluded = new Set()) {
        const counts = Array(this.colors).fill(0);
        for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
            const gem = this.board[r][c]; if (gem && gem.special !== 'prism' && !excluded.has(key(r, c))) counts[gem.type]++;
        }
        return counts.indexOf(Math.max(...counts));
    }
    activateEffect(gem, row, col, visual = true) {
        this.specialsActivated++; this.radiance = Math.min(100, this.radiance + 8);
        this.emit('special', { kind: gem.special, row, col });
        this.shake = Math.max(this.shake, gem.special === 'prism' ? .35 : .2);
        if (!visual) return;
        const color = gem.special === 'prism' ? [238, 218, 255] : COLORS[gem.type];
        if (gem.special === 'row') this.beam(0, row + .5, 8, row + .5, color);
        else if (gem.special === 'col') this.beam(col + .5, 0, col + .5, 8, color);
        else this.ring(col + .5, row + .5, color, gem.special === 'burst' ? 2 : 5, .65);
    }
    expandSpecials(clear, protectedKeys, consumed) {
        const queue = [...clear], processed = new Set(consumed);
        for (let cursor = 0; cursor < queue.length; cursor++) {
            const k = queue[cursor]; if (processed.has(k) || protectedKeys.has(k)) continue;
            processed.add(k); const { row, col } = cell(k), gem = this.board[row][col];
            if (!gem?.special) continue;
            this.activateEffect(gem, row, col);
            const add = (r, c) => {
                if (!inside(r, c)) return; const next = key(r, c);
                if (!clear.has(next) && !protectedKeys.has(next)) { clear.add(next); queue.push(next); }
            };
            if (gem.special === 'row') for (let n = 0; n < GRID; n++) add(row, n);
            else if (gem.special === 'col') for (let n = 0; n < GRID; n++) add(n, col);
            else if (gem.special === 'burst') for (let r = row - 1; r <= row + 1; r++) for (let c = col - 1; c <= col + 1; c++) add(r, c);
            else if (gem.special === 'prism') {
                const type = this.mostCommonType(clear);
                for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) if (this.board[r][c]?.type === type) add(r, c);
            }
        }
    }
    executeMatch() {
        const { clear, plan, frost, consumed } = this.pending;
        this.expandSpecials(clear, new Set(plan.keys()), consumed);
        for (const k of clear) frost.add(k);
        for (const k of frost) {
            const { row, col } = cell(k);
            if (this.frost[row][col] > 0) { this.frost[row][col]--; this.frostRemaining--; this.burst(col + .5, row + .5, [191, 237, 255], 4); }
        }
        for (const [k, special] of plan) {
            const { row, col } = cell(k), gem = this.board[row][col];
            gem.special = special; this.specialsCreated++; this.stats.specials++; this.radiance = Math.min(100, this.radiance + 12);
            this.ring(col + .5, row + .5, [255, 225, 154], 1.2, .6);
            this.emit('special', { kind: special, row, col, created: true });
        }
        const cells = [];
        for (const k of clear) {
            const { row, col } = cell(k), gem = this.board[row][col]; if (!gem) continue;
            cells.push({ row, col, type: gem.type, special: gem.special });
            if (gem.special !== 'prism') this.collected[gem.type]++;
            this.board[row][col] = null; gem.shatter = { age: 0, duration: .2 }; gem.anim = null;
            this.burst(col + .5, row + .5, COLORS[gem.type], this.cascade >= 3 ? 5 : 3);
        }
        this.stats.gems += cells.length;
        const multiplier = Math.min(6, Math.max(1, this.cascade)) * (this.radiantActive ? 2 : 1);
        const points = cells.length * 100 * multiplier; this.score += points;
        this.radiance = Math.min(100, this.radiance + cells.length * 1.5 + (this.cascade > 1 ? 5 : 0));
        this.emit('match', { cascade: this.cascade, points, cells });
        if (cells.length) this.popup(cells.reduce((sum, p) => sum + p.col + .5, 0) / cells.length,
            cells.reduce((sum, p) => sum + p.row + .5, 0) / cells.length, '+' + points.toLocaleString('en-US'), [255, 235, 181]);
        if (this.cascade >= 2) {
            const words = this.cascade >= 5 ? 'DAZZLING!' : this.cascade >= 3 ? 'BRILLIANT!' : 'BEAUTIFUL CASCADE';
            this.announce(words, 'CASCADE ×' + this.cascade + ' · +' + points.toLocaleString('en-US'), [255, 224, 141], 1.25, 2);
        } else if (plan.size) {
            const special = [...plan.values()][0], title = special === 'prism' ? 'PRISM CREATED' : special === 'burst' ? 'NOVA CREATED' : 'LIGHTNING CREATED';
            this.announce(title, special === 'prism' ? 'SWAP WITH ANY COLOR' : 'MATCH IT. WATCH IT SHINE.', [223, 197, 255], 1.3, 1);
        }
        this.shake = Math.max(this.shake, Math.min(.25, cells.length * .008));
        this.pending = null; this.swap = null; this.matchingKeys.clear(); this.updateGoals();
        this.phase = 'shattering'; this.phaseAge = 0; this.phaseDuration = .2;
    }
    beginFall() {
        const free = this.gems.filter(g => !g.active);
        for (let c = 0; c < GRID; c++) {
            const kept = [];
            for (let r = GRID - 1; r >= 0; r--) if (this.board[r][c]) kept.push(this.board[r][c]);
            for (let r = 0; r < GRID; r++) this.board[r][c] = null;
            let row = GRID - 1;
            for (const gem of kept) {
                this.board[row][c] = gem; gem.row = row; gem.col = c;
                if (Math.abs(gem.y - row - .5) > .001) this.animate(gem, 'fall', .15 + Math.abs(gem.y - row - .5) * .038);
                row--;
            }
            let spawned = 0;
            while (row >= 0) {
                const gem = free.shift();
                if (!gem) throw new Error('Facet gem pool invariant violated');
                Object.assign(gem, { active: true, row, col: c, x: c + .5, y: -.5 - spawned * .8,
                    type: Math.floor(this.random() * this.colors), special: null, anim: null, shatter: null });
                this.board[row][c] = gem; this.animate(gem, 'fall', .18 + Math.abs(gem.y - row - .5) * .038);
                row--; spawned++;
            }
        }
        this.phase = 'falling'; this.phaseAge = 0;
    }
    settleAfterFall() {
        const matches = this.findMatches();
        if (matches.cells.size && this.cascade < 24) {
            this.cascade++; this.maxCascade = Math.max(this.maxCascade, this.cascade); this.bestCascade = this.maxCascade;
            this.stats.bestCascade = Math.max(this.stats.bestCascade, this.cascade); this.prepareMatch(matches); return;
        }
        if (matches.cells.size) { this.startShuffle(true); return; }
        this.finishTurn();
    }
    finishTurn() {
        const turn = this.turnStart;
        if (turn) {
            this.lastTurn = { score: this.score - turn.score, cleared: this.stats.gems - turn.gems, cascade: this.cascade,
                specialsCreated: this.specialsCreated - turn.specials, specialsActivated: this.specialsActivated - turn.activated, radiant: this.radiantActive };
        }
        this.radiantActive = false;
        if (this.radiance >= 100 && this.radiantMoves === 0) {
            this.radiance -= 100; this.radiantMoves = 3; this.stats.radiances++;
            this.announce('RADIANCE!', 'YOUR NEXT 3 MATCHES SCORE DOUBLE', [255, 228, 148], 2.6, 4);
            this.ring(4, 4, [255, 226, 159], 6, 1); this.emit('radiance');
        }
        this.updateGoals();
        const finished = this.mode === 'journey' && (this.goalsComplete || this.movesLeft <= 0) || this.mode === 'rush' && this.timeLeft <= 0;
        if (finished) this.finish(this.mode === 'rush' || this.goalsComplete);
        else { this.phase = 'ready'; this.idleTime = 0; this.cascade = 0; }
        this.turnStart = null;
        if (this.phase === 'ready' && !this.findValidMove()) { this.settledPending = !!turn; this.startShuffle(false); }
        else if (turn) this.emit('settled');
    }
    startShuffle(resumeTurn = false) {
        this.selected = null; this.hintPair = null; this.reshuffles++; this.shuffleResumeTurn = resumeTurn;
        const gems = this.board.flat();
        let accepted = false;
        for (let attempt = 0; attempt < 100; attempt++) {
            for (let i = gems.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [gems[i], gems[j]] = [gems[j], gems[i]]; }
            for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) this.board[r][c] = gems[r * GRID + c];
            if (!this.findMatches().cells.size && this.findValidMove()) { accepted = true; break; }
        }
        if (!accepted) this.forcePlayable();
        for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
            const gem = this.board[r][c]; gem.row = r; gem.col = c; this.animate(gem, 'shuffle', .55);
        }
        this.phase = 'shuffling'; this.phaseAge = 0; this.phaseDuration = .55;
        this.announce('A FRESH PERSPECTIVE', 'YOUR SPECIAL GEMS ARE SAFE', [188, 213, 255], 1.6, 1); this.emit('shuffle');
    }
    updateGoals() {
        this.goalProgress = this.goals.map(goal => {
            const current = goal.type === 'score' ? this.score : goal.type === 'collect' ? this.collected[goal.color] || 0
                : goal.type === 'frost' ? this.frostInitial - this.frostRemaining : goal.type === 'specials' ? this.specialsCreated : 0;
            return { ...goal, current, complete: current >= goal.target };
        });
        this.goalsComplete = this.goalProgress.every(g => g.complete);
    }
    finish(won) {
        if (this.phase === 'won' || this.phase === 'lost') return this.result;
        const matchScore = this.score, reserveBonus = won && this.mode === 'journey' ? this.movesLeft * 400 : 0;
        this.score += reserveBonus;
        this.phase = won ? 'won' : 'lost'; this.selected = null; this.hintPair = null;
        const par = this.level.parScore || Math.max(this.level.moves * 550 || 10000, ...this.goals.filter(g => g.type === 'score').map(g => g.target));
        const stars = won ? this.score >= par * 1.6 ? 3 : this.score >= par ? 2 : 1 : 0;
        this.result = { won, mode: this.mode, score: this.score, matchScore, reserveBonus, stars, movesUsed: this.stats.moves, movesLeft: this.movesLeft,
            maxCascade: this.maxCascade, cleared: this.stats.gems, specialsCreated: this.specialsCreated,
            specialsActivated: this.specialsActivated, goals: copy(this.goalProgress),
            reason: this.mode === 'rush' ? 'Time’s up — what a rush!' : won ? 'Every goal completed!' : 'Out of moves. Your next masterpiece awaits.' };
        this.announce(this.mode === 'rush' ? 'TIME’S UP!' : won ? 'MASTERPIECE COMPLETE!' : 'ONE MORE TRY?',
            this.result.reason, won ? [255, 225, 154] : [193, 197, 226], 3, 5);
        this.emit(won ? 'win' : 'lose');
        return this.result;
    }
    announce(title, subtitle, color, duration = 1.5, priority = 1) {
        if (this.callout.life > 0 && this.callout.priority > priority) return;
        this.callout = { title, subtitle, color, life: duration, maxLife: duration, priority };
    }
    burst(x, y, color, count) {
        if (this.reduced) count = Math.min(count, 1);
        for (let i = 0; i < count && this.particles.length < 96; i++) {
            const angle = this.effectRandom() * Math.PI * 2, speed = 1.2 + this.effectRandom() * 3, life = .3 + this.effectRandom() * .4;
            this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1,
                r: .045 + this.effectRandom() * .065, life, maxLife: life, color, rotation: angle });
        }
    }
    ring(x, y, color, maxR = 1, duration = .5) {
        if (this.rings.length >= 12) this.rings.shift();
        this.rings.push({ x, y, r: .1, maxR, life: duration, maxLife: duration, color });
    }
    beam(x1, y1, x2, y2, color) {
        if (this.beams.length >= 12) this.beams.shift();
        this.beams.push({ x1, y1, x2, y2, color, width: .16, life: .32, maxLife: .32 });
    }
    popup(x, y, text, color) {
        if (this.popups.length >= 10) this.popups.shift();
        this.popups.push({ x, y, text, color, life: 1, maxLife: 1 });
    }
    tick(dt) {
        this.uiTime += dt; this.callout.life = Math.max(0, this.callout.life - dt); this.shake = Math.max(0, this.shake - dt);
        for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 5 * dt; p.life -= dt; }
        this.particles = this.particles.filter(p => p.life > 0);
        for (const ring of this.rings) { ring.life -= dt; ring.r = .1 + (ring.maxR - .1) * (1 - Math.pow(Math.max(0, ring.life / ring.maxLife), 2)); }
        this.rings = this.rings.filter(r => r.life > 0);
        for (const beam of this.beams) beam.life -= dt; this.beams = this.beams.filter(b => b.life > 0);
        for (const p of this.popups) { p.life -= dt; p.y -= dt * .4; } this.popups = this.popups.filter(p => p.life > 0);
        if (['title', 'won', 'lost'].includes(this.phase)) return;
        this.time += dt; this.phaseAge += dt;
        if (this.mode === 'rush' && this.phase !== 'shuffling') this.timeLeft = Math.max(0, this.timeLeft - dt);
        for (const gem of this.gems) {
            if (!gem.active) continue;
            if (gem.anim) {
                const a = gem.anim; a.age += dt; a.progress = Math.min(1, a.age / a.duration);
                const t = a.progress, ease = a.kind === 'fall' ? 1 - Math.pow(1 - t, 3) : t * t * (3 - 2 * t);
                gem.x = a.fromX + (a.toX - a.fromX) * ease;
                gem.y = a.fromY + (a.toY - a.fromY) * ease + (a.kind === 'fall' ? Math.sin(t * Math.PI * 3) * (1 - t) * .075 : 0);
                if (t >= 1) { gem.x = a.toX; gem.y = a.toY; gem.anim = null; }
            }
            if (gem.shatter) { gem.shatter.age += dt; if (gem.shatter.age + 1e-9 >= gem.shatter.duration) { gem.active = false; gem.shatter = null; } }
        }
        if (this.phase === 'swapping' || this.phase === 'swapBack') {
            if (!this.swap.a.anim && !this.swap.b.anim) this.finishSwap();
        } else if (this.phase === 'matching' && this.phaseAge + 1e-9 >= this.phaseDuration) this.executeMatch();
        else if (this.phase === 'shattering' && !this.gems.some(g => g.shatter)) this.beginFall();
        else if (this.phase === 'falling' && !this.gems.some(g => g.anim)) { this.emit('land'); this.settleAfterFall(); }
        else if (this.phase === 'shuffling' && !this.gems.some(g => g.anim)) {
            if (this.shuffleResumeTurn) this.finishTurn();
            else {
                this.phase = 'ready'; this.idleTime = 0;
                if (this.settledPending) { this.settledPending = false; this.emit('settled'); }
            }
        } else if (this.phase === 'ready') {
            if (this.mode === 'rush' && this.timeLeft <= 0) { this.finish(true); this.emit('settled'); return; }
            this.idleTime += dt;
            if (this.idleTime >= 7 && !this.selected && !this.hintPair) this.hintPair = this.findValidMove();
        }
    }
    step(dt = 1 / 30) {
        if (this.paused || !Number.isFinite(dt) || dt <= 0) return;
        this.accumulator += Math.min(dt, .25);
        while (this.accumulator + 1e-10 >= DT) { this.accumulator -= DT; this.tick(DT); }
        if (this.accumulator < 1e-10) this.accumulator = 0;
    }
    exportState() {
        if (this.phase !== 'ready') return null;
        return copy({ version: 1, mode: this.mode, level: this.level, seed: this.seed, score: this.score, movesLeft: this.movesLeft,
            timeLeft: this.timeLeft, collected: this.collected, frost: this.frost, frostInitial: this.frostInitial,
            stats: this.stats, specialsActivated: this.specialsActivated, radiance: this.radiance, radiantMoves: this.radiantMoves,
            board: this.board.map(row => row.map(gem => ({ type: gem.type, special: gem.special }))) });
    }
    restoreState(saved) {
        const finite = (v, max = 1e12) => Number.isFinite(v) && v >= 0 && v <= max;
        if (!saved || saved.version !== 1 || !['journey', 'zen', 'rush'].includes(saved.mode) ||
            !saved.level || typeof saved.level !== 'object' || !Number.isInteger(saved.seed) || saved.seed < 0 || saved.seed > 0xffffffff ||
            !finite(saved.score) || !finite(saved.movesLeft, 200) || !finite(saved.timeLeft, 120) ||
            !finite(saved.radiance, 100) || !Number.isInteger(saved.radiantMoves) || saved.radiantMoves < 0 || saved.radiantMoves > 3 ||
            !Array.isArray(saved.board) || saved.board.length !== GRID || !Array.isArray(saved.frost) || saved.frost.length !== GRID ||
            !Array.isArray(saved.collected) || saved.collected.length !== GEM_TYPES || !saved.collected.every(n => finite(n)) ||
            !saved.stats || !['gems', 'moves', 'specials', 'combos', 'bestCascade', 'radiances'].every(k => finite(saved.stats[k])) ||
            !finite(saved.frostInitial, GRID * GRID * 3) || !finite(saved.specialsActivated)) return false;
        const colors = clamp(Number.isInteger(saved.level.colors) ? saved.level.colors : GEM_TYPES, 4, GEM_TYPES);
        for (let r = 0; r < GRID; r++) {
            if (!Array.isArray(saved.board[r]) || saved.board[r].length !== GRID || !Array.isArray(saved.frost[r]) || saved.frost[r].length !== GRID) return false;
            for (let c = 0; c < GRID; c++) {
                const g = saved.board[r][c], frost = saved.frost[r][c];
                if (!g || !Number.isInteger(g.type) || g.type < 0 || g.type >= colors || g.special !== null && !SPECIALS.includes(g.special) ||
                    !Number.isInteger(frost) || frost < 0 || frost > 3) return false;
            }
        }
        if (saved.mode === 'rush' && saved.timeLeft <= 0 || saved.mode === 'journey' && saved.movesLeft <= 0 ||
            !Array.isArray(saved.level.goals) || !Array.isArray(saved.level.frost) ||
            saved.level.goals.some(g => !g || !['score', 'collect', 'frost', 'specials'].includes(g.type) || !finite(g.target) ||
                g.type === 'collect' && (!Number.isInteger(g.color) || g.color < 0 || g.color >= colors)) ||
            saved.level.frost.some(f => !f || !inside(f.row, f.col) || !Number.isInteger(f.layers) || f.layers < 1 || f.layers > 3) ||
            saved.level.moves !== undefined && (!Number.isInteger(saved.level.moves) || saved.level.moves < 1 || saved.level.moves > 200) ||
            saved.level.parScore !== undefined && !finite(saved.level.parScore)) return false;
        const candidate = new Engine(this.initialSeed); candidate.start({ mode: saved.mode, level: copy(saved.level) });
        for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) Object.assign(candidate.board[r][c], saved.board[r][c]);
        if (candidate.findMatches().cells.size || !candidate.findValidMove()) return false;
        candidate.seed = saved.seed >>> 0; candidate.score = saved.score; candidate.movesLeft = saved.movesLeft; candidate.timeLeft = saved.timeLeft;
        candidate.collected = saved.collected.slice(); candidate.frost = copy(saved.frost); candidate.frostInitial = saved.frostInitial;
        candidate.frostRemaining = candidate.frost.flat().reduce((sum, n) => sum + n, 0);
        if (candidate.frostRemaining > candidate.frostInitial) return false;
        candidate.stats = { ...saved.stats }; candidate.specialsCreated = candidate.stats.specials; candidate.specialsActivated = saved.specialsActivated;
        candidate.maxCascade = candidate.bestCascade = candidate.stats.bestCascade;
        candidate.radiance = saved.radiance; candidate.radiantMoves = saved.radiantMoves; candidate.updateGoals();
        if (candidate.mode === 'journey' && candidate.goalsComplete) return false;
        const sound = this.sound, reduced = this.reduced;
        Object.assign(this, candidate); this.sound = sound; this.reduced = reduced; this.events = [];
        return true;
    }
}

module.exports = { Engine, GRID, GEM_TYPES, SPECIALS, COLORS };
