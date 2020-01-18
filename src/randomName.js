const generateList = require('./dictionary');

const generateName = async (numberOfWords) => {
    const data = await generateList();
    const length = data.length;
    const toReturn = [];
    for(let i = 0; i < numberOfWords; i++) {
        toReturn.push(data[Math.floor( Math.random() * length )]);
    }
    return toReturn.join(' ');
};

module.exports = generateName;
