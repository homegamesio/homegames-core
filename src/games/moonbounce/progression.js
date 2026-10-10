const { LEVELS, WORLDS, CHALLENGES } = require('./levels');

const ACHIEVEMENTS = [
    { id: 'first-light', title: 'First Light', description: 'Clear your first constellation.', target: 1, metric: 'clearedLevels' },
    { id: 'star-collector', title: 'Star Collector', description: 'Earn 30 adventure stars.', target: 30, metric: 'totalStars' },
    { id: 'chain-reaction', title: 'Chain Reaction', description: 'Hit 20 pegs in a single shot.', target: 20, metric: 'bestCombo' },
    { id: 'catcher', title: 'Safe Hands', description: 'Catch 10 balls in the moonboat.', target: 10, metric: 'catches' },
    { id: 'trickshot', title: 'A Little Showmanship', description: 'Earn 25 shot-style bonuses.', target: 25, metric: 'styles' },
    { id: 'worldwalker', title: 'Worldwalker', description: 'Light all eight constellations in a world.', target: 1, metric: 'worlds' },
    { id: 'stardust', title: 'Stardust Trail', description: 'Light 1,000 pegs across your adventures.', target: 1000, metric: 'pegHits' },
    { id: 'challenge', title: 'Challenge Accepted', description: 'Complete your first challenge.', target: 1, metric: 'completedChallenges' },
    { id: 'skykeeper', title: 'Keeper of the Sky', description: 'Complete all five worlds.', target: 5, metric: 'worlds' },
    { id: 'challenge-master', title: 'Against the Odds', description: 'Complete all 15 challenges.', target: 15, metric: 'completedChallenges' },
    { id: 'perfect-sky', title: 'A Perfect Sky', description: 'Earn all 120 adventure stars.', target: 120, metric: 'totalStars' },
    { id: 'mastery', title: 'Beyond the Moon', description: 'Earn all 45 challenge stars.', target: 45, metric: 'challengeStars' },
];
const POWER_IDS = ['guide', 'blast', 'twin', 'magnet', 'phoenix'];
const count = (value, max = 1e12) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
const values = (input, length, max) => Array.from({ length }, (_, i) => count(Array.isArray(input) ? input[i] : 0, max));
const has = (input, id) => Array.isArray(input) && input.includes(id);

function refresh(p) {
    p.totalStars = p.medals.reduce((sum, n) => sum + n, 0);
    p.challengeStars = p.challengeMedals.reduce((sum, n) => sum + n, 0);
    p.clearedLevels = p.medals.filter(Boolean).length;
    p.completedChallenges = p.challengeMedals.filter(Boolean).length;
    p.completedWorlds = WORLDS.map((_, i) => i).filter(i => LEVELS.filter(l => l.worldIndex === i).every(l => p.medals[LEVELS.indexOf(l)] > 0));
    p.unlockedLevels = LEVELS.map((_, i) => i).filter(i => isLevelUnlocked(p, i));
    for (const world of p.completedWorlds) {
        const power = WORLDS[world].unlockPower;
        if (power && !p.unlockedPowers.includes(power)) p.unlockedPowers.push(power);
    }
    const earned = [];
    for (const award of ACHIEVEMENTS) {
        if (!p.achievements.includes(award.id) && achievementValue(p, award) >= award.target) {
            p.achievements.push(award.id); earned.push(award);
        }
    }
    return earned;
}

function hydrate(saved = {}) {
    const legacy = saved.schema === 1;
    const valid = saved.schema === 2 || legacy;
    const s = valid ? saved : {};
    const p = {
        medals: values(s.medals, LEVELS.length, 3),
        bestScores: values(s.bestScores, LEVELS.length, 1e12),
        challengeMedals: values(s.challengeMedals, CHALLENGES.length, 3),
        challengeBests: values(s.challengeBests, CHALLENGES.length, 1e12),
        unlockedPowers: POWER_IDS.filter(id => id === 'guide' || legacy && ['blast', 'twin'].includes(id) || has(s.unlockedPowers, id)),
        achievements: ACHIEVEMENTS.filter(a => has(s.achievements, a.id)).map(a => a.id),
        career: Object.fromEntries(['shots', 'catches', 'pegHits', 'styles', 'bestCombo'].map(key => [key, count(s.career && s.career[key])])),
    };
    refresh(p);
    let selectedLevel = count(s.selectedLevel, LEVELS.length - 1);
    if (!valid || s.selectedLevel === undefined || !isLevelUnlocked(p, selectedLevel)) {
        selectedLevel = p.medals.findIndex(n => !n);
        if (selectedLevel < 0 || !isLevelUnlocked(p, selectedLevel)) selectedLevel = p.unlockedLevels.at(-1) || 0;
    }
    p.selectedLevel = selectedLevel;
    p.selectedWorld = LEVELS[selectedLevel].worldIndex;
    return p;
}

function isLevelUnlocked(p, index) {
    return Number.isInteger(index) && index >= 0 && index < LEVELS.length && (index === 0 || p.medals[index - 1] > 0);
}
function isWorldUnlocked(p, index) {
    const first = LEVELS.findIndex(l => l.worldIndex === index);
    return first >= 0 && isLevelUnlocked(p, first);
}
function isPowerUnlocked(p, id) { return p.unlockedPowers.includes(id); }
function isChallengeUnlocked(p, id) {
    const challenge = CHALLENGES.find(c => c.id === id);
    return !!challenge && p.completedWorlds.includes(challenge.worldIndex);
}
function achievementValue(p, award) {
    if (award.metric === 'worlds') return p.completedWorlds.length;
    return p[award.metric] === undefined ? p.career[award.metric] || 0 : p[award.metric];
}
function saveProgress(p) {
    const { medals, bestScores, challengeMedals, challengeBests, unlockedPowers, achievements, career, selectedLevel, selectedWorld } = p;
    return { medals: medals.slice(), bestScores: bestScores.slice(), challengeMedals: challengeMedals.slice(), challengeBests: challengeBests.slice(),
        unlockedPowers: unlockedPowers.slice(), achievements: achievements.slice(), career: { ...career }, selectedLevel, selectedWorld };
}

module.exports = { ACHIEVEMENTS, hydrate, refresh, saveProgress, isLevelUnlocked, isWorldUnlocked, isPowerUnlocked, isChallengeUnlocked, achievementValue };
