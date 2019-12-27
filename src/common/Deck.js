class Card {
    constructor(suit, value) {
        this.suit = suit;
        this.value = value;

        const specialCards = new Map([
            [1, "Ace"],
            [11, "Jack"],
            [12, "Queen"],
            [13, "King"],
        ]);

        this.name = (specialCards.get(value) ? specialCards.get(value) : value.toString());
    }

    toString() {
        return this.name + " of " + this.suit;
    }

}

class Deck {
    constructor() {
        const suits = ["Clubs", "Diamonds", "Hearts", "Spades"];

        const cardsInDeck = [];
        for (var i = 0; i < suits.length; i++) {
            for(var j = 1; j <= 13; j++) {
                cardsInDeck.push(new Card(suits[i],j));
            }
        }
        this.activeDeck = cardsInDeck;
    }

    shuffle() {
        for (var shuffleCount = 0; shuffleCount < 100; shuffleCount++){
            for (var i = 0; i < this.activeDeck.length; i++) {
                const randomCardInd = Math.floor(Math.random() * Math.floor(this.activeDeck.length));
                const tmp = this.activeDeck[i];
                this.activeDeck[i] = this.activeDeck[randomCardInd];
                this.activeDeck[randomCardInd] = tmp;
            }
        }
    }

    drawCard() {
        return this.activeDeck.pop();
    }

}

module.exports = Deck;
