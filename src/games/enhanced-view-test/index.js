const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-136');
const { ExpiringSet, animations } = require('../../common/util');

const COLORS = Colors.COLORS;

class EnhancedViewTest extends ViewableGame {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Assistant',
            squishVersion: '136',
            thumbnail: 'placeholder',
            isTest: true,
            description: 'Enhanced view test with player movement and smart camera'
        };
    }

    constructor() {
        super(800); // Larger world size

        this.keyCoolDowns = new ExpiringSet();
        this.playerViews = {};
        this.players = {}; // Track player positions and movement
        this.worldItems = [];
        
        this.viewSize = 100; // Size of each player's view
        this.worldSize = 800;
        this.playerSize = 3;
        this.playerSpeed = 2;

        this.initializeWorld();
    }

    initializeWorld() {
        // Create world background
        const worldBase = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, this.worldSize, this.worldSize),
            fill: [240, 240, 240, 255] // Light gray background
        });

        // Add a grid of background tiles for movement reference
        const tileSize = 20;
        for (let x = 0; x < this.worldSize; x += tileSize) {
            for (let y = 0; y < this.worldSize; y += tileSize) {
                if ((Math.floor(x/tileSize) + Math.floor(y/tileSize)) % 2 === 0) {
                    const tile = new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        coordinates2d: ShapeUtils.rectangle(x, y, tileSize, tileSize),
                        fill: [250, 250, 250, 255] // Very light gray tiles
                    });
                    worldBase.addChild(tile);
                }
            }
        }

        // Randomly spawn lots of colorful items throughout the world
        const numItems = 200; // Much more items for visual richness
        for (let i = 0; i < numItems; i++) {
            const x = Math.random() * (this.worldSize - 10);
            const y = Math.random() * (this.worldSize - 10);
            const size = 3 + Math.random() * 10; // Random size between 3-13
            
            // Calculate health based on size (bigger blocks = more health)
            const health = Math.ceil(size * 2); // Health is roughly 2x the size
            
            // Create more varied colors - some bright, some pastel
            let color;
            if (Math.random() < 0.3) {
                // Bright colors
                color = [
                    Math.floor(150 + Math.random() * 105),
                    Math.floor(150 + Math.random() * 105),
                    Math.floor(150 + Math.random() * 105),
                    255
                ];
            } else {
                // More muted colors
                color = [
                    Math.floor(50 + Math.random() * 150),
                    Math.floor(50 + Math.random() * 150),
                    Math.floor(50 + Math.random() * 150),
                    255
                ];
            }

            const item = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, y, size, size),
                fill: color,
                onClick: (clickPlayerId) => {
                    console.log(`Player ${clickPlayerId} clicked item at (${x}, ${y}) with ${health} health`);
                }
            });

            // Add health text above the block
            const healthText = new GameNode.Text({
                textInfo: {
                    x: x + size/2, // Center horizontally on the block
                    y: y - 1, // Position slightly above the block
                    color: [255, 0, 0, 255], // Red text
                    text: health.toString(),
                    align: 'center',
                    size: Math.max(1, size/4) // Text size scales with block size, minimum 1
                }
            });

            this.worldItems.push({ x, y, size, color, health, node: item, healthText });
            worldBase.addChild(item);
            worldBase.addChild(healthText);
        }

        // Add some larger landmark objects
        const numLandmarks = 15;
        for (let i = 0; i < numLandmarks; i++) {
            const x = Math.random() * (this.worldSize - 30);
            const y = Math.random() * (this.worldSize - 30);
            const size = 15 + Math.random() * 15; // Larger objects (15-30)
            
            // Calculate health for landmarks (they're tougher!)
            const health = Math.ceil(size * 3); // Landmarks have 3x health multiplier
            
            const color = [
                Math.floor(Math.random() * 128),
                Math.floor(Math.random() * 128),
                Math.floor(Math.random() * 128),
                255
            ];

            const landmark = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, y, size, size),
                fill: color,
                onClick: (clickPlayerId) => {
                    console.log(`Player ${clickPlayerId} clicked landmark at (${x}, ${y}) with ${health} health`);
                }
            });

            // Add health text above the landmark
            const landmarkHealthText = new GameNode.Text({
                textInfo: {
                    x: x + size/2, // Center horizontally on the landmark
                    y: y - 2, // Position above the landmark
                    color: [255, 0, 0, 255], // Red text
                    text: health.toString(),
                    align: 'center',
                    size: Math.max(2, size/6) // Larger text for landmarks, minimum 2
                }
            });

            worldBase.addChild(landmark);
            worldBase.addChild(landmarkHealthText);
        }

        this.getPlane().addChild(worldBase);
    }

    calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
    }

    movePlayerTowards(playerId, targetX, targetY) {
        const player = this.players[playerId];
        if (!player) return;

        const distance = this.calculateDistance(player.x, player.y, targetX, targetY);
        
        if (distance <= this.playerSpeed) {
            // Reached target
            player.x = targetX;
            player.y = targetY;
            player.moving = false;
        } else {
            // Move towards target
            const angle = Math.atan2(targetY - player.y, targetX - player.x);
            player.x += Math.cos(angle) * this.playerSpeed;
            player.y += Math.sin(angle) * this.playerSpeed;
        }

        // Keep player within world bounds
        player.x = Math.max(this.playerSize/2, Math.min(this.worldSize - this.playerSize/2, player.x));
        player.y = Math.max(this.playerSize/2, Math.min(this.worldSize - this.playerSize/2, player.y));
    }

    updatePlayerView(playerId) {
        const player = this.players[playerId];
        const currentView = this.playerViews[playerId];
        if (!player || !currentView) return;

        // Always center the view on the player
        const newView = {
            x: Math.max(0, Math.min(this.worldSize - this.viewSize, player.x - this.viewSize/2)),
            y: Math.max(0, Math.min(this.worldSize - this.viewSize, player.y - this.viewSize/2)),
            w: this.viewSize,
            h: this.viewSize
        };

        // Update the view
        const newViewRoot = this.createPlayerView(playerId, newView);
        
        if (currentView.viewRoot) {
            this.getViewRoot().removeChild(currentView.viewRoot.node.id);
        }
        
        this.playerViews[playerId] = {
            view: newView,
            viewRoot: newViewRoot
        };
        
        this.getViewRoot().addChild(newViewRoot);
    }

    createPlayerView(playerId, view) {
        const viewRoot = ViewUtils.getView(this.getPlane(), view, [playerId]);
        
        // Add a transparent clickable layer over the entire view to handle clicks
        const clickLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, this.viewSize, this.viewSize),
            fill: [0, 0, 0, 0], // Transparent
            onClick: (clickPlayerId, x, y) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    // Convert click coordinates to world coordinates
                    const worldX = x + view.x;
                    const worldY = y + view.y;

                    // Set player target to clicked position
                    const player = this.players[playerId];
                    if (player) {
                        player.targetX = worldX;
                        player.targetY = worldY;
                        player.moving = true;
                        console.log(`Player ${playerId} clicked at view (${x}, ${y}) -> world (${worldX}, ${worldY})`);
                    }
                }
            },
            playerIds: [playerId]
        });
        
        viewRoot.addChild(clickLayer);
        
        // Add player to the view
        this.addPlayerToView(playerId, viewRoot, view);
        
        return viewRoot;
    }

    addPlayerToView(playerId, viewRoot, view) {
        const player = this.players[playerId];
        if (!player) return;

        // Calculate player position relative to view
        const relativeX = player.x - view.x;
        const relativeY = player.y - view.y;

        const playerNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(
                relativeX - this.playerSize/2, 
                relativeY - this.playerSize/2, 
                this.playerSize, 
                this.playerSize
            ),
            fill: [0, 0, 0, 255], // Black player
            playerIds: [playerId]
        });

        viewRoot.addChild(playerNode);
        player.nodeId = playerNode.node.id;
    }

    updatePlayerInView(playerId) {
        const player = this.players[playerId];
        const currentView = this.playerViews[playerId];
        if (!player || !currentView) return;

        // Remove old player node and add new one
        if (player.nodeId) {
            currentView.viewRoot.removeChild(player.nodeId);
        }
        
        this.addPlayerToView(playerId, currentView.viewRoot, currentView.view);
    }

    handleKeyDown(playerId, key) {
        const keyCacheId = `player${playerId}:${key}`;
        
        if (['w','a','s','d'].indexOf(key) >= 0 && !this.keyCoolDowns.has(keyCacheId)) {
            const player = this.players[playerId];
            if (!player) return;

            let targetX = player.x;
            let targetY = player.y;

            if (key === 'w') targetY -= this.playerSpeed;
            if (key === 's') targetY += this.playerSpeed;
            if (key === 'a') targetX -= this.playerSpeed;
            if (key === 'd') targetX += this.playerSpeed;

            // Set new target position
            player.targetX = targetX;
            player.targetY = targetY;
            player.moving = true;

            this.keyCoolDowns.put(keyCacheId, 100);
        }
    }



    handleNewPlayer({ playerId }) {
        // Initialize player at center of world
        const player = {
            x: this.worldSize / 2,
            y: this.worldSize / 2,
            targetX: this.worldSize / 2,
            targetY: this.worldSize / 2,
            moving: false,
            nodeId: null
        };

        this.players[playerId] = player;

        // Create initial view centered on player
        const initialView = {
            x: Math.max(0, Math.min(this.worldSize - this.viewSize, player.x - this.viewSize/2)),
            y: Math.max(0, Math.min(this.worldSize - this.viewSize, player.y - this.viewSize/2)),
            w: this.viewSize,
            h: this.viewSize
        };

        const playerViewRoot = this.createPlayerView(playerId, initialView);

        this.playerViews[playerId] = {
            view: initialView,
            viewRoot: playerViewRoot
        };

        this.getViewRoot().addChild(playerViewRoot);
    }

    handlePlayerDisconnect(playerId) {
        const playerViewRoot = this.playerViews[playerId] && this.playerViews[playerId].viewRoot;
        if (playerViewRoot) {
            this.getViewRoot().removeChild(playerViewRoot.node.id);
        }
        delete this.playerViews[playerId];
        delete this.players[playerId];
    }

    tick() {
        // Update all player movements
        Object.keys(this.players).forEach(playerId => {
            const player = this.players[playerId];
            if (player.moving) {
                this.movePlayerTowards(playerId, player.targetX, player.targetY);
                this.updatePlayerView(playerId);
            }
        });
    }

    getLayers() {
        return [{root: this.getViewRoot()}];
    }
}

module.exports = EnhancedViewTest; 