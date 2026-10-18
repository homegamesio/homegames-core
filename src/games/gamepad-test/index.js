const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const C = Colors.COLORS;

class GamepadTest extends Game {
    static metadata() {
        return {
            name: 'Gamepad Test', squishVersion: '150', aspectRatio: { x: 16, y: 9 },
            author: "Joseph Garcia", isTest: true,
            gamepadBindings: {
                ArrowLeft: ['DIRECTION_LEFT', 'STICK_1_LEFT'],
                ArrowRight: ['DIRECTION_RIGHT', 'STICK_1_RIGHT'],
                ArrowUp: ['DIRECTION_UP', 'STICK_1_UP'],
                ArrowDown: ['DIRECTION_DOWN', 'STICK_1_DOWN'],
                ' ': 'FACE_1',
            },
        };
    }

    constructor() {
        super();
        this.position = { x: 28, y: 56 };
        this.keys = {};
        this.colorIndex = 0;
        this.base = new GameNode.Shape({ shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100), fill: C.HG_BLACK });
        this.text(5, 8, 4, 'CONTROLLER TEST', C.HG_BLUE);
        this.text(5, 19, 2.4, 'Left stick / D-pad: move   |   Bottom face button: change color', C.WHITE);
        this.text(5, 26, 2.4, 'Right stick: analog marker   |   Keyboard: arrows + Space', C.WHITE);
        this.status = this.text(5, 36, 2.3, 'Press a controller button to connect.', C.HG_YELLOW);
        this.text(5, 90, 2, 'Try holding a direction, unplugging, reconnecting, and switching tabs.', C.WHITE);
        this.player = new GameNode.Shape({ shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(28, 56, 6, 10), fill: C.HG_BLUE });
        this.analog = new GameNode.Shape({ shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(73, 61, 3, 5), fill: C.HG_YELLOW });
        this.base.addChildren(this.player, this.analog);
    }

    text(x, y, size, text, color) {
        const node = new GameNode.Text({ textInfo: { x, y, size, text, color } });
        this.base.addChild(node);
        return node;
    }

    handleKeyDown(playerId, key) {
        const held = this.keys[playerId] ||= new Set();
        if (key === ' ' && !held.has(key)) {
            this.colorIndex++;
            this.player.node.fill = [C.HG_BLUE, C.HG_RED, C.HG_YELLOW][this.colorIndex % 3];
        }
        held.add(key);
        const delta = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, -0.5], ArrowDown: [0, 0.5] }[key];
        if (delta) {
            this.position.x = Math.max(3, Math.min(57, this.position.x + delta[0]));
            this.position.y = Math.max(43, Math.min(75, this.position.y + delta[1]));
        }
        this.player.node.coordinates2d = ShapeUtils.rectangle(this.position.x, this.position.y, 6, 10);
        this.player.node.onStateChange();
    }

    handleKeyUp(playerId, key) { this.keys[playerId]?.delete(key); }
    handlePlayerDisconnect(playerId) { delete this.keys[playerId]; }

    handleGamepadInput(playerId, { input, gamepadIndex, connected, pressed }) {
        const x = input.sticks.STICK_2_X.value;
        const y = input.sticks.STICK_2_Y.value;
        this.analog.node.coordinates2d = ShapeUtils.rectangle(73 + x * 12, 61 + y * 15, 3, 5);
        this.status.node.text = { ...this.status.node.text,
            text: connected
                ? `Player ${playerId} / pad ${gamepadIndex} | right stick ${x.toFixed(2)}, ${y.toFixed(2)}${pressed.length ? ' | press: ' + pressed.join(', ') : ''}`
                : `Pad ${gamepadIndex} released. Reconnect or return to this tab.` };
        this.base.node.onStateChange();
    }

    getLayers() { return [{ root: this.base }]; }
}
module.exports = GamepadTest;
