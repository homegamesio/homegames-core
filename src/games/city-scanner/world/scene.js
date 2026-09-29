'use strict';

// The wire format expects viewport coordinates. Clip polygons before encoding;
// offscreen world coordinates can otherwise wrap or clamp into giant shapes.
function clipPolygon(points) {
    if (!points || points.length < 3) return [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of points) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    if (maxX <= 0 || minX >= 100 || maxY <= 0 || minY >= 100 || minX === maxX || minY === maxY) return [];
    if (minX >= 0 && maxX <= 100 && minY >= 0 && maxY <= 100) return points;

    let output = points;
    for (const [axis, edge, direction] of [[0, 0, 1], [0, 100, -1], [1, 0, 1], [1, 100, -1]]) {
        const input = output;
        output = [];
        if (!input.length) return output;
        let previous = input[input.length - 1];
        let previousInside = (previous[axis] - edge) * direction >= 0;
        for (const current of input) {
            const inside = (current[axis] - edge) * direction >= 0;
            if (inside !== previousInside) {
                const t = (edge - previous[axis]) / (current[axis] - previous[axis]);
                const intersection = [previous[0] + t * (current[0] - previous[0]), previous[1] + t * (current[1] - previous[1])];
                intersection[axis] = edge;
                output.push(intersection);
            }
            if (inside) output.push(current);
            previous = current;
            previousInside = inside;
        }
    }
    if (output.length < 3) return [];
    const first = output[0], last = output[output.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) output.push(first);
    return output;
}

// Keep the complete pool privately, but attach only visible nodes to the game
// tree. Preserve node IDs and painter order across camera moves. Cached clipping
// also lets static scenery keep its geometry between camera/lighting updates.
class VisibleScene {
    constructor(root) {
        const capture = (shape) => ({ shape, children: shape.getChildren().map(capture), source: null, output: null, clipped: [] });
        this.root = capture(root);
    }

    update(entry = this.root) {
        const node = entry.shape.node;
        if (entry.children.length) {
            const children = [];
            for (const child of entry.children) {
                if (this.update(child)) children.push(child.shape);
            }
            node.children = children;
        }
        if (node.coordinates2d !== entry.output && node.coordinates2d !== entry.source) {
            entry.source = node.coordinates2d;
            // Reserve the header and footer for controls, including both lanes
            // of traffic in the viewport rather than covering them with UI.
            entry.clipped = clipPolygon(entry.source).map(([x, y]) => [x, 13 + y * 0.81]);
            entry.output = entry.clipped.length ? entry.clipped : undefined;
        }
        // A grouping node may retain visible children with no shape of its
        // own. Omit coordinates instead of emitting an empty polygon: older
        // clients assume any encoded polygon has a first vertex.
        node.coordinates2d = entry.output;
        return node.children.length > 0 || !!node.text || (entry.clipped.length > 0 &&
            (!!node.handleClick || (node.fill && node.fill[3] > 0) || (node.border && node.color && node.color[3] > 0)));
    }
}

module.exports = { clipPolygon, VisibleScene };
