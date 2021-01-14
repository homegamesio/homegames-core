const path = require('path');
const gamePath = `${gameRoot}/slaps/index.js`;
const Slaps = require(gamePath);
const assert = require("assert");

const {
	testMetaData,
	testGetRoot,
	testHandleNewPlayer,
	testHandlePlayerDisconnect
} = require("./gameTestHelper");

test("Run basic game tests for Slaps", () => {
	let gameInstance = new Slaps();
	testMetaData(Slaps);
	testGetRoot(gameInstance);
	testHandleNewPlayer(gameInstance);
	testHandlePlayerDisconnect(gameInstance);
	gameInstance.close();
});
