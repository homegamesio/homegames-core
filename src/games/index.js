const selfName = __filename.split('/').pop();

const _exports = {};

require('fs').readdirSync(__dirname).forEach((fileName) => {
    if (fileName.endsWith('.js') && fileName !== selfName) {
        const game = require(`./${fileName}`);
        _exports[game.name] = game;
    }
});

module.exports = _exports;

