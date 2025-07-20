const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-136');
const { ExpiringSet, animations } = require('../../common/util');
const CombatSystem = require('./systems/CombatSystem');
const CombatConfig = require('./config/CombatConfig');
const LemonadeStandSystem = require('./systems/LemonadeStandSystem');
const LemonadeConfig = require('./config/LemonadeConfig');
const GameStateManager = require('./managers/GameStateManager');
const PlayerManager = require('./managers/PlayerManager');
const UIComponents = require('./utils/UIComponents');

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

        // Initialize managers
        this.gameStateManager = new GameStateManager(this);
        this.playerManager = new PlayerManager(this);
        
        // Initialize systems
        this.combatSystem = new CombatSystem(CombatConfig);
        this.lemonadeSystem = new LemonadeStandSystem(LemonadeConfig);
        
        // Initialize game configuration
        this.initializeGameConfig();
        this.initializeWorld();
    }
    
    initializeGameConfig() {
        this.keyCoolDowns = new ExpiringSet();
        this.worldItems = [];
        this.landmarks = []; // Track landmark objects separately
        
        this.viewSize = 100; // Size of each player's view
        this.worldSize = 800;
        this.playerSize = 3;
        this.playerSpeed = 0.2; // Very small moves for ultra-smooth movement (matching view-test)
        this.gatherRange = 6; // Player gathering range
        this.gatherCooldown = 300; // Time between gathering attempts
        this.gatherIndicators = []; // Store active resource gathering indicators
        
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
            attackDamage: 0,     // 0-5 levels - damage per attack
            attackSpeed: 0,      // 0-5 levels - cooldown reduction 
            attackRange: 0,      // 0-5 levels - reach distance
            moveSpeed: 0,        // 0-5 levels - movement speed
            aggroReduction: 0,   // 0-5 levels - reduce enemy detection range
            multiAttack: 0       // 0-3 levels - attack multiple enemies (1→2→3→4)
        };
        this.upgradeBaseCost = 5; // Cost per upgrade
        this.upgradeBonus = 0.2;  // 20% increase per level
        this.maxUpgradeLevel = 5; // Maximum upgrade level
        
        // Base stats (before upgrades)
        this.basePlayerSpeed = 0.3;
        this.baseAttackDamage = 5;
        this.baseAttackRange = 2;
        this.baseAttackCooldown = 400; // Base attack cooldown in ms
        this.baseEnemyDetectionRange = 20; // Base enemy detection range

        // Apply upgrades to current stats
        this.applyUpgrades();
    }
    
    applyUpgrades() {
        // Calculate actual stats based on base stats + upgrades
        this.attackDamage = Math.round(this.baseAttackDamage * (1 + this.upgrades.attackDamage * this.upgradeBonus));
        this.attackCooldown = Math.round(this.baseAttackCooldown * (1 - this.upgrades.attackSpeed * this.upgradeBonus)); // Reduce cooldown
        this.attackRange = this.baseAttackRange * (1 + this.upgrades.attackRange * this.upgradeBonus);
        this.playerSpeed = this.basePlayerSpeed * (1 + this.upgrades.moveSpeed * this.upgradeBonus);
        this.enemyDetectionRange = this.baseEnemyDetectionRange * (1 - this.upgrades.aggroReduction * this.upgradeBonus); // Reduce detection range
        this.maxSimultaneousAttacks = 1 + this.upgrades.multiAttack; // 1, 2, 3, or 4 enemies at once
        
        // Set player health to a fixed value since we removed health upgrades
        this.playerMaxHealth = 100;
    }
    
    getUpgradeCost(upgradeType) {
        const currentLevel = this.upgrades[upgradeType];
        const maxLevel = upgradeType === 'multiAttack' ? 3 : this.maxUpgradeLevel; // Multi-attack caps at 3 levels
        if (currentLevel >= maxLevel) return null; // Max level reached
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
                this.combatSystem.spawnGuardsAroundPool(poolData, numGuards, this.worldSize, this.worldBase);
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
            this.combatSystem.spawnGuardsAroundPool(veinData, numGuards, this.worldSize, this.worldBase);
        }

        // Add random enemy clusters scattered around the world
        this.spawnRandomEnemyClusters();

        // Spawn bosses (sugar-addicted customers from previous days)
        this.spawnBosses();

        this.getPlane().addChild(this.worldBase);
    }





    spawnRandomEnemyClusters() {
        const numClusters = 8 + Math.floor(Math.random() * 5); // 8-12 random clusters
        
        for (let i = 0; i < numClusters; i++) {
            // Find a random location with some spacing from edges
            const clusterX = 50 + Math.random() * (this.worldSize - 100);
            const clusterY = 50 + Math.random() * (this.worldSize - 100);
            
            // Vary cluster sizes: most are small, some are medium, few are large
            let clusterSize;
            const sizeRoll = Math.random();
            if (sizeRoll < 0.6) {
                clusterSize = 2 + Math.floor(Math.random() * 3); // 60% chance: 2-4 enemies (small packs)
            } else if (sizeRoll < 0.9) {
                clusterSize = 5 + Math.floor(Math.random() * 3); // 30% chance: 5-7 enemies (medium groups)
            } else {
                clusterSize = 8 + Math.floor(Math.random() * 4); // 10% chance: 8-11 enemies (large camps)
            }
            
            const clusterType = clusterSize <= 4 ? 'pack' : clusterSize <= 7 ? 'group' : 'camp';
            console.log(`Spawning enemy ${clusterType} ${i+1} at (${clusterX.toFixed(1)}, ${clusterY.toFixed(1)}) with ${clusterSize} enemies`);
            
            this.spawnEnemyCluster(clusterX, clusterY, clusterSize);
        }
    }

    spawnEnemyCluster(centerX, centerY, numEnemies) {
        // Adjust formation based on cluster size
        const maxDistance = numEnemies <= 4 ? 12 : numEnemies <= 7 ? 20 : 30; // Larger camps spread out more
        const minDistance = numEnemies <= 4 ? 3 : 5; // Minimum spacing
        
        // Create a mix of guards and archers in the cluster
        for (let i = 0; i < numEnemies; i++) {
            let enemyX, enemyY;
            
            if (numEnemies <= 4) {
                // Small packs: tight circular formation
                const angle = (i / numEnemies) * 2 * Math.PI + (Math.random() - 0.5) * 0.3;
                const distance = Math.random() * (maxDistance - minDistance) + minDistance;
                enemyX = centerX + Math.cos(angle) * distance;
                enemyY = centerY + Math.sin(angle) * distance;
            } else {
                // Larger groups: more random spread within area
                const angle = Math.random() * 2 * Math.PI;
                const distance = Math.random() * (maxDistance - minDistance) + minDistance;
                enemyX = centerX + Math.cos(angle) * distance;
                enemyY = centerY + Math.sin(angle) * distance;
            }
            
            // Keep enemies within world bounds
            const clampedX = Math.max(0, Math.min(this.worldSize - 4, enemyX));
            const clampedY = Math.max(0, Math.min(this.worldSize - 4, enemyY));
            
            const enemySize = 4; // Standard enemy size
            
            // Enemy distribution: guards, archers, and sentries based on camp size
            const enemyRoll = Math.random();
            if (numEnemies <= 4) {
                // Small packs: 50% guards, 30% archers, 20% sentries
                if (enemyRoll < 0.5) {
                    this.combatSystem.spawnFreeRoamingGuard(clampedX, clampedY, enemySize, this.worldBase);
                } else if (enemyRoll < 0.8) {
                    this.combatSystem.spawnFreeRoamingArcher(clampedX, clampedY, enemySize, this.worldBase);
                } else {
                    this.combatSystem.spawnFreeRoamingSentry(clampedX, clampedY, enemySize, this.worldBase);
                }
            } else {
                // Larger camps: 40% guards, 40% archers, 20% sentries (more ranged)
                if (enemyRoll < 0.4) {
                    this.combatSystem.spawnFreeRoamingGuard(clampedX, clampedY, enemySize, this.worldBase);
                } else if (enemyRoll < 0.8) {
                    this.combatSystem.spawnFreeRoamingArcher(clampedX, clampedY, enemySize, this.worldBase);
                } else {
                    this.combatSystem.spawnFreeRoamingSentry(clampedX, clampedY, enemySize, this.worldBase);
                }
            }
        }
    }



    spawnBosses() {
        const bosses = this.lemonadeSystem.bosses;
        console.log(`Spawning ${bosses.length} sugar-crazed bosses`);
        
        for (let i = 0; i < bosses.length; i++) {
            const bossId = bosses[i];
            const bossName = bossId.split('_')[0]; // Extract name from "Name_Day" format
            
            // Find a random location away from the center (bosses roam the edges)
            const edgeDistance = 100; // Distance from center
            const angle = Math.random() * 2 * Math.PI;
            const centerX = this.worldSize / 2;
            const centerY = this.worldSize / 2;
            
            const bossX = centerX + Math.cos(angle) * edgeDistance - 6; // 6 is boss size
            const bossY = centerY + Math.sin(angle) * edgeDistance - 6;
            
            // Keep boss within world bounds
            const clampedX = Math.max(0, Math.min(this.worldSize - 12, bossX));
            const clampedY = Math.max(0, Math.min(this.worldSize - 12, bossY));
            
            this.combatSystem.spawnBoss(clampedX, clampedY, bossName, bossId, this.worldBase);
        }
    }



    calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
    }

    updatePlayerView(playerId) {
        this.playerManager.updatePlayerView(playerId);
    }

    createPlayerView(playerId, view) {
        return this.gameStateManager.createView(playerId, view);
    }

    // The gameplay view creation method (for when state is 'playing')
    createGameplayView(playerId, view) {
        const viewRoot = ViewUtils.getView(this.getPlane(), view, [playerId]);
        
        // Add dynamic resource text for pools and veins visible in this view
        this.addResourceTextToView(viewRoot, view);
        
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
        for (const indicator of this.combatSystem.damageIndicators) {
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
        for (const indicator of this.combatSystem.attackIndicators) {
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
        for (const projectile of this.combatSystem.projectiles) {
            // Check if projectile is visible in current view
            if (projectile.x + projectile.size >= view.x && projectile.x <= view.x + view.w &&
                projectile.y + projectile.size >= view.y && projectile.y <= view.y + view.h) {
                
                // Convert world coordinates to view coordinates
                const viewX = projectile.x - projectile.size/2 - view.x;
                const viewY = projectile.y - projectile.size/2 - view.y;
                
                // Different appearance for sentry projectiles
                const isSentryProjectile = projectile.type === 'sentry';
                const projectileColor = isSentryProjectile ? 
                    [255, 100, 0, 255] : // Orange for heavy sentry projectiles
                    [255, 255, 0, 255];  // Yellow for archer projectiles
                
                const projectileNode = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(viewX, viewY, projectile.size, projectile.size),
                    fill: projectileColor,
                    playerIds: [playerId]
                });
                
                viewRoot.addChild(projectileNode);
            }
        }
    }

    addTimerToView(viewRoot, view, playerId) {
        if (this.gameStateManager.getCurrentState() !== 'playing') return; // Only show timer during active gameplay
        
        const timeRemaining = Math.max(0, this.gameStateManager.gameTimer - (Date.now() - this.gameStateManager.gameStartTime));
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
        for (const guard of this.combatSystem.guards) {
            if (guard.health <= 0) continue; // Skip dead guards
            
            // Check if guard is visible in current view
            if (guard.x + guard.size >= view.x && guard.x <= view.x + view.w &&
                guard.y + guard.size >= view.y && guard.y <= view.y + view.h) {
                
                // Convert world coordinates to view coordinates
                const viewX = guard.x + guard.size/2 - view.x;
                const viewY = guard.y - 2 - view.y; // Above the guard
                
                // Color-code health (bosses have different thresholds)
                let healthColor, displayText;
                if (guard.type === 'boss') {
                    healthColor = guard.health <= 10 ? [255, 0, 0, 255] : // Red when low health
                                 guard.health <= 20 ? [255, 255, 0, 255] : // Yellow when medium health
                                 [255, 0, 255, 255]; // Magenta when healthy (boss color)
                    displayText = `BOSS ${guard.name}: ${guard.health}`;
                } else {
                    healthColor = guard.health <= 3 ? [255, 0, 0, 255] : // Red when low health
                                 guard.health <= 6 ? [255, 255, 0, 255] : // Yellow when medium health
                                 [0, 255, 0, 255]; // Green when healthy
                    displayText = `${guard.health}`;
                }

                const guardHealthText = new GameNode.Text({
                    textInfo: {
                        x: viewX,
                        y: viewY,
                        color: healthColor,
                        text: displayText,
                        align: 'center',
                        size: guard.type === 'boss' ? 1.5 : 1.2 // Bigger text for bosses
                    },
                    playerIds: [playerId]
                });
                
                viewRoot.addChild(guardHealthText);
            }
        }
        
        // Add health text for archers visible in this view
        for (const archer of this.combatSystem.archers) {
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
        
        // Add health text for sentries visible in this view
        for (const sentry of this.combatSystem.sentries) {
            if (sentry.health <= 0) continue; // Skip dead sentries
            
            // Check if sentry is visible in current view
            if (sentry.x + sentry.size >= view.x && sentry.x <= view.x + view.w &&
                sentry.y + sentry.size >= view.y && sentry.y <= view.y + view.h) {
                
                // Convert world coordinates to view coordinates
                const viewX = sentry.x + sentry.size/2 - view.x;
                const viewY = sentry.y - 2 - view.y; // Above the sentry
                
                // Color-code health (sentries have higher max health)
                const healthColor = sentry.health <= 5 ? [255, 0, 0, 255] : // Red when low health
                                   sentry.health <= 10 ? [255, 255, 0, 255] : // Yellow when medium health
                                   [0, 255, 0, 255]; // Green when healthy

                const sentryHealthText = new GameNode.Text({
                    textInfo: {
                        x: viewX,
                        y: viewY,
                        color: healthColor,
                        text: `${sentry.health}`,
                        align: 'center',
                        size: 1.2
                    },
                    playerIds: [playerId]
                });
                
                viewRoot.addChild(sentryHealthText);
            }
        }
    }

    addAllPlayersToView(viewRoot, view) {
        const players = this.playerManager.getAllPlayers();
        
        let playerIndex = 0;
        for (const playerId in players) {
            const player = players[playerId];
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
            const playerColor = this.playerManager.getPlayerColor(playerIndex);

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



    handleKeyDown(playerId, key) {
        const keyCacheId = `player${playerId}:${key}`;
        
        if (['w','a','s','d'].indexOf(key) >= 0 && !this.keyCoolDowns.has(keyCacheId)) {
            this.playerManager.handlePlayerKeyDown(playerId, key);
            this.keyCoolDowns.put(keyCacheId, 20); // Ultra-fast key repeat for smoothest movement (matching view-test)
        }
    }



    handleNewPlayer({ playerId }) {
        this.playerManager.addPlayer(playerId);
    }

    handlePlayerDisconnect(playerId) {
        this.playerManager.removePlayer(playerId);
    }

    // Helper methods for PlayerManager integration
    createPlayerViewComponents(playerId, initialView) {
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
                    this.playerManager.handlePlayerClick(playerId, x, y);
                }
            },
            playerIds: [playerId]
        });

        // Add content layer first
        stableWrapper.addChild(contentLayer);
        
        // Only add click layer if game is playing (movement clicks)
        let hasClickLayer = false;
        if (this.gameStateManager.shouldHaveClickLayer()) {
            stableWrapper.addChild(clickLayer);
            hasClickLayer = true;
        }

        const viewComponents = {
            view: initialView,
            viewRoot: stableWrapper,
            contentLayer: contentLayer,
            clickLayer: clickLayer,
            hasClickLayer: hasClickLayer
        };

        this.getViewRoot().addChild(stableWrapper);
        return viewComponents;
    }

    updatePlayerViewContent(playerId, newView, currentView) {
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
        const shouldHaveClickLayer = this.gameStateManager.shouldHaveClickLayer();
        
        console.log(`DEBUG: gameState=${this.gameStateManager.getCurrentState()}, shouldHaveClickLayer=${shouldHaveClickLayer}, hasClickLayerFlag=${currentView.hasClickLayer}`);
        
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
        currentView.view = newView;
    }

    gatherResources() {
        // Roll for gathering efficiency: 25% chance each for 1, 2, 3, or 4 resources
        const roll = Math.random();
        if (roll < 0.25) return 1;
        else if (roll < 0.5) return 2;
        else if (roll < 0.75) return 3;
        else return 4;
    }

    // fighting over sugar. sugar is in abundance. lemons are used for upgrades and also used for lemonade. they go bad after a day so if you dont sell them they are no good anymore after.
    // sugar makes people like the lemonade more. its the only real way to make a significant amount of money.
    // people will have profiles, they will like tart or sweet but you can add sugar to make people addicted.
    // if theyre addicted they will come back every day.
    // once they get too addicted, they become a boss fight in the combat section because theyre out there looking for sugar. 
    // bosses get more health and do more damage. lets say there are 4 bosses. 

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

        // New Day button - moved higher up
        const newDayButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(25, 85, 50, 8),
            fill: [0, 180, 0, 255],
            // border: { color: [255, 255, 255, 255], width: 1 },
            onClick: (clickPlayerId) => {
                console.log(`DEBUG: New Day button clicked! PlayerId: ${clickPlayerId}, Target: ${playerId}`);
                if (Number(clickPlayerId) === Number(playerId)) {
                    console.log('New Day clicked!');
                    this.startRecipePhase();
                }
            },
            // playerIds: [playerId]
        });

        const newDayText = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 89,
                color: [255, 255, 255, 255],
                text: 'NEW DAY',
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
        
        viewRoot.addChild(newDayButton);
        viewRoot.addChild(newDayText);



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
                name: 'attackDamage', 
                displayName: 'DAMAGE', 
                currentValue: this.attackDamage,
                baseValue: this.baseAttackDamage,
                icon: '⚔️'
            },
            { 
                name: 'attackSpeed', 
                displayName: 'ATK SPEED', 
                currentValue: `${this.attackCooldown}ms`,
                baseValue: this.baseAttackCooldown,
                icon: '⚡'
            },
            { 
                name: 'attackRange', 
                displayName: 'RANGE', 
                currentValue: this.attackRange.toFixed(1),
                baseValue: this.baseAttackRange,
                icon: '🎯'
            },
            { 
                name: 'moveSpeed', 
                displayName: 'MOVE SPEED', 
                currentValue: this.playerSpeed.toFixed(2),
                baseValue: this.basePlayerSpeed,
                icon: '🏃'
            },
            { 
                name: 'aggroReduction', 
                displayName: 'STEALTH', 
                currentValue: this.enemyDetectionRange.toFixed(1),
                baseValue: this.baseEnemyDetectionRange,
                icon: '👁️'
            },
            { 
                name: 'multiAttack', 
                displayName: 'MULTI-HIT', 
                currentValue: `${this.maxSimultaneousAttacks} enemies`,
                baseValue: 1,
                icon: '💥'
            }
        ];
        
        upgrades.forEach((upgrade, index) => {
            const yPos = 66 + index * 3.2; // Even tighter spacing to fit 6 upgrades
            const currentLevel = this.upgrades[upgrade.name];
            const cost = this.getUpgradeCost(upgrade.name);
            const canAfford = cost !== null && playerScore >= cost;
            const maxLevel = upgrade.name === 'multiAttack' ? 3 : this.maxUpgradeLevel;
            const isMaxLevel = currentLevel >= maxLevel;
            
            // Simple upgrade row
            const upgradeText = new GameNode.Text({
                textInfo: {
                    x: 15,
                    y: yPos,
                    color: [255, 255, 255, 255],
                    text: `${upgrade.displayName}: ${upgrade.currentValue} [${currentLevel}/${maxLevel}]`,
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
                        // console.log(`DEBUG: Upgrade button clicked! PlayerId: ${clickPlayerId}, Target: ${playerId}, Upgrade: ${upgrade.name}, canAfford: ${canAfford}, currentLevel: ${currentLevel}`);
                        if (Number(clickPlayerId) === Number(playerId) && canAfford && currentLevel < maxLevel) {
                            console.log(`Upgrade ${upgrade.name} clicked!`);
                            if (this.purchaseUpgrade(upgrade.name, player)) {
                                this.playerManager.updatePlayerView(playerId);
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

    // Phase transition methods
    startRecipePhase() {
        this.gameStateManager.setState('recipe');
        console.log('Started recipe phase');
    }

    startLemonadeStand() {
        this.gameStateManager.setState('newSection');
        this.lemonadeSystem.startStand();
        console.log('Started lemonade stand');
    }

    startNewSectionStats() {
        this.gameStateManager.setState('newSectionStats');
        console.log('Started lemonade stand results');
    }

    // New view creation methods
    createRecipeView(playerId, view) {
        const viewRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [50, 70, 50, 255], // Dark green background
            // playerIds: [playerId]
        });

        // Title
        const title = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 15,
                color: [255, 255, 255, 255],
                text: 'RECIPE',
                align: 'center',
                size: 4
            },
            // playerIds: [playerId]
        });

        // Sugar section
        const sugarLabel = new GameNode.Text({
            textInfo: {
                x: 25,
                y: 35,
                color: [255, 255, 255, 255],
                text: 'Sugar:',
                align: 'center',
                size: 2
            },
            // playerIds: [playerId]
        });

        const sugarMinus = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(15, 42, 8, 8),
            fill: [200, 0, 0, 255],
            onClick: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.lemonadeSystem.recipe.sugar = Math.max(0, this.lemonadeSystem.recipe.sugar - 1);
                    this.playerManager.updateAllPlayerViews();
                    console.log(`Sugar decreased to ${this.lemonadeSystem.recipe.sugar}`);
                }
            },
            // playerIds: [playerId]
        });

        const sugarMinusText = new GameNode.Text({
            textInfo: {
                x: 19,
                y: 46,
                color: [255, 255, 255, 255],
                text: '-',
                align: 'center',
                size: 3
            },
            // playerIds: [playerId]
        });

        const sugarValue = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 46,
                color: [255, 255, 255, 255],
                text: this.lemonadeSystem.recipe.sugar.toString(),
                align: 'center',
                size: 3
            },
            // playerIds: [playerId]
        });

        const sugarPlus = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(77, 42, 8, 8),
            fill: [0, 200, 0, 255],
            onClick: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.lemonadeSystem.recipe.sugar = Math.min(20, this.lemonadeSystem.recipe.sugar + 1);
                    this.playerManager.updateAllPlayerViews();
                    console.log(`Sugar increased to ${this.lemonadeSystem.recipe.sugar}`);
                }
            },
            // playerIds: [playerId]
        });

        const sugarPlusText = new GameNode.Text({
            textInfo: {
                x: 81,
                y: 46,
                color: [255, 255, 255, 255],
                text: '+',
                align: 'center',
                size: 3
            },
            // playerIds: [playerId]
        });

        // Lemons section
        const lemonsLabel = new GameNode.Text({
            textInfo: {
                x: 25,
                y: 60,
                color: [255, 255, 255, 255],
                text: 'Lemons:',
                align: 'center',
                size: 2
            },
            // playerIds: [playerId]
        });

        const lemonsMinus = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(15, 67, 8, 8),
            fill: [200, 0, 0, 255],
            onClick: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.lemonadeSystem.recipe.lemons = Math.max(0, this.lemonadeSystem.recipe.lemons - 1);
                    this.playerManager.updateAllPlayerViews();
                    console.log(`Lemons decreased to ${this.lemonadeSystem.recipe.lemons}`);
                }
            },
            // playerIds: [playerId]
        });

        const lemonsMinusText = new GameNode.Text({
            textInfo: {
                x: 19,
                y: 71,
                color: [255, 255, 255, 255],
                text: '-',
                align: 'center',
                size: 3
            },
            // playerIds: [playerId]
        });

        const lemonsValue = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 71,
                color: [255, 255, 255, 255],
                text: this.lemonadeSystem.recipe.lemons.toString(),
                align: 'center',
                size: 3
            },
            // playerIds: [playerId]
        });

        const lemonsPlus = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(77, 67, 8, 8),
            fill: [0, 200, 0, 255],
            onClick: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    this.lemonadeSystem.recipe.lemons = Math.min(20, this.lemonadeSystem.recipe.lemons + 1);
                    this.playerManager.updateAllPlayerViews();
                    console.log(`Lemons increased to ${this.lemonadeSystem.recipe.lemons}`);
                }
            },
            // playerIds: [playerId]
        });

        const lemonsPlusText = new GameNode.Text({
            textInfo: {
                x: 81,
                y: 71,
                color: [255, 255, 255, 255],
                text: '+',
                align: 'center',
                size: 3
            },
            // playerIds: [playerId]
        });

        // Confirm button
        const confirmButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(25, 85, 50, 8),
            fill: [0, 0, 200, 255],
            onClick: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    console.log(`Recipe confirmed: Sugar ${this.lemonadeSystem.recipe.sugar}, Lemons ${this.lemonadeSystem.recipe.lemons}`);
                    this.startLemonadeStand();
                }
            },
            // playerIds: [playerId]
        });

        const confirmText = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 89,
                color: [255, 255, 255, 255],
                text: 'CONFIRM',
                align: 'center',
                size: 2.5
            },
            // playerIds: [playerId]
        });

        viewRoot.addChild(title);
        viewRoot.addChild(sugarLabel);
        viewRoot.addChild(sugarMinus);
        viewRoot.addChild(sugarMinusText);
        viewRoot.addChild(sugarValue);
        viewRoot.addChild(sugarPlus);
        viewRoot.addChild(sugarPlusText);
        viewRoot.addChild(lemonsLabel);
        viewRoot.addChild(lemonsMinus);
        viewRoot.addChild(lemonsMinusText);
        viewRoot.addChild(lemonsValue);
        viewRoot.addChild(lemonsPlus);
        viewRoot.addChild(lemonsPlusText);
        viewRoot.addChild(confirmButton);
        viewRoot.addChild(confirmText);

        return viewRoot;
    }

    createNewSectionView(playerId, view) {
        const viewRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [135, 206, 235, 255], // Sky blue background (sunny day)
            // playerIds: [playerId]
        });

        // Ground/sidewalk
        const sidewalk = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 40, 100, 20),
            fill: [192, 192, 192, 255], // Light gray sidewalk
            // playerIds: [playerId]
        });

        // Timer display
        const timeLeft = Math.max(0, Math.ceil(this.lemonadeSystem.getTimeRemaining() / 1000));
        
        const timerText = new GameNode.Text({
            textInfo: {
                x: 10,
                y: 10,
                color: [0, 0, 0, 255],
                text: `Time: ${timeLeft}s`,
                align: 'left',
                size: 2
            },
            // playerIds: [playerId]
        });

        // Revenue display
        const revenueText = new GameNode.Text({
            textInfo: {
                x: 90,
                y: 10,
                color: [0, 0, 0, 255],
                text: `$${this.lemonadeSystem.standRevenue.toFixed(2)}`,
                align: 'right',
                size: 2
            },
            // playerIds: [playerId]
        });

        // Current price display
        const currentPrice = this.lemonadeSystem.calculateLemonadePrice();
        const priceText = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 10,
                color: [0, 0, 0, 255],
                text: `Price: $${currentPrice.toFixed(2)}`,
                align: 'center',
                size: 1.8
            },
            // playerIds: [playerId]
        });

        // Player/stand in center
        const playerStand = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(45, 35, 10, 10),
            fill: [139, 69, 19, 255], // Brown stand
            // playerIds: [playerId]
        });

        const playerBehindStand = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(47, 30, 6, 8),
            fill: [0, 0, 0, 255], // Black player figure
            // playerIds: [playerId]
        });

        const standSign = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 25,
                color: [255, 255, 255, 255],
                text: 'LEMONADE',
                align: 'center',
                size: 1.2
            },
            // playerIds: [playerId]
        });

        // Recipe display above stand
        const recipeDisplay = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 20,
                color: [0, 0, 0, 255],
                text: `${this.lemonadeSystem.recipe.sugar}🍯 ${this.lemonadeSystem.recipe.lemons}🍋`,
                align: 'center',
                size: 1.5
            },
            // playerIds: [playerId]
        });

        viewRoot.addChild(sidewalk);
        viewRoot.addChild(timerText);
        viewRoot.addChild(revenueText);
        viewRoot.addChild(priceText);
        viewRoot.addChild(playerStand);
        viewRoot.addChild(playerBehindStand);
        viewRoot.addChild(standSign);
        viewRoot.addChild(recipeDisplay);

        // Add walking customers
        this.lemonadeSystem.walkingCustomers.forEach(customer => {
            this.lemonadeSystem.addWalkingCustomerToView(viewRoot, customer, playerId);
        });

        // Add stopped customers
        this.lemonadeSystem.stoppedCustomers.forEach(customer => {
            this.lemonadeSystem.addStoppedCustomerToView(viewRoot, customer, playerId);
        });

        return viewRoot;
    }

    createNewSectionStatsView(playerId, view) {
        const viewRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [50, 50, 20, 255], // Dark yellow background
            // playerIds: [playerId]
        });

        // Title
        const title = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 15,
                color: [255, 255, 255, 255],
                text: `DAY ${this.lemonadeSystem.standDay} RESULTS`,
                align: 'center',
                size: 2.5
            },
            // playerIds: [playerId]
        });

        // Recipe display
        const recipeText = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 28,
                color: [255, 255, 255, 255],
                text: `Recipe: ${this.lemonadeSystem.recipe.sugar} Sugar, ${this.lemonadeSystem.recipe.lemons} Lemons`,
                align: 'center',
                size: 1.8
            },
            // playerIds: [playerId]
        });

        // Revenue display
        const revenueText = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 40,
                color: [0, 255, 0, 255],
                text: `Total Revenue: $${this.lemonadeSystem.standRevenue.toFixed(2)}`,
                align: 'center',
                size: 2
            },
            // playerIds: [playerId]
        });

        // Boss warnings
        let yOffset = 50;
        if (this.lemonadeSystem.bosses.length > 0) {
            const bossWarning = new GameNode.Text({
                textInfo: {
                    x: 50,
                    y: yOffset,
                    color: [255, 100, 100, 255],
                    text: 'WARNING: Sugar addicts turning hostile!',
                    align: 'center',
                    size: 1.5
                },
                // playerIds: [playerId]
            });
            viewRoot.addChild(bossWarning);
            yOffset += 8;

            const bossCount = new GameNode.Text({
                textInfo: {
                    x: 50,
                    y: yOffset,
                    color: [255, 150, 150, 255],
                    text: `${this.lemonadeSystem.bosses.length} new boss(es) in combat tomorrow!`,
                    align: 'center',
                    size: 1.3
                },
                // playerIds: [playerId]
            });
            viewRoot.addChild(bossCount);
            yOffset += 10;
        }

        // Addiction stats
        const addictionCount = this.lemonadeSystem.getAddictionStats();
        if (addictionCount > 0) {
            const addictionText = new GameNode.Text({
                textInfo: {
                    x: 50,
                    y: yOffset,
                    color: [255, 255, 100, 255],
                    text: `${addictionCount} customer(s) tracking addiction levels`,
                    align: 'center',
                    size: 1.2
                },
                // playerIds: [playerId]
            });
            viewRoot.addChild(addictionText);
        }

        // Confirm button to go back to combat
        const confirmButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(25, 85, 50, 8),
            fill: [0, 150, 0, 255],
            onClick: (clickPlayerId) => {
                if (Number(clickPlayerId) === Number(playerId)) {
                    console.log('Going to next day - advancing to combat phase');
                    this.advanceToNextDay();
                }
            },
            // playerIds: [playerId]
        });

        const confirmText = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 89,
                color: [255, 255, 255, 255],
                text: 'START NEXT DAY',
                align: 'center',
                size: 2.5
            },
            // playerIds: [playerId]
        });

        viewRoot.addChild(title);
        viewRoot.addChild(recipeText);
        viewRoot.addChild(revenueText);
        viewRoot.addChild(confirmButton);
        viewRoot.addChild(confirmText);

        return viewRoot;
    }

    advanceToNextDay() {
        // Advance day and reset stand
        this.lemonadeSystem.advanceDay();
        
        // Reset game to combat phase
        this.resetGame();
        
        console.log(`Advanced to Day ${this.lemonadeSystem.standDay}. Lemons went bad! New bosses: ${this.lemonadeSystem.bosses.length}`);
    }









    resetGame() {
        // Save current stats as previous stats
        this.previousStats = {
            resourcesCollected: this.currentStats.resourcesCollected,
            enemiesKilled: this.currentStats.enemiesKilled,
            timeAlive: Math.floor((Date.now() - this.gameStateManager.gameStartTime) / 1000)
        };

        // Reset current stats
        this.currentStats = {
            resourcesCollected: 0,
            enemiesKilled: 0,
            timeAlive: 0
        };

        // Reset game state
        this.gameStateManager.resetForNewGame();
        this.lastViewUpdate = 0; // Reset view update tracking
        
        // Reapply upgrades (they persist between rounds)
        this.applyUpgrades();

        // Reset all players
        this.playerManager.resetAllPlayers();

        // Clear existing world
        this.getPlane().clearChildren();
        this.worldItems = [];
        this.landmarks = [];
        this.combatSystem.reset(); // Reset all combat-related data
        this.lemonadeSystem.reset(); // Reset all lemonade stand data
        this.gatherIndicators = [];

        // Rebuild world
        this.initializeWorld();

        // Update all player views
        this.playerManager.updateAllPlayerViews();
        
        console.log('Game reset! New game started.');
    }


    updateAllPlayerViews() {
        this.playerManager.updateAllPlayerViews();
    }

    tick() {
        const currentTime = Date.now();
        
        // Check game state transitions first
        if (this.gameStateManager.checkTransitions()) {
            return; // State changed, stop processing
        }
        
        // Update based on current state
        this.updateForCurrentState(currentTime);
    }

    updateForCurrentState(currentTime) {
        const currentState = this.gameStateManager.getCurrentState();
        
        switch (currentState) {
            case 'playing':
                this.updateGameplay(currentTime);
                break;
            case 'newSection':
                this.updateLemonadeStand(currentTime);
                break;
            // Other states don't need tick updates
        }
    }

    updateLemonadeStand(currentTime) {
        if (!this.lemonadeSystem.isStandActive()) return;

        // End stand after duration expires
        if (this.lemonadeSystem.isStandTimeUp()) {
            this.gameStateManager.setState('newSectionStats');
            return;
        }
        
        // Manage customer interactions
        const needsViewUpdate = this.lemonadeSystem.updateCustomers(currentTime);
        
        // Update views frequently for smooth customer movement
        const hasMovingCustomers = this.lemonadeSystem.hasMovingCustomers();
        const updateInterval = hasMovingCustomers ? 50 : 200; // 20 FPS when customers moving, 5 FPS when idle
        
        if (!this.lastViewUpdate || currentTime - this.lastViewUpdate >= updateInterval) {
            this.lastViewUpdate = currentTime;
            
            // Always update if there are moving customers, or periodically for timer, or if customer state changed
            const timeRemaining = this.lemonadeSystem.getTimeRemaining();
            const shouldUpdate = hasMovingCustomers || needsViewUpdate ||
                                (timeRemaining) % 1000 < 100; // Timer updates every second
            
            if (shouldUpdate) {
                this.playerManager.updateAllPlayerViews();
            }
        }
    }

    updateGameplay(currentTime) {
        // Update views regularly for smooth projectile movement and dynamic elements
        this.updateViewsIfNeeded(currentTime);
        
        // Clean up expired gather indicators
        this.gatherIndicators = this.gatherIndicators.filter(indicator => 
            currentTime - indicator.createdAt < indicator.duration
        );
        
        // Update combat system (handles projectiles, enemy AI, and combat indicators)
        const players = this.playerManager.getAllPlayers();
        this.combatSystem.updateProjectiles(currentTime, players);
        this.combatSystem.updateEnemyAI(currentTime, players);
        this.combatSystem.cleanupExpiredIndicators(currentTime);
        
        // Update all player actions
        this.updatePlayerActions(currentTime);
    }

    updateViewsIfNeeded(currentTime) {
        // Check if we need frequent updates for smooth visuals
        const hasActiveProjectiles = this.combatSystem.hasActiveProjectiles();
        const hasMovingEnemies = this.combatSystem.hasMovingEnemies();
        const needsFrequentUpdates = hasActiveProjectiles || hasMovingEnemies;
        
        // Use different update rates based on activity level
        const updateInterval = needsFrequentUpdates ? 33 : 200; // 30 FPS when active, 5 FPS when idle
        
        if (!this.lastViewUpdate || currentTime - this.lastViewUpdate >= updateInterval) {
            this.lastViewUpdate = currentTime;
            
            // Always update if there's activity, or periodically for timer
            const shouldUpdate = needsFrequentUpdates || 
                                (currentTime - this.gameStateManager.gameStartTime) % 1000 < 100; // Timer updates
            
            if (shouldUpdate) {
                this.playerManager.updateAllPlayerViews();
            }
        }
    }

    updatePlayerActions(currentTime) {
        const players = this.playerManager.getAllPlayers();
        
        Object.keys(players).forEach(playerId => {
            const player = players[playerId];
            let needsViewUpdate = false;
            
            // Update movement
            if (this.playerManager.updatePlayerMovement(playerId)) {
                needsViewUpdate = true;
            }
            
            // Check for gathering targets (with cooldown)
            if (currentTime - player.lastGatherTime >= this.gatherCooldown) {
                const gatherResult = this.findGatherTarget(player);
                if (gatherResult) {
                    this.gatherFrom(gatherResult.target, playerId);
                    player.lastGatherTime = currentTime;
                    needsViewUpdate = true;
                }
            }
            
            // Check for attack targets (with cooldown)
            if (currentTime - player.lastAttackTime >= this.attackCooldown) {
                const attackTargets = this.combatSystem.findMultipleAttackTargets(player, this.attackRange, this.maxSimultaneousAttacks);
                if (attackTargets.length > 0) {
                    // Attack all targets simultaneously
                    for (const target of attackTargets) {
                        this.combatSystem.playerAttackEnemy(target, playerId, player, this.attackDamage, this.worldBase);
                        this.currentStats.enemiesKilled += 1;
                    }
                    player.lastAttackTime = currentTime;
                    needsViewUpdate = true;
                    
                    if (attackTargets.length > 1) {
                        console.log(`Player ${playerId} multi-attacks ${attackTargets.length} enemies!`);
                    }
                }
            }
            
            // Update view if needed
            if (needsViewUpdate) {
                this.playerManager.updatePlayerView(playerId);
            }
        });
    }

    getLayers() {
        return [{root: this.getViewRoot()}];
    }
}

module.exports = EnhancedViewTest; 