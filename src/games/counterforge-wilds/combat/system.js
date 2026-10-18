'use strict';

const BASE_ACTIONS = {
    LIGHT: {
        startupSeconds: 7 / 120,
        activeSeconds: 5 / 120,
        recoverySeconds: 18 / 120,
        stamina: 12,
        damage: 12,
        posture: 15,
        range: 7.8,
        arc: 1.35,
        lungePerSecond: 8
    },
    HEAVY: {
        startupSeconds: 20 / 120,
        activeSeconds: 5 / 120,
        recoverySeconds: 31 / 120,
        stamina: 25,
        damage: 25,
        posture: 38,
        range: 9.2,
        arc: 0.82,
        lungePerSecond: 12
    },
    RANGED: {
        startupSeconds: 16 / 120,
        activeSeconds: 1 / 120,
        recoverySeconds: 24 / 120,
        stamina: 23,
        damage: 11,
        posture: 18,
        projectileSpeedPerSecond: 43,
        projectileLifeSeconds: 1.75
    },
    DODGE: {
        startupSeconds: 0,
        activeSeconds: 12 / 120,
        recoverySeconds: 8 / 120,
        stamina: 21,
        speedPerSecond: 42,
        invulnerableSeconds: 9 / 120
    }
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function createActor(options) {
    const source = options || {};
    return {
        id: source.id || 'actor',
        kind: source.kind || 'enemy',
        type: source.type || 'raider',
        x: source.x || 0,
        y: source.y || 0,
        homeX: Number.isFinite(source.homeX) ? source.homeX : source.x || 0,
        homeY: Number.isFinite(source.homeY) ? source.homeY : source.y || 0,
        angle: Number.isFinite(source.angle) ? source.angle : 0,
        radius: Number.isFinite(source.radius) ? source.radius : 2.05,
        speedPerSecond: Number.isFinite(source.speedPerSecond) ? source.speedPerSecond : 18,
        maxHealth: Number.isFinite(source.maxHealth) ? source.maxHealth : 100,
        health: Number.isFinite(source.health) ? source.health : Number.isFinite(source.maxHealth) ? source.maxHealth : 100,
        maxStamina: Number.isFinite(source.maxStamina) ? source.maxStamina : 100,
        stamina: Number.isFinite(source.stamina) ? source.stamina : Number.isFinite(source.maxStamina) ? source.maxStamina : 100,
        maxPosture: Number.isFinite(source.maxPosture) ? source.maxPosture : 100,
        posture: Number.isFinite(source.posture) ? source.posture : Number.isFinite(source.maxPosture) ? source.maxPosture : 100,
        staminaRegenPerSecond: Number.isFinite(source.staminaRegenPerSecond) ? source.staminaRegenPerSecond : 24,
        postureRegenPerSecond: Number.isFinite(source.postureRegenPerSecond) ? source.postureRegenPerSecond : 12,
        action: 'NEUTRAL',
        actionTick: 0,
        actionSpec: null,
        attackConnected: {},
        guarding: false,
        guardTicks: 99999,
        parryWindowTicks: source.parryWindowTicks || 6,
        staggerTicks: 0,
        invulnerableTicks: 0,
        hitFlashTicks: 0,
        blockFlashTicks: 0,
        parryFlashTicks: 0,
        dead: false,
        aiCooldownTicks: 0,
        aiPlan: null,
        aiPlanTicks: 0,
        rangedFired: false,
        lastAction: 'WAIT',
        boss: Boolean(source.boss),
        level: source.level || 1,
        xp: source.xp || 0,
        gold: source.gold || 0,
        worldId: source.worldId || source.id || null,
        color: source.color || [220, 220, 220, 255],
        darkColor: source.darkColor || [80, 80, 80, 255],
        style: source.style || 'duelist',
        weaponId: source.weaponId || 'traveler-blade',
        rangedId: source.rangedId || 'short-bow',
        bossPhase: 1
    };
}

function actionPhase(actor) {
    if (!actor || actor.action === 'NEUTRAL' || !actor.actionSpec) return 'neutral';
    const spec = actor.actionSpec;
    if (actor.actionTick < spec.startupTicks) return 'startup';
    if (actor.actionTick < spec.startupTicks + spec.activeTicks) return 'active';
    return 'recovery';
}

function actionRemaining(actor) {
    if (!actor || actor.action === 'NEUTRAL' || !actor.actionSpec) return 0;
    const spec = actor.actionSpec;
    return Math.max(0, spec.startupTicks + spec.activeTicks + spec.recoveryTicks - actor.actionTick);
}

function canBegin(actor) {
    return actor && !actor.dead && actor.staggerTicks <= 0 && actor.action === 'NEUTRAL';
}

function makeActionSpec(action, ticksFor, weapon, rangedWeapon, upgrades) {
    const base = BASE_ACTIONS[action];
    if (!base) return null;
    const melee = weapon || {
        damageScale: 1,
        postureScale: 1,
        rangeScale: 1,
        staminaScale: 1,
        speedScale: 1
    };
    const ranged = rangedWeapon || {
        damageScale: 1,
        speedScale: 1,
        staminaScale: 1,
        recoveryScale: 1
    };
    const perks = upgrades || {};
    const speedScale = action === 'LIGHT' || action === 'HEAVY' ? melee.speedScale || 1 : 1;
    const recoveryScale = action === 'RANGED' ? ranged.recoveryScale || 1 : 1;
    const spec = {
        startupTicks: ticksFor(base.startupSeconds / speedScale),
        activeTicks: Math.max(1, ticksFor(base.activeSeconds)),
        recoveryTicks: ticksFor(base.recoverySeconds / speedScale * recoveryScale),
        stamina: base.stamina || 0,
        damage: base.damage || 0,
        posture: base.posture || 0,
        range: base.range || 0,
        arc: base.arc || 0,
        lungePerSecond: base.lungePerSecond || 0,
        projectileSpeedPerSecond: base.projectileSpeedPerSecond || 0,
        projectileLifeTicks: base.projectileLifeSeconds ? ticksFor(base.projectileLifeSeconds) : 0,
        dodgeSpeedPerSecond: base.speedPerSecond || 0,
        invulnerableTicks: base.invulnerableSeconds ? ticksFor(base.invulnerableSeconds) : 0
    };

    if (action === 'LIGHT' || action === 'HEAVY') {
        spec.stamina *= melee.staminaScale || 1;
        spec.damage *= melee.damageScale || 1;
        spec.posture *= (melee.postureScale || 1) * (perks.breaker ? 1.3 : 1);
        spec.range *= melee.rangeScale || 1;
        if (perks.parry && action === 'HEAVY') spec.damage *= 1.08;
    } else if (action === 'RANGED') {
        spec.stamina *= ranged.staminaScale || 1;
        spec.damage *= (ranged.damageScale || 1) * (perks.focus ? 1.25 : 1);
        spec.projectileSpeedPerSecond *= (ranged.speedScale || 1) * (perks.focus ? 1.12 : 1);
    } else if (action === 'DODGE' && perks.quickstep) {
        spec.stamina *= 0.78;
        spec.invulnerableTicks += 2;
        spec.dodgeSpeedPerSecond *= 1.06;
    }

    spec.stamina = Math.max(0, spec.stamina);
    return spec;
}

function beginAction(actor, action, ticksFor, weapon, rangedWeapon, upgrades) {
    if (!canBegin(actor)) return false;
    const spec = makeActionSpec(action, ticksFor, weapon, rangedWeapon, upgrades);
    if (!spec || actor.stamina + 0.001 < spec.stamina) return false;
    actor.stamina = Math.max(0, actor.stamina - spec.stamina);
    actor.guarding = false;
    actor.action = action;
    actor.actionTick = 0;
    actor.actionSpec = spec;
    actor.attackConnected = {};
    actor.rangedFired = false;
    actor.lastAction = action;
    if (action === 'DODGE') actor.invulnerableTicks = Math.max(actor.invulnerableTicks, spec.invulnerableTicks);
    return true;
}

function cancelAction(actor) {
    if (!actor) return;
    actor.action = 'NEUTRAL';
    actor.actionTick = 0;
    actor.actionSpec = null;
    actor.attackConnected = {};
    actor.rangedFired = false;
}

function tickActor(actor, dt, blockMoveScale, perks) {
    if (!actor || actor.dead) return;
    if (actor.staggerTicks > 0) {
        actor.staggerTicks -= 1;
        actor.guarding = false;
        cancelAction(actor);
    }
    if (actor.invulnerableTicks > 0) actor.invulnerableTicks -= 1;
    if (actor.hitFlashTicks > 0) actor.hitFlashTicks -= 1;
    if (actor.blockFlashTicks > 0) actor.blockFlashTicks -= 1;
    if (actor.parryFlashTicks > 0) actor.parryFlashTicks -= 1;
    if (actor.aiCooldownTicks > 0) actor.aiCooldownTicks -= 1;
    if (actor.aiPlanTicks > 0) actor.aiPlanTicks -= 1;

    if (actor.guarding) actor.guardTicks += 1;
    else actor.guardTicks = 99999;

    if (actor.action !== 'NEUTRAL' && actor.actionSpec) {
        actor.actionTick += 1;
        const total = actor.actionSpec.startupTicks + actor.actionSpec.activeTicks + actor.actionSpec.recoveryTicks;
        if (actor.actionTick >= total) cancelAction(actor);
    }

    if (actor.action === 'NEUTRAL' && actor.staggerTicks <= 0) {
        const regenScale = perks && perks.flow ? 1.22 : 1;
        actor.stamina = clamp(actor.stamina + actor.staminaRegenPerSecond * regenScale * dt, 0, actor.maxStamina);
        if (!actor.guarding) actor.posture = clamp(actor.posture + actor.postureRegenPerSecond * dt, 0, actor.maxPosture);
    } else if (actor.guarding) {
        actor.stamina = clamp(actor.stamina + actor.staminaRegenPerSecond * 0.18 * dt, 0, actor.maxStamina);
    }

    actor.moveScale = actor.guarding ? blockMoveScale : actor.action === 'NEUTRAL' ? 1 : actionPhase(actor) === 'startup' ? 0.55 : 0.25;
}

function guard(actor, active) {
    if (!actor || actor.dead || actor.staggerTicks > 0) return false;
    if (active) {
        if (actor.action !== 'NEUTRAL') return false;
        if (!actor.guarding) actor.guardTicks = 0;
        actor.guarding = true;
        actor.lastAction = 'BLOCK';
        return true;
    }
    actor.guarding = false;
    actor.guardTicks = 99999;
    return true;
}

function breakPosture(actor, staggerTicks) {
    actor.posture = actor.maxPosture * 0.42;
    actor.staggerTicks = Math.max(actor.staggerTicks, staggerTicks);
    actor.guarding = false;
    cancelAction(actor);
}

module.exports = {
    BASE_ACTIONS,
    createActor,
    actionPhase,
    actionRemaining,
    canBegin,
    makeActionSpec,
    beginAction,
    cancelAction,
    tickActor,
    guard,
    breakPosture,
    clamp
};
