const { createWorld, MAPS } = require('./world');

const TAU = Math.PI * 2;
const PLAYER_RADIUS = 0.27;
const BODY_HEIGHT = 1.8, EYE_HEIGHT = 1.45, HEAD_HEIGHT = 1.35, HEAD_RADIUS = .19, TORSO_HEIGHT = .6;
const CEILING_HEIGHT = 3.35, MAX_PITCH = .75;
const RUN_SPEED = 6, SPRINT_SPEED = 8, JUMP_SPEED = 6.5, GRAVITY = 17;
const MAX_PROJECTILES = 96, MAX_EFFECTS = 192;
const TEAMS = ['amber', 'cyan'];
const TEAM_COLORS = { amber:'#ffc078', cyan:'#83e5f2' };
const MODES = [
    {id:'ffa',name:'FREE FOR ALL',description:'First to 12 eliminations.'},
    {id:'ctf',name:'CAPTURE THE FLAG',description:'Return the enemy flag while your own flag is home. First to 3 captures.'},
    {id:'domination',name:'DOMINATION',description:'Capture and hold control points. First team to 180.'}
];
const FLAG_RETURN_SECONDS = 20, CAPTURE_SECONDS = 3, CONTROL_SCORE_INTERVAL = 1;
const WEAPON_ORDER = ['machinegun', 'shotgun', 'rocket', 'rail', 'plasma', 'pulse'];
/* Initial three-weapon balance retained for rollback.
const WEAPONS = Object.freeze({
    pulse: { id: 'pulse', name: 'PULSE', color: '#9bdfef', damage: 24, cooldown: 0.3, range: 24, spread: 0, pellets: 1, maxAmmo: Infinity, pickupAmmo: 0 },
    scatter: { id: 'scatter', name: 'SCATTER', color: '#ffc28b', damage: 12, cooldown: 0.86, range: 11, spread: 0.22, pellets: 8, maxAmmo: 32, pickupAmmo: 12 },
    rail: { id: 'rail', name: 'RAIL', color: '#d6b9ff', damage: 76, cooldown: 1.15, range: 48, spread: 0, pellets: 1, maxAmmo: 16, pickupAmmo: 6 }
});
*/
const shotgun = { id:'shotgun', name:'SHOTGUN', color:'#ffc28b', damage:11, cooldown:.72, range:15, spread:.2, verticalSpread:.13, pellets:10, maxAmmo:30, pickupAmmo:10 };
const WEAPONS = Object.freeze({
    pulse:{id:'pulse',name:'PULSE',color:'#9bdfef',damage:24,cooldown:.3,range:32,spread:0,pellets:1,maxAmmo:Infinity,pickupAmmo:0},
    machinegun:{id:'machinegun',name:'MACHINEGUN',color:'#ffd986',damage:12,cooldown:.085,range:40,spread:.018,verticalSpread:.012,pellets:1,maxAmmo:240,pickupAmmo:90},
    shotgun, scatter:shotgun,
    rocket:{id:'rocket',name:'ROCKET LAUNCHER',color:'#ff9860',damage:95,cooldown:.85,range:60,spread:0,pellets:1,maxAmmo:20,pickupAmmo:6,projectileSpeed:13,projectileRadius:.13,projectileLife:4.5,splashRadius:3.4,splashDamage:90},
    rail:{id:'rail',name:'RAILGUN',color:'#d6b9ff',damage:85,cooldown:1.1,range:60,spread:0,pellets:1,maxAmmo:18,pickupAmmo:6,piercing:true},
    plasma:{id:'plasma',name:'PLASMA RIFLE',color:'#84f4ec',damage:19,cooldown:.11,range:60,spread:.008,pellets:1,maxAmmo:180,pickupAmmo:70,projectileSpeed:20,projectileRadius:.1,projectileLife:2.7}
});
const HIT_ZONES = Object.freeze([
    {name:'head',bottom:HEAD_HEIGHT,top:BODY_HEIGHT,radius:HEAD_RADIUS,multiplier:2},
    {name:'torso',bottom:TORSO_HEIGHT,top:HEAD_HEIGHT,radius:PLAYER_RADIUS,multiplier:1},
    {name:'legs',bottom:0,top:TORSO_HEIGHT,radius:.24,multiplier:.55}
]);
const PLAYER_COLORS = ['#91e4ee', '#ffba90', '#c3e4a0', '#e8b5de', '#adc5ff', '#ffd68e', '#a8e4ca', '#f6a9b2'];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const squaredDistance = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

// DDA returns world-space distance even when the caller's direction is not unit
// length. Both rendering and authoritative hit tests use this exact helper.
function raycast(world, x, y, dx, dy, maxDistance = 80) {
    const magnitude = Math.hypot(dx, dy);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(magnitude) || magnitude < 1e-10) {
        return { distance: 0, x, y, mapX: Math.floor(x), mapY: Math.floor(y), side: 0, wall: 0, u: 0 };
    }
    dx /= magnitude;
    dy /= magnitude;
    maxDistance = Number.isFinite(maxDistance) ? Math.max(0, maxDistance) : 80;
    let mapX = Math.floor(x);
    let mapY = Math.floor(y);
    const wallAt = (xx, yy) => world.cells[yy] && world.cells[yy][xx] || (xx < 0 || yy < 0 || xx >= world.width || yy >= world.height ? 1 : 0);
    if (wallAt(mapX, mapY)) return { distance: 0, x, y, mapX, mapY, side: 0, wall: wallAt(mapX, mapY), u: 0 };
    const deltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
    const deltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
    const stepX = dx < 0 ? -1 : 1;
    const stepY = dy < 0 ? -1 : 1;
    let sideX = dx < 0 ? (x - mapX) * deltaX : (mapX + 1 - x) * deltaX;
    let sideY = dy < 0 ? (y - mapY) * deltaY : (mapY + 1 - y) * deltaY;
    let distance = 0;
    let side = 0;
    while (distance <= maxDistance) {
        if (sideX < sideY) {
            distance = sideX;
            sideX += deltaX;
            mapX += stepX;
            side = 0;
        } else {
            distance = sideY;
            sideY += deltaY;
            mapY += stepY;
            side = 1;
        }
        if (distance > maxDistance) break;
        const wall = wallAt(mapX, mapY);
        if (wall) {
            const hitX = x + dx * distance;
            const hitY = y + dy * distance;
            const coordinate = side === 0 ? hitY : hitX;
            return { distance, x: hitX, y: hitY, mapX, mapY, side, wall, u: coordinate - Math.floor(coordinate) };
        }
    }
    return { distance: maxDistance, x: x + dx * maxDistance, y: y + dy * maxDistance, mapX: Math.floor(x + dx * maxDistance), mapY: Math.floor(y + dy * maxDistance), side, wall: 0, u: 0 };
}

function circleHitsWorld(world, x, y, radius = PLAYER_RADIUS) {
    for (let yy = Math.floor(y - radius); yy <= Math.floor(y + radius); yy++) {
        for (let xx = Math.floor(x - radius); xx <= Math.floor(x + radius); xx++) {
            if (!world.isWall(xx, yy)) continue;
            const nearestX = clamp(x, xx, xx + 1);
            const nearestY = clamp(y, yy, yy + 1);
            if ((x - nearestX) ** 2 + (y - nearestY) ** 2 < radius ** 2 - 1e-9) return true;
        }
    }
    return false;
}

function moveCircle(world, player, dx, dy, radius = PLAYER_RADIUS) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
    const oldX = player.x;
    const oldY = player.y;
    // Substeps also make this safe for callers moving more than a cell at a time.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (radius * 0.65)));
    for (let i = 0; i < steps; i++) {
        if (!circleHitsWorld(world, player.x + dx / steps, player.y, radius)) player.x += dx / steps;
        if (!circleHitsWorld(world, player.x, player.y + dy / steps, radius)) player.y += dy / steps;
    }
    return Math.hypot(player.x - oldX, player.y - oldY) > 0.0001;
}

function playerRayHit(origin, direction, target, maxDistance, padding = 0) {
    let result = null;
    const horizontal = direction.x ** 2 + direction.y ** 2;
    for (const zone of HIT_ZONES) {
        const rx = origin.x - target.x, ry = origin.y - target.y;
        const radius = zone.radius + padding;
        let entry = 0, exit = maxDistance;
        if (horizontal < 1e-12) {
            if (rx * rx + ry * ry > radius * radius) continue;
        } else {
            const b = 2 * (rx * direction.x + ry * direction.y);
            const c = rx * rx + ry * ry - radius * radius;
            const discriminant = b * b - 4 * horizontal * c;
            if (discriminant < 0) continue;
            const root = Math.sqrt(discriminant);
            entry = Math.max(entry, (-b - root) / (2 * horizontal));
            exit = Math.min(exit, (-b + root) / (2 * horizontal));
        }
        const bottom = (target.z || 0) + zone.bottom - padding, top = (target.z || 0) + zone.top + padding;
        if (Math.abs(direction.z) < 1e-12) {
            if (origin.z < bottom || origin.z > top) continue;
        } else {
            const a = (bottom - origin.z) / direction.z, b = (top - origin.z) / direction.z;
            entry = Math.max(entry, Math.min(a, b));
            exit = Math.min(exit, Math.max(a, b));
        }
        if (entry > exit || entry < 0 || entry >= maxDistance) continue;
        if (!result || entry < result.distance) result = { distance:entry, zone:zone.name, multiplier:zone.multiplier };
    }
    return result;
}

class MuseumEngine {
    constructor(options = {}) {
        this.world = options.world || createWorld(options.mapId || 'museum');
        this._customWorld = options.world || null;
        this.mapId = this.world.mapId || this.world.id || 'museum';
        this.mode = MODES.some(mode => mode.id === options.mode) ? options.mode : 'ffa';
        this.players = new Map();
        this.pickups = this.world.pickups.map(item => ({ ...item, active: true, cooldown: 0 }));
        this.events = [];
        this.killFeed = [];
        this.time = 0;
        this.targetScore = options.targetScore || 12;
        this.roundDuration = options.roundDuration || 360;
        // Original seven-second result pause is now a configurable voting lobby.
        this.lobbyDuration = Number.isFinite(options.lobbyDuration) ? Math.max(.1, options.lobbyDuration) : 18;
        this.captureTarget = options.captureTarget || 3;
        this.dominationTarget = options.dominationTarget || 180;
        this.round = { remaining: this.roundDuration, winner: null, winnerId: null, winnerTeam:null, intermission: 0, number: 1, phase:'playing' };
        this.votes = {};
        this.ready = {};
        this.lobbySelection = {mapId:this.mapId,mode:this.mode};
        this.teamScores = {amber:0,cyan:0};
        this.practiceBots = options.bots !== false;
        this._seed = options.seed === undefined ? 1937 : options.seed >>> 0;
        this._playerCounter = 0;
        this.projectiles = [];
        this.effects = [];
        this._effectId = 0;
        this._projectileId = 0;
        this._resetObjectives();
    }

    _random() {
        this._seed = (1664525 * this._seed + 1013904223) >>> 0;
        return this._seed / 4294967296;
    }

    _emit(event) {
        this.events.push({ ...event, time: this.time });
        if (this.events.length > 256) this.events.shift();
    }

    drainEvents() { return this.events.splice(0); }
    getPlayer(id) { return this.players.get(id); }
    get ceilingHeight() {
        const height=this.world.ceilingHeight??this.world.wallHeight;
        return Number.isFinite(height)&&height>BODY_HEIGHT?height:CEILING_HEIGHT;
    }
    raycast(x, y, dx, dy, distance) { return raycast(this.world, x, y, dx, dy, distance); }
    hasLineOfSight(a, b) {
        const distance = Math.hypot(b.x - a.x, b.y - a.y);
        return this.raycast(a.x, a.y, b.x - a.x, b.y - a.y, distance).distance >= distance - 0.005;
    }

    _maps() { return MAPS?.length ? MAPS : [{id:'museum',name:'The Museum'}]; }
    _human(id) { const player=this.players.get(id);return player&&!player.bot?player:null; }
    _allies(a,b) { return this.mode!=='ffa'&&a&&b&&a!==b&&a.team&&a.team===b.team; }

    _resetObjectives() {
        this.teamScores={amber:0,cyan:0};this._controlScoreClock=0;
        const bases=this.world.flagBases||{amber:this.world.spawns[0],cyan:this.world.spawns.at(-1)};
        this.flags=Object.fromEntries(TEAMS.map(team=>[team,{team,base:{x:bases[team].x,y:bases[team].y},
            x:bases[team].x,y:bases[team].y,carrierId:null,atBase:true,dropped:false,returnTimer:0}]));
        this.controlPoints=(this.world.dominationPoints||[]).map(point=>({...point,owner:null,capturingTeam:null,progress:0,contested:false,radius:2}));
        for(const player of this.players.values())player.carryingFlag=null;
    }

    _setTeam(player,team,respawn=true) {
        if(player.team===team)return;
        this._dropFlag(player);player.team=team;player.color=team?TEAM_COLORS[team]:player.baseColor;
        if(respawn)this._respawn(player);
    }

    _syncTeams(respawn=true,reset=false) {
        if(this.mode==='ffa') {for(const player of this.players.values())this._setTeam(player,null,respawn);return;}
        const humans=[...this.players.values()].filter(player=>!player.bot);
        const bots=[...this.players.values()].filter(player=>player.bot);
        if(reset)for(const player of this.players.values())player.team=null;
        const counts={amber:0,cyan:0};
        for(const player of humans)if(TEAMS.includes(player.team))counts[player.team]++;
        const nextTeam=()=>counts.amber===counts.cyan?TEAMS[(this.round.number-1)%2]:counts.amber<counts.cyan?'amber':'cyan';
        for(const player of humans)if(!TEAMS.includes(player.team)){const team=nextTeam();this._setTeam(player,team,respawn);counts[team]++;}
        while(Math.abs(counts.amber-counts.cyan)>1){
            const larger=counts.amber>counts.cyan?'amber':'cyan',smaller=larger==='amber'?'cyan':'amber';
            const candidates=humans.filter(player=>player.team===larger);
            const player=candidates.filter(p=>!p.carryingFlag).at(-1)||candidates.at(-1);
            this._setTeam(player,smaller,respawn);counts[larger]--;counts[smaller]++;
        }
        for(const player of bots){const team=nextTeam();this._setTeam(player,team,respawn);counts[team]++;}
    }

    _rotateChoice(ids,current,counts={}) {
        const start=(ids.indexOf(current)+1)%ids.length;
        const ranked=ids.map((_,index)=>ids[(start+index)%ids.length]);
        let winner=ranked[0],best=-1;
        for(const id of ranked){const count=counts[id]||0;if(count>best){winner=id;best=count;}}
        return winner;
    }

    _resolveVotes() {
        const mapCounts={},modeCounts={};
        for(const [id,vote] of Object.entries(this.votes)){
            if(!this._human(Number(id)))continue;
            if(vote.mapId)mapCounts[vote.mapId]=(mapCounts[vote.mapId]||0)+1;
            if(vote.mode)modeCounts[vote.mode]=(modeCounts[vote.mode]||0)+1;
        }
        const maps=this._maps().map(map=>map.id),modes=MODES.map(mode=>mode.id);
        this.lobbySelection={
            mapId:Object.keys(mapCounts).length?this._rotateChoice(maps,this.mapId,mapCounts):this._lobbyDefault.mapId,
            mode:Object.keys(modeCounts).length?this._rotateChoice(modes,this.mode,modeCounts):this._lobbyDefault.mode
        };
        return this.lobbySelection;
    }

    openLobby({initial=false}={}) {
        this.round.phase='lobby';this.round.intermission=this.lobbyDuration;
        this._initialLobby=initial&&this.round.number===1;
        this.votes={};this.ready={};
        const maps=this._maps().map(map=>map.id);
        this._lobbyDefault={mapId:initial&&maps.includes('kitchen')?'kitchen':this._rotateChoice(maps,this.mapId),
            mode:initial?'ffa':this._rotateChoice(MODES.map(mode=>mode.id),this.mode)};
        this.lobbySelection={...this._lobbyDefault};
        this.projectiles=[];this.effects=[];
        for(const player of this.players.values()){
            player._input={forward:0,strafe:0,turn:0,fire:false,sprint:false,jump:false};
            player.vx=player.vy=player.vz=0;player.moving=false;player._aimTime=0;
        }
        return this.lobbySelection;
    }

    vote(id,choice={}) {
        const player=this._human(id);
        if(!player||this.round.phase!=='lobby'||!choice||typeof choice!=='object')return false;
        const hasMap=Object.hasOwn(choice,'mapId'),hasMode=Object.hasOwn(choice,'mode');
        if(!hasMap&&!hasMode||hasMap&&!this._maps().some(map=>map.id===choice.mapId)||hasMode&&!MODES.some(mode=>mode.id===choice.mode))return false;
        this.votes[id]={...this.votes[id],...(hasMap?{mapId:choice.mapId}:{}),...(hasMode?{mode:choice.mode}:{})};
        this.ready[id]=false;this._resolveVotes();return true;
    }

    setReady(id,value=true) {
        if(!this._human(id)||this.round.phase!=='lobby'||typeof value!=='boolean')return false;
        this.ready[id]=value;this._maybeStartReady();return true;
    }

    _maybeStartReady() {
        const humans=[...this.players.values()].filter(player=>!player.bot);
        if(this.round.phase==='lobby'&&humans.length&&humans.every(player=>this.ready[player.id]))this._newRound();
    }

    startRound({mapId=this.mapId,mode=this.mode}={}) {
        if(!this._maps().some(map=>map.id===mapId)||!MODES.some(item=>item.id===mode))return false;
        const world=this._customWorld&&mapId===this.mapId?this._customWorld:createWorld(mapId);
        this.world=world;this.mapId=world.mapId||world.id||mapId;this.mode=mode;
        this.pickups=world.pickups.map(item=>({...item,active:true,cooldown:0}));
        this.round={remaining:this.roundDuration,winner:null,winnerId:null,winnerTeam:null,intermission:0,number:this.round.number+(this._initialLobby?0:1),phase:'playing'};
        this._initialLobby=false;
        this.votes={};this.ready={};this.lobbySelection={mapId:this.mapId,mode:this.mode};
        this._resetObjectives();this._syncTeams(false,true);
        for(const player of this.players.values()){
            player.kills=0;player.deaths=0;player.score=0;player.captures=0;player.objectiveScore=0;this._respawn(player);
        }
        this.killFeed=[];this.projectiles=[];this.effects=[];
        this._emit({type:'round',mapId:this.mapId,mode:this.mode});return true;
    }

    _returnFlag(flag,playerId=null) {
        if(flag.carrierId!==null){const carrier=this.players.get(flag.carrierId);if(carrier)carrier.carryingFlag=null;}
        Object.assign(flag,{x:flag.base.x,y:flag.base.y,carrierId:null,atBase:true,dropped:false,returnTimer:0});
        this._emit({type:'flagReturn',playerId,team:flag.team,x:flag.x,y:flag.y});
    }

    _dropFlag(player) {
        if(!player?.carryingFlag)return;
        const flag=this.flags?.[player.carryingFlag];player.carryingFlag=null;
        if(!flag||flag.carrierId!==player.id)return;
        Object.assign(flag,{x:player.x,y:player.y,carrierId:null,atBase:false,dropped:true,returnTimer:FLAG_RETURN_SECONDS});
        this._emit({type:'flagDrop',playerId:player.id,team:flag.team,x:flag.x,y:flag.y});
    }

    _objectives(dt) {
        if(this.mode==='ctf'){
            for(const flag of Object.values(this.flags)){
                if(flag.carrierId!==null){const carrier=this.players.get(flag.carrierId);if(carrier&&carrier.hp>0){flag.x=carrier.x;flag.y=carrier.y;}else this._returnFlag(flag);}
                else if(flag.dropped){flag.returnTimer=Math.max(0,flag.returnTimer-dt);if(flag.returnTimer===0)this._returnFlag(flag);}
            }
            const alive=[...this.players.values()].filter(player=>player.hp>0&&player.respawn<=0&&player.z<.8&&player.team);
            // Own-team returns resolve before enemy pickups/captures, avoiding
            // iteration-order-dependent flag denial when both arrive together.
            for(const player of alive){const own=this.flags[player.team];if(own.dropped&&squaredDistance(player,own)<.85**2&&this.hasLineOfSight(player,own))this._returnFlag(own,player.id);}
            for(const player of alive){
                const own=this.flags[player.team],enemy=this.flags[player.team==='amber'?'cyan':'amber'];
                if(enemy.carrierId===null&&!player.carryingFlag&&squaredDistance(player,enemy)<.85**2&&this.hasLineOfSight(player,enemy)){
                    Object.assign(enemy,{carrierId:player.id,atBase:false,dropped:false,returnTimer:0});player.carryingFlag=enemy.team;player.invulnerable=0;
                    this._emit({type:'flagPickup',playerId:player.id,team:enemy.team,x:player.x,y:player.y});
                }
                if(player.carryingFlag&&own.atBase&&squaredDistance(player,own.base)<1**2&&this.hasLineOfSight(player,own.base)){
                    this._returnFlag(this.flags[player.carryingFlag]);player.captures++;player.objectiveScore+=100;this.teamScores[player.team]++;
                    this._emit({type:'flagCapture',playerId:player.id,team:player.team,x:player.x,y:player.y});
                    if(this.teamScores[player.team]>=this.captureTarget){this._finishRound(player.team);break;}
                }
            }
        }else if(this.mode==='domination'){
            for(const point of this.controlPoints){
                const counts={amber:0,cyan:0};
                for(const player of this.players.values())if(player.hp>0&&player.respawn<=0&&player.team&&player.z<1.3&&squaredDistance(player,point)<point.radius**2&&this.hasLineOfSight(player,point))counts[player.team]++;
                point.contested=counts.amber>0&&counts.cyan>0;
                if(point.contested)continue;
                const team=counts.amber?'amber':counts.cyan?'cyan':null;
                if(!team){point.progress=Math.max(0,point.progress-dt/CAPTURE_SECONDS);if(point.progress===0)point.capturingTeam=null;continue;}
                if(team===point.owner){point.progress=0;point.capturingTeam=null;continue;}
                if(point.capturingTeam!==team){point.capturingTeam=team;point.progress=0;}
                point.progress=Math.min(1,point.progress+dt/CAPTURE_SECONDS);
                if(point.progress>=1-1e-8){point.owner=team;point.capturingTeam=null;point.progress=0;
                    this._emit({type:'controlCapture',team,pointId:point.id,x:point.x,y:point.y});}
            }
            this._controlScoreClock+=dt;
            if(this._controlScoreClock>=CONTROL_SCORE_INTERVAL-1e-8){
                this._controlScoreClock-=CONTROL_SCORE_INTERVAL;
                for(const point of this.controlPoints)if(point.owner&&!point.contested)this.teamScores[point.owner]++;
                if(Math.max(this.teamScores.amber,this.teamScores.cyan)>=this.dominationTarget){
                    this._finishRound(this.teamScores.amber===this.teamScores.cyan?null:this.teamScores.amber>this.teamScores.cyan?'amber':'cyan');
                }
            }
        }
    }

    _createPlayer(id, name, bot) {
        const player = {
            id, name: String(name || 'Visitor').slice(0, 28), x: 21.5, y: 21.8, angle: -Math.PI / 2,
            hp: 100, shield: 0, radius: PLAYER_RADIUS, weapon: 'pulse', ammo: { pulse: Infinity, scatter: 0, rail: 0 }, owned: ['pulse'],
            score: 0, kills: 0, deaths: 0, respawn: 0, invulnerable: 0, shotFlash: 0, damageFlash: 0, hitFlash: 0, aimFlash: 0,
            moving: false, bot: !!bot, color: PLAYER_COLORS[this._playerCounter++ % PLAYER_COLORS.length],
            team:null,carryingFlag:null,captures:0,objectiveScore:0,
            _input: { forward: 0, strafe: 0, turn: 0, fire: false, sprint: false }, _cooldown: 0, _think: 0, _path: [], _aimTime: 0
        };
        player.baseColor=player.color;
        this.players.set(id, player);
        this._respawn(player, this.players.size === 1);
        return player;
    }

    addPlayer(id, name) {
        if (this.players.has(id)) return this.players.get(id);
        const player = this._createPlayer(id, name, false);
        this._balanceBots();
        return player;
    }

    removePlayer(id) {
        this._dropFlag(this.players.get(id));
        this.players.delete(id);
        delete this.votes[id];delete this.ready[id];
        this.projectiles = this.projectiles.filter(projectile => projectile.ownerId !== id);
        this._balanceBots();
        if(this.round.phase==='lobby'){this._resolveVotes();this._maybeStartReady();}
    }

    _balanceBots() {
        const humans = [...this.players.values()].filter(player => !player.bot).length;
        const wanted = humans && this.practiceBots ? Math.max(0, 4 - humans) : 0;
        for (const player of [...this.players.values()]) {
            // if (player.bot && -player.id > wanted) this.players.delete(player.id);
            if (player.bot && -player.id > wanted) {
                this._dropFlag(player);
                this.players.delete(player.id);
                this.projectiles = this.projectiles.filter(projectile => projectile.ownerId !== player.id);
            }
        }
        const names = ['DOCENT / 01', 'DOCENT / 02', 'DOCENT / 03'];
        for (let i = 1; i <= wanted; i++) if (!this.players.has(-i)) this._createPlayer(-i, names[i - 1], true);
        this._syncTeams();
    }

    input(id, state = {}) {
        const player = this.players.get(id);
        if (!player || player.bot) return;
        const axis = value => Number.isFinite(value) ? clamp(value, -1, 1) : 0;
        // player._input = { forward: axis(state.forward), strafe: axis(state.strafe), turn: axis(state.turn), fire: !!state.fire, sprint: !!state.sprint };
        player._input = { forward: axis(state.forward), strafe: axis(state.strafe), turn: axis(state.turn), fire: !!state.fire, sprint: !!state.sprint, jump: !!state.jump };
        if (Number.isFinite(state.pitch)) player.pitch = clamp(state.pitch, -MAX_PITCH, MAX_PITCH);
        // if (typeof state.weapon === 'string' && player.owned.includes(state.weapon)) player.weapon = state.weapon;
        const selected = state.weapon === 'scatter' ? 'shotgun' : state.weapon;
        if (typeof selected === 'string' && player.owned.includes(selected)) player.weapon = selected;
        if (Number.isInteger(state.weapon) && player.owned[state.weapon]) player.weapon = player.owned[state.weapon];
    }

    cycleWeapon(id) {
        const player = this.players.get(id);
        if (!player || player.hp <= 0) return;
        // player.weapon = player.owned[(player.owned.indexOf(player.weapon) + 1) % player.owned.length];
        const available = WEAPON_ORDER.filter(key => player.owned.includes(key));
        player.weapon = available[(available.indexOf(player.weapon) + 1) % available.length];
    }

    /* Flat hitscan fire/damage retained below; finite-height combat replaces it.
    fire(id, aimAngle) {
        const player = this.players.get(id);
        if (!player || player.hp <= 0 || player.respawn > 0 || player._cooldown > 0 || this.round.intermission > 0) return false;
        const weapon = WEAPONS[player.weapon];
        if (player.ammo[player.weapon] <= 0) {
            player.weapon = 'pulse';
            return false;
        }
        player.ammo[player.weapon]--;
        player._cooldown = weapon.cooldown;
        player.shotFlash = 0.15;
        // Attacking forfeits spawn protection; opponents never face an invincible gun.
        player.invulnerable = 0;
        const angle = Number.isFinite(aimAngle) ? aimAngle : player.angle;
        const shot = { type: 'shot', playerId: id, weapon: weapon.id, x: player.x, y: player.y, angle };
        this._emit(shot);
        const damage = new Map();
        for (let pellet = 0; pellet < weapon.pellets; pellet++) {
            const offset = weapon.pellets > 1 ? (pellet / (weapon.pellets - 1) - 0.5) * weapon.spread * 2 : 0;
            const dx = Math.cos(angle + offset);
            const dy = Math.sin(angle + offset);
            let nearest = this.raycast(player.x, player.y, dx, dy, weapon.range).distance;
            let target = null;
            for (const other of this.players.values()) {
                if (other === player || other.hp <= 0 || other.respawn > 0) continue;
                const rx = other.x - player.x;
                const ry = other.y - player.y;
                const along = rx * dx + ry * dy;
                const perpendicularSquared = rx * rx + ry * ry - along * along;
                if (along <= 0 || perpendicularSquared > PLAYER_RADIUS ** 2) continue;
                const entry = Math.max(0, along - Math.sqrt(Math.max(0, PLAYER_RADIUS ** 2 - perpendicularSquared)));
                if (entry < nearest) { nearest = entry; target = other; }
            }
            if (target && target.invulnerable <= 0) damage.set(target, (damage.get(target) || 0) + weapon.damage);
        }
        for (const [target, amount] of damage) this._damage(player, target, amount, weapon.id);
        return true;
    }

    _damage(attacker, target, amount, weapon) {
        const absorbed = Math.min(target.shield, amount);
        target.shield -= absorbed;
        target.hp = Math.max(0, target.hp - (amount - absorbed));
        target.damageFlash = 0.3;
        attacker.hitFlash = 0.16;
        this._emit({ type: 'hit', playerId: attacker.id, targetId: target.id, weapon, x: target.x, y: target.y, amount });
        if (target.hp > 0) return;
        target.deaths++;
        target.respawn = 3;
        target.moving = false;
        target._aimTime = 0;
        attacker.kills++;
        attacker.score++;
        const kill = { type: 'kill', playerId: attacker.id, targetId: target.id, killer: attacker.name, victim: target.name, weapon, x: target.x, y: target.y };
        this._emit(kill);
        this.killFeed.unshift({ ...kill, time: this.time });
        this.killFeed.length = Math.min(5, this.killFeed.length);
        if (attacker.score >= this.targetScore) this._finishRound(attacker);
    }
    */

    _effect(effect) {
        this.effects.push({ id:++this._effectId, age:0, life:.2, radius:.15, ...effect });
        if (this.effects.length > MAX_EFFECTS) this.effects.splice(0, this.effects.length - MAX_EFFECTS);
    }

    _worldRay(origin, direction, distance) {
        const horizontal = Math.hypot(direction.x, direction.y);
        let hit = { distance, surface:null };
        if (horizontal > 1e-9) {
            const wall = this.raycast(origin.x, origin.y, direction.x, direction.y, distance * horizontal);
            if (wall.wall) hit = { distance:wall.distance / horizontal, surface:'wall' };
        }
        if (direction.z !== 0) {
            const plane = direction.z > 0 ? this.ceilingHeight : 0;
            const d = (plane - origin.z) / direction.z;
            if (d >= 0 && d < hit.distance) hit = { distance:d, surface:direction.z > 0 ? 'ceiling' : 'floor' };
        }
        return hit;
    }

    fire(id, aimAngle, aimPitch) {
        const player = this.players.get(id);
        if (!player || player.hp <= 0 || player.respawn > 0 || player._cooldown > 0 || this.round.intermission > 0) return false;
        if (player.weapon === 'scatter') player.weapon = 'shotgun';
        const weapon = WEAPONS[player.weapon];
        if (!weapon || !player.owned.includes(player.weapon)) return false;
        if (!(player.ammo[player.weapon] > 0)) { player.weapon = 'pulse'; return false; }
        if (weapon.projectileSpeed && this.projectiles.length >= MAX_PROJECTILES) return false;
        player.ammo[player.weapon]--;
        player._cooldown = weapon.cooldown;
        player.shotFlash = Math.min(.15, weapon.cooldown * .8);
        player.invulnerable = 0;
        const angle = Number.isFinite(aimAngle) ? aimAngle : player.angle;
        const pitch = clamp(Number.isFinite(aimPitch) ? aimPitch : player.pitch || 0, -MAX_PITCH, MAX_PITCH);
        const origin = { x:player.x, y:player.y, z:player.z + EYE_HEIGHT };
        this._emit({type:'shot',playerId:id,weapon:weapon.id,...origin,angle,pitch});
        if (weapon.projectileSpeed) {
            const horizontal = Math.cos(pitch), direction = {x:Math.cos(angle)*horizontal,y:Math.sin(angle)*horizontal,z:Math.sin(pitch)};
            this.projectiles.push({id:++this._projectileId,ownerId:id,weapon:weapon.id,...origin,
                vx:direction.x*weapon.projectileSpeed,vy:direction.y*weapon.projectileSpeed,vz:direction.z*weapon.projectileSpeed,
                radius:weapon.projectileRadius,age:0,life:weapon.projectileLife,color:weapon.color,trail:[]});
            return true;
        }
        const damages = new Map();
        for (let pellet = 0; pellet < weapon.pellets; pellet++) {
            const azimuth = angle + (weapon.pellets > 1 ? (pellet / (weapon.pellets - 1) - .5) * weapon.spread * 2 : (this._random() - .5) * weapon.spread * 2);
            const elevation = clamp(pitch + (weapon.verticalSpread || 0) * (weapon.pellets > 1 ? Math.sin(pellet * 2.39996) : (this._random() - .5) * 2), -MAX_PITCH, MAX_PITCH);
            const horizontal = Math.cos(elevation), direction = {x:Math.cos(azimuth)*horizontal,y:Math.sin(azimuth)*horizontal,z:Math.sin(elevation)};
            const worldHit = this._worldRay(origin,direction,weapon.range);
            const targets = [];
            for (const target of this.players.values()) {
                if (target === player || target.hp <= 0 || target.respawn > 0) continue;
                const hit = playerRayHit(origin,direction,target,worldHit.distance);
                if (hit) targets.push({target,...hit});
            }
            targets.sort((a,b)=>a.distance-b.distance);
            const hitTargets = weapon.piercing ? targets : targets.slice(0,1);
            let distance = worldHit.distance;
            if (!weapon.piercing && hitTargets.length) distance = hitTargets[0].distance;
            for (const hit of hitTargets) {
                if (hit.target.invulnerable > 0) continue;
                const prior = damages.get(hit.target) || {amount:0,hitZone:hit.zone};
                prior.amount += weapon.damage * hit.multiplier;
                if (hit.zone === 'head') prior.hitZone = 'head';
                damages.set(hit.target,prior);
            }
            const end = {x:origin.x+direction.x*distance,y:origin.y+direction.y*distance,z:origin.z+direction.z*distance};
            this._effect({type:'tracer',ownerId:id,weapon:weapon.id,...origin,endX:end.x,endY:end.y,endZ:end.z,color:weapon.color,
                life:weapon.id === 'rail' ? .32 : .085,radius:weapon.id === 'rail' ? .05 : .012});
            if (worldHit.surface && distance === worldHit.distance) this._effect({type:'impact',ownerId:id,weapon:weapon.id,...end,color:weapon.color,life:.22,radius:.12});
        }
        for (const [target,hit] of damages) this._damage(player,target,hit.amount,weapon.id,hit.hitZone);
        return true;
    }

    _damage(attacker,target,amount,weapon,hitZone='torso') {
        if (target.hp <= 0 || target.invulnerable > 0 || this._allies(attacker,target) || !Number.isFinite(amount) || amount <= 0) return;
        const absorbed = Math.min(target.shield,amount);
        target.shield -= absorbed;
        target.hp = Math.max(0,target.hp-(amount-absorbed));
        target.damageFlash = .3;
        if (attacker) {attacker.hitFlash=.16;attacker.lastHitZone=hitZone;}
        this._emit({type:'hit',playerId:attacker?.id ?? 0,targetId:target.id,weapon,x:target.x,y:target.y,z:target.z+1,amount,hitZone});
        this._effect({type:'impact',ownerId:attacker?.id,weapon,x:target.x,y:target.y,z:target.z+(hitZone==='head'?1.55:hitZone==='legs'?.35:1),
            color:hitZone==='head'?'#ffe8ad':'#f7b798',life:.18,radius:.13,hitZone});
        if (target.hp > 0) return;
        this._dropFlag(target);
        target.deaths++;target.respawn=3;target.moving=false;target._aimTime=0;
        if (attacker && attacker !== target) {attacker.kills++;attacker.score++;}
        else if (attacker === target) attacker.score=Math.max(0,attacker.score-1);
        const kill = {type:'kill',playerId:attacker?.id ?? 0,targetId:target.id,killer:attacker?.name || 'THE MUSEUM',victim:target.name,
            weapon,x:target.x,y:target.y,z:target.z,hitZone,self:attacker===target};
        this._emit(kill);this.killFeed.unshift({...kill,time:this.time});this.killFeed.length=Math.min(5,this.killFeed.length);
        // Team objective rounds are won by captures/control, never frag count.
        if (this.mode==='ffa' && attacker && attacker.score >= this.targetScore) this._finishRound(attacker);
    }

    _explode(projectile,directTarget=null,directZone='torso') {
        const weapon = WEAPONS[projectile.weapon],attacker=this.players.get(projectile.ownerId);
        if (directTarget) {
            const multiplier = HIT_ZONES.find(zone=>zone.name===directZone)?.multiplier || 1;
            this._damage(attacker,directTarget,weapon.damage*multiplier,weapon.id,directZone);
        }
        if (!weapon.splashRadius) {
            this._effect({type:'impact',ownerId:projectile.ownerId,weapon:weapon.id,x:projectile.x,y:projectile.y,z:projectile.z,color:weapon.color,life:.2,radius:.3});
            return;
        }
        this._effect({type:'explosion',ownerId:projectile.ownerId,weapon:weapon.id,x:projectile.x,y:projectile.y,z:projectile.z,color:weapon.color,life:.55,radius:weapon.splashRadius});
        this._emit({type:'explosion',playerId:projectile.ownerId,weapon:weapon.id,x:projectile.x,y:projectile.y,z:projectile.z,radius:weapon.splashRadius});
        for (const target of this.players.values()) {
            if (target.hp<=0 || target.invulnerable>0 || this._allies(attacker,target) || !this.hasLineOfSight(projectile,target)) continue;
            const dx=target.x-projectile.x,dy=target.y-projectile.y,dz=target.z+BODY_HEIGHT*.45-projectile.z;
            const distance=Math.hypot(dx,dy,dz);
            if (distance>=weapon.splashRadius) continue;
            const strength=1-distance/weapon.splashRadius;
            if (target!==directTarget) this._damage(attacker,target,weapon.splashDamage*strength*(target===attacker? .6:1),weapon.id,'splash');
            const horizontal=Math.hypot(dx,dy)||1;
            target.vx=clamp(target.vx+dx/horizontal*strength*7,-14,14);
            target.vy=clamp(target.vy+dy/horizontal*strength*7,-14,14);
            target.vz=Math.min(7.5,Math.max(target.vz,strength*6.8));
            target.grounded=false;
        }
    }

    _advanceProjectiles(dt) {
        const active=[];
        for (const projectile of this.projectiles) {
            projectile.age+=dt;
            const speed=Math.hypot(projectile.vx,projectile.vy,projectile.vz),distance=speed*dt;
            const direction={x:projectile.vx/speed,y:projectile.vy/speed,z:projectile.vz/speed};
            let impactDistance=distance,target=null,zone='torso',collided=false;
            // A swept sphere samples wall volume at sub-radius intervals; the
            // player intersections below are analytic, so fast plasma cannot tunnel.
            const samples=Math.max(1,Math.ceil(distance/(projectile.radius*.45)));
            for(let i=0;i<=samples;i++){
                const d=distance*i/samples,x=projectile.x+direction.x*d,y=projectile.y+direction.y*d,z=projectile.z+direction.z*d;
                if(z<projectile.radius||z>this.ceilingHeight-projectile.radius||circleHitsWorld(this.world,x,y,projectile.radius)){
                    impactDistance=Math.max(0,d-distance/samples*.6);collided=true;break;
                }
            }
            for(const other of this.players.values()){
                if(other.id===projectile.ownerId||other.hp<=0||other.respawn>0)continue;
                const hit=playerRayHit(projectile,direction,other,impactDistance,projectile.radius);
                if(hit){impactDistance=hit.distance;target=other;zone=hit.zone;collided=true;}
            }
            projectile.trail.push({x:projectile.x,y:projectile.y,z:projectile.z});
            if(projectile.trail.length>8)projectile.trail.shift();
            projectile.x+=direction.x*impactDistance;projectile.y+=direction.y*impactDistance;projectile.z+=direction.z*impactDistance;
            if(collided)this._explode(projectile,target,zone);
            else if(projectile.age<projectile.life)active.push(projectile);
            else if(projectile.weapon==='rocket')this._explode(projectile);
            if(this.round.intermission>0)break;
        }
        this.projectiles=this.round.intermission>0?[]:active;
    }

    _movePlayer(player,dt,forward,strafe,sprint,jump) {
        const normalized=Math.max(1,Math.hypot(forward,strafe));
        const desiredSpeed=player.bot?2.65:sprint?SPRINT_SPEED:RUN_SPEED;
        const dx=(Math.cos(player.angle)*forward-Math.sin(player.angle)*strafe)/normalized;
        const dy=(Math.sin(player.angle)*forward+Math.cos(player.angle)*strafe)/normalized;
        if(player.grounded){
            if(Math.abs(forward)+Math.abs(strafe)<.001){
                const drag=Math.max(0,1-12*dt);player.vx*=drag;player.vy*=drag;
            }else{
                const changeX=dx*desiredSpeed-player.vx,changeY=dy*desiredSpeed-player.vy;
                const change=Math.hypot(changeX,changeY),scale=change?Math.min(1,55*dt/change):0;
                player.vx+=changeX*scale;player.vy+=changeY*scale;
            }
        }else if(Math.abs(forward)+Math.abs(strafe)>.001){
            player.vx+=dx*7*dt;player.vy+=dy*7*dt;
            const speed=Math.hypot(player.vx,player.vy),cap=SPRINT_SPEED*1.25;
            if(speed>cap){player.vx*=cap/speed;player.vy*=cap/speed;}
        }
        if(jump&&!player._jumpHeld&&player.grounded){player.vz=JUMP_SPEED;player.grounded=false;this._emit({type:'jump',playerId:player.id,x:player.x,y:player.y,z:player.z});}
        player._jumpHeld=!!jump;
        const x=player.x,y=player.y;
        player.moving=moveCircle(this.world,player,player.vx*dt,player.vy*dt);
        if(Math.abs(player.x-x)<.000001)player.vx=0;
        if(Math.abs(player.y-y)<.000001)player.vy=0;
        if(!player.grounded){
            player.vz-=GRAVITY*dt;player.z+=player.vz*dt;
            if(player.z>=this.ceilingHeight-BODY_HEIGHT){player.z=this.ceilingHeight-BODY_HEIGHT;player.vz=Math.min(0,player.vz);}
            if(player.z<=0){player.z=0;player.vz=0;player.grounded=true;}
        }
    }

    _respawn(player, first = false) {
        this._dropFlag(player);
        const spawns=this.mode!=='ffa'&&player.team&&this.world.teamSpawns?.[player.team]?.length?this.world.teamSpawns[player.team]:this.world.spawns;
        let spawn = spawns[0];
        let best = -1;
        if (!first) {
            for (const candidate of spawns) {
                let nearest = 10000;
                for (const other of this.players.values()) {
                    if (other !== player && other.hp > 0) nearest = Math.min(nearest, squaredDistance(candidate, other));
                }
                if (nearest > best) { best = nearest; spawn = candidate; }
            }
        }
        // Original flat spawn loadout retained for rollback.
        // Object.assign(player, spawn, { hp: 100, shield: 0, weapon: 'pulse', ammo: { pulse: Infinity, scatter: 0, rail: 0 }, owned: ['pulse'], respawn: 0, invulnerable: 2.5, shotFlash: 0, damageFlash: 0, hitFlash: 0, aimFlash: 0, moving: false, _cooldown: 0, _aimTime: 0, _think: 0, _path: [] });
        Object.assign(player,spawn,{hp:100,shield:0,weapon:player.bot?'pulse':'machinegun',
            ammo:{pulse:Infinity,machinegun:player.bot?0:120,shotgun:0,rocket:0,rail:0,plasma:0},
            owned:player.bot?['pulse']:['machinegun','pulse'],z:0,vz:0,vx:0,vy:0,pitch:0,grounded:true,
            respawn:0,invulnerable:2.5,shotFlash:0,damageFlash:0,hitFlash:0,aimFlash:0,moving:false,lastHitZone:null,
            _cooldown:0,_aimTime:0,_think:0,_path:[],_jumpHeld:false});
        // player._input = { forward: 0, strafe: 0, turn: 0, fire: false, sprint: false };
        player._input = { forward:0,strafe:0,turn:0,fire:false,sprint:false,jump:false };
        this._emit({ type: 'respawn', playerId: player.id, x: player.x, y: player.y });
    }

    _finishRound(winner) {
        if(this.round.phase==='lobby')return;
        const team=TEAMS.includes(winner)?winner:null;
        this.round.winner = team?team.toUpperCase():winner?.name || 'DRAW';
        this.round.winnerId = team?null:winner?.id ?? null;
        this.round.winnerTeam = team;
        // this.round.intermission = 7; // Original result-only pause.
        this.openLobby();
    }

    _newRound() {
        /* Original single-map round reset retained for rollback.
        this.round = { remaining: this.roundDuration, winner: null, winnerId: null, intermission: 0, number: this.round.number + 1 };
        for (const pickup of this.pickups) { pickup.active = true; pickup.cooldown = 0; }
        for (const player of this.players.values()) {
            player.kills = 0;
            player.deaths = 0;
            player.score = 0;
            this._respawn(player);
        }
        this.killFeed.length = 0;
        this.projectiles = [];
        this.effects = [];
        */
        this.startRound(this._resolveVotes());
    }

    // A small breadth-first search runs at most once a second per practice drone.
    // They follow floor cells through real doors, never walk or shoot through walls.
    _pathTo(player, target) {
        const width = this.world.width;
        const start = Math.floor(player.y) * width + Math.floor(player.x);
        const goal = Math.floor(target.y) * width + Math.floor(target.x);
        if (start === goal) return [];
        const previous = new Int32Array(width * this.world.height).fill(-1);
        const queue = [start];
        previous[start] = start;
        for (let head = 0; head < queue.length && previous[goal] < 0; head++) {
            const current = queue[head];
            const x = current % width;
            const y = Math.floor(current / width);
            for (const [xx, yy] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
                if (this.world.isWall(xx, yy)) continue;
                const next = yy * width + xx;
                if (previous[next] >= 0) continue;
                previous[next] = current;
                queue.push(next);
            }
        }
        if (previous[goal] < 0) return [];
        const path = [];
        for (let current = goal; current !== start; current = previous[current]) path.push({ x: current % width + 0.5, y: Math.floor(current / width) + 0.5 });
        return path.reverse();
    }

    _objectiveDestination(player) {
        if(this.mode==='ctf'){
            const own=this.flags[player.team],enemy=this.flags[player.team==='amber'?'cyan':'amber'];
            if(player.carryingFlag)return own.atBase?own.base:own;
            if(!own.atBase&&(own.carrierId!==null||squaredDistance(player,own)<squaredDistance(player,enemy)))return own;
            if(enemy.carrierId!==null)return own.base;
            return enemy;
        }
        const desired=this.controlPoints.filter(point=>point.owner!==player.team||point.contested);
        const candidates=desired.length?desired:this.controlPoints;
        // Prioritize nearby objectives still held by opponents or contested.
        return candidates.slice().sort((a,b)=>squaredDistance(player,a)-squaredDistance(player,b))[0]||this.world.spawns[0];
    }

    _updateObjectiveBot(player,dt) {
        const goal=this._objectiveDestination(player);
        const goalVisible=this.hasLineOfSight(player,goal);
        const goalKey=Math.floor(goal.x)+','+Math.floor(goal.y);
        player._think-=dt;
        if(!goalVisible&&(player._think<=0||player._goalKey!==goalKey)){
            player._path=this._pathTo(player,goal);player._think=.8+this._random()*.4;player._goalKey=goalKey;
        }
        while(player._path.length&&squaredDistance(player,player._path[0])<.11)player._path.shift();
        const destination=goalVisible?goal:player._path[0];
        let enemy=null,best=Infinity;
        for(const other of this.players.values()){
            if(other===player||other.hp<=0||this._allies(player,other))continue;
            const distance=squaredDistance(player,other);
            if(distance<best&&this.hasLineOfSight(player,other)){enemy=other;best=distance;}
        }
        const combat=enemy&&best<18**2;
        const facing=combat?enemy:destination||goal;
        const angle=Math.atan2(facing.y-player.y,facing.x-player.x);
        player.angle=wrapAngle(player.angle+clamp(wrapAngle(angle-player.angle),-2.6*dt,2.6*dt));
        if(destination&&squaredDistance(player,goal)>.4**2){
            const travel=Math.atan2(destination.y-player.y,destination.x-player.x)-player.angle;
            this._movePlayer(player,dt,Math.cos(travel),Math.sin(travel),false,false);
        }else this._movePlayer(player,dt,0,0,false,false);
        if(combat&&enemy.invulnerable<=0&&Math.abs(wrapAngle(angle-player.angle))<.16){
            player.pitch=clamp(Math.atan2(enemy.z+.95-(player.z+EYE_HEIGHT),Math.sqrt(best)),-MAX_PITCH,MAX_PITCH);
            player._aimTime+=dt;player.aimFlash=clamp(player._aimTime/.85,0,1);
            if(player._aimTime>=.85&&player._cooldown<=0){
                const error=this._random()<.45?(this._random()<.5?-.18:.18):(this._random()-.5)*.025;
                this.fire(player.id,angle+error,player.pitch);player._aimTime=0;
            }
        }else{player._aimTime=0;player.aimFlash=0;}
    }

    _updateBot(player, dt) {
        if(this.mode!=='ffa'&&player.team){this._updateObjectiveBot(player,dt);return;}
        let target = null;
        let distanceSquared = Infinity;
        for (const other of this.players.values()) {
            if (other === player || other.hp <= 0) continue;
            // In solo play the drones prefer other drones until the visitor is close.
            const d = squaredDistance(player, other) * (other.bot ? 1 : 1.2);
            if (d < distanceSquared) { distanceSquared = d; target = other; }
        }
        if (!target) { player.moving = false; return; }
        const distance = Math.hypot(target.x - player.x, target.y - player.y);
        const visible = this.hasLineOfSight(player, target);
        player._think -= dt;
        if (player._think <= 0 && !visible) {
            player._path = this._pathTo(player, target);
            player._think = 0.8 + this._random() * 0.4;
        }
        while (player._path.length && squaredDistance(player, player._path[0]) < 0.11) player._path.shift();
        const destination = visible ? target : player._path[0];
        if (destination) {
            const desired = Math.atan2(destination.y - player.y, destination.x - player.x);
            player.angle = wrapAngle(player.angle + clamp(wrapAngle(desired - player.angle), -2.6 * dt, 2.6 * dt));
            // const speed = visible && distance < 4.5 ? 0 : 2.05;
            // const direction = visible ? player.angle : desired;
            // player.moving = moveCircle(this.world, player, Math.cos(direction) * speed * dt, Math.sin(direction) * speed * dt);
            this._movePlayer(player,dt,visible&&distance<4.5?0:1,0,false,false);
        } else this._movePlayer(player,dt,0,0,false,false);
        // Practice drones aim at the torso instead of delivering constant
        // eye-height headshots; their existing charge and misses remain visible.
        player.pitch=clamp(Math.atan2(target.z+.95-(player.z+EYE_HEIGHT),distance),-MAX_PITCH,MAX_PITCH);
        const aimError = Math.abs(wrapAngle(Math.atan2(target.y - player.y, target.x - player.x) - player.angle));
        if (visible && distance < 18 && aimError < 0.16 && target.invulnerable <= 0) {
            player._aimTime += dt;
            player.aimFlash = clamp(player._aimTime / 0.85, 0, 1);
            if (player._aimTime >= 0.85 && player._cooldown <= 0) {
                // A conspicuous aiming pause and deliberate misses keep solo exploring viable.
                const deliberateMiss = this._random() < 0.45;
                const error = deliberateMiss ? (this._random() < 0.5 ? -1 : 1) * 0.18 : (this._random() - 0.5) * 0.025;
                this.fire(player.id, Math.atan2(target.y - player.y, target.x - player.x) + error,player.pitch);
                player._aimTime = 0;
            }
        } else { player._aimTime = 0; player.aimFlash = 0; }
    }

    _collectPickups(player) {
        if(player.z>.7)return;
        for (const pickup of this.pickups) {
            if (!pickup.active || squaredDistance(player, pickup) > 0.72 ** 2) continue;
            if (pickup.type === 'health') {
                if (player.hp >= 100) continue;
                player.hp = Math.min(100, player.hp + 40);
            } else if (pickup.type === 'shield') {
                if (player.shield >= 60) continue;
                player.shield = Math.min(60, player.shield + 35);
            } else {
                const weapon = WEAPONS[pickup.weapon];
                if (player.ammo[weapon.id] >= weapon.maxAmmo) continue;
                if (!player.owned.includes(weapon.id)) {
                    player.owned.push(weapon.id);
                    player.weapon = weapon.id;
                }
                player.ammo[weapon.id] = Math.min(weapon.maxAmmo, player.ammo[weapon.id] + weapon.pickupAmmo);
            }
            pickup.active = false;
            pickup.cooldown = pickup.type === 'weapon' ? 16 : 12;
            this._emit({ type: 'pickup', playerId: player.id, weapon: pickup.weapon, pickupType: pickup.type, x: pickup.x, y: pickup.y });
        }
    }

    step(dt) {
        if (!Number.isFinite(dt) || dt <= 0 || this.players.size === 0) return;
        // Keep browser pauses from producing a teleport or hundreds of queued shots.
        const elapsed = Math.min(dt, 0.25);
        const steps = Math.ceil(elapsed / (1 / 60));
        for (let i = 0; i < steps; i++) this._step(elapsed / steps);
    }

    _step(dt) {
        this.time += dt;
        for(const effect of this.effects)effect.age+=dt;
        this.effects=this.effects.filter(effect=>effect.age<effect.life);
        for (const player of this.players.values()) {
            for (const key of ['invulnerable', 'shotFlash', 'damageFlash', 'hitFlash', '_cooldown']) player[key] = Math.max(0, player[key] - dt);
        }
        if (this.round.intermission > 0) {
            this.round.intermission = Math.max(0, this.round.intermission - dt);
            if (this.round.intermission === 0) this._newRound();
            return;
        }
        this.round.remaining = Math.max(0, this.round.remaining - dt);
        if (this.round.remaining === 0) {
            const winner = this.mode==='ffa'?[...this.players.values()].sort((a, b) => b.score - a.score || a.deaths - b.deaths)[0]
                :this.teamScores.amber===this.teamScores.cyan?null:this.teamScores.amber>this.teamScores.cyan?'amber':'cyan';
            this._finishRound(winner);
            return;
        }
        for (const pickup of this.pickups) {
            if (!pickup.active) {
                pickup.cooldown = Math.max(0, pickup.cooldown - dt);
                if (pickup.cooldown === 0) pickup.active = true;
            }
        }
        for (const player of this.players.values()) {
            if (player.hp <= 0) {
                player.respawn = Math.max(0, player.respawn - dt);
                if (player.respawn === 0) this._respawn(player);
                continue;
            }
            if (player.bot) this._updateBot(player, dt);
            else {
                const state = player._input;
                player.angle = wrapAngle(player.angle + state.turn * 2.15 * dt);
                /* Original direct movement retained for rollback.
                const magnitude = Math.max(1, Math.hypot(state.forward, state.strafe));
                const speed = (state.sprint && !state.fire ? 4.65 : 3.3) * dt / magnitude;
                player.moving = moveCircle(this.world, player,
                    (Math.cos(player.angle) * state.forward - Math.sin(player.angle) * state.strafe) * speed,
                    (Math.sin(player.angle) * state.forward + Math.cos(player.angle) * state.strafe) * speed);
                */
                player.pitch=clamp(player.pitch||0,-MAX_PITCH,MAX_PITCH);
                this._movePlayer(player,dt,state.forward,state.strafe,state.sprint,state.jump);
                if (state.fire) this.fire(player.id);
            }
            this._collectPickups(player);
            if (this.round.intermission > 0) break;
        }
        if(this.round.intermission<=0)this._advanceProjectiles(dt);
        if(this.round.intermission<=0)this._objectives(dt);
        this.killFeed = this.killFeed.filter(item => this.time - item.time < 7);
    }
}

// module.exports = { MuseumEngine, WEAPONS, raycast, moveCircle, circleHitsWorld, PLAYER_RADIUS };
module.exports = {MuseumEngine,WEAPONS,WEAPON_ORDER,MODES,TEAMS,TEAM_COLORS,FLAG_RETURN_SECONDS,CAPTURE_SECONDS,CONTROL_SCORE_INTERVAL,raycast,moveCircle,circleHitsWorld,playerRayHit,HIT_ZONES,
    PLAYER_RADIUS,BODY_HEIGHT,EYE_HEIGHT,HEAD_HEIGHT,HEAD_RADIUS,TORSO_HEIGHT,CEILING_HEIGHT,MAX_PITCH,
    RUN_SPEED,SPRINT_SPEED,JUMP_SPEED,GRAVITY,MAX_PROJECTILES,MAX_EFFECTS};
