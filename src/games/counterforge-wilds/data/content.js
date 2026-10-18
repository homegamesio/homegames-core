'use strict';

const WEAPONS = {
    'traveler-blade': {
        id: 'traveler-blade',
        name: 'Traveler Blade',
        color: [205, 218, 232, 255],
        damageScale: 1,
        postureScale: 1,
        rangeScale: 1,
        staminaScale: 1,
        speedScale: 1
    },
    'iron-longsword': {
        id: 'iron-longsword',
        name: 'Iron Longsword',
        color: [235, 239, 246, 255],
        damageScale: 1.16,
        postureScale: 1.08,
        rangeScale: 1.12,
        staminaScale: 1.08,
        speedScale: 0.94
    },
    'ember-edge': {
        id: 'ember-edge',
        name: 'Ember Edge',
        color: [255, 111, 67, 255],
        damageScale: 1.28,
        postureScale: 1.12,
        rangeScale: 1.03,
        staminaScale: 1.12,
        speedScale: 1.02
    },
    'moon-spear': {
        id: 'moon-spear',
        name: 'Moon Spear',
        color: [155, 188, 255, 255],
        damageScale: 1.12,
        postureScale: 1.34,
        rangeScale: 1.38,
        staminaScale: 1.14,
        speedScale: 0.9
    }
};

const RANGED_WEAPONS = {
    'short-bow': {
        id: 'short-bow',
        name: 'Short Bow',
        color: [238, 201, 116, 255],
        damageScale: 1,
        speedScale: 1,
        staminaScale: 1,
        recoveryScale: 1
    },
    'hunter-bow': {
        id: 'hunter-bow',
        name: 'Hunter Bow',
        color: [116, 226, 168, 255],
        damageScale: 1.22,
        speedScale: 1.16,
        staminaScale: 1.06,
        recoveryScale: 0.94
    },
    'storm-bow': {
        id: 'storm-bow',
        name: 'Storm Bow',
        color: [109, 177, 255, 255],
        damageScale: 1.38,
        speedScale: 1.28,
        staminaScale: 1.12,
        recoveryScale: 0.9
    }
};

const UPGRADES = {
    vitality: {
        id: 'vitality',
        name: 'Vital Heart',
        description: '+18 max health and full heal.'
    },
    flow: {
        id: 'flow',
        name: 'Flow State',
        description: '+22% stamina regeneration.'
    },
    parry: {
        id: 'parry',
        name: 'Open Hand',
        description: '+2 parry frames and stronger ripostes.'
    },
    quickstep: {
        id: 'quickstep',
        name: 'Quickstep',
        description: 'Cheaper dodge with two extra invulnerability frames.'
    },
    focus: {
        id: 'focus',
        name: 'Hunter Focus',
        description: '+25% ranged damage and faster arrows.'
    },
    breaker: {
        id: 'breaker',
        name: 'Stonebreaker',
        description: '+30% posture damage.'
    }
};

const ENEMY_TYPES = {
    wolf: {
        id: 'wolf',
        name: 'Ash Wolf',
        color: [151, 161, 180, 255],
        dark: [65, 71, 86, 255],
        health: 44,
        stamina: 82,
        posture: 58,
        speed: 22,
        xp: 16,
        gold: 4,
        style: 'rush'
    },
    raider: {
        id: 'raider',
        name: 'Road Raider',
        color: [225, 92, 84, 255],
        dark: [104, 35, 38, 255],
        health: 70,
        stamina: 100,
        posture: 82,
        speed: 18,
        xp: 24,
        gold: 8,
        style: 'duelist'
    },
    archer: {
        id: 'archer',
        name: 'Briar Archer',
        color: [106, 195, 132, 255],
        dark: [41, 91, 58, 255],
        health: 54,
        stamina: 92,
        posture: 64,
        speed: 17,
        xp: 22,
        gold: 7,
        style: 'ranged'
    },
    sentinel: {
        id: 'sentinel',
        name: 'Stone Sentinel',
        color: [126, 146, 187, 255],
        dark: [49, 57, 83, 255],
        health: 104,
        stamina: 110,
        posture: 132,
        speed: 14,
        xp: 34,
        gold: 12,
        style: 'guard'
    },
    warden: {
        id: 'warden',
        name: 'Hollow Warden',
        color: [205, 83, 255, 255],
        dark: [83, 30, 110, 255],
        health: 260,
        stamina: 150,
        posture: 190,
        speed: 18,
        xp: 150,
        gold: 60,
        style: 'boss'
    }
};

const BIOMES = {
    meadow: {
        id: 'meadow',
        name: 'Windmeadow',
        floor: [25, 47, 38, 255],
        floorAlt: [31, 59, 47, 255],
        propA: [57, 102, 69, 255],
        propB: [111, 126, 83, 255],
        enemies: ['wolf', 'raider']
    },
    pine: {
        id: 'pine',
        name: 'Blackpine Reach',
        floor: [18, 35, 34, 255],
        floorAlt: [23, 45, 42, 255],
        propA: [33, 76, 59, 255],
        propB: [85, 92, 91, 255],
        enemies: ['wolf', 'archer', 'raider']
    },
    amber: {
        id: 'amber',
        name: 'Amber Waste',
        floor: [73, 55, 34, 255],
        floorAlt: [86, 66, 40, 255],
        propA: [124, 84, 41, 255],
        propB: [159, 122, 69, 255],
        enemies: ['raider', 'archer', 'sentinel']
    },
    mire: {
        id: 'mire',
        name: 'Glassmire',
        floor: [25, 43, 48, 255],
        floorAlt: [30, 53, 59, 255],
        propA: [42, 87, 86, 255],
        propB: [84, 111, 99, 255],
        enemies: ['wolf', 'archer', 'sentinel']
    }
};

const QUEST_TEMPLATES = {
    hunt: {
        kind: 'hunt',
        title: 'Thin the Pack',
        description: 'Defeat nearby enemies threatening the road.',
        target: 4,
        rewardXp: 70,
        rewardGold: 28
    },
    dungeon: {
        kind: 'dungeon',
        title: 'Break the Warden',
        description: 'Enter a marked ruin and defeat its guardian.',
        target: 1,
        rewardXp: 130,
        rewardGold: 55
    },
    secret: {
        kind: 'secret',
        title: 'Whispers Under Stone',
        description: 'Find and open a hidden cache.',
        target: 1,
        rewardXp: 95,
        rewardGold: 40
    }
};

module.exports = {
    WEAPONS,
    RANGED_WEAPONS,
    UPGRADES,
    ENEMY_TYPES,
    BIOMES,
    QUEST_TEMPLATES
};
