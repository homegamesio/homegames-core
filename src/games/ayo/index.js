const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-138');
const { COLORS } = Colors;

class CoinFlip extends Game {
    static metadata() {
        return {
            squishVersion: '138',
            name: 'Coin Flip',
            author: 'Your Name',
            description: 'Click the coin to flip it! The winner is announced.',
            aspectRatio: { x: 16, y: 9 },
            //tickRate: 0
        };
    }

    constructor() {
        super();

        // --- Game state ---
        this.flipTimer = null;
        this.currentFlipState = ''; // Initial state (heads)
        this.winnerName = '';
        this.winningText = null;

        // --- Build the game world ---
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.HG_BLUE
        });

        // --- Coin (gold block) ---
        this.coin = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(50, 50, 30, 30),
            fill: COLORS.GOLD,
            onClick: (playerId) => this.handleCoinFlip(playerId)
        });

        // --- Flip button ---
        this.flipButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(30, 75, 40, 10),
            fill: COLORS.CANDY_RED,
            onClick: (playerId) => {
                this.handleFlipButton(playerId);
            }
        });

        // --- Winner text ---
        this.winningText = new GameNode.Text({
            textInfo: { text: 'ass and balls', x: 50, y: 12, size: 4, align: 'center', color: COLORS.WHITE }
        });

        // --- Add to scene ---
        this.base.addChildren(this.coin, this.flipButton, this.winningText);
    }

    handleCoinFlip(playerId) {
        console.log('bsbsbs');
        // Only allow flipping if the coin is not already in motion
        if (this.flipTimer !== null) return;

        this.handleFlipButton(playerId);
    }

    handleFlipButton(playerId) {

        console.log('bsbsbssfndjkfsd1111');
        // Randomly determine winner between heads and tails
        const random = Math.random();
        const newState = random < 0.5 ? 'heads' : 'tails';

        if (newState !== this.currentFlipState) {
            console.log('cool');
            this.winnerName = `Player ${playerId} wins!`;
            this.showWinner();

            // Reset after a short delay
            this.flipTimer = setTimeout(() => {
                this.resetGame();
            }, 2000);
        }
    }

    showWinner() {
        console.log('sdnjfkjg');
        console.log('dsfkjnsdf ' + this.winnerName);
        console.log(this.winningText.node.text);
        this.winningText.node.text = { ...this.winningText.node.text, text: this.winnerName };
        console.log(this.winningText.node.text);
        this.base.node.onStateChange();
    }

    resetGame() {
        clearTimeout(this.flipTimer);

        // Reset coin state
        this.currentFlipState = '';
        this.winningText.node.text = { ...this.winningText.node.text, text: '' };

        // Re-enable the flip button
        this.flipButton.node.fill = COLORS.CANDY_RED;

        this.base.node.onStateChange();
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = CoinFlip;
