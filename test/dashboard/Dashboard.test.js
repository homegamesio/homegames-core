const HomegamesDashboard = require('../../src/HomegamesDashboard');
const Player = require('../../src/Player');
const assert = require('assert');

const dashboard = new HomegamesDashboard();

dashboard.addStateListener(() => {
	console.log('dsfdsfsdfdsf');
});

const fakePlayer = new Player();

assert(Object.keys(dashboard.players).length == 0);
assert(Object.keys(dashboard.playerViews).length == 0);

dashboard._hgAddPlayer(fakePlayer);
assert(Object.keys(dashboard.players).length == 1);

dashboard.handleNewPlayer(fakePlayer);
assert(Object.keys(dashboard.playerViews).length == 1);


console.log('yooooo');
console.log(dashboard);
