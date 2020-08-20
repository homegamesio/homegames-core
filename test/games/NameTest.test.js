const path = require('path');
const gamePath = path.resolve('src/games/name-test.js');
const NameTest = require(gamePath);
const assert = require("assert");

const {
	testMetaData,
	testGetRoot,
	testHandleNewPlayer,
	testHandlePlayerDisconnect,
	testHasClose
} = require("./gameTestHelper");

test("Run basic game tests for NameTest", () => {
	let gameInstance = new NameTest();
	testMetaData(NameTest);
	testGetRoot(gameInstance);
	testHandleNewPlayer(gameInstance);
	testHandlePlayerDisconnect(gameInstance);
	testHasClose(gameInstance);
	gameInstance.close && gameInstance.close();
});
