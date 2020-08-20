const path = require('path');
const gamePath = path.resolve('src/games/squarer.js');
const Squarer = require(gamePath);
const assert = require("assert");

const {
	testMetaData,
	testGetRoot,
	testHandleNewPlayer,
	testHandlePlayerDisconnect,
	testHasClose
} = require("./gameTestHelper");

test("Run basic game tests for Squarer", () => {
	let gameInstance = new Squarer();
	testMetaData(Squarer);
	testGetRoot(gameInstance);
	testHandleNewPlayer(gameInstance);
	testHandlePlayerDisconnect(gameInstance);
	testHasClose(gameInstance);
	gameInstance.close && gameInstance.close();
});
