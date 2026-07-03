const { Game, ViewableGame, GameNode, Colors, Shapes, ShapeUtils, ViewUtils } = require('squish-142');
const { COLORS } = require('squish-142/src/Colors');

const SCREENS = {
    STAND: 'stand',
    SHOP: 'shop',
    RECIPE: 'recipe',
    RESULTS: 'results',
    COMBAT_SHOP: 'combat_shop',
    COMBAT: 'combat',
    COMBAT_RESULTS: 'combat_results'
};

const STAND_DURATION_MS = 2000;//0; // 1 minute
const CUSTOMER_SPEED = 1.2; // units per tick
const CUSTOMER_SPAWN_INTERVAL = 60; // ticks between customers (about 1 per second at 60fps)

class Lemonade extends ViewableGame {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '142',
            author: 'Assistant',
            thumbnail: 'placeholder',
            tickRate: 60,
            description: 'Lemonade Stand: classic gameplay with blocks and text - now with viewable game support!'
        };
    }

    constructor(initialState = {}) {
        super(300); // Larger plane for viewable game
        this.screen = SCREENS.STAND;
        this.money = 100;
        this.price = 1;
        this.lemons = 10;
        this.sugar = 10;
        this.buyLemons = 0;
        this.buySugar = 0;
        this.recipeLemons = 1;
        this.recipeSugar = 1;
        this.playerViews = {};
        this.playerStates = {};
        // Combat shop state
        this.combatSwordAmmo = 0;
        this.combatRangedAmmo = 0;
        // Combat arena state
        this.combatPlayer = { x: 500, y: 500, size: 8, speed: 4 };
        this.combatView = { w: 100, h: 100 };
        this.combatArenaSize = 1000;
        this.combatStarted = false;
        // Stand simulation state
        this.resetStandSim();
        this.buildGameWorld();
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

    buildGameWorld() {
        // Clear the plane
        this.getPlane().clearChildren();
        
        // Create the main game world on the plane
        const worldBase = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 300, 300),
            fill: [240, 240, 220, 255] // Light background
        });

        // Add some decorative elements to make the world more interesting
        // Trees in the background
        for (let i = 0; i < 5; i++) {
            const tree = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(20 + i * 50, 20, 15, 30),
                fill: [100, 150, 100, 255]
            });
            worldBase.addChild(tree);
        }

        // Buildings in the distance
        for (let i = 0; i < 3; i++) {
            const building = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(200 + i * 30, 50, 20, 40),
                fill: [150, 150, 150, 255]
            });
            worldBase.addChild(building);
        }

        this.getPlane().addChild(worldBase);
    }

    setScreen(screen) {
        // Track if we're entering or leaving combat
        if (screen === SCREENS.COMBAT && !this.combatStarted) {
            // Reset player position for combat only when first entering
            this.combatPlayer = { x: 500, y: 500, size: 8, speed: 4 };
            this.combatStarted = true;
        }
        if (this.screen === SCREENS.COMBAT && screen !== SCREENS.COMBAT) {
            // Leaving combat screen
            this.combatStarted = false;
        }
        this.screen = screen;
        if (screen === SCREENS.STAND) {
            this.resetStandSim();
        }
        if (screen === SCREENS.COMBAT_SHOP) {
            // Reset ammo purchases at start of shop
            this.combatSwordAmmo = 0;
            this.combatRangedAmmo = 0;
        }
        this.updateAllPlayerViews();
    }

    updateAllPlayerViews() {
        // Update all existing player views
        Object.keys(this.playerViews).forEach(playerId => {
            this.updatePlayerView(playerId);
        });
    }

    updatePlayerView(playerId) {
        if (!this.playerViews[playerId]) return;

        const playerState = this.playerStates[playerId];
        const currentView = this.playerViews[playerId].view;
        
        // Remove old view
        if (this.playerViews[playerId].viewRoot) {
            console.log('removing old view');
            this.getViewRoot().removeChild(this.playerViews[playerId].viewRoot.node.id);
        } else {
            console.log('no old view');
        }

        // Create new view based on current screen
        let newViewRoot;
        if (this.screen === SCREENS.STAND) {
            newViewRoot = this.createStandView(playerId, currentView);
        } else if (this.screen === SCREENS.SHOP) {
            newViewRoot = this.createShopView(playerId, currentView);
        } else if (this.screen === SCREENS.RECIPE) {
            newViewRoot = this.createRecipeView(playerId, currentView);
        } else if (this.screen === SCREENS.RESULTS) {
            newViewRoot = this.createResultsView(playerId, currentView);
        } else if (this.screen === SCREENS.COMBAT_SHOP) {
            newViewRoot = this.createCombatShopView(playerId, currentView);
        } else if (this.screen === SCREENS.COMBAT) {
            newViewRoot = this.createCombatView(playerId, currentView);
        } else if (this.screen === SCREENS.COMBAT_RESULTS) {
            newViewRoot = this.createCombatResultsView(playerId, currentView);
        }

        this.playerViews[playerId].viewRoot = newViewRoot;
        this.getViewRoot().addChild(newViewRoot);
        return newViewRoot;
    }

    createStandView(playerId, view) {
        const viewRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [255, 255, 200, 255],
            // playerIds: [playerId]
        });

        // Stand block - positioned in the center of the view
        const stand = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(40, 60, 20, 20),
            fill: [255, 220, 100, 255],
            // playerIds: [playerId]
        });

        // Money text
        const moneyText = new GameNode.Text({
            textInfo: {
                x: 10, y: 10, color: Colors.COLORS.BLACK, text: `$${this.money}`, align: 'left', size: 2
            },
            // playerIds: [playerId]
        });

        // Weather text
        const weatherText = new GameNode.Text({ 
            textInfo: {
                x: 50, y: 15, color: Colors.COLORS.BLACK, text: `Weather: ${this.weather}`, align: 'center', size: 2
            },
            // playerIds: [playerId]
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
            },
            // playerIds: [playerId]
        });

        // Price up button
        const priceUp = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(60, 35, 6, 6),
            fill: [200,255,200,255],
            onClick: (clickPlayerId) => { 
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.price++; 
                    this.updatePlayerView(playerId); 
                }
            },
            // playerIds: [playerId]
        });

        const priceUpText = new GameNode.Text({
            textInfo: { x: 63, y: 38, color: Colors.COLORS.BLACK, text: '+', align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        // Price down button
        const priceDown = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(34, 35, 6, 6),
            fill: [200,255,200,255],
            onClick: (clickPlayerId) => { 
                if (Number(clickPlayerId) === Number(playerId) && this.price > 1) {
                    this.price--; 
                    this.updatePlayerView(playerId); 
                }
            },
            // playerIds: [playerId]
        });

        const priceDownText = new GameNode.Text({
            textInfo: { x: 37, y: 38, color: Colors.COLORS.BLACK, text: '-', align: 'center', size: 2 },
            // playerIds: [playerId]
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
            },
            // playerIds: [playerId]
        });

        // Timer
        let timerText = null;
        if (this.standSimActive) {
            const secondsLeft = Math.max(0, Math.ceil((STAND_DURATION_MS - this.standSimElapsed) / 1000));
            timerText = new GameNode.Text({
                textInfo: {
                    x: 90, y: 10, color: Colors.COLORS.BLACK, text: `${secondsLeft}s`, align: 'right', size: 2
                },
                // playerIds: [playerId]
            });
        } else {
            timerText = new GameNode.Text({
                textInfo: {
                    x: 50, y: 25, color: Colors.COLORS.BLACK, text: 'Click to start day', align: 'center', size: 2
                },
                // playerIds: [playerId]
            });

            // Overlay a transparent clickable area to start
            const startBtn = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                fill: [0,0,0,0],
                onClick: (clickPlayerId) => {
                    console.log('dsfjnksdf');
                    if (Number(clickPlayerId) === Number(playerId)) {
                        this.standSimActive = true;
                        this.standSimStart = Date.now();
                        this.standSimElapsed = 0;
                        this.customers = [];
                        this.customerSpawnTick = 0;
                        this.moneyEarned = 0;
                        this.sales = 0;
                        this.failedSales = 0;
                        this.updateAllPlayerViews();
                    }
                },
                // playerIds: [playerId]
            });
            viewRoot.addChild(startBtn);
        }

        // Customers
        for (const customer of this.customers) {
            const custBlock = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(customer.x, customer.y, 6, 6),
                fill: customer.color,
                // playerIds: [playerId]
            });
            viewRoot.addChild(custBlock);
        }

        // Navigation buttons
        const shopBtn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(5, 85, 15, 10),
            fill: [150,200,255,255],
            onClick: (clickPlayerId) => {
                // console.log('sdfkusdhfdskf')
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.setScreen(SCREENS.SHOP);
                }
            },
            // playerIds: [playerId]
        });

        const shopBtnText = new GameNode.Text({
            textInfo: { x: 12.5, y: 90, color: Colors.COLORS.BLACK, text: 'Shop', align: 'center', size: 1.5 },
            // playerIds: [playerId]
        });

        const recipeBtn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(80, 85, 15, 10),
            fill: [255,200,150,255],
            onClick: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.setScreen(SCREENS.RECIPE);
                }
            },
            //  playerIds: [playerId]
        });

        const recipeBtnText = new GameNode.Text({
            textInfo: { x: 87.5, y: 90, color: Colors.COLORS.BLACK, text: 'Recipe', align: 'center', size: 1.5 },
            // playerIds: [playerId]
        });

        viewRoot.addChildren(
            stand, moneyText, weatherText, priceLabel, 
            priceUp, priceUpText, priceDown, priceDownText, 
            salesCapText, timerText, shopBtn, shopBtnText, 
            recipeBtn, recipeBtnText
        );

        return viewRoot;
    }

    createShopView(playerId, view) {
        const viewRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [200, 255, 255, 255],
            // playerIds: [playerId]
        });

        // Money text
        const moneyText = new GameNode.Text({
            textInfo: { x: 10, y: 10, color: Colors.COLORS.BLACK, text: `$${this.money}`, align: 'left', size: 2 },
            // playerIds: [playerId]
        });

        // Lemons
        const lemonsLabel = new GameNode.Text({
            textInfo: { x: 30, y: 40, color: Colors.COLORS.BLACK, text: `Lemons $1: ${this.lemons}`, align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        // Buy amount display
        const buyLemonsLabel = new GameNode.Text({
            textInfo: { x: 30, y: 50, color: Colors.COLORS.BLACK, text: `Buy: ${this.buyLemons}`, align: 'center', size: 1.5 },
            // playerIds: [playerId]
        });

        const lemonsUp = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(50, 35, 6, 6),
            fill: [255,220,220,255],
            onClick: () => { 
                console.log('Lemons up clicked!');
                this.buyLemons++; 
                this.updatePlayerView(playerId); 
            }
        });

        const lemonsUpText = new GameNode.Text({
            textInfo: { x: 53, y: 38, color: Colors.COLORS.BLACK, text: '+', align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        const lemonsDown = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(14, 35, 6, 6),
            fill: [255,220,220,255],
            onClick: () => { 
                console.log('what the hell');
                if (this.buyLemons > 0) {
                    this.buyLemons--; 
                    this.updatePlayerView(playerId); 
                }
            }
        });

        const lemonsDownText = new GameNode.Text({
            textInfo: { x: 17, y: 38, color: Colors.COLORS.BLACK, text: '-', align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        // Sugar
        const sugarLabel = new GameNode.Text({
            textInfo: { x: 30, y: 70, color: Colors.COLORS.BLACK, text: `Sugar $2: ${this.sugar}`, align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        // Buy amount display
        const buySugarLabel = new GameNode.Text({
            textInfo: { x: 30, y: 80, color: Colors.COLORS.BLACK, text: `Buy: ${this.buySugar}`, align: 'center', size: 1.5 },
            // playerIds: [playerId]
        });

        const sugarUp = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(50, 65, 6, 6),
            fill: [220,255,220,255],
            onClick: () => { 
                this.buySugar++; 
                this.updatePlayerView(playerId); 
            }
        });

        const sugarUpText = new GameNode.Text({
            textInfo: { x: 53, y: 68, color: Colors.COLORS.BLACK, text: '+', align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        const sugarDown = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(14, 65, 6, 6),
            fill: [220,255,220,255],
            onClick: () => { 
                if (this.buySugar > 0) {
                    this.buySugar--; 
                    this.updatePlayerView(playerId); 
                }
            }
        });

        const sugarDownText = new GameNode.Text({
            textInfo: { x: 17, y: 68, color: Colors.COLORS.BLACK, text: '-', align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        // Buy button
        const buyBtn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(70, 40, 20, 15),
            fill: [255,200,150,255],
            onClick: () => {
                console.log('Buy button clicked!');
                const cost = this.buyLemons * 1 + this.buySugar * 2;
                if (cost <= this.money) {
                    this.money -= cost;
                    this.lemons += this.buyLemons;
                    this.sugar += this.buySugar;
                    this.buyLemons = 0;
                    this.buySugar = 0;
                    this.updateAllPlayerViews();
                }
            }
        });

        const buyBtnText = new GameNode.Text({
            textInfo: { x: 80, y: 48, color: Colors.COLORS.BLACK, text: 'Buy', align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        // Back button
        const backBtn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(80, 80, 15, 10),
            fill: [150,200,255,255],
            onClick: () => {
                this.setScreen(SCREENS.STAND);
            }
        });

        const backBtnText = new GameNode.Text({
            textInfo: { x: 87.5, y: 85, color: Colors.COLORS.BLACK, text: 'Back', align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        // Add all elements to the view root
        viewRoot.addChild(moneyText);
        viewRoot.addChild(lemonsLabel);
        viewRoot.addChild(buyLemonsLabel);
        viewRoot.addChild(lemonsUp);
        viewRoot.addChild(lemonsUpText);
        viewRoot.addChild(lemonsDown);
        viewRoot.addChild(lemonsDownText);
        viewRoot.addChild(sugarLabel);
        viewRoot.addChild(buySugarLabel);
        viewRoot.addChild(sugarUp);
        viewRoot.addChild(sugarUpText);
        viewRoot.addChild(sugarDown);
        viewRoot.addChild(sugarDownText);
        viewRoot.addChild(buyBtn);
        viewRoot.addChild(buyBtnText);
        viewRoot.addChild(backBtn);
        viewRoot.addChild(backBtnText);

        return viewRoot;
    }

    createRecipeView(playerId, view) {
        console.log('reeoeoc' + playerId);
        const viewRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [255, 220, 255, 255],
            // playerIds: [playerId]
        });

        // Recipe label
        const recipeLabel = new GameNode.Text({
            textInfo: { x: 50, y: 20, color: Colors.COLORS.BLACK, text: 'Recipe', align: 'center', size: 3 },
            // playerIds: [playerId]
        });

        // Sugar per unit
        const sugarLabel = new GameNode.Text({
            textInfo: { x: 40, y: 40, color: Colors.COLORS.BLACK, text: `Sugar: ${this.recipeSugar}/unit`, align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        const sugarUp = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(60, 35, 6, 6),
            fill: [220,255,255,255],
            onClick: (clickPlayerId) => { 
                console.log('clickPlayerId' + clickPlayerId + ", " + playerId);
                console.log(clickPlayerId === playerId);
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.recipeSugar++; 
                    this.updatePlayerView(playerId); 
                }
            },
            // playerIds: [playerId]
        });

        const sugarUpText = new GameNode.Text({
            textInfo: { x: 63, y: 38, color: Colors.COLORS.BLACK, text: '+', align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        const sugarDown = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(24, 35, 6, 6),
            fill: [220,255,255,255],
            onClick: (clickPlayerId) => { 
                if (Number(clickPlayerId) === Number(playerId) && this.recipeSugar > 1) {
                    this.recipeSugar--; 
                    this.updatePlayerView(playerId); 
                }
            },
            // playerIds: [playerId]
        });

        const sugarDownText = new GameNode.Text({
            textInfo: { x: 27, y: 38, color: Colors.COLORS.BLACK, text: '-', align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        // Lemons per unit
        const lemonsLabel = new GameNode.Text({
            textInfo: { x: 40, y: 60, color: Colors.COLORS.BLACK, text: `Lemons: ${this.recipeLemons}/unit`, align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        const lemonsUp = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(60, 55, 6, 6),
            fill: [255,255,220,255],
            onClick: (clickPlayerId) => { 
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.recipeLemons++; 
                    this.updatePlayerView(playerId); 
                }
            },
            // playerIds: [playerId]
        });

        const lemonsUpText = new GameNode.Text({
            textInfo: { x: 63, y: 58, color: Colors.COLORS.BLACK, text: '+', align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        const lemonsDown = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(24, 55, 6, 6),
            fill: [255,255,220,255],
            onClick: (clickPlayerId) => { 
                if (Number(clickPlayerId) === Number(playerId) && this.recipeLemons > 1) {
                    this.recipeLemons--; 
                    this.updatePlayerView(playerId); 
                }
            },
            // playerIds: [playerId]
        });

        const lemonsDownText = new GameNode.Text({
            textInfo: { x: 27, y: 58, color: Colors.COLORS.BLACK, text: '-', align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        // Done button
        const doneBtn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(80, 80, 15, 10),
            fill: [150,200,255,255],
            onClick: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.setScreen(SCREENS.STAND);
                }
            },
            // playerIds: [playerId]
        });

        const doneBtnText = new GameNode.Text({
            textInfo: { x: 87.5, y: 85, color: Colors.COLORS.BLACK, text: 'Done', align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        viewRoot.addChildren(
            recipeLabel,
            sugarLabel, sugarUp, sugarUpText, sugarDown, sugarDownText,
            lemonsLabel, lemonsUp, lemonsUpText, lemonsDown, lemonsDownText,
            doneBtn, doneBtnText
        );

        return viewRoot;
    }

    createResultsView(playerId, view) {
        const viewRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [220, 255, 220, 255],
            // playerIds: [playerId]
        });

        const label = new GameNode.Text({
            textInfo: { x: 50, y: 25, color: Colors.COLORS.BLACK, text: 'Day Results', align: 'center', size: 3 },
            // playerIds: [playerId]
        });

        const weatherText = new GameNode.Text({
            textInfo: { x: 50, y: 35, color: Colors.COLORS.BLACK, text: `Weather: ${this.weather}`, align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        const earned = new GameNode.Text({
            textInfo: { x: 50, y: 50, color: Colors.COLORS.BLACK, text: `Money earned: $${this.moneyEarned}`, align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        const sales = new GameNode.Text({
            textInfo: { x: 50, y: 60, color: Colors.COLORS.BLACK, text: `Sales: ${this.sales}`, align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        const failed = new GameNode.Text({
            textInfo: { x: 50, y: 70, color: Colors.COLORS.BLACK, text: `No sale: ${this.failedSales}`, align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        // Next button
        const nextBtn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(80, 80, 15, 10),
            fill: [150,200,255,255],
            onClick: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.setScreen(SCREENS.COMBAT_SHOP);
                }
            },
            // playerIds: [playerId]
        });

        const nextBtnText = new GameNode.Text({
            textInfo: { x: 87.5, y: 85, color: Colors.COLORS.BLACK, text: 'Next', align: 'center', size: 2 },
            // playerIds: [playerId]
        });

        viewRoot.addChildren(label, weatherText, earned, sales, failed, nextBtn, nextBtnText);
        return viewRoot;
    }

    createCombatShopView(playerId, view) {
        const viewRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [220, 220, 255, 255],
        });
        // Money display
        const moneyText = new GameNode.Text({
            textInfo: { x: 10, y: 10, color: Colors.COLORS.BLACK, text: `$${this.money}`, align: 'left', size: 2 }
        });
        // Sword ammo
        const swordLabel = new GameNode.Text({
            textInfo: { x: 30, y: 30, color: Colors.COLORS.BLACK, text: `Sword: $5`, align: 'center', size: 2 }
        });
        const swordCount = new GameNode.Text({
            textInfo: { x: 30, y: 40, color: Colors.COLORS.BLACK, text: `Buy: ${this.combatSwordAmmo}`, align: 'center', size: 1.5 }
        });
        const swordUp = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(50, 25, 6, 6),
            fill: [200,255,200,255],
            onClick: () => {
                if (this.money >= 5) {
                    this.combatSwordAmmo++;
                    this.money -= 5;
                    this.updatePlayerView(playerId);
                }
            }
        });
        const swordUpText = new GameNode.Text({
            textInfo: { x: 53, y: 28, color: Colors.COLORS.BLACK, text: '+', align: 'center', size: 2 }
        });
        const swordDown = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(14, 25, 6, 6),
            fill: [200,255,200,255],
            onClick: () => {
                if (this.combatSwordAmmo > 0) {
                    this.combatSwordAmmo--;
                    this.money += 5;
                    this.updatePlayerView(playerId);
                }
            }
        });
        const swordDownText = new GameNode.Text({
            textInfo: { x: 17, y: 28, color: Colors.COLORS.BLACK, text: '-', align: 'center', size: 2 }
        });
        // Ranged ammo
        const rangedLabel = new GameNode.Text({
            textInfo: { x: 30, y: 60, color: Colors.COLORS.BLACK, text: `Ranged: $10`, align: 'center', size: 2 }
        });
        const rangedCount = new GameNode.Text({
            textInfo: { x: 30, y: 70, color: Colors.COLORS.BLACK, text: `Buy: ${this.combatRangedAmmo}`, align: 'center', size: 1.5 }
        });
        const rangedUp = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(50, 55, 6, 6),
            fill: [255,220,220,255],
            onClick: () => {
                if (this.money >= 10) {
                    this.combatRangedAmmo++;
                    this.money -= 10;
                    this.updatePlayerView(playerId);
                }
            }
        });
        const rangedUpText = new GameNode.Text({
            textInfo: { x: 53, y: 58, color: Colors.COLORS.BLACK, text: '+', align: 'center', size: 2 }
        });
        const rangedDown = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(14, 55, 6, 6),
            fill: [255,220,220,255],
            onClick: () => {
                if (this.combatRangedAmmo > 0) {
                    this.combatRangedAmmo--;
                    this.money += 10;
                    this.updatePlayerView(playerId);
                }
            }
        });
        const rangedDownText = new GameNode.Text({
            textInfo: { x: 17, y: 58, color: Colors.COLORS.BLACK, text: '-', align: 'center', size: 2 }
        });
        // Next button
        const nextBtn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(80, 80, 15, 10),
            fill: [150,200,255,255],
            onClick: () => {
                this.setScreen(SCREENS.COMBAT);
            }
        });
        const nextBtnText = new GameNode.Text({
            textInfo: { x: 87.5, y: 85, color: Colors.COLORS.BLACK, text: 'Next', align: 'center', size: 2 }
        });
        viewRoot.addChild(moneyText);
        viewRoot.addChild(swordLabel);
        viewRoot.addChild(swordCount);
        viewRoot.addChild(swordUp);
        viewRoot.addChild(swordUpText);
        viewRoot.addChild(swordDown);
        viewRoot.addChild(swordDownText);
        viewRoot.addChild(rangedLabel);
        viewRoot.addChild(rangedCount);
        viewRoot.addChild(rangedUp);
        viewRoot.addChild(rangedUpText);
        viewRoot.addChild(rangedDown);
        viewRoot.addChild(rangedDownText);
        viewRoot.addChild(nextBtn);
        viewRoot.addChild(nextBtnText);
        return viewRoot;
    }

    createCombatView(playerId, view) {
        console.log('createCombatView called');
        console.log('combatPlayer object in view', this.combatPlayer, 'at', this.combatPlayer.x, this.combatPlayer.y);
        // Basic combat arena: player movement and camera scrolling
        const arenaSize = this.combatArenaSize;
        const player = this.combatPlayer;
        const viewW = this.combatView.w;
        const viewH = this.combatView.h;
        // Center view on player, clamp to arena bounds
        let viewX = Math.max(0, Math.min(player.x - viewW/2, arenaSize - viewW));
        let viewY = Math.max(0, Math.min(player.y - viewH/2, arenaSize - viewH));
        // Arena background
        const viewRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [255, 220, 220, 255],
        });
        // Debug: Text at center
        const debugText = new GameNode.Text({
            textInfo: { x: 50, y: 50, color: Colors.COLORS.BLACK, text: 'DEBUG CENTER', align: 'center', size: 3 },
            playerIds: [playerId]
        });
        viewRoot.addChild(debugText);
        // Draw player (scaled to view size)
        const px = ((player.x - viewX) / viewW) * 100;
        const py = ((player.y - viewY) / viewH) * 100;
        const playerSize = (player.size / viewW) * 100;
        const playerNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(px - playerSize/2, py - playerSize/2, playerSize, playerSize),
            fill: [0, 0, 255, 255],
            playerIds: [playerId]
        });
        viewRoot.addChild(playerNode);
        console.log("pxxx  + " + player.x + "," + player.y)
        // Add player (x, y) text above the player
        const playerText = new GameNode.Text({
            textInfo: {
                x: px,
                y: py - playerSize/2 - 4, // 4 units above the player
                color: Colors.COLORS.BLACK,
                text: `(${Math.round(player.x)},${Math.round(player.y)})`,
                align: 'center',
                size: 1.5
            },
            playerIds: [playerId]
        });
        viewRoot.addChild(playerText);
        // Arena border (for visual reference)
        const border = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [0,0,0,0],
            border: { color: [0,0,0,255], width: 2 },
            playerIds: [playerId]
        });
        viewRoot.addChild(border);
        // Show debug info
        const info = new GameNode.Text({
            textInfo: { x: 50, y: 10, color: Colors.COLORS.BLACK, text: `Player: (${Math.round(player.x)},${Math.round(player.y)}) px=${Math.round(px)} py=${Math.round(py)} size=${Math.round(playerSize)}`, align: 'center', size: 1.5 },
            playerIds: [playerId]
        });
        viewRoot.addChild(info);
        return viewRoot;
    }

    createCombatResultsView(playerId, view) {
        // TODO: Implement combat results summary
        const viewRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [220, 255, 255, 255],
        });
        const label = new GameNode.Text({
            textInfo: { x: 50, y: 50, color: Colors.COLORS.BLACK, text: 'Combat Results (stub)', align: 'center', size: 3 }
        });
        viewRoot.addChild(label);
        return viewRoot;
    }

    handleNewPlayer({ playerId }) {
        // Initialize player state
        this.playerStates[playerId] = {
            view: { x: 0, y: 0, w: 100, h: 100 }
        };

        // Create initial view
        this.playerViews[playerId] = {
            view: { x: 0, y: 0, w: 100, h: 100 },
            viewRoot: null
        };

        this.updatePlayerView(playerId);
    }

    handlePlayerDisconnect(playerId) {
        // Clean up player view
        if (this.playerViews[playerId] && this.playerViews[playerId].viewRoot) {
            this.getViewRoot().removeChild(this.playerViews[playerId].viewRoot.node.id);
        }
        delete this.playerViews[playerId];
        delete this.playerStates[playerId];
    }

    handleKeyDown(playerId, key) {
        console.log('handleKeyDown called');
        console.log('playerId', playerId);
        console.log('key', key);
        if (!this.playerViews[playerId]) return;

        if (this.screen === SCREENS.COMBAT) {
            const p = this.combatPlayer;
            console.log('player object before move', p, 'at', p.x, p.y);
            if (key === 'w' && p.y - p.speed - p.size/2 > 0) p.y -= p.speed;
            if (key === 's' && p.y + p.speed + p.size/2 < this.combatArenaSize) p.y += p.speed;
            if (key === 'a' && p.x - p.speed - p.size/2 > 0) p.x -= p.speed;
            if (key === 'd' && p.x + p.speed + p.size/2 < this.combatArenaSize) p.x += p.speed;
            console.log('player object after move', p, 'at', p.x, p.y);
            this.updatePlayerView(playerId);
            this.getViewRoot().node.onStateChange();
            this.getPlane().node.onStateChange();
            return;
        }
        // ... existing code for lemonade view movement ...
        const currentView = this.playerViews[playerId].view;
        const newView = { ...currentView };
        const moveAmount = 10;
        if (key === 'w' && currentView.y - moveAmount >= 0) {
            newView.y = currentView.y - moveAmount;
        } else if (key === 's' && currentView.y + moveAmount <= this.getPlaneSize() - currentView.h) {
            newView.y = currentView.y + moveAmount;
        } else if (key === 'a' && currentView.x - moveAmount >= 0) {
            newView.x = currentView.x - moveAmount;
        } else if (key === 'd' && currentView.x + moveAmount <= this.getPlaneSize() - currentView.w) {
            newView.x = currentView.x + moveAmount;
        }
        if (newView.x !== currentView.x || newView.y !== currentView.y) {
            this.playerViews[playerId].view = newView;
            this.updatePlayerView(playerId);
        }
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
                this.updateAllPlayerViews();
            }
        }
    }

    getLayers() { 
        return [{root: this.getViewRoot()}]; 
    }
}

module.exports = Lemonade; 

