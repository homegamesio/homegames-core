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
            description: 'Enhanced view test with player movement and smart camera',
            tickRate: 100 // Higher tick rate for smoother movement (matching view-test)
        };
    }

    constructor() {
        super(800); // Larger world size

        this.keyCoolDowns = new ExpiringSet();
        this.playerViews = {};
        this.players = {}; // Track player positions and movement
        this.worldItems = [];
        this.landmarks = []; // Track landmark objects separately
        
        this.viewSize = 100; // Size of each player's view
        this.worldSize = 800;
        this.playerSize = 3;
        this.playerSpeed = 0.2; // Very small moves for ultra-smooth movement (matching view-test)
        this.attackRange = 6; // Player attack range
        this.attackCooldown = 300; // Reduced cooldown for faster combat feel
        this.damageIndicators = []; // Store active damage indicators

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

            // Only store item data - health text will be created dynamically in views
            this.worldItems.push({ x, y, size, color, health, node: item });
            worldBase.addChild(item);
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

            // Only store landmark data - health text will be created dynamically in views
            this.landmarks.push({ x, y, size, color, health, node: landmark });
            worldBase.addChild(landmark);
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

        // Update the view content using the original view-test pattern
        const newViewContent = this.createPlayerView(playerId, newView);
        
        if (currentView.contentLayer) {
            // Clear only the content layer, leaving click layer intact
            currentView.contentLayer.node.clearChildren();
            currentView.contentLayer.node.addChild(newViewContent);
            currentView.contentLayer.node.onStateChange();
        }
        
        // Update stored view coordinates
        this.playerViews[playerId].view = newView;
    }

    createPlayerView(playerId, view) {
        const viewRoot = ViewUtils.getView(this.getPlane(), view, [playerId]);
        
        // Add dynamic health text for items and landmarks visible in this view
        this.addHealthTextToView(viewRoot, view);
        
        // Click layer is now handled separately, no need to add it here
        
        // Add player to the view
        this.addPlayerToView(playerId, viewRoot, view);
        
        return viewRoot;
    }

    addHealthTextToView(viewRoot, view) {
        // Add health text for regular items visible in this view
        for (const item of this.worldItems) {
            // Check if item is visible in current view
            if (item.x + item.size >= view.x && item.x <= view.x + view.w &&
                item.y + item.size >= view.y && item.y <= view.y + view.h) {
                
                // Convert world coordinates to view coordinates
                const viewX = item.x + item.size/2 - view.x;
                const viewY = item.y - 1 - view.y;
                
                // Choose color based on health status
                const textColor = item.health <= 0 ? [100, 100, 100, 255] : [255, 0, 0, 255];
                const healthValue = Math.max(0, item.health);
                
                const healthText = new GameNode.Text({
                    textInfo: {
                        x: viewX,
                        y: viewY,
                        color: textColor,
                        text: healthValue.toString(),
                        align: 'center',
                        size: Math.max(1, item.size/4)
                    }
                });
                
                viewRoot.addChild(healthText);
            }
        }
        
        // Add health text for landmarks visible in this view
        for (const landmark of this.landmarks) {
            // Check if landmark is visible in current view
            if (landmark.x + landmark.size >= view.x && landmark.x <= view.x + view.w &&
                landmark.y + landmark.size >= view.y && landmark.y <= view.y + view.h) {
                
                // Convert world coordinates to view coordinates
                const viewX = landmark.x + landmark.size/2 - view.x;
                const viewY = landmark.y - 2 - view.y;
                
                // Choose color based on health status
                const textColor = landmark.health <= 0 ? [100, 100, 100, 255] : [255, 0, 0, 255];
                const healthValue = Math.max(0, landmark.health);
                
                const healthText = new GameNode.Text({
                    textInfo: {
                        x: viewX,
                        y: viewY,
                        color: textColor,
                        text: healthValue.toString(),
                        align: 'center',
                        size: Math.max(2, landmark.size/6)
                    }
                });
                
                viewRoot.addChild(healthText);
            }
        }
        
        // Add damage indicators visible in this view
        const currentTime = Date.now();
        for (const indicator of this.damageIndicators) {
            // Check if indicator is still active and visible
            if (currentTime - indicator.createdAt < indicator.duration &&
                indicator.x >= view.x && indicator.x <= view.x + view.w &&
                indicator.y >= view.y && indicator.y <= view.y + view.h) {
                
                // Convert world coordinates to view coordinates
                const viewX = indicator.x - view.x;
                const viewY = indicator.y - view.y;
                
                // Calculate fade effect based on age
                const age = currentTime - indicator.createdAt;
                const fadeProgress = age / indicator.duration;
                const alpha = Math.round(255 * (1 - fadeProgress));
                
                const damageText = new GameNode.Text({
                    textInfo: {
                        x: viewX,
                        y: viewY,
                        color: [255, 255, 0, alpha], // Yellow text that fades out
                        text: `-${indicator.damage}`,
                        align: 'center',
                        size: 2
                    }
                });
                
                viewRoot.addChild(damageText);
            }
        }
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
        // This method is no longer needed since we recreate the entire view content
        // in updatePlayerView using the stable wrapper pattern
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

            this.keyCoolDowns.put(keyCacheId, 20); // Ultra-fast key repeat for smoothest movement (matching view-test)
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
            nodeId: null,
            lastAttackTime: 0 // Track last attack time for cooldown
        };

        this.players[playerId] = player;

        // Create initial view centered on player
        const initialView = {
            x: Math.max(0, Math.min(this.worldSize - this.viewSize, player.x - this.viewSize/2)),
            y: Math.max(0, Math.min(this.worldSize - this.viewSize, player.y - this.viewSize/2)),
            w: this.viewSize,
            h: this.viewSize
        };

        // Create stable wrapper (like original view-test)
        const stableWrapper = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, this.viewSize, this.viewSize),
            fill: [240, 240, 240, 255], // Light gray background so player never sees nothing
            playerIds: [playerId]
        });

        // Create content layer that will be updated
        const contentLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, this.viewSize, this.viewSize),
            fill: [0, 0, 0, 0], // Transparent container
            playerIds: [playerId]
        });

        // Create initial view content
        const initialViewContent = this.createPlayerView(playerId, initialView);
        contentLayer.addChild(initialViewContent);

        // Create stable click layer
        const clickLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, this.viewSize, this.viewSize),
            fill: [0, 0, 0, 0], // Transparent
            onClick: (clickPlayerId, x, y) => {
                console.log('clicked ' + clickPlayerId);
                if (Number(clickPlayerId) === Number(playerId)) {
                    const currentView = this.playerViews[playerId];
                    if (!currentView) return;
                    
                    // Convert click coordinates to world coordinates
                    const worldX = x + currentView.view.x;
                    const worldY = y + currentView.view.y;

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

        // Add layers in order: content first, click layer on top
        stableWrapper.addChild(contentLayer);
        stableWrapper.addChild(clickLayer);

        this.playerViews[playerId] = {
            view: initialView,
            viewRoot: stableWrapper,
            contentLayer: contentLayer,
            clickLayer: clickLayer
        };

        this.getViewRoot().addChild(stableWrapper);
    }

    handlePlayerDisconnect(playerId) {
        const playerViewRoot = this.playerViews[playerId] && this.playerViews[playerId].viewRoot;
        if (playerViewRoot) {
            this.getViewRoot().removeChild(playerViewRoot.node.id);
        }
        delete this.playerViews[playerId];
        delete this.players[playerId];
    }

    dealDamage() {
        // Roll for damage: 25% chance each for 1, 2, 3, or 4 damage
        const roll = Math.random();
        if (roll < 0.25) return 1;
        else if (roll < 0.5) return 2;
        else if (roll < 0.75) return 3;
        else return 4;
    }

    calculateDistanceToRectangle(pointX, pointY, rectX, rectY, rectWidth, rectHeight) {
        // Find the closest point on the rectangle to the given point
        const closestX = Math.max(rectX, Math.min(pointX, rectX + rectWidth));
        const closestY = Math.max(rectY, Math.min(pointY, rectY + rectHeight));
        
        // Calculate distance from point to closest point on rectangle
        return this.calculateDistance(pointX, pointY, closestX, closestY);
    }

    findAttackTarget(player) {
        // Check regular items first
        for (const item of this.worldItems) {
            if (item.health <= 0) continue; // Skip destroyed items
            
            const distance = this.calculateDistanceToRectangle(
                player.x, player.y,
                item.x, item.y, item.size, item.size
            );
            
            if (distance <= this.attackRange) {
                return { target: item, type: 'item' };
            }
        }
        
        // Check landmarks
        for (const landmark of this.landmarks) {
            if (landmark.health <= 0) continue; // Skip destroyed landmarks
            
            const distance = this.calculateDistanceToRectangle(
                player.x, player.y,
                landmark.x, landmark.y, landmark.size, landmark.size
            );
            
            if (distance <= this.attackRange) {
                return { target: landmark, type: 'landmark' };
            }
        }
        
        return null; // No targets in range
    }

    attackTarget(target, playerId) {
        const damage = this.dealDamage();
        target.health -= damage;
        
        console.log(`Player ${playerId} attacks for ${damage} damage! Target health: ${target.health}`);
        
        // Create damage indicator at random position near the target
        const indicatorX = target.x + (Math.random() * target.size);
        const indicatorY = target.y + (Math.random() * target.size);
        
        const damageIndicator = {
            x: indicatorX,
            y: indicatorY,
            damage: damage,
            createdAt: Date.now(),
            duration: 1000 // Show for 1 second
        };
        
        this.damageIndicators.push(damageIndicator);
        
        if (target.health <= 0) {
            // Target destroyed
            target.health = 0; // Ensure it doesn't go negative
            console.log(`Target destroyed!`);
        }
        
        // Health text will be updated automatically when view refreshes
        // No need to manually update text nodes since they're created dynamically
    }

    tick() {
        const currentTime = Date.now();
        
        // Clean up expired damage indicators
        this.damageIndicators = this.damageIndicators.filter(indicator => 
            currentTime - indicator.createdAt < indicator.duration
        );
        
        // Update all player movements
        Object.keys(this.players).forEach(playerId => {
            const player = this.players[playerId];
            let needsViewUpdate = false;
            
            if (player.moving) {
                this.movePlayerTowards(playerId, player.targetX, player.targetY);
                needsViewUpdate = true;
            }
            
            // Check for attack targets (with cooldown)
            if (currentTime - player.lastAttackTime >= this.attackCooldown) {
                const attackResult = this.findAttackTarget(player);
                if (attackResult) {
                    this.attackTarget(attackResult.target, playerId);
                    player.lastAttackTime = currentTime;
                    needsViewUpdate = true; // Need to update view to show new health values
                }
            }
            
            // Update view if needed (either from movement or attacking)
            if (needsViewUpdate) {
                this.updatePlayerView(playerId);
            }
        });
    }

    getLayers() {
        return [{root: this.getViewRoot()}];
    }
}

module.exports = EnhancedViewTest; 