const path = require('path');
const gamePath = `${gameRoot}/squarer/index.js`;
const Squarer = require(gamePath);
const assert = require("assert");

const {
	testMetaData,
	testGetRoot,
	testHandleNewPlayer,
	testHandlePlayerDisconnect
} = require("./gameTestHelper");

test("Run basic game tests for Squarer", () => {
	let gameInstance = new Squarer();
	testMetaData(Squarer);
	testGetRoot(gameInstance);
	testHandleNewPlayer(gameInstance);
	testHandlePlayerDisconnect(gameInstance);
        gameInstance.close();
});
