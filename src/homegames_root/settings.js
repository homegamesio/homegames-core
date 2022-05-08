const { GameNode, Colors, ShapeUtils, Shapes } = require('squish-0710');
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
		coordinates2d: ShapeUtils.rectangle(16, 64, 35, 16),
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
				y: 70,
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
	const container = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(16, 16, 4, 7),
        fill: COLORS.HG_BLUE,
        onClick: onRemove,
        playerIds: [playerId]
    });        

    const closeButton = new GameNode.Text({
        textInfo: {
            x: 18,
            y: 16,
            color: COLORS.HG_BLACK,
            text: '\u2715',
            align: 'center',
            size: 3
        }
    });

    container.addChild(closeButton);

    return container;
}

const settingsModal = ({ playerId, playerName, onRemove, onNameChange, onSoundToggle }) => {
		const settingsModal = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(15, 15, 70, 70),
            fill: COLORS.HG_BLUE,
            playerIds: [playerId]
        });

        settingsModal.addChildren(closeContainer({ playerId, onRemove }), nameSettingContainer({ playerId, onNameChange }), soundSettingContainer({ playerId, onToggle: onSoundToggle }));

        return settingsModal;
 };

module.exports = settingsModal;