let { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squishjs');
Colors = Colors.COLORS;
const config = require('../../config');
const Asset = require('../common/Asset');
const fs = require('fs');

class Game42 extends Game {
    static metadata() {
        return {
            res: {
                width: 1920,
                height: 1080
            },
            author: 'Joseph Garcia',
            players: 2,
            name: 'Game 42'
        };
    }

    constructor() {
        super();
        this.defaultQuestionUrl = 'https://homegamesio.s3-us-west-1.amazonaws.com/assets/test_questions_1.json';
        this.baseColor = [245, 126, 66, 255];
        this.base = new GameNode.Shape(
            this.baseColor,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                fill: this.baseColor
            }
        );

        this.excludedNodeRoot = new GameNode.Shape(
            this.baseColor,
            Shapes.POLYGON,
            {
                fill: this.baseColor,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
            }
        );
        
        this.base.addChild(this.excludedNodeRoot);
        this.activeGame = false;
        this.currentPlayerId = null;
        this.answers = {};
        this.questions = {};
    }

    initQuestions(url, data, playerId) {
        const initCounter = () => {
            if (!this.questionCounter) {
                this.questionCounter = new GameNode.Text({
                    text: `Question ${this.questionIndex + 1} of ${Object.values(this.questions[Object.keys(this.questions)[0]]).length}`, 
                    color: Colors.BLACK,
                    x: 50, 
                    y: 6, 
                    size: 2,
                    align: 'center'
                });
                this.excludedNodeRoot.addChild(this.questionCounter);
            } else {
                this.updateQuestionCounter();
            }
        }

        if (data) {
            this.questions[playerId] = JSON.parse(Buffer.from(data));
            this.questionIndex = 0;
            initCounter();
            if (this.activeGame) {
                this.newTurn();
            }
        } else {
            this.questionUrl = new Asset('url', {location: url});
            const initWords = async() => {
                const questionData = await this.questionUrl.getData();
                this.questions[1] = JSON.parse(questionData);
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
        const currentText = this.questionCounter.node.text;
        currentText.text = `Question ${this.questionIndex + 1} of ${Object.values(this.questions[Object.keys(this.questions)[0]]).length}`;
        this.questionCounter.node.text = currentText;
    }

    newTurn() {
        // hack
        let toRemove = [];
        for (let i in this.excludedNodeRoot.node.children) {
            const child = this.excludedNodeRoot.node.children[i];
            if (child.node.input) {
                toRemove.push(child.node.id);
            } 
        }
        for (let i in toRemove) {
            this.excludedNodeRoot.removeChild(toRemove[i]);
        }

        this.waitingForTransition = false;

        const player1Id = Math.min(...Object.keys(this.players).map(k => Number(k)));
        const player2Id = Math.max(...Object.keys(this.players).map(k => Number(k)));

        this.base.clearChildren([this.excludedNodeRoot.id]);
        if (!this.currentPlayerId) {
            this.currentPlayerId = player1Id;
        } else {
            this.currentPlayerId = this.currentPlayerId == player1Id ? player2Id : player1Id;
        }

        this.answers = {
            player1Id: null,
            player2Id: null 
        };

        this.nonCurrentPlayerId = this.currentPlayerId === player1Id ? player2Id : player1Id;

        const currentQuestion = this.questions[this.currentPlayerId][this.questionIndex];

        const question = new GameNode.Text({
            text: currentQuestion.question, 
            x: 50, 
            y: 22, 
            size: 1,
            color: Colors.BLACK,
            align: 'center'
        });

        const answerButton = new GameNode.Shape(
            Colors.HG_BLUE,
            Shapes.POLYGON,
            {
                fill: Colors.HG_BLUE,
                coordinates2d: ShapeUtils.rectangle(50, 50, 10, 10)
            },
            this.nonCurrentPlayerId,
            null,
            null,
            {
                type: 'text',
                oninput: (player, data) => {
                    const playerAnswerNode = new GameNode.Text({
                        text: data,
                        x: 50,
                        y: 40,
                        size: 1,
                        color: Colors.BLACK,
                        align: 'center'
                    });
                    this.base.addChild(playerAnswerNode);
                    
                    const realAnswerNode = new GameNode.Text({
                        text: currentQuestion.answer,
                        x: 50,
                        y: 70,
                        size: 1,
                        color: Colors.BLACK,
                        align: 'center'
                    });
                    this.base.addChild(realAnswerNode);

                    setTimeout(this.newTurn.bind(this), 5000);
                }
            }
        );

        this.base.addChild(answerButton);
        this.base.addChild(question);
    }

    handleNewPlayer(player) {
        const newQuestionButton = new GameNode.Shape(
            [53, 196, 91, 255],
            Shapes.POLYGON,
            {
                fill: [53, 196, 91, 255],
                coordinates2d: ShapeUtils.rectangle(40, 40, 20, 20)
            },
            player.id,
            null,
            {
                shadow: {
                    color: Colors.BLACK,
                    blur: 5
                }
            },
            {
                type: 'file',
                oninput: (player, data) => {
                    this.initQuestions(null, data, player.id)
                }
            }
        );

        const waitingNode = new GameNode.Text({
            text: 'Upload questions',
            x: 50, 
            y: 40,
            size: 2,
            align: 'center',
            color: Colors.BLACK, 
        });

        newQuestionButton.addChild(waitingNode);
 
        this.excludedNodeRoot.addChild(newQuestionButton);
    }

    tick() {
        if (Object.keys(this.questions).length == 2 && !this.activeGame) {
            this.activeGame = true;
            this.newTurn();
        } else if (!this.waiting) {
            this.waiting = true;
            const waitingNode = new GameNode.Text({
                text: 'Waiting for all players to upload questions',
                x: 50, 
                y: 25,
                size: 3,
                align: 'center',
                color: Colors.BLACK, 
            });
            this.base.addChild(waitingNode);
        } else if (this.activeGame && !this.waitingForTransition) {
            if (this.answers[1] && this.answers[2]) {
                this.waitingForTransition = true;
                this.base.clearChildren([this.excludedNodeRoot.id]);
                if (this.answers[1] == this.answers[2]) {
                    const sameAnswerNode = new GameNode.Text({
                        text: `Player ${this.nonCurrentPlayerId} got it!`, 
                        x: 50, 
                        y: 40, 
                        size: 3,
                        align: 'center',
                        color: Colors.BLACK
                    });
                    this.base.addChild(sameAnswerNode);
                    this.questionIndex++;
                    if (this.questionIndex >= Object.values(this.questions).length) {
                        this.questionIndex = 0;
                    }
                    this.updateQuestionCounter();
                    setTimeout(this.newTurn.bind(this), 2250);
                } else {
                    const notSameAnswerNode = new GameNode.Text({
                        text: `Player ${this.nonCurrentPlayerId} was wrong`,
                        x: 50, 
                        y: 40,
                        size: 3,
                        align: 'center',
                        color: Colors.BLACK,
                    });

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

module.exports = Game42;
