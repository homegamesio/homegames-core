const { ExpiringSet } = require('./cache');
const { generateName } = require('./name-generator');
const { charadesWord } = require('./charades-generator');
const { dictionary } = require('./dictionary');
const animations = require('./animations');

module.exports = {
    generateName,
    ExpiringSet,
    charadesWord,
    dictionary,
    animations
};
