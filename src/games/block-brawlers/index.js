const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { ProceduralFighter, polyCircle, makeShape, rotatedRect } = require('./rig/procedural-fighter');


const { COLORS } = Colors;
const TICK_RATE = 60; // MUST match metadata().tickRate literal.
const DT = 1 / TICK_RATE;
const FLOOR_Y = 80;

const P = {
    bg: [14, 18, 32, 255],
    bg2: [30, 37, 61, 255],
    ring: [71, 79, 111, 255],
    floor: [51, 56, 77, 255],
    floorLight: [79, 86, 111, 255],
    rope: [232, 192, 71, 255],
    white: [245, 247, 250, 255],
    muted: [169, 178, 197, 255],
    dark: [13, 17, 26, 255],
    red: [226, 73, 84, 255],
    redLight: [255, 129, 119, 255],
    blue: [67, 131, 236, 255],
    blueLight: [119, 190, 255, 255],
    green: [82, 207, 135, 255],
    yellow: [255, 215, 87, 255],
    panel: [27, 33, 50, 255],
    transparent: [0,0,0,0]
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (a,b) => a + Math.random() * (b-a);

const makeText = (text, x, y, size, color = P.white, align = 'center', playerIds) => new GameNode.Text({
    textInfo: { text, x, y, size, align, color, font: 'monospace' },
    playerIds
});

const updateText = (node, text, x, y, size, color = P.white, align = 'center') => {
    node.node.text = { text, x, y, size, align, color, font: 'monospace' };
};

const pointSegmentDistance = (px, py, ax, ay, bx, by) => {
    const abx = bx - ax;
    const aby = by - ay;
    const denom = abx * abx + aby * aby;
    if (denom <= 0.000001) return Math.hypot(px - ax, py - ay);
    const t = clamp(((px - ax) * abx + (py - ay) * aby) / denom, 0, 1);
    const x = ax + abx * t;
    const y = ay + aby * t;
    return Math.hypot(px - x, py - y);
};

class BlockBrawlers extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Block Brawlers',
            author: "Joseph Garcia",
            description: 'Two fully procedural polygon fighters trade body-driven punches in a tiny robot boxing ring.',
            aspectRatio: { x: 1, y: 1 },
            tickRate: 60,
            maxPlayers: 1,
            gameId: "35e00d46-3451-5f71-ad1d-926d97b1b907"
        };
    }

    constructor() {
        super();
        this.phase = 'title';
        this.keys = {};
        this.time = 0;
        this.playerScore = 0;
        this.cpuScore = 0;
        this.round = 1;
        this.winner = null;
        this.aiThink = 0;
        this.aiBlockRelease = 0;
        this.screenShake = 0;

        this.base = makeShape(ShapeUtils.rectangle(0,0,100,100), P.bg);
        this.buildArena();
        this.buildFighters();
        this.buildEffects();
        this.buildHud();
        this.buildControls();
        this.buildOverlay();
        this.setPhase('title');
        this.renderHud();
    }

    getLayers() {
        return [{ root: this.base }];
    }

    handleNewPlayer() {}

    handlePlayerDisconnect() {
        this.keys = {};
        this.player.setMove(0);
        this.player.setBlock(false);
    }

    handleKeyDown(playerId, key) {
        const k = String(key || '').toLowerCase();
        if (this.keys[k]) return;
        this.keys[k] = true;

        if (this.phase === 'title') {
            if (k === 'enter' || k === ' ') this.startMatch();
            return;
        }
        if (this.phase === 'roundOver') {
            if (k === 'enter' || k === ' ') this.startNextRound();
            return;
        }
        if (this.phase === 'matchOver') {
            if (k === 'enter' || k === ' ') this.startMatch();
            return;
        }
        if (this.phase !== 'playing') return;

        if (k === 'a' || k === 'arrowleft') this.updatePlayerMove();
        if (k === 'd' || k === 'arrowright') this.updatePlayerMove();
        if (k === 'j' || k === 'z') this.player.tryPunch('jab');
        if (k === 'k' || k === 'x') this.player.tryPunch('cross');
        if (k === 'l' || k === 'c') this.player.setBlock(true);
    }

    handleKeyUp(playerId, key) {
        const k = String(key || '').toLowerCase();
        delete this.keys[k];
        if (k === 'a' || k === 'arrowleft' || k === 'd' || k === 'arrowright') this.updatePlayerMove();
        if (k === 'l' || k === 'c') this.player.setBlock(false);
    }

    updatePlayerMove() {
        if (this.phase !== 'playing') return;
        const left = this.keys.a || this.keys.arrowleft;
        const right = this.keys.d || this.keys.arrowright;
        this.player.setMove((right ? 1 : 0) - (left ? 1 : 0));
    }

    buildArena() {
        this.backWall = makeShape(ShapeUtils.rectangle(0,0,100,100), P.bg);
        this.base.addChild(this.backWall);
        this.wallBands = [];
        for (let i = 0; i < 8; i++) {
            const y = 8 + i * 8;
            const fill = i % 2 ? P.bg2 : [24, 29, 48, 255];
            const n = makeShape([[0,y],[100,y-2],[100,y+5],[0,y+7],[0,y]], fill);
            this.wallBands.push(n);
            this.base.addChild(n);
        }

        this.lights = [];
        for (let i = 0; i < 9; i++) {
            const x = 6 + i * 11;
            const n = makeShape(polyCircle(x, 8 + (i%2)*1.2, 1.2, 8), i % 2 ? P.blueLight : P.redLight, {
                effects: { shadow: { color: i % 2 ? P.blueLight : P.redLight, blur: 12 } }
            });
            this.lights.push(n);
            this.base.addChild(n);
        }

        this.crowd = [];
        for (let i = 0; i < 25; i++) {
            const x = i * 4 + 1;
            const h = 5 + (i % 4) * 1.6;
            const n = makeShape([
                [x,74],[x+1.2,69-h*0.15],[x+2.0,68-h*0.3],[x+2.8,69-h*0.15],[x+4,74],[x,74]
            ], i % 3 === 0 ? [33,43,65,255] : [24,32,51,255]);
            this.crowd.push(n);
            this.base.addChild(n);
        }

        this.ringBack = makeShape(ShapeUtils.rectangle(5,72,90,13), P.ring);
        this.base.addChild(this.ringBack);
        this.floor = makeShape([[4,79],[96,79],[91,87],[9,87],[4,79]], P.floor);
        this.base.addChild(this.floor);
        this.floorStripe = makeShape([[9,82],[91,82],[88,84],[12,84],[9,82]], P.floorLight);
        this.base.addChild(this.floorStripe);

        this.ropeBack = makeShape(ShapeUtils.rectangle(4,55,92,0.8), P.rope);
        this.ropeMid = makeShape(ShapeUtils.rectangle(4,62,92,0.8), P.rope);
        this.base.addChild(this.ropeBack);
        this.base.addChild(this.ropeMid);
        this.posts = [];
        [4,96].forEach((x) => {
            const p = makeShape(ShapeUtils.rectangle(x-1.2,52,2.4,35), [116,88,53,255]);
            this.posts.push(p);
            this.base.addChild(p);
        });
    }

    buildFighters() {
        this.fighterLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), P.transparent);
        this.base.addChild(this.fighterLayer);
        this.player = new ProceduralFighter({
            root: this.fighterLayer,
            x: 31,
            floorY: FLOOR_Y,
            facing: 1,
            name: 'PLAYER',
            colors: {
                body: P.blue,
                light: P.blueLight,
                mid: [51, 101, 190, 255],
                dark: [35, 62, 121, 255],
                head: [77, 142, 238, 255],
                face: [204, 238, 255, 255],
                glove: [237, 245, 255, 255],
                boot: [24, 38, 65, 255],
                core: [119, 226, 255, 255]
            }
        });
        this.cpu = new ProceduralFighter({
            root: this.fighterLayer,
            x: 69,
            floorY: FLOOR_Y,
            facing: -1,
            name: 'CPU',
            colors: {
                body: P.red,
                light: P.redLight,
                mid: [185, 54, 70, 255],
                dark: [110, 39, 53, 255],
                head: [222, 74, 85, 255],
                face: [255, 228, 205, 255],
                glove: [255, 225, 187, 255],
                boot: [58, 30, 36, 255],
                core: [255, 191, 100, 255]
            }
        });
        this.ropeFront = makeShape(ShapeUtils.rectangle(4,69,92,0.9), P.rope);
        this.base.addChild(this.ropeFront);
    }

    buildEffects() {
        this.effectLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), P.transparent);
        this.base.addChild(this.effectLayer);
        this.particles = [];
        for (let i = 0; i < 32; i++) {
            const n = makeShape(ShapeUtils.rectangle(0,0,0,0), P.yellow);
            this.particles.push({ node: n, active: false, x:0, y:0, vx:0, vy:0, life:0, max:0, size:0 });
            this.effectLayer.addChild(n);
        }
    }

    buildHud() {
        this.hudLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), P.transparent);
        this.base.addChild(this.hudLayer);
        this.playerBarBack = makeShape(ShapeUtils.rectangle(4,4,35,4), P.panel);
        this.playerBar = makeShape(ShapeUtils.rectangle(5,5,33,2), P.blue);
        this.cpuBarBack = makeShape(ShapeUtils.rectangle(61,4,35,4), P.panel);
        this.cpuBar = makeShape(ShapeUtils.rectangle(62,5,33,2), P.red);
        this.playerStaminaBack = makeShape(ShapeUtils.rectangle(4,9,27,2.2), P.panel);
        this.playerStamina = makeShape(ShapeUtils.rectangle(5,9.5,25,1.2), P.yellow);
        this.cpuStaminaBack = makeShape(ShapeUtils.rectangle(69,9,27,2.2), P.panel);
        this.cpuStamina = makeShape(ShapeUtils.rectangle(70,9.5,25,1.2), P.yellow);
        [this.playerBarBack,this.playerBar,this.cpuBarBack,this.cpuBar,this.playerStaminaBack,this.playerStamina,this.cpuStaminaBack,this.cpuStamina].forEach(n=>this.hudLayer.addChild(n));
        this.scoreText = makeText('0  -  0', 50, 4.2, 2.4, P.white);
        this.roundText = makeText('ROUND 1', 50, 9.0, 1.3, P.muted);
        this.playerName = makeText('BLUE', 4, 12.2, 1.1, P.blueLight, 'left');
        this.cpuName = makeText('RED', 96, 12.2, 1.1, P.redLight, 'right');
        [this.scoreText,this.roundText,this.playerName,this.cpuName].forEach(n=>this.hudLayer.addChild(n));
    }

    makeButton(x,y,w,h,label,fill,onClick) {
        const bg = makeShape(ShapeUtils.rectangle(x,y,w,h), fill, { color: P.white, border: 2, onClick });
        const t = makeText(label, x+w/2, y+h/2-0.8, 1.25, P.white);
        bg.addChild(t);
        return bg;
    }

    buildControls() {
        this.controlLayer = makeShape(ShapeUtils.rectangle(0,0,0,0), P.transparent);
        this.base.addChild(this.controlLayer);
        this.leftBtn = this.makeButton(3,89,10,8,'LEFT',P.panel,()=>{ if(this.phase==='playing') this.player.tapStep(-1); });
        this.rightBtn = this.makeButton(14,89,10,8,'RIGHT',P.panel,()=>{ if(this.phase==='playing') this.player.tapStep(1); });
        this.jabBtn = this.makeButton(62,89,10,8,'JAB',P.blue,()=>{ if(this.phase==='playing') this.player.tryPunch('jab'); });
        this.crossBtn = this.makeButton(73,89,11,8,'CROSS',P.red,()=>{ if(this.phase==='playing') this.player.tryPunch('cross'); });
        this.guardBtn = this.makeButton(85,89,12,8,'GUARD',P.panel,()=>{ if(this.phase==='playing') this.player.setBlock(!this.player.blocking); });
        [this.leftBtn,this.rightBtn,this.jabBtn,this.crossBtn,this.guardBtn].forEach(n=>this.controlLayer.addChild(n));
    }

    buildOverlay() {
        this.overlay = makeShape(ShapeUtils.rectangle(0,0,100,100), [10,14,25,255], {
            onClick: () => this.advanceOverlay()
        });
        this.overlayTitle = makeText('FIRST TO 3 ROUNDS',50,32,2.5,P.yellow);
        this.overlayLine1 = makeText('',50,36,1.5,P.white);
        this.overlayLine2 = makeText('A / D  MOVE     J  JAB     K  CROSS',50,45,1.25,P.muted);
        this.overlayLine3 = makeText('HOLD L TO BLOCK — TAP IT TO PARRY',50,50,1.25,P.muted);
        this.overlayPrompt = makeText('TAP TO FIGHT / ENTER',50,63,1.8,P.green);
        [this.overlayTitle,this.overlayLine1,this.overlayLine2,this.overlayLine3,this.overlayPrompt].forEach(n=>this.overlay.addChild(n));
        this.base.addChild(this.overlay);
    }

    advanceOverlay() {
        if (this.phase === 'title' || this.phase === 'matchOver') this.startMatch();
        else if (this.phase === 'roundOver') this.startNextRound();
    }

    setOverlayVisible(visible) {
        if (visible) {
            this.overlay.node.coordinates2d = ShapeUtils.rectangle(0,0,100,100);
            this.overlay.node.fill = [10,14,25,255];
        } else {
            this.overlay.node.coordinates2d = ShapeUtils.rectangle(0,0,0,0);
            this.overlay.node.fill = P.transparent;
            updateText(this.overlayTitle,'',0,0,0.1,P.transparent);
            updateText(this.overlayLine1,'',0,0,0.1,P.transparent);
            updateText(this.overlayLine2,'',0,0,0.1,P.transparent);
            updateText(this.overlayLine3,'',0,0,0.1,P.transparent);
            updateText(this.overlayPrompt,'',0,0,0.1,P.transparent);
        }
    }

    setPhase(phase) {
        this.phase = phase;
        this.keys = {};
        this.player.setMove(0);
        this.player.setBlock(false);
        if (phase === 'playing') {
            this.setOverlayVisible(false);
        } else {
            this.setOverlayVisible(true);
            if (phase === 'title') {
                updateText(this.overlayTitle,'FIRST TO 3 ROUNDS',50,32,2.5,P.yellow);
                updateText(this.overlayLine1,'',50,36,1.5,P.white);
                updateText(this.overlayLine2,'A / D  MOVE     J  JAB     K  CROSS',50,45,1.25,P.muted);
                updateText(this.overlayLine3,'HOLD L TO BLOCK — TAP IT TO PARRY',50,50,1.25,P.muted);
                updateText(this.overlayPrompt,'TAP TO FIGHT / ENTER',50,63,1.8,P.green);
            } else if (phase === 'roundOver') {
                updateText(this.overlayTitle,this.winner === 'player' ? 'BLUE WINS THE ROUND' : 'RED WINS THE ROUND',50,31,3.1,this.winner==='player'?P.blueLight:P.redLight);
                updateText(this.overlayLine1,'HEAD POP!',50,41,2.0,P.yellow);
                updateText(this.overlayLine2,'',0,0,0.1,P.transparent);
                updateText(this.overlayLine3,'',0,0,0.1,P.transparent);
                updateText(this.overlayPrompt,'PRESS ENTER OR TAP FOR NEXT ROUND',50,58,1.5,P.green);
            } else {
                const playerWon = this.playerScore > this.cpuScore;
                updateText(this.overlayTitle,playerWon ? 'BLUE IS CHAMPION' : 'RED IS CHAMPION',50,31,3.2,playerWon?P.blueLight:P.redLight);
                updateText(this.overlayLine1,`${this.playerScore}  -  ${this.cpuScore}`,50,42,3.0,P.white);
                updateText(this.overlayLine2,'',0,0,0.1,P.transparent);
                updateText(this.overlayLine3,'',0,0,0.1,P.transparent);
                updateText(this.overlayPrompt,'PRESS ENTER OR TAP TO RESTART',50,58,1.5,P.green);
            }
        }
        this.base.node.onStateChange();
    }

    startMatch() {
        this.playerScore = 0;
        this.cpuScore = 0;
        this.round = 1;
        this.startRound();
    }

    startNextRound() {
        this.round++;
        this.startRound();
    }

    startRound() {
        this.winner = null;
        this.player.reset(31,1);
        this.cpu.reset(69,-1);
        this.aiThink = 0;
        this.aiBlockRelease = 0;
        this.resetParticles();
        this.setPhase('playing');
        this.renderHud();
    }

    resetParticles() {
        this.particles.forEach(p=>{
            p.active=false;
            p.node.node.coordinates2d=ShapeUtils.rectangle(0,0,0,0);
            p.node.node.fill=P.transparent;
        });
    }

    emitImpact(x,y,color,count=10) {
        let remaining = count;
        for (const p of this.particles) {
            if (!remaining) break;
            if (p.active) continue;
            remaining--;
            p.active=true;
            p.x=x; p.y=y;
            const a=rand(0,Math.PI*2);
            const speed=rand(7,22);
            p.vx=Math.cos(a)*speed;
            p.vy=Math.sin(a)*speed-4;
            p.life=rand(0.18,0.42);
            p.max=p.life;
            p.size=rand(0.25,0.72);
            p.color=color;
            p.node.node.fill=color;
        }
    }

    updateParticles() {
        for (const p of this.particles) {
            if (!p.active) continue;
            p.life-=DT;
            if (p.life<=0) {
                p.active=false;
                p.node.node.coordinates2d=ShapeUtils.rectangle(0,0,0,0);
                p.node.node.fill=P.transparent;
                continue;
            }
            p.vy+=28*DT;
            p.x+=p.vx*DT;
            p.y+=p.vy*DT;
            const k=p.life/p.max;
            p.node.node.coordinates2d=rotatedRect(p.x,p.y,p.size*k*1.8,p.size*k*0.65,Math.atan2(p.vy,p.vx));
            p.node.node.color=[255,255,255,Math.round(255*k)];
        }
    }

    updateAi() {
        this.aiThink -= DT;
        this.aiBlockRelease -= DT;
        if (this.aiBlockRelease <= 0 && this.cpu.blocking) this.cpu.setBlock(false);
        if (this.aiThink > 0 || this.cpu.ko || this.cpu.stun > 0) return;
        this.aiThink = rand(0.045,0.11);
        const dx = this.player.x - this.cpu.x;
        const distance = Math.abs(dx);
        const playerThreat = this.player.action && this.player.actionTime < 0.27 && distance < 14;

        if (playerThreat && this.cpu.guard > 18 && Math.random() < 0.72) {
            this.cpu.setMove(0);
            this.cpu.setBlock(true);
            this.aiBlockRelease = rand(0.16,0.36);
            return;
        }
        if (this.cpu.stamina < 24) {
            this.cpu.setMove(dx > 0 ? -1 : 1);
            return;
        }
        if (distance > 11.5) {
            this.cpu.setMove(dx > 0 ? 1 : -1);
            return;
        }
        if (distance < 7.5 && Math.random() < 0.25) {
            this.cpu.setMove(dx > 0 ? -1 : 1);
            return;
        }
        this.cpu.setMove(0);
        if (this.player.blocking && Math.random() < 0.62) this.cpu.tryPunch('cross');
        else if (Math.random() < 0.64) this.cpu.tryPunch('jab');
        else this.cpu.tryPunch('cross');
    }

    resolveFighterSpacing() {
        const minGap = 8.8;
        const dx = this.cpu.x - this.player.x;
        if (dx < minGap) {
            const push = (minGap - dx) * 0.5;
            this.player.x -= push;
            this.cpu.x += push;
            this.player.vx = Math.min(0,this.player.vx);
            this.cpu.vx = Math.max(0,this.cpu.vx);
        }
    }

    checkAttack(attacker, defender, hitColor) {
        if (!attacker.isAttackActive() || attacker.attackHit || attacker.ko || defender.ko) return;
        const fist = attacker.attackFist();
        const prev = attacker.previousAttackFist();
        const body = defender.bodyTarget();
        const head = defender.headTarget();
        const bodyHit = pointSegmentDistance(body.x,body.y,prev.x,prev.y,fist.x,fist.y) <= body.radius + 1.0;
        const headHit = pointSegmentDistance(head.x,head.y,prev.x,prev.y,fist.x,fist.y) <= head.radius + 0.9;
        if (!bodyHit && !headHit) return;
        attacker.attackHit = true;
        const info = attacker.getActionInfo();
        const result = defender.takeHit({
            damage: info.damage * (headHit ? 1.12 : 1),
            guardDamage: info.guard,
            force: info.force,
            attackerX: attacker.x,
            parryable: true
        });
        if (result.result === 'parry') {
            attacker.action = null;
            attacker.stun = 0.40;
            attacker.vx -= attacker.facing * 7;
            this.emitImpact(fist.x,fist.y,P.yellow,16);
            this.screenShake = 0.10;
        } else {
            this.emitImpact(fist.x,fist.y,hitColor,result.result === 'block' ? 7 : 13);
            this.screenShake = result.result === 'block' ? 0.035 : 0.07;
        }
    }

    finishRoundIfNeeded() {
        if (this.phase !== 'playing') return;
        if (!this.player.ko && !this.cpu.ko) return;
        const knocked = this.player.ko ? this.player : this.cpu;
        if (knocked.koTime < 1.15) return;
        this.winner = this.player.ko ? 'cpu' : 'player';
        if (this.winner === 'player') this.playerScore++;
        else this.cpuScore++;
        if (this.playerScore >= 3 || this.cpuScore >= 3) this.setPhase('matchOver');
        else this.setPhase('roundOver');
        this.renderHud();
    }

    renderHud() {
        this.playerBar.node.coordinates2d = ShapeUtils.rectangle(5,5,33*(this.player.health/100),2);
        this.cpuBar.node.coordinates2d = ShapeUtils.rectangle(95-33*(this.cpu.health/100),5,33*(this.cpu.health/100),2);
        this.playerStamina.node.coordinates2d = ShapeUtils.rectangle(5,9.5,25*(this.player.stamina/100),1.2);
        this.cpuStamina.node.coordinates2d = ShapeUtils.rectangle(95-25*(this.cpu.stamina/100),9.5,25*(this.cpu.stamina/100),1.2);
        updateText(this.scoreText,`${this.playerScore}  -  ${this.cpuScore}`,50,4.2,2.4,P.white);
        updateText(this.roundText,`ROUND ${this.round}`,50,9.0,1.3,P.muted);
        this.guardBtn.node.fill = this.player.blocking ? P.green : P.panel;
    }

    tick() {
        this.time += DT;
        if (this.phase !== 'playing') return;

        this.updateAi();
        this.player.update(DT,this.cpu.x,{minX:10,maxX:90});
        this.cpu.update(DT,this.player.x,{minX:10,maxX:90});
        this.resolveFighterSpacing();
        this.checkAttack(this.player,this.cpu,P.blueLight);
        if (this.phase !== 'playing') return;
        this.checkAttack(this.cpu,this.player,P.redLight);
        if (this.phase !== 'playing') return;
        this.updateParticles();
        this.finishRoundIfNeeded();
        this.renderHud();
        this.base.node.onStateChange();
    }
}

module.exports = BlockBrawlers;
