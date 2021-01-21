const gamePath = `${global.gameRoot}/perf-test/index.js`;
const PerfTest = require(gamePath);

const {
    runBasicTests
} = require('../gameTestHelper');

runBasicTests(PerfTest);

