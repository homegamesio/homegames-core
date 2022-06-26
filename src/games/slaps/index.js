const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-0750');
const Deck = require('../../common/Deck');
const COLORS = Colors.COLORS;

class Slaps extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '0750',
            author: 'Joseph Garcia',
            thumbnail: 'e9d61bd0a3ab307dfe077e363b24e64a',
            name: 'Slaps - Reslapstered',
            description: 'One of the first homegames "games" ever made. Players draw cards and whoever draws a higer value wins.'
        };
    }

    constructor() {
        super();
        this.players = {};
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: COLORS.EMERALD,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100)
        });

        this.infoNodeRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: COLORS.EMERALD,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
        this.base.addChild(this.infoNodeRoot);
        this.infoNodes = {};
    }

    initializeCards() {
        this.deck = new Deck();
        this.deck.shuffle();
    }

    clearTable() {
        this.base.clearChildren([this.playerInfoPanel && this.playerInfoPanel.id, this.infoNodeRoot && this.infoNodeRoot.id, this.playerRequirementNode && this.playerRequirementNode.id, this.newGameNode && this.newGameNode.id]);
    }

    tick() {

        const playerCount = Object.keys(this.players).length;

        if (playerCount < 2 && !this.playerRequirementNode) { 
            this.clearTable();
            this.playerRequirementNode = new GameNode.Text({
                textInfo: {
                    'text': '2 players required', 
                    x: 50, 
                    y: 5,
                    size: 3,
                    align: 'center',
                    color: COLORS.BLACK
                }
            });
            this.base.addChild(this.playerRequirementNode);
        } else if (playerCount >= 2 && !this.newGameNode) {

            this.clearTable();
            const newGameText = new GameNode.Text({
                textInfo: {
                    text: 'New Game',
                    x: 50,
                    y: 47.5,
                    align: 'center',
                    size: 2,
                    color: COLORS.BLACK
                }
            });
            this.newGameNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                fill: COLORS.GREEN,
                coordinates2d: ShapeUtils.rectangle(37.5, 37.5, 25, 25),
                onClick: this.newGame.bind(this)
            });
            this.newGameNode.addChild(newGameText);
            this.base.addChild(this.newGameNode);
        } else if (this.newGameNode && playerCount < 2) {

            this.clearTable();
            this.base.removeChild(this.newGameNode.id);
        } else if (this.playerRequirementNode && playerCount > 1) {

            this.clearTable();
            this.base.removeChild(this.playerRequirementNode.id);
            this.playerRequirementNode = null;
        }
    }

    newGame() {
        this.base.removeChild(this.newGameNode.id);
        this.clearTable();
        this.initializeCards();
        
        this.hands = {};
        let index = 0;
        let highestVal, winner;
        for (const i in this.players) {
            this.hands[i] = this.deck.drawCard();
            const player = this.players[i];
            if (!highestVal || this.hands[i].value > highestVal) {
                highestVal = this.hands[i].value;
                winner = player;
            }

            const cardNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                fill: COLORS.WHITE,
                coordinates2d: ShapeUtils.rectangle((index * 48) + 17.5, 35, 20, 15)
            });

            const cardText = new GameNode.Text({
                textInfo: {
                    text: this.hands[i].toString(), 
                    x: (index * 48) + 27.5, 
                    y: 40,
                    size: 1.4,
                    align: 'center',
                    color: COLORS.BLACK
                }
            }); 

            const nameNode = new GameNode.Text({
                textInfo: {
                    text: this.players[i].info.name,
                    x: (index * 48) + 27.5,
                    y: 52,
                    color: COLORS.WHITE,
                    align: 'center',
                    size: 1.4
                }
            });

            cardNode.addChildren(cardText, nameNode);

            this.base.addChild(cardNode);
            index += 1;
        }

        const winnerNotification = new GameNode.Text({
            textInfo: {
                text: winner.info.name + ' wins!', 
                x: 50, 
                y: 10,
                size: 2,
                align: 'center',
                color: COLORS.BLACK
            }
        });

        this.base.addChild(winnerNotification);

        const newGameNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: COLORS.GREEN,
            coordinates2d: ShapeUtils.rectangle(40, 70, 20, 15),
            onClick: () => {
                this.base.clearChildren();
                this.setTimeout(this.newGame.bind(this), 500);
            }
        });

        const newGameText = new GameNode.Text({
            textInfo: {
                text: 'New Game',
                x: 50,
                y: 75,
                align: 'center',
                size: 1.8,
                color: COLORS.BLACK
            }
        });

        newGameNode.addChild(newGameText);

        this.base.addChild(newGameNode);
        
    }

    handleNewPlayer({ playerId, info, settings }) {
        this.players[playerId] = { info, settings };

        this.clearTable();
    }

    handlePlayerDisconnect(playerId) {
        if (this.infoNodes[playerId]) { 
            this.infoNodeRoot.removeChild(this.infoNodes[playerId].id);
        }
        delete this.players[playerId];
        delete this.infoNodes[playerId];
    }
    
    getLayers() {
        return [{root: this.base}];
    }

}

module.exports = Slaps;
