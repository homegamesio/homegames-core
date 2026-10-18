// All dimensions use the playfield's physical world units. Descriptors are
// deliberately free of engine state: every piece becomes an ordinary free body.
const FLOOR = 76;
const structureNames = Object.freeze(['tower', 'bridge', 'dominoes']);
const block = (x, y, width, height, colorIndex) => ({ x, y, width, height, colorIndex });

function tower() {
    const blocks = [];
    // Small alternating offsets give the rows a woven appearance while keeping
    // each block's center over the block underneath it.
    for (let row = 0; row < 5; row++) {
        const centers = row % 2 ? [66, 78, 90] : [64, 78, 92];
        centers.forEach((x, i) => blocks.push(block(x, FLOOR - 4 - row * 8, 12, 8, (row + i * 2) % 6)));
    }
    [64, 78, 92].forEach((x, i) => blocks.push(block(x, 33.5, 14, 5, (i + 2) % 6)));
    [64, 78, 92].forEach((x, i) => blocks.push(block(x, 27.5, 10, 7, (i + 4) % 6)));
    return blocks;
}

function bridge() {
    const blocks = [];
    // The lintel rests on both piers. Its center lies between their contacts;
    // there are no floating wedge pieces or artificially pinned arch stones.
    for (let row = 0; row < 3; row++) {
        [54, 96].forEach((x, i) => blocks.push(block(x, FLOOR - 5 - row * 10, 12, 10, (row + i * 3) % 6)));
    }
    blocks.push(block(75, 43, 54, 6, 2));
    [54, 75, 96].forEach((x, i) => blocks.push(block(x, 36, 9, 8, (i + 3) % 6)));
    return blocks;
}

function dominoes() {
    const heights = [17, 15, 13, 15, 17, 15, 13, 15, 17, 15, 13];
    // A tipped piece reaches its neighbor, but upright pieces have clear gaps.
    // All bases share the same floor so the chain needs no scripted motion.
    return heights.map((height, i) => block(36 + i * 7, FLOOR - height / 2, 3.6, height, i % 6));
}

function presetBlocks(index = 0) {
    const selected = Number.isFinite(index) ? ((Math.trunc(index) % 3) + 3) % 3 : 0;
    return [tower, bridge, dominoes][selected]();
}

// Fit the actual arrangement into a small rectangle, preserving proportions.
// Returned x/y values are centers, just like the full-size block descriptors.
function thumbnailBlocks(index, { x = 0, y = 0, width = 1, height = 1 } = {}) {
    const blocks = presetBlocks(index);
    const left = Math.min(...blocks.map(b => b.x - b.width / 2));
    const right = Math.max(...blocks.map(b => b.x + b.width / 2));
    const top = Math.min(...blocks.map(b => b.y - b.height / 2));
    const bottom = Math.max(...blocks.map(b => b.y + b.height / 2));
    const scale = Math.min(width / (right - left), height / (bottom - top));
    const offsetX = x + (width - (right - left) * scale) / 2;
    const offsetY = y + (height - (bottom - top) * scale) / 2;
    return blocks.map(b => ({
        ...b, x: offsetX + (b.x - left) * scale, y: offsetY + (b.y - top) * scale,
        width: b.width * scale, height: b.height * scale,
    }));
}

module.exports = { structureNames, presetBlocks, thumbnailBlocks };
