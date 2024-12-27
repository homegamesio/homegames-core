const { fork } = require('child_process');
const http = require('http');
const https = require('https');
const path = require('path');
const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-113');

const fs = require('fs');

const COLORS = Colors.COLORS;

const formatDate = (ting) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[ting.getMonth()]} ${ting.getDate()}, ${ting.getFullYear()}`;
};

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
    const assetKey = gameMetadata?.thumbnail ? gameKey : 'default';
    console.log("GAME KEY " + gameKey); 
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


const metadataSection = ({ gameKey, gameMetadata}) => {
    const section = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
    });

    const maxPlayers = new GameNode.Text({
        textInfo: {
            x: 10, 
            y: 20,
            align: 'left',
            color: COLORS.HG_BLACK,
            size: 1.5,
            text: 'Max players: ' + (gameMetadata?.maxPlayers || 'N/A')
        }
    });

    section.addChildren(maxPlayers)

    return section;
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
            y: 36.5,
            align: 'center',
            color: COLORS.HG_BLACK,
            size: 2.5,
            text: gameMetadata?.name || gameKey
        }
    });

    console.log('gigiiggi');
    console.log(gameMetadata);

    const author = new GameNode.Text({
        textInfo: {
            x: 50, 
            y: 43.5,
            align: 'center',
            color: COLORS.HG_BLACK,
            size: 1.5,
            text: `By ${gameMetadata?.author || 'Unknown author'}`
        }
    });

    const descriptionText = new GameNode.Text({
        textInfo: {
            x: 50, 
            y: 50.5,
            align: 'center',
            color: COLORS.HG_BLACK,
            size: 1.2,
            text: gameMetadata.description || 'No description available'
        }
    });

    infoContainer.addChildren(thumbnail, title, author, descriptionText);

    return infoContainer;
};

const createSection = ({ gameKey, onCreateSession, approved = false }) => {
    const createContainer = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(8, 67, 20, 20),
        fill: approved ? [160, 235, 93, 255] : COLORS.HG_YELLOW,
        onClick: onCreateSession
    });

    const createText = new GameNode.Text({
        textInfo: {
            x: 10,
            y: 75,
            align: 'left',
            size: 1.2,
            color: COLORS.HG_BLACK,
            text: 'Create a new session'
        }
    });

    createContainer.addChildren(createText);

    if (!approved) {
        const warningContainer = new GameNode.Shape({
            fill: COLORS.HG_RED,
            coordinates2d: ShapeUtils.rectangle(30, 87.5, 40, 10),
            shapeType: Shapes.POLYGON
        });

        const warningTextHead = new GameNode.Text({
            textInfo: {
                text: 'This game version has not been reviewed',
                x: 50,
                y: 88.5,
                align: 'center',
                size: 1.2,
                color: COLORS.WHITE
            }
        });

        const warningTextSub = new GameNode.Text({
            textInfo: {
                text: 'Only play games from sources you trust.',
                x: 50,
                y: 93.5,
                align: 'center',
                size: 1,
                color: COLORS.WHITE
            }
        });

        warningContainer.addChildren(warningTextHead, warningTextSub);

        createContainer.addChildren(warningContainer);
    }

    return createContainer;
};

const versionSelector = ({ gameKey, currentVersion, onVersionChange, otherVersions }) => {

    const versionSelectorContainer = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
        fill: COLORS.HG_RED
    });

    const publishedDateVal = currentVersion.published || currentVersion.metadata?.published;
    const publishedDate = new Date(publishedDateVal);
    const currentVersionText = new GameNode.Text({
        textInfo: {
            text: publishedDateVal ? `Published ${formatDate(publishedDate)}` : 'Local game' ,
            x: 80,
            y: 12.5,
            color: COLORS.HG_BLACK,
            size: 1.4,
            align: 'center'
        }
    });

    const previousVersions = otherVersions.filter(v => v.published !== null && v.published < currentVersion.published).sort((a, b) => b.published - a.published);
    const subsequentVersions = otherVersions.filter(v => v.published !== null && v.published > currentVersion.published).sort((a, b) => a.published - b.published);

    if (previousVersions.length > 0) {
        const leftButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: COLORS.HG_BLUE,
            coordinates2d: ShapeUtils.rectangle(65, 15, 10, 10),
            onClick: () => onVersionChange(previousVersions[0].metadata.versionId)
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
            coordinates2d: ShapeUtils.rectangle(85, 15, 10, 10),
            onClick: () => onVersionChange(subsequentVersions[0].metadata.versionId)
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

const joinSection = ({ gameKey, gameMetadata, activeSessions, onJoinSession, page = 0, pageSize = 2 }) => {
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
                pageContent[i].getPlayers(players => {

                    const gameFull = gameMetadata?.maxPlayers && players.length >= gameMetadata.maxPlayers;

                    const optionWrapper = new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        coordinates2d: ShapeUtils.rectangle(60, startingY + (10 * i), 30, 8),
                        fill: gameFull ? COLORS.GRAY : COLORS.WHITE,
                        onClick: gameFull ? null : () => onJoinSession(pageContent[i])
                    });

                    const sessionPlayerCount = activeSessions.filter(s => s.id === pageContent[i].id).length;

                    const playerText = gameMetadata?.maxPlayers ? `${players.length} / ${gameMetadata.maxPlayers} ${gameMetadata.maxPlayers > 1 ? 'players' : 'player'}` : `${players.length} ${players.length > 1 ? 'players' : 'player'}`
                    const optionText = new GameNode.Text({
                        textInfo: {
                            x: 61,
                            y: startingY + (10 * i) + 3,
                            align: 'left',
                            size: 1,
                            color: COLORS.HG_BLACK,
                            text: `Session ${pageContent[i].id} - ${playerText}`
                        }
                    });

                    optionWrapper.addChildren(optionText);

                    pageContainer.addChildren(optionWrapper);

                });
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

    const thisVersion = versions.filter(version => version.id === versionId)[0];

    const otherVersions = versions.filter(version => version.id !== versionId);

    const close = closeSection({ playerId, onClose });

    const info = infoSection({ gameKey, gameMetadata });

    const metadata = metadataSection({ gameKey, gameMetadata });

    console.log("VERSIONS?");
    console.log(versionId);
    console.log(versions);
    console.log(thisVersion);
    console.log("OTHER VERISON");
    console.log(otherVersions);

    const approved = thisVersion.approved;

    const create = createSection({ gameKey, onCreateSession, approved });

    const join = joinSection({ gameKey, gameMetadata, activeSessions, onJoinSession });
    modal.addChildren(close, info, metadata, create, join);

    if (versionId !== 'local-game-version') {   
        const selector = versionSelector({ gameKey, currentVersion: thisVersion, onVersionChange, otherVersions });
        modal.addChild(selector);
    }

    return modal;
};

module.exports = gameModal;
