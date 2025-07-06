const { Game, ViewableGame, GameNode, Colors, Shapes, ShapeUtils, ViewUtils } = require('squish-136');
const { COLORS } = require('squish-136/src/Colors');

const SCREENS = {
    STAND: 'stand',
    SHOP: 'shop',
    RECIPE: 'recipe',
    RESULTS: 'results'
};

const STAND_DURATION_MS = 60000; // 1 minute
const CUSTOMER_SPEED = 1.2; // units per tick
const CUSTOMER_SPAWN_INTERVAL = 60; // ticks between customers (about 1 per second at 60fps)

class Lemonade extends ViewableGame {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '136',
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
        this.screen = screen;
        if (screen === SCREENS.STAND) {
            this.resetStandSim();
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
            this.getViewRoot().removeChild(this.playerViews[playerId].viewRoot.node.id);
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
        }

        this.playerViews[playerId].viewRoot = newViewRoot;
        this.getViewRoot().addChild(newViewRoot);
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
                    this.setScreen(SCREENS.SHOP);
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
        // Allow players to move their viewport around the world
        if (!this.playerViews[playerId]) return;

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

