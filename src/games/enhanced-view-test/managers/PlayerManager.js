class PlayerManager {
    constructor(game) {
        this.game = game;
        this.players = {};
        this.playerViews = {};
        this.playerColors = [
            [0, 0, 0, 255],       // Black (player 1)
            [0, 0, 255, 255],     // Blue (player 2)  
            [255, 0, 0, 255],     // Red (player 3)
            [0, 255, 0, 255],     // Green (player 4)
            [255, 255, 0, 255],   // Yellow (player 5)
            [255, 0, 255, 255],   // Magenta (player 6)
            [0, 255, 255, 255],   // Cyan (player 7)
            [255, 128, 0, 255],   // Orange (player 8)
        ];
    }

    addPlayer(playerId) {
        const worldSize = this.game.worldSize;
        const playerMaxHealth = this.game.playerMaxHealth;

        const player = {
            x: worldSize / 2,
            y: worldSize / 2,
            targetX: worldSize / 2,
            targetY: worldSize / 2,
            moving: false,
            nodeId: null,
            lastGatherTime: 0,
            lastAttackTime: 0,
            health: playerMaxHealth,
            maxHealth: playerMaxHealth,
            score: 0
        };

        this.players[playerId] = player;
        this.createInitialView(playerId, player);
        return player;
    }

    removePlayer(playerId) {
        const playerViewRoot = this.playerViews[playerId]?.viewRoot;
        if (playerViewRoot) {
            this.game.getViewRoot().removeChild(playerViewRoot.node.id);
        }
        delete this.playerViews[playerId];
        delete this.players[playerId];
    }

    getPlayer(playerId) {
        return this.players[playerId];
    }

    getAllPlayers() {
        return this.players;
    }

    resetAllPlayers() {
        const worldSize = this.game.worldSize;
        const playerMaxHealth = this.game.playerMaxHealth;

        Object.keys(this.players).forEach(playerId => {
            const player = this.players[playerId];
            player.health = playerMaxHealth;
            player.maxHealth = playerMaxHealth;
            player.score = 0;
            player.x = worldSize / 2;
            player.y = worldSize / 2;
            player.targetX = worldSize / 2;
            player.targetY = worldSize / 2;
            player.moving = false;
            player.lastGatherTime = 0;
            player.lastAttackTime = 0;
        });
    }

    movePlayerTowards(playerId, targetX, targetY) {
        const player = this.players[playerId];
        if (!player) return;

        const distance = this.calculateDistance(player.x, player.y, targetX, targetY);
        const playerSpeed = this.game.playerSpeed;
        
        if (distance <= playerSpeed) {
            player.x = targetX;
            player.y = targetY;
            player.moving = false;
        } else {
            const angle = Math.atan2(targetY - player.y, targetX - player.x);
            player.x += Math.cos(angle) * playerSpeed;
            player.y += Math.sin(angle) * playerSpeed;
        }

        // Keep player within world bounds
        const worldSize = this.game.worldSize;
        const playerSize = this.game.playerSize;
        player.x = Math.max(playerSize/2, Math.min(worldSize - playerSize/2, player.x));
        player.y = Math.max(playerSize/2, Math.min(worldSize - playerSize/2, player.y));
    }

    calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
    }

    updatePlayerMovement(playerId) {
        const player = this.players[playerId];
        if (!player || !player.moving) return false;

        this.movePlayerTowards(playerId, player.targetX, player.targetY);
        return true; // Movement occurred
    }

    handlePlayerKeyDown(playerId, key) {
        const player = this.players[playerId];
        if (!player) return;

        let targetX = player.x;
        let targetY = player.y;
        
        const moveDistance = 50; // Set target far away for continuous movement

        if (key === 'w') targetY -= moveDistance;
        if (key === 's') targetY += moveDistance;
        if (key === 'a') targetX -= moveDistance;
        if (key === 'd') targetX += moveDistance;

        // Keep target within world bounds
        const worldSize = this.game.worldSize;
        const playerSize = this.game.playerSize;
        targetX = Math.max(playerSize/2, Math.min(worldSize - playerSize/2, targetX));
        targetY = Math.max(playerSize/2, Math.min(worldSize - playerSize/2, targetY));

        player.targetX = targetX;
        player.targetY = targetY;
        player.moving = true;
    }

    handlePlayerClick(playerId, x, y) {
        const currentView = this.playerViews[playerId];
        if (!currentView) return;
        
        // Convert click coordinates to world coordinates
        const worldX = x + currentView.view.x;
        const worldY = y + currentView.view.y;

        const player = this.players[playerId];
        if (player) {
            player.targetX = worldX;
            player.targetY = worldY;
            player.moving = true;
            console.log(`Player ${playerId} clicked at view (${x}, ${y}) -> world (${worldX}, ${worldY})`);
        }
    }

    getPlayerColor(playerIndex) {
        return this.playerColors[playerIndex % this.playerColors.length];
    }

    createInitialView(playerId, player) {
        const viewSize = this.game.viewSize;
        const worldSize = this.game.worldSize;

        // Create initial view centered on player
        const initialView = {
            x: Math.max(0, Math.min(worldSize - viewSize, player.x - viewSize/2)),
            y: Math.max(0, Math.min(worldSize - viewSize, player.y - viewSize/2)),
            w: viewSize,
            h: viewSize
        };

        // Use the game's existing view creation logic
        const viewComponents = this.game.createPlayerViewComponents(playerId, initialView);
        this.playerViews[playerId] = viewComponents;
    }

    updatePlayerView(playerId) {
        const player = this.players[playerId];
        const currentView = this.playerViews[playerId];
        if (!player || !currentView) return;

        const viewSize = this.game.viewSize;
        const worldSize = this.game.worldSize;

        // Calculate new view centered on player
        const newView = {
            x: Math.max(0, Math.min(worldSize - viewSize, player.x - viewSize/2)),
            y: Math.max(0, Math.min(worldSize - viewSize, player.y - viewSize/2)),
            w: viewSize,
            h: viewSize
        };

        // Update view using game's existing logic
        this.game.updatePlayerViewContent(playerId, newView, currentView);
    }

    updateAllPlayerViews() {
        Object.keys(this.players).forEach(playerId => {
            this.updatePlayerView(playerId);
        });
    }
}

module.exports = PlayerManager; 