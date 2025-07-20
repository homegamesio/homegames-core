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
        this.archers = []; // Track archer enemies (purple, ranged)
        this.projectiles = []; // Track active projectiles
        
        this.viewSize = 100; // Size of each player's view
        this.worldSize = 800;
        this.playerSize = 3;
        this.playerSpeed = 0.2; // Very small moves for ultra-smooth movement (matching view-test)
        this.gatherRange = 6; // Player gathering range
        this.gatherCooldown = 300; // Time between gathering attempts
        this.gatherIndicators = []; // Store active resource gathering indicators
        
        // Player attack settings
        this.attackRange = 2; // Player attack range (closer than gathering)
        this.attackDamage = 5; // Player attack damage
        this.attackCooldown = 400; // Time between player attacks
        this.attackIndicators = []; // Store attack damage indicators
        
        // Enemy/combat settings
        this.enemyDetectionRange = 20; // Guards detect player within this range (doubled)
        this.enemyAttackRange = 3; // Guards attack when this close to player
        this.enemyAttackCooldown = 500; // Time between enemy attacks
        this.enemySpeed = 0.15; // Enemy movement speed (slightly slower than player)
        this.damageIndicators = []; // Store damage indicators for player
        
        // Archer settings
        this.archerHealth = 5; // Archers have less health than guards
        this.archerDamage = 0.5; // Weaker melee attacks
        this.archerProjectileRange = 15; // Range for shooting projectiles
        this.archerProjectileCooldown = 800; // Time between projectile shots
        this.projectileSpeed = 0.2; // Speed of projectiles
        this.projectileDamage = 1; // Damage per projectile hit
        this.projectileSize = 2; // Size of projectile squares
        
        // Game state and timer
        this.gameState = 'playing'; // 'playing', 'gameOver', 'dead'
        this.gameTimer = 60000; // 60 seconds in milliseconds
        this.gameStartTime = Date.now();
        this.lastViewUpdate = 0; // Track when we last updated views for smooth visuals
        
        // Stats tracking
        this.currentStats = {
            resourcesCollected: 0,
            enemiesKilled: 0,
            timeAlive: 0
        };
        this.previousStats = {
            resourcesCollected: 0,
            enemiesKilled: 0,
            timeAlive: 0
        };
        
        // Player upgrade system
        this.upgrades = {
            moveSpeed: 0,    // 0-5 levels
            attackDamage: 0, // 0-5 levels
            attackRange: 0,  // 0-5 levels
            health: 0        // 0-5 levels
        };
        this.upgradeBaseCost = 5; // Cost per upgrade
        this.upgradeBonus = 0.2;  // 20% increase per level
        this.maxUpgradeLevel = 5; // Maximum upgrade level
        
        // Base stats (before upgrades)
        this.basePlayerSpeed = 0.3;
        this.baseAttackDamage = 5;
        this.baseAttackRange = 2;
        this.basePlayerHealth = 100;

        // Apply upgrades to current stats
        this.applyUpgrades();
        
        this.initializeWorld();
    }
    
    applyUpgrades() {
        // Calculate actual stats based on base stats + upgrades
        this.playerSpeed = this.basePlayerSpeed * (1 + this.upgrades.moveSpeed * this.upgradeBonus);
        this.attackDamage = Math.round(this.baseAttackDamage * (1 + this.upgrades.attackDamage * this.upgradeBonus));
        this.attackRange = this.baseAttackRange * (1 + this.upgrades.attackRange * this.upgradeBonus);
        this.playerMaxHealth = Math.round(this.basePlayerHealth * (1 + this.upgrades.health * this.upgradeBonus));
    }
    
    getUpgradeCost(upgradeType) {
        const currentLevel = this.upgrades[upgradeType];
        if (currentLevel >= this.maxUpgradeLevel) return null; // Max level reached
        return this.upgradeBaseCost;
    }
    
    canAffordUpgrade(upgradeType, playerScore) {
        const cost = this.getUpgradeCost(upgradeType);
        return cost !== null && playerScore >= cost;
    }
    
    purchaseUpgrade(upgradeType, player) {
        const cost = this.getUpgradeCost(upgradeType);
        if (cost === null || player.score < cost) return false;
        
        this.upgrades[upgradeType]++;
        player.score -= cost;
        this.applyUpgrades();
        
        console.log(`Upgraded ${upgradeType} to level ${this.upgrades[upgradeType]}! Cost: ${cost} points.`);
        return true;
    }

    initializeWorld() {
        // Create world background
        this.worldBase = new GameNode.Shape({
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
                    this.worldBase.addChild(tile);
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
            this.worldBase.addChild(resourcePool);

            // Spawn guards for medium to large resource pools
            if (size >= 8) { // Medium/large pools get guards
                const numGuards = Math.floor(size / 4); // More guards for larger pools
                this.spawnGuardsAroundPool(poolData, numGuards);
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
            this.worldBase.addChild(resourceVein);

            // Resource veins always get guards (they're valuable!)
            const numGuards = Math.floor(size / 3); // More guards per size for veins
            this.spawnGuardsAroundPool(veinData, numGuards);
        }

        this.getPlane().addChild(this.worldBase);
    }

    spawnGuardsAroundPool(poolData, numGuards) {
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

            // 30% chance to spawn archer, 70% chance for regular guard
            const isArcher = Math.random() < 0.3;
            
            if (isArcher) {
                this.spawnArcher(clampedX, clampedY, guardSize, poolData);
            } else {
                this.spawnGuard(clampedX, clampedY, guardSize, poolData);
            }
        }
    }
    
    spawnGuard(x, y, size, poolData) {
        const guard = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, size, size),
            fill: [200, 0, 0, 255], // Red guards
            onClick: (clickPlayerId) => {
                console.log(`Player ${clickPlayerId} clicked guard at (${x}, ${y})`);
            }
        });

        const guardData = {
            x: x,
            y: y,
            size: size,
            poolData: poolData,
            node: guard,
            // AI state
            isChasing: false,
            targetPlayerId: null,
            lastAttackTime: 0,
            originalX: x,
            originalY: y,
            // Combat stats
            health: 10,
            maxHealth: 10,
            type: 'guard'
        };

        this.guards.push(guardData);
        this.worldBase.addChild(guard);
    }
    
    spawnArcher(x, y, size, poolData) {
        const archer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, size, size),
            fill: [150, 0, 150, 255], // Purple archers
            onClick: (clickPlayerId) => {
                console.log(`Player ${clickPlayerId} clicked archer at (${x}, ${y})`);
            }
        });

        const archerData = {
            x: x,
            y: y,
            size: size,
            poolData: poolData,
            node: archer,
            // AI state
            isChasing: false,
            targetPlayerId: null,
            lastAttackTime: 0,
            lastProjectileTime: 0,
            originalX: x,
            originalY: y,
            // Combat stats
            health: this.archerHealth,
            maxHealth: this.archerHealth,
            type: 'archer'
        };

        this.archers.push(archerData);
        this.worldBase.addChild(archer);
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
        
        console.log('player view is');
        console.log(newView);
        if (currentView.contentLayer) {
            // Clear only the content layer, leaving click layer intact
            currentView.contentLayer.node.clearChildren();
            currentView.contentLayer.node.addChild(newViewContent);
            currentView.contentLayer.node.onStateChange();
        }
        
        // Manage click layer based on game state
        const shouldHaveClickLayer = this.gameState === 'playing';
        
        console.log(`DEBUG: gameState=${this.gameState}, shouldHaveClickLayer=${shouldHaveClickLayer}, hasClickLayerFlag=${currentView.hasClickLayer}`);
        
        if (shouldHaveClickLayer && !currentView.hasClickLayer) {
            // Add click layer for movement during gameplay
            console.log(`DEBUG: Adding click layer for player ${playerId}`);
            currentView.viewRoot.addChild(currentView.clickLayer);
            currentView.hasClickLayer = true;
        } else if (!shouldHaveClickLayer && currentView.hasClickLayer) {
            // Remove click layer during game over so upgrade buttons work
            console.log(`DEBUG: Removing click layer for player ${playerId}`);
            try {
                console.log('ffifififi')
                console.log(currentView.viewRoot.node.children.map(child => child.node.id));
                console.log(currentView.clickLayer.node.id)
                currentView.viewRoot.removeChild(currentView.clickLayer.node.id);
                currentView.hasClickLayer = false;
                console.log(`DEBUG: Successfully removed click layer for player ${playerId}`);
                this.getViewRoot().node.onStateChange();
            } catch (e) {
                console.log(`DEBUG: Error removing click layer for player ${playerId}:`, e);
                // Try alternative removal method - completely rebuild the view structure
                currentView.viewRoot.node.clearChildren();
                currentView.viewRoot.addChild(currentView.contentLayer);
                currentView.hasClickLayer = false;
                console.log(`DEBUG: Used alternative removal method for player ${playerId} - view structure rebuilt without click layer`);
            }
        }
        
        // Update stored view coordinates
        this.playerViews[playerId].view = newView;
    }

    createPlayerView(playerId, view) {
        console.log('dsfsdf bls ' + playerId);
        console.log(playerId)
        if (this.gameState === 'gameOver' || this.gameState === 'dead') {
            // return new GameNode.Shape({
            //     shapeType: Shapes.POLYGON,
            //     coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            //     fill: [255, 0, 0, 255],
            //     // playerIds: [playerId],
            //     onClick: (clickPlayerId) => {
            //         console.log(`DEBUG: TEST BUTTON CLICKED! PlayerId: ${clickPlayerId}`);
            //     }
            // });
            // For game over, we need to create a view that can handle clicks properly
            const gameOverRoot = this.createGameOverView(playerId, view);
            return gameOverRoot;
        }
        
        const viewRoot = ViewUtils.getView(this.getPlane(), view, [playerId]);
        
        // Add dynamic resource text for pools and veins visible in this view
        this.addResourceTextToView(viewRoot, view);
        
        // Click layer is now handled separately, no need to add it here
        
        // Add all players to the view so they can see each other
        this.addAllPlayersToView(viewRoot, view);
        
        // Add guard health display to the view
        this.addGuardHealthToView(viewRoot, view, playerId);
        
        // Add timer display at top center
        this.addTimerToView(viewRoot, view, playerId);
        
        // Add projectiles to the view
        this.addProjectilesToView(viewRoot, view, playerId);
        
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
        
        // Add damage indicators visible in this view (player taking damage)
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
                        color: [255, 0, 0, alpha], // Red text that fades out
                        text: `-${indicator.damage}`,
                        align: 'center',
                        size: 2
                    }
                });
                
                viewRoot.addChild(damageText);
            }
        }
        
        // Add attack indicators visible in this view (player attacking enemies)
        for (const indicator of this.attackIndicators) {
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
                
                const attackText = new GameNode.Text({
                    textInfo: {
                        x: viewX,
                        y: viewY,
                        color: [255, 140, 0, alpha], // Orange text that fades out (distinct from red damage)
                        text: `-${indicator.damage}`,
                        align: 'center',
                        size: 2
                    }
                });
                
                viewRoot.addChild(attackText);
            }
        }
    }

    addProjectilesToView(viewRoot, view, playerId) {
        // Add projectiles visible in this view
        for (const projectile of this.projectiles) {
            // Check if projectile is visible in current view
            if (projectile.x + projectile.size >= view.x && projectile.x <= view.x + view.w &&
                projectile.y + projectile.size >= view.y && projectile.y <= view.y + view.h) {
                
                // Convert world coordinates to view coordinates
                const viewX = projectile.x - projectile.size/2 - view.x;
                const viewY = projectile.y - projectile.size/2 - view.y;
                
                const projectileNode = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(viewX, viewY, projectile.size, projectile.size),
                    fill: [255, 255, 0, 255], // Bright yellow projectiles
                    playerIds: [playerId]
                });
                
                viewRoot.addChild(projectileNode);
            }
        }
    }

    addTimerToView(viewRoot, view, playerId) {
        if (this.gameState !== 'playing') return; // Only show timer during active gameplay
        
        const timeRemaining = Math.max(0, this.gameTimer - (Date.now() - this.gameStartTime));
        const secondsLeft = Math.ceil(timeRemaining / 1000);
        
        const timerText = new GameNode.Text({
            textInfo: {
                x: 50, // Center of view
                y: 10, // Top of view
                color: secondsLeft <= 10 ? [255, 0, 0, 255] : [255, 255, 255, 255], // Red when low time
                text: `Time: ${secondsLeft}s`,
                align: 'center',
                size: 2.5
            },
            playerIds: [playerId]
        });
        
        viewRoot.addChild(timerText);
    }



    addGuardHealthToView(viewRoot, view, playerId) {
        // Add health text for guards visible in this view
        for (const guard of this.guards) {
            if (guard.health <= 0) continue; // Skip dead guards
            
            // Check if guard is visible in current view
            if (guard.x + guard.size >= view.x && guard.x <= view.x + view.w &&
                guard.y + guard.size >= view.y && guard.y <= view.y + view.h) {
                
                // Convert world coordinates to view coordinates
                const viewX = guard.x + guard.size/2 - view.x;
                const viewY = guard.y - 2 - view.y; // Above the guard
                
                // Color-code health
                const healthColor = guard.health <= 3 ? [255, 0, 0, 255] : // Red when low health
                                   guard.health <= 6 ? [255, 255, 0, 255] : // Yellow when medium health
                                   [0, 255, 0, 255]; // Green when healthy

                const guardHealthText = new GameNode.Text({
                    textInfo: {
                        x: viewX,
                        y: viewY,
                        color: healthColor,
                        text: `${guard.health}`,
                        align: 'center',
                        size: 1.2
                    },
                    playerIds: [playerId]
                });
                
                viewRoot.addChild(guardHealthText);
            }
        }
        
        // Add health text for archers visible in this view
        for (const archer of this.archers) {
            if (archer.health <= 0) continue; // Skip dead archers
            
            // Check if archer is visible in current view
            if (archer.x + archer.size >= view.x && archer.x <= view.x + view.w &&
                archer.y + archer.size >= view.y && archer.y <= view.y + view.h) {
                
                // Convert world coordinates to view coordinates
                const viewX = archer.x + archer.size/2 - view.x;
                const viewY = archer.y - 2 - view.y; // Above the archer
                
                // Color-code health (archers have lower max health)
                const healthColor = archer.health <= 1 ? [255, 0, 0, 255] : // Red when low health
                                   archer.health <= 3 ? [255, 255, 0, 255] : // Yellow when medium health
                                   [0, 255, 0, 255]; // Green when healthy

                const archerHealthText = new GameNode.Text({
                    textInfo: {
                        x: viewX,
                        y: viewY,
                        color: healthColor,
                        text: `${archer.health}`,
                        align: 'center',
                        size: 1.2
                    },
                    playerIds: [playerId]
                });
                
                viewRoot.addChild(archerHealthText);
            }
        }
    }

    addAllPlayersToView(viewRoot, view) {
        // Different colors for each player so they can distinguish each other
        const playerColors = [
            [0, 0, 0, 255],       // Black (player 1)
            [0, 0, 255, 255],     // Blue (player 2)  
            [255, 0, 0, 255],     // Red (player 3)
            [0, 255, 0, 255],     // Green (player 4)
            [255, 255, 0, 255],   // Yellow (player 5)
            [255, 0, 255, 255],   // Magenta (player 6)
            [0, 255, 255, 255],   // Cyan (player 7)
            [255, 128, 0, 255],   // Orange (player 8)
        ];

        let playerIndex = 0;
        for (const playerId in this.players) {
            const player = this.players[playerId];
            if (!player) continue;

            // Check if player is visible in current view
            if (player.x + this.playerSize/2 < view.x || player.x - this.playerSize/2 > view.x + view.w ||
                player.y + this.playerSize/2 < view.y || player.y - this.playerSize/2 > view.y + view.h) {
                continue; // Player is outside this view, skip
            }

            // Calculate player position relative to view
            const relativeX = player.x - view.x;
            const relativeY = player.y - view.y;

            // Get player color (cycle through colors if more than 8 players)
            const playerColor = playerColors[playerIndex % playerColors.length];

            const playerNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(
                    relativeX - this.playerSize/2, 
                    relativeY - this.playerSize/2, 
                    this.playerSize, 
                    this.playerSize
                ),
                fill: playerColor
                // No playerIds - all players can see each other
            });

            // Add health text below the player
            const healthColor = player.health <= 20 ? [255, 0, 0, 255] : // Red when low health
                               player.health <= 50 ? [255, 255, 0, 255] : // Yellow when medium health
                               [0, 255, 0, 255]; // Green when healthy

            const healthText = new GameNode.Text({
                textInfo: {
                    x: relativeX,
                    y: relativeY + this.playerSize/2 + 3, // Below the player
                    color: healthColor,
                    text: `P${playerIndex+1} ${player.health}/${player.maxHealth} | Score: ${player.score}`,
                    align: 'center',
                    size: 1.5
                }
                // No playerIds - all players can see each other's health
            });

            viewRoot.addChild(playerNode);
            viewRoot.addChild(healthText);
            
            playerIndex++;
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
            // playerIds: [playerId]
        });

        // Add health text below the player
        const healthColor = player.health <= 20 ? [255, 0, 0, 255] : // Red when low health
                           player.health <= 50 ? [255, 255, 0, 255] : // Yellow when medium health
                           [0, 255, 0, 255]; // Green when healthy

        const healthText = new GameNode.Text({
            textInfo: {
                x: relativeX,
                y: relativeY + this.playerSize/2 + 3, // Below the player
                color: healthColor,
                text: `${player.health}/${player.maxHealth} | Score: ${player.score}`,
                align: 'center',
                size: 1.5
            },
            playerIds: [playerId]
        });

        viewRoot.addChild(playerNode);
        viewRoot.addChild(healthText);
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
            
            // Set target far in the direction to maintain constant speed
            const moveDistance = 50; // Set target 50 units away for continuous movement

            if (key === 'w') targetY -= moveDistance;
            if (key === 's') targetY += moveDistance;
            if (key === 'a') targetX -= moveDistance;
            if (key === 'd') targetX += moveDistance;

            // Keep target within world bounds
            targetX = Math.max(this.playerSize/2, Math.min(this.worldSize - this.playerSize/2, targetX));
            targetY = Math.max(this.playerSize/2, Math.min(this.worldSize - this.playerSize/2, targetY));

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
            lastGatherTime: 0, // Track last gathering time for cooldown
            lastAttackTime: 0, // Track last attack time for cooldown
            health: this.playerMaxHealth, // Player health (upgraded)
            maxHealth: this.playerMaxHealth,
            score: 0 // Kill score
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

        // Add content layer first
        stableWrapper.addChild(contentLayer);
        
        // Only add click layer if game is playing (movement clicks)
        let hasClickLayer = false;
        if (this.gameState === 'playing') {
            stableWrapper.addChild(clickLayer);
            hasClickLayer = true;
        }

        this.playerViews[playerId] = {
            view: initialView,
            viewRoot: stableWrapper,
            contentLayer: contentLayer,
            clickLayer: clickLayer,
            hasClickLayer: hasClickLayer
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
        this.currentStats.resourcesCollected += gathered;
        
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

    updateEnemyAI(currentTime) {
        // Update regular guards
        for (const guard of this.guards) {
            if (guard.health <= 0) continue; // Skip dead guards
            this.updateGuardAI(guard, currentTime);
        }
        
        // Update archers
        for (const archer of this.archers) {
            if (archer.health <= 0) continue; // Skip dead archers
            this.updateArcherAI(archer, currentTime);
        }
    }
    
    updateGuardAI(guard, currentTime) {
        let closestPlayer = null;
        let closestDistance = Infinity;

        // Find the closest player within detection range
        for (const playerId in this.players) {
            const player = this.players[playerId];
            const distance = this.calculateDistance(guard.x + guard.size/2, guard.y + guard.size/2, player.x, player.y);
            
            if (distance <= this.enemyDetectionRange && distance < closestDistance) {
                closestPlayer = player;
                closestDistance = distance;
                guard.targetPlayerId = playerId;
            }
        }

        if (closestPlayer) {
            // Start chasing if not already
            if (!guard.isChasing) {
                guard.isChasing = true;
                console.log(`Guard starts chasing player ${guard.targetPlayerId}!`);
            }

            // Move towards the player
            this.moveGuardTowards(guard, closestPlayer.x, closestPlayer.y);

            // Attack if within range and cooldown is ready
            if (closestDistance <= this.enemyAttackRange && 
                currentTime - guard.lastAttackTime >= this.enemyAttackCooldown) {
                this.guardAttackPlayer(guard, closestPlayer, guard.targetPlayerId);
                guard.lastAttackTime = currentTime;
            }
        } else {
            // No player in range, but guards never stop hunting once they've started chasing
            if (guard.isChasing) {
                // Keep hunting! Guards remember the last known player position and patrol
                console.log(`Guard continues hunting...`);
                // Optionally add patrolling behavior here in the future
            } else {
                // Guard hasn't detected anyone yet, stay at post
                // Only return to post if they've never chased anyone
                this.moveGuardTowards(guard, guard.originalX + guard.size/2, guard.originalY + guard.size/2);
            }
        }
    }
    
    updateArcherAI(archer, currentTime) {
        let closestPlayer = null;
        let closestDistance = Infinity;

        // Find the closest player within detection range
        for (const playerId in this.players) {
            const player = this.players[playerId];
            const distance = this.calculateDistance(archer.x + archer.size/2, archer.y + archer.size/2, player.x, player.y);
            
            if (distance <= this.enemyDetectionRange && distance < closestDistance) {
                closestPlayer = player;
                closestDistance = distance;
                archer.targetPlayerId = playerId;
            }
        }

        if (closestPlayer) {
            // Start chasing if not already
            if (!archer.isChasing) {
                archer.isChasing = true;
                console.log(`Archer starts chasing player ${archer.targetPlayerId}!`);
            }

            // Archers move towards player but also try to maintain some distance
            if (closestDistance > this.enemyAttackRange + 2) {
                this.moveGuardTowards(archer, closestPlayer.x, closestPlayer.y);
            }

            // Shoot projectile if within range and cooldown is ready
            if (closestDistance <= this.archerProjectileRange && 
                currentTime - archer.lastProjectileTime >= this.archerProjectileCooldown) {
                this.archerShootProjectile(archer, closestPlayer, archer.targetPlayerId);
                archer.lastProjectileTime = currentTime;
            }
            
            // Melee attack if player gets too close
            if (closestDistance <= this.enemyAttackRange && 
                currentTime - archer.lastAttackTime >= this.enemyAttackCooldown) {
                this.archerAttackPlayer(archer, closestPlayer, archer.targetPlayerId);
                archer.lastAttackTime = currentTime;
            }
        } else {
            // No player in range, but archers never stop hunting once they've started chasing
            if (archer.isChasing) {
                // Keep hunting!
                console.log(`Archer continues hunting...`);
            } else {
                // Archer hasn't detected anyone yet, stay at post
                this.moveGuardTowards(archer, archer.originalX + archer.size/2, archer.originalY + archer.size/2);
            }
        }
    }

    moveGuardTowards(guard, targetX, targetY) {
        const guardCenterX = guard.x + guard.size/2;
        const guardCenterY = guard.y + guard.size/2;
        
        const distance = this.calculateDistance(guardCenterX, guardCenterY, targetX, targetY);
        
        if (distance > 1) { // Only move if not already at target
            const angle = Math.atan2(targetY - guardCenterY, targetX - guardCenterX);
            const newX = guard.x + Math.cos(angle) * this.enemySpeed;
            const newY = guard.y + Math.sin(angle) * this.enemySpeed;
            
            // Keep guard within world bounds
            guard.x = Math.max(0, Math.min(this.worldSize - guard.size, newX));
            guard.y = Math.max(0, Math.min(this.worldSize - guard.size, newY));
            
            // Update the visual node position
            guard.node.node.coordinates2d = ShapeUtils.rectangle(guard.x, guard.y, guard.size, guard.size);
        }
    }

    guardAttackPlayer(guard, player, playerId) {
        const damage = 1; // Guards always do 1 damage
        player.health -= damage;
        
        console.log(`Guard attacks player ${playerId} for ${damage} damage! Player health: ${player.health}`);
        
        // Create damage indicator near the player
        const indicatorX = player.x + (Math.random() * 4 - 2); // Small random offset
        const indicatorY = player.y + (Math.random() * 4 - 2);
        
        const damageIndicator = {
            x: indicatorX,
            y: indicatorY,
            damage: damage,
            createdAt: Date.now(),
            duration: 1000,
            playerId: playerId // Track which player this belongs to
        };
        
        this.damageIndicators.push(damageIndicator);
        
        if (player.health <= 0) {
            player.health = 0;
            console.log(`Player ${playerId} has been defeated!`);
            // TODO: Handle player death
        }
    }
    
    archerAttackPlayer(archer, player, playerId) {
        const damage = this.archerDamage; // Archers do less melee damage
        player.health -= damage;
        
        console.log(`Archer melee attacks player ${playerId} for ${damage} damage! Player health: ${player.health}`);
        
        // Create damage indicator near the player
        const indicatorX = player.x + (Math.random() * 4 - 2);
        const indicatorY = player.y + (Math.random() * 4 - 2);
        
        const damageIndicator = {
            x: indicatorX,
            y: indicatorY,
            damage: damage,
            createdAt: Date.now(),
            duration: 1000,
            playerId: playerId
        };
        
        this.damageIndicators.push(damageIndicator);
        
        if (player.health <= 0) {
            player.health = 0;
            console.log(`Player ${playerId} has been defeated!`);
        }
    }
    
    archerShootProjectile(archer, player, playerId) {
        console.log(`Archer shoots projectile at player ${playerId}!`);
        
        // Calculate direction to player
        const archerCenterX = archer.x + archer.size/2;
        const archerCenterY = archer.y + archer.size/2;
        const angle = Math.atan2(player.y - archerCenterY, player.x - archerCenterX);
        
        // Create projectile
        const projectile = {
            x: archerCenterX,
            y: archerCenterY,
            velocityX: Math.cos(angle) * this.projectileSpeed,
            velocityY: Math.sin(angle) * this.projectileSpeed,
            size: this.projectileSize,
            damage: this.projectileDamage,
            createdAt: Date.now(),
            targetPlayerId: playerId
        };
        
        this.projectiles.push(projectile);
    }

    findAttackTarget(player) {
        // Find the closest enemy (guard or archer) within attack range
        let closestEnemy = null;
        let closestDistance = Infinity;
        
        // Check guards
        for (const guard of this.guards) {
            if (guard.health <= 0) continue; // Skip dead guards
            
            const guardCenterX = guard.x + guard.size/2;
            const guardCenterY = guard.y + guard.size/2;
            const distance = this.calculateDistance(player.x, player.y, guardCenterX, guardCenterY);
            
            if (distance <= this.attackRange && distance < closestDistance) {
                closestEnemy = guard;
                closestDistance = distance;
            }
        }
        
        // Check archers
        for (const archer of this.archers) {
            if (archer.health <= 0) continue; // Skip dead archers
            
            const archerCenterX = archer.x + archer.size/2;
            const archerCenterY = archer.y + archer.size/2;
            const distance = this.calculateDistance(player.x, player.y, archerCenterX, archerCenterY);
            
            if (distance <= this.attackRange && distance < closestDistance) {
                closestEnemy = archer;
                closestDistance = distance;
            }
        }
        
        return closestEnemy;
    }
    
    playerAttack(enemy, playerId, player) {
        const damage = this.attackDamage;
        enemy.health -= damage;
        
        const enemyType = enemy.type || 'guard';
        console.log(`Player ${playerId} attacks ${enemyType} for ${damage} damage! ${enemyType} health: ${enemy.health}`);
        
        // Create attack indicator near the enemy
        const indicatorX = enemy.x + enemy.size/2 + (Math.random() * 4 - 2); // Small random offset
        const indicatorY = enemy.y + enemy.size/2 + (Math.random() * 4 - 2);
        
        const attackIndicator = {
            x: indicatorX,
            y: indicatorY,
            damage: damage,
            createdAt: Date.now(),
            duration: 1000, // Show for 1 second
        };
        
        this.attackIndicators.push(attackIndicator);
        
        // Check if enemy is dead
        if (enemy.health <= 0) {
            enemy.health = 0;
            console.log(`${enemyType} has been defeated!`);
            this.removeDeadEnemy(enemy, player);
        }
    }
    
    removeDeadGuard(deadGuard, player) {
        // Remove from world base (where guards were added)
        this.worldBase.removeChild(deadGuard.node.node.id);
        
        // Remove from guards array
        const index = this.guards.indexOf(deadGuard);
        if (index > -1) {
            this.guards.splice(index, 1);
        }
        
        // Award kill point to player
        player.score += 1;
        this.currentStats.enemiesKilled += 1;
        console.log(`Guard defeated and removed. Player score: ${player.score}. Remaining guards: ${this.guards.length}`);
    }
    
    removeDeadEnemy(deadEnemy, player) {
        // Remove from world base
        this.worldBase.removeChild(deadEnemy.node.node.id);
        
        // Remove from appropriate array based on enemy type
        if (deadEnemy.type === 'archer') {
            const index = this.archers.indexOf(deadEnemy);
            if (index > -1) {
                this.archers.splice(index, 1);
            }
            console.log(`Archer defeated and removed. Remaining archers: ${this.archers.length}`);
        } else {
            const index = this.guards.indexOf(deadEnemy);
            if (index > -1) {
                this.guards.splice(index, 1);
            }
            console.log(`Guard defeated and removed. Remaining guards: ${this.guards.length}`);
        }
        
        // Award kill point to player
        player.score += 1;
        this.currentStats.enemiesKilled += 1;
        console.log(`Player score: ${player.score}`);
    }

    createGameOverView(playerId, view) {
        console.log(`DEBUG: Creating game over view for player ${playerId}, gameState=${this.gameState}`);
        const viewRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [40, 40, 40, 255], // Dark gray background
            // playerIds: [playerId]
        });

        // Title
        const title = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 20,
                color: this.gameState === 'dead' ? [255, 0, 0, 255] : [255, 255, 0, 255],
                text: this.gameState === 'dead' ? 'YOU DIED!' : 'TIME UP!',
                align: 'center',
                size: 3
            },
            // playerIds: [playerId]
        });

        // Current stats
        const player = this.players[playerId];
        const finalScore = player ? player.score : 0;
        const timeAlive = Math.floor((Date.now() - this.gameStartTime) / 1000);

        const scoreText = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 35,
                color: [255, 255, 255, 255],
                text: `Final Score: ${finalScore}`,
                align: 'center',
                size: 2
            },
            // playerIds: [playerId]
        });

        const resourcesText = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 45,
                color: [255, 255, 255, 255],
                text: `Resources Collected: ${this.currentStats.resourcesCollected}`,
                align: 'center',
                size: 1.5
            },
            // playerIds: [playerId]
        });

        const timeText = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 55,
                color: [255, 255, 255, 255],
                text: `Time Survived: ${timeAlive}s`,
                align: 'center',
                size: 1.5
            },
            // playerIds: [playerId]
        });



        // Create clean upgrade section
        const upgradeElements = this.createUpgradeElements(playerId, player, finalScore);

        // Play Again button - moved higher up
        const playAgainButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(25, 85, 50, 8),
            fill: [0, 180, 0, 255],
            // border: { color: [255, 255, 255, 255], width: 1 },
            onClick: (clickPlayerId) => {
                console.log(`DEBUG: Play Again button clicked! PlayerId: ${clickPlayerId}, Target: ${playerId}`);
                if (Number(clickPlayerId) === Number(playerId)) {
                    console.log('Play Again clicked!');
                    this.resetGame();
                }
            },
            // playerIds: [playerId]
        });

        const playAgainText = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 89,
                color: [255, 255, 255, 255],
                text: 'PLAY AGAIN',
                align: 'center',
                size: 2.5
            },
            // playerIds: [playerId]
        });

        viewRoot.addChild(title);
        viewRoot.addChild(scoreText);
        viewRoot.addChild(resourcesText);
        viewRoot.addChild(timeText);
        
        // Add a simple test button to see if clicks work at all
        // const testButton = new GameNode.Shape({
        //     shapeType: Shapes.POLYGON,
        //     coordinates2d: ShapeUtils.rectangle(10, 10, 30, 10),
        //     fill: [255, 0, 255, 255], // Bright magenta
        //     onClick: (clickPlayerId) => {
        //         console.log(`DEBUG: TEST BUTTON CLICKED! PlayerId: ${clickPlayerId}`);
        //         alert('Test button works!');
        //     },
        //     playerIds: [playerId]
        // });
        // viewRoot.addChild(testButton);
        
        // const testButtonText = new GameNode.Text({
        //     textInfo: {
        //         x: 25,
        //         y: 15,
        //         color: [255, 255, 255, 255],
        //         text: 'TEST CLICK',
        //         align: 'center',
        //         size: 2
        //     },
        //     playerIds: [playerId]
        // });
        // viewRoot.addChild(testButtonText);
        
        // Add all upgrade elements
        upgradeElements.forEach(element => viewRoot.addChild(element));
        
        viewRoot.addChild(playAgainButton);
        viewRoot.addChild(playAgainText);



        return viewRoot;
    }
    
    createUpgradeElements(playerId, player, playerScore) {
        const elements = [];
        
        // Add upgrade section title
        const upgradeTitle = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 62,
                color: [255, 255, 100, 255],
                text: `UPGRADES (${playerScore} points available)`,
                align: 'center',
                size: 2.0
            },
            // playerIds: [playerId]
        });
        elements.push(upgradeTitle);
        
        const upgrades = [
            { 
                name: 'moveSpeed', 
                displayName: 'SPEED', 
                currentValue: this.playerSpeed.toFixed(2),
                baseValue: this.basePlayerSpeed,
                icon: '⚡'
            },
            { 
                name: 'attackDamage', 
                displayName: 'DAMAGE', 
                currentValue: this.attackDamage,
                baseValue: this.baseAttackDamage,
                icon: '⚔️'
            },
            { 
                name: 'attackRange', 
                displayName: 'RANGE', 
                currentValue: this.attackRange.toFixed(1),
                baseValue: this.baseAttackRange,
                icon: '🎯'
            },
            { 
                name: 'health', 
                displayName: 'HEALTH', 
                currentValue: this.playerMaxHealth,
                baseValue: this.basePlayerHealth,
                icon: '❤️'
            }
        ];
        
        upgrades.forEach((upgrade, index) => {
            const yPos = 66 + index * 4; // Tighter spacing to fit in view
            const currentLevel = this.upgrades[upgrade.name];
            const cost = this.getUpgradeCost(upgrade.name);
            const canAfford = cost !== null && playerScore >= cost;
            const isMaxLevel = currentLevel >= this.maxUpgradeLevel;
            
            // Simple upgrade row
            const upgradeText = new GameNode.Text({
                textInfo: {
                    x: 15,
                    y: yPos,
                    color: [255, 255, 255, 255],
                    text: `${upgrade.displayName}: ${upgrade.currentValue} [${currentLevel}/${this.maxUpgradeLevel}]`,
                    align: 'left',
                    size: 1.3
                },
                // playerIds: [playerId]
            });
            elements.push(upgradeText);
            
            // Upgrade button
            if (!isMaxLevel) {
                const buttonColor = canAfford ? [0, 150, 0, 255] : [80, 80, 80, 255];
                const button = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(75, yPos - 1, 10, 2.5),
                    fill: buttonColor,
                    onClick: (clickPlayerId) => {
                        console.log(`DEBUG: Upgrade button clicked! PlayerId: ${clickPlayerId}, Target: ${playerId}, Upgrade: ${upgrade.name}, canAfford: ${canAfford}, currentLevel: ${currentLevel}`);
                        if (Number(clickPlayerId) === Number(playerId) && canAfford && currentLevel < this.maxUpgradeLevel) {
                            console.log(`Upgrade ${upgrade.name} clicked!`);
                            if (this.purchaseUpgrade(upgrade.name, player)) {
                                this.updatePlayerView(playerId);
                            }
                        }
                    },
                    // playerIds: [playerId]
                });
                elements.push(button);
                
                const buttonText = new GameNode.Text({
                    textInfo: {
                        x: 80,
                        y: yPos,
                        color: [255, 255, 255, 255],
                        text: canAfford ? '+5' : 'X',
                        align: 'center',
                        size: 1.0
                    },
                    // playerIds: [playerId]
                });
                elements.push(buttonText);
            } else {
                const maxText = new GameNode.Text({
                    textInfo: {
                        x: 80,
                        y: yPos,
                        color: [255, 215, 0, 255],
                        text: 'MAX',
                        align: 'center',
                        size: 1.0
                    },
                    // playerIds: [playerId]
                });
                elements.push(maxText);
            }
        });
        
        return elements;
    }

    resetGame() {
        // Save current stats as previous stats
        this.previousStats = {
            resourcesCollected: this.currentStats.resourcesCollected,
            enemiesKilled: this.currentStats.enemiesKilled,
            timeAlive: Math.floor((Date.now() - this.gameStartTime) / 1000)
        };

        // Reset current stats
        this.currentStats = {
            resourcesCollected: 0,
            enemiesKilled: 0,
            timeAlive: 0
        };

        // Reset game state
        this.gameState = 'playing';
        this.gameStartTime = Date.now();
        this.lastViewUpdate = 0; // Reset view update tracking
        
        // Reapply upgrades (they persist between rounds)
        this.applyUpgrades();

        // Reset all players
        Object.keys(this.players).forEach(playerId => {
            this.players[playerId].health = this.playerMaxHealth;
            this.players[playerId].maxHealth = this.playerMaxHealth;
            this.players[playerId].score = 0;
            this.players[playerId].x = this.worldSize / 2;
            this.players[playerId].y = this.worldSize / 2;
            this.players[playerId].targetX = this.worldSize / 2;
            this.players[playerId].targetY = this.worldSize / 2;
            this.players[playerId].moving = false;
            this.players[playerId].lastGatherTime = 0;
            this.players[playerId].lastAttackTime = 0;
        });

        // Clear existing world
        this.getPlane().clearChildren();
        this.worldItems = [];
        this.landmarks = [];
        this.guards = [];
        this.archers = [];
        this.projectiles = [];
        this.gatherIndicators = [];
        this.damageIndicators = [];
        this.attackIndicators = [];

        // Rebuild world
        this.initializeWorld();

        // Update all player views
        this.updateAllPlayerViews();
        
        console.log('Game reset! New game started.');
    }
    
    updateProjectiles(currentTime) {
        // Update projectile positions and check for collisions
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            
            // Move projectile
            projectile.x += projectile.velocityX;
            projectile.y += projectile.velocityY;
            
            // Check if projectile is out of bounds (remove old projectiles)
            if (projectile.x < 0 || projectile.x > this.worldSize ||
                projectile.y < 0 || projectile.y > this.worldSize ||
                currentTime - projectile.createdAt > 5000) { // 5 second max lifetime
                this.projectiles.splice(i, 1);
                continue;
            }
            
            // Check collision with players
            for (const playerId in this.players) {
                const player = this.players[playerId];
                const distance = this.calculateDistance(projectile.x, projectile.y, player.x, player.y);
                
                if (distance <= this.playerSize/2 + projectile.size/2) {
                    // Projectile hit player
                    player.health -= projectile.damage;
                    
                    console.log(`Projectile hits player ${playerId} for ${projectile.damage} damage! Player health: ${player.health}`);
                    
                    // Create damage indicator
                    const indicatorX = player.x + (Math.random() * 4 - 2);
                    const indicatorY = player.y + (Math.random() * 4 - 2);
                    
                    const damageIndicator = {
                        x: indicatorX,
                        y: indicatorY,
                        damage: projectile.damage,
                        createdAt: Date.now(),
                        duration: 1000,
                        playerId: playerId
                    };
                    
                    this.damageIndicators.push(damageIndicator);
                    
                    // Remove projectile after hit
                    this.projectiles.splice(i, 1);
                    break; // Exit player loop since projectile is removed
                }
            }
        }
    }

    updateAllPlayerViews() {
        Object.keys(this.players).forEach(playerId => {
            this.updatePlayerView(playerId);
        });
    }

    tick() {
        const currentTime = Date.now();
        
        // Check game over conditions
        if (this.gameState === 'playing') {
            // Check timer
            const timeRemaining = this.gameTimer - (currentTime - this.gameStartTime);
            if (timeRemaining <= 0) {
                this.gameState = 'gameOver';
                this.updateAllPlayerViews();
                return;
            }
            
            // Check player death
            for (const playerId in this.players) {
                const player = this.players[playerId];
                if (player.health <= 0) {
                    this.gameState = 'dead';
                    this.updateAllPlayerViews();
                    return;
                }
            }
        }
        
        // Don't update game logic if game is over
        if (this.gameState !== 'playing') {
            return;
        }
        
        // Update views regularly for smooth projectile movement and dynamic elements
        // Check if we need frequent updates for smooth visuals
        const hasActiveProjectiles = this.projectiles.length > 0;
        const hasMovingEnemies = this.archers.some(archer => archer.isChasing) || 
                                this.guards.some(guard => guard.isChasing);
        const needsFrequentUpdates = hasActiveProjectiles || hasMovingEnemies;
        
        // Use different update rates based on activity level
        const updateInterval = needsFrequentUpdates ? 33 : 200; // 30 FPS when active, 5 FPS when idle
        
        if (!this.lastViewUpdate || currentTime - this.lastViewUpdate >= updateInterval) {
            this.lastViewUpdate = currentTime;
            
            // Always update if there's activity, or periodically for timer
            const shouldUpdate = needsFrequentUpdates || 
                                (currentTime - this.gameStartTime) % 1000 < 100; // Timer updates
            
            if (shouldUpdate) {
                Object.keys(this.players).forEach(playerId => {
                    this.updatePlayerView(playerId);
                });
            }
        }
        
        // Clean up expired gather indicators
        this.gatherIndicators = this.gatherIndicators.filter(indicator => 
            currentTime - indicator.createdAt < indicator.duration
        );
        
        // Clean up expired damage indicators
        this.damageIndicators = this.damageIndicators.filter(indicator => 
            currentTime - indicator.createdAt < indicator.duration
        );
        
        // Clean up expired attack indicators
        this.attackIndicators = this.attackIndicators.filter(indicator => 
            currentTime - indicator.createdAt < indicator.duration
        );
        
        // Update projectiles
        this.updateProjectiles(currentTime);
        
        // Update enemy AI
        this.updateEnemyAI(currentTime);
        
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
            
            // Check for attack targets (with cooldown)
            if (currentTime - player.lastAttackTime >= this.attackCooldown) {
                const attackTarget = this.findAttackTarget(player);
                if (attackTarget) {
                    this.playerAttack(attackTarget, playerId, player);
                    player.lastAttackTime = currentTime;
                    needsViewUpdate = true; // Need to update view to show attack indicators
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