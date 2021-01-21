const gamePath = `${global.gameRoot}/clicktionary/index.js`;
const Clicktionary = require(gamePath);

const {
    runBasicTests
} = require('../gameTestHelper');

runBasicTests(Clicktionary);

