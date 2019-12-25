const games = require('./games');

class Game {
    constructor(metadata) {
        console.log("i'm a game");
        this.metadata = metadata;
        console.log(this);
    }
}

//let game = new games.Draw({
//    author: 'Joseph Garcia',
//    thumbnail: 'ayy lmao',
//    res: {
//        width: 1280,
//        height: 720
//    }
//});
//
module.exports = Game;
