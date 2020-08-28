const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squishjs');
const dictionary = require('../common/util/dictionary');

class WordMatch extends Game {
    static metadata() {
        return {
            res: {
                width: 1280,
                height: 720
            },
            author: 'Joseph Garcia'
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape(
            Colors.CREAM, 
            Shapes.POLYGON,
            {
                fill: Colors.CREAM,
                coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100)
            }
        );

        this.savedNodeRoot = GameNode(Colors.CREAM, null, {x: 0, y: 0}, {x: 0, y: 0});
        this.playerList = GameNode(Colors.CREAM, null, {x: 0, y: 0}, {x: 0, y: 0});

        this.newGameButton = GameNode(Colors.CREAM, this.newGame.bind(this), {x: 40, y: 47}, {x: 0, y: 0});
        this.playerRequirement = GameNode(Colors.CREAM, null, {x: 40, y: 3}, {x: 0, y: 0}, null);

        this.savedNodeRoot.addChild(this.playerRequirement);
        this.savedNodeRoot.addChild(this.newGameButton);

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
    }

    clearTable() {
        this.base.clearChildren([this.savedNodeRoot.id, this.playerList.id]);
    }

    tick() {
        const playerCount = Object.keys(this.players).length;
        if (playerCount > 1 && this.newGameButton.size.x === 0 && !this.gameInProgress) {
            this.newGameButton.size = {x: 20, y: 20};
            this.newGameButton.text = {text: 'New Game', x: 50, y: 50};
            this.playerRequirement.text = null;
        } else if (playerCount < 2 && (this.newGameButton.size.x > 0 || !this.playerRequirement.text)) {
            this.gameInProgress = false;
            this.newGameButton.size = {x: 0, y: 0};
            this.newGameButton.text = null;
            this.playerRequirement.text = {x: 50, y: 50, text: 'At least two players required'};
            this.clearTable();
        } else if (this.gameInProgress && !this.results) {
            const notReadyPlayers = Object.values(this.playerReadyButtons).filter(s => !s.ready);
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
        const countdownNode = GameNode(Colors.CREAM, null, {x: 50, y: 50}, {x: 20, y: 20}, {text: '', x: 50, y: 50});
        const votes = {};

        const interval = setInterval(() => {
            if (countdownInt == 0) {
                clearInterval(interval);
                this.clearTable();
                const resultOneText = Object.values(this.responseBoxes)[0].text.text;
                const resultTwoText = Object.values(this.responseBoxes)[1].text.text;
                
                const resultOne = GameNode(Colors.WHITE, null, {x: 20, y: 30}, {x: 20, y: 20}, {text: resultOneText, x: 25, y: 35});
                const resultTwo = GameNode(Colors.WHITE, null, {x: 60, y: 30}, {x: 20, y: 20}, {text: resultTwoText, x: 65, y: 35});
                this.base.addChild(resultOne);
                this.base.addChild(resultTwo);

                const resultsMatch = resultOneText.toLowerCase().trim() === resultTwoText.toLowerCase().trim();
                if (resultsMatch) {
                    const results = GameNode(Colors.GREEN, null, {x: 50, y: 60}, {x: 20, y: 20}, {text: 'Same!', x: 50, y: 60});
                    this.base.addChild(results);
                    this.grantPlayerPoints();
                    setTimeout(this.finishRound.bind(this), 3000);
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
                    const closeEnoughText = GameNode(Colors.CREAM, null, {x: 50, y: 55}, {x: 10, y: 10}, {'text': 'Close Enough?', x: 50, y: 55});
                    const btn1 = GameNode(Colors.BLUE, addPlayerVote('yes').bind(this), {x: 55, y: 65}, {x: 10, y: 10}, {text: 'Yes', x: 60, y: 65});
                    const btn2 = GameNode(Colors.RED, addPlayerVote('no').bind(this), {x: 35, y: 65}, {x: 10, y: 10}, {text: 'No', x: 40, y: 65});
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

        this.newGameButton.size = {x: 0, y: 0};
        this.newGameButton.text = null;
        this.clearTable();
        this.gameInProgress = true;
        this.updatePlayerList();
        dictionary.random().then(word1 => {
            dictionary.random().then(word2 => {
                const word1Node = GameNode(Colors.WHITE, null, 
                    {x: 10, y: 45},
                    {x: 20, y: 20},
                    {text: word1, x: 20 , y: 53}
                );
                const word2Node = GameNode(Colors.WHITE, null, 
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
                            this.responseBoxes[player.id].color = Colors.WHITE;
                        } else {
                            this.responseBoxes[player.id].color = Colors.CREAM;
                        }
                    };

                    const toggleReady = () => {
                        this.playerReadyButtons[player.id].ready = !this.playerReadyButtons[player.id].ready;
                        if (!this.playerReadyButtons[player.id].ready) {
                            this.playerReadyButtons[player.id].color = Colors.RED;
                        } else {
                            this.playerReadyButtons[player.id].color = Colors.GREEN;
                        }

                        this.updatePlayerList();
                    };

                    const textValue = {
                        text: '',
                        x: 50,
                        y: 50
                    };
                    this.responseBoxes[player.id] = GameNode(
                        Colors.WHITE,
                        toggleEdit,
                        {x: 40, y: 40},
                        {x: 20, y: 20},
                        textValue,
                        null,
                        player.id
                    );
                    
                    this.playerReadyButtons[player.id] = GameNode(
                        Colors.RED,
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
            });
        });
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
            this.keyCoolDowns[player.id][key] = setTimeout(() => {
                clearTimeout(this.keyCoolDowns[player.id][key]);
                delete this.keyCoolDowns[player.id][key];
            }, 250);
        }
    }

    handleKeyUp(player, key) {
        if (this.keyCoolDowns[player.id][key]) {
            clearTimeout(this.keyCoolDowns[player.id][key]);
            delete this.keyCoolDowns[player.id][key];
        }
    }

    updatePlayerList() {
        this.playerList.clearChildren();
        let yIndex = 0;
        for (const playerId in this.players) {
            const player = this.players[playerId];
            const yPos = yIndex++;
            const ready = this.playerReadyButtons[player.id] && this.playerReadyButtons[player.id].ready;
            const readyStatusColor = ready ? Colors.GREEN : Colors.RED;
            const statusColor = this.gameInProgress ? readyStatusColor : Colors.CREAM;
            const playerNameText = player.name + ': ' + (player.id in this.scores ? this.scores[player.id] : 0);
            const playerNode = GameNode(statusColor, null, {x: 70, y: 2 + (yPos * 10)}, {x: 5, y: 5}, {x: 85, y: 2 + (yPos * 10), text: playerNameText});
            this.playerList.addChild(playerNode);
        }
    }

    handleNewPlayer(player) {
        this.keyCoolDowns[player.id] = {};
        const toggleNameEdit = () => {
            this.players[player.id].name = 'butt';
            this.updatePlayerList();
        };
        
        const infoNode = GameNode(
            Colors.CREAM,
            toggleNameEdit,
            {
                x: 12,
                y: 5
            },
            {
                x: 5,
                y: 5
            },
            {
                text: player.name,
                x: 12,
                y: 5
            },
            null,
            player.id
        );
        this.infoNodes[player.id] = infoNode;
        this.savedNodeRoot.addChild(infoNode);
        this.updatePlayerList();
    }

    handlePlayerDisconnect(playerId) {
        this.savedNodeRoot.removeChild(this.infoNodes[playerId].id);
        delete this.infoNodes[playerId];
        delete this.scores[playerId];
        this.updatePlayerList();
    }

    getRoot() {
        return this.base;
    }

    getAssets() {
        return this.assets;
    }
}

module.exports = WordMatch;
