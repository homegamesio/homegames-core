const gamePath = `${global.gameRoot}/word-match/index.js`;
const WordMatch = require(gamePath);

const {
    runBasicTests
} = require('../gameTestHelper');

runBasicTests(WordMatch);

