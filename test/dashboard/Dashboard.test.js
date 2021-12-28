const HomegamesDashboard = require('../../src/HomegamesDashboard');
const Player = require('../../src/Player');
const assert = require('assert');

const arrayEquals = (array1, array2) => {
    let eq = true;

    if (array1.length != array2.length) {
        return false;
    }

    for (let i = 0; i < array1.length; i++) {
        eq &= array1[i] === array2[i];    
    }

    return eq;
};

const dashboard = new HomegamesDashboard();

const fakePlayer = new Player();

assert(Object.keys(dashboard.players).length == 0);
assert(Object.keys(dashboard.playerViews).length == 0);

dashboard._hgAddPlayer(fakePlayer);
assert(Object.keys(dashboard.players).length == 1);

dashboard.handleNewPlayer(fakePlayer);
assert(Object.keys(dashboard.playerViews).length == 1);

const fakePlayerView = dashboard.playerViews[fakePlayer.id];

const playerScrollBar = fakePlayerView.root.getChildren().find(child => child.node.fill && arrayEquals(child.node.fill, [0, 0, 255, 255]));

playerScrollBar.node.handleClick(fakePlayer, 80, 90);
// get the canvas that everything is rendered on top of
// const playerCanvas = fakePlayerRoot.getChildren().find(child => arrayEquals(child.node.coordinates2d[0], [0, 0]) && arrayEquals(child.node.coordinates2d[1], [0, 0]));

// playerCanvas.getChildren().forEach(child => {
// 	console.log('sdfsdfdsf');
// 	console.log(child);
// });


// console.log('can');
// console.log(playerCanvas);

// fakePlayerViewRoot.getChildren().forEach(child => {
// 	console.log("CHILD");
// 	console.log(child);
// });

// // const scrollBar = fakePlayerViewRoot.children.

// console.log('yooooo');
// console.log(fakePlayerView);
