const { GameNode, Colors, ShapeUtils, Shapes } = require('squish-0756');
const HomenamesHelper = require('../util/homenames-helper');
const { COLORS } = Colors;
const PLAYER_SETTINGS = require('../common/player-settings');

const soundSettingContainer = ({ playerId, onToggle }) => {

    const homenamesHelper = new HomenamesHelper();


    let _playerSettings = {};
    const handleClick = () => {
        onToggle(!(_playerSettings && _playerSettings[PLAYER_SETTINGS.SOUND] && _playerSettings[PLAYER_SETTINGS.SOUND].enabled));
    };

    const soundSettingContainer = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(16, 56, 35, 16),
        fill: [251, 255, 242, 255],
        onClick: handleClick,
        playerIds: [playerId]
    });

    homenamesHelper.getPlayerSettings(playerId).then((playerSettings) => {
        _playerSettings = playerSettings;
        let soundEnabled = false;
        if (playerSettings && playerSettings[PLAYER_SETTINGS.SOUND] && playerSettings[PLAYER_SETTINGS.SOUND].enabled) {
            soundEnabled = true;
        }

        const soundEnabledText = new GameNode.Text({
            textInfo: {
                x: 17,
                y: 62,
                text: `Sound: ${soundEnabled ? 'on' : 'off'}`,
                align: 'left',
                size: 1.5,
                color: COLORS.HG_BLACK
            }
        });

        soundSettingContainer.addChild(soundEnabledText);
    });

    return soundSettingContainer;
};

const sessionInfoContainer = ({ playerId, session, playerInfo }) => {
    
    const sessionPlayerInfoHeight = 55;

    const homenamesHelper = new HomenamesHelper();
    
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
            x: 55,
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
                    x: 55,
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

    sessionInfoContainer.addChild(spectatorCountText);

    const gameName = session.gameMetadata && session.gameMetadata.name || session.game.constructor.name;
    const squishVersion = session.gameMetadata && session.gameMetadata.squishVersion || 'Unknown';

    const gameNameText = new GameNode.Text({
        textInfo: {
            x: 16,
            y: 74,
            text: 'Current game: ' + gameName,
            align: 'left',
            size: .7,
            color: COLORS.HG_BLACK
        },
        playerIds: [playerId]
    });

    const authorText = new GameNode.Text({
        textInfo: {
            x: 16,
            y: 78,
            text: 'Author: ' + session.gameMetadata?.author,
            align: 'left',
            size: .7,
            color: COLORS.HG_BLACK
        },
        playerIds: [playerId]
    });

    const squishVersionText = new GameNode.Text({
        textInfo: {
            x: 16,
            y: 82,
            text: 'Squish version: ' + squishVersion,
            align: 'left',
            size: .7,
            color: COLORS.HG_BLACK
        },
        playerIds: [playerId]
    });

    sessionInfoContainer.addChildren(gameNameText, authorText, squishVersionText);

    return sessionInfoContainer;
}

const nameSettingContainer = ({ playerId, onNameChange }) => {

    const nameSettingContainerHeight = 16;
    const nameSettingContainerWidth = 35;

    const container = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(16, 32, nameSettingContainerWidth, nameSettingContainerHeight),
        fill: [251, 255, 242, 255],
        input: {
            type: 'text',
            oninput: (player, text) => {
                if (text) {
                    onNameChange && onNameChange(text);
                }
            }
        }
    });

    const homenamesHelper = new HomenamesHelper();

    homenamesHelper.getPlayerInfo(playerId).then(playerInfo => {
        const nameText = new GameNode.Text({
            textInfo: {
                x: 17,// + (nameSettingContainerWidth / 2),
                y: 30 + (nameSettingContainerHeight / 2),
                color: COLORS.HG_BLACK,
                text: `Name: ${playerInfo.name || 'unknown'}`,
                align: 'left',
                size: 1.5
            }
        });

        container.addChild(nameText);
    });

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
            y: 16,
            text: 'X',
            align: 'center',
            color: [251, 255, 242, 255],
            size: 3
        }
    });
    closeButton.addChild(closeX);

    return closeButton;
};

const settingsModal = ({ playerId, playerName, onRemove, onNameChange, onSoundToggle, session, playerInfo }) => {
    const settingsModal = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(15, 15, 70, 70),
        fill: COLORS.HG_BLUE,
        playerIds: [playerId]
    });

    settingsModal.addChildren(
        closeContainer({ playerId, onRemove }), 
        nameSettingContainer({ playerId, onNameChange }), 
        soundSettingContainer({ playerId, onToggle: onSoundToggle }),
        sessionInfoContainer({ playerId, session, playerInfo })
    );

    return settingsModal;
};

module.exports = settingsModal;
