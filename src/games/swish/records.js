'use strict';
const { themeIds, DURATIONS } = require('./themes');
const keyFor = (theme, duration) => `${theme}:${duration}`;

function readRecords(value) {
    const data = { schema: 1, theme: 'classic', duration: 60, scores: {} };
    if (value?.schema !== 1) return data;
    if (themeIds.includes(value.theme)) data.theme = value.theme;
    if (DURATIONS.includes(value.duration)) data.duration = value.duration;
    for (const theme of themeIds) for (const duration of DURATIONS) {
        const key = keyFor(theme, duration), scores = value.scores?.[key];
        if (Array.isArray(scores)) data.scores[key] = scores
            .filter(n => Number.isInteger(n) && n >= 0 && n <= 10000).sort((a, b) => b - a).slice(0, 5);
    }
    return data;
}
function recordRound(data, theme, duration, score) {
    const key = keyFor(theme, duration);
    data.scores[key] = [...(data.scores[key] || []), score].sort((a, b) => b - a).slice(0, 5);
}
module.exports = { readRecords, recordRound, keyFor };
