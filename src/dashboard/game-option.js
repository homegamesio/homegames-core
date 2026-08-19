const path = require('path');
const { GameNode, Colors, ShapeUtils, Shapes } = require('squish-142');

const COLORS = Colors.COLORS;

// Site-matching card: white surface, thin charcoal border (homegames.io's
// outlined-button style), near-black name text.
const CARD_FILL = COLORS.WHITE;
const CARD_BORDER_COLOR = [77, 77, 77, 255]; // #4D4D4D
const NAME_COLOR = COLORS.ALMOST_BLACK;

// One game tile in the dashboard grid: a bordered card with the thumbnail
// filling most of it and the name in a strip along the bottom. The outer node
// spans the full grid cell (paging math reads its coordinates); the card is
// inset by a proportional gutter so the grid breathes at any page size.
const gameOption = ({ x, y, width, height, assetKey, gameName, onClick }) => {
    const gutterX = width * 0.05;
    const gutterY = height * 0.05;

    const cardX = x + gutterX;
    const cardY = y + gutterY;
    const cardW = width - (2 * gutterX);
    const cardH = height - (2 * gutterY);

    const node = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(x, y, width, height)
    });

    const card = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(cardX, cardY, cardW, cardH),
        fill: CARD_FILL,
        border: 2,
        color: CARD_BORDER_COLOR
    });

    const nameSize = Math.max(1.2, Math.min(1.8, width / 22));
    const nameStripH = Math.min(7, cardH * 0.2);
    const padX = cardW * 0.06;
    const padTop = cardH * 0.06;

    const thumbnail = new GameNode.Asset({
        coordinates2d: ShapeUtils.rectangle(
            cardX + padX,
            cardY + padTop,
            cardW - (2 * padX),
            cardH - padTop - nameStripH
        ),
        assetInfo: {
            [assetKey]: {
                pos: {
                    x: cardX + padX,
                    y: cardY + padTop
                },
                size: {
                    x: cardW - (2 * padX),
                    y: cardH - padTop - nameStripH
                }
            }
        }
    });

    // vertically center the name in the bottom strip (text height in y-units
    // is size * 16/9 at the dashboard's aspect ratio)
    const gameNameNode = new GameNode.Text({
        textInfo: {
            text: gameName,
            x: cardX + (cardW / 2),
            y: cardY + cardH - nameStripH + ((nameStripH - (nameSize * 16 / 9)) / 2),
            color: NAME_COLOR,
            align: 'center',
            size: nameSize
        }
    });

    // transparent click target over the card, added last so it sits on top
    const clickHandlerOverlay = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(cardX, cardY, cardW, cardH),
        onClick
    });

    node.addChildren(card, thumbnail, gameNameNode, clickHandlerOverlay);

    return node;
};

module.exports = gameOption;
