const { UPGRADES, SECTORS, ROLES } = require('./settings');

const C = {
    void: [4, 9, 17, 255], panel: [9, 20, 31, 255], raised: [15, 34, 47, 255],
    line: [37, 68, 79, 255], text: [229, 237, 220, 255], muted: [119, 155, 164, 255],
    teal: [107, 247, 211, 255], gold: [245, 199, 122, 255], red: [255, 111, 103, 255],
    blue: [115, 169, 244, 255], violet: [191, 150, 248, 255],
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
const number = value => Math.floor(Number(value) || 0).toLocaleString('en-US');
const costText = cost => !cost ? 'MAXIMUM EVOLUTION' : Object.entries(cost).filter(([, n]) => n > 0)
    .map(([key, n]) => `${Math.ceil(n)} ${key === 'life' ? 'LIFE' : key.toUpperCase()}`).join('  /  ');

function label(p, text, x, y, color = C.muted) { p.text(text, x, y, 1.35, color); }
function bar(p, x, y, w, h, value, max, color) {
    p.rect(x, y, w, h, C.line); p.rect(x, y, w * clamp(value / Math.max(1, max), 0, 1), h, color);
}
function button(g, text, x, y, w, h, action, options = {}) {
    const p = g.painter, selected = g.menuSelection ? g.menuSelection === action : options.selected;
    const color = options.color || C.teal, disabled = options.disabled;
    p.rect(x, y, w, h, selected && !disabled ? color : C.raised);
    p.rect(x, y, .3, h, disabled ? C.line : color);
    p.text(text, x + 2, y + h / 2 - 1, options.size || 1.75,
        disabled ? C.muted : selected ? C.void : C.text);
    if (!disabled) g.buttons.push({ x, y, w, h, action });
}

function hud(g) {
    const p = g.painter, e = g.engine, s = SECTORS[e.sector] || {};
    p.rect(0, 0, 160, 14, C.void); p.rect(0, 13.75, 160, .25, C.line);
    p.text('WORLD EATER', 4, 2.7, 2.65, C.text);
    label(p, `${String(e.sector + 1).padStart(2, '0')} / 05`, 34, 3.1, C.gold);
    p.text(s.name || 'THE NURSERY', 45, 2.7, 2.3, C.gold);
    const items = [['ore', 'ORE', C.gold], ['crystal', 'CRYSTAL', C.blue], ['life', 'LIFE', C.teal]];
    items.forEach(([key, text, c], i) => {
        const x = 105 + i * 18; label(p, text, x, 2.4, c);
        p.text(number(e.cargo[key]), x, 5.7, 2.8, C.text);
    });
    label(p, `ARK ${Math.ceil(e.core.hp)} / ${Math.ceil(e.core.maxHp)}`, 4, 8.3,
        e.core.hp / e.core.maxHp < .3 ? C.red : C.muted);
    bar(p, 4, 11.2, 23, .65, e.core.hp, e.core.maxHp, C.teal);
    bar(p, 29, 11.2, 12, .65, e.core.shield, e.core.maxShield, C.blue);
    label(p, e.objective || 'Find a world. Feed the machine.', 45, 9.5, C.text);
}

function title(g) {
    const p = g.painter, e = g.engine;
    p.rect(0, 0, 160, 14, C.void); p.rect(0, 74, 160, 16, C.void);
    p.rect(8, 18, 8, .45, C.teal);
    label(p, 'A COOPERATIVE COSMIC ODYSSEY', 19, 17.6, C.teal);
    p.text('WORLD', 8, 24, 13, C.text);
    p.text('EATER', 8, 37, 13, C.gold);
    p.text('Become the thing the stars are afraid of.', 9, 53, 2.25, C.text);
    label(p, 'Devour planets. Grow a living machine. Face the last sun.', 9, 58, C.muted);
    if (e.hasCheckpoint) {
        button(g, 'CONTINUE EXPEDITION', 9, 64, 44, 8, 'resume', { selected: true });
        button(g, 'NEW VOYAGE', 56, 64, 29, 8, 'start', { color: C.gold });
    } else {
        button(g, 'AWAKEN THE MACHINE', 9, 64, 49, 8, 'start', { selected: true });
        button(g, 'HOW TO PLAY', 61, 64, 27, 8, 'help', { color: C.gold });
    }
    label(p, 'FIVE SYSTEMS', 10, 79, C.gold);
    label(p, 'ONE EVOLVING ARK', 44, 79, C.gold);
    label(p, '1–6 PILOTS', 88, 79, C.gold);
    label(p, 'KEYBOARD · TOUCH · CONTROLLER', 114, 79, C.gold);
    label(p, `${e.players.size || 0} PILOT${e.players.size === 1 ? '' : 'S'} ABOARD`, 10, 85, C.muted);
    label(p, 'ENTER TO AWAKEN  /  H FOR FLIGHT MANUAL', 44, 85, C.muted);
    button(g, g.sound ? 'SOUND ON' : 'SOUND OFF', 133, 3, 23, 6, 'sound', { size: 1.4 });
}

function cockpit(g) {
    const p = g.painter, e = g.engine;
    p.rect(0, 74, 160, 16, C.void); p.rect(0, 74, 160, .25, C.line);
    const message = e.messages && e.messages[e.messages.length - 1];
    label(p, message && e.time - message.at < 7 ? message.text :
        g.map ? 'STAR CHART / hold a world to fly toward it. M returns to your ship.' :
        'Hold / drag to fly and feed  ·  WASD move  ·  Space fire  ·  E harvest  ·  Shift boost', 4, 75, C.muted);
    button(g, `Q  NOVA ${Math.floor(e.core.energy)}%`, 4, 78, 29, 6.1, 'nova',
        { color: C.violet, disabled: e.core.energy < 100, size: 1.55 });
    button(g, 'R  RESCUE', 35, 78, 23, 6.1, 'rescue', { color: C.teal, size: 1.55 });
    button(g, 'TAB  ROLE', 60, 78, 24, 6.1, 'role', { color: C.gold, size: 1.55 });
    button(g, g.map ? 'M  CLOSE MAP' : 'M  STAR MAP', 86, 78, 29, 6.1, 'map', { size: 1.55 });
    button(g, e.gateReady ? 'F  ENTER FORGE' : 'H  MANUAL', 117, 78, 39, 6.1,
        e.gateReady ? 'forge' : 'help', { color: e.gateReady ? C.gold : C.muted, size: 1.55 });
    if (e.boss && e.boss.hp > 0) {
        const bossName = e.boss.name || (SECTORS[e.sector] || {}).boss;
        p.text(bossName, 80, 15.5, 1.5, C.red, 'center');
        bar(p, 54, 18, 52, .7, e.boss.hp, e.boss.maxHp, C.red);
    } else if (e.sectorTime < 14) {
        p.text((SECTORS[e.sector] || {}).subtitle || 'Everything here can become part of you.', 80, 19, 1.8, C.muted, 'center');
    }
    if (e.gateReady) {
        p.rect(46, 63, 68, 8, C.panel);
        p.text('GUARDIAN SILENCED', 80, 64.2, 2.15, C.gold, 'center');
        label(p, 'Enter the forge to evolve, repair, and jump.', 54, 68, C.text);
    }
    if (e.core.hp / e.core.maxHp < .25 && !g.reduced) {
        p.rect(0, 14, 160, .4, C.red, .5 + .4 * Math.sin(e.time * 5));
        label(p, 'ARK CRITICAL / protect the heart', 6, 16, C.red);
    }
}

function forge(g) {
    const p = g.painter, e = g.engine;
    p.rect(0, 14, 160, 76, C.void);
    label(p, 'SAFE ORBIT / EVOLUTION CHAMBER', 7, 17.7, C.teal);
    p.text('THE BLACK FORGE', 7, 22, 5.9, C.text);
    label(p, 'What you consume becomes what you are. Install modules before the next jump.', 7, 29.5);
    UPGRADES.forEach((u, i) => {
        const x = 7 + i % 3 * 49, y = 34 + Math.floor(i / 3) * 18.6, cost = e.getUpgradeCost(u.id);
        const affordable = cost && Object.entries(cost).every(([key, n]) => e.cargo[key] >= n);
        const selected = g.menuSelection === `buy:${u.id}`;
        p.rect(x, y, 46, 16, selected ? C.raised : C.panel);
        p.rect(x, y, .4, 16, affordable ? C.teal : C.line);
        p.ngon(x + 5, y + 4.6, 2.3, 4 + i % 3, g.clock * .15, null, i % 2 ? C.gold : C.teal);
        p.text(u.name.toUpperCase(), x + 10, y + 2, 2, C.text);
        label(p, `LEVEL ${e.upgrades[u.id] || 0}`, x + 10, y + 5.3, C.gold);
        label(p, (u.description || '').slice(0, 58), x + 2, y + 9, C.muted);
        label(p, costText(cost), x + 2, y + 12.5, affordable ? C.teal : C.muted);
        if (affordable) g.buttons.push({ x, y, w: 46, h: 16, action: `buy:${u.id}` });
    });
    label(p, 'THE ARK IS REPAIRED FOR THE NEXT CROSSING.', 7, 76, C.teal);
    label(p, 'Progress saves automatically. All pilots share these upgrades.', 7, 80, C.muted);
    button(g, `JUMP TO SYSTEM ${Math.min(5, e.sector + 2)}  >`, 105, 75, 47, 9, 'jump', { color: C.gold });
    label(p, 'ARROWS SELECT  /  ENTER INSTALLS  /  J JUMPS', 7, 85.5);
}

function ending(g) {
    const p = g.painter, e = g.engine, won = e.phase === 'won';
    p.rect(6, 20, 98, 51, C.void, .95);
    label(p, won ? 'TRANSMISSION FROM BEYOND THE LAST SUN' : 'BLACK BOX / FINAL TRANSMISSION', 11, 24, won ? C.teal : C.red);
    p.text(won ? 'YOU ATE THE NIGHT.' : 'EVEN GODS GO HUNGRY.', 11, 31, won ? 6.3 : 4.9, C.text);
    p.text(won ? 'And left a new universe in your wake.' : 'The heart is silent. The stars remember.', 11, 41, 2.3, C.muted);
    const stats = e.stats || {};
    p.text(`${number(stats.consumed)} WORLDS CONSUMED    ${number(stats.rescued)} LIVES RESCUED`, 11, 48, 1.65, C.gold);
    p.text(`${number(stats.kills)} HOSTILES SILENCED    SYSTEM ${e.sector + 1} / 5`, 11, 53, 1.65, C.teal);
    button(g, 'ANOTHER UNIVERSE', 11, 60, 43, 8, 'start', { selected: true });
    button(g, 'TITLE', 57, 60, 20, 8, 'title', { color: C.gold });
    p.rect(0, 74, 160, 16, C.void);
    label(p, won && stats.rescued > 0 ? 'The people you carried will name the new stars. Perhaps that was the point.' :
        won ? 'A new beginning, built from the bones of everything before it.' : 'Upgrade the carapace, rescue living worlds, and keep moving during boss attacks.', 8, 80, C.muted);
}

function manual(g) {
    const p = g.painter;
    p.rect(4, 15, 152, 59, C.void);
    label(p, 'FIELD MANUAL / READ BEFORE FEEDING', 9, 18.5, C.teal);
    p.text('HOW TO BECOME A WORLD EATER', 9, 23, 4.25, C.text);
    const blocks = [
        ['01  PILOT YOUR DRONE', 'WASD / left stick, or hold and drag the world.', 'Your enormous ark follows its crew. Stay together.'],
        ['02  FEED OR SAVE', 'Hold E / left trigger near a planet to harvest.', 'R / Y rescues living worlds. Both advance your journey.'],
        ['03  KILL THE GUARDIAN', 'Space / right trigger fires. Shift / A boosts.', 'Meet the world quota. Dodge red beams. Q / X unleashes nova.'],
        ['04  EVOLVE AND CROSS', 'F opens the forge when the guardian is dead.', 'Spend resources on permanent modules. Survive all five systems.'],
    ];
    blocks.forEach(([heading, a, b], i) => {
        const x = 9 + i % 2 * 74, y = 34 + Math.floor(i / 2) * 16;
        label(p, heading, x, y, C.gold); p.text(a, x, y + 3.5, 1.5, C.text); p.text(b, x, y + 7, 1.4, C.muted);
    });
    button(g, 'UNDERSTOOD / H', 106, 66, 43, 6, 'help', { selected: true, size: 1.55 });
}

function pause(g) {
    const p = g.painter;
    p.rect(39, 22, 82, 47, C.void, .96);
    label(p, 'ALL SYSTEMS HOLDING', 46, 27, C.gold);
    p.text('BETWEEN HEARTBEATS', 46, 33, 4, C.text);
    button(g, 'RESUME / P', 46, 43, 68, 7, 'pause', { selected: true });
    button(g, g.sound ? 'SOUND ON' : 'SOUND OFF', 46, 53, 32, 6, 'sound', { size: 1.5 });
    button(g, g.reduced ? 'FX REDUCED' : 'FX FULL', 81, 53, 33, 6, 'effects', { size: 1.5 });
    label(p, 'A checkpoint is saved while the universe waits.', 46, 63, C.muted);
}

function renderUI(g) {
    g.buttons = [];
    const phase = g.engine.phase;
    if (phase === 'title') title(g);
    else {
        hud(g);
        if (phase === 'forge') forge(g);
        else if (phase === 'won' || phase === 'lost') ending(g);
        else cockpit(g);
    }
    if (g.guide) { g.buttons = []; manual(g); }
    else if (g.engine.paused && phase === 'play') { g.buttons = []; pause(g); }
}

function renderPersonal(g, person) {
    const p = person.painter, e = g.engine, pilot = e.players.get(person.id);
    p.begin();
    if (pilot && e.phase === 'play') {
        const role = ROLES.find(r => r.id === pilot.role) || {};
        p.text(`YOU / ${person.name.toUpperCase().slice(0, 17)} / ${(role.name || pilot.role).toUpperCase()}`, 4, 86.2, 1.3, role.color || C.teal);
        const hint = person.noticeUntil > g.clock ? person.notice :
            pilot.respawn > 0 ? `DRONE REBUILDING ${Math.ceil(pilot.respawn)}s / the ark must survive` :
            `${Math.ceil(pilot.hp)} HULL  /  ${e.players.size} PILOT${e.players.size === 1 ? '' : 'S'}  /  P PAUSE`;
        p.text(hint, 156, 86.2, 1.3, person.noticeUntil > g.clock ? C.gold : C.muted, 'right');
    }
    p.end();
}

module.exports = { renderUI, renderPersonal, C, costText };
