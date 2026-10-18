const { GameNode, Shapes, ShapeUtils } = require('squish-150');

const T = {
    felt: [48, 76, 57, 255],
    feltDeep: [37, 60, 45, 255],
    wood: [100, 70, 48, 255],
    woodLight: [130, 94, 66, 255],
    cream: [246, 239, 220, 255],
    paper: [250, 247, 237, 255],
    ink: [50, 44, 38, 255],
    red: [154, 52, 55, 255],
    black: [43, 42, 40, 255],
    gold: [238, 198, 105, 255],
    muted: [224, 216, 193, 255],
    soft: [222, 214, 192, 255],
    shadow: [28, 38, 30, 255],
    select: [214, 182, 104, 255],
    good: [63, 99, 70, 255]
};

function text(text, x, y, size, color = T.cream, playerIds, align = 'center') {
    return new GameNode.Text({ textInfo: { text, x, y, size, align, color, font: 'default' }, playerIds });
}

function button(x, y, w, h, label, onClick, playerIds, fill = T.wood) {
    const n = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(x, y, w, h),
        fill, color: T.woodLight, border: 4, onClick, playerIds
    });
    const t = text(label, x + w / 2, y + h * 0.27, Math.min(2.1, h * 0.32), fill === T.gold || fill === T.select ? T.ink : T.cream);
    n.addChild(t);
    n._label = t;
    return n;
}

function showButton(n, playerIds) {
    n.node.playerIds = playerIds;
    if (n._label) n._label.node.playerIds = [];
}

function card(x, y, w, h, onClick, playerIds) {
    const n = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(x, y, w, h),
        fill: T.paper, color: T.soft, border: 5, onClick, playerIds
    });
    const rank = text('', x + w * 0.18, y + h * 0.12, Math.min(2.6, w * 0.22, h * 0.28), T.ink, undefined, 'left');
    const suit = text('', x + w * 0.5, y + h * 0.43, Math.min(4.2, w * 0.34, h * 0.36), T.ink);
    // A symbol makes selectable/selected cards readable without color cues.
    const cue = text('', x + w * 0.8, y + h * 0.1, Math.min(2.2, w * 0.19), T.ink);
    n.addChildren(rank, suit, cue);
    n._cue = cue;
    n._interactive = typeof onClick === 'function';
    n._rank = rank;
    n._suit = suit;
    return n;
}

function setCard(n, c, selected = false, enabled = true) {
    if (!c) {
        n._cue.node.text.text = '';
        n.node.fill = T.feltDeep;
        n.node.color = T.feltDeep;
        n.node.playerIds = [0];
        n._rank.node.text = { text: '', x: n._rank.node.text.x, y: n._rank.node.text.y, size: n._rank.node.text.size, align: 'left', color: T.ink, font: 'default' };
        n._suit.node.text = { text: '', x: n._suit.node.text.x, y: n._suit.node.text.y, size: n._suit.node.text.size, align: 'center', color: T.ink, font: 'default' };
        return;
    }
    const red = c.suit === 'H' || c.suit === 'D';
    const color = red ? T.red : T.black;
    n.node.fill = selected ? [255, 246, 213, 255] : enabled ? T.paper : [216, 212, 200, 255];
    n._cue.node.text.text = n._interactive ? (selected ? '✓' : enabled ? '•' : '') : '';
    n.node.color = selected ? T.gold : (enabled ? T.soft : [175, 167, 148, 255]);
    n.node.border = selected ? 12 : (enabled ? 7 : 3);
    n._rank.node.text = { text: c.rank, x: n._rank.node.text.x, y: n._rank.node.text.y, size: n._rank.node.text.size, align: 'left', color, font: 'default' };
    n._suit.node.text = { text: c.symbol, x: n._suit.node.text.x, y: n._suit.node.text.y, size: n._suit.node.text.size, align: 'center', color, font: 'default' };
}

function tableRoot() {
    const root = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(0,0,100,100), fill: T.wood });
    const felt = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(3,3,94,94), fill: T.felt, color: T.woodLight, border: 6 });
    root.addChild(felt);
    return { root, felt };
}

module.exports = { T, text, button, showButton, card, setCard, tableRoot };
