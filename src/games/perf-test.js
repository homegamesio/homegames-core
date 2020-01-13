const { gameNode, Colors } = require("../common");

class PerfTest {
    static metadata() {
        return {
            res: {
                width: 1920,
                height: 1080
            },
            author: "Joseph Garcia"
        };
    }

    constructor() {
        this.base = gameNode(Colors.WHITE, (player) => {
        }, {"x": 0, "y": 0}, {"x": 100, "y": 100});

        let xCounter = 0;
        let yCounter = 0;

        const filler = setInterval(() => {
            let dot = gameNode(Colors.randomColor(), null, {x: xCounter, y: yCounter}, {x: 1, y: 1});
            this.base.addChild(dot);
            xCounter += 1;
            if (xCounter >= 100) {
                xCounter = 0;
                yCounter++;
            }

            if (yCounter == 100 && xCounter == 100) {
                clearInterval(filler);
            }

        }, 2);
        //this.guy1 = gameNode(Colors.RED, null, {x: 30, y: 0}, {x: 10, y: 10});
        //this.guy2 = gameNode(Colors.GREEN, null, {x: 50, y: 0}, {x: 10, y: 10});
        //this.guy3 = gameNode(Colors.BLUE, null, {x: 70, y: 0}, {x: 10, y: 10});
        
        //this.base.addChild(this.guy1);
        //this.base.addChild(this.guy2);
        //this.base.addChild(this.guy3);

        //this.guy1Interval = setInterval(this.moveGuy1.bind(this), 20);
        //this.guy2Interval = setInterval(this.moveGuy2.bind(this), 40);
        //this.guy3Interval = setInterval(this.moveGuy3.bind(this), 80);
    }

    moveGuy1() {
        const newPos = this.guy1.pos;
        newPos.y = newPos.y + 1;
        this.guy1.pos = newPos;
        if (this.guy1.pos.y + this.guy1.size.y >= 100) {
            clearInterval(this.guy1Interval);
        }
    }

    moveGuy2() {
        const newPos = this.guy2.pos;
        newPos.y = newPos.y + 1;
        this.guy2.pos = newPos;
        if (this.guy2.pos.y + this.guy2.size.y >= 100) {
            clearInterval(this.guy2Interval);
        }
    }

    moveGuy3() {
        const newPos = this.guy3.pos;
        newPos.y = newPos.y + 1;
        this.guy3.pos = newPos;
        if (this.guy3.pos.y + this.guy3.size.y >= 100) {
            clearInterval(this.guy3Interval);
        }
    }

    getRoot() {
        return this.base;
    }

}

module.exports = PerfTest;