const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { COLORS } = Colors;

class DumpTruckGame extends Game {
    static metadata() {
        return {
            // Catalog review: Vehicle movement sketch; Happy Haulers and Red Truck Ramble develop this idea.
            isTest: true,
            squishVersion: '150',
            name: 'Dump Truck',
            author: "Joseph Garcia",
            description: 'Control a detailed polygonal 2d dump truck',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 30
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.SKY_BLUE
        });
        const ground = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 80, 100, 20),
            fill: COLORS.GREEN,
            color: [123, 123, 123, 255],//COLORS.DARK_GREEN,
            border: 2
        });
        this.base.addChild(ground);
        this.players = {};
    }

    getLayers() {
        return [{ root: this.base }];
    }

    handleNewPlayer({ playerId, info }) {
        const color = Colors.randomColor(['BLACK', 'ALMOST_BLACK', 'HG_BLACK', 'CHARCOAL']);
        const x = 20 + Math.random() * 60;
        const y = 70;
        const chassis = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: color,
            color: COLORS.BLACK,
            border: 3
        });
        const cab = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: COLORS.RED,
            color: COLORS.BLACK,
            border: 3
        });
        const cabWindow = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: COLORS.ALMOST_WHITE,
            color: COLORS.BLACK,
            border: 2
        });
        const bed = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: COLORS.YELLOW,
            color: COLORS.BLACK,
            border: 3
        });
        const bedLiner = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: COLORS.GOLD,
            color: COLORS.BLACK,
            border: 2
        });
        const wheelFL = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: COLORS.BLACK
        });
        const wheelFR = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: COLORS.BLACK
        });
        const wheelRL = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: COLORS.BLACK
        });
        const wheelRR = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: COLORS.BLACK
        });
        const exhaust = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: COLORS.GRAY,
            color: COLORS.BLACK,
            border: 2
        });

        this.base.addChildren(chassis, cab, cabWindow, bed, bedLiner, wheelFL, wheelFR, wheelRL, wheelRR, exhaust);

        this.players[playerId] = {
            x, y,
            vx: 0,
            bedAngle: 0,
            tiltUp: false,
            tiltDown: false,
            nodes: { chassis, cab, cabWindow, bed, bedLiner, wheelFL, wheelFR, wheelRL, wheelRR, exhaust }
        };
        this.updateTruck(playerId);
    }

    handlePlayerDisconnect(playerId) {
        const p = this.players[playerId];
        if (!p) return;
        for (const n of Object.values(p.nodes)) {
            this.base.removeChild(n.id);
        }
        delete this.players[playerId];
    }

    handleKeyDown(playerId, key) {
        const p = this.players[playerId];
        if (!p) return;
        if (key === 'ArrowLeft' || key === 'a') p.vx = -2;
        else if (key === 'ArrowRight' || key === 'd') p.vx = 2;
        if (key === 'ArrowUp' || key === 'w' || key === ' ') p.tiltUp = true;
        if (key === 'ArrowDown' || key === 's') p.tiltDown = true;
    }

    handleKeyUp(playerId, key) {
        const p = this.players[playerId];
        if (!p) return;
        if (key === 'ArrowLeft' || key === 'a' || key === 'ArrowRight' || key === 'd') p.vx = 0;
        if (key === 'ArrowUp' || key === 'w' || key === ' ') p.tiltUp = false;
        if (key === 'ArrowDown' || key === 's') p.tiltDown = false;
    }

    tick() {
        let changed = false;
        for (const id in this.players) {
            const p = this.players[id];
            p.x += p.vx;
            if (p.x < 5) p.x = 5;
            if (p.x > 95) p.x = 95;
            if (p.tiltUp) p.bedAngle = Math.min(0.9, p.bedAngle + 0.04);
            if (p.tiltDown) p.bedAngle = Math.max(0, p.bedAngle - 0.04);
            this.updateTruck(id);
            changed = true;
        }
        if (changed) this.base.node.onStateChange();
    }

    makeCircle(cx, cy, r, sides = 12) {
        const pts = [];
        for (let i = 0; i <= sides; i++) {
            const a = (i / sides) * Math.PI * 2;
            pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        return pts;
    }

    updateTruck(playerId) {
        const p = this.players[playerId];
        if (!p) return;
        const { x, y, bedAngle } = p;
        const { chassis, cab, cabWindow, bed, bedLiner, wheelFL, wheelFR, wheelRL, wheelRR, exhaust } = p.nodes;

        chassis.node.coordinates2d = ShapeUtils.rectangle(x - 9, y - 3, 18, 6);
        cab.node.coordinates2d = ShapeUtils.rectangle(x - 9, y - 9, 6, 6);
        cabWindow.node.coordinates2d = ShapeUtils.rectangle(x - 8.5, y - 8, 4.5, 4);
        exhaust.node.coordinates2d = ShapeUtils.rectangle(x - 8, y - 2, 2, 3);

        const wheelR = 2.5;
        wheelFL.node.coordinates2d = this.makeCircle(x - 7, y + 3, wheelR);
        wheelFR.node.coordinates2d = this.makeCircle(x + 7, y + 3, wheelR);
        wheelRL.node.coordinates2d = this.makeCircle(x - 7, y + 3, wheelR);
        wheelRR.node.coordinates2d = this.makeCircle(x + 7, y + 3, wheelR);

        const bedWidth = 12;
        const bedHeight = 4;
        const hingeOffsetX = 3;
        const hingeOffsetY = -3;
        const hx = x + hingeOffsetX;
        const hy = y + hingeOffsetY;
        const cos = Math.cos(bedAngle);
        const sin = Math.sin(bedAngle);
        const local = [
            [-bedWidth / 2, 0],
            [ bedWidth / 2, 0],
            [ bedWidth / 2, -bedHeight],
            [-bedWidth / 2, -bedHeight]
        ];
        const pts = [];
        for (const [lx, ly] of local) {
            const rx = lx * cos - ly * sin;
            const ry = lx * sin + ly * cos;
            pts.push([hx + rx, hy + ry]);
        }
        pts.push(pts[0]);
        bed.node.coordinates2d = pts;

        const linerOffset = 0.6;
        const linerPts = [];
        for (let i = 0; i < 4; i++) {
            const [lx, ly] = local[i];
            const rx = lx * cos - ly * sin;
            const ry = lx * sin + ly * cos;
            linerPts.push([hx + rx + (i === 2 || i === 3 ? linerOffset : -linerOffset), hy + ry + linerOffset]);
        }
        linerPts.push(linerPts[0]);
        bedLiner.node.coordinates2d = linerPts;
    }
}

module.exports = DumpTruckGame;