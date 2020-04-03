const { Colors, GameNode } = require('squishjs');
const Game = require('./Game');

class Quarantine extends Game {
    static metadata() {
        return {
            res: {
                width: 1920,
                height: 1080
            },
            author: 'Joseph Garcia',
            players: 2
        };
    }

    constructor() {
        super();
        this.base = GameNode(Colors.RED, null, {x: 0, y: 0}, {x: 100, y: 100});
        this.playerNameRoot = GameNode(Colors.RED, null, {x: 0, y: 0}, {x: 0, y: 0});
        this.base.addChild(this.playerNameRoot);
        this.activeGame = false;
        this.currentPlayerId = null;
        this.answers = {};
    }

    newTurn() {
        this.base.clearChildren([this.playerNameRoot.id]);
        if (!this.currentPlayerId) {
            this.currentPlayerId = 1;
        } else {
            this.currentPlayerId = this.currentPlayerId == 1 ? 2 : 1;
        }

        this.answers = {
            1: null,
            2: null 
        };

        const currentPlayerNode = GameNode(Colors.RED, null, {x: 40, y: 5}, {x: 80, y: 10}, {text: `Player ${this.currentPlayerId}'s turn`, x: 50, y: 5, size: 36});
        const question = GameNode(Colors.RED, null, {x: 40, y: 10}, {x: 80, y: 10}, {text: 'This is a question', x: 50, y: 15, size: 50});
        const cardOne = GameNode(Colors.randomColor(), (player, x, y) => {
            this.answers[player.id] = cardOne.id;
        }, {x: 5, y: 35}, {x: 40, y: 40}, {text: 'Option A', x: 25, y: 52, size: 36});

        const cardTwo = GameNode(Colors.WHITE, (player, x, y) => {
            this.answers[player.id] = cardTwo.id;
        }, {x: 55, y: 35}, {x: 40, y: 40}, {text: 'Option B', x: 75, y: 52, size: 36});

        this.base.addChild(currentPlayerNode);
        this.base.addChild(question);
        this.base.addChild(cardOne);
        this.base.addChild(cardTwo);
    }

    handleNewPlayer(player) {
        const playerName = `Player ${player.id}`;
        const playerNode = GameNode(Colors.RED, null, {x: 5, y: 5}, {x: 5, y: 5}, {text: playerName, x: 5, y: 5, size: 36}, null, player.id);
        this.playerNameRoot.addChild(playerNode);
    }

    tick() {
        if (Object.keys(this.players).length == 2 && !this.activeGame) {
            this.activeGame = true;
            this.newTurn();
        } else if (this.activeGame) {
            if (this.answers[1] && this.answers[2]) {
                if (this.answers[1] == this.answers[2]) {
                    console.log('saaaame dude');
                } else {
                    console.log('not same');
                }
                this.newTurn();
            }
        }
    }

    getRoot() {
        return this.base;
    }
}

module.exports = Quarantine;
