module.exports = {
    tanks: [
        {
            id: 'starter',
            name: 'STARTER TANK',
            width: 100,
            fishCap: 72,
            decorScale: 1,
            rewardScale: 1,
            storeScale: 1,
            upgradeCost: 0
        },
        {
            id: 'wide',
            name: 'WIDE TANK',
            width: 190,
            fishCap: 180,
            decorScale: 2,
            rewardScale: 10,
            storeScale: 12,
            upgradeCost: 50000
        },
        {
            id: 'gallery',
            name: 'GALLERY TANK',
            width: 340,
            fishCap: 420,
            decorScale: 3,
            rewardScale: 120,
            storeScale: 150,
            upgradeCost: 8000000
        },
        {
            id: 'ocean-wall',
            name: 'OCEAN WALL',
            width: 560,
            fishCap: 1000,
            decorScale: 5,
            rewardScale: 1500,
            storeScale: 2000,
            upgradeCost: 1500000000
        },
        {
            id: 'space',
            name: 'BREAK THE SURFACE',
            width: 560,
            fishCap: 1000,
            alienCap: 400,
            decorScale: 6,
            rewardScale: 25000,
            storeScale: 30000,
            upgradeCost: 2000000000000
        }
    ],
    fish: [
        {
            id: 'guppy',
            name: 'GUPPY',
            unlockTier: 0,
            renderType: 'guppy',
            baseCost: 25,
            reward: 1,
            speed: 8.4,
            length: 3.0,
            height: 1.45,
            behavior: { temperament: 'social', schooling: 0.65, curiosity: 0.55, separation: 1.0, depthMin: 18, depthMax: 74 },
            colors: [[255, 173, 73, 255], [255, 231, 137, 255], [35, 39, 54, 255]]
        },
        {
            id: 'clown',
            name: 'CLOWNFISH',
            unlockTier: 0,
            renderType: 'clown',
            baseCost: 100,
            reward: 3,
            speed: 7.5,
            length: 4.1,
            height: 2.0,
            behavior: { temperament: 'social', schooling: 0.5, curiosity: 0.85, separation: 1.0, depthMin: 22, depthMax: 73 },
            colors: [[245, 127, 45, 255], [246, 246, 240, 255], [34, 34, 43, 255]]
        },
        {
            id: 'tang',
            name: 'BLUE TANG',
            unlockTier: 0,
            renderType: 'tang',
            baseCost: 450,
            reward: 8,
            speed: 10.4,
            length: 4.7,
            height: 2.45,
            behavior: { temperament: 'school', schooling: 0.82, curiosity: 0.45, separation: 1.0, depthMin: 18, depthMax: 68 },
            colors: [[57, 106, 224, 255], [255, 214, 70, 255], [20, 29, 50, 255]]
        },
        {
            id: 'angel',
            name: 'ANGELFISH',
            unlockTier: 0,
            renderType: 'angel',
            baseCost: 2000,
            reward: 22,
            speed: 6.2,
            length: 3.7,
            height: 3.45,
            behavior: { temperament: 'grazer', schooling: 0.35, curiosity: 0.75, separation: 1.05, depthMin: 20, depthMax: 76 },
            colors: [[245, 208, 89, 255], [31, 31, 43, 255], [116, 209, 241, 255]]
        },
        {
            id: 'puffer',
            name: 'PUFFER',
            unlockTier: 0,
            renderType: 'puffer',
            baseCost: 9000,
            reward: 65,
            speed: 4.8,
            length: 3.4,
            height: 3.2,
            behavior: { temperament: 'curious', schooling: 0.08, curiosity: 1.0, separation: 1.25, depthMin: 20, depthMax: 74 },
            colors: [[224, 196, 112, 255], [246, 239, 214, 255], [40, 40, 45, 255]]
        },
        {
            id: 'neon',
            name: 'NEON TETRA',
            unlockTier: 1,
            renderType: 'neon',
            baseCost: 28000,
            reward: 180,
            speed: 11.8,
            length: 2.8,
            height: 1.15,
            behavior: { temperament: 'school', schooling: 0.98, curiosity: 0.25, separation: 0.8, depthMin: 22, depthMax: 65 },
            colors: [[36, 91, 160, 255], [75, 241, 245, 255], [245, 68, 88, 255]]
        },
        {
            id: 'betta',
            name: 'BETTA',
            unlockTier: 1,
            renderType: 'betta',
            baseCost: 110000,
            reward: 520,
            speed: 5.4,
            length: 4.2,
            height: 2.35,
            behavior: { temperament: 'territorial', schooling: 0.05, curiosity: 0.65, separation: 1.65, depthMin: 18, depthMax: 72 },
            colors: [[116, 52, 204, 255], [241, 76, 150, 255], [113, 222, 246, 255]]
        },
        {
            id: 'lionfish',
            name: 'LIONFISH',
            unlockTier: 2,
            renderType: 'lionfish',
            baseCost: 480000,
            reward: 1600,
            speed: 4.1,
            length: 5.4,
            height: 3.15,
            behavior: { temperament: 'lurker', schooling: 0.08, curiosity: 0.4, separation: 1.35, depthMin: 38, depthMax: 79 },
            colors: [[181, 74, 57, 255], [246, 222, 181, 255], [65, 34, 36, 255]]
        },
        {
            id: 'turtle',
            name: 'SEA TURTLE',
            unlockTier: 2,
            renderType: 'turtle',
            baseCost: 2200000,
            reward: 5200,
            speed: 3.5,
            length: 6.3,
            height: 4.0,
            behavior: { temperament: 'glider', schooling: 0.15, curiosity: 0.8, separation: 1.2, depthMin: 10, depthMax: 72 },
            colors: [[74, 126, 84, 255], [151, 165, 91, 255], [39, 70, 52, 255]]
        },
        {
            id: 'shark',
            name: 'REEF SHARK',
            unlockTier: 3,
            renderType: 'shark',
            baseCost: 12000000,
            reward: 17000,
            speed: 12.4,
            length: 7.6,
            height: 2.55,
            behavior: { temperament: 'patrol', schooling: 0.02, curiosity: 0.2, separation: 1.7, depthMin: 18, depthMax: 74 },
            colors: [[101, 127, 145, 255], [199, 216, 223, 255], [28, 42, 52, 255]]
        }
    ],
    aliens: [
        { id: 'orbit-blob', name: 'ORBIT BLOB', biome: 'space', unlockTier: 4, renderType: 'blob', baseCost: 1500000, reward: 140, speed: 4.6, length: 4.2, height: 4.0, colors: [[142,105,255,255],[104,245,220,255],[24,20,52,255]] },
        { id: 'prism-ray', name: 'PRISM RAY', biome: 'space', unlockTier: 4, renderType: 'ray', baseCost: 6000000, reward: 520, speed: 7.2, length: 7.2, height: 3.2, colors: [[72,214,255,255],[255,102,215,255],[255,234,112,255]] },
        { id: 'tripod-grazer', name: 'TRIPOD GRAZER', biome: 'space', unlockTier: 4, renderType: 'tripod', baseCost: 28000000, reward: 2100, speed: 3.4, length: 5.0, height: 6.0, colors: [[255,154,91,255],[105,236,148,255],[38,35,63,255]] },
        { id: 'void-leviathan', name: 'VOID LEVIATHAN', biome: 'space', unlockTier: 4, renderType: 'leviathan', baseCost: 160000000, reward: 12000, speed: 5.8, length: 14.0, height: 4.5, colors: [[73,58,130,255],[192,102,255,255],[82,241,224,255]] }
    ],
    decor: [
        {
            id: 'plant',
            name: 'SEAWEED',
            baseCost: 75,
            maxByTier: [10, 16, 24, 36, 42],
            description: '+2% ALL FOOD'
        },
        {
            id: 'coral',
            name: 'CORAL',
            baseCost: 350,
            maxByTier: [8, 12, 18, 24, 30],
            description: '+5% ALL FOOD'
        },
        {
            id: 'bubbler',
            name: 'BUBBLER',
            baseCost: 1800,
            maxByTier: [2, 3, 4, 6, 8],
            description: 'AUTO FEEDS'
        },
        {
            id: 'castle',
            name: 'CASTLE',
            baseCost: 8000,
            maxByTier: [3, 4, 5, 6, 8],
            description: '+15% ALL FOOD'
        },
        {
            id: 'flakes',
            name: 'BETTER FLAKES',
            baseCost: 250,
            max: 999,
            description: '+1 FOOD VALUE'
        },
        {
            id: 'feeder',
            name: 'ROAMING FEEDER',
            unlockTier: 1,
            baseCost: 50000,
            maxByTier: [0, 2, 3, 4, 5],
            description: 'SPREADS FOOD AROUND'
        },
        {
            id: 'current',
            name: 'CURRENT JET',
            unlockTier: 1,
            baseCost: 160000,
            maxByTier: [0, 2, 3, 4, 5],
            description: 'FISH SURF THE FLOW'
        },
        {
            id: 'cave',
            name: 'REEF CAVE',
            unlockTier: 1,
            baseCost: 400000,
            maxByTier: [0, 4, 6, 8, 10],
            description: 'FISH HIDE + REST'
        },
        {
            id: 'beacon',
            name: 'SCHOOLING LIGHT',
            unlockTier: 2,
            baseCost: 1200000,
            maxByTier: [0, 0, 3, 4, 5],
            description: 'BUILDS BIG SCHOOLS'
        },
        {
            id: 'treasure',
            name: 'TREASURE CHEST',
            unlockTier: 2,
            baseCost: 5000000,
            maxByTier: [0, 0, 2, 3, 4],
            description: 'GOLDEN FOOD BURSTS'
        },
        { id: 'orbital-feeder', name: 'ORBITAL FEEDER', biome: 'space', unlockTier: 4, baseCost: 3000000, maxByTier: [0,0,0,0,4], description: 'LAUNCHES COSMIC FOOD' },
        { id: 'gravity-well', name: 'GRAVITY WELL', biome: 'space', unlockTier: 4, baseCost: 14000000, maxByTier: [0,0,0,0,4], description: 'ALIENS ORBIT + GATHER' },
        { id: 'asteroid-garden', name: 'ASTEROID GARDEN', biome: 'space', unlockTier: 4, baseCost: 40000000, maxByTier: [0,0,0,0,6], description: 'TRIPODS EXPLORE IT' },
        { id: 'signal-beacon', name: 'SIGNAL BEACON', biome: 'space', unlockTier: 4, baseCost: 126000000, maxByTier: [0,0,0,0,3], description: '+20% SPACE REWARDS' },
        { id: 'wormhole', name: 'WORMHOLE', biome: 'space', unlockTier: 4, baseCost: 300000000, maxByTier: [0,0,0,0,2], description: 'TELEPORTS ALIENS' }
    ]
};
