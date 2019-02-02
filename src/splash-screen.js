const gameNode = require('./GameNode');
const Asset = require('./Asset');
const { colors, randomColor } = require('./Colors');

class SplashScreen {
    constructor() {
        this.assets = {
            'slothboy': new Asset('url', {
                'location': 'https://i.kym-cdn.com/photos/images/newsfeed/000/437/645/a9d.jpg'
            })
        };
        
        this.base = gameNode(
            randomColor(), 
            this.handleLayerClick, 
            {
                'x': 0, 
                'y': 0
            }, 
            {
                'x': 100, 
                'y': 100
            },
            null,
            {
                'slothboy': {
                    size: {
                        x: 50,
                        y: 50
                    },
                    pos: {
                        x: 25,
                        y: 25
                    }
                }
            }
        );
    }
    
    handleImageClick() {
        console.log("IDK");
    }

    setParent(parent) {
        this.parent = parent;
    }

    getRoot() {
        return this.base;
    }

    getAssets() {
        return this.assets;
    }
}

class Demo {
    constructor() {
        this.base = gameNode(colors.WHITE, null, {'x': 0, 'y': 0}, {'x': 0, 'y': 0}, {'x': 25, 'y': 25, 'text': 'ayy lmao'}); 
        this.layerTest = new LayerTest();
        this.layerTest.setParent(this);
        this.base.addChild(this.layerTest.getRoot());
    }

    addClick() {
    }

    handleNewPlayer(player) {
    }

    handlePlayerDisconnect(player) {
    }

    getRoot() {
        return this.base;
    }
}

module.exports = SplashScreen;
