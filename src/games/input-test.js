const { Game, GameNode, Colors } = require('squishjs');
const { dictionary } = require('../common/util');
const fs = require('fs');
const Asset = require('../common/Asset');

class InputTest extends Game {
    static metadata() {
        return {
            res: {
                width: 1280,
                height: 720
            },
            author: 'Joseph Garcia',
            name: 'Input Test'
        };
    }

    constructor() {
        super();
        this.base = GameNode(Colors.CREAM, null, {'x': 0, 'y': 0}, {'x': 100, 'y': 100});
        this.textInputNode = GameNode(
            Colors.WHITE, 
            null, 
            {x: 10, y: 10}, 
            {x: 20, y: 20}, 
            {text: 'Text input', x: 20, y: 18, size: 20}, 
            null, 
            0, 
            null, {
            type: 'text',
            oninput: (thing) => {
                if (!thing) {
                    return;
                }
                const currentText = this.textInputNode.text;
                currentText.text = thing;
                this.textInputNode.text = currentText;
            }
        });

        this.fileInputNode = GameNode(
            Colors.WHITE,
            null,
            {x: 70, y: 10},
            {x: 20, y: 20},
            {text: 'File input', x: 80, y: 18, size: 20},
            null,
            0,
            null, {
                type: 'file',
                oninput: (data) => {
                    this.assets = {
                        'test': new Asset('data', {type: 'image'}, Buffer.from(data))
                    }
                    this.session.squisher.initialize().then(() => {
                        Object.values(this.players).forEach(player => {
                            player.receiveUpdate(this.session.squisher.assetBundle);
                        });
                        setTimeout(() => {
                            const newThing = GameNode(Colors.WHITE,
                                null,
                                {x: 20, y: 20},
                                {x: 0, y: 0},
                                null,
                                {'test': {
                                    pos: {
                                        x: 40,
                                        y: 40
                                    },
                                    size: {
                                        x: 30,
                                        y: 30
                                    }
                                }});
                            this.base.addChild(newThing);
                        }, 500);

                    });
                }
            }
        );

        this.base.addChild(this.textInputNode);
        this.base.addChild(this.fileInputNode);
    }

    isText(key) {
        return key.length == 1 && (key >= 'A' && key <= 'Z') || (key >= 'a' && key <= 'z') || key === ' ' || key === 'Backspace';
    }

    getRoot() {
        return this.base;
    }

//    getAssets() {
//        return this.assets;
//    }
}

module.exports = InputTest;
