const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-136');

const SCREENS = {
    STAND: 'stand',
    SHOP: 'shop',
    RECIPE: 'recipe',
    RESULTS: 'results'
};

const STAND_DURATION_MS = 60000; // 1 minute
const CUSTOMER_SPEED = 1.2; // units per tick
const CUSTOMER_SPAWN_INTERVAL = 60; // ticks between customers (about 1 per second at 60fps)

class Lemonade extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '136',
            author: 'Assistant',
            thumbnail: 'placeholder',
            tickRate: 60,
            description: 'Lemonade Stand: classic gameplay with blocks and text.'
        };
    }

    constructor(initialState = {}) {
        super();
        this.screen = SCREENS.STAND;
        this.money = 100;
        this.price = 1;
        this.lemons = 10;
        this.sugar = 10;
        this.buyLemons = 0;
        this.buySugar = 0;
        this.recipeLemons = 1;
        this.recipeSugar = 1;
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100)
        });
        // Stand simulation state
        this.resetStandSim();
        this.render();
    }

    resetStandSim() {
        this.standSimActive = false;
        this.standSimStart = null;
        this.standSimElapsed = 0;
        this.customers = [];
        this.customerSpawnTick = 0;
        this.moneyEarned = 0;
        this.sales = 0;
        this.failedSales = 0;
        // Weather mechanic
        const weatherTypes = ['Raining', 'Cloudy', 'Sunny'];
        this.weather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
    }

    setScreen(screen) {
        this.screen = screen;
        if (screen === SCREENS.STAND) {
            this.resetStandSim();
        }
        this.render();
    }

    render() {
        this.base.clearChildren();
        if (this.screen === SCREENS.STAND) {
            this.renderStand();
        } else if (this.screen === SCREENS.SHOP) {
            this.renderShop();
        } else if (this.screen === SCREENS.RECIPE) {
            this.renderRecipe();
        } else if (this.screen === SCREENS.RESULTS) {
            this.renderResults();
        }
    }

    renderStand() {
        // Background
        const bg = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [255, 255, 200, 255]
        });
        // Stand block
        const stand = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(40, 60, 20, 20),
            fill: [255, 220, 100, 255]
        });
        // Money text
        const moneyText = new GameNode.Text({
            textInfo: {
                x: 10, y: 10, color: Colors.COLORS.BLACK, text: `$${this.money}`, align: 'left', size: 2
            }
        });
        // Weather text
        const weatherText = new GameNode.Text({
            textInfo: {
                x: 50, y: 15, color: Colors.COLORS.BLACK, text: `Weather: ${this.weather}`, align: 'center', size: 2
            }
        });
        // Profit/loss calculation
        const costPerSale = this.recipeLemons * 1 + this.recipeSugar * 2;
        const profitPerSale = this.price - costPerSale;
        let profitText = '';
        if (profitPerSale > 0) {
            profitText = `(profit: $${profitPerSale})`;
        } else if (profitPerSale < 0) {
            profitText = `(loss: $${-profitPerSale})`;
        } else {
            profitText = `(break even)`;
        }
        // Price label
        const priceLabel = new GameNode.Text({
            textInfo: {
                x: 50, y: 40, color: Colors.COLORS.BLACK, text: `Price: $${this.price} ${profitText}`, align: 'center', size: 2
            }
        });
        // Price up button
        const priceUp = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(60, 35, 6, 6),
            fill: [200,255,200,255],
            onClick: () => { this.price++; this.render(); }
        });
        const priceUpText = new GameNode.Text({
            textInfo: { x: 63, y: 38, color: Colors.COLORS.BLACK, text: '+', align: 'center', size: 2 }
        });
        // Price down button
        const priceDown = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(34, 35, 6, 6),
            fill: [200,255,200,255],
            onClick: () => { if(this.price>1){ this.price--; this.render(); } }
        });
        const priceDownText = new GameNode.Text({
            textInfo: { x: 37, y: 38, color: Colors.COLORS.BLACK, text: '-', align: 'center', size: 2 }
        });
        // Remaining sales capacity
        let maxSales = Math.min(
            Math.floor(this.lemons / this.recipeLemons),
            Math.floor(this.sugar / this.recipeSugar)
        );
        if (!isFinite(maxSales) || maxSales < 0) maxSales = 0;
        const salesCapText = new GameNode.Text({
            textInfo: {
                x: 50, y: 55, color: Colors.COLORS.BLACK, text: `Sales left today: ${maxSales}`, align: 'center', size: 2
            }
        });
        // Timer
        let timerText = null;
        if (this.standSimActive) {
            const secondsLeft = Math.max(0, Math.ceil((STAND_DURATION_MS - this.standSimElapsed) / 1000));
            timerText = new GameNode.Text({
                textInfo: {
                    x: 90, y: 10, color: Colors.COLORS.BLACK, text: `${secondsLeft}s`, align: 'right', size: 2
                }
            });
        } else {
            timerText = new GameNode.Text({
                textInfo: {
                    x: 50, y: 25, color: Colors.COLORS.BLACK, text: 'Click to start day', align: 'center', size: 2
                }
            });
            // Overlay a transparent clickable area to start
            const startBtn = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                fill: [0,0,0,0],
                onClick: () => {
                    this.standSimActive = true;
                    this.standSimStart = Date.now();
                    this.standSimElapsed = 0;
                    this.customers = [];
                    this.customerSpawnTick = 0;
                    this.moneyEarned = 0;
                    this.sales = 0;
                    this.failedSales = 0;
                    this.render();
                }
            });
            bg.addChild(startBtn);
        }
        // Customers
        for (const customer of this.customers) {
            const custBlock = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(customer.x, customer.y, 6, 6),
                fill: customer.color
            });
            bg.addChild(custBlock);
        }
        bg.addChildren(stand, moneyText, weatherText, priceLabel, priceUp, priceUpText, priceDown, priceDownText, salesCapText, timerText);
        this.base.addChild(bg);
    }

    renderResults() {
        const bg = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [220, 255, 220, 255]
        });
        const label = new GameNode.Text({
            textInfo: { x: 50, y: 25, color: Colors.COLORS.BLACK, text: 'Day Results', align: 'center', size: 3 }
        });
        const weatherText = new GameNode.Text({
            textInfo: { x: 50, y: 35, color: Colors.COLORS.BLACK, text: `Weather: ${this.weather}`, align: 'center', size: 2 }
        });
        const earned = new GameNode.Text({
            textInfo: { x: 50, y: 50, color: Colors.COLORS.BLACK, text: `Money earned: $${this.moneyEarned}`, align: 'center', size: 2 }
        });
        const sales = new GameNode.Text({
            textInfo: { x: 50, y: 60, color: Colors.COLORS.BLACK, text: `Sales: ${this.sales}`, align: 'center', size: 2 }
        });
        const failed = new GameNode.Text({
            textInfo: { x: 50, y: 70, color: Colors.COLORS.BLACK, text: `No sale: ${this.failedSales}`, align: 'center', size: 2 }
        });
        // Next button
        const nextBtn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(80, 80, 15, 10),
            fill: [150,200,255,255],
            onClick: () => this.setScreen(SCREENS.SHOP)
        });
        const nextBtnText = new GameNode.Text({
            textInfo: { x: 87.5, y: 85, color: Colors.COLORS.BLACK, text: 'Next', align: 'center', size: 2 }
        });
        bg.addChildren(label, weatherText, earned, sales, failed, nextBtn, nextBtnText);
        this.base.addChild(bg);
    }

    renderShop() {
        // Background
        const bg = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [200, 255, 255, 255]
        });
        // Money text
        const moneyText = new GameNode.Text({
            textInfo: { x: 10, y: 10, color: Colors.COLORS.BLACK, text: `$${this.money}`, align: 'left', size: 2 }
        });
        // Lemons
        const lemonsLabel = new GameNode.Text({
            textInfo: { x: 30, y: 40, color: Colors.COLORS.BLACK, text: `Lemons $1: ${this.lemons}`, align: 'center', size: 2 }
        });
        const lemonsUp = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(50, 35, 6, 6),
            fill: [255,220,220,255],
            onClick: () => { this.buyLemons++; this.render(); }
        });
        const lemonsUpText = new GameNode.Text({
            textInfo: { x: 53, y: 38, color: Colors.COLORS.BLACK, text: '+', align: 'center', size: 2 }
        });
        const lemonsDown = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(14, 35, 6, 6),
            fill: [255,220,220,255],
            onClick: () => { if(this.buyLemons>0){ this.buyLemons--; this.render(); } }
        });
        const lemonsDownText = new GameNode.Text({
            textInfo: { x: 17, y: 38, color: Colors.COLORS.BLACK, text: '-', align: 'center', size: 2 }
        });
        // Sugar
        const sugarLabel = new GameNode.Text({
            textInfo: { x: 30, y: 60, color: Colors.COLORS.BLACK, text: `Sugar $2: ${this.sugar}`, align: 'center', size: 2 }
        });
        const sugarUp = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(50, 55, 6, 6),
            fill: [220,255,220,255],
            onClick: () => { this.buySugar++; this.render(); }
        });
        const sugarUpText = new GameNode.Text({
            textInfo: { x: 53, y: 58, color: Colors.COLORS.BLACK, text: '+', align: 'center', size: 2 }
        });
        const sugarDown = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(14, 55, 6, 6),
            fill: [220,255,220,255],
            onClick: () => { if(this.buySugar>0){ this.buySugar--; this.render(); } }
        });
        const sugarDownText = new GameNode.Text({
            textInfo: { x: 17, y: 58, color: Colors.COLORS.BLACK, text: '-', align: 'center', size: 2 }
        });
        // Buy button
        const buyBtn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(70, 40, 20, 15),
            fill: [255,200,150,255],
            onClick: () => {
                const cost = this.buyLemons * 1 + this.buySugar * 2;
                if (cost <= this.money) {
                    this.money -= cost;
                    this.lemons += this.buyLemons;
                    this.sugar += this.buySugar;
                    this.buyLemons = 0;
                    this.buySugar = 0;
                    this.render();
                }
            }
        });
        const buyBtnText = new GameNode.Text({
            textInfo: { x: 80, y: 48, color: Colors.COLORS.BLACK, text: 'Buy', align: 'center', size: 2 }
        });
        // Next button
        const nextBtn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(80, 80, 15, 10),
            fill: [150,200,255,255],
            onClick: () => this.setScreen(SCREENS.RECIPE)
        });
        const nextBtnText = new GameNode.Text({
            textInfo: { x: 87.5, y: 85, color: Colors.COLORS.BLACK, text: 'Next', align: 'center', size: 2 }
        });
        bg.addChildren(
            moneyText,
            lemonsLabel, lemonsUp, lemonsUpText, lemonsDown, lemonsDownText,
            sugarLabel, sugarUp, sugarUpText, sugarDown, sugarDownText,
            buyBtn, buyBtnText, nextBtn, nextBtnText
        );
        this.base.addChild(bg);
    }

    renderRecipe() {
        // Background
        const bg = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [255, 220, 255, 255]
        });
        // Recipe label
        const recipeLabel = new GameNode.Text({
            textInfo: { x: 50, y: 20, color: Colors.COLORS.BLACK, text: 'Recipe', align: 'center', size: 3 }
        });
        // Sugar per unit
        const sugarLabel = new GameNode.Text({
            textInfo: { x: 40, y: 40, color: Colors.COLORS.BLACK, text: `Sugar: ${this.recipeSugar}/unit`, align: 'center', size: 2 }
        });
        const sugarUp = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(60, 35, 6, 6),
            fill: [220,255,255,255],
            onClick: () => { this.recipeSugar++; this.render(); }
        });
        const sugarUpText = new GameNode.Text({
            textInfo: { x: 63, y: 38, color: Colors.COLORS.BLACK, text: '+', align: 'center', size: 2 }
        });
        const sugarDown = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(24, 35, 6, 6),
            fill: [220,255,255,255],
            onClick: () => { if(this.recipeSugar>1){ this.recipeSugar--; this.render(); } }
        });
        const sugarDownText = new GameNode.Text({
            textInfo: { x: 27, y: 38, color: Colors.COLORS.BLACK, text: '-', align: 'center', size: 2 }
        });
        // Lemons per unit
        const lemonsLabel = new GameNode.Text({
            textInfo: { x: 40, y: 60, color: Colors.COLORS.BLACK, text: `Lemons: ${this.recipeLemons}/unit`, align: 'center', size: 2 }
        });
        const lemonsUp = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(60, 55, 6, 6),
            fill: [255,255,220,255],
            onClick: () => { this.recipeLemons++; this.render(); }
        });
        const lemonsUpText = new GameNode.Text({
            textInfo: { x: 63, y: 58, color: Colors.COLORS.BLACK, text: '+', align: 'center', size: 2 }
        });
        const lemonsDown = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(24, 55, 6, 6),
            fill: [255,255,220,255],
            onClick: () => { if(this.recipeLemons>1){ this.recipeLemons--; this.render(); } }
        });
        const lemonsDownText = new GameNode.Text({
            textInfo: { x: 27, y: 58, color: Colors.COLORS.BLACK, text: '-', align: 'center', size: 2 }
        });
        // Done button
        const doneBtn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(80, 80, 15, 10),
            fill: [150,200,255,255],
            onClick: () => this.setScreen(SCREENS.STAND)
        });
        const doneBtnText = new GameNode.Text({
            textInfo: { x: 87.5, y: 85, color: Colors.COLORS.BLACK, text: 'Done', align: 'center', size: 2 }
        });
        bg.addChildren(
            recipeLabel,
            sugarLabel, sugarUp, sugarUpText, sugarDown, sugarDownText,
            lemonsLabel, lemonsUp, lemonsUpText, lemonsDown, lemonsDownText,
            doneBtn, doneBtnText
        );
        this.base.addChild(bg);
    }

    handleNewPlayer({ playerId }) {
        // All players see the same state
    }

    handleKeyUp(player, key) {}

    tick() {
        if (this.screen === SCREENS.STAND && this.standSimActive) {
            // Update timer
            this.standSimElapsed = Date.now() - this.standSimStart;
            // Spawn customers
            this.customerSpawnTick++;
            if (this.customerSpawnTick >= CUSTOMER_SPAWN_INTERVAL) {
                this.customerSpawnTick = 0;
                // Spawn at left, random y in lower half
                this.customers.push({
                    x: -6,
                    y: 70 + Math.random() * 10,
                    color: [Math.floor(150+Math.random()*100),Math.floor(150+Math.random()*100),Math.floor(150+Math.random()*100),255],
                    moving: true,
                    decided: false
                });
            }
            // Move customers
            for (const customer of this.customers) {
                if (customer.moving) {
                    customer.x += CUSTOMER_SPEED;
                    // If reached stand (x >= 40), stop and decide
                    if (customer.x >= 40 && !customer.decided) {
                        customer.moving = false;
                        customer.decided = true;
                        if (Math.random() < 0.5) {
                            // Buy
                            if (this.lemons >= this.recipeLemons && this.sugar >= this.recipeSugar) {
                                this.money += this.price;
                                this.moneyEarned += this.price;
                                this.lemons -= this.recipeLemons;
                                this.sugar -= this.recipeSugar;
                                this.sales++;
                            } else {
                                this.failedSales++;
                            }
                        } else {
                            // No buy
                            this.failedSales++;
                        }
                    }
                }
            }
            // Remove customers that have stopped for a while
            this.customers = this.customers.filter(c => c.x < 60);
            // End of simulation
            if (this.standSimElapsed >= STAND_DURATION_MS) {
                this.standSimActive = false;
                // Lemons go bad at end of day
                this.lemons = 0;
                this.setScreen(SCREENS.RESULTS);
            } else {
                this.render();
            }
        }
    }
    getLayers() { return [{root: this.base}]; }
}

module.exports = Lemonade; 
