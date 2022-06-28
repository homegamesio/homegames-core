const { fork } = require('child_process');
const http = require('http');
const https = require('https');
const path = require('path');
const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-0755');

const unzipper = require('unzipper');
const fs = require('fs');
const gameModal = require('./game-modal');

const COLORS = Colors.COLORS;

const Asset = require('../common/Asset');

const { ExpiringSet, animations } = require('../common/util');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const gameOption = ({ x, y, width, height, assetKey, gameName, onClick }) => {

    const optionXMargin = 6;
    const optionYMargin = 6;

    const node = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(x, y, width, height)
    });

    const clickHandlerOverlay = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(x, y, width, height),
        onClick
    });

    const gameOption = new GameNode.Asset({
        coordinates2d:  ShapeUtils.rectangle(
            x + optionXMargin,
            y + optionYMargin,
            width - 2 * optionXMargin,
            height - 2 * optionYMargin
        ),
        assetInfo: {
            [assetKey]: {
                pos: {
                    x: x + optionXMargin,
                    y: y + optionYMargin
                },
                size: {
                    x: width - 2 * optionXMargin,
                    y: height - 2 * optionYMargin
                }
            }
        }
    });

    const gameNameNode = new GameNode.Text({
        textInfo: {
            text: gameName,
            x: x + (width / 2),
            y: y + optionYMargin + (height - 2 * optionYMargin) + 1,
            color: COLORS.ALMOST_BLACK,
            align: 'center',
            size: 1.6
        }
    });

    node.addChildren(gameOption, clickHandlerOverlay, gameNameNode);

    return node;
};

module.exports = gameOption;