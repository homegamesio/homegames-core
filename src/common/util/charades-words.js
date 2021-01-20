const https = require('https');
const fs = require('fs');

let words = [];

const generateList = async () => new Promise((resolve, reject) => {
    resolve(['to', 'do'])
});

const charadesWords = {

    init: async () => {
        if (words.length > 0) {
            return words;
        } else {
            words = await generateList();
            return words;
        }
    },
    
    length: async () => {
        const words = await charadesWords.init();
        return words.length;
    },

    get: async (index) => {
        const words = await charadesWords.init();
        return words[index];
    },

    random: async () => {
        const length = await charadesWords.length();
        return charadesWords.get(Math.floor(Math.random() * length));
    }
};

module.exports = charadesWords;
