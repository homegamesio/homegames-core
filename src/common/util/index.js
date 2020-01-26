const { ExpiringSet } = require('./cache');
const { generateName } = require('./name-generator');

module.exports = {
    generateName,
    ExpiringSet,
};
