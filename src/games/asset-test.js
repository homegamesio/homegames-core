const { Asset, gameNode, Colors, Deck } = require('../common');

const fs = require('fs');

class AssetTest {
    static metadata() {
        return {
            res: {
                width: 1280,
                height: 720
            },
            author: "Joseph Garcia"
        };
    }

    constructor() {
        this.base = gameNode(Colors.BLUE, (player, x, y) => {
            console.log(player.id);
            console.log("sending update");
        }, {'x': 0, 'y': 0}, {'x': 100, 'y': 100}, {'text': "ayy lmao", x: 50, y: 5});
    }

    handleNewPlayer(player) {
        console.log("Game A");
        console.log(Object.values(this.players).length);
    }

    handlePlayerDisconnect(player) {
        console.log("disconnected?");
    }

    handlePlayerData(player, data) {
        const asset = new Asset("file", {type: 'image'}, data);

        this.assets = {
            'test-upload': asset
        };
        this.squisher.initialize(() => {
            for (let ting in this.players) {
                this.players[ting].receiveUpdate(this.squisher.getAssets());
            }
            const imageNode = gameNode(
                Colors.WHITE,
                (player, x, y) => {
                    console.log("clicked image???");
                },
                {x: 50, y: 50},
                {x: 20, y: 20},
                {text: '', x: 0, y: 0},
                {'test-upload': {
                    pos: {x: 50, y: 50},
                    size: {x: 20, y: 20}
                }});
                this.base.addChild(imageNode);
        });
    }

    getRoot() {
        return this.base;
    }

    getAssets() {
        return this.assets;
    }

}

module.exports = AssetTest;
