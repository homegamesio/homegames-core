const path = require('path');
const gamePath = `${gameRoot}/word-match/index.js`;
const WordMatch = require(gamePath);
const assert = require("assert");

const {
	testMetaData,
	testGetRoot,
	testHandleNewPlayer,
	testHandlePlayerDisconnect,
} = require("./gameTestHelper");

test("Run basic game tests for WordMatch", () => {
	let gameInstance = new WordMatch();
	testMetaData(WordMatch);
	testGetRoot(gameInstance);
	testHandleNewPlayer(gameInstance);
	testHandlePlayerDisconnect(gameInstance);
	gameInstance.close();
});
