const LemonadeConfig = {
    // Stand timer settings
    standDuration: 30000, // 30 seconds of selling
    customerSpawnInterval: 2000, // Spawn every 2 seconds
    
    // Pricing settings
    basePrice: 0.5,
    sugarCost: 0.1,  // 10 cents per sugar
    lemonCost: 0.15, // 15 cents per lemon
    
    // Customer behavior settings
    customerDecisionTime: 2000, // 2 seconds to decide
    resultDisplayTime: 2000,    // 2 seconds to show purchase result
    
    // Addiction system
    sugarAddictionRate: 3, // Every 3 sugar = 1 addiction point
    bossThreshold: 10,     // 10 addiction points = becomes boss
    
    // Screen positions
    walkingY: 45,           // Y position for walking customers
    standX: 50,             // X position of the stand
    stoppedY: 50,           // Y position for stopped customers
    spawnLeftX: -10,        // Left spawn position
    spawnRightX: 110,       // Right spawn position
    despawnLeftX: -15,      // Left despawn position  
    despawnRightX: 115,     // Right despawn position
    stopCheckLeftX: 40,     // Left boundary for stop check
    stopCheckRightX: 60     // Right boundary for stop check
};

module.exports = LemonadeConfig; 