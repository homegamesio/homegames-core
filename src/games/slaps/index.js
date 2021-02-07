const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-063');
const Deck = require('../../common/Deck');
const COLORS = Colors.COLORS;

class Slaps extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '063',
            author: 'Joseph Garcia',
            thumbnail: 'https://d3lgoy70hwd3pc.cloudfront.net/thumbnails/slaps.png'
        };
    }

    constructor() {
        super();
        this.players = {};
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: COLORS.EMERALD,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            onClick: this.handleBackgroundClick.bind(this)
        });

        this.infoNodeRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: COLORS.EMERALD,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
        this.base.addChild(this.infoNodeRoot);
        this.infoNodes = {};
    }

    handleBackgroundClick() {

        this.clearTable();
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
                    'text': 'Need at least 2 players', 
                    x: 45, 
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
                coordinates2d: ShapeUtils.rectangle((index * 16) + 20, 35, 15, 15)
            });

            const cardText = new GameNode.Text({
                textInfo: {
                    text: this.hands[i].toString(), 
                    x: (index * 16) + 26, 
                    y: 35,
                    size: 1,
                    align: 'center',
                    color: COLORS.BLACK
                }
            }); 

            cardNode.addChild(cardText);

            this.base.addChild(cardNode);
            index += 1;
        }

        const winnerNotification = new GameNode.Text({
            textInfo: {
                text: winner.name + ' wins!', 
                x: 50, 
                y: 10,
                size: 1,
                align: 'center',
                color: COLORS.BLACK
            }
        });

        this.base.addChild(winnerNotification);

        if (this.canStartNewGame) {
            const newGameNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                fill: COLORS.GREEN,
                coordinates2d: ShapeUtils.rectangle(80, 5, 15, 15),
                onClick: () => {
                    this.base.clearChildren();
                    this.setTimeout(this.newGame.bind(this), 500);
                }
            });

            const newGameText = new GameNode.Text({
                textInfo: {
                    text: 'New Game',
                    x: 88,
                    y: 10.5,
                    align: 'center',
                    size: 2,
                    color: COLORS.BLACK
                }
            });

            this.base.addChild(newGameNode);
        }

    }

    handleNewPlayer(player) {
        this.players[player.id] = player;        
        this.updatePlayerCount();
        const infoNode = new GameNode.Text({
            textInfo: {
                text: player.name, 
                x: 80, 
                y: 5,
                size: 3,
                align: 'center',
                color: COLORS.BLACK
            }, 
            playerIds: [player.id]
        });

        this.infoNodes[player.id] = infoNode;
        this.infoNodeRoot.addChild(infoNode);

        this.clearTable();
    }

    updatePlayerCount() {
        let playerYIndex = 0;
        const playerNodes = Object.values(this.players).map(player => {
            const yIndex = ++playerYIndex * 10;
            return new GameNode.Text({
                textInfo: {
                    text: this.players[player.id].name, 
                    x: 15, 
                    y: yIndex,
                    size: 2,
                    align: 'center',
                    color: COLORS.BLACK
                }
            });
        });

        const playerInfoPanel = new GameNode.Text({
            textInfo: {
                text: 'Players', 
                x: 15, 
                y: 5,
                size: 3,
                align: 'center',
                color: COLORS.BLACK
            }
        });

        playerNodes.forEach(player => {
            playerInfoPanel.addChild(player);
        });

        if (!this.playerInfoPanel) {
            this.playerInfoPanel = playerInfoPanel;
            this.base.addChild(this.playerInfoPanel);
        } else {
            this.base.removeChild(this.playerInfoPanel.id);
            this.playerInfoPanel = playerInfoPanel;
            this.base.addChild(this.playerInfoPanel);
        }
    }

    handlePlayerDisconnect(player) {
        if (this.infoNodes[player.id]) { 
            this.infoNodeRoot.removeChild(this.infoNodes[player.id].id);
        }
        delete this.players[player.id];
        delete this.infoNodes[player.id];
        this.updatePlayerCount();
    }

    getRoot() {
        return this.base;
    }

}

module.exports = Slaps;
