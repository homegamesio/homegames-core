const { LEVELS, REALMS, ACHIEVEMENTS } = require('./content');
const STATS = ['gems', 'moves', 'specials', 'combos', 'bestCascade', 'radiances'];
const count = (v, cap = 1e12) => Number.isFinite(v) ? Math.min(cap, Math.max(0, Math.floor(v))) : 0;
const list = (v, max) => LEVELS.map((_, i) => count(Array.isArray(v) ? v[i] : 0, max));
const isLevelUnlocked = (p, index) => Number.isInteger(index) && index >= 0 && index < LEVELS.length && (index === 0 || p.medals[index - 1] > 0);
const isRealmUnlocked = (p, index) => Number.isInteger(index) && index >= 0 && index < REALMS.length && isLevelUnlocked(p, index * 10);

function achievementValue(p, a) {
    if (/^realm\d$/.test(a.metric)) return p.completedRealms.includes(Number(a.metric.slice(5))) ? 1 : 0;
    return p[a.metric] === undefined ? p.stats[a.metric] || 0 : p[a.metric];
}
function refresh(p) {
    p.totalStars = p.medals.reduce((n, v) => n + v, 0);
    p.completedLevels = p.medals.filter(Boolean).length;
    p.completedRealms = REALMS.map((_, i) => i).filter(i => p.medals.slice(i * 10, i * 10 + 10).every(Boolean));
    const awards = [];
    for (const a of ACHIEVEMENTS) if (!p.achievements.includes(a.id) && achievementValue(p, a) >= a.target) {
        p.achievements.push(a.id); awards.push(a);
    }
    return awards;
}
function hydrate(saved = {}) {
    const s = saved && saved.schema === 1 ? saved : {};
    const p = { medals: list(s.medals, 3), bests: list(s.bests, 1e12),
        stats: Object.fromEntries(STATS.map(key => [key, count(s.stats && s.stats[key])])),
        zenBest: count(s.zenBest), rushBest: count(s.rushBest),
        achievements: ACHIEVEMENTS.filter(a => Array.isArray(s.achievements) && s.achievements.includes(a.id)).map(a => a.id),
        selectedLevel: count(s.selectedLevel, LEVELS.length - 1), tutorialSeen: s.tutorialSeen === true };
    refresh(p);
    if (!isLevelUnlocked(p, p.selectedLevel)) p.selectedLevel = Math.max(0, p.medals.findIndex(n => !n));
    return p;
}
function saveProgress(p) {
    return { medals: p.medals.slice(), bests: p.bests.slice(), stats: { ...p.stats }, zenBest: p.zenBest, rushBest: p.rushBest,
        achievements: p.achievements.slice(), selectedLevel: p.selectedLevel, tutorialSeen: p.tutorialSeen };
}

// Accumulate only the portion of this run not already credited. Resume restores
// its baseline, so reopening a saved board cannot mint career stats or trophies.
function record(p, e, accounted = {}, levelIndex = -1) {
    for (const key of STATS) {
        const value = count(e.stats && e.stats[key]);
        if (key === 'bestCascade') p.stats[key] = Math.max(p.stats[key], value);
        else p.stats[key] += Math.max(0, value - count(accounted[key]));
        accounted[key] = value;
    }
    if (e.mode === 'zen') p.zenBest = Math.max(p.zenBest, count(e.score));
    if (e.mode === 'rush') p.rushBest = Math.max(p.rushBest, count(e.score));
    if (e.mode === 'journey' && Number.isInteger(levelIndex) && levelIndex >= 0 && levelIndex < LEVELS.length) {
        p.bests[levelIndex] = Math.max(p.bests[levelIndex], count(e.score));
        if (e.phase === 'won') p.medals[levelIndex] = Math.max(p.medals[levelIndex], Math.max(1, count(e.result && e.result.stars, 3)));
    }
    return refresh(p);
}

module.exports = { STATS, hydrate, refresh, saveProgress, record, achievementValue, isLevelUnlocked, isRealmUnlocked };
