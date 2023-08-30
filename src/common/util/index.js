const { ExpiringSet } = require('./cache');
const { generateName } = require('./name-generator');
const { charadesWord } = require('./charades-generator');
const { dictionary } = require('./dictionary');
const animations = require('./animations');
const reportBug = require('./report-bug');

module.exports = {
    generateName,
    ExpiringSet,
    charadesWord,
    dictionary,
    animations,
    reportBug
};
