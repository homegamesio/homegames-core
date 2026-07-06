const CombatConfig = {
    // World settings
    worldSize: 800,
    playerSize: 3,
    basePlayerSpeed: 0.3,
    
    // Enemy combat settings
    enemyAttackRange: 3,
    enemyAttackCooldown: 500,
    enemySpeed: 0.15,
    enemyDetectionRange: 20,
    
    // Archer settings
    archerHealth: 5,
    archerDamage: 0.5,
    archerProjectileRange: 25,
    archerProjectileCooldown: 700,
    archerKiteDistance: 12,
    
    // Sentry settings
    sentryHealth: 15,
    sentryProjectileRange: 20,
    sentryProjectileCooldown: 1200,
    sentryProjectileSpeed: 0.08,
    sentryProjectileDamage: 4,
    sentryProjectileSize: 6,
    
    // Projectile settings
    projectileSpeed: 0.2,
    projectileDamage: 1,
    projectileSize: 2
};

module.exports = CombatConfig; 