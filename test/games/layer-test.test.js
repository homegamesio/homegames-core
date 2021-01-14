const path = require('path');
const gamePath = `${gameRoot}/layer-test/index.js`;
const LayerTest = require(gamePath);
const assert = require("assert");

const {
	testMetaData,
	testGetRoot,
	testHandleNewPlayer,
	testHandlePlayerDisconnect
} = require("./gameTestHelper");

test("Run basic game tests for LayerTest", () => {
	let gameInstance = new LayerTest();
	testMetaData(LayerTest);
	testGetRoot(gameInstance);
	testHandleNewPlayer(gameInstance);
	testHandlePlayerDisconnect(gameInstance);
	gameInstance.close();
});
