const { C, WEAPONS } = require('./settings');
const { polygon, ship, emblem, wrap, combat } = require('./scene');
const { FACTIONS, UNITS, TYPES } = require('./war-settings');
const TAU = Math.PI * 2;
const count = (n, faction) => n.battle.force(faction, true).length;
const clock = t => Math.floor(t / 60)+':'+String(Math.floor(t % 60)).padStart(2, '0');
const freeSocket = (n, i) => !n.sockets[i] && !n.queue.some(q => q.socket === i);
function button(d, text, x, y, w, h, action, enabled = true, color = C.cyan, size = 1.45) {
    const quiet = color === C.line || color === C.teal;
    d.rect(x, y, w, h, enabled && !quiet ? color : C.panel);
    if (!enabled || quiet) d.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], null, enabled ? color : C.line, .1);
    d.text(text, x + w / 2, y + (h - size) / 2, size, enabled ? quiet ? C.white : C.bg : C.dim, 'center');
    if (enabled) d.hit(x, y, w, h, action);
}
function geom(d, x, y, r = .9, color = C.cyan) { d.poly(polygon(x, y, r, 4), color); }
function unitIcon(d, kind, x, y, color = C.cyan, r = 1.5) {
    if (kind === 'seeker') d.poly(polygon(x, y, r, 4), null, color, .18);
    else if (kind === 'bastion') { d.poly(polygon(x, y, r, 4, Math.PI / 4), null, color, .25); d.line(x - r, y, x + r, y, color, .18); }
    else if (kind === 'warden') { d.poly(polygon(x, y, r, 6), null, color, .16); d.arc(x, y, r * 1.4, -.8, 1.6, color, .16); }
    else { d.poly(polygon(x, y, r, kind === 'rail' ? 3 : 4, -Math.PI / 2), null, color, .18); d.line(x, y, x, y - r * 1.5, color, .2); }
}
function hull(d, p, x, y, spacing = 2.2) {
    for (let i = 0; i < p.maxHp; i++) d.rect(x + i * spacing, y, spacing - .5, 1.3, i < p.hp ? C.cyan : C.line);
}
function backdrop(d, w) {
    d.rect(0, 0, 160, 90, C.bg);
    for (let i = 0; i < 36; i++) d.rect((i * 37.7) % 158 + 1, (i * 13.9) % 88 + 1, .09, .09, C.line);
    d.text('V / S', 6, 4.5, 2.5, C.cyan);
    d.text('Take the red core.', 23, 5.2, 1.5, C.dim);
    geom(d, 84, 6.6, 1.1); d.text(Math.floor(w.bank[1]), 87, 4.4, 2.5, C.cyan);
    d.text('+'+w.income(1).toFixed(1)+'/s', 104, 5.5, 1.1, C.dim);
    button(d, w.paused ? w.time ? 'Resume' : 'Start' : 'Pause', 119, 3.5, 17, 6, 'w:pause', true, w.paused ? C.cyan : C.line);
    button(d, w.speed+'x', 138, 3.5, 8, 6, 'w:speed', true, C.line, 1.3);
    button(d, '?', 148, 3.5, 7, 6, 'w:help', true, C.line, 1.7);
}
function sector(d, w) {
    backdrop(d, w);
    const reachable = new Set(w.order ? w.nodes.filter(n => n.id !== w.order.from && w.path(w.order.from, n.id, 1)).map(n => n.id) : []);
    // In destination mode, the route network itself becomes the instruction.
    const routes = new Set();
    if (w.order) for (const id of reachable) {
        const route = w.path(w.order.from, id, 1);
        for (let i = 1; i < route.length; i++) routes.add([route[i-1], route[i]].sort((a,b)=>a-b).join(':'));
    }
    for (const [a, b] of w.edges) {
        const n = w.nodes[a], m = w.nodes[b], lit = routes.has([a,b].sort((a,b)=>a-b).join(':'));
        d.line(n.x, n.y, m.x, m.y, lit ? C.cyan : n.owner === 1 && m.owner === 1 ? C.teal : C.line, lit ? .3 : .12);
        if (lit) {
            const q = (w.time * .22) % 1;
            geom(d, n.x + (m.x - n.x) * q, n.y + (m.y - n.y) * q, .35);
        }
    }
    for (const n of w.nodes) if (n.rally !== null && n.owner === 1 && w.selected === n.id) {
        const target = w.nodes[n.rally]; d.line(n.x, n.y, target.x, target.y, C.blue, .13);
    }
    w.nodes.forEach(n => {
        const selected = w.selected === n.id, battle = n.battle, target = reachable.has(n.id);
        const color = w.order && !target && !selected ? C.line : FACTIONS[n.owner];
        if (selected) d.poly(polygon(n.x, n.y, 5.1, 32), null, C.white, .13);
        if (target) for (const a of [0, Math.PI]) d.arc(n.x, n.y, 5.4, a + .3, Math.PI - .6, C.cyan, .2);
        if (battle.contested()) d.poly(polygon(n.x, n.y, 4.5 + Math.sin(w.time * 5) * .3, 4, Math.PI / 4), null, C.orange, .18);
        emblem(d, n.x, n.y, TYPES[n.type].emblem, n.home ? 3.4 : 2.6, color, w.time, selected);
        if (battle.core.hp < battle.core.maxHp * .98) {
            d.rect(n.x - 3, n.y - 4.4, 6, .35, C.line); d.rect(n.x - 3, n.y - 4.4, 6 * battle.core.hp / battle.core.maxHp, .35, color);
        }
        const blue = count(n, 1), red = count(n, 2) + count(n, 0);
        const label = battle.contested() ? blue+' : '+red : String(blue + red);
        ship(d, n.x - 2, n.y + 6.6, 0, .38, battle.contested() ? C.orange : color);
        d.text(label, n.x + .1, n.y + 5.6, 1.55, battle.contested() ? C.orange : color);
        if (selected || n.home) d.text(n.name, n.x, n.y - 8, 1.1, selected ? C.white : color, 'center');
        if (n.queue.length) d.arc(n.x, n.y, 3.8, -.5 * Math.PI, (1 - Math.max(0, n.queue[0].remaining) / n.queue[0].duration) * TAU, C.yellow, .18);
        if (n.auto) geom(d, n.x + 4.3, n.y + 3.5, .45, C.blue);
        if (!w.order || target || selected) d.hit(n.x - 6, n.y - 5.5, 12, 14, 'w:node:'+n.id);
    });
    for (const f of w.fleets.slice(0, 30)) {
        const from = w.nodes[f.route[f.leg]], to = w.nodes[f.route[f.leg + 1]], q = Math.min(1, f.progress);
        if (!to) continue;
        const x = from.x + (to.x - from.x) * q, y = from.y + (to.y - from.y) * q;
        const a = Math.atan2(to.y - from.y, to.x - from.x);
        d.line(x, y, x - Math.cos(a) * 2.5, y - Math.sin(a) * 2.5, FACTIONS[f.faction], .13);
        ship(d, x, y, a, .55, FACTIONS[f.faction]);
        d.text(f.units.length, x + 1.6, y - 1.1, 1.15, FACTIONS[f.faction]);
    }
    if (!w.hero.rebuild) {
        const travel = w.hero.travel, a = w.nodes[travel ? travel.route[travel.leg] : w.hero.node], b = travel ? w.nodes[travel.route[travel.leg + 1]] : a;
        const q = travel ? travel.progress : 0, x = a.x + (b.x - a.x) * q, y = a.y + (b.y - a.y) * q;
        ship(d, x + (travel ? 0 : -6.8), y, travel ? Math.atan2(b.y - a.y, b.x - a.x) : 0, .8, C.white, true);
    }
    if (w.order) d.text('Choose a glowing outpost', 57, 15, 1.45, C.cyan, 'center');
    else {
        const notice = w.notices[0];
        if (notice && w.time - notice.time < 5) {
            d.text(notice.text, 57, 15, 1.2, C.white, 'center');
            if (notice.node !== null) d.hit(6, 13, 106, 5, 'w:node:'+notice.node);
        }
    }
    panel(d, w);
    // The pilot has its own drawer; its loadout never competes with fleet orders.
    d.rect(6, 81, 31, 6, C.panel); ship(d, 9.5, 84, 0, .8, C.white);
    d.text('Pilot', 13, 81.7, 1.4, C.white); hull(d, w.pilot.player, 13, 84.8, 1.8);
    d.hit(6, 81, 31, 6, 'w:panel:pilot');
    if (w.hero.travel || w.hero.rebuild) d.text(w.hero.rebuild ? 'Rebuilding '+Math.ceil(w.hero.rebuild)+'s' : 'Travelling', 40, 83, 1.2, C.dim);
    if (w.paused) d.text('Paused', 80, 83, 1.2, C.dim, 'center');
    d.text(clock(w.time), 110, 83, 1.2, C.dim, 'right');
}
function panelFrame(d, title, subtitle, color = C.white) {
    d.rect(116, 20, 39, 57, C.panel); d.rect(116, 20, .3, 57, color);
    d.hit(116, 20, 39, 57, 'w:noop');
    d.text(title, 119, 24, 2.5, color);
    if (subtitle) d.text(subtitle, 119, 29, 1.15, C.dim);
}
function queue(d, n) {
    if (!n.queue.length) return;
    d.text(n.battle.contested() ? 'Building slowly' : 'Building', 119, 70.5, 1, C.dim);
    n.queue.forEach((q, i) => {
        const x = 139 + i * 2.7;
        d.rect(x, 71, 2, 2, C.line); d.rect(x, 71, 2 * (i ? 1 : 1 - Math.max(0,q.remaining) / q.duration), 2, i ? C.teal : C.yellow);
    });
}
function panel(d, w) {
    const n = w.nodes[w.selected], ours = n.owner === 1, b = n.battle;
    if (w.panel === 'pilot') { pilot(d, w); return; }
    panelFrame(d, n.name, TYPES[n.type].name, FACTIONS[n.owner]);
    if (w.order) {
        d.text(w.order.kind === 'rally' ? 'Rally destination' : 'Send fleet', 119, 37, 1.7, C.white);
        if (w.order.kind === 'fleet') {
            const all = w.order.fraction === 1;
            button(d, 'Half', 119, 43, 16, 6, 'w:send:half', true, all ? C.line : C.cyan);
            button(d, 'All', 137, 43, 15, 6, 'w:send:all', true, all ? C.cyan : C.line);
            const ready = b.force(1, true).filter(u=>u.spawn <= 0).length;
            ship(d, 122, 56, 0, 1, C.cyan); d.text(Math.ceil(ready * w.order.fraction)+' ships', 127, 54.5, 1.8, C.white);
        }
        button(d, 'Cancel', 119, 65, 33, 6, 'w:cancel', true, C.line); return;
    }
    if (w.panel) button(d, '‹', 147, 23, 5, 5, 'w:panel', true, C.line, 2);
    else button(d, 'i', 147, 23, 5, 5, 'w:panel:info', true, C.line);
    if (w.panel === 'build' && ours) { build(d, w, n); return; }
    if (w.panel === 'orders' && ours) {
        d.text('Reinforcements', 119, 37, 1.6, C.white);
        button(d, n.auto ? 'Auto Seekers: on' : 'Auto Seekers: off', 119, 43, 33, 6, 'w:auto', true, n.auto ? C.cyan : C.line, 1.3);
        d.text('Keep 8 ships · 14 each',119,51,1.05,C.dim);
        button(d, n.rally === null ? 'Set rally point' : 'Clear rally point', 119, 57, 33, 6, 'w:rally', true, n.rally === null ? C.line : C.blue, 1.3);
        if (n.rally !== null) d.text('To '+w.nodes[n.rally].name, 119, 67, 1.1, C.dim);
        return;
    }
    if (w.panel === 'info') {
        wrap(d, n.home === 2 ? 'Capture this core to win.' : TYPES[n.type].description, 119, 36, 32, 1.4, C.white);
        d.text(n.trait.name, 119, 49, 1.2, C.yellow);
        wrap(d, n.trait.id === 'salvage' && n.bountyPaid ? 'Cache claimed' : n.trait.text, 119, 53, 32, 1.35, C.dim);
        d.text('Core '+Math.ceil(b.core.hp)+' / '+b.core.maxHp, 119, 63, 1.2, FACTIONS[n.owner]);
        d.text(count(n,n.owner)+' ships · '+b.force(n.owner).filter(u=>UNITS[u.kind].static).length+' turrets',119,68,1.2,C.dim);
        return;
    }
    ship(d, 121, 36, 0, .65, FACTIONS[n.owner]); d.text(count(n, n.owner), 124, 34.8, 1.6, C.white);
    geom(d, 138, 36, .75); d.text('+'+(TYPES[n.type].income * (n.trait.income || 1)).toFixed(1)+'/s', 140, 34.8, 1.3, C.dim);
    const mobile = b.force(1, true).some(u => u.spawn <= 0);
    if (mobile) button(d, 'Send', 119, 42, 33, 6.5, 'w:send:half', true, C.cyan, 1.7);
    if (ours) button(d, 'Build', 119, 51, 33, 6.5, 'w:panel:build', true, C.line, 1.7);
    else if (!mobile) {
        emblem(d, 135.5, 47.5, TYPES[n.type].emblem, 5, FACTIONS[n.owner], w.time);
    }
    button(d, w.hero.travel ? 'Travelling…' : w.hero.rebuild ? 'Rebuilding…' : 'Dive in', 119, 60, 33, 6.5, 'w:dive', !w.hero.travel && !w.hero.rebuild, C.line, 1.7);
    if (ours) { d.text('Orders', 135.5, 71, 1.3, C.dim, 'center'); d.hit(119, 69, 33, 6, 'w:panel:orders'); }
}
function build(d, w, n) {
    const defenses = w.buildTab === 'defenses';
    button(d, 'Ships', 119, 34, 16, 5.5, 'w:tab:ships', true, defenses ? C.line : C.cyan, 1.3);
    button(d, 'Defenses', 137, 34, 15, 5.5, 'w:tab:defenses', true, defenses ? C.blue : C.line, 1.3);
    const kinds = defenses ? ['pulse','rail'] : ['seeker','bastion','warden'];
    if (defenses) {
        d.text('Place', 119, 43.2, 1.1, C.dim);
        for (let i=0; i<3; i++) {
            const x = 135 + i * 7, available = freeSocket(n, i), color = w.socket === i ? C.blue : C.dim;
            d.poly(polygon(x, 44, 2.1, 6), available ? null : C.line, color, w.socket === i ? .22 : .1);
            if (!available) d.line(x-1,44,x+1,44,color,.18); else geom(d,x,44,.35,color);
            d.hit(x-3,41,6,6,'w:socket:'+i);
        }
    }
    kinds.forEach((kind,i) => {
        const y = (defenses ? 49 : 42) + i * 9, cost = w.cost(n,kind), enough = w.bank[1] >= cost;
        const enabled = enough && n.queue.length < 5 && n.battle.force(1).length + n.queue.length < 24 && (!defenses || freeSocket(n,w.socket));
        const color = enabled ? defenses ? C.blue : C.cyan : C.dim;
        d.rect(119,y,33,7.7,C.bg); unitIcon(d,kind,122,y+3.8,color,1.35);
        d.text(UNITS[kind].name.replace(' TURRET',''),125,y+1,1.45,color);
        d.text({seeker:'Fast',bastion:'Armor',warden:'Shield',pulse:'Rapid fire',rail:'Long range'}[kind],125,y+4.6,1.05,C.dim);
        geom(d,145,y+3.8,.55,color); d.text(cost,148,y+2.7,1.6,color,'center');
        if (enabled) d.hit(119,y,33,7.7,'w:buy:'+kind);
    });
    queue(d,n);
}
function pilot(d,w) {
    const p=w.pilot.player, available=!w.hero.travel && !w.hero.rebuild && w.nodes[w.hero.node].owner===1;
    panelFrame(d,'Your pilot',w.hero.rebuild ? 'Rebuilding '+Math.ceil(w.hero.rebuild)+'s' : w.hero.travel ? 'Travelling' : w.nodes[w.hero.node].name);
    button(d,'‹',147,23,5,5,'w:panel',true,C.line,2); hull(d,p,119,34);
    WEAPONS.forEach((weapon,i)=>button(d,weapon.name,119,39+i*7.2,33,5.5,'w:weapon:'+weapon.id,available,w.pilot.weapon===weapon.id?weapon.color:C.line,1.25));
    button(d,'Repair · 20',119,62,15.5,6,'w:repair',available && w.bank[1]>=20 && p.hp<p.maxHp,C.line,1.2);
    button(d,'Upgrade · 70',136,62,16,6,'w:module',w.bank[1]>=70,C.violet,1.15);
}
function battleHud(d,b) {
    const w=b.war,p=b.player;
    d.rect(0,0,160,13,C.bg); d.rect(0,80,160,10,C.bg);
    d.text(b.outpost.name,6,4,2.4,C.white); hull(d,p,64,6,2.5);
    geom(d,133,6,1); d.text(Math.floor(w.bank[1]),137,4.1,2.1,C.cyan);
    d.text('×'+Math.floor(b.multiplier),154,8.4,1.1,C.dim,'right');
    button(d,'Map  G',6,82,20,5.5,'w:back',true,C.line,1.35);
    if(b.outpost.owner===1) button(d,'Build',29,82,17,5.5,'w:panel:build',true,w.panel==='build'?C.blue:C.line,1.35);
    d.text('Space',66,85,1.05,C.dim);
    for(let i=0;i<2;i++) d.rect(66+i*5.4,82,4.2,1.4,i<p.charges?C.blue:C.line);
    d.arc(94,84.5,2.5,-Math.PI/2,TAU,C.line,.18);
    d.arc(94,84.5,2.5,-Math.PI/2,TAU*b.flux/100,b.overload>0?C.white:C.violet,.23);
    d.text('Q',94,83.5,1.4,b.flux>=100?C.white:C.violet,'center');
    if(b.flux>=100) d.text('Overload',99,83.4,1.15,C.violet);
    button(d,w.paused?'Resume':'Pause',134,82,20,5.5,'w:pause',true,w.paused?C.cyan:C.line,1.35);
    if(w.panel==='build') panel(d,w);
    const alert=w.notices.find(n=>n.node!==w.selected && w.time-n.time<5);
    if(alert) d.text(alert.text,80,14,1.1,C.yellow,'center');
}
function help(d,w) {
    d.rect(0,0,160,90,C.bg);
    d.text('Take the red core.',80,12,4.5,C.white,'center');
    const items=[['Send','Choose where your fleet goes.'],['Build','Grow your fleet. Defend your worlds.'],['Dive in','Fly the battle yourself.']];
    items.forEach(([title,caption],i)=>{
        const x=30+i*50;
        if(i===0) { emblem(d,x-8,35,'fortress',3,C.cyan); d.line(x-3,35,x+6,35,C.teal,.18); ship(d,x+7,35,0,1.5,C.cyan,true); }
        if(i===1) { unitIcon(d,'seeker',x-7,35,C.cyan,2.6); unitIcon(d,'bastion',x,35,C.cyan,2.6); unitIcon(d,'warden',x+8,35,C.blue,2.6); }
        if(i===2) ship(d,x,35,-.5,3,C.white,true);
        d.text(title,x,45,2.7,C.cyan,'center'); d.text(caption,x,52,1.15,C.dim,'center');
    });
    d.text('WASD move   ·   Mouse aim + fire   ·   Space dash   ·   Q overload',80,64,1.35,C.dim,'center');
    button(d,'Back',84,74,42,7,'w:help',true,C.cyan,1.7);
    button(d,'End run',34,74,42,7,'w:leave',true,C.line,1.4);
}
function modules(d,w) {
    d.rect(0,0,160,90,C.bg);
    d.text('Choose an upgrade',80,20,4.5,C.white,'center');
    w.choices.forEach((m,i)=>{
        const x=8+i*50; d.rect(x,37,46,34,C.panel); d.text(m.tag,x+3,41,1.1,m.color);
        d.text(m.name,x+3,46,2.1,C.white); wrap(d,m.text,x+3,52,39,1.25,C.dim);
        button(d,'Install',x+3,64,40,4.5,'w:mod:'+i,true,m.color,1.25);
    });
}
function ending(d,w) {
    const won=w.result==='won'; d.rect(0,0,160,90,C.bg);
    d.text(won?'SECTOR LIBERATED':'COMMAND LOST',80,23,6,won?C.cyan:C.red,'center');
    d.text(clock(w.time)+'   ·   '+w.stats.captures[1]+' captures   ·   '+w.stats.dives+' dives',80,40,1.6,C.dim,'center');
    if(won&&!w.stats.dives) d.text('Commander victory',80,50,2,C.yellow,'center');
    button(d,'New sector',44,65,34,7,'w:new',true,C.cyan,1.6);
    button(d,'Retry',82,65,34,7,'w:retry',true,C.line,1.6);
}
function renderWar(d,w) {
    d.begin();
    if(w.result) ending(d,w);
    else if(w.help) help(d,w);
    else if(w.choices) modules(d,w);
    else {
        if(w.activeBattle) combat(d,w.activeBattle,battleHud); else sector(d,w);
        if(w.paused && w.activeBattle && !w.panel) {
            d.rect(55,37,50,17,C.panel); d.text('Paused',80,40,2.7,C.white,'center');
            button(d,'Resume',66,47,28,5,'w:pause',true,C.cyan,1.4);
        }
    }
    d.end();
}
module.exports={renderWar};
