const dictionary = require('./dictionary');

const generateName = async () => {
    let name = '';
    const nameLength = 2;
    for (let i = 0; i < nameLength; i++) {

        await dictionary.random().then(word => {
            name += word;

            if (i < nameLength - 1) {
                name += ' ';
            }
        })
    }
    return name;
}

module.exports = {
    generateName
};
