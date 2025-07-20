const UIComponents = require('../utils/UIComponents');
const { GameNode, Shapes, ShapeUtils } = require('squish-136');

class GameStateManager {
    constructor(game) {
        this.game = game;
        this.state = 'playing';
        this.gameStartTime = Date.now();
        this.gameTimer = 60000; // 60 seconds
        
        this.states = {
            playing: new PlayingState(game),
            gameOver: new GameOverState(game),
            dead: new DeadState(game),
            bossFailure: new BossFailureState(game),
            deathFailure: new DeathFailureState(game),
            noIngredientsFailure: new NoIngredientsFailureState(game),
            noLemonsFailure: new NoLemonsFailureState(game),
            recipe: new RecipeState(game),
            newSection: new LemonadeStandState(game),
            newSectionStats: new ResultsState(game)
        };
    }

    setState(newState) {
        if (this.states[newState]) {
            console.log(`Transitioning from ${this.state} to ${newState}`);
            this.state = newState;
            this.game.updateAllPlayerViews();
        }
    }

    getCurrentState() {
        return this.state;
    }

    createView(playerId, view) {
        return this.states[this.state].createView(playerId, view);
    }

    shouldHaveClickLayer() {
        // Only the playing state needs a click layer for movement
        // All other states handle clicks through their UI buttons
        return this.state === 'playing';
    }

    checkTransitions() {
        if (this.state === 'playing') {
            // Check if there are any bosses in the arena
            const aliveBosses = this.game.combatSystem.guards.filter(guard => 
                guard.type === 'boss' && guard.health > 0
            );
            const bossesPresent = aliveBosses.length > 0;
            
            // Check player death
            const players = this.game.playerManager.getAllPlayers();
            for (const playerId in players) {
                const player = players[playerId];
                if (player.health <= 0) {
                    // Handle resource loss from death
                    this.game.resourceManager.handlePlayerDeath();
                    
                    if (bossesPresent) {
                        // Boss fight mode: death = game over
                        this.setState('bossFailure');
                        return true;
                    } else {
                        // Normal mode: death loses resources but game continues
                        this.setState('dead');
                        return true;
                    }
                }
            }
            
            if (bossesPresent) {
                // Boss fight mode: no timer, must defeat all bosses
                // Check if all bosses are defeated
                if (aliveBosses.length === 0) {
                    // All bosses defeated! Normal victory
                    this.setState('gameOver');
                    return true;
                }
                // Continue fighting - no timer in boss mode
            } else {
                // Normal mode: check timer
                const timeRemaining = this.gameTimer - (Date.now() - this.gameStartTime);
                if (timeRemaining <= 0) {
                    this.setState('gameOver');
                    return true;
                }
            }
        }
        return false;
    }

    resetForNewGame() {
        this.state = 'playing';
        this.gameStartTime = Date.now();
        
        // Reset any state-specific data
        if (this.states.noIngredientsFailure.customerStartTime) {
            this.states.noIngredientsFailure.customerStartTime = null;
            this.states.noIngredientsFailure.customer = null;
        }
        if (this.states.noLemonsFailure.customerStartTime) {
            this.states.noLemonsFailure.customerStartTime = null;
            this.states.noLemonsFailure.customer = null;
        }
    }
}

// Base state class
class GameState {
    constructor(game) {
        this.game = game;
    }

    createView(playerId, view) {
        throw new Error('createView must be implemented by subclass');
    }
}

class PlayingState extends GameState {
    createView(playerId, view) {
        // Return the normal game view
        return this.game.createGameplayView(playerId, view);
    }
}

class GameOverState extends GameState {
    createView(playerId, view) {
        const viewRoot = UIComponents.createBackground([40, 40, 40, 255]);
        
        // Title
        const title = UIComponents.createTitle('TIME UP!', 20, 3, [255, 255, 0, 255]);
        
        // Stats
        const player = this.game.playerManager.getPlayer(playerId);
        const finalScore = player ? player.score : 0;
        const timeAlive = Math.floor((Date.now() - this.game.gameStateManager.gameStartTime) / 1000);

        const elements = [
            title,
            this.createStatsText(finalScore, timeAlive),
            ...this.createUpgradeSection(playerId, player),
            ...this.createNewDayButton(playerId)
        ];

        elements.forEach(element => {
            if (Array.isArray(element)) {
                element.forEach(e => viewRoot.addChild(e));
            } else {
                viewRoot.addChild(element);
            }
        });

        return viewRoot;
    }

    createStatsText(finalScore, timeAlive) {
        return [
            UIComponents.createTitle(`Final Score: ${finalScore}`, 35, 2, [255, 255, 255, 255]),
            UIComponents.createTitle(`Resources: ${this.game.currentStats.resourcesCollected}`, 45, 1.5, [255, 255, 255, 255]),
            UIComponents.createTitle(`Time Survived: ${timeAlive}s`, 55, 1.5, [255, 255, 255, 255])
        ];
    }

    createUpgradeSection(playerId, player) {
        // This would use the existing createUpgradeElements logic but with UI components
        return this.game.createUpgradeElements(playerId, player);
    }

    createNewDayButton(playerId) {
        return UIComponents.createButton({
            rect: [25, 85, 50, 8],
            fillColor: [0, 180, 0, 255],
            text: 'NEW DAY',
            textSize: 2.5,
            onClick: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.game.gameStateManager.setState('recipe');
                }
            }
        });
    }
}

class DeadState extends GameOverState {
    createView(playerId, view) {
        const viewRoot = super.createView(playerId, view);
        // Modify title to say "YOU DIED!" instead
        // This is a simple example - you'd need to find and modify the title
        return viewRoot;
    }
}

class RecipeState extends GameState {
    createView(playerId, view) {
        const viewRoot = UIComponents.createBackground([50, 70, 50, 255]);
        
        const title = UIComponents.createTitle('RECIPE', 15, 4);
        viewRoot.addChild(title);

        // Resource display
        const resources = this.game.resourceManager.getResourceSummary();
        const resourceDisplay = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 25,
                color: [255, 255, 255, 255],
                text: `Available: 🍯${resources.sugar} 🍋${resources.lemons} 💰$${resources.money.toFixed(2)}`,
                align: 'center',
                size: 1.5
            }
        });
        viewRoot.addChild(resourceDisplay);

        // Sugar controls
        const sugarControls = UIComponents.createIncrementControl({
            label: 'Sugar',
            value: this.game.lemonadeSystem.recipe.sugar,
            x: 50,
            y: 40,
            onIncrement: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.game.lemonadeSystem.recipe.sugar = Math.min(20, this.game.lemonadeSystem.recipe.sugar + 1);
                    this.game.updateAllPlayerViews();
                }
            },
            onDecrement: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.game.lemonadeSystem.recipe.sugar = Math.max(0, this.game.lemonadeSystem.recipe.sugar - 1);
                    this.game.updateAllPlayerViews();
                }
            }
        });

        // Lemon controls
        const lemonControls = UIComponents.createIncrementControl({
            label: 'Lemons',
            value: this.game.lemonadeSystem.recipe.lemons,
            x: 50,
            y: 55,
            onIncrement: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.game.lemonadeSystem.recipe.lemons = Math.min(20, this.game.lemonadeSystem.recipe.lemons + 1);
                    this.game.updateAllPlayerViews();
                }
            },
            onDecrement: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.game.lemonadeSystem.recipe.lemons = Math.max(0, this.game.lemonadeSystem.recipe.lemons - 1);
                    this.game.updateAllPlayerViews();
                }
            }
        });

        // Price controls
        const currentPrice = this.game.lemonadeSystem.price;
        const priceControls = UIComponents.createIncrementControl({
            label: 'Price',
            value: `$${currentPrice.toFixed(2)}`,
            x: 50,
            y: 70,
            onIncrement: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.game.lemonadeSystem.setPrice(this.game.lemonadeSystem.price + 0.25);
                    this.game.updateAllPlayerViews();
                }
            },
            onDecrement: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.game.lemonadeSystem.setPrice(this.game.lemonadeSystem.price - 0.25);
                    this.game.updateAllPlayerViews();
                }
            }
        });

        // Buy options
        const buyLemonsButton = UIComponents.createButton({
            rect: [10, 80, 15, 6],
            fillColor: this.game.resourceManager.canAfford(5) ? [255, 165, 0, 255] : [100, 100, 100, 255], // Orange if affordable
            text: 'Buy 20🍋',
            textSize: 1.2,
            onClick: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId) && this.game.resourceManager.canAfford(5)) {
                    if (this.game.resourceManager.spendMoney(5)) {
                        this.game.resourceManager.addLemons(20);
                        this.game.updateAllPlayerViews();
                    }
                }
            }
        });
        
        const buyLemonsPrice = new GameNode.Text({
            textInfo: {
                x: 17.5,
                y: 87,
                color: [255, 255, 255, 255],
                text: '$5',
                align: 'center',
                size: 1
            }
        });

        const buySugarButton = UIComponents.createButton({
            rect: [75, 80, 15, 6],
            fillColor: this.game.resourceManager.canAfford(5) ? [255, 165, 0, 255] : [100, 100, 100, 255], // Orange if affordable
            text: 'Buy 10🍯',
            textSize: 1.2,
            onClick: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId) && this.game.resourceManager.canAfford(5)) {
                    if (this.game.resourceManager.spendMoney(5)) {
                        this.game.resourceManager.addSugar(10);
                        this.game.updateAllPlayerViews();
                    }
                }
            }
        });
        
        const buySugarPrice = new GameNode.Text({
            textInfo: {
                x: 82.5,
                y: 87,
                color: [255, 255, 255, 255],
                text: '$5',
                align: 'center',
                size: 1
            }
        });

        // Confirm button (moved down for buy options)
        const [confirmButton, confirmText] = UIComponents.createButton({
            rect: [35, 91, 30, 6],
            fillColor: [0, 0, 200, 255],
            text: 'START SELLING',
            textSize: 1.8,
            onClick: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.game.startLemonadeStand(); // This properly starts the lemonade stand
                }
            }
        });

        [
            ...sugarControls,
            ...lemonControls,
            ...priceControls,
            ...buyLemonsButton,
            buyLemonsPrice,
            ...buySugarButton,
            buySugarPrice,
            confirmButton,
            confirmText
        ].forEach(element => viewRoot.addChild(element));

        return viewRoot;
    }
}

class LemonadeStandState extends GameState {
    createView(playerId, view) {
        // Use existing createNewSectionView logic
        return this.game.createNewSectionView(playerId, view);
    }
}

class ResultsState extends GameState {
    createView(playerId, view) {
        // Use existing createNewSectionStatsView logic
        return this.game.createNewSectionStatsView(playerId, view);
    }
}

class BossFailureState extends GameState {
    createView(playerId, view) {
        const viewRoot = UIComponents.createBackground([60, 20, 20, 255]); // Dark red
        
        const title = UIComponents.createTitle('BOSS VICTORY!', 20, 3, [255, 100, 100, 255]);
        const subtitle = UIComponents.createTitle('The sugar addicts have won...', 30, 2, [255, 150, 150, 255]);
        const message = UIComponents.createTitle('You were defeated by the boss!', 40, 1.5, [255, 255, 255, 255]);
        
        const playAgainButton = UIComponents.createButton({
            rect: [25, 75, 50, 10],
            fillColor: [100, 200, 100, 255],
            text: 'PLAY AGAIN',
            textSize: 2.5,
            onClick: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.game.resetGame();
                }
            }
        });

        [title, subtitle, message, ...playAgainButton].forEach(element => {
            viewRoot.addChild(element);
        });

        return viewRoot;
    }
}

class DeathFailureState extends GameState {
    createView(playerId, view) {
        const viewRoot = UIComponents.createBackground([40, 20, 20, 255]); // Dark red
        
        const title = UIComponents.createTitle('GAME OVER', 20, 3, [255, 0, 0, 255]);
        const subtitle = UIComponents.createTitle('You have been defeated!', 30, 2, [255, 100, 100, 255]);
        
        // Show final stats
        const player = this.game.playerManager.getPlayer(playerId);
        const finalScore = player ? player.score : 0;
        const timeAlive = Math.floor((Date.now() - this.game.gameStateManager.gameStartTime) / 1000);

        const scoreText = UIComponents.createTitle(`Final Score: ${finalScore}`, 45, 1.8, [255, 255, 255, 255]);
        const timeText = UIComponents.createTitle(`Time Survived: ${timeAlive}s`, 55, 1.8, [255, 255, 255, 255]);
        
        const playAgainButton = UIComponents.createButton({
            rect: [25, 75, 50, 10],
            fillColor: [100, 200, 100, 255],
            text: 'PLAY AGAIN',
            textSize: 2.5,
            onClick: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.game.resetGame();
                }
            }
        });

        [title, subtitle, scoreText, timeText, ...playAgainButton].forEach(element => {
            viewRoot.addChild(element);
        });

        return viewRoot;
    }
}

class NoIngredientsFailureState extends GameState {
    constructor(game) {
        super(game);
        this.customerStartTime = null;
        this.customer = null;
    }

    createView(playerId, view) {
        const viewRoot = UIComponents.createBackground([135, 206, 235, 255]); // Sky blue
        
        // Ground/sidewalk
        const sidewalk = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 40, 100, 20),
            fill: [192, 192, 192, 255]
        });
        viewRoot.addChild(sidewalk);

        // Empty lemonade stand
        const playerStand = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(45, 35, 10, 10),
            fill: [139, 69, 19, 255]
        });
        
        const playerBehindStand = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(47, 30, 6, 8),
            fill: [0, 0, 0, 255]
        });
        
        const standSign = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 25,
                color: [255, 255, 255, 255],
                text: 'LEMONADE',
                align: 'center',
                size: 1.2
            }
        });

        viewRoot.addChild(playerStand);
        viewRoot.addChild(playerBehindStand);
        viewRoot.addChild(standSign);

        // Initialize customer if not done yet
        if (!this.customerStartTime) {
            this.customerStartTime = Date.now();
            this.customer = {
                x: -10, // Start off screen
                y: 45,
                targetX: 35, // Stop near the stand
                state: 'walking',
                messageShown: false
            };
        }

        // Update customer position
        const elapsedTime = Date.now() - this.customerStartTime;
        
        if (this.customer.state === 'walking' && this.customer.x < this.customer.targetX) {
            this.customer.x = Math.min(this.customer.targetX, -10 + (elapsedTime / 2000) * 45); // 2 second walk
        }
        
        if (this.customer.x >= this.customer.targetX && !this.customer.messageShown) {
            this.customer.state = 'talking';
            this.customer.messageShown = true;
            this.customer.messageTime = Date.now();
        }

        // Draw customer
        const customer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(this.customer.x, this.customer.y, 6, 8),
            fill: [150, 100, 50, 255] // Brown customer
        });
        viewRoot.addChild(customer);

        // Show message after customer reaches stand
        if (this.customer.messageShown) {
            const message = new GameNode.Text({
                textInfo: {
                    x: 50,
                    y: 15,
                    color: [255, 0, 0, 255],
                    text: '"You want to have a lemonade stand with no lemonade?!"',
                    align: 'center',
                    size: 1.5
                }
            });
            viewRoot.addChild(message);

            // Show game over after message displays for 3 seconds
            const messageElapsed = Date.now() - this.customer.messageTime;
            if (messageElapsed > 3000) {
                const gameOverTitle = UIComponents.createTitle('GAME OVER', 60, 3, [255, 0, 0, 255]);
                const failureText = UIComponents.createTitle('No ingredients to make lemonade!', 70, 1.8, [255, 255, 255, 255]);
                
                const playAgainButton = UIComponents.createButton({
                    rect: [25, 80, 50, 10],
                    fillColor: [100, 200, 100, 255],
                    text: 'PLAY AGAIN',
                    textSize: 2.5,
                    onClick: (clickPlayerId) => {
                        if (Number(clickPlayerId) === Number(playerId)) {
                            this.game.resetGame();
                        }
                    }
                });

                [gameOverTitle, failureText, ...playAgainButton].forEach(element => {
                    viewRoot.addChild(element);
                });
            }
        }

        return viewRoot;
    }
}

class NoLemonsFailureState extends GameState {
    constructor(game) {
        super(game);
        this.customerStartTime = null;
        this.customer = null;
    }

    createView(playerId, view) {
        const viewRoot = UIComponents.createBackground([135, 206, 235, 255]); // Sky blue
        
        // Ground/sidewalk
        const sidewalk = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 40, 100, 20),
            fill: [192, 192, 192, 255]
        });
        viewRoot.addChild(sidewalk);

        // Empty lemonade stand
        const playerStand = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(45, 35, 10, 10),
            fill: [139, 69, 19, 255]
        });
        
        const playerBehindStand = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(47, 30, 6, 8),
            fill: [0, 0, 0, 255]
        });
        
        const standSign = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 25,
                color: [255, 255, 255, 255],
                text: 'LEMONADE',
                align: 'center',
                size: 1.2
            }
        });

        viewRoot.addChild(playerStand);
        viewRoot.addChild(playerBehindStand);
        viewRoot.addChild(standSign);

        // Initialize customer if not done yet
        if (!this.customerStartTime) {
            this.customerStartTime = Date.now();
            this.customer = {
                x: -10, // Start off screen
                y: 45,
                targetX: 35, // Stop near the stand
                state: 'walking',
                messageShown: false
            };
        }

        // Update customer position
        const elapsedTime = Date.now() - this.customerStartTime;
        
        if (this.customer.state === 'walking' && this.customer.x < this.customer.targetX) {
            this.customer.x = Math.min(this.customer.targetX, -10 + (elapsedTime / 2000) * 45); // 2 second walk
        }
        
        if (this.customer.x >= this.customer.targetX && !this.customer.messageShown) {
            this.customer.state = 'talking';
            this.customer.messageShown = true;
            this.customer.messageTime = Date.now();
        }

        // Draw customer
        const customer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(this.customer.x, this.customer.y, 6, 8),
            fill: [150, 100, 50, 255] // Brown customer
        });
        viewRoot.addChild(customer);

        // Show message after customer reaches stand
        if (this.customer.messageShown) {
            const message = new GameNode.Text({
                textInfo: {
                    x: 50,
                    y: 15,
                    color: [255, 0, 0, 255],
                    text: '"This is just sugar water! Where are the lemons?!"',
                    align: 'center',
                    size: 1.5
                }
            });
            viewRoot.addChild(message);

            // Show game over after message displays for 3 seconds
            const messageElapsed = Date.now() - this.customer.messageTime;
            if (messageElapsed > 3000) {
                const gameOverTitle = UIComponents.createTitle('GAME OVER', 60, 3, [255, 0, 0, 255]);
                const failureText = UIComponents.createTitle('Lemonade needs lemons!', 70, 1.8, [255, 255, 255, 255]);
                
                const playAgainButton = UIComponents.createButton({
                    rect: [25, 80, 50, 10],
                    fillColor: [100, 200, 100, 255],
                    text: 'PLAY AGAIN',
                    textSize: 2.5,
                    onClick: (clickPlayerId) => {
                        if (Number(clickPlayerId) === Number(playerId)) {
                            this.game.resetGame();
                        }
                    }
                });

                [gameOverTitle, failureText, ...playAgainButton].forEach(element => {
                    viewRoot.addChild(element);
                });
            }
        }

        return viewRoot;
    }
}

module.exports = GameStateManager; 