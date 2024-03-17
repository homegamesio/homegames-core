const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-1006');

class InfiniteQuestions extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            thumbnail: 'f103961541614b68c503a9ae2fd4cc47',
            squishVersion: '1006',
            tickRate: 60,
            services: ['contentGenerator']
        };
    }

    constructor({ services }) {
        super();
    
        this.playerStates = {};
        this.questionIndex = 0;
        this.contentGenerator = services['contentGenerator']
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [0, 0],
                [100, 0],
                [100, 100],
                [0, 100],
                [0, 0]
            ],
            fill: Colors.COLORS.PURPLE
        });

        this.generateButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: Colors.COLORS.PINK,
            coordinates2d: ShapeUtils.rectangle(40, 15, 20, 10),
            onClick: this.requestQuestions.bind(this)
        });

        const generateText = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 17.5,
                align: 'center',
                text: 'Generate',
                color: Colors.COLORS.BLACK,
                size: 1.6
            }
        });

        this.generateButton.addChild(generateText);

        this.playerTextBoxRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        this.base.addChild(this.playerTextBoxRoot);
        this.base.addChild(this.generateButton);

        this.layers = [
            {
                root: this.base      
            }
        ];

    }

    getLayers() {
        return this.layers;
    }

    renderContent() {
        if (!this.content && !this.error && !this.loading) {
            console.log('ayy lmao no content');
            return;
        }

        this.base.clearChildren([this.playerTextBoxRoot.node.id, this.generateButton.node.id]);

        if (this.error) {
            const textNode = new GameNode.Text({
                textInfo: {
                    text: this.error,
                    x: 50,
                    y: 50,
                    color: Colors.COLORS.WHITE,
                    size: 1,
                    align: 'center'
                }
            });

            this.base.addChild(textNode);    
        } else if (this.loading) {
            const textNode = new GameNode.Text({
                textInfo: {
                    text: `Generating conversation starters from ${Object.keys(this.playerStates).length} players...`,
                    x: 50,
                    y: 50,
                    color: Colors.COLORS.WHITE,
                    size: 1.2,
                    align: 'center'
                }
            });

            this.base.addChild(textNode);    

        } else {
            const curQuestionIndex = this.questionIndex || 0;

            const curQuestionText = this.content.questions[curQuestionIndex];

            const textNode = new GameNode.Text({
                textInfo: {
                    text: curQuestionText,
                    x: 50,
                    y: 50,
                    color: Colors.COLORS.WHITE,
                    size: 1.2,
                    align: 'center'
                }
            });

            const nextNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(80, 80, 10, 10),
                fill: Colors.COLORS.BLUE,
                onClick: () => {
                    this.questionIndex = (this.questionIndex + 1) % this.content.questions.length;
                    this.renderContent();
                }
            });

            const prevNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(10, 80, 10, 10),
                fill: Colors.COLORS.BLUE,
                onClick: () => {
                    this.questionIndex = this.questionIndex === 0 ? 5 : (this.questionIndex - 1) % this.content.questions.length;
                    this.renderContent();
                }
            });

            this.base.addChildren(textNode, prevNode, nextNode);
        }
    }

    handlePlayerDisconnect(playerId) {
        const currentTextBox = this.playerStates[playerId]?.textBox;

        if (currentTextBox) {
            this.playerTextBoxRoot.removeChild(currentTextBox.node.id);
        }

        delete this.playerStates[playerId];
    }

    handleNewPlayer({ playerId }) {

        this.playerStates[playerId] = {
            text: 'sloths'
        };

        const playerTextNode = new GameNode.Text({
            textInfo: {
                x: 12.5,
                y: 3.5,
                size: 1.4,
                align: 'left',
                color: Colors.COLORS.BLACK,
                text: this.playerStates[playerId].text
            },
            playerIds: [playerId]
        });

        const playerTextBox = new GameNode.Shape({
            shapeType: Shapes.POLYGON, 
            coordinates2d: ShapeUtils.rectangle(12.5, 2.5, 75, 10),
            playerIds: [playerId],
            fill: Colors.COLORS.WHITE,
            input: {
                type: 'text',
                oninput: (playerId, input) => {
                    if (!input) {
                        input = '';
                    }
                    this.playerStates[playerId].text = input;
                    const newText = Object.assign({}, playerTextNode.node.text);
                    newText.text = input;
                    playerTextNode.node.text = newText;
                    playerTextNode.node.onStateChange();
                }
            }
        });

        this.playerStates[playerId].textBox = playerTextBox;
        this.playerStates[playerId].textNode = playerTextNode;

        playerTextBox.addChild(playerTextNode);

        this.playerTextBoxRoot.addChild(playerTextBox);
    }

    requestQuestions() {
        if (this.lastRequest && this.lastRequest + (30 * 1000) >= Date.now()) {
            return;
        }

        this.lastRequest = Date.now();

        this.loading = true;
        this.error = null;
        this.renderContent();
        const randFillers = ['sloths', 'gelato', 'basketball'];

        const allPlayerIds = Object.keys(this.playerStates);
        allPlayerIds.sort((a, b) => Math.random() - Math.random());
        let keywords = [];
        for (let playerId in this.playerStates) {
            if (this.playerStates[playerId].text) {
                const toAdd = this.playerStates[playerId].text.trim().split(' ').map(p => p.trim());
                for (let i = 0; i < toAdd.length; i++) {
                    keywords.push(toAdd[i]);
                }
            }
        }
        if (keywords.length < 1) {
            keywords = ['sloths', 'gelato'];
        } else if (keywords.length < 2) {
            keywords.push('basketball');
        } else {
            keywords = keywords.slice(0, 2);
        }
        console.log('key words');
        console.log(keywords);
        this.contentGenerator.requestContent({
            type: 'trivia_questions',
            keywords
        }).then((contentJson) => {
            this.content = contentJson;
            this.error = null;
            this.loading = false;
            this.renderContent();
        }).catch(err => {
            this.error = err;
            this.renderContent();
            this.loading = false;
        });
    }
}

module.exports = InfiniteQuestions;
