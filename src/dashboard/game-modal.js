const { fork } = require('child_process');
const http = require('http');
const https = require('https');
const path = require('path');
const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-0730');

const unzipper = require('unzipper');
const fs = require('fs');

const COLORS = Colors.COLORS;

const closeSection = ({ onClose, playerId }) => {
	const closeButton = new GameNode.Shape({
            coordinates2d: ShapeUtils.rectangle(2.5, 2.5, 10, 10),
            fill: COLORS.HG_RED,
            shapeType: Shapes.POLYGON,
            onClick: onClose,
            playerIds: [playerId]
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
    		size: 2.5,
    		text: gameKey
    	}
    });

    const descriptionText = new GameNode.Text({
    	textInfo: {
    		x: 50, 
    		y: 50,
    		align: 'center',
    		color: COLORS.HG_BLACK,
    		size: 1.2,
    		text: gameMetadata.description || 'No description available'
    	}
    });

    infoContainer.addChildren(thumbnail, title, descriptionText);

    return infoContainer;
}

const createSection = ({ gameKey, onCreateSession, onJoinSession }) => {
	const createContainer = new GameNode.Shape({
		shapeType: Shapes.POLYGON,
		coordinates2d: ShapeUtils.rectangle(12.5, 67, 20, 20),
		fill: [160, 235, 93, 255],
		onClick: onCreateSession
	});

	const createText = new GameNode.Text({
		textInfo: {
			x: 22.5,
			y: 61,
			align: 'center',
			size: 1.1,
			color: COLORS.HG_BLACK,
			text: 'Create a new session'
		}
	});

	const playIcon = new GameNode.Text({
		textInfo: {
			text: '\u25B8',
			x: 22.5,
			y: 70,
			size: 6,
			align: 'center',
			color: COLORS.HG_BLACK
		}
	});

	createContainer.addChildren(createText, playIcon);

	return createContainer;
};

const joinSection = ({ gameKey, activeSessions, onJoinSession, page = 0, pageSize = 2 }) => {
	const joinContainer = new GameNode.Shape({
		shapeType: Shapes.POLYGON,
		coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
	});

	let pageNodeId;
	let currentPage = page;

	if (activeSessions.length) {
		const renderPage = (pageContent) => {

			const pageContainer = new GameNode.Shape({
				shapeType: Shapes.POLYGON,
				coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
			});

			if (pageNodeId) {
				joinContainer.removeChild(pageNodeId);
			}
			
			pageNodeId = pageContainer.node.id;

			const joinText = new GameNode.Text({
				textInfo: {
					x: 75,
					y: 61,
					align: 'center',
					size: 1.1,
					color: COLORS.HG_BLACK,
					text: 'Join an existing session'
				}
			});

			pageContainer.addChildren(joinText);

			const startingY = 67;
			for (let i = 0; i < pageContent.length; i++) {
				const optionWrapper = new GameNode.Shape({
					shapeType: Shapes.POLYGON,
					coordinates2d: ShapeUtils.rectangle(60, startingY + (10 * i), 30, 8),
					fill: COLORS.WHITE,
					onClick: () => onJoinSession(pageContent[i])
				});

				const optionText = new GameNode.Text({
					textInfo: {
						x: 61,
						y: startingY + (10 * i) + 3,
						align: 'left',
						size: 1,
						color: COLORS.HG_BLACK,
						text: `Session ${pageContent[i].id} - ${pageContent[i].players.length} players`
					}
				});

				optionWrapper.addChildren(optionText);

				pageContainer.addChildren(optionWrapper);
			}

			if (currentPage > 0) {
				const pageLeft = new GameNode.Shape({
					shapeType: Shapes.POLYGON,
					fill: COLORS.HG_BLUE,
					coordinates2d: ShapeUtils.rectangle(65, 86, 5, 5),
					onClick: () => {

						currentPage--;
						const sessionsPage = activeSessions.slice(currentPage * pageSize, (currentPage * pageSize) + pageSize);
						renderPage(sessionsPage);
					}
				});

				const pageLeftIcon = new GameNode.Text({
					textInfo: {
						x: 67.5,
						y: 86.5,
						align: 'center',
						text: '\u2190',
						color: COLORS.HG_BLACK,
						size: 2
					}
				});

				pageLeft.addChildren(pageLeftIcon);

				pageContainer.addChildren(pageLeft);
			} 

			if ((currentPage + 1) * pageSize < activeSessions.length) {
				const pageRight = new GameNode.Shape({
					shapeType: Shapes.POLYGON,
					fill: COLORS.HG_BLUE,
					coordinates2d: ShapeUtils.rectangle(80, 86, 5, 5),
					onClick: () => {
						currentPage++;
						const sessionsPage = activeSessions.slice(currentPage * pageSize, (currentPage * pageSize) + pageSize);
						renderPage(sessionsPage);
					}
				});

				const pageRightIcon = new GameNode.Text({
					textInfo: {
						x: 82.5,
						y: 86.5,
						align: 'center',
						text: '\u2192',
						color: COLORS.HG_BLACK,
						size: 2
					}
				});

				pageRight.addChildren(pageRightIcon);

				pageContainer.addChildren(pageRight);

			}

			const totalPages = Math.ceil(activeSessions.length / pageSize);

			const currentPageText = `Page ${currentPage + 1} of ${totalPages}`;

			const currentPageNode = new GameNode.Text({
				textInfo: {
					text: currentPageText,
					x: 75, 
					y: 88,
					align: 'center',
					size: 1,
					color: COLORS.HG_BLACK
				}
			});

			pageContainer.addChildren(currentPageNode);
			joinContainer.addChild(pageContainer);

		}

		const sessionsPage = activeSessions.slice(currentPage * pageSize, (currentPage * pageSize) + pageSize);
		renderPage(sessionsPage);
	} else {
		const noSessions = new GameNode.Text({
			textInfo: {
				x: 75,
				y: 75,
				text: 'No active sessions',
				size: 1.5,
				align: 'center',
				color: COLORS.HG_BLACK
			}
		});
		joinContainer.addChildren(noSessions);
	}

	return joinContainer;
}

const gameModal = ({ gameMetadata, gameKey, onClose, activeSessions, onCreateSession, onJoinSession, playerId }) => {
        const modal = new GameNode.Shape({
            coordinates2d: ShapeUtils.rectangle(2.5, 2.5, 95, 95),
            fill: COLORS.HG_BLUE,
            shapeType: Shapes.POLYGON,
            playerIds: [playerId]
        });

        const close = closeSection({ playerId, onClose });

        const info = infoSection({ gameKey, gameMetadata });

        const create = createSection({ gameKey, onCreateSession });

        const join = joinSection({ gameKey, activeSessions, onJoinSession })

        modal.addChildren(close, info, create, join);

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
