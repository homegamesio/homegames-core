const { Game, GameNode, Colors, Shapes } = require('squish-1005');

const COLORS = Colors.COLORS;

const gameEntry = (x, y) => {
    const entry = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: [
            [x, y],
            [x + 30, y],
            [x + 30, y + 10],
            [x, y + 10],
            [x, y]
        ],
        fill: COLORS.BLACK
    });

    const entryText = new GameNode.Text({
        textInfo: {
            x: x + 15,
            y: y + 5,
            size: 2,
            text: 'ayy lmao',
            align: 'center',
            color: COLORS.WHITE
        }
    });

    entry.addChild(entryText);

    return entry;
};

const gameList = () => {
    const base = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: [
            [0, 0],
            [100, 0],
            [100, 100],
            [0, 100],
            [0, 0]
        ],
        fill: COLORS.BLUE
    });

    const listView = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: [
            [20, 20],
            [40, 20],
            [40, 60],
            [20, 60],
            [20, 20]
        ],
        fill: COLORS.WHITE
    });

    const gameEntry1 = gameEntry(20, 40);
    const gameEntry2 = gameEntry(20, 60);
    const gameEntry3 = gameEntry(20, 80);

    listView.addChildren(gameEntry1, gameEntry2, gameEntry3);

    base.addChild(listView);

    return base;
}

class Clicker extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            thumbnail: 'f103961541614b68c503a9ae2fd4cc47',
            squishVersion: '1005'
        };
    }

    constructor() {
        super();

        const baseColor = Colors.randomColor();
        this.gameList = gameList();
       
        this.layers = [
            {
                root: this.gameList
            }
        ];

    }

    renderGameList() {  
        const gameListBase = this.gameListBase || new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [0, 0],
                [100, 0],
                [100, 100],
                [0, 100],
                [0, 0]
            ],
            fill: COLORS.BLUE
        });
        
        const initialGames = () => {
            const game1 = gameEntry(20, 40);
            const game2 = gameEntry(20, 60);
            const game3 = gameEntry(20, 80);

            this.gameExpireTimes = {
                [game1.node.id]: Date.now() + 1000,
                [game2.node.id]: Date.now() + 1000,
                [game3.node.id]: Date.now() + 1000
            };
            return [game1, game2, game3];
        };

        const renderedGames = this.renderedGames || initialGames();

        console.log('rendered games!');
        console.log(renderedGames);
        console.log(this.gameExpireTimes);

        gameListBase.clearChildren();

        gameListBase.addChildren(renderedGames);

        this.gameListBase = gameListBase;
        this.renderedGames = renderedGames;
    }

    tick() {
        if (!this.renderedGames || this.renderedGames.length < 3) {
            this.renderGameList();
        }
    }

    handleNewPlayer({ playerId, info, settings }) {
    }

    handlePlayerDisconnect() {
    }

    getLayers() {
        return this.layers;
    }
}

module.exports = Clicker;
