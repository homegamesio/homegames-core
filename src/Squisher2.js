class Squisher {
    constructor(root) {
        console.log("I am squisher 2");
        console.log(root);
        this.stuff = this.squish(root);
    }

    squish(node) {
        return [420];
    }

    getStuff() {
        return this.stuff;
    }
}

module.exports = Squisher;
