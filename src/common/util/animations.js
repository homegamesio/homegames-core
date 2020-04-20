const fadeIn = (node, secondsToFinish, increment) => {  
    const thing = setInterval(() => {
        if (node.color[3] + increment <= 255 || node.color[3] < 255) {
            const currentColor = node.color;
            if (currentColor[3] + increment > 255) {
                currentColor[3] += 255 % increment;
            } else {
                currentColor[3] += increment;
            }
            node.color = currentColor;
        } else {
            clearInterval(thing);
        }
    }, secondsToFinish / (255 / increment));

    return thing;
};

const animations = {
    fadeIn
};

module.exports = animations;
