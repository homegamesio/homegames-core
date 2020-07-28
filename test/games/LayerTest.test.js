const LayerTest = require("../../src/games/layer-test");
const assert = require("assert");
const {
	testMetaData,
	testGetRoot,
	testHandleNewPlayer,
	testHandlePlayerDisconnect,
	testHasClose
} = require("./gameTestHelper");

test("Run basic game tests for LayerTest", () => {
	let gameInstance = new LayerTest();
	testMetaData(LayerTest);
	testGetRoot(gameInstance);
	testHandleNewPlayer(gameInstance);
	testHandlePlayerDisconnect(gameInstance);
	testHasClose(gameInstance);
	gameInstance.close && gameInstance.close();
});