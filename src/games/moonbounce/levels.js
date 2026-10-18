// All boards are authored in world coordinates. No random layout changes on retry.
const round = n => Math.round(n * 1000) / 1000;
const peg = (x, y, r = 1.3) => ({ x: round(x), y: round(y), r });
const arc = (cx, cy, rx, ry, count, from = Math.PI, to = Math.PI * 2) =>
    Array.from({ length: count }, (_, i) => {
        const a = from + (to - from) * i / (count - 1);
        return peg(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    });
const row = (left, right, y, count) => Array.from({ length: count }, (_, i) => peg(left + (right - left) * i / (count - 1), y));
const line = (x1, y1, x2, y2, count) => Array.from({ length: count }, (_, i) =>
    peg(x1 + (x2 - x1) * i / (count - 1), y1 + (y2 - y1) * i / (count - 1)));
const ring = (x, y, rx, ry, count, phase = 0) => arc(x, y, rx, ry, count, phase, phase + Math.PI * 2 * (count - 1) / count);
const wave = (left, right, y, height, count, cycles = 1, phase = 0) => Array.from({ length: count }, (_, i) =>
    peg(left + (right - left) * i / (count - 1), y + Math.sin(i / (count - 1) * Math.PI * 2 * cycles + phase) * height));
const path = (vertices, perEdge = 5, closed = false) => vertices.slice(0, closed ? vertices.length : -1).flatMap((v, i) =>
    line(v[0], v[1], vertices[(i + 1) % vertices.length][0], vertices[(i + 1) % vertices.length][1], perEdge));
const sway = (x, y, ax = 2, ay = 0, speed = .8, phase = 0) => ({
    ...peg(x + Math.sin(phase) * ax, y + Math.sin(phase) * ay),
    motion: { kind: 'sway', cx: x, cy: y, ax, ay, speed, phase }
});
const orbit = (x, y, ax = 2, ay = 2, speed = .8, phase = 0) => ({
    ...peg(x + Math.cos(phase) * ax, y + Math.sin(phase) * ay),
    motion: { kind: 'orbit', cx: x, cy: y, ax, ay, speed, phase }
});
const bumper = (x, y, r = 3.2, id = 0) => ({ id, x, y, r });
const gates = (x1, y1, x2, y2, r = 2.6) => [
    { id: 0, x: x1, y: y1, r, pairId: 1 }, { id: 1, x: x2, y: y2, r, pairId: 0 }
];
const bounds = p => p.motion ? { x: p.motion.cx, y: p.motion.cy, ax: Math.abs(p.motion.ax), ay: Math.abs(p.motion.ay) }
    : { x: p.x, y: p.y, ax: 0, ay: 0 };
const separation = (a, b) => {
    const u = bounds(a), v = bounds(b);
    return Math.hypot(Math.max(0, Math.abs(u.x - v.x) - u.ax - v.ax), Math.max(0, Math.abs(u.y - v.y) - u.ay - v.ay));
};
const directlyReachable = p => {
    // Required targets must remain hittable when all their neighboring pegs are
    // gone. Leave aim margin for Gemini's ±.045 spread and discrete physics.
    const distance = Math.abs(p.x - 59), angle = 1.17;
    const flightTime = Math.max(0, distance / Math.sin(angle) - 2.8) / 41;
    const minimumReachableY = 17 + distance / Math.tan(angle) + 12 * flightTime * flightTime;
    return p.y >= minimumReachableY + 1;
};
const clearLaunchPath = (p, obstacles) => {
    if (!obstacles.length) return true;
    // A required star must still have a normal ballistic approach after every
    // neighboring peg is gone. Never hide the final orange behind a permanent
    // bumper or a portal that would whisk its only approach somewhere else.
    const dx = Math.abs(p.x - 59);
    let angle = 0, time;
    if (dx > .001) {
        let low = .0001, high = 1.22;
        for (let i = 0; i < 36; i++) {
            const a = (low + high) / 2, t = (dx / Math.sin(a) - 2.8) / 41;
            if (17 + dx / Math.tan(a) + 12 * t * t > p.y) low = a; else high = a;
        }
        angle = (low + high) / 2 * Math.sign(p.x - 59);
        time = (dx / Math.abs(Math.sin(angle)) - 2.8) / 41;
    } else time = (-41 + Math.sqrt(41 * 41 + 48 * (p.y - 19.8))) / 24;
    for (let i = 0; i <= 60; i++) {
        const t = time * i / 60, x = 59 + Math.sin(angle) * (2.8 + 41 * t);
        const y = 17 + Math.cos(angle) * (2.8 + 41 * t) + 12 * t * t;
        if (obstacles.some(o => Math.hypot(x - o.x, y - o.y) < o.r + .9)) return false;
    }
    return true;
};

function board(name, subtitle, points, orangeCount, balls, seed, options = {}) {
    // Curves meet in a few places. Keep one peg at each junction so no two solid
    // circles overlap or trap a ball inside a cluster.
    const obstacles = [...(options.bumpers || []), ...(options.portals || [])];
    points = points.filter(p => {
        const b = bounds(p);
        return b.x - b.ax >= 12 && b.x + b.ax <= 106 && b.y - b.ay > 25 && b.y + b.ay < 75 &&
            !obstacles.some(o => separation(p, o) < p.r + o.r + 1.6);
    });
    const spaced = [];
    for (const p of points) if (!spaced.some(q => separation(p, q) < 3.15)) spaced.push(p);
    points = spaced;
    // Evenly spread targets across the entire arrangement; shuffle a stable permutation
    // so orange paths look different on each board without changing between attempts.
    let state = seed;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    const order = points.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]];
    }
    const reachable = p => {
        const b = bounds(p);
        return [-1, 1].every(sx => [-1, 1].every(sy => {
            const edge = { x: b.x + b.ax * sx, y: b.y + b.ay * sy };
            return directlyReachable(edge) && clearLaunchPath(edge, obstacles);
        }));
    };
    const oranges = new Set(order.filter(i => reachable(points[i])).slice(0, orangeCount));
    const blues = order.filter(i => !oranges.has(i)).sort((a, b) => points[a].y - points[b].y);
    const powerCandidates = blues.filter(i => reachable(points[i]));
    // Powers in the upper half are reachable early and reward deliberate aiming.
    const greens = new Set([powerCandidates[2], powerCandidates[Math.floor(powerCandidates.length * .4)]]);
    const bonusCandidates = powerCandidates.filter(i => !greens.has(i));
    const purple = bonusCandidates[Math.floor(bonusCandidates.length * .6)];
    return { name, subtitle, balls, seed, parScore: 80000 + (orangeCount - 15) * 3000,
        bumpers: [], portals: [], ...options,
        pegs: points.map((p, id) => ({ ...p, id,
        type: oranges.has(id) ? 'orange' : greens.has(id) ? 'green' : id === purple ? 'purple' : 'blue' })) };
}

const GARDEN = [
    board('Lunar Garden', 'Clear every orange peg.', [
        ...arc(59, 44, 39, 17, 15), ...arc(59, 48, 28, 12, 12),
        ...arc(59, 56, 37, 15, 15, 0, Math.PI),
        ...row(25, 93, 57, 9), ...row(40, 78, 48, 6)
    ], 15, 12, 731),
    board('Crystal Cascade', 'Green pegs recharge powers.', [
        ...Array.from({ length: 7 }, (_, r) => Array.from({ length: 9 }, (_, c) =>
            peg(20 + c * 9.7 + (r % 2 ? 3.5 : 0), 29 + r * 6.6))).flat()
    ], 18, 12, 919),
    board('Orbit Waltz', 'Purple pegs award extra points.', [
        ...arc(34, 45, 19, 15, 18, 0, Math.PI * 2 * 17 / 18),
        ...arc(83, 45, 19, 15, 18, 0, Math.PI * 2 * 17 / 18),
        ...arc(59, 59, 16, 12, 14, 0, Math.PI * 2 * 13 / 14),
        ...row(39, 79, 28, 7), ...row(20, 98, 69, 10)
    ], 20, 13, 403),
    board('Starlight Steps', 'Bank shots earn bonus points.', [
        ...Array.from({ length: 6 }, (_, r) => row(17 + r * 3.9, 46 + r * 3.9, 28 + r * 6.5, 5)).flat(),
        ...Array.from({ length: 7 }, (_, r) => row(73 + r * 1.8, 99 - r * 2.6, 28 + r * 6.5, Math.max(2, 5 - Math.floor(r / 2)))).flat(),
        ...row(20, 100, 73, 10)
    ], 21, 13, 1671),
    board('Heart of the Comet', 'Long shots earn bonus points.', [
        ...Array.from({ length: 36 }, (_, i) => {
            const t = Math.PI * 2 * i / 36;
            return peg(59 + 2.35 * 16 * Math.pow(Math.sin(t), 3),
                45 - 1.45 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)));
        }),
        ...arc(59, 49, 20, 13, 18, 0, Math.PI * 2 * 17 / 18),
        ...row(24, 94, 72, 11), ...row(45, 73, 43, 5)
    ], 23, 13, 121),
    board('Celestial Finale', 'Clearing orange opens the jackpot.', [
        ...Array.from({ length: 5 }, (_, arm) => Array.from({ length: 9 }, (_, i) => {
            const a = -Math.PI / 2 + arm * Math.PI * 2 / 5 + i * .18;
            const r = 8 + i * 3.7;
            return peg(59 + Math.cos(a) * r * 1.15, 50 + Math.sin(a) * r * .59);
        })).flat(),
        ...arc(59, 49, 43, 23, 26, 0, Math.PI * 2 * 25 / 26)
    ], 25, 14, 7733)
];

const WORLDS = [
    { id: 'garden', name: 'Lunar Garden', subtitle: 'Clear orange pegs and catch extra balls.', color: [116, 233, 229], color2: [255, 215, 123], mechanic: 'Clear orange pegs and catch the moving bucket.', unlockPower: 'blast', host: 'Lumi', finaleName: 'The Wishing Gate' },
    { id: 'sunforge', name: 'Sunforge Atoll', subtitle: 'Bumpers redirect the ball.', color: [255, 188, 87], color2: [255, 123, 134], mechanic: 'Golden bumpers redirect the ball.', unlockPower: 'twin', host: 'Sol', finaleName: 'The Sun Engine' },
    { id: 'tideglass', name: 'Tideglass Isles', subtitle: 'Portals connect two places on the board.', color: [93, 234, 203], color2: [115, 186, 255], mechanic: 'Paired portals carry the ball across the board.', unlockPower: 'magnet', host: 'Marina', finaleName: 'The Tidal Heart' },
    { id: 'clockwork', name: 'Clockwork Canopy', subtitle: 'Time shots around moving pegs.', color: [198, 160, 255], color2: [197, 245, 123], mechanic: 'Time your shots around moving pegs.', unlockPower: 'phoenix', host: 'Tick', finaleName: 'The Grand Orrery' },
    { id: 'aurora', name: 'Aurora Crown', subtitle: 'Combine portals, bumpers and moving pegs.', color: [156, 236, 255], color2: [255, 164, 223], mechanic: 'This world combines bumpers, portals and moving pegs.', unlockPower: null, host: 'Nova', finaleName: 'Crown of the Cosmos' }
];

GARDEN.push(
    board('Firefly Procession', 'Earn stars by beating score targets.', [
        ...wave(17, 101, 36, 7, 15, 1.5), ...wave(18, 100, 52, 7, 15, 1.5, Math.PI),
        ...wave(19, 99, 66, 5, 15, 1.5), ...row(37, 81, 29, 7), ...row(39, 79, 44, 7)
    ], 22, 13, 8871),
    board('The Wishing Gate', 'Unlock Supernova.', [
        ...arc(59, 51, 40, 24, 17), ...arc(59, 53, 27, 17, 13),
        ...line(19, 51, 19, 72, 5), ...line(99, 51, 99, 72, 5),
        ...row(24, 94, 72, 10), ...path([[41, 59], [59, 45], [77, 59], [59, 68]], 4, true)
    ], 25, 14, 4421)
);

// Each new board starts from an authored silhouette: an anvil, a reef, a clock,
// a crown. Small helpers place its individual pegs; the seed only chooses colors.
const SUNFORGE = [
    board('First Spark', 'Bumpers redirect the ball.', [
        ...arc(59, 48, 34, 20, 17), ...row(26, 92, 57, 11), ...row(31, 87, 66, 9),
        ...line(22, 45, 22, 68, 6), ...line(96, 45, 96, 68, 6), ...row(44, 74, 35, 6)
    ], 18, 13, 2081, { bumpers: [bumper(59, 46, 3.6)], hint: 'Golden bumpers send the ball back into the pegs.' }),
    board('Palmfire Cove', 'Bounce back into the pegs.', [
        ...path([[17, 42], [35, 29], [54, 39]], 6), ...path([[67, 39], [85, 29], [102, 43]], 6),
        ...line(35, 37, 30, 64, 7), ...line(85, 37, 89, 64, 7),
        ...wave(19, 100, 69, 3, 14), ...row(43, 75, 57, 6), ...row(46, 72, 46, 5)
    ], 19, 13, 2089, { bumpers: [bumper(35, 48, 3.2, 0), bumper(84, 48, 3.2, 1)], hint: 'Bumpers can send a low shot back up.' }),
    board('Copper Kites', 'Aim along the kite edges.', [
        ...path([[34, 28], [50, 43], [34, 58], [18, 43]], 6, true),
        ...path([[83, 31], [101, 46], [83, 61], [65, 46]], 6, true),
        ...path([[34, 58], [44, 65], [34, 72]], 4), ...path([[83, 61], [72, 67], [82, 73]], 4),
        ...row(47, 72, 29, 5), ...row(47, 69, 57, 5)
    ], 20, 13, 2099, { bumpers: [bumper(34, 43, 3.3, 0), bumper(83, 46, 3.3, 1)], hint: 'Aim along the edges to hit several pegs.' }),
    board('The Singing Anvil', 'Bank off the side walls.', [
        ...path([[20, 32], [98, 32], [85, 44], [70, 44], [70, 60], [88, 70], [31, 70], [47, 60], [47, 44], [30, 44]], 5, true),
        ...row(34, 84, 38, 9), ...row(46, 72, 53, 5), ...row(42, 77, 65, 6)
    ], 22, 14, 2111, { bumpers: [bumper(31, 56, 3.4, 0), bumper(88, 56, 3.4, 1)], hint: 'Bank off a side wall to reach the anvil.' }),
    board('Solar Sail', 'Cross between the sails.', [
        ...path([[59, 28], [22, 58], [59, 58]], 8, true),
        ...path([[65, 35], [98, 61], [65, 61]], 7, true),
        ...path([[22, 66], [35, 73], [88, 73], [99, 66]], 6), ...row(37, 87, 66, 8)
    ], 22, 14, 2129, { bumpers: [bumper(47, 46, 3.2, 0), bumper(81, 52, 3.2, 1)], hint: 'Long jumps between pegs earn a long-shot bonus.' }),
    board('Furnace Flowers', 'Bumpers sit inside the flowers.', [
        ...ring(32, 40, 15, 12, 15), ...ring(86, 40, 15, 12, 15),
        ...ring(59, 62, 17, 11, 17), ...row(43, 75, 28, 6), ...row(22, 97, 70, 12)
    ], 23, 14, 2131, { bumpers: [bumper(32, 40, 3.4, 0), bumper(86, 40, 3.4, 1), bumper(59, 62, 3.4, 2)], hint: 'The center bumpers send the ball back up.' }),
    board('Molten Waterfall', 'Clear a path to the lower rows.', [
        ...wave(19, 99, 32, 4, 15, 1.5), ...wave(21, 97, 45, 4, 14, 1.5, 1),
        ...wave(19, 99, 59, 4, 15, 1.5, 2), ...row(22, 96, 71, 12),
        ...line(59, 37, 59, 66, 7)
    ], 24, 14, 2137, { bumpers: [bumper(32, 52, 3.1, 0), bumper(87, 52, 3.1, 1)], hint: 'Clear upper pegs to reach the lower rows.' }),
    board('The Sun Engine', 'Unlock Gemini.', [
        ...ring(59, 49, 40, 23, 27), ...ring(59, 49, 24, 15, 19),
        ...row(24, 94, 73, 12), ...row(43, 75, 28, 6), ...row(46, 72, 48, 5)
    ], 26, 15, 2143, { bumpers: [bumper(35, 49, 3.2, 0), bumper(83, 49, 3.2, 1), bumper(59, 64, 3.2, 2)], hint: 'Clear this board to unlock Gemini.' })
];

const TIDEGLASS = [
    board('A Door in the Tide', 'Portals connect two positions.', [
        ...arc(59, 48, 35, 19, 17), ...row(22, 96, 62, 12), ...row(27, 91, 72, 11),
        ...line(21, 43, 21, 64, 6), ...line(97, 43, 97, 64, 6), ...row(43, 75, 46, 6)
    ], 19, 13, 3011, { portals: gates(39, 41, 81, 57), hint: 'Enter a portal to exit from its matching partner.' }),
    board('Seahorse Stair', 'Reach the upper pegs through a portal.', [
        ...path([[28, 30], [47, 30], [47, 41], [68, 41], [68, 53], [91, 53], [91, 68]], 5),
        ...path([[22, 43], [38, 43], [38, 55], [57, 55], [57, 68], [77, 68]], 5),
        ...row(21, 99, 73, 13), ...row(64, 93, 30, 6), ...row(77, 98, 39, 5)
    ], 20, 13, 3019, { portals: gates(29, 57, 83, 42), hint: 'A lower portal can send the ball back up.' }),
    board('Coral Courtyard', 'Cross between both courtyards.', [
        ...arc(33, 48, 17, 18, 12), ...arc(85, 48, 17, 18, 12),
        ...line(16, 49, 16, 71, 6), ...line(102, 49, 102, 71, 6),
        ...row(22, 97, 71, 10), ...ring(59, 54, 16, 12, 13), ...row(42, 76, 28, 7)
    ], 21, 14, 3023, { portals: gates(33, 47, 85, 47), hint: 'Portals connect the two sides of the board.' }),
    board('Message in a Bottle', 'Choose your portal entrance angle.', [
        ...path([[48, 28], [70, 28], [70, 39], [84, 48], [84, 69], [34, 69], [34, 48], [48, 39]], 5, true),
        ...wave(39, 79, 57, 4, 9, 1), ...row(41, 77, 64, 7),
        ...line(18, 45, 23, 69, 6), ...line(99, 45, 96, 69, 6), ...row(46, 72, 46, 5)
    ], 22, 14, 3037, { portals: gates(59, 37, 59, 61), hint: 'Portals preserve the direction of the ball.' }),
    board('Jellyfish Waltz', 'Follow the peg columns.', [
        ...arc(59, 47, 37, 19, 19), ...wave(22, 96, 48, 3, 14, 2),
        ...path([[29, 53], [35, 61], [28, 70]], 5), ...path([[46, 54], [41, 64], [48, 73]], 5),
        ...path([[72, 54], [78, 64], [71, 73]], 5), ...path([[89, 53], [83, 61], [90, 70]], 5)
    ], 22, 14, 3041, { portals: gates(37, 39, 80, 62), hint: 'Aim down a column to hit several pegs.' }),
    board('The Pearl Exchange', 'Combine portals and bumpers.', [
        ...ring(34, 42, 18, 14, 18), ...ring(84, 57, 19, 15, 19),
        ...line(51, 31, 73, 31, 5), ...line(23, 65, 53, 65, 6),
        ...row(30, 93, 73, 11), ...row(49, 75, 47, 5)
    ], 23, 14, 3049, { portals: gates(34, 42, 84, 57), bumpers: [bumper(58, 56, 3.3)], hint: 'Use the bumper to redirect the ball toward a portal.' }),
    board('Ribbon Reef', 'Cross the reef through portals.', [
        ...wave(17, 101, 36, 7, 17, 1.5), ...wave(18, 100, 51, 7, 17, 1.5, Math.PI),
        ...wave(19, 99, 66, 6, 17, 1.5), ...row(41, 78, 29, 7)
    ], 24, 14, 3061, { portals: gates(28, 51, 91, 51), bumpers: [bumper(59, 43, 3.1)], hint: 'Portals cross the board without ending your chain.' }),
    board('The Tidal Heart', 'Unlock Cometkeeper.', [
        ...ring(59, 49, 41, 23, 29), ...path([[37, 34], [59, 53], [81, 34]], 7),
        ...path([[37, 64], [59, 46], [81, 64]], 7), ...row(35, 83, 73, 9)
    ], 26, 15, 3067, { portals: gates(31, 49, 87, 49), bumpers: [bumper(59, 34, 3.2), bumper(59, 65, 3.2, 1)], hint: 'Clear this board to unlock Cometkeeper.' })
];

const CLOCKWORK = [
    board('The Patient Pendulum', 'Wait for gaps in moving pegs.', [
        ...arc(59, 50, 36, 22, 19), ...row(24, 94, 65, 12), ...row(29, 89, 73, 11),
        ...[31, 45, 59, 73, 87].map(x => sway(x, 45, 2.6, 0, .85)),
        ...[35, 51, 67, 83].map(x => sway(x, 55, 2.1, 0, .85, Math.PI))
    ], 20, 14, 4001, { hint: 'Wait for a gap between moving pegs before firing.' }),
    board('Clockface Orchard', 'Aim ahead of orbiting pegs.', [
        ...ring(35, 42, 19, 14, 18), ...ring(83, 42, 19, 14, 18),
        ...line(35, 58, 35, 71, 4), ...line(83, 58, 83, 71, 4), ...row(22, 97, 73, 12),
        orbit(35, 42, 2.5, 2.5, 1), orbit(83, 42, 2.5, 2.5, -1, Math.PI),
        ...row(48, 70, 60, 5), ...row(45, 73, 29, 5)
    ], 21, 14, 4003, { hint: 'Aim ahead of the orbiting pegs.' }),
    board('Wind-Up Wings', 'Time a bounce toward either wing.', [
        ...path([[57, 44], [33, 28], [18, 45], [38, 58]], 5, true),
        ...path([[61, 44], [85, 28], [100, 45], [80, 58]], 5, true),
        ...path([[56, 54], [29, 68], [48, 73]], 5, true), ...path([[64, 54], [89, 68], [70, 73]], 5, true),
        ...[34, 48, 62].map(y => sway(59, y, 2.2, 0, 1.15, y / 9))
    ], 22, 14, 4013, { hint: 'Moving center pegs can redirect the ball into a wing.' }),
    board('The Turning Leaves', 'Cross between moving leaves.', [
        ...path([[22, 36], [42, 28], [52, 43], [31, 48]], 5, true),
        ...path([[68, 43], [80, 28], [101, 36], [91, 49]], 5, true),
        ...path([[34, 61], [58, 49], [84, 62], [59, 73]], 6, true),
        orbit(37, 39, 2.6, 1.8, .9), orbit(84, 39, 2.6, 1.8, -.9),
        ...[44, 59, 74].map(x => sway(x, 62, 2, 0, .8))
    ], 22, 14, 4019, { hint: 'Time a bounce between leaves for a long-shot bonus.' }),
    board('Escapement Alley', 'Moving pegs share the bumper lanes.', [
        ...path([[19, 30], [41, 30], [41, 42], [20, 42], [20, 54], [43, 54], [43, 68], [21, 68]], 5),
        ...path([[98, 30], [77, 30], [77, 42], [98, 42], [98, 54], [75, 54], [75, 68], [98, 68]], 5),
        ...[32, 45, 58, 71].map(y => sway(59, y, 3.1, 0, 1, y / 10))
    ], 23, 14, 4021, { bumpers: [bumper(31, 60, 3.1), bumper(87, 60, 3.1, 1)], hint: 'The center pegs move between the bumpers.' }),
    board('The Sky Loom', 'Watch the moving portal exits.', [
        ...line(23, 30, 94, 70, 14), ...line(95, 30, 24, 70, 14),
        ...row(34, 84, 29, 9), ...row(27, 91, 73, 11),
        ...[32, 49, 66, 83].map(x => sway(x, 46, 0, 2.5, 1, x / 11)),
        ...[39, 59, 79].map(x => sway(x, 59, 0, 2.3, .8, x / 10))
    ], 24, 14, 4027, { portals: gates(27, 52, 91, 52), hint: 'Watch the moving pegs near each portal exit.' }),
    board('Midnight Metronome', 'Wait for the moving gaps.', [
        ...path([[59, 27], [24, 72], [94, 72]], 10, true),
        ...path([[59, 39], [40, 65], [78, 65]], 6, true), ...row(26, 92, 39, 11),
        ...[31, 46, 61].map(y => sway(59, y, 3.2, 0, .9, .5)),
        ...[26, 92].flatMap(x => [51, 62].map(y => orbit(x, y, 1.9, 1.6, 1, y)))
    ], 24, 15, 4049, { hint: 'Wait for the moving pegs to leave a clear path.' }),
    board('The Grand Orrery', 'Unlock Dawnkeeper.', [
        ...ring(59, 49, 41, 23, 29), ...ring(59, 49, 25, 15, 19), ...row(35, 83, 73, 9),
        ...[45, 59, 73].map((x, i) => orbit(x, 49, 2.2, 2.2, .8, i * Math.PI * 2 / 3)),
        ...[46, 72].map(x => sway(x, 29, 2, 0, 1.1))
    ], 26, 15, 4051, { bumpers: [bumper(59, 34, 3.1)], portals: gates(28, 53, 90, 53), hint: 'Clear this board to unlock Dawnkeeper.' })
];

const AURORA = [
    board('Prism Welcome', 'Combine all three board mechanics.', [
        ...path([[59, 28], [24, 60], [94, 60]], 10, true), ...row(30, 88, 70, 11),
        ...line(21, 46, 21, 67, 6), ...line(97, 46, 97, 67, 6),
        ...[43, 59, 75].map(x => sway(x, 50, 2, 0, .7))
    ], 22, 14, 5003, { portals: gates(34, 43, 84, 64), bumpers: [bumper(59, 63, 3.2)], hint: 'This board combines portals, bumpers and moving pegs.' }),
    board('Northern Ribbons', 'Time a portal exit.', [
        ...wave(18, 100, 35, 6, 17, 1.2), ...wave(18, 100, 50, 6, 17, 1.2, Math.PI),
        ...wave(19, 99, 67, 5, 17, 1.2),
        ...[32, 51, 70, 89].map(x => sway(x, 58, 2.3, 0, .85, x / 20))
    ], 23, 14, 5009, { portals: gates(29, 49, 89, 49), hint: 'Time your portal entry to meet the moving pegs.' }),
    board('Crystal Carillon', 'Bounce back into the columns.', [
        ...[25, 47, 71, 93].flatMap((x, i) => path([[x - 8, 32 + i % 2 * 5], [x + 8, 32 + i % 2 * 5], [x + 8, 59 + i % 2 * 6], [x - 8, 59 + i % 2 * 6]], 4, true)),
        ...row(25, 93, 73, 12), ...[36, 59, 82].map(x => sway(x, 66, 0, 2, .9, x / 10))
    ], 24, 14, 5011, { bumpers: [bumper(25, 45, 3.1), bumper(71, 45, 3.1, 1)], hint: 'Bumpers can send the ball back into the columns.' }),
    board('The Snowbird', 'Redirect a falling ball through portals.', [
        ...path([[59, 42], [38, 29], [17, 43], [38, 53], [59, 42], [80, 29], [101, 43], [80, 53], [59, 42]], 5),
        ...path([[59, 47], [40, 70], [59, 62], [78, 70]], 6), ...row(24, 94, 73, 12),
        ...[39, 79].map(x => orbit(x, 41, 2.2, 1.7, .9)), sway(59, 31, 2.3, 0, .8)
    ], 24, 15, 5021, { portals: gates(30, 61, 88, 61), hint: 'A lower portal gives a falling ball another path.' }),
    board('Stairway to Starlight', 'Use portals to reach upper steps.', [
        ...path([[20, 68], [35, 68], [35, 57], [49, 57], [49, 45], [63, 45], [63, 33], [81, 33]], 5),
        ...path([[39, 73], [58, 73], [58, 63], [75, 63], [75, 51], [94, 51], [94, 39]], 5),
        ...row(27, 56, 29, 6), ...[27, 89].map(x => sway(x, 49, 2.3, 0, .95)),
        ...row(22, 98, 73, 13)
    ], 25, 15, 5023, { portals: gates(24, 56, 84, 44), bumpers: [bumper(59, 56, 3.3)], hint: 'Use portals to reach the upper steps.' }),
    board('The Infinity Fountain', 'Connect the loops with a bounce.', [
        ...ring(34, 47, 18, 16, 19), ...ring(84, 47, 18, 16, 19),
        ...row(27, 91, 73, 12), ...row(44, 74, 29, 6),
        ...[44, 59, 74].map(x => orbit(x, 66, 1.8, 1.6, 1, x)),
        sway(59, 43, 0, 2.1, .8), sway(59, 56, 0, 2.1, .8, Math.PI)
    ], 25, 15, 5039, { portals: gates(34, 47, 84, 47), bumpers: [bumper(59, 34, 3.2)], hint: 'Use portals and bumpers to cross between the loops.' }),
    board('The Last Constellation', 'Recharge your selected power.', [
        ...path([[59, 27], [70, 42], [98, 43], [79, 55], [86, 72], [59, 62], [32, 72], [39, 55], [20, 43], [48, 42]], 5, true),
        ...[40, 59, 78].map(x => sway(x, 57, 1.9, 0, .9)),
        ...[40, 78].map(x => orbit(x, 34, 1.8, 1.6, .85)), ...row(39, 79, 73, 8)
    ], 26, 15, 5051, { portals: gates(30, 57, 88, 57), bumpers: [bumper(59, 47, 3.3)], hint: 'Green pegs recharge your selected power.' }),
    board('Crown of the Cosmos', 'Complete the adventure.', [
        ...path([[18, 43], [29, 63], [89, 63], [100, 43], [79, 51], [59, 28], [39, 51]], 6, true),
        ...row(28, 90, 72, 12), ...ring(59, 50, 19, 13, 17),
        ...[29, 59, 89].map(x => orbit(x, x === 59 ? 41 : 35, 1.8, 1.8, .8)),
        ...[45, 73].map(x => sway(x, 67, 2, 0, .9))
    ], 28, 15, 5059, { portals: gates(30, 53, 88, 53), bumpers: [bumper(59, 56, 3.5)], hint: 'Clear this board to complete all five worlds.' })
];

const LEVELS = [GARDEN, SUNFORGE, TIDEGLASS, CLOCKWORK, AURORA].flatMap((world, worldIndex) =>
    world.map((level, stageIndex) => ({ ...level, worldIndex, stageIndex, finale: stageIndex === 7,
        hint: level.hint || ['Clear orange pegs. Catch the bucket for another ball.', 'Green pegs add two charged shots to your power.', 'Purple pegs are worth extra points.', 'Hit a wall before a peg for a bank-shot bonus.', 'Long shots and ten-peg chains earn style bonuses.', 'Clear all orange pegs to open the jackpot slots.', 'Score above the board target to earn more stars.', 'Clear this board to unlock Supernova.'][stageIndex],
        parScore: level.parScore + worldIndex * 7000 + (stageIndex === 7 ? 12000 : 0)
    })));

// Challenges are short, curated remixes. Clearing every orange remains the core
// objective; the extra goal rewards a particular skill instead of more grinding.
const CHALLENGES = [
    { id: 'garden-score', title: 'Garden Party', description: 'Clear the garden with a score of 90,000.', worldIndex: 0, levelIndex: 0, balls: 12, goal: { kind: 'score', target: 90000 } },
    { id: 'garden-catch', title: 'Catch a Falling Star', description: 'Clear Crystal Cascade and catch the bucket once.', worldIndex: 0, levelIndex: 1, balls: 12, goal: { kind: 'catches', target: 1 } },
    { id: 'garden-style', title: 'Comet Chaser', description: 'Clear the comet and earn two style bonuses.', worldIndex: 0, levelIndex: 4, balls: 14, goal: { kind: 'style', target: 2 }, powerId: 'blast' },
    { id: 'sunforge-score', title: 'Gold Rush', description: 'Clear the Sun Engine with a score of 125,000.', worldIndex: 1, levelIndex: 15, balls: 14, goal: { kind: 'score', target: 125000 }, powerId: 'blast' },
    { id: 'sunforge-catch', title: 'Sun Catcher', description: 'Clear the flowers and catch the bucket twice.', worldIndex: 1, levelIndex: 13, balls: 14, goal: { kind: 'catches', target: 2 } },
    { id: 'sunforge-style', title: 'Double Sunshine', description: 'Clear Copper Kites and earn three style bonuses.', worldIndex: 1, levelIndex: 10, balls: 13, goal: { kind: 'style', target: 3 }, powerId: 'twin' },
    { id: 'tideglass-score', title: 'Pearl Collector', description: 'Clear the Pearl Exchange with a score of 115,000.', worldIndex: 2, levelIndex: 21, balls: 13, goal: { kind: 'score', target: 115000 } },
    { id: 'tideglass-catch', title: 'Ashore Again', description: 'Clear the courtyard and catch the bucket twice.', worldIndex: 2, levelIndex: 18, balls: 13, goal: { kind: 'catches', target: 2 }, powerId: 'magnet' },
    { id: 'tideglass-style', title: 'Postcard from Everywhere', description: 'Clear Ribbon Reef and earn three style bonuses.', worldIndex: 2, levelIndex: 22, balls: 14, goal: { kind: 'style', target: 3 } },
    { id: 'clockwork-score', title: 'Perfect Timing', description: 'Clear the Grand Orrery with a score of 140,000.', worldIndex: 3, levelIndex: 31, balls: 14, goal: { kind: 'score', target: 140000 } },
    { id: 'clockwork-catch', title: 'Borrowed Time', description: 'Clear the orchard and catch the bucket twice.', worldIndex: 3, levelIndex: 25, balls: 13, goal: { kind: 'catches', target: 2 }, powerId: 'magnet' },
    { id: 'clockwork-style', title: 'Second Wind', description: 'Clear Wind-Up Wings and earn three style bonuses.', worldIndex: 3, levelIndex: 26, balls: 13, goal: { kind: 'style', target: 3 }, powerId: 'phoenix' },
    { id: 'aurora-score', title: 'Crown Jewels', description: 'Clear the crown with a score of 150,000.', worldIndex: 4, levelIndex: 39, balls: 15, goal: { kind: 'score', target: 150000 } },
    { id: 'aurora-catch', title: 'Northern Keeper', description: 'Clear Northern Ribbons and catch the bucket twice.', worldIndex: 4, levelIndex: 33, balls: 14, goal: { kind: 'catches', target: 2 }, powerId: 'magnet' },
    { id: 'aurora-style', title: 'Wish Upon Every Star', description: 'Clear the last constellation and earn four style bonuses.', worldIndex: 4, levelIndex: 38, balls: 15, goal: { kind: 'style', target: 4 } }
];

module.exports = { LEVELS, WORLDS, CHALLENGES };
