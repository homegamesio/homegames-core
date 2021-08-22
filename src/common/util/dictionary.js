const https = require('https');
const path = require('path');
const fs = require('fs');

let words = [];

const generateList = async () => new Promise((resolve, reject) => {
    resolve(['to', 'do']);
});

const dictionary = {

    init: async () => {
        if (words.length > 0) {
            return words;
        } else {
            words = await generateList();
            return words;
        }
    },
    
    length: async () => {
        const words = await dictionary.init();
        return words.length;
    },

    get: async (index) => {
        const words = await dictionary.init();
        return words[index];
    },

    random: async () => {
        const length = await dictionary.length();
        return dictionary.get(Math.floor(Math.random() * length));
    }
};

module.exports = dictionary;
