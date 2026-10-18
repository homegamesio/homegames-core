
// -----------------------------------------------------------------------------
// Vegas Trail — gameplay tuning
// Every balance / gameplay number lives here. Tweak, restart, iterate.
//
// Notes:
// - metadata() in index.js must stay a pure object literal (the platform parses
//   it statically), so tickRate: 60 there CANNOT reference this file. Values
//   below marked "per tick" assume tickRate 60 (~16ms per tick).
// - Time knobs are in milliseconds unless the name says otherwise.
// - Copy objects out of here (Object.assign / spread) — never mutate them.
// -----------------------------------------------------------------------------

const TUNING = {
    // The journey from Tucson to Vegas
    TRIP: {
        totalDistanceMiles: 420,
        durationMinutes: 15,          // real time for a one-way trip (also sets map dot speed)
        travelUpdateIntervalMs: 1000  // how often distanceTraveled advances
    },

    // Party survival
    SURVIVAL: {
        maxSickHealth: 100,          // sickness meter; drained by losing in Fight
        maxCarHealth: 100,           // car meter; drained by obstacles in Drive
        sickHitDamage: 1,            // sick health lost when the fight bug lands a hit
        foodDepleteIntervalMs: 12000, // a meal is eaten this often
        foodPerPlayerPerMeal: 1      // food consumed per player per meal
    },

    // What you start with
    START_RESOURCES: {
        scrap: 75,       // money
        wheels: 4,       // a wheel is consumed when car health hits 0
        ammo: 30,        // depleted when hunting
        health: 100,
        antibiotics: 3,  // one is consumed when sick health hits 0
        food: 120,
        weapon: 'baseball',
        vehicle: 'gas-car'
    },

    // Hunt minigame (throwing stuff at desert creatures)
    HUNT: {
        maxShotsOnScreen: 3,
        maxEnemiesOnScreen: 3,
        enemySpawnIntervalMs: 1000,
        enemySpeed: 0.25,        // x units per tick (higher = crosses screen faster)
        enemyMaxYDrift: 20,      // max y wander over a full screen crossing
        enemySpawnMinY: 30,
        enemySpawnMaxY: 70,
        enemyHealth: 50,
        enemyScore: 25,          // score awarded per kill
        damageVariancePct: 10,   // damage rolls within +/- this % of weapon damage
        scrapPerPickup: 1,       // scrap gained when a dropped pickup reaches the counter
        scrapFlyTicks: 40,       // ticks for a dropped pickup to fly to the counter
        legAnimIntervalMs: 500,  // walking animation frame swap
        hitTextLifetimeMs: 500   // how long "-30" damage text lingers
    },

    // Weapons (used by Hunt; rock/biscuit are bought as shop upgrades)
    WEAPONS: {
        baseball: { x: 4, y: 4, velocity: 2, cooldown: 1000, penetration: false, damage: 30 },
        rock:     { x: 5, y: 5, velocity: 3, cooldown: 600,  penetration: true,  damage: 50 },
        biscuit:  { x: 6, y: 6, velocity: 2, cooldown: 1500, penetration: true,  damage: 80 }
    },

    // Drive minigame (dodge obstacles, grab scrap)
    DRIVE: {
        maxThingsOnScreen: 6,        // obstacles + rewards combined
        spawnIntervalMs: 600,
        rewardProbability: 0.5,      // chance a spawn is scrap instead of an obstacle
        obstacleSpeed: 1.5,            // y units per tick
        rewardSpeed: 1,              // y units per tick
        obstacleDamage: 30,          // car health lost per obstacle hit
        scrapPerReward: 1,
        collisionCheckIntervalMs: 0, // 0 = every tick
        roadAnimIntervalMs: 500      // road animation frame swap
    },

    // Fight minigame (whack-a-bug boxing)
    FIGHT: {
        hitsToWin: 3,              // punches needed to knock out a bug
        enemyMoveIntervalMs: 750,  // how often the bug changes stance / lands a hit
        gloveResetMs: 250,         // punch animation duration
        dustLifetimeMs: 500        // KO dust cloud duration
    },

    // Talk minigame
    TALK: {
        cooldownMs: 3000  // min time between new random strangers
    },

    // Shop (drone-delivered, summoned from the map)
    SHOP: {
        droneMoveIntervalMs: 200,  // how often the drone advances along its path
        droneTripSteps: 8,         // path steps for the drone to reach the party (lower = faster)
        // Bundles unlocked when the party reaches each landmark (amount per purchase).
        inventoryByLandmark: {
            "St. Mary's Mexican Food": {
                consumables: {
                    food:        { amount: 40,  cost: 1 },
                    wheels:      { amount: 1,   cost: 50 },
                    ammo:        { amount: 100, cost: 2 },
                    antibiotics: { amount: 4,   cost: 50 }
                },
                upgrades: {
                    rock:    { cost: 50 },
                    biscuit: { cost: 100 }
                }
            },
            "Phoenix": {},
            "Gas Station": {},
            "Hoover Dam": {},
            "Las Vegas Strip": {}
        }
    }
};

module.exports = TUNING;
