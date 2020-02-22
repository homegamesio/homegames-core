const gameNode = require('../GameNode');
const Asset = require('../Asset');
const { colors } = require('../Colors');

class SplashScreen {
    constructor() {
        this.assets = {
            'splashScreen': new Asset('url', {
                'location': 'https://s3-us-west-1.amazonaws.com/homegamesio/images/splash_screen.png',
                'type': 'image'
            }),
            'logo': new Asset('url', {
                'location': 'https://s3-us-west-1.amazonaws.com/homegamesio/images/logo.png',
                'type': 'image'
            }),
            'clickSound': new Asset('url', {
                'location': 'http://www.noiseaddicts.com/samples_1w72b820/3740.mp3',
                'type': 'audio'
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

        this.soundPlayer = gameNode(
            colors.PERRYWINKLE,
            null,
            {
                'x': 0,
                'y': 0
            },
            {
                'x': 0,
                'y': 0
            }, 
            null,
            {
                'clickSound': {
                    size: {
                        x: 0,
                        y: 0
                    },
                    pos: {
                        x: 0,
                        y: 0
                    }
                }
            }
        );

        this.base.addChild(this.logo);
        this.base.addChild(this.soundPlayer);
    }

    handleLayerClick() {
        this.clickCount++;
        this.base.text = {'x': this.base.text.x, 'y': this.base.text.y, text: this.clickCount + ''}; 
    }
    
    getRoot() {
        return this.base;
    }

    getAssets() {
        return this.assets;
    }
}

module.exports = SplashScreen;
