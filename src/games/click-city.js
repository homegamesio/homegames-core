let { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squishjs');

Colors = Colors.COLORS;
console.log("RED");

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

        this.menu = new GameNode.Shape(
            Colors.BLACK,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 0, 100, 10),
                fill: Colors.BLACK
            }
        );

        const cityButton = new GameNode.Shape(
            Colors.BLUE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(70, 2, 10, 6),
                fill: Colors.BLUE
            }
        );

        const clickerButton = new GameNode.Shape(
            Colors.RED,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(40, 2, 10, 6),
                fill: Colors.RED
            },
            null,
            (player, x, y) => {
                // todo: player views
                console.log("PLAYER IS CURRENTLY LOOKING AT SOMETHING AND YOU WANT THEIR VIEW TO BE CLICKER");
                console.log(this.playerViews[player.id]);
            }
        );

        this.menu.addChild(cityButton);
        this.menu.addChild(clickerButton);

        this.viewRoot = new GameNode.Shape(
            Colors.WHITE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
            }
        );

        this.clickerView = new GameNode.Shape(
            Colors.RED,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                fill: Colors.RED
            }
        );

        this.playerAbilities = {};
        this.playerViews = {};

        this.cityView = new GameNode.Shape(
            Colors.BLUE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                fill: Colors.BLUE
            }
        );

        this.viewRoot.addChildren(this.clickerView, this.cityView);

        this.base.addChildren(this.viewRoot, this.menu);
    }

    tick() {
        this.runPlayerStuff();
    }

    runPlayerStuff() {
        for (const playerId in this.players) {
            console.log(this.playerAbilities[playerId]);
        }
    }

    getRoot() {
        return this.base;
    }

    handleNewPlayer(player) {
        this.playerAbilities[player.id] = {}
        this.playerViews[player.id] = {};
    }

}

module.exports = ClickCity;
