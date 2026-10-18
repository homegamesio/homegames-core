const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { COLORS } = Colors;

class RobotsGame extends Game {
    static metadata() {
        return {
            // Catalog review: Basic robot combat sketch; retain for comparison with Block Brawlers and the arena games.
            isTest: true,
            squishVersion: '150',
            services: ['multiplayer'],
            name: 'Robots Arena',
            author: "Joseph Garcia",
            description: 'Control your robot and fight others in the arena!',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 30
        };
    }

    constructor() {
        super();
        this.players = {};
        this.projectiles = [];
        this.playerHealth = {};
        
        // Create arena background
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.DARK_GRAY
        });

        // Add grid lines
        for (let i = 10; i < 100; i += 10) {
            // Vertical lines
            this.base.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(i, 0, 1, 100),
                fill: COLORS.GRAY
            }));
            // Horizontal lines
            this.base.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, i, 100, 1),
                fill: COLORS.GRAY
            }));
        }
    }

    handleNewPlayer({ playerId, info }) {
        // Create robot for player
        const startPos = this.getStartPosition(playerId);
        const robot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(startPos.x, startPos.y, 8, 8),
            fill: this.getPlayerColor(playerId),
            border: 2,
            color: COLORS.WHITE
        });
        
        this.players[playerId] = {
            node: robot,
            x: startPos.x,
            y: startPos.y,
            vx: 0,
            vy: 0,
            direction: 'right'
        };
        this.playerHealth[playerId] = 100;
        
        this.base.addChild(robot);
    }

    handlePlayerDisconnect(playerId) {
        const player = this.players[playerId];
        if (player) {
            this.base.removeChild(player.node.id);
            delete this.players[playerId];
            delete this.playerHealth[playerId];
        }
    }

    handleKeyDown(playerId, key) {
        const player = this.players[playerId];
        if (!player) return;
        
        switch (key) {
            case 'ArrowUp':
            case 'w':
                player.vy = -2;
                player.direction = 'up';
                break;
            case 'ArrowDown':
            case 's':
                player.vy = 2;
                player.direction = 'down';
                break;
            case 'ArrowLeft':
            case 'a':
                player.vx = -2;
                player.direction = 'left';
                break;
            case 'ArrowRight':
            case 'd':
                player.vx = 2;
                player.direction = 'right';
                break;
            case ' ':
                this.fireProjectile(playerId);
                break;
        }
    }

    handleKeyUp(playerId, key) {
        const player = this.players[playerId];
        if (!player) return;
        
        switch (key) {
            case 'ArrowUp':
            case 'w':
            case 'ArrowDown':
            case 's':
                player.vy = 0;
                break;
            case 'ArrowLeft':
            case 'a':
            case 'ArrowRight':
            case 'd':
                player.vx = 0;
                break;
        }
    }

    tick() {
        let needsUpdate = false;
        
        // Update player positions
        for (const id in this.players) {
            const player = this.players[id];
            
            // Update position with velocity
            player.x += player.vx;
            player.y += player.vy;
            
            // Keep robot within bounds (8x8 size)
            player.x = Math.max(0, Math.min(92, player.x));
            player.y = Math.max(0, Math.min(92, player.y));
            
            // Update shape coordinates
            player.node.node.coordinates2d = ShapeUtils.rectangle(player.x, player.y, 8, 8);
            needsUpdate = true;
        }
        
        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.x += proj.dx;
            proj.y += proj.dy;
            proj.lifespan--;
            
            // Check if projectile is out of bounds
            if (proj.x < 0 || proj.x > 100 || proj.y < 0 || proj.y > 100 || proj.lifespan <= 0) {
                this.base.removeChild(proj.node.id);
                this.projectiles.splice(i, 1);
                needsUpdate = true;
                continue;
            }
            
            // Check collision with players
            for (const id in this.players) {
                const player = this.players[id];
                // Check if projectile overlaps player's rectangle
                const px = player.x;
                const py = player.y;
                const projLeft = proj.x - 1;
                const projRight = proj.x + 1;
                const projTop = proj.y - 1;
                const projBottom = proj.y + 1;
                
                if (
                    projLeft < px + 8 && projRight > px &&
                    projTop < py + 8 && projBottom > py
                ) {
                    // Hit player
                    this.playerHealth[id] -= 10; // damage
                    
                    // Remove projectile
                    this.base.removeChild(proj.node.id);
                    this.projectiles.splice(i, 1);
                    needsUpdate = true;
                    
                    // Check if player is dead
                    if (this.playerHealth[id] <= 0) {
                        // Remove player's robot
                        this.base.removeChild(player.node.id);
                        delete this.players[id];
                        delete this.playerHealth[id];
                        needsUpdate = true;
                    }
                    break;
                }
            }
            
            // Update projectile coordinates
            proj.node.node.coordinates2d = ShapeUtils.rectangle(proj.x - 1, proj.y - 1, 2, 2);
        }
        
        if (needsUpdate) {
            this.base.node.onStateChange();
        }
    }

    fireProjectile(playerId) {
        const player = this.players[playerId];
        const dir = player.direction;
        let dx = 0, dy = 0;
        
        switch(dir) {
            case 'up': dy = -4; break;
            case 'down': dy = 4; break;
            case 'left': dx = -4; break;
            case 'right': dx = 4; break;
        }
        
        // Calculate projectile starting position (center of robot)
        const px = player.x + 4;
        const py = player.y + 4;
        
        const projectile = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(px - 1, py - 1, 2, 2), // size 2x2
            fill: COLORS.RED,
            border: 1,
            color: COLORS.BLACK
        });
        
        projectile.dx = dx;
        projectile.dy = dy;
        projectile.lifespan = 100; // ticks
        
        this.projectiles.push({ node: projectile, x: px, y: py, dx, dy });
        this.base.addChild(projectile);
    }

    getLayers() {
        return [{ root: this.base }];
    }

    // Helper methods
    getStartPosition(playerId) {
        const positions = [
            { x: 10, y: 10 },
            { x: 82, y: 10 },
            { x: 10, y: 82 },
            { x: 82, y: 82 }
        ];
        return positions[playerId % 4];
    }

    getPlayerColor(playerId) {
        const colors = [
            COLORS.RED,
            COLORS.BLUE,
            COLORS.GREEN,
            COLORS.YELLOW,
            COLORS.PURPLE,
            COLORS.ORANGE
        ];
        return colors[playerId % colors.length];
    }
}

module.exports = RobotsGame;