const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { COLORS } = Colors;

class NeonShooter extends Game {
    static metadata() {
        return {
            // Catalog review: Early wave shooter; Polystorm and Doodle Invaders provide more developed alternatives.
            isTest: true,
            squishVersion: '150',
            services: ['multiplayer'],
            name: 'Neon Shooter',
            author: "Joseph Garcia",
            description: 'A neon space shooter with waves of enemies. Move with WASD/Arrows, click to shoot.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 20
        };
    }

    constructor() {
        super();
        this.phase = 'menu'; // 'menu', 'playing', 'gameover'
        this.score = 0;
        this.wave = 0;
        this.lives = 3;
        this.players = {};
        this.enemies = [];
        this.bullets = [];
        this.particles = [];
        this.waveTimer = 0;
        this.spawnTimer = 0;
        this._t = 0;

        // Build base
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.HG_BLACK
        });

        // Score text
        this.scoreText = new GameNode.Text({
            textInfo: { text: 'Score: 0', x: 50, y: 5, size: 2.5, align: 'center', color: COLORS.HG_YELLOW }
        });

        // Wave text
        this.waveText = new GameNode.Text({
            textInfo: { text: 'Wave 1', x: 50, y: 8, size: 2, align: 'center', color: COLORS.CANDY_GREEN }
        });

        // Lives display
        this.livesText = new GameNode.Text({
            textInfo: { text: 'Lives: 3', x: 50, y: 10, size: 1.5, align: 'center', color: COLORS.CANDY_RED }
        });

        // Menu text
        this.menuText = new GameNode.Text({
            textInfo: { text: 'NEON SHOOTER\nClick to Start', x: 50, y: 45, size: 3, align: 'center', color: COLORS.HG_BLUE }
        });

        // Game over text
        this.gameOverText = new GameNode.Text({
            textInfo: { text: 'GAME OVER\nFinal Score: 0\nClick to Restart', x: 50, y: 45, size: 2.5, align: 'center', color: COLORS.CANDY_RED }
        });

        // Tap catcher for shooting
        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            onClick: (playerId, x, y) => this.handleShoot(playerId, x, y)
        });

        // Add all to base
        this.base.addChildren(
            this.scoreText,
            this.waveText,
            this.livesText,
            this.menuText,
            this.gameOverText,
            this.tapCatcher
        );

        // Create particle pool (48 particles)
        for (let i = 0; i < 48; i++) {
            this.particles.push({
                active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
                node: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                    fill: [0, 0, 0, 0],
                    color: [255, 255, 255, 255]
                })
            });
            this.base.addChild(this.particles[i].node);
        }
    }

    handleNewPlayer({ playerId, info }) {
        const name = info?.name || `Player ${playerId}`;
        
        // Player ship (triangle)
        const ship = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.triangle(50, 85, 47, 92, 53, 92),
            fill: COLORS.HG_BLUE,
            effects: { shadow: { color: [148, 210, 230, 255], blur: 8 } }
        });

        // Player name (scoped to player)
        const nameTag = new GameNode.Text({
            textInfo: { text: name, x: 50, y: 95, size: 1.2, align: 'center', color: COLORS.WHITE },
            playerIds: [playerId]
        });

        this.players[playerId] = {
            node: ship,
            name: name,
            x: 50, y: 85,
            vx: 0, vy: 0,
            fireCooldown: 0,
            alive: true,
            nameTag: nameTag
        };

        this.base.addChildren(ship, nameTag);
    }

    handlePlayerDisconnect(playerId) {
        const p = this.players[playerId];
        if (p) {
            this.base.removeChild(p.node.id);
            this.base.removeChild(p.nameTag.id);
            delete this.players[playerId];
        }
    }

    handleKeyDown(playerId, key) {
        const p = this.players[playerId];
        if (!p || !p.alive) return;
        
        if (key === 'ArrowUp' || key === 'w') p.vy = -0.8;
        else if (key === 'ArrowDown' || key === 's') p.vy = 0.8;
        else if (key === 'ArrowLeft' || key === 'a') p.vx = -0.8;
        else if (key === 'ArrowRight' || key === 'd') p.vx = 0.8;
    }

    handleKeyUp(playerId, key) {
        const p = this.players[playerId];
        if (!p) return;
        
        if (key === 'ArrowUp' || key === 'w' || key === 'ArrowDown' || key === 's') p.vy = 0;
        if (key === 'ArrowLeft' || key === 'a' || key === 'ArrowRight' || key === 'd') p.vx = 0;
    }

    handleShoot(playerId, x, y) {
        if (this.phase !== 'playing') {
            // Start/restart game
            if (this.phase === 'menu' || this.phase === 'gameover') {
                this.startGame();
            }
            return;
        }

        const p = this.players[playerId];
        if (!p || !p.alive) return;
        if (this._t < p.fireCooldown) return;

        // Create bullet
        const bullet = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x - 0.5, y - 2, 1, 4),
            fill: COLORS.HG_YELLOW,
            effects: { shadow: { color: [255, 255, 0, 255], blur: 6 } }
        });

        const angle = Math.atan2(y - p.y, x - p.x);
        const speed = 2;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        this.bullets.push({
            node: bullet,
            x: p.x, y: p.y,
            vx: vx, vy: vy,
            life: 100
        });

        this.base.addChild(bullet);
        p.fireCooldown = this._t + 8; // Fire rate
    }

    startGame() {
        this.phase = 'playing';
        this.score = 0;
        this.wave = 0;
        this.lives = 3;
        this._t = 0;
        this.waveTimer = 0;
        this.spawnTimer = 0;
        this.enemies = [];
        this.bullets = [];
        this.particles.forEach(p => p.active = false);

        // Reset UI
        this.scoreText.node.text = { text: 'Score: 0', x: 50, y: 5, size: 2.5, align: 'center', color: COLORS.HG_YELLOW };
        this.waveText.node.text = { text: 'Wave 1', x: 50, y: 8, size: 2, align: 'center', color: COLORS.CANDY_GREEN };
        this.livesText.node.text = { text: 'Lives: 3', x: 50, y: 10, size: 1.5, align: 'center', color: COLORS.CANDY_RED };
        this.menuText.node.text = { text: 'NEON SHOOTER\nClick to Start', x: 50, y: 45, size: 3, align: 'center', color: COLORS.HG_BLUE };
        this.gameOverText.node.text = { text: 'GAME OVER\nFinal Score: 0\nClick to Restart', x: 50, y: 45, size: 2.5, align: 'center', color: COLORS.CANDY_RED };

        // Reset player positions
        for (const id in this.players) {
            const p = this.players[id];
            p.x = 50;
            p.y = 85;
            p.vx = 0;
            p.vy = 0;
            p.alive = true;
            p.node.node.coordinates2d = ShapeUtils.triangle(50, 85, 47, 92, 53, 92);
            p.node.node.fill = COLORS.HG_BLUE;
            p.node.node.effects = { shadow: { color: [148, 210, 230, 255], blur: 8 } };
        }

        this.base.node.onStateChange();
    }

    emitExplosion(x, y, color, count) {
        for (const p of this.particles) {
            if (count <= 0) break;
            if (p.active) continue;
            count--;
            p.active = true;
            p.life = 20;
            p.maxLife = 20;
            p.x = x;
            p.y = y;
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.2 + Math.random() * 0.5;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
            p.node.node.fill = color;
        }
    }

    spawnEnemy() {
        const types = ['basic', 'sine', 'spiral', 'charger'];
        const type = types[Math.floor(Math.random() * types.length)];
        const x = 10 + Math.random() * 80;
        const y = -5;
        const color = Colors.randomColor(['ALMOST_BLACK', 'HG_BLACK', 'BLACK']);

        let enemyNode;
        if (type === 'basic') {
            enemyNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.triangle(x, y, x - 3, y + 6, x + 3, y + 6),
                fill: color,
                effects: { shadow: { color: color, blur: 4 } }
            });
        } else if (type === 'sine') {
            enemyNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x - 2, y, 4, 4),
                fill: color,
                effects: { shadow: { color: color, blur: 4 } }
            });
        } else if (type === 'spiral') {
            enemyNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.triangle(x, y, x - 4, y + 8, x + 4, y + 8),
                fill: color,
                effects: { shadow: { color: color, blur: 4 } }
            });
        } else {
            enemyNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x - 3, y, 6, 6),
                fill: color,
                effects: { shadow: { color: color, blur: 4 } }
            });
        }

        this.base.addChild(enemyNode);

        this.enemies.push({
            node: enemyNode,
            x: x, y: y,
            vx: 0, vy: 0.3,
            type: type,
            phase: 0,
            life: 3,
            color: color
        });
    }

    tick() {
        this._t++;

        if (this.phase !== 'playing') {
            this.base.node.onStateChange();
            return;
        }

        let changed = false;

        // Update player
        for (const id in this.players) {
            const p = this.players[id];
            if (!p.alive) continue;

            p.x += p.vx;
            p.y += p.vy;
            p.x = Math.max(2, Math.min(98, p.x));
            p.y = Math.max(2, Math.min(98, p.y));

            p.node.node.coordinates2d = ShapeUtils.triangle(p.x, p.y, p.x - 3, p.y + 6, p.x + 3, p.y + 6);
            changed = true;
        }

        // Update bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.x += b.vx;
            b.y += b.vy;
            b.life--;

            b.node.node.coordinates2d = ShapeUtils.rectangle(b.x - 0.5, b.y - 2, 1, 4);

            if (b.life <= 0 || b.y < 0 || b.y > 100 || b.x < 0 || b.x > 100) {
                this.base.removeChild(b.node.id);
                this.bullets.splice(i, 1);
                changed = true;
                continue;
            }

            // Check collision with enemies
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const e = this.enemies[j];
                const dx = b.x - e.x;
                const dy = b.y - e.y;
                if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
                    // Hit!
                    this.emitExplosion(e.x, e.y, e.color, 8);
                    this.base.removeChild(e.node.id);
                    this.enemies.splice(j, 1);
                    this.base.removeChild(b.node.id);
                    this.bullets.splice(i, 1);
                    this.score += 10;
                    this.scoreText.node.text = { text: `Score: ${this.score}`, x: 50, y: 5, size: 2.5, align: 'center', color: COLORS.HG_YELLOW };
                    changed = true;
                    break;
                }
            }
        }

        // Update enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.x += e.vx;
            e.y += e.vy;
            e.phase += 0.05;

            if (e.type === 'sine') {
                e.x += Math.sin(e.phase) * 0.5;
            } else if (e.type === 'spiral') {
                e.vx += Math.cos(e.phase) * 0.02;
                e.vy += Math.sin(e.phase) * 0.02;
            } else if (e.type === 'charger') {
                // Charge towards nearest player
                let nearest = null;
                let minDist = Infinity;
                for (const id in this.players) {
                    const p = this.players[id];
                    if (!p.alive) continue;
                    const dx = p.x - e.x;
                    const dy = p.y - e.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = p;
                    }
                }
                if (nearest) {
                    const angle = Math.atan2(nearest.y - e.y, nearest.x - e.x);
                    e.vx = Math.cos(angle) * 0.5;
                    e.vy = Math.sin(angle) * 0.5;
                }
            }

            e.node.node.coordinates2d = e.node.node.coordinates2d; // Keep shape

            // Check if off screen
            if (e.y > 105) {
                this.base.removeChild(e.node.id);
                this.enemies.splice(i, 1);
                changed = true;
                continue;
            }

            // Check collision with players
            for (const id in this.players) {
                const p = this.players[id];
                if (!p.alive) continue;
                const dx = p.x - e.x;
                const dy = p.y - e.y;
                if (Math.abs(dx) < 4 && Math.abs(dy) < 4) {
                    // Player hit!
                    this.emitExplosion(p.x, p.y, COLORS.HG_BLUE, 12);
                    p.alive = false;
                    p.node.node.fill = COLORS.CANDY_RED;
                    p.node.node.effects = null;
                    this.lives--;
                    this.livesText.node.text = { text: `Lives: ${this.lives}`, x: 50, y: 10, size: 1.5, align: 'center', color: COLORS.CANDY_RED };
                    changed = true;

                    if (this.lives <= 0) {
                        this.phase = 'gameover';
                        this.gameOverText.node.text = { text: `GAME OVER\nFinal Score: ${this.score}\nClick to Restart`, x: 50, y: 45, size: 2.5, align: 'center', color: COLORS.CANDY_RED };
                    }
                    break;
                }
            }
        }

        // Update particles
        for (const p of this.particles) {
            if (!p.active) continue;
            p.x += p.vx;
            p.y += p.vy;
            p.life--;

            if (p.life <= 0) {
                p.active = false;
                p.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                p.node.node.fill = [0, 0, 0, 0];
                continue;
            }

            p.node.node.coordinates2d = ShapeUtils.rectangle(p.x - 0.3, p.y - 0.3, 0.6, 0.6);
            p.node.node.color = [255, 255, 255, Math.round(255 * p.life / p.maxLife)];
        }

        // Spawn enemies
        this.spawnTimer++;
        if (this.spawnTimer >= 60) {
            this.spawnTimer = 0;
            this.spawnEnemy();
            changed = true;
        }

        // Wave progression
        this.waveTimer++;
        if (this.waveTimer >= 600) { // Every ~30 seconds
            this.waveTimer = 0;
            this.wave++;
            this.waveText.node.text = { text: `Wave ${this.wave}`, x: 50, y: 8, size: 2, align: 'center', color: COLORS.CANDY_GREEN };
            changed = true;
        }

        if (changed) {
            this.base.node.onStateChange();
        }
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = NeonShooter;