'use strict';

const THEMES = {
    classic: {
        name: 'Classic', park: 'SUNNY FIELD', sky: [184, 222, 224, 255], haze: [217, 236, 218, 255],
        grass: [110, 163, 120, 255], stripe: [119, 172, 127, 255], dark: [36, 76, 65, 255],
        fence: [55, 104, 85, 255], dirt: [219, 173, 129, 255], accent: [207, 85, 55, 255],
        shirt: [206, 85, 57, 255], cap: [41, 87, 72, 255], light: [245, 199, 99, 255],
    },
    halloween: {
        name: 'Halloween', park: 'PUMPKIN PARK', sky: [65, 60, 93, 255], haze: [108, 92, 124, 255],
        grass: [104, 121, 99, 255], stripe: [114, 131, 106, 255], dark: [51, 44, 68, 255],
        fence: [69, 64, 87, 255], dirt: [189, 145, 116, 255], accent: [177, 79, 33, 255],
        shirt: [232, 141, 60, 255], cap: [76, 53, 106, 255], light: [255, 198, 99, 255],
    },
    christmas: {
        name: 'Christmas', park: 'SNOWFLAKE STADIUM', sky: [173, 201, 215, 255], haze: [226, 238, 235, 255],
        grass: [210, 228, 218, 255], stripe: [221, 235, 226, 255], dark: [39, 77, 72, 255],
        fence: [58, 104, 95, 255], dirt: [189, 165, 137, 255], accent: [184, 60, 62, 255],
        shirt: [196, 66, 67, 255], cap: [184, 60, 62, 255], light: [247, 206, 120, 255],
    },
};
const themeIds = Object.keys(THEMES);
function readSave(raw) {
    const data = raw && typeof raw === 'object' ? raw : {};
    return { version: 1, theme: themeIds.includes(data.theme) ? data.theme : 'classic', sound: data.sound !== false,
        best: Object.fromEntries(themeIds.map(id => [id, Number.isInteger(data.best?.[id]) ? Math.max(0, Math.min(40, data.best[id])) : 0])) };
}
module.exports = { THEMES, themeIds, readSave };
