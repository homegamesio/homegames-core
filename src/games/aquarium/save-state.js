'use strict';

const catalog = require('./data/catalog');
const MAX_POINTS = 9000000000000000;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const number = (value, fallback, min = 0, max = MAX_POINTS) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const integer = (value, fallback = 0, max = MAX_POINTS) => Math.floor(number(value, fallback, 0, max));
const text = (value, fallback, limit = 40) => typeof value === 'string' ? value.slice(0, limit) : fallback;

// Rebuild logical objects through the game's constructors. Never restore nodes,
// callbacks, player connections, food targets, or arbitrary object properties.
function restoreCheckpoint(game, saved, { upgrades, events, eventDuration, spaceMinY, spaceMaxY }) {
    if (!object(saved) || saved.kind !== 'homegames.save' || !object(saved.economy) || !Array.isArray(saved.fish)) return false;
    if (!(saved.formatVersion === 7 && saved.game === 'aquarium-forever-horizon')
        && !(saved.formatVersion === 4 && saved.game === 'aquarium-forever-strict-streaming')) return false;
    if (!saved.fish.some(fish => object(fish) && !fish.golden && catalog.fish.some(species => species.id === fish.speciesId))) return false;

    game.time = number(saved.elapsedSeconds, 0, 0, 1e12);
    game.tankTier = integer(saved.tankTier, 0, catalog.tanks.length - 1);
    game.spaceUnlocked = game.tankTier >= 4;
    for (let tier = 1; tier <= Math.min(3, game.tankTier); tier++) game.expandStaticWorld(tier);
    if (game.spaceUnlocked) game.buildSpaceWorld();

    const progression = object(saved.progression) ? saved.progression : {};
    game.progression.completedEras = integer(progression.completedEras, 0, 1000000);
    game.progression.era = game.progression.completedEras + 1;
    game.progression.lifetimeEarned = number(progression.lifetimeEarned, number(saved.economy.totalEarned, 0));
    for (const upgrade of upgrades) {
        game.progression.worldUpgrades[upgrade.id] = integer(progression.worldUpgrades?.[upgrade.id], 0, upgrade.maxLevel);
    }
    for (const key of ['money', 'totalEarned']) game.economy[key] = number(saved.economy[key], game.economy[key]);
    game.economy.foodEaten = integer(saved.economy.foodEaten);
    game.economy.foodLevel = integer(saved.economy.foodLevel, 0, 10000);
    for (const key of ['fishPurchases', 'decorPurchases']) {
        for (const id of Object.keys(game.economy[key])) game.economy[key][id] = integer(saved.economy[key]?.[id]);
    }

    game.fish = []; game.fishById.clear(); game.nextFishId = 1;
    game.aliens = []; game.alienById.clear(); game.nextAlienId = 1;
    for (const id of Object.keys(game.fishCounts)) game.fishCounts[id] = 0;
    const bounds = game.tankBounds();
    const restoreCreatures = (records, speciesList, create, list, cap, minY, maxY) => {
        for (const record of Array.isArray(records) ? records : []) {
            if (list.length >= cap) break;
            if (!object(record) || record.golden || !speciesList.some(species => species.id === record.speciesId)) continue;
            if (!create(record.speciesId, true)) continue;
            const creature = list[list.length - 1];
            creature.x = number(record.x, creature.x, bounds.min + 5, bounds.max - 5);
            creature.y = number(record.y, creature.y, minY, maxY);
            creature.dir = record.dir === -1 ? -1 : 1;
            creature.vx = creature.desiredVx = Math.abs(creature.vx) * creature.dir;
            creature.scale = number(record.scale, 1, 0.5, 2);
            creature.name = text(record.name, creature.name);
            creature.trait = game.creatureTraitInfo(record.trait)?.id || '';
            creature.bornAt = number(record.bornAt, game.time, 0, game.time);
            creature.bites = integer(record.bites);
            creature.lifetimeEarned = number(record.lifetimeEarned, 0);
        }
    };
    restoreCreatures(saved.fish, catalog.fish, game.addFish.bind(game), game.fish, game.effectiveFishCap(), 5, 95);
    if (game.spaceUnlocked) restoreCreatures(saved.aliens, catalog.aliens || [], game.addAlien.bind(game), game.aliens, game.effectiveAlienCap(), spaceMinY, spaceMaxY);

    for (const record of (Array.isArray(saved.accessories) ? saved.accessories : []).slice(0, game.poolLimits().accessories)) {
        if (!object(record)) continue;
        const item = catalog.decor.find(item => item.id === record.type && item.id !== 'flakes');
        if (!item || (item.unlockTier || 0) > game.tankTier || game.decorCounts[item.id] >= game.decorMax(item)) continue;
        game.activateAccessory(item.id);
        const accessory = game.accessories[game.accessories.length - 1];
        accessory.x = number(record.x, accessory.x, bounds.min + 5, bounds.max - 5);
        const space = accessory.y < 0;
        accessory.y = number(record.y, accessory.y, space ? spaceMinY : 1, space ? spaceMaxY : 98);
        accessory.nextAction = game.time + number(record.nextAction - game.time, 5, 0, 60);
        game.decorCounts[item.id]++;
    }
    game.progression.lastCurrentUnlocked = game.currentEraMarkerCount();
    game.goldenEvent.nextAt = game.time + game.nextFirstGoldenVisitorDelay();
    game.worldEvent.nextAt = game.time + game.nextFirstWorldEventDelay();
    const event = events.find(event => event.id === saved.worldEvent?.id && (event.biome !== 'space' || game.spaceUnlocked));
    const remaining = number(saved.worldEvent?.remaining, 0, 0, eventDuration);
    if (event && remaining > 0) {
        game.worldEvent.serial = 1;
        game.worldEvent.lastId = event.id;
        game.worldEvent.active = { ...event, until: game.time + remaining, nextPulse: game.time, direction: 1, serial: 1 };
    }
    game._renderSpatialIndexTime = -1;
    return true;
}

module.exports = { restoreCheckpoint };
