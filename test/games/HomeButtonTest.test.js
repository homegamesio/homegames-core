const HomeButtonTest = require("../../src/games/home-button-test");
const assert = require("assert");
const {
	testMetaData,
	testGetRoot,
	testHandleNewPlayer,
	testHandlePlayerDisconnect,
	testHasClose
} = require("./gameTestHelper");

test("Run basic game tests for HomeButonTest", () => {
	let gameInstance = new HomeButtonTest();
	testMetaData(HomeButtonTest);
	testGetRoot(gameInstance);
	testHandleNewPlayer(gameInstance);
	testHandlePlayerDisconnect(gameInstance);
	testHasClose(gameInstance);
	gameInstance.close && gameInstance.close();
});