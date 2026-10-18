const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { COLORS } = Colors;

const TUNING = {
    TICK_RATE: 12, // MUST match metadata().tickRate literal.
    MAX_PLAYERS: 6, // MUST match metadata().maxPlayers literal.
    AGES: 8,
    REVEAL_SECONDS: 3.6,
    IMPACT_AT_SECONDS: 0.9,
    MIN_ACTORS: 3,
    MAX_STAT: 12,
    TREE_POOL: 14,
    HOUSE_POOL: 8,
    WONDER_POOL: 6,
    RIVER_POOL: 3,
    CRACK_POOL: 4,
    STAR_COUNT: 14,
    REVEAL_POOL: 6,
    PULSE_POOL: 3
};

const DT = 1 / TUNING.TICK_RATE;
const TRANSPARENT = [0, 0, 0, 0];
const WHITE = [245, 247, 255, 255];
const MUTED = [174, 184, 205, 255];
const PANEL = [15, 20, 36, 255];
const PANEL_2 = [25, 32, 52, 255];
const OUTLINE = [74, 88, 122, 255];

const POWERS = {
    root: {
        key: 'root',
        label: 'ROOT',
        color: [63, 191, 111, 255],
        dark: [31, 104, 69, 255],
        hint: 'Grow nature'
    },
    rise: {
        key: 'rise',
        label: 'RISE',
        color: [242, 155, 63, 255],
        dark: [137, 75, 31, 255],
        hint: 'Build cities'
    },
    tide: {
        key: 'tide',
        label: 'TIDE',
        color: [65, 170, 239, 255],
        dark: [28, 91, 143, 255],
        hint: 'Restore balance'
    },
    spark: {
        key: 'spark',
        label: 'SPARK',
        color: [192, 106, 245, 255],
        dark: [101, 49, 145, 255],
        hint: 'Create wonder'
    }
};

const POWER_ORDER = ['root', 'rise', 'tide', 'spark'];

const PROPHECIES = [
    {
        title: 'ROOTKEEPER',
        prompt: 'Finish with NATURE >= PEOPLE',
        test: s => s.nature >= s.people
    },
    {
        title: 'SKYBUILDER',
        prompt: 'Finish with PEOPLE >= NATURE',
        test: s => s.people >= s.nature
    },
    {
        title: 'DREAMER',
        prompt: 'Reach WONDER 8',
        test: s => s.wonder >= 8
    },
    {
        title: 'PEACEMAKER',
        prompt: 'Finish with BALANCE 7',
        test: s => s.balance >= 7
    },
    {
        title: 'EQUALIZER',
        prompt: 'Keep NATURE, PEOPLE, WONDER within 2',
        test: s => Math.max(s.nature, s.people, s.wonder) - Math.min(s.nature, s.people, s.wonder) <= 2
    },
    {
        title: 'EDGEWALKER',
        prompt: 'Finish alive with BALANCE 1-3',
        test: s => s.balance >= 1 && s.balance <= 3
    }
];

const BOT_TEMPLATES = [
    { id: 'bot-moss', name: 'MOSS', favorite: 'root' },
    { id: 'bot-brick', name: 'BRICK', favorite: 'rise' },
    { id: 'bot-moon', name: 'MOON', favorite: 'spark' },
    { id: 'bot-rain', name: 'RAIN', favorite: 'tide' }
];

function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
}

function clampByte(value) {
    return Math.round(clamp(value, 0, 255));
}

function copyColor(color) {
    return [color[0], color[1], color[2], color[3]];
}

function setText(textNode, value, overrides = {}) {
    const prior = textNode && textNode.node && textNode.node.text;
    if (!prior || typeof prior !== 'object') return false;
    textNode.node.text = {
        ...prior,
        ...overrides,
        text: String(value)
    };
    return true;
}

function ellipse(cx, cy, rx, ry, sides = 28) {
    const points = [];
    for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        points.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return points;
}

function diamond(cx, cy, w, h) {
    return [
        [cx, cy - h / 2],
        [cx + w / 2, cy],
        [cx, cy + h / 2],
        [cx - w / 2, cy],
        [cx, cy - h / 2]
    ];
}

function thickLine(x1, y1, x2, y2, width) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.sin(angle) * width / 2;
    const dy = Math.cos(angle) * width / 2;
    return [
        [x1 - dx, y1 + dy],
        [x2 - dx, y2 + dy],
        [x2 + dx, y2 - dy],
        [x1 + dx, y1 - dy],
        [x1 - dx, y1 + dy]
    ];
}

function easeOutCubic(t) {
    const k = clamp(t, 0, 1);
    return 1 - Math.pow(1 - k, 3);
}

class Worldseed extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'WORLDSEED',
            author: "Joseph Garcia",
            description: 'Secretly choose a power. Reveal together. Live with the world you made.',
            aspectRatio: { x: 4, y: 3 },
            tickRate: 12,
            maxPlayers: 6,
            gameId: "5aac1fbd-6ac7-5310-a959-45b775a82163"
        };
    }

    constructor(options = {}) {
        super();
        this.addAsset = typeof options.addAsset === 'function' ? options.addAsset : null;
        this.phase = 'lobby';
        this.players = {};
        this.playerOrder = [];
        this.roundHumanIds = [];
        this.bots = [];
        this.choices = {};
        this.revealActors = [];
        this.revealElapsed = 0;
        this.revealApplied = false;
        this.age = 0;
        this.history = [];
        this.stats = { nature: 3, people: 3, wonder: 1, balance: 6 };

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [7, 10, 22, 255]
        });

        this.worldLayer = this.makeContainer();
        this.hudLayer = this.makeContainer();
        this.privateLayer = this.makeContainer();
        this.modalLayer = this.makeContainer();

        this.buildBackground();
        this.buildWorld();
        this.buildHud();
        this.buildRoster();
        this.buildModal();
        this.buildEffects();

        this.base.addChildren(
            this.worldLayer,
            this.hudLayer,
            this.privateLayer,
            this.modalLayer
        );

        this.renderWorld();
        this.renderLobby();
    }

    getLayers() {
        return [{ root: this.base }];
    }

    makeContainer(playerIds) {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            ...(playerIds ? { playerIds } : {})
        });
    }

    makeText(text, x, y, size, align = 'center', color = WHITE, playerIds) {
        return new GameNode.Text({
            textInfo: { text, x, y, size, align, color: copyColor(color), font: 'monospace' },
            ...(playerIds ? { playerIds } : {})
        });
    }

    makeButton({ x, y, w, h, label, fill, onClick, playerIds }) {
        const button = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill: copyColor(fill),
            color: copyColor(WHITE),
            border: 3,
            onClick,
            ...(playerIds ? { playerIds } : {})
        });
        const labelNode = this.makeText(label, x + w / 2, y + h / 2 - 1.25, 1.85, 'center', WHITE);
        button.addChild(labelNode);
        button._label = labelNode;
        button._layout = { x, y, w, h };
        button._defaultLabel = label;
        button._fill = copyColor(fill);
        return button;
    }

    hideButton(button) {
        button.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        button.node.playerIds = [0];
        setText(button._label, '');
    }

    showButton(button, label, playerIds) {
        const p = button._layout;
        button.node.coordinates2d = ShapeUtils.rectangle(p.x, p.y, p.w, p.h);
        button.node.fill = copyColor(button._fill);
        button.node.color = copyColor(WHITE);
        button.node.playerIds = Array.isArray(playerIds) ? playerIds.slice() : [];
        setText(button._label, label || button._defaultLabel);
    }

    buildBackground() {
        this.stars = [];
        const positions = [
            [5, 12], [12, 27], [19, 8], [24, 20], [78, 13], [87, 25], [95, 8],
            [7, 60], [16, 75], [23, 52], [79, 67], [90, 55], [96, 76], [84, 38]
        ];
        for (let i = 0; i < TUNING.STAR_COUNT; i++) {
            const p = positions[i];
            const size = i % 3 === 0 ? 0.8 : 0.45;
            const star = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: diamond(p[0], p[1], size, size * 1.3),
                fill: i % 4 === 0 ? [160, 205, 255, 255] : [238, 240, 255, 255],
                color: [255, 255, 255, 180]
            });
            this.worldLayer.addChild(star);
            this.stars.push(star);
        }
    }

    buildWorld() {
        this.atmosphere = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ellipse(50, 45, 22.2, 29.6, 32),
            fill: TRANSPARENT,
            color: [91, 201, 255, 255],
            border: 5,
            effects: { shadow: { color: [70, 170, 255, 255], blur: 16 } }
        });
        this.planet = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ellipse(50, 45, 21, 28, 32),
            fill: [30, 96, 151, 255]
        });

        this.land = [
            new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: [[36, 28], [43, 23], [50, 28], [48, 38], [42, 44], [35, 39], [36, 28]],
                fill: [85, 135, 74, 255]
            }),
            new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: [[48, 44], [56, 38], [65, 44], [64, 55], [58, 66], [48, 61], [44, 53], [48, 44]],
                fill: [93, 145, 78, 255]
            }),
            new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: [[56, 27], [63, 30], [65, 36], [59, 39], [54, 34], [56, 27]],
                fill: [105, 154, 82, 255]
            })
        ];

        this.worldLayer.addChildren(this.atmosphere, this.planet, ...this.land);

        this.rivers = [];
        const riverPaths = [
            [41, 27, 43, 42],
            [56, 41, 60, 61],
            [58, 29, 61, 36]
        ];
        for (let i = 0; i < TUNING.RIVER_POOL; i++) {
            const r = riverPaths[i];
            const river = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: thickLine(r[0], r[1], r[2], r[3], 0.8),
                fill: [115, 211, 255, 255],
                color: [255, 255, 255, 180]
            });
            this.worldLayer.addChild(river);
            this.rivers.push(river);
        }

        this.trees = [];
        const treePositions = [
            [39, 31], [43, 29], [46, 34], [39, 38], [44, 40], [58, 48], [61, 52],
            [55, 54], [58, 59], [52, 57], [59, 33], [61, 35], [54, 47], [47, 53]
        ];
        for (let i = 0; i < TUNING.TREE_POOL; i++) {
            const p = treePositions[i];
            const tree = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: diamond(p[0], p[1], 2.1, 3.8),
                fill: i % 2 ? [51, 166, 87, 255] : [72, 196, 105, 255],
                color: [235, 255, 220, 220]
            });
            this.worldLayer.addChild(tree);
            this.trees.push({ node: tree, x: p[0], y: p[1], index: i });
        }

        this.houses = [];
        const housePositions = [
            [42, 35], [47, 31], [54, 49], [59, 55], [52, 58], [58, 34], [45, 54], [61, 47]
        ];
        for (let i = 0; i < TUNING.HOUSE_POOL; i++) {
            const p = housePositions[i];
            const houseRoot = this.makeContainer();
            const body = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(p[0] - 1.1, p[1], 2.2, 2.5),
                fill: i % 2 ? [233, 194, 117, 255] : [238, 142, 93, 255],
                color: [72, 48, 55, 255],
                border: 2
            });
            const roof = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.triangle(p[0] - 1.45, p[1], p[0], p[1] - 1.9, p[0] + 1.45, p[1]),
                fill: [114, 69, 83, 255]
            });
            houseRoot.addChildren(body, roof);
            this.worldLayer.addChild(houseRoot);
            this.houses.push({ root: houseRoot, body, roof, x: p[0], y: p[1], index: i });
        }

        this.wonders = [];
        const wonderPositions = [[33, 45], [67, 43], [38, 62], [64, 64], [48, 17], [54, 72]];
        for (let i = 0; i < TUNING.WONDER_POOL; i++) {
            const p = wonderPositions[i];
            const wonder = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: diamond(p[0], p[1], 2.4, 4.2),
                fill: i % 2 ? [245, 222, 104, 255] : [205, 121, 255, 255],
                color: [255, 255, 255, 255],
                border: 2,
                effects: i < 2 ? { shadow: { color: [208, 118, 255, 255], blur: 10 } } : null
            });
            this.worldLayer.addChild(wonder);
            this.wonders.push({ node: wonder, x: p[0], y: p[1], index: i });
        }

        this.cracks = [];
        const crackPaths = [
            [44, 47, 40, 53], [56, 51, 61, 58], [48, 35, 45, 29], [59, 42, 64, 39]
        ];
        for (let i = 0; i < TUNING.CRACK_POOL; i++) {
            const c = crackPaths[i];
            const crack = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: thickLine(c[0], c[1], c[2], c[3], 0.45),
                fill: [255, 89, 78, 255],
                color: [255, 255, 255, 180]
            });
            this.worldLayer.addChild(crack);
            this.cracks.push(crack);
        }
    }

    buildHud() {
        this.ageText = this.makeText('', 13, 14, 2.6, 'center', WHITE);
        this.worldNameText = this.makeText('UNNAMED WORLD', 13, 19, 1.35, 'center', MUTED);
        this.historyTitle = this.makeText('', 13, 28, 1.25, 'center', MUTED);
        this.historyTexts = [
            this.makeText('', 3, 34, 0.85, 'left', WHITE),
            this.makeText('', 3, 39, 0.85, 'left', WHITE),
            this.makeText('', 3, 44, 0.85, 'left', WHITE)
        ];

        this.eventTitle = this.makeText('', 50, 12.2, 2.05, 'center', WHITE);
        this.eventSubtitle = this.makeText('', 50, 16.1, 1.05, 'center', MUTED);

        this.statsTitle = this.makeText('', 87, 25, 1.35, 'center', MUTED);
        this.statRows = {};
        const rows = [
            ['nature', 'NATURE', [63, 191, 111, 255]],
            ['people', 'PEOPLE', [242, 155, 63, 255]],
            ['wonder', 'WONDER', [192, 106, 245, 255]],
            ['balance', 'BALANCE', [65, 170, 239, 255]]
        ];
        rows.forEach((row, index) => {
            const y = 31 + index * 9.5;
            const label = this.makeText('', 77, y, 1.05, 'left', WHITE);
            const bg = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(77, y + 3, 20, 2.6),
                fill: [36, 44, 66, 255],
                color: OUTLINE,
                border: 2
            });
            const fill = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(77, y + 3, 0, 2.6),
                fill: copyColor(row[2])
            });
            this.statRows[row[0]] = { label, bg, fill, color: row[2], y };
            this.hudLayer.addChildren(label, bg, fill);
        });

        this.hudLayer.addChildren(
            this.ageText,
            this.worldNameText,
            this.historyTitle,
            ...this.historyTexts,
            this.eventTitle,
            this.eventSubtitle,
            this.statsTitle
        );
    }

    buildRoster() {
        this.rosterSlots = [];
        for (let i = 0; i < TUNING.MAX_PLAYERS; i++) {
            const x = 2 + i * 16.2;
            const panel = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, 2, 15.2, 6.4),
                fill: PANEL_2,
                color: OUTLINE,
                border: 2
            });
            const text = this.makeText('', x + 7.6, 3.8, 0.82, 'center', WHITE);
            panel.addChild(text);
            this.rosterSlots.push({ panel, text, x, index: i });
            this.hudLayer.addChild(panel);
        }
    }

    buildModal() {
        this.modalPanel = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(14, 14, 72, 70),
            fill: PANEL,
            color: [93, 116, 171, 255],
            border: 5,
            effects: { shadow: { color: [60, 94, 175, 255], blur: 18 } }
        });
        this.modalTitle = this.makeText('CHOOSE POWERS TOGETHER', 50, 24, 2.5, 'center', WHITE);
        this.modalLine1 = this.makeText('SECRETLY CHOOSE A POWER.', 50, 35, 1.65, 'center', WHITE);
        this.modalLine2 = this.makeText('COMBINE THEM TO CHANGE YOUR WORLD.', 50, 40, 1.25, 'center', MUTED);
        this.modalLine3 = this.makeText('EVERY SPIRIT HAS A PRIVATE WISH.', 50, 45, 1.25, 'center', MUTED);
        this.modalLine4 = this.makeText('', 50, 53, 1.25, 'center', WHITE);
        this.primaryButton = this.makeButton({
            x: 34, y: 61, w: 32, h: 10,
            label: 'MAKE A WORLD',
            fill: [55, 130, 238, 255],
            onClick: (playerId) => this.handlePrimary(playerId)
        });
        this.modalHint = this.makeText('TAP TO BEGIN', 50, 75, 1.0, 'center', MUTED);

        this.resultRows = [];
        for (let i = 0; i < TUNING.MAX_PLAYERS; i++) {
            const row = this.makeText('', 50, 47 + i * 4.2, 1.1, 'center', WHITE);
            this.resultRows.push(row);
        }

        this.modalLayer.addChildren(
            this.modalPanel,
            this.modalTitle,
            this.modalLine1,
            this.modalLine2,
            this.modalLine3,
            this.modalLine4,
            ...this.resultRows,
            this.primaryButton,
            this.modalHint
        );
    }

    buildEffects() {
        this.revealSlots = [];
        for (let i = 0; i < TUNING.REVEAL_POOL; i++) {
            const token = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                fill: TRANSPARENT,
                color: [255, 255, 255, 255],
                border: 2
            });
            this.worldLayer.addChild(token);
            this.revealSlots.push({ node: token, active: false, startX: 0, startY: 0, endX: 0, endY: 0, power: null });
        }

        this.pulses = [];
        for (let i = 0; i < TUNING.PULSE_POOL; i++) {
            const pulse = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                fill: TRANSPARENT,
                color: [255, 255, 255, 0],
                border: 4
            });
            this.worldLayer.addChild(pulse);
            this.pulses.push({ node: pulse, active: false, delay: i * 0.16, color: WHITE });
        }
    }

    handleNewPlayer({ playerId, info }) {
        if (this.players[playerId]) return;
        const id = Number(playerId);
        const name = String((info && info.name) || `PLAYER ${id}`).slice(0, 9).toUpperCase();
        const uiRoot = this.makeContainer([id]);
        const youMarker = this.makeText('', 50, 9, 0.9, 'center', [122, 211, 255, 255]);
        const prophecyText = this.makeText('', 50, 72.2, 1.1, 'center', WHITE);
        const statusText = this.makeText('', 50, 76.1, 1.0, 'center', MUTED);
        uiRoot.addChildren(youMarker, prophecyText, statusText);

        const buttons = {};
        POWER_ORDER.forEach((key, index) => {
            const power = POWERS[key];
            const button = this.makeButton({
                x: 2 + index * 24.5,
                y: 81,
                w: 22.5,
                h: 13,
                label: power.label,
                fill: power.dark,
                onClick: (clickerId) => this.choosePower(clickerId, id, key)
            });
            setText(button._label, power.label, { y: 84, size: 1.65 });
            button.addChild(this.makeText(power.hint, 13.25 + index * 24.5, 90, 1.05, 'center', WHITE));
            uiRoot.addChild(button);
            buttons[key] = button;
        });

        const player = {
            id,
            name,
            uiRoot,
            youMarker,
            prophecyText,
            statusText,
            buttons,
            prophecy: null,
            choice: null,
            participating: false,
            keys: {}
        };
        this.players[id] = player;
        this.playerOrder.push(id);
        this.privateLayer.addChild(uiRoot);

        if (this.phase === 'lobby') {
            this.renderLobby();
        } else {
            this.hidePlayerChoiceUi(player);
            setText(player.statusText, 'WORLD IN PROGRESS - YOU JOIN THE NEXT ONE');
            this.renderRoster();
            this.base.node.onStateChange();
        }
    }

    handlePlayerDisconnect(playerId) {
        const id = Number(playerId);
        const player = this.players[id];
        if (!player) return;
        this.privateLayer.removeChild(player.uiRoot.id);
        delete this.players[id];
        delete this.choices[id];
        this.playerOrder = this.playerOrder.filter(pid => pid !== id);
        this.roundHumanIds = this.roundHumanIds.filter(pid => pid !== id);

        if (this.phase === 'lobby') {
            this.renderLobby();
            return;
        }

        if (this.roundHumanIds.length === 0) {
            this.resetToLobby();
            return;
        }

        if (this.phase === 'choosing') {
            this.ensureBots();
            this.renderRoster();
            if (this.roundHumanIds.length === 0) {
                this.resetToLobby();
                return;
            }
            if (this.allHumansReady()) this.beginReveal();
            else this.updateWaitingTexts();
            this.base.node.onStateChange();
            return;
        }

        this.renderRoster();
        this.base.node.onStateChange();
    }

    normalizeKey(key) {
        return typeof key === 'string' && key.length === 1 ? key.toLowerCase() : key;
    }

    handleKeyDown(playerId, rawKey) {
        const player = this.players[Number(playerId)];
        if (!player) return;
        const key = this.normalizeKey(rawKey);
        const wasDown = !!player.keys[key];
        player.keys[key] = true;
        if (wasDown) return;

        if (key === 'Enter') {
            this.handlePrimary(player.id);
            return;
        }
        const keyMap = {
            '1': 'root', r: 'root',
            '2': 'rise', b: 'rise',
            '3': 'tide', t: 'tide',
            '4': 'spark', s: 'spark'
        };
        if (keyMap[key]) this.choosePower(player.id, player.id, keyMap[key]);
    }

    handleKeyUp(playerId, rawKey) {
        const player = this.players[Number(playerId)];
        if (!player) return;
        player.keys[this.normalizeKey(rawKey)] = false;
    }

    handlePrimary(playerId) {
        if (!this.players[Number(playerId)]) return;
        if (this.phase === 'lobby') this.startGame();
        else if (this.phase === 'gameover') this.startGame();
    }

    clearAllKeys() {
        Object.values(this.players).forEach(player => { player.keys = {}; });
    }

    startGame() {
        if (this.phase !== 'lobby' && this.phase !== 'gameover') return;
        const humanIds = this.playerOrder.filter(id => this.players[id]).slice(0, TUNING.MAX_PLAYERS);
        if (humanIds.length === 0) return;

        this.clearAllKeys();
        this.phase = 'choosing';
        this.age = 1;
        this.history = [];
        this.stats = { nature: 3, people: 3, wonder: 1, balance: 6 };
        this.roundHumanIds = humanIds;
        this.bots = [];
        this.choices = {};
        this.revealActors = [];
        this.revealElapsed = 0;
        this.revealApplied = false;

        const prophecies = this.shuffledProphecies();
        this.playerOrder.forEach(id => {
            const player = this.players[id];
            player.choice = null;
            player.participating = this.roundHumanIds.includes(id);
            player.prophecy = player.participating ? prophecies.shift() || PROPHECIES[0] : null;
        });
        this.ensureBots();
        this.hideModal();
        this.hideEffects();
        this.renderWorld();
        this.beginChoosing();
    }

    shuffledProphecies() {
        const list = PROPHECIES.slice();
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = list[i];
            list[i] = list[j];
            list[j] = tmp;
        }
        return list;
    }

    ensureBots() {
        const target = Math.max(0, Math.min(TUNING.REVEAL_POOL - this.roundHumanIds.length, TUNING.MIN_ACTORS - this.roundHumanIds.length));
        while (this.bots.length < target) {
            const template = BOT_TEMPLATES[this.bots.length % BOT_TEMPLATES.length];
            this.bots.push({ ...template, choice: null });
        }
        if (this.bots.length > target) this.bots.length = target;
    }

    beginChoosing() {
        if (this.age > TUNING.AGES) {
            this.finishGame();
            return;
        }
        this.phase = 'choosing';
        this.clearAllKeys();
        this.ensureBots();
        this.choices = {};
        this.revealActors = [];
        this.revealElapsed = 0;
        this.revealApplied = false;
        this.bots.forEach(bot => { bot.choice = null; });
        this.hideEffects();
        setText(this.eventTitle, 'CHOOSE IN SECRET');
        setText(this.eventSubtitle, 'Your power locks the moment every spirit is ready.');
        this.roundHumanIds.forEach(id => {
            const player = this.players[id];
            if (!player) return;
            player.choice = null;
            this.showPlayerChoiceUi(player);
        });
        this.playerOrder.forEach(id => {
            const player = this.players[id];
            if (player && !player.participating) {
                this.hidePlayerChoiceUi(player);
                setText(player.statusText, 'WORLD IN PROGRESS - YOU JOIN THE NEXT ONE');
            }
        });
        this.renderHud();
        this.renderRoster();
        this.base.node.onStateChange();
    }

    showPlayerChoiceUi(player) {
        setText(player.prophecyText, `YOUR WISH - ${player.prophecy.title}: ${player.prophecy.prompt}`);
        setText(player.statusText, '');
        POWER_ORDER.forEach(key => this.showButton(player.buttons[key], POWERS[key].label, [player.id]));
    }

    hidePlayerChoiceUi(player) {
        POWER_ORDER.forEach(key => this.hideButton(player.buttons[key]));
        if (this.phase !== 'gameover') setText(player.prophecyText, '');
    }

    choosePower(clickerId, ownerId, key) {
        const clicker = Number(clickerId);
        const owner = Number(ownerId);
        if (clicker !== owner) return;
        if (this.phase !== 'choosing') return;
        const player = this.players[owner];
        if (!player || !player.participating || player.choice || !POWERS[key]) return;

        player.choice = key;
        this.choices[owner] = key;
        POWER_ORDER.forEach(powerKey => this.hideButton(player.buttons[powerKey]));
        setText(player.statusText, `LOCKED: ${POWERS[key].label}`);
        this.renderRoster();

        if (this.allHumansReady()) this.beginReveal();
        else {
            this.updateWaitingTexts();
            this.base.node.onStateChange();
        }
    }

    allHumansReady() {
        return this.roundHumanIds.length > 0 && this.roundHumanIds.every(id => !!this.choices[id]);
    }

    updateWaitingTexts() {
        const remaining = this.roundHumanIds.filter(id => !this.choices[id]).length;
        this.roundHumanIds.forEach(id => {
            const player = this.players[id];
            if (!player || !player.choice) return;
            setText(player.statusText, remaining > 0 ? `LOCKED - WAITING FOR ${remaining}` : 'LOCKED');
        });
    }

    chooseBotPower(bot) {
        const s = this.stats;
        if (s.balance <= 3 && Math.random() < 0.7) return 'tide';
        if (s.nature + 2 < s.people && Math.random() < 0.55) return 'root';
        if (s.people + 2 < s.nature && Math.random() < 0.55) return 'rise';
        if (s.wonder < 5 && bot.favorite === 'spark' && Math.random() < 0.65) return 'spark';
        if (Math.random() < 0.45) return bot.favorite;
        return POWER_ORDER[Math.floor(Math.random() * POWER_ORDER.length)];
    }

    beginReveal() {
        if (this.phase !== 'choosing') return;
        this.phase = 'reveal';
        this.clearAllKeys();
        this.roundHumanIds.forEach(id => {
            const player = this.players[id];
            if (player) this.hidePlayerChoiceUi(player);
        });
        this.bots.forEach(bot => { bot.choice = this.chooseBotPower(bot); });

        const humans = this.roundHumanIds
            .map(id => this.players[id])
            .filter(Boolean)
            .map(player => ({ id: player.id, name: player.name, isBot: false, choice: player.choice }));
        const bots = this.bots.map(bot => ({ id: bot.id, name: bot.name, isBot: true, choice: bot.choice }));
        this.revealActors = humans.concat(bots).slice(0, TUNING.REVEAL_POOL);
        this.revealElapsed = 0;
        this.revealApplied = false;
        setText(this.eventTitle, 'THE POWERS ARE MEETING...');
        setText(this.eventSubtitle, 'Nobody gets to take their choice back.');
        this.prepareRevealTokens();
        this.preparePulses([255, 255, 255, 255]);
        this.renderRoster();
        this.base.node.onStateChange();
    }

    prepareRevealTokens() {
        this.revealSlots.forEach((slot, index) => {
            const actor = this.revealActors[index];
            if (!actor) {
                slot.active = false;
                slot.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                slot.node.node.fill = TRANSPARENT;
                return;
            }
            const roster = this.rosterSlots[index];
            const angle = (index / Math.max(1, this.revealActors.length)) * Math.PI * 2 - Math.PI / 2;
            slot.active = true;
            slot.power = actor.choice;
            slot.startX = roster.x + 7.6;
            slot.startY = 7.5;
            slot.endX = 50 + Math.cos(angle) * 13;
            slot.endY = 45 + Math.sin(angle) * 17;
            slot.node.node.fill = copyColor(POWERS[actor.choice].color);
            slot.node.node.color = copyColor(WHITE);
            slot.node.node.coordinates2d = diamond(slot.startX, slot.startY, 3.2, 4.2);
        });
    }

    preparePulses(color) {
        this.pulses.forEach((pulse, index) => {
            pulse.active = true;
            pulse.delay = index * 0.16;
            pulse.color = copyColor(color);
            pulse.node.node.coordinates2d = ellipse(50, 45, 21, 28, 28);
            pulse.node.node.color = [color[0], color[1], color[2], 0];
        });
    }

    hideEffects() {
        this.revealSlots.forEach(slot => {
            slot.active = false;
            slot.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            slot.node.node.fill = TRANSPARENT;
        });
        this.pulses.forEach(pulse => {
            pulse.active = false;
            pulse.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            pulse.node.node.color = [255, 255, 255, 0];
        });
    }

    resolveRound() {
        const counts = { root: 0, rise: 0, tide: 0, spark: 0 };
        this.revealActors.forEach(actor => {
            if (counts[actor.choice] !== undefined) counts[actor.choice] += 1;
        });

        const delta = {
            nature: counts.root,
            people: counts.rise,
            wonder: counts.spark,
            balance: counts.tide - 1 - Math.floor(counts.spark / 2)
        };

        let event = {
            title: 'A QUIET AGE PASSED',
            subtitle: 'The world changed, but did not reveal its plan.',
            color: [180, 190, 210, 255]
        };

        const allFour = POWER_ORDER.every(key => counts[key] > 0);
        const maxKey = POWER_ORDER.reduce((best, key) => counts[key] > counts[best] ? key : best, 'root');
        const maxCount = counts[maxKey];

        if (allFour) {
            delta.nature += 1;
            delta.people += 1;
            delta.wonder += 1;
            delta.balance += 2;
            event = {
                title: 'THE FOUR POWERS AGREED',
                subtitle: 'For one impossible age, nothing had to lose.',
                color: [244, 225, 122, 255]
            };
        } else if (maxCount >= 3) {
            if (maxKey === 'root') {
                delta.nature += 2;
                delta.people -= 1;
                event = { title: 'THE GREEN TOOK EVERYTHING', subtitle: 'Roots split roads and forests swallowed towers.', color: POWERS.root.color };
            } else if (maxKey === 'rise') {
                delta.people += 2;
                delta.nature -= 2;
                event = { title: 'THE CITY ATE THE HORIZON', subtitle: 'Every hill became a foundation.', color: POWERS.rise.color };
            } else if (maxKey === 'tide') {
                delta.balance += 2;
                delta.wonder -= 1;
                event = { title: 'THE GREAT QUIET', subtitle: 'The waters carried every sharp edge away.', color: POWERS.tide.color };
            } else {
                delta.wonder += 3;
                delta.balance -= 2;
                event = { title: 'A MIRACLE ESCAPED', subtitle: 'The sky opened and refused to close.', color: POWERS.spark.color };
            }
        } else {
            const pairs = [
                ['root', 'tide', counts.root * counts.tide, () => { delta.nature += 1; delta.balance += 1; }, 'THE RAINS FOUND ROOTS', 'Every drop became something alive.', [77, 215, 164, 255]],
                ['rise', 'tide', counts.rise * counts.tide, () => { delta.people += 1; delta.balance += 1; }, 'RIVERS CARRIED STONE', 'A city learned to bend instead of break.', [92, 192, 238, 255]],
                ['root', 'rise', counts.root * counts.rise, () => { delta.nature += 1; delta.people += 1; }, 'A VILLAGE TOOK ROOT', 'Doors opened beneath a living canopy.', [213, 180, 83, 255]],
                ['root', 'spark', counts.root * counts.spark, () => { delta.nature += 1; delta.wonder += 2; delta.balance -= 1; }, 'THE FOREST LEARNED TO DREAM', 'Strange animals watched from impossible trees.', [128, 219, 125, 255]],
                ['rise', 'spark', counts.rise * counts.spark, () => { delta.people += 1; delta.wonder += 2; delta.nature -= 1; }, 'THE MACHINES WOKE UP', 'The first engine asked who had built whom.', [224, 121, 211, 255]],
                ['tide', 'spark', counts.tide * counts.spark, () => { delta.wonder += 2; delta.balance += 1; }, 'THE SEA REMEMBERED THE MOON', 'Silver tides climbed into the night.', [133, 154, 255, 255]]
            ];
            pairs.sort((a, b) => b[2] - a[2]);
            const pair = pairs[0];
            if (pair[2] > 0) {
                pair[3]();
                event = { title: pair[4], subtitle: pair[5], color: pair[6] };
            } else if (maxKey === 'root') {
                delta.nature += 1;
                event = { title: 'THE FIRST SEED OPENED', subtitle: 'Life arrived without asking permission.', color: POWERS.root.color };
            } else if (maxKey === 'rise') {
                delta.people += 1;
                event = { title: 'THE FIRST WALL STOOD', subtitle: 'Someone decided tomorrow should have a shape.', color: POWERS.rise.color };
            } else if (maxKey === 'tide') {
                delta.balance += 1;
                event = { title: 'THE WATER FOUND A WAY', subtitle: 'The world exhaled.', color: POWERS.tide.color };
            } else {
                delta.wonder += 2;
                delta.balance -= 1;
                event = { title: 'THE FIRST STAR FELL', subtitle: 'It landed gently. That was the strange part.', color: POWERS.spark.color };
            }
        }

        this.stats = {
            nature: clamp(this.stats.nature + delta.nature, 0, TUNING.MAX_STAT),
            people: clamp(this.stats.people + delta.people, 0, TUNING.MAX_STAT),
            wonder: clamp(this.stats.wonder + delta.wonder, 0, TUNING.MAX_STAT),
            balance: clamp(this.stats.balance + delta.balance, 0, TUNING.MAX_STAT)
        };
        this.history.push(event);
        if (this.history.length > TUNING.AGES) this.history.shift();
        return event;
    }

    tick() {
        if (this.phase !== 'reveal') return;
        this.revealElapsed += DT;
        let changed = false;

        const travel = easeOutCubic(this.revealElapsed / TUNING.IMPACT_AT_SECONDS);
        this.revealSlots.forEach(slot => {
            if (!slot.active) return;
            const x = slot.startX + (slot.endX - slot.startX) * travel;
            const y = slot.startY + (slot.endY - slot.startY) * travel;
            const size = 3.2 + Math.sin(clamp(travel, 0, 1) * Math.PI) * 1.4;
            slot.node.node.coordinates2d = diamond(x, y, size, size * 1.3);
            changed = true;
        });

        this.pulses.forEach((pulse, index) => {
            if (!pulse.active) return;
            const local = (this.revealElapsed - TUNING.IMPACT_AT_SECONDS - pulse.delay) / 0.9;
            if (local < 0 || local > 1) {
                if (local > 1) {
                    pulse.active = false;
                    pulse.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                    pulse.node.node.color = [pulse.color[0], pulse.color[1], pulse.color[2], 0];
                    changed = true;
                }
                return;
            }
            const rx = 21 + local * (5 + index * 1.2);
            const ry = 28 + local * (6.6 + index * 1.5);
            pulse.node.node.coordinates2d = ellipse(50, 45, rx, ry, 28);
            pulse.node.node.color = [pulse.color[0], pulse.color[1], pulse.color[2], clampByte(220 * (1 - local))];
            changed = true;
        });

        if (!this.revealApplied && this.revealElapsed >= TUNING.IMPACT_AT_SECONDS) {
            this.revealApplied = true;
            const event = this.resolveRound();
            setText(this.eventTitle, event.title);
            setText(this.eventSubtitle, event.subtitle);
            this.preparePulses(event.color);
            this.renderWorld();
            this.renderHud();
            this.renderRoster();
            changed = true;
        }

        if (this.revealElapsed >= TUNING.REVEAL_SECONDS) {
            this.hideEffects();
            if (this.age >= TUNING.AGES || this.stats.balance <= 0) {
                this.finishGame();
            } else {
                this.age += 1;
                this.beginChoosing();
            }
            return;
        }

        if (changed) this.base.node.onStateChange();
    }

    renderWorld() {
        const s = this.stats;
        const natureRatio = s.nature / TUNING.MAX_STAT;
        const peopleRatio = s.people / TUNING.MAX_STAT;
        const wonderRatio = s.wonder / TUNING.MAX_STAT;
        const balanceRatio = s.balance / TUNING.MAX_STAT;

        const landColor = [
            clampByte(111 - natureRatio * 52 + peopleRatio * 24),
            clampByte(105 + natureRatio * 92 - peopleRatio * 25),
            clampByte(70 + natureRatio * 38),
            255
        ];
        this.land.forEach((node, index) => {
            node.node.fill = [
                clampByte(landColor[0] + index * 6),
                clampByte(landColor[1] + index * 5),
                clampByte(landColor[2] + index * 2),
                255
            ];
        });

        this.planet.node.fill = [
            clampByte(25 + wonderRatio * 23),
            clampByte(86 + balanceRatio * 43),
            clampByte(132 + balanceRatio * 55),
            255
        ];

        const atmosphereColor = balanceRatio < 0.25
            ? [255, 91, 84, 255]
            : wonderRatio > 0.65
                ? [211, 126, 255, 255]
                : [91, 201, 255, 255];
        this.atmosphere.node.color = atmosphereColor;
        this.atmosphere.node.effects = {
            shadow: { color: copyColor(atmosphereColor), blur: 10 + Math.round(wonderRatio * 12) }
        };

        const treeCount = Math.round(natureRatio * TUNING.TREE_POOL);
        this.trees.forEach((tree, index) => {
            if (index < treeCount) {
                const scale = 0.85 + natureRatio * 0.45;
                tree.node.node.coordinates2d = diamond(tree.x, tree.y, 2.1 * scale, 3.8 * scale);
                tree.node.node.fill = index % 2 ? [51, 166, 87, 255] : [72, 196, 105, 255];
                tree.node.node.color = [235, 255, 220, 220];
            } else {
                tree.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                tree.node.node.fill = TRANSPARENT;
            }
        });

        const houseCount = Math.round(peopleRatio * TUNING.HOUSE_POOL);
        this.houses.forEach((house, index) => {
            if (index < houseCount) {
                const height = 2.2 + peopleRatio * 2.0 + (index % 3) * 0.3;
                house.body.node.coordinates2d = ShapeUtils.rectangle(house.x - 1.1, house.y - (height - 2.5), 2.2, height);
                house.body.node.fill = index % 2 ? [233, 194, 117, 255] : [238, 142, 93, 255];
                house.body.node.color = [72, 48, 55, 255];
                house.roof.node.coordinates2d = ShapeUtils.triangle(
                    house.x - 1.45, house.y - (height - 2.5),
                    house.x, house.y - (height - 2.5) - 1.9,
                    house.x + 1.45, house.y - (height - 2.5)
                );
                house.roof.node.fill = [114, 69, 83, 255];
            } else {
                house.body.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                house.body.node.fill = TRANSPARENT;
                house.roof.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                house.roof.node.fill = TRANSPARENT;
            }
        });

        const wonderCount = Math.round(wonderRatio * TUNING.WONDER_POOL);
        this.wonders.forEach((wonder, index) => {
            if (index < wonderCount) {
                const pulse = 1 + wonderRatio * 0.45;
                wonder.node.node.coordinates2d = diamond(wonder.x, wonder.y, 2.4 * pulse, 4.2 * pulse);
                wonder.node.node.fill = index % 2 ? [245, 222, 104, 255] : [205, 121, 255, 255];
                wonder.node.node.color = [255, 255, 255, 255];
                wonder.node.node.effects = index < 2 ? { shadow: { color: [208, 118, 255, 255], blur: 10 + Math.round(wonderRatio * 7) } } : null;
            } else {
                wonder.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                wonder.node.node.fill = TRANSPARENT;
                wonder.node.node.effects = null;
            }
        });

        const riverCount = Math.round(balanceRatio * TUNING.RIVER_POOL);
        this.rivers.forEach((river, index) => {
            if (index < riverCount) {
                const paths = [[41, 27, 43, 42], [56, 41, 60, 61], [58, 29, 61, 36]];
                const p = paths[index];
                river.node.coordinates2d = thickLine(p[0], p[1], p[2], p[3], 0.8);
                river.node.fill = [115, 211, 255, 255];
                river.node.color = [255, 255, 255, 180];
            } else {
                river.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                river.node.fill = TRANSPARENT;
            }
        });

        const crackCount = s.balance <= 4 ? Math.min(TUNING.CRACK_POOL, 5 - s.balance) : 0;
        this.cracks.forEach((crack, index) => {
            if (index < crackCount) {
                const paths = [[44, 47, 40, 53], [56, 51, 61, 58], [48, 35, 45, 29], [59, 42, 64, 39]];
                const p = paths[index];
                crack.node.coordinates2d = thickLine(p[0], p[1], p[2], p[3], 0.45);
                crack.node.fill = [255, 89, 78, 255];
                crack.node.color = [255, 255, 255, 180];
            } else {
                crack.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                crack.node.fill = TRANSPARENT;
            }
        });
    }

    renderHud() {
        if (this.phase === 'lobby') {
            setText(this.ageText, '');
            setText(this.worldNameText, 'UNNAMED WORLD');
            setText(this.historyTitle, '');
            this.historyTexts.forEach(node => setText(node, ''));
            setText(this.statsTitle, '');
            Object.values(this.statRows).forEach(row => {
                setText(row.label, '');
                row.bg.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                row.fill.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            });
            return;
        }

        setText(this.ageText, this.phase === 'gameover' ? 'WORLD COMPLETE' : `AGE ${this.age} / ${TUNING.AGES}`);
        setText(this.worldNameText, this.phase === 'gameover' ? this.makeWorldName() : 'UNNAMED WORLD');
        setText(this.historyTitle, 'RECENT AGES');
        const recent = this.history.slice(-3);
        this.historyTexts.forEach((node, index) => {
            const event = recent[index];
            setText(node, event ? `${this.history.length - recent.length + index + 1}. ${event.title}` : '');
        });
        setText(this.statsTitle, 'THE WORLD');
        Object.keys(this.statRows).forEach(key => {
            const row = this.statRows[key];
            const value = this.stats[key];
            setText(row.label, `${key.toUpperCase()}  ${value}`);
            row.bg.node.coordinates2d = ShapeUtils.rectangle(77, row.y + 3, 20, 2.6);
            row.fill.node.coordinates2d = ShapeUtils.rectangle(77, row.y + 3, (value / TUNING.MAX_STAT) * 20, 2.6);
            row.fill.node.fill = copyColor(row.color);
        });
    }

    renderRoster() {
        let actors;
        if (this.phase === 'lobby' || this.phase === 'gameover') {
            actors = this.playerOrder.map(id => {
                const p = this.players[id];
                return p ? { id: p.id, name: p.name, isBot: false, choice: p.choice } : null;
            }).filter(Boolean);
        } else {
            const humans = this.roundHumanIds.map(id => this.players[id]).filter(Boolean).map(p => ({ id: p.id, name: p.name, isBot: false, choice: p.choice }));
            const bots = this.bots.map(bot => ({ ...bot, isBot: true }));
            actors = humans.concat(bots);
        }

        this.rosterSlots.forEach((slot, index) => {
            const actor = actors[index];
            if (!actor) {
                slot.panel.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                slot.panel.node.fill = TRANSPARENT;
                setText(slot.text, '');
                return;
            }
            slot.panel.node.coordinates2d = ShapeUtils.rectangle(slot.x, 2, 15.2, 6.4);
            let suffix = '';
            if (this.phase === 'choosing') suffix = actor.choice ? ' - READY' : actor.isBot ? ' - DREAMING' : '';
            if (this.phase === 'reveal') suffix = actor.choice ? ` - ${POWERS[actor.choice].label}` : '';
            if (this.phase === 'gameover' && !actor.isBot) {
                const player = this.players[actor.id];
                suffix = player && player.prophecy && player.prophecy.test(this.stats) ? ' - WISH!' : '';
            }
            setText(slot.text, `${actor.name}${suffix}`);
            slot.panel.node.fill = this.phase === 'reveal' && actor.choice ? copyColor(POWERS[actor.choice].dark) : copyColor(PANEL_2);
            slot.panel.node.color = this.phase === 'reveal' && actor.choice ? copyColor(POWERS[actor.choice].color) : copyColor(OUTLINE);
        });

        this.playerOrder.forEach(id => {
            const p = this.players[id];
            if (!p) return;
            const actorIndex = actors.findIndex(actor => !actor.isBot && actor.id === id);
            if (actorIndex >= 0) {
                const slot = this.rosterSlots[actorIndex];
                setText(p.youMarker, 'YOU', { x: slot.x + 7.6, y: 9.1 });
            } else {
                setText(p.youMarker, '');
            }
        });
    }

    renderLobby() {
        this.phase = 'lobby';
        this.clearAllKeys();
        this.renderWorld();
        this.renderHud();
        this.renderRoster();
        this.playerOrder.forEach(id => {
            const player = this.players[id];
            if (!player) return;
            player.participating = false;
            player.choice = null;
            player.prophecy = null;
            this.hidePlayerChoiceUi(player);
            setText(player.statusText, '');
        });
        this.showModalLobby();
        this.base.node.onStateChange();
    }

    showModalLobby() {
        this.modalPanel.node.coordinates2d = ShapeUtils.rectangle(14, 14, 72, 70);
        this.modalPanel.node.fill = copyColor(PANEL);
        this.modalPanel.node.color = [93, 116, 171, 255];
        this.modalPanel.node.effects = { shadow: { color: [60, 94, 175, 255], blur: 18 } };
        setText(this.modalTitle, 'GROW A WORLD TOGETHER', { y: 26, size: 2.5 });
        setText(this.modalLine1, 'Choose your powers in secret.', { y: 41, size: 1.65 });
        setText(this.modalLine2, '', { y: 40, size: 1.25 });
        setText(this.modalLine3, '', { y: 45, size: 1.25 });
        const count = this.playerOrder.length;
        setText(this.modalLine4, count === 0 ? 'Waiting for a player' : '');
        this.resultRows.forEach(row => setText(row, ''));
        this.showButton(this.primaryButton, 'MAKE A WORLD', []);
        setText(this.modalHint, '');
    }

    hideModal() {
        this.modalPanel.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        this.modalPanel.node.fill = TRANSPARENT;
        this.modalPanel.node.effects = null;
        setText(this.modalTitle, '');
        setText(this.modalLine1, '');
        setText(this.modalLine2, '');
        setText(this.modalLine3, '');
        setText(this.modalLine4, '');
        this.resultRows.forEach(row => setText(row, ''));
        this.hideButton(this.primaryButton);
        setText(this.modalHint, '');
    }

    finishGame() {
        this.phase = 'gameover';
        this.clearAllKeys();
        this.hideEffects();
        this.playerOrder.forEach(id => {
            const player = this.players[id];
            if (!player) return;
            this.hidePlayerChoiceUi(player);
            if (player.prophecy) {
                const fulfilled = player.prophecy.test(this.stats);
                setText(player.prophecyText, `YOUR WISH - ${player.prophecy.title}: ${fulfilled ? 'FULFILLED' : 'UNMET'}`);
                setText(player.statusText, player.prophecy.prompt);
            } else {
                setText(player.prophecyText, 'YOU ARRIVED AFTER THIS WORLD BEGAN');
                setText(player.statusText, 'JOIN THE NEXT WORLD');
            }
        });

        const ending = this.classifyWorld();
        const worldName = this.makeWorldName();
        this.modalPanel.node.coordinates2d = ShapeUtils.rectangle(10, 10, 80, 78);
        this.modalPanel.node.fill = copyColor(PANEL);
        this.modalPanel.node.color = ending.color;
        this.modalPanel.node.effects = { shadow: { color: copyColor(ending.color), blur: 18 } };
        setText(this.modalTitle, `YOU MADE ${worldName}`, { y: 17, size: 3.1 });
        setText(this.modalLine1, ending.title, { y: 25, size: 2.2 });
        setText(this.modalLine2, ending.line1, { y: 30, size: 1.2 });
        setText(this.modalLine3, ending.line2, { y: 34, size: 1.1 });
        setText(this.modalLine4, 'THE WISHES', { y: 40, size: 1.15 });

        const humans = this.roundHumanIds.map(id => this.players[id]).filter(Boolean);
        this.resultRows.forEach((row, index) => {
            const player = humans[index];
            if (!player || !player.prophecy) {
                setText(row, '');
                return;
            }
            const fulfilled = player.prophecy.test(this.stats);
            setText(row, `${player.name} - ${player.prophecy.title} - ${fulfilled ? 'FULFILLED' : 'UNMET'}`, { y: 45 + index * 4.0 });
        });
        this.showButton(this.primaryButton, 'MAKE ANOTHER', []);
        this.primaryButton._layout = { x: 34, y: 73, w: 32, h: 9 };
        this.showButton(this.primaryButton, 'MAKE ANOTHER', []);
        setText(this.modalHint, 'SCREENSHOT YOUR WORLD. THEN TRY TO MAKE A STRANGER ONE.', { y: 84 });

        this.renderHud();
        this.renderRoster();
        this.base.node.onStateChange();
    }

    classifyWorld() {
        const s = this.stats;
        if (s.balance <= 0) {
            return {
                title: 'THE BEAUTIFUL RUIN',
                line1: 'It burned brightly enough to become a legend.',
                line2: 'Nobody could honestly call it stable.',
                color: [255, 92, 84, 255]
            };
        }
        if (Math.min(s.nature, s.people, s.wonder, s.balance) >= 8) {
            return {
                title: 'THE IMPOSSIBLE EDEN',
                line1: 'Nothing had to be sacrificed. Somehow.',
                line2: 'Future worlds will assume this one was a myth.',
                color: [246, 224, 116, 255]
            };
        }
        const spread = Math.max(s.nature, s.people, s.wonder) - Math.min(s.nature, s.people, s.wonder);
        if (spread <= 2 && s.balance >= 6) {
            return {
                title: 'THE LIVING ACCORD',
                line1: 'Every force learned the shape of every other.',
                line2: 'Disagreement became the world\'s weather.',
                color: [100, 218, 198, 255]
            };
        }
        if (s.nature >= 9 && s.people >= 8) {
            return {
                title: 'THE GARDEN CITY',
                line1: 'Towers rose without teaching the forests to leave.',
                line2: 'Every window looked out on something alive.',
                color: [118, 216, 126, 255]
            };
        }
        if (s.wonder >= s.nature && s.wonder >= s.people) {
            return {
                title: 'THE DREAMING WORLD',
                line1: 'Reality became a custom more than a rule.',
                line2: 'The moon still visits in daylight.',
                color: [207, 126, 255, 255]
            };
        }
        if (s.nature > s.people + 2) {
            return {
                title: 'THE ENDLESS GARDEN',
                line1: 'The roads disappeared. Nobody missed them for long.',
                line2: 'Even the ruins learned to flower.',
                color: [74, 199, 105, 255]
            };
        }
        if (s.people > s.nature + 2) {
            return {
                title: 'THE CLOCKWORK COMMONWEALTH',
                line1: 'Every problem acquired a bridge, a bell, or a lever.',
                line2: 'The last wild hill became a public park.',
                color: [242, 161, 76, 255]
            };
        }
        return {
            title: 'THE STRANGE HARBOR',
            line1: 'It never became perfect. It became unmistakably yours.',
            line2: 'That turned out to be more interesting.',
            color: [102, 177, 241, 255]
        };
    }

    makeWorldName() {
        const s = this.stats;
        const entries = [
            ['nature', s.nature],
            ['people', s.people],
            ['wonder', s.wonder],
            ['balance', s.balance]
        ].sort((a, b) => b[1] - a[1]);
        const prefixes = {
            nature: ['MOSS', 'THORN', 'VERDANT'],
            people: ['IRON', 'CROWN', 'TOWER'],
            wonder: ['STAR', 'DREAM', 'MOON'],
            balance: ['TIDE', 'CALM', 'HARMONY']
        };
        const suffixes = {
            nature: ['GARDEN', 'VALE', 'BLOOM'],
            people: ['CITY', 'HARBOR', 'SPIRE'],
            wonder: ['GLASS', 'SONG', 'LIGHT'],
            balance: ['HAVEN', 'SHORE', 'EDEN']
        };
        const seed = this.history.reduce((sum, event) => sum + event.title.length, this.age * 7);
        const first = prefixes[entries[0][0]][seed % 3];
        const second = suffixes[entries[1][0]][Math.floor(seed / 3) % 3];
        return `${first}${second}`;
    }

    resetToLobby() {
        this.roundHumanIds = [];
        this.bots = [];
        this.choices = {};
        this.revealActors = [];
        this.age = 0;
        this.history = [];
        this.stats = { nature: 3, people: 3, wonder: 1, balance: 6 };
        this.hideEffects();
        this.primaryButton._layout = { x: 34, y: 61, w: 32, h: 10 };
        this.renderLobby();
    }
}

module.exports = Worldseed;
