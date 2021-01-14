const assert = require("assert");
const { GameNode } =  require('squishjs');

const testMetaData = (game) => {
	const metaData = game.metadata();
	assert(metaData.aspectRatio);
	assert(metaData.aspectRatio.x);
	assert(metaData.aspectRatio.y);
	assert(metaData.author);
};

const testGetRoot = (game) => {
    const res = game.getRoot();
    assert((res instanceof GameNode.Shape) || (res instanceof GameNode.Text) || (res instanceof GameNode.Asset));
};

const testHandleNewPlayer = (game) => {
	let succeeded;
	try {
		game.handleNewPlayer && game.handleNewPlayer({ id: 1 });
		succeeded = true;
	} catch {
		succeeded = false;
	}
	assert(succeeded);
};

const testHandlePlayerDisconnect = (game) => {
	let succeeded;
	try {
		game.handlePlayerDisconnect && game.handlePlayerDisconnect(1);
		succeeded = true;
	} catch {
		succeeded = false;
	}
	assert(succeeded);
};

module.exports = {
	testMetaData,
	testGetRoot,
	testHandleNewPlayer,
	testHandlePlayerDisconnect
};
