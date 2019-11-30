const COLORS = {
    AQUA: [188, 212, 230, 255],
    BLACK: [0, 0, 0, 255],
    BLUE: [0, 0, 255, 255],
    BRONZE: [227, 151, 17, 255],
    BROWN: [145, 97, 11, 255],
    CREAM: [240, 224, 136, 255],
    EMERALD: [39, 89, 45, 255],
    FUCHSIA: [255, 0, 255, 255],
    GOLD: [255, 198, 35, 255],
    GRAY: [190, 190, 190, 255],
    GREEN: [0, 255, 0, 255],
    LAVENDER: [230, 230, 250, 255],
    MAGENTA: [255, 0, 255, 255],
    MAROON: [128, 0, 0, 255],
    MUSTARD: [232, 219, 32, 255],
    ORANGE: [255, 165, 0, 255],
    ORANGE_RED: [255, 69, 0, 255],
    PERRYWINKLE: [204, 204, 255, 255],
    PINK: [255, 192, 203, 255],
    PURPLE: [128, 0, 128, 255],
    RED: [255, 0, 0, 255],
    SILVER: [192, 192, 192, 255],
    TEAL: [0, 128, 128, 255],
    TERRACOTTA: [226, 114, 91, 255],
    TURQUOISE: [64, 224, 208, 255],
    WHITE: [255, 255, 255, 255],
    YELLOW: [255, 255, 0, 255]
};

const colorValues = Object.values(COLORS);

const randomColor = function() {
    const colorIndex = Math.floor(Math.random() * colorValues.length);    
    return colorValues[colorIndex];
};

COLORS.randomColor = randomColor;

module.exports = COLORS;
