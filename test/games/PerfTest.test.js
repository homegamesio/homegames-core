const path = require('path');
const gamePath = path.resolve('src/games/perf-test.js');
const PerfTest = require(gamePath);
const assert = require("assert");

const {
	testMetaData,
	testGetRoot,
	testHandleNewPlayer,
	testHandlePlayerDisconnect,
	testHasClose
} = require("./gameTestHelper");

test("Run basic game tests for PerfTest", () => {
	let gameInstance = new PerfTest();
	testMetaData(PerfTest);
	testGetRoot(gameInstance);
	testHandleNewPlayer(gameInstance);
	testHandlePlayerDisconnect(gameInstance);
	testHasClose(gameInstance);
	gameInstance.close && gameInstance.close();
});
