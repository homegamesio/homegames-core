'use strict';
const { TOWERS, ENEMIES, THEMES, ORDER, ENEMY_ORDER, DECOR, stats, fieldFor, clamp } = require('./content');
const { VIEWPORT, fitZoom, worldBounds } = require('./camera');
const { LEVELS, BASE_COUNT } = require('./levels');
const { waveSummary, MAP_SIZES, MAX_MAPS } = require('./design');
const { C, tint, symbol, cowboy, upgradeBadge, defeated, scenery, saloon, landscape } = require('./art');
const numberText = value => String(Math.round(value * 100) / 100);

function top(p, title, subtitle) {
    p.rect(0, 0, 160, 100, C.deep); p.rect(3, 3, 154, 94, C.paper); p.rect(5, 5, 150, 90, C.cream);
    p.text(title, 10, 9, 5, C.deep, 'left', true); if (subtitle) p.text(subtitle, 10, 17, 1.8, C.brown);
    p.button('home', '', 141, 8, 10, 9, C.deep, true, 'home');
}
function home(g, p) {
    const level = LEVELS[g.progress.unlocked]; landscape(p, { ...level, paths: [], decor: [] }, g.clock);
    p.poly([[85, 11], [160, 11], [160, 100], [107, 100], [91, 77], [104, 47]], THEMES[level.theme].rock, .18);
    scenery(p, { kind: 'rock', x: 145, y: 49 }, level.theme, 0, 4);
    scenery(p, { kind: 'cactus', x: 91, y: 72 }, level.theme, 0, 2);
    scenery(p, { kind: 'cactus', x: 152, y: 91 }, level.theme, 0, 2.5);
    p.poly([[80, 100], [103, 60], [119, 62], [103, 100]], C.paper, .85);
    saloon(p, 120, 60, g.clock, 0, 3);
    cowboy(p, 'deputy', 101, 84, 2.3, g.clock, { aim: -.5, rank: 2, branch: 1 });
    cowboy(p, 'rider', 136, 85, 2.1, g.clock, { enemy: true, walk: true });
    scenery(p, { kind: 'tumbleweed', x: 78 + Math.sin(g.clock * .15) * 4, y: 91 }, level.theme, g.clock, 1.8);
    p.panel(8, 9, 69, 5, C.deep); p.text('A LITTLE SALOON. A LOT TO LOSE.', 42.5, 10, 1.8, C.cream, 'center');
    p.text('GOLD', 9, 21, 14, C.deep, 'left', true); p.text('& GRIT', 9, 36, 12.2, C.deep, 'left', true);
    p.line(10, 53, 71, 53, .45, C.brown); p.star(40, 53, 2.2, C.brown);
    p.text('Keep the gold. Keep your friends.', 10, 59, 2.7, C.brown);
    p.text(g.badlandsUnlocked ? 'The Badlands are open. Ride beyond.' : '30 trails through the wild frontier', 10, 64, 1.9, C.brown);
    p.button(g.resume ? 'resume' : 'continue', g.resume ? 'CONTINUE THE RUN' : g.badlandsUnlocked ? 'RIDE BEYOND' : 'RIDE OUT', 10, 71, 61, 9, C.deep);
    p.button('campaign', 'THE TRAIL', 10, 83, 29, 7, C.paper); p.button('library', 'WORKSHOP', 42, 83, 29, 7, C.paper);
    const visible = g.badlandsUnlocked ? LEVELS.length : BASE_COUNT;
    p.text(`${g.progress.stars.slice(0, visible).reduce((a, b) => a + b, 0)} / ${visible * 3}`, 15, 94, 1.7, C.brown); p.star(11, 95, 1.2, C.gold);
    p.text('Tap a cowboy. Pick a spot. Ring the bell.', 81, 96, 1.7, C.deep);
}
function campaign(g, p) {
    const secret = g.badlandsUnlocked && g.campaignPage === 1, offset = secret ? BASE_COUNT : 0;
    top(p, g.copyPicker ? 'MAKE IT YOUR FRONTIER' : secret ? 'THE BADLANDS' : 'THE GOLD TRAIL', g.copyPicker ? 'Choose a stage to open a copy in the workshop.' : secret ? 'Beyond the frontier. Thirty more stands for a seasoned posse.' : 'Five counties. Thirty stands. Every star earned.');
    for (let chapter = 0; chapter < 5; chapter++) {
        const y = 26 + chapter * 13.5, c = THEMES[chapter + (secret ? 5 : 0)];
        p.rect(9, y - 2, 141, 12.5, c.sand); p.text(c.name, 11, y + 2.3, 1.55, C.brown);
        for (let j = 0; j < 6; j++) {
            const i = offset + chapter * 6 + j, x = 43 + j * 17.5, available = g.copyPicker || i <= g.progress.unlocked;
            if (j < 5) p.line(x + 6, y + 3, x + 17, y + 3, .5, C.brown, .4);
            p.button('level:' + i, available ? String(i + 1) : '', x, y, 12, 7.5, available ? C.deep : tint(c.sand, .86), available, available ? null : 'lock');
            for (let s = 0; s < 3; s++) p.star(x + 3 + s * 3, y + 10, .9, s < g.progress.stars[i] ? C.gold : tint(c.sand, .78));
        }
    }
    if (g.badlandsUnlocked) {
        p.button('campaign-page:0', 'THE GOLD TRAIL', 10, 94, 38, 5, secret ? C.paper : C.gold);
        p.button('campaign-page:1', 'THE BADLANDS', 111, 94, 38, 5, secret ? C.gold : C.paper);
        p.text(secret ? '31 — 60' : '1 — 30', 80, 95, 1.8, C.brown, 'center');
    } else p.text('Stars celebrate the gold you kept. One win opens the next trail.', 80, 95, 1.7, C.brown, 'center');
}
function header(g, p, level, editor = false) {
    p.rect(0, 0, 160, 11, C.deep); p.text(editor ? 'FRONTIER WORKSHOP' : 'GOLD & GRIT', 4, 2, 3, C.cream, 'left', true);
    if (editor) p.text(level.name, 52, 3.3, 2.2, C.paper);
    else {
        const e = g.run;
        symbol(p, 'gold', 47, 5.5, 2); p.text(e.gold + ' / ' + level.gold, 51, 3.4, 2.5, e.gold < level.gold / 3 ? [255, 151, 118] : C.cream);
        symbol(p, 'coin', 76, 5.5, 1.7); p.text(e.cash, 80, 3.4, 2.7, C.gold);
        p.text(`${Math.min(e.wave + 1, level.waves.length)} / ${level.waves.length}`, 105, 3.4, 2.5, C.cream);
        p.text('WAVE', 105, 7.3, 1.05, C.paper);
    }
    p.button('home', '', 126, 1.8, 8, 7, C.deep, true, 'home');
    p.button('sound', '', 137, 1.8, 8, 7, C.deep, true, g.muted ? 'mute' : 'sound');
    p.button(editor ? 'test' : 'speed', editor ? '' : g.run.speed + '×', 148, 1.8, 8, 7, C.deep, true, editor ? 'play' : null);
}
function range(p, x, y, r, c) { p.oval(x, y, r, r, c, .07, 32); p.outline(x, y, r, c, .7); }
function routeBadge(p, route, x, y, r) {
    const sides = route ? 4 : 12, color = route ? [132, 75, 137] : [46, 113, 154];
    p.oval(x, y, r, r, C.cream, 1, sides);
    p.oval(x, y, r * .84, r * .84, color, 1, sides);
    p.text(route + 1, x, y - r * .52, r * 1.05, C.cream, 'center');
}
function routeEntrances(g, p, level) {
    if (level.paths.length < 2) return;
    level.paths.forEach((path, route) => routeBadge(p, route, ...path[0], Math.max(2.7, 2.3 / g.camera.zoom)));
}
function battlefield(g, p) {
    const e = g.run; p.rect(0, 11, 124, 72, THEMES[e.level.theme].sand); p.rect(0, 11, 124, 7, C.deep); p.world(g.camera); landscape(p, e.level, g.clock);
    routeEntrances(g, p, e.level);
    const selected = e.towers.find(t => t.id === g.selected), preview = g.buildKind && g.hover && g.hoverVisible;
    if (selected) range(p, selected.x, selected.y, stats(selected).range, TOWERS[selected.kind].color);
    if (preview) range(p, g.hover.x, g.hover.y, TOWERS[g.buildKind].range, e.canPlace(g.buildKind, g.hover.x, g.hover.y) ? C.red : C.deep);
    for (const fire of e.fires) { p.oval(fire.x, fire.y, fire.radius, fire.radius * .6, C.red, .15); for (let i = 0; i < 5; i++) p.star(fire.x + Math.sin(i * 9) * fire.radius * .6, fire.y + Math.cos(i * 4) * fire.radius * .5, .8 + Math.sin(e.time * 12 + i) * .3, C.gold); }
    const endpoint = e.level.paths[0].at(-1);
    const actors = e.level.decor.filter(d => d.kind !== 'fence').map(d => ({ y: d.y, draw: () => scenery(p, d, e.level.theme, g.clock) }));
    actors.push({ y: endpoint[1], draw: () => saloon(p, ...endpoint, g.clock, e.saloonHit) });
    for (const t of e.towers) actors.push({ y: t.y, draw: () => {
        if (t.id === g.selected) p.oval(t.x, t.y, 3.2, 1.5, C.cream, .9);
        cowboy(p, t.kind, t.x, t.y, .8, e.time, t);
        if (t.kind === 'banjo' && e.phase === 'wave') symbol(p, 'music', t.x + Math.sin(e.time * 2) * 3, t.y - 6.8 - e.time % 1, .6, C.gold);
    } });
    for (const enemy of e.enemies) actors.push({ y: enemy.y, draw: () => {
        if (enemy.slowTime > 0) { p.oval(enemy.x, enemy.y, 2.7, 1.2, TOWERS.lasso.color, .3); p.oval(enemy.x, enemy.y - 1, 2, .5, C.gold, .6); }
        cowboy(p, enemy.kind, enemy.x, enemy.y, .65, e.time + enemy.id, { enemy: true, walk: true, flash: enemy.flash > 0 });
        if (enemy.hp < enemy.maxHp) { const w = enemy.kind === 'baron' ? 7 : 3.4; p.rect(enemy.x - w / 2, enemy.y - 6.6, w, .6, C.ink); p.rect(enemy.x - w / 2, enemy.y - 6.6, w * enemy.hp / enemy.maxHp, .6, C.red); }
        if (enemy.markTime > 0 && enemy.mark > 1) symbol(p, 'target', enemy.x, enemy.y - 7.7, .8, C.gold);
    } });
    for (const fx of e.effects) if (fx.kind === 'death') actors.push({ y: fx.y, draw: () => defeated(p, fx) });
    actors.sort((a, b) => a.y - b.y).forEach(a => a.draw());
    for (const shot of e.shots) {
        const t = shot.age / shot.life, x = shot.x + (shot.tx - shot.x) * t, y = shot.y + (shot.ty - shot.y) * t - Math.sin(t * Math.PI) * 8;
        p.oval(shot.tx, shot.ty, shot.radius, shot.radius * .5, C.red, .12); p.rect(x - .5, y - 1, 1, 2, C.red); p.star(x, y - 1.5, .6, C.gold);
    }
    for (const fx of e.effects) {
        const t = fx.age / fx.life;
        if (fx.kind === 'shot') p.line(fx.x, fx.y, fx.tx, fx.ty, .24, C.cream, 1 - t);
        else if (fx.kind === 'rope') { p.line(fx.x, fx.y, fx.tx, fx.ty, .2, C.gold, 1 - t); p.oval(fx.tx, fx.ty, 1.5, .7, C.gold, (1 - t) * .5); }
        else if (fx.kind === 'burst') { p.oval(fx.x, fx.y, fx.radius * (.2 + t), fx.radius * (.2 + t) * .65, C.gold, (1 - t) * .7, 12); p.star(fx.x, fx.y, 3 * (1 - t), C.cream); }
        else if (fx.kind === 'blood') {
            for (let i = 0; i < 3; i++) {
                const angle = fx.angle + (i - 1) * .85, travel = .35 + t * (1.3 + i * .35);
                const x = fx.x + Math.cos(angle) * travel, y = fx.y + Math.sin(angle) * travel - Math.sin(t * Math.PI) * .45 + t * t * .6;
                const size = (.24 + i % 2 * .08) * (1 - t * .45);
                p.poly([[x - size, y], [x, y - size], [x + size, y + size * .6]], [158, 49, 43], (1 - t) * .85);
            }
        }
        else if (fx.kind === 'death') defeated(p, fx, true);
        else if (fx.kind === 'upgrade') {
            p.outline(fx.x, fx.y, 2 + t * 4, C.gold, 1 - t, 16);
            for (let i = 0; i < fx.rank; i++) p.star(fx.x + (i - (fx.rank - 1) / 2) * 2.1, fx.y - 6.5 - t * 3, (1 - t) * 1.1, C.gold);
        }
        else if (fx.kind === 'steal') { symbol(p, 'gold', fx.x + t * 6, fx.y - 6 - t * 5, 1.2, C.gold); p.text('-' + fx.value, fx.x + t * 6, fx.y - 11 - t * 4, 2, C.red); }
        else { p.outline(fx.x, fx.y, 2 + t * 4, C.cream, 1 - t, 12); }
    }
    // Draw rank markers last so scenery and passing bandits cannot hide them.
    for (const tower of e.towers) if (tower.rank) upgradeBadge(p, tower.x, tower.y + 1.3, tower.rank, Math.max(1, .7 / g.camera.zoom));
    if (preview) { cowboy(p, g.buildKind, g.hover.x, g.hover.y, .8, g.clock); if (e.canPlace(g.buildKind, g.hover.x, g.hover.y)) symbol(p, 'close', g.hover.x, g.hover.y + 2, 1, C.red); }
    if (g.invalid && g.clock < g.invalid.until) { p.outline(g.invalid.x, g.invalid.y, 3.5, C.red); symbol(p, 'close', g.invalid.x, g.invalid.y, 1, C.red); }
    p.screen();
}
function navigation(g, p, level) {
    const y = g.screen === 'editor' ? 83.5 : 12, camera = g.camera;
    p.button('camera-pan', '', 86, y, 8, 5, g.cameraPan ? C.gold : C.deep, true, 'pan');
    p.button('camera-out', '−', 95, y, 8, 5, C.deep, camera.zoom > fitZoom(level) + .001);
    p.button('camera-in', '+', 104, y, 8, 5, C.deep, camera.zoom < 1.599);
    p.button('camera-fit', '', 113, y, 8, 5, C.deep, true, 'fit');
    const field = fieldFor(level);
    if (g.screen === 'editor') {
        p.button('tab:size', `${field.w} × ${field.h}`, 5, y, 26, 5, C.deep);
        p.text(Math.round(camera.zoom * 100) + '%', 34, y + 1.5, 1.5, C.deep);
        p.button('camera-map', 'MINIMAP', 45, y, 38, 5, g.editorMinimap ? C.gold : C.paper);
    }
    g.minimap = null;
    if (g.screen === 'editor' && !g.editorMinimap) return;
    if (field.w === 116 && field.h === 62 && camera.zoom <= 1.001) return;
    const bounds = worldBounds(level), x = 4, my = 63, w = 28, h = 17;
    const scale = Math.min((w - 2) / bounds.w, (h - 2) / bounds.h), ox = x + (w - bounds.w * scale) / 2, oy = my + (h - bounds.h * scale) / 2;
    const point = (x, y) => [ox + (x - bounds.x) * scale, oy + (y - bounds.y) * scale];
    p.panel(x - .3, my - .3, w + .6, h + .6, C.cream, .5); p.panel(x, my, w, h, C.deep, .4);
    for (const path of level.paths) { path.slice(1).forEach((b, i) => p.line(...point(...path[i]), ...point(...b), .55, C.paper)); if (level.paths.length === 1) p.oval(...point(...path[0]), .7, .7, C.red, 1, 6); }
    if (g.screen === 'play') {
        for (const t of g.run.towers) p.oval(...point(t.x, t.y), .45, .45, C.mint, 1, 4);
        for (const e of g.run.enemies) p.oval(...point(e.x, e.y), .5, .5, C.red, 1, 4);
    }
    p.star(...point(...level.paths[0].at(-1)), 1, C.gold);
    const left = clamp(camera.x - VIEWPORT.w / camera.zoom / 2, bounds.x, bounds.x + bounds.w), right = clamp(camera.x + VIEWPORT.w / camera.zoom / 2, bounds.x, bounds.x + bounds.w);
    const top = clamp(camera.y - VIEWPORT.h / camera.zoom / 2, bounds.y, bounds.y + bounds.h), bottom = clamp(camera.y + VIEWPORT.h / camera.zoom / 2, bounds.y, bounds.y + bounds.h);
    for (const [a, b] of [[[left, top], [right, top]], [[right, top], [right, bottom]], [[right, bottom], [left, bottom]], [[left, bottom], [left, top]]]) p.line(...point(...a), ...point(...b), .22, C.mint);
    if (level.paths.length > 1) level.paths.forEach((path, route) => routeBadge(p, route, ...point(...path[0]), 1.2));
    g.minimap = { x, y: my, w, h, ox, oy, scale, bounds };
    p.buttons.push({ id: 'minimap', x, y: my, w, h, enabled: true });
}
function towerPanel(g, p) {
    const e = g.run; p.rect(124, 11, 36, 89, C.deep); p.text('THE POSSE', 142, 15, 2.7, C.paper, 'center', true);
    ORDER.forEach((kind, i) => {
        const t = TOWERS[kind], x = 127 + i % 2 * 16, y = 23 + Math.floor(i / 2) * 19, unlocked = e.level.unlocked.includes(kind), chosen = g.buildKind === kind;
        p.button('tower:' + kind, '', x, y, 14, 17, chosen ? C.gold : unlocked ? C.paper : [83, 99, 84], unlocked);
        if (unlocked) {
            cowboy(p, kind, x + 7, y + 9, .78, g.clock); p.text(t.name, x + 7, y + 10.5, 1.45, C.deep, 'center');
            p.text('$' + t.cost, x + 7, y + 13.5, 1.8, e.cash >= t.cost ? C.deep : C.red, 'center');
        } else symbol(p, 'lock', x + 7, y + 8, 2, C.muted);
    });
    const paused = e.phase === 'wave' && e.paused;
    p.button('wave', '', 128, 83, 28, 12, e.phase === 'build' || paused ? C.gold : C.paper, ['wave', 'build'].includes(e.phase), e.phase === 'wave' && !e.paused ? 'pause' : 'play');
    p.text(e.phase === 'build' ? 'SEND WAVE' : paused ? 'RESUME' : 'PAUSE', 142, 96, 1.35, C.paper, 'center');
}
function bottom(g, p) {
    const e = g.run, selected = e.towers.find(t => t.id === g.selected);
    p.rect(0, 83, 124, 17, C.cream); p.rect(0, 82.5, 124, .5, C.brown);
    if (selected) {
        const t = TOWERS[selected.kind], s = stats(selected), cost = t.upgrades[selected.rank];
        cowboy(p, selected.kind, 8, 94, 1, g.clock, selected); p.text(t.name, 14, 85.3, 2.1, C.deep, 'left', true);
        if (selected.rank >= 2) p.text(t.branches[selected.branch], 14, 89.5, 1.6, C.brown);
        upgradeBadge(p, 20, selected.rank >= 2 ? 95 : 92, selected.rank, 1.25);
        p.button('target', '', 35, 86, 8, 8, C.deep, true, 'target'); p.text({ first: 'FIRST', last: 'LAST', strong: 'STRONG' }[selected.target], 39, 96, 1.1, C.brown, 'center');
        if (selected.rank < 3) {
            const branches = selected.rank === 1 ? [0, 1] : [selected.branch || 0];
            branches.forEach((branch, i) => {
                const x = 47 + i * 25, w = branches.length === 1 ? 49 : 23;
                p.button('upgrade:' + branch, '', x, 85, w, 11, C.deep, e.cash >= cost);
                symbol(p, selected.rank === 1 ? t.symbols[branch] : 'up', x + 4, 90.5, 1.7, C.gold);
                p.text('$' + cost, x + w - 3, 87, 2.2, e.cash >= cost ? C.cream : C.muted, 'right');
                p.text(selected.rank === 1 ? t.branches[branch] : selected.rank === 2 ? 'Legend' : 'Upgrade', x + w / 2, 93, 1.25, C.paper, 'center');
            });
        } else { p.text('LEGEND', 71, 88, 3, C.brown, 'center', true); for (let i = 0; i < 3; i++) p.star(65 + i * 6, 95, 1.1, C.gold); }
        p.button('sell', '$' + e.refund(selected), 102, 85, 17, 8, C.paper); p.text('SELL', 110, 95, 1.25, C.brown, 'center');
    } else if (g.buildKind) {
        cowboy(p, g.buildKind, 8, 95, 1.2, g.clock); p.text(TOWERS[g.buildKind].name, 16, 85.5, 2.4, C.deep, 'left', true);
        const icons = { deputy: 'fast', rifle: 'target', lasso: 'ring', dynamite: 'burst', gatling: 'fast', banjo: 'music' };
        symbol(p, icons[g.buildKind], 20, 94, 2, TOWERS[g.buildKind].color);
        p.text({ deputy: 'Quick shots', rifle: 'Long range • armor piercing', lasso: 'Ropes slow the bandits', dynamite: 'Explosions ignore armor', gatling: 'Rapid fire', banjo: 'Nearby friends shoot faster' }[g.buildKind], 27, 92, 1.9, C.brown);
        symbol(p, 'play', 85, 91, 1.6, C.brown); p.oval(95, 92, 4, 2, C.mint, .8); symbol(p, 'plus', 95, 91, 1.8, C.deep);
        p.button('cancel', '', 109, 86, 10, 9, C.paper, true, 'close');
    } else {
        p.text(e.phase === 'wave' ? 'ON THE TRAIL' : 'COMING NEXT', 5, 86, 1.65, C.brown);
        const wave = e.level.waves[Math.min(e.wave, e.level.waves.length - 1)];
        const counts = {}, split = e.level.paths.length > 1;
        const add = (v, count) => { const key = split ? v.route + ':' + v.kind : v.kind; if (!counts[key]) counts[key] = { kind: v.kind, route: v.route, count: 0 }; counts[key].count += count; };
        if (e.phase === 'wave') { e.enemies.forEach(v => add(v, 1)); e.queue.slice(e.spawnIndex).forEach(v => add(v, 1)); }
        else wave.forEach(v => add(v, v.count));
        const groups = Object.values(counts);
        if (split) groups.sort((a, b) => a.route - b.route || ENEMY_ORDER.indexOf(a.kind) - ENEMY_ORDER.indexOf(b.kind));
        groups.forEach(({ kind, route, count }, i) => {
            const x = split ? 40 + i * Math.min(16, 80 / groups.length) : 40 + i * 11;
            cowboy(p, kind, x, 94, .75, g.clock, { enemy: true }); p.text(count, x + 3, 94, 1.6, C.deep);
            if (split) routeBadge(p, route, x + 4, 86.5, 1.5);
        });
        if (e.wave === 0 && !e.towers.length) { p.text('1', 6, 93, 2, C.brown); cowboy(p, 'deputy', 14, 97, .65, g.clock); symbol(p, 'play', 22, 94, 1, C.brown); p.oval(29, 94, 2, 1, C.mint); }
    }
}
function result(g, p) {
    const e = g.run, win = e.phase === 'won', reveal = win && !g.testing && g.levelIndex === BASE_COUNT - 1 && g.badlandsUnlocked;
    p.rect(0, 11, 124, 72, C.deep, .55); p.panel(27, 28, 70, 43, C.cream, 2);
    p.text(win ? g.levelIndex === LEVELS.length - 1 ? 'LEGENDS OF THE WEST' : g.levelIndex === BASE_COUNT - 1 ? 'THE FRONTIER IS SAFE' : 'THE GOLD IS SAFE' : 'THEY GOT THE GOLD', 62, 34, 4.2, C.deep, 'center', true);
    if (reveal) p.text('THE BADLANDS AWAIT · 30 SECRET TRAILS', 62, 40, 1.7, C.brown, 'center', true);
    if (win) for (let i = 0; i < 3; i++) p.star(48 + i * 14, 48, 4.3, i < e.stars() ? C.gold : C.muted);
    else { symbol(p, 'gold', 54, 49, 4); p.text('0', 62, 45, 5, C.red); }
    p.text(win ? `${e.gold} / ${e.level.gold} gold kept` : 'Same trail. A new plan.', 62, 55, 2.2, C.brown, 'center');
    p.button('retry', 'RETRY', 32, 61, 27, 7, C.paper);
    const next = win && g.levelIndex + 1 < LEVELS.length;
    p.button(g.testing ? 'back-editor' : g.levelIndex < 0 ? 'library' : reveal ? 'badlands' : next ? 'next' : 'campaign', g.testing ? 'WORKSHOP' : g.levelIndex < 0 ? 'MAPS' : reveal ? 'THE BADLANDS' : next ? 'NEXT TRAIL' : 'THE TRAIL', 64, 61, 28, 7, C.deep);
}
function play(g, p) {
    battlefield(g, p); header(g, p, g.run.level); towerPanel(g, p); bottom(g, p);
    if (g.testing) p.button('back-editor', '← WORKSHOP', 5, 12, 25, 5, C.deep);
    else p.text(g.run.level.name, 6, 12.7, 2, C.cream, 'left', true);
    navigation(g, p, g.run.level);
    if (g.run.paused && g.run.phase === 'wave') { p.panel(74, 12, 9, 5, C.deep); symbol(p, 'pause', 78.5, 14.5, 1.4, C.gold); }
    if (['won', 'lost'].includes(g.run.phase)) result(g, p);
}
function library(g, p) {
    top(p, 'FRONTIER WORKSHOP', 'Build a trail. Arrange the ambush. Take it for a ride.');
    p.button('new-map', 'NEW MAP', 10, 25, 32, 8, C.deep);
    p.button('copy-campaign', 'COPY A STAGE', 46, 25, 32, 8, C.deep);
    p.button('import', 'IMPORT JSON', 82, 25, 32, 8, C.deep);
    p.button('export-pack', 'EXPORT PACK', 118, 25, 32, 8, C.deep, g.custom.length > 0);
    if (g.editor) p.button('edit-draft', 'CONTINUE DRAFT', 10, 37, 90, 7, C.gold);
    const pages = Math.max(1, Math.ceil(g.custom.length / 12)); g.libraryPage = clamp(g.libraryPage, 0, pages - 1);
    p.button('library-page:prev', '←', 105, 37, 9, 7, C.paper, g.libraryPage > 0);
    p.text(`${g.libraryPage + 1} / ${pages}`, 128, 38, 1.8, C.brown, 'center');
    p.text(`${g.custom.length} / ${MAX_MAPS} maps`, 128, 42, 1.1, C.brown, 'center');
    p.button('library-page:next', '→', 142, 37, 9, 7, C.paper, g.libraryPage < pages - 1);
    if (!g.custom.length) { p.text('Your frontier starts here.', 80, 57, 4, C.brown, 'center', true); p.text('Maps and scenery travel with copies of this game.', 80, 66, 2.2, C.brown, 'center'); }
    g.custom.slice(g.libraryPage * 12, (g.libraryPage + 1) * 12).forEach((level, slot) => {
        const i = g.libraryPage * 12 + slot, x = 10 + slot % 3 * 48, y = 49 + Math.floor(slot / 3) * 10;
        p.panel(x, y, 44, 8, THEMES[level.theme].sand); p.text(level.name.slice(0, 18), x + 2, y + 1.5, 1.5, C.deep);
        p.text(level.waves.length + ' waves', x + 2, y + 4.8, 1.2, C.brown);
        p.button('delete-map:' + i, '', x + 24, y + 1, 5, 6, C.paper, true, 'close'); p.button('edit-map:' + i, '', x + 30.5, y + 1, 5, 6, C.deep, true, 'edit'); p.button('play-map:' + i, '', x + 37, y + 1, 5, 6, C.deep, true, 'play');
    });
    if (g.notice) p.text(g.notice, 10, 93, 1.7, C.red);
    if (g.removedMap && g.custom.length < MAX_MAPS) p.button('restore-map', 'UNDO', 130, 91, 20, 6, C.deep);
}
function mapSize(g, p) {
    const l = g.editor.level, field = fieldFor(l), theme = THEMES[l.theme];
    p.panel(5, 21, 115, 61, C.cream);
    p.text('ROOM TO ROAM', 10, 24, 2.3, C.deep, 'left', true);
    p.text(`${field.w} × ${field.h}`, 114, 24.5, 2, C.brown, 'right');
    // Keep a fixed preview scale: growing a map visibly adds land around the
    // existing trail instead of stretching the trail to fill the new bounds.
    const scale = .16, x = 12, y = 30, point = (px, py) => [x + (px - field.x) * scale, y + (py - field.y) * scale];
    p.rect(x, y, 260 * scale, 180 * scale, C.paper);
    p.rect(x, y, field.w * scale, field.h * scale, theme.rock);
    p.rect(x + .3, y + .3, field.w * scale - .6, field.h * scale - .6, theme.sand);
    for (const path of l.paths) {
        path.slice(1).forEach((b, i) => p.line(...point(...path[i]), ...point(...b), .8, C.brown));
        p.oval(...point(...path[0]), .7, .7, C.red);
    }
    for (const d of l.decor) p.oval(...point(d.x, d.y), .3, .3, C.deep, .7, 4);
    p.star(...point(...l.paths[0].at(-1)), 1.1, C.gold);
    p.text((field.w * field.h / (116 * 62)).toFixed(1) + '×', 65, 34, 5, C.deep, 'left', true);
    p.text('STARTER MAP AREA', 65, 41, 1.5, C.brown);
    p.text('More land for trails and towers.', 65, 48, 1.7, C.deep);
    p.text('Your existing trail stays in place.', 65, 52, 1.7, C.brown);
    MAP_SIZES.forEach((size, i) => {
        const sx = 9 + i * 21.5, selected = field.w === size.w && field.h === size.h;
        p.button('size-preset:' + i, '', sx, 63, 20, 14, selected ? C.gold : C.paper);
        p.rect(sx + 10 - size.w * .02, 64.5, size.w * .04, size.h * .026, C.deep, .8);
        p.text(size.name, sx + 10, 70, 1.7, C.deep, 'center');
        p.text(`${size.w} × ${size.h}`, sx + 10, 73.4, 1.2, C.brown, 'center');
    });
    for (const [i, key] of ['width', 'height'].entries()) {
        const value = key === 'width' ? field.w : field.h, min = i ? 62 : 116, max = i ? 180 : 260, y = 31 + i * 18;
        p.text(key.toUpperCase(), 142, y - 5, 1.6, C.paper, 'center');
        p.button('size-shrink:' + key, '−', 128, y, 8, 7, C.paper, value > min);
        p.button('number:' + key, String(value), 138, y, 10, 7, C.gold);
        p.button('size-grow:' + key, '+', 150, y, 8, 7, C.paper, value < max);
        p.text(`${min} – ${max}`, 142, y + 9, 1.3, C.paper, 'center');
    }
    p.button('tab:trail', 'DRAW TRAILS →', 128, 69, 28, 7, C.gold);
    p.text('Zoom + drag to explore', 142, 79, 1.25, C.paper, 'center');
}
function editor(g, p) {
    const ed = g.editor, l = ed.level; p.rect(0, 11, 124, 72, THEMES[l.theme].sand); p.rect(0, 11, 124, 7, C.deep); p.world(g.camera); landscape(p, l, g.clock);
    if (['trail', 'scenery'].includes(ed.tab)) {
        const f = fieldFor(l), left = f.x, right = f.x + f.w - 3, top = f.y + 2, bottom = f.y + f.h - 2;
        for (const [a, b] of [[[left, top], [right, top]], [[right, top], [right, bottom]], [[right, bottom], [left, bottom]], [[left, bottom], [left, top]]]) p.line(...a, ...b, .25 / g.camera.zoom, C.deep, .4);
    }
    routeEntrances(g, p, l);
    l.decor.filter(d => d.kind !== 'fence').sort((a, b) => a.y - b.y).forEach(d => scenery(p, d, l.theme, g.clock));
    saloon(p, ...l.paths[0].at(-1), g.clock);
    p.screen();
    header(g, p, l, true); p.rect(124, 11, 36, 89, C.deep);
    ['trail', 'scenery', 'size', 'waves', 'rules'].forEach((tab, i) => p.button('tab:' + tab, tab === 'size' ? 'MAP SIZE' : tab.toUpperCase(), 5 + i * 23, 12, 22, 5, ed.tab === tab ? C.gold : C.paper));
    p.text('YOUR FRONTIER', 142, 15, 2, C.paper, 'center', true);
    if (ed.tab === 'trail') {
        p.button('route:0', 'TRAIL 1', 128, 23, 28, 6, ed.route === 0 ? C.gold : C.paper);
        p.button(l.paths.length === 1 ? 'add-route' : 'route:1', l.paths.length === 1 ? '+ TRAIL 2' : 'TRAIL 2', 128, 31, 28, 6, ed.route === 1 ? C.gold : C.paper);
        ['move', 'add', 'erase'].forEach((tool, i) => p.button('tool:' + tool, { move: 'MOVE CORNERS', add: 'ADD CORNER', erase: 'ERASE CORNER' }[tool], 128, 43 + i * 8, 28, 6, ed.tool === tool ? C.gold : C.paper));
        if (l.paths.length > 1) p.button('remove-route', 'REMOVE TRAIL 2', 128, 69, 28, 6, C.paper);
        const path = l.paths[ed.route];
        p.world(g.camera);
        path.forEach(([x, y], i) => { const scale = 1 / g.camera.zoom; p.oval(x, y, 2 * scale, 2 * scale, i === 0 ? C.red : i === path.length - 1 ? C.gold : C.deep); p.text(i === 0 ? '→' : i === path.length - 1 ? '★' : i, x, y - scale, 1.8 * scale, C.cream, 'center'); });
        routeEntrances(g, p, l);
        p.screen();
    } else if (ed.tab === 'scenery') {
        DECOR.forEach((kind, i) => { const x = 128 + i % 2 * 15, y = 24 + Math.floor(i / 2) * 17; p.button('stamp:' + kind, '', x, y, 13, 15, ed.stamp === kind && ed.tool !== 'erase' ? C.gold : C.paper); scenery(p, { kind, x: x + 6.5, y: y + 10 }, l.theme, g.clock, .7); p.text(kind, x + 6.5, y + 11.5, 1.15, C.deep, 'center'); });
        p.button('tool:erase', 'ERASE', 128, 77, 28, 5, ed.tool === 'erase' ? C.gold : C.paper);
    } else if (ed.tab === 'size') {
        mapSize(g, p);
    } else if (ed.tab === 'waves') {
        const summary = waveSummary(l.waves[ed.wave]);
        p.panel(5, 21, 115, 61, C.cream); p.text('WAVE ' + (ed.wave + 1) + ' / ' + l.waves.length, 10, 23, 2.2, C.deep, 'left', true);
        p.text(`${summary.count} bandits · $${summary.bounty} bounty · last spawn ${summary.end.toFixed(1)}s`, 10, 28.3, 1.2, summary.count > 240 ? C.red : C.brown);
        p.button('wave-timeline', ed.timeline ? 'GROUPS' : 'TIMING', 47, 22, 20, 5, ed.timeline ? C.gold : C.paper);
        p.button('wave-prev', '←', 70, 22, 9, 6, C.deep, ed.wave > 0); p.button('wave-next', '→', 81, 22, 9, 6, C.deep, ed.wave < l.waves.length - 1);
        p.button('wave-add', 'COPY', 93, 22, 13, 6, C.deep, l.waves.length < 24); p.button('wave-delete', '−', 108, 22, 8, 6, C.deep, l.waves.length > 1);
        if (ed.timeline) { p.text('BANDIT / TRAIL', 12, 31, 1.3, C.brown); p.text('0s     SPAWN TIMING', 46, 31, 1.3, C.brown); p.text(summary.end.toFixed(1) + 's', 112, 31, 1.3, C.brown, 'right'); }
        else ['BANDIT', 'COUNT', 'GAP', 'DELAY', 'TRAIL'].forEach((t, i) => p.text(t, [12, 46, 64, 82, 100][i], 31, 1.3, C.brown));
        l.waves[ed.wave].forEach((group, i) => {
            const y = 35 + i * 5.1; p.button('group:' + i, '', 9, y, 107, 4.6, ed.group === i ? C.gold : C.paper);
            p.text(ENEMIES[group.kind].name, 12, y + .8, ed.timeline ? 1.4 : 1.7, C.deep);
            if (ed.timeline) {
                routeBadge(p, group.route, 41, y + 2.1, 1.5);
                const x = time => 47 + time / Math.max(1, summary.end) * 64, color = group.route ? [132, 75, 137] : [46, 113, 154];
                p.line(47, y + 2.2, 111, y + 2.2, .15, C.brown, .25);
                p.line(x(group.delay), y + 2.2, x(group.delay + (group.count - 1) * group.gap), y + 2.2, .7, color);
                const dots = Math.min(26, group.count);
                for (let k = 0; k < dots; k++) p.oval(x(group.delay + (dots === 1 ? 0 : Math.round(k * (group.count - 1) / (dots - 1))) * group.gap), y + 2.2, .35, 1, color, 1, 4);
            } else [group.count, numberText(group.gap) + 's', numberText(group.delay) + 's', group.route + 1].forEach((v, k) => p.text(v, [47, 65, 84, 102][k], y + .8, 1.7, C.deep));
        });
        p.button('wave-earlier', '← EARLIER', 9, 76.5, 30, 4.5, C.paper, ed.wave > 0);
        p.button('wave-later', 'LATER →', 42, 76.5, 30, 4.5, C.paper, ed.wave < l.waves.length - 1);
        p.button('wave-blank', '+ BLANK', 75, 76.5, 40, 4.5, C.paper, l.waves.length < 24);
        p.button('kind-prev', '←', 128, 23, 9, 6, C.paper); p.button('kind-next', '→', 147, 23, 9, 6, C.paper);
        const group = l.waves[ed.wave][ed.group]; cowboy(p, group.kind, 142, 36, .9, g.clock, { enemy: true });
        for (const [i, field] of ['count', 'gap', 'delay', 'route'].entries()) { const y = 39 + i * 8.5; p.text(field === 'route' ? 'TRAIL' : field.toUpperCase(), 142, y, 1.2, C.paper, 'center'); p.button('dec:' + field, '−', 128, y + 2, 8, 5, C.paper); p.button('inc:' + field, '+', 148, y + 2, 8, 5, C.paper); if (field !== 'route') p.button('number:' + field, numberText(group[field]), 138, y + 2, 9, 5, C.deep); else p.text(group.route + 1, 142, y + 3.2, 1.8, C.cream, 'center'); }
        p.button('group-add', '+', 128, 76, 8, 5, C.paper, l.waves[ed.wave].length < 8); p.button('group-copy', 'COPY', 138, 76, 10, 5, C.paper, l.waves[ed.wave].length < 8); p.button('group-delete', '−', 150, 76, 6, 5, C.paper, l.waves[ed.wave].length > 1);
    } else {
        p.panel(8, 24, 111, 53, C.cream); p.text('NAME', 12, 28, 1.6, C.brown); p.button('rename', l.name, 12, 32, 102, 8, C.paper);
        p.text('STARTING CASH', 12, 45, 1.6, C.brown); p.button('number:cash', '$' + l.cash, 51, 43, 27, 7, C.paper); p.button('cash-down', '−', 82, 43, 10, 7, C.deep); p.button('cash-up', '+', 96, 43, 10, 7, C.deep);
        p.text('SALOON GOLD', 12, 57, 1.6, C.brown); p.button('number:gold', String(l.gold), 51, 55, 27, 7, C.paper); p.button('gold-down', '−', 82, 55, 10, 7, C.deep); p.button('gold-up', '+', 96, 55, 10, 7, C.deep);
        p.text('POSSE', 12, 70, 1.6, C.brown);
        ORDER.forEach((kind, i) => { p.button('allow:' + kind, '', 33 + i * 13.4, 67, 11, 7, l.unlocked.includes(kind) ? C.mint : C.paper); cowboy(p, kind, 38.5 + i * 13.4, 74, .65, g.clock); });
        p.text(THEMES[l.theme].name, 142, 24, 1.35, C.paper, 'center');
        THEMES.forEach((theme, i) => { const x = 128 + i % 2 * 15, y = 30 + Math.floor(i / 2) * 8; p.button('theme:' + i, '', x, y, 13, 6.5, theme.sand); p.poly([[x + 2, y + 5], [x + 4, y + 2], [x + 7, y + 5]], theme.rock); if (l.theme === i) p.star(x + 10, y + 3, 1.5, C.deep); });
        p.button('tab:size', 'MAP SIZE →', 128, 74, 28, 6, C.paper);
    }
    p.rect(0, 83, 124, 17, C.cream); p.button('undo', 'UNDO', 5, 90, 16, 8, C.paper, ed.undoStack.length > 0); p.button('redo', 'REDO', 24, 90, 16, 8, C.paper, ed.redoStack.length > 0);
    p.button('save-map', 'SAVE MAP', 44, 90, 23, 8, C.deep); p.button('export-map', 'EXPORT', 71, 90, 22, 8, C.deep); p.button('library', 'MAPS', 97, 90, 22, 8, C.paper);
    p.button('test', '', 128, 86, 28, 9, C.gold, true, 'play'); p.text('TEST RUN', 142, 96, 1.4, C.paper, 'center');
    if (['trail', 'scenery'].includes(ed.tab)) navigation(g, p, l);
    else { g.minimap = null; p.text(ed.tab === 'size' ? 'Choose a size, then draw trails into the new land.' : 'Changes are kept in your draft. Save to add this map to your library.', 7, 84.5, 1.6, C.brown); }
    if (g.notice) { p.panel(7, 79, 112, 4.5, C.deep); p.text(g.notice, 10, 79.8, 1.5, C.cream); }
}
function draw(g) {
    const p = g.painter; p.begin();
    ({ home, campaign, play, library, editor }[g.screen] || home)(g, p);
    p.end(); g.buttons = p.buttons; g.syncInputs(); g.base.node.onStateChange();
}
module.exports = { draw };
