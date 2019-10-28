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

    showResults() {
        this.results = true;
        this.clearTable();
        let countdownInt = 3;
        let countdownNode = gameNode(colors.CREAM, null, {x: 50, y: 50}, {x: 20, y: 20}, {text: '', x: 50, y: 50});
        let interval = setInterval(() => {
            if (countdownInt == 0) {
                clearInterval(interval);
                this.clearTable();
                let resultOneText = Object.values(this.responseBoxes)[0].text.text;
                let resultTwoText = Object.values(this.responseBoxes)[1].text.text;
                let beCool = () => {
                    console.log(this.players);
                };
                let resultOne = gameNode(colors.WHITE, null, {x: 20, y: 40}, {x: 20, y: 20}, {text: resultOneText, x: 20, y: 40});
                let resultTwo = gameNode(colors.WHITE, null, {x: 60, y: 40}, {x: 20, y: 20}, {text: resultTwoText, x: 60, y: 40});
                this.base.addChild(resultOne);
                this.base.addChild(resultTwo);

                let resultsMatch = resultOneText.toLowerCase().trim() === resultTwoText.toLowerCase().trim();
                if (resultsMatch) {
                    let results = gameNode(colors.GREEN, null, {x: 50, y: 60}, {x: 20, y: 20}, {text: 'Same!', x: 50, y: 60});
                    this.base.addChild(results);
                } else {
                    let btn1 = gameNode(colors.BLUE, null, {x: 30, y: 60}, {x: 20, y: 20}, {text: 'Be Cool', x: 30, y: 60});
                    let btn2 = gameNode(colors.RED, null, {x: 60, y: 60}, {x: 20, y: 20}, {text: 'Nah', x: 60, y: 60});
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

    whoUp() {
        let whoUp = gameNode(colors.CREAM, null, {x: 50, y: 50}, {x: 15, y: 15}, {text: 'Who up?', x: 50, y: 50});
        this.clearTable();
        this.base.addChild(whoUp);
    }

    newGame() {
        let playerCount = Object.keys(this.players).length;
        console.log(playerCount);
        if (playerCount > 2) {
            return this.whoUp();
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

                for (let playerId in this.players) {
                    const player = this.players[playerId];

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
        if (!this.isText(key) || !this.responseBoxes[player.id].editing) {
            return;
        }

        if (!this.keyCoolDowns[player.id]) {
            let newText = this.responseBoxes[player.id].text;
            if (newText.text.length > 0 && key === 'Backspace') {
                newText.text = newText.text.substring(0, newText.text.length - 1); 
            } else if(key !== 'Backspace') {
                newText.text = newText.text + key;
            }
            this.responseBoxes[player.id].text = newText;
            this.keyCoolDowns[player.id] = setTimeout(() => {
                clearTimeout(this.keyCoolDowns[player.id]);
                delete this.keyCoolDowns[player.id];
            }, 500);
        }
    }

    handleKeyUp(player, key) {
        if (this.keyCoolDowns[player.id]) {
            clearTimeout(this.keyCoolDowns[player.id]);
            delete this.keyCoolDowns[player.id];
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
            let playerNode = gameNode(statusColor, null, {x: 70, y: 2 + (yPos * 10)}, {x: 5, y: 5}, {x: 85, y: 2 + (yPos * 10), text: player.name});
            this.playerList.addChild(playerNode);
        }
    }

    handleNewPlayer(player) {
        let toggleNameEdit = () => {
            console.log('f');
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
