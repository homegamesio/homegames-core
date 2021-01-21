const gamePath = `${global.gameRoot}/sprite-test/index.js`;
const SpriteTest = require(gamePath);

const {
    runBasicTests
} = require('../gameTestHelper');

runBasicTests(SpriteTest);

