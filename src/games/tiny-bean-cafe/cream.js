// Original paper-cup and whipped-cream artwork, authored in cup-local coordinates.
const C = {
    cream: [255, 239, 202, 255], white: [255, 251, 231, 255], foam: [255, 252, 239, 255],
    coral: [217, 77, 47, 255], mint: [159, 207, 168, 255], teal: [40, 124, 112, 255],
    shadow: [232, 207, 153, 255], paper: [255, 246, 218, 255], inside: [213, 224, 183, 255],
};
const HIDDEN = [[0, 0], [0, 0], [0, 0]];
const TAU = Math.PI * 2;
const closed = points => [...points, points[0]];
const oval = (x, y, rx, ry = rx) => Array.from({ length: 33 }, (_, i) => [
    x + Math.cos(i * TAU / 32) * rx, y + Math.sin(i * TAU / 32) * ry,
]);
const rect = (x, y, w, h) => closed([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
const heart = (x, y, size) => closed(Array.from({ length: 32 }, (_, i) => {
    const t = i * TAU / 32;
    return [x + Math.pow(Math.sin(t), 3) * size,
        y - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * size / 16];
}));
const clamp = p => Math.max(0, Math.min(1, p));
const ease = p => { const t = clamp(p); return t * t * (3 - 2 * t); };

// Small cubic paths give each swirl a soft silhouette without image assets.
function curve(start, segments) {
    const points = [start];
    let from = start;
    for (const [a, b, end] of segments) {
        for (let i = 1; i <= 8; i++) {
            const t = i / 8, r = 1 - t;
            points.push([0, 1].map(axis => r * r * r * from[axis] + 3 * r * r * t * a[axis]
                + 3 * r * t * t * b[axis] + t * t * t * end[axis]));
        }
        from = end;
    }
    return closed(points);
}

function makePaperCup(game, parent) {
    const cup = game.object(parent);
    const part = (points, color) => game.part(cup, points, color);
    // A handle-free tapered cup, with a broad printed sleeve and rolled paper rim.
    part(closed([[-7, -5.7], [7, -5.7], [5.25, 6], [-5.25, 6]]), C.shadow);
    part(closed([[-6.65, -5.6], [6.65, -5.6], [4.95, 5.65], [-4.95, 5.65]]), C.white);
    part(closed([[-6.08, -1.65], [6.08, -1.65], [5.3, 3.55], [-5.3, 3.55]]), C.coral);
    part(heart(0, .75, 1.85), C.cream);
    part(oval(0, -5.6, 7.2, 1.4), C.white);
    part(oval(0, -5.85, 6.4, .85), C.inside);
    part(curve([-6.7, -5.2], [
        [[-3.5, -4.05], [3.5, -4.05], [6.7, -5.2]],
        [[3.3, -4.8], [-3.3, -4.8], [-6.7, -5.2]],
    ]), C.paper);
    return cup;
}

function addWhippedCream(game, cup) {
    // Allocate once. update() changes local points; place(cup) applies the pose.
    const tiers = [
        {
            start: 0, end: .38, anchor: -5.5,
            points: curve([-6.25, -5.45], [
                [[-7, -6.15], [-5.9, -7.7], [-4.45, -7.45]],
                [[-3.4, -8.55], [-1.4, -8.25], [-.4, -7.65]],
                [[1.25, -8.5], [3.05, -8.15], [3.75, -7.4]],
                [[5.5, -7.65], [6.9, -6.25], [6.25, -5.45]],
                [[3.6, -4.75], [-3.6, -4.75], [-6.25, -5.45]],
            ]),
        },
        {
            start: .24, end: .65, anchor: -7.2,
            points: curve([-4.95, -7.4], [
                [[-5.1, -8.85], [-3.7, -9.65], [-2.35, -9.35]],
                [[-1.5, -10.15], [.8, -10], [1.65, -9.2]],
                [[3.5, -9.55], [5.15, -8.35], [4.65, -7.45]],
                [[2.5, -6.8], [-3.1, -6.7], [-4.95, -7.4]],
            ]),
        },
        {
            start: .5, end: .86, anchor: -9.1,
            points: curve([-3.1, -9.4], [
                [[-3.3, -10.5], [-1.8, -11.4], [-.5, -11.1]],
                [[.6, -11.65], [2.65, -11.1], [2.75, -9.65]],
                [[1.6, -8.75], [-1.8, -8.8], [-3.1, -9.4]],
            ]),
        },
        {
            start: .74, end: 1, anchor: -10.65,
            points: curve([-1.7, -10.6], [
                [[-1.5, -11.9], [.35, -11.7], [.9, -13]],
                [[1.8, -12.65], [2.15, -11.25], [1.45, -10.6]],
                [[.7, -10.2], [-.85, -10.15], [-1.7, -10.6]],
            ]),
        },
    ];
    const parts = [];
    for (const tier of tiers) {
        tier.shadow = game.part(cup, HIDDEN, C.shadow);
        tier.cream = game.part(cup, HIDDEN, C.foam);
        parts.push(tier.shadow, tier.cream);
    }
    const cream = {
        parts,
        update(progress) {
            const p = Number.isFinite(progress) ? clamp(progress) : 0;
            for (const tier of tiers) {
                const grow = ease((p - tier.start) / (tier.end - tier.start));
                if (!grow) { tier.shadow.points = HIDDEN; tier.cream.points = HIDDEN; continue; }
                const width = .48 + grow * .52;
                tier.shadow.points = tier.points.map(([x, y]) => [x * width, tier.anchor + (y - tier.anchor) * grow]);
                // A narrow warm edge below each tier reads as a piped cream swirl.
                tier.cream.points = tier.points.map(([x, y]) => [x * width * .985,
                    tier.anchor + (y - tier.anchor) * grow - .2 * grow]);
            }
            return cream;
        },
    };
    cream.update(0);
    return cream;
}

function makeCreamDispenser(game, parent) {
    const can = game.object(parent);
    const part = (points, color) => game.part(can, points, color);
    // Rounded can, white shoulder, and a chunky side nozzle for squirting cream.
    part(oval(0, 4.05, 3.75, .95), C.teal);
    part(rect(-3.75, -5.25, 7.5, 9.3), C.teal);
    part(rect(-3.4, -5.2, 6.8, 9.1), C.mint);
    part(oval(0, -5.2, 3.75, 1.8), C.white);
    part(rect(-1.55, -8.1, 3.1, 2.8), C.white);
    part(oval(0, -8.1, 1.55, .65), C.teal);
    part(closed([[-4.9, -9.1], [.8, -9.1], [1.2, -8.3], [.8, -7.6], [-4.9, -7.6]]), C.white);
    part(rect(-4.9, -9.1, .75, 1.5), C.teal);
    part(rect(-3.4, -3.25, 6.8, 5.7), C.coral);
    part(oval(0, .85, 2.6, .75), C.white);
    part(oval(0, -.1, 1.9, .9), C.white);
    part(curve([-1.1, -.65], [
        [[-1.05, -1.6], [.35, -1.3], [.55, -2.25]],
        [[1.25, -1.85], [1.55, -.8], [.75, -.35]],
        [[.2, -.25], [-.55, -.25], [-1.1, -.65]],
    ]), C.white);
    part(rect(-2.8, 3.3, 5.6, .55), C.white);
    can.nozzle = [-4.9, -8.35];
    return can;
}

module.exports = { makePaperCup, addWhippedCream, makeCreamDispenser };
