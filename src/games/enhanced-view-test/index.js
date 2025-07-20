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
        this.sentries = []; // Track sentry enemies (stationary knockback)
        this.projectiles = []; // Track active projectiles
        
        this.viewSize = 100; // Size of each player's view
        this.worldSize = 800;
        this.playerSize = 3;
        this.playerSpeed = 0.2; // Very small moves for ultra-smooth movement (matching view-test)
        this.gatherRange = 6; // Player gathering range
        this.gatherCooldown = 300; // Time between gathering attempts
        this.gatherIndicators = []; // Store active resource gathering indicators
        
        // Player attack settings (now calculated in applyUpgrades)
        this.attackIndicators = []; // Store attack damage indicators
        
        // Enemy/combat settings
        this.enemyAttackRange = 3; // Guards attack when this close to player
        this.enemyAttackCooldown = 500; // Time between enemy attacks
        this.enemySpeed = 0.15; // Enemy movement speed (slightly slower than player)
        this.damageIndicators = []; // Store damage indicators for player
        
        // Archer settings
        this.archerHealth = 5; // Archers have less health than guards
        this.archerDamage = 0.5; // Weaker melee attacks
        this.archerProjectileRange = 25; // Range for shooting projectiles (increased for kiting)
        this.archerProjectileCooldown = 700; // Time between projectile shots (slightly faster)
        this.archerKiteDistance = 12; // Preferred distance to maintain from player
        
        // Sentry settings (stationary artillery enemies)
        this.sentryHealth = 15; // Tankier since they can't move
        this.sentryProjectileRange = 20; // Long range for artillery
        this.sentryProjectileCooldown = 1200; // Slower firing rate for heavy projectiles
        this.sentryProjectileSpeed = 0.08; // Very slow heavy projectiles
        this.sentryProjectileDamage = 4; // High damage per hit
        this.sentryProjectileSize = 6; // Large projectiles
        this.projectileSpeed = 0.2; // Speed of projectiles
        this.projectileDamage = 1; // Damage per projectile hit
        this.projectileSize = 2; // Size of projectile squares
        
        // Game state and timer
        this.gameState = 'playing'; // 'playing', 'gameOver', 'dead', 'recipe', 'newSection', 'newSectionStats'
        this.gameTimer = 60000; // 60 seconds in milliseconds
        this.gameStartTime = Date.now();
        this.lastViewUpdate = 0; // Track when we last updated views for smooth visuals
        
        // Recipe system
        this.recipe = {
            sugar: 5,
            lemons: 3
        };
        
        // Lemonade stand system
        this.walkingCustomers = []; // Customers currently walking across screen
        this.stoppedCustomers = []; // Customers who stopped at the stand
        this.lastCustomerSpawn = 0;
        this.customerSpawnInterval = 2000; // Spawn every 2 seconds
        this.standRevenue = 0;
        this.standDay = 1;
        this.addictionLevels = {}; // Track customer addiction
        this.bosses = []; // Track customers who became bosses
        
        // Define unique customers with distinct traits
        this.uniqueCustomers = [
            { name: 'Sweet Sally', trait: 'sweet_tooth', color: [255, 192, 203, 255], stopChance: 0.8, buyChance: 0.9, preferredPrice: 1.5 },
            { name: 'Sour Sam', trait: 'tart_lover', color: [255, 255, 0, 255], stopChance: 0.6, buyChance: 0.7, preferredPrice: 1.2 },
            { name: 'Balanced Bob', trait: 'balanced', color: [144, 238, 144, 255], stopChance: 0.7, buyChance: 0.8, preferredPrice: 1.0 },
            { name: 'Rich Rita', trait: 'wealthy', color: [255, 215, 0, 255], stopChance: 0.5, buyChance: 0.9, preferredPrice: 3.0 },
            { name: 'Cheap Charlie', trait: 'budget', color: [139, 69, 19, 255], stopChance: 0.9, buyChance: 0.3, preferredPrice: 0.5 },
            { name: 'Picky Pete', trait: 'critic', color: [128, 0, 128, 255], stopChance: 0.4, buyChance: 0.5, preferredPrice: 2.0 },
            { name: 'Loyal Lucy', trait: 'regular', color: [0, 191, 255, 255], stopChance: 0.95, buyChance: 0.85, preferredPrice: 1.3 },
            { name: 'Speedy Steve', trait: 'rushed', color: [255, 69, 0, 255], stopChance: 0.3, buyChance: 0.6, preferredPrice: 1.8 },
            { name: 'Curious Carla', trait: 'explorer', color: [255, 20, 147, 255], stopChance: 0.8, buyChance: 0.4, preferredPrice: 1.1 },
            { name: 'Grumpy Greg', trait: 'pessimist', color: [105, 105, 105, 255], stopChance: 0.6, buyChance: 0.2, preferredPrice: 0.8 }
        ];
        
        // Generic customer traits for filling gaps
        this.genericTraits = [
            { trait: 'casual', color: [176, 196, 222, 255], stopChance: 0.6, buyChance: 0.6, preferredPrice: 1.0 },
            { trait: 'tourist', color: [255, 182, 193, 255], stopChance: 0.7, buyChance: 0.7, preferredPrice: 1.4 },
            { trait: 'local', color: [152, 251, 152, 255], stopChance: 0.8, buyChance: 0.5, preferredPrice: 0.9 },
            { trait: 'student', color: [173, 216, 230, 255], stopChance: 0.5, buyChance: 0.4, preferredPrice: 0.7 }
        ];
        
        this.usedUniqueCustomers = []; // Track which unique customers appeared today
        
        // Stand timer
        this.standStartTime = null;
        this.standDuration = 30000; // 30 seconds of selling
        
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
        
        this.initializeWorld();
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

        // Add random enemy clusters scattered around the world
        this.spawnRandomEnemyClusters();

        // Spawn bosses (sugar-addicted customers from previous days)
        this.spawnBosses();

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

            // 50% guards, 30% archers, 20% sentries for resource pools
            const enemyRoll = Math.random();
            if (enemyRoll < 0.5) {
                this.spawnGuard(clampedX, clampedY, guardSize, poolData);
            } else if (enemyRoll < 0.8) {
                this.spawnArcher(clampedX, clampedY, guardSize, poolData);
            } else {
                this.spawnSentry(clampedX, clampedY, guardSize, poolData);
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
    
    spawnSentry(x, y, size, poolData) {
        const sentry = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, size, size),
            fill: [100, 100, 100, 255], // Gray sentries (stationary)
            onClick: (clickPlayerId) => {
                console.log(`Player ${clickPlayerId} clicked sentry at (${x}, ${y})`);
            }
        });

        const sentryData = {
            x: x,
            y: y,
            size: size,
            poolData: poolData,
            node: sentry,
            // AI state (minimal since stationary)
            lastProjectileTime: 0,
            targetPlayerId: null,
            // Combat stats
            health: this.sentryHealth,
            maxHealth: this.sentryHealth,
            type: 'sentry'
        };

        this.sentries.push(sentryData);
        this.worldBase.addChild(sentry);
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
                    this.spawnFreeRoamingGuard(clampedX, clampedY, enemySize);
                } else if (enemyRoll < 0.8) {
                    this.spawnFreeRoamingArcher(clampedX, clampedY, enemySize);
                } else {
                    this.spawnFreeRoamingSentry(clampedX, clampedY, enemySize);
                }
            } else {
                // Larger camps: 40% guards, 40% archers, 20% sentries (more ranged)
                if (enemyRoll < 0.4) {
                    this.spawnFreeRoamingGuard(clampedX, clampedY, enemySize);
                } else if (enemyRoll < 0.8) {
                    this.spawnFreeRoamingArcher(clampedX, clampedY, enemySize);
                } else {
                    this.spawnFreeRoamingSentry(clampedX, clampedY, enemySize);
                }
            }
        }
    }

    spawnFreeRoamingGuard(x, y, size) {
        const guard = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, size, size),
            fill: [150, 0, 0, 255], // Darker red for free-roaming guards to distinguish from resource guards
            onClick: (clickPlayerId) => {
                console.log(`Player ${clickPlayerId} clicked free-roaming guard at (${x}, ${y})`);
            }
        });

        const guardData = {
            x: x,
            y: y,
            size: size,
            poolData: null, // No associated resource pool
            node: guard,
            // AI state
            isChasing: false,
            targetPlayerId: null,
            lastAttackTime: 0,
            originalX: x,
            originalY: y,
            // Combat stats
            health: 12, // Slightly stronger than resource guards
            maxHealth: 12,
            type: 'guard',
            isFreeRoaming: true // Mark as free-roaming for different AI behavior
        };

        this.guards.push(guardData);
        this.worldBase.addChild(guard);
    }

    spawnFreeRoamingArcher(x, y, size) {
        const archer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, size, size),
            fill: [100, 0, 100, 255], // Darker purple for free-roaming archers
            onClick: (clickPlayerId) => {
                console.log(`Player ${clickPlayerId} clicked free-roaming archer at (${x}, ${y})`);
            }
        });

        const archerData = {
            x: x,
            y: y,
            size: size,
            poolData: null, // No associated resource pool
            node: archer,
            // AI state
            isChasing: false,
            targetPlayerId: null,
            lastAttackTime: 0,
            lastProjectileTime: 0,
            originalX: x,
            originalY: y,
            // Combat stats
            health: 6, // Slightly stronger than resource archers
            maxHealth: 6,
            type: 'archer',
            isFreeRoaming: true // Mark as free-roaming for different AI behavior
        };

        this.archers.push(archerData);
        this.worldBase.addChild(archer);
    }

    spawnFreeRoamingSentry(x, y, size) {
        const sentry = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, size, size),
            fill: [80, 80, 80, 255], // Darker gray for free-roaming sentries
            onClick: (clickPlayerId) => {
                console.log(`Player ${clickPlayerId} clicked free-roaming sentry at (${x}, ${y})`);
            }
        });

        const sentryData = {
            x: x,
            y: y,
            size: size,
            poolData: null, // No associated resource pool
            node: sentry,
            // AI state (minimal since stationary)
            lastProjectileTime: 0,
            targetPlayerId: null,
            // Combat stats
            health: 18, // Even stronger than resource sentries
            maxHealth: 18,
            type: 'sentry',
            isFreeRoaming: true // Mark as free-roaming for different AI behavior
        };

        this.sentries.push(sentryData);
        this.worldBase.addChild(sentry);
    }

    spawnBosses() {
        console.log(`Spawning ${this.bosses.length} sugar-crazed bosses`);
        
        for (let i = 0; i < this.bosses.length; i++) {
            const bossId = this.bosses[i];
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
            
            this.spawnBoss(clampedX, clampedY, bossName, bossId);
        }
    }

    spawnBoss(x, y, name, bossId) {
        const bossSize = 12; // Bigger than regular enemies
        
        const boss = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, bossSize, bossSize),
            fill: [120, 0, 120, 255], // Dark purple for bosses
            onClick: (clickPlayerId) => {
                console.log(`Player ${clickPlayerId} clicked boss ${name} at (${x}, ${y})`);
            }
        });

        const bossData = {
            x: x,
            y: y,
            size: bossSize,
            poolData: null, // Bosses are free-roaming
            node: boss,
            // AI state
            isChasing: false,
            targetPlayerId: null,
            lastAttackTime: 0,
            originalX: x,
            originalY: y,
            // Combat stats - much stronger than regular guards
            health: 30, // 3x regular guard health
            maxHealth: 30,
            type: 'boss',
            name: name,
            bossId: bossId,
            isFreeRoaming: true,
            // Boss special abilities
            attackDamage: 3, // Triple damage
            attackRange: 6,  // Longer reach
            detectionRange: 30, // Can spot players from much further
            moveSpeed: 0.2   // Slightly faster than regular enemies
        };

        this.guards.push(bossData); // Bosses use guard AI but with enhanced stats
        this.worldBase.addChild(boss);
        
        console.log(`Spawned boss ${name} (${bossId}) at (${x.toFixed(1)}, ${y.toFixed(1)})`);
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
        if (this.gameState === 'gameOver' || this.gameState === 'dead') {
            // For game over, we need to create a view that can handle clicks properly
            const gameOverRoot = this.createGameOverView(playerId, view);
            return gameOverRoot;
        } else if (this.gameState === 'recipe') {
            const recipeRoot = this.createRecipeView(playerId, view);
            return recipeRoot;
        } else if (this.gameState === 'newSection') {
            const newSectionRoot = this.createNewSectionView(playerId, view);
            return newSectionRoot;
        } else if (this.gameState === 'newSectionStats') {
            const newSectionStatsRoot = this.createNewSectionStatsView(playerId, view);
            return newSectionStatsRoot;
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
        
        // Add health text for sentries visible in this view
        for (const sentry of this.sentries) {
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
        
        // Update sentries
        for (const sentry of this.sentries) {
            if (sentry.health <= 0) continue; // Skip dead sentries
            this.updateSentryAI(sentry, currentTime);
        }
    }
    
    updateGuardAI(guard, currentTime) {
        let closestPlayer = null;
        let closestDistance = Infinity;

        // Find the closest player within detection range (bosses have extended range)
        const detectionRange = guard.type === 'boss' ? guard.detectionRange : this.enemyDetectionRange;
        
        for (const playerId in this.players) {
            const player = this.players[playerId];
            const distance = this.calculateDistance(guard.x + guard.size/2, guard.y + guard.size/2, player.x, player.y);
            
            if (distance <= detectionRange && distance < closestDistance) {
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

            // Move towards the player (bosses are faster)
            if (guard.type === 'boss') {
                this.moveBossTowards(guard, closestPlayer.x, closestPlayer.y);
            } else {
                this.moveGuardTowards(guard, closestPlayer.x, closestPlayer.y);
            }

            // Attack if within range and cooldown is ready (bosses have longer reach)
            const attackRange = guard.type === 'boss' ? guard.attackRange : this.enemyAttackRange;
            if (closestDistance <= attackRange && 
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
            // Start engaging if not already
            if (!archer.isChasing) {
                archer.isChasing = true;
                console.log(`Archer starts kiting player ${archer.targetPlayerId}!`);
            }

            // Kiting behavior: maintain optimal distance
            if (closestDistance < this.archerKiteDistance) {
                // Too close! Move away from player
                this.moveArcherAwayFromPlayer(archer, closestPlayer);
            } else if (closestDistance > this.archerProjectileRange) {
                // Too far to shoot, move closer (but still try to maintain kite distance)
                this.moveGuardTowards(archer, closestPlayer.x, closestPlayer.y);
            }
            // If in the sweet spot (archerKiteDistance <= distance <= archerProjectileRange), just hold position and shoot

            // Shoot projectile if within range and cooldown is ready
            if (closestDistance <= this.archerProjectileRange && 
                currentTime - archer.lastProjectileTime >= this.archerProjectileCooldown) {
                this.archerShootProjectile(archer, closestPlayer, archer.targetPlayerId);
                archer.lastProjectileTime = currentTime;
            }
            
            // Melee attack only as last resort if player gets really close
            if (closestDistance <= this.enemyAttackRange && 
                currentTime - archer.lastAttackTime >= this.enemyAttackCooldown) {
                this.archerAttackPlayer(archer, closestPlayer, archer.targetPlayerId);
                archer.lastAttackTime = currentTime;
            }
        } else {
            // No player in range, but archers never stop hunting once they've started chasing
            if (archer.isChasing) {
                // Keep hunting - patrol around original position
                const patrolRadius = 15;
                const patrolX = archer.originalX + Math.cos(Date.now() / 3000) * patrolRadius;
                const patrolY = archer.originalY + Math.sin(Date.now() / 3000) * patrolRadius;
                this.moveGuardTowards(archer, patrolX + archer.size/2, patrolY + archer.size/2);
            } else {
                // Archer hasn't detected anyone yet, stay at post
                this.moveGuardTowards(archer, archer.originalX + archer.size/2, archer.originalY + archer.size/2);
            }
        }
    }

    moveArcherAwayFromPlayer(archer, player) {
        const archerCenterX = archer.x + archer.size/2;
        const archerCenterY = archer.y + archer.size/2;
        
        // Calculate direction away from player
        const directionX = archerCenterX - player.x;
        const directionY = archerCenterY - player.y;
        
        // Normalize direction
        const distance = Math.sqrt(directionX * directionX + directionY * directionY);
        if (distance === 0) return; // Avoid division by zero
        
        const normalizedX = directionX / distance;
        const normalizedY = directionY / distance;
        
        // Move away at much slower speed than player (so player can catch them)
        const kiteSpeed = this.basePlayerSpeed * 0.25; // 50% of base player speed (0.15)
        const newX = archer.x + normalizedX * kiteSpeed;
        const newY = archer.y + normalizedY * kiteSpeed;
        
        // Keep archer within world bounds
        archer.x = Math.max(0, Math.min(this.worldSize - archer.size, newX));
        archer.y = Math.max(0, Math.min(this.worldSize - archer.size, newY));
        
        // Update the visual node position
        archer.node.node.coordinates2d = ShapeUtils.rectangle(archer.x, archer.y, archer.size, archer.size);
    }

    updateSentryAI(sentry, currentTime) {
        let closestPlayer = null;
        let closestDistance = Infinity;

        // Find the closest player within projectile range (sentries don't chase)
        for (const playerId in this.players) {
            const player = this.players[playerId];
            const distance = this.calculateDistance(sentry.x + sentry.size/2, sentry.y + sentry.size/2, player.x, player.y);
            
            if (distance <= this.sentryProjectileRange && distance < closestDistance) {
                closestPlayer = player;
                closestDistance = distance;
                sentry.targetPlayerId = playerId;
            }
        }

        // Sentry shoots heavy projectile if player is in range
        if (closestPlayer && currentTime - sentry.lastProjectileTime >= this.sentryProjectileCooldown) {
            this.sentryShootProjectile(sentry, closestPlayer, sentry.targetPlayerId);
            sentry.lastProjectileTime = currentTime;
        }
    }

    sentryShootProjectile(sentry, player, playerId) {
        console.log(`Sentry fires heavy artillery at player ${playerId}!`);
        
        // Calculate direction to player
        const sentryCenterX = sentry.x + sentry.size/2;
        const sentryCenterY = sentry.y + sentry.size/2;
        const angle = Math.atan2(player.y - sentryCenterY, player.x - sentryCenterX);
        
        // Create heavy projectile
        const projectile = {
            x: sentryCenterX,
            y: sentryCenterY,
            velocityX: Math.cos(angle) * this.sentryProjectileSpeed,
            velocityY: Math.sin(angle) * this.sentryProjectileSpeed,
            size: this.sentryProjectileSize,
            damage: this.sentryProjectileDamage,
            createdAt: Date.now(),
            targetPlayerId: playerId,
            type: 'sentry' // Mark as sentry projectile for different appearance
        };
        
        this.projectiles.push(projectile);
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

    moveBossTowards(boss, targetX, targetY) {
        const bossCenterX = boss.x + boss.size/2;
        const bossCenterY = boss.y + boss.size/2;
        
        const distance = this.calculateDistance(bossCenterX, bossCenterY, targetX, targetY);
        
        if (distance > 1) { // Only move if not already at target
            const angle = Math.atan2(targetY - bossCenterY, targetX - bossCenterX);
            const newX = boss.x + Math.cos(angle) * boss.moveSpeed; // Use boss speed
            const newY = boss.y + Math.sin(angle) * boss.moveSpeed;
            
            // Keep boss within world bounds
            boss.x = Math.max(0, Math.min(this.worldSize - boss.size, newX));
            boss.y = Math.max(0, Math.min(this.worldSize - boss.size, newY));
            
            // Update the visual node position
            boss.node.node.coordinates2d = ShapeUtils.rectangle(boss.x, boss.y, boss.size, boss.size);
        }
    }

    guardAttackPlayer(guard, player, playerId) {
        const damage = guard.type === 'boss' ? guard.attackDamage : 1; // Bosses do more damage
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

    findMultipleAttackTargets(player) {
        // Find multiple enemies within attack range, up to maxSimultaneousAttacks
        let enemiesInRange = [];
        
        // Check guards
        for (const guard of this.guards) {
            if (guard.health <= 0) continue; // Skip dead guards
            
            const guardCenterX = guard.x + guard.size/2;
            const guardCenterY = guard.y + guard.size/2;
            const distance = this.calculateDistance(player.x, player.y, guardCenterX, guardCenterY);
            
            if (distance <= this.attackRange) {
                enemiesInRange.push({ enemy: guard, distance: distance });
            }
        }
        
        // Check archers
        for (const archer of this.archers) {
            if (archer.health <= 0) continue; // Skip dead archers
            
            const archerCenterX = archer.x + archer.size/2;
            const archerCenterY = archer.y + archer.size/2;
            const distance = this.calculateDistance(player.x, player.y, archerCenterX, archerCenterY);
            
            if (distance <= this.attackRange) {
                enemiesInRange.push({ enemy: archer, distance: distance });
            }
        }
        
        // Check sentries
        for (const sentry of this.sentries) {
            if (sentry.health <= 0) continue; // Skip dead sentries
            
            const sentryCenterX = sentry.x + sentry.size/2;
            const sentryCenterY = sentry.y + sentry.size/2;
            const distance = this.calculateDistance(player.x, player.y, sentryCenterX, sentryCenterY);
            
            if (distance <= this.attackRange) {
                enemiesInRange.push({ enemy: sentry, distance: distance });
            }
        }
        
        // Sort by distance (closest first) and return up to maxSimultaneousAttacks
        enemiesInRange.sort((a, b) => a.distance - b.distance);
        return enemiesInRange.slice(0, this.maxSimultaneousAttacks).map(item => item.enemy);
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
        } else if (deadEnemy.type === 'sentry') {
            const index = this.sentries.indexOf(deadEnemy);
            if (index > -1) {
                this.sentries.splice(index, 1);
            }
            console.log(`Sentry defeated and removed. Remaining sentries: ${this.sentries.length}`);
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

    // Phase transition methods
    startRecipePhase() {
        this.gameState = 'recipe';
        this.updateAllPlayerViews();
        console.log('Started recipe phase');
    }

    startLemonadeStand() {
        this.gameState = 'newSection';
        this.standStartTime = Date.now();
        this.standRevenue = 0;
        this.walkingCustomers = [];
        this.stoppedCustomers = [];
        this.lastCustomerSpawn = 0;
        this.usedUniqueCustomers = []; // Reset unique customers for new day
        this.updateAllPlayerViews();
        console.log('Started lemonade stand');
    }

    startNewSectionStats() {
        this.gameState = 'newSectionStats';
        this.updateAllPlayerViews();
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
                    this.recipe.sugar = Math.max(0, this.recipe.sugar - 1);
                    this.updateAllPlayerViews();
                    console.log(`Sugar decreased to ${this.recipe.sugar}`);
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
                text: this.recipe.sugar.toString(),
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
                    this.recipe.sugar = Math.min(20, this.recipe.sugar + 1);
                    this.updateAllPlayerViews();
                    console.log(`Sugar increased to ${this.recipe.sugar}`);
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
                    this.recipe.lemons = Math.max(0, this.recipe.lemons - 1);
                    this.updateAllPlayerViews();
                    console.log(`Lemons decreased to ${this.recipe.lemons}`);
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
                text: this.recipe.lemons.toString(),
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
                    this.recipe.lemons = Math.min(20, this.recipe.lemons + 1);
                    this.updateAllPlayerViews();
                    console.log(`Lemons increased to ${this.recipe.lemons}`);
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
                    console.log(`Recipe confirmed: Sugar ${this.recipe.sugar}, Lemons ${this.recipe.lemons}`);
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
        const elapsed = Date.now() - this.standStartTime;
        const timeLeft = Math.max(0, Math.ceil((this.standDuration - elapsed) / 1000));
        
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
                text: `$${this.standRevenue.toFixed(2)}`,
                align: 'right',
                size: 2
            },
            // playerIds: [playerId]
        });

        // Current price display
        const currentPrice = this.calculateLemonadePrice();
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
                text: `${this.recipe.sugar}🍯 ${this.recipe.lemons}🍋`,
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
        this.walkingCustomers.forEach(customer => {
            this.addWalkingCustomerToView(viewRoot, customer, playerId);
        });

        // Add stopped customers
        this.stoppedCustomers.forEach(customer => {
            this.addStoppedCustomerToView(viewRoot, customer, playerId);
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
                text: `DAY ${this.standDay} RESULTS`,
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
                text: `Recipe: ${this.recipe.sugar} Sugar, ${this.recipe.lemons} Lemons`,
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
                text: `Total Revenue: $${this.standRevenue.toFixed(2)}`,
                align: 'center',
                size: 2
            },
            // playerIds: [playerId]
        });

        // Boss warnings
        let yOffset = 50;
        if (this.bosses.length > 0) {
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
                    text: `${this.bosses.length} new boss(es) in combat tomorrow!`,
                    align: 'center',
                    size: 1.3
                },
                // playerIds: [playerId]
            });
            viewRoot.addChild(bossCount);
            yOffset += 10;
        }

        // Addiction stats
        const addictionCount = Object.keys(this.addictionLevels).length;
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
        // Advance day counter
        this.standDay++;
        
        // Lemons go bad after each day (reset to 0)
        this.recipe.lemons = 0;
        
        // Reset stand data for new day
        this.standRevenue = 0;
        this.walkingCustomers = [];
        this.stoppedCustomers = [];
        this.usedUniqueCustomers = [];
        
        // Reset game to combat phase
        this.resetGame();
        
        console.log(`Advanced to Day ${this.standDay}. Lemons went bad! New bosses: ${this.bosses.length}`);
    }

    // Lemonade stand customer management
    spawnWalkingCustomer() {
        // Decide if this should be a unique customer or generic
        const useUniqueCustomer = Math.random() < 0.4 && this.usedUniqueCustomers.length < this.uniqueCustomers.length;
        
        let customerData;
        let customerId;
        
        if (useUniqueCustomer) {
            // Pick a unique customer we haven't used yet
            const availableUnique = this.uniqueCustomers.filter(customer => 
                !this.usedUniqueCustomers.includes(customer.name)
            );
            customerData = availableUnique[Math.floor(Math.random() * availableUnique.length)];
            this.usedUniqueCustomers.push(customerData.name);
            customerId = `${customerData.name}_${this.standDay}`;
        } else {
            // Create a generic customer
            const genericNames = ['Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Taylor', 'Avery', 'Blake', 'Quinn'];
            const name = genericNames[Math.floor(Math.random() * genericNames.length)];
            const traitData = this.genericTraits[Math.floor(Math.random() * this.genericTraits.length)];
            
            customerData = {
                name: name,
                trait: traitData.trait,
                color: traitData.color,
                stopChance: traitData.stopChance,
                buyChance: traitData.buyChance,
                preferredPrice: traitData.preferredPrice
            };
            customerId = `${name}_${this.standDay}_${Date.now()}`;
        }
        
        // Determine spawn side (left or right)
        const spawnFromLeft = Math.random() < 0.5;
        const speed = 0.8 + Math.random() * 0.6; // Random walking speed
        
        const customer = {
            ...customerData,
            id: customerId,
            x: spawnFromLeft ? -10 : 110, // Start off-screen
            y: 45, // Walking level
            targetX: spawnFromLeft ? 110 : -10, // Walk to other side
            speed: speed,
            direction: spawnFromLeft ? 1 : -1,
            spawnTime: Date.now(),
            state: 'walking', // 'walking', 'stopped', 'purchasing', 'leaving'
            addictionLevel: this.addictionLevels[customerId] || 0,
            hasCheckedForStop: false
        };
        
        this.walkingCustomers.push(customer);
        console.log(`${customer.name} (${customer.trait}) starts walking from ${spawnFromLeft ? 'left' : 'right'}`);
    }

    updateLemonadeStand(currentTime) {
        let needsViewUpdate = false;
        
        // Spawn new customers periodically
        if (currentTime - this.lastCustomerSpawn >= this.customerSpawnInterval) {
            this.spawnWalkingCustomer();
            this.lastCustomerSpawn = currentTime;
            needsViewUpdate = true;
        }
        
        // Update walking customers
        for (let i = this.walkingCustomers.length - 1; i >= 0; i--) {
            const customer = this.walkingCustomers[i];
            
            if (customer.state === 'walking') {
                // Move customer
                customer.x += customer.direction * customer.speed;
                needsViewUpdate = true; // Customer movement requires view update
                
                // Check if customer reached the stand area (center of screen)
                if (!customer.hasCheckedForStop && 
                    ((customer.direction === 1 && customer.x >= 40) || 
                     (customer.direction === -1 && customer.x <= 60))) {
                    
                    customer.hasCheckedForStop = true;
                    
                    // Check if customer decides to stop
                    if (Math.random() < customer.stopChance) {
                        customer.state = 'stopped';
                        customer.x = 50; // Position at stand
                        customer.stopTime = currentTime;
                        this.stoppedCustomers.push(customer);
                        this.walkingCustomers.splice(i, 1);
                        console.log(`${customer.name} stopped at the stand!`);
                        needsViewUpdate = true;
                        continue;
                    }
                }
                
                // Remove customers who walked off screen
                if (customer.x < -15 || customer.x > 115) {
                    this.walkingCustomers.splice(i, 1);
                    console.log(`${customer.name} walked away without stopping`);
                    needsViewUpdate = true;
                }
            }
        }
        
        // Update stopped customers
        for (let i = this.stoppedCustomers.length - 1; i >= 0; i--) {
            const customer = this.stoppedCustomers[i];
            
            if (customer.state === 'stopped') {
                // Customer has been stopped for 2 seconds, decide whether to buy
                if (currentTime - customer.stopTime >= 2000) {
                    const currentPrice = this.calculateLemonadePrice();
                    const priceModifier = customer.preferredPrice / currentPrice;
                    const adjustedBuyChance = customer.buyChance * Math.min(1.5, priceModifier);
                    
                    if (Math.random() < adjustedBuyChance) {
                        // Customer buys!
                        this.completePurchase(customer, currentPrice);
                        customer.state = 'leaving';
                        customer.leaveTime = currentTime;
                    } else {
                        // Customer decides not to buy
                        console.log(`${customer.name} decided not to buy (price: $${currentPrice.toFixed(2)})`);
                        customer.state = 'leaving';
                        customer.leaveTime = currentTime;
                    }
                    needsViewUpdate = true;
                }
            } else if (customer.state === 'leaving') {
                // Remove customer after showing purchase result for 2 seconds
                if (currentTime - customer.leaveTime >= 2000) {
                    this.stoppedCustomers.splice(i, 1);
                    console.log(`${customer.name} leaves the stand`);
                    needsViewUpdate = true;
                }
            }
        }
        
        // Update views if anything changed
        if (needsViewUpdate) {
            this.updateAllPlayerViews();
        }
    }

    calculateLemonadePrice() {
        // Base price calculation based on recipe
        const sugar = this.recipe.sugar;
        const lemons = this.recipe.lemons;
        
        // Dynamic pricing based on recipe complexity
        const basePrice = 0.5;
        const sugarCost = sugar * 0.1; // 10 cents per sugar
        const lemonCost = lemons * 0.15; // 15 cents per lemon
        
        return basePrice + sugarCost + lemonCost;
    }
    
    completePurchase(customer, price) {
        const sugar = this.recipe.sugar;
        const lemons = this.recipe.lemons;
        
        // Calculate satisfaction based on customer trait and recipe
        let satisfaction = this.calculateCustomerSatisfaction(customer, sugar, lemons);
        
        // Adjust price based on satisfaction
        let finalPrice = price;
        let reaction = '';
        
        if (satisfaction >= 80) {
            reaction = 'Loves it!';
            finalPrice *= 1.2; // Willing to pay 20% more
        } else if (satisfaction >= 60) {
            reaction = 'Pretty good!';
        } else if (satisfaction >= 40) {
            reaction = 'It\'s okay...';
            finalPrice *= 0.8; // Pays 20% less
        } else {
            reaction = 'Not great.';
            finalPrice *= 0.5; // Pays half price
        }

        // Update addiction level based on sugar content
        const sugarAddiction = Math.floor(sugar / 3); // Every 3 sugar = 1 addiction point
        this.addictionLevels[customer.id] = (this.addictionLevels[customer.id] || 0) + sugarAddiction;
        
        // Check if customer becomes a boss
        if (this.addictionLevels[customer.id] >= 10 && !this.bosses.includes(customer.id)) {
            this.bosses.push(customer.id);
            console.log(`${customer.name} became a sugar-crazed boss!`);
        }

        this.standRevenue += finalPrice;
        customer.satisfaction = satisfaction;
        customer.finalPrice = finalPrice;
        customer.reaction = reaction;
        customer.purchased = true;

        console.log(`${customer.name}: ${reaction} (${satisfaction}% satisfaction, $${finalPrice.toFixed(2)}, addiction: ${this.addictionLevels[customer.id]})`);
    }
    
    calculateCustomerSatisfaction(customer, sugar, lemons) {
        let satisfaction = 0;
        
        switch (customer.trait) {
            case 'sweet_tooth':
                satisfaction = Math.min(100, sugar * 15 + Math.max(0, 50 - lemons * 10));
                break;
            case 'tart_lover':
                satisfaction = Math.min(100, lemons * 20 + Math.max(0, 30 - sugar * 5));
                break;
            case 'balanced':
                satisfaction = Math.min(100, 70 - Math.abs(sugar - lemons) * 10);
                break;
            case 'wealthy':
                satisfaction = Math.min(100, 60 + sugar * 8 + lemons * 8); // Appreciates quality
                break;
            case 'budget':
                satisfaction = Math.min(100, 80 - sugar * 3 - lemons * 3); // Prefers simple/cheap
                break;
            case 'critic':
                satisfaction = Math.min(100, Math.abs(sugar - 5) < 2 && Math.abs(lemons - 3) < 2 ? 90 : 30); // Very picky
                break;
            case 'regular':
                satisfaction = Math.min(100, 60 + Math.min(sugar, 8) * 5 + Math.min(lemons, 5) * 4); // Loyal but reasonable
                break;
            case 'rushed':
                satisfaction = Math.min(100, 50 + Math.random() * 40); // Random, just wants something quick
                break;
            case 'explorer':
                satisfaction = Math.min(100, sugar + lemons > 8 ? 80 : 40); // Likes adventurous recipes
                break;
            case 'pessimist':
                satisfaction = Math.min(100, Math.max(20, 60 - Math.random() * 30)); // Always somewhat dissatisfied
                break;
            default: // Generic traits
                if (customer.trait === 'casual') {
                    satisfaction = Math.min(100, 50 + sugar * 5 + lemons * 5);
                } else if (customer.trait === 'tourist') {
                    satisfaction = Math.min(100, 60 + sugar * 6 + lemons * 6);
                } else if (customer.trait === 'local') {
                    satisfaction = Math.min(100, 70 + sugar * 4 + lemons * 4);
                } else if (customer.trait === 'student') {
                    satisfaction = Math.min(100, 40 + sugar * 8); // Prefers sweet, cheap
                }
                break;
        }
        
        return satisfaction;
    }

    addWalkingCustomerToView(viewRoot, customer, playerId) {
        // Customer figure walking on sidewalk
        const customerShape = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(customer.x - 2, customer.y - 3, 4, 6),
            fill: customer.color,
            // playerIds: [playerId]
        });

        // Customer name above head
        const nameText = new GameNode.Text({
            textInfo: {
                x: customer.x,
                y: customer.y - 5,
                color: [0, 0, 0, 255],
                text: customer.name,
                align: 'center',
                size: 0.8
            },
            // playerIds: [playerId]
        });

        // Trait indicator (small text)
        const traitText = new GameNode.Text({
            textInfo: {
                x: customer.x,
                y: customer.y + 4,
                color: [100, 100, 100, 255],
                text: this.getTraitDisplayName(customer.trait),
                align: 'center',
                size: 0.6
            },
            // playerIds: [playerId]
        });

        viewRoot.addChild(customerShape);
        viewRoot.addChild(nameText);
        viewRoot.addChild(traitText);
    }

    addStoppedCustomerToView(viewRoot, customer, playerId) {
        // Customer figure at the stand
        const customerShape = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(customer.x - 3, 50, 6, 8),
            fill: customer.color,
            // playerIds: [playerId]
        });

        // Customer name
        const nameText = new GameNode.Text({
            textInfo: {
                x: customer.x,
                y: 48,
                color: [0, 0, 0, 255],
                text: customer.name,
                align: 'center',
                size: 1.0
            },
            // playerIds: [playerId]
        });

        // Customer trait
        const traitText = new GameNode.Text({
            textInfo: {
                x: customer.x,
                y: 60,
                color: [100, 100, 100, 255],
                text: this.getTraitDisplayName(customer.trait),
                align: 'center',
                size: 0.8
            },
            // playerIds: [playerId]
        });

        // Show purchase result if customer bought something
        if (customer.purchased) {
            const reactionText = new GameNode.Text({
                textInfo: {
                    x: customer.x,
                    y: 65,
                    color: customer.satisfaction >= 60 ? [0, 150, 0, 255] : [150, 0, 0, 255],
                    text: customer.reaction,
                    align: 'center',
                    size: 1.0
                },
                // playerIds: [playerId]
            });

            const priceText = new GameNode.Text({
                textInfo: {
                    x: customer.x,
                    y: 70,
                    color: [0, 100, 0, 255],
                    text: `$${customer.finalPrice.toFixed(2)}`,
                    align: 'center',
                    size: 0.8
                },
                // playerIds: [playerId]
            });

            viewRoot.addChild(reactionText);
            viewRoot.addChild(priceText);
        } else if (customer.state === 'leaving' && !customer.purchased) {
            // Customer decided not to buy
            const noSaleText = new GameNode.Text({
                textInfo: {
                    x: customer.x,
                    y: 65,
                    color: [150, 0, 0, 255],
                    text: 'Not buying',
                    align: 'center',
                    size: 0.9
                },
                // playerIds: [playerId]
            });

            viewRoot.addChild(noSaleText);
        } else {
            // Customer is deciding
            const thinkingText = new GameNode.Text({
                textInfo: {
                    x: customer.x,
                    y: 65,
                    color: [100, 100, 100, 255],
                    text: '...',
                    align: 'center',
                    size: 1.2
                },
                // playerIds: [playerId]
            });

            viewRoot.addChild(thinkingText);
        }

        viewRoot.addChild(customerShape);
        viewRoot.addChild(nameText);
        viewRoot.addChild(traitText);
    }

    getTraitDisplayName(trait) {
        switch (trait) {
            case 'sweet_tooth': return 'Sweet Tooth';
            case 'tart_lover': return 'Tart Lover';
            case 'balanced': return 'Balanced';
            case 'wealthy': return 'Rich';
            case 'budget': return 'Cheap';
            case 'critic': return 'Picky';
            case 'regular': return 'Loyal';
            case 'rushed': return 'Rushed';
            case 'explorer': return 'Curious';
            case 'pessimist': return 'Grumpy';
            case 'casual': return 'Casual';
            case 'tourist': return 'Tourist';
            case 'local': return 'Local';
            case 'student': return 'Student';
            default: return trait;
        }
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
        this.sentries = [];
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
        
        // Check for lemonade stand timer and customer management
        if (this.gameState === 'newSection' && this.standStartTime) {
            const elapsed = currentTime - this.standStartTime;
            
            // End stand after 30 seconds
            if (elapsed >= this.standDuration) {
                this.startNewSectionStats();
                return;
            }
            
            // Manage customer interactions
            this.updateLemonadeStand(currentTime);
            
            // Update views frequently for smooth customer movement (like we do for combat)
            const hasMovingCustomers = this.walkingCustomers.length > 0;
            const updateInterval = hasMovingCustomers ? 50 : 200; // 20 FPS when customers moving, 5 FPS when idle
            
            if (!this.lastViewUpdate || currentTime - this.lastViewUpdate >= updateInterval) {
                this.lastViewUpdate = currentTime;
                
                // Always update if there are moving customers, or periodically for timer
                const shouldUpdate = hasMovingCustomers || 
                                    (elapsed) % 1000 < 100; // Timer updates every second
                
                if (shouldUpdate) {
                    this.updateAllPlayerViews();
                }
            }
            
            return; // Don't proceed to combat logic during lemonade stand
        }
        
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
                const attackTargets = this.findMultipleAttackTargets(player);
                if (attackTargets.length > 0) {
                    // Attack all targets simultaneously
                    for (const target of attackTargets) {
                        this.playerAttack(target, playerId, player);
                    }
                    player.lastAttackTime = currentTime;
                    needsViewUpdate = true; // Need to update view to show attack indicators
                    
                    if (attackTargets.length > 1) {
                        console.log(`Player ${playerId} multi-attacks ${attackTargets.length} enemies!`);
                    }
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