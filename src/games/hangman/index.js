const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-1007');

const { data: questionsBase64 } = require('./questions');// not sure if i want to do it like this

const { questions } = JSON.parse(Buffer.from(questionsBase64, 'base64').toString('utf8'));

const { WHITE, BLACK } = Colors.COLORS;

class Hangman extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 2, y: 3},
            author: 'Joseph Garcia',
            thumbnail: 'f103961541614b68c503a9ae2fd4cc47',
            squishVersion: '1007',
            tickRate: 60,
            assets: {
                'amateur': new Asset({
                    'type': 'font',
                    'id': '026a26ef0dd340681f62565eb5bf08fb'
                }),
                'heavy-amateur': new Asset({
                    'type': 'font',
                    'id': '9f11fac62df9c1559f6bd32de1382c20'
                }), 
                'hangman_0': new Asset({
                    'type': 'image',
                    'id': 'f5c92180db47539d4a92ee947b137aae'
                }),
                'hangman_1': new Asset({
                    'type': 'image',
                    'id': '6e89789a60d9cc55c490eee96b0a8bfe'
                }),
                'hangman_2': new Asset({
                    'type': 'image',
                    'id': '413d6a8e94bdb81bac8cc02debbe0c11'
                }),
                'hangman_3': new Asset({
                    'type': 'image',
                    'id': 'a816e4b84ae74df580c7b93c15e2f2ae'
                }),
                'hangman_4': new Asset({
                    'type': 'image',
                    'id': 'af52c4ad108055ec0099d9246bc04516'
                }),
                'hangman_5': new Asset({
                    'type': 'image',
                    'id': '59d08314d9184f8e3f1b54bd65b230a9'
                }),
                'strikethrough_0': new Asset({
                    'type': 'image',
                    'id': 'bf83d4c187d7f997c5a93547150482b8'
                }),
                'strikethrough_1': new Asset({
                    'type': 'image',
                    'id': '433ebba7ceea900df41e825fe6445fe5'
                }),
                'strikethrough_2': new Asset({
                    'type': 'image',
                    'id': '25fa2a38b52580789082a224a66f3ad7'
                })
            }
        };
    }

    constructor() {
        super();
        this.players = {};

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [0, 0],
                [100, 0],
                [100, 100],
                [0, 100],
                [0, 0]
            ],
            fill: WHITE
        });

        this.gameBase = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [0, 0],
                [100, 0],
                [100, 100],
                [0, 100],
                [0, 0]
            ],
        });

        this.base.addChild(this.gameBase);

        this.layers = [
            {
                root: this.base
            }
        ];
    }

    handleNewPlayer({ playerId, info, settings }) {
        this.players[playerId] = {
            correctGuesses: 0,
            incorrectGuesses: 0,
            kills: 0,
            info
        };
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
    }

    getLayers() {
        return this.layers;
    }

    waitForPlayers() {
        this.waitingForPlayers = true;
        const waitingForPlayersText = new GameNode.Text({
            textInfo: {
                x: 40,
                y: 40,
                size: 2,
                text: 'no one else is here yet.',
                color: BLACK,
                align: 'center',
                font: 'amateur'
            }
        });

        const playAgainstCpuButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(50, 60, 10, 10),
            fill: BLACK,
            onClick: (playerId) => {
                this.players['cpu'] = {};
                this.newGame();
            }
        });

        this.base.addChildren(waitingForPlayersText, playAgainstCpuButton);
    }

    newGame() {
        this.base.clearChildren([this.gameBase.node.id]);
        const playerOrder = Object.keys(this.players).sort((a, b) => Math.random() - Math.random());
        this.playerOrder = playerOrder;
        this.activeGame = true;
        this.needsNewRound = true;
    }

    renderHangmanSection() {
        const container = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(5, 5, 25, 95)
        });

        let secretPhraseText = "";

        const correctGuesses = new Set(this.currentRound.correctGuesses);
        const incorrectGuesses = new Set(this.currentRound.incorrectGuesses);
        for (let i = 0; i < this.currentRound.secretPhrase.length; i++) {
            const currentChar = this.currentRound.secretPhrase.charAt(i).toLowerCase();
            if (currentChar === ' ') {
                for (let s = 0; s < 5; s++) {
                    secretPhraseText += " ";
                }
            } else {
                if (correctGuesses.has(currentChar)) {
                    secretPhraseText += currentChar;
                } else {
                    secretPhraseText += " _ ";
                }
            }
        }

        const secretPhraseNode = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 40,
                align: 'center',
                size: 4,
                text: secretPhraseText,
                font: 'amateur',
                color: BLACK
            }
        });

        container.addChildren(secretPhraseNode);

        const key = `hangman_${this.currentRound.incorrectGuesses.length}`;

        const image = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(30, 5, 30, 25),
            assetInfo: {
                [key]: {
                    pos: {x: 30, y: 5},
                    size: {x: 30, y: 25}
                }
            }
        });

        container.addChild(image);

        return container;
    }

    renderLettersSection() {
        const container = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(5, 50, 95, 50),
        });
        
        // A is 65
        // Z is 90
        const alphabet = [];
        for (let i = 65; i <= 90; i++) {
            alphabet.push(String.fromCharCode(i).toLowerCase());
        }

        let n = 0;
        const textNodes = alphabet.map(a => {
            const xPos = 6.5 + (14.5 * (n % 7));
            const yPos = 50 + (12 * Math.floor(n / 7));

            const node = new GameNode.Text({
                textInfo: {
                    x: xPos,
                    y: yPos,
                    size: 10,
                    text: a.toUpperCase(),
                    color: BLACK,
                    align: 'center',
                    font: 'amateur'
                }
            });

            if (this.currentRound.incorrectGuesses.indexOf(a) >= 0 || this.currentRound.correctGuesses.indexOf(a) >= 0) {
                let key;
                if (this.currentRound.strikethroughs[a]) {
                    key = this.currentRound.strikethroughs[a];
                } else {
                    const rand = Math.floor(Math.random() * 3);
                    key = `strikethrough_${rand}`;
                    this.currentRound.strikethroughs[a] = key;
                }

                const strikethrough = new GameNode.Asset({
                    coordinates2d: ShapeUtils.rectangle(xPos - 6, yPos - 2, 13, 13),
                    assetInfo: {
                        [key]: {
                            pos: { x: xPos - 6, y: yPos - 2 },
                            size: { x: 13, y: 13}
                        }
                    }
                });
                node.addChild(strikethrough);
            }

            const clickWrapper = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(xPos - 5, yPos, 10, 10),
                onClick: (playerId) => {
                    this.guess(playerId, a);
                },
                onHover: (playerId) => {
                    if (!this.currentRound.strikethroughs[a] && this.currentRound.incorrectGuesses.length < 5) {
                        const textInfo = Object.assign({}, node.node.text);
                        textInfo.font = 'heavy-amateur';
                        node.node.text = textInfo;
                        this.base.node.onStateChange();
                    }
                },
                offHover: (playerId) => {
                    const textInfo = Object.assign({}, node.node.text);
                    textInfo.font = 'amateur';
                    node.node.text = textInfo;
                    this.base.node.onStateChange();
                }

            });

            node.addChild(clickWrapper);
            
            n++;

            return node;
        });

        container.addChildren(...textNodes);

        return container;
    }

    guess(playerId, guessChar) {
        if (!this.currentRound) {
            return;
        }

        const { correctGuesses, incorrectGuesses, secretPhrase } = this.currentRound;

        if (correctGuesses.indexOf(guessChar) >= 0 || incorrectGuesses.indexOf(guessChar) >= 0) {
            return;
        }

        if (secretPhrase.indexOf(guessChar) > -1) {
            correctGuesses.push(guessChar);
            this.players[playerId].correctGuesses++;
        } else {
            incorrectGuesses.push(guessChar);
            this.players[playerId].incorrectGuesses++;
            if (incorrectGuesses.length == 5) {
                this.currentRound.killer = playerId;
                this.players[playerId].kills++;
            }
        }

        this.nextTurn();
    }

    endRound() {
        this.gameBase.clearChildren();
        let count = 0;

        const playerHeader = new GameNode.Text({
            textInfo: {
                x: 18,
                y: 4,
                text: 'Player',
                font: 'heavy-amateur',
                align: 'center',
                color: BLACK,
                size: 5
            }
        });

        const scoreHeader = new GameNode.Text({
            textInfo: {
                x: 57.5,
                y: 4,
                text: 'Score',
                font: 'heavy-amateur',
                align: 'center',
                color: BLACK,
                size: 5
            }
        });

        const killsHeader = new GameNode.Text({
            textInfo: {
                x: 85,
                y: 4,
                text: 'Kills',
                font: 'heavy-amateur',
                align: 'center',
                color: BLACK,
                size: 5
            }
        });

        this.gameBase.addChildren(playerHeader, scoreHeader, killsHeader);
        const playerScoreList = Object.keys(this.players).filter(k => k !== 'cpu').map(k => {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(5, 10 + (count * 15), 90, 10)
            });

            const { incorrectGuesses, correctGuesses, info, kills } = this.players[k];

            const playerName = info.name;

            const playerNameText = new GameNode.Text({
                textInfo: {
                    x: 6,
                    y: 14 + (count * 15),
                    size: 3,
                    align: 'left',
                    font: 'amateur',
                    color: BLACK,
                    text: `${playerName}`
                }
            });

            const incorrectGuessesText = new GameNode.Text({
                textInfo: {
                    x: 50,
                    y: 14 + (count * 15),
                    size: 4,
                    align: 'center',
                    font: 'amateur',
                    color: BLACK,
                    text: `-${incorrectGuesses}`
                }
            });

            const correctGuessesText = new GameNode.Text({
                textInfo: {
                    x: 60,
                    y: 14 + (count * 15),
                    size: 4,
                    align: 'center',
                    font: 'amateur',
                    color: BLACK,
                    text: `+${correctGuesses}`
                }
            });
            
            const killsText = new GameNode.Text({
                textInfo: {
                    x: 85,
                    y: 14 + (count * 15),
                    size: 4,
                    align: 'center',
                    font: 'amateur',
                    color: BLACK,
                    text: `${kills}`
                }
            });

            node.addChildren(playerNameText, incorrectGuessesText, correctGuessesText, killsText);

            count++;
            return node;
        });

        this.base.addChildren(...playerScoreList);

        if (this.currentRound.incorrectGuesses.length >= 5) {
            // show leaderboard also
        } else {
            // show leaderboard for this session
        }
    }

    nextTurn() {
        const currentGuesserId = this.currentRound.guessers[this.currentRound.guesserIndex % (Object.keys(this.players).length - 1)]; // - 1 for cpu "player"

        if (!currentGuesserId) {
            console.log('unable to guess.');
            this.gameBase.clearChildren();
                if (!this.currentRound.round) {
                    this.currentRound.round = 1;
                } else {
                    this.currentRound.round++;
                }
            this.nextTurn();

        } else {
            if (this.currentRound.incorrectGuesses.length >= 5) {
                if (this.lettersSection) {
                    this.gameBase.removeChild(this.lettersSection.node.id);
                }

                const ripText = new GameNode.Text({
                    textInfo: {
                        font: 'heavy-amateur',
                        text: 'R.I.P',
                        size: 6,
                        color: BLACK,
                        x: 50, 
                        y: 60,
                        align: 'center'
                    }
                });
                
                if (this.currentRound.killer) {
                    const killedByName = this.players[this.currentRound.killer].info.name;
                    const killedByText = new GameNode.Text({
                        textInfo: {
                            font: 'heavy-amateur',
                            text: `killed by ${killedByName}`,
                            size: 4,
                            color: BLACK,
                            x: 50, 
                            y: 75,
                            align: 'center'
                        }
                    });

                    this.gameBase.addChild(killedByText);
                }

                this.gameBase.addChild(ripText);
                this.action = {'type': 'endRound', 'timestamp': Date.now() + 3000};
            } else {
                this.gameBase.clearChildren();
                if (!this.currentRound.round) {
                    this.currentRound.round = 1;
                } else {
                    this.currentRound.round++;
                }

                this.hangmanSection = this.renderHangmanSection();
                this.lettersSection = this.renderLettersSection();
                this.gameBase.addChildren(this.hangmanSection, this.lettersSection);
            }
        }
    }

    startRound(playerKey) {
        this.needsNewRound = false;
        this.currentRound = {
            players: Object.keys(this.players).sort((a, b) => Math.random() - Math.random()),
            guessers: Object.keys(this.players).filter(k => k !== 'cpu' && k !== playerKey).sort((a, b) => Math.random() - Math.random()),
            correctGuesses: [],
            incorrectGuesses: [],
            strikethroughs: {},
            guesserIndex: 0,
            playerIndex: 0
        };

        if (playerKey === 'cpu') {
            const randomIndex = Math.floor(Math.random() * questions.length);
            const randomPhrase = questions[randomIndex];
            this.currentRound.secretPhrase = randomPhrase.toLowerCase();
            this.nextTurn();
        } else {
            this.currentRound.secretPhrase = 'balls';
            this.nextTurn(); 
        }
    }

    tick() {
        if (this.action && this.action.timestamp < Date.now()) {
            if (this.action.type == 'endRound') {
                this.action = null;
                this.endRound();
            }
        }

        if (!this.activeGame) {
            if (!this.waitingForPlayers && Object.keys(this.players).length < 2) {
                this.waitForPlayers();
            }
        } else {
            if (this.needsNewRound) {
                const popped = this.playerOrder.pop();
                this.startRound(popped);
            }
        }
    }
}

module.exports = Hangman;