const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');
const { buildCharacter, buildBall } = require('./character');
const { TUNING, BRAND, COLORS:C, SWATCHES, CAMERA } = require('./settings');
const { OUTFITS } = require('./wardrobe');
const { Animator } = require('./animation');
const { project, projectMesh } = require('./projection');
const HIDDEN=[[0,0],[0,0],[0,0]];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mix=(a,b,t)=>a.map((v,i)=>i===3?255:Math.round(v+(b[i]-v)*clamp(t,0,1)));
const close=p=>p.concat([p[0]]);
const poly=(x,y,r,n=6)=>Array.from({length:n+1},(_,i)=>[x+Math.cos(i*Math.PI*2/n)*r,y+Math.sin(i*Math.PI*2/n)*r]);
const strip=(x,y,xx,yy,w)=>{const a=Math.atan2(yy-y,xx-x),dx=Math.sin(a)*w/2,dy=Math.cos(a)*w/2;return close([[x-dx,y+dy],[xx-dx,yy+dy],[xx+dx,yy-dy],[x+dx,y-dy]]);};


class Sunside extends Game {
    static metadata(){return {
            // Catalog review: Character, outfit and camera showcase with a short attached rally.
            isTest: true,
        squishVersion:'150',name:'Sunside',author: "Joseph Garcia",createdBy: "Joseph Garcia",
        description:'A polygon character studio with Mika, a 25-year-old volleyball captain. Three outfits, blended animations, camera presets and a twelve-return rally. Entirely procedural 3D, rendered through Homegames.',
        aspectRatio:{x:1,y:1},tickRate:20,maxPlayers:1,
    };}
    constructor(options={}){
        super();this.time=0;this.phase='free';this.players=new Set();this.keys={};
        this.palette=0;this.outfit=0;this.sunset=false;this.waveUntil=0;this.cheerUntil=0;this.hitAt=-10;
        this.freePose='idle';this.autoOrbit=false;this.animator=new Animator();this.motion=null;
        this.camera={yaw:-.10,targetYaw:-.10,zoom:1,targetZoom:1};
        this.drag=null;this.buttonPress=null;this.lastAction={};this.flight=0;this.hits=0;this.perfects=0;this.messageUntil=0;
        const saved=options.saveData||{};
        this.best=[1,2].includes(saved.schema)&&Number.isInteger(saved.best)?clamp(saved.best,0,TUNING.goal):0;
        if(saved.schema===2){
            this.outfit=Math.max(0,OUTFITS.findIndex(o=>o.id===saved.outfit));
            if(Number.isInteger(saved.palette)&&SWATCHES[saved.palette])this.palette=saved.palette;
            this.sunset=saved.sunset===true;
        }
        this.saveGame=typeof options.saveGame==='function'?options.saveGame:null;
        this.base=this.rect(0,0,100,100,C.cream);
        this.scenery=this.group();this.mesh=this.group();this.fx=this.group();this.hud=this.group();
        this.touch=this.shape(ShapeUtils.rectangle(34,13,66,71),null,{onClick:(id,x,y)=>this.pointer(id,{x,y})});
        this.base.addChildren(this.scenery,this.mesh,this.fx,this.touch,this.hud);
        this.meshNodes=[];
        for(let i=0;i<TUNING.meshBudget;i++)this.meshNodes.push(this.put(this.mesh,this.shape(HIDDEN,C.cream)));
        this.particles=Array.from({length:18},()=>({life:0,node:this.put(this.fx,this.shape(HIDDEN,C.gold))}));
        this.buildScenery();this.buildHud();this.renderScene();this.updateHud();
    }
    getLayers(){return [{root:this.base}];}
    shape(points,fill,opts={}){return new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:points,...(fill?{fill}:{}),...opts});}
    rect(x,y,w,h,color,opts){return this.shape(ShapeUtils.rectangle(x,y,w,h),color,opts);}
    group(){return this.shape(HIDDEN,null);}
    text(str,x,y,size,color=C.ink,align='left',font='sans-serif'){
        // Squish 1.5.0 scales type by the length of its XY scale vector.
        return new GameNode.Text({textInfo:{text:str,x,y,size:size/Math.SQRT2,color,align,font}});
    }
    put(parent,node){parent.addChild(node,false);return node;}
    setText(n,str,color){n.node.text={...n.node.text,text:str,...(color?{color}:{})};}
    dirty(){this.base.node.onStateChange();}
    button(label,x,y,w,h,action,fill=C.cream,size=2.15){
        const info={x,y,w,h,action};
        const n=this.rect(x,y,w,h,fill,{color:C.line,border:1,onClick:()=>{
            const previous=this.buttonPress;this.buttonPress={action,time:this.time};
            if(!previous)this.invoke(action);
        }});
        info.node=n;info.label=this.text(label,x+w/2,y+(h-size)/2,size,fill===C.sea?C.white:C.ink,'center');
        n.addChild(info.label,false);this.hud.addChild(n,false);this.buttons.push(info);return info;
    }

    buildScenery(){
        this.scenery.clearChildren();const s=this.scenery;
        const skyTop=this.sunset?[244,173,144,255]:[188,222,218,255];
        const skyBottom=this.sunset?[255,222,172,255]:[238,241,219,255];
        for(let i=0;i<6;i++)this.put(s,this.rect(0,13+i*5.5,100,5.6,mix(skyTop,skyBottom,i/5)));
        this.put(s,this.shape(poly(84,26,6.1,22),this.sunset?[255,234,169,255]:[255,250,219,255]));
        this.put(s,this.shape(close([[0,43],[13,37],[22,40],[35,34],[52,43]]),this.sunset?[190,151,145,255]:[141,186,185,255]));
        this.put(s,this.shape(close([[17,44],[39,38],[52,41],[66,36],[80,44]]),this.sunset?[171,142,143,255]:[111,164,169,255]));
        this.put(s,this.rect(0,43,100,18,this.sunset?[119,167,170,255]:[93,176,185,255]));
        this.put(s,this.shape(close([[0,55],[18,54],[35,57],[53,55],[74,57],[100,53],[100,64],[0,64]]),this.sunset?[161,190,179,255]:[145,207,201,255]));
        this.water=[];
        for(let i=0;i<7;i++){
            const y=45+i*2.0;
            this.water.push({y,index:i,node:this.put(s,this.shape(strip(0,y,100,y,.10),mix(C.white,[108,181,187,255],.35)))});
        }
        this.put(s,this.shape(close([[0,60],[18,58],[35,60],[59,59],[81,60],[100,57],[100,85],[0,85]]),this.sunset?[239,206,163,255]:[236,221,181,255]));
        this.put(s,this.shape(close([[36,72],[77,63],[99,72],[57,84]]),this.sunset?[228,190,145,255]:[225,204,159,255]));
        for(const pair of [[[37,72],[77,64]],[[77,64],[97,72]],[[97,72],[57,83]],[[57,83],[37,72]]])this.put(s,this.shape(strip(...pair[0],...pair[1],.2),C.cream));
        // A distant net and palm establish scale without competing with the face.
        this.put(s,this.shape(strip(34,54,34,70,.35),[164,152,119,255]));
        this.put(s,this.shape(strip(90,50,90,67,.35),[164,152,119,255]));
        for(let j=0;j<5;j++)this.put(s,this.shape(strip(34,54+j*1.6,90,50+j*1.6,.08),[242,235,204,255]));
        for(let j=0;j<15;j++){const x=34+j*4;this.put(s,this.shape(strip(x,54-j*.285,x,60.4-j*.285,.065),C.cream));}
        this.put(s,this.shape(close([[95,68],[94,43],[91,31],[93,31],[97,43],[98,68]]),[163,141,103,255]));
        const leaves=[[[92,32],[77,29],[71,35],[83,33]],[[92,32],[80,19],[71,21],[82,24]],[[92,32],[93,18],[100,15],[97,24]],[[92,32],[100,26],[100,34]],[[92,32],[82,38],[80,43],[89,38]],[[92,32],[100,41],[100,35]]];
        leaves.forEach((pts,i)=>this.put(s,this.shape(close(pts),i%2?[79,127,111,255]:[103,150,120,255])));
        this.shadow=this.put(s,this.shape(close(Array.from({length:20},(_,i)=>[65+Math.cos(i*Math.PI/10)*7,80.1+Math.sin(i*Math.PI/10)*1.5])),[193,181,146,255]));
    }
    buildHud(){
        this.hud.clearChildren();this.buttons=[];
        this.put(this.hud,this.rect(0,0,100,13,C.cream));
        this.put(this.hud,this.text(BRAND.title,4,3.2,5,C.ink,'left','serif'));
        this.put(this.hud,this.text(BRAND.subtitle,34,6.2,1.5,C.muted));
        this.lightButton=this.button('GOLDEN HOUR',80,4.5,16,4.4,'light',C.paper,1.55);
        this.put(this.hud,this.rect(4,19,29,59,C.cream));
        this.put(this.hud,this.text('01 / THE BEACH CLUB',6,22,1.4,C.muted));
        this.put(this.hud,this.text(BRAND.character,6,25.5,6.5,C.ink,'left','serif'));
        this.put(this.hud,this.text(BRAND.biography,6,34.3,1.4,C.muted));
        this.outfitButton=this.button('',6,38.5,25,5,'outfit',C.paper,2);
        this.secondary=this.button('WAVE',6,45,12,5,'secondary',C.paper,1.85);
        this.danceButton=this.button('DANCE',19,45,12,5,'dance',C.paper,1.85);
        this.warmupButton=this.button('STRETCH',6,51,12,5,'warmup',C.paper,1.6);
        this.idleButton=this.button('IDLE',19,51,12,5,'idle',C.paper,1.85);
        this.put(this.hud,this.rect(6,59,25,1.5,C.line));
        this.hotZone=this.put(this.hud,this.rect(6+25*TUNING.hitFrom,59,25*(1-TUNING.hitFrom),1.5,C.mint));
        this.timing=this.put(this.hud,this.rect(6,58.6,.5,2.3,C.ink));
        this.primary=this.button('START A RALLY',6,62,25,7,'primary',C.sea,2.45);
        this.status=this.put(this.hud,this.text('',6,70.8,2.3));
        this.hint=this.put(this.hud,this.text('',6,74.7,1.45,C.muted));
        this.score=this.put(this.hud,this.text('',6,57,1.15,C.muted));
        this.put(this.hud,this.rect(0,84,100,16,C.cream));
        this.cameraLabel=this.put(this.hud,this.text('CAMERA / DRAG THE SCENE TO TURN',4,87,1.35,C.muted));
        this.button('FULL',4,91,10,6,'full');this.button('3/4',16,91,10,6,'threequarter');
        this.button('FACE',28,91,10,6,'portrait');this.autoButton=this.button('AUTO',40,91,12,6,'auto');
        this.button('-',54,91,7,6,'out');this.button('+',63,91,7,6,'in');
        this.put(this.hud,this.text('OUTFIT COLOR',77,87,1.35,C.muted));
        SWATCHES.forEach((color,i)=>this.button('',77+i*7,91,5,6,'color'+i,color));
        this.selection=this.put(this.hud,this.rect(77,98,5,.4,C.ink));
        this.sceneHint=this.put(this.hud,this.text('MEET MIKA / TURN THE SCENE OR TRY A RALLY',65,81.2,1.0,C.ink,'center'));
    }

    handleNewPlayer({playerId}){if(this.players.size===0)this.players.add(Number(playerId));this.dirty();}
    handlePlayerDisconnect(id){this.players.delete(Number(id));this.drag=null;this.buttonPress=null;this.keys={};}
    handleKeyDown(id,key){
        if(!this.players.has(Number(id))||typeof key!=='string')return;
        key=key.toLowerCase();const previous=this.keys[key];this.keys[key]=this.time;
        if(key==='arrowleft'||key==='a')this.invoke('left');
        else if(key==='arrowright'||key==='d')this.invoke('right');
        else if((key==='+'||key==='=')&&previous===undefined)this.invoke('in');
        else if(key==='-'&&previous===undefined)this.invoke('out');
        else if((key===' '||key==='enter')&&previous===undefined)this.invoke('primary');
        else if(key==='w'&&previous===undefined)this.invoke('secondary');
        else if(key==='p'&&previous===undefined)this.invoke('portrait');
        else if(previous===undefined){
            const actions={o:'outfit',m:'dance',r:'warmup',i:'idle',v:'threequarter',t:'auto'};
            if(actions[key])this.invoke(actions[key]);
        }
    }
    handleKeyUp(id,key){if(this.players.has(Number(id))&&typeof key==='string')delete this.keys[key.toLowerCase()];}
    pointer(id,pos){
        if(!this.players.has(Number(id))||this.phase==='rally'||!pos||!Number.isFinite(pos.x)||!Number.isFinite(pos.y))return;
        if(pos.x<34||pos.y<13||pos.y>84)return;
        this.autoOrbit=false;
        if(this.drag){this.camera.targetYaw+=(pos.x-this.drag.x)*.025;this.drag.x=pos.x;this.drag.y=pos.y;}
        else this.drag={x:pos.x,y:pos.y};
    }
    handleMouseMove(id,pos){
        if(this.buttonPress&&this.players.has(Number(id)))this.buttonPress.time=this.time;
        this.pointer(id,pos);
    }
    handleMouseUp(id,pos){
        if(!this.players.has(Number(id)))return;
        this.drag=null;const pressed=this.buttonPress;this.buttonPress=null;
        // Same short-tap fallback as Tug Club, scoped to actual controls.
        if(!pos||!Number.isFinite(pos.x)||!Number.isFinite(pos.y))return;
        const b=this.buttons.find(b=>pos.x>=b.x&&pos.x<=b.x+b.w&&pos.y>=b.y&&pos.y<=b.y+b.h);
        if(b&&!pressed)this.invoke(b.action);
    }
    invoke(action){
        if(!this.players.size)return;
        if(this.lastAction[action]!==undefined&&this.time-this.lastAction[action]<.22)return;
        this.lastAction[action]=this.time;
        if(action==='primary'){
            if(this.phase==='rally')this.hit();else this.startRally();
        } else if(action==='secondary'){
            if(this.phase==='free'){this.waveUntil=this.time+3.2;this.setText(this.hint,'Hey! Good to see you.');this.messageUntil=this.time+3;}
            else {this.phase='free';this.camera.targetZoom=1;this.cheerUntil=0;this.freePose='idle';}
        } else if(['dance','warmup','idle'].includes(action)){
            this.phase='free';this.freePose=action;this.waveUntil=0;this.cheerUntil=0;this.messageUntil=0;
        } else if(action==='outfit'){
            this.outfit=(this.outfit+1)%OUTFITS.length;this.save();
        } else if(action==='light'){
            this.sunset=!this.sunset;this.buildScenery();this.setText(this.lightButton.label,this.sunset?'DAYLIGHT':'GOLDEN HOUR');
            this.save();
        } else if(action.startsWith('color')){
            const n=Number(action.slice(5));if(Number.isInteger(n)&&SWATCHES[n])this.palette=n;
            this.save();
        } else if(this.phase!=='rally'){
            if(CAMERA.presets[action]){
                const preset=CAMERA.presets[action];
                this.camera.targetZoom=preset.zoom;this.camera.targetYaw=preset.yaw;this.autoOrbit=false;
            }
            if(action==='auto')this.autoOrbit=!this.autoOrbit;
            if(action==='left'){this.camera.targetYaw-=.16;this.autoOrbit=false;}
            if(action==='right'){this.camera.targetYaw+=.16;this.autoOrbit=false;}
            if(action==='in')this.camera.targetZoom=clamp(this.camera.targetZoom+.15,CAMERA.minZoom,CAMERA.maxZoom);
            if(action==='out')this.camera.targetZoom=clamp(this.camera.targetZoom-.15,CAMERA.minZoom,CAMERA.maxZoom);
        }
        this.updateHud();this.dirty();
    }
    startRally(){
        this.phase='rally';this.hits=0;this.perfects=0;this.flight=-.85;this.hitAt=-10;
        this.camera.targetZoom=1;this.camera.targetYaw=0;this.waveUntil=0;this.cheerUntil=0;
        this.autoOrbit=false;this.freePose='idle';
        this.messageUntil=this.time+1;this.setText(this.hint,'Watch the timing marker.');
    }
    hit(){
        const q=this.flight/TUNING.flightSeconds;
        if(q<TUNING.hitFrom||q>TUNING.hitUntil){this.setText(this.hint,'Wait for the green zone.');this.messageUntil=this.time+.6;return;}
        this.hits++;const perfect=Math.abs(q-.975)<.048;if(perfect)this.perfects++;
        this.hitAt=this.time;this.flight=0;
        this.setText(this.hint,perfect?'PERFECT RETURN!':'Nice! Keep it going.');this.messageUntil=this.time+.8;
        this.emit(60,43,perfect?C.gold:C.mint);
        if(this.hits>=TUNING.goal)this.finish(true);
    }
    finish(won){
        this.phase=won?'won':'over';if(won)this.cheerUntil=this.time+4;
        this.best=Math.max(this.best,this.hits);
        this.save();
    }
    save(){
        if(!this.saveGame)return;
        try{
            const result=this.saveGame({schema:2,best:this.best,outfit:OUTFITS[this.outfit].id,palette:this.palette,sunset:this.sunset});
            if(result&&result.catch)result.catch(()=>{});
        }catch(_){}
    }
    poseName(){
        return this.phase==='rally'?'rally':this.time<this.cheerUntil?'cheer':this.time<this.waveUntil?'wave':this.freePose;
    }
    updateHud(){
        const playing=this.phase==='rally',won=this.phase==='won',over=this.phase==='over';
        const pose=this.poseName();
        this.setText(this.status,playing?this.hits+' / '+TUNING.goal:won?'Beach champion!':over?'Nice try!':pose==='dance'?'Find your rhythm.':pose==='warmup'?'Ready for the court.':'A little sunshine.');
        if(this.time>this.messageUntil)this.setText(this.hint,playing?'Tap HIT in the green zone.':won?'Twelve returns. All smiles.':over?'Ready for another round?':OUTFITS[this.outfit].description);
        this.setText(this.primary.label,playing?'HIT!':won||over?'PLAY AGAIN':'START A RALLY');
        this.setText(this.secondary.label,this.phase==='free'?'WAVE':'FREE VIEW');
        this.setText(this.outfitButton.label,'LOOK / '+OUTFITS[this.outfit].label+'  >');
        this.setText(this.lightButton.label,this.sunset?'DAYLIGHT':'GOLDEN HOUR');
        for(const [button,selected] of [[this.danceButton,pose==='dance'],[this.warmupButton,pose==='warmup'],[this.idleButton,pose==='idle'],[this.autoButton,this.autoOrbit]]){
            button.node.node.fill=selected?C.sea:C.paper;this.setText(button.label,button.label.node.text.text,selected?C.white:C.ink);
        }
        const q=clamp(this.flight/TUNING.flightSeconds,0,1);
        this.timing.node.coordinates2d=ShapeUtils.rectangle(6+24.5*(playing?q:0),58.6,.5,2.3);
        this.hotZone.node.fill=playing?C.mint:C.line;
        this.primary.node.fill=playing&&q>=TUNING.hitFrom?C.coral:C.sea;
        this.setText(this.score,playing||won||over?'RETURNS '+this.hits+' / PERFECT '+this.perfects:'BEST RALLY / '+this.best);
        this.selection.node.coordinates2d=ShapeUtils.rectangle(77+this.palette*7,98,5,.4);
        this.setText(this.cameraLabel,playing?'RALLY CAMERA / SPACE OR TAP HIT':'CAMERA / DRAG THE SCENE TO TURN');
        this.setText(this.sceneHint,playing?'KEEP THE BALL IN THE AIR':this.camera.zoom>1.6?'PORTRAIT / WIND, BLINKS & POLYGON DETAILS':'MEET MIKA / TURN THE SCENE OR TRY A RALLY');
    }

    project(point){return project(point,this.camera);}
    renderScene(){
        const pose=this.poseName();
        const faces=buildCharacter({time:this.time,pose,action:clamp((this.time-this.hitAt)/.5,0,1),color:SWATCHES[this.palette],outfit:OUTFITS[this.outfit].id,motion:this.motion});
        let ballPos=[-.75,.18,.35];
        if(this.phase==='rally'){
            const q=clamp(this.flight/TUNING.flightSeconds,0,1.065);
            ballPos=[-.10-Math.sin(q*Math.PI)*1.05,1.76+Math.sin(q*Math.PI)*1.03,.54];
        }
        faces.push(...buildBall(ballPos,.14,this.time*1.5));
        const projected=projectMesh(faces,this.camera,this.sunset);
        this.visibleFaces=projected.length;
        for(let i=0;i<this.meshNodes.length;i++){
            const node=this.meshNodes[i].node,f=projected[i];
            node.coordinates2d=f?f.points:HIDDEN;if(f)node.fill=f.color;
        }
    }
    emit(x,y,color){
        for(let i=0;i<this.particles.length;i++){
            const p=this.particles[i],a=i*Math.PI*2/this.particles.length;
            p.life=.7;p.x=x;p.y=y;p.vx=Math.cos(a)*7;p.vy=Math.sin(a)*7;p.node.node.fill=color;
        }
    }
    tick(){
        const dt=1/TUNING.tickRate;this.time+=dt;
        for(const key of Object.keys(this.keys))if(this.time-this.keys[key]>.4)delete this.keys[key];
        if(this.buttonPress&&this.time-this.buttonPress.time>.4)this.buttonPress=null;
        if(this.autoOrbit&&this.phase!=='rally')this.camera.targetYaw+=dt*CAMERA.orbitSpeed;
        this.camera.yaw+=(this.camera.targetYaw-this.camera.yaw)*.24;
        this.camera.zoom+=(this.camera.targetZoom-this.camera.zoom)*.20;
        if(this.phase==='rally'&&this.players.size){this.flight+=dt;if(this.flight/TUNING.flightSeconds>TUNING.hitUntil)this.finish(false);}
        this.motion=this.animator.update(this.poseName(),this.time,clamp((this.time-this.hitAt)/.5,0,1),dt);
        for(const w of this.water){
            const x=Math.sin(this.time*.45+w.index)*2;
            w.node.node.coordinates2d=strip(0,w.y,100,w.y+Math.sin(this.time*.4+w.index)*.2,.09+Math.abs(x)*.012);
        }
        for(const p of this.particles){
            if(p.life<=0)continue;p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
            p.node.node.coordinates2d=p.life>0?poly(p.x,p.y,.18+p.life*.18,4):HIDDEN;
            p.node.node.color=[255,255,255,Math.round(255*clamp(p.life/.7,0,1))];
        }
        this.renderScene();this.updateHud();this.dirty();
    }
}

module.exports=Sunside;
