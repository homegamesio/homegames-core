const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squishjs');
const Deck = require('../common/Deck');
const COLORS = Colors.COLORS;

class Slappers extends Game {
    static metadata() {
        return {
            author: 'Joseph Garcia',
            aspectRatio: {
                x: 16,
                y: 9
            }
        };
    }

    constructor() {
        super();

        this.scores = {};

        this.base = new GameNode.Shape({
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            shapeType: Shapes.POLYGON,
            fill: COLORS.BLACK
        });

        this.playerListSection = new GameNode.Shape({
            coordinates2d: ShapeUtils.rectangle(5, 20, 20, 70),
            shapeType: Shapes.POLYGON,
            fill: COLORS.RED
        });

        this.newRoundButtonSection = new GameNode.Shape({
            coordinates2d: ShapeUtils.rectangle(85, 20, 10, 60),
            shapeType: Shapes.POLYGON,
            fill: COLORS.PURPLE
        });

        this.winnerTextSection = new GameNode.Shape({
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: COLORS.BLUE,
            shapeType: Shapes.POLYGON
        });

        this.cardSection = new GameNode.Shape({
            coordinates2d: ShapeUtils.rectangle(30, 20, 50, 60),
            shapeType: Shapes.POLYGON,
            fill: COLORS.BLACK
        });

        this.newRoundButton = new GameNode.Shape({
            coordinates2d: ShapeUtils.rectangle(85, 40, 10, 20),
            shapeType: Shapes.POLYGON,
            fill: COLORS.HG_BLUE,
            onClick: (player) => {
                this.newRound();
            }
        });

        this.newRoundButtonSection.addChild(this.newRoundButton);
        this.newRoundText = new GameNode.Text({
            textInfo: {
                text: "New Round",
                x: 90,
                y: 49,
                align: "center",
                color: COLORS.BLACK,
                size: 1
            }
        });

        this.newRoundButton.addChild(this.newRoundText);

        this.base.addChildren(this.winnerTextSection, this.playerListSection, this.newRoundButtonSection, this.cardSection);
    }

    newRound() {
        this.cardSection.node.clearChildren();
        this.winnerTextSection.node.clearChildren();
        const deck = new Deck();
        deck.shuffle();
        let xIndex = 30;
        let top = true;
        let winnerObj = {};
        for (const playerId in this.players) {
            const player = this.players[playerId];

            const playerCard = deck.drawCard();

            if (!winnerObj.player || playerCard.value > winnerObj.score) {
                winnerObj.player = player;
                winnerObj.score = playerCard.value;
            }

            const playerCardNode = new GameNode.Shape({
                fill: COLORS.WHITE,
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(xIndex, 42.5, 6, 15)
            });
            this.cardSection.addChild(playerCardNode);
            const cardTextNode = new GameNode.Text({
                textInfo: {
                    text: playerCard.value + '',
                    x: xIndex + 3,
                    y: 45,
                    color: COLORS.BLACK,
                    size: 4,
                    align: "center"
                }
            });

            playerCardNode.addChild(cardTextNode);

            const textYPos = top ? 40 : 60;
            const cardPlayerNameText = new GameNode.Text({
                textInfo: {
                    text: player.name,
                    x: xIndex + 3,
                    y: textYPos,
                    align: "center",
                    size: 1,
                    color: COLORS.WHITE
                }
            });

            playerCardNode.addChild(cardPlayerNameText);

            xIndex += 10;
            top = !top;
        }

        const winnerText = new GameNode.Text({
            textInfo: {
                text: winnerObj.player.name + ' wins!',
                x: 50, 
                y: 5,
                size: 3,
                align: 'center',
                color: COLORS.WHITE
            }
        });

        this.scores[winnerObj.player.id] += 1;
        this.renderPlayerList();

        this.winnerTextSection.addChild(winnerText);
    }

    renderPlayerList() {
        this.playerListSection.node.clearChildren();
        let yIndex = 20;
        for (const playerId in this.players) {
            const player = this.players[playerId];
            const textNode = new GameNode.Text({
                textInfo: {
                    text: player.name + ' ' + this.scores[player.id],
                    x: 15,
                    y: yIndex,
                    align: 'center',
                    color: COLORS.WHITE,
                    size: 1
                }
            });

            this.playerListSection.addChild(textNode);
            yIndex += 10;
        }
    }

    handleNewPlayer(player) {
        this.scores[player.id] = 0;
        this.renderPlayerList();
    }

    handlePlayerDisconnect(playerId) {
        delete this.scores[playerId];
        this.renderPlayerList();
    }

    getRoot() {
        return this.base;
    }
}

module.exports = Slappers;
