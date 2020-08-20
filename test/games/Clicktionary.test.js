const path = require('path');
const gamePath = path.resolve('src/games/clicktionary.js');
const Clicktionary = require(gamePath);

const assert = require("assert");
const {
	testMetaData,
	testGetRoot,
	testHandleNewPlayer,
	testHandlePlayerDisconnect,
	testHasClose
} = require("./gameTestHelper");

test("Run basic game tests for Clicktionary", () => {
	let gameInstance = new Clicktionary();
	testMetaData(Clicktionary);
	testGetRoot(gameInstance);
	testHandleNewPlayer(gameInstance);
	testHandlePlayerDisconnect(gameInstance);
	testHasClose(gameInstance);
	gameInstance.close && gameInstance.close();
});
