const path = require('path');
const fs = require('fs');

const selfName = __filename.split('/').pop();

const _exports = {};

fs.readdirSync(__dirname).forEach((fileName) => {
    const dir = path.join(__dirname, fileName);

    if (fs.lstatSync(dir).isDirectory()) {
        fs.readdirSync(dir).forEach(entry => {
            if (entry === 'index.js') {
                const game = require(`${dir}/${entry}`);
                _exports[game.name] = game;
            }
        });
    } 
});

module.exports = _exports;
