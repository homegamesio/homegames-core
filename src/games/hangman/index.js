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

        this.playerOverrideRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        this.base.addChildren(this.gameBase, this.playerOverrideRoot);

        this.layers = [
            {
                root: this.base
            }
        ];
    }

    showHangmanOptions(playerId, actionPayload) {
        const fullScreenTakeOver = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: BLACK,
            onClick: () => {

            },
            playerIds: [playerId]
        });

        this.playerOverrideRoot.addChildren(fullScreenTakeOver);
    }

    handleNewPlayer({ playerId, info, settings }) {
        if (Object.keys(this.players).filter(k => k !== 'cpu').length == 0) {
            this.players[playerId] = {
                correctGuesses: 0,
                incorrectGuesses: 0,
                kills: 0,
                info
            };
        } else {
            this.showHangmanOptions(playerId, {'type': 'addPlayer', payload: {correctGuesses: 0, incorrectGuesses: 0, kills: 0, info} });
        }
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
        this.base.clearChildren([this.gameBase.node.id, this.playerOverrideRoot.node.id]); 
        const playerOrder = Object.keys(this.players).sort((a, b) => Math.random() - Math.random());
        this.playerOrder = playerOrder;
        this.activeGame = true;
        this.nextRoundStartTime = Date.now();
    }

    renderHangmanSection(showMissingCharacters) {
        const container = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(5, 5, 25, 95)
        });

        let secretPhraseText = "";

        const correctGuesses = new Set(this.currentRound.correctGuesses);
        const incorrectGuesses = new Set(this.currentRound.incorrectGuesses);

        const secretPhraseWords = this.currentRound.secretPhrase.split(' ');
        const secretPhrasePieces = secretPhraseWords.map(w => {
            let secretPhraseText = "";
            for (let i = 0; i < w.length; i++) {
                const currentChar = w.charAt(i).toLowerCase();
                if (currentChar <= 'z' && currentChar >= 'a') {
                    if (showMissingCharacters || correctGuesses.has(currentChar)) {
                        secretPhraseText += w.charAt(i);
                    } else {
                        secretPhraseText += " _ ";
                    }
                } else {
                    secretPhraseText += currentChar;
                }
            }
            return secretPhraseText;
        });

        if (secretPhrasePieces.length < 3) {
            const secretPhraseNode = new GameNode.Text({
                textInfo: {
                    x: 50,
                    y: 40,
                    align: 'center',
                    size: 4,
                    text: secretPhrasePieces.join('     '),
                    font: 'amateur',
                    color: BLACK
                }
            });

            container.addChildren(secretPhraseNode);
        } else if (secretPhrasePieces.length < 5) {
            const secretPhraseNode1 = new GameNode.Text({
                textInfo: {
                    x: 50,
                    y: 36,
                    align: 'center',
                    size: 4,
                    text: secretPhrasePieces.slice(0, 2).join('    '),
                    font: 'amateur',
                    color: BLACK
                }
            });

            const secretPhraseNode2 = new GameNode.Text({
                textInfo: {
                    x: 50,
                    y: 42,
                    align: 'center',
                    size: 4,
                    text: secretPhrasePieces.slice(2).join('    '),
                    font: 'amateur',
                    color: BLACK
                }
            });

            container.addChildren(secretPhraseNode1, secretPhraseNode2);

        } else {
            const secretPhraseNode1 = new GameNode.Text({
                textInfo: {
                    x: 50,
                    y: 30,
                    align: 'center',
                    size: 4,
                    text: secretPhrasePieces.slice(0, 2).join('    '),
                    font: 'amateur',
                    color: BLACK
                }
            });

            const secretPhraseNode2 = new GameNode.Text({
                textInfo: {
                    x: 50,
                    y: 36,
                    align: 'center',
                    size: 4,
                    text: secretPhrasePieces.slice(2, 4).join('    '),
                    font: 'amateur',
                    color: BLACK
                }
            });

            const secretPhraseNode3 = new GameNode.Text({
                textInfo: {
                    x: 50,
                    y: 42,
                    align: 'center',
                    size: 4,
                    text: secretPhrasePieces.slice(4).join('    '),
                    font: 'amateur',
                    color: BLACK
                }
            });

            container.addChildren(secretPhraseNode1, secretPhraseNode2, secretPhraseNode3);


        }

        const key = `hangman_${this.currentRound.incorrectGuesses.length}`;

        const image = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(30, 4, 30, 25),
            assetInfo: {
                [key]: {
                    pos: {x: 30, y: 4},
                    size: {x: 30, y: 25}
                }
            }
        });

        container.addChild(image);

        const currentPlayerId = this.currentRound.player;

        const currentPlayerName = currentPlayerId === 'cpu' ? 'CPU' : this.players[currentPlayerId].info.name;

        const currentPlayerTextNode = new GameNode.Text({
            textInfo: {
                text: `${currentPlayerName}`,
                x: 50,
                y: 1,
                align: 'center',
                font: 'amateur',
                color: BLACK,
                size: 3
            }
        });

        container.addChild(currentPlayerTextNode);

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

        if (secretPhrase.toLowerCase().indexOf(guessChar) > -1) {
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
//        this.base.clearChildren([this.0gameBase.node.id, this.playerOverrideRoot.node.id]); 
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
        this.nextRoundStartTime = Date.now() + 5000;
    }

    nextTurn() { 
        let charsGuessed = {};

        for (let i = 0; i < this.currentRound.secretPhrase.length; i++) {
            const currentChar = this.currentRound.secretPhrase.charAt(i).toLowerCase();
            if (currentChar !== ' ' && currentChar <= 'z' && currentChar >= 'a') {
                charsGuessed[currentChar.toLowerCase()] = false;
            }
        }
        
        for (let i = 0; i < this.currentRound.correctGuesses.length; i++) {
           charsGuessed[this.currentRound.correctGuesses[i].toLowerCase()] = true; 
        }

        const allLettersGuessed = Object.keys(charsGuessed).filter(k => !charsGuessed[k]).length === 0;

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

            this.gameBase.removeChild(this.hangmanSection.node.id);
            this.hangmanSection = this.renderHangmanSection(true);
            this.gameBase.addChildren(ripText, this.hangmanSection);
            this.action = {'type': 'endRound', 'timestamp': Date.now() + 3000};
        } else {
            this.gameBase.clearChildren();
            if (!this.currentRound.round) {
                this.currentRound.round = 1;
            } else {
                this.currentRound.round++;
            }

            this.hangmanSection = this.renderHangmanSection();
            this.gameBase.addChildren(this.hangmanSection);
            
            if (allLettersGuessed) {
                this.action = {'type': 'endRound', 'timestamp': Date.now() + 3000};
            } else {
                this.lettersSection = this.renderLettersSection();
                this.gameBase.addChildren(this.lettersSection);
            }
        }
        
    }

    startRound(playerKey) {
        this.base.clearChildren([this.gameBase.node.id, this.playerOverrideRoot.node.id]); 
        this.nextRoundStartTime = null;

        // if cpu is the only possible guesser, force the only player to be the guesser
        let nonCpuPlayers = Object.keys(this.players).filter(k => k !== 'cpu').sort((a, b) => Math.random() - Math.random());
        let guessers = nonCpuPlayers.filter(k => k !== playerKey).sort((a, b) => Math.random() - Math.random());
        let player = playerKey;

        if (nonCpuPlayers.length == 1) {
            player = 'cpu';
            guessers = nonCpuPlayers;
        }

        this.currentRound = {
            player,// players,// Object.keys(this.players).sort((a, b) => Math.random() - Math.random()),
            guessers,
            correctGuesses: [],
            incorrectGuesses: [],
            strikethroughs: {},
            guesserIndex: 0
        };

        // handle last player dropping out (only cpu left with _my_ word)
        // player should not be able to click letters on their own word
        // players should be able to set their own hangmans

        if (player === 'cpu') {
            const randomIndex = Math.floor(Math.random() * questions.length);
            const randomPhrase = questions[randomIndex];
            this.currentRound.secretPhrase = randomPhrase;
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
            if (this.nextRoundStartTime && this.nextRoundStartTime < Date.now()) {
                if (!this.playerIndex) {
                    this.playerIndex = 0;
                }
                const nextPlayer = this.playerOrder[this.playerIndex % this.playerOrder.length];
                this.playerIndex += 1;
                this.startRound(nextPlayer);
            }
        }
    }
}

module.exports = Hangman;
