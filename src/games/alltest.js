const gameNode = require("../GameNode");
const Asset = require("../Asset");
const { colors, randomColor } = require("../Colors");

class AllTest {
    constructor() {
        this.collisionCount = 0;
        this.assets = {
            "buddy": new Asset("url", {
                "location": "https://upload.wikimedia.org/wikipedia/commons/b/bb/Gorgosaurus_BW_transparent.png",
                "type": "image"
            }),
            "collisionSound": new Asset("url", {
                "location": "https://www.myinstants.com/media/sounds/waluigi_wahring2mob.mp3",
                "type": "audio"
            })
        };
 
        this.base = gameNode(colors.RED, null, {x: 0, y: 0}, {x: 100, y: 100}, {x: 5, y: 5, text: this.collisionCount}, {'buddy': {size: {x: 25, y: 20}, pos: {x: 70, y: 8}}});

        this.soundPlayer = gameNode(
            colors.PERRYWINKLE,
            null,
            {
                "x": 0,
                "y": 0
            },
            {
                "x": 0,
                "y": 0
            }, 
            null,
            {
                "collisionSound": {
                    size: {
                        x: 0,
                        y: 0
                    },
                    pos: {
                        x: 0,
                        y: 0
                    }
                }
            }
        );

        this.initialize();
    }

    initialize() {
        this.base.clearChildren();

        this.leftRight = gameNode(colors.WHITE, (x,y) => {
            this.leftRight.color = colors.BLUE;
        }, {x: 0, y: 45}, {x: 10, y: 10});

        this.upDown = gameNode(colors.BLUE, (x,y) => {
            this.upDown.color = colors.WHITE;
        }, {x: 45, y: 0}, {x: 10, y: 10});

        this.base.addChild(this.leftRight);
        this.base.addChild(this.upDown);
    }

    handleKeyDown(player, key) {
        if (key === 'ArrowUp' || key === 'ArrowDown') {
            const co = key === 'ArrowUp' ? -1 : 1;
            this.upDown.pos = {x: this.upDown.pos.x, y: this.upDown.pos.y + (co * 5)};
        } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
            const co = key === 'ArrowLeft' ? -1 : 1;
            this.leftRight.pos = {x: this.leftRight.pos.x + (co * 5), y: this.leftRight.pos.y};
        }
    };

    handleCollision(node1, node2) {
        this.initialize();
        this.collisionCount++;
        this.base.text = {x: 5, y: 5, text: '' + this.collisionCount};
        this.base.addChild(this.soundPlayer);
    }

    handleNewPlayer(player) {
    }

    handlePlayerDisconnect(player) {
    }

    getAssets() {
        return this.assets;
    }

    getRoot() {
        return this.base;
    }
}

module.exports = AllTest;
