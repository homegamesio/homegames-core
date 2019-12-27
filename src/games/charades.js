const { gameNode, Colors } = require("../common");
const { charadesWord } = require("../common/util/charades-generator");

class Charades {
    static metadata() {
        return {
            res: {
                width: 1280,
                height: 720
            },
            author: "Joseph Garcia"
        };
    }

    constructor() {
        this.base = gameNode(Colors.CREAM, (player) => {
        }, {"x": 0, "y": 0}, {"x": 100, "y": 100});
        this.playerInfoNodes = {};
        this.newRoundNode = gameNode(Colors.GREEN, (player) => {
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

            const playerInfoNode = gameNode(
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

            const playerNameNode = gameNode(
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
        if (!this.currentPlayerIndex) {
            this.currentPlayerIndex = 0;
        } else {
            let newPlayerIndex = this.currentPlayerIndex + 1;
            if (newPlayerIndex >= Object.values(this.players).length) {
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
        this.drawNode = gameNode(
            Colors.WHITE,
            (player, x, y) => {
                if (!this.currentPlayerId || this.currentPlayerId != player.id) {
                    return;
                }
                const playerColor = this.playerColors[player.id] || Colors.BLACK;
                const coloredPixel = gameNode(playerColor, () => {}, {"x": (x * 100) - .25, "y": (y * 100) - .25}, {"x": .5, "y": .5});
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
            this.wordNode = gameNode(Colors.CREAM, null,
                {
                    x: 45, y: 5
                },
                {
                    x: 10,
                    y: 10
                },
                {
                    text: 'ayy lmao',
                    x: 45,
                    y: 5
                }, null,
                currentPlayer.id);
            this.base.addChild(this.wordNode);
        });

        const clearButton = gameNode(
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
                text: "Clear",
                x: 17.5,
                y: 90
            },
            null,
            currentPlayer.id
        );

        const colorOptions = [Colors.BLACK, Colors.RED, Colors.BLUE, Colors.GREEN, Colors.YELLOW, Colors.WHITE];
        let optionIndex = 25;
        for (let colorIndex in colorOptions) {
            const color = colorOptions[colorIndex];
            console.log(color);
            const colorButton = gameNode(color, 
                (player) => {
                    this.playerColors[player.id] = color;
                }, {x: optionIndex, y: 90}, {x: 5, y: 5}, null, currentPlayer.id);
            clearButton.addChild(colorButton);
            optionIndex += 10;
        }
        this.drawNode.addChild(clearButton);
    }

    getRoot() {
        return this.base;
    }

}

module.exports = Charades;
