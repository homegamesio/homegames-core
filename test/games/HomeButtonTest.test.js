const path = require('path');
const gamePath = path.resolve('src/games/home-button-test.js');
const HomeButtonTest = require(gamePath);
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
