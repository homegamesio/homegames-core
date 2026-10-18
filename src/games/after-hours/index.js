'use strict';
const { Game, GameNode, Shapes, ShapeUtils, Asset } = require('squish-150');
const { MuseumEngine, WEAPONS, WEAPON_ORDER, MAX_PITCH } = require('./engine');
const { Scene, container, renderMuseum } = require('./render');
const { MAP_CARDS, MODE_CARDS, READY_BUTTON } = require('./arena-ui');

class AfterHours extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'After Hours',
            author: "Joseph Garcia",
            description: 'An after-dark arena tour: giant kitchens, neon rooftops, a foundry, an orbital station and a museum. Vote on maps and battle in Deathmatch, Capture the Flag or Domination.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 60,
            maxPlayers: 8,
            pointerLock: true,
            assets: {
                menuCursor: new Asset({ path: './assets/menu-cursor.png', type: 'image' }),
                tidal: new Asset({ path: './assets/tidal.png', type: 'image' }),
                verdant: new Asset({ path: './assets/verdant.png', type: 'image' }),
                signal: new Asset({ path: './assets/signal.png', type: 'image' }),
                dream: new Asset({ path: './assets/dream.png', type: 'image' }),
                kinetic: new Asset({ path: './assets/kinetic.webm', type: 'video' }),
                tide: new Asset({ path: './assets/tide.webm', type: 'video' }),
                pulse: new Asset({ path: './assets/pulse.wav', type: 'audio' }),
                scatter: new Asset({ path: './assets/scatter.wav', type: 'audio' }),
                rail: new Asset({ path: './assets/rail.wav', type: 'audio' }),
                machinegun: new Asset({ path: './assets/machinegun.wav', type: 'audio' }),
                shotgun: new Asset({ path: './assets/shotgun.wav', type: 'audio' }),
                rocket: new Asset({ path: './assets/rocket.wav', type: 'audio' }),
                plasma: new Asset({ path: './assets/plasma.wav', type: 'audio' }),
                explosion: new Asset({ path: './assets/explosion.wav', type: 'audio' }),
                hit: new Asset({ path: './assets/hit.wav', type: 'audio' }),
                pickup: new Asset({ path: './assets/pickup.wav', type: 'audio' }),
                respawn: new Asset({ path: './assets/respawn.wav', type: 'audio' }),
                ambient: new Asset({ path: './assets/ambient.wav', type: 'audio' })
            },
            gameId: "b9c5c7f3-7833-4210-a8a8-143058151ea4"
        };
    }
    constructor({ setCursor } = {}) {
        super();
        this.setCursor=setCursor;
        this.base=container();this.engine=new MuseumEngine();this.weapons=WEAPONS;
        this.views=new Map();this.paused=false;this.soundSerial=0;this.lobbyOpened=false;
        this.roundViewKey=this.engine.round.phase+':'+this.engine.round.number;
        this.tickSeconds=1/this.constructor.metadata().tickRate;
    }
    getLayers() { return [{root:this.base}]; }
    handleNewPlayer({playerId,info,clientInfo}) {
        if(this.views.has(playerId))this.handlePlayerDisconnect(playerId);
        this.engine.addPlayer(playerId,info?.name||'VISITOR '+playerId);
        const root=container(playerId),picture=container(),controls=container(),audio=container();
        root.addChildren(picture,controls,audio);
        const touch=['mobile','tablet'].includes(clientInfo?.deviceType);
        const view={root,scene:new Scene(picture),controls,audio,touch,keys:new Set(),suppressedKeys:new Set(),held:{},started:false,help:false,map:false,pointer:null,sounds:[],nextAmbient:0};
        this.views.set(playerId,view);this.base.addChild(root,false);
        this.renderPlayer(playerId);this.buildControls(playerId);this.base.node.onStateChange();
    }
    handlePlayerDisconnect(playerId) {
        this.clearCursor(playerId);
        const view=this.views.get(playerId);if(view)this.base.removeChild(view.root.id,false);
        this.views.delete(playerId);this.engine.removePlayer(playerId);this.syncRoundControls();
        for(const id of this.views.keys())this.renderPlayer(id);this.base.node.onStateChange();
    }
    handlePlayerUpdate(playerId,{info}={}) {const p=this.engine.getPlayer(playerId);if(p&&info?.name)p.name=String(info.name).slice(0,28);}
    updateCursor(id) {
        const view=this.views.get(id);if(!view||typeof this.setCursor!=='function')return;
        const menu=!view.started||view.help||view.map||this.engine.round.phase==='lobby';
        if(view.cursorMenu===menu)return;
        // The existing player-scoped cursor channel also lets menus release
        // mouse capture. Gameplay restores normal capture on the next click.
        try {
            const cursor=menu?{assetKey:'menuCursor',hotspot:{x:3,y:3},size:{width:32,height:32},pointerLock:false}:null;
            if(this.setCursor(id,cursor)!==false)view.cursorMenu=menu;
        } catch (_) { /* Older hosts can keep their system cursor. */ }
    }
    clearCursor(id) {
        const view=this.views.get(id);if(!view?.cursorMenu||typeof this.setCursor!=='function')return;
        try {this.setCursor(id,null);} catch (_) { /* Cursor cleanup is presentation only. */ }
        view.cursorMenu=false;
    }
    startPlayer(id) {
        const v=this.views.get(id);if(!v)return;const firstEntry=!v.started;v.started=true;v.help=false;v.map=false;v.keys.clear();v.held={};v.pointer=null;
        const p=this.engine.getPlayer(id);if(p&&firstEntry)p.invulnerable=2.5;
        if(!this.lobbyOpened){this.lobbyOpened=true;this.engine.openLobby({initial:true});this.syncRoundControls();}
        this.renderPlayer(id);this.buildControls(id);this.base.node.onStateChange();
    }
    syncRoundControls() {
        const key=this.engine.round.phase+':'+this.engine.round.number;if(key===this.roundViewKey)return;
        this.roundViewKey=key;
        for(const [id,v] of this.views){
            for(const held of ['f',' '])if(v.keys.has(held))v.suppressedKeys.add(held);
            v.keys.clear();v.held={};v.pointer=null;v.jumpQueued=false;v.help=false;v.map=false;
            this.buildControls(id);
        }
    }
    handleKeyDown(id,key) {
        const v=this.views.get(id);if(!v)return;const k=String(key).toLowerCase();if(v.suppressedKeys.has(k))return;const fresh=!v.keys.has(k);v.keys.add(k);
        if(!v.started){if(k==='enter'||k===' ')this.startPlayer(id);return;}
        if(this.engine.round.phase==='lobby'){if(fresh&&k==='enter'){this.engine.setReady(id,!this.engine.ready[id]);this.syncRoundControls();}return;}
        if(fresh&&k==='enter'&&v.help){this.startPlayer(id);return;}
        if(fresh&&k==='h'){v.help=!v.help;v.held={};this.buildControls(id);}
        if(fresh&&k==='m'){v.map=!v.map;v.held={};v.pointer=null;this.updateCursor(id);}
        if(v.help||v.map)return;
        if(fresh&&k===' ')v.jumpQueued=true;
        if(fresh&&k==='r')this.engine.cycleWeapon(id);
        // Original three-weapon selection: ['pulse','scatter','rail'].
        if(fresh&&/^[1-6]$/.test(k)){const p=this.engine.getPlayer(id),weapon=WEAPON_ORDER[Number(k)-1];if(p.owned.includes(weapon))p.weapon=weapon;}
    }
    handleKeyUp(id,key) { const v=this.views.get(id),k=String(key).toLowerCase();v?.keys.delete(k);v?.suppressedKeys.delete(k); }
    handlePointerMove(id,{dx,dy}={}) {
        const v=this.views.get(id),p=this.engine.getPlayer(id);
        if(!v?.started||v.help||v.map||this.engine.round.phase==='lobby'||!p||p.hp<=0||p.respawn>0||!Number.isFinite(dx)||!Number.isFinite(dy))return;
        const angle=p.angle+Math.max(-4096,Math.min(4096,dx))*.0028;
        p.angle=Math.atan2(Math.sin(angle),Math.cos(angle));
        // Looking upward raises the authoritative aim ray as well as the view.
        p.pitch=Math.max(-MAX_PITCH,Math.min(MAX_PITCH,(p.pitch||0)-Math.max(-4096,Math.min(4096,dy))*.0022));
    }
    handleMouseUp(id) { const v=this.views.get(id);if(v){v.held={};v.pointer=null;} }
    buildControls(id) {
        const view=this.views.get(id);if(!view)return;view.controls.clearChildren();
        this.updateCursor(id);
        const shape=(x,y,w,h,fill,press,release,drag)=>new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:ShapeUtils.rectangle(x,y,w,h),
            fill,color:[255,255,255,255],onClick:pid=>{if(pid===id)press?.();},offClick:pid=>{if(pid===id)release?.();},onDrag:(pid,xx,yy)=>{if(pid===id)drag?.(xx,yy);}});
        const catcher=new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:ShapeUtils.rectangle(0,10,100,74),
            onClick:(pid,x,y)=>{if(pid!==id||!view.started||view.help||this.engine.round.phase==='lobby')return;if(view.map){view.map=false;this.updateCursor(id);return;}view.pointer={x,y};view.held.fire=true;this.engine.fire(id);},
            onDrag:(pid,x,y)=>{if(pid!==id||!view.pointer)return;const p=this.engine.getPlayer(id);if(p&&p.hp>0){p.angle+=(x-view.pointer.x)*.018;p.pitch=Math.max(-MAX_PITCH,Math.min(MAX_PITCH,(p.pitch||0)-(y-view.pointer.y)*.013));}view.pointer={x,y};},
            offClick:pid=>{if(pid===id)this.handleMouseUp(id);}});
        view.controls.addChild(catcher,false);
        if(!view.started||view.help){
            view.controls.addChild(shape(7,64,40,6.2,undefined,()=>this.startPlayer(id)),false);return;
        }
        if(this.engine.round.phase==='lobby'){
            const vote=choice=>{this.engine.vote(id,choice);this.renderPlayer(id);this.base.node.onStateChange();};
            for(const card of MAP_CARDS())view.controls.addChild(shape(card.x,card.y,card.w,card.h,undefined,()=>vote({mapId:card.map.id})),false);
            for(const card of MODE_CARDS())view.controls.addChild(shape(card.x,card.y,card.w,card.h,undefined,()=>vote({mode:card.mode.id})),false);
            const b=READY_BUTTON;view.controls.addChild(shape(b.x,b.y,b.w,b.h,undefined,()=>{
                this.engine.setReady(id,!this.engine.ready[id]);this.syncRoundControls();
                for(const playerId of this.views.keys())this.renderPlayer(playerId);
                this.base.node.onStateChange();
            }),false);return;
        }
        const button=(label,x,y,w,h,action,color=[30,43,47,255])=>{
            const node=shape(x,y,w,h,color,()=>{view.held={};view.held[action]=true;if(action==='fire')this.engine.fire(id);if(action==='jump')view.jumpQueued=true;},()=>{view.held[action]=false;});
            node.addChild(new GameNode.Text({textInfo:{text:label,x:x+w/2,y:y+h*.25,size:1.15,color:[235,231,218,255],align:'center',font:'sans-serif'}}),false);view.controls.addChild(node,false);
        };
        // Leave the detailed desktop viewmodel clear; touch visitors still get
        // the original movement/fire controls plus their jump button.
        if(view.touch){
            button('^',7,66,6,6,'forward');button('v',7,77,6,6,'back');button('<',1,71.5,6,6,'left');button('>',13,71.5,6,6,'right');
            button('<',75,72,6,7,'turnLeft');button('>',81,72,6,7,'turnRight');button('FIRE',87,70,10,11,'fire',[130,78,49,255]);
            button('JUMP',75,63,12,6,'jump',[44,70,77,255]);
        }
        const swap=shape(74,85,11,14,undefined,()=>this.engine.cycleWeapon(id));view.controls.addChild(swap,false);
        const map=shape(27,0,43,10,undefined,()=>{view.map=!view.map;view.held={};view.pointer=null;this.updateCursor(id);});view.controls.addChild(map,false);
    }
    renderPlayer(id) {
        const v=this.views.get(id),p=this.engine.getPlayer(id);if(v&&p)renderMuseum(this,v,p);
    }
    sound(id,key,duration=.8) {
        const v=this.views.get(id);if(!v||!v.started)return;
        // Sound playback uses the existing Asset/audio nodes and per-view scopes.
        const node=new GameNode.Asset({assetInfo:{[key]:{pos:{x:0,y:0},size:{x:0,y:0},startTime:0}}});
        v.audio.addChild(node,false);v.sounds.push({node,until:this.engine.time+duration});
        while(v.sounds.length>10){const oldest=v.sounds.shift();v.audio.removeChild(oldest.node.id,false);}
    }
    processEvents() {
        for(const event of this.engine.drainEvents()){
            if(event.type==='shot'){
                for(const [id] of this.views){const p=this.engine.getPlayer(id);if(p&&Math.hypot(p.x-event.x,p.y-event.y)<14&&this.engine.hasLineOfSight(p,event))this.sound(id,event.weapon,.65);}
            }else if(event.type==='hit'){
                this.sound(event.playerId,'hit',.2);if(event.targetId!==event.playerId)this.sound(event.targetId,'hit',.2);
                if(event.hitZone==='head'){const v=this.views.get(event.playerId);if(v){v.message='HEADSHOT';v.messageUntil=this.engine.time+.65;}}
            }else if(event.type==='explosion'){
                for(const [id] of this.views){const p=this.engine.getPlayer(id);if(p&&Math.hypot(p.x-event.x,p.y-event.y)<18&&this.engine.hasLineOfSight(p,event))this.sound(id,'explosion',1);}
            }else if(event.type==='pickup'){
                this.sound(event.playerId,'pickup',.5);const v=this.views.get(event.playerId);if(v){v.message=event.weapon?WEAPONS[event.weapon].name+' ACQUIRED':(event.pickupType==='shield'?'SHIELD RESTORED':'CONDITION RESTORED');v.messageUntil=this.engine.time+2.2;}
            }else if(['flagPickup','flagCapture','flagReturn','controlCapture'].includes(event.type)){
                for(const [id,v] of this.views){
                    v.message=event.type==='controlCapture'?'POINT '+event.pointId+' / '+event.team.toUpperCase():event.team.toUpperCase()+' FLAG '+({flagPickup:'TAKEN',flagCapture:'CAPTURED',flagReturn:'RETURNED'}[event.type]);
                    v.messageUntil=this.engine.time+2.2;this.sound(id,'pickup',.5);
                }
            }else if(event.type==='respawn'){
                const v=this.views.get(event.playerId);if(v){for(const key of [' ','f'])if(v.keys.has(key)){v.suppressedKeys.add(key);v.keys.delete(key);}v.held={};v.pointer=null;v.jumpQueued=false;}
                this.sound(event.playerId,'respawn',.85);
            }
        }
    }
    tick() {
        if(this.paused||!this.views.size)return;
        for(const [id,v] of this.views){
            const k=v.keys,h=v.held,active=v.started&&!v.help&&!v.map&&this.engine.round.phase==='playing',down=(...keys)=>keys.some(key=>k.has(key));
            this.engine.input(id,active?{forward:(down('w','arrowup')||h.forward?1:0)-(down('s','arrowdown')||h.back?1:0),
                strafe:(down('d')||h.right?1:0)-(down('a')||h.left?1:0),turn:(down('arrowright','e')||h.turnRight?1:0)-(down('arrowleft','q')||h.turnLeft?1:0),
                // Space previously fired. Arena controls use it for jumping.
                fire:down('f')||h.fire,jump:down(' ')||h.jump||v.jumpQueued,sprint:down('shift')}:{});
            // A quick tap can begin and end between two 60 Hz ticks.
            v.jumpQueued=false;
            if(!v.started)this.engine.getPlayer(id).invulnerable=.3;
        }
        this.engine.step(this.tickSeconds);this.syncRoundControls();this.processEvents();
        for(const [id,v] of this.views){
            if(v.started&&this.engine.time>=v.nextAmbient){this.sound(id,'ambient',8);v.nextAmbient=this.engine.time+8;}
            for(let i=v.sounds.length-1;i>=0;i--)if(v.sounds[i].until<=this.engine.time){v.audio.removeChild(v.sounds[i].node.id,false);v.sounds.splice(i,1);}
            this.renderPlayer(id);
        }
        this.base.node.onStateChange();
    }
    close() { for(const id of this.views.keys())this.clearCursor(id);super.close?.();this.views.clear();this.base.clearChildren(); }
}
module.exports=AfterHours;
