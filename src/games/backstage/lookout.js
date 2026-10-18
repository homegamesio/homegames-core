'use strict';
const { ViewableGame, ViewUtils } = require('squish-150');
const { UI, C, group, clamp, polygon } = require('./ui');

// This really is a ViewableGame. The surrounding tutorial remains a regular
// Game and mounts the view in its own screen alongside a fixed teaching HUD.
class Lookout extends ViewableGame {
    constructor(onBeacon) {
        super(200);
        const u = new UI(this.getPlane());
        u.rect(0, 0, 200, 200, C.ink);
        for (let x = 0; x < 200; x += 20) u.rect(x, 0, .5, 200, C.line);
        for (let y = 0; y < 200; y += 20) u.rect(0, y, 200, .5, C.line);
        this.beacons = [[30, 30], [154, 46], [150, 160]];
        this.beaconNodes = this.beacons.map(([x, y], i) => {
            const node = u.shape(polygon(x, y, 8, 6, 1.5), [C.gold, C.mint, C.coral][i], {
                onClick: id => onBeacon(id, i),
            });
            u.text(String(i + 1), x, y - 5, 2.2, C.ink, 'center');
            return node;
        });
        this.views = new Map();
    }
    join(id) { this.views.set(id, { x: 0, y: 0, w: 100, h: 100 }); }
    pan(id, dx, dy) {
        const view = this.views.get(id);
        if (!view) return;
        view.x = clamp(view.x + dx, 0, 200 - view.w);
        view.y = clamp(view.y + dy, 0, 200 - view.h);
    }
    zoom(id) {
        const v = this.views.get(id); if (!v) return;
        const next = v.w === 100 ? 60 : 100;
        v.x = clamp(v.x + (v.w - next) / 2, 0, 200 - next);
        v.y = clamp(v.y + (v.h - next) / 2, 0, 200 - next);
        v.w = v.h = next;
    }
    slice(id, lit = new Set()) {
        const view = this.views.get(id);
        if (!view) return group(id);
        // ViewUtils clips in world units before scaling. A 100-unit view uses
        // the stock helper directly; for zoom the tighter window culls nodes.
        const slice = ViewUtils.getView(this.getPlane(), view, [id], { x: 6, y: 29 }, { x: 58 / view.w, y: 40 / view.h });
        // The helper's built-in clipping assumes a full 100-unit viewport.
        // Clip the inset/zoomed experiment to its own screen rectangle too.
        for (const child of [...slice.getChildren()]) {
            const index = this.beaconNodes.findIndex(node => node.id === child.id);
            if (lit.has(index)) child.update({ fill: C.paper, effects: { shadow: { color: C.mint, blur: 12 } } });
            const text = child.node.text;
            if (text && (text.x < 6 || text.x > 64 || text.y < 29 || text.y > 67)) slice.removeChild(child.id);
            else if (child.node.coordinates2d) child.update({ coordinates2d: child.node.coordinates2d.map(([x, y]) => [clamp(x, 6, 64), clamp(y, 29, 69)]) });
        }
        return slice;
    }
    leave(id) { this.views.delete(id); }
}
module.exports = Lookout;
