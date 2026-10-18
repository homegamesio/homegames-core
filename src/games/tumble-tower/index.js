const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');
const { ToyWorld, box, circle, vertices } = require('./physics');
const { TowerAudio } = require('./audio');
const { restoreBuild } = require('./saves');
const { structureNames, presetBlocks, thumbnailBlocks } = require('./structures');
const C = { sky:[224,241,241,255], cream:[255,247,221,255], ink:[70,72,89,255], muted:[115,141,145,255], floor:[247,221,181,255], teal:[76,153,154,255], coral:[228,127,111,255], gold:[244,196,100,255], shadow:[221,189,154,255] };
const COLORS = [C.coral,[126,174,208,255],C.gold,[164,150,204,255],[143,189,143,255],[237,166,184,255]];
const BLOCKS = [{width:17,height:6},{width:10,height:10},{width:31,height:4}];
const BALLS = [
    {name:'bounce',radius:3.5,mass:3,restitution:.8,friction:.35,material:'rubber',color:C.coral},
    {name:'heavy',radius:4,mass:10,restitution:.16,friction:.7,material:'heavy',color:[105,122,150,255]},
    {name:'pop!',radius:3.3,mass:3,restitution:.3,friction:.45,material:'wood',color:C.gold}
];
const HIDDEN=[[0,0],[0,0],[0,0]], TAU=Math.PI*2;
const clamp=(v,l,h)=>Math.max(l,Math.min(h,v));
const oval=(x,y,rx,ry=rx,n=24)=>Array.from({length:n+1},(_,i)=>[x+Math.cos(i*TAU/n)*rx,y+Math.sin(i*TAU/n)*ry]);
const rect=(x,y,w,h)=>ShapeUtils.rectangle(x,y,w,h), closed=p=>[...p,p[0]];
const tint=c=>c.map((v,i)=>i===3?v:Math.round(v*.68+255*.32));
const star=(x,y,r,turn=0)=>closed(Array.from({length:10},(_,i)=>{const a=turn+i*Math.PI/5-Math.PI/2,s=i%2?r*.45:r;return[x+Math.cos(a)*s,y+Math.sin(a)*s];}));

class TumbleTower extends Game {
    static metadata(){return{
            thumbnail: './assets/thumbnail.png',
            name:'Tumble Tower',
            author: "Joseph Garcia",
            createdBy: "Joseph Garcia",
            description:'Set up the blocks and knock them over',
            aspectRatio:{x:3,y:2},
            tickRate:30,
            maxPlayers: 1,
            assets:{},
            gamepadBindings:{' ':['FACE_1'],r:['FACE_2'],b:['FACE_3'],x:['FACE_4'],Enter:['START'],q:['LEFT_SHOULDER'],e:['RIGHT_SHOULDER'],v:['SELECT'],ArrowLeft:['DIRECTION_LEFT','STICK_1_LEFT'],ArrowRight:['DIRECTION_RIGHT','STICK_1_RIGHT'],ArrowUp:['DIRECTION_UP','STICK_1_UP'],ArrowDown:['DIRECTION_DOWN','STICK_1_DOWN']},
            gameId: "7bcc907c-b9a6-5c20-a309-cf86cfa0515f"
        };}
    constructor({addAsset,now=Date.now,saveData,saveGame}={}){
        super();this.addAsset=addAsset;this.players=new Map();this.time=0;this.sound=true;
        this.now=now;this.lastTick=now();this.closed=false;
        this.saveGame=saveGame;this.saveKey=null;this.saveRevision=0;this.saveFailed=false;this.saveTail=Promise.resolve();
        const saved=saveData?.schema===1?saveData:{};this.sound=saved.sound!==false;
        this.world=new ToyWorld({left:29});this.blocks=[];this.projectiles=[];this.custom=restoreBuild(saved.custom);
        this.mode=0;this.phase='play';this.selectedBall=0;this.selectedBlock=0;this.blockTurn=false;
        this.aim={x:73,y:56};this.lastShot=-10;this.lastAdd=-10;this.shots=0;this.tumbled=0;this.impactCount=0;this.booms=0;
        this.message='';this.messageUntil=0;this.cheered=false;
        this.base=this.shape(rect(0,0,150,100),C.sky);
        this.room=this.group(this.base);this.blockLayer=this.group(this.base);this.effects=this.group(this.base);
        this.hud=this.group(this.base);this.audioRoot=this.group(this.base);this.audio=new TowerAudio(this.audioRoot);
        this.buildRoom();this.buildHud();
        this.projectiles=Array.from({length:4},()=>({active:false,body:null,bodyNode:this.poly(this.effects,HIDDEN,C.coral),stripe:this.poly(this.effects,HIDDEN,C.cream),highlight:this.poly(this.effects,HIDDEN,C.cream)}));
        this.sparks=Array.from({length:26},()=>({born:-10,node:this.poly(this.effects,HIDDEN,C.gold)}));
        this.ripples=Array.from({length:3},()=>({born:-10,node:this.poly(this.effects,HIDDEN,C.gold)}));
        this.ghost=this.poly(this.effects,HIDDEN,[255,255,255,150]);
        this.aimDots=Array.from({length:9},()=>this.poly(this.effects,HIDDEN,[255,247,221,170]));
        this.loadPreset(0,false);this.audio.setEnabled(this.sound);this.setText(this.soundLabel,this.sound?'sound on':'sound off');
        const touch=this.poly(this.base,rect(0,0,150,100),null,{onClick:(id,x,y)=>this.pointerDown(id,x,y)});
        touch.node.offClick=id=>this.cancelPointer(id);
    }
    snapshotBuild(){
        if(this.phase==='building')this.custom=this.blocks.map(b=>({x:b.x,y:b.y,width:b.width,height:b.height,angle:b.angle,colorIndex:b.colorIndex}));
    }
    persist(){
        if(this.closed||typeof this.saveGame!=='function')return;
        const data={schema:1,sound:this.sound,custom:restoreBuild(this.custom)},key=JSON.stringify(data);
        if(key===this.saveKey&&!this.saveFailed)return this.saveTail;
        this.saveKey=key;const revision=++this.saveRevision;
        const finish=success=>{if(this.closed||revision!==this.saveRevision)return;this.saveFailed=!success;this.draw();this.dirty();};
        // Submit before close returns; the platform owns write ordering/coalescing.
        try{this.saveTail=Promise.resolve(this.saveGame(data)).then(()=>finish(true),()=>finish(false));}
        catch(_){finish(false);this.saveTail=Promise.resolve();}
        return this.saveTail;
    }
    getLayers(){return[{root:this.base}];} getAssets(){return this.audio.assets;}
    project(points){return points.map(([x,y])=>[clamp(x/1.5,0,100),clamp(y,0,100)]);}
    shape(points,fill,options={}){return new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:this.project(points),...(fill?{fill}:{}),...options});}
    put(parent,node){parent.addChild(node,false);return node;} group(parent){return this.put(parent,this.shape(HIDDEN));}
    poly(parent,points,fill,options){return this.put(parent,this.shape(points,fill,options));}
    disk(parent,x,y,r,ry,fill){return this.poly(parent,oval(x,y,r,ry),fill);}
    coords(node,points){node.node.coordinates2d=this.project(points);}
    text(parent,text,x,y,size,color=C.ink){return this.put(parent,new GameNode.Text({textInfo:{text,x:x/1.5,y,size:size/(1.5*Math.SQRT2),color,align:'center',font:'Trebuchet MS, sans-serif'}}));}
    setText(node,text){node.node.text={...node.node.text,text};} dirty(){this.base.node.onStateChange();}
    say(message,seconds=1.8){this.message=message;this.messageUntil=this.time+seconds;}
    pill(x,y,w,h,fill,parent=this.hud){return[this.disk(parent,x-w/2+h/2,y,h/2,h/2,fill),this.disk(parent,x+w/2-h/2,y,h/2,h/2,fill),this.poly(parent,rect(x-w/2+h/2,y-h/2,w-h,h),fill)];}
    buildRoom(){
        this.poly(this.room,rect(0,76,150,24),C.floor);this.poly(this.room,rect(0,76,150,.7),C.shadow);
        this.disk(this.room,74,77.4,49,2.2,[233,204,166,255]);
        this.poly(this.room,closed([[128,58],[140,58],[139,66],[130,66]]),C.teal);
        this.poly(this.room,rect(133,66,3,8),C.teal);this.disk(this.room,134.5,74,8,1.5,C.teal);
        this.launchBall=this.disk(this.room,133,56,4,4,C.coral);this.launchMark=this.poly(this.room,star(133,56,1.7),C.cream);
        this.launchLabel=this.text(this.room,'throw',133,68,3.3,C.ink);this.targetRing=this.poly(this.effects,HIDDEN,C.cream);
    }
    buildHud(){
        this.poly(this.hud,rect(0,0,150,18),C.sky);
        this.text(this.hud,'TUMBLE TOWER',75,1,4);
        this.orientationLabel=this.text(this.hud,'On a phone? Turn it sideways',75,6.5,2.8,C.ink);
        this.subtitle=this.text(this.hud,'',75,12,3.1,C.ink);
        this.pill(13,6.5,23,8.5,C.cream);this.soundLabel=this.text(this.hud,'sound on',13,4.5,3);
        this.pill(135,6.5,27,8.5,C.cream);this.rebuildLabel=this.text(this.hud,'rebuild ↻',135,4.5,3);
        this.toolCards=Array.from({length:3},(_,i)=>{const y=29+i*17,card=this.pill(14,y,24,15,C.cream);return{card,icon:this.poly(this.hud,HIDDEN,BALLS[i].color),mark:this.poly(this.hud,HIDDEN,C.cream),label:this.text(this.hud,BALLS[i].name,14,y+3,3.4)};});
        this.poly(this.hud,rect(0,81,150,19),C.cream);
        this.presetCards=Array.from({length:4},(_,i)=>{
            const x=21+i*36,nodes=this.pill(x,90.5,33,17,C.sky);
            const shapes=i<3?thumbnailBlocks(i,{x:x-9,y:83.5,width:18,height:8}):[{x:x-6,y:90,width:7,height:3,colorIndex:0},{x:x+3,y:90,width:6,height:5,colorIndex:1},{x,y:85,width:17,height:3,colorIndex:2}];
            for(const b of shapes)this.poly(this.hud,rect(b.x-b.width/2,b.y-b.height/2,b.width,b.height),COLORS[b.colorIndex%6]);
            const label=this.text(this.hud,i<3?structureNames[i]:'build yours',x,93.3,3.2);if(i===3)this.buildLabel=label;return nodes;
        });
        this.progressStars=Array.from({length:3},(_,i)=>this.poly(this.hud,star(126+i*6,28,2.2),[187,210,207,255]));
        this.counter=this.text(this.hud,'',132,33,2.8,C.ink);
        this.turnButton=this.pill(133,42,23,8,C.cream).map(node=>({node,points:node.node.coordinates2d.map(p=>[p[0]*1.5,p[1]])}));
        this.turnLabel=this.text(this.hud,'',133,40,3);
    }
    makeBlock(desc,sleeping=true){
        const b=box(desc.x,desc.y,desc.width,desc.height);
        Object.assign(b,{homeX:desc.x,homeY:desc.y,angle:desc.angle||0,colorIndex:desc.colorIndex??this.blocks.length%6,material:'wood',disturbed:false,sleeping,restTime:sleeping?1:0});
        const color=COLORS[b.colorIndex%6];b.parts=[this.poly(this.blockLayer,HIDDEN,color),this.poly(this.blockLayer,HIDDEN,tint(color)),this.poly(this.blockLayer,HIDDEN,[255,247,221,160])];this.blocks.push(b);return b;
    }
    syncBodies(){this.world.bodies=[...this.blocks,...this.projectiles.filter(p=>p.active).map(p=>p.body)];}
    loadPreset(mode,sound=true){
        if(this.closed||!Number.isInteger(mode)||mode<0||mode>3)return false;
        this.snapshotBuild();
        this.cancelPointers();
        this.mode=mode;this.phase=mode===3?'building':'play';this.world=new ToyWorld({left:29});this.blocks=[];this.blockLayer.clearChildren();this.projectiles.forEach(p=>{p.active=false;p.body=null;});
        this.sparks.forEach(p=>{p.born=-10;});this.ripples.forEach(p=>{p.born=-10;});this.arc=null;
        this.tumbled=0;this.shots=0;this.impactCount=0;this.cheered=false;this.lastShot=this.time-1;this.lastAdd=this.time-1;
        for(const desc of mode===3?this.custom:presetBlocks(mode))this.makeBlock(desc,mode!==3);
        this.syncBodies();this.aim={x:mode===2?106:73,y:mode===2?65:55};this.messageUntil=0;
        if(sound&&this.sound)this.audio.play('reset');if(sound)this.persist();this.draw();this.dirty();return true;
    }
    rebuild(){if(this.closed)return false;const resume=this.mode===3&&this.phase==='play';if(this.mode===3&&!resume){this.custom=[];this.blocks=[];}this.loadPreset(this.mode);if(resume)this.playCustom();return true;}
    blockShape(){
        const shape=BLOCKS[this.selectedBlock];return this.blockTurn?{width:shape.height,height:shape.width}:shape;
    }
    dropBlock(x=this.aim.x,y=this.aim.y){
        if(this.closed||this.phase!=='building'||!Number.isFinite(x)||!Number.isFinite(y)||this.blocks.length>=24||this.time-this.lastAdd<.24)return false;
        const shape=this.blockShape(),spot={...shape,x:clamp(x,29+shape.width/2,143-shape.width/2),y:clamp(y,18+shape.height/2,76-shape.height/2)};
        this.aim={x:spot.x,y:spot.y};this.aimUntil=0;this.makeBlock({...spot,colorIndex:this.blocks.length%6},false);this.lastAdd=this.time;
        this.syncBodies();this.snapshotBuild();this.persist();this.draw();this.dirty();return true;
    }
    playCustom(){
        if(this.closed||this.phase!=='building'||!this.blocks.length)return false;
        this.phase='play';this.custom=this.blocks.map(b=>({x:b.x,y:b.y,width:b.width,height:b.height,angle:b.angle,colorIndex:b.colorIndex}));
        for(const b of this.blocks){b.homeX=b.x;b.homeY=b.y;b.disturbed=false;}
        this.persist();this.say('Pick a ball and tap a target');this.draw();this.dirty();return true;
    }
    throwAt(x,y){
        if(this.closed||this.phase!=='play'||!Number.isFinite(x)||!Number.isFinite(y)||this.time-this.lastShot<.65)return false;
        this.aim={x:clamp(x,32,140),y:clamp(y,24,72)};
        const slot=this.projectiles.find(p=>!p.active)||this.projectiles.reduce((old,p)=>p.born<old.born?p:old);
        const type=BALLS[this.selectedBall],b=circle(133,56,type.radius,type);b.material=type.material;b.projectileKind=this.selectedBall;
        const flight=clamp((133-this.aim.x)/125,.35,.8),gravity=this.world.gravity??70;
        b.vx=(this.aim.x-b.x)/flight;b.vy=(this.aim.y-b.y-gravity*flight*flight/2)/flight;b.spin=-3;
        Object.assign(slot,{active:true,body:b,kind:this.selectedBall,born:this.time,detonated:false});
        this.shots++;this.lastShot=this.time;this.syncBodies();this.arc={x:b.x,y:b.y,vx:b.vx,vy:b.vy,flight,gravity,until:this.time+.65};
        if(this.sound)this.audio.play('launch');this.draw();this.dirty();return true;
    }
    burst(x,y,count,strong=false){
        for(const spark of this.sparks){if(count<=0)break;if(this.time-spark.born<.65)continue;
            const a=(count*2.39996+this.time)%TAU,speed=strong?24:10;
            Object.assign(spark,{x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-5,born:this.time,color:COLORS[count%6]});count--;}
    }
    detonate(p){
        if(!p.active||p.detonated)return;p.detonated=true;p.active=false;this.booms++;
        const{x,y}=p.body;this.syncBodies();this.world.explode(x,y,{radius:32,strength:110});
        const ring=this.ripples.find(r=>this.time-r.born>=.7)||this.ripples[0];Object.assign(ring,{x,y,born:this.time});
        this.burst(x,y,22,true);if(this.sound)this.audio.play('boom');this.say('Pop!');
    }
    draw(){
        for(const b of this.blocks){
            this.coords(b.parts[0],closed(vertices(b).map(v=>[v.x,v.y])));
            const transform=points=>points.map(([x,y])=>[b.x+x*Math.cos(b.angle)-y*Math.sin(b.angle),b.y+x*Math.sin(b.angle)+y*Math.cos(b.angle)]);
            this.coords(b.parts[1],transform(rect(-b.width/2+.35,-b.height/2+.35,b.width-.7,Math.min(.8,b.height/5))));
            this.coords(b.parts[2],transform(oval(0,0,Math.min(1.1,b.width/5),Math.min(1.1,b.height/4),12)));
        }
        for(const p of this.projectiles){
            if(!p.active){[p.bodyNode,p.stripe,p.highlight].forEach(node=>this.coords(node,HIDDEN));continue;}
            const b=p.body;this.coords(p.bodyNode,oval(b.x,b.y,b.radius));p.bodyNode.node.fill=BALLS[p.kind].color;
            this.coords(p.stripe,p.kind===2?star(b.x,b.y,b.radius*.58,b.angle):oval(b.x,b.y,b.radius*.78,.45));this.coords(p.highlight,oval(b.x-b.radius*.32,b.y-b.radius*.4,b.radius*.2));
        }
        for(const p of this.sparks){const t=this.time-p.born;this.coords(p.node,t>=0&&t<.65?star(p.x+p.vx*t,p.y+p.vy*t+15*t*t,1.2*(1-t/.65),t*4):HIDDEN);if(p.color)p.node.node.fill=p.color;}
        for(const r of this.ripples){const t=this.time-r.born,radius=3+35*t;this.coords(r.node,t>=0&&t<.65?closed([...oval(r.x,r.y,radius,radius,24),...oval(r.x,r.y,Math.max(0,radius-.8),Math.max(0,radius-.8),24).reverse()]):HIDDEN);}
        const ghost=this.blockShape();this.coords(this.ghost,this.phase==='building'&&this.blocks.length<24&&this.time<(this.aimUntil||0)?rect(this.aim.x-ghost.width/2,this.aim.y-ghost.height/2,ghost.width,ghost.height):HIDDEN);
        this.toolCards.forEach((tool,i)=>{
            const y=29+i*17,building=this.phase==='building',selected=building?this.selectedBlock:this.selectedBall;
            tool.card.forEach(node=>{node.node.fill=selected===i?[177,217,206,255]:C.cream;});
            const shape=this.blockTurn?{width:BLOCKS[i].height,height:BLOCKS[i].width}:BLOCKS[i],scale=Math.min(16/shape.width,7/shape.height);
            this.coords(tool.icon,building?rect(14-shape.width*scale/2,y-2.5-shape.height*scale/2,shape.width*scale,shape.height*scale):oval(14,y-2,3.7));tool.icon.node.fill=building?COLORS[i]:BALLS[i].color;
            this.coords(tool.mark,building?HIDDEN:i===2?star(14,y-2,1.9):oval(13,y-3,.65));this.setText(tool.label,building?['brick','cube','plank'][i]:BALLS[i].name);
        });
        this.presetCards.forEach((nodes,i)=>nodes.forEach(node=>{node.node.fill=i===this.mode?[177,217,206,255]:C.sky;}));
        this.launchBall.node.fill=this.phase==='building'?C.teal:BALLS[this.selectedBall].color;
        this.coords(this.launchMark,this.phase==='building'?closed([[131,53],[136,56],[131,59]]):star(133,56,1.7));this.setText(this.launchLabel,this.phase==='building'?'PLAY':'throw');
        this.progressStars.forEach((node,i)=>{node.node.fill=this.blocks.length&&this.tumbled/this.blocks.length>=(i+1)/4?C.gold:[187,210,207,255];});
        this.setText(this.counter,this.phase==='building'?this.blocks.length+(this.blocks.length===1?' block':' blocks'):this.tumbled?this.tumbled+' moved':'pick a ball');
        this.setText(this.subtitle,this.saveFailed?'Save failed - tap here to retry':this.time<this.messageUntil?this.message:this.phase==='building'?this.blocks.length===24?'24 blocks - tap PLAY':this.blocks.length?'':'Drag a block into the room':this.shots?'':'Drag a ball or tap a target');
        this.setText(this.buildLabel,this.custom.length?'your build':'build yours');
        this.setText(this.rebuildLabel,this.phase==='building'?'clear ↻':'rebuild ↻');
        this.turnButton.forEach(p=>this.coords(p.node,this.phase==='building'?p.points:HIDDEN));this.setText(this.turnLabel,this.phase==='building'?'turn ↻':'');
        const arc=this.arc,show=arc&&this.time<arc.until;
        this.aimDots.forEach((node,i)=>{const t=show?arc.flight*i/8:0;this.coords(node,show?oval(arc.x+arc.vx*t,arc.y+arc.vy*t+arc.gravity*t*t/2,.4):HIDDEN);});
        this.coords(this.targetRing,show||this.time<(this.aimUntil||0)?star(this.aim.x,this.aim.y,2.5):HIDDEN);
    }
    tap(x,y){
        if(this.closed||![x,y].every(Number.isFinite)||x<0||x>100||y<0||y>100)return;const wx=x*1.5;
        if(this.saveFailed&&y>=10&&y<18&&wx>=29&&wx<=120){this.persist();}
        else if(y<14&&wx<27){this.sound=!this.sound;this.audio.setEnabled(this.sound);this.setText(this.soundLabel,this.sound?'sound on':'sound off');this.persist();}
        else if(y<14&&wx>119)this.rebuild();
        else if(y>=81){const i=Math.round((wx-21)/36);if(i>=0&&i<4&&Math.abs(wx-(21+i*36))<=17){this.loadPreset(i);}}
        else if(wx<=27&&y>=21&&y<=71){const i=clamp(Math.round((y-29)/17),0,2);if(this.phase==='building')this.selectedBlock=i;else this.selectedBall=i;}
        else if(this.phase==='building'&&wx>=121&&y>=36&&y<=47)this.blockTurn=!this.blockTurn;
        else if(wx>=121&&y>=48&&y<=77){if(this.phase==='building')this.playCustom();else if(this.blocks.some(b=>Math.abs(wx-b.x)<Math.max(b.width,b.height)/2+3&&Math.abs(y-b.y)<Math.max(b.width,b.height)/2+3))this.throwAt(wx,y);else this.throwAt(this.aim.x,this.aim.y);}
        else if(wx>=31&&wx<=141&&y>=20&&y<=79){if(this.phase==='building')this.dropBlock(wx,y);else this.throwAt(wx,y);}
        this.draw();this.dirty();
    }
    player(id){return !this.closed&&['number','string'].includes(typeof id)?this.players.get(Number(id)):null;}
    cancelPointer(id){
        const p=this.player(id);if(!p)return;
        if(p.pointer||p.dragTool)p.suppressRelease=true;
        p.pointer=false;p.dragTool=null;const visible=this.aimUntil>this.time;this.aimUntil=0;
        if(visible){this.draw();this.dirty();}
    }
    cancelPointers(){for(const [id,p] of this.players){const held=p.pointer;this.cancelPointer(id);p.pointer=held;}}
    pointerDown(id,x,y){
        const p=this.player(id);if(!p||p.pointer||![x,y].every(Number.isFinite)||x<0||x>=100||y<0||y>=100)return;
        p.pointer=true;p.suppressRelease=false;this.tap(x,y);
        // A preset/reset may cancel the old gesture during tap. This physical
        // press is still held, so its repeated packets cannot act again.
        p.pointer=true;
        if(x*1.5<=27&&y>=21&&y<=71)p.dragTool={x,y,moved:false};
    }
    handleMouseMove(id,pos){
        const p=this.player(id),d=p?.dragTool;if(!p?.pointer||!d||!pos||![pos.x,pos.y].every(Number.isFinite))return;
        d.moved ||= Math.hypot(pos.x-d.x,pos.y-d.y)>1;
        if(!d.moved)return;
        this.aim={x:clamp(pos.x*1.5,32,140),y:clamp(pos.y,24,72)};this.aimUntil=this.time+2;this.draw();this.dirty();
    }
    handleMouseUp(id,pos){
        const p=this.player(id);if(!p)return;const d=p.dragTool,held=p.pointer,blocked=p.suppressRelease;
        p.dragTool=null;p.pointer=false;p.suppressRelease=false;
        if(!blocked&&pos&&[pos.x,pos.y].every(Number.isFinite)&&pos.x>=0&&pos.x<100&&pos.y>=0&&pos.y<100){
            if(d?.moved&&pos.x*1.5>=31&&pos.x*1.5<=141&&pos.y>=20&&pos.y<=79){
                if(this.phase==='building')this.dropBlock(pos.x*1.5,pos.y);else this.throwAt(pos.x*1.5,pos.y);
            }else if(!held)this.tap(pos.x,pos.y);
        }
        this.aimUntil=0;this.draw();this.dirty();
    }
    handleKeyDown(id,key){
        const p=this.player(id);if(!p||p.keys.has(key)||![' ','Enter','r','b','x','q','e','v','1','2','3','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key))return;p.keys.add(key);this.cancelPointers();
        if(['1','2','3'].includes(key)){if(this.phase==='building')this.selectedBlock=Number(key)-1;else this.selectedBall=Number(key)-1;}
        else if(key==='q'||key==='e'){const field=this.phase==='building'?'selectedBlock':'selectedBall';this[field]=(this[field]+(key==='q'?2:1))%3;}
        else if(key==='v')this.loadPreset((this.mode+1)%4);
        else if(key==='r')this.rebuild();else if(key==='b'){this.loadPreset(3);}else if(key==='x'){if(this.phase==='building')this.blockTurn=!this.blockTurn;}
        else if(key.startsWith('Arrow')){this.aim.x=clamp(this.aim.x+(key==='ArrowLeft'?-10:key==='ArrowRight'?10:0),32,140);this.aim.y=clamp(this.aim.y+(key==='ArrowUp'?-8:key==='ArrowDown'?8:0),24,72);this.aimUntil=this.time+5;}
        else if(this.phase==='building'){if(key==='Enter')this.playCustom();else this.dropBlock();}else this.throwAt(this.aim.x,this.aim.y);
        this.draw();this.dirty();
    }
    handleKeyUp(id,key){this.player(id)?.keys.delete(key);}
    handleNewPlayer({playerId}={}){
        if(this.closed||this.players.size||!['number','string'].includes(typeof playerId)||!Number.isSafeInteger(Number(playerId))||Number(playerId)<=0)return;
        this.players.set(Number(playerId),{pointer:false,suppressRelease:false,keys:new Set()});this.lastTick=this.now();this.audio.setEnabled(this.sound);
        if(!this.assetsRegistered&&typeof this.addAsset==='function'){this.assetsRegistered=true;for(const[key,asset]of Object.entries(this.audio.assets))try{this.addAsset(key,asset)?.catch(()=>{});}catch(_){/* Quiet play remains available. */}}
    }
    handlePlayerDisconnect(id){if(!this.player(id))return;this.cancelPointer(id);this.players.delete(Number(id));this.audio.mute();this.snapshotBuild();this.persist();}
    tick(){
        if(this.closed||!this.players.size)return;
        const now=this.now(),elapsed=(now-this.lastTick)/1000;this.lastTick=now;
        if(!Number.isFinite(elapsed)||elapsed<=0)return;
        const dt=Math.min(.1,elapsed),wasMoving=this.world.bodies.some(b=>!b.sleeping&&!b.fixed);
        const transient=this.time<this.messageUntil||this.time<(this.aimUntil||0)||this.time<(this.arc?.until||0)||
            this.sparks.some(p=>this.time-p.born<.65)||this.ripples.some(p=>this.time-p.born<.65);
        this.time+=dt;this.audio.tick(dt);this.world.step(dt);
        const detonations=new Set();
        for(const impact of this.world.impacts){
            this.impactCount++;const p=this.projectiles.find(p=>p.active&&(p.body===impact.body||p.body===impact.other));if(p?.kind===2)detonations.add(p);
            if(this.sound)this.audio.impact(impact.speed,impact.floor,p?BALLS[p.kind].material:'wood');
            if(impact.speed>12)this.burst(impact.point?.x??impact.body.x,impact.point?.y??impact.body.y,3);
        }
        detonations.forEach(p=>this.detonate(p));
        if(this.sound)for(const p of this.projectiles)if(p.active&&!p.body.sleeping&&p.body.y+p.body.radius>75.3)this.audio.roll(p.body.vx,BALLS[p.kind].material);
        let expired=false;for(const p of this.projectiles)if(p.active&&this.time-p.born>8){p.active=false;expired=true;}if(expired)this.syncBodies();
        if(this.phase==='play'){
            for(const b of this.blocks)if(Math.abs(b.angle)>.4||Math.hypot(b.x-b.homeX,b.y-b.homeY)>5)b.disturbed=true;
            this.tumbled=this.blocks.filter(b=>b.disturbed).length;
            if(!this.cheered&&this.blocks.length&&this.tumbled/this.blocks.length>=.75){this.cheered=true;this.say('3 stars',2.5);this.burst(75,35,20,true);}
        }
        if(this.phase==='building'&&wasMoving&&!this.world.bodies.some(b=>!b.sleeping&&!b.fixed)){this.snapshotBuild();this.persist();}
        if(wasMoving||expired||transient||this.world.bodies.some(b=>!b.sleeping&&!b.fixed)){this.draw();this.dirty();}
    }
    close(){if(this.closed)return;this.snapshotBuild();this.persist();this.closed=true;this.audio.close();this.players.clear();super.close();}
}
module.exports=TumbleTower;
