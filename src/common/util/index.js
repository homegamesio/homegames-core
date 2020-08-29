const { ExpiringSet } = require('./cache');
const { generateName } = require('./name-generator');
const { charadesWord } = require('./charades-generator');
const { checkCollisions } = require('./collision');
const { dictionary } = require('./dictionary');
const animations = require('./animations');

module.exports = {
    generateName,
    ExpiringSet,
    charadesWord,
    checkCollisions,
    dictionary,
    animations
};
