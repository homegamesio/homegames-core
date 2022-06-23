const assert = require('assert');
const squishMap = require('../src/common/squish-map');
const Player = require('../src/Player');

const testMetaData = (game) => {
    const metaData = game.metadata();
    assert(metaData.aspectRatio);
    assert(metaData.aspectRatio.x);
    assert(metaData.aspectRatio.y);
    assert(metaData.author);
};

const testGetRoot = (game) => {
    const layers = game.getLayers();
    const metadata = game.constructor.metadata && game.constructor.metadata();
    const squishVersion = metadata?.squishVersion;
    const squishLib = require(squishMap[squishVersion]);
    // console.log('squsiv ' + squishVersion);
    // console.log(squishMap);
    const GameNode = squishLib.GameNode;
    layers.forEach(layer => {
        // console.log('layerrrr');
        // console.log(layer);

        // console.log(layer.root);
        // console.log(layer.root.constructor);
        // console.log()
        assert((layer.root instanceof GameNode.Shape) || (layer.root instanceof GameNode.Text) || (layer.root instanceof GameNode.Asset));
    });
};

const testHandleNewPlayer = (game) => {
    let succeeded;
    try {
        game.handleNewPlayer && game.handleNewPlayer({ playerId: 1, info: { name: 'test' }, settings: {} });
        succeeded = true;
    } catch (err) {
        console.log('sdfdsf');
        console.log(err);
        succeeded = false;
    }
    assert(succeeded);
};

const testHandlePlayerDisconnect = (game) => {
    let succeeded;
    try {
        game.handlePlayerDisconnect && game.handlePlayerDisconnect(1);
        succeeded = true;
    } catch (err) {
        console.log(err);
        succeeded = false;
    }
    assert(succeeded);
};

const runBasicTests = (gameClass) => {
    global.test(`Run basic game tests for ${gameClass.name}`, () => {
        const gameInstance = new gameClass();
        testMetaData(gameClass);
        testGetRoot(gameInstance);
        testHandleNewPlayer(gameInstance);
        testHandlePlayerDisconnect(gameInstance);
        gameInstance.close();
    });
};

module.exports = {
    testMetaData,
    testGetRoot,
    testHandleNewPlayer,
    testHandlePlayerDisconnect,
    runBasicTests
};
