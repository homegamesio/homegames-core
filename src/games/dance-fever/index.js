const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { COLORS } = Colors;

class DanceGame extends Game {
    static metadata() {
        return {
            // Catalog review: Movement/scoring prototype without a timed round or result.
            isTest: true,
            squishVersion: '150',
            services: ['multiplayer'],
            name: 'Dance Fever',
            author: "Joseph Garcia",
            description: 'Move and groove to earn points! Stand on the glowing dance spots for a multiplier!',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 30
        };
    }

    constructor() {
        super();
        this._t = 0;
        this.players = {}; // playerId -> { node, vx, vy, score, color }
        
        // Background
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [30, 20, 50, 255] // Deep purple dance floor
        });

        // Scoreboard
        this.scoreText = new GameNode.Text({
            textInfo: {
                text: 'Get Moving!',
                x: 50, y: 10, size: 4, align: 'center', color: COLORS.WHITE
            }
        });

        // Dance Spots Pool
        this.spots = [];
        const SPOT_COUNT = 5;
        for (let i = 0; i < SPOT_COUNT; i++) {
            const spot = {
                active: false,
                x: 0, y: 0,
                life: 0,
                node: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                    fill: [0, 255, 255, 100], // Semi-transparent cyan
                    effects: { shadow: { color: [0, 255, 255, 255], blur: 15 } }
                })
            };
            this.spots.push(spot);
            this.base.addChild(spot.node);
        }

        this.base.addChild(this.scoreText);
    }

    // Helper for round dance spots
    polyCircle(cx, cy, r) {
        const pts = [];
        for (let i = 0; i <= 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        return pts;
    }

    handleNewPlayer({ playerId, info }) {
        const color = Colors.randomColor(['BLACK', 'ALMOST_BLACK', 'HG_BLACK']);
        
        // The "Dancer" - a simple character that we will animate in tick()
        const dancer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(47, 47, 6, 6),
            fill: color,
            color: COLORS.WHITE,
            border: 3
        });

        this.players[playerId] = {
            node: dancer,
            vx: 0, vy: 0,
            score: 0,
            color: color,
            name: info?.name || `Player ${playerId}`
        };

        this.base.addChild(dancer);
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
        if (!p) return;
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

    tick() {
        this._t++;
        let changed = false;

        // 1. Manage Dance Spots
        for (const s of this.spots) {
            if (s.active) {
                s.life--;
                if (s.life <= 0) s.active = false;
            } else if (Math.random() < 0.01) { // Random spawn chance
                s.active = true;
                s.x = 10 + Math.random() * 80;
                s.y = 10 + Math.random() * 80;
                s.life = 300; // ~10 seconds
                s.node.node.coordinates2d = this.polyCircle(s.x, s.y, 4);
                s.node.node.fill = [0, 255, 255, 150];
                changed = true;
            } else {
                // Hide inactive spots
                s.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                s.node.node.fill = [0, 0, 0, 0];
            }
        }

        // 2. Update Players
        let totalScore = 0;
        for (const id in this.players) {
            const p = this.players[id];
            
            // Movement
            const x = p.node.node.coordinates2d[0][0];
            const y = p.node.node.coordinates2d[0][1];
            const nx = Math.max(0, Math.min(94, x + p.vx));
            const ny = Math.max(0, Math.min(94, y + p.vy));

            // Calculate distance moved for points
            const dist = Math.hypot(nx - x, ny - y);
            let multiplier = 1;

            // Check if on a dance spot
            for (const s of this.spots) {
                if (s.active && Math.hypot(nx + 3 - s.x, ny + 3 - s.y) < 5) {
                    multiplier = 5;
                    break;
                }
            }

            p.score += dist * multiplier * 10;
            totalScore += p.score;

            // "Dance" Animation: Squash and Stretch based on sine wave
            const bounce = Math.sin(this._t * 0.3) * 0.5;
            const sway = Math.cos(this._t * 0.2) * 0.4;
            
            // We update the rectangle to look like it's bouncing/dancing
            // Width oscillates, Height oscillates, and Y position shifts slightly
            p.node.node.coordinates2d = ShapeUtils.rectangle(
                nx + sway, 
                ny + bounce, 
                6 - bounce, 
                6 + bounce
            );

            if (p.vx !== 0 || p.vy !== 0 || bounce !== 0) changed = true;
        }

        // Update Scoreboard Text
        const scoreStr = Object.values(this.players).length > 0 
            ? `Total Groove Score: ${Math.floor(totalScore)}` 
            : 'Get Moving!';
        
        if (this.scoreText.node.text.text !== scoreStr) {
            this.scoreText.node.text = {
                text: scoreStr, x: 50, y: 10, size: 4, align: 'center', color: COLORS.WHITE
            };
            changed = true;
        }

        if (changed) this.base.node.onStateChange();
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = DanceGame;