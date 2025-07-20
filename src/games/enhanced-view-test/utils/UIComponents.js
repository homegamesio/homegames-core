const { GameNode, Shapes, ShapeUtils } = require('squish-136');

class UIComponents {
    /**
     * Create a button with text
     * @param {Object} config - Button configuration
     * @param {Array} config.rect - [x, y, width, height]
     * @param {Array} config.fillColor - RGBA color array
     * @param {string} config.text - Button text
     * @param {number} config.textSize - Text size
     * @param {Array} config.textColor - Text color array
     * @param {Function} config.onClick - Click handler
     * @param {Array} config.playerIds - Player IDs array
     * @returns {Array} [buttonNode, textNode] - Both nodes to add to parent
     */
    static createButton({
        rect: [x, y, width, height],
        fillColor,
        text,
        textSize = 2,
        textColor = [255, 255, 255, 255],
        onClick,
        playerIds = undefined
    }) {
        const button = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, width, height),
            fill: fillColor,
            onClick,
            ...(playerIds && { playerIds })
        });

        const buttonText = new GameNode.Text({
            textInfo: {
                x: x + width / 2,
                y: y + height / 2,
                color: textColor,
                text,
                align: 'center',
                size: textSize
            },
            ...(playerIds && { playerIds })
        });

        return [button, buttonText];
    }

    /**
     * Create increment/decrement controls
     * @param {Object} config - Control configuration
     * @param {string} config.label - Label text
     * @param {number} config.value - Current value
     * @param {number} config.x - X position
     * @param {number} config.y - Y position
     * @param {Function} config.onIncrement - Increment handler
     * @param {Function} config.onDecrement - Decrement handler
     * @param {Array} config.playerIds - Player IDs array
     * @returns {Array} Array of nodes to add to parent
     */
    static createIncrementControl({
        label,
        value,
        x,
        y,
        onIncrement,
        onDecrement,
        playerIds = undefined
    }) {
        const elements = [];

        // Label
        elements.push(new GameNode.Text({
            textInfo: {
                x: x - 25,
                y: y,
                color: [255, 255, 255, 255],
                text: `${label}:`,
                align: 'center',
                size: 2
            },
            ...(playerIds && { playerIds })
        }));

        // Minus button
        const [minusButton, minusText] = this.createButton({
            rect: [x - 15, y + 7, 8, 8],
            fillColor: [200, 0, 0, 255],
            text: '-',
            textSize: 3,
            onClick: onDecrement,
            playerIds
        });
        elements.push(minusButton, minusText);

        // Value display
        elements.push(new GameNode.Text({
            textInfo: {
                x: x,
                y: y + 11,
                color: [255, 255, 255, 255],
                text: value.toString(),
                align: 'center',
                size: 3
            },
            ...(playerIds && { playerIds })
        }));

        // Plus button
        const [plusButton, plusText] = this.createButton({
            rect: [x + 27, y + 7, 8, 8],
            fillColor: [0, 200, 0, 255],
            text: '+',
            textSize: 3,
            onClick: onIncrement,
            playerIds
        });
        elements.push(plusButton, plusText);

        return elements;
    }

    /**
     * Create a centered title
     */
    static createTitle(text, y = 15, size = 4, color = [255, 255, 255, 255], playerIds = undefined) {
        return new GameNode.Text({
            textInfo: {
                x: 50,
                y,
                color,
                text,
                align: 'center',
                size
            },
            ...(playerIds && { playerIds })
        });
    }

    /**
     * Create a full-screen background
     */
    static createBackground(color = [40, 40, 40, 255], playerIds = undefined) {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: color,
            ...(playerIds && { playerIds })
        });
    }
}

module.exports = UIComponents; 