const path = require('path');
const gamePath = path.resolve('src/games/word-match.js');
const WordMatch = require(gamePath);
const assert = require("assert");

const {
	testMetaData,
	testGetRoot,
	testHandleNewPlayer,
	testHandlePlayerDisconnect,
	testHasClose
} = require("./gameTestHelper");

test("Run basic game tests for WordMatch", () => {
	let gameInstance = new WordMatch();
	testMetaData(WordMatch);
	testGetRoot(gameInstance);
//	testHandleNewPlayer(gameInstance);
//	testHandlePlayerDisconnect(gameInstance);
//	testHasClose(gameInstance);
//	gameInstance.close && gameInstance.close();
});
