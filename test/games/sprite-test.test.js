const path = require('path');
const gamePath = `${gameRoot}/sprite-test/index.js`;
const SpriteTest = require(gamePath);
const assert = require("assert");

const {
	testMetaData,
	testGetRoot,
	testHandleNewPlayer,
	testHandlePlayerDisconnect
} = require("./gameTestHelper");

test("Run basic game tests for SpriteTest", () => {
	let gameInstance = new SpriteTest();
	testMetaData(SpriteTest);
	testGetRoot(gameInstance);
	testHandleNewPlayer(gameInstance);
	testHandlePlayerDisconnect(gameInstance);
	gameInstance.close();
});
