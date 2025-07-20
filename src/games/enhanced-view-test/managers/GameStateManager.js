const UIComponents = require('../utils/UIComponents');

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
        return this.state === 'playing';
    }

    checkTransitions() {
        if (this.state === 'playing') {
            // Check timer
            const timeRemaining = this.gameTimer - (Date.now() - this.gameStartTime);
            if (timeRemaining <= 0) {
                this.setState('gameOver');
                return true;
            }
            
            // Check player death
            const players = this.game.playerManager.getAllPlayers();
            for (const playerId in players) {
                const player = players[playerId];
                if (player.health <= 0) {
                    this.setState('dead');
                    return true;
                }
            }
        }
        return false;
    }

    resetForNewGame() {
        this.state = 'playing';
        this.gameStartTime = Date.now();
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
            ...this.createUpgradeSection(playerId, player, finalScore),
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

    createUpgradeSection(playerId, player, playerScore) {
        // This would use the existing createUpgradeElements logic but with UI components
        return this.game.createUpgradeElements(playerId, player, playerScore);
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

        // Sugar controls
        const sugarControls = UIComponents.createIncrementControl({
            label: 'Sugar',
            value: this.game.lemonadeSystem.recipe.sugar,
            x: 50,
            y: 35,
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
            y: 60,
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

        // Confirm button
        const [confirmButton, confirmText] = UIComponents.createButton({
            rect: [25, 85, 50, 8],
            fillColor: [0, 0, 200, 255],
            text: 'CONFIRM',
            textSize: 2.5,
            onClick: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.game.startLemonadeStand(); // This properly starts the lemonade stand
                }
            }
        });

        [
            ...sugarControls,
            ...lemonControls,
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

module.exports = GameStateManager; 