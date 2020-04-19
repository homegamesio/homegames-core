const { Game, GameNode, Colors } = require('squishjs');
const { charadesWord } = require('../common/util');

class Clicktionary extends Game {
    static metadata() {
        return {
            res: {
                width: 1920,
                height: 1080
            },
            author: 'Joseph Garcia'
        };
    }

    constructor() {
        super();
        this.base = GameNode(Colors.CREAM, (player) => {
        }, {'x': 0, 'y': 0}, {'x': 100, 'y': 100});
        this.playerInfoNodes = {};
        this.newRoundNode = GameNode(Colors.GREEN, (player) => {
            this.newRound();
        }, {x: 45, y: 5}, {x: 10, y: 10}, {
            text: 'Start',
            x: 50,
            y: 9
        });
        this.base.addChild(this.newRoundNode);
        this.playerColors = {};
    }

    handleNewPlayer(player) {
        this.renderPlayerList();
    }

    renderPlayerList() {
        this.base.clearChildren([this.newRoundNode.id, this.drawNode && this.drawNode.id, this.wordNode && this.wordNode.id]);
        let yIndex = 0;
        for (const playerId in this.players) {
            const player = this.players[playerId];

            const playerInfoNode = GameNode(
                Colors.CREAM,
                (player) => {

                },
                {
                    x: 10,
                    y: yIndex * 8 + 2
                },
                {
                    x: 1,
                    y: 1
                },
                {
                    text: player.name,
                    x: 10,
                    y: yIndex * 8 + 2
                }
            );
            this.playerInfoNodes[player.id] = playerInfoNode;
            this.base.addChild(playerInfoNode);

            const playerNameNode = GameNode(
                Colors.CREAM,
                null,
                {
                    x: 85,
                    y: 5
                },
                {
                    x: 10,
                    y: 10
                },
                {
                    text: player.name,
                    x: 85,
                    y: 5
                },
                null,
                playerId
            );
            this.base.addChild(playerNameNode);
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
        this.drawNode = GameNode(
            Colors.WHITE,
            (player, x, y) => {
                if (!this.currentPlayerId || this.currentPlayerId != player.id) {
                    return;
                }
                const playerColor = this.playerColors[player.id] || Colors.BLACK;
                const coloredPixel = GameNode(playerColor, () => {}, {'x': (x * 100) - .25, 'y': (y * 100) - .25}, {'x': .5, 'y': .5});
                this.drawNode.addChild(coloredPixel);
            },
            {
                x: 15,
                y: 15
            },
            {
                x: 70,
                y: 70
            });
        this.base.addChild(this.drawNode);
        charadesWord().then(word => {
            this.wordNode = GameNode(Colors.CREAM, null,
                {
                    x: 50, y: 2
                },
                {
                    x: 1,
                    y: 1
                },
                {
                    text: word,
                    x: 50,
                    y: 2
                }, null,
                currentPlayer.id);
            this.base.addChild(this.wordNode);
        });

        const clearButton = GameNode(
            Colors.WHITE,
            (player) => {
                this.drawNode.clearChildren([clearButton.id]);
            }, 
            {
                x: 15,
                y: 90
            },
            {
                x: 5,
                y: 5
            },
            {
                text: 'Clear',
                x: 17.5,
                y: 90
            },
            null,
            currentPlayer.id
        );

        const doneButton = GameNode(Colors.WHITE, () => {
            this.countdownInterval && clearInterval(this.countdownInterval);
            this.wordNode.playerId = 0; 
            setTimeout(() => {
                this.base.clearChildren();
                this.renderPlayerList();
                this.newRound();
            }, 5000);

        }, {x: 5, y: 90}, {x: 5, y: 5}, {x: 5, y: 90, text: 'New Round'}, null, currentPlayer.id);
        this.drawNode.addChild(doneButton);

        const colorOptions = [Colors.BLACK, Colors.RED, Colors.BLUE, Colors.GREEN, Colors.YELLOW, Colors.WHITE];
        let optionIndex = 25;
        for (const colorIndex in colorOptions) {
            const color = colorOptions[colorIndex];
            const colorButton = GameNode(color, 
                (player) => {
                    this.playerColors[player.id] = color;
                }, {x: optionIndex, y: 90}, {x: 5, y: 5}, null, null, currentPlayer.id);
            clearButton.addChild(colorButton);
            optionIndex += 10;
        }
        this.drawNode.addChild(clearButton);

        const countdownNode = GameNode(Colors.CREAM, null,
            {x: 50, y: 10}, {x: 1, y: 1}, {text: '60', x: 50, y: 10});
        this.drawNode.addChild(countdownNode);
        this.countdownInterval = setInterval(() => {
            const currentSecs = Number(countdownNode.text.text);
            const newSecs = currentSecs - 1;
            countdownNode.text = {
                text: '' + newSecs,
                x: 50,
                y: 10
            };
            if (newSecs < 1) {
                clearInterval(this.countdownInterval);
                // visible to everyone
                this.wordNode.playerId = 0; 
                setTimeout(() => {
                    this.base.clearChildren();
                    this.renderPlayerList();
                    this.newRound();
                }, 5000);
            }
        }, 1000);
    }

    getRoot() {
        return this.base;
    }

}

module.exports = Clicktionary;
