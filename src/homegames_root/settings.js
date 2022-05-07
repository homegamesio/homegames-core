const { GameNode, Colors, ShapeUtils, Shapes } = require('squish-0710');

const { COLORS } = Colors;

const settingsModal = ({ playerId, playerName, onRemove, onNameChange }) => {
		const settingsModal = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(15, 15, 70, 70),
            fill: COLORS.HG_BLUE,
            playerIds: [playerId]
        });


		const closeContainer = new GameNode.Shape({
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

        closeContainer.addChild(closeButton);

        settingsModal.addChildren(closeContainer);

        const nameSettingContainerHeight = 16;
        const nameSettingContainerWidth = 35;

        const nameSettingContainer = new GameNode.Shape({
        	shapeType: Shapes.POLYGON,
        	coordinates2d: ShapeUtils.rectangle(16, 32, nameSettingContainerWidth, nameSettingContainerHeight),
        	fill: [251, 255, 242, 255],//COLORS.RED,
        	input: {
                type: 'text',
                oninput: (player, text) => {
                    if (text) {
                    	onNameChange && onNameChange(text);
                    }
                }
            }
        });

        const nameText = new GameNode.Text({
        	textInfo: {
        		x: 17,// + (nameSettingContainerWidth / 2),
        		y: 30 + (nameSettingContainerHeight / 2),
        		color: COLORS.HG_BLACK,
        		text: `Name: ${playerName}`,
        		align: 'left',
        		size: 1.5
        	}
        });

        nameSettingContainer.addChild(nameText);

        settingsModal.addChildren(closeContainer, nameSettingContainer);

        return settingsModal;
 };

module.exports = settingsModal;
