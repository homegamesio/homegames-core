const https = require('https');
const path = require('path');
const fs = require('fs');

const baseDir = path.dirname(require.main.filename);

let words = [];

// need to move to squish

if (fs.existsSync(path.resolve('dictionary.txt'))) {
    const dictionaryBytes = fs.readFileSync(path.resolve('dictionary.txt'));
    words = dictionaryBytes.toString().split('\n').filter(w => !!w);
} else {
    console.warn('Missing dictionary.txt file. Using default dictionary');
    words = ['hello', 'world'];
}

const dictionary = {
    length: () => words.length,
    
    get: (index) => words[index],
    
    random: () => words[Math.floor(Math.random() * words.length)]
};

module.exports = dictionary;
