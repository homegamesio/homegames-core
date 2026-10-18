'use strict';

const KIND = 'lemonade-tycoon-morning';
const VERSION = 1;
const ingredients = ['water', 'sugar', 'lemons'];
const weapons = ['axe', 'bow', 'cannon'];
const decorations = ['paint', 'sign', 'patio', 'tipjar'];
const boosts = ['power', 'tempo', 'standHp', 'vitality', 'swiftness', 'premium'];
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const number = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const integer = (value, min, max) => Number.isSafeInteger(value) && number(value, min, max);
const pick = (value, keys) => Object.fromEntries(keys.map(key => [key, value[key]]));

// Only logical morning state crosses the save boundary. Connections, input,
// scene nodes, timers, projectiles and unbanked loot are always reconstructed.
function captureMorning(game, weatherIndex) {
    return {
        kind: KIND, version: VERSION, ended: false,
        day: game.day, era: game.era, money: game.money, rep: game.rep,
        inv: pick(game.inv, ingredients), recipe: { ...game.recipe },
        weapon: game.weapon, owned: pick(game.owned, weapons),
        appearance: Object.fromEntries(decorations.map(key => [key, !!game.appearance[key]])),
        boosts: pick(game.boosts, boosts), standHp: game.standHp,
        fence: { level: game.fence.level, hp: game.fence.hp }, turrets: game.turrets,
        stats: { cupsTotal: game.stats.cupsTotal, bossKills: game.stats.bossKills }, weatherIndex
    };
}

const endRun = () => ({ kind: KIND, version: VERSION, ended: true });

function readMorning(saved, weatherCount) {
    if (saved == null) return { status: 'none' };
    const invalid = { status: 'invalid' };
    if (!object(saved) || saved.kind !== KIND || saved.version !== VERSION) return invalid;
    if (saved.ended === true) return { status: 'ended' };
    if (saved.ended !== false || !integer(saved.day, 1, 1000000) || !integer(saved.era, 1, 100)
        || !number(saved.money, 0, 1e12) || !integer(saved.rep, 0, 100)
        || !integer(saved.weatherIndex, 0, weatherCount - 1)
        || !object(saved.inv) || !ingredients.every(key => integer(saved.inv[key], 0, 1e12))
        || !object(saved.recipe) || !integer(saved.recipe.sugar, 1, 5) || !integer(saved.recipe.lemons, 1, 5)
        || !number(saved.recipe.price, .5, 6) || !Number.isInteger(saved.recipe.price * 4)
        || !object(saved.owned) || !weapons.every(key => typeof saved.owned[key] === 'boolean')
        || !['hands', ...weapons].includes(saved.weapon) || (saved.weapon !== 'hands' && !saved.owned[saved.weapon])
        || !object(saved.appearance) || !decorations.every(key => typeof saved.appearance[key] === 'boolean')
        || !object(saved.boosts) || !boosts.every(key => integer(saved.boosts[key], 0, key === 'tempo' ? 5 : 10))
        || !integer(saved.standHp, 1, 30 + saved.boosts.standHp * 10)
        || !object(saved.fence) || !integer(saved.fence.level, 0, 3)
        || !integer(saved.fence.hp, 0, [0, 30, 65, 110][saved.fence.level])
        || !integer(saved.turrets, 0, 4) || !object(saved.stats)
        || !integer(saved.stats.cupsTotal, 0, 1e12) || saved.stats.bossKills !== saved.era - 1) return invalid;
    // Reconstruct an allowlisted value, ignoring any extra persisted fields.
    return { status: 'ready', checkpoint: captureMorning(saved, saved.weatherIndex) };
}

module.exports = { captureMorning, readMorning, endRun };
