const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { COLORS } = Colors;

class NeonDodge extends Game {
    static metadata() {
        return {
            // Catalog review: Small survival prototype; retain for review alongside the more developed arcade games.
            isTest: true,
            squishVersion: '150',
            services: ['multiplayer'],
            name: 'Neon Dodge',
            author: "Joseph Garcia",
            description: 'Survive the neon chaos! Dodge enemies, collect power-ups, and be the last ship standing.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 30
        };
    }

    constructor() {
        super();
        this.players = {};
        this.enemies = [];
        this.particles = [];
        this.powerUps = [];
        this.tickCount = 0;
        this.spawnTimer = 0;
        this.difficulty = 1;
        this.gameOver = false;
        this.winner = null;

        // Background
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.ALMOST_BLACK
        });

        // UI layer
        this.uiLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        // Start screen
        this.createStartScreen();

        this.base.addChild(this.uiLayer);
    }

    createStartScreen() {
        // Title with glow effect
        const titleY = 30;
        const glowOffsets = [[-0.3, 0], [0.3, 0], [0, -0.3], [0, 0.3]];
        
        glowOffsets.forEach(offset => {
            const glowText = new GameNode.Text({
                textInfo: {
                    text: 'NEON DODGE',
                    x: 50,
                    y: titleY + offset[1],
                    size: 6,
                    align: 'center',
                    color: [COLORS.CYAN[0], COLORS.CYAN[1], COLORS.CYAN[2], 100],
                    font: 'monospace'
                }
            });
            this.uiLayer.addChild(glowText);
        });

        const title = new GameNode.Text({
            textInfo: {
                text: 'NEON DODGE',
                x: 50,
                y: titleY,
                size: 6,
                align: 'center',
                color: COLORS.CYAN,
                font: 'monospace'
            }
        });
        this.uiLayer.addChild(title);

        // Instructions
        const instructions = new GameNode.Text({
            textInfo: {
                text: 'Arrows/WASD to move • Survive the chaos!',
                x: 50,
                y: 45,
                size: 2.5,
                align: 'center',
                color: COLORS.HG_BLUE
            }
        });
        this.uiLayer.addChild(instructions);

        // Start button
        const startBtn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(35, 60, 30, 12),
            fill: COLORS.CANDY_PINK,
            effects: { shadow: { color: COLORS.CANDY_PINK, blur: 10 } },
            onClick: (playerId) => this.startGame()
        });

        const startText = new GameNode.Text({
            textInfo: {
                text: 'START GAME',
                x: 50,
                y: 65,
                size: 2.5,
                align: 'center',
                color: COLORS.WHITE
            }
        });
        startBtn.addChild(startText);
        this.uiLayer.addChild(startBtn);

        this.showStartScreen = true;
    }

    startGame() {
        // Clear UI
        this.uiLayer.node.clearChildren();
        this.showStartScreen = false;
        this.gameOver = false;
        this.winner = null;
        this.difficulty = 1;
        this.spawnTimer = 0;
        this.enemies = [];
        this.particles = [];
        this.powerUps = [];

        // Reset player positions
        for (const playerId in this.players) {
            const player = this.players[playerId];
            player.x = 50;
            player.y = 50;
            player.vx = 0;
            player.vy = 0;
            player.alive = true;
            player.score = 0;
            player.speed = 0.3;
            player.ship.node.coordinates2d = ShapeUtils.triangle(50, 50, 50, 50, 50, 50);
            player.ship.node.playerIds = [Number(playerId)];
            player.trail = [];
        }

        // Create score display
        this.scoreText = new GameNode.Text({
            textInfo: {
                text: 'Wave: 1',
                x: 5,
                y: 5,
                size: 2,
                align: 'left',
                color: COLORS.WHITE
            }
        });
        this.uiLayer.addChild(this.scoreText);

        // Create player count display
        this.updatePlayerCountText();
    }

    handleNewPlayer({ playerId, info }) {
        const color = Colors.randomColor(['ALMOST_BLACK', 'BLACK', 'WHITE']);
        
        // Ship shape (triangle pointing up)
        const ship = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.triangle(50, 50, 48, 47, 52, 47),
            fill: color,
            effects: { shadow: { color: color, blur: 8 } },
            playerIds: [Number(playerId)]
        });

        this.players[playerId] = {
            x: 50,
            y: 50,
            vx: 0,
            vy: 0,
            alive: true,
            score: 0,
            speed: 0.3,
            color: color,
            ship: ship,
            trail: [],
            name: info?.name || `Player ${playerId}`
        };

        this.base.addChild(ship);
        this.updatePlayerCountText();
    }

    handlePlayerDisconnect(playerId) {
        const player = this.players[playerId];
        if (player) {
            this.base.removeChild(player.ship.node.id);
            delete this.players[playerId];
            this.updatePlayerCountText();
        }
    }

    handleKeyDown(playerId, key) {
        const player = this.players[playerId];
        if (!player || !player.alive) return;

        if (key === 'ArrowUp' || key === 'w') player.vy = -player.speed;
        else if (key === 'ArrowDown' || key === 's') player.vy = player.speed;
        else if (key === 'ArrowLeft' || key === 'a') player.vx = -player.speed;
        else if (key === 'ArrowRight' || key === 'd') player.vx = player.speed;
    }

    handleKeyUp(playerId, key) {
        const player = this.players[playerId];
        if (!player) return;

        if (key === 'ArrowUp' || key === 'w' || key === 'ArrowDown' || key === 's') {
            if (key === 'ArrowUp' || key === 'w') player.vy = 0;
            else player.vy = 0;
        }
        if (key === 'ArrowLeft' || key === 'a' || key === 'ArrowRight' || key === 'd') {
            if (key === 'ArrowLeft' || key === 'a') player.vx = 0;
            else player.vx = 0;
        }
    }

    updatePlayerCountText() {
        const count = Object.keys(this.players).length;
        if (this.playerCountText) {
            this.uiLayer.removeChild(this.playerCountText.node.id);
        }
        this.playerCountText = new GameNode.Text({
            textInfo: {
                text: `Players: ${count}`,
                x: 95,
                y: 5,
                size: 2,
                align: 'right',
                color: COLORS.WHITE
            }
        });
        this.uiLayer.addChild(this.playerCountText);
    }

    spawnEnemy() {
        const edge = Math.floor(Math.random() * 4);
        let x, y;
        
        switch (edge) {
            case 0: x = Math.random() * 100; y = -2; break;
            case 1: x = 102; y = Math.random() * 100; break;
            case 2: x = Math.random() * 100; y = 102; break;
            case 3: x = -2; y = Math.random() * 100; break;
        }

        const enemy = {
            x: x,
            y: y,
            vx: 0,
            vy: 0,
            speed: 0.15 + this.difficulty * 0.02,
            size: 2.5,
            color: COLORS.CANDY_RED,
            node: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: this.makeDiamond(x, y, 2.5),
                fill: COLORS.CANDY_RED,
                effects: { shadow: { color: COLORS.CANDY_RED, blur: 6 } }
            }),
            targetPlayer: null,
            targetSwitchTimer: 0
        };

        this.enemies.push(enemy);
        this.base.addChild(enemy.node);
    }

    makeDiamond(cx, cy, size) {
        return [
            [cx, cy - size],
            [cx + size, cy],
            [cx, cy + size],
            [cx - size, cy],
            [cx, cy - size]
        ];
    }

    makeTriangle(cx, cy, angle, size) {
        return ShapeUtils.triangle(
            cx + Math.cos(angle) * size, cy + Math.sin(angle) * size,
            cx + Math.cos(angle + 2.5) * size, cy + Math.sin(angle + 2.5) * size,
            cx + Math.cos(angle - 2.5) * size, cy + Math.sin(angle - 2.5) * size
        );
    }

    createExplosion(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 0.1 + Math.random() * 0.15;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 30 + Math.random() * 20,
                color: color,
                size: 0.5 + Math.random() * 0.5,
                node: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(x, y, 0.5, 0.5),
                    fill: color
                })
            });
            this.base.addChild(this.particles[this.particles.length - 1].node);
        }
    }

    spawnPowerUp() {
        const x = 10 + Math.random() * 80;
        const y = 10 + Math.random() * 80;
        const type = Math.random() < 0.5 ? 'speed' : 'shield';
        
        const powerUp = {
            x: x,
            y: y,
            type: type,
            pulse: 0,
            node: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: this.makeDiamond(x, y, 2),
                fill: type === 'speed' ? COLORS.GOLD : COLORS.CYAN,
                effects: { shadow: { color: type === 'speed' ? COLORS.GOLD : COLORS.CYAN, blur: 8 } }
            })
        };
        
        this.powerUps.push(powerUp);
        this.base.addChild(powerUp.node);
    }

    updatePlayer(player) {
        if (!player.alive) return;

        // Move player
        player.x = Math.max(2, Math.min(98, player.x + player.vx));
        player.y = Math.max(2, Math.min(98, player.y + player.vy));

        // Update ship position
        const angle = Math.atan2(player.vy, player.vx) + Math.PI / 2;
        if (Math.abs(player.vx) > 0.01 || Math.abs(player.vy) > 0.01) {
            player.ship.node.coordinates2d = this.makeTriangle(
                player.x, player.y, angle, 1.5
            );
        }

        // Trail effect
        player.trail.push({ x: player.x, y: player.y, life: 15 });
        if (player.trail.length > 10) player.trail.shift();

        // Update trail nodes
        player.trail.forEach((t, i) => {
            t.life--;
            if (t.life <= 0) return;
            const size = (t.life / 15) * 1.5;
            if (!t.node) {
                t.node = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(t.x - size/2, t.y - size/2, size, size),
                    fill: player.color,
                });
            }
        });
    }

    updateEnemies() {
        const alivePlayers = Object.values(this.players).filter(p => p.alive);
        
        this.enemies.forEach(enemy => {
            // Find closest alive player
            let closest = null;
            let closestDist = Infinity;
            
            alivePlayers.forEach(player => {
                const dx = player.x - enemy.x;
                const dy = player.y - enemy.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = player;
                }
            });

            if (closest) {
                const dx = closest.x - enemy.x;
                const dy = closest.y - enemy.y;
                const angle = Math.atan2(dy, dx);
                enemy.vx = Math.cos(angle) * enemy.speed;
                enemy.vy = Math.sin(angle) * enemy.speed;
            }

            enemy.x += enemy.vx;
            enemy.y += enemy.vy;
            enemy.node.node.coordinates2d = this.makeDiamond(enemy.x, enemy.y, enemy.size);

            // Check collision with players
            alivePlayers.forEach(player => {
                const dx = player.x - enemy.x;
                const dy = player.y - enemy.y;
                if (Math.sqrt(dx * dx + dy * dy) < 3) {
                    player.alive = false;
                    player.ship.node.fill = COLORS.DARK_GRAY;
                    player.ship.node.effects = null;
                    this.createExplosion(player.x, player.y, player.color, 15);
                    this.base.removeChild(enemy.node.id);
                    enemy.dead = true;
                }
            });
        });

        this.enemies = this.enemies.filter(e => !e.dead);
    }

    updateParticles() {
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            p.node.node.coordinates2d = ShapeUtils.rectangle(
                p.x - p.size/2, p.y - p.size/2, p.size, p.size
            );
            p.node.node.fill = [p.color[0], p.color[1], p.color[2], Math.max(0, p.life * 8)];
        });
        this.particles = this.particles.filter(p => p.life > 0);
    }

    updatePowerUps() {
        this.powerUps.forEach(p => {
            p.pulse += 0.1;
            const scale = 1 + Math.sin(p.pulse) * 0.2;
            const size = 2 * scale;
            p.node.node.coordinates2d = this.makeDiamond(p.x, p.y, size);

            // Check collision with players
            Object.values(this.players).forEach(player => {
                if (player.alive) {
                    const dx = player.x - p.x;
                    const dy = player.y - p.y;
                    if (Math.sqrt(dx * dx + dy * dy) < 3.5) {
                        // Apply power-up
                        if (p.type === 'speed') {
                            player.speed = Math.min(0.6, player.speed + 0.1);
                        }
                        this.createExplosion(p.x, p.y, p.node.node.fill, 8);
                        this.base.removeChild(p.node.id);
                        p.dead = true;
                    }
                }
            });
        });
        this.powerUps = this.powerUps.filter(p => !p.dead);
    }

    checkGameOver() {
        const alivePlayers = Object.values(this.players).filter(p => p.alive);
        
        if (alivePlayers.length === 0 && !this.gameOver) {
            this.gameOver = true;
            this.showGameOverScreen('GAME OVER', COLORS.CANDY_RED);
        } else if (alivePlayers.length === 1 && !this.gameOver) {
            this.gameOver = true;
            this.winner = alivePlayers[0];
            this.showGameOverScreen(`WINNER: ${this.winner.name}!`, COLORS.GOLD);
        }
    }

    showGameOverScreen(text, color) {
        // Game over text
        const gameOverText = new GameNode.Text({
            textInfo: {
                text: text,
                x: 50,
                y: 35,
                size: 5,
                align: 'center',
                color: color,
                font: 'monospace'
            }
        });
        this.uiLayer.addChild(gameOverText);

        // Play again button
        const playAgainBtn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(35, 55, 30, 12),
            fill: COLORS.HG_BLUE,
            effects: { shadow: { color: COLORS.HG_BLUE, blur: 10 } },
            onClick: () => {
                location.reload();
            }
        });

        const playAgainText = new GameNode.Text({
            textInfo: {
                text: 'PLAY AGAIN',
                x: 50,
                y: 60,
                size: 2.5,
                align: 'center',
                color: COLORS.WHITE
            }
        });
        playAgainBtn.addChild(playAgainText);
        this.uiLayer.addChild(playAgainBtn);
    }

    tick() {
        this.tickCount++;

        // Spawn enemies
        this.spawnTimer++;
        const spawnRate = Math.max(20, 60 - this.difficulty * 5);
        if (this.spawnTimer >= spawnRate) {
            this.spawnEnemy();
            this.spawnTimer = 0;
        }

        // Increase difficulty
        if (this.tickCount % 300 === 0) {
            this.difficulty++;
            this.scoreText.node.text = {
                text: `Wave: ${this.difficulty}`,
                x: 5,
                y: 5,
                size: 2,
                align: 'left',
                color: COLORS.WHITE
            };
        }

        // Spawn power-ups
        if (this.tickCount % 180 === 0) {
            this.spawnPowerUp();
        }

        // Update players
        Object.values(this.players).forEach(p => this.updatePlayer(p));

        // Update enemies
        this.updateEnemies();

        // Update particles
        this.updateParticles();

        // Update power-ups
        this.updatePowerUps();

        // Check game over
        this.checkGameOver();

        this.base.node.onStateChange();
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = NeonDodge;