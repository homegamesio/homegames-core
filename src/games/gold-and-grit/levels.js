'use strict';
const { ORDER, clone } = require('./content');
// The shipped campaign is ordinary editor data. No procedural wave generation
// or hidden difficulty adjustment runs during play; every encounter is inspectable.
const BASE_LEVELS = require('./campaign.json');
const SECRET_LEVELS = require('./badlands.json');
const BASE_COUNT = BASE_LEVELS.length;
const LEVELS = [...BASE_LEVELS, ...SECRET_LEVELS];
const unlockedIndex = stars => {
    let index = 0;
    while (index < LEVELS.length - 1 && stars[index] > 0) index++;
    return index;
};
function group(kind, count, gap = .8, delay = 0, route = 0) { return { kind, count, gap, delay, route }; }
function blankLevel() {
    return { ...clone(LEVELS[0]), id: 'custom', name: 'My frontier', unlocked: ORDER.slice(), cash: 300,
        waves: [[group('drifter', 12)], [group('runner', 14)], [group('rider', 8)]] };
}
module.exports = { LEVELS, BASE_LEVELS, SECRET_LEVELS, BASE_COUNT, unlockedIndex, blankLevel, group };
