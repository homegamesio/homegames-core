const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-0755');
const dictionary = require('../../common/util/dictionary');

let COLORS = Colors.COLORS;

class WordMatch extends Game {
    static metadata() {
        return {
            author: 'Joseph Garcia',
            squishVersion: '0755',
            aspectRatio: {
                x: 16,
                y: 9
            },
            description: "Match the same word as the other player. Desktop keyboard input required."
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            fill: COLORS.CREAM, 
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100)
        });

        this.savedNodeRoot = new GameNode.Shape({
            fill: COLORS.CREAM, 
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        this.base.addChild(this.savedNodeRoot);

        this.gameInProgress = false;
        this.infoNodes = {};
        this.responseBoxes = {};
        this.playerReadyStates = {};
        this.keyCoolDowns = {};
        this.currentPlayerIndices = [];
        this.scores = {};
        this.players = {};
    }

    clearTable() {
        this.base.clearChildren([this.savedNodeRoot.id]);
    }

    tick() {
        const playerCount = Object.keys(this.players).length;
        if (playerCount > 1 && !this.newGameButton && !this.gameInProgress) {
            if (this.playerRequirementText) {
                this.savedNodeRoot.removeChild(this.playerRequirementText.id);
                this.playerRequirementText = null;
            }

            this.newGameButton = new GameNode.Shape({
                fill: COLORS.HG_BLUE,
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(40, 40, 20, 20),   
                onClick: () => { 
                    this.savedNodeRoot.removeChild(this.newGameButton.node.id);
                    this.newGame()
                }
            });

            const newGameText = new GameNode.Text({
                textInfo: {
                    text: 'Start',
                    x: 50, 
                    y: 50,
                    size: 1.2,
                    color: COLORS.WHITE,
                    align: 'center'
                }
            });

            this.newGameButton.addChild(newGameText);

            this.savedNodeRoot.addChild(this.newGameButton);            
        } else if (playerCount < 2 && !this.playerRequirementText && !this.gameInProgress) {
            this.playerRequirementText = new GameNode.Text({
                textInfo: {
                    text: '2 players required',
                    size: 1.8,
                    color: COLORS.BLACK,
                    x: 50,
                    y: 25,
                    align: 'center'
                }
            });
            this.savedNodeRoot.addChild(this.playerRequirementText);
        } else if (this.gameInProgress && !this.results) {
            const notReadyPlayers = Object.values(this.playerReadyStates).filter(s => !s.ready);
            if (notReadyPlayers.length < 1) {
                this.showResults();
            }
        }
    }

    finishRound() {
        const newPlayerIndices = new Array();
        // next players
        for (let n in this.currentPlayerIndices) {
            n = Number(n);
            newPlayerIndices.push((n + 1) % Object.keys(this.players).length);
        }
        this.currentPlayerIndices = newPlayerIndices;
        this.newGame();
    }

    grantPlayerPoints() {
        for (const id in this.players) {
            const player = this.players[id];
            if (!this.scores[id]) {
                this.scores[id] = 0;
            }
            this.scores[id] = this.scores[id] + 1; 
        }
    }

    showResults() {
        this.results = true;
        this.clearTable();
        let countdownInt = 3;
        const countdownNode = new GameNode.Text({
            textInfo: {
                color: COLORS.BLACK,
                text: '', 
                x: 50, 
                y: 50,
                align: 'center',
                size: 2
            }
        });

        this.base.addChild(countdownNode);

        const me = this;

        const votes = {};

        const interval = this.setInterval(() => {
            if (countdownInt == 0) {
                clearInterval(interval);
                this.clearTable();
                const resultOneText = Object.values(this.responseBoxes)[0].node.text.text;
                const resultTwoText = Object.values(this.responseBoxes)[1].node.text.text;
                
                const resultOne = new GameNode.Text({
                    textInfo: {
                        color: COLORS.HG_BLACK, 
                        text: resultOneText, 
                        x: 25, 
                        y: 35,
                        align: 'center',
                        size: 1.2
                    }
                });

                const resultTwo = new GameNode.Text({
                    textInfo: {
                        color: COLORS.HG_BLACK, 
                        text: resultTwoText, 
                        x: 65, 
                        y: 35
                    }
                });
                this.base.addChild(resultOne);
                this.base.addChild(resultTwo);

                const resultsMatch = resultOneText.toLowerCase().trim() === resultTwoText.toLowerCase().trim();
                if (resultsMatch) {
                    const results = new GameNode.Text({
                        textInfo: {
                            color: COLORS.HG_BLUE, 
                            text: 'Same!', 
                            x: 50, 
                            y: 60,
                            align: 'center',
                            size: 1.6
                        }
                    });
                    this.base.addChild(results);
                    this.grantPlayerPoints();

                    const playerIdList = Object.keys(this.players);

                    const scoreNode1 = new GameNode.Text({
                        textInfo: {
                            text: this.players[playerIdList[0]].info.name + ': ' + this.scores[playerIdList[0]],
                            x: 25,
                            y: 25,
                            color: COLORS.HG_RED,
                            align: 'center',
                            size: 1.6
                        }
                    });
                    
                    const scoreNode2 = new GameNode.Text({
                        textInfo: {
                            text: this.players[playerIdList[1]].info.name + ': ' + this.scores[playerIdList[1]],
                            x: 75,
                            y: 25,
                            color: COLORS.HG_RED,
                            align: 'center',
                            size: 1.6
                        }
                    });

                    this.base.addChildren(scoreNode1, scoreNode2);

                    this.setTimeout(this.finishRound.bind(this), 3000);
                } else {
                    const addPlayerVote = (voteType) => (playerId) => {
                        if (!votes[voteType]) {
                            votes[voteType] = new Set();
                        }
                        for (const key in votes) {
                            if (votes[key].has(playerId)) {
                                votes[key].delete(playerId);
                            }
                        }
                        votes[voteType].add(playerId);

                        let totalVotes = 0;
                        for (const key in votes) {
                            totalVotes += votes[key].size;
                        }
                        if (totalVotes == Object.keys(this.players).length) {
                            if ((votes['yes'] ? votes['yes'].size : 0) > (votes['no'] ? votes['no'].size : 0)) {
                                this.grantPlayerPoints(); 
                            } else {
                                console.log('it\'s a no from me dog');
                            }
                            this.finishRound();
                        }
                    };
                    const closeEnoughText = new GameNode.Text({
                        textInfo: {
                            color: COLORS.BLACK,
                            'text': 'Close Enough?', 
                            x: 50, 
                            y: 55,
                            align: 'center',
                            size: 1.4
                        }
                    });
                    const btn1 = new GameNode.Shape({
                        fill: COLORS.BLUE, 
                        onClick: (playerId) => addPlayerVote('yes')(playerId),
                        shapeType: Shapes.POLYGON,
                        coordinates2d: ShapeUtils.rectangle(55, 65, 10, 10)
                    });

                    const btn2 = new GameNode.Shape({
                        fill: COLORS.RED, 
                        onClick: (playerId) => addPlayerVote('no')(playerId), 
                        shapeType: Shapes.POLYGON,
                        coordinates2d: ShapeUtils.rectangle(35, 65, 10, 10)
                    });
                    this.base.addChild(closeEnoughText);
                    this.base.addChild(btn1);
                    this.base.addChild(btn2);
                }
            } else {
                const newText = countdownNode.node.text;
                newText.text = '' + countdownInt--;
                countdownNode.node.text = newText;
            }
        }, 1000);

        this.base.addChild(countdownNode);

    }

    newGame() {
        // this.base.removeChild(this.playerRequirementText.node.id)
        this.playerReadyStates = {};
        for (const playerId in this.players) {
            this.playerReadyStates[playerId] = {
                ready: false
            }
        }

        this.results = false;
        if (!this.currentPlayerIndices.length) {
            this.currentPlayerIndices = [0, 1];
        }

        this.newGameButton.size = {x: 0, y: 0};
        this.newGameButton.text = null;
        this.clearTable();
        this.gameInProgress = true;
        const word1 = dictionary.random();
        const word2 = dictionary.random();
        const word1Node = new GameNode.Text({
            textInfo: {
                color: COLORS.HG_BLACK,
                text: word1, 
                x: 20, 
                y: 53,
                align: 'center',
                size: 1.2
            }
        });

        const word2Node = new GameNode.Text({
            textInfo: {
                color: COLORS.HG_BLACK,
                text: word2, 
                x: 80, 
                y: 53,
                align: 'center',
                size: 1.2
            }
        });

        this.base.addChild(word1Node);
        this.base.addChild(word2Node);

        for (const j in this.currentPlayerIndices) {
            const player = Object.values(this.players)[this.currentPlayerIndices[j]];

            const toggleEdit = () => {
                this.responseBoxes[player.id].editing = !this.responseBoxes[player.id].editing;
                if (this.responseBoxes[player.id].editing) {
                    this.responseBoxes[player.id].color = COLORS.WHITE;
                } else {
                    this.responseBoxes[player.id].color = COLORS.CREAM;
                }
            };

            const toggleReady = () => {
                this.playerReadyStates[player.id].ready = !this.playerReadyStates[player.id].ready;
            };

            const textValue = {
                text: '',
                x: 50,
                y: 50
            };

            const responseBoxWrapper = new GameNode.Shape({
                fill: COLORS.WHITE,
                onClick: () => toggleEdit,
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(40, 40, 20, 20),
                playerIds: [player.id]
            });

            this.responseBoxes[player.id] = new GameNode.Text({
                textInfo: {
                    color: COLORS.BLACK,
                    text: 'ayy lmao',
                    x: 50,
                    y: 50,
                    align: 'center',
                    size: 1
                }
            });
            
            const playerReadyButton = new GameNode.Shape({
                fill: COLORS.RED,
                onClick: () => {
                    toggleReady();
                    playerReadyButton.node.fill = this.playerReadyStates[player.id].ready ? COLORS.GREEN : COLORS.RED;
                },
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(40, 70, 20, 10),
                playerIds: [player.id]
            });

            this.responseBoxes[player.id].editing = true;

            this.base.addChild(playerReadyButton);

            responseBoxWrapper.addChild(this.responseBoxes[player.id]);
            this.base.addChild(responseBoxWrapper);
        }
    }

    isText(key) {
        return key.length == 1 && (key >= 'A' && key <= 'Z') || (key >= 'a' && key <= 'z') || key === ' ' || key === 'Backspace';
    }

    handleKeyDown(playerId, key) {
        if (!this.gameInProgress || !this.isText(key) || !this.responseBoxes[playerId].editing) {
            return;
        }
        const me = this;

        if (!this.keyCoolDowns[playerId] || !this.keyCoolDowns[playerId][key]) {
            const newText = this.responseBoxes[playerId].node.text;
            if (newText.text.length > 0 && key === 'Backspace') {
                newText.text = newText.text.substring(0, newText.text.length - 1); 
            } else if(key !== 'Backspace') {
                newText.text = newText.text + key;
            }
            this.responseBoxes[playerId].node.text = newText;
            this.keyCoolDowns[playerId][key] = this.setTimeout(() => {
                clearTimeout(this.keyCoolDowns[playerId][key]);
                delete this.keyCoolDowns[playerId][key];
            }, 250);
        }
    }

    handleKeyUp(playerId, key) {
        if (this.keyCoolDowns[playerId][key]) {
            clearTimeout(this.keyCoolDowns[playerId][key]);
            delete this.keyCoolDowns[playerId][key];
        }
    }

    handleNewPlayer({ playerId, info, settings }) {
        this.keyCoolDowns[playerId] = {};
        this.players[playerId] = { info, settings, id: playerId };
    }

    handlePlayerDisconnect(playerId) {
        delete this.infoNodes[playerId];
        delete this.scores[playerId];
        delete this.players[playerId];
    }

    getLayers() {
        return [{root: this.base}];
    }

    getAssets() {
        return this.assets;
    }
}

module.exports = WordMatch;