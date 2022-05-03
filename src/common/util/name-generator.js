const dictionary = require('./dictionary');

const generateName = () => {
    let name = '';
    const nameLength = 2;
    for (let i = 0; i < nameLength; i++) {

        name += dictionary.random();

        if (i < nameLength - 1) {
            name += ' ';
        }
    }
    
    return name;
};

module.exports = {
    generateName
};
