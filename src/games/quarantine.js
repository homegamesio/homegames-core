const { Game, GameNode, Colors } = require('squishjs');
const config = require('../../config');
const Asset = require('../common/Asset');
const fs = require('fs');

class Quarantine extends Game {
    static metadata() {
        return {
            res: {
                width: 1920,
                height: 1080
            },
            author: 'Joseph Garcia',
            players: 2,
            name: 'Quarantine Questions'
        };
    }

    constructor() {
        super();
        this.defaultQuestionUrl = 'https://homegamesio.s3-us-west-1.amazonaws.com/assets/questions.json';
        this.baseColor = [245, 126, 66, 255];
        this.base = GameNode(this.baseColor, null, {x: 0, y: 0}, {x: 100, y: 100});
        this.playerNameRoot = GameNode(this.baseColor, null, {x: 0, y: 0}, {x: 0, y: 0});
        this.base.addChild(this.playerNameRoot);
        this.newQuestionButton = GameNode(
            [53, 196, 91, 255],
            null, 
            {x: 80, y: 3.8}, 
            {x: 15, y: 5}, 
            {text: 'Upload Custom Questions', x: 87.7, y: 5.2, size: 20}, 
            null, 
            0, 
            {shadow: {color: Colors.BLACK, blur: 5}}, 
            {
                type: 'file',
                oninput: (data) => {
                    this.initQuestions(null, data)
                }
            });

        this.playerNameRoot.addChild(this.newQuestionButton);
        this.activeGame = false;
        this.currentPlayerId = null;
        this.answers = {};
        this.questions = {};
        this.initQuestions(this.defaultQuestionUrl);
    }

    initQuestions(url, data) {
        const initCounter = () => {
            if (!this.questionCounter) {
                this.questionCounter = GameNode(
                    this.baseColor, 
                    null, 
                    {x: 5, y: 15}, 
                    {x: 10, y: 10}, 
                    {text: `Question ${this.questionIndex + 1} of ${Object.values(this.questions).length}`, x: 6, y: 15, size: 26});
                this.playerNameRoot.addChild(this.questionCounter);
            } else {
                this.updateQuestionCounter();
            }
        }

        if (data) {
            this.questions = JSON.parse(Buffer.from(data));
            this.questionIndex = 0;
            initCounter();
            if (this.activeGame) {
                this.newTurn();
            }
        } else {
            this.questionUrl = new Asset('url', {location: url});
            const initWords = async() => {
                const questionData = await this.questionUrl.getData();
                this.questions = JSON.parse(questionData);
                this.questionIndex = 0;
                initCounter();
                if (this.activeGame) {
                    this.newTurn();
                }
            };
            initWords();
        }

    }

    updateQuestionCounter() {
        const currentText = this.questionCounter.text;
        currentText.text = `Question ${this.questionIndex + 1} of ${Object.values(this.questions).length}`;
        this.questionCounter.text = currentText;
    }

    newTurn() {
        this.waitingForTransition = false;
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

        this.nonCurrentPlayerId = this.currentPlayerId === 1 ? 2 : 1;

        const nonCurrentPlayerInfoNode = GameNode(
            this.baseColor, 
            null, 
            {x: 42.5, y: 10}, 
            {x: 0, y: 0}, 
            {text: `How would player ${this.currentPlayerId} respond to:`, x: 50, y: 10, size: 36}, null, this.nonCurrentPlayerId);

        const currentQuestion = this.questions[this.questionIndex];

        const question = GameNode(
            this.baseColor, 
            null, 
            {x: 40, y: 10}, 
            {x: 0, y: 0}, 
            {text: currentQuestion.question, x: 50, y: 22, size: 50});

        const createWaitingNode = (playerId) => {
            if (this.answers[1] === null || this.answers[2] === null) {
                const waitingInfo = GameNode(this.baseColor, null,
                    {x: 50, y: 50}, {x: 0, y:0},
                    {text: 'Waiting for other player...', x: 50, y: 80, size: 30}, null, playerId);
                this.base.addChild(waitingInfo);
            }
        }
        
        const cardOnePlayerOne = GameNode(Colors.WHITE, (player, x, y) => {
            this.answers[player.id] = 1;
            cardOnePlayerOne.handleClick = null;
            cardTwoPlayerOne.handleClick = null;
            cardOnePlayerOne.effects = {
                shadow: {
                    color: Colors.GREEN,
                    blur: 12
                }
            }
            createWaitingNode(player.id);
        }, {x: 5, y: 35}, {x: 40, y: 40}, {text: currentQuestion.answerA, x: 25, y: 52, size: 36}, null, 1, {
            shadow: {
                color: Colors.BLACK,
                blur: 12
            }
        });

        const cardTwoPlayerOne = GameNode(Colors.WHITE, (player, x, y) => {
            this.answers[player.id] = 2;
            cardTwoPlayerOne.handleClick = null;
            cardOnePlayerOne.handleClick = null;
            cardTwoPlayerOne.effects = {
                shadow: {
                    color: Colors.GREEN,
                    blur: 12
                }
            }
            createWaitingNode(player.id);
        }, {x: 55, y: 35}, {x: 40, y: 40}, {text: currentQuestion.answerB, x: 75, y: 52, size: 36}, null, 1, {
            shadow: {
                color: Colors.BLACK,
                blur: 12
            }
        });

        const cardOnePlayerTwo = GameNode(Colors.WHITE, (player, x, y) => {
            this.answers[player.id] = 1;
            cardOnePlayerTwo.handleClick = null;
            cardTwoPlayerTwo.handleClick = null;
            cardOnePlayerTwo.effects = {
                shadow: {
                    color: Colors.GREEN,
                    blur: 12
                }
            }
            createWaitingNode(player.id);
        }, {x: 5, y: 35}, {x: 40, y: 40}, {text: currentQuestion.answerA, x: 25, y: 52, size: 36}, null, 2, {
            shadow: {
                color: Colors.BLACK,
                blur: 12
            }
        });

        const cardTwoPlayerTwo = GameNode(Colors.WHITE, (player, x, y) => {
            this.answers[player.id] = 2;
            cardTwoPlayerTwo.handleClick = null;
            cardOnePlayerTwo.handleClick = null;
            cardTwoPlayerTwo.effects = {
                shadow: {
                    color: Colors.GREEN,
                    blur: 12
                }
            }
            createWaitingNode(player.id);
        }, {x: 55, y: 35}, {x: 40, y: 40}, {text: currentQuestion.answerB, x: 75, y: 52, size: 36}, null, 2, {
            shadow: {
                color: Colors.BLACK,
                blur: 12
            }
        });

        this.base.addChild(nonCurrentPlayerInfoNode);
        this.base.addChild(question);
        this.base.addChild(cardOnePlayerOne);
        this.base.addChild(cardTwoPlayerOne);
        this.base.addChild(cardOnePlayerTwo);
        this.base.addChild(cardTwoPlayerTwo);
    }

    handleNewPlayer(player) {
        const playerName = `Player ${player.id}`;
        const playerNode = GameNode(
            this.baseColor, 
            null, 
            {x: 1, y: 4}, 
            {x: 8, y: 6}, 
            {text: playerName, x: 5, y: 5, size: 36}, 
            null, player.id);
        this.playerNameRoot.addChild(playerNode);
    }

    tick() {
        if (Object.keys(this.players).length == 2 && !this.activeGame) {
            this.activeGame = true;
            this.newTurn();
        } else if (Object.keys(this.players).length == 1 && !this.waiting) {
            this.waiting = true;
            const waitingNode = GameNode(
                this.baseColor, 
                null, 
                {x: 37.5, y: 38}, 
                {x: 25, y: 10}, 
                {text: 'Waiting for another player', x: 50, y: 40, size: 40});
            this.base.addChild(waitingNode);
        } else if (this.activeGame && !this.waitingForTransition) {
            if (this.answers[1] && this.answers[2]) {
                this.waitingForTransition = true;
                this.base.clearChildren([this.playerNameRoot.id]);
                if (this.answers[1] == this.answers[2]) {
                    const sameAnswerNode = GameNode(this.baseColor, null, {
                        x: 50, y: 40}, {x: 10, y: 10}, {text: `Player ${this.nonCurrentPlayerId} got it right!`, x: 50, y: 40, size: 80});
                    this.base.addChild(sameAnswerNode);
                    this.questionIndex++;
                    if (this.questionIndex >= Object.values(this.questions).length) {
                        this.questionIndex = 0;
                    }
                    this.updateQuestionCounter();
                    setTimeout(this.newTurn.bind(this), 2250);
                } else {
                    const notSameAnswerNode = GameNode(this.baseColor, null, {
                        x: 50, y: 40}, {x: 10, y: 10}, {text: `Player ${this.nonCurrentPlayerId} was wrong`, x: 50, y: 40, size: 80});
                    this.base.addChild(notSameAnswerNode);
                    this.questionIndex++;
                    if (this.questionIndex >= Object.values(this.questions).length) {
                        this.questionIndex = 0;
                    }
                    this.updateQuestionCounter();
                    setTimeout(this.newTurn.bind(this), 2250);
                }
            }
        }
    }

    getRoot() {
        return this.base;
    }
}

module.exports = Quarantine;
