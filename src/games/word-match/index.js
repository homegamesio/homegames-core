const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-0754');
const dictionary = require('../../common/util/dictionary');

const COLORS = Colors.COLORS;

class WordMatch extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '0754',
            author: 'Joseph Garcia'
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: COLORS.CREAM,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100)
        });

        this.savedNodeRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        this.playerList = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        this.base.addChild(this.savedNodeRoot);
        this.base.addChild(this.playerList);

        this.gameInProgress = false;
        this.infoNodes = {};
        this.responseBoxes = {};
        this.playerReadyButtons = {};
        this.playerListNodes = {};
        this.keyCoolDowns = {};
        this.currentPlayerIndices = [];
        this.scores = {};
        this.players = {};
        this.update();
    }

    clearTable() {
        this.base.clearChildren([this.savedNodeRoot.id, this.playerList.id]);
    }

//    tick() {
//        const playerCount = Object.keys(this.players).length;
//        if (playerCount > 1 && !this.newGameButton && !this.gameInProgress) {
//            this.newGameButton.size = {x: 20, y: 20};
//            this.newGameButton.text = {text: 'New Game', x: 50, y: 50};
//            this.playerRequirement.text = null;
//        } else if (playerCount < 2 && !this.playerRequirement) {
//            this.gameInProgress = false;
//            // this.newGameButton = new GameNode.Shape({
//            //     shapeType: Shapes.POLYGON,
//            //     coordinates2d: ShapeUtils.rectangle(40, 40, 20, 20),
//            //     fill: COLORS.HG_GREEN
//            // });
//            console.log('wat');
//            // console.log(this.savedNodeRoot);
//            // console.log(this.newGameButton);
//            // this.savedNodeRoot.addChild(this.newGameButton);
//            //this.newGameButton.size = {x: 0, y: 0};
//            //tis.newGameButton.text = null;
//            //this.playerRequirement.text = {x: 50, y: 50, text: 'At least two players required'};
//            //this.clearTable();
//        } else if (this.gameInProgress && !this.results) {
//            const notReadyPlayers = Object.values(this.playerReadyButtons).filter(s => !s.ready);
//            if (notReadyPlayers.length < 1) {
//                this.showResults();
//            }
//        }
//    }

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
        for (const m in this.currentPlayerIndices) {
            const player = Object.values(this.players)[this.currentPlayerIndices[m]];
            if (!this.scores[player.id]) {
                this.scores[player.id] = 0;
            }
            this.scores[player.id] = this.scores[player.id] + 1; 
        }
    }

    showResults() {
        this.results = true;
        this.clearTable();
        let countdownInt = 3;
        const countdownNode = GameNode(COLORS.CREAM, null, {x: 50, y: 50}, {x: 20, y: 20}, {text: '', x: 50, y: 50});
        const votes = {};

        const interval = this.setInterval(() => {
            if (countdownInt == 0) {
                clearInterval(interval);
                this.clearTable();
                const resultOneText = Object.values(this.responseBoxes)[0].text.text;
                const resultTwoText = Object.values(this.responseBoxes)[1].text.text;
                
                const resultOne = GameNode(COLORS.WHITE, null, {x: 20, y: 30}, {x: 20, y: 20}, {text: resultOneText, x: 25, y: 35});
                const resultTwo = GameNode(COLORS.WHITE, null, {x: 60, y: 30}, {x: 20, y: 20}, {text: resultTwoText, x: 65, y: 35});
                this.base.addChild(resultOne);
                this.base.addChild(resultTwo);

                const resultsMatch = resultOneText.toLowerCase().trim() === resultTwoText.toLowerCase().trim();
                if (resultsMatch) {
                    const results = GameNode(COLORS.GREEN, null, {x: 50, y: 60}, {x: 20, y: 20}, {text: 'Same!', x: 50, y: 60});
                    this.base.addChild(results);
                    this.grantPlayerPoints();
                    this.setTimeout(this.finishRound.bind(this), 3000);
                } else {
                    const addPlayerVote = (voteType) => (player) => {
                        if (!votes[voteType]) {
                            votes[voteType] = new Set();
                        }
                        for (const key in votes) {
                            if (votes[key].has(player.id)) {
                                votes[key].delete(player.id);
                            }
                        }
                        votes[voteType].add(player.id);

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
                    const closeEnoughText = GameNode(COLORS.CREAM, null, {x: 50, y: 55}, {x: 10, y: 10}, {'text': 'Close Enough?', x: 50, y: 55});
                    const btn1 = GameNode(COLORS.BLUE, addPlayerVote('yes').bind(this), {x: 55, y: 65}, {x: 10, y: 10}, {text: 'Yes', x: 60, y: 65});
                    const btn2 = GameNode(COLORS.RED, addPlayerVote('no').bind(this), {x: 35, y: 65}, {x: 10, y: 10}, {text: 'No', x: 40, y: 65});
                    this.base.addChild(closeEnoughText);
                    this.base.addChild(btn1);
                    this.base.addChild(btn2);
                }
            } else {
                const newText = countdownNode.text;
                newText.text = '' + countdownInt--;
                countdownNode.text = newText;
            }
        }, 1000);

        this.base.addChild(countdownNode);
    }

    newGame() {
        this.playerReadyButtons = {};
        this.results = false;
        if (!this.currentPlayerIndices.length) {
            this.currentPlayerIndices = [0, 1];
        }

        // this.newGameButton.size = {x: 0, y: 0};
        // this.newGameButton.text = null;
        this.clearTable();
        this.gameInProgress = true;
        this.updatePlayerList();
        const word1 = dictionary.random();
        const word2 = dictionary.random();
        const word1Node = GameNode(COLORS.WHITE, null, 
            {x: 10, y: 45},
            {x: 20, y: 20},
            {text: word1, x: 20 , y: 53}
        );
        const word2Node = GameNode(COLORS.WHITE, null, 
            {x: 70, y: 45},
            {x: 20, y: 20},
            {text: word2, x: 80, y: 53}
        );

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
                this.playerReadyButtons[player.id].ready = !this.playerReadyButtons[player.id].ready;
                if (!this.playerReadyButtons[player.id].ready) {
                    this.playerReadyButtons[player.id].color = COLORS.RED;
                } else {
                    this.playerReadyButtons[player.id].color = COLORS.GREEN;
                }

                this.updatePlayerList();
            };

            const textValue = {
                text: '',
                x: 50,
                y: 50
            };
            this.responseBoxes[player.id] = GameNode(
                COLORS.WHITE,
                toggleEdit,
                {x: 40, y: 40},
                {x: 20, y: 20},
                textValue,
                null,
                player.id
            );
            
            this.playerReadyButtons[player.id] = GameNode(
                COLORS.RED,
                toggleReady,
                {x: 40, y: 70},
                {x: 20, y: 10},
                {text: 'Ready', x: 50, y: 73},
                null,
                player.id
            );

            this.responseBoxes[player.id].editing = true;
            this.playerReadyButtons[player.id].ready = false;

            this.base.addChild(this.playerReadyButtons[player.id]);
            this.base.addChild(this.responseBoxes[player.id]);
        }
    }

    isText(key) {
        return key.length == 1 && (key >= 'A' && key <= 'Z') || (key >= 'a' && key <= 'z') || key === ' ' || key === 'Backspace';
    }

    handleKeyDown(player, key) {
        if (!this.gameInProgress || !this.isText(key) || !this.responseBoxes[player.id].editing) {
            return;
        }

        if (!this.keyCoolDowns[player.id] || !this.keyCoolDowns[player.id][key]) {
            const newText = this.responseBoxes[player.id].text;
            if (newText.text.length > 0 && key === 'Backspace') {
                newText.text = newText.text.substring(0, newText.text.length - 1); 
            } else if(key !== 'Backspace') {
                newText.text = newText.text + key;
            }
            this.responseBoxes[player.id].text = newText;
            this.keyCoolDowns[player.id][key] = this.setTimeout(() => {
                clearTimeout(this.keyCoolDowns[player.id][key]);
                delete this.keyCoolDowns[player.id][key];
            }, 250);
        }
    }

    handleKeyUp(playerId, key) {
        if (this.keyCoolDowns[playerId][key]) {
            clearTimeout(this.keyCoolDowns[playerId][key]);
            delete this.keyCoolDowns[playerId][key];
        }
    }

    updatePlayerList() {
        this.playerList.clearChildren();
        let yIndex = 0;
        for (const playerId in this.players) {
            const player = this.players[playerId];
            const yPos = yIndex++;
            const ready = this.playerReadyButtons[playerId] && this.playerReadyButtons[playerId].ready;
            const readyStatusColor = ready ? COLORS.GREEN : Colors.RED;
            const statusColor = this.gameInProgress ? readyStatusColor : COLORS.CREAM;
            const playerNameText = player.name + ': ' + (playerId in this.scores ? this.scores[playerId] : 0);
            const playerNode = GameNode(statusColor, null, {x: 70, y: 2 + (yPos * 10)}, {x: 5, y: 5}, {x: 85, y: 2 + (yPos * 10), text: playerNameText});
            this.playerList.addChild(playerNode);
        }
    }
//        if (playerCount > 1 && !this.newGameButton && !this.gameInProgress) {
//            this.newGameButton.size = {x: 20, y: 20};
//            this.newGameButton.text = {text: 'New Game', x: 50, y: 50};
//            this.playerRequirement.text = null;
//        } else if (playerCount < 2 && !this.playerRequirement) {
//            this.gameInProgress = false;
//            // this.newGameButton = new GameNode.Shape({
//            //     shapeType: Shapes.POLYGON,
//            //     coordinates2d: ShapeUtils.rectangle(40, 40, 20, 20),
//            //     fill: COLORS.HG_GREEN
//            // });
//            console.log('wat');
//            // console.log(this.savedNodeRoot);
//            // console.log(this.newGameButton);
//            // this.savedNodeRoot.addChild(this.newGameButton);
//            //this.newGameButton.size = {x: 0, y: 0};
//            //tis.newGameButton.text = null;
//            //this.playerRequirement.text = {x: 50, y: 50, text: 'At least two players required'};
//            //this.clearTable();
//        } else if (this.gameInProgress && !this.results) {
//            const notReadyPlayers = Object.values(this.playerReadyButtons).filter(s => !s.ready);
//            if (notReadyPlayers.length < 1) {
//                this.showResults();

    handleNewPlayer({ playerId, info }) {
        this.keyCoolDowns[playerId] = {};
        
        //const infoNode = GameNode(
        //    COLORS.CREAM,
        //    toggleNameEdit,
        //    {
        //        x: 12,
        //        y: 5
        //    },
        //    {
        //        x: 5,
        //        y: 5
        //    },
        //    {
        //        text: player.name,
        //        x: 12,
        //        y: 5
        //    },
        //    null,
        //    player.id
        //);
        this.players[playerId] = { id: playerId, ...info };
        this.infoNodes[playerId] = {};//infoNode;

        this.update();
        //this.savedNodeRoot.addChild(infoNode);
        //this.updatePlayerList();
    }

    update() {
        console.log('something happened. need to look at current state and see what i need to do');
        if (!this.gameInProgress) {
            if (Object.keys(this.players).length == 2 && !this.newGameButton) {
                if (this.notEnoughPlayersText) {
                    this.base.removeChild(this.notEnoughPlayersText.id);
                }
                console.log('need to show play button');
                this.playButton = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    fill: COLORS.BLACK,
                    coordinates2d: ShapeUtils.rectangle(30, 30, 40, 40),
                    onClick: () => {
                        this.newGame();
                    }
                });

                this.base.addChild(this.playButton);
            } else if (!this.notEnoughPlayersText) {
                console.log('not enough players');

                this.notEnoughPlayersText = new GameNode.Text({
                    textInfo: {
                        x: 50,
                        y: 50,
                        align: 'center',
                        size: 3,
                        text: '2 players required',
                        color: COLORS.BLACK
                    }
                });

                this.instructionsText = new GameNode.Text({
                    textInfo: {
                        x: 50,
                        y: 95,
                        align: 'center',
                        size: 1,
                        text: 'Entsdfsdfdsfafsdfasdfasd faPLEAS REKFBSJKFGera the word you think is the "middle" of the two words shown.',
                        color: COLORS.BLACK
                    }
                });
                // this.base.addChildren(this.instructionsText);

                this.base.addChildren(this.notEnoughPlayersText, this.instructionsText);
            }
        } else {
            console.log('a game is happening');
        }
    }

    handlePlayerDisconnect(playerId) {
        this.savedNodeRoot.removeChild(this.infoNodes[playerId].id);
        delete this.players[playerId];
        delete this.infoNodes[playerId];
        delete this.scores[playerId];
        this.updatePlayerList();
        this.update();
    }

    getLayers() {
        return [{root: this.base}];
    }

    close() {

    }
}

module.exports = WordMatch;
