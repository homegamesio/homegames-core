const gameNode = require("./GameNode");

let manager;

const init = () => {
    this.manager = {
        'node': gameNode,
        'checkCollisions': () => {
            console.log('nice');
        }
    };
    return this.manager;
}

const homegames = () => {
    return manager || init();
};

module.exports = homegames;
