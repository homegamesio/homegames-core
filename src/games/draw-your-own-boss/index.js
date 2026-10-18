'use strict';
const {Game,GameNode,Asset,Shapes,ShapeUtils}=require('squish-150');
const {UI,C,circle,line,clamp}=require('./ui');
const {design,BossFight,ATTACKS}=require('./rules');
const initial=require('./creation');
const COLORS=[[247,241,220,255],[30,55,66,255],[120,201,163,255],[255,253,242,255],[237,110,84,255],[244,193,81,255],[94,157,199,255]];
function readUserDesign(files) { try { return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(files?.['monster.json'])); } catch (_) { return null; } }
class DrawYourOwnBoss extends Game {
 static metadata(){return {
            name:'Draw Your Own Boss',
            thumbnail: './assets/thumbnail.png',
            description:'Draw a monster, give it a roar, and fight it with friends.',
            author: "Joseph Garcia",
            aspectRatio:{x:1,y:1},
            tickRate:30,
            maxPlayers: 4,
            assets:{roar:new Asset({path:'./assets/roar.wav',type:'audio'})},
            gameId: "16629b5a-8962-4667-99ad-b7887fd4da2a"
        };}
 constructor(options={}){super();this.options=options;this.creation=design(readUserDesign(options.userExports)||options.saveData?.creation||initial);this.roarBytes=options.userExports?.['roar.wav']?.slice() || (Array.isArray(options.saveData?.roar)&&options.saveData.roar.length<=132344?new Uint8Array(options.saveData.roar):null);
  this.players=new Map();this.owner=null;this.phase='edit';this.color=4;this.undo=[];this.painting=false;this.notice='';this.roarKey='roar';this.recording=false;this.t=0;this.keys={};
  this.base=new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:ShapeUtils.rectangle(0,0,100,100),fill:C.cream});this.ui=new UI(this.base);this.renderEditor();}
 getLayers(){return [{root:this.base}];}
 canAddPlayer(){return this.players.size<4;}
 handleNewPlayer({playerId,info}){if(!this.canAddPlayer())return;this.players.set(playerId,String(info?.name||'Player '+playerId).slice(0,14));if(this.owner===null){this.owner=playerId;if(this.roarBytes)this.installRoar(playerId,this.roarBytes).catch(()=>{});}if(this.phase==='fight')this.fight.join(playerId);else if(this.phase==='edit')this.renderEditor();}
 handlePlayerDisconnect(id){this.players.delete(id);delete this.keys[id];if(this.owner===id)this.owner=this.players.keys().next().value??null;if(this.phase==='fight')this.fight.leave(id);else if(this.phase==='edit')this.renderEditor();}
 save(){return Promise.all([this.options.saveGame?.({creation:this.creation,roar:this.roarBytes?Array.from(this.roarBytes):null}),this.options.createExport?.('monster.json',new TextEncoder().encode(JSON.stringify(this.creation,null,2))),this.roarBytes?this.options.createExport?.('roar.wav',this.roarBytes):null]).catch(()=>{this.notice='Could not save the creation. Try again before closing.';});}
 edit(id,action){if(id!==this.owner||this.phase!=='edit'||this.recording)return;action();this.save();this.renderEditor();}
 paint(id,x,y){if(id!==this.owner||this.phase!=='edit')return;const col=Math.floor((x-6)/4),row=Math.floor((y-22)/4);if(col<0||col>11||row<0||row>11)return;
  if(!this.painting){this.undo.push(this.creation.pixels.slice());if(this.undo.length>20)this.undo.shift();this.painting=true;}const i=row*12+col;if(this.creation.pixels[i]===this.color)return;this.creation.pixels[i]=this.color;this.pixelNodes[i].update({fill:COLORS[this.color]});}
 handleMouseUp(){if(this.painting){this.painting=false;this.save();}}
 async installRoar(id,bytes){if(!this.options.handleFileUpload)return;const asset=await this.options.handleFileUpload(id,bytes,{fileName:'roar.wav',contentType:'audio/wav'},{slot:'boss-roar'});this.roarKey=asset.key;}
 async record(id){if(id!==this.owner||this.recording||this.phase!=='edit')return;this.recording=true;
  try{if(!this.options.media)throw new Error('This host does not provide recording. Choose a roar file instead.');const {bytes}=await this.options.media.record(id,{kind:'audio',durationSeconds:3,maxBytes:132344,prompt:'Record a roar. It will be included when players copy this game.'});if(this.closed)return;
   if(!(bytes instanceof Uint8Array)||bytes.length>132344)throw new Error('Please keep the roar under three seconds.');this.roarBytes=bytes;await this.installRoar(id,bytes);this.notice='Your roar is ready. Downloads and copies include it.';await this.save();}
  catch(e){this.notice=e.message;}finally{this.recording=false;if(!this.closed&&this.phase==='edit')this.renderEditor();}}
 roar(){if(!this.audioRoot)return;this.audioRoot.clearChildren();const asset=new GameNode.Asset({coordinates2d:ShapeUtils.rectangle(0,0,0,0),assetInfo:{[this.roarKey]:{pos:{x:0,y:0},size:{x:0,y:0},startTime:0}}});this.audioRoot.addChild(asset);this.roarUntil=this.t+3.2;}
 renderEditor(){this.base.clearChildren();const u=this.ui;
  u.text('Draw your own boss',6,10,5,C.ink);
  const rename=u.button(this.creation.name,6,16,48,5,null,C.white);rename.node.input={type:'text',oninput:(id,value)=>this.edit(id,()=>{this.creation.name=String(value).trim().slice(0,24)||'My Monster';})};rename.node.onStateChange();
  this.pixelNodes=this.creation.pixels.map((color,i)=>u.rect(6+i%12*4,22+Math.floor(i/12)*4,3.95,3.95,COLORS[color]));
  const canvas=u.rect(6,22,48,48,[0,0,0,0],this.base,{onClick:(id,x,y)=>this.paint(id,x,y),onDrag:(id,x,y)=>this.paint(id,x,y),offClick:()=>this.handleMouseUp()});
  COLORS.forEach((color,i)=>{u.button(i===this.color?'•':i===0?'×':'',6+i*6.8,76,6,6,id=>this.edit(id,()=>{this.color=i;}),color);});
  u.text('Moves',60,22,2,C.muted);
  ATTACKS.forEach((attack,i)=>u.button((this.creation.attacks.includes(attack)?'✓ ':'')+({charge:'CHARGE',spit:'SPIT',summon:'LITTLE GUYS'}[attack]),60,27+i*9,34,7,id=>this.edit(id,()=>{this.creation.attacks=this.creation.attacks.includes(attack)?this.creation.attacks.filter(a=>a!==attack):[...this.creation.attacks,attack];if(!this.creation.attacks.length)this.creation.attacks=[attack];}),this.creation.attacks.includes(attack)?C.mint:C.white));
  u.button(['','Gentle','Spicy','Absurd'][this.creation.difficulty],60,56,34,7,id=>this.edit(id,()=>{this.creation.difficulty=this.creation.difficulty%3+1;}),C.gold);
  u.button('Record a roar',60,64,34,6,id=>this.record(id),C.blue);
  const upload=u.button('Choose roar file',60,71,34,4,null,C.white);upload.node.input={type:'file',oninput:async(id,bytes,meta)=>{if(id!==this.owner)return;try{if(meta?.kind!=='audio'||bytes.length>132344||String.fromCharCode(...bytes.slice(0,4))!=='RIFF')throw new Error('Choose a WAV file smaller than 130 KiB.');await this.installRoar(id,bytes);this.roarBytes=new Uint8Array(bytes);await this.save();this.notice='Your roar is ready.';}catch(e){this.notice=e.message;}if(this.phase==='edit')this.renderEditor();}};upload.node.onStateChange();
  u.button('Undo',60,76,16,6,id=>this.edit(id,()=>{if(this.undo.length)this.creation.pixels=this.undo.pop();}),C.white);
  u.button('Clear',78,76,16,6,id=>this.edit(id,()=>{this.undo.push(this.creation.pixels.slice());this.creation.pixels.fill(0);}),C.white);
  u.text(this.players.size+' / 4 players',6,85,2.1,C.muted);
  u.button('BRING IT TO LIFE',6,89,88,8,id=>this.start(id),C.coral);
  this.noticeText=u.text(this.notice.slice(0,82),6,98,1.45,C.muted);
 }
 start(id){if(id!==this.owner||this.recording||!this.creation.pixels.some(Boolean))return;this.save();this.phase='fight';this.fight=new BossFight(this.creation,[...this.players.keys()]);this.lastRoars=0;this.buildArena();this.roar();}
 buildArena(){this.base.clearChildren();const u=this.ui;u.rect(0,0,100,100,C.navy);u.rect(4,14,92,79,[40,70,77,255]);
  for(let x=10;x<100;x+=10)u.rect(x,16,.15,75,[48,82,86,255]);for(let y=20;y<92;y+=10)u.rect(5,y,90,.15,[48,82,86,255]);
  u.text(this.creation.name,5,4,3.4,C.white);u.text('Tap / WASD to move',5,10,1.8,C.cream);
  this.hpBar=u.rect(5,12,90,1,C.coral);this.warning=u.shape([[0,0],[0,0],[0,0]],C.coral);
  this.bossPixels=this.creation.pixels.map((c,i)=>u.rect(0,0,0,0,COLORS[c]));
  this.heroNodes=Array.from({length:4},()=>({body:u.shape(circle(0,0,0),C.mint),health:u.text('',0,0,1.6,C.white)}));
  this.shotNodes=this.fight.shots.map(()=>u.shape(circle(0,0,0),C.gold));this.bulletNodes=this.fight.bullets.map(()=>u.shape(circle(0,0,0),C.coral));this.minionNodes=this.fight.minions.map(()=>u.rect(0,0,0,0,C.mint));
  this.audioRoot=u.group();u.rect(4,14,92,79,[0,0,0,0],this.base,{onClick:(id,x,y)=>this.fight.steer(id,x,y),onDrag:(id,x,y)=>this.fight.steer(id,x,y)});
  u.button('Back to drawing',5,94,30,5,id=>{if(id===this.owner){this.phase='edit';this.renderEditor();}},C.cream);this.fightStatus=u.text('Team up or take it on solo',40,96,2,C.white);}
 handleKeyDown(id,key){if(this.phase!=='fight')return;this.keys[id]||={};this.keys[id][key.toLowerCase()]=this.t;}
 handleKeyUp(id,key){if(this.keys[id])delete this.keys[id][key.toLowerCase()];}
 tick(){this.t+=1/30;if(this.audioRoot&&this.roarUntil&&this.t>this.roarUntil){this.audioRoot.clearChildren();this.roarUntil=0;}
  if(this.phase!=='fight')return;
  for(const [id,p] of this.fight.people){const keys=this.keys[id]||{};const down=k=>this.t-(keys[k]??-100)<.2;const dx=Number(down('d')||down('arrowright'))-Number(down('a')||down('arrowleft')),dy=Number(down('s')||down('arrowdown'))-Number(down('w')||down('arrowup'));if(dx||dy)this.fight.steer(id,p.x+dx*7,p.y+dy*7);}
  this.fight.tick(1/30);this.renderFight();if(this.fight.roars!==this.lastRoars){this.lastRoars=this.fight.roars;this.roar();}if(this.fight.phase!=='fight'){this.phase=this.fight.phase;this.result();}}
 renderFight(){const u=this.ui,f=this.fight,b=f.boss;u.move(this.hpBar,5,12,90*b.hp/b.max,1);
  this.creation.pixels.forEach((c,i)=>{if(c)u.move(this.bossPixels[i],b.x-9+i%12*1.5,b.y-9+Math.floor(i/12)*1.5,1.55,1.55);else u.hide(this.bossPixels[i]);});
  if(f.attack&&f.attack.time<1){const a=f.attack;this.warning.update({coordinates2d:line(b.x,b.y,a.tx,a.ty,a.kind==='charge'?9:2),fill:[237,110,84,160]});}else u.hide(this.warning);
  const people=[...f.people.values()];this.heroNodes.forEach((node,i)=>{const p=people[i];if(!p){u.hide(node.body);u.updateText(node.health,'');return;}u.ball(node.body,p.x,p.y,p.hp>0?2:1,p.inv>0&&Math.floor(this.t*8)%2?C.white:COLORS[2+i]);node.health.node.text.x=p.x;node.health.node.text.y=p.y+3;node.health.node.text.align='center';u.updateText(node.health,p.hp>0?'♥'.repeat(p.hp):'reviving');node.health.node.onStateChange();});
  for(const [pool,nodes,size] of [[f.shots,this.shotNodes,.7],[f.bullets,this.bulletNodes,1.3]])pool.forEach((s,i)=>s.life>0&&s.x>2&&s.x<98&&s.y>14&&s.y<92?u.ball(nodes[i],s.x,s.y,size):u.hide(nodes[i]));
  f.minions.forEach((m,i)=>m.hp>0?u.move(this.minionNodes[i],m.x-2,m.y-2,4,4):u.hide(this.minionNodes[i]));u.updateText(this.fightStatus,Math.ceil(b.hp)+' boss health · '+Math.floor(f.time)+'s');}
 result(){const u=this.ui,box=u.rect(10,35,80,35,C.cream);u.text(this.phase==='won'?'YOU MADE A MONSTER.':'YOUR MONSTER WINS.',50,40,3.6,C.ink,box,'center');u.text(this.phase==='won'?'And you beat it together.':'Try moving before the red warning lands.',50,48,2,C.muted,box,'center');u.button('Rematch',17,56,30,8,id=>this.start(id),C.coral,box);u.button('Edit monster',53,56,30,8,id=>{if(id===this.owner){this.phase='edit';this.renderEditor();}},C.mint,box);}
 close(){this.closed=true;super.close();}
}
module.exports=DrawYourOwnBoss;
