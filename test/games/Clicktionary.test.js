const path = require('path');
const gamePath = `${gameRoot}/clicktionary/index.js`;
const Clicktionary = require(gamePath);
const assert = require("assert");

const {
	testMetaData,
	testGetRoot,
	testHandleNewPlayer,
	testHandlePlayerDisconnect
} = require("./gameTestHelper");

test("Run basic game tests for Clicktionary", () => {
	let gameInstance = new Clicktionary();
	testMetaData(Clicktionary);
	testGetRoot(gameInstance);
	testHandleNewPlayer(gameInstance);
	testHandlePlayerDisconnect(gameInstance);
        gameInstance.close();
});
