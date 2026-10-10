const { LEVELS, WORLDS, CHALLENGES } = require('./levels');
const { POWERS } = require('./engine');
const { ACHIEVEMENTS, isLevelUnlocked, isWorldUnlocked, isPowerUnlocked, isChallengeUnlocked, achievementValue } = require('./progression');
const { C, TAU, fiveStar, display, moon, powerCharacter, frame, gem } = require('./decorations');
const number = n => Math.floor(Number(n) || 0).toLocaleString('en-US');
const clock = e => e.reduced ? 0 : e.uiTime || e.time || 0;
const progress = e => e.progress || { medals: e.medals || [], bestScores: [], challengeMedals: [], challengeBests: [], unlockedPowers: ['guide'],
    achievements: [], completedWorlds: [], totalStars: 0, challengeStars: 0, clearedLevels: 0, completedChallenges: 0, career: {} };
const worldIndex = e => Math.max(0, Math.min(WORLDS.length - 1, e.selectedWorld || 0));

function wrap(p, text, x, y, width = 31, size = 1.7, color = C.cream, align = 'left', maxLines = 4) {
    const words = String(text || '').split(/\s+/), lines = [];
    let line = '';
    for (const word of words) {
        if (line.length + word.length + 1 > width && line) { lines.push(line); line = word; } else line += (line ? ' ' : '') + word;
    }
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((value, i) => p.text(value, x, y + i * size * 1.45, size, color, align));
    return Math.min(lines.length, maxLines) * size * 1.45;
}
function lock(p, x, y, size = 1, color = C.muted) {
    p.arc(x, y - size * .25, size * .6, Math.PI, Math.PI, color, size * .19);
    p.roundRect(x - size * .85, y - size * .2, size * 1.7, size * 1.4, size * .22, color);
    p.circle(x, y + size * .25, size * .16, C.dark);
}
function disabled(p, label, x, y, w, h) {
    p.roundRect(x, y, w, h, 1.5, [38, 42, 64], C.line);
    p.heading(label, x + w / 2, y + (h - 1.75) / 2, 1.75, C.muted, 'center');
}
function navigation(p, e) {
    const items = [['HOME', 'home', 18], ['ADVENTURE', 'map', 28], ['MOON CREW', 'characters', 28], ['CHALLENGES', 'challenges', 28], ['TROPHIES', 'trophies', 24]];
    let x = 5;
    for (const [label, screen, width] of items) {
        p.button(label, x, 84.7, width, 4.2, 'screen:' + screen, e.screen === screen, true); x += width + 2;
    }
    const pr = progress(e);
    fiveStar(p, 145, 87.1, 1.1, C.gold); p.heading(pr.totalStars + '/120', 153, 86.4, 1.45, C.gold, 'center');
}
function worldTabs(p, e) {
    const pr = progress(e), current = worldIndex(e);
    WORLDS.forEach((world, i) => {
        const x = 6 + i * 30, selected = current === i, unlocked = isWorldUnlocked(pr, i);
        p.roundRect(x, 12.4, 28.5, 8.3, 2, selected ? [61, 47, 96] : [22, 38, 61], selected ? world.color : C.line, .95);
        p.heading(world.name, x + 14.2, 15.2, 1.8, selected ? C.cream : unlocked ? world.color : C.muted, 'center');
        if (selected) p.line(x + 3, 19.2, x + 25.5, 19.2, world.color, .32);
        if (!unlocked) lock(p, x + 25.4, 13.5, .45, C.muted);
        p.buttons.push({ x, y: 12.4, w: 28.5, h: 8.3, action: 'world:' + i });
    });
}

function home(p, e) {
    const t = clock(e), pr = progress(e);
    p.roundRect(9, 14, 85, 35, 5, C.dark, null, .3);
    display(p, 'MOON', 51, 14.5, 14.1, C.cream);
    display(p, 'BOUNCE', 51, 28.5, 14.1, C.gold);
    p.heading('A whole sky of little miracles.', 51, 44.5, 2.7, C.cream, 'center');
    for (let i = 0; i < 5; i++) {
        const angle = t * .13 + i * TAU / 5;
        gem(p, { x: 123 + Math.cos(angle) * 16, y: 34 + Math.sin(angle) * 15, r: 1.3,
            type: ['orange', 'blue', 'green', 'purple', 'orange'][i] }, t, e.reduced);
    }
    moon(p, 123, 34, 10.5, 'happy', t, C.gold, e.reduced);
    p.button(pr.clearedLevels ? 'CONTINUE ADVENTURE' : 'BEGIN YOUR ADVENTURE', 10, 55, 82, 11.5, 'screen:map', true);
    p.text('5 magical worlds  /  40 constellations  /  15 challenges', 51, 69.7, 1.8, C.cream, 'center');
    p.button('MOON CREW', 10, 75.1, 25.5, 6.6, 'screen:characters', false, true);
    p.button('CHALLENGES', 38, 75.1, 26, 6.6, 'screen:challenges', false, true);
    p.button('TROPHIES', 66.5, 75.1, 25.5, 6.6, 'screen:trophies', false, true);
    p.roundRect(100, 55, 50, 26.7, 3, C.dark, C.line, .88);
    p.heading('YOUR JOURNEY', 125, 58.4, 2.2, C.gold, 'center');
    p.heading(pr.clearedLevels + ' / 40 CONSTELLATIONS', 125, 63.2, 1.9, C.cream, 'center');
    p.text(pr.totalStars + ' stars  /  ' + pr.achievements.length + ' trophies', 125, 67.2, 1.7, C.muted, 'center');
    WORLDS.forEach((world, i) => {
        const x = 107 + i * 9, completed = pr.completedWorlds.includes(i);
        p.circle(x, 75.7, 2.9, isWorldUnlocked(pr, i) ? world.color : C.panelLight);
        if (completed) fiveStar(p, x, 75.7, 1.7, C.cream);
        else p.heading(i + 1, x, 74.5, 2.2, isWorldUnlocked(pr, i) ? C.dark : C.muted, 'center');
    });
    p.text('Drag to aim. Release to shoot.  /  Arrows + Space', 8, 86.5, 1.45, C.cream);
    p.text('BEST  ' + number(e.best), 153, 86.5, 1.45, C.gold, 'right');
}

function map(p, e) {
    worldTabs(p, e);
    const pr = progress(e), wi = worldIndex(e), world = WORLDS[wi];
    const entries = LEVELS.map((level, i) => ({ level, i })).filter(entry => entry.level.worldIndex === wi);
    const selected = entries.find(entry => entry.i === e.selectedLevel) || entries[0];
    const unlockedWorld = isWorldUnlocked(pr, wi), canPlay = isLevelUnlocked(pr, selected.i);
    p.roundRect(6, 23.2, 102, 59, 3.5, C.dark, world.color, .57);
    p.heading(world.subtitle, 57, 25.3, 1.95, C.cream, 'center');
    const points = [[19, 43], [42, 35], [66, 44], [93, 34], [96, 61], [72, 70], [45, 60], [21, 70]];
    for (let i = 0; i < points.length - 1; i++) {
        const [x, y] = points[i], [xx, yy] = points[i + 1], lit = pr.medals[entries[i].i] > 0;
        p.line(x, y, xx, yy, C.dark, 1.35, .8);
        p.line(x, y, xx, yy, lit ? world.color : C.line, .6, lit ? .9 : .7);
    }
    entries.forEach(({ level, i }, index) => {
        const [x, y] = points[index], unlocked = isLevelUnlocked(pr, i), active = selected.i === i;
        const hovered = e.hoverAction === 'level:' + i || e.focusAction === 'level:' + i;
        if (active || hovered) p.arc(x, y, 5.1, 0, TAU, active ? C.gold : C.cream, .3, .9);
        p.circle(x, y + .5, 4.15, C.dark);
        p.circle(x, y, 4, active ? C.gold : pr.medals[i] ? world.color : unlocked ? C.panelLight : [42, 43, 66], unlocked ? C.cream : C.line);
        if (unlocked) p.heading(index + 1, x, y - 1.8, 3.4, active || pr.medals[i] ? C.dark : C.cream, 'center');
        else lock(p, x, y - .3, 1.55, C.muted);
        for (let star = 0; star < 3; star++) fiveStar(p, x - 2.3 + star * 2.3, y + 5.4, .92, star < (pr.medals[i] || 0) ? C.gold : C.line);
        if (level.finale) p.heading('FINALE', x, y + 7.5, 1.35, C.gold, 'center');
        if (unlocked) p.buttons.push({ x: x - 5.5, y: y - 5, w: 11, h: 13, action: 'level:' + i });
    });
    frame(p, 112, 23.2, 42, 59, world.color);
    p.roundRect(113.5, 24.7, 39, 56, 2, C.panel);
    p.heading('CONSTELLATION ' + String(selected.level.stageIndex + 1).padStart(2, '0'), 133, 27.2, 1.55, world.color, 'center');
    const lines = wrap(p, selected.level.name, 133, 31.4, 22, 2.8, C.cream, 'center', 2);
    for (let i = 0; i < 3; i++) fiveStar(p, 126 + i * 7, Math.max(40.4, 32.8 + lines), 2.15, i < (pr.medals[selected.i] || 0) ? C.gold : C.line);
    p.text('2 STAR SCORE', 116, 46.3, 1.45, C.muted); p.heading(number(selected.level.parScore), 149, 46.1, 1.85, C.gold, 'right');
    p.text('PERSONAL BEST', 116, 50.3, 1.45, C.muted); p.heading(number(pr.bestScores[selected.i] || 0), 149, 50.1, 1.85, C.cream, 'right');
    p.line(116, 54, 150, 54, C.line, .14);
    const hint = !unlockedWorld ? 'Complete ' + WORLDS[Math.max(0, wi - 1)].name + ' to open this world.' : selected.level.hint || world.mechanic;
    wrap(p, hint, 116, 56.2, 31, 1.65, canPlay ? C.cream : C.muted, 'left', 4);
    const power = POWERS.find(item => item.id === e.powerId) || POWERS[0];
    p.text('MAGIC: ' + power.name.toUpperCase(), 133, 69.5, 1.4, power.color, 'center');
    if (canPlay) p.button(pr.medals[selected.i] ? 'PLAY AGAIN' : 'LET\'S PLAY!', 117, 73, 32, 6.6, 'start', true);
    else disabled(p, 'WORLD LOCKED', 117, 73, 32, 6.6);
    navigation(p, e);
}

function characters(p, e) {
    const pr = progress(e), t = clock(e);
    display(p, 'MEET YOUR MOON CREW', 80, 13.2, 5, C.gold);
    p.text('Five friends. Five ways to make the impossible bounce happen.', 80, 21.2, 1.9, C.cream, 'center');
    const descriptions = {
        guide: ['See a longer path.', 'Plan the perfect ricochet.'], blast: ['The first hit explodes.', 'Set off a chain reaction.'], twin: ['Two balls in one shot.', 'Twice the possibilities.'],
        magnet: ['A little cosmic pull.', 'Curve toward orange stars.'], phoenix: ['A second chance.', 'Rescue a missed shot.'],
    };
    POWERS.forEach((power, i) => {
        const x = 6 + i * 30, unlocked = isPowerUnlocked(pr, power.id), chosen = e.powerId === power.id;
        p.roundRect(x, 28, 28.5, 50.3, 2.8, chosen ? [61, 43, 101] : [27, 37, 62], chosen ? power.color : C.line, .97);
        powerCharacter(p, power.id, x + 14.2, 39, 5.8, power.color, t + i);
        if (!unlocked) lock(p, x + 22.5, 33, 1.1, C.gold);
        p.heading(power.name, x + 14.2, 49, 2.4, unlocked ? C.cream : C.muted, 'center');
        (descriptions[power.id] || []).forEach((line, row) => p.text(line, x + 14.2, 54.2 + row * 3.2, 1.65, C.cream, 'center'));
        p.text(unlocked ? chosen ? 'YOUR MAGIC' : 'READY TO JOIN YOU' : 'CLEAR WORLD ' + i, x + 14.2, 63.2, 1.4, unlocked ? power.color : C.gold, 'center');
        if (unlocked) p.button(chosen ? 'SELECTED' : 'CHOOSE', x + 2, 68.8, 24.5, 6.5, 'power:' + power.id, chosen, true);
        else disabled(p, 'LOCKED', x + 2, 68.8, 24.5, 6.5);
    });
    navigation(p, e);
}

function challenges(p, e) {
    worldTabs(p, e);
    const pr = progress(e), wi = worldIndex(e), world = WORLDS[wi];
    const entries = CHALLENGES.map((challenge, i) => ({ challenge, i })).filter(item => item.challenge.worldIndex === wi);
    p.heading('A LITTLE EXTRA MAGIC', 80, 24.2, 3.8, C.gold, 'center');
    p.text(pr.completedWorlds.includes(wi) ? 'Special rules. Bold shots. Three more stars to chase.' : 'Light all eight constellations in ' + world.name + ' to unlock these challenges.',
        80, 30, 1.8, C.cream, 'center');
    entries.forEach(({ challenge, i }, slot) => {
        const x = 7 + slot * 50, unlocked = isChallengeUnlocked(pr, challenge.id), chosen = e.selectedChallenge === challenge.id;
        p.roundRect(x, 36, 46, 34, 2.8, chosen ? [62, 44, 101] : [24, 39, 62], chosen ? world.color : C.line, .95);
        if (unlocked) fiveStar(p, x + 23, 41.5, 2.3, world.color); else lock(p, x + 23, 41, 1.7, C.gold);
        p.heading(challenge.title, x + 23, 45.5, 2.25, unlocked ? C.cream : C.muted, 'center');
        wrap(p, challenge.description, x + 23, 50.5, 35, 1.65, C.cream, 'center', 3);
        p.text(challenge.balls + ' BALLS' + (challenge.powerId ? '  /  ' + (POWERS.find(power => power.id === challenge.powerId) || { name: challenge.powerId }).name.toUpperCase() : '  /  YOUR CHOICE OF MAGIC'),
            x + 23, 60, 1.4, world.color, 'center');
        for (let star = 0; star < 3; star++) fiveStar(p, x + 18 + star * 5, 65.7, 1.5, star < (pr.challengeMedals[i] || 0) ? C.gold : C.line);
        if (unlocked) p.buttons.push({ x, y: 36, w: 46, h: 34, action: 'challenge:' + challenge.id });
    });
    const selected = entries.find(item => item.challenge.id === e.selectedChallenge) || entries[0];
    if (selected && isChallengeUnlocked(pr, selected.challenge.id)) p.button('TAKE THE CHALLENGE', 50, 73.2, 60, 7.2, 'startChallenge', true);
    else disabled(p, 'FINISH THIS WORLD TO UNLOCK', 47, 73.2, 66, 7.2);
    navigation(p, e);
}

function trophies(p, e) {
    const pr = progress(e);
    display(p, 'THE TROPHY ROOM', 80, 13, 5.2, C.gold);
    p.text(pr.achievements.length + '/' + ACHIEVEMENTS.length + ' trophies  /  ' + pr.totalStars + '/120 adventure stars  /  ' + pr.challengeStars + '/45 challenge stars',
        80, 20.5, 1.9, C.cream, 'center');
    ACHIEVEMENTS.forEach((award, i) => {
        const x = 6 + i % 3 * 50, y = 27 + Math.floor(i / 3) * 13.5, earned = pr.achievements.includes(award.id);
        const value = Math.min(award.target, achievementValue(pr, award));
        p.roundRect(x, y, 47.5, 12.5, 1.9, earned ? [55, 48, 82] : [24, 39, 62], earned ? C.gold : C.line, .95);
        fiveStar(p, x + 4.5, y + 4.7, 2.3, earned ? C.gold : C.line);
        p.heading(award.title, x + 8.5, y + 1.2, 1.9, earned ? C.gold : C.cream);
        wrap(p, award.description, x + 8.5, y + 4.3, 39, 1.45, C.muted, 'left', 2);
        p.roundRect(x + 8.5, y + 10.4, 24, .55, .25, C.panelLight);
        if (value > 0) p.roundRect(x + 8.5, y + 10.4, 24 * value / award.target, .55, .25, earned ? C.gold : C.green);
        p.text(earned ? 'EARNED' : number(value) + '/' + number(award.target), x + 45.5, y + 9.1, 1.3, earned ? C.gold : C.muted, 'right');
    });
    navigation(p, e);
}

function renderMenu(p, e) {
    const screen = e.screen || 'home';
    ({ home, map, characters, challenges, trophies }[screen] || home)(p, e);
}
module.exports = { renderMenu, wrap, lock, disabled, navigation };
