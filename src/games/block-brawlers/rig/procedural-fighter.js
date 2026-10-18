const { GameNode, Shapes, ShapeUtils } = require('squish-150');

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

const makeShape = (coords, fill, extra = {}) => new GameNode.Shape({
    shapeType: Shapes.POLYGON,
    coordinates2d: coords,
    fill,
    ...extra
});

const polyCircle = (cx, cy, r, sides = 10) => {
    const pts = [];
    for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
};

const thickLine = (x1, y1, x2, y2, width) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.sin(a) * width / 2;
    const dy = Math.cos(a) * width / 2;
    return [
        [x1 - dx, y1 + dy],
        [x2 - dx, y2 + dy],
        [x2 + dx, y2 - dy],
        [x1 + dx, y1 - dy],
        [x1 - dx, y1 + dy]
    ];
};

const rotatedRect = (cx, cy, w, h, angle) => {
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const pts = [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
    const out = pts.map(([x,y]) => [cx + x*ca - y*sa, cy + x*sa + y*ca]);
    out.push(out[0]);
    return out;
};

const solveTwoBone = (hx, hy, fx, fy, upper, lower, bendSign) => {
    const dx = fx - hx;
    const dy = fy - hy;
    const rawD = Math.hypot(dx, dy);
    const d = clamp(rawD, 0.001, upper + lower - 0.001);
    const ux = dx / (rawD || 1);
    const uy = dy / (rawD || 1);
    const a = (upper * upper - lower * lower + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, upper * upper - a * a));
    const mx = hx + ux * a;
    const my = hy + uy * a;
    const px = -uy * bendSign;
    const py = ux * bendSign;
    return { x: mx + px * h, y: my + py * h };
};

class ProceduralFighter {
    constructor({ root, x, floorY, facing, colors, name }) {
        this.root = root;
        this.name = name;
        this.colors = colors;
        this.floorY = floorY;
        this.spawnX = x;
        this.spawnFacing = facing;
        this.group = makeShape(ShapeUtils.rectangle(0, 0, 0, 0), [0,0,0,0]);
        root.addChild(this.group);

        this.nodes = {};
        const add = (key, fill, extra) => {
            const n = makeShape(ShapeUtils.rectangle(0,0,0,0), fill, extra);
            this.nodes[key] = n;
            this.group.addChild(n);
            return n;
        };

        // Back-to-front render order.
        add('shadow', [10, 14, 22, 255]);
        add('backUpperArm', colors.dark);
        add('backForearm', colors.mid);
        add('backFist', colors.glove);
        add('backThigh', colors.dark);
        add('backShin', colors.mid);
        add('backBoot', colors.boot);
        add('pelvis', colors.dark);
        add('torso', colors.body);
        add('chestPlate', colors.light);
        add('neck', colors.dark);
        add('head', colors.head);
        add('face', colors.face);
        add('antenna', colors.light);
        add('frontThigh', colors.body);
        add('frontShin', colors.light);
        add('frontBoot', colors.boot);
        add('frontUpperArm', colors.body);
        add('frontForearm', colors.light);
        add('frontFist', colors.glove);
        add('frontShoulder', colors.light);
        add('backShoulder', colors.mid);
        add('frontKnee', colors.light);
        add('backKnee', colors.mid);
        add('impactCore', colors.core);

        this.reset(x, facing);
    }

    reset(x = this.spawnX, facing = this.spawnFacing) {
        this.x = x;
        this.y = this.floorY;
        this.facing = facing;
        this.vx = 0;
        this.moveIntent = 0;
        this.tapMove = 0;
        this.health = 100;
        this.stamina = 100;
        this.guard = 100;
        this.blocking = false;
        this.blockAge = 99;
        this.action = null;
        this.actionTime = 0;
        this.attackHit = false;
        this.attackSerial = 0;
        this.stun = 0;
        this.hitFlash = 0;
        this.hitLean = 0;
        this.ko = false;
        this.koTime = 0;
        this.headPopV = 0;
        this.headPopY = 0;
        this.headSpin = 0;
        this.walkPhase = 0;
        this.bob = 0;
        this.frontFist = { x: this.x, y: 60 };
        this.backFist = { x: this.x, y: 60 };
        this.prevFrontFist = { ...this.frontFist };
        this.prevBackFist = { ...this.backFist };
        this.frontFoot = this.makeFoot(this.x + this.facing * 1.7);
        this.backFoot = this.makeFoot(this.x - this.facing * 1.7);
        this.render(0);
    }

    makeFoot(x) {
        return { x, y: this.floorY, stepping: false, startX: x, targetX: x, t: 0, duration: 0.18 };
    }

    setMove(intent) {
        this.moveIntent = clamp(intent, -1, 1);
    }

    tapStep(direction) {
        this.tapMove = clamp(direction, -1, 1) * 0.24;
    }

    setBlock(active) {
        if (this.ko) return;
        if (active && !this.blocking) this.blockAge = 0;
        this.blocking = !!active;
        if (active && this.action) this.action = null;
    }

    canAct() {
        return !this.ko && this.stun <= 0 && !this.action;
    }

    tryPunch(kind) {
        if (!this.canAct() || this.blocking) return false;
        const cost = kind === 'cross' ? 24 : 14;
        if (this.stamina < cost) return false;
        this.stamina -= cost;
        this.action = kind;
        this.actionTime = 0;
        this.attackHit = false;
        this.attackSerial++;
        return true;
    }

    getActionInfo() {
        if (this.action === 'jab') return { total: 0.34, startup: 0.09, active: 0.08, damage: 9, guard: 16, force: 4.2 };
        if (this.action === 'cross') return { total: 0.52, startup: 0.16, active: 0.10, damage: 16, guard: 27, force: 7.1 };
        return null;
    }

    isAttackActive() {
        const info = this.getActionInfo();
        if (!info) return false;
        return this.actionTime >= info.startup && this.actionTime <= info.startup + info.active;
    }

    attackFist() {
        return this.action === 'cross' ? this.backFist : this.frontFist;
    }

    previousAttackFist() {
        return this.action === 'cross' ? this.prevBackFist : this.prevFrontFist;
    }

    bodyTarget() {
        return { x: this.x, y: this.floorY - 15.0, radius: 4.2 };
    }

    headTarget() {
        return { x: this.x + this.facing * 0.2, y: this.floorY - 23.0, radius: 3.3 };
    }

    takeHit({ damage, guardDamage, force, attackerX, parryable = true }) {
        if (this.ko) return { result: 'ko' };
        const incomingDir = attackerX < this.x ? -1 : 1;
        const facingAttack = this.facing === incomingDir;
        if (this.blocking && facingAttack) {
            if (parryable && this.blockAge <= 0.085 && this.guard > 0) {
                this.hitFlash = 0.10;
                this.hitLean = -incomingDir * 0.10;
                return { result: 'parry' };
            }
            this.guard = Math.max(0, this.guard - guardDamage);
            this.health = Math.max(0, this.health - damage * 0.18);
            this.vx += incomingDir * force * 0.32;
            this.hitFlash = 0.12;
            this.hitLean = incomingDir * 0.14;
            if (this.guard <= 0) {
                this.blocking = false;
                this.stun = 0.55;
                this.vx += incomingDir * force * 0.55;
                return { result: 'guardBreak' };
            }
            if (this.health <= 0) this.knockOut(incomingDir, force);
            return { result: 'block' };
        }
        this.health = Math.max(0, this.health - damage);
        this.guard = Math.max(0, this.guard - guardDamage * 0.2);
        this.vx += incomingDir * force;
        this.stun = damage > 12 ? 0.27 : 0.16;
        this.hitFlash = 0.16;
        this.hitLean = incomingDir * 0.30;
        this.action = null;
        if (this.health <= 0) this.knockOut(incomingDir, force);
        return { result: this.ko ? 'ko' : 'hit' };
    }

    knockOut(direction, force) {
        this.ko = true;
        this.koTime = 0;
        this.blocking = false;
        this.action = null;
        this.stun = 0;
        this.vx += direction * force * 0.75;
        this.headPopV = -28;
        this.headPopY = 0;
        this.headSpin = 0;
    }

    update(dt, opponentX, bounds) {
        this.prevFrontFist = { ...this.frontFist };
        this.prevBackFist = { ...this.backFist };
        this.blockAge += dt;
        this.hitFlash = Math.max(0, this.hitFlash - dt);
        this.hitLean *= Math.pow(0.0008, dt);

        if (this.ko) {
            this.koTime += dt;
            this.vx *= Math.pow(0.03, dt);
            this.x += this.vx * dt;
            this.x = clamp(this.x, bounds.minX, bounds.maxX);
            this.headPopV += 45 * dt;
            this.headPopY += this.headPopV * dt;
            this.headSpin += 7.5 * dt;
            this.render(dt);
            return;
        }

        this.facing = opponentX >= this.x ? 1 : -1;
        this.stun = Math.max(0, this.stun - dt);
        let effectiveMove = this.moveIntent;
        if (this.tapMove !== 0) {
            const tapDirection = this.tapMove > 0 ? 1 : -1;
            effectiveMove = tapDirection;
            this.tapMove -= tapDirection * dt;
            if ((tapDirection > 0 && this.tapMove <= 0) || (tapDirection < 0 && this.tapMove >= 0)) this.tapMove = 0;
        }

        let desired = this.stun > 0 || this.action ? 0 : effectiveMove * 14.5;
        if (this.blocking) desired *= 0.35;
        const accel = this.blocking ? 35 : 62;
        const dv = clamp(desired - this.vx, -accel * dt, accel * dt);
        this.vx += dv;
        this.vx *= Math.pow(0.68, dt);
        this.x += this.vx * dt;
        this.x = clamp(this.x, bounds.minX, bounds.maxX);

        if (this.action) {
            this.actionTime += dt;
            const info = this.getActionInfo();
            if (!info || this.actionTime >= info.total) {
                this.action = null;
                this.actionTime = 0;
            }
        }

        const moveAmount = Math.abs(this.vx);
        this.walkPhase += moveAmount * 0.46 * dt;
        this.bob = Math.sin(this.walkPhase * 2) * Math.min(0.45, moveAmount * 0.025);
        this.updateFeet(dt);

        const regen = this.blocking ? 7 : 18;
        this.stamina = Math.min(100, this.stamina + regen * dt);
        if (!this.blocking && !this.action && this.stun <= 0) this.guard = Math.min(100, this.guard + 11 * dt);
        this.render(dt);
    }

    updateFeet(dt) {
        const stride = clamp(Math.abs(this.vx) * 0.16, 1.8, 3.5);
        const lead = this.vx >= 0 ? 1 : -1;
        const desiredFront = this.x + lead * stride;
        const desiredBack = this.x - lead * stride * 0.75;
        const startStep = (foot, target) => {
            foot.stepping = true;
            foot.startX = foot.x;
            foot.targetX = target;
            foot.t = 0;
            foot.duration = clamp(0.25 - Math.abs(this.vx) * 0.006, 0.13, 0.24);
        };
        if (!this.frontFoot.stepping && !this.backFoot.stepping) {
            const fd = Math.abs(this.frontFoot.x - desiredFront);
            const bd = Math.abs(this.backFoot.x - desiredBack);
            if (fd > 2.3 || bd > 2.3) {
                if (fd >= bd) startStep(this.frontFoot, desiredFront);
                else startStep(this.backFoot, desiredBack);
            }
        }
        [this.frontFoot, this.backFoot].forEach((foot) => {
            if (foot.stepping) {
                foot.t = Math.min(1, foot.t + dt / foot.duration);
                const u = ease(foot.t);
                foot.x = lerp(foot.startX, foot.targetX, u);
                foot.y = this.floorY - Math.sin(Math.PI * foot.t) * 1.35;
                if (foot.t >= 1) { foot.stepping = false; foot.y = this.floorY; }
            } else {
                foot.y = this.floorY;
            }
        });
    }

    armTargets(shoulderFront, shoulderBack, pelvisY) {
        const idleFront = { x: this.x + this.facing * 3.4, y: pelvisY - 6.2 };
        const idleBack = { x: this.x + this.facing * 1.3, y: pelvisY - 4.7 };
        let front = idleFront;
        let back = idleBack;
        let torsoTwist = 0;
        let torsoDrop = 0;

        if (this.blocking) {
            front = { x: this.x + this.facing * 3.0, y: pelvisY - 10.2 };
            back = { x: this.x + this.facing * 2.3, y: pelvisY - 7.5 };
            torsoDrop = 0.6;
        }

        if (this.action) {
            const info = this.getActionInfo();
            const t = this.actionTime;
            let reach;
            if (t < info.startup) reach = ease(t / info.startup) * -1;
            else if (t < info.startup + info.active) reach = ease((t - info.startup) / info.active);
            else reach = 1 - ease((t - info.startup - info.active) / Math.max(0.001, info.total - info.startup - info.active));

            if (this.action === 'jab') {
                if (reach < 0) front = { x: this.x - this.facing * 1.0, y: pelvisY - 8.0 };
                else front = { x: this.x + this.facing * lerp(3.4, 8.2, reach), y: pelvisY - 9.0 + Math.sin(reach * Math.PI) * -0.5 };
                back = { x: this.x + this.facing * 1.7, y: pelvisY - 7.0 };
                torsoTwist = this.facing * 0.08 * Math.max(0, reach);
            } else {
                if (reach < 0) back = { x: this.x - this.facing * 2.2, y: pelvisY - 5.6 };
                else back = { x: this.x + this.facing * lerp(1.3, 9.0, reach), y: pelvisY - 8.4 };
                front = { x: this.x + this.facing * 2.4, y: pelvisY - 8.7 };
                torsoTwist = this.facing * 0.22 * Math.max(0, reach);
                torsoDrop = Math.sin(Math.max(0, reach) * Math.PI) * 0.7;
            }
        }

        if (this.stun > 0) {
            front = { x: shoulderFront.x + this.facing * 0.2, y: pelvisY - 1.4 };
            back = { x: shoulderBack.x - this.facing * 0.4, y: pelvisY - 0.9 };
        }
        return { front, back, torsoTwist, torsoDrop };
    }

    render() {
        const c = this.colors;
        const pelvisY = this.floorY - 11.0 + this.bob;
        let lean = clamp(-this.vx * 0.012 + this.hitLean, -0.32, 0.32);
        let bodyDrop = 0;
        if (this.ko) {
            const u = clamp(this.koTime / 0.65, 0, 1);
            lean += this.facing * 1.18 * ease(u);
            bodyDrop = ease(u) * 4.2;
        }
        const ca = Math.cos(lean);
        const sa = Math.sin(lean);
        const localPoint = (lx, ly) => ({
            x: this.x + lx * ca - ly * sa,
            y: pelvisY + bodyDrop + lx * sa + ly * ca
        });

        const hipFront = localPoint(this.facing * 1.25, 0.2);
        const hipBack = localPoint(-this.facing * 1.05, 0.5);
        const shoulderFrontBase = localPoint(this.facing * 2.0, -7.2);
        const shoulderBackBase = localPoint(-this.facing * 1.65, -6.9);
        const arms = this.armTargets(shoulderFrontBase, shoulderBackBase, pelvisY + bodyDrop);
        lean += arms.torsoTwist;

        const shoulderFront = { x: shoulderFrontBase.x, y: shoulderFrontBase.y + arms.torsoDrop };
        const shoulderBack = { x: shoulderBackBase.x, y: shoulderBackBase.y + arms.torsoDrop };

        const frontElbow = solveTwoBone(shoulderFront.x, shoulderFront.y, arms.front.x, arms.front.y, 4.1, 4.0, -this.facing);
        const backElbow = solveTwoBone(shoulderBack.x, shoulderBack.y, arms.back.x, arms.back.y, 4.2, 4.1, -this.facing);
        this.frontFist = arms.front;
        this.backFist = arms.back;

        const frontKnee = solveTwoBone(hipFront.x, hipFront.y, this.frontFoot.x, this.frontFoot.y - 0.4, 5.8, 5.7, -this.facing);
        const backKnee = solveTwoBone(hipBack.x, hipBack.y, this.backFoot.x, this.backFoot.y - 0.4, 5.8, 5.7, -this.facing);

        const shadowW = 8.5 + Math.abs(this.vx) * 0.08;
        this.nodes.shadow.node.coordinates2d = rotatedRect(this.x, this.floorY + 0.55, shadowW, 1.0, 0);

        this.nodes.backThigh.node.coordinates2d = thickLine(hipBack.x, hipBack.y, backKnee.x, backKnee.y, 2.1);
        this.nodes.backShin.node.coordinates2d = thickLine(backKnee.x, backKnee.y, this.backFoot.x, this.backFoot.y - 0.5, 1.8);
        this.nodes.backBoot.node.coordinates2d = rotatedRect(this.backFoot.x + this.facing * 0.45, this.backFoot.y - 0.35, 3.0, 1.35, 0);
        this.nodes.frontThigh.node.coordinates2d = thickLine(hipFront.x, hipFront.y, frontKnee.x, frontKnee.y, 2.3);
        this.nodes.frontShin.node.coordinates2d = thickLine(frontKnee.x, frontKnee.y, this.frontFoot.x, this.frontFoot.y - 0.5, 1.9);
        this.nodes.frontBoot.node.coordinates2d = rotatedRect(this.frontFoot.x + this.facing * 0.5, this.frontFoot.y - 0.35, 3.2, 1.45, 0);
        this.nodes.backKnee.node.coordinates2d = polyCircle(backKnee.x, backKnee.y, 1.0, 8);
        this.nodes.frontKnee.node.coordinates2d = polyCircle(frontKnee.x, frontKnee.y, 1.05, 8);

        const torsoCenter = localPoint(0, -4.2);
        this.nodes.pelvis.node.coordinates2d = rotatedRect(localPoint(0,-0.2).x, localPoint(0,-0.2).y, 5.8, 3.1, lean * 0.5);
        this.nodes.torso.node.coordinates2d = rotatedRect(torsoCenter.x, torsoCenter.y + arms.torsoDrop, 7.0, 8.7, lean);
        this.nodes.chestPlate.node.coordinates2d = rotatedRect(torsoCenter.x + this.facing * 0.22, torsoCenter.y - 0.5 + arms.torsoDrop, 4.8, 4.0, lean);
        const core = localPoint(this.facing * 0.45, -4.7);
        this.nodes.impactCore.node.coordinates2d = polyCircle(core.x, core.y + arms.torsoDrop, 0.8 + this.hitFlash * 4, 8);
        this.nodes.impactCore.node.fill = this.hitFlash > 0 ? [255, 244, 172, 255] : c.core;

        this.nodes.backUpperArm.node.coordinates2d = thickLine(shoulderBack.x, shoulderBack.y, backElbow.x, backElbow.y, 1.9);
        this.nodes.backForearm.node.coordinates2d = thickLine(backElbow.x, backElbow.y, arms.back.x, arms.back.y, 1.65);
        this.nodes.backFist.node.coordinates2d = rotatedRect(arms.back.x, arms.back.y, 2.4, 2.4, 0);
        this.nodes.frontUpperArm.node.coordinates2d = thickLine(shoulderFront.x, shoulderFront.y, frontElbow.x, frontElbow.y, 2.05);
        this.nodes.frontForearm.node.coordinates2d = thickLine(frontElbow.x, frontElbow.y, arms.front.x, arms.front.y, 1.75);
        this.nodes.frontFist.node.coordinates2d = rotatedRect(arms.front.x, arms.front.y, 2.55, 2.55, 0);
        this.nodes.frontShoulder.node.coordinates2d = polyCircle(shoulderFront.x, shoulderFront.y, 1.25, 8);
        this.nodes.backShoulder.node.coordinates2d = polyCircle(shoulderBack.x, shoulderBack.y, 1.15, 8);

        const neck = localPoint(0, -9.0);
        this.nodes.neck.node.coordinates2d = rotatedRect(neck.x, neck.y + arms.torsoDrop, 2.2, 2.6, lean);
        let headCenter = localPoint(this.facing * 0.15, -12.0);
        let headAngle = lean * 0.6;
        if (this.ko) {
            headCenter = { x: headCenter.x + this.facing * Math.sin(this.headSpin) * 0.7, y: headCenter.y + this.headPopY };
            headAngle = this.headSpin;
        }
        this.nodes.head.node.coordinates2d = rotatedRect(headCenter.x, headCenter.y + arms.torsoDrop, 5.7, 5.3, headAngle);
        const faceX = headCenter.x + this.facing * 1.4 * Math.cos(headAngle);
        const faceY = headCenter.y + arms.torsoDrop + this.facing * 1.4 * Math.sin(headAngle);
        this.nodes.face.node.coordinates2d = rotatedRect(faceX, faceY, 1.9, 2.5, headAngle);
        const antennaBase = { x: headCenter.x - this.facing * 0.2, y: headCenter.y - 2.4 + arms.torsoDrop };
        const antennaTip = { x: antennaBase.x - Math.sin(headAngle) * 2.0, y: antennaBase.y - Math.cos(headAngle) * 2.0 };
        this.nodes.antenna.node.coordinates2d = thickLine(antennaBase.x, antennaBase.y, antennaTip.x, antennaTip.y, 0.45);
    }
}

module.exports = { ProceduralFighter, polyCircle, makeShape, rotatedRect, thickLine };
