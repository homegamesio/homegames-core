const path = require('path');
const gamePath = `${gameRoot}/perf-test/index.js`;
const PerfTest = require(gamePath);
const assert = require("assert");

const {
	testMetaData,
	testGetRoot,
	testHandleNewPlayer,
	testHandlePlayerDisconnect
} = require("./gameTestHelper");

test("Run basic game tests for PerfTest", () => {
	let gameInstance = new PerfTest();
	testMetaData(PerfTest);
	testGetRoot(gameInstance);
	testHandleNewPlayer(gameInstance);
	testHandlePlayerDisconnect(gameInstance);
	gameInstance.close();
});
