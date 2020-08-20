const path = require('path');
const gamePath = path.resolve('src/games/sprite-test.js');
const SpriteTest = require(gamePath);
const assert = require("assert");

const {
	testMetaData,
	testGetRoot,
	testHandleNewPlayer,
	testHandlePlayerDisconnect,
	testHasClose
} = require("./gameTestHelper");

test("Run basic game tests for SpriteTest", () => {
	let gameInstance = new SpriteTest();
	testMetaData(SpriteTest);
	testGetRoot(gameInstance);
	testHandleNewPlayer(gameInstance);
	testHandlePlayerDisconnect(gameInstance);
	testHasClose(gameInstance);
	gameInstance.close && gameInstance.close();
});
