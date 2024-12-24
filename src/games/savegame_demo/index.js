const { Game, GameNode, Colors, Shapes, ShapeUtils, GeometryUtils } = require('squish-112');
const COLORS = Colors.COLORS;

class SaveGameDemo extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '112',
            author: 'Joseph Garcia',
            thumbnail: '4d22ce79be8aef1c467271e7f27386e6',
            isTest: true
        };
    }

    constructor({ saveData, saveGame }) {
        super();

        this.canClick = true;

        const baseColor = COLORS.BEIGE;

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: baseColor
        });

        this.textBase = new GameNode.Shape({
        	shapeType: Shapes.POLYGON,
        	coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        this.button = new GameNode.Shape({
        	shapeType: Shapes.POLYGON,
        	coordinates2d: ShapeUtils.rectangle(40, 40, 20, 20),
        	fill: COLORS.RED,
        	onClick: () => {
        		if (this.canClick) {
	        		this.clickCount += 1;
	        		this.renderText();
	        		this.canClick = false;
	        	}
        	}
        });

        this.saveButton = new GameNode.Shape({
        	shapeType: Shapes.POLYGON,
        	coordinates2d: ShapeUtils.rectangle(5, 5, 5, 5),
        	fill: COLORS.PURPLE,
        	onClick: () => {
        		saveGame({
        			clickCount: this.clickCount
        		});
        	}
        })

        this.base.addChildren(this.button, this.textBase, this.saveButton);

        this.clickCount = saveData && saveData.clickCount || 0;
        this.renderText();
    }

    handleMouseUp() {
    	this.canClick = true;
    }

    renderText() {
    	const children = this.textBase.node.children;

    	this.textBase.clearChildren();

    	if (children.length > 0) {
    		for (let i = 0; i < children.length; i++) {
    			children[i].free();
    		}
    	}

        const textLabel = new GameNode.Text({
            textInfo: {
                text: '' + this.clickCount,
                x: 50,
                y: 25,
                align: 'center',
                size: 2,
                color: COLORS.BLACK
            }
        });

        this.textBase.addChild(textLabel);
    }

    getLayers() {
        return [{root: this.base}];
    }
}

module.exports = SaveGameDemo;
