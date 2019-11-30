const Asset = require("../common/Asset");
const gameNode = require('../common/GameNode');
const colors = require('../common/Colors');
const dictionary = require('../common/util/dictionary');

class WordMatch {
    constructor() {
        this.base = gameNode(colors.CREAM, null, {'x': 0, 'y': 0}, {'x': 100, 'y': 100});
        this.savedNodeRoot = gameNode(colors.CREAM, null, {x: 0, y: 0}, {x: 0, y: 0});
        this.playerList = gameNode(colors.CREAM, null, {x: 0, y: 0}, {x: 0, y: 0});

        this.newGameButton = gameNode(colors.CREAM, this.newGame.bind(this), {x: 40, y: 47}, {x: 0, y: 0});
        this.playerRequirement = gameNode(colors.CREAM, null, {x: 40, y: 3}, {x: 0, y: 0}, null);

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
       let playerCount = Object.keys(this.players).length;
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
            let notReadyPlayers = Object.values(this.playerReadyButtons).filter(s => !s.ready);
            if (notReadyPlayers.length < 1) {
                this.showResults();
            }
        }
    }

    finishRound() {
        let newPlayerIndices = new Array();
        // next players
        for (let n in this.currentPlayerIndices) {
            n = Number(n);
            newPlayerIndices.push((n + 1) % Object.keys(this.players).length);
        }
        this.currentPlayerIndices = newPlayerIndices;
        this.newGame();
    }

    grantPlayerPoints() {
        for (let m in this.currentPlayerIndices) {
            let player = Object.values(this.players)[this.currentPlayerIndices[m]];
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
        let countdownNode = gameNode(colors.CREAM, null, {x: 50, y: 50}, {x: 20, y: 20}, {text: '', x: 50, y: 50});
        let votes = {};

        let interval = setInterval(() => {
            if (countdownInt == 0) {
                clearInterval(interval);
                this.clearTable();
                let resultOneText = Object.values(this.responseBoxes)[0].text.text;
                let resultTwoText = Object.values(this.responseBoxes)[1].text.text;
                
                let resultOne = gameNode(colors.WHITE, null, {x: 20, y: 30}, {x: 20, y: 20}, {text: resultOneText, x: 25, y: 35});
                let resultTwo = gameNode(colors.WHITE, null, {x: 60, y: 30}, {x: 20, y: 20}, {text: resultTwoText, x: 65, y: 35});
                this.base.addChild(resultOne);
                this.base.addChild(resultTwo);

                let resultsMatch = resultOneText.toLowerCase().trim() === resultTwoText.toLowerCase().trim();
                if (resultsMatch) {
                    let results = gameNode(colors.GREEN, null, {x: 50, y: 60}, {x: 20, y: 20}, {text: 'Same!', x: 50, y: 60});
                    this.base.addChild(results);
                    this.grantPlayerPoints();
                    setTimeout(this.finishRound.bind(this), 3000);
                } else {
                    let addPlayerVote = (voteType) => (player) => {
                        if (!votes[voteType]) {
                            votes[voteType] = new Set();
                        }
                        for (let key in votes) {
                            if (votes[key].has(player.id)) {
                                votes[key].delete(player.id);
                            }
                        }
                        votes[voteType].add(player.id);

                        let totalVotes = 0;
                        for (let key in votes) {
                            totalVotes += votes[key].size;
                        }
                        if (totalVotes == Object.keys(this.players).length) {
                            if ((votes['yes'] ? votes['yes'].size : 0) > (votes['no'] ? votes['no'].size : 0)) {
                                this.grantPlayerPoints(); 
                            } else {
                                console.log("it's a no from me dog");
                            }
                            this.finishRound();
                        }
                    };
                    let closeEnoughText = gameNode(colors.CREAM, null, {x: 50, y: 55}, {x: 10, y: 10}, {'text': 'Close Enough?', x: 50, y: 55});
                    let btn1 = gameNode(colors.BLUE, addPlayerVote('yes').bind(this), {x: 55, y: 65}, {x: 10, y: 10}, {text: 'Yes', x: 60, y: 65});
                    let btn2 = gameNode(colors.RED, addPlayerVote('no').bind(this), {x: 35, y: 65}, {x: 10, y: 10}, {text: 'No', x: 40, y: 65});
                    this.base.addChild(closeEnoughText);
                    this.base.addChild(btn1);
                    this.base.addChild(btn2);
                }
            } else {
                let newText = countdownNode.text;
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
                let word1Node = gameNode(colors.WHITE, null, 
                    {x: 10, y: 45},
                    {x: 20, y: 20},
                    {text: word1, x: 20 , y: 53}
                );
                let word2Node = gameNode(colors.WHITE, null, 
                    {x: 70, y: 45},
                    {x: 20, y: 20},
                    {text: word2, x: 80, y: 53}
                );

                this.base.addChild(word1Node);
                this.base.addChild(word2Node);

                for (let j in this.currentPlayerIndices) {
                    const player = Object.values(this.players)[this.currentPlayerIndices[j]];

                    const toggleEdit = () => {
                        this.responseBoxes[player.id].editing = !this.responseBoxes[player.id].editing;
                        if (this.responseBoxes[player.id].editing) {
                            this.responseBoxes[player.id].color = colors.WHITE;
                        } else {
                            this.responseBoxes[player.id].color = colors.CREAM;
                        }
                    };

                    const toggleReady = () => {
                        this.playerReadyButtons[player.id].ready = !this.playerReadyButtons[player.id].ready;
                        if (!this.playerReadyButtons[player.id].ready) {
                            this.playerReadyButtons[player.id].color = colors.RED;
                        } else {
                            this.playerReadyButtons[player.id].color = colors.GREEN;
                        }

                        this.updatePlayerList();
                    };

                    let textValue = {
                        text: '',
                        x: 50,
                        y: 50
                    };
                    this.responseBoxes[player.id] = gameNode(
                        colors.WHITE,
                        toggleEdit,
                        {x: 40, y: 40},
                        {x: 20, y: 20},
                        textValue,
                        null,
                        player.id
                    );
                    
                    this.playerReadyButtons[player.id] = gameNode(
                        colors.RED,
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
            let newText = this.responseBoxes[player.id].text;
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
        for (let playerId in this.players) {
            const player = this.players[playerId];
            let yPos = yIndex++;
            let ready = this.playerReadyButtons[player.id] && this.playerReadyButtons[player.id].ready;
            let readyStatusColor = ready ? colors.GREEN : colors.RED;
            let statusColor = this.gameInProgress ? readyStatusColor : colors.CREAM;
            let playerNameText = player.name + ': ' + (player.id in this.scores ? this.scores[player.id] : 0);
            let playerNode = gameNode(statusColor, null, {x: 70, y: 2 + (yPos * 10)}, {x: 5, y: 5}, {x: 85, y: 2 + (yPos * 10), text: playerNameText});
            this.playerList.addChild(playerNode);
        }
    }

    handleNewPlayer(player) {
        this.keyCoolDowns[player.id] = {};
        let toggleNameEdit = () => {
            this.players[player.id].name = 'butt';
            this.updatePlayerList();
        };
        
        let infoNode = gameNode(
            colors.CREAM,
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

    handlePlayerDisconnect(player) {
        this.savedNodeRoot.removeChild(this.infoNodes[player.id].id);
        delete this.infoNodes[player.id];
        delete this.scores[player.id];
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
