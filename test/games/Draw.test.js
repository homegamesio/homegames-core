const path = require('path');
const gamePath = `${gameRoot}/draw/index.js`;
const Draw = require(gamePath);
const assert = require("assert");

const {
	testMetaData,
	testGetRoot,
	testHandleNewPlayer,
	testHandlePlayerDisconnect
} = require("./gameTestHelper");

test("Run basic game tests for DrawTest", () => {
	let gameInstance = new Draw();
	testMetaData(Draw);
	testGetRoot(gameInstance);
	testHandleNewPlayer(gameInstance);
	testHandlePlayerDisconnect(gameInstance);
	gameInstance.close();
});
