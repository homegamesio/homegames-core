const { ViewableGame, GameNode, Shapes, ShapeUtils, Colors } = require('squish-136');

class Thangs extends ViewableGame {
    static metadata() {
        return {
            aspectRatio: { x: 16, y: 9 },
            squishVersion: '136',
            author: 'User & Assistant',
            thumbnail: 'placeholder',
            tickRate: 60,
            description: 'A Vampire Survivors-like game with colored blocks.'
        };
    }

    constructor() {
        super(1000); // Game world size
        this.players = {};
        this.enemies = [];
        this.projectiles = [];
        this.enemySpawnTicker = 0;
        this.enemySpawnRate = 120; // Spawn every 2 seconds
    }

    handleNewPlayer({ playerId }) {
        this.players[playerId] = {
            id: playerId,
            x: 500,
            y: 500,
            size: 10,
            speed: 3,
            color: [0, 0, 255, 255], // Blue
            view: { x: 0, y: 0, w: 200, h: 200 }, // Player's camera view
            viewRoot: null,
            attackCooldown: 0,
            attackRate: 30 // Attacks every 0.5 seconds
        };
        this.updatePlayerView(playerId);
    }

    handlePlayerDisconnect(playerId) {
        const player = this.players[playerId];
        if (player && player.viewRoot) {
            this.getViewRoot().removeChild(player.viewRoot.node.id);
        }
        delete this.players[playerId];
    }

    handleKeyDown(playerId, key) {
        const player = this.players[playerId];
        if (!player) return;

        // Using a velocity model would be better, but for simplicity:
        if (key === 'w') player.y -= player.speed;
        if (key === 's') player.y += player.speed;
        if (key === 'a') player.x -= player.speed;
        if (key === 'd') player.x += player.speed;

        // Clamp position to world bounds
        player.x = Math.max(0, Math.min(this.getPlaneSize(), player.x));
        player.y = Math.max(0, Math.min(this.getPlaneSize(), player.y));
        
        this.updatePlayerView(playerId);
    }

    tick() {
        // --- Enemy Spawning ---
        this.enemySpawnTicker++;
        if (this.enemySpawnTicker >= this.enemySpawnRate) {
            this.enemySpawnTicker = 0;
            const side = Math.floor(Math.random() * 4);
            let x, y;
            const planeSize = this.getPlaneSize();
            if (side === 0) { // Top
                x = Math.random() * planeSize;
                y = 0;
            } else if (side === 1) { // Right
                x = planeSize;
                y = Math.random() * planeSize;
            } else if (side === 2) { // Bottom
                x = Math.random() * planeSize;
                y = planeSize;
            } else { // Left
                x = 0;
                y = Math.random() * planeSize;
            }
            this.enemies.push({
                x,
                y,
                size: 8,
                speed: 1,
                color: [255, 0, 0, 255], // Red
                id: `enemy-${Date.now()}-${Math.random()}`
            });
        }

        // --- Player Attack ---
        for (const playerId in this.players) {
            const player = this.players[playerId];
            player.attackCooldown--;
            if (player.attackCooldown <= 0) {
                player.attackCooldown = player.attackRate;
                
                // Find nearest enemy
                let nearestEnemy = null;
                let minDistance = Infinity;
                for (const enemy of this.enemies) {
                    const dx = enemy.x - player.x;
                    const dy = enemy.y - player.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestEnemy = enemy;
                    }
                }

                if (nearestEnemy) {
                    // Create a projectile
                    const dx = nearestEnemy.x - player.x;
                    const dy = nearestEnemy.y - player.y;
                    const magnitude = Math.sqrt(dx*dx + dy*dy);
                    this.projectiles.push({
                        x: player.x,
                        y: player.y,
                        vx: (dx / magnitude) * 5,
                        vy: (dy / magnitude) * 5,
                        size: 4,
                        color: [255, 255, 0, 255], // Yellow
                        lifespan: 120 // 2 seconds
                    });
                }
            }
        }

        // --- Enemy Movement ---
        // Basic AI: Move towards the nearest player
        for (const enemy of this.enemies) {
            let nearestPlayer = null;
            let minDistance = Infinity;
            for (const playerId in this.players) {
                const player = this.players[playerId];
                const dx = player.x - enemy.x;
                const dy = player.y - enemy.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestPlayer = player;
                }
            }
            if (nearestPlayer) {
                const dx = nearestPlayer.x - enemy.x;
                const dy = nearestPlayer.y - enemy.y;
                const magnitude = Math.sqrt(dx*dx + dy*dy);
                if (magnitude > 0) {
                    enemy.x += (dx / magnitude) * enemy.speed;
                    enemy.y += (dy / magnitude) * enemy.speed;
                }
            }
        }

        // --- Projectile Movement & Collision ---
        const newProjectiles = [];
        for (const p of this.projectiles) {
            p.x += p.vx;
            p.y += p.vy;
            p.lifespan--;

            let hit = false;
            // Check for collision with enemies
            this.enemies = this.enemies.filter(enemy => {
                const dx = enemy.x - p.x;
                const dy = enemy.y - p.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < (enemy.size + p.size) / 2) {
                    hit = true;
                    return false; // Remove enemy
                }
                return true;
            });

            if (p.lifespan > 0 && !hit) {
                newProjectiles.push(p);
            }
        }
        this.projectiles = newProjectiles;

        // --- Update all views ---
        this.updateAllPlayerViews();
    }

    updateAllPlayerViews() {
        Object.keys(this.players).forEach(playerId => {
            this.updatePlayerView(playerId);
        });
    }
    
    updatePlayerView(playerId) {
        const player = this.players[playerId];
        if (!player) return;

        // Clean up old view
        if (player.viewRoot) {
            this.getViewRoot().removeChild(player.viewRoot.node.id);
        }

        const viewRoot = this.createPlayerView(playerId);
        player.viewRoot = viewRoot;
        this.getViewRoot().addChild(viewRoot);
        viewRoot.node.onStateChange();
    }

    createPlayerView(playerId) {
        const player = this.players[playerId];
        const viewW = player.view.w;
        const viewH = player.view.h;

        // Center the view on the player
        const viewX = player.x - viewW / 2;
        const viewY = player.y - viewH / 2;

        const viewRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100), // view is always 100x100
            fill: [50, 50, 50, 255], // Dark grey background
            playerIds: [playerId]
        });
        
        // Function to transform world coords to view coords
        const toViewCoords = (worldX, worldY, worldSize) => {
            return {
                x: ((worldX - viewX) / viewW) * 100,
                y: ((worldY - viewY) / viewH) * 100,
                size: (worldSize / viewW) * 100
            };
        };

        // Draw player
        const playerRenderSize = (player.size / viewW) * 100;
        const playerNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(50 - playerRenderSize/2, 50 - playerRenderSize/2, playerRenderSize, playerRenderSize), // Player is always centered
            fill: player.color,
            playerIds: [playerId]
        });
        viewRoot.addChild(playerNode);

        // Draw enemies
        for (const enemy of this.enemies) {
            const renderInfo = toViewCoords(enemy.x, enemy.y, enemy.size);
            const enemyNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(renderInfo.x - renderInfo.size/2, renderInfo.y - renderInfo.size/2, renderInfo.size, renderInfo.size),
                fill: enemy.color,
                playerIds: [playerId]
            });
            viewRoot.addChild(enemyNode);
        }
        
        // Draw projectiles
        for (const p of this.projectiles) {
            const renderInfo = toViewCoords(p.x, p.y, p.size);
            const pNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(renderInfo.x - renderInfo.size/2, renderInfo.y - renderInfo.size/2, renderInfo.size, renderInfo.size),
                fill: p.color,
                playerIds: [playerId]
            });
            viewRoot.addChild(pNode);
        }

        return viewRoot;
    }

    getLayers() {
        return [{ root: this.getViewRoot() }];
    }
}

module.exports = Thangs; 