const fadeIn = (_node, secondsToFinish) => {
    const node = _node.node;
    const startingOpacity = node.color[3];
    const ticks = 10;
    const increment = (255 - startingOpacity) / ticks;

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
            node._animation = null;
        }
    }, secondsToFinish * 1000 / increment);

    node._animation = thing;
    return thing;
};

const animations = {
    fadeIn
};

module.exports = animations;
