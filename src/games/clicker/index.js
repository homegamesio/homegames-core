const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-1005');

const COLORS = Colors.COLORS;


// TODO: add these to shapeutils

const getCenter = (node) => {
    return [
        (node.node.coordinates2d[1][0] - node.node.coordinates2d[0][0]) / 2,
        (node.node.coordinates2d[2][1] - node.node.coordinates2d[1][0]) / 2,
    ]
};

const getXStart = (node) => node.node.coordinates2d[0][0];

const getYStart = (node) => node.node.coordinates2d[0][1];

const getHeight = (node) => node.node.coordinates2d[2][1] - node.node.coordinates2d[1][1];

const getWidth = (node) => node.node.coordinates2d[1][0] - node.node.coordinates2d[0][0];

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

        this.rates = {};
        this.progress = {};
        this.progressNodes = {};

        this.gameList = this.renderGameList();
       
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

            this.rates[game1.node.id] = Math.random() * 10;//Date.now() + 1000,
            this.rates[game2.node.id] = Math.random() * 10;
            this.rates[game3.node.id] = Math.random() * 10;

            this.progress[game1.node.id] = 0;
            this.progress[game2.node.id] = 0;
            this.progress[game3.node.id] = 0;

            this.progressNodes[game1.node.id] = game1;
            this.progressNodes[game2.node.id] = game2;
            this.progressNodes[game3.node.id] = game3;

            return [game1, game2, game3];
        };

        const renderedGames = initialGames();

        gameListBase.clearChildren();

        for (let i in renderedGames) {
            gameListBase.addChild(renderedGames[i]);
        }

        return gameListBase;
    }

    onProgress(progressBarNodeId) {
        const node = this.progressNodes[progressBarNodeId];

        if (!node) {
            console.warn('Attempted to render unknown progress bar node ' + progressBarNodeId);
            return;
        }

        // basically guaranteed to be here
        const textChild = node.node.children[0];
        const textInfo = Object.assign({}, textChild.node.text);

        const curPos = getCenter(node);
        // todo: better names
        const left = getXStart(node);
        const _top = getYStart(node);
        const nodeHeight = getHeight(node);
        const nodeWidth = getWidth(node) + this.rates[progressBarNodeId];
        if (nodeWidth > 80) {
            this.gameList.removeChild(progressBarNodeId);
            const newGame = gameEntry(left, _top);
            this.rates[newGame.node.id] = Math.random() * 10;
            this.progress[newGame.node.id] = 0;
            this.progressNodes[newGame.node.id] = newGame;
            this.gameList.addChild(newGame);

            console.log('replacing node');

            delete this.rates[progressBarNodeId];
            // todo: free()
        } 
        const newCoords = ShapeUtils.rectangle(left, _top, nodeWidth, nodeHeight);
        node.node.coordinates2d = newCoords; 
        textInfo.text = 'ayy ' + nodeWidth;
        textChild.node.text = textInfo;
    }

    tick() {
        if (!this.renderedGames || this.renderedGames.length < 3) {
//            this.renderGameList();
        }
        for (let gameNodeId in this.rates) {
            this.onProgress(gameNodeId);
//            console.log("ffoiofofof " + gameNodeId)
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
