const gamePath = `${global.gameRoot}/squarer/index.js`;
const Squarer = require(gamePath);

const {
    runBasicTests
} = require('../gameTestHelper');

runBasicTests(Squarer);

