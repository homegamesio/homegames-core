const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');

const COLORS = Colors.COLORS;

// DRAG TEST — exercises squish 1.4.4's node-level drag support end to end:
//   onClick  (press starts on a node)
//   onDrag   (held pointer moves — fires on the pressed node)
//   offClick (release, wherever it happens)
//   handleMouseMove (game-level held-pointer movement)
//
// onDrag/offClick are passed straight through the GameNode constructors —
// the new 1.4.4 API this game exists to test (no node.node assignment
// workaround).
//
// Three grabbable boxes + a drawing area behind them. Grab a box and drag it
// around; press + drag on the open background to rubber-band a new box —
// it previews translucently while held and is finalized on offClick.
// Press C to clear drawn boxes.

const BOX_SIZE = 12;
const MAX_DRAWN_BOXES = 50;
const MIN_DRAWN_SIZE = 1; // releases smaller than this are treated as stray clicks

// Finalized-box colors cycle per creation
const DRAWN_COLORS = [COLORS.PURPLE, COLORS.ORANGE, COLORS.TURQUOISE, COLORS.PINK, COLORS.GOLD];

const BOXES = [
    { label: 'A', x: 15, y: 20, fill: COLORS.RED },
    { label: 'B', x: 44, y: 20, fill: COLORS.GREEN },
    { label: 'C', x: 73, y: 20, fill: COLORS.BLUE },
];

class DragTest extends Game {
    static metadata() {
        return {
            squishVersion: '150',
            name: 'Drag Test',
            author: "Joseph Garcia",
            description: 'Test game for squish 1.4.4 click + drag support: grab boxes, rubber-band new ones.',
            aspectRatio: { x: 16, y: 9 },
            isTest: true
        };
    }

    constructor(options = {}) {
        super();

        this.grabs = {}; // playerId -> { box, dx, dy }
        this.drafts = {}; // playerId -> { anchorX, anchorY, node } — in-progress drawn box
        this.drawnBoxes = [];
        this.drawnCount = 0;

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.CREAM
        });

        // Drawing area — press anchors a corner, drag rubber-bands a preview,
        // offClick finalizes the box.
        this.drawCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [0, 0, 0, 0],
            onClick: (playerId, x, y) => this.startDraft(playerId, x, y),
            onDrag: (playerId, x, y) => this.resizeDraft(playerId, x, y),
            offClick: (playerId, x, y) => this.finalizeDraft(playerId, x, y)
        });

        this.drawnLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: [0, 0, 0, 0]
        });

        this.statusText = new GameNode.Text({
            textInfo: {
                text: 'grab a box, or drag on the background to draw a new one. C clears drawn boxes.',
                x: 50,
                y: 4,
                size: 1.6,
                align: 'center',
                color: COLORS.BLACK
            }
        });

        this.moveText = new GameNode.Text({
            textInfo: {
                text: 'handleMouseMove: —',
                x: 50,
                y: 95,
                size: 1.4,
                align: 'center',
                color: COLORS.BLACK
            }
        });

        this.boxes = BOXES.map((spec) => this.buildBox(spec));

        this.base.addChildren(
            this.drawCatcher,
            this.drawnLayer,
            ...this.boxes.map(b => b.node),
            this.statusText,
            this.moveText
        );
    }

    buildBox(spec) {
        const box = {
            label: spec.label,
            x: spec.x,
            y: spec.y,
            baseFill: spec.fill,
            node: null,
            labelNode: null
        };

        box.node = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(spec.x, spec.y, BOX_SIZE, BOX_SIZE),
            fill: spec.fill,
            onClick: (playerId, x, y) => this.grabBox(playerId, box, x, y),
            onDrag: (playerId, x, y) => this.dragBox(playerId, box, x, y),
            offClick: (playerId, x, y) => this.dropBox(playerId, box, x, y)
        });

        box.labelNode = new GameNode.Text({
            textInfo: {
                text: spec.label,
                x: spec.x + BOX_SIZE / 2,
                y: spec.y + BOX_SIZE / 2 - 1.5,
                size: 2.5,
                align: 'center',
                color: COLORS.WHITE
            }
        });
        box.node.addChild(box.labelNode);

        return box;
    }

    setStatus(text) {
        this.statusText.node.text = Object.assign({}, this.statusText.node.text, { text });
        this.statusText.node.onStateChange();
    }

    setMoveText(text) {
        this.moveText.node.text = Object.assign({}, this.moveText.node.text, { text });
        this.moveText.node.onStateChange();
    }

    // --- box drag lifecycle ------------------------------------------------

    grabBox(playerId, box, x, y) {
        // onClick re-fires ~30ms while held (the server's repeated-click
        // contract) and also fires when a drag passes over this box —
        // only a fresh press (no open grab/draft) starts a grab.
        if (this.grabs[playerId] || this.drafts[playerId]) return;

        this.grabs[playerId] = { box, dx: x - box.x, dy: y - box.y };
        box.node.update({ fill: COLORS.BLACK });
        this.setStatus(`player ${playerId} grabbed box ${box.label} (onClick)`);
    }

    dragBox(playerId, box, x, y) {
        const grab = this.grabs[playerId];
        if (!grab || grab.box !== box) return;

        box.x = Math.max(0, Math.min(100 - BOX_SIZE, x - grab.dx));
        box.y = Math.max(0, Math.min(100 - BOX_SIZE, y - grab.dy));

        box.node.update({ coordinates2d: ShapeUtils.rectangle(box.x, box.y, BOX_SIZE, BOX_SIZE) });
        box.labelNode.node.text = Object.assign({}, box.labelNode.node.text, {
            x: box.x + BOX_SIZE / 2,
            y: box.y + BOX_SIZE / 2 - 1.5
        });
        box.labelNode.node.onStateChange();

        this.setStatus(`player ${playerId} dragging box ${box.label} @ (${x.toFixed(1)}, ${y.toFixed(1)}) (onDrag)`);
    }

    dropBox(playerId, box, x, y) {
        const grab = this.grabs[playerId];
        if (grab && grab.box === box) {
            delete this.grabs[playerId];
        }
        box.node.update({ fill: box.baseFill });
        this.setStatus(`player ${playerId} dropped box ${box.label} @ (${x.toFixed(1)}, ${y.toFixed(1)}) (offClick)`);
    }

    // --- background box drawing ---------------------------------------------

    // Rect between the press anchor and the current pointer, dragging in any
    // direction, clamped to the play area.
    draftRect(draft, x, y) {
        const cx = Math.max(0, Math.min(100, x));
        const cy = Math.max(0, Math.min(100, y));
        const rx = Math.min(draft.anchorX, cx);
        const ry = Math.min(draft.anchorY, cy);
        return {
            x: rx,
            y: ry,
            w: Math.abs(cx - draft.anchorX),
            h: Math.abs(cy - draft.anchorY)
        };
    }

    startDraft(playerId, x, y) {
        // onClick re-fires ~30ms while held (the server's repeated-click
        // contract), so a drag in progress hits this repeatedly — without
        // this guard each re-click would re-anchor the draft at the pointer
        // and the box would finalize as 0x0. Also fires when a box drag
        // passes over the background. Only a fresh press starts a draft;
        // stale presses are closed out by the server (offClick fires before
        // a new press begins), so drafts[playerId] can't be left dangling.
        if (this.grabs[playerId] || this.drafts[playerId]) return;

        const color = DRAWN_COLORS[this.drawnCount % DRAWN_COLORS.length];
        // border requires color — the client renderer strokes with node.color
        // and dies on a border with no color, killing the whole frame.
        const preview = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, 0, 0),
            color: [color[0], color[1], color[2], 255],
            fill: [color[0], color[1], color[2], 120],
            border: 1
        });

        this.drafts[playerId] = { anchorX: x, anchorY: y, node: preview, color };
        this.drawnLayer.addChild(preview);
        this.setStatus(`player ${playerId} drawing a box from (${x.toFixed(1)}, ${y.toFixed(1)}) (onClick)`);
    }

    resizeDraft(playerId, x, y) {
        const draft = this.drafts[playerId];
        if (!draft) return;

        const r = this.draftRect(draft, x, y);
        draft.node.update({ coordinates2d: ShapeUtils.rectangle(r.x, r.y, r.w, r.h) });
        this.setStatus(`player ${playerId} sizing box ${r.w.toFixed(1)} x ${r.h.toFixed(1)} (onDrag)`);
    }

    finalizeDraft(playerId, x, y) {
        const draft = this.drafts[playerId];
        if (!draft) return;
        delete this.drafts[playerId];

        const r = this.draftRect(draft, x, y);
        if (r.w < MIN_DRAWN_SIZE || r.h < MIN_DRAWN_SIZE) {
            // Barely moved — treat as a stray click, not a box.
            this.drawnLayer.removeChild(draft.node.node.id);
            this.setStatus(`player ${playerId} released without dragging — no box (offClick)`);
            return;
        }

        // Solidify the preview in place.
        draft.node.update({
            coordinates2d: ShapeUtils.rectangle(r.x, r.y, r.w, r.h),
            fill: draft.color
        });

        this.drawnBoxes.push(draft.node);
        this.drawnCount++;
        if (this.drawnBoxes.length > MAX_DRAWN_BOXES) {
            const oldest = this.drawnBoxes.shift();
            this.drawnLayer.removeChild(oldest.node.id);
        }

        this.setStatus(`player ${playerId} finalized a ${r.w.toFixed(1)} x ${r.h.toFixed(1)} box (offClick)`);
    }

    discardDraft(playerId) {
        const draft = this.drafts[playerId];
        if (!draft) return;
        delete this.drafts[playerId];
        this.drawnLayer.removeChild(draft.node.node.id);
    }

    clearDrawnBoxes() {
        this.drawnBoxes = [];
        for (const pid of Object.keys(this.drafts)) this.discardDraft(pid);
        this.drawnLayer.clearChildren();
        this.setStatus('drawn boxes cleared');
    }

    // --- game hooks ----------------------------------------------------------

    handleKeyDown(playerId, key) {
        if (key === 'c' || key === 'C') {
            this.clearDrawnBoxes();
        }
    }

    handleMouseMove(playerId, { x, y }) {
        this.setMoveText(`handleMouseMove: player ${playerId} @ (${x.toFixed(1)}, ${y.toFixed(1)})`);
    }

    handleNewPlayer({ playerId, info }) {
        this.setStatus(`player ${playerId} (${(info && info.name) || 'unknown'}) joined`);
    }

    handlePlayerDisconnect(playerId) {
        const grab = this.grabs[playerId];
        if (grab) {
            grab.box.node.update({ fill: grab.box.baseFill });
            delete this.grabs[playerId];
        }
        this.discardDraft(playerId);
        this.setStatus(`player ${playerId} left`);
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = DragTest;
