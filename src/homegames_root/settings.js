const { GameNode, Colors, ShapeUtils, Shapes } = require(process.env.SQUISH_PATH);
const HomenamesHelper = require('../util/homenames-helper');
const { COLORS } = Colors;
const PLAYER_SETTINGS = require('../common/player-settings');

const sessionInfoContainer = ({ playerId, session, playerInfo }) => {
    
    const sessionPlayerInfoHeight = 55;

    // this is a hack lol
    const homenamesHelper = session.homenamesHelper;
    
    const sessionInfoContainer = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(53.5, 30, 30, sessionPlayerInfoHeight),
        playerIds: [playerId]
    });

    const spectatorCountText = new GameNode.Text({
        textInfo: {
            x: 74,
            y: 17,
            text: 'Spectators: ' + Object.keys(session.spectators).length,
            align: 'left',
            size: 1,
            color: COLORS.HG_BLACK
        },
        playerIds: [playerId]
    })

    const playerHeight = sessionPlayerInfoHeight / 12;

    const playersHeader = new GameNode.Text({
        textInfo: {
            text: 'Players',
            size: 1.4,
            color: COLORS.HG_BLACK,
            x: 62.5,
            y: 25,
            align: 'left'
        },
        playerIds: [playerId]
    });

    sessionInfoContainer.addChild(playersHeader);

    for (let [index, key] of Object.keys(session.players).entries()) {
        // todo: optimize this

        homenamesHelper.getPlayerInfo(key).then(playerInfo => {
            const playerName = new GameNode.Text({
                textInfo: {
                    text: playerInfo.name || 'Unknown',
                    x: 62.5,
                    y: 1.025 * (30 + (playerHeight * index)),
                    color: COLORS.HG_BLACK,
                    size: 1.1,
                    align: 'left',
                },
                playerIds: [playerId]
            });

            sessionInfoContainer.addChild(playerName);
        });
    }
    if (Object.keys(session.spectators).length > 0) {
        sessionInfoContainer.addChild(spectatorCountText);
    }

    const gameName = session.gameMetadata && session.gameMetadata.name || session.game.constructor.name;
    const squishVersion = session.gameMetadata && session.gameMetadata.squishVersion || 'Unknown';

    const gameNameText = new GameNode.Text({
        textInfo: {
            x: 23,
            y: 70,
            text: 'Current game: ' + gameName,
            align: 'left',
            size: 0.8,
            color: COLORS.HG_BLACK
        },
        playerIds: [playerId]
    });

    const authorText = new GameNode.Text({
        textInfo: {
            x: 23,
            y: 74,
            text: 'Author: ' + session.gameMetadata?.author,
            align: 'left',
            size: 0.8,
            color: COLORS.HG_BLACK
        },
        playerIds: [playerId]
    });

    const squishVersionText = new GameNode.Text({
        textInfo: {
            x: 23,
            y: 78,
            text: 'Squish version: ' + squishVersion,
            align: 'left',
            size: 0.8,
            color: COLORS.HG_BLACK
        },
        playerIds: [playerId]
    });

    sessionInfoContainer.addChildren(gameNameText, authorText, squishVersionText);

    return sessionInfoContainer;
}

const nameSettingContainer = ({ playerId, onNameChange, session }) => {

    const nameSettingContainerHeight = 16;
    const nameSettingContainerWidth = 35;

    let nameText;

    const container = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(23, 23, 30, 6),
        input: {
            type: 'text',
            oninput: (player, text) => {
                if (text) {
                    if (onNameChange) {
                        onNameChange(text).then(() => {
                            if (nameText) {
                                const curText = Object.assign({}, nameText.node.text);
                                curText.text = `Name: ${text}`;
                                nameText.node.text = curText;
                                nameText.node.onStateChange();
                            }
                        });
                    }
                }
            }
        }
    });

    const homenamesHelper = session.homenamesHelper;

    homenamesHelper.getPlayerInfo(playerId).then(playerInfo => {
        nameText = new GameNode.Text({
            textInfo: {
                x: 23,
                y: 25,
                color: COLORS.HG_BLACK,
                text: `Name: ${playerInfo.name || 'unknown'}`,
                align: 'left',
                size: 1.4
            }
        });

        container.addChild(nameText);
    });

    return container;
};

const soundSettingContainer = ({ playerId, onToggle, session }) => {

    const homenamesHelper = session.homenamesHelper;


    let soundEnabled = true;
    let _playerSettings = {};

    let soundEnabledText;

    const soundSettingContainer = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(23, 34, 30, 6),
        onClick: () => {
            soundEnabled = !soundEnabled;
            onToggle(soundEnabled).then(() => {
                const currentText = soundEnabledText?.node?.text ? Object.assign({}, soundEnabledText.node.text) : null;
                if (currentText) {
                    currentText.text = `Sound: ${soundEnabled ? 'on' : 'off'}`;
                    soundEnabledText.node.text = currentText;
                    soundEnabledText.node.onStateChange();
                }
            });
        },
        playerIds: [playerId]
    });

    homenamesHelper.getPlayerSettings(playerId).then((playerSettings) => {
        _playerSettings = playerSettings;
        if (playerSettings && playerSettings[PLAYER_SETTINGS.SOUND] && !playerSettings[PLAYER_SETTINGS.SOUND].enabled) {
            soundEnabled = false;
        }

        soundEnabledText = new GameNode.Text({
            textInfo: {
                x: 23,
                y: 36,
                text: `Sound: ${soundEnabled ? 'on' : 'off'}`,
                align: 'left',
                size: 1.4,
                color: COLORS.HG_BLACK
            }
        });

        soundSettingContainer.addChild(soundEnabledText);
    });

    return soundSettingContainer;
};

const saveRecordingContainer = ({ playerId, onExportSessionData }) => {
    const text = new GameNode.Text({
        textInfo: {
            x: 23,
            y: 46,
            align: 'left',
            color: COLORS.HG_BLACK,
            size: 1,
            text: 'Save session recording'
        },
        playerIds: [playerId]
    });

    const container = new GameNode.Shape({
        coordinates2d: ShapeUtils.rectangle(23, 45, 35, 8),
        shapeType: Shapes.POLYGON,
        playerIds: [playerId],
        onClick: () => {
            const exportPath = onExportSessionData();
            const newText = Object.assign({}, text.node.text);
            newText.text = 'Wrote recording to ' + exportPath;
            newText.size = 0.8;
            text.node.text = newText;
            text.node.onStateChange();
        }
    });

    container.addChild(text);

    return container;
}

const assetInfoContainer = ({ playerId, assetInfo, onDownload }) => {
    const container = new GameNode.Shape({
        coordinates2d: ShapeUtils.rectangle(23, 60, 35, 8),
        shapeType: Shapes.POLYGON
    });

    if (assetInfo.downloadedCount < assetInfo.totalCount) {
        const assetText = new GameNode.Text({
            textInfo: {
                x: 23,
                y: 60,
                text: `Downloaded game assets: ${assetInfo.downloadedCount} of ${assetInfo.totalCount}` ,
                align: 'left',
                color: COLORS.HG_BLACK,//[251, 255, 242, 255],
                size: 1
            }
        });

        const downloadButton = new GameNode.Shape({
            coordinates2d: ShapeUtils.rectangle(45, 59, 12, 4),
            fill: COLORS.HG_YELLOW,
            onClick: () => onDownload(),
            shapeType: Shapes.POLYGON
        });

        const downloadText = new GameNode.Text({
            textInfo: {
                x: 51,
                y: 60,
                text: `Download all assets`,
                align: 'center',
                color: COLORS.HG_BLACK,//[251, 255, 242, 255],
                size: 0.7
            }
        });

        downloadButton.addChild(downloadText);

        container.addChild(downloadButton);
        container.addChild(assetText);
    } else {
        const allAssetsDownloadedText = new GameNode.Text({
            textInfo: {
                x: 23,
                y: 60,
                text: `All game assets downloaded locally!` ,
                align: 'left',
                color: COLORS.HG_BLACK,//[251, 255, 242, 255],
                size: 1
            }
        });

        container.addChild(allAssetsDownloadedText);
    }

    return container;
};

const closeContainer = ({ playerId, onRemove }) => {
    const closeButton = new GameNode.Shape({
        coordinates2d: ShapeUtils.rectangle(15, 15, 6, 8),
        fill: COLORS.HG_RED,
        shapeType: Shapes.POLYGON,
        onClick: onRemove
    });

    const closeX = new GameNode.Text({
        textInfo: {
            x: 18,
            y: 15,
            text: 'X',
            align: 'center',
            color: [251, 255, 242, 255],
            size: 3
        }
    });
    closeButton.addChild(closeX);

    return closeButton;
};

const settingsModal = ({ playerId, playerName, onRemove, onNameChange, onSoundToggle, session, playerInfo, assetInfo, onDownload, onExportSessionData }) => {
    
    const paddingSize = 1;

    const paddingWidth = paddingSize;
    const paddingHeight = paddingSize * (16 / 9);

    const settingsBase = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(15 - paddingWidth, 15 - paddingHeight, 70 + (2 * paddingWidth), 70 + (2 * paddingHeight)),
        fill: COLORS.HG_BLACK,
        playerIds: [playerId]
    });

    const settingsModal = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(15, 15, 70, 70),
        fill: COLORS.HG_BLUE,
        playerIds: [playerId]
    });

    settingsModal.addChildren(
        closeContainer({ playerId, onRemove }), 
        nameSettingContainer({ playerId, onNameChange, session }), 
        soundSettingContainer({ playerId, onToggle: onSoundToggle, session }),
        sessionInfoContainer({ playerId, session, playerInfo }),
        assetInfoContainer({ playerId, assetInfo, onDownload }),
        saveRecordingContainer({ playerId, onExportSessionData })
    );

    settingsBase.addChild(settingsModal);

    return settingsBase;
};

module.exports = settingsModal;
