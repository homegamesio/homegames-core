const gamePath = `${global.gameRoot}/move-test/index.js`;
const MoveTest = require(gamePath);

const {
    runBasicTests
} = require('../gameTestHelper');

runBasicTests(MoveTest);

