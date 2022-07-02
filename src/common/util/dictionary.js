const https = require('https');
const path = require('path');
const fs = require('fs');

const baseDir = path.dirname(require.main.filename);

let words = [];

// need to move to squish
const options = [process.cwd(), require.main.filename, process.mainModule.filename, __dirname]

let dictPath;

for (let i = 0; i < options.length; i++) {
    if (fs.existsSync(`${options[i]}/dictionary.txt`)) {
        dictPath = `${options[i]}/dictionary.txt`;
        break;
    }
}

if (dictPath) {
    console.log('Using dictionary file at ' + dictPath);
    const dictionaryBytes = fs.readFileSync(dictPath);
    words = dictionaryBytes.toString().split('\n').filter(w => !!w);
} else {
    console.log('Missing dictionary.txt file. Using default dictionary');
    words = ['hello', 'world'];
}

const dictionary = {
    length: () => words.length,
    
    get: (index) => words[index],
    
    random: () => words[Math.floor(Math.random() * words.length)]
};

module.exports = dictionary;
