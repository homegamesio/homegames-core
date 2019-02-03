const gameNode = require('./GameNode');
const Asset = require('./Asset');
const { colors, randomColor } = require('./Colors');

class SplashScreen {
    constructor() {
        this.assets = {
            'splashScreen': new Asset('url', {
                'location': 'https://s3-us-west-1.amazonaws.com/homegamesio/images/splash_screen.png'
            }),
            'logo': new Asset('url', {
                'location': 'https://s3-us-west-1.amazonaws.com/homegamesio/images/logo.png'
            })

        };
        
        this.clickCount = 0;
        
        this.base = gameNode(
            colors.PERRYWINKLE, 
            this.handleLayerClick.bind(this), 
            {
                'x': 0, 
                'y': 0
            }, 
            {
                'x': 100, 
                'y': 100
            },
            {
                'x': 80,
                'y': 10,
                'text': this.clickCount
            },
            {
                'splashScreen': {
                    size: {
                        x: 45,
                        y: 45
                    },
                    pos: {
                        x: 25,
                        y: 20
                    }
                }
            }
        );
 
        this.logo = gameNode(
            colors.PERRYWINKLE, 
            this.handleLayerClick.bind(this), 
            {
                'x': 0, 
                'y': 0
            }, 
            {
                'x': 20, 
                'y': 20
            },
            null,
            {
                'logo': {
                    size: {
                        x: 10,
                        y: 10
                    },
                    pos: {
                        x: 1,
                        y: 1
                    }
                }
            }
        );

        this.base.addChild(this.logo);


    }

    handleLayerClick() {
        this.clickCount++;
        this.base.text = {'x': this.base.text.x, 'y': this.base.text.y, text: this.clickCount + ''}; 
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

module.exports = SplashScreen;
