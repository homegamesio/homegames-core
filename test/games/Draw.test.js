const gamePath = `${global.gameRoot}/draw/index.js`;
const Draw = require(gamePath);

const {
    runBasicTests
} = require('../gameTestHelper');

runBasicTests(Draw);

