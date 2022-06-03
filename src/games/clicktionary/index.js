const { charadesWord } = require('../../common/util');
const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-0740');

const COLORS = Colors.COLORS;

class Clicktionary extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            description: 'ayy lmao this is a test',
            author: 'Joseph Garcia',
            thumbnail: '4b5f169186bc542e14b5d001d25ce6bb'
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.CREAM
        });

        this.players = {};
        this.excludedNodeRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [0, 0],
                [0, 0]
            ]
        });

        this.base.addChild(this.excludedNodeRoot);

        this.playerInfoNodes = {};
        this.playerCOLORS = {};

        this.updateGameState();
    }

    updateGameState() {

        if (Object.keys(this.players).length > 1) {
            if (this.notEnoughPlayersText) {
                this.excludedNodeRoot.removeChild(this.notEnoughPlayersText.id);
                this.notEnoughPlayersText = null;
            }
            this.newRoundNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON, 
                coordinates2d: ShapeUtils.rectangle(45, 4, 10, 10),
                fill: COLORS.HG_RED,
                onClick: (player) => {
                    this.excludedNodeRoot.removeChild(this.newRoundNode.id);
                    this.newRound();
                }
            });

            const newRoundLabel = new GameNode.Text({
                textInfo: {
                    text: 'Start',
                    x: 50,
                    y: 7.5,
                    align: 'center',
                    size: 2,
                    color: COLORS.WHITE
                }
            });

            this.newRoundNode.addChild(newRoundLabel);
            this.excludedNodeRoot.addChild(this.newRoundNode);
        } else if (!this.notEnoughPlayersText) {
            this.notEnoughPlayersText = new GameNode.Text({
                textInfo: {
                    text: 'At least 2 players required',
                    x: 50,
                    y: 50,
                    align: 'center',
                    size: 1,
                    color: COLORS.HG_BLACK
                }
            });
            
            this.excludedNodeRoot.addChild(this.notEnoughPlayersText);
        }
    }

    handleNewPlayer({ playerId, info: playerInfo }) {
        this.players[playerId] = playerInfo;
        this.updateGameState();
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
    }

    renderPlayerList() {
        this.base.clearChildren([this.excludedNodeRoot.id]);
        let yIndex = 0;
        for (const playerId in this.players) {

            const playerInfoNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(10, 10, yIndex * 8 + 2, 1, 1),
                fill: COLORS.CREAM
            });
            
            this.playerInfoNodes[playerId] = playerInfoNode;
            this.base.addChild(playerInfoNode);

            yIndex++;
        }
    }

    playerDidDisconnect(playerId) {
        delete this.playerInfoNodes[playerId];
        this.renderPlayerList();
    }

    getCurrentPlayer() {
        if (this.currentPlayerIndex === null || this.currentPlayerIndex === undefined) {
            this.currentPlayerIndex = 0;
        } else {
            let newPlayerIndex = this.currentPlayerIndex + 1;
            if (newPlayerIndex > Object.values(this.players).length - 1) {
                newPlayerIndex = 0;
            }
            this.currentPlayerIndex = newPlayerIndex;
        }
        this.currentPlayerId = Object.keys(this.players)[this.currentPlayerIndex];

        return Object.values(this.players)[this.currentPlayerIndex];
    }

    newRound() {
        this.newRoundNode.size = {x: 0, y: 0};
        this.newRoundNode.text = null;
        const currentPlayer = this.getCurrentPlayer();
        this.canvas = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [15, 15],
                [85, 15],
                [85, 85],
                [15, 85],
                [15, 15]
            ],
            fill: COLORS.WHITE,
            onClick: (player, x, y) => {
                if (!currentPlayer || currentPlayer.id != player.id) {
                    return;
                }

                const playerColor = this.playerCOLORS[player.id] || COLORS.BLACK;

                const coloredPixel = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: [
                        x - .25, y - .25,
                        x + .25, y - .25,
                        x + .25, y + .25,
                        x - .25, y + .25, 
                        x - .25, y - .25
                    ],
                    fill: playerColor
                });
                this.canvas.addChild(coloredPixel);
            }
        });

        this.base.addChild(this.canvas);
        
        charadesWord().then(word => {
            this.wordNode = new GameNode.Text({
                textInfo: {
                    text: word,
                    align: 'center',
                    x: 50,
                    y: 5,
                    size: 2,
                    color: COLORS.BLACK
                },
                playerIds: [currentPlayer.id]
            });

            this.base.addChild(this.wordNode);

        });
    
        const clearButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(2, 70, 10, 10),
            fill: COLORS.HG_RED,
            playerIds: [currentPlayer.id],
            onClick: (player) => {
                this.canvas.clearChildren([clearButton.id]);
            }
        });

        const clearText = new GameNode.Text({
            textInfo: {
                text: 'Clear',
                x: 7,
                y: 73,
                align: 'center',
                size: 2,
                color: COLORS.WHITE
            }, 
            playerIds: [currentPlayer.id]
        });
    
        clearButton.addChild(clearText);

        let doneCountdown;

        const doneButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(88, 4, 10, 10),
            fill: COLORS.HG_BLUE,
            playerIds: [currentPlayer.id],
            onClick: () => {
                if (!doneCountdown) {
                    this.wordNode.node.playerId = null;
                    doneCountdown = this.setTimeout(() => {
                        doneCountdown = null;
                        this.base.clearChildren([this.excludedNodeRoot.id]);
                        this.newRound();
                    }, 5000);
                }
            }
        });

        const doneText = new GameNode.Text({
            textInfo: {
                text: 'Done',
                x: 93.3,
                y: 7,
                align: 'center',
                size: 2,
                color: COLORS.WHITE
            }, 
            playerIds: [currentPlayer.id]
        });

        doneButton.addChild(doneText);

        clearButton.addChild(doneButton);

        this.canvas.addChild(clearButton);

        const colorOptions = [COLORS.BLACK, COLORS.RED, COLORS.BLUE, COLORS.GREEN, COLORS.YELLOW, COLORS.WHITE];

        let optionX = 25;
        for (const colorIndex in colorOptions) {
            const color = colorOptions[colorIndex];
            const colorButton = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(optionX, 90, 5, 5),
                fill: color,
                playerIds: [currentPlayer.id],
                onClick: (player) => {
                    this.playerCOLORS[player.id] = color;
                }
            });
            clearButton.addChild(colorButton);

            optionX += 10;
        }

        const answerTime = 60;

        let currentTime = answerTime;
        const textInfo = {
            text: '' + currentTime,
            x: 80,
            y: 5,
            align: 'center',
            size: 5,
            color: COLORS.WHITE
        };

        const countdownNode = new GameNode.Text({textInfo: Object.assign({}, textInfo)});

        const countdown = this.setInterval(() => {
            if (currentTime <= 1) {
                clearInterval(countdown);
                this.wordNode.node.playerId = null;
                this.setTimeout(() => {
                    this.base.clearChildren([this.excludedNodeRoot.id]);
                    this.newRound();
                }, 5000);
            }

            currentTime--;
            
            const newText = Object.assign({}, textInfo);
            newText.text = '' + currentTime;
            countdownNode.node.text = newText;
        }, 1000);

        clearButton.addChild(countdownNode);
    }

    getLayers() {
        return [{root: this.base}];
    }

}

module.exports = Clicktionary;
