const { fork } = require('child_process');
const http = require('http');
const https = require('https');
const path = require('path');
const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-0740');

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
    const assetKey = gameMetadata.game.thumbnail ? gameKey : 'default';

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
    console.log('hhwe');

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
            text: gameMetadata?.game?.name || gameKey
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
};

const createSection = ({ gameKey, onCreateSession, onJoinSession, isVerified = false }) => {
    const createContainer = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(12.5, 67, 20, 20),
        fill: isVerified ? [160, 235, 93, 255] : COLORS.HG_YELLOW,
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

const versionSelector = ({ gameKey, currentVersion, onVersionChange, otherVersions }) => {

    const versionSelectorContainer = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
        fill: COLORS.HG_RED
    });

    const currentVersionText = new GameNode.Text({
        textInfo: {
            text: 'Version ' + currentVersion.version,
            x: 80,
            y: 12.5,
            color: COLORS.HG_BLACK,
            size: 2,
            align: 'center'
        }
    });

    const previousVersions = otherVersions.filter(v => v.version !== null && v.version < currentVersion.version).sort((a, b) => b.version - a.version);
    const subsequentVersions = otherVersions.filter(v => v.version !== null && v.version > currentVersion.version).sort((a, b) => a.version - b.version);

    if (previousVersions.length > 0) {
        const leftButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: COLORS.HG_BLUE,
            coordinates2d: ShapeUtils.rectangle(65, 10, 10, 10),
            onClick: () => onVersionChange(previousVersions[0].versionId)
        });

        const leftText = new GameNode.Text({
            textInfo: {
                text: '\u2190',
                x: 70,
                y: 10,
                color: COLORS.HG_BLACK,
                align: 'center',
                size: 4
            }
        });

        leftButton.addChildren(leftText);

        versionSelectorContainer.addChildren(leftButton);
    }

    if (subsequentVersions.length > 0) {
        const rightButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: COLORS.HG_BLUE,
            coordinates2d: ShapeUtils.rectangle(85, 10, 10, 10),
            onClick: () => onVersionChange(subsequentVersions[0].versionId)
        });

        const rightText = new GameNode.Text({
            textInfo: {
                text: '\u2192',
                x: 90,
                y: 10,
                color: COLORS.HG_BLACK,
                align: 'center',
                size: 4
            }
        });

        rightButton.addChildren(rightText);

        versionSelectorContainer.addChildren(rightButton);
    }

    versionSelectorContainer.addChildren(currentVersionText);

    return versionSelectorContainer;
    
};

const unverifiedGameVersionWarning = () => {
    const warningContainer = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(60, 60, 15, 15),
        fill: COLORS.HG_YELLOW
    });

    const warningText = new GameNode.Text({
        textInfo: {
            x: 60,
            y: 60,
            size: 1.2,
            color: COLORS.HG_BLACK,
            align: 'left',
            text: 'This game version has not yet been verified by Homegames administrators.'
        }
    });

    warningContainer.addChildren(warningText);

    return warningContainer;
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

                console.log('ayooo');
                console.log(pageContent);
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

        };

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
};

const gameModal = ({ 
    gameMetadata, 
    gameKey, 
    versionId, 
    onClose, 
    activeSessions, 
    onCreateSession, 
    onJoinSession, 
    playerId, 
    onVersionChange,
    versions = [] 
}) => {
    const modal = new GameNode.Shape({
        coordinates2d: ShapeUtils.rectangle(2.5, 2.5, 95, 95),
        fill: COLORS.HG_BLUE,
        shapeType: Shapes.POLYGON,
        playerIds: [playerId]
    });

    const thisVersion = versions.filter(version => version.versionId === versionId)[0];
    const otherVersions = versions.filter(version => version.versionId !== versionId);

    const close = closeSection({ playerId, onClose });

    const info = infoSection({ gameKey, gameMetadata });

    const isVerified = thisVersion.version >= 0;

    const create = createSection({ gameKey, onCreateSession, isVerified });

    const join = joinSection({ gameKey, activeSessions, onJoinSession });
    modal.addChildren(close, info, create, join);

    if (thisVersion.version > 0) {
        const selector = versionSelector({ gameKey, currentVersion: thisVersion, onVersionChange, otherVersions });
        modal.addChild(selector);
    }

    return modal;
};

module.exports = gameModal;
