const { Game, GameNode, Shapes } = require('squish-150');
const { LittleRamblerEngine } = require('./engine');
const { Painter, HIDDEN } = require('./painter');
const { render } = require('./scene');
const { artAssets } = require('./art');
const { RamblerAudio } = require('./audio');
const { cursorAssets, cursorDescriptor } = require('./cursors');
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

class LittleRambler extends Game {
    static metadata() {
        return {
            thumbnail: './assets/thumbnail.png',
            name: 'Little Rambler',
            author: "Joseph Garcia",
            createdBy: "Joseph Garcia",
            description: 'Raise a curious little companion in a travelling house. Share snacks and scratches, hop through a giant garden, cast a bouncing magnet into a forgotten lagoon, and turn your discoveries into a home your friend can use. Original painted scenery, music and saved progress.',
            aspectRatio:{x:16,y:9},
            tickRate:30,
            maxPlayers: 1,
            assets:{},
            gamepadBindings: { ArrowLeft:['DIRECTION_LEFT','STICK_1_LEFT'], ArrowRight:['DIRECTION_RIGHT','STICK_1_RIGHT'],
                ArrowUp:['DIRECTION_UP','STICK_1_UP'], ArrowDown:['DIRECTION_DOWN','STICK_1_DOWN'],
                ' ':'FACE_1', b:'FACE_2', Enter:'START', p:'SELECT' },
            gameId: "151f3211-1ea9-51a0-aea8-8fd1e040d602"
        };
    }
    constructor(options={}) {
        super();
        const saved=options.saveData&&typeof options.saveData==='object'?options.saveData:{};
        this.engine=new LittleRamblerEngine(saved);
        this.sound=saved.sound!==false;this.music=saved.music!==false;this.introduced=saved.introduced===true;
        this.overlay=this.introduced?null:'welcome';this.clock=0;this.playerId=null;this.paused=false;
        this.keys={};this.keyTime={};this.pointerHeld=false;this.pointerAction=null;this.dragging=false;this.pendingJump=false;
        this.aim={vx:-36,vy:-64};this.focusAction='';this.nameDraft=this.engine.save.name;
        this.setCursor=options.setCursor;this.cursorImages=cursorAssets();this.cursorKind=null;
        this.hoverTargets=new Map();this.hoverKey=null;this.hoverAction='';this.cursorPulseUntil=0;this.cursorPulseKind=null;
        this.saveGame=options.saveGame;this.addAsset=options.addAsset;this.savedRevision=-1;this.saveStatus='ready';
        this.base=new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:HIDDEN});
        this.visual=new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:HIDDEN});
        this.audioRoot=new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:HIDDEN});
        this.painter=new Painter(this.visual);this.art=artAssets();
        this.audio=new RamblerAudio(this.audioRoot,options.addAsset);
        this.surface=new GameNode.Shape({shapeType:Shapes.POLYGON,
            coordinates2d:[[0,0],[99.99,0],[99.99,99.99],[0,99.99]],fill:[0,0,0,0],color:[0,0,0,0],
            onClick:(id,x,y)=>this.click(id,x,y),onHover:id=>this.hover(id,null),offHover:id=>this.hoverExit(id,null)});
        this.surface.node.offClick=(id,x,y)=>this.release(id,x,y);
        this.nameField=new GameNode.Shape({shapeType:Shapes.POLYGON,
            coordinates2d:[[79/1.6,36/.9],[118/1.6,36/.9],[118/1.6,44/.9],[79/1.6,44/.9]],
            fill:[0,0,0,0],color:[0,0,0,0],input:{type:'text',oninput:(id,value)=>{
                if(!this.owns(id)||this.overlay!=='custom')return;
                this.nameDraft=this.cleanName(value);this.clearPointer();this.draw();
            }}});
        this.base.addChildren(this.visual,this.audioRoot,this.surface);
        this.draw();
    }
    getLayers(){return [{root:this.base}];}
    getAssets(){return {...this.art,...this.audio.assets,...this.cursorImages};}
    owns(id){return this.playerId!==null&&Number(id)===this.playerId;}
    cleanName(value){return String(value||'').replace(/[^a-zA-Z0-9 '\-]/g,'').slice(0,16);}
    handleNewPlayer({playerId}){
        if(this.playerId===null)this.playerId=Number(playerId);
        this.audio.register();
        if(this.addAsset&&!this.artRegistered){
            this.artRegistered=true;
            for(const [id,asset]of Object.entries({...this.art,...this.cursorImages})){
                try{const pending=this.addAsset(id,asset);if(pending&&pending.catch)pending.catch(()=>{});}catch(_){/* getAssets also supplies these. */}
            }
        }
        this.draw();
    }
    clearPointer(){this.pointerHeld=false;this.pointerAction=null;this.dragging=false;}
    clearInput(){this.keys={};this.keyTime={};this.pendingJump=false;this.clearPointer();}
    handlePlayerDisconnect(id){
        if(!this.owns(id))return;
        this.resetCursor();
        if(['garden','salvage'].includes(this.engine.mode))this.engine.finishOuting('disconnect');
        this.clearInput();this.playerId=null;this.persist();this.draw();
    }
    persist(){
        this.savedRevision=this.engine.revision;
        if(!this.saveGame)return;
        const snapshot={...this.engine.exportSave(),introduced:this.introduced,sound:this.sound,music:this.music};
        this.saveStatus='saving';
        try{
            const pending=this.saveGame(snapshot);
            if(pending&&pending.then)pending.then(()=>{this.saveStatus='saved';},()=>{this.saveStatus='unavailable';});
            else this.saveStatus='saved';
        }catch(_){this.saveStatus='unavailable';}
    }
    events(){
        for(const event of this.engine.drainEvents()){
            if(this.sound)this.audio.play(event==='launch'?'jump':event==='bell'?'happy':event);
        }
        if(this.savedRevision!==this.engine.revision)this.persist();
    }
    action(action){
        const e=this.engine;
        if(!action)return;
        if(action==='music'){this.music=!this.music;this.persist();}
        else if(action==='sound'){this.sound=!this.sound;this.persist();}
        else if(action==='welcome:done'){this.overlay=null;this.introduced=true;e.pet();this.persist();}
        else if(action==='resume'){this.paused=false;this.clearInput();}
        else if(action==='close'){this.overlay=null;this.focusAction='';}
        else if(action==='home'){e.dismissResult();this.overlay=null;this.clearInput();}
        else if(action==='finish'&&['garden','salvage'].includes(e.mode)){e.finishOuting();this.clearInput();}
        else if(action==='pet'&&e.mode==='home'){e.pet();}
        else if(action.startsWith('feed:')&&e.mode==='home'){e.feed(action.slice(5));}
        else if(['outings','builds','journal','custom'].includes(action)&&e.mode==='home'){
            this.overlay=action;this.focusAction='';if(action==='custom')this.nameDraft=e.save.name;
        }
        else if(action.startsWith('start:')&&e.mode==='home'){
            if(action==='start:garden')e.startGarden();else if(action==='start:salvage')e.startSalvage();
            this.overlay=null;this.focusAction='';this.clearInput();
        }
        else if(action.startsWith('build:')&&e.mode==='home'){
            if(e.build(action.slice(6))){this.overlay=null;this.focusAction='';}
        }
        else if(action.startsWith('use:')&&e.mode==='home'){
            e.interactHome(action.slice(4));this.overlay=null;this.focusAction='';
        }
        else if(action.startsWith('coat:')&&['moss','peach','lilac'].includes(action.slice(5))){
            e.save.coat=action.slice(5);e.changed();
        }
        else if(action==='name:save'){
            e.save.name=this.cleanName(this.nameDraft).trim()||'Pip';e.changed();
            e.message=e.save.name+' likes the sound of that.';this.overlay=null;
        }
        else if(action==='cast'&&e.mode==='salvage'&&!this.overlay){e.launchSalvage(this.aim.vx,this.aim.vy);}
        else if(action==='aim:left'){this.aim.vx=clamp(this.aim.vx-8,-85,85);}
        else if(action==='aim:right'){this.aim.vx=clamp(this.aim.vx+8,-85,85);}
        this.events();this.draw();
    }
    hit(x,y){return [...this.painter.buttons].reverse().find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);}
    hover(id,key){
        if(!this.owns(id))return;
        this.hoverKey=key;this.hoverAction=this.hoverTargets.get(key)?.action||'';
        this.updateCursor();if(this.paused)this.draw();
    }
    hoverExit(id,key){
        if(!this.owns(id)||this.hoverKey!==key)return;
        this.hoverKey=null;this.hoverAction='';this.updateCursor();
    }
    updateCursor(){
        if(!this.setCursor||this.playerId===null)return;
        const action=this.hoverAction;
        let kind='default';
        if(!this.overlay&&!this.paused&&this.engine.mode==='salvage'&&!action)kind='magnet';
        if(action==='pet')kind='pet';
        else if(action==='feed:staple')kind='oat';
        else if(action==='feed:berry')kind='berry';
        else if(action==='use:planter'&&this.engine.save.planterGrowth>=45)kind='pick';
        else if(action==='cast'||action.startsWith('aim:'))kind='magnet';
        else if(action&&action!=='name:input')kind='pet';
        if(this.dragging)kind='cast';
        else if(this.clock<this.cursorPulseUntil)kind=this.cursorPulseKind;
        if(this.cursorKind===kind)return;
        try{if(this.setCursor(this.playerId,cursorDescriptor(kind))!==false)this.cursorKind=kind;}catch(_){/* Cursors are presentation only. */}
    }
    resetCursor(){
        if(this.setCursor&&this.playerId!==null){try{this.setCursor(this.playerId,null);}catch(_){/* The player may have already left. */}}
        this.cursorKind=null;this.hoverKey=null;this.hoverAction='';this.cursorPulseUntil=0;
    }
    syncHoverTargets(){
        // Each visual action needs a native hover target; unpressed pointer
        // coordinates are deliberately not streamed by Homegames.
        const context=this.paused?'pause':this.overlay||this.engine.mode,counts={},active=new Set(),nodes=[];
        for(const button of this.painter.buttons){
            if(button.action==='name:input')continue; // Preserve the native text prompt above all targets.
            const key=context+':'+button.action+':'+(counts[button.action]||0);
            counts[button.action]=(counts[button.action]||0)+1;active.add(key);
            let target=this.hoverTargets.get(key);
            if(!target){
                const node=new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:HIDDEN,fill:[0,0,0,0],color:[0,0,0,0],
                    onClick:(id,x,y)=>this.click(id,x,y),onHover:id=>this.hover(id,key),offHover:id=>this.hoverExit(id,key)});
                node.node.offClick=(id,x,y)=>this.release(id,x,y);
                target={node,action:button.action};this.hoverTargets.set(key,target);
            }
            const {x,y,w,h}=button;
            target.node.node.coordinates2d=[[x/1.6,y/.9],[(x+w)/1.6,y/.9],[(x+w)/1.6,(y+h)/.9],[x/1.6,(y+h)/.9]];
            nodes.push(target.node);
        }
        if(this.hoverKey&&!active.has(this.hoverKey)){
            this.hoverKey=null;this.hoverAction='';this.cursorPulseUntil=0;
        }
        this.updateCursor();return nodes;
    }
    click(id,x,y){
        if(!this.owns(id)||!Number.isFinite(x)||!Number.isFinite(y))return;
        const px=x*1.6,py=y*.9,b=this.hit(px,py);
        if(this.pointerHeld){if(this.dragging)this.updateAim(x,y);return;}
        this.pointerHeld=true;this.pointerAction=b?.action||null;
        if(b){
            if(b.action==='pet'){this.cursorPulseKind='pat';this.cursorPulseUntil=this.clock+.28;}
            else if(b.action==='cast'){this.cursorPulseKind='cast';this.cursorPulseUntil=this.clock+.32;}
            this.updateCursor();
            if(['left','right','jump'].includes(b.action)){
                if(b.action==='jump')this.pendingJump=true;
                return;
            }
            const held=true;this.action(b.action);this.pointerHeld=held;return;
        }
        if(!this.overlay&&!this.paused&&this.engine.mode==='salvage'&&x>5&&x<95&&y>20&&y<86){
            this.dragging=true;this.updateAim(x,y);this.draw();
        }
    }
    updateAim(x,y){
        if(!Number.isFinite(x)||!Number.isFinite(y))return;
        if(Math.hypot(x-50,y-72)<3)return;
        this.aim={vx:clamp((x-50)*2.2,-85,85),vy:clamp((y-72)*2.2,-90,-18)};
    }
    release(id,x,y){
        if(!this.owns(id))return;
        const cast=this.dragging&&!this.paused&&!this.overlay;
        if(cast&&Number.isFinite(x)&&Number.isFinite(y)&&x>=3&&x<=97&&y>=16&&y<=86){
            this.updateAim(x,y);this.engine.launchSalvage(this.aim.vx,this.aim.vy);
        }
        this.clearPointer();this.events();this.draw();
    }
    handleMouseMove(id,{x,y}={}){
        if(!this.owns(id))return;
        if(this.dragging){this.updateAim(x,y);this.draw();}
    }
    handleMouseUp(id,data={}){this.release(id,data.x,data.y);}
    handleKeyDown(id,key){
        if(!this.owns(id)||typeof key!=='string')return;
        const fresh=!this.keys[key]||this.clock-(this.keyTime[key]||0)>.4;
        this.keys[key]=true;this.keyTime[key]=this.clock;
        if(!fresh)return;
        if(this.overlay==='custom'){
            if(key==='Enter'){this.action('name:save');return;}
            if(key==='Backspace')this.nameDraft=this.nameDraft.slice(0,-1);
            else if(key.length===1)this.nameDraft=this.cleanName(this.nameDraft+key);
            this.draw();return;
        }
        if(key==='m'||key==='M'){this.action('music');return;}
        if(key==='p'||key==='P'){
            if(['garden','salvage'].includes(this.engine.mode)){this.paused=!this.paused;this.clearPointer();this.draw();}return;
        }
        if(key==='b'||key==='Escape'||key==='Backspace'){
            if(this.overlay){this.action('close');return;}
            if(['garden','salvage'].includes(this.engine.mode)){this.paused=!this.paused;this.draw();}return;
        }
        if(this.paused){if(key===' '||key==='Enter')this.action('resume');return;}
        if(!this.overlay&&this.engine.mode==='garden'){
            if([' ','ArrowUp','w','W'].includes(key))this.pendingJump=true;
            return;
        }
        if(!this.overlay&&this.engine.mode==='salvage'){
            if(key===' '||key==='Enter')this.action('cast');return;
        }
        const seenActions=new Set();
        const buttons=this.painter.buttons.filter(b=>{
            if(['music','sound','name:input'].includes(b.action)||seenActions.has(b.action))return false;
            seenActions.add(b.action);return true;
        });
        if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s'].includes(key)){
            const index=buttons.findIndex(b=>b.action===this.focusAction);
            const d=['ArrowLeft','ArrowUp','a','w'].includes(key)?-1:1;
            this.focusAction=buttons[(index+d+buttons.length)%buttons.length]?.action||'';this.draw();return;
        }
        if(key===' '||key==='Enter')this.action(this.focusAction||buttons[0]?.action);
        if(!this.overlay&&this.engine.mode==='home'){
            const shortcuts={f:'feed:staple',v:'feed:berry',h:'pet',e:'outings',c:'builds',j:'journal'};
            if(shortcuts[key])this.action(shortcuts[key]);
        }
    }
    handleKeyUp(id,key){if(this.owns(id)){delete this.keys[key];delete this.keyTime[key];}}
    input(){
        // Key heartbeats self-expire after focus loss, even when a release is lost.
        for(const key of Object.keys(this.keys))if(this.clock-(this.keyTime[key]||0)>.45)delete this.keys[key];
        return {left:!!(this.keys.ArrowLeft||this.keys.a||this.keys.A||this.pointerAction==='left'),
            right:!!(this.keys.ArrowRight||this.keys.d||this.keys.D||this.pointerAction==='right'),
            jump:!!(this.keys[' ']||this.keys.ArrowUp||this.keys.w||this.keys.W||this.pointerAction==='jump')};
    }
    draw(){
        render(this.painter,this);
        this.base.node.children=[this.visual,this.audioRoot,this.surface,...this.syncHoverTargets()];
        if(this.overlay==='custom')this.base.node.children.push(this.nameField);
        this.base.node.onStateChange();
    }
    tick(){
        if(this.playerId===null||this.closed)return;
        const dt=1/30;this.clock+=dt;
        if(!this.paused&&this.overlay!=='welcome'){
            const input=this.input();
            if(this.engine.mode==='salvage'&&!this.overlay&&!this.engine.salvage.ball.active){
                this.aim.vx=clamp(this.aim.vx+((input.right?1:0)-(input.left?1:0))*dt*55,-85,85);
            }
            if(this.pendingJump){this.engine.jumpQueued=true;this.pendingJump=false;}
            this.engine.tick(dt,input);this.events();
        }
        this.audio.tick(dt,{scene:this.engine.mode==='result'?'home':this.engine.mode,
            enabled:this.sound&&!this.paused,music:this.music});
        this.updateCursor();
        if(!this.paused)this.draw();
    }
    close(){
        if(this.closed)return;
        this.resetCursor();
        if(['garden','salvage'].includes(this.engine.mode))this.engine.finishOuting('close');
        this.persist();this.closed=true;this.clearInput();this.audio.close();super.close?.();
    }
}
module.exports=LittleRambler;
