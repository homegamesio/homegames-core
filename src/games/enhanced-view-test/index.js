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
            description: 'Resource gathering game with smooth movement and dynamic camera',
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
        this.guards = []; // Track all guards in the world
        
        this.viewSize = 100; // Size of each player's view
        this.worldSize = 800;
        this.playerSize = 3;
        this.playerSpeed = 0.2; // Very small moves for ultra-smooth movement (matching view-test)
        this.gatherRange = 6; // Player gathering range
        this.gatherCooldown = 300; // Time between gathering attempts
        this.gatherIndicators = []; // Store active resource gathering indicators

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

        // Randomly spawn resource pools throughout the world
        const numResourcePools = 200; // Many resource pools for variety
        for (let i = 0; i < numResourcePools; i++) {
            const x = Math.random() * (this.worldSize - 10);
            const y = Math.random() * (this.worldSize - 10);
            const size = 3 + Math.random() * 10; // Random size between 3-13
            
            // Calculate resources based on size (bigger pools = more resources)
            const resources = Math.ceil(size * 2); // Resources roughly 2x the size
            
            // Create more varied colors - some bright, some pastel
            let color;
            if (Math.random() < 0.3) {
                // Bright colors - rich resource deposits
                color = [
                    Math.floor(150 + Math.random() * 105),
                    Math.floor(150 + Math.random() * 105),
                    Math.floor(150 + Math.random() * 105),
                    255
                ];
            } else {
                // More muted colors - common resource deposits
                color = [
                    Math.floor(50 + Math.random() * 150),
                    Math.floor(50 + Math.random() * 150),
                    Math.floor(50 + Math.random() * 150),
                    255
                ];
            }

            const resourcePool = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, y, size, size),
                fill: color,
                onClick: (clickPlayerId) => {
                    console.log(`Player ${clickPlayerId} clicked resource pool at (${x}, ${y}) with ${resources} resources remaining`);
                }
            });

            // Store resource pool data - resource text will be created dynamically in views
            const poolData = { x, y, size, color, resources, node: resourcePool };
            this.worldItems.push(poolData);
            worldBase.addChild(resourcePool);

            // Spawn guards for medium to large resource pools
            if (size >= 8) { // Medium/large pools get guards
                const numGuards = Math.floor(size / 4); // More guards for larger pools
                this.spawnGuardsAroundPool(poolData, numGuards, worldBase);
            }
        }

        // Add some larger resource veins (major deposits)
        const numResourceVeins = 15;
        for (let i = 0; i < numResourceVeins; i++) {
            const x = Math.random() * (this.worldSize - 30);
            const y = Math.random() * (this.worldSize - 30);
            const size = 15 + Math.random() * 15; // Larger deposits (15-30)
            
            // Calculate resources for veins (they're much richer!)
            const resources = Math.ceil(size * 3); // Resource veins have 3x resource multiplier
            
            const color = [
                Math.floor(Math.random() * 128),
                Math.floor(Math.random() * 128),
                Math.floor(Math.random() * 128),
                255
            ];

            const resourceVein = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, y, size, size),
                fill: color,
                onClick: (clickPlayerId) => {
                    console.log(`Player ${clickPlayerId} clicked resource vein at (${x}, ${y}) with ${resources} resources remaining`);
                }
            });

            // Store resource vein data - resource text will be created dynamically in views
            const veinData = { x, y, size, color, resources, node: resourceVein };
            this.landmarks.push(veinData);
            worldBase.addChild(resourceVein);

            // Resource veins always get guards (they're valuable!)
            const numGuards = Math.floor(size / 3); // More guards per size for veins
            this.spawnGuardsAroundPool(veinData, numGuards, worldBase);
        }

        this.getPlane().addChild(worldBase);
    }

    spawnGuardsAroundPool(poolData, numGuards, worldBase) {
        const poolCenterX = poolData.x + poolData.size / 2;
        const poolCenterY = poolData.y + poolData.size / 2;
        const guardDistance = poolData.size * 0.8 + 6; // Distance from pool center
        const guardSize = 4; // Size of guard squares

        for (let i = 0; i < numGuards; i++) {
            // Arrange guards in a circle around the pool
            const angle = (i / numGuards) * 2 * Math.PI;
            const guardX = poolCenterX + Math.cos(angle) * guardDistance - guardSize / 2;
            const guardY = poolCenterY + Math.sin(angle) * guardDistance - guardSize / 2;

            // Make sure guards stay within world bounds
            const clampedX = Math.max(0, Math.min(this.worldSize - guardSize, guardX));
            const clampedY = Math.max(0, Math.min(this.worldSize - guardSize, guardY));

            const guard = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(clampedX, clampedY, guardSize, guardSize),
                fill: [200, 0, 0, 255], // Red guards
                onClick: (clickPlayerId) => {
                    console.log(`Player ${clickPlayerId} clicked guard at (${clampedX}, ${clampedY})`);
                }
            });

            const guardData = {
                x: clampedX,
                y: clampedY,
                size: guardSize,
                poolData: poolData, // Reference to the pool they're guarding
                node: guard
            };

            this.guards.push(guardData);
            worldBase.addChild(guard);
        }
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
        
        // Add dynamic resource text for pools and veins visible in this view
        this.addResourceTextToView(viewRoot, view);
        
        // Click layer is now handled separately, no need to add it here
        
        // Add player to the view
        this.addPlayerToView(playerId, viewRoot, view);
        
        return viewRoot;
    }

    addResourceTextToView(viewRoot, view) {
        // Add resource text for resource pools visible in this view
        for (const resourcePool of this.worldItems) {
            // Check if resource pool is visible in current view
            if (resourcePool.x + resourcePool.size >= view.x && resourcePool.x <= view.x + view.w &&
                resourcePool.y + resourcePool.size >= view.y && resourcePool.y <= view.y + view.h) {
                
                // Convert world coordinates to view coordinates
                const viewX = resourcePool.x + resourcePool.size/2 - view.x;
                const viewY = resourcePool.y - 1 - view.y;
                
                // Choose color based on resource status
                const textColor = resourcePool.resources <= 0 ? [100, 100, 100, 255] : [0, 200, 0, 255]; // Green for resources
                const resourceValue = Math.max(0, resourcePool.resources);
                
                const resourceText = new GameNode.Text({
                    textInfo: {
                        x: viewX,
                        y: viewY,
                        color: textColor,
                        text: resourceValue.toString(),
                        align: 'center',
                        size: Math.max(1, resourcePool.size/4)
                    }
                });
                
                viewRoot.addChild(resourceText);
            }
        }
        
        // Add resource text for resource veins visible in this view
        for (const resourceVein of this.landmarks) {
            // Check if resource vein is visible in current view
            if (resourceVein.x + resourceVein.size >= view.x && resourceVein.x <= view.x + view.w &&
                resourceVein.y + resourceVein.size >= view.y && resourceVein.y <= view.y + view.h) {
                
                // Convert world coordinates to view coordinates
                const viewX = resourceVein.x + resourceVein.size/2 - view.x;
                const viewY = resourceVein.y - 2 - view.y;
                
                // Choose color based on resource status
                const textColor = resourceVein.resources <= 0 ? [100, 100, 100, 255] : [0, 200, 0, 255]; // Green for resources
                const resourceValue = Math.max(0, resourceVein.resources);
                
                const resourceText = new GameNode.Text({
                    textInfo: {
                        x: viewX,
                        y: viewY,
                        color: textColor,
                        text: resourceValue.toString(),
                        align: 'center',
                        size: Math.max(2, resourceVein.size/6)
                    }
                });
                
                viewRoot.addChild(resourceText);
            }
        }
        
        // Add gather indicators visible in this view
        const currentTime = Date.now();
        for (const indicator of this.gatherIndicators) {
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
                
                const gatherText = new GameNode.Text({
                    textInfo: {
                        x: viewX,
                        y: viewY,
                        color: [255, 255, 0, alpha], // Yellow text that fades out
                        text: `+${indicator.gathered}`,
                        align: 'center',
                        size: 2
                    }
                });
                
                viewRoot.addChild(gatherText);
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
            lastGatherTime: 0 // Track last gathering time for cooldown
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

    gatherResources() {
        // Roll for gathering efficiency: 25% chance each for 1, 2, 3, or 4 resources
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

    findGatherTarget(player) {
        // Check resource pools first
        for (const resourcePool of this.worldItems) {
            if (resourcePool.resources <= 0) continue; // Skip depleted pools
            
            const distance = this.calculateDistanceToRectangle(
                player.x, player.y,
                resourcePool.x, resourcePool.y, resourcePool.size, resourcePool.size
            );
            
            if (distance <= this.gatherRange) {
                return { target: resourcePool, type: 'pool' };
            }
        }
        
        // Check resource veins
        for (const resourceVein of this.landmarks) {
            if (resourceVein.resources <= 0) continue; // Skip depleted veins
            
            const distance = this.calculateDistanceToRectangle(
                player.x, player.y,
                resourceVein.x, resourceVein.y, resourceVein.size, resourceVein.size
            );
            
            if (distance <= this.gatherRange) {
                return { target: resourceVein, type: 'vein' };
            }
        }
        
        return null; // No gathering targets in range
    }

    gatherFrom(target, playerId) {
        const gathered = this.gatherResources();
        target.resources -= gathered;
        
        console.log(`Player ${playerId} gathered ${gathered} resources! Remaining: ${target.resources}`);
        
        // Create gather indicator at random position near the target
        const indicatorX = target.x + (Math.random() * target.size);
        const indicatorY = target.y + (Math.random() * target.size);
        
        const gatherIndicator = {
            x: indicatorX,
            y: indicatorY,
            gathered: gathered,
            createdAt: Date.now(),
            duration: 1000 // Show for 1 second
        };
        
        this.gatherIndicators.push(gatherIndicator);
        
        if (target.resources <= 0) {
            // Resource depleted
            target.resources = 0; // Ensure it doesn't go negative
            console.log(`Resource source depleted!`);
        }
        
        // Resource text will be updated automatically when view refreshes
        // No need to manually update text nodes since they're created dynamically
    }

    tick() {
        const currentTime = Date.now();
        
        // Clean up expired gather indicators
        this.gatherIndicators = this.gatherIndicators.filter(indicator => 
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
            
            // Check for gathering targets (with cooldown)
            if (currentTime - player.lastGatherTime >= this.gatherCooldown) {
                const gatherResult = this.findGatherTarget(player);
                if (gatherResult) {
                    this.gatherFrom(gatherResult.target, playerId);
                    player.lastGatherTime = currentTime;
                    needsViewUpdate = true; // Need to update view to show new resource values
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