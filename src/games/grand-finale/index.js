const { Game, GameNode, Shapes, ShapeUtils } = require('squish-142');

// A 4th of July chain-reaction fireworks show. Rockets arc in from off
// screen; tap one to detonate it, and the blast sets off anything nearby —
// chains score quadratically, so the skill is waiting for a dense sky.
// Strictly red, white, and blue.

const TICK_RATE = 16;

const ASPECT = 16 / 9;              // y-units are taller than x-units at 16:9

const GRAVITY = 0.02;
const BLAST_RADIUS = 12;            // x-units; blast reach and visual ring
const BLAST_GROW_TICKS = 6;
const BLAST_LINGER_TICKS = 8;
const CHAIN_DELAY_TICKS = 2;        // ripple delay so cascades read visually
const TAP_RADIUS = 8;               // how close a tap must be to a rocket

const FUSE_TICKS = Math.round(1.5 * TICK_RATE);
const SHOW_SECONDS = 75;
const FINALE_SECONDS = 12;

const MAX_PARTICLES = 90;

// The only colors in the game.
const SKY = [8, 10, 30, 255];
const NAVY = [16, 22, 60, 255];
const RED = [235, 60, 50, 255];
const WHITE = [255, 255, 255, 255];
const BLUE = [70, 120, 255, 255];
const DIM_WHITE = [200, 205, 220, 255];
const ROCKET_COLORS = [RED, WHITE, BLUE];

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });

class GrandFinale extends Game {
    static metadata() {
        return {
            aspectRatio: { x: 16, y: 9 },
            squishVersion: '142',
            author: 'Joseph Garcia',
            name: 'Grand Finale',
            description: 'A 4th of July chain-reaction fireworks show. Tap a rocket, detonate the sky - big chains score big. Red, white, and blue only.',
            tickRate: TICK_RATE
        };
    }

    constructor() {
        super();

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: SKY
        });

        for (let i = 0; i < 40; i++) {
            const size = 0.12 + Math.random() * 0.2;
            this.base.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(Math.random() * 99, Math.random() * 70, size, size * ASPECT),
                fill: WHITE,
                color: [255, 255, 255, 60 + Math.floor(Math.random() * 120)]
            }), false);
        }

        this.trailLayer = this.makeContainer();
        this.rocketLayer = this.makeContainer();
        this.blastLayer = this.makeContainer();
        this.hud = this.makeContainer();
        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            onClick: (playerId, x, y) => this.handleTap(playerId, x, y)
        });
        this.overlay = this.makeContainer();
        this.base.addChildren(this.trailLayer, this.rocketLayer, this.blastLayer, this.hud, this.tapCatcher, this.overlay);

        this.players = {};
        this.gunners = {};
        this.rockets = [];
        this.blasts = [];
        this.particles = [];
        this.floaters = [];
        this.transients = [];
        this.cascades = {};
        this.nextCascadeId = 1;
        this.bestChainEver = 0;
        this.tickCount = 0;

        this.showLobby();
    }

    makeContainer() {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
    }

    makeGlowText(text, x, y, size, color, glowColor, playerIds) {
        const gc = glowColor || color;
        const offsets = [[-0.25, 0], [0.25, 0], [0, -0.15], [0, 0.15]];
        const nodes = offsets.map(o => new GameNode.Text({
            textInfo: { x: x + o[0], y: y + o[1], text, size, align: 'center', font: 'monospace', color: [gc[0], gc[1], gc[2], 140] },
            playerIds
        }));
        nodes.push(new GameNode.Text({
            textInfo: { x, y, text, size, align: 'center', font: 'monospace', color },
            playerIds
        }));
        return nodes;
    }

    // Festive title: red halo left/up, blue halo right/down, white core.
    makeFlagText(text, x, y, size) {
        return [
            new GameNode.Text({ textInfo: { x: x - 0.35, y: y - 0.2, text, size, align: 'center', font: 'monospace', color: [RED[0], RED[1], RED[2], 170] } }),
            new GameNode.Text({ textInfo: { x: x + 0.35, y: y + 0.2, text, size, align: 'center', font: 'monospace', color: [BLUE[0], BLUE[1], BLUE[2], 170] } }),
            new GameNode.Text({ textInfo: { x, y, text, size, align: 'center', font: 'monospace', color: WHITE } })
        ];
    }

    makeButton(label, x, y, w, h, color, onClick) {
        const button = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill: NAVY,
            color,
            border: 8,
            effects: glow(color, 8),
            onClick
        });
        button.addChild(new GameNode.Text({
            textInfo: { x: x + w / 2, y: y + (h - 2.2 * ASPECT) / 2, text: label, size: 2.2, align: 'center', font: 'monospace', color: WHITE }
        }), false);
        return button;
    }

    addTransient(nodes, ticks) {
        nodes.forEach(n => this.overlay.addChild(n, false));
        this.transients.push({ nodes, ticks });
    }

    playerName(playerId) {
        return String((this.players[playerId] && this.players[playerId].name) || ('PLAYER ' + playerId)).toUpperCase().slice(0, 8);
    }

    diamond(cx, cy, r) {
        return [
            [cx, cy - r * ASPECT],
            [cx + r, cy],
            [cx, cy + r * ASPECT],
            [cx - r, cy],
            [cx, cy - r * ASPECT]
        ].map(([x, y]) => [Math.round(Math.max(0, Math.min(100, x)) * 100) / 100, Math.round(Math.max(0, Math.min(100, y)) * 100) / 100]);
    }

    // An octagon ring that LOOKS circular at 16:9.
    ring(cx, cy, r) {
        const points = [];
        for (let i = 0; i <= 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            points.push([
                Math.round(Math.max(0, Math.min(100, cx + Math.cos(a) * r)) * 100) / 100,
                Math.round(Math.max(0, Math.min(100, cy + Math.sin(a) * r * ASPECT)) * 100) / 100
            ]);
        }
        return points;
    }

    // Distance in x-units, correcting for the stretched y axis.
    unitDist(x1, y1, x2, y2) {
        const dx = x1 - x2;
        const dy = (y1 - y2) / ASPECT;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // --- lobby / show flow ---

    showLobby() {
        this.phase = 'lobby';
        this.clearSky();
        this.gunners = {};
        this.hud.clearChildren();
        this.overlay.clearChildren();
        this.transients = [];

        this.buildFlag(41, 8, 18);
        this.makeFlagText('GRAND FINALE', 50, 26, 6, null).forEach(n => this.overlay.addChild(n, false));
        this.titlePulse = this.overlay.node.children[this.overlay.node.children.length - 3];

        this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 38, text: 'A CHAIN-REACTION FIREWORKS SHOW', size: 1.8, align: 'center', font: 'monospace', color: DIM_WHITE }
        }), false);
        if (this.bestChainEver > 1) {
            this.overlay.addChild(new GameNode.Text({
                textInfo: { x: 50, y: 43, text: 'BIGGEST CHAIN TONIGHT: ' + this.bestChainEver, size: 1.5, align: 'center', font: 'monospace', color: WHITE }
            }), false);
        }

        this.overlay.addChild(this.makeButton('LIGHT THE FUSES', 34, 52, 32, 9, BLUE, (playerId) => {
            if (this.phase === 'lobby' && this.players[playerId]) {
                this.startShow();
            }
        }), false);

        const lines = [
            'TAP A ROCKET TO DETONATE IT - BLASTS SET OFF NEARBY ROCKETS',
            'CHAINS SCORE BIG: 1 + 2 + 3 + ... PER ROCKET - WAIT FOR A CROWDED SKY',
            'YOUR FUSE RELOADS BETWEEN TAPS - EVERYONE PLAYS AT ONCE'
        ];
        lines.forEach((text, i) => this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 70 + i * 4, text, size: 1.3, align: 'center', font: 'monospace', color: DIM_WHITE }
        }), false));

        this.base.node.onStateChange();
    }

    buildFlag(x, y, w) {
        const h = w * 0.55 * ASPECT;
        const stripeH = h / 7;
        for (let i = 0; i < 7; i++) {
            this.overlay.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, y + i * stripeH, w, stripeH + 0.05),
                fill: i % 2 === 0 ? RED : WHITE
            }), false);
        }
        const cantonW = w * 0.42;
        const cantonH = stripeH * 4;
        this.overlay.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, cantonW, cantonH),
            fill: BLUE
        }), false);
        for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 3; c++) {
                this.overlay.addChild(new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: this.diamond(x + cantonW * (0.25 + c * 0.25), y + cantonH * (0.3 + r * 0.4), 0.55),
                    fill: WHITE
                }), false);
            }
        }
    }

    startShow() {
        this.phase = 'show';
        this.clearSky();
        this.overlay.clearChildren();
        this.transients = [];
        this.showTicksLeft = SHOW_SECONDS * TICK_RATE;
        this.inFinale = false;
        this.spawnTicks = 4;
        this.cascades = {};
        this.bestChainRound = 0;

        this.gunners = {};
        Object.keys(this.players).map(Number).forEach((pid, i) => this.addGunner(pid, i));
        this.buildHud();

        this.addTransient(this.makeFlagText('LIGHT UP THE SKY', 50, 30, 4), TICK_RATE);
        this.base.node.onStateChange();
    }

    addGunner(playerId, index) {
        this.gunners[playerId] = {
            playerId,
            swatch: index % 2 === 0 ? RED : BLUE,
            score: 0,
            fuse: 0,
            bestChain: 0
        };
    }

    clearSky() {
        this.rockets = [];
        this.blasts = [];
        this.particles = [];
        this.floaters = [];
        this.trailLayer.clearChildren();
        this.rocketLayer.clearChildren();
        this.blastLayer.clearChildren();
    }

    endShow() {
        this.phase = 'finaleOver';
        this.overlay.clearChildren();
        this.transients = [];

        const standings = Object.values(this.gunners).sort((a, b) => b.score - a.score);
        this.makeFlagText('THE SHOW IS OVER', 50, 16, 4.5).forEach(n => this.overlay.addChild(n, false));

        standings.forEach((gunner, i) => {
            this.overlay.addChild(new GameNode.Text({
                textInfo: {
                    x: 50, y: 28 + i * 4.5,
                    text: (i + 1) + '. ' + this.playerName(gunner.playerId) + ' - ' + gunner.score + '  (BEST CHAIN ' + gunner.bestChain + ')',
                    size: 1.8, align: 'center', font: 'monospace',
                    color: i === 0 ? WHITE : DIM_WHITE
                }
            }), false);
        });
        this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 32 + standings.length * 4.5, text: 'BIGGEST CHAIN OF THE NIGHT: ' + this.bestChainEver, size: 1.6, align: 'center', font: 'monospace', color: WHITE }
        }), false);

        this.overlay.addChild(this.makeButton('ENCORE', 37, 74, 26, 9, RED, (playerId) => {
            if (this.phase === 'finaleOver' && this.players[playerId]) {
                this.startShow();
            }
        }), false);
        this.base.node.onStateChange();
    }

    buildHud() {
        this.hud.clearChildren();
        this.timerText = new GameNode.Text({
            textInfo: { x: 50, y: 1.5, text: String(SHOW_SECONDS), size: 2.2, align: 'center', font: 'monospace', color: WHITE }
        });
        this.hud.addChild(this.timerText, false);

        Object.values(this.gunners).forEach((gunner, i) => {
            const x = 2 + i * 16;
            this.hud.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, 2, 1.4, 1.4 * ASPECT),
                fill: gunner.swatch,
                color: WHITE
            }), false);
            this.hud.addChild(new GameNode.Text({
                textInfo: { x: x + 2.2, y: 1.8, text: this.playerName(gunner.playerId), size: 1.1, font: 'monospace', color: WHITE }
            }), false);
            gunner.scoreText = new GameNode.Text({
                textInfo: { x: x + 2.2, y: 4.4, text: '0', size: 1.2, font: 'monospace', color: DIM_WHITE }
            });
            this.hud.addChild(gunner.scoreText, false);
            this.hud.addChild(new GameNode.Text({
                textInfo: { x: x + 10.4, y: 1.8, text: 'YOU', size: 1, font: 'monospace', color: WHITE },
                playerIds: [gunner.playerId]
            }), false);
            // fuse reload bar
            this.hud.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, 7.2, 10, 0.8),
                fill: NAVY
            }), false);
            gunner.fuseBar = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, 7.2, 10, 0.8),
                fill: WHITE
            });
            this.hud.addChild(gunner.fuseBar, false);
        });
    }

    // --- rockets ---

    spawnRocket() {
        const color = ROCKET_COLORS[Math.floor(Math.random() * ROCKET_COLORS.length)];
        const side = Math.random();
        let x, y, vx, vy;
        if (side < 0.35) {
            // from the bottom-left corner, arcing right
            x = -3 - Math.random() * 3;
            y = 60 + Math.random() * 30;
            vx = 0.5 + Math.random() * 0.5;
            vy = -(0.85 + Math.random() * 0.5);
        } else if (side < 0.7) {
            // from the bottom-right corner, arcing left
            x = 103 + Math.random() * 3;
            y = 60 + Math.random() * 30;
            vx = -(0.5 + Math.random() * 0.5);
            vy = -(0.85 + Math.random() * 0.5);
        } else {
            // straight up from below
            x = 12 + Math.random() * 76;
            y = 104;
            vx = (Math.random() - 0.5) * 0.5;
            vy = -(1.05 + Math.random() * 0.5);
        }

        const rocket = {
            x, y, vx, vy, color,
            exploding: 0,
            node: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: this.diamond(x, y, 1.2),
                fill: color,
                color: WHITE,
                effects: glow(color, 12)
            })
        };
        this.rockets.push(rocket);
        this.rocketLayer.addChild(rocket.node, false);
    }

    updateRockets() {
        for (let i = this.rockets.length - 1; i >= 0; i--) {
            const rocket = this.rockets[i];

            if (rocket.exploding > 0) {
                rocket.exploding--;
                if (rocket.exploding === 0) {
                    this.detonate(rocket);
                    this.rockets.splice(i, 1);
                }
                continue;
            }

            rocket.x += rocket.vx;
            rocket.y += rocket.vy;
            rocket.vy += GRAVITY;

            if (rocket.y > 108 || rocket.x < -10 || rocket.x > 110) {
                this.rocketLayer.removeChild(rocket.node.id, false);
                this.rockets.splice(i, 1);
                continue;
            }

            rocket.node.node.coordinates2d = this.diamond(rocket.x, rocket.y, 1.2);

            if (this.tickCount % 3 === 0 && rocket.y < 104 && this.particles.length < MAX_PARTICLES) {
                this.spawnParticle(rocket.x, rocket.y + 1.2 * ASPECT, -rocket.vx * 0.2, -rocket.vy * 0.2, 6, WHITE, 0.4);
            }
        }
    }

    // --- detonation and chains ---

    igniteRocket(rocket, cascadeId, chainDepth, ownerPid) {
        if (rocket.exploding > 0) return;
        rocket.cascadeId = cascadeId;
        rocket.chainDepth = chainDepth;
        rocket.ownerPid = ownerPid;
        rocket.exploding = chainDepth === 1 ? 1 : CHAIN_DELAY_TICKS;
        rocket.node.node.fill = WHITE;   // armed flash
    }

    detonate(rocket) {
        this.rocketLayer.removeChild(rocket.node.id, false);

        const blast = {
            x: rocket.x,
            y: rocket.y,
            color: rocket.color,
            ticks: 0,
            cascadeId: rocket.cascadeId,
            chainDepth: rocket.chainDepth,
            ownerPid: rocket.ownerPid,
            ringNode: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: this.ring(rocket.x, rocket.y, 1),
                color: [rocket.color[0], rocket.color[1], rocket.color[2], 255],
                border: 6,
                effects: glow(rocket.color, 16)
            }),
            flashNode: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: this.diamond(rocket.x, rocket.y, 2.4),
                fill: WHITE,
                color: WHITE,
                effects: glow(WHITE, 24)
            })
        };
        this.blasts.push(blast);
        this.blastLayer.addChildren(blast.ringNode, blast.flashNode);

        const burst = Math.min(16, MAX_PARTICLES - this.particles.length);
        for (let i = 0; i < burst; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.5 + Math.random() * 1.1;
            this.spawnParticle(rocket.x, rocket.y, Math.cos(angle) * speed, Math.sin(angle) * speed * ASPECT * 0.6,
                10 + Math.floor(Math.random() * 8), Math.random() < 0.4 ? WHITE : rocket.color, 0.7);
        }

        // scoring: depth 1 = 1 point, each chained rocket is worth its depth
        const gunner = this.gunners[rocket.ownerPid];
        if (gunner) {
            gunner.score += rocket.chainDepth;
            if (gunner.scoreText) gunner.scoreText.node.text.text = String(gunner.score);
            this.addFloater('+' + rocket.chainDepth, rocket.x, rocket.y - 4, rocket.chainDepth > 1 ? rocket.color : WHITE);
        }

        const cascade = this.cascades[rocket.cascadeId];
        if (cascade) {
            cascade.count++;
            if (cascade.count > 1) {
                this.addFloater('×' + cascade.count + ' CHAIN', rocket.x, rocket.y - 8, WHITE);
            }
            if (gunner) gunner.bestChain = Math.max(gunner.bestChain, cascade.count);
            this.bestChainRound = Math.max(this.bestChainRound, cascade.count);
            this.bestChainEver = Math.max(this.bestChainEver, cascade.count);
        }
    }

    updateBlasts() {
        for (let i = this.blasts.length - 1; i >= 0; i--) {
            const blast = this.blasts[i];
            blast.ticks++;

            const grow = Math.min(1, blast.ticks / BLAST_GROW_TICKS);
            const radius = BLAST_RADIUS * grow;
            const fade = blast.ticks <= BLAST_GROW_TICKS ? 1 : Math.max(0, 1 - (blast.ticks - BLAST_GROW_TICKS) / BLAST_LINGER_TICKS);

            blast.ringNode.node.coordinates2d = this.ring(blast.x, blast.y, Math.max(1, radius));
            blast.ringNode.node.color = [blast.color[0], blast.color[1], blast.color[2], Math.round(255 * fade)];
            blast.flashNode.node.color = [255, 255, 255, Math.round(200 * Math.max(0, 1 - blast.ticks / 5))];

            // chain: growing blasts ignite rockets they touch
            if (blast.ticks <= BLAST_GROW_TICKS + 2) {
                this.rockets.forEach(rocket => {
                    if (rocket.exploding === 0 && this.unitDist(rocket.x, rocket.y, blast.x, blast.y) < radius) {
                        this.igniteRocket(rocket, blast.cascadeId, blast.chainDepth + 1, blast.ownerPid);
                    }
                });
            }

            if (blast.ticks > BLAST_GROW_TICKS + BLAST_LINGER_TICKS) {
                this.blastLayer.removeChild(blast.ringNode.id, false);
                this.blastLayer.removeChild(blast.flashNode.id, false);
                this.blasts.splice(i, 1);
            }
        }
    }

    // --- particles / floating text ---

    spawnParticle(x, y, vx, vy, life, color, size) {
        const particle = {
            x, y, vx, vy, life, maxLife: life, size, color,
            node: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(Math.max(0, Math.min(99, x)), Math.max(0, Math.min(99, y)), size, size * ASPECT),
                fill: color,
                color: [color[0], color[1], color[2], 255]
            })
        };
        this.particles.push(particle);
        this.trailLayer.addChild(particle.node, false);
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += GRAVITY * 0.7;
            p.life--;
            if (p.life <= 0 || p.y > 104 || p.x < -2 || p.x > 102) {
                this.trailLayer.removeChild(p.node.id, false);
                this.particles.splice(i, 1);
            } else {
                const frac = p.life / p.maxLife;
                p.node.node.coordinates2d = ShapeUtils.rectangle(
                    Math.max(0, Math.min(99, p.x)), Math.max(0, Math.min(99, p.y)),
                    p.size * frac + 0.12, (p.size * frac + 0.12) * ASPECT);
                p.node.node.color = [p.color[0], p.color[1], p.color[2], Math.round(255 * frac)];
            }
        }
    }

    addFloater(text, x, y, color) {
        const node = new GameNode.Text({
            textInfo: { x: Math.max(4, Math.min(96, x)), y: Math.max(3, Math.min(92, y)), text, size: 1.7, align: 'center', font: 'monospace', color }
        });
        this.floaters.push({ node, ticks: TICK_RATE });
        this.blastLayer.addChild(node, false);
    }

    updateFloaters() {
        for (let i = this.floaters.length - 1; i >= 0; i--) {
            const f = this.floaters[i];
            f.ticks--;
            f.node.node.text.y = Math.max(1, f.node.node.text.y - 0.35);
            f.node.node.text.color = [f.node.node.text.color[0], f.node.node.text.color[1], f.node.node.text.color[2],
                Math.round(255 * f.ticks / TICK_RATE)];
            if (f.ticks <= 0) {
                this.blastLayer.removeChild(f.node.id, false);
                this.floaters.splice(i, 1);
            }
        }
    }

    updateTransients() {
        for (let i = this.transients.length - 1; i >= 0; i--) {
            const t = this.transients[i];
            t.ticks--;
            if (t.ticks <= 0) {
                t.nodes.forEach(n => this.overlay.removeChild(n.id, false));
                this.transients.splice(i, 1);
            }
        }
    }

    // --- simulation ---

    tick() {
        this.tickCount++;

        if (this.phase === 'lobby') {
            if (this.titlePulse && this.titlePulse.node && this.titlePulse.node.text) {
                const alpha = 120 + Math.round(60 * Math.sin(this.tickCount / 5));
                this.titlePulse.node.text.color = [RED[0], RED[1], RED[2], alpha];
            }
            // a lazy ambient rocket now and then so the lobby feels alive
            if (this.tickCount % 40 === 0 && this.rockets.length < 3) {
                this.spawnRocket();
            }
            this.updateRockets();
            this.updateParticles();
        } else if (this.phase === 'show') {
            this.showTicksLeft--;

            const secs = Math.ceil(this.showTicksLeft / TICK_RATE);
            if (this.timerText && this.showTicksLeft % TICK_RATE === 0) {
                this.timerText.node.text.text = String(secs);
                this.timerText.node.text.color = secs <= FINALE_SECONDS ? RED : WHITE;
            }

            if (!this.inFinale && secs <= FINALE_SECONDS) {
                this.inFinale = true;
                this.addTransient(this.makeFlagText('GRAND FINALE!', 50, 24, 5), 2 * TICK_RATE);
            }

            if (--this.spawnTicks <= 0) {
                this.spawnRocket();
                if (this.inFinale) this.spawnRocket();
                const progress = 1 - this.showTicksLeft / (SHOW_SECONDS * TICK_RATE);
                this.spawnTicks = this.inFinale ? 3 : Math.max(6, Math.round(15 - progress * 8));
            }

            Object.values(this.gunners).forEach(gunner => {
                if (gunner.fuse > 0) {
                    gunner.fuse--;
                    if (gunner.fuseBar) {
                        const frac = 1 - gunner.fuse / (this.inFinale ? FUSE_TICKS / 2 : FUSE_TICKS);
                        gunner.fuseBar.node.coordinates2d = ShapeUtils.rectangle(
                            gunner.fuseBar.node.coordinates2d[0][0], 7.2, Math.max(0.2, 10 * frac), 0.8);
                    }
                }
            });

            this.updateRockets();
            this.updateBlasts();
            this.updateParticles();
            this.updateFloaters();

            if (this.showTicksLeft <= 0 && this.rockets.length === 0 && this.blasts.length === 0) {
                this.endShow();
            } else if (this.showTicksLeft <= 0) {
                // show is over but let in-flight fireworks finish; stop spawning
                this.spawnTicks = 9999;
            }
        } else if (this.phase === 'finaleOver') {
            this.updateParticles();
            this.updateBlasts();
            this.updateFloaters();
        }

        this.updateTransients();
        this.base.node.onStateChange();
    }

    // --- input ---

    handleTap(playerId, x, y) {
        if (this.phase !== 'show') return;
        const gunner = this.gunners[playerId];
        if (!gunner || gunner.fuse > 0) return;

        let best = null;
        this.rockets.forEach(rocket => {
            if (rocket.exploding > 0) return;
            const dist = this.unitDist(rocket.x, rocket.y, x, y);
            if (dist < TAP_RADIUS && (!best || dist < best.dist)) {
                best = { rocket, dist };
            }
        });

        gunner.fuse = this.inFinale ? Math.round(FUSE_TICKS / 2) : FUSE_TICKS;

        if (best) {
            const cascadeId = this.nextCascadeId++;
            this.cascades[cascadeId] = { count: 0 };
            this.igniteRocket(best.rocket, cascadeId, 1, playerId);
        } else {
            // a dud puff so the miss is visible
            for (let i = 0; i < 5 && this.particles.length < MAX_PARTICLES; i++) {
                const angle = Math.random() * Math.PI * 2;
                this.spawnParticle(x, y, Math.cos(angle) * 0.4, Math.sin(angle) * 0.6, 6, DIM_WHITE, 0.4);
            }
        }
        this.base.node.onStateChange();
    }

    // --- platform hooks ---

    handleNewPlayer({ playerId, info }) {
        this.players[playerId] = { name: (info && info.name) || ('PLAYER ' + playerId) };
        if (this.phase === 'show' && !this.gunners[playerId]) {
            this.addGunner(playerId, Object.keys(this.gunners).length);
            this.buildHud();
            this.addTransient(this.makeFlagText(this.playerName(playerId) + ' JOINED THE SHOW', 50, 12, 1.8), 2 * TICK_RATE);
        }
        this.base.node.onStateChange();
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
        if (this.gunners[playerId]) {
            delete this.gunners[playerId];
            if (this.phase === 'show') this.buildHud();
        }
        if (Object.keys(this.players).length === 0) {
            this.showLobby();
        }
        this.base.node.onStateChange();
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = GrandFinale;
