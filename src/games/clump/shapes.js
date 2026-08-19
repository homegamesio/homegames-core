// Unit-space silhouettes. `norm` scales each poly so its farthest vertex
// sits on the unit circle, then instances scale by world radius.

const close = (pts) => {
    if (!pts.length) return pts;
    const a = pts[0], b = pts[pts.length - 1];
    if (a[0] !== b[0] || a[1] !== b[1]) pts.push([a[0], a[1]]);
    return pts;
};

const norm = (pts) => {
    let max = 0.0001;
    for (let i = 0; i < pts.length; i++) {
        const d = Math.hypot(pts[i][0], pts[i][1]);
        if (d > max) max = d;
    }
    return close(pts.map(([x, y]) => [x / max, y / max]));
};

const ngon = (sides, rot) => {
    const pts = [];
    for (let i = 0; i < sides; i++) {
        const a = (rot || 0) + (i / sides) * Math.PI * 2;
        pts.push([Math.cos(a), Math.sin(a)]);
    }
    return close(pts);
};

const star = (points, inner) => {
    const pts = [];
    const n = points * 2;
    for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const r = i % 2 === 0 ? 1 : inner;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return close(pts);
};

const C = {
    pink: [255, 110, 170, 255],
    hot: [255, 70, 110, 255],
    coral: [255, 120, 90, 255],
    orange: [255, 150, 50, 255],
    gold: [255, 210, 70, 255],
    yellow: [255, 240, 90, 255],
    lime: [150, 230, 70, 255],
    mint: [70, 220, 170, 255],
    cyan: [40, 220, 230, 255],
    sky: [80, 170, 255, 255],
    blue: [70, 110, 240, 255],
    grape: [150, 90, 255, 255],
    violet: [190, 80, 220, 255],
    cream: [255, 244, 220, 255],
    brown: [160, 100, 60, 255],
    wood: [190, 130, 70, 255],
    ink: [40, 36, 48, 255],
    silver: [190, 200, 210, 255],
    white: [250, 250, 255, 255],
    red: [230, 50, 60, 255],
    brick: [190, 70, 55, 255],
    grass: [70, 170, 80, 255],
    leaf: [50, 140, 70, 255],
    night: [230, 230, 180, 255]
};

const TYPES = [
    {
        id: 'pin', label: 'thumbtack', r: 0.045, count: 90, minD: 0.4, maxD: 14,
        mobile: false, colors: [C.hot, C.cyan, C.gold, C.lime, C.grape],
        verts: norm([[0, -1], [0.35, 0.7], [0, 0.35], [-0.35, 0.7]])
    },
    {
        id: 'crumb', label: 'crumb', r: 0.038, count: 70, minD: 0.3, maxD: 12,
        mobile: false, colors: [C.wood, C.gold, C.coral, C.cream],
        verts: ngon(5, 0.4)
    },
    {
        id: 'coin', label: 'coin', r: 0.07, count: 36, minD: 1, maxD: 22,
        mobile: false, colors: [C.gold, C.yellow, C.silver],
        verts: ngon(8, 0.2)
    },
    {
        id: 'key', label: 'key', r: 0.09, count: 18, minD: 1.5, maxD: 24,
        mobile: false, colors: [C.gold, C.silver],
        verts: norm([
            [-1, -0.15], [-0.2, -0.15], [-0.2, -0.45], [0.15, -0.55],
            [0.55, -0.25], [0.55, 0.25], [0.15, 0.55], [-0.2, 0.45],
            [-0.2, 0.15], [-1, 0.15], [-1, 0.45], [-0.75, 0.45],
            [-0.75, 0.15], [-0.55, 0.15], [-0.55, 0.45], [-0.35, 0.45],
            [-0.35, 0.15], [-0.2, 0.15]
        ])
    },
    {
        id: 'crayon', label: 'crayon', r: 0.11, count: 28, minD: 1, maxD: 20,
        mobile: false, colors: [C.hot, C.sky, C.lime, C.gold, C.grape, C.coral],
        verts: norm([
            [-0.22, 1], [0.22, 1], [0.22, -0.45], [0, -1], [-0.22, -0.45]
        ])
    },
    {
        id: 'paperclip', label: 'paperclip', r: 0.1, count: 22, minD: 1, maxD: 18,
        mobile: false, colors: [C.silver, C.sky, C.pink],
        verts: norm([
            [-0.35, 1], [0.25, 1], [0.45, 0.7], [0.45, -0.5], [0.2, -0.85],
            [-0.15, -0.85], [-0.15, -0.55], [0.15, -0.55], [0.15, 0.55],
            [-0.05, 0.7], [-0.05, -0.35], [-0.35, -0.35], [-0.35, 0.75]
        ])
    },
    {
        id: 'leaf', label: 'leaf', r: 0.12, count: 30, minD: 8, maxD: 80,
        mobile: false, colors: [C.lime, C.leaf, C.mint, C.grass],
        verts: norm([
            [0, -1], [0.45, -0.45], [0.55, 0.2], [0.15, 0.7], [0, 1],
            [-0.1, 0.55], [-0.5, 0.15], [-0.4, -0.5]
        ])
    },
    {
        id: 'banana', label: 'banana', r: 0.16, count: 14, minD: 4, maxD: 28,
        mobile: false, colors: [C.yellow, C.gold],
        verts: norm([
            [-1, 0.2], [-0.6, -0.35], [0.1, -0.55], [0.8, -0.15], [1, 0.25],
            [0.7, 0.05], [0.1, -0.15], [-0.5, 0.05]
        ])
    },
    {
        id: 'mug', label: 'mug', r: 0.18, count: 16, minD: 3, maxD: 30,
        mobile: false, colors: [C.cream, C.sky, C.hot, C.mint],
        verts: norm([
            [-0.7, -0.7], [0.45, -0.7], [0.55, 0.7], [-0.8, 0.7],
            [-0.7, 0.15], [-1, 0.15], [-1, -0.25], [-0.7, -0.25]
        ])
    },
    {
        id: 'book', label: 'book', r: 0.2, count: 18, minD: 3, maxD: 32,
        mobile: false, colors: [C.red, C.blue, C.grape, C.mint, C.coral],
        verts: norm([
            [-0.7, -0.9], [0.7, -0.85], [0.75, 0.9], [-0.65, 0.85]
        ])
    },
    {
        id: 'die', label: 'die', r: 0.14, count: 12, minD: 2, maxD: 22,
        mobile: false, colors: [C.white, C.cream],
        verts: ngon(4, Math.PI / 4)
    },
    {
        id: 'bug', label: 'bug', r: 0.035, count: 40, minD: 0.4, maxD: 16,
        mobile: true, flee: 1.4, colors: [C.ink, C.brown, C.wood],
        verts: ngon(6, 0.2)
    },
    {
        id: 'bird', label: 'bird', r: 0.22, count: 22, minD: 10, maxD: 160,
        mobile: true, flee: 1.3, colors: [C.ink, C.sky, C.coral, C.white, C.gold],
        verts: norm([
            [-1, 0.15], [-0.25, -0.05], [0, -0.55], [0.25, -0.05], [1, 0.2],
            [0.2, 0.12], [0, -0.15], [-0.2, 0.12]
        ])
    },
    {
        id: 'mouse', label: 'mouse', r: 0.15, count: 14, minD: 4, maxD: 36,
        mobile: true, flee: 1.1, colors: [C.silver, C.brown, C.pink],
        verts: norm([
            [0.9, 0.1], [0.5, -0.45], [0.1, -0.35], [-0.2, -0.7],
            [-0.15, -0.2], [-0.7, -0.1], [-1, 0.25], [-0.5, 0.45],
            [0.2, 0.4], [0.7, 0.25]
        ])
    },
    {
        id: 'fish', label: 'fish', r: 0.17, count: 10, minD: 6, maxD: 40,
        mobile: true, flee: 0.9, colors: [C.cyan, C.orange, C.pink, C.gold],
        verts: norm([
            [1, 0], [0.4, -0.55], [-0.3, -0.4], [-0.7, -0.8], [-0.5, 0],
            [-0.7, 0.8], [-0.3, 0.4], [0.4, 0.55]
        ])
    },
    {
        id: 'duck', label: 'duck', r: 0.22, count: 10, minD: 8, maxD: 50,
        mobile: true, flee: 0.85, colors: [C.yellow, C.cream, C.white],
        verts: norm([
            [0.9, -0.15], [0.55, -0.35], [0.35, -0.7], [0.15, -0.35],
            [-0.5, -0.45], [-0.9, 0.1], [-0.4, 0.55], [0.3, 0.4], [0.7, 0.1]
        ])
    },
    {
        id: 'cat', label: 'cat', r: 0.32, count: 20, minD: 5, maxD: 55,
        mobile: true, flee: 1.25, colors: [C.orange, C.ink, C.cream, C.silver, C.brown],
        verts: norm([
            [-0.75, 0.85], [-0.55, 0.15], [-0.8, -0.55], [-0.35, -0.1],
            [-0.2, -0.95], [0.05, -0.2], [0.25, -0.9], [0.5, -0.05],
            [0.95, 0.2], [0.75, 0.7], [0.25, 0.45], [-0.15, 0.7], [-0.45, 0.4]
        ])
    },
    {
        id: 'dog', label: 'dog', r: 0.36, count: 14, minD: 8, maxD: 60,
        mobile: true, flee: 1.15, colors: [C.brown, C.gold, C.cream, C.ink],
        verts: norm([
            [1, 0.15], [0.55, -0.2], [0.2, -0.15], [-0.1, -0.55],
            [-0.5, -0.2], [-1, -0.35], [-0.85, 0.15], [-0.4, 0.35],
            [0.15, 0.3], [0.55, 0.55], [0.7, 0.2]
        ])
    },
    {
        id: 'chair', label: 'chair', r: 0.55, count: 14, minD: 6, maxD: 48,
        mobile: false, colors: [C.wood, C.red, C.sky, C.cream],
        verts: norm([
            [-0.7, 1], [-0.45, 1], [-0.45, 0.1], [0.7, 0.1], [0.7, 0.35],
            [0.95, 0.35], [0.95, 1], [0.7, 1], [0.7, 0.55], [-0.45, 0.55],
            [-0.45, 1]
        ])
    },
    {
        id: 'lamp', label: 'lamp', r: 0.5, count: 10, minD: 8, maxD: 50,
        mobile: false, colors: [C.gold, C.cream, C.coral],
        verts: norm([
            [-0.55, -0.85], [0.55, -0.85], [0.25, -0.15], [0.12, -0.15],
            [0.12, 0.75], [0.35, 0.9], [0.35, 1], [-0.35, 1], [-0.35, 0.9],
            [-0.12, 0.75], [-0.12, -0.15], [-0.25, -0.15]
        ])
    },
    {
        id: 'hydrant', label: 'hydrant', r: 0.42, count: 8, minD: 20, maxD: 90,
        mobile: false, colors: [C.hot, C.red],
        verts: norm([
            [-0.35, 1], [0.35, 1], [0.35, 0.2], [0.7, 0.2], [0.7, -0.05],
            [0.35, -0.05], [0.35, -0.7], [0.2, -1], [-0.2, -1], [-0.35, -0.7],
            [-0.35, -0.05], [-0.7, -0.05], [-0.7, 0.2], [-0.35, 0.2]
        ])
    },
    {
        id: 'cone', label: 'cone', r: 0.4, count: 12, minD: 18, maxD: 100,
        mobile: false, colors: [C.orange, C.gold],
        verts: norm([[0, -1], [0.7, 1], [-0.7, 1]])
    },
    {
        id: 'cactus', label: 'cactus', r: 0.48, count: 8, minD: 30, maxD: 120,
        mobile: false, colors: [C.grass, C.mint, C.lime],
        verts: norm([
            [-0.15, 1], [0.15, 1], [0.15, 0.15], [0.7, 0.15], [0.7, -0.25],
            [0.15, -0.25], [0.15, -0.7], [-0.15, -0.7], [-0.15, -0.05],
            [-0.65, -0.05], [-0.65, 0.4], [-0.15, 0.4]
        ])
    },
    {
        id: 'person', label: 'person', r: 0.85, count: 48, minD: 12, maxD: 110,
        mobile: true, flee: 1.0, colors: [C.sky, C.hot, C.lime, C.grape, C.gold, C.mint, C.coral, C.cyan],
        verts: norm([
            [0, -1], [0.28, -0.82], [0.28, -0.5], [0.7, -0.28], [0.62, -0.05],
            [0.28, -0.18], [0.32, 0.45], [0.55, 1], [0.22, 1], [0.1, 0.4],
            [-0.1, 0.4], [-0.22, 1], [-0.55, 1], [-0.32, 0.45], [-0.28, -0.18],
            [-0.62, -0.05], [-0.7, -0.28], [-0.28, -0.5], [-0.28, -0.82]
        ])
    },
    {
        id: 'bench', label: 'bench', r: 0.9, count: 8, minD: 18, maxD: 90,
        mobile: false, colors: [C.wood, C.brown],
        verts: norm([
            [-1, 0.2], [1, 0.2], [1, 0.45], [0.75, 0.45], [0.75, 1],
            [0.5, 1], [0.5, 0.45], [-0.5, 0.45], [-0.5, 1], [-0.75, 1],
            [-0.75, 0.45], [-1, 0.45]
        ])
    },
    {
        id: 'bike', label: 'bicycle', r: 1.1, count: 10, minD: 18, maxD: 100,
        mobile: true, flee: 0.9, colors: [C.red, C.cyan, C.ink],
        verts: norm([
            [-1, 0.4], [-0.7, -0.1], [-0.2, -0.1], [0, -0.6], [0.25, -0.6],
            [0.15, -0.1], [0.7, -0.15], [1, 0.4], [0.55, 0.4], [0.4, 0.05],
            [0.05, 0.05], [-0.15, 0.4]
        ])
    },
    {
        id: 'car', label: 'car', r: 2.1, count: 24, minD: 36, maxD: 180,
        mobile: true, flee: 0.7, colors: [C.hot, C.sky, C.gold, C.mint, C.grape, C.white, C.ink],
        verts: norm([
            [-1, 0.45], [-0.85, 0], [-0.45, -0.1], [-0.25, -0.55], [0.35, -0.55],
            [0.6, -0.1], [1, 0], [1, 0.45], [0.72, 0.45], [0.58, 0.12],
            [0.28, 0.12], [0.12, 0.45], [-0.4, 0.45], [-0.55, 0.12],
            [-0.82, 0.12], [-1, 0.45]
        ])
    },
    {
        id: 'truck', label: 'truck', r: 2.8, count: 8, minD: 55, maxD: 200,
        mobile: true, flee: 0.55, colors: [C.orange, C.blue, C.red],
        verts: norm([
            [-1, 0.4], [-0.2, 0.4], [-0.2, -0.7], [0.15, -0.7], [0.15, -0.15],
            [1, -0.15], [1, 0.4], [0.75, 0.4], [0.62, 0.1], [0.35, 0.1],
            [0.22, 0.4], [-0.45, 0.4], [-0.58, 0.1], [-0.85, 0.1], [-1, 0.4]
        ])
    },
    {
        id: 'bus', label: 'bus', r: 3.6, count: 6, minD: 70, maxD: 220,
        mobile: true, flee: 0.45, colors: [C.gold, C.sky, C.lime],
        verts: norm([
            [-1, 0.35], [-1, -0.55], [1, -0.55], [1, 0.35], [0.8, 0.35],
            [0.68, 0.05], [0.4, 0.05], [0.28, 0.35], [-0.35, 0.35],
            [-0.48, 0.05], [-0.75, 0.05], [-0.88, 0.35]
        ])
    },
    {
        id: 'tree', label: 'tree', r: 3.4, count: 22, minD: 50, maxD: 240,
        mobile: false, colors: [C.leaf, C.grass, C.lime],
        verts: norm([
            [-0.18, 1], [-0.18, 0.35], [-0.75, 0.3], [-0.5, -0.15],
            [-0.9, -0.3], [-0.25, -0.75], [0, -1], [0.3, -0.75],
            [0.9, -0.25], [0.5, -0.1], [0.75, 0.3], [0.18, 0.35], [0.18, 1]
        ])
    },
    {
        id: 'house', label: 'house', r: 5.5, count: 16, minD: 80, maxD: 280,
        mobile: false, colors: [C.cream, C.coral, C.brick, C.sky, C.white],
        verts: norm([
            [-0.95, 0.95], [-0.95, -0.05], [0, -1], [0.95, -0.05], [0.95, 0.95],
            [0.28, 0.95], [0.28, 0.25], [-0.18, 0.25], [-0.18, 0.95]
        ])
    },
    {
        id: 'tower', label: 'tower', r: 9, count: 8, minD: 140, maxD: 340,
        mobile: false, colors: [C.silver, C.brick, C.ink, C.sky],
        verts: norm([
            [-0.35, 1], [0.35, 1], [0.28, -0.55], [0, -1], [-0.28, -0.55]
        ])
    },
    {
        id: 'cloud', label: 'cloud', r: 12, count: 12, minD: 180, maxD: 380,
        mobile: true, flee: 0.15, colors: [C.white, C.cream, [220, 230, 245, 255]],
        verts: norm([
            [-1, 0.25], [-0.7, -0.15], [-0.35, -0.45], [0.1, -0.35],
            [0.45, -0.55], [0.85, -0.15], [1, 0.3], [0.5, 0.55],
            [0, 0.4], [-0.5, 0.55]
        ])
    },
    {
        id: 'hill', label: 'hill', r: 18, count: 7, minD: 220, maxD: 400,
        mobile: false, colors: [C.grass, C.leaf, [90, 150, 80, 255]],
        verts: norm([
            [-1, 1], [-0.7, 0.15], [-0.25, -0.55], [0.2, -1], [0.65, -0.4],
            [1, 0.35], [1, 1]
        ])
    },
    {
        id: 'star', label: 'star', r: 7, count: 14, minD: 260, maxD: 430,
        mobile: false, colors: [C.yellow, C.gold, C.cream, C.cyan],
        verts: star(5, 0.4)
    },
    {
        id: 'moon', label: 'moon', r: 16, count: 3, minD: 280, maxD: 430,
        mobile: false, glow: true, colors: [C.night, C.cream, C.gold],
        verts: norm([
            [0.2, -1], [0.75, -0.6], [1, 0], [0.7, 0.7], [0.1, 1],
            [0.45, 0.4], [0.4, -0.15], [0.55, -0.6]
        ])
    },
    {
        id: 'planet', label: 'planet', r: 28, count: 2, minD: 340, maxD: 440,
        mobile: false, glow: true, colors: [C.grape, C.cyan, C.hot],
        verts: ngon(12, 0)
    },
    {
        id: 'sun', label: 'sun', r: 36, count: 1, minD: 380, maxD: 430,
        mobile: false, glow: true, colors: [C.gold, C.orange],
        verts: star(8, 0.55)
    }
];

const KING_FIRST = {
    pin: 'A thumbtack. Humble. Correct.',
    crayon: 'Color. Finally.',
    cat: 'A cat. It did not agree to this.',
    dog: 'The dog believes this is a game. It is.',
    person: 'A person! They had plans, I think.',
    car: 'Cars are loud. You have improved them.',
    house: 'That was a house. The family will adapt.',
    tree: 'A tree. Photosynthesis: cancelled.',
    cloud: 'You rolled up weather. Rude. Impressive.',
    moon: 'THE MOON. We needed that for later.',
    planet: 'A planet. Do not get cocky.',
    sun: 'THE SUN. The King is screaming. With joy.',
    bus: 'Public transit is now private.',
    hill: 'You ate a hill. Geography is embarrassed.'
};

const KING_SIZE = [
    { r: 0.25, line: 'Yes. Larger. Always larger.' },
    { r: 0.6, line: 'You are the size of a rumor.' },
    { r: 1.4, line: 'Furniture is beginning to sweat.' },
    { r: 3.2, line: 'The street knows your name now.' },
    { r: 7, line: 'Houses look like snacks. They are.' },
    { r: 16, line: 'Do not stop. The moon is shy.' },
    { r: 30, line: 'A gift worthy of the cosmos.' }
];

module.exports = { TYPES, KING_FIRST, KING_SIZE, C };
