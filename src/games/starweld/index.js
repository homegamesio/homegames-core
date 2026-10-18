'use strict';

const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');

// All designer-facing numbers live here. POOL entries are hard rendering budgets.
const TUNING = {
    TICK: 60, DIFFICULTY: 1, MAX_PLAYERS: 1,
    PLAYER: { hull: 100, speed: 22, acceleration: 0.18, coreRadius: 1.05, invulnerable: 0.85,
        startX: 50, startY: 68, minX: 15, maxX: 85, minY: 25, maxY: 80,
        cannonDamage: 9, cannonCooldown: 0.48, shotSpeed: 66, range: 100 },
    PULSE: { cooldown: 10, radius: 30, damage: 32, protection: 1.3 },
    SALVAGE: { heal: 0.55, pulse: 0.17, magnet: 19, speed: 45, waveRepair: 8, bossRepair: 20 },
    WAVES: { sectors: 4, perSector: 3, baseCount: 14, sectorCount: 4, secondCount: 4,
        spawnSeconds: 0.9, spawnReduction: 0.09, openingDelay: 1.6, clearDelay: 1.8 },
    ENEMY: {
        scout: { hp: 22, speed: 6.4, radius: 1.8, shotSpeed: 13, cooldown: 3.4, tell: 0.8, damage: 10, scrap: 2 },
        needle: { hp: 40, speed: 9, radius: 2.1, shotSpeed: 17, cooldown: 3.7, tell: 0.8, damage: 10, scrap: 3 },
        tank: { hp: 140, speed: 3.7, radius: 3.3, shotSpeed: 12, cooldown: 4.3, tell: 1, damage: 14, scrap: 5 },
        splitter: { hp: 85, speed: 5.6, radius: 2.7, shotSpeed: 13, cooldown: 4, tell: 0.9, damage: 12, scrap: 4 },
        mine: { hp: 32, speed: 10.5, radius: 1.65, shotSpeed: 0, cooldown: 9, tell: 0.95, damage: 17, scrap: 2 },
        hpPerSector: 0.9, contact: 15, engageRange: 75
    },
    BOSS: { coreHp: [850, 1800, 3200, 5000], podHp: [100, 160, 220, 290],
        podCounts: [2, 3, 4, 4], shotSpeed: 13, tell: 0.95, attackCooldown: 2.8,
        laserTell: 1.4, laserLife: 0.7, laserWidth: 5.2, laserDamage: 22, laserCooldown: 5.6 },
    MODULE: {
        cannon: { damage: 7, cooldown: 0.62, cap: 3 },
        rail: { damage: 34, cooldown: 1.65, cap: 3 },
        missile: { damage: 21, cooldown: 1.6, radius: 5.5, speed: 26, cap: 3 },
        arc: { damage: 17, cooldown: 1.25, range: 44, jump: 19, cap: 3 },
        drone: { damage: 8, cooldown: 0.6, orbit: 10, cap: 3 },
        shield: { capacity: 24, recharge: 5, delay: 3.7, cap: 2 },
        engine: { speed: 0.14, pulse: 0.16, cap: 2 },
        reactor: { damage: 0.2, cap: 3 },
        tierBonus: 0.65
    },
    POOL: { enemies: 22, playerShots: 68, enemyShots: 72, particles: 48, pickups: 24, beams: 14 },
    UI: { actionLock: 0.35, keyExpiry: 0.24, tutorialSeconds: 9 }
};
const DT = 1 / TUNING.TICK;
const C = {
    bg: [7, 12, 22, 255], dark: [12, 23, 36, 255], panel: [16, 30, 44, 255],
    edge: [37, 60, 73, 255], muted: [126, 158, 171, 255], white: [232, 243, 232, 255],
    cyan: [104, 241, 213, 255], cyanDark: [27, 96, 93, 255],
    gold: [255, 204, 119, 255], orange: [250, 132, 83, 255], red: [255, 96, 104, 255],
    violet: [179, 151, 255, 255], blue: [122, 194, 255, 255], steel: [65, 94, 109, 255],
    hull: [175, 196, 191, 255], transparent: [0, 0, 0, 0]
};
const SECTORS = [
    { name: 'RUST BELT', boss: 'THE BREAKER', color: C.orange, sub: 'A graveyard of forgotten fleets.' },
    { name: 'GLASS NEBULA', boss: 'THE ORRERY', color: C.violet, sub: 'Something is moving between the stars.' },
    { name: 'IRON CHOIR', boss: 'IRON CATHEDRAL', color: C.blue, sub: 'The old war machines are still awake.' },
    { name: 'THE LAST LIGHT', boss: 'THE STAR EATER', color: C.gold, sub: 'Bring the stolen sun home.' }
];
const PARTS = {
    cannon: { name: 'TWIN CANNONS', color: C.gold, lines: ['Two barrels. More firepower.', 'Fires rapid paired shots.'] },
    rail: { name: 'RAIL LANCE', color: C.blue, lines: ['A powerful piercing shot.', 'Cuts through entire lines.'] },
    missile: { name: 'ROCKET POD', color: C.orange, lines: ['Guided explosive rockets.', 'Damages clustered enemies.'] },
    arc: { name: 'ARC COIL', color: C.violet, lines: ['Lightning jumps to 3 targets.', 'Excellent against swarms.'] },
    drone: { name: 'ESCORT DRONE', color: C.cyan, lines: ['An orbiting gunship joins you.', 'Fires independently.'] },
    shield: { name: 'AEGIS FIELD', color: C.cyan, lines: ['Adds a recharging shield.', 'Regrows after avoiding hits.'] },
    engine: { name: 'AFTERBURNER', color: C.orange, lines: ['Fly faster. Dodge further.', 'Shockwave recharges faster.'] },
    reactor: { name: 'STAR REACTOR', color: C.gold, lines: ['Every weapon hits harder.', 'Feeds your entire battleship.'] }
};
const SLOTS = [[-3.7,1],[3.7,1],[-7.2,2.6],[7.2,2.6],[-3.7,5.1],[3.7,5.1],
    [-7.2,6.7],[7.2,6.7],[-10.7,4.2],[10.7,4.2],[-3.7,-3.1],[3.7,-3.1]];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, k) => a + (b - a) * k;
const tint = (c, k) => [Math.round(clamp(c[0]*k,0,255)),Math.round(clamp(c[1]*k,0,255)),Math.round(clamp(c[2]*k,0,255)),255];
const alpha = a => [255,255,255,Math.round(clamp(a,0,255))];
const distance = (a, b) => Math.hypot(a.x-b.x,a.y-b.y);
const rect = (x,y,w,h) => ShapeUtils.rectangle(x,y,w,h);
function circle(x,y,r,sides=20,angle=0) {
    const pts=[];
    for(let i=0;i<=sides;i++) { const a=angle+i*Math.PI*2/sides; pts.push([x+Math.cos(a)*r,y+Math.sin(a)*r]); }
    return pts;
}
function line(x,y,tx,ty,w) {
    const a=Math.atan2(ty-y,tx-x),dx=Math.sin(a)*w/2,dy=Math.cos(a)*w/2;
    return [[x-dx,y+dy],[tx-dx,ty+dy],[tx+dx,ty-dy],[x+dx,y-dy],[x-dx,y+dy]];
}
function arc(x,y,r,width,start,end,steps=28) {
    const pts=[];
    for(let i=0;i<=steps;i++){const a=mix(start,end,i/steps);pts.push([x+Math.cos(a)*r,y+Math.sin(a)*r]);}
    for(let i=steps;i>=0;i--){const a=mix(start,end,i/steps);pts.push([x+Math.cos(a)*(r-width),y+Math.sin(a)*(r-width)]);}
    pts.push(pts[0]);return pts;
}
function transform(pts,x,y,scale=1,a=0) {
    const co=Math.cos(a),si=Math.sin(a);
    return pts.map(p=>[x+(p[0]*co-p[1]*si)*scale,y+(p[0]*si+p[1]*co)*scale]);
}
// Real polygon clipping, rather than vertex pinning at the edge of the wire plane.
function clip(pts) {
    let out=pts;
    for(let axis=0;axis<2;axis++) for(const edge of [0.2,99.8]) {
        const low=edge<1, input=out; out=[];
        if(!input.length) return rect(0,0,0,0);
        let a=input[input.length-1],ina=low?a[axis]>=edge:a[axis]<=edge;
        for(const b of input) {
            const inb=low?b[axis]>=edge:b[axis]<=edge;
            if(ina!==inb){const t=(edge-a[axis])/(b[axis]-a[axis]);out.push([mix(a[0],b[0],t),mix(a[1],b[1],t)]);}
            if(inb) out.push(b); a=b;ina=inb;
        }
    }
    return out.length>=3?out:rect(0,0,0,0);
}
function shape(pts=rect(0,0,0,0),fill=C.transparent,options={}) {
    return new GameNode.Shape(Object.assign({shapeType:Shapes.POLYGON,coordinates2d:pts,fill,color:alpha(255)},options));
}
function group(){return shape();}
function label(text,x,y,size=2,color=C.white,align='left') {
    return new GameNode.Text({textInfo:{text,x,y,size,color,align,font:'monospace'}});
}
function setText(n,text){if(n&&n.node.text.text!==text)n.node.text=Object.assign({},n.node.text,{text});}
function put(n,pts,fill,opacity=255){n.node.coordinates2d=clip(pts);if(fill)n.node.fill=fill;n.node.color=alpha(opacity);}
function hide(n){n.node.coordinates2d=rect(0,0,0,0);n.node.fill=C.transparent;}
function segmentDistance(px,py,x1,y1,x2,y2) {
    const dx=x2-x1,dy=y2-y1,den=dx*dx+dy*dy;
    const t=den?clamp(((px-x1)*dx+(py-y1)*dy)/den,0,1):0;
    return Math.hypot(px-x1-t*dx,py-y1-t*dy);
}

class Starweld extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name:'STARWELD',
            author: "Joseph Garcia",
            description:'Build a battleship from the wreckage. Steer a salvage ship through four sectors, weld eight kinds of weapons and systems onto your hull, and dismantle four enormous bosses. Automatic weapons, mouse/touch or keyboard steering, and a lifesaving shockwave. A complete solo campaign with checkpoint saves.',
            aspectRatio:{x:1,y:1},
            tickRate:TUNING.TICK,
            maxPlayers: 1,
            gameId: "5d5c5ee8-edd9-5c96-a829-ba9f808a11b1"
        };
    }
    constructor(options={}) {
        super();
        this.base=shape(rect(0,0,100,100),C.bg);
        this.phase='title';this.clock=0;this.time=0;this.token=0;this.lockUntil=0;
        this.owner=null;this.players={};this.keys={};this.target=null;
        this.saveFn=typeof options.saveGame==='function'?options.saveGame:null;
        this.profile=this.readProfile(options.saveData);this.mode=1;
        this.run=null;this.player=null;this.boss=null;this.round=0;
        this.combat=null;this.shipArt=null;this.hud=null;this.pendingDefeat=false;
        this.pools=this.makePools();
        this.showTitle();
    }
    getLayers(){return [{root:this.base}];}
    readProfile(data) {
        const out={best:0,wins:0,checkpoint:null};
        if(!data||typeof data!=='object')return out;
        if(Number.isFinite(data.best))out.best=clamp(Math.floor(data.best),0,1e8);
        if(Number.isFinite(data.wins))out.wins=clamp(Math.floor(data.wins),0,1e5);
        const c=data.checkpoint;
        if(c&&typeof c==='object'&&Number.isInteger(c.round)&&c.round>=0&&c.round<12&&
           Array.isArray(c.modules)&&c.modules.length===c.round&&c.modules.length<=11&&
           c.modules.every(m=>m&&Object.prototype.hasOwnProperty.call(PARTS,m.type)&&(m.tier===1||m.tier===2))&&
           [c.hull,c.scrap,c.kills,c.elapsed,c.seed,c.mode].every(Number.isFinite)) {
            out.checkpoint={round:c.round,modules:c.modules.map(m=>({type:m.type,tier:m.tier})),
                hull:clamp(c.hull,1,TUNING.PLAYER.hull),scrap:clamp(Math.floor(c.scrap),0,1e6),
                kills:clamp(Math.floor(c.kills),0,1e6),elapsed:clamp(c.elapsed,0,1e6),
                seed:(c.seed>>>0)||1,mode:[0.72,1,1.3].includes(c.mode)?c.mode:1};
        }
        return out;
    }
    persist(checkpoint) {
        this.profile.checkpoint=checkpoint;
        if(!this.saveFn)return;
        try { const p=this.saveFn({best:this.profile.best,wins:this.profile.wins,checkpoint});
            if(p&&typeof p.catch==='function')p.catch(()=>{});
        } catch(_error) { /* Saving never interrupts a flight. */ }
    }
    random() {
        this.run.seed=(Math.imul(this.run.seed,1664525)+1013904223)>>>0;
        return this.run.seed/4294967296;
    }
    handleNewPlayer({playerId}) {
        this.players[playerId]=true;
        if(this.owner===null)this.owner=playerId;
    }
    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
        if(playerId!==this.owner)return;
        const next=Object.keys(this.players)[0];this.owner=next===undefined?null:Number(next);
        this.keys={};this.target=null;
        if(this.phase==='battle'||this.phase==='clear')this.pause();
    }
    accepts(playerId){return this.owner===null||Number(playerId)===Number(this.owner);}
    changeScreen(phase) {
        this.phase=phase;this.token++;this.base.clearChildren();this.keys={};this.target=null;
        this.lockUntil=this.clock+TUNING.UI.actionLock;
    }
    button(parent,x,y,w,h,text,action,color=C.cyan,small=false) {
        const token=this.token;
        const b=shape([[x+1,y],[x+w,y],[x+w,y+h-1],[x+w-1,y+h],[x,y+h],[x,y+1],[x+1,y]],color,
            {onClick:(pid)=>{if(this.accepts(pid)&&this.token===token&&this.clock>=this.lockUntil)action();}});
        b.addChild(label(text,x+w/2,y+(h-(small?1.65:2.3))/2,small?1.65:2.3,C.bg,'center'));
        parent.addChild(b);return b;
    }
    backdrop(parent,sector=0,stars=true) {
        const col=SECTORS[sector].color;
        parent.addChild(shape([[0,0],[100,0],[100,76],[66,58],[25,31],[0,35],[0,0]],tint(col,0.055)));
        parent.addChild(shape([[0,52],[27,42],[57,68],[100,70],[100,100],[0,100],[0,52]],[7,18,28,255]));
        parent.addChild(shape(arc(82,30,28,0.12,1.1,5.2),tint(col,0.28)));
        parent.addChild(shape(arc(82,30,32,0.07,1.5,4.7),tint(col,0.14)));
        parent.addChild(shape(circle(82,30,21,64),[11,23,33,255]));
        parent.addChild(shape(arc(82,30,21,1.05,2.2,5.1),tint(col,0.35)));
        parent.addChild(shape(arc(82,30,20,0.22,2.3,4.9),tint(col,0.6)));
        if(stars)for(let i=0;i<50;i++){
            const x=2+(i*37.319)%96,y=1+(i*23.173)%97;
            parent.addChild(shape(rect(x,y,i%8===0?0.22:0.12,i%8===0?0.22:0.12),i%8===0?C.muted:C.edge));
        }
    }
    showTitle() {
        this.changeScreen('title');
        this.backdrop(this.base,0);

        const demo=['cannon','missile','rail','arc','shield','engine','drone','reactor'];
        const art=this.makeShip(this.base,demo.map(type=>({type,tier:1})));
        this.paintShip(art,50,44,1.45,0,0,1);
        this.base.addChild(label('4 SECTORS  /  4 TITANS  /  YOUR SHIP',50,64,1.55,C.gold,'center'));
        const cp=this.profile.checkpoint;
        if(cp) {
            this.button(this.base,22,71,56,9,'CONTINUE FLIGHT',()=>this.start(true));
            this.button(this.base,28,82,44,6,'NEW FLIGHT',()=>this.start(false),C.muted,true);
        } else this.button(this.base,22,73,56,10,'LAUNCH',()=>this.start(false));
        const modeText=this.mode===0.72?'RELAXED':this.mode===1.3?'OVERDRIVE':'STANDARD';
        this.button(this.base,64,2,32,4,'FLIGHT: '+modeText,()=>{
            this.mode=this.mode===1?0.72:this.mode===0.72?1.3:1;this.showTitle();
        },C.muted,true);
        this.base.addChild(label('WASD / ARROWS or hold + drag to steer',50,91,1.55,C.white,'center'));
        this.base.addChild(label('Weapons fire automatically. SPACE = shockwave.',50,95,1.4,C.muted,'center'));
        if(this.profile.best)this.base.addChild(label('BEST '+this.profile.best,4,3,1.5,C.gold));
    }
    start(resume) {
        const cp=resume?this.profile.checkpoint:null;
        this.run=cp?{modules:cp.modules.map(m=>Object.assign({},m)),scrap:cp.scrap,kills:cp.kills,
            elapsed:cp.elapsed,seed:cp.seed,mode:cp.mode}:
            {modules:[],scrap:0,kills:0,elapsed:0,seed:(Math.floor(Math.random()*4294967295)>>>0)||1,mode:this.mode};
        this.round=cp?cp.round:0;
        this.player={x:50,y:68,vx:0,vy:0,hull:cp?cp.hull:TUNING.PLAYER.hull,shield:0,
            invuln:1.5,pulse:0,lastHit:-100,baseCd:0,cooldowns:[],bank:0};
        this.recalculate();this.player.shield=this.stats.shield;this.beginBattle();
    }
    recalculate() {
        let damage=1,speed=1,pulse=1,shield=0,recharge=0;
        for(const m of this.run.modules){
            const v=1+(m.tier-1)*TUNING.MODULE.tierBonus;
            if(m.type==='reactor')damage+=TUNING.MODULE.reactor.damage*v;
            if(m.type==='engine'){speed+=TUNING.MODULE.engine.speed*v;pulse-=TUNING.MODULE.engine.pulse*v;}
            if(m.type==='shield'){shield+=TUNING.MODULE.shield.capacity*v;recharge+=TUNING.MODULE.shield.recharge*v;}
        }
        this.stats={damage,speed:TUNING.PLAYER.speed*speed,pulse:TUNING.PULSE.cooldown*Math.max(0.5,pulse),shield,recharge};
    }
    saveCheckpoint() {
        this.persist({round:this.round,modules:this.run.modules.map(m=>Object.assign({},m)),
            hull:this.player.hull,scrap:this.run.scrap,kills:this.run.kills,elapsed:this.run.elapsed,
            seed:this.run.seed,mode:this.run.mode});
    }
    makeShip(parent,modules,showField=true) {
        const root=group();parent.addChild(root);
        const art={root,parts:[],mounts:[],drones:[],shield:null,core:null,flames:[]};
        const part=(pts,col,kind='body')=>{const n=shape(pts,col);root.addChild(n);art.parts.push({node:n,pts,col,kind});return n;};
        for(let i=0;i<modules.length;i++){
            const m=modules[i],slot=SLOTS[i],s=m.tier===2?1.15:1;
            part(line(0,2,slot[0],slot[1],1.6),C.steel);
            part(circle(slot[0],slot[1],2.25*s,6,Math.PI/6),C.steel);
            part(circle(slot[0],slot[1]-0.18,1.87*s,6,Math.PI/6),C.hull);
            part(circle(slot[0],slot[1]-0.18,1.35*s,6,Math.PI/6),C.dark);
            const col=PARTS[m.type].color;
            const accent=part(rect(slot[0]-0.8,slot[1]+1.08,1.6,0.25),col);
            const gun=shape();const eye=shape();root.addChildren(gun,eye);
            const mount={x:slot[0],y:slot[1],type:m.type,tier:m.tier,gun,eye,accent,angle:-Math.PI/2};
            art.mounts.push(mount);
            if(m.type==='drone') {
                const wing=shape(),glint=shape();root.addChildren(wing,glint);
                art.drones.push({wing,glint,index:i});
            }
            if(m.type==='engine') {
                const flame=part([[slot[0]-0.75,slot[1]+1],[slot[0]+0.75,slot[1]+1],[slot[0],slot[1]+5]],col,'flame');
                art.flames.push(flame);
            }
        }
        part([[-2,4],[-2.8,1],[-1.65,-3],[0,-5.7],[1.65,-3],[2.8,1],[2,4],[-2,4]],C.steel);
        part([[-1.65,2.8],[-2.1,0.5],[0,-5],[2.1,0.5],[1.65,2.8],[-1.65,2.8]],C.hull);
        part([[-1.65,2.8],[-2.1,0.5],[0,-5],[0,2.8],[-1.65,2.8]],[129,156,157,255]);
        part([[-1.05,0],[0,-2.6],[1.05,0],[0,1.6],[-1.05,0]],C.dark);
        part([[-0.85,3.1],[0.85,3.1],[0.5,6.7],[0,8],[-0.5,6.7],[-0.85,3.1]],C.cyan,'flame');
        part(rect(-1.3,2.3,2.6,0.6),C.dark);
        part(circle(0,0,1.28,6,Math.PI/6),C.cyanDark);
        art.core=part(circle(0,0,0.85,6,Math.PI/6),C.cyan,'core');
        art.core.node.effects={shadow:{color:C.cyan,blur:12}};
        if(showField&&modules.some(m=>m.type==='shield')) {
            art.shield=shape();root.addChild(art.shield);
        }
        return art;
    }
    paintShip(art,x,y,scale,a,time,shieldRatio=0) {
        for(const p of art.parts) {
            let pts=p.pts;
            if(p.kind==='flame')pts=p.pts.map(q=>[q[0],q[1]+(q[1]>4?Math.sin(time*29)*0.8:0)]);
            put(p.node,transform(pts,x,y,scale,a),p.kind==='core'&&this.player&&this.player.invuln>0&&Math.floor(time*12)%2?C.white:p.col);
        }
        for(const m of art.mounts) {
            const v=transform([[m.x,m.y]],x,y,scale,a)[0],col=PARTS[m.type].color;
            const angle=m.angle+a,co=Math.cos(angle),si=Math.sin(angle);
            if(m.type==='cannon') {
                put(m.gun,transform([[-1.1,0.8],[-1.1,-2.7],[-0.55,-2.7],[-0.55,-0.3],[0.55,-0.3],[0.55,-2.7],[1.1,-2.7],[1.1,0.8],[-1.1,0.8]],v[0],v[1],scale,angle+Math.PI/2),C.hull);
                put(m.eye,circle(v[0],v[1],0.55*scale,6),col);
            } else if(m.type==='rail') {
                put(m.gun,line(v[0]-co*scale,v[1]-si*scale,v[0]+co*3.2*scale,v[1]+si*3.2*scale,(m.type==='rail'?0.65:1.15)*scale),C.steel);
                put(m.eye,line(v[0],v[1],v[0]+co*2.8*scale,v[1]+si*2.8*scale,0.3*scale),col);
            } else if(m.type==='missile') {
                put(m.gun,transform(rect(-1.05,-1.05,2.1,2.1),v[0],v[1],scale,a),col);
                put(m.eye,transform([[-0.65,0.55],[-0.65,-0.6],[0,-1.15],[0.65,-0.6],[0.65,0.55],[-0.65,0.55]],v[0],v[1],scale,a),C.dark);
            } else if(m.type==='arc') {
                put(m.gun,circle(v[0],v[1],1.1*scale,6,time*0.6),col);
                put(m.eye,circle(v[0],v[1],0.55*scale,6,-time),C.white);
            } else if(m.type==='reactor'){
                put(m.gun,transform(rect(-0.9,-0.9,1.8,1.8),v[0],v[1],scale,Math.PI/4+a),col);
                put(m.eye,transform(rect(-0.4,-0.4,0.8,0.8),v[0],v[1],scale,Math.PI/4+a),C.white);
            } else {
                put(m.gun,circle(v[0],v[1],1.1*scale,m.type==='shield'?6:4,Math.PI/4+a),col);
                put(m.eye,circle(v[0],v[1],0.48*scale,4,a),C.dark);
            }
        }
        for(let i=0;i<art.drones.length;i++) {
            const d=art.drones[i],ang=time*1.5+i*2.5,r=TUNING.MODULE.drone.orbit;
            d.x=x+Math.cos(ang)*r*scale;d.y=y+Math.sin(ang)*r*0.55*scale;
            put(d.wing,transform([[-1.6,1],[0,-2],[1.6,1],[0,0.4],[-1.6,1]],d.x,d.y,scale),C.cyan);
            put(d.glint,circle(d.x,d.y,0.42*scale,4),C.white);
        }
        if(art.shield)put(art.shield,arc(x,y,(modulesRadius(art.mounts.length)+1.6)*scale,0.12*scale,
            Math.PI*0.05,Math.PI*1.95,40),C.cyan,35+Math.round(115*shieldRatio));
    }
    makePools() {
        const root=group(),fxRoot=group(),shotsRoot=group(),enemyRoot=group(),pickupRoot=group();
        root.addChildren(pickupRoot,enemyRoot,shotsRoot,fxRoot);
        const pools={root,enemyRoot,fxRoot,shotsRoot,pickupRoot};
        pools.enemies=Array.from({length:TUNING.POOL.enemies},()=>{
            const nodes=[shape(),shape(),shape(),shape()];enemyRoot.addChildren(...nodes);
            return {active:false,nodes,x:0,y:0,vx:0,vy:0,hp:0,maxHp:0,kind:'scout',age:0,cd:0,tell:0,aim:0,flash:0};
        });
        const shots=(count,friendly)=>Array.from({length:count},()=>{
            const node=shape();shotsRoot.addChild(node);
            return {active:false,node,friendly,x:0,y:0,vx:0,vy:0,life:0,damage:0,radius:0.5,kind:'bullet',pierce:0,hitIds:[],target:null};
        });
        pools.playerShots=shots(TUNING.POOL.playerShots,true);pools.enemyShots=shots(TUNING.POOL.enemyShots,false);
        pools.particles=Array.from({length:TUNING.POOL.particles},()=>{
            const node=shape();fxRoot.addChild(node);return {active:false,node,x:0,y:0,vx:0,vy:0,life:0,total:0,size:0,color:C.gold,angle:0};
        });
        pools.pickups=Array.from({length:TUNING.POOL.pickups},()=>{
            const node=shape();pickupRoot.addChild(node);return {active:false,node,x:0,y:0,vx:0,vy:0,value:0,age:0};
        });
        pools.beams=Array.from({length:TUNING.POOL.beams},()=>{
            const node=shape();fxRoot.addChild(node);return {active:false,node,x:0,y:0,tx:0,ty:0,life:0,total:0,width:0,color:C.blue};
        });
        return pools;
    }
    resetPools() {
        for(const key of ['enemies','playerShots','enemyShots','particles','pickups','beams'])
            for(const p of this.pools[key]){p.active=false;if(p.node)hide(p.node);if(p.nodes)p.nodes.forEach(hide);}
    }
    beginBattle() {
        this.changeScreen('battle');this.pendingDefeat=false;this.time=0;this.clearTime=0;this.boss=null;
        this.player.x=TUNING.PLAYER.startX;this.player.y=TUNING.PLAYER.startY;
        this.player.vx=0;this.player.vy=0;this.player.invuln=1.5;this.player.baseCd=0;
        this.player.lastHit=-100;this.player.shield=this.stats.shield;
        this.player.cooldowns=this.run.modules.map((m,i)=>i*0.07);this.target=null;
        this.resetPools();
        this.sector=Math.floor(this.round/TUNING.WAVES.perSector);
        this.isBoss=this.round%TUNING.WAVES.perSector===2;
        this.wave={spawned:0,total:Math.round((TUNING.WAVES.baseCount+this.sector*TUNING.WAVES.sectorCount+
            (this.round%3)*TUNING.WAVES.secondCount)*this.run.mode*TUNING.DIFFICULTY),next:TUNING.WAVES.openingDelay};
        this.combat=group();this.base.addChild(this.combat);this.backdrop(this.combat,this.sector,false);
        this.starNodes=[];
        for(let i=0;i<42;i++){
            const node=shape();this.combat.addChild(node);this.starNodes.push({node,x:2+(i*37.319)%96,y:12+(i*23.173)%76,speed:0.8+(i%4)*0.7});
        }
        this.combat.addChild(this.pools.root);
        this.bossRoot=group();this.combat.addChild(this.bossRoot);
        if(this.isBoss)this.createBoss();
        this.shipArt=this.makeShip(this.combat,this.run.modules);
        this.pulseRing=shape();this.combat.addChild(this.pulseRing);this.pulseFx=0;
        this.tapCatcher=shape(rect(0,11,100,78),C.transparent,{onClick:(pid,x,y)=>this.steer(pid,x,y)});
        this.combat.addChild(this.tapCatcher);
        this.hudRoot=group();this.combat.addChild(this.hudRoot);this.buildHud();
        if(this.run.modules.length){
            const i=this.run.modules.length-1,slot=SLOTS[i];
            this.burst(this.player.x+slot[0],this.player.y+slot[1],PARTS[this.run.modules[i].type].color,18,10,0.9);
        }
        this.renderBattle();this.saveCheckpoint();
    }
    buildHud() {
        const r=this.hudRoot;
        r.addChild(shape(rect(0,0,100,11),C.bg));r.addChild(shape(rect(0,89,100,11),C.bg));
        r.addChild(shape(rect(4,10.4,92,0.1),C.edge));r.addChild(shape(rect(4,89,92,0.1),C.edge));
        const hull=label('',5,2,1.7),bar=shape(),shield=this.stats.shield?shape():null;
        r.addChildren(hull,shape(rect(5,6,26,1.5),C.edge),bar);
        if(shield)r.addChild(shield);
        const stage=label(SECTORS[this.sector].name,50,2,1.7,SECTORS[this.sector].color,'center');
        const objective=label(this.isBoss?'DESTROY THE TITAN':'CLEAR THE FLEET',50,6.3,1.45,C.white,'center');
        r.addChildren(stage,objective);
        this.button(r,84,2,12,6,'PAUSE',()=>this.pause(),C.muted,true);
        const scrap=label('',5,92,1.8,C.gold);r.addChild(scrap);
        r.addChild(label('SECTOR '+(this.sector+1)+' / 4',5,96,1.25,C.muted));
        const pulse=this.button(r,62,91,34,7,'SHOCKWAVE',()=>this.pulse(),C.cyan,true);
        const ready=label('',79,96.7,1.15,C.bg,'center');pulse.addChild(ready);
        this.hud={hull,bar,shield,stage,objective,scrap,pulse,ready};
        if(this.round===0){
            this.tutorial=group();
            this.tutorial.addChildren(label('STEER. PROTECT YOUR GLOWING CORE.',50,79,1.8,C.white,'center'),
                label('Guns fire automatically. Gold scrap repairs your hull.',50,83,1.3,C.muted,'center'));
            r.addChild(this.tutorial);
        }else this.tutorial=null;
        if(this.isBoss){
            r.addChild(label(SECTORS[this.sector].boss,50,13,1.5,SECTORS[this.sector].color,'center'));
            r.addChild(shape(rect(25,16,50,0.75),C.edge));this.hud.bossBar=shape();r.addChild(this.hud.bossBar);
        }
    }

    steer(pid,x,y) {
        if(!this.accepts(pid)||this.phase!=='battle'||!Number.isFinite(x)||!Number.isFinite(y))return;
        this.target={x:clamp(x,TUNING.PLAYER.minX,TUNING.PLAYER.maxX),y:clamp(y,TUNING.PLAYER.minY,TUNING.PLAYER.maxY)};
    }
    handleMouseMove(pid,pos){if(pos)this.steer(pid,pos.x,pos.y);}
    handleMouseUp(){ /* A tap is also a destination; release does not teleport or stop the ship. */ }
    handleKeyDown(pid,key) {
        if(!this.accepts(pid)||typeof key!=='string')return;
        key=key.toLowerCase();
        const fresh=this.keys[key]===undefined||this.clock-this.keys[key]>TUNING.UI.keyExpiry;
        this.keys[key]=this.clock;
        if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){this.target=null;return;}
        if(!fresh||this.clock<this.lockUntil)return;
        if(key==='p'){if(this.phase==='battle'||this.phase==='clear')this.pause();else if(this.phase==='pause')this.resume();return;}
        if(key===' '&&this.phase==='battle'){this.pulse();return;}
        if(this.phase==='forge'&&['1','2','3'].includes(key)){this.choosePart(Number(key)-1);return;}
        if(key==='enter'){
            if(this.phase==='title')this.start(!!this.profile.checkpoint);
            else if(this.phase==='pause')this.resume();
            else if(this.phase==='victory'||this.phase==='defeat')this.start(false);
        }
    }
    handleKeyUp(pid,key){if(this.accepts(pid)&&typeof key==='string')delete this.keys[key.toLowerCase()];}
    pause() {
        if(this.phase!=='battle'&&this.phase!=='clear')return;
        this.resumePhase=this.phase;this.changeScreen('pause');this.backdrop(this.base,this.sector);
        this.base.addChild(label('FLIGHT PAUSED',50,18,4.5,C.white,'center'));
        this.base.addChild(label('Your battleship can wait.',50,26,1.8,C.muted,'center'));
        const art=this.makeShip(this.base,this.run.modules,false);this.paintShip(art,50,45,1.5,0,0,1);
        this.button(this.base,24,70,52,10,'RESUME',()=>this.resume());
        this.button(this.base,29,84,42,6,'MENU',()=>this.showTitle(),C.muted,true);

    }
    resume() {
        if(this.phase!=='pause'||!this.combat)return;
        this.changeScreen(this.resumePhase||'battle');this.base.addChild(this.combat);
        // The HUD buttons were made before the pause; refresh their screen tokens.
        this.hudRoot.clearChildren();this.buildHud();this.renderBattle();
    }
    tick() {
        this.clock+=DT;
        if(this.phase!=='battle'&&this.phase!=='clear')return;
        this.time+=DT;this.run.elapsed+=DT;
        this.updatePlayer();
        if(this.phase==='battle'){
            this.updateDirector();this.updateEnemies();this.updateBoss();
            if(!this.pendingDefeat)this.updateWeapons();
            this.updateShots(this.pools.playerShots);this.updateShots(this.pools.enemyShots);
            this.updatePulse();
            if(this.pendingDefeat){this.finish(false);return;}
            if((this.isBoss&&this.boss&&this.boss.dead)||
                (!this.isBoss&&this.wave.spawned>=this.wave.total&&!this.pools.enemies.some(e=>e.active)))
                this.beginClear();
        }else{
            this.clearTime+=DT;
        }
        this.updateSalvage();this.updateEffects();
        if(this.phase==='clear'&&this.clearTime>=TUNING.WAVES.clearDelay){
            for(const p of this.pools.pickups)if(p.active){this.collect(p.value);p.active=false;}
            if(this.round>=TUNING.WAVES.sectors*TUNING.WAVES.perSector-1)this.finish(true);
            else this.showForge();
            return;
        }
        if(this.tutorial&&this.time>TUNING.UI.tutorialSeconds){
            this.hudRoot.removeChild(this.tutorial.id);this.tutorial=null;
        }
        this.renderBattle();this.base.node.onStateChange();
    }
    updatePlayer() {
        const p=this.player;
        p.invuln=Math.max(0,p.invuln-DT);p.pulse=Math.max(0,p.pulse-DT);
        if(this.time-p.lastHit>TUNING.MODULE.shield.delay)p.shield=Math.min(this.stats.shield,p.shield+this.stats.recharge*DT);
        const held=k=>this.keys[k]!==undefined&&this.clock-this.keys[k]<TUNING.UI.keyExpiry;
        let dx=(held('d')||held('arrowright')?1:0)-(held('a')||held('arrowleft')?1:0);
        let dy=(held('s')||held('arrowdown')?1:0)-(held('w')||held('arrowup')?1:0);
        let len=Math.hypot(dx,dy),speed=this.stats.speed;
        if(!len&&this.target){
            dx=this.target.x-p.x;dy=this.target.y-p.y;len=Math.hypot(dx,dy);
            speed=Math.min(speed,len*8);
            if(len<0.18){this.target=null;dx=0;dy=0;len=0;}
        }
        p.vx=mix(p.vx,len?dx/len*speed:0,TUNING.PLAYER.acceleration);
        p.vy=mix(p.vy,len?dy/len*speed:0,TUNING.PLAYER.acceleration);
        p.x=clamp(p.x+p.vx*DT,TUNING.PLAYER.minX,TUNING.PLAYER.maxX);
        p.y=clamp(p.y+p.vy*DT,TUNING.PLAYER.minY,TUNING.PLAYER.maxY);
        p.bank=mix(p.bank,p.vx*0.003,0.1);
    }
    updateDirector() {
        if(this.isBoss||this.time<this.wave.next||this.wave.spawned>=this.wave.total)return;
        const i=this.wave.spawned;
        let kind='scout';
        if(this.round>0&&i%4===2)kind='needle';
        if(this.sector>=1&&i%5===3)kind='tank';
        if(this.sector>=2&&i%6===4)kind='splitter';
        if(this.sector>=1&&i%5===0)kind='mine';
        const x=i%3===0?8:i%3===1?92:20+this.random()*60;
        const y=i%3===2?19:22+this.random()*27;
        if(this.spawnEnemy(kind,x,y)){
            this.wave.spawned++;
            this.wave.next=this.time+(TUNING.WAVES.spawnSeconds-this.sector*TUNING.WAVES.spawnReduction)/
                (this.run.mode*TUNING.DIFFICULTY);
        }
    }
    spawnEnemy(kind,x,y) {
        const e=this.pools.enemies.find(p=>!p.active);if(!e)return null;
        const cfg=TUNING.ENEMY[kind];
        const hp=cfg.hp*(1+this.sector*TUNING.ENEMY.hpPerSector)*this.run.mode*TUNING.DIFFICULTY;
        Object.assign(e,{active:true,kind,x:clamp(x,5+cfg.radius,95-cfg.radius),y:clamp(y,19,83),
            hp,maxHp:hp,age:0,cd:1.4+this.random(),tell:0,aim:0,flash:0,serial:(this.enemySerial=(this.enemySerial||0)+1),
            radius:cfg.radius,phase:this.random()*6.28});
        this.burst(e.x,e.y,PARTS.arc.color,3,1.5,0.25);
        return e;
    }
    updateEnemies() {
        for(const e of this.pools.enemies){
            if(!e.active)continue;
            const cfg=TUNING.ENEMY[e.kind],p=this.player;
            e.age+=DT;e.flash=Math.max(0,e.flash-DT);e.cd-=DT;
            const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;
            if(e.tell>0){
                e.tell-=DT;
                if(e.tell<=0){this.fireEnemy(e);e.cd=cfg.cooldown/(this.run.mode*TUNING.DIFFICULTY);}
            }else{
                if(e.kind==='mine'){
                    e.x+=dx/d*cfg.speed*DT;e.y+=dy/d*cfg.speed*DT;
                    if(d<7){e.tell=cfg.tell;e.aim=Math.atan2(dy,dx);}
                }else{
                    const approach=d>23?1:d<13?-0.55:0.1;
                    const strafe=Math.sin(e.age*1.6+e.phase)*0.45;
                    e.x+=(dx/d*approach-dy/d*strafe)*cfg.speed*DT;
                    e.y+=(dy/d*approach+dx/d*strafe)*cfg.speed*DT;
                    if(e.cd<=0&&d<TUNING.ENEMY.engageRange&&this.time>2){
                        e.tell=cfg.tell;e.aim=Math.atan2(dy,dx)+(this.random()-0.5)*(0.05+d*0.002);
                    }
                }
            }
            e.x=clamp(e.x,4+e.radius,96-e.radius);e.y=clamp(e.y,18+e.radius,86-e.radius);
            if(d<e.radius+TUNING.PLAYER.coreRadius){
                this.damagePlayer(TUNING.ENEMY.contact);
                e.x-=dx/d*2;e.y-=dy/d*2;
            }
            if(this.pendingDefeat)return;
        }
    }
    fireEnemy(e) {
        if(!e.active)return;
        const cfg=TUNING.ENEMY[e.kind];
        if(e.kind==='mine'){
            if(distance(e,this.player)<7)this.damagePlayer(cfg.damage);
            this.burst(e.x,e.y,C.orange,12,10,0.7);this.killEnemy(e,false);return;
        }
        const count=e.kind==='tank'?5:e.kind==='needle'?3:1;
        for(let i=0;i<count;i++){
            const angle=e.aim+(i-(count-1)/2)*(e.kind==='tank'?0.27:0.17);
            this.fireShot(false,e.x,e.y,angle,cfg.shotSpeed,cfg.damage,'bullet');
        }
    }
    targets() {
        const out=this.pools.enemies.filter(e=>e.active);
        if(this.boss&&!this.boss.dead){
            const pods=this.boss.parts.filter(p=>p.active&&!p.core);
            if(pods.length)out.push(...pods);
            else out.push(this.boss.parts[0]);
        }
        return out;
    }
    nearest(x,y,range=100,excluded=[]) {
        let best=null,dist=range;
        for(const e of this.targets()){
            if(excluded.includes(e.serial))continue;
            const d=Math.hypot(e.x-x,e.y-y);
            if(d<dist){best=e;dist=d;}
        }
        return best;
    }
    updateWeapons() {
        const p=this.player; p.baseCd-=DT;
        const target=this.nearest(p.x,p.y,TUNING.PLAYER.range);
        if(target&&p.baseCd<=0){
            this.fireShot(true,p.x,p.y-3.7,Math.atan2(target.y-(p.y-3.7),target.x-p.x),
                TUNING.PLAYER.shotSpeed,TUNING.PLAYER.cannonDamage*this.stats.damage,'bullet');
            p.baseCd=TUNING.PLAYER.cannonCooldown;
        }
        for(let i=0;i<this.run.modules.length;i++){
            const m=this.run.modules[i],mount=this.shipArt.mounts[i],cfg=TUNING.MODULE[m.type];
            p.cooldowns[i]-=DT;
            const point=transform([[mount.x,mount.y]],p.x,p.y,1,p.bank)[0];
            let x=point[0],y=point[1];
            if(m.type==='drone'){
                const droneIndex=this.shipArt.drones.findIndex(d=>d.index===i);
                const a=this.time*1.5+droneIndex*2.5;
                x=p.x+Math.cos(a)*TUNING.MODULE.drone.orbit;y=p.y+Math.sin(a)*TUNING.MODULE.drone.orbit*0.55;
            }
            const t=this.nearest(x,y,m.type==='arc'?cfg.range:100);
            if(!t||!cfg.cooldown)continue;
            const angle=Math.atan2(t.y-y,t.x-x);mount.angle=angle-p.bank;
            if(p.cooldowns[i]>0)continue;
            const damage=cfg.damage*this.stats.damage*(1+(m.tier-1)*TUNING.MODULE.tierBonus);
            p.cooldowns[i]=cfg.cooldown;
            if(m.type==='cannon'){
                for(const side of [-1,1]){
                    const ox=Math.sin(angle)*side*0.55,oy=-Math.cos(angle)*side*0.55;
                    this.fireShot(true,x+ox,y+oy,angle,TUNING.PLAYER.shotSpeed,damage,'bullet');
                }
            }else if(m.type==='rail'){
                this.fireShot(true,x,y,angle,100,damage,'rail',2);
                this.beam(x,y,x+Math.cos(angle)*6,y+Math.sin(angle)*6,C.blue,0.45,0.12);
            }else if(m.type==='missile'){
                this.fireShot(true,x,y,angle,cfg.speed,damage,'missile',0,t);
            }else if(m.type==='drone'){
                this.fireShot(true,x,y,angle,TUNING.PLAYER.shotSpeed,damage,'drone');
            }else if(m.type==='arc'){
                let prev={x,y},next=t;const ids=[];
                for(let jump=0;jump<3&&next;jump++){
                    this.beam(prev.x,prev.y,next.x,next.y,C.violet,0.32,0.2);
                    ids.push(next.serial);this.damageTarget(next,damage*Math.pow(0.8,jump));
                    prev={x:next.x,y:next.y};next=this.nearest(prev.x,prev.y,cfg.jump,ids);
                }
            }
        }
    }
    fireShot(friendly,x,y,a,speed,damage,kind='bullet',pierce=0,target=null) {
        const pool=friendly?this.pools.playerShots:this.pools.enemyShots;
        const s=pool.find(p=>!p.active);if(!s)return;
        Object.assign(s,{active:true,x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,
            life:friendly?3:8,damage,kind,pierce,hitIds:[],target,
            radius:friendly?(kind==='missile'?0.8:0.42):0.65});
    }
    updateShots(pool) {
        for(const s of pool){
            if(!s.active)continue;
            const oldX=s.x,oldY=s.y;
            s.life-=DT;
            if(s.kind==='missile'){
                if(!s.target||!s.target.active)s.target=this.nearest(s.x,s.y);
                if(s.target){
                    const a=Math.atan2(s.target.y-s.y,s.target.x-s.x),sp=TUNING.MODULE.missile.speed;
                    s.vx=mix(s.vx,Math.cos(a)*sp,0.085);s.vy=mix(s.vy,Math.sin(a)*sp,0.085);
                }
            }
            s.x+=s.vx*DT;s.y+=s.vy*DT;
            if(s.life<=0||s.x<2||s.x>98||s.y<12||s.y>88){s.active=false;hide(s.node);continue;}
            if(s.friendly){
                for(const e of this.targets()){
                    if(!e.active||s.hitIds.includes(e.serial))continue;
                    if(segmentDistance(e.x,e.y,oldX,oldY,s.x,s.y)>e.radius+s.radius)continue;
                    s.hitIds.push(e.serial);
                    if(s.kind==='missile'){
                        this.burst(s.x,s.y,C.orange,9,9,0.55);
                        for(const t of this.targets())if(distance(t,s)<TUNING.MODULE.missile.radius+t.radius)
                            this.damageTarget(t,s.damage);
                    }else this.damageTarget(e,s.damage);
                    if(s.pierce<=0){s.active=false;hide(s.node);break;}s.pierce--;
                }
            }else if(segmentDistance(this.player.x,this.player.y,oldX,oldY,s.x,s.y)<TUNING.PLAYER.coreRadius+s.radius){
                this.damagePlayer(s.damage);s.active=false;hide(s.node);
            }
            if(this.pendingDefeat)return;
        }
    }
    damagePlayer(amount) {
        const p=this.player;if(p.invuln>0||this.pendingDefeat)return;
        p.lastHit=this.time;p.invuln=TUNING.PLAYER.invulnerable;
        const blocked=Math.min(p.shield,amount);p.shield-=blocked;p.hull=Math.max(0,p.hull-(amount-blocked));
        this.burst(p.x,p.y,blocked?C.cyan:C.red,12,10,0.55);
        if(p.hull<=0)this.pendingDefeat=true;
    }
    damageTarget(e,amount) {
        if(!e.active)return;
        e.hp-=amount;e.flash=0.1;
        this.burst(e.x,e.y,e.boss?SECTORS[this.sector].color:C.gold,1,5,0.17);
        if(e.hp>0)return;
        if(e.boss)this.killBossPart(e);else this.killEnemy(e,true);
    }
    killEnemy(e,split=true) {
        if(!e.active)return;
        e.active=false;e.nodes.forEach(hide);this.run.kills++;
        const cfg=TUNING.ENEMY[e.kind];
        this.dropSalvage(e.x,e.y,cfg.scrap);this.burst(e.x,e.y,this.enemyColor(e.kind),8,8,0.6);
        if(e.kind==='splitter'&&split)
            for(const side of [-1,1])this.spawnEnemy('scout',e.x+side*3.2,e.y);
    }
    enemyColor(kind){return kind==='splitter'?C.violet:kind==='tank'?C.orange:kind==='mine'?C.gold:C.red;}
    pulse() {
        if(this.phase!=='battle'||this.player.pulse>0)return;
        this.player.pulse=this.stats.pulse;this.player.invuln=TUNING.PULSE.protection;
        this.pulseFx=0.7;this.pulseOrigin={x:this.player.x,y:this.player.y};this.pulseHits=[];
        this.burst(this.player.x,this.player.y,C.cyan,16,24,0.6);
    }
    updatePulse() {
        if(this.pulseFx<=0)return;
        const r=(1-this.pulseFx/0.7)*TUNING.PULSE.radius;
        for(const s of this.pools.enemyShots)if(s.active&&distance(s,this.pulseOrigin)<r){s.active=false;hide(s.node);}
        for(const e of this.targets()){
            if(distance(e,this.pulseOrigin)<r+e.radius&&!this.pulseHits.includes(e.serial)){
                this.pulseHits.push(e.serial);this.damageTarget(e,TUNING.PULSE.damage*this.stats.damage);
                if(!e.boss&&e.active){const a=Math.atan2(e.y-this.pulseOrigin.y,e.x-this.pulseOrigin.x);e.x+=Math.cos(a)*3;e.y+=Math.sin(a)*3;}
            }
        }
    }
    dropSalvage(x,y,value) {
        let p=this.pools.pickups.find(q=>!q.active);
        if(!p){
            // Merge overflow into an existing pickup. The rendering budget never loses rewards.
            p=this.pools.pickups.reduce((a,b)=>distance(a,{x,y})<distance(b,{x,y})?a:b);
            p.value+=value;return;
        }
        Object.assign(p,{active:true,x,y,vx:(this.random()-0.5)*5,vy:(this.random()-0.5)*5,value,age:0});
    }
    collect(value) {
        this.run.scrap+=value;
        this.player.hull=Math.min(TUNING.PLAYER.hull,this.player.hull+value*TUNING.SALVAGE.heal);
        this.player.pulse=Math.max(0,this.player.pulse-value*TUNING.SALVAGE.pulse);
    }
    updateSalvage() {
        for(const p of this.pools.pickups){
            if(!p.active)continue;p.age+=DT;
            const d=distance(p,this.player);
            if(d<TUNING.SALVAGE.magnet||this.phase==='clear'){
                const speed=TUNING.SALVAGE.speed*(this.phase==='clear'?1.6:1);
                p.x+=(this.player.x-p.x)/(d||1)*Math.min(d,speed*DT);
                p.y+=(this.player.y-p.y)/(d||1)*Math.min(d,speed*DT);
            }else {p.x=clamp(p.x+p.vx*DT,4,96);p.y=clamp(p.y+p.vy*DT,16,86);p.vx*=0.98;p.vy*=0.98;}
            if(d<2){this.collect(p.value);p.active=false;hide(p.node);}
        }
    }
    burst(x,y,color,count,speed=8,life=0.5) {
        for(const p of this.pools.particles){
            if(!count)break;if(p.active)continue;count--;
            const a=this.random()*Math.PI*2,v=speed*(0.4+this.random()*0.6);
            Object.assign(p,{active:true,x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life,total:life,
                size:0.25+this.random()*0.55,color,angle:a});
        }
    }
    beam(x,y,tx,ty,color,width,life) {
        const b=this.pools.beams.find(p=>!p.active);if(!b)return;
        Object.assign(b,{active:true,x,y,tx,ty,color,width,life,total:life});
    }
    updateEffects() {
        this.pulseFx=Math.max(0,this.pulseFx-DT);
        for(const p of this.pools.particles){
            if(!p.active)continue;p.life-=DT;
            if(p.life<=0||p.x<2||p.x>98||p.y<12||p.y>88){p.active=false;hide(p.node);continue;}
            p.x+=p.vx*DT;p.y+=p.vy*DT;p.vx*=0.976;p.vy*=0.976;
        }
        for(const b of this.pools.beams){if(!b.active)continue;b.life-=DT;if(b.life<=0){b.active=false;hide(b.node);}}
    }

    createBoss() {
        const sector=this.sector, color=SECTORS[sector].color;
        const b={x:50,y:32,age:0,parts:[],plates:[],lasers:[],dead:false,cd:2.6,tell:0,
            aim:Math.PI/2,attack:0,laserCd:5.5,summonCd:10};
        this.boss=b;
        const plate=(pts,col)=>{const node=shape();this.bossRoot.addChild(node);b.plates.push({node,pts,col});};
        if(sector===0){
            for(const side of [-1,1]){
                plate([[-2,0],[-7,-6],[-17,-3],[-20,3],[-13,6],[-6,5],[-2,0]].map(q=>[q[0]*side,q[1]]),tint(color,0.36));
                plate([[-4,0],[-8,-4],[-16,-2],[-17,1],[-10,4],[-4,0]].map(q=>[q[0]*side,q[1]]),tint(color,0.65));
                plate([[-8,5],[-16,2],[-16,3],[-9,6],[-8,5]].map(q=>[q[0]*side,q[1]]),color);
            }
        }else if(sector===1){
            for(let i=0;i<8;i++){
                const a=i*Math.PI/4;
                plate(arc(0,0,16,1.2,a,a+0.52,9),tint(color,0.45));
                plate(arc(0,0,18,0.2,a,a+0.52,9),tint(color,0.65));
            }
        }else if(sector===2){
            for(const side of [-1,1]){
                plate([[3,-8],[12,-11],[17,-6],[17,10],[12,15],[9,5],[4,7],[3,-8]].map(q=>[q[0]*side,q[1]]),tint(color,0.37));
                plate([[9,-7],[13,-8],[14,7],[12,11],[10,4],[9,-7]].map(q=>[q[0]*side,q[1]]),tint(color,0.68));
                for(let i=0;i<4;i++)plate(rect(side>0?9:-13,-5+i*3,4,0.45),color);
            }
        }else{
            for(let i=0;i<12;i++){
                const a=i*Math.PI/6;
                plate(transform([[10,-1.5],[17,-2],[21,0],[17,2],[10,1.5],[10,-1.5]],0,0,1,a),i%2?tint(color,0.4):tint(color,0.65));
                plate(arc(0,0,18,0.35,a,a+0.3,7),color);
            }
        }
        plate(circle(0,0,8.5,12),tint(color,0.35));
        plate(circle(0,0,7.2,12),C.bg);
        plate(arc(0,0,6.1,0.7,0,Math.PI*1.95,36),tint(color,0.8));
        const count=TUNING.BOSS.podCounts[sector];
        for(let i=0;i<=count;i++){
            const core=i===0,hp=(core?TUNING.BOSS.coreHp[sector]:TUNING.BOSS.podHp[sector])*this.run.mode*TUNING.DIFFICULTY;
            const root=group();this.bossRoot.addChild(root);
            const nodes=[shape(),shape(),shape(),shape(),shape()];root.addChildren(...nodes);
            const p={boss:true,core,active:true,index:i,x:50,y:32,hp,maxHp:hp,radius:core?4.2:2.8,
                serial:-i-1,root,nodes,flash:0,angle:0};
            if(core)nodes[2].node.effects={shadow:{color,blur:16}};
            b.parts.push(p);
        }
        for(let i=0;i<(sector<2?0:sector===2?2:3);i++){
            const node=shape();this.bossRoot.addChild(node);
            b.lasers.push({active:false,node,x:0,t:0});
        }
        this.positionBoss();
    }
    positionBoss() {
        const b=this.boss;
        b.x=50+Math.sin(b.age*0.38)*9;b.y=39+Math.sin(b.age*0.55)*1.5;
        for(const p of b.parts){
            if(p.core){p.x=b.x;p.y=b.y;continue;}
            const i=p.index-1;
            if(this.sector===0){p.x=b.x+(i===0?-12:12);p.y=b.y+1.8;}
            else if(this.sector===1){
                const a=-Math.PI/2+i*Math.PI*2/3+b.age*0.25;
                p.x=b.x+Math.cos(a)*13;p.y=b.y+Math.sin(a)*11;
            }else if(this.sector===2){
                p.x=b.x+(i%2===0?-12:12);p.y=b.y+(i<2?-5:6);
            }else{
                const a=Math.PI/4+i*Math.PI/2+b.age*0.1;
                p.x=b.x+Math.cos(a)*13.5;p.y=b.y+Math.sin(a)*11;
            }
        }
    }
    updateBoss() {
        const b=this.boss;if(!b||b.dead)return;
        b.age+=DT;b.cd-=DT;b.laserCd-=DT;b.summonCd-=DT;
        this.positionBoss();
        for(const p of b.parts)p.flash=Math.max(0,p.flash-DT);
        if(b.tell>0){
            b.tell-=DT;
            if(b.tell<=0){this.bossAttack();b.cd=TUNING.BOSS.attackCooldown/(this.run.mode*TUNING.DIFFICULTY);}
        }else if(b.cd<=0){
            b.tell=TUNING.BOSS.tell;
            b.aim=Math.atan2(this.player.y-b.y,this.player.x-b.x);
            for(const p of b.parts)p.aim=Math.atan2(this.player.y-p.y,this.player.x-p.x);
        }
        if(this.sector>=2&&b.laserCd<=0){
            b.laserCd=TUNING.BOSS.laserCooldown;
            const count=this.sector===3?3:2;
            for(let i=0;i<count;i++){
                const l=b.lasers[i];l.active=true;l.t=TUNING.BOSS.laserTell+TUNING.BOSS.laserLife;
                l.x=clamp(this.player.x+(i-(count-1)/2)*16,9,91);
            }
        }
        for(const l of b.lasers){
            if(!l.active)continue;l.t-=DT;
            if(l.t<=0){l.active=false;hide(l.node);continue;}
            if(l.t<=TUNING.BOSS.laserLife&&this.player.y>44&&Math.abs(this.player.x-l.x)<TUNING.BOSS.laserWidth/2+TUNING.PLAYER.coreRadius)
                this.damagePlayer(TUNING.BOSS.laserDamage);
        }
        if(this.sector>=2&&b.summonCd<=0){
            b.summonCd=12;
            this.spawnEnemy(this.sector===3?'needle':'scout',14,23);
            this.spawnEnemy(this.sector===3?'needle':'scout',86,23);
        }
        for(const p of b.parts)if(p.active&&distance(p,this.player)<p.radius+TUNING.PLAYER.coreRadius)
            this.damagePlayer(TUNING.ENEMY.contact);
    }
    bossAttack() {
        const b=this.boss;b.attack++;
        const pods=b.parts.filter(p=>p.active&&!p.core);
        const guns=pods.length?pods:[b.parts[0]];
        for(const p of guns){
            const count=this.sector===0?5:this.sector===1?4:5;
            // Fans leave generous gaps; the telegraph never follows the player after it locks.
            const locked=p.aim===undefined?b.aim:p.aim;
            for(let i=0;i<count;i++)
                this.fireShot(false,p.x,p.y,locked+(i-(count-1)/2)*0.21,TUNING.BOSS.shotSpeed,12,'boss');
        }
        if((this.sector>=1&&b.attack%2===0)||!pods.length){
            const count=this.sector===3?16:12;
            for(let i=0;i<count;i++){
                const angle=i*Math.PI*2/count+b.attack*0.23;
                // Leave a two-bullet opening on the aimed bearing.
                const delta=Math.atan2(Math.sin(angle-b.aim),Math.cos(angle-b.aim));
                if(Math.abs(delta)<0.26)continue;
                this.fireShot(false,b.x,b.y,angle,TUNING.BOSS.shotSpeed*0.85,12,'boss');
            }
        }
    }
    killBossPart(p) {
        if(!p.active)return;p.active=false;p.hp=0;
        this.bossRoot.removeChild(p.root.id);
        this.burst(p.x,p.y,SECTORS[this.sector].color,p.core?26:16,p.core?20:12,0.8);
        this.dropSalvage(p.x,p.y,p.core?18:8);this.run.kills++;
        if(p.core){
            this.boss.dead=true;
            this.combat.removeChild(this.bossRoot.id);
            for(const l of this.boss.lasers){l.active=false;hide(l.node);}
        }
    }
    renderBattle() {
        for(const s of this.starNodes){
            const y=12+((s.y-12+this.time*s.speed)%75);
            put(s.node,rect(s.x,y,s.speed>2?0.17:0.11,s.speed>2?0.5:0.17),s.speed>2?C.muted:C.edge);
        }
        for(const e of this.pools.enemies){
            if(!e.active)continue;
            const r=e.radius,col=this.enemyColor(e.kind),a=e.tell>0?e.aim:Math.atan2(this.player.y-e.y,this.player.x-e.x);
            let silhouette;
            if(e.kind==='scout')silhouette=[[-r,-r*0.8],[r*1.4,0],[-r,r*0.8],[-r*0.5,0],[-r,-r*0.8]];
            else if(e.kind==='needle')silhouette=[[-r*1.3,-r*0.5],[r*1.5,0],[-r*1.3,r*0.5],[-r*0.7,0],[-r*1.3,-r*0.5]];
            else if(e.kind==='mine')silhouette=circle(0,0,r,4,Math.PI/4+e.age*0.9);
            else silhouette=circle(0,0,r,6,Math.PI/6);
            put(e.nodes[0],transform(silhouette,e.x,e.y,1,a),e.flash>0?C.white:tint(col,0.55));
            put(e.nodes[1],circle(e.x,e.y,r*0.52,e.kind==='splitter'?3:4,e.age*0.3),e.flash>0?C.white:col);
            const ratio=clamp(e.hp/e.maxHp,0,1);
            put(e.nodes[2],arc(e.x,e.y,r+0.7,0.18,-Math.PI/2,-Math.PI/2+Math.PI*2*ratio,18),tint(col,0.7));
            if(e.tell>0){
                if(e.kind==='mine')put(e.nodes[3],arc(e.x,e.y,7,0.18,0,Math.PI*1.99,32),C.gold,150);
                else put(e.nodes[3],line(e.x,e.y,e.x+Math.cos(e.aim)*(r+2.5),e.y+Math.sin(e.aim)*(r+2.5),0.55),C.white,150+80*Math.sin(e.age*32));
            }else hide(e.nodes[3]);
        }
        for(const pool of [this.pools.playerShots,this.pools.enemyShots])for(const s of pool){
            if(!s.active)continue;
            const angle=Math.atan2(s.vy,s.vx),length=s.friendly?(s.kind==='rail'?5:s.kind==='missile'?2:1.8):1.3;
            if(s.friendly)put(s.node,line(s.x-Math.cos(angle)*length,s.y-Math.sin(angle)*length,s.x,s.y,s.kind==='rail'?0.32:s.radius),
                s.kind==='rail'?C.blue:s.kind==='missile'?C.orange:s.kind==='drone'?C.cyan:C.gold);
            else put(s.node,transform([[-0.8,-0.7],[1,0],[-0.8,0.7],[-0.8,-0.7]],s.x,s.y,1,angle),C.red);
        }
        for(const p of this.pools.pickups)if(p.active)
            put(p.node,circle(p.x,p.y,0.48+Math.min(0.32,p.value*0.04),4,p.age*1.6),C.gold);
        for(const p of this.pools.particles)if(p.active)
            put(p.node,transform([[0,-p.size*1.7],[p.size,0],[0,p.size],[-p.size,0],[0,-p.size*1.7]],p.x,p.y,1,p.angle+p.life*3),p.color,220*p.life/p.total);
        for(const b of this.pools.beams)if(b.active){
            const dx=b.tx-b.x,dy=b.ty-b.y,l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l,w=b.width;
            const pts=[[b.x,b.y],[b.x+dx*0.32+nx*w*3,b.y+dy*0.32+ny*w*3],
                [b.x+dx*0.61-nx*w*2,b.y+dy*0.61-ny*w*2],[b.tx,b.ty],
                [b.x+dx*0.61-nx*w,b.y+dy*0.61-ny*w],[b.x+dx*0.32+nx*w*4,b.y+dy*0.32+ny*w*4],[b.x,b.y]];
            put(b.node,pts,b.color,255*b.life/b.total);
        }
        this.renderBoss();
        this.paintShip(this.shipArt,this.player.x,this.player.y,1,this.player.bank,this.time,
            this.stats.shield?this.player.shield/this.stats.shield:0);
        if(this.pulseFx>0&&this.pulseOrigin){
            const k=1-this.pulseFx/0.7;
            put(this.pulseRing,arc(this.pulseOrigin.x,this.pulseOrigin.y,Math.max(0.2,k*TUNING.PULSE.radius),
                Math.min(k*TUNING.PULSE.radius,0.4),0,Math.PI*1.99,42),C.cyan,230*(1-k));
        }else hide(this.pulseRing);
        setText(this.hud.hull,'HULL '+Math.ceil(this.player.hull));
        put(this.hud.bar,rect(5,6,26*this.player.hull/TUNING.PLAYER.hull,1.5),this.player.hull<30?C.red:C.cyan);
        if(this.hud.shield)put(this.hud.shield,rect(5,8.1,26*this.player.shield/this.stats.shield,0.5),C.blue);
        setText(this.hud.scrap,'SCRAP '+this.run.scrap);
        this.hud.pulse.node.fill=this.player.pulse<=0?C.cyan:C.steel;
        setText(this.hud.ready,this.player.pulse<=0?'SPACE / TAP':'READY IN '+Math.ceil(this.player.pulse)+'s');
        if(this.phase==='clear')setText(this.hud.objective,'WRECKAGE SECURED');
        else if(!this.isBoss){
            const alive=this.pools.enemies.filter(e=>e.active).length;
            setText(this.hud.objective,'FLEET '+(this.round%3+1)+' / 2  -  '+(this.wave.total-this.wave.spawned+alive)+' LEFT');
        }else if(this.boss){
            const pods=this.boss.parts.filter(p=>p.active&&!p.core).length;
            setText(this.hud.objective,this.boss.lasers.some(l=>l.active&&l.t>TUNING.BOSS.laserLife)?'DODGE THE RED LANES':pods?'BREAK '+pods+' GLOWING CORE'+(pods===1?'':'S'):'CORE EXPOSED');
            const hp=this.boss.parts.reduce((s,p)=>s+Math.max(0,p.hp),0);
            const max=this.boss.parts.reduce((s,p)=>s+p.maxHp,0);
            put(this.hud.bossBar,rect(25,16,50*hp/max,0.75),SECTORS[this.sector].color);
        }
    }
    renderBoss() {
        const b=this.boss;if(!b||b.dead)return;
        const color=SECTORS[this.sector].color;
        const rotation=this.sector===3?b.age*0.035:this.sector===1?b.age*0.04:0;
        for(const plate of b.plates)put(plate.node,transform(plate.pts,b.x,b.y,1,rotation),plate.col);
        const pods=b.parts.filter(p=>p.active&&!p.core).length;
        for(const p of b.parts){
            if(!p.active)continue;
            const r=p.radius;
            put(p.nodes[0],circle(p.x,p.y,r+0.8,6,b.age*0.09),tint(color,0.45));
            put(p.nodes[1],circle(p.x,p.y,r,6,b.age*0.09),C.dark);
            const charged=b.tell>0?1+0.15*Math.sin(b.age*28):1;
            put(p.nodes[2],circle(p.x,p.y,r*0.58*charged,p.core?12:6,b.age*0.12),p.flash>0?C.white:(p.core&&pods?tint(color,0.35):color));
            if(b.tell>0&&(!p.core||!pods))put(p.nodes[3],line(p.x,p.y,p.x+Math.cos(p.aim)*(r+2.8),p.y+Math.sin(p.aim)*(r+2.8),0.38),C.white);
            else put(p.nodes[3],circle(p.x,p.y,r*0.22,4,b.age),p.core&&pods?C.edge:C.white);
            put(p.nodes[4],arc(p.x,p.y,r+1,0.25,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(p.hp/p.maxHp,0,1),26),color);
        }
        for(const l of b.lasers){
            if(!l.active)continue;
            const live=l.t<=TUNING.BOSS.laserLife,w=TUNING.BOSS.laserWidth;
            put(l.node,rect(l.x-w/2,44,w,44),C.red,live?200:55+35*Math.sin(b.age*18));
        }
    }
    beginClear() {
        if(this.phase!=='battle')return;
        this.phase='clear';this.clearTime=0;
        for(const e of this.pools.enemies){e.active=false;e.nodes.forEach(hide);}
        for(const s of this.pools.enemyShots){s.active=false;hide(s.node);}
        for(const s of this.pools.playerShots){s.active=false;hide(s.node);}
        this.player.hull=Math.min(TUNING.PLAYER.hull,this.player.hull+
            (this.isBoss?TUNING.SALVAGE.bossRepair:TUNING.SALVAGE.waveRepair));
        this.player.pulse=0;
    }
    rollChoices() {
        if(this.round===0)return ['cannon','missile','shield'];
        const counts={};
        for(const m of this.run.modules)counts[m.type]=(counts[m.type]||0)+1;
        const available=Object.keys(PARTS).filter(k=>(counts[k]||0)<TUNING.MODULE[k].cap);
        const result=[];
        while(result.length<3&&available.length){
            const i=Math.floor(this.random()*available.length);result.push(available.splice(i,1)[0]);
        }
        return result;
    }
    showForge() {
        this.changeScreen('forge');this.choices=this.rollChoices();this.backdrop(this.base,this.sector);
        const bossTech=this.isBoss;
        this.base.addChild(label(bossTech?'TITAN DISMANTLED':'WRECKAGE RECOVERED',50,6,1.7,C.gold,'center'));
        this.base.addChild(label('WELD A NEW MODULE',50,12,4.1,C.white,'center'));
        this.base.addChild(label(bossTech?'Boss technology. Every choice is amplified.':'Choose one. It becomes a real part of your ship.',50,19,1.55,C.muted,'center'));
        const art=this.makeShip(this.base,this.run.modules,false);
        this.paintShip(art,50,31,1.05,0,0,1);
        this.base.addChild(label('HULL '+Math.ceil(this.player.hull)+'  /  SCRAP '+this.run.scrap,50,45,1.6,C.cyan,'center'));
        for(let i=0;i<this.choices.length;i++)this.forgeCard(i,this.choices[i],bossTech?2:1);
        const nextSector=Math.floor((this.round+1)/3);
        const nextBoss=(this.round+1)%3===2;
        this.base.addChild(label('NEXT: '+(nextBoss?SECTORS[nextSector].boss:SECTORS[nextSector].name),50,92,1.7,C.white,'center'));
        this.base.addChild(label('Tap a module or press 1, 2, 3.',50,96,1.45,C.muted,'center'));
    }
    forgeCard(i,type,tier) {
        const x=4+i*32,w=28,y=52,h=34,col=PARTS[type].color,token=this.token;
        const card=group();this.base.addChild(card);
        card.addChild(shape([[x+1,y],[x+w,y],[x+w,y+h-1],[x+w-1,y+h],[x,y+h],[x,y+1],[x+1,y]],C.panel));
        card.addChild(shape(rect(x+1,y,w-2,0.35),col));
        card.addChild(label('0'+(i+1)+(tier===2?'  /  MK II':''),x+2,y+2,1.4,col));
        // The card icon uses the same module geometry as the actual ship.
        const iconRoot=group();card.addChild(iconRoot);
        iconRoot.addChild(shape(circle(x+14,y+11,3.5,6,Math.PI/6),C.steel));
        iconRoot.addChild(shape(circle(x+14,y+11,2.8,6,Math.PI/6),C.dark));
        if(type==='cannon'||type==='rail'){
            for(const s of type==='cannon'?[-1,1]:[0])
                iconRoot.addChild(shape(rect(x+13.6+s*1.2,y+7,0.8,7),col));
        }else if(type==='missile'){
            for(const s of [-1,1])iconRoot.addChild(shape([[x+14+s*1.2-0.7,y+13],[x+14+s*1.2-0.7,y+9],[x+14+s*1.2,y+7],
                [x+14+s*1.2+0.7,y+9],[x+14+s*1.2+0.7,y+13],[x+14+s*1.2-0.7,y+13]],col));
        }else if(type==='engine'||type==='drone'){
            iconRoot.addChild(shape([[x+11,y+13],[x+14,y+7],[x+17,y+13],[x+14,y+11],[x+11,y+13]],col));
        }else{
            iconRoot.addChild(shape(circle(x+14,y+11,1.9,type==='arc'?3:6,Math.PI/6),col));
            iconRoot.addChild(shape(circle(x+14,y+11,0.7,4),C.white));
        }
        card.addChild(label(PARTS[type].name,x+14,y+18,1.8,C.white,'center'));
        PARTS[type].lines.forEach((text,n)=>card.addChild(label(text,x+14,y+23+n*3,1.1,C.muted,'center')));
        card.addChild(label(tier===2?'WELD MK II  >':'WELD MODULE  >',x+14,y+30,1.35,col,'center'));
        card.addChild(shape(rect(x,y,w,h),C.transparent,{onClick:(pid)=>{
            if(this.accepts(pid)&&this.token===token&&this.clock>=this.lockUntil)this.choosePart(i);
        }}));
    }
    choosePart(i) {
        if(this.phase!=='forge'||!Number.isInteger(i)||!this.choices[i]||this.clock<this.lockUntil)return;
        this.run.modules.push({type:this.choices[i],tier:this.isBoss?2:1});this.round++;
        this.recalculate();this.player.shield=this.stats.shield;this.beginBattle();
    }
    score(victory=false){return this.run.kills*100+this.run.scrap*10+Math.floor(this.round/3)*1000+(victory?5000:0);}
    finish(victory) {
        const score=this.score(victory);
        this.profile.best=Math.max(this.profile.best,score);if(victory)this.profile.wins++;
        this.persist(null);this.changeScreen(victory?'victory':'defeat');
        this.backdrop(this.base,victory?3:this.sector);
        this.base.addChild(label(victory?'THE SUN IS YOURS':'YOUR SIGNAL WENT DARK',50,9,1.8,victory?C.gold:C.red,'center'));
        this.base.addChild(label(victory?'STARFORGED':'HULL LOST',50,17,6.1,C.white,'center'));
        this.base.addChild(label(victory?'You built a battleship. You brought the light home.':'The wreckage is waiting for another pilot.',50,27,1.5,C.muted,'center'));
        const art=this.makeShip(this.base,this.run.modules,false);this.paintShip(art,50,43,1.4,0,0,victory?1:0);
        this.base.addChild(label(String(score),50,61,4.3,C.gold,'center'));
        const seconds=Math.floor(this.run.elapsed),mins=Math.floor(seconds/60);
        this.base.addChild(label(this.run.kills+' DESTROYED  /  '+this.run.modules.length+' MODULES  /  '+mins+':'+String(seconds%60).padStart(2,'0'),50,68,1.4,C.muted,'center'));
        this.button(this.base,23,77,54,9,'FLY AGAIN',()=>this.start(false));
        this.button(this.base,29,89,42,6,'MENU',()=>this.showTitle(),C.muted,true);
    }
}
function modulesRadius(count){return count>8?13:count>2?10:7;}
module.exports=Starweld;
