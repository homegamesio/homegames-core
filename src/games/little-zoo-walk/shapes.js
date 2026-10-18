const TAU = Math.PI * 2;
const HIDDEN = [[0, 0], [0, 0], [0, 0]];
const closed = points => [...points, points[0]];
const rect = (x, y, w, h) => closed([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
const oval = (x, y, rx, ry = rx, n = 28) => Array.from({ length: n + 1 }, (_, i) => [x + Math.cos(i * TAU / n) * rx, y + Math.sin(i * TAU / n) * ry]);
const stroke = (points, width) => {
    const a = [], b = [];
    points.forEach(([x, y], i) => {
        const p = points[Math.max(0, i - 1)], q = points[Math.min(points.length - 1, i + 1)];
        const angle = Math.atan2(q[1] - p[1], q[0] - p[0]);
        a.push([x - Math.sin(angle) * width / 2, y + Math.cos(angle) * width / 2]);
        b.unshift([x + Math.sin(angle) * width / 2, y - Math.cos(angle) * width / 2]);
    });
    return closed([...a, ...b]);
};
const heart = (x, y, size) => closed(Array.from({ length: 36 }, (_, i) => {
    const a = i * TAU / 36;
    return [x + size * Math.pow(Math.sin(a), 3), y - size * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16];
}));
module.exports = { TAU, HIDDEN, closed, rect, oval, stroke, heart };
