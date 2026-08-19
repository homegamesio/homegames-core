const { fork } = require('child_process');
const http = require('http');
const https = require('https');
const path = require('path');
const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-142');

const fs = require('fs');

const COLORS = Colors.COLORS;

// Modal palette — the homegames.io modal treatment (app.css #modal): charcoal
// panel with white text, butter-yellow primary buttons, coral accents.
const PANEL_COLOR = [77, 77, 77, 255];        // #4D4D4D
const PANEL_BORDER_COLOR = [26, 26, 26, 255]; // site's dark border tone
const CORAL_COLOR = [241, 112, 111, 255];
const BUTTER_COLOR = [255, 247, 142, 255];
const PANEL_TEXT_COLOR = COLORS.WHITE;
const MUTED_TEXT_COLOR = [206, 209, 200, 255]; // light gray-green on charcoal

// Vertically center a text of `size` in a bar at (barY, barH) — text height in
// y-units is size * 16/9 at the dashboard's aspect ratio.
const centerTextY = (barY, barH, size) => barY + ((barH - (size * 16 / 9)) / 2);

const formatDate = (ting) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[ting.getMonth()]} ${ting.getDate()}, ${ting.getFullYear()}`;
};

// Format an arbitrary created/published value (ms timestamp, ISO string, Date)
// for display, tolerating null/undefined and unparseable values.
const formatDateValue = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return null;
    return formatDate(date);
};

const closeSection = ({ onClose, playerId }) => {
    // Compact close affordance in the modal's top-right corner.
    const closeButton = new GameNode.Shape({
        coordinates2d: ShapeUtils.rectangle(88, 6.5, 5.5, 6),
        fill: [0, 0, 0, 0],
        shapeType: Shapes.POLYGON,
        onClick: onClose,
        playerIds: [playerId]
    });

    const closeX = new GameNode.Text({
        textInfo: {
            x: 90.75,
            y: centerTextY(6.5, 6, 1.8),
            text: '✕',
            align: 'center',
            color: CORAL_COLOR,
            size: 1.8
        }
    });

    closeButton.addChildren(closeX);

    return closeButton;
};

const thumbnailSection = ({ gameKey, gameMetadata }) => {
    const assetKey = gameMetadata?.thumbnail ? gameKey : 'default';
    const thumbnail = new GameNode.Asset({
        coordinates2d: ShapeUtils.rectangle(36, 8, 28, 25),
        assetInfo: {
            [assetKey]: {
                pos: {
                    x: 36,
                    y: 8
                },
                size: {
                    x: 28,
                    y: 25
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
            x: 50,
            y: 55,
            align: 'center',
            color: MUTED_TEXT_COLOR,
            size: 1.1,
            text: 'Max players: ' + (gameMetadata?.maxPlayers || 'N/A')
        }
    });

    const createdDate = formatDateValue(gameMetadata?.created);
    const created = new GameNode.Text({
        textInfo: {
            x: 50,
            y: 58.5,
            align: 'center',
            color: MUTED_TEXT_COLOR,
            size: 1.1,
            text: 'Created: ' + (createdDate || 'N/A')
        }
    });

    section.addChildren(maxPlayers, created);

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
            color: PANEL_TEXT_COLOR,
            size: 2.4,
            text: gameMetadata?.name || gameKey
        }
    });

    const author = new GameNode.Text({
        textInfo: {
            x: 50,
            y: 43,
            align: 'center',
            color: MUTED_TEXT_COLOR,
            size: 1.3,
            text: `By ${gameMetadata?.author || 'Unknown author'}`
        }
    });

    const descriptionText = new GameNode.Text({
        textInfo: {
            x: 50,
            y: 48.5,
            align: 'center',
            color: PANEL_TEXT_COLOR,
            size: 1.2,
            text: gameMetadata.description || 'No description available'
        }
    });

    infoContainer.addChildren(thumbnail, title, author, descriptionText);

    return infoContainer;
};

const createSection = ({ gameKey, onCreateSession, approved = false }) => {
    // Slim primary action button; the whole rect is the tap target.
    const createContainer = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(10, 68, 26, 9),
        fill: BUTTER_COLOR,
        border: 2,
        color: PANEL_BORDER_COLOR,
        onClick: onCreateSession
    });

    const createText = new GameNode.Text({
        textInfo: {
            x: 23,
            y: centerTextY(68, 9, 1.3),
            align: 'center',
            size: 1.3,
            color: COLORS.ALMOST_BLACK,
            text: 'Create a new session'
        }
    });

    createContainer.addChildren(createText);

    if (!approved) {
        // Unreviewed-version warning: quiet red text under the button instead
        // of a shouting red block.
        const warningTextHead = new GameNode.Text({
            textInfo: {
                text: 'This game version has not been reviewed',
                x: 23,
                y: 79.5,
                align: 'center',
                size: 1.05,
                color: CORAL_COLOR
            }
        });

        const warningTextSub = new GameNode.Text({
            textInfo: {
                text: 'Only play games from sources you trust.',
                x: 23,
                y: 83,
                align: 'center',
                size: 0.95,
                color: CORAL_COLOR
            }
        });

        createContainer.addChildren(warningTextHead, warningTextSub);
    }

    return createContainer;
};

const versionSelector = ({ gameKey, currentVersion, onVersionChange, otherVersions }) => {

    const versionSelectorContainer = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
    });

    const publishedDateVal = currentVersion.published || currentVersion.metadata?.published;
    const publishedDate = new Date(publishedDateVal);
    const currentVersionText = new GameNode.Text({
        textInfo: {
            text: publishedDateVal ? `Published ${formatDate(publishedDate)}` : 'Local game' ,
            x: 76,
            y: 10.5,
            color: MUTED_TEXT_COLOR,
            size: 1.2,
            align: 'center'
        }
    });

    const previousVersions = otherVersions.filter(v => v.published !== null && v.published < currentVersion.published).sort((a, b) => b.published - a.published);
    const subsequentVersions = otherVersions.filter(v => v.published !== null && v.published > currentVersion.published).sort((a, b) => a.published - b.published);

    if (previousVersions.length > 0) {
        const leftButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: BUTTER_COLOR,
            border: 2,
            color: PANEL_BORDER_COLOR,
            coordinates2d: ShapeUtils.rectangle(66, 14, 6, 6),
            onClick: () => onVersionChange(previousVersions[0].metadata.versionId)
        });

        const leftText = new GameNode.Text({
            textInfo: {
                text: '\u2190',
                x: 69,
                y: centerTextY(14, 6, 1.6),
                color: COLORS.ALMOST_BLACK,
                align: 'center',
                size: 1.6
            }
        });

        leftButton.addChildren(leftText);

        versionSelectorContainer.addChildren(leftButton);
    }

    if (subsequentVersions.length > 0) {
        const rightButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: BUTTER_COLOR,
            border: 2,
            color: PANEL_BORDER_COLOR,
            coordinates2d: ShapeUtils.rectangle(80, 14, 6, 6),
            onClick: () => onVersionChange(subsequentVersions[0].metadata.versionId)
        });

        const rightText = new GameNode.Text({
            textInfo: {
                text: '\u2192',
                x: 83,
                y: centerTextY(14, 6, 1.6),
                color: COLORS.ALMOST_BLACK,
                align: 'center',
                size: 1.6
            }
        });

        rightButton.addChildren(rightText);

        versionSelectorContainer.addChildren(rightButton);
    }

    versionSelectorContainer.addChildren(currentVersionText);

    return versionSelectorContainer;
    
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
                    color: PANEL_TEXT_COLOR,
                    text: 'Join an existing session'
                }
            });

            pageContainer.addChildren(joinText);

            const startingY = 67;
            for (let i = 0; i < pageContent.length; i++) {
                pageContent[i].getPlayers((_players) => {
                    const players = _players || [];
                    const gameFull = gameMetadata?.maxPlayers && players.length >= gameMetadata.maxPlayers;

                    const optionWrapper = new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        coordinates2d: ShapeUtils.rectangle(60, startingY + (10 * i), 30, 8),
                        fill: gameFull ? COLORS.GRAY : COLORS.WHITE,
                        border: 2,
                        color: PANEL_BORDER_COLOR,
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
                    fill: BUTTER_COLOR,
                    border: 2,
                    color: PANEL_BORDER_COLOR,
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
                    fill: BUTTER_COLOR,
                    border: 2,
                    color: PANEL_BORDER_COLOR,
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
                    color: MUTED_TEXT_COLOR
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
                color: MUTED_TEXT_COLOR
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
        coordinates2d: ShapeUtils.rectangle(5, 5, 90, 90),
        fill: PANEL_COLOR,
        border: 2,
        color: PANEL_BORDER_COLOR,
        shapeType: Shapes.POLYGON,
        playerIds: [playerId]
    });

    const thisVersion = versions.filter(version => version.id === versionId)[0];

    const otherVersions = versions.filter(version => version.id !== versionId);

    const close = closeSection({ playerId, onClose });

    const info = infoSection({ gameKey, gameMetadata });

    const metadata = metadataSection({ gameKey, gameMetadata });

    const approved = thisVersion ? thisVersion.approved : false;

    const create = createSection({ gameKey, onCreateSession, approved });

    const join = joinSection({ gameKey, gameMetadata, activeSessions, onJoinSession });
    modal.addChildren(close, info, metadata, create, join);

    if (versionId !== 'local-game-version' && thisVersion) {
        const selector = versionSelector({ gameKey, currentVersion: thisVersion, onVersionChange, otherVersions });
        modal.addChild(selector);
    }

    return modal;
};

module.exports = gameModal;
