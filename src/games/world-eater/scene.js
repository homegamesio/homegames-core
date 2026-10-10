const { C, WORLD, SECTORS } = require('./settings');

const TAU = Math.PI * 2;
const VIEW = { x: 0, y: 14, w: 160, h: 60 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const tint = (a, b, amount) => a.map((n, i) => Math.round(lerp(n, b[i], amount)));
const dark = [5, 10, 21];
const steel = [18, 37, 48];
const lightSteel = [34, 68, 75];
const palette = [C.teal, C.gold, C.red, C.blue, C.violet, C.green];
const frac = n => n - Math.floor(n);
const noise = n => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453123);

function hash(value) {
    let result = 2166136261;
    for (const char of String(value)) { result ^= char.charCodeAt(0); result = Math.imul(result, 16777619); }
    return result >>> 0;
}

function camera(engine, options = {}) {
    const core = engine.core || { x: WORLD.width / 2, y: WORLD.height / 2 };
    const scale = options.map ? Math.min(150 / WORLD.width, 53 / WORLD.height) : (options.scale || .23);
    return {
        x: options.map ? WORLD.width / 2 : core.x,
        y: options.map ? WORLD.height / 2 : core.y,
        scale,
        screenX: options.title ? 116 : 80,
        screenY: options.title ? 48 : 44,
        bounds: VIEW,
    };
}

function worldToScreen(engine, x, y, options = {}) {
    const view = options.camera || camera(engine, options);
    return { x: view.screenX + (x - view.x) * view.scale, y: view.screenY + (y - view.y) * view.scale };
}

function screenToWorld(engine, x, y, options = {}) {
    const view = options.camera || camera(engine, options);
    return { x: view.x + (x - view.screenX) / view.scale, y: view.y + (y - view.screenY) / view.scale };
}

function visible(x, y, radius = 0) {
    return x + radius >= VIEW.x && x - radius <= VIEW.x + VIEW.w &&
        y + radius >= VIEW.y && y - radius <= VIEW.y + VIEW.h;
}

function polygon(x, y, points, rotation = 0, scale = 1) {
    const cosine = Math.cos(rotation), sine = Math.sin(rotation);
    return points.map(([px, py]) => [x + (px * cosine - py * sine) * scale, y + (px * sine + py * cosine) * scale]);
}

function background(p, e, view, options) {
    p.rect(0, 14, 160, 60, C.bg);
    const sector = SECTORS[e.sector || 0] || SECTORS[0];
    const accent = sector.color;
    // Almost-black, irregular nested dust patches leave the ships and planets
    // as the brightest objects. Avoid repeated straight bands across the sky.
    const clouds = [[26, 75, 62, 17], [124, 12, 56, 15], [159, 61, 37, 11]];
    for (let i = 0; i < clouds.length; i++) {
        const [x, y, rx, ry] = clouds[i];
        for (let layer = 0; layer < 3; layer++) {
            const scale = 1.4 - layer * .32;
            const points = Array.from({ length: 18 }, (_, j) => {
                const angle = j * TAU / 18;
                const variation = .7 + noise(i * 40 + j) * .36;
                const dx = Math.cos(angle) * rx * variation * scale;
                return [x + dx, y + Math.sin(angle) * ry * variation * scale - dx * .18];
            });
            p.poly(points, tint(C.bg, accent, .011 + layer * .006));
        }
    }
    const starCount = options.reduced ? 26 : 57;
    const parallaxX = view.x * .018, parallaxY = view.y * .018;
    for (let i = 0; i < starCount; i++) {
        const depth = .3 + noise(i + 80) * .7;
        const x = ((noise(i + 1) * 164 - parallaxX * depth) % 164 + 164) % 164 - 2;
        const y = 14 + ((noise(i + 143) * 64 - parallaxY * depth) % 64 + 64) % 64 - 2;
        const size = i % 13 === 0 ? .22 : .09;
        p.rect(x, y, size, size, i % 5 === 0 ? accent : C.white, .15 + depth * .4);
        if (i % 19 === 0 && !options.reduced) {
            p.line(x - .5, y + size / 2, x + .5, y + size / 2, C.white, .06, .24);
            p.line(x + size / 2, y - .5, x + size / 2, y + .5, C.white, .06, .24);
        }
    }
    if (options.map) {
        const corner = worldToScreen(e, 0, 0, { camera: view });
        const width = WORLD.width * view.scale, height = WORLD.height * view.scale;
        for (let i = 0; i <= 7; i++) p.line(corner.x + i * width / 7, corner.y, corner.x + i * width / 7, corner.y + height, C.line, .045, .45);
        for (let i = 0; i <= 5; i++) p.line(corner.x, corner.y + i * height / 5, corner.x + width, corner.y + i * height / 5, C.line, .045, .45);
    }
}

function worldShape(x, y, radius, seed, remaining, biteAngle) {
    const points = [];
    const biteWidth = (1 - remaining) * 2.5;
    for (let i = 0; i < 40; i++) {
        const a = i / 40 * TAU;
        const difference = Math.abs(Math.atan2(Math.sin(a - biteAngle), Math.cos(a - biteAngle)));
        const eaten = difference < biteWidth ? (1 - remaining) * (.7 + .24 * noise(seed + i)) * Math.cos(difference / Math.max(.01, biteWidth) * Math.PI / 2) : 0;
        const r = radius * (1 - eaten) * (.99 + .01 * noise(seed + i * 7));
        points.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    return points;
}

function drawPlanet(p, planet, e, view, options = {}) {
    const position = options.position || worldToScreen(e, planet.x, planet.y, { camera: view });
    const x = position.x, y = position.y;
    const radius = options.radius || planet.radius * view.scale;
    if (!visible(x, y, radius * 1.7)) return;
    const seed = hash(planet.id || planet.name || planet.x);
    const base = planet.kind === 'garden' ? C.teal : planet.kind === 'crystal' ? C.violet : C.gold;
    const remaining = planet.consumed ? 0 : clamp((planet.amount == null ? 1 : planet.amount) / (planet.maxAmount || 1), 0, 1);
    const biteAngle = Math.atan2((e.core?.y || 0) - planet.y, (e.core?.x || 0) - planet.x);

    if (planet.consumed) {
        const rescued = planet.rescued;
        p.arc(x, y, radius * 1.13, -.6, TAU * .7, rescued ? C.teal : C.line, .09, .5);
        const count = options.map ? 3 : 9;
        for (let i = 0; i < count; i++) {
            const a = i * TAU / count + noise(seed + i) * .3;
            const r = radius * (1 + noise(seed + i * 3) * .5);
            p.ngon(x + Math.cos(a) * r, y + Math.sin(a) * r, radius * (.055 + noise(seed + i * 4) * .05), 4, a, tint(C.bg, base, .25));
        }
        if (!options.title) p.text(rescued ? 'EVACUATED' : 'CONSUMED', x, y + radius * 1.35, options.map ? .75 : 1.05, rescued ? C.teal : C.muted, 'center', .7);
        return;
    }

    if (options.map) {
        p.circle(x, y, radius * 1.25, tint(C.bg, base, .12));
        p.circle(x, y, radius, tint(C.bg, base, .45));
        p.arc(x, y, radius * 1.2, -Math.PI / 2, TAU * remaining, base, .14, .8);
        if (planet.inhabited) p.ngon(x, y, .35, 4, Math.PI / 4, C.white);
        p.text(planet.name || 'WORLD', x, y + radius + 1.1, .8, base, 'center');
        return;
    }

    const contour = worldShape(x, y, radius, seed, remaining, biteAngle);
    const atmosphere = tint(C.bg, base, .12);
    p.circle(x, y, radius * 1.18, atmosphere, null, .5);
    p.circle(x, y, radius * 1.08, atmosphere, null, .7);
    p.poly(contour, tint(C.bg, base, .44));

    // Surface facets form the same eroded contour, so extraction changes the
    // planet's actual silhouette instead of hiding it beneath an opaque disk.
    for (let i = 0; i < 10; i++) {
        const a = contour[i * 4], b = contour[(i * 4 + 4) % contour.length];
        const midpoint = [x - radius * .25, y - radius * .18];
        const brightness = .16 + .16 * ((Math.cos(i * TAU / 10 + 2.1) + 1) / 2);
        p.poly([midpoint, a, contour[(i * 4 + 2) % contour.length], b], tint(C.bg, base, brightness));
    }
    if (!options.reduced && remaining > .4) {
        for (let i = 0; i < 5; i++) {
            const a = noise(seed + i * 5) * TAU;
            const rr = radius * (.17 + .43 * noise(seed + i * 6));
            const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
            const patch = radius * (.1 + noise(seed + i * 7) * .14);
            const points = Array.from({ length: 7 }, (_, j) => {
                const angle = j * TAU / 7;
                const r = patch * (.45 + noise(seed + j * 4 + i) * .5);
                return [px + Math.cos(angle) * r, py + Math.sin(angle) * r * .65];
            });
            p.poly(points, tint(C.bg, base, planet.kind === 'garden' ? .55 : .25));
        }
    }
    // A lit crescent and short cloud bands establish the direction of starlight.
    p.arc(x, y, radius * .99, -Math.PI * .9, Math.PI * .95, base, radius * .034, .7);
    p.arc(x, y, radius * 1.035, -Math.PI * .9, Math.PI * .95, base, .09, .5);
    if (planet.kind === 'garden' && remaining > .75 && !options.reduced) {
        p.arc(x - radius * .1, y - radius * .26, radius * .52, -2.4, 1.5, C.white, radius * .055, .2);
        p.arc(x - radius * .12, y + radius * .38, radius * .48, -2.6, 1.3, C.white, radius * .04, .14);
    }
    if (planet.kind === 'crystal') {
        // An inclined belt of diamonds, seen edge on.
        for (let i = 0; i < (options.reduced ? 7 : 13); i++) {
            const a = i / 13 * TAU;
            const rx = Math.cos(a) * radius * 1.42, ry = Math.sin(a) * radius * .31;
            if (ry < 0 && Math.abs(rx) < radius * .87) continue;
            p.ngon(x + rx, y + ry + rx * .18, radius * .045, 4, a, base, null, .6);
        }
    }
    if (planet.inhabited && remaining > .65) {
        for (let i = 0; i < 5; i++) {
            const a = .15 + i * .45, r = radius * (.38 + noise(seed + i * 14) * .37);
            p.ngon(x + Math.cos(a) * r, y + Math.sin(a) * r, .11 + radius * .012, 4, 0, C.gold, null, .85);
        }
    }
    if (remaining < .93) {
        const a = biteAngle, point = { x: x + Math.cos(a) * radius * remaining, y: y + Math.sin(a) * radius * remaining };
        p.circle(point.x, point.y, radius * .09, C.gold, null, .7);
        for (let i = 0; i < 5; i++) {
            const angle = a + (noise(seed + i) - .5) * 1.5;
            const distance = radius * (1.04 + noise(seed + i * 8) * .35);
            p.ngon(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance,
                radius * (.02 + noise(seed + i * 9) * .065), 3, angle, base, null, .8);
        }
    }
    if (!options.title) {
        const nameY = y + radius * 1.27;
        p.text(planet.name || 'UNNAMED WORLD', x, nameY, 1.05, C.white, 'center', .85);
        p.text((planet.inhabited ? 'INHABITED / ' : '') + (planet.kind || 'ore').toUpperCase() + ' / ' + Math.ceil(remaining * 100) + '%', x, nameY + 1.7, .75, base, 'center', .7);
    }
}

function drawCore(p, e, view, options) {
    const core = e.core || { x: 250, y: 450, radius: 31, shield: 100, maxShield: 100 };
    const point = worldToScreen(e, core.x, core.y, { camera: view });
    const x = point.x, y = point.y;
    const radius = (core.radius || 31) * view.scale * (options.title ? 1.52 : 1);
    const time = options.reduced ? 0 : e.time || 0;
    const angle = (core.angle || 0) * .12 + time * .045;
    const r = radius;
    if (options.map) {
        p.circle(x, y, Math.max(3.6, r * 2), C.teal, null, .09);
        p.ngon(x, y, Math.max(1.4, r), 6, angle, dark, C.teal);
        p.ngon(x, y, .5, 4, 0, C.white);
        p.text('YOUR ARK', x, y + r + 1.8, .85, C.teal, 'center');
        return;
    }
    // Outer breathing halo, fragmentary shield and the six immense jaw vanes.
    p.circle(x, y, r * 2.25, [6, 24, 31], null, .4);
    const shield = clamp((core.shield || 0) / (core.maxShield || 1), 0, 1);
    if (shield > .01) {
        p.arc(x, y, r * 1.78, angle, TAU * shield, C.teal, .13, .18 + shield * .23);
        p.arc(x, y, r * 1.84, angle + .2, TAU * .34, C.teal, .06, .16);
    }
    for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + angle;
        const mouth = polygon(x, y, [[.69, -.3], [1.55, -.52], [1.89, -.09], [1.08, -.12], [.72, .14]], a, r);
        p.poly(mouth, i % 2 ? steel : lightSteel, C.teal, .07, .85);
        p.poly(polygon(x, y, [[1.08, -.13], [1.89, -.09], [1.59, .01], [.86, .1]], a, r), dark);
        p.line(x + Math.cos(a - .23) * r * 1.12, y + Math.sin(a - .23) * r * 1.12,
            x + Math.cos(a - .16) * r * 1.56, y + Math.sin(a - .16) * r * 1.56, C.teal, .16, .75);
    }
    p.ngon(x, y, r * 1.1, 12, angle, dark, lightSteel);
    p.ngon(x, y, r * .93, 6, -angle, steel, C.teal);
    p.ngon(x, y, r * .76, 12, angle, [6, 14, 26], C.line);
    p.arc(x, y, r * .83, -time * .15, TAU * .75, C.gold, .19, .8);
    p.arc(x, y, r * .66, time * .25, TAU * .7, C.teal, .11, .6);

    // Mechanical iris: six articulated shutter blades orbit a brilliant pupil.
    for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + time * .12;
        p.poly(polygon(x, y, [[.16, -.11], [.43, -.44], [.65, -.18], [.27, .23]], a, r), i % 2 ? lightSteel : steel, C.teal, .055, .85);
    }
    const pulse = 1 + Math.sin(time * 2.2) * .08;
    p.circle(x, y, r * .31 * pulse, C.teal, null, .15);
    p.ngon(x, y, r * .21, 6, -time * .2, C.teal);
    p.ngon(x, y, r * .1, 6, time * .13, C.white);

    const modules = (e.modules || []).slice(0, 12);
    modules.forEach((module, i) => {
        const a = (module.angle == null ? i * TAU / Math.max(1, modules.length) : module.angle) + time * .06;
        const distance = r * 2.08;
        const mx = x + Math.cos(a) * distance, my = y + Math.sin(a) * distance;
        const size = r * (.19 + Math.min(module.level || 1, 3) * .035);
        const color = module.type === 'fangs' ? C.red : module.type === 'siphon' ? C.gold : module.type === 'choir' ? C.green : C.teal;
        p.line(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2, mx, my, lightSteel, .65);
        p.line(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2, mx, my, color, .1, .65);
        p.ngon(mx, my, size * 1.25, module.type === 'fangs' ? 3 : 6, a, dark, color);
        p.ngon(mx, my, size * .5, 4, a + Math.PI / 4, color);
        if (module.type === 'wings') {
            p.poly(polygon(mx, my, [[0, 0], [-1, -2.8], [1, -2], [1.7, 0], [1, 2], [-1, 2.8]], a, size), lightSteel, color, .1, .7);
        }
    });
    if (!options.title) {
        p.text('LEVIATHAN / ARK-01', x, y + r * 2.5, .82, C.teal, 'center', .65);
    }
}

function drawBoss(p, enemy, e, view, options) {
    const point = worldToScreen(e, enemy.x, enemy.y, { camera: view });
    const x = point.x, y = point.y, r = (enemy.radius || 54) * view.scale;
    if (!visible(x, y, r * 2)) return;
    const time = options.reduced ? 0 : e.time || 0;
    const stage = enemy.stage || 1, angle = (enemy.angle || 0) * .3 + time * .06;
    const sector = clamp(e.sector || 0, 0, 4);
    const color = (SECTORS[sector] || SECTORS[0]).color;
    if (options.map) {
        p.ngon(x, y, Math.max(1.8, r), 3, angle, C.red);
        p.text('SOVEREIGN', x, y + r + 1.4, .8, C.red, 'center');
        return;
    }
    p.circle(x, y, r * 1.6, C.red, null, .035);
    p.arc(x, y, r * 1.38, -angle, TAU * .81, C.red, .12, .38);
    const armCount = [8, 10, 6, 8, 12][sector];
    const armProfiles = [
        [[.55, -.12], [1.24, -.18], [1.65, 0], [1.05, .15], [.55, .12]],
        [[.5, -.17], [1.03, -.28], [1.77, -.16], [1.28, .05], [.55, .19]],
        [[.55, 0], [1.24, -.29], [1.72, 0], [1.24, .29]],
        [[.55, -.15], [1.06, -.33], [1.5, -.3], [1.64, .12], [1.29, -.03], [.6, .18]],
        [[.58, -.13], [1.03, -.18], [1.9, 0], [1.03, .18], [.58, .13]],
    ];
    for (let i = 0; i < armCount; i++) {
        const a = i * TAU / armCount + angle;
        p.poly(polygon(x, y, armProfiles[sector], a, r), tint(dark, color, .12), sector === 4 ? C.gold : C.red, .14);
        p.ngon(x + Math.cos(a) * r * 1.24, y + Math.sin(a) * r * 1.24, r * .09, 4, a, stage > 1 ? C.gold : C.red);
    }
    if (sector === 2) {
        for (let i = 0; i < 3; i++) {
            const a = time * -.13 + i * TAU / 3;
            p.ngon(x + Math.cos(a) * r * 1.85, y + Math.sin(a) * r * 1.85, r * .23, 4, a, dark, C.blue);
            p.ngon(x + Math.cos(a) * r * 1.85, y + Math.sin(a) * r * 1.85, r * .09, 4, a, C.white);
        }
    } else if (sector === 3) {
        p.arc(x, y, r * 1.12, angle + .3, Math.PI * .75, C.violet, .3, .75);
        p.arc(x, y, r * 1.12, angle + Math.PI + .3, Math.PI * .75, C.violet, .3, .75);
    } else if (sector === 4) {
        p.arc(x, y, r * 1.57, -angle, TAU * .98, C.gold, .13, .7);
        p.arc(x, y, r * 1.68, angle, TAU * .94, C.gold, .07, .35);
    }
    p.ngon(x, y, r, 8, angle, [29, 15, 29], C.red);
    p.ngon(x, y, r * .79, 4, -angle + Math.PI / 4, dark, color);
    p.arc(x, y, r * .59, -time * .2, TAU * .88, C.red, .3, .8);
    p.poly(polygon(x, y, [[-.62, 0], [0, -.21], [.62, 0], [0, .21]], -angle * .3, r), C.red);
    p.ngon(x, y, r * .17 * (1 + Math.sin(time * 3) * .15), 4, angle, C.white);
    if (enemy.warm > 0) p.arc(x, y, r * 1.75, -Math.PI / 2, TAU * clamp(enemy.warm / 2, 0, 1), C.gold, .3, .65);
    p.text(enemy.name || 'SOVEREIGN', x, y + r * 1.75, 1.1, C.red, 'center');
}

function drawEnemy(p, enemy, e, view, options) {
    if (enemy.boss || enemy.type === 'boss') { drawBoss(p, enemy, e, view, options); return; }
    const point = worldToScreen(e, enemy.x, enemy.y, { camera: view });
    const x = point.x, y = point.y, r = Math.max(.5, (enemy.radius || 10) * view.scale);
    if (!visible(x, y, r * 2)) return;
    if (options.map) { p.ngon(x, y, .35, 3, enemy.angle || 0, C.red, null, .8); return; }
    const a = enemy.angle || 0;
    const color = enemy.type === 'lancer' ? C.violet : enemy.type === 'bomber' ? C.gold : C.red;
    const shapes = {
        scout: [[1.2, 0], [-.8, -.72], [-.45, 0], [-.8, .72]],
        lancer: [[1.7, 0], [-.65, -.42], [-.1, 0], [-.65, .42]],
        bomber: [[1, 0], [.55, -.84], [-.65, -.84], [-1, 0], [-.65, .84], [.55, .84]],
        shard: [[1, 0], [-.3, -.66], [-.9, .16], [-.3, .56]],
    };
    p.poly(polygon(x, y, shapes[enemy.type] || shapes.scout, a, r), [35, 18, 31], color, .12);
    p.ngon(x, y, r * .2, enemy.type === 'bomber' ? 6 : 3, a, color);
    if (enemy.type === 'bomber') p.arc(x, y, r * 1.4, (e.time || 0) * .5, Math.PI * 1.5, color, .09, .5);
    if (enemy.hp < enemy.maxHp) p.line(x - r, y - r * 1.5, x - r + 2 * r * Math.max(0, enemy.hp / enemy.maxHp), y - r * 1.5, color, .12, .8);
}

function drawPlayer(p, player, e, view, options) {
    const point = worldToScreen(e, player.x, player.y, { camera: view });
    const x = point.x, y = point.y;
    const color = palette[Math.abs(player.colorIndex || 0) % palette.length];
    const time = options.reduced ? 0 : e.time || 0;
    if (!visible(x, y, 5)) {
        if (!options.map && !options.title) {
            const ex = clamp(x, 3, 157), ey = clamp(y, 17, 70);
            const angle = Math.atan2(y - view.screenY, x - view.screenX);
            p.ngon(ex, ey, .65, 3, angle, color);
            p.text(String(player.name || 'DRONE').slice(0, 12), ex, ey + 1, .72, color, 'center');
        }
        return;
    }
    if (player.respawn > 0) {
        p.arc(x, y, 2.3, time, Math.PI * 1.5, color, .13, .4);
        p.text('REBUILDING', x, y + 3, .85, color, 'center');
        return;
    }
    const a = player.angle || 0, size = options.map ? .5 : 1.35;
    if (options.map) { p.ngon(x, y, .45, 3, a, color); return; }
    const velocity = Math.hypot(player.vx || 0, player.vy || 0);
    if (velocity > 1) {
        const tail = player.boosting ? 6 : 2.5;
        p.poly(polygon(x, y, [[-.65, -.34], [-tail * (1 + Math.sin(time * 37) * .1), 0], [-.65, .34]], a, size), color, null, 0, .45);
    }
    if (player.role === 'warden') p.arc(x, y, size * 1.75, a, TAU * .8, color, .09, .3);
    p.poly(polygon(x, y, [[1.25, 0], [-.9, -.83], [-.52, 0], [-.9, .83]], a, size), dark, color, .14);
    p.poly(polygon(x, y, [[.6, 0], [-.3, -.18], [-.3, .18]], a, size), C.white);
    if (player.role === 'vanguard') {
        p.line(x + Math.cos(a - 1.5) * size, y + Math.sin(a - 1.5) * size,
            x + Math.cos(a - .55) * size * 1.4, y + Math.sin(a - .55) * size * 1.4, color, .2);
        p.line(x + Math.cos(a + 1.5) * size, y + Math.sin(a + 1.5) * size,
            x + Math.cos(a + .55) * size * 1.4, y + Math.sin(a + .55) * size * 1.4, color, .2);
    }
    p.text(String(player.name || 'DRONE').slice(0, 16), x, y + 2.7, .85, color, 'center');
    if (player.hp < player.maxHp) p.line(x - 1.6, y + 2.1, x - 1.6 + 3.2 * Math.max(0, player.hp / player.maxHp), y + 2.1, color, .18);
}

function drawHarvest(p, e, player, view, options) {
    if (!player.harvesting || options.map) return;
    const planet = (e.planets || []).find(body => body.id === player.harvesting);
    if (!planet || planet.consumed) return;
    const start = worldToScreen(e, player.x, player.y, { camera: view });
    const end = worldToScreen(e, planet.x, planet.y, { camera: view });
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const radius = planet.radius * view.scale * .78;
    end.x -= Math.cos(angle) * radius; end.y -= Math.sin(angle) * radius;
    const color = planet.inhabited && player.input?.rescue ? C.teal : C.gold;
    p.line(start.x, start.y, end.x, end.y, color, 1.2, .07);
    p.line(start.x, start.y, end.x, end.y, color, .34, .35);
    p.line(start.x, start.y, end.x, end.y, C.white, .09, .8);
    for (let i = 0; i < 4; i++) {
        const t = frac(i / 4 - (e.time || 0) * .75);
        p.ngon(lerp(start.x, end.x, t), lerp(start.y, end.y, t), .21, 4, angle, color);
    }
    p.circle(end.x, end.y, .5, C.white, null, .75);
}

function drawBeam(p, beam, e, view) {
    const start = worldToScreen(e, beam.x, beam.y, { camera: view });
    const targetX = beam.tx == null ? beam.x + Math.cos(beam.angle || 0) * (beam.length || 500) : beam.tx;
    const targetY = beam.ty == null ? beam.y + Math.sin(beam.angle || 0) * (beam.length || 500) : beam.ty;
    const end = worldToScreen(e, targetX, targetY, { camera: view });
    const color = Array.isArray(beam.color) ? beam.color : C.red;
    if (beam.fired) {
        p.line(start.x, start.y, end.x, end.y, color, 2.4, .17);
        p.line(start.x, start.y, end.x, end.y, color, .8, .8);
        p.line(start.x, start.y, end.x, end.y, C.white, .22);
    } else {
        const charge = clamp((beam.age || 0) / (beam.duration || 1.5), 0, 1);
        p.line(start.x, start.y, end.x, end.y, color, .11, .3 + charge * .6);
        p.arc(start.x, start.y, 3.5, -Math.PI / 2, TAU * charge, color, .2, .7);
    }
}

function drawNavigation(p, e, view, options) {
    if (options.title || options.map || e.phase !== 'play' || !e.core) return;
    const boss = e.boss && e.boss.hp > 0 ? e.boss : null;
    let target = boss;
    if (!target && !e.gateReady) {
        let nearestDistance = Infinity;
        for (const planet of e.planets || []) {
            if (planet.consumed) continue;
            const distance = Math.hypot(planet.x - e.core.x, planet.y - e.core.y);
            if (distance < nearestDistance) { target = planet; nearestDistance = distance; }
        }
    }
    if (!target) return;
    const point = worldToScreen(e, target.x, target.y, { camera: view });
    if (visible(point.x, point.y, (target.radius || 0) * view.scale * .7)) return;
    const dx = point.x - view.screenX, dy = point.y - view.screenY;
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (!dx && !dy)) return;
    // Intersect the center-to-target ray with an inset viewport. Labels point
    // inward, staying clear of both the shared HUD and the bottom controls.
    const left = 4, right = 156, top = 18.5, bottom = 69.5;
    const tx = dx > 0 ? (right - view.screenX) / dx : dx < 0 ? (left - view.screenX) / dx : Infinity;
    const ty = dy > 0 ? (bottom - view.screenY) / dy : dy < 0 ? (top - view.screenY) / dy : Infinity;
    const edge = Math.min(tx, ty);
    const x = view.screenX + dx * edge, y = view.screenY + dy * edge;
    const angle = Math.atan2(dy, dx);
    const color = boss ? C.red : target.inhabited ? C.teal : target.kind === 'crystal' ? C.violet : C.gold;
    p.poly(polygon(x, y, [[1, 0], [-.55, -.6], [-.1, 0], [-.55, .6]], angle, 1), color, null, 0, .9);
    p.line(x - Math.cos(angle) * 1.2, y - Math.sin(angle) * 1.2,
        x - Math.cos(angle) * 2.3, y - Math.sin(angle) * 2.3, color, .11, .5);
    let labelX, labelY, align;
    if (tx < ty) {
        labelX = x + (dx > 0 ? -3.4 : 3.4);
        labelY = clamp(y - 1.5, 19, 66);
        align = dx > 0 ? 'right' : 'left';
    } else {
        labelX = clamp(x, 17, 143);
        labelY = dy > 0 ? y - 5 : y + 2;
        align = 'center';
    }
    const distance = Math.round(Math.hypot(target.x - e.core.x, target.y - e.core.y));
    p.text(String(target.name || (boss ? 'GUARDIAN' : 'WORLD')).slice(0, 22), labelX, labelY, 1.15, color, align, .9);
    p.text('RANGE ' + distance, labelX, labelY + 1.7, .85, C.muted, align, .8);
}

function titleScene(p, e, view, options) {
    const time = options.reduced ? 0 : e.time || 0;
    // An enormous, partly devoured nursery hangs over the title's mechanical
    // protagonist. It uses exactly the same native geometry as live worlds.
    const planet = { id: 'title-world', name: 'EDEN', x: 600, y: 240, radius: 80,
        kind: 'garden', amount: 65, maxAmount: 100, inhabited: true };
    drawPlanet(p, planet, e, view, { ...options, title: true, position: { x: 137, y: 30 }, radius: 17 });
    p.arc(119, 45, 31, -2.1, Math.PI * 1.4, C.teal, .075, .25);
    p.arc(119, 45, 34, -.8, Math.PI * .9, C.gold, .09, .25);
    const hero = { ...e, core: { ...(e.core || {}), x: view.x, y: view.y, radius: 34 },
        modules: e.modules?.length > 2 ? e.modules : [
            { type: 'fangs', level: 2, angle: .12 }, { type: 'siphon', level: 2, angle: 2.22 },
            { type: 'carapace', level: 3, angle: 4.32 },
        ] };
    for (let i = 0; i < 7; i++) {
        const progress = frac(i / 7 + time * .1);
        const x = lerp(139, 121, progress), y = lerp(31, 45, progress);
        p.ngon(x, y, .1 + progress * .2, 4, time * .3 + i, C.gold, null, .3 + progress * .5);
    }
    drawCore(p, hero, view, options);
    // Deliberately quiet left half keeps title typography legible.
    p.poly([[0, 14], [70, 14], [88, 74], [0, 74]], C.bg, null, 0, .67);
}

function renderWorld(p, engine, options = {}) {
    const source = engine || {};
    // A title screen has no running simulation; use the adapter's UI clock for
    // its reactor and debris animation without mutating the campaign clock.
    const e = options.title && Number.isFinite(options.time) ? { ...source, time: options.time } : source;
    const view = camera(e, options);
    const previousClip = p.clip;
    const startCount = p.si;
    p.clip = VIEW;
    background(p, e, view, options);
    if (options.title) {
        titleScene(p, e, view, options);
        p.clip = previousClip;
        return { camera: view, shapes: p.si - startCount };
    }
    const players = e.players instanceof Map ? [...e.players.values()] : Array.isArray(e.players) ? e.players : [];
    const planets = (e.planets || []).slice(0, 16);
    // World orbits and tether limits use the same Euclidean camera transform as
    // gameplay. The star map is only a different camera, never a second world.
    if (!options.map && e.core) {
        const center = worldToScreen(e, e.core.x, e.core.y, { camera: view });
        p.arc(center.x, center.y, (WORLD.tether || 150) * view.scale, 0, TAU, C.line, .07, .25);
    }
    let planetCount = 0;
    for (const planet of planets) {
        if (p.si - startCount > 320) break;
        const position = worldToScreen(e, planet.x, planet.y, { camera: view });
        if (!visible(position.x, position.y, planet.radius * view.scale * 1.7)) continue;
        drawPlanet(p, planet, e, view, { ...options, reduced: options.reduced || planetCount > 3 });
        planetCount++;
    }
    for (const beam of (e.beams || []).slice(0, 10)) drawBeam(p, beam, e, view);
    for (const player of players.slice(0, 8)) drawHarvest(p, e, player, view, options);

    // Reserve enough pooled shapes for the ark and crew even during bullet
    // storms. Far-off effects are culled before consuming a pooled node.
    for (const shot of (e.shots || []).slice(-110)) {
        if (p.si - startCount > 455) break;
        const position = worldToScreen(e, shot.x, shot.y, { camera: view });
        if (!visible(position.x, position.y, 1)) continue;
        const color = shot.friendly ? C.teal : C.red;
        if (options.map) continue;
        p.line(position.x, position.y, position.x - (shot.vx || 1) * view.scale * .04,
            position.y - (shot.vy || 0) * view.scale * .04, color, shot.friendly ? .16 : .26, .9);
    }
    for (const enemy of (e.enemies || []).slice(0, 48)) {
        if (enemy === e.boss || enemy.boss || enemy.type === 'boss') continue;
        if (p.si - startCount > 530) break;
        drawEnemy(p, enemy, e, view, options);
    }
    if (e.boss && e.boss.hp > 0) drawBoss(p, e.boss, e, view, options);
    drawCore(p, e, view, options);
    for (const player of players.slice(0, 8)) drawPlayer(p, player, e, view, options);
    if (!options.reduced && !options.map) {
        for (const particle of (e.particles || []).slice(-48)) {
            if (p.si - startCount > 745) break;
            const position = worldToScreen(e, particle.x, particle.y, { camera: view });
            if (!visible(position.x, position.y, 1)) continue;
            const color = Array.isArray(particle.color) ? particle.color : C[particle.color] || C.gold;
            const alpha = clamp(particle.life / (particle.maxLife || 1), 0, 1);
            p.line(position.x, position.y, position.x - (particle.vx || 5) * view.scale * .035,
                position.y - (particle.vy || 0) * view.scale * .035, color, .13, alpha);
        }
    }
    for (const ring of (e.rings || []).slice(-5)) {
        if (p.si - startCount > 755) break;
        const position = worldToScreen(e, ring.x, ring.y, { camera: view });
        const color = Array.isArray(ring.color) ? ring.color : C[ring.color] || C.teal;
        p.arc(position.x, position.y, (ring.radius || ring.r || 0) * view.scale,
            0, TAU, color, .3, clamp(ring.life / (ring.maxLife || 1), 0, 1) * .65);
    }
    drawNavigation(p, e, view, options);
    p.clip = previousClip;
    return { camera: view, shapes: p.si - startCount };
}

module.exports = { renderWorld, worldToScreen, screenToWorld, camera, VIEW };
