const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squishjs');
const config = require('../../../config');
const Asset = require('../../common/Asset');
const fs = require('fs');

const COLORS = Colors.COLORS;

class Quarantine extends Game {
    static metadata() {
        return {
            res: {
                width: 1920,
                height: 1080
            },
            author: 'Joseph Garcia',
            players: 2,
            name: 'Quarantine Questions',
            thumbnail: 'https://d3lgoy70hwd3pc.cloudfront.net/thumbnails/quarantine-questions.png'
        };
    }

    constructor() {
        super();
        this.defaultQuestionUrl = 'https://homegamesio.s3-us-west-1.amazonaws.com/assets/questions.json';
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
        
        this.newQuestionButton = new GameNode.Shape(
            [53, 196, 91, 255],
            Shapes.POLYGON,
            {
                fill: [53, 196, 91, 255],
                coordinates2d: ShapeUtils.rectangle(80, 3.8, 15, 10)
            },
            null,
            null,
            {
                shadow: {
                    color: COLORS.BLACK,
                    blur: 5
                }
            },
            {
                type: 'file',
                oninput: (player, data) => {
                    this.initQuestions(null, data)
                }
            }
        );

        this.excludedNodeRoot.addChild(this.newQuestionButton);
        this.base.addChild(this.excludedNodeRoot);
        this.activeGame = false;
        this.currentPlayerId = null;
        this.answers = {};
        this.questions = {};
        this.initQuestions(this.defaultQuestionUrl);
    }

    initQuestions(url, data) {
        const initCounter = () => {
            if (!this.questionCounter) {
                this.questionCounter = new GameNode.Text({
                    text: `Question ${this.questionIndex + 1} of ${Object.values(this.questions).length}`, 
                    x: 50, 
                    y: 6, 
                    size: 2,
                    align: 'center',
                    color: COLORS.BLACK
                });
                this.excludedNodeRoot.addChild(this.questionCounter);
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
        } else if (url) {
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
        const currentText = this.questionCounter.node.text;
        currentText.text = `Question ${this.questionIndex + 1} of ${Object.values(this.questions).length}`;
        this.questionCounter.node.text = currentText;
    }

    newTurn() {
        this.waitingForTransition = false;
        this.base.clearChildren([this.excludedNodeRoot.id]);
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

        const nonCurrentPlayerInfoNode = new GameNode.Text({
            text: `How would player ${this.currentPlayerId} respond to:`, 
            x: 50, 
            y: 15, 
            size: 1,
            align: 'center',
            color: COLORS.BLACK
        }, this.nonCurrentPlayerId);

        const currentQuestion = this.questions[this.questionIndex];

        const question = new GameNode.Text({
            text: currentQuestion.question, 
            x: 50, 
            y: 22, 
            size: 1,
            align: 'center',
            color: COLORS.BLACK
        });

        const createWaitingNode = (playerId) => {
            if (this.answers[1] === null || this.answers[2] === null) {
                const waitingInfo = new GameNode.Text({
                    text: 'Waiting for other player...', 
                    x: 50, 
                    y: 80, 
                    size: 3,
                    align: 'center',
                    color: COLORS.BLACK
                }, playerId);
                this.base.addChild(waitingInfo);
            }
        }
        
        const cardOnePlayerOne = new GameNode.Shape(
            COLORS.WHITE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(5, 35, 40, 40),
                fill: COLORS.WHITE
            },
            1,
            (player, x, y) => {
                this.answers[player.id] = 1;
                cardOnePlayerOne.node.handleClick = null;
                cardTwoPlayerOne.node.handleClick = null;
                cardOnePlayerOne.node.effects = {
                    shadow: {
                        color: COLORS.GREEN,
                        blur: 12
                    }
                }
                createWaitingNode(player.id)
            },
            {
                shadow: {
                    color: COLORS.BLACK,
                    blur: 12
               }
            }
        );

        const cardOneP1Text = new GameNode.Text({
            text: currentQuestion.answerA,
            x: 25,
            y: 55,
            align: 'center',
            size: 1,
            color: COLORS.BLACK
        }, 1);

        cardOnePlayerOne.addChild(cardOneP1Text);

        const cardTwoPlayerOne = new GameNode.Shape(
            COLORS.WHITE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(55, 35, 40, 40),
                fill: COLORS.WHITE
            },
            1,
            (player, x, y) => {
                this.answers[player.id] = 2;
                cardOnePlayerOne.node.handleClick = null;
                cardTwoPlayerOne.node.handleClick = null;
                cardTwoPlayerOne.node.effects = {
                    shadow: {
                        color: COLORS.GREEN,
                        blur: 12
                    }
                }
                createWaitingNode(player.id)
            },
            {
                shadow: {
                    color: COLORS.BLACK,
                    blur: 12
               }
            }
        );

        const cardTwoP1Text = new GameNode.Text({
            text: currentQuestion.answerB,
            x: 75,
            y: 55,
            align: 'center',
            size: 1,
            color: COLORS.BLACK
        }, 1);

        cardTwoPlayerOne.addChild(cardTwoP1Text);
        
        const cardOnePlayerTwo = new GameNode.Shape(
            COLORS.WHITE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(5, 35, 40, 40),
                fill: COLORS.WHITE
            },
            2,
            (player, x, y) => {
                this.answers[player.id] = 1;
                cardOnePlayerTwo.node.handleClick = null;
                cardTwoPlayerTwo.node.handleClick = null;
                cardOnePlayerTwo.node.effects = {
                    shadow: {
                        color: COLORS.GREEN,
                        blur: 12
                    }
                }
                createWaitingNode(player.id)
            },
            {
                shadow: {
                    color: COLORS.BLACK,
                    blur: 12
               }
            }
        );

        const cardOneP2Text = new GameNode.Text({
            text: currentQuestion.answerA,
            x: 25,
            y: 55,
            align: 'center',
            size: 1,
            color: COLORS.BLACK
        }, 2);

        cardOnePlayerTwo.addChild(cardOneP2Text);

        const cardTwoPlayerTwo = new GameNode.Shape(
            COLORS.WHITE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(55, 35, 40, 40),
                fill: COLORS.WHITE
            },
            2,
            (player, x, y) => {
                this.answers[player.id] = 2;
                cardOnePlayerTwo.node.handleClick = null;
                cardTwoPlayerTwo.node.handleClick = null;
                cardTwoPlayerTwo.node.effects = {
                    shadow: {
                        color: COLORS.GREEN,
                        blur: 12
                    }
                }
                createWaitingNode(player.id)
            },
            {
                shadow: {
                    color: COLORS.BLACK,
                    blur: 12
               }
            }
        );

        const cardTwoP2Text = new GameNode.Text({
            text: currentQuestion.answerB,
            x: 75,
            y: 55,
            align: 'center',
            size: 1,
            color: COLORS.BLACK
        }, 2);

        cardTwoPlayerTwo.addChild(cardTwoP2Text);

        this.base.addChild(nonCurrentPlayerInfoNode);
        this.base.addChild(question);
        this.base.addChild(cardOnePlayerOne);
        this.base.addChild(cardTwoPlayerOne);
        this.base.addChild(cardOnePlayerTwo);
        this.base.addChild(cardTwoPlayerTwo);
    }

    handleNewPlayer(player) {
        const playerName = new GameNode.Text({
            text: player.name,
            x: 1,
            y: 4,
            size: 2,
            align: 'center',
            color: COLORS.BLACK
        }, player.id);

        this.excludedNodeRoot.addChild(playerName);
    }

    tick() {
        if (Object.keys(this.players).length == 2 && !this.activeGame) {
            this.activeGame = true;
            this.newTurn();
        } else if (Object.keys(this.players).length == 1 && !this.waiting) {
            this.waiting = true;
            const waitingNode = new GameNode.Text({
                text: 'Waiting for another player',
                x: 50, 
                y: 40,
                size: 4,
                align: 'center',
                color: COLORS.BLACK, 
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
                        color: COLORS.BLACK
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
                        color: COLORS.BLACK, 
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

module.exports = Quarantine;
