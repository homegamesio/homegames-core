'use strict';
const { Asset, Game, GameNode, Shapes, ShapeUtils } = require('squish-150');
const { WillieWorld, RULES } = require('./engine');
const rgba = hex => hex ? [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).concat(hex.length===9?parseInt(hex.slice(7,9),16):255) : undefined;
const box = (x, y, w, h, fill) => new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(x, y, w, h), fill: rgba(fill) });
const money = n => Math.round(n).toLocaleString('en-US');
const validId = id => ['number', 'string'].includes(typeof id) && Number.isSafeInteger(Number(id)) && Number(id) > 0;
const CHEAT = ['DIRECTION_UP','DIRECTION_UP','DIRECTION_DOWN','DIRECTION_DOWN','DIRECTION_LEFT','DIRECTION_RIGHT','DIRECTION_LEFT','DIRECTION_RIGHT','FACE_2','FACE_1','START'];

class WeedSmokeWillie extends Game {
    static metadata() {
        return {
            name: 'Weed Smoke Willie',
            description: 'Supply your underwater customers with what they need',
            gamepadBindings: { ArrowLeft: ['DIRECTION_LEFT', 'STICK_1_LEFT'], ArrowRight: ['DIRECTION_RIGHT', 'STICK_1_RIGHT'], ' ': ['FACE_1'], Enter: ['START'], m: ['SELECT'] },
            aspectRatio: {x: 16, y: 9},
            author: "Joseph Garcia",
            thumbnail: './assets/thumbnail.png',
            tickRate: 60,
            assets: {
                'background_1': new Asset({
                    path: './assets/8c1043367014492950188a4792c91e37.png',
                    type: 'image'
                }),
                'background_2': new Asset({
                    path: './assets/d146bd1a317de48cd807db1f98a48593.png',
                    type: 'image'
                }), 
                'boat_1_left': new Asset({
                    path: './assets/da3bb83675a47712d00202261840dda4.png',
                    type: 'image'
                }),
                'boat_1_right': new Asset({
                    path: './assets/26ff7ab8054b285308045b4ee1268102.png',
                    type: 'image'
                }),
                'boat_2_left': new Asset({
                    path: './assets/1cc08364781f3f5ce640736e47549cd3.png',
                    type: 'image'
                }),
                'boat_2_right': new Asset({
                    path: './assets/3d0228f5e822ff800bd2075a88a65c6d.png',
                    type: 'image'
                }),
                'boat_3_left': new Asset({
                    path: './assets/fad5bd46015511cd2e0c8d3591c70a73.png',
                    type: 'image'
                }),
                'boat_3_right': new Asset({
                    path: './assets/6fc3197eef1434fc49c456296758482c.png',
                    type: 'image'
                }),
                'song': new Asset({
                    path: './assets/f1b220587346862960f9535898f2a36d.mp3',
                    type: 'audio'
                }),
                'load_1': new Asset({
                    path: './assets/56d40d4f11e5e8c56816b23a7545675f.png',
                    type: 'image'
                }),
                'load_2': new Asset({
                    path: './assets/7214cab68490676d2715e778c76b06e8.png',
                    type: 'image'
                }),
                'load_3': new Asset({
                    path: './assets/96c01293e192152a0247d5ce75f052c6.png',
                    type: 'image'
                }),
                'fish_1_left': new Asset({
                    path: './assets/1085ec5013bf3d6b90ab901b99b85832.png',
                    type: 'image'
                }),
                'fish_1_left_dead': new Asset({
                    path: './assets/8831710a5d831cea7f3bc8636b6f6458.png',
                    type: 'image'
                }),
                'fish_1_right_dead': new Asset({
                    path: './assets/9327398422eff852b13515af4808dc31.png',
                    type: 'image'
                }), 
                'fish_2_left': new Asset({
                    path: './assets/11275cd9ec3bc49675f00fd564eafdba.png',
                    type: 'image'
                }),
                'fish_2_left_dead': new Asset({
                    path: './assets/669db76574dc7c14b14bb2c89e647077.png',
                    type: 'image'
                }),
                'fish_2_right_dead': new Asset({
                    path: './assets/b0bfd74527ab86224f8d5d8a52eab14a.png',
                    type: 'image'
                }),
                'fish_3_left_dead': new Asset({
                    path: './assets/b05bb82adbece188b431650ef233148f.png',
                    type: 'image'
                }),
                'fish_3_right_dead': new Asset({
                    path: './assets/63d00bae97df53ac0954c55aa09b7ab5.png',
                    type: 'image'
                }),
                'fish_3_left': new Asset({
                    path: './assets/2364f2fcb997129ca1b9404f4d91c0be.png',
                    type: 'image'
                }),
                'fish_1_right': new Asset({
                    path: './assets/a1c24442e89d919f2622caa6701a6b21.png',
                    type: 'image'
                }),
                'fish_2_right': new Asset({
                    path: './assets/82be259af5d0a0ad6f80d07cdec404a5.png',
                    type: 'image'
                }),
                'fish_3_right': new Asset({
                    path: './assets/0242ca9972961b6b68707abd635a0a53.png',
                    type: 'image'
                }),
                'heavy-amateur': new Asset({
                    'type': 'font',
                    path: './assets/9f11fac62df9c1559f6bd32de1382c20.bin'
                })  
            },
            gameId: "364997b2-b1cf-59a1-ac27-1d5b9838f146",
            maxPlayers: 1
        };
    }

    constructor({ now = Date.now, random = Math.random, saveData, saveGame } = {}) {
        super();
        this.now = now; this.world = new WillieWorld(random); this.players = new Map(); this.owner = null; this.closed = false;
        this.best = saveData?.schema === 1 && Number.isSafeInteger(saveData.bestTotal) && saveData.bestTotal >= 0 ? saveData.bestTotal : 0;
        this.sound = saveData?.schema === 1 && typeof saveData.sound === 'boolean' ? saveData.sound : true;
        this.saveGame = saveGame; this.saveKey = null; this.saveFailed = false; this.saveRevision = 0; this.saveTail = Promise.resolve();
        this.keys = new Set(); this.pointerHeld = false; this.pointerAction = null; this.suppressRelease = false; this.cheatIndex = 0;
        this.lastTick = now(); this.startedAt = null; this.remaining = RULES.seconds; this.accumulator = 0;
        this.base = box(0, 0, 100, 100, '#ffffff'); this.background = this.assetNode(this.base); this.boat = this.assetNode(this.base);
        this.fishLayer = box(0, 0, 0, 0); this.loadLayer = box(0, 0, 0, 0); this.hud = box(0, 0, 0, 0);
        this.base.removeChild(this.boat.id, false);this.base.addChildren(this.fishLayer, this.boat, this.loadLayer, this.hud);
        this.fishNodes = []; this.loadNodes = []; this.popupNodes = []; this.labels = new Map();
        this.controls = [box(1, 92, 31, 7, '#eef8ed'), box(34.5, 92, 31, 7, '#eef8ed'), box(68, 92, 31, 7, '#eef8ed')];
        // Small backplates keep status text readable as the boat moves beneath it.
        this.hud.addChildren(box(.5, .5, 22, 8, '#ffffffee'), box(42, .5, 16, 10, '#ffffffee'),
            box(73, .5, 26.5, 22, '#ffffffee'), ...this.controls);
        this.resultPanel = box(5, 30, 90, 44, '#fffffff0'); this.resultPanel.node.coordinates2d = [[0,0]]; this.hud.addChild(this.resultPanel);
        this.replayButton = box(32, 61, 36, 10, '#b9e68d'); this.replayButton.node.coordinates2d = [[0,0]]; this.hud.addChild(this.replayButton);
        this.song = this.assetNode(this.base);
        this.inputLayer = box(0,0,100,100);
        this.inputLayer.node.handleClick = (id,x,y) => this.press(id,x,y);
        this.inputLayer.node.offClick = id => { if (this.isOwner(id)) this.cancelPointer(); };
        this.base.addChild(this.inputLayer); this.render();
    }
    assetNode(parent) { const node = new GameNode.Asset({ coordinates2d:[[0,0]], assetInfo:{} }); node.node.asset=null; parent.addChild(node, false); return node; }
    asset(node, key, x=0,y=0,w=0,h=0) {
        const value = key ? { [key]: { pos:{x,y}, size:{x:w,y:h}, ...(key === 'song' ? {startTime:0} : {}) } } : null;
        const signature = JSON.stringify(value); if (node.signature === signature) return;
        node.signature = signature; node.node.asset = value;
        node.node.coordinates2d = key && w && h ? ShapeUtils.rectangle(x,y,w,h) : [[0,0]];
    }
    text(key, value, x, y, size=2.6, color='#111111', align='left') {
        let node=this.labels.get(key);
        if (!node) { node=new GameNode.Text({textInfo:{text:'',x,y,size,color,font:'heavy-amateur',align}});this.hud.addChild(node,false);this.labels.set(key,node); }
        const info={text:String(value),x,y,size,color:rgba(color),font:'heavy-amateur',align},signature=JSON.stringify(info);
        if (node.signature !== signature) { node.signature=signature;node.node.text=info; }
    }
    isOwner(id) { return !this.closed && validId(id) && Number(id) === this.owner; }
    canAddPlayer() { return !this.closed && this.owner === null; }
    handleNewPlayer({playerId}={}) {
        if (!validId(playerId) || !this.canAddPlayer()) return;
        this.owner=Number(playerId);this.players.set(this.owner,{});this.lastTick=this.now();this.render();
    }
    handlePlayerDisconnect(id) {
        if (!this.isOwner(id)) return;
        this.persist();this.players.clear();this.owner=null;this.reset();
    }
    persist() {
        if (this.closed || typeof this.saveGame !== 'function') return;
        const data={schema:1,bestTotal:this.best,sound:this.sound},key=JSON.stringify(data);
        if (key === this.saveKey && !this.saveFailed) return this.saveTail;
        this.saveKey=key;const revision=++this.saveRevision;
        const finish=ok=>{if(!this.closed && revision===this.saveRevision){this.saveFailed=!ok;this.render();}};
        try {this.saveTail=Promise.resolve(this.saveGame(data)).then(()=>finish(true),()=>finish(false));}
        catch(_){finish(false);this.saveTail=Promise.resolve();}
        return this.saveTail;
    }
    recordBest() { if(this.world.total>this.best){this.best=this.world.total;this.persist();} }
    clearControls(keepPointer=false) { this.keys.clear();this.cancelPointer(keepPointer);this.cheatIndex=0; }
    reset(keepPointer=false) {
        this.clearControls(keepPointer);this.world.reset();this.startedAt=null;this.remaining=RULES.seconds;this.accumulator=0;this.lastTick=this.now();this.render();
    }
    begin() { if(this.world.phase==='ready'){this.world.start();this.startedAt=this.now();this.lastTick=this.startedAt;this.accumulator=0;} }
    cancelPointer(keepHeld=false) { if(this.pointerHeld)this.suppressRelease=true;this.pointerHeld=keepHeld&&this.pointerHeld;this.pointerAction=null; }
    validPoint(x,y) { return Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<100&&y>=0&&y<100; }
    actionAt(x,y) {
        if(this.saveFailed&&y>=23&&y<=29)return 'retry';
        if(x<=22&&y<=8)return 'sound';
        if(['time','perished'].includes(this.world.phase))return x>=32&&x<=68&&y>=61&&y<=71?'replay':null;
        return x<33?'left':x<67?'drop':'right';
    }
    act(action) {
        if(action==='retry'){this.persist();return;}
        if(action==='sound'){this.sound=!this.sound;this.persist();return;}
        if(action==='replay'){this.reset(true);return;}
        if(!['left','right','drop'].includes(action))return;
        this.begin();if(action==='drop')this.world.drop();
    }
    press(id,x,y) {
        if(!this.isOwner(id)||!this.validPoint(x,y)||this.pointerHeld)return;
        this.pointerHeld=true;this.suppressRelease=false;
        const action=this.actionAt(x,y);this.pointerAction=['left','right','drop'].includes(action)?action:null;
        this.act(action);this.render();
    }
    handleMouseMove(id,point) {
        if(!this.isOwner(id)||!this.pointerHeld||!this.pointerAction||!point||!this.validPoint(point.x,point.y))return;
        const action=this.actionAt(point.x,point.y);
        if(['left','right','drop'].includes(action)&&action!==this.pointerAction){this.pointerAction=action;this.act(action);this.render();}
    }
    handleMouseUp(id,point) {
        if(!this.isOwner(id))return;
        if(!this.pointerHeld&&!this.suppressRelease&&point&&this.validPoint(point.x,point.y))this.act(this.actionAt(point.x,point.y));
        this.pointerHeld=false;this.pointerAction=null;this.suppressRelease=false;this.render();
    }
    handleKeyDown(id,key) {
        if(!this.isOwner(id)||typeof key!=='string')return;
        const k=key.toLowerCase();if(!['a','d','arrowleft','arrowright',' ','enter','m'].includes(k)||this.keys.has(k))return;
        this.cancelPointer(true);this.keys.add(k);
        if(k==='m'){this.act('sound');}
        else if(k==='enter'&&['time','perished'].includes(this.world.phase)){this.reset(true);this.keys.add('enter');}
        else if(['ready','running'].includes(this.world.phase)){this.begin();if(k===' ')this.world.drop();}
        this.render();
    }
    handleKeyUp(id,key) { if(this.isOwner(id)&&typeof key==='string')this.keys.delete(key.toLowerCase()); }
    handleGamepadInput(id,message) {
        if(!this.isOwner(id)||!message||message.connected===false){if(this.isOwner(id))this.cheatIndex=0;return;}
        // Keep the original secret sequence; movement/drop use shared bindings.
        for(const key of Array.isArray(message.pressed)?message.pressed:[]){
            this.cheatIndex=key===CHEAT[this.cheatIndex]?this.cheatIndex+1:(key===CHEAT[0]?1:0);
            if(this.cheatIndex===CHEAT.length){this.world.finish('perished');this.clearControls(true);this.recordBest();this.render();}
        }
    }
    tick() {
        if(this.closed||this.owner===null||this.world.phase!=='running')return;
        const now=this.now();if(!Number.isFinite(now))return;
        const elapsed=(now-this.lastTick)/1000;this.lastTick=now;
        this.remaining=Math.max(0,Math.min(this.remaining,RULES.seconds-(now-this.startedAt)/1000));
        if(this.remaining<=0){this.world.finish('time');this.clearControls(true);this.recordBest();this.persist();this.render();return;}
        if(elapsed<=0)return;
        this.accumulator+=Math.min(.1,elapsed);
        const controls={left:this.keys.has('a')||this.keys.has('arrowleft')||this.pointerAction==='left',right:this.keys.has('d')||this.keys.has('arrowright')||this.pointerAction==='right',drop:this.keys.has(' ')||this.pointerAction==='drop'};
        while(this.accumulator+1e-9>=1/RULES.hz){this.accumulator=Math.max(0,this.accumulator-1/RULES.hz);this.world.step(1/RULES.hz,controls);}
        if(this.world.phase!=='running')this.clearControls(true);
        this.recordBest();this.render();
    }
    render() {
        if(this.closed)return;
        const w=this.world;
        this.asset(this.background,Math.floor(w.time*2)%2?'background_2':'background_1',0,0,100,100);
        this.asset(this.boat,`boat_${w.level}_${w.direction}`,w.x,0,45,45);
        const sprites=(items,pool,parent,key)=>{
            items.forEach((item,i)=>{pool[i]??=this.assetNode(parent);this.asset(pool[i],key(item),item.x,item.y,item.w,item.h);});
            for(let i=items.length;i<pool.length;i++)this.asset(pool[i],null);
        };
        sprites(w.fish,this.fishNodes,this.fishLayer,f=>`fish_${f.type}_${f.direction}${f.served?'_dead':''}`);
        sprites(w.loads,this.loadNodes,this.loadLayer,l=>`load_${l.level}`);
        for(let i=0;i<Math.max(w.popups.length,this.popupNodes.length);i++){
            const pop=w.popups[i];if(pop)this.popupNodes[i]=true;
            this.text('popup'+i,pop?.text||'',pop?.x||0,pop?.y||0,2.4,pop?.color||'#111111','center');
        }
        this.text('cash','$'+money(w.cash),98,1.5,w.cash<1e7?3.8:2.8,'#008600','right');
        this.text('tier',`Tier ${w.level} · $${money(RULES.costs[w.level-1])}/drop`,98,10,2.0,'#111111','right');
        this.text('multiplier','x'+w.multiplier,98,16,2.4,'#b52525','right');
        const seconds=Math.ceil(this.remaining),clock=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
        this.text('clock',clock,50,2,3,'#111111','center');
        this.text('sound',this.sound?'Sound on':'Sound off',1,2,2.4);
        this.text('total','Total: $'+money(w.total),1,80,2.2);this.text('best','Best: $'+money(this.best),1,86,2.0);
        this.text('hint',w.phase==='ready'?'Move: A/D or arrows · Drop: Space':'',50,78,2.4,'#111111','center');
        this.text('landscape',w.phase==='ready'?'Landscape recommended':'',98,86,1.9,'#111111','right');
        this.text('save',this.saveFailed?'Best not saved - tap to retry':'',50,24,2.5,'#8c2222','center');
        ['Left','Drop','Right'].forEach((label,i)=>this.text('control'+i,label,[16.5,50,83.5][i],93,2.3,'#111111','center'));
        const finished=['time','perished'].includes(w.phase);
        this.resultPanel.node.coordinates2d=finished?ShapeUtils.rectangle(5,30,90,44):[[0,0]];
        this.replayButton.node.coordinates2d=finished?ShapeUtils.rectangle(32,61,36,10):[[0,0]];
        this.text('result',finished?(w.phase==='time'?'Time up':'Weedsmoke Willie has perished'):'',50,36,3.3,'#111111','center');
        this.text('resultTotal',finished?'Total: $'+money(w.total):'',50,47,3,'#111111','center');
        this.text('resultBest',finished?'Best: $'+money(this.best):'',50,54,2.5,'#111111','center');
        this.text('replay',finished?'Play again':'',50,64,3,'#111111','center');
        this.asset(this.song,this.sound&&this.owner!==null&&w.phase==='running'?'song':null);
        this.base.node.onStateChange();
    }
    close() { if(this.closed)return;this.recordBest();this.persist();this.closed=true;this.players.clear();this.owner=null;this.keys.clear();this.base.clearChildren();super.close(); }
    getLayers() { return [{root:this.base}]; }
}
module.exports=WeedSmokeWillie;
