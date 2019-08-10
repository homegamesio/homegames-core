const https = require("https");
const fs = require("fs");
const generateList = async () => new Promise((resolve, reject) => {
    let wordList = [];
    if (fs.existsSync("../dictionary.json")) {
        wordList = fs.readFileSync("../dictionary.json");
        resolve(JSON.parse(wordList));
    } else {
        https.get("https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt", (res) => {
            res.on("data", (d) => {
                wordList = [ ...wordList, ...d.toString().split(/\r?\n/)];
            });
            res.on("end", () => {
                fs.writeFile("../dictionary.json", JSON.stringify(wordList), (err) => {
                    if (err) console.log(err);
                });
                resolve(wordList);
            });
        }).on("error", error => {
            reject(error);
        });
    }
});
module.exports = generateList;
