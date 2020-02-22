class Game {
    constructor() {
        this.players = {};
        this.listeners = new Set();
        this.root = null;
    }

    _hgAddPlayer(player) {
        this.players[player.id] = player;
    }

    _hgRemovePlayer(playerId) {
        delete this.players[playerId];
    }

    addStateListener(listener) {
        this.listeners.add(listener);
    }

    removeStateListener(listener) {
        this.listeners.remove(listener);
    }

    getRoot() {
        return this.root;
    }
}

module.exports = Game;

