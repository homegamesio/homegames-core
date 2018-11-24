const GameNode = require('../GameNode');

const COLORS = {
	BLACK: [0, 0, 0, 255],
	WHITE: [255, 255, 255, 255],
	GRAY: [190, 190, 190, 255],
	RED: [255, 0, 0, 255],
	PURPLE: [128, 0, 128, 255],
	BLUE: [0, 0, 255, 255],
	GREEN: [0, 255, 0, 255],
	ORANGE: [255, 165, 0, 255],
	YELLOW: [255, 255, 0, 255],
	BROWN: [145, 97, 11, 255],
	PINK: [255, 192, 203, 255],
	FUCHSIA: [255, 0, 255, 255],
	LAVENDER: [230, 230, 250, 255],
	PERRYWINKLE: [204, 204, 255, 255],
	AQUA: [188, 212, 230, 255],
	TURQUOISE: [64, 224, 208],
	MAGENTA: [255, 0, 255, 255],
	ORANGE_RED: [255, 69, 0, 255],
	MUSTARD: [232, 219, 32, 255],
	EMERALD: [39, 89, 45, 255],
	CREAM: [240, 224, 136, 255],
	GOLD: [255, 198, 35, 255],
	SILVER: [192, 192, 192, 255],
	BRONZE: [227, 151, 17, 255],
	MAROON: [128, 0, 0, 255],
	TEAL: [0, 128, 128, 255],
	TERRACOTTA: [226, 114, 91, 255]
};

const resetBoard = function() {
    boardEntities = {};
};

const randomizeBackground = function() {
	let colorKey = Math.floor(Math.random() * colorKeys.length);
	boardColor = COLORS[colorKeys[colorKey]];
};

const randomizeDrawColor = function(ws) {
	let colorKey = Math.floor(Math.random() * colorKeys.length);
	let newColor = COLORS[colorKeys[colorKey]];
	clientColors[ws.id] = newColor;
};

const handleBoardClick = function() {
    console.log("YOOOOOOOO");
};

const board = new GameNode(COLORS.BLUE, handleBoardClick, {'x': 0, 'y': 0}, {'x': 1, 'y': 1});

const resetButton = new GameNode(COLORS.RED, resetBoard, {'x': .9, 'y': 0}, {'x': .1, 'y': .1});

board.addChild(resetButton);

const squisher = new Squisher(192, 108, board);
squisher.handleClick(120, 40);
//console.log(squisher.getPixels());
//
