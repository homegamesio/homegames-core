const dictionary = require('./charades-words');

const charadesWord = async () => {
    let name = '';
    const nameLength = 1;
    for (let i = 0; i < nameLength; i++) {

        await dictionary.random().then(word => {
            name += word;

            if (i < nameLength - 1) {
                name += ' ';
            }
        });
    }
    return name;
};

module.exports = {
    charadesWord
};
