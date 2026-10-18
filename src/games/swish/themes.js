'use strict';

const THEMES = {
    classic: { name: 'Classic', colors: {
        wall: [178, 204, 198, 255], lower: [151, 182, 176, 255], light: [194, 216, 205, 255],
        floor: [213, 151, 117, 255], floorShade: [193, 128, 100, 255], floorLight: [225, 167, 130, 255],
        glass: [208, 224, 210, 255], boardShadow: [133, 165, 158, 255], accent: [83, 133, 117, 255],
    } },
    halloween: { name: 'Halloween', colors: {
        wall: [64, 57, 86, 255], lower: [51, 45, 70, 255], light: [77, 67, 98, 255],
        floor: [121, 84, 103, 255], floorShade: [90, 61, 84, 255], floorLight: [139, 94, 112, 255],
        glass: [110, 101, 126, 255], boardShadow: [41, 37, 62, 255], accent: [205, 110, 51, 255],
    } },
    christmas: { name: 'Christmas', colors: {
        wall: [170, 201, 210, 255], lower: [125, 165, 174, 255], light: [195, 221, 220, 255],
        floor: [166, 183, 171, 255], floorShade: [122, 153, 142, 255], floorLight: [192, 201, 181, 255],
        glass: [218, 232, 221, 255], boardShadow: [126, 161, 165, 255], accent: [161, 67, 62, 255],
    } },
};
const DURATIONS = [30, 60, 300];
const themeIds = Object.keys(THEMES);
const circle = (id, kind, x, y, radius) => ({ id, kind, shape: 'circle', x, y, radius });

// Each theme owns its geometry and motion. These are gameplay objects, not a
// shared obstacle course with its sprites swapped. All begin after 3 baskets.
function obstaclesAt(theme, baskets, time) {
    if (baskets < 3) return [];
    const objects = [];
    if (theme === 'halloween') {
        const x = 50 + Math.sin(time * 1.25) * 27, y = 36 + Math.sin(time * 2.1) * 7;
        objects.push({ id: 'bat', kind: 'bat', shape: 'capsule', x, y, radius: 1.8,
            ax: x - 3.5, ay: y, bx: x + 3.5, by: y });
        if (baskets >= 6) objects.push(circle('spider', 'spider', 31 + Math.sin(time * .45) * 7,
            33 + Math.sin(time * .8) * 20, 3));
    } else if (theme === 'christmas') {
        const angle = Math.sin(time * 1.1) * .9;
        objects.push(circle('ornament', 'ornament', 50 + Math.sin(angle) * 30, 17 + Math.cos(angle) * 30, 4));
        if (baskets >= 6) objects.push({ id: 'present', kind: 'present', shape: 'box',
            x: 73, y: 48 + Math.sin(time * .9) * 14, hw: 3.6, hh: 3.4 });
    } else {
        const a = time * .85;
        objects.push({ id: 'bar', kind: 'bar', shape: 'capsule', x: 50, y: 51, radius: 1.35,
            ax: 50 - Math.cos(a) * 10, ay: 51 - Math.sin(a) * 10,
            bx: 50 + Math.cos(a) * 10, by: 51 + Math.sin(a) * 10 });
        if (baskets >= 6) objects.push(circle('bumper', 'bumper', 50 + Math.sin(time * .9) * 27, 25, 3.3));
    }
    return objects;
}

module.exports = { THEMES, DURATIONS, themeIds, obstaclesAt };
