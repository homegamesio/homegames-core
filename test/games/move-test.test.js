const path = require('path');
const gamePath = `${gameRoot}/move-test/index.js`;
const MoveTest = require(gamePath);
const assert = require("assert");

const {
	testMetaData,
	testGetRoot,
	testHandleNewPlayer,
	testHandlePlayerDisconnect
} = require("./gameTestHelper");

test("Run basic game tests for MoveTest", () => {
	let gameInstance = new MoveTest();
	testMetaData(MoveTest);
	testGetRoot(gameInstance);
	testHandleNewPlayer(gameInstance);
	testHandlePlayerDisconnect(gameInstance);
	gameInstance.close();
});
