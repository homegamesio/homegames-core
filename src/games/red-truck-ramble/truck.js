/* Original vector pickup, inspired by the square early-2000s Super Duty shape.
 * Coordinates are local world units: nose to the right, wheel centers at y=5.
 * Paint body parts in order, then paint a copy of wheelParts at each wheel.
 */

const INK = '#293b46';

function part(fill, points) {
    const closed = points.map(([x, y]) => ({ x, y }));
    closed.push({ ...closed[0] });
    return { fill, points: closed };
}

function rectangle(fill, x, y, width, height) {
    return part(fill, [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]);
}

function ellipse(fill, x, y, rx, ry, count = 24) {
    return part(fill, Array.from({ length: count }, (_, i) => {
        const a = i * Math.PI * 2 / count;
        return [x + Math.cos(a) * rx, y + Math.sin(a) * ry];
    }));
}

function wheelArch(x, radius) {
    return Array.from({ length: 13 }, (_, i) => {
        const a = -Math.PI * i / 12;
        return [x + Math.cos(a) * radius, 5 + Math.sin(a) * radius];
    });
}

function truckParts() {
    const body = [
        // The dark outline itself has open wheel arches: no background masks.
        part(INK, [
            [-21.1, -6.1], [-8.5, -6.1], [-7.2, -12.2], [-5.7, -12.8],
            [2.8, -12.8], [4.1, -12.1], [8, -6.1], [19.8, -5.8],
            [21.6, -4.1], [21.6, 5], ...wheelArch(12, 5.5),
            ...wheelArch(-11, 5.5), [-21.1, 5]
        ]),
        part('#d9403d', [
            [-20.5, -5.5], [-7.9, -5.5], [-6.6, -11.7], [-5.6, -12.2],
            [2.6, -12.2], [3.6, -11.6], [7.7, -5.5], [19.6, -5.2],
            [21, -3.8], [21, 4.4], [17.9, 4.4], ...wheelArch(12, 6),
            ...wheelArch(-11, 6), [-20.5, 4.4]
        ]),
        // Bed rail, slightly raised tailgate, and a broad sunlit red panel.
        rectangle('#f36a57', -20.5, -5.5, 12.6, 1.05),
        rectangle('#9c302f', -20.3, -4.1, 0.6, 7.6),
        part('#e74b43', [[-19.3, -3.9], [-8.7, -3.9], [-8.7, -1.6], [-14.4, -1.6], [-17.2, 0.5], [-19.3, 0.5]]),
        rectangle('#f88b6d', -18.4, -3.2, 8.2, 0.45),
        rectangle('#fff0cb', -20.9, -3.4, 0.9, 2.1),
        rectangle('#ed7754', -20.9, -1.3, 0.9, 1.2),
        // Extended-cab rear quarter window and the large front door window.
        part(INK, [[-6.1, -11.3], [-3.2, -11.3], [-3.2, -5.4], [-7.3, -5.4]]),
        part('#7fb8bd', [[-5.7, -10.7], [-3.8, -10.7], [-3.8, -6], [-6.6, -6]]),
        part('#cce8df', [[-5.7, -10.7], [-4.8, -10.7], [-5.6, -6], [-6.6, -6]]),
        part(INK, [[-2.6, -11.3], [2.4, -11.3], [6.2, -5.4], [-2.6, -5.4]]),
        part('#9ccdd0', [[-2, -10.7], [2.1, -10.7], [5.2, -6], [-2, -6]]),
        part('#d8eee4', [[-1.8, -10.7], [-0.5, -10.7], [-1.3, -6], [-1.8, -6]]),
        // A little bear driver is visible above the door, with both eyes forward.
        ellipse('#ad714b', 0.2, -8.5, 0.58, 0.58, 12),
        ellipse('#ad714b', 2.2, -8.5, 0.58, 0.58, 12),
        ellipse('#d8a577', 1.2, -7.4, 1.35, 1.55, 18),
        ellipse('#edc393', 1.65, -6.9, 0.7, 0.52, 12),
        ellipse(INK, 1.05, -7.8, 0.16, 0.2, 10),
        ellipse(INK, 2.03, -7.6, 0.16, 0.2, 10),
        ellipse(INK, 1.94, -7.05, 0.22, 0.16, 10),
        // Red belt line and door shapes keep the driver tucked inside the cab.
        rectangle('#f16b54', -7.4, -5.6, 14.9, 0.65),
        rectangle('#ac3433', -3.2, -4.8, 0.32, 8.35),
        part('#ac3433', [[6.6, -4.8], [7, -4.8], [7, 0.1], [6.6, 0.8]]),
        rectangle('#f4745c', -2.3, -4.6, 7.7, 0.42),
        rectangle(INK, -1.9, -3.6, 2, 0.68),
        rectangle('#e2e6dc', -1.65, -3.48, 1.35, 0.26),
        rectangle(INK, -4.9, -3.5, 1.25, 0.58),
        // Long, almost horizontal hood: the defining early Super Duty profile.
        part('#ef5c4a', [[7.7, -5.5], [19.5, -5.2], [20.8, -3.9], [8, -3.9]]),
        part('#ff9672', [[8.1, -5.05], [19.1, -4.83], [19.75, -4.4], [8.2, -4.4]]),
        rectangle('#b93231', 8.1, -3.7, 10.7, 0.34),
        // A small chrome fender badge and black towing mirror, without text.
        rectangle('#e2e4d9', 7.8, -2.9, 2.05, 0.8),
        rectangle('#718a8b', 8.05, -2.65, 1.5, 0.22),
        part(INK, [[5.7, -6.7], [8, -7.5], [8.35, -6.4], [6.2, -5.6]]),
        part(INK, [[7.6, -8.9], [9.5, -8.9], [9.8, -8.5], [9.8, -6.1], [7.6, -6.1]]),
        rectangle('#a8babc', 8.85, -8.42, 0.5, 1.6),
        // Rectangular headlight, amber indicator, and chrome front edge.
        part(INK, [[18.7, -3.5], [21, -3.5], [21, -0.8], [18.7, -0.8]]),
        rectangle('#fff5ca', 19, -3.2, 1.65, 1.6),
        rectangle('#f1aa43', 19, -1.5, 1.65, 0.4),
        rectangle('#c8d2cf', 21, -2.8, 0.75, 5.6),
        rectangle('#5b7278', 21.25, -1.7, 0.45, 0.4),
        rectangle('#5b7278', 21.25, -0.5, 0.45, 0.4),
        rectangle('#5b7278', 21.25, 0.7, 0.45, 0.4),
        // Bumpers and a chrome running board across the bottom of the cab.
        part(INK, [[18.2, 2.6], [22.4, 2.6], [22.4, 4.8], [17.8, 4.8]]),
        rectangle('#d7ddd4', 18.4, 2.9, 3.7, 1.2),
        rectangle('#8fa5a7', 18.4, 4.1, 3.7, 0.36),
        rectangle(INK, -22.1, 2.5, 3.1, 2.3),
        rectangle('#d7ddd4', -21.8, 2.8, 2.4, 1.1),
        part(INK, [[-5.1, 3.1], [5.8, 3.1], [6.1, 4.8], [-5.5, 4.8]]),
        rectangle('#bbc9c4', -5.1, 3.4, 10.8, 0.72),
        rectangle('#748d8e', -4.5, 4.2, 9.4, 0.38)
    ];

    // Tread teeth and a single eight-spoke polygon keep the whole truck to 63
    // shapes while making spinning wheels legible even on a small screen.
    const tread = [];
    for (let i = 0; i < 12; i++) {
        for (const [offset, radius] of [[0, 4.08], [0.09, 4.3], [0.43, 4.3], [0.52, 4.08]]) {
            const a = i * Math.PI / 6 + offset;
            tread.push([Math.cos(a) * radius, Math.sin(a) * radius]);
        }
    }
    const spokes = [];
    for (let i = 0; i < 8; i++) {
        for (const [offset, radius] of [[-0.16, 0.63], [-0.15, 2.07], [0.15, 2.07], [0.16, 0.63]]) {
            const a = i * Math.PI / 4 + offset;
            spokes.push([Math.cos(a) * radius, Math.sin(a) * radius]);
        }
    }
    const wheelParts = [
        part('#24363e', tread),
        ellipse('#3b4b4e', 0, 0, 3.65, 3.65, 28),
        ellipse('#c3d0c9', 0, 0, 2.34, 2.34, 24),
        ellipse('#617f84', 0, 0, 1.89, 1.89, 24),
        part('#e8ede1', spokes),
        ellipse('#a7bfba', 0, 0, 0.77, 0.77, 16)
    ];

    return {
        body,
        wheels: [{ x: -11, y: 5, radius: 4.3 }, { x: 12, y: 5, radius: 4.3 }],
        wheelParts,
        bounds: { left: -22.1, right: 22.4, top: -12.8, bottom: 9.3 }
    };
}

module.exports = { truckParts };
