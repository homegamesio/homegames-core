const gamePath = `${global.gameRoot}/slaps/index.js`;
const Slaps = require(gamePath);

const {
    runBasicTests
} = require('../gameTestHelper');

runBasicTests(Slaps);

