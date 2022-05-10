const { fork } = require('child_process');
const http = require('http');
const https = require('https');
const path = require('path');
// const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-0710');
const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squishjs');
console.log("WHATTTT AYO");

// console.log()
const unzipper = require('unzipper');
const fs = require('fs');

const COLORS = Colors.COLORS;

const closeSection = ({ onClose }) => {
	const closeButton = new GameNode.Shape({
            coordinates2d: ShapeUtils.rectangle(2.5, 2.5, 10, 10),
            fill: COLORS.HG_RED,
            shapeType: Shapes.POLYGON,
            onClick: onClose
        });

    const closeX = new GameNode.Text({
        textInfo: {
            x: 7.5,
            y: 4.5,
            text: 'X',
            align: 'center',
            color: [251, 255, 242, 255],
            size: 3
        }
    });

    closeButton.addChildren(closeX);

    return closeButton;
};

const thumbnailSection = ({ gameKey, gameMetadata }) => {
    const assetKey = gameMetadata.thumbnail ? gameKey : 'default';

    const thumbnail = new GameNode.Asset({
    	coordinates2d: ShapeUtils.rectangle(35, 5, 30, 30),
    	assetInfo: {
    		[assetKey]: {
    			pos: {
    				x: 35,
    				y: 5
    			},
    			size: {
    				x: 30,
    				y: 30
    			}
    		}
    	}
    });

    return thumbnail;
};

const infoSection = ({ gameKey, gameMetadata}) => {
	const infoContainer = new GameNode.Shape({
		shapeType: Shapes.POLYGON,
		coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
	});

    const thumbnail = thumbnailSection({ gameKey, gameMetadata });
    const title = new GameNode.Text({
    	textInfo: {
    		x: 50, 
    		y: 40,
    		align: 'center',
    		color: COLORS.HG_BLACK,
    		size: 3,
    		text: gameKey
    	}
    });

    infoContainer.addChildren(thumbnail, title);

    return infoContainer;
}

const gameModal = ({ gameMetadata, gameKey, onClose, playerId }) => {
		console.log('only player ' + playerId + ' can see modal');
        const modal = new GameNode.Shape({
            coordinates2d: ShapeUtils.rectangle(2.5, 2.5, 95, 95),
            fill: COLORS.HG_BLUE,
            shapeType: Shapes.POLYGON,
            playerIds: [playerId]
        });

        const close = closeSection({ onClose });

        const info = infoSection({ gameKey, gameMetadata });

        modal.addChildren(close, info);

        // const imgCoords = [27.5, 12.5, 45, 45];
        // const gameImage = new GameNode.Asset({
        //     coordinates2d:  ShapeUtils.rectangle(imgCoords[0], imgCoords[1], imgCoords[2], imgCoords[3]),
        //     assetInfo: {
        //         [assetKey]: {
        //             pos: {
        //                 x: imgCoords[0],
        //                 y: imgCoords[1]
        //             },
        //             size: {
        //                 x: imgCoords[2],
        //                 y: imgCoords[3]
        //             }
        //         }
        //     }
        // });

        // const gameName = new GameNode.Text({
        //     textInfo: {
        //         text: assetKey,
        //         x: 50,
        //         y: 5,
        //         color: COLORS.WHITE,
        //         size: 1.5,
        //         align: 'center'
        //     }
        // });

        // const author = new GameNode.Text({
        //     textInfo: {
        //         text: gameCollection[gameKey].metadata && gameCollection[gameKey].metadata().author || 'Unknown author',
        //         x: 50,
        //         y: 9,
        //         color: COLORS.ALMOST_BLACK,
        //         size: 0.9,
        //         align: 'center'
        //     }
        // });

        // const description = new GameNode.Text({
        //     textInfo: {
        //         x: 27.5,
        //         y: 65,
        //         text: gameCollection[gameKey].metadata && gameCollection[gameKey].metadata().description || 'No description available',
        //         align: 'left',
        //         size: 0.6,
        //         color: COLORS.WHITE
        //     }
        // });

        // const sessionText = new GameNode.Text({
        //     textInfo: {
        //         x: 15,
        //         y: 17.5,
        //         text: 'Join an existing session',
        //         color: COLORS.WHITE,
        //         align: 'center',
        //         size: 1.2
        //     }
        // });

        // let yIndex = 22.5;

        // let count = 0;
        // const sessionList = Object.values(this.sessions).filter(session => {
        //     return session.game === gameKey;
        // }).map(session => {
        //     const sessionNode = new GameNode.Shape({
        //         shapeType: Shapes.POLYGON,
        //         coordinates2d: ShapeUtils.rectangle(10, yIndex, 10, 8),
        //         fill: COLORS.GRAY,
        //         onClick: (player, x, y) => {
        //             this.joinSession(player, session);
        //         }
        //     });

        //     const sessionText = new GameNode.Text({
        //         textInfo: {
        //             x: 15,
        //             y: yIndex + 3,
        //             size: 0.8,
        //             color: COLORS.WHITE,
        //             align: 'center',
        //             text: `Session ${session.id}`
        //         }
        //     });

        //     yIndex += 10;
        //     sessionNode.addChild(sessionText);
        //     return sessionNode;
        // });

        // const createButton = new GameNode.Shape({
        //     fill: COLORS.COOL_GREEN,
        //     coordinates2d: ShapeUtils.rectangle(75, 22.5, 20, 15),
        //     shapeType: Shapes.POLYGON,
        //     onClick: () => {
        //         this.startSession(player, gameKey, versionKey);
        //     }
        // });

        // const createIcon = new GameNode.Text({
        //     textInfo: {
        //         color: COLORS.ALMOST_BLACK,
        //         x: 85, 
        //         y: 25,
        //         text: '\u1405',
        //         align: 'center',
        //         size: 5
        //     }
        // });

        // const createText = new GameNode.Text({
        //     textInfo: {
        //         x: 85,
        //         y: 17.5, 
        //         text: 'Create a session',
        //         color: COLORS.WHITE,
        //         size: 1.3,
        //         align: 'center'
        //     }
        // });

        // createButton.addChildren(createText, createIcon);


        // sessionList.forEach(sessionNode => modalBase.addChild(sessionNode));
        // modalBase.addChildren(closeButton, gameName, author, gameImage, description, sessionText, createButton);
	return modal;
}

module.exports = gameModal;
