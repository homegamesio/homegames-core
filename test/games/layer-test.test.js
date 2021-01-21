const gamePath = `${global.gameRoot}/layer-test/index.js`;
const LayerTest = require(gamePath);

const {
    runBasicTests
} = require('../gameTestHelper');

runBasicTests(LayerTest);

