const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { COLORS } = Colors;

/**
 * Bunny Harvest
 * A multiplayer game where players (and bots) compete to collect the most carrots.
 */
class BunnyHarvest extends Game {
    static metadata() {
        return {
            isTest: true, // Catalog review: see docs/game-consolidation.md.

            squishVersion: '150',
            services: ['multiplayer'],
            name: 'Bunny Harvest',
            author: "Joseph Garcia",
            description: 'Collect as many carrots as you can before time runs out!',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 20
        };
    }

    constructor() {
        super();
        this.gameTime = 60 * 20; // 60 seconds at 20fps
        this.phase = 'lobby'; // lobby | playing | gameOver
        this.players = {}; // playerId -> player state
        this.bots = [];    // bot states
        this.carrotPool = [];
        this.maxCarrots = 15;

        // Root background (the meadow)
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [100, 180, 60, 255] // Grass green
        });

        // UI Elements
        this.scoreText = new GameNode.Text({
            textInfo: { text: 'Welcome to Bunny Harvest!', x: 50, y: 10, size: 3, align: 'center', color: COLORS.WHITE }
        });

        this.timerText = new GameNode.Text({
            textInfo: { text: '', x: 90, y: 10, size: 2, align: 'right', color: COLORS.WHITE }
        });

        // Start Button
        this.startBtn = this.makeButton({
            x: 35, y: 45, w: 30, h: 10, label: 'Start Harvest', fill: COLORS.CANDY_PINK,
            onClick: (playerId) => this.startGame(playerId)
        });

        this.base.addChildren(this.scoreText, this.timerText, this.startBtn);

        // Pre-allocate carrot pool
        for (let i = 0; i < this.maxCarrots; i++) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                fill: [255, 140, 0, 255], // Carrot orange
                playerIds: [0] // Hidden initially
            });
            this.base.addChild(node);
            this.carrotPool.push({ active: false, node: node });
        }
    }

    makeButton({ x, y, w, h, label, fill, onClick }) {
        const bg = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill,
            onClick: (pid) => onClick(pid)
        });
        const text = new GameNode.Text({
            textInfo: { text: label, x: x + w / 2, y: y + h / 2 - 1, size: 2, align: 'center', color: COLORS.WHITE }
        });
        bg.addChild(text);
        return bg;
    }

    // Helper to create a bunny-like shape (body + ears)
    createBunnyNode(color) {
        const container = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0), // Zero size so it doesn't swallow clicks
            fill: [0, 0, 0, 0]
        });

        // Body (approx circle)
        const body = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: this.polyCircle(0, 0, 2.5),
            fill: color
        });

        // Ears
        const earL = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(-1.5, -4, 0.8, 2),
            fill: color
        });
        const earR = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0.7, -4, 0.8, 2),
            fill: color
        });

        container.addChildren(body, earL, earR);
        return container;
    }

    polyCircle(cx, cy, r) {
        const pts = [];
        for (let i = 0; i <= 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        return pts;
    }

    handleNewPlayer({ playerId, info }) {
        const color = Colors.randomColor(['BLACK', 'ALMOST_BLACK', 'HG_BLACK']);
        const bunnyNode = this.createBunnyNode(color);
        
        // Position randomly
        const x = 20 + Math.random() * 60;
        const y = 20 + Math.random() * 60;
        bunnyNode.node.coordinates2d = ShapeUtils.rectangle(x, y, 0, 0);

        this.players[playerId] = {
            id: playerId,
            name: info?.name || `Bunny ${playerId}`,
            node: bunnyNode,
            score: 0,
            vx: 0, vy: 0,
            color: color
        };

        this.base.addChild(bunnyNode);
    }

    handlePlayerDisconnect(playerId) {
        const p = this.players[playerId];
        if (p) {
            this.base.removeChild(p.node.id);
            delete this.players[playerId];
        }
    }

    handleKeyDown(playerId, key) {
        const p = this.players[playerId];
        if (!p || this.phase !== 'playing') return;
        if (key === 'ArrowUp' || key === 'w') p.vy = -1.2;
        else if (key === 'ArrowDown' || key === 's') p.vy = 1.2;
        else if (key === 'ArrowLeft' || key === 'a') p.vx = -1.2;
        else if (key === 'ArrowRight' || key === 'd') p.vx = 1.2;
    }

    handleKeyUp(playerId, key) {
        const p = this.players[playerId];
        if (!p) return;
        if (key === 'ArrowUp' || key === 'w' || key === 'ArrowDown' || key === 's') p.vy = 0;
        if (key === 'ArrowLeft' || key === 'a' || key === 'ArrowRight' || key === 'd') p.vx = 0;
    }

    startGame(playerId) {
        this.phase = 'playing';
        this.gameTime = 60 * 20;
        this.startBtn.node.playerIds = [0]; // Hide button
        
        // Reset scores
        for (const id in this.players) this.players[id].score = 0;

        // Spawn some bots if only one player is here
        if (Object.keys(this.players).length < 3) {
            const botCount = 3 - Object.keys(this.players).length;
            for (let i = 0; i < botCount; i++) {
                const color = Colors.randomColor(['BLACK', 'ALMOST_BLACK']);
                const node = this.createBunnyNode(color);
                const bx = 20 + Math.random() * 60;
                const by = 20 + Math.random() * 60;
                node.node.coordinates2d = ShapeUtils.rectangle(bx, by, 0, 0);
                this.base.addChild(node);
                this.bots.push({
                    name: `Bot ${i+1}`,
                    node: node,
                    score: 0,
                    x: bx, y: by,
                    vx: 0, vy: 0,
                    angle: Math.random() * Math.PI * 2,
                    targetCarrot: null
                });
            }
        }
    }

    spawnCarrot() {
        const inactive = this.carrotPool.filter(c => !c.active);
        if (inactive.length === 0) return;
        const c = inactive[0];
        c.active = true;
        const cx = 10 + Math.random() * 80;
        const cy = 10 + Math.random() * 80;
        // Carrot is a small triangle
        c.node.node.coordinates2d = ShapeUtils.triangle(cx, cy, cx+0.5, cy+2, cx-0.5, cy+2);
        c.node.node.playerIds = []; // Visible to all
    }

    tick() {
        if (this.phase === 'lobby') return;

        let changed = false;

        // Timer logic
        if (this.phase === 'playing') {
            this.gameTime--;
            if (this.gameTime <= 0) {
                this.phase = 'gameOver';
            }
        }

        // Carrot spawning
        if (this.phase === 'playing' && Math.random() < 0.1) {
            this.spawnCarrot();
            changed = true;
        }

        // Update Players
        for (const id in this.players) {
            const p = this.players[id];
            if (this.phase !== 'playing') continue;

            const curX = p.node.node.coordinates2d[0][0];
            const curY = p.node.node.coordinates2d[0][1];
            const nx = Math.max(5, Math.min(95, curX + p.vx));
            const ny = Math.max(5, Math.min(95, curY + p.vy));
            p.node.node.coordinates2d = ShapeUtils.rectangle(nx, ny, 0, 0);
            changed = true;

            // Collision with carrots
            for (const c of this.carrotPool) {
                if (!c.active) continue;
                const cx = c.node.node.coordinates2d[0][0];
                const cy = c.node.node.coordinates2d[0][1];
                if (Math.hypot(nx - cx, ny - cy) < 3) {
                    p.score++;
                    c.active = false;
                    c.node.node.playerIds = [0];
                    changed = true;
                }
            }
        }

        // Update Bots
        for (const b of this.bots) {
            if (this.phase !== 'playing') continue;

            // Simple AI: Find nearest carrot or wander
            let target = null;
            let minDist = 100;
            for (const c of this.carrotPool) {
                if (!c.active) continue;
                const d = Math.hypot(b.x - c.node.node.coordinates2d[0][0], b.y - c.node.node.coordinates2d[0][1]);
                if (d < minDist) { minDist = d; target = c; }
            }

            if (target) {
                const tx = target.node.node.coordinates2d[0][0];
                const ty = target.node.node.coordinates2d[0][1];
                b.vx = Math.sign(tx - b.x) * 0.6;
                b.vy = Math.sign(ty - b.y) * 0.6;
            } else {
                // Wander
                if (Math.random() < 0.05) b.angle += (Math.random() - 0.5);
                b.vx = Math.cos(b.angle) * 0.5;
                b.vy = Math.sin(b.angle) * 0.5;
            }

            b.x = Math.max(5, Math.min(95, b.x + b.vx));
            b.y = Math.max(5, Math.min(95, b.y + b.vy));
            b.node.node.coordinates2d = ShapeUtils.rectangle(b.x, b.y, 0, 0);

            // Bot collision with carrots
            for (const c of this.carrotPool) {
                if (!c.active) continue;
                const cx = c.node.node.coordinates2d[0][0];
                const cy = c.node.node.coordinates2d[0][1];
                if (Math.hypot(b.x - cx, b.y - cy) < 3) {
                    b.score++;
                    c.active = false;
                    c.node.node.playerIds = [0];
                    changed = true;
                }
            }
            changed = true;
        }

        // Update UI
        if (this.phase === 'playing') {
            const secs = Math.ceil(this.gameTime / 20);
            this.timerText.node.text = { text: `Time: ${secs}`, x: 90, y: 10, size: 2, align: 'right', color: COLORS.WHITE };
            this.scoreText.node.text = { text: 'Collect the Carrots!', x: 50, y: 10, size: 3, align: 'center', color: COLORS.WHITE };
        } else if (this.phase === 'gameOver') {
            // Find winner
            let winner = null;
            let maxS = -1;
            for (const id in this.players) {
                if (this.players[id].score > maxS) { maxS = this.players[id].score; winner = this.players[id]; }
            }
            for (const b of this.bots) {
                if (b.score > maxS) { maxS = b.score; winner = b; }
            }

            this.scoreText.node.text = { 
                text: `${winner ? winner.name : 'Nobody'} wins with ${maxS} carrots!`, 
                x: 50, y: 10, size: 3, align: 'center', color: COLORS.YELLOW 
            };
            this.timerText.node.text = { text: 'GAME OVER', x: 90, y: 10, size: 2, align: 'right', color: COLORS.RED };
            
            // Show restart button
            this.startBtn.node.playerIds = [];
            this.startBtn.node.text = { text: 'Play Again', x: 50, y: 50, size: 2, align: 'center', color: COLORS.WHITE };
        }

        if (changed) this.base.node.onStateChange();
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = BunnyHarvest;