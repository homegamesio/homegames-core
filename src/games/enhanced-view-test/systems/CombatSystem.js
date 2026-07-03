const { GameNode, ShapeUtils, Shapes } = require('squish-142');

class CombatSystem {
    constructor(config) {
        // Enemy arrays
        this.guards = [];
        this.archers = [];
        this.sentries = [];
        this.projectiles = [];
        
        // Combat configuration
        this.config = config;
        
        // Combat indicators for visual feedback
        this.attackIndicators = [];
        this.damageIndicators = [];
    }
    
    // Enemy spawning methods
    spawnGuardsAroundPool(poolData, numGuards, worldSize, worldBase) {
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
            const clampedX = Math.max(0, Math.min(worldSize - guardSize, guardX));
            const clampedY = Math.max(0, Math.min(worldSize - guardSize, guardY));

            // 50% guards, 30% archers, 20% sentries for resource pools
            const enemyRoll = Math.random();
            if (enemyRoll < 0.5) {
                this.spawnGuard(clampedX, clampedY, guardSize, poolData, worldBase);
            } else if (enemyRoll < 0.8) {
                this.spawnArcher(clampedX, clampedY, guardSize, poolData, worldBase);
            } else {
                this.spawnSentry(clampedX, clampedY, guardSize, poolData, worldBase);
            }
        }
    }
    
    spawnGuard(x, y, size, poolData, worldBase) {
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
        worldBase.addChild(guard);
    }
    
    spawnArcher(x, y, size, poolData, worldBase) {
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
            health: this.config.archerHealth,
            maxHealth: this.config.archerHealth,
            type: 'archer'
        };

        this.archers.push(archerData);
        worldBase.addChild(archer);
    }
    
    spawnSentry(x, y, size, poolData, worldBase) {
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
            health: this.config.sentryHealth,
            maxHealth: this.config.sentryHealth,
            type: 'sentry'
        };

        this.sentries.push(sentryData);
        worldBase.addChild(sentry);
    }

    spawnFreeRoamingGuard(x, y, size, worldBase) {
        const guard = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, size, size),
            fill: [150, 0, 0, 255], // Darker red for free-roaming guards
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
        worldBase.addChild(guard);
    }

    spawnFreeRoamingArcher(x, y, size, worldBase) {
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
        worldBase.addChild(archer);
    }

    spawnFreeRoamingSentry(x, y, size, worldBase) {
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
        worldBase.addChild(sentry);
    }

    spawnBoss(x, y, name, bossId, worldBase) {
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
        worldBase.addChild(boss);
        
        console.log(`Spawned boss ${name} (${bossId}) at (${x.toFixed(1)}, ${y.toFixed(1)})`);
    }

    // Utility methods
    calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
    }

    // AI Update methods
    updateEnemyAI(currentTime, players) {
        // Update regular guards
        for (const guard of this.guards) {
            if (guard.health <= 0) continue; // Skip dead guards
            this.updateGuardAI(guard, currentTime, players);
        }
        
        // Update archers
        for (const archer of this.archers) {
            if (archer.health <= 0) continue; // Skip dead archers
            this.updateArcherAI(archer, currentTime, players);
        }
        
        // Update sentries
        for (const sentry of this.sentries) {
            if (sentry.health <= 0) continue; // Skip dead sentries
            this.updateSentryAI(sentry, currentTime, players);
        }
    }
    
    updateGuardAI(guard, currentTime, players) {
        let closestPlayer = null;
        let closestDistance = Infinity;

        // Find the closest player within detection range (bosses have extended range)
        const detectionRange = guard.type === 'boss' ? guard.detectionRange : this.config.enemyDetectionRange;
        
        for (const playerId in players) {
            const player = players[playerId];
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
            const attackRange = guard.type === 'boss' ? guard.attackRange : this.config.enemyAttackRange;
            if (closestDistance <= attackRange && 
                currentTime - guard.lastAttackTime >= this.config.enemyAttackCooldown) {
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
    
    updateArcherAI(archer, currentTime, players) {
        let closestPlayer = null;
        let closestDistance = Infinity;

        // Find the closest player within detection range
        for (const playerId in players) {
            const player = players[playerId];
            const distance = this.calculateDistance(archer.x + archer.size/2, archer.y + archer.size/2, player.x, player.y);
            
            if (distance <= this.config.enemyDetectionRange && distance < closestDistance) {
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
            if (closestDistance < this.config.archerKiteDistance) {
                // Too close! Move away from player
                this.moveArcherAwayFromPlayer(archer, closestPlayer);
            } else if (closestDistance > this.config.archerProjectileRange) {
                // Too far to shoot, move closer (but still try to maintain kite distance)
                this.moveGuardTowards(archer, closestPlayer.x, closestPlayer.y);
            }
            // If in the sweet spot (archerKiteDistance <= distance <= archerProjectileRange), just hold position and shoot

            // Shoot projectile if within range and cooldown is ready
            if (closestDistance <= this.config.archerProjectileRange && 
                currentTime - archer.lastProjectileTime >= this.config.archerProjectileCooldown) {
                this.archerShootProjectile(archer, closestPlayer, archer.targetPlayerId);
                archer.lastProjectileTime = currentTime;
            }
            
            // Melee attack only as last resort if player gets really close
            if (closestDistance <= this.config.enemyAttackRange && 
                currentTime - archer.lastAttackTime >= this.config.enemyAttackCooldown) {
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

    updateSentryAI(sentry, currentTime, players) {
        let closestPlayer = null;
        let closestDistance = Infinity;

        // Find the closest player within projectile range (sentries don't chase)
        for (const playerId in players) {
            const player = players[playerId];
            const distance = this.calculateDistance(sentry.x + sentry.size/2, sentry.y + sentry.size/2, player.x, player.y);
            
            if (distance <= this.config.sentryProjectileRange && distance < closestDistance) {
                closestPlayer = player;
                closestDistance = distance;
                sentry.targetPlayerId = playerId;
            }
        }

        // Sentry shoots heavy projectile if player is in range
        if (closestPlayer && currentTime - sentry.lastProjectileTime >= this.config.sentryProjectileCooldown) {
            this.sentryShootProjectile(sentry, closestPlayer, sentry.targetPlayerId);
            sentry.lastProjectileTime = currentTime;
        }
    }

    // Movement methods
    moveGuardTowards(guard, targetX, targetY) {
        const guardCenterX = guard.x + guard.size/2;
        const guardCenterY = guard.y + guard.size/2;
        
        const distance = this.calculateDistance(guardCenterX, guardCenterY, targetX, targetY);
        
        if (distance > 1) { // Only move if not already at target
            const angle = Math.atan2(targetY - guardCenterY, targetX - guardCenterX);
            const newX = guard.x + Math.cos(angle) * this.config.enemySpeed;
            const newY = guard.y + Math.sin(angle) * this.config.enemySpeed;
            
            // Keep guard within world bounds
            guard.x = Math.max(0, Math.min(this.config.worldSize - guard.size, newX));
            guard.y = Math.max(0, Math.min(this.config.worldSize - guard.size, newY));
            
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
            boss.x = Math.max(0, Math.min(this.config.worldSize - boss.size, newX));
            boss.y = Math.max(0, Math.min(this.config.worldSize - boss.size, newY));
            
            // Update the visual node position
            boss.node.node.coordinates2d = ShapeUtils.rectangle(boss.x, boss.y, boss.size, boss.size);
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
        const kiteSpeed = this.config.basePlayerSpeed * 0.25; // 25% of base player speed
        const newX = archer.x + normalizedX * kiteSpeed;
        const newY = archer.y + normalizedY * kiteSpeed;
        
        // Keep archer within world bounds
        archer.x = Math.max(0, Math.min(this.config.worldSize - archer.size, newX));
        archer.y = Math.max(0, Math.min(this.config.worldSize - archer.size, newY));
        
        // Update the visual node position
        archer.node.node.coordinates2d = ShapeUtils.rectangle(archer.x, archer.y, archer.size, archer.size);
    }

    // Attack methods
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
        }
    }
    
    archerAttackPlayer(archer, player, playerId) {
        const damage = this.config.archerDamage; // Archers do less melee damage
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
            velocityX: Math.cos(angle) * this.config.projectileSpeed,
            velocityY: Math.sin(angle) * this.config.projectileSpeed,
            size: this.config.projectileSize,
            damage: this.config.projectileDamage,
            createdAt: Date.now(),
            targetPlayerId: playerId
        };
        
        this.projectiles.push(projectile);
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
            velocityX: Math.cos(angle) * this.config.sentryProjectileSpeed,
            velocityY: Math.sin(angle) * this.config.sentryProjectileSpeed,
            size: this.config.sentryProjectileSize,
            damage: this.config.sentryProjectileDamage,
            createdAt: Date.now(),
            targetPlayerId: playerId,
            type: 'sentry' // Mark as sentry projectile for different appearance
        };
        
        this.projectiles.push(projectile);
    }

    // Projectile management
    updateProjectiles(currentTime, players) {
        // Update projectile positions and check for collisions
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            
            // Move projectile
            projectile.x += projectile.velocityX;
            projectile.y += projectile.velocityY;
            
            // Check if projectile is out of bounds (remove old projectiles)
            if (projectile.x < 0 || projectile.x > this.config.worldSize ||
                projectile.y < 0 || projectile.y > this.config.worldSize ||
                currentTime - projectile.createdAt > 5000) { // 5 second max lifetime
                this.projectiles.splice(i, 1);
                continue;
            }
            
            // Check collision with players
            for (const playerId in players) {
                const player = players[playerId];
                const distance = this.calculateDistance(projectile.x, projectile.y, player.x, player.y);
                
                if (distance <= this.config.playerSize/2 + projectile.size/2) {
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

    // Player attack handling
    findMultipleAttackTargets(player, attackRange, maxSimultaneousAttacks) {
        // Find multiple enemies within attack range, up to maxSimultaneousAttacks
        let enemiesInRange = [];
        
        // Check guards
        for (const guard of this.guards) {
            if (guard.health <= 0) continue; // Skip dead guards
            
            const guardCenterX = guard.x + guard.size/2;
            const guardCenterY = guard.y + guard.size/2;
            const distance = this.calculateDistance(player.x, player.y, guardCenterX, guardCenterY);
            
            if (distance <= attackRange) {
                enemiesInRange.push({ enemy: guard, distance: distance });
            }
        }
        
        // Check archers
        for (const archer of this.archers) {
            if (archer.health <= 0) continue; // Skip dead archers
            
            const archerCenterX = archer.x + archer.size/2;
            const archerCenterY = archer.y + archer.size/2;
            const distance = this.calculateDistance(player.x, player.y, archerCenterX, archerCenterY);
            
            if (distance <= attackRange) {
                enemiesInRange.push({ enemy: archer, distance: distance });
            }
        }
        
        // Check sentries
        for (const sentry of this.sentries) {
            if (sentry.health <= 0) continue; // Skip dead sentries
            
            const sentryCenterX = sentry.x + sentry.size/2;
            const sentryCenterY = sentry.y + sentry.size/2;
            const distance = this.calculateDistance(player.x, player.y, sentryCenterX, sentryCenterY);
            
            if (distance <= attackRange) {
                enemiesInRange.push({ enemy: sentry, distance: distance });
            }
        }
        
        // Sort by distance (closest first) and return up to maxSimultaneousAttacks
        enemiesInRange.sort((a, b) => a.distance - b.distance);
        return enemiesInRange.slice(0, maxSimultaneousAttacks).map(item => item.enemy);
    }
    
    playerAttackEnemy(enemy, playerId, player, attackDamage, worldBase) {
        const damage = attackDamage;
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
            this.removeDeadEnemy(enemy, player, worldBase);
            return true; // Enemy was killed
        }
        
        return false; // Enemy is still alive
    }
    
    removeDeadEnemy(deadEnemy, player, worldBase) {
        // Remove from world base
        worldBase.removeChild(deadEnemy.node.node.id);
        
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
        console.log(`Player score: ${player.score}`);
    }

    // Cleanup methods
    cleanupExpiredIndicators(currentTime) {
        // Clean up expired damage indicators
        this.damageIndicators = this.damageIndicators.filter(indicator => 
            currentTime - indicator.createdAt < indicator.duration
        );
        
        // Clean up expired attack indicators
        this.attackIndicators = this.attackIndicators.filter(indicator => 
            currentTime - indicator.createdAt < indicator.duration
        );
    }

    // Reset methods
    reset() {
        this.guards = [];
        this.archers = [];
        this.sentries = [];
        this.projectiles = [];
        this.attackIndicators = [];
        this.damageIndicators = [];
    }

    // Getters for the main game
    getAllEnemies() {
        return [...this.guards, ...this.archers, ...this.sentries];
    }

    hasMovingEnemies() {
        return this.archers.some(archer => archer.isChasing) || 
               this.guards.some(guard => guard.isChasing);
    }

    hasActiveProjectiles() {
        return this.projectiles.length > 0;
    }
}

module.exports = CombatSystem; 
