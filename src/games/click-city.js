let { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squishjs');

Colors = Colors.COLORS;

class ClickCity extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            tickRate: 1
        };
    }

    constructor() {
        super();

        this.base = new GameNode.Shape(
            Colors.WHITE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
            }
        );

        this.viewRoot = new GameNode.Shape(
            Colors.WHITE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
            }
        );

        this.playerStates = {};

        this.base.addChildren(this.viewRoot);
    }

    tick() {
        this.runPlayerStuff();
    }

    runPlayerStuff() {
        for (const playerId in this.players) {
        }
    }

    getRoot() {
        return this.base;
    }

    updatePlayerView(playerId) {
        // todo:
        // shared nodes w/ multiple player IDs 
        for (const nodeIndex in this.viewRoot.node.children) {
            if (this.viewRoot.node.children[nodeIndex].node.playerId == playerId) {
                this.viewRoot.removeChild(this.viewRoot.node.children[nodeIndex].node.id);
            }
        }

        const playerRoot = new GameNode.Shape(
            Colors.BLACK,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
            },
            playerId
        );

        const menu = new GameNode.Shape(
            Colors.BLACK,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 0, 100, 10),
                fill: Colors.BLACK
            },
            playerId
        );

        const cityButton = new GameNode.Shape(
            Colors.BLUE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(70, 2, 10, 6),
                fill: Colors.BLUE
            },
            playerId,
            (player, x, y) => {
                // todo: player views
                this.playerStates[player.id] = {
                    view: 'city'
                };
                this.updatePlayerView(player.id);
            }
        );

        const cityText = new GameNode.Text({
            text: "City",
            x: 75, 
            y: 3.5,
            align: "center",
            color: Colors.WHITE,
            size: 2
        }, playerId);

        const clickerButton = new GameNode.Shape(
            Colors.RED,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(40, 2, 10, 6),
                fill: Colors.RED
            },
            playerId,
            (player, x, y) => {
                // todo: player views
                this.playerStates[player.id] = {
                    view: 'clicker'
                };
                this.updatePlayerView(player.id);
            }
        );

        const clickerText = new GameNode.Text({
            text: "Clicker",
            x: 45, 
            y: 3.5,
            align: "center",
            color: Colors.WHITE,
            size: 2
        }, playerId);

        if (this.playerStates[playerId].view === 'clicker') {
            const clickerView = new GameNode.Shape(
                Colors.RED,
                Shapes.POLYGON,
                {
                    coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                    fill: Colors.RED
                },
                playerId
            );

            playerRoot.addChild(clickerView);
        } else {
            const cityView = new GameNode.Shape(
                Colors.BLUE,
                Shapes.POLYGON,
                {
                    coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                    fill: Colors.BLUE
                },
                playerId
            );

            playerRoot.addChild(cityView);
        }

        cityButton.addChild(cityText);
        clickerButton.addChild(clickerText);

        menu.addChild(cityButton);
        menu.addChild(clickerButton);
        
        playerRoot.addChild(menu);
        
        this.viewRoot.addChild(playerRoot);
    }

    handleNewPlayer(player) {
        this.playerStates[player.id] = {
            view: 'clicker'
        };
        this.updatePlayerView(player.id);
    }

}

module.exports = ClickCity;
