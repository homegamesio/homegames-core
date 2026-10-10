const { LEVELS, REALMS, ACHIEVEMENTS } = require('./content');
const { achievementValue } = require('./progression');

const BOARD = Object.freeze({ x: 12, y: 12, cell: 9, size: 72, rows: 8, cols: 8 });
const TAU = Math.PI * 2;
const C = {
    bg: [9, 24, 35], panel: [16, 35, 46], deep: [7, 18, 29], line: [70, 101, 110],
    gold: [230, 191, 119], cream: [255, 247, 226], muted: [162, 189, 197], mint: [120, 229, 208],
    jewel: [[240, 75, 110], [255, 188, 65], [50, 211, 146], [70, 142, 255], [188, 103, 243], [67, 225, 236]],
    light: [[255, 177, 193], [255, 237, 158], [155, 255, 207], [174, 219, 255], [235, 181, 255], [192, 255, 250]],
    dark: [[120, 22, 65], [147, 77, 18], [15, 98, 85], [21, 52, 125], [85, 30, 138], [15, 108, 136]],
};
const CUTS = [
    [[0, -1.07], [.83, 0], [0, 1.07], [-.83, 0]],
    [[-.5, -.87], [.5, -.87], [1, 0], [.5, .87], [-.5, .87], [-1, 0]],
    [[-.64, -.91], [.64, -.91], [.91, -.64], [.91, .64], [.64, .91], [-.64, .91], [-.91, .64], [-.91, -.64]],
    [[0, -1.12], [.78, -.15], [.65, .62], [0, 1], [-.65, .62], [-.78, -.15]],
    [[0, -1.05], [.94, .55], [.51, .95], [-.51, .95], [-.94, .55]],
    [[-.35, -.96], [.35, -.96], [.87, -.5], [.98, .2], [.65, .79], [0, 1.02], [-.65, .79], [-.98, .2], [-.87, -.5]],
];
const NAMES = ['Ruby', 'Amber', 'Emerald', 'Sapphire', 'Amethyst', 'Aquamarine'];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const number = n => Math.floor(Number(n) || 0).toLocaleString('en-US');
const formatTime = n => { const seconds = Math.max(0, Math.ceil(n || 0)); return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'); };
const clock = s => s.settings && s.settings.reduced ? 0 : s.clock || 0;
const progress = s => s.progress || { medals: [], bests: [], totalStars: 0, completedLevels: 0, completedRealms: [], achievements: [], stats: {}, zenBest: 0, rushBest: 0 };
const selectedLevel = s => LEVELS[s.selectedLevel || 0] || LEVELS[0];
const realmFor = s => REALMS[s.screen === 'play' ? selectedLevel(s).realmIndex : s.selectedRealm || 0] || REALMS[0];
const cell = (x, y) => [BOARD.x + x * BOARD.cell, BOARD.y + y * BOARD.cell];
const mode = s => s.engine.mode || s.mode || 'journey';
const canPlay = (s, i) => i === 0 || (progress(s).medals[i - 1] || 0) > 0;

function textLines(p, value, x, y, width = 30, size = 1.75, color = C.cream, align = 'left', limit = 4) {
    const lines = []; let line = '';
    for (const word of String(value || '').split(/\s+/)) {
        if (line && line.length + word.length + 1 > width) { lines.push(line); line = word; }
        else line += (line ? ' ' : '') + word;
    }
    if (line) lines.push(line);
    lines.slice(0, limit).forEach((text, i) => p.text(text, x, y + i * size * 1.5, size, color, align));
}
function titleText(p, text, x, y, size, color = C.cream, align = 'center', alpha = 1) {
    p.heading(text, x, y + .28, size, C.deep, align, alpha);
    p.heading(text, x, y, size, color, align, alpha);
}
function star(p, x, y, r, color, alpha = 1) {
    p.poly(Array.from({ length: 10 }, (_, i) => { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * .45 : r;
        return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]; }), color, null, 0, alpha);
}
function panel(p, x, y, w, h, alpha = .94, color = C.gold) {
    p.roundRect(x, y + .45, w, h, 1.6, C.deep, null, .65);
    p.roundRect(x, y, w, h, 1.6, C.panel, color, alpha);
    p.line(x + 2, y + .45, x + w - 2, y + .45, color, .11, .6);
    for (const [xx, yy, sign] of [[x + 1.2, y + 1.2, 1], [x + w - 1.2, y + h - 1.2, -1]]) {
        p.line(xx, yy, xx + sign * 2.4, yy, color, .16, .65);
        p.line(xx, yy, xx, yy + sign * 2.4, color, .16, .65);
    }
}
function disabled(p, label, x, y, w, h) {
    p.roundRect(x, y, w, h, 1, [24, 41, 52], C.line);
    p.heading(label, x + w / 2, y + (h - 1.7) / 2, 1.7, C.muted, 'center');
}
function lock(p, x, y, r = 1.3) {
    p.arc(x, y - r * .25, r * .56, Math.PI, Math.PI, C.muted, r * .17);
    p.roundRect(x - r * .75, y - r * .1, r * 1.5, r * 1.25, r * .12, C.muted);
    p.circle(x, y + r * .3, r * .12, C.deep);
}

function jewel(p, type, x, y, r, options = {}) {
    const shape = CUTS[type % 6], alpha = options.alpha === undefined ? 1 : options.alpha;
    const sy = options.stretch || 1, sx = 1 / Math.sqrt(sy), special = options.special;
    const at = (points, scale = 1, dx = 0, dy = 0) => points.map(([a, b]) => [x + dx + a * r * scale * sx, y + dy + b * r * scale * sy]);
    const base = special === 'prism' ? C.cream : C.jewel[type], dark = special === 'prism' ? C.dark[5] : C.dark[type];
    p.poly(at(shape, 1.02, .1, r * .12), C.deep, null, 0, alpha * .68);
    p.poly(at(shape), dark, null, 0, alpha);
    p.poly(at(shape, .89, 0, -r * .065), base, null, 0, alpha);
    if (!options.simple) {
        p.poly(at([[0, -.81], [-.7, -.04], [-.36, .49], [0, .17]]), special === 'prism' ? C.light[5] : C.light[type], null, 0, alpha * .9);
        p.poly(at([[.05, -.61], [.75, -.02], [.4, .57], [0, .21]]), special === 'prism' ? C.light[4] : dark, null, 0, alpha * .5);
    }
    p.poly(at([[-.18, -.56], [.13, -.64], [.29, -.4], [-.07, -.22]]), C.cream, null, 0, alpha * .9);
    if (special === 'row') {
        p.line(x - r * .75, y + r * .08, x + r * .75, y + r * .08, C.cream, r * .17, alpha);
        p.star(x - r * .72, y + r * .08, r * .21, C.cream, alpha);
    } else if (special === 'col') {
        p.line(x, y - r * .73, x, y + r * .74, C.cream, r * .17, alpha);
        p.star(x, y + r * .7, r * .21, C.cream, alpha);
    } else if (special === 'burst') {
        p.ngon(x, y, r * .55, 8, Math.PI / 8, C.deep, C.cream, alpha * .85);
        p.star(x, y, r * .39, C.cream, alpha);
    } else if (special === 'prism') {
        p.ngon(x, y, r * .52, 6, -Math.PI / 2, C.jewel[4], C.cream, alpha);
        p.star(x, y, r * .36, C.cream, alpha);
    }
}

function keepsake(p, realmIndex, x, y, r, alpha = 1) {
    if (realmIndex === 0) {
        for (let i = 0; i < 8; i++) {
            const angle = i * TAU / 8;
            p.line(x + Math.cos(angle) * r * .91, y + Math.sin(angle) * r * .91,
                x + Math.cos(angle) * r * 1.25, y + Math.sin(angle) * r * 1.25,
                C.gold, i % 2 ? .18 : .3, alpha);
        }
        p.ngon(x, y, r, 4, 0, C.gold, C.light[1], alpha);
        jewel(p, 1, x, y, r * .73, { alpha });
    } else if (realmIndex === 1) {
        for (let i = 0; i < 6; i++) {
            const angle = i * TAU / 6 - Math.PI / 2, radial = distance => [x + Math.cos(angle) * distance, y + Math.sin(angle) * distance];
            const middle = radial(r * .69), across = r * .31;
            p.poly([radial(r * .23), [middle[0] - Math.sin(angle) * across, middle[1] + Math.cos(angle) * across],
                radial(r * 1.18), [middle[0] + Math.sin(angle) * across, middle[1] - Math.cos(angle) * across]],
            i % 2 ? C.jewel[2] : C.mint, C.light[2], .08, alpha);
        }
        jewel(p, 2, x, y, r * .57, { alpha });
        p.star(x, y, r * .24, C.light[1], alpha);
    } else {
        star(p, x, y, r * 1.22, C.light[4], alpha);
        star(p, x, y, r * 1.01, C.jewel[0], alpha);
        jewel(p, 4, x, y, r * .75, { alpha });
        p.star(x + r * .63, y - r * .7, r * .22, C.cream, alpha);
    }
}

function background(p, s) {
    const realm = realmFor(s), t = clock(s);
    if (s.hasArt && realm.assetId) p.image(realm.assetId, 0, 0, 160, 90);
    else {
        p.rect(0, 0, 160, 90, C.bg);
        for (let i = 0; i < 5; i++) p.arc(123, 45, 17 + i * 7, .2, TAU * .88, i % 2 ? realm.color : C.gold, .12, .13);
        p.poly([[0, 65], [43, 43], [89, 72], [160, 51], [160, 90], [0, 90]], [16, 42, 52]);
        for (let i = 0; i < 16; i++) p.star(6 + (i * 37.7) % 147, 12 + (i * 29.1) % 65, .2 + i % 3 * .13, C.gold, .35);
    }
    if (s.screen !== 'home') {
        p.rect(0, 0, 160, 9.3, C.deep, .87);
        p.heading('F A C E T', 7, 3.1, 3.2, C.cream);
        p.ngon(3.5, 5, .95, 4, 0, C.gold);
    }
    if (s.screen === 'play') {
        const callout = s.engine.callout, celebrating = callout && callout.life > 0 && callout.priority >= 2 && !s.engine.paused && !s.tutorial && !['won', 'lost'].includes(s.engine.phase);
        const label = celebrating ? callout.title : mode(s) === 'zen' ? 'Zen' : mode(s) === 'rush' ? 'Rush' : selectedLevel(s).name;
        p.heading(label, 79, celebrating ? 3.5 : 4.2, celebrating ? 2.6 : 1.75, celebrating ? callout.color : C.gold, 'center');
        p.button('PAUSE', 136, 2.4, 18.5, 5.2, 'pause', false, true);
    } else {
        p.button('SOUND ' + (s.settings.sound ? 'ON' : 'OFF'), 133, 2.4, 22, 5.2, 'sound', false, true);
    }
}
function nav(p, s) {
    const items = [['HOME', 'home', 22], ['JOURNEY', 'journey', 28], ['COLLECTION', 'collection', 31]];
    let x = 7;
    for (const [label, screen, w] of items) { p.button(label, x, 85.7, w, 3.5, 'screen:' + screen, s.screen === screen, true); x += w + 3; }
}
function home(p, s) {
    const pr = progress(s), t = clock(s);
    p.text('FACET', 10.4, 24.8, 15.5, C.deep, 'left', .9, 'Georgia, serif');
    p.text('FACET', 10, 24, 15.5, C.cream, 'left', 1, 'Georgia, serif');
    p.arc(123, 39, 22, t * .03, TAU * .92, C.gold, .15, .65);
    p.arc(123, 39, 18.5, -t * .08, TAU * .87, C.mint, .13, .5);
    jewel(p, 5, 123, 39, 14.5, { special: 'prism' });
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + t * .06; p.star(123 + Math.cos(a) * 22, 39 + Math.sin(a) * 22, .55, C.light[i], .85); }
    if (s.hasResume) {
        p.button('CONTINUE', 11, 56.5, 45, 10, 'continue', true);
        p.button('JOURNEY', 59, 56.5, 29, 10, 'screen:journey');
        p.text(s.resumeLabel || '', 33.5, 68, 1.55, C.muted, 'center');
    } else p.button('PLAY', 11, 56.5, 77, 10, 'screen:journey', true);
    p.button('ZEN', 11, 71, 37, 7.7, 'zen', false, true);
    p.button('RUSH · 2 MIN', 51, 71, 37, 7.7, 'rush', false, true);
    panel(p, 100, 65, 48, 15.2, .9, C.line);
    p.heading('COLLECTION', 124, 68.2, 2.1, C.cream, 'center');
    star(p, 118, 75.4, 1.2, C.gold);
    p.text(pr.totalStars + ' / 90', 121, 74.4, 1.9, C.gold);
    p.buttons.push({ x: 100, y: 65, w: 48, h: 15.2, action: 'screen:collection' });
}
function journey(p, s) {
    const pr = progress(s), realmIndex = s.selectedRealm || 0, realm = REALMS[realmIndex];
    REALMS.forEach((item, i) => {
        const x = 7 + i * 50;
        p.button(item.name.toUpperCase(), x, 12.4, 46, 7.2, 'realm:' + i, i === realmIndex, true);
    });
    const entries = LEVELS.filter(level => level.realmIndex === realmIndex);
    const selected = entries.find(level => level.index === s.selectedLevel) || entries[0];
    panel(p, 7, 24, 100, 58, .64, realm.color);
    const points = [[18, 40], [37, 47], [56, 38], [75, 47], [95, 38], [95, 66], [75, 72], [56, 63], [37, 72], [18, 64]];
    for (let i = 0; i < 9; i++) p.line(...points[i], ...points[i + 1], pr.medals[entries[i].index] ? C.gold : C.line, .32, .65);
    entries.forEach((level, i) => {
        const [x, y] = points[i], unlocked = canPlay(s, level.index), active = level.index === selected.index;
        if (active || s.focusAction === 'level:' + level.index || s.hoverAction === 'level:' + level.index) p.ngon(x, y, 5.2, 4, 0, null, C.gold);
        if (unlocked) { jewel(p, realmIndex * 2 + 1, x, y, 3.8); p.heading(i + 1, x, y - 1.2, 2.3, C.deep, 'center'); }
        else { p.ngon(x, y, 3.7, 4, 0, C.panel, C.line); lock(p, x, y - .3, 1.15); }
        for (let j = 0; j < 3; j++) star(p, x - 2.2 + j * 2.2, y + 5.2, .83, j < (pr.medals[level.index] || 0) ? C.gold : C.line);
        if (unlocked) p.buttons.push({ x: x - 5, y: y - 4.8, w: 10, h: 12, action: 'level:' + level.index });
    });
    panel(p, 112, 24, 42, 58, .97, C.gold);
    p.text(String(selected.index + 1).padStart(2, '0'), 133, 27, 1.5, C.gold, 'center');
    textLines(p, selected.name, 133, 31, 23, 2.7, C.cream, 'center', 2);
    p.heading(selected.moves + ' MOVES', 133, 41.3, 2.2, C.mint, 'center');
    p.text('2 STAR SCORE', 116, 46, 1.5, C.muted); p.heading(number(selected.parScore), 150, 45.9, 1.8, C.gold, 'right');
    if (pr.bests[selected.index]) { p.text('BEST', 116, 50, 1.5, C.muted); p.heading(number(pr.bests[selected.index]), 150, 49.9, 1.8, C.cream, 'right'); }
    if (!canPlay(s, selected.index)) textLines(p, 'Clear the previous level to unlock.', 116, 59, 30, 1.6, C.muted, 'left', 2);
    if (canPlay(s, selected.index)) p.button(pr.medals[selected.index] ? 'REPLAY' : 'PLAY', 117, 72.5, 32, 6.6, 'start', true, true);
    else disabled(p, 'LOCKED', 117, 72.5, 32, 6.6);
    nav(p, s);
}
function collection(p, s) {
    const pr = progress(s);
    titleText(p, 'COLLECTION', 80, 13, 4.9, C.cream);
    REALMS.forEach((realm, i) => {
        const x = 7 + i * 50, earned = pr.completedRealms.includes(i);
        panel(p, x, 23, 46, 15, .93, earned ? C.gold : C.line);
        keepsake(p, i, x + 7, 30.5, 3.9, earned ? 1 : .3);
        p.heading(realm.keepsake.name, x + 14, 25.7, 2, earned ? C.gold : C.muted);
        if (!earned) textLines(p, 'Complete ' + realm.name, x + 14, 30, 30, 1.5, C.muted, 'left', 2);
    });
    const rows = Math.ceil(ACHIEVEMENTS.length / 3), height = Math.min(13, 41 / Math.max(1, rows));
    ACHIEVEMENTS.forEach((award, i) => {
        const x = 7 + i % 3 * 50, y = 41 + Math.floor(i / 3) * height, earned = pr.achievements.includes(award.id);
        const value = Math.min(award.target, achievementValue(pr, award));
        p.roundRect(x, y, 46, height - 1, 1.1, C.panel, earned ? C.gold : C.line, .95);
        star(p, x + 3.5, y + 3.7, 1.6, earned ? C.gold : C.line);
        p.heading(award.title, x + 7, y + 1.1, 1.85, earned ? C.gold : C.cream);
        textLines(p, award.description, x + 7, y + 4, 39, 1.4, C.muted, 'left', 2);
        if (!earned) p.text(number(value) + '/' + number(award.target), x + 44, y + height - 3.5, 1.2, C.mint, 'right');
    });
    nav(p, s);
    p.button('HOW TO PLAY', 120, 85.7, 33, 3.5, 'tutorial', false, true);
}

function boardFrame(p, s) {
    const e = s.engine, realm = realmFor(s), radiant = e.radiantActive || e.radiantMoves > 0;
    p.roundRect(10.2, 10.2, 75.6, 75.6, 2.1, C.deep);
    p.roundRect(10.8, 10.7, 74.4, 74.5, 1.9, [103, 85, 65], radiant ? C.cream : C.gold);
    p.roundRect(11.4, 11.3, 73.2, 73.3, 1.4, C.gold);
    if (s.hasArt) p.image(realm.assetId, BOARD.x, BOARD.y, BOARD.size, BOARD.size, 1,
        { cropLeft: 7.5, cropRight: 47.5, cropTop: 13.333, cropBottom: 6.667 });
    p.rect(BOARD.x, BOARD.y, BOARD.size, BOARD.size, C.deep, .91);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const [x, y] = cell(c, r), selected = e.selected && e.selected.row === r && e.selected.col === c;
        const hover = e.hovered && e.hovered.row === r && e.hovered.col === c;
        const hinted = e.hintPair && e.hintPair.some(item => item.row === r && item.col === c);
        const color = selected ? [62, 65, 63] : hover ? [27, 52, 64] : (r + c) % 2 ? [15, 34, 46] : [18, 38, 49];
        p.roundRect(x + .16, y + .16, 8.68, 8.68, .5, color, selected ? C.gold : hinted ? C.mint : null);
    }
    for (const [x, y] of [[11.2, 11.2], [84.8, 11.2], [11.2, 84.8], [84.8, 84.8]]) p.ngon(x, y, .65, 4, 0, C.cream);
    if (radiant) {
        const alpha = s.settings.reduced ? .85 : .7 + Math.sin(clock(s) * 3) * .15;
        p.line(12, 10.5, 84, 10.5, C.mint, .3, alpha); p.line(10.5, 12, 10.5, 84, C.mint, .3, alpha);
        p.line(85.5, 12, 85.5, 84, C.mint, .3, alpha); p.line(12, 85.5, 84, 85.5, C.mint, .3, alpha);
    }
}
function board(p, s) {
    const e = s.engine, t = clock(s); boardFrame(p, s);
    p.setClip({ x: BOARD.x, y: BOARD.y, w: BOARD.size, h: BOARD.size });
    const gems = e.gems || e.board.flat().filter(Boolean);
    const specialCount = gems.filter(gem => gem.active !== false && gem.special).length;
    const frostCount = (e.frost || []).flat().filter(Boolean).length;
    const simple = specialCount > 12 || frostCount > 24 && (e.particles || []).length > 20;
    if (!s.settings.reduced && e.shake > 0 && !e.paused && !s.tutorial) {
        const amount = Math.min(.32, e.shake);
        p.ox = Math.sin(t * 103) * amount; p.oy = Math.cos(t * 89) * amount;
    }
    for (const gem of gems) {
        if (gem.active === false) continue;
        const [x, y] = cell(gem.x, gem.y), selected = e.selected && e.selected.row === gem.row && e.selected.col === gem.col;
        let radius = 3.45 * (selected ? 1.07 : 1), alpha = 1, stretch = 1;
        if (e.matchingKeys && e.matchingKeys.has(gem.row + ',' + gem.col)) radius *= s.settings.reduced ? 1.05 : 1.06 + Math.sin(t * 23) * .035;
        if (gem.shatter) { const age = clamp(gem.shatter.age / gem.shatter.duration, 0, 1); radius *= 1 + age * .19; alpha = 1 - age; }
        if (!s.settings.reduced && gem.anim && gem.anim.kind === 'fall') {
            const phase = gem.anim.progress || 0;
            stretch = phase < .8 ? 1 + .12 * (1 - phase) : 1 - Math.sin((phase - .8) / .2 * Math.PI) * .1;
        }
        jewel(p, gem.type, x, y, radius, { alpha, stretch, special: gem.special, simple });
        if (!gem.special && !s.settings.reduced && (Math.floor(t * 1.5) + gem.id) % 23 === 0) p.star(x + radius * .22, y - radius * .47, .28, C.cream, alpha * .7);
    }
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
        const layers = e.frost && e.frost[row] && e.frost[row][col];
        if (!layers) continue;
        const [x, y] = cell(col + .5, row + .5);
        p.roundRect(x - 3.95, y - 3.95, 7.9, 7.9, .7, [148, 230, 242], C.light[5], layers > 1 ? .21 : .13);
        p.line(x - 3.2, y - 3.2, x - 1.6, y - 2.5, C.cream, .16, .65);
        p.line(x - 1.6, y - 2.5, x - 2.2, y - 1, C.cream, .16, .65);
        if (layers > 1) p.line(x + 2.1, y + 1, x + 3.2, y + 3.1, C.cream, .2, .7);
    }
    // A modal freezes the board. Omit its transient flashes behind the veil so
    // dense special/frost boards leave ample native-frame room for the dialog.
    if (!e.paused && !s.tutorial && !['won', 'lost'].includes(e.phase)) boardEffects(p, s);
    p.ox = p.oy = 0;
    if (s.cursorVisible && s.cursor) {
        const [x, y] = cell(s.cursor.col + .5, s.cursor.row + .5);
        for (const [dx, dy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
            p.line(x + dx * 4.1, y + dy * 4.1, x + dx * 2.7, y + dy * 4.1, C.cream, .25);
            p.line(x + dx * 4.1, y + dy * 4.1, x + dx * 4.1, y + dy * 2.7, C.cream, .25);
        }
    }
    p.setClip();
}
function boardEffects(p, s) {
    const e = s.engine;
    for (const beam of (e.beams || []).slice(-6)) {
        const alpha = clamp(beam.life / (beam.maxLife || 1), 0, 1), color = beam.color || C.cream;
        const a = cell(beam.x1 === undefined ? beam.x : beam.x1, beam.y1 === undefined ? beam.y : beam.y1);
        const b = cell(beam.x2 === undefined ? beam.xx : beam.x2, beam.y2 === undefined ? beam.yy : beam.y2);
        if ([...a, ...b].every(Number.isFinite)) { p.line(...a, ...b, color, 1.2, alpha * .24); p.line(...a, ...b, C.cream, .24, alpha); }
    }
    for (const ring of (e.rings || []).slice(-4)) {
        const [x, y] = cell(ring.x, ring.y), alpha = clamp(ring.life / (ring.maxLife || 1), 0, 1);
        p.arc(x, y, (ring.r || .2) * BOARD.cell, 0, TAU, ring.color || C.gold, .22, alpha * .7);
    }
    if (!s.settings.reduced) for (const part of (e.particles || []).slice(-34)) {
        const [x, y] = cell(part.x, part.y), alpha = clamp(part.life / (part.maxLife || 1), 0, 1);
        p.ngon(x, y, (part.r || part.size || .07) * BOARD.cell, 4, part.rotation || 0, part.color || C.gold, null, alpha);
    }
    for (const popup of (e.popups || []).slice(-6)) {
        const [x, y] = cell(popup.x, popup.y);
        if (y >= BOARD.y && y <= BOARD.y + BOARD.size - 2.5) p.heading(popup.text,
            clamp(x, BOARD.x + 7, BOARD.x + BOARD.size - 7), y, 1.85, popup.color || C.gold, 'center', clamp(popup.life / .4, 0, 1));
    }
}
function goalLabel(goal) {
    if (goal.type === 'collect' || goal.type === 'color') return (NAMES[goal.color] || 'JEWELS').toUpperCase();
    if (goal.type === 'frost') return 'FROST';
    if (goal.type === 'score') return 'SCORE';
    if (goal.type === 'specials') return 'SPECIALS';
    return String(goal.type || 'OBJECTIVE').toUpperCase();
}
function hud(p, s) {
    const e = s.engine, currentMode = mode(s), goals = e.goalProgress || [];
    panel(p, 96, 12, 58, 71.8, .95, C.line);
    p.text('SCORE', 101, 16, 1.55, C.muted);
    titleText(p, number(s.displayScore === undefined ? e.score : s.displayScore), 101, 20, e.score >= 1000000 ? 5.1 : 6.2, C.cream, 'left');
    p.line(101, 29.3, 149, 29.3, C.gold, .12, .7);
    p.heading(currentMode === 'rush' ? 'TIME' : currentMode === 'zen' ? 'BEST CASCADE' : 'MOVES', 101, 33.1, 1.7, C.muted);
    p.heading(currentMode === 'rush' ? formatTime(e.timeLeft) : currentMode === 'zen' ? '×' + (e.maxCascade || 1) : e.movesLeft, 149, 31, 4.9,
        currentMode === 'rush' && e.timeLeft < 20 || currentMode === 'journey' && e.movesLeft <= 5 ? C.jewel[0] : C.gold, 'right');
    if (currentMode === 'journey') goals.slice(0, 3).forEach((goal, i) => {
        const y = 42 + i * 6.6, color = goal.complete ? C.mint : C.cream;
        if (goal.type === 'collect' || goal.type === 'color') jewel(p, goal.color || 0, 103.5, y + 1, 1.45);
        else if (goal.type === 'frost') p.ngon(103.5, y + 1, 1.45, 6, 0, C.light[5], C.cream, .7);
        else star(p, 103.5, y + 1, 1.4, C.gold);
        p.text(goalLabel(goal), 107, y - .1, 1.45, color);
        p.heading(number(Math.min(goal.target, goal.current || 0)) + ' / ' + number(goal.target), 149, y + 2.4, 1.55, color, 'right');
        p.roundRect(107, y + 3.9, 25, .5, .2, C.line);
        if (goal.current > 0) p.roundRect(107, y + 3.9, 25 * Math.min(1, goal.current / goal.target), .5, .2, goal.complete ? C.mint : C.gold);
    });
    else {
        p.text('Best  ' + number(currentMode === 'zen' ? progress(s).zenBest : progress(s).rushBest), 125, 49, 1.8, C.gold, 'center');
    }
    const radiant = e.radiantMoves > 0 || e.radiantActive, charge = clamp((e.radiance || 0) / 100, 0, 1);
    p.arc(108, 72.5, 7.1, 0, TAU, C.line, .24, .65);
    if (radiant || charge > 0) p.arc(108, 72.5, 7.1, -Math.PI / 2, TAU * (radiant ? 1 : charge), radiant ? C.mint : C.gold, .46);
    jewel(p, 5, 108, 72.5, 3.7, { special: radiant ? 'prism' : null });
    p.heading(radiant ? 'RADIANT!' : 'RADIANCE', 119, 65.4, 2.35, radiant ? C.mint : C.gold);
    p.text(radiant ? (e.radiantMoves || 1) + ' moves · ×2' : Math.floor(e.radiance || 0) + '%', 119, 70, 1.55, C.cream);
    p.button('HINT', 119, 75.3, 14, 5.4, 'hint', false, true);
    p.button('HELP', 136, 75.3, 14, 5.4, 'tutorial', false, true);

}

function modal(p, s) {
    const e = s.engine, tutorial = s.tutorial, paused = e.paused || s.paused;
    p.rect(0, 9.3, 160, 76, C.deep, .78);
    panel(p, 30, 15, 100, 67, .99, C.gold);
    if (tutorial) {
        titleText(p, 'HOW TO PLAY', 80, 20, 5.2, C.cream);
        p.text('Swap neighboring jewels to match three or more.', 80, 28, 2, C.muted, 'center');
        const specials = [['row', 'MATCH 4', 'A beam clears a full line.'], ['burst', 'MATCH A T OR L', 'A starburst clears its neighbors.'], ['prism', 'MATCH 5', 'A prism clears one whole color.']];
        specials.forEach(([special, heading, caption], i) => {
            const x = 48 + i * 32;
            jewel(p, i + 1, x, 40, 4.5, { special });
            p.heading(heading, x, 47.7, 1.85, C.gold, 'center');
            textLines(p, caption, x, 52.2, 24, 1.6, C.muted, 'center', 2);
        });
        p.text('Swap two specials to combine them.', 80, 61, 2, C.cream, 'center');
        p.text('Radiance: 3 moves at ×2. Match over frost to clear it.', 80, 65, 1.55, C.muted, 'center');
        p.text('Drag or tap · Arrows + Enter · H: hint · P: pause', 80, 68.5, 1.45, C.muted, 'center');
        p.button('PLAY', 52, 72.5, 56, 7, 'dismissTutorial', true); return;
    }
    if (paused) {
        jewel(p, 5, 80, 29, 6, { special: 'prism' });
        titleText(p, 'PAUSED', 80, 38, 4.6, C.cream);
        p.button('RESUME', 49, 47.5, 62, 8, 'resume', true);
        p.button('SOUND ' + (s.settings.sound ? 'ON' : 'OFF'), 38, 60, 26, 6, 'sound', false, true);
        p.button('MUSIC ' + (s.settings.music ? 'ON' : 'OFF'), 67, 60, 26, 6, 'music', false, true);
        p.button('FX ' + (s.settings.reduced ? 'LOW' : 'FULL'), 96, 60, 26, 6, 'effects', false, true);
        p.button('RESTART', 40, 71.5, 37, 6, 'retry', false, true); p.button('HOME', 83, 71.5, 37, 6, 'home', false, true); return;
    }
    const won = e.phase === 'won', result = e.result || {}, stars = result.stars || (won ? 1 : 0), currentMode = mode(s), age = s.resultAge || 0;
    titleText(p, currentMode === 'rush' ? 'TIME UP' : won ? 'COMPLETE' : 'OUT OF MOVES', 80, 21, 4.7, C.cream);
    if (won && currentMode === 'journey') {
        for (let i = 0; i < 3; i++) {
            const lit = i < stars && (s.settings.reduced || age >= i * .25 + .15), x = 65 + i * 15, y = i === 1 ? 37 : 38.5;
            star(p, x, y + .45, 5.4, C.deep); star(p, x, y, 5, lit ? C.gold : C.line);
            if (lit) p.star(x - 1, y - 1.5, 1.1, C.cream, .8);
        }
    } else jewel(p, won || currentMode === 'rush' ? 5 : 0, 80, 37, 6.8, { special: won || currentMode === 'rush' ? 'prism' : null });
    titleText(p, number(s.displayScore === undefined ? e.score : s.displayScore), 80, 46, 6.7, C.gold);
    if (won && currentMode === 'journey') {
        p.text('Move bonus  +' + number(result.reserveBonus), 80, 57, 1.85, C.muted, 'center');
    }
    const awards = s.newAwards || [];
    const noteY = won && currentMode === 'journey' ? 65.1 : 61;
    if (awards.length) p.heading((awards[0].title || awards[0].name || awards[0]), 80, noteY, 1.8, C.mint, 'center');
    else if (currentMode === 'journey') p.text(won ? stars >= 3 ? '' : 'Next star at ' + number(selectedLevel(s).parScore * (stars === 2 ? 1.6 : 1)) : '', 80, noteY, 1.9, C.muted, 'center');
    else p.text('Best cascade ×' + (e.maxCascade || 1) + '   /   Personal best ' + number(currentMode === 'rush' ? progress(s).rushBest : progress(s).zenBest), 80, 61, 1.8, C.muted, 'center');
    const nextLabel = selectedLevel(s).index === LEVELS.length - 1 ? 'COLLECTION' : selectedLevel(s).finale ? 'NEXT REALM' : 'NEXT';
    p.button(won && currentMode === 'journey' ? nextLabel : 'RETRY', 42, 71, 54, 7, won && currentMode === 'journey' ? 'next' : 'retry', true);
    p.button('HOME', 102, 71, 19, 7, 'home', false, true);
}

function render(p, s) {
    p.begin(); p.focusAction = s.focusAction; p.hoverAction = s.hoverAction;
    background(p, s);
    if (s.screen === 'play') { board(p, s); hud(p, s); }
    else ({ journey, collection, home }[s.screen] || home)(p, s);
    if (s.tutorial || s.screen === 'play' && (s.engine.paused || s.paused || ['won', 'lost'].includes(s.engine.phase))) {
        p.buttons = []; modal(p, s);
    }
    p.end();
}
module.exports = { render, BOARD, C, jewel, goalLabel };
