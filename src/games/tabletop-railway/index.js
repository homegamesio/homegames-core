'use strict';
const {Game,GameNode,Shapes,ShapeUtils}=require('squish-150');
const {UI,C,circle,line}=require('./ui');const {design,Railway,laneY}=require('./rules');const initial=require('./creation');
const COLORS=[C.coral,C.blue,C.mint,C.gold];const NAMES=['SUNSET','BLUEBELL','CLOVER','HONEY'];
function readUserDesign(files) { try { return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(files?.['railway.json'])); } catch (_) { return null; } }
class TabletopRailway extends Game{
 static metadata(){return {
            thumbnail: './assets/thumbnail.png',
            name:'Tabletop Railway',
            description:'Line up your phones and run a railway across every screen. Switch tracks, stop trains, and deliver the right cargo together. Solo practice included.',
            author: "Joseph Garcia",
            aspectRatio:{x:1,y:1},
            tickRate:20,
            maxPlayers: 4,
            gameId: "81bd8bdd-3f29-424b-be59-440e9db2c696"
        };}
 constructor(options={}){super();this.options=options;this.creation=design(readUserDesign(options.userExports)||options.saveData?.creation||initial);this.people=new Map();this.order=[];this.owner=null;this.views=new Map();this.phase='lobby';this.notice='';this.best=Number(options.saveData?.best)||0;this.t=0;
  this.base=new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:ShapeUtils.rectangle(0,0,0,0)});this.ui=new UI(this.base);}
 getLayers(){return [{root:this.base}];}
 canAddPlayer(){return this.people.size<4;}
 handleNewPlayer({playerId,info}){if(!this.canAddPlayer())return;this.people.set(playerId,String(info?.name||'Player '+playerId).slice(0,12));this.order.push(playerId);if(this.owner===null)this.owner=playerId;
  if(this.phase==='run'){this.phase='lobby';this.notice='A new station joined. Arrange screens, then start a fresh run.';}this.render();}
 handlePlayerDisconnect(id){this.people.delete(id);this.order=this.order.filter(p=>p!==id);if(id===this.owner)this.owner=this.order[0]??null;if(this.phase==='run'){this.phase='lobby';this.notice='A station left. Trains are safe; restart with the remaining screens.';}this.render();}

    save() { return Promise.all([this.options.saveGame?.({creation:this.creation,best:this.best}), this.options.createExport?.('railway.json', new TextEncoder().encode(JSON.stringify(this.creation,null,2)))]).catch(() => { this.notice='Could not save the creation. Try again before closing.'; }); }
 reorder(id,dir){if(this.phase!=='lobby')return;const i=this.order.indexOf(id),j=i+dir;if(i<0||j<0||j>=this.order.length)return;[this.order[i],this.order[j]]=[this.order[j],this.order[i]];this.render();}
 start(id){if(id!==this.owner||!this.order.length)return;this.rail=new Railway(this.order,this.creation);this.phase='run';this.render();}
 render(){this.base.clearChildren();this.views.clear();for(const id of this.order){const root=this.ui.group(this.base,[id]),u=new UI(root);const index=this.order.indexOf(id);const view={root,u,index};this.views.set(id,view);
  u.rect(0,0,100,100,C.cream);u.text(this.creation.lineName,5,9,3.5,C.ink);
  if(this.phase==='lobby')this.lobby(id,view);else this.station(id,view);
 }}
 lobby(id,{u,index}){u.text('YOU ARE SCREEN',50,21,2.4,C.muted,undefined,'center');u.text(index+1,50,28,16,COLORS[index],undefined,'center');
  u.text(NAMES[index]+' STATION',50,48,3.5,C.ink,undefined,'center');
  u.button('← Move left',5,56,43,9,who=>{if(who===id)this.reorder(id,-1);},C.white);u.button('Move right →',52,56,43,9,who=>{if(who===id)this.reorder(id,1);},C.white);
  u.text(this.order.length>1?'Line up screens from left to right.':'Match each train to its platform.',50,71,2.05,C.muted,undefined,'center');
  if(id===this.owner){u.button(['','Leisurely','Express','Rush hour'][this.creation.pace],5,81,43,7,who=>{if(who===id){this.creation.pace=this.creation.pace%3+1;this.save();this.render();}},C.gold);u.button(this.order.length===1?'SOLO PRACTICE':'ALL ABOARD',52,81,43,7,who=>this.start(who),C.mint);}
  else u.text('Your host will start the railway.',50,84,2.4,C.muted,undefined,'center');
  u.text(this.notice.slice(0,83),50,93,1.65,C.muted,undefined,'center');}
 station(id,v){const {u,index}=v;u.rect(0,21,100,55,[230,227,199,255]);
  // Houses and trees are all local geometry. The two rail heights match on every device.
  for(let i=0;i<5;i++){u.rect(7+i*21,24,7,7,COLORS[(index+i)%4]);u.shape([[6+i*21,24],[10.5+i*21,20],[15+i*21,24],[6+i*21,24]],C.navy);}
  for(const y of [42,65]){for(let x=0;x<=100;x+=5)u.rect(x,y-2.5,1.2,5,C.muted);u.rect(0,y-1.1,100,.65,C.ink);u.rect(0,y+1.1,100,.65,C.ink);}
  v.diag=u.shape(line(33,42,67,65,1.6),C.gold);v.route=u.shape(line(33,65,67,42,1.6),C.gold);
  for(let lane=0;lane<2;lane++){u.rect(75,laneY(lane)-8,21,5,COLORS[index]);u.text((index+1)+(lane?' B':' A'),85.5,laneY(lane)-7,2,C.ink,undefined,'center');}
  u.text('← FROM '+(index===0?this.order.length:index),2,77,1.8,C.muted);u.text('TO '+(index+1===this.order.length?1:index+2)+' →',98,77,1.8,C.muted,undefined,'right');
  v.trains=Array.from({length:10},()=>({body:u.rect(0,0,0,0,C.coral),cab:u.rect(0,0,0,0,C.ink),label:u.text('',0,0,1.6,C.white),wheel:u.rect(0,0,0,0,C.ink)}));
  v.score=u.text('',5,16,2.4,C.ink);v.signal=u.shape(circle(25,34,2),C.mint);v.switchLabel=u.text('',50,83,2.2,C.ink,undefined,'center');
  u.button('SWITCH TRACK',5,87,54,9,who=>{if(who===id&&this.phase==='run')this.rail.switch(id);},C.gold);
  u.button('STOP / GO',62,87,33,9,who=>{if(who===id&&this.phase==='run')this.rail.signal(id);},C.coral);
  if(id===this.owner)u.button('Arrange',80,1,18,5,who=>{if(who===id){this.phase='lobby';this.render();}},C.white);
  if(this.phase==='won'||this.phase==='lost')this.result(id,v);}
 drawTrains(v){const {u,index}=v,r=this.rail;const visible=[];
  for(const t of r.trains){if(t.section===index)visible.push({t,x:t.x,y:r.y(t)});
   else if((t.section+1)%r.ids.length===index&&t.x>94)visible.push({t,x:t.x-100,y:laneY(t.exit)});
   else if((t.section+r.ids.length-1)%r.ids.length===index&&t.x<6)visible.push({t,x:t.x+100,y:laneY(t.entry)});}
  v.trains.forEach((nodes,i)=>{const item=visible[i];if(!item){u.hide(nodes.body);u.hide(nodes.cab);u.hide(nodes.wheel);u.updateText(nodes.label,'');return;}const {t,x,y}=item;const left=Math.max(0,x-6),right=Math.min(100,x+6);u.move(nodes.body,left,y-3,Math.max(0,right-left),6,COLORS[t.dest]);u.move(nodes.cab,Math.max(0,Math.min(98,x+2)),y-2,2,2,C.white);u.move(nodes.wheel,left,y+2.4,Math.max(0,right-left),.9,C.ink);nodes.label.node.text.x=Math.max(4,Math.min(96,x));nodes.label.node.text.y=y-1;nodes.label.node.text.align='center';nodes.label.node.onStateChange();u.updateText(nodes.label,(t.dest+1)+(t.destLane?'B':'A'));});
  u.updateText(v.score,r.delivered+' / '+r.design.deliveryGoal+' deliveries · '+(3-r.crashes)+' chances · '+Math.ceil(240-r.time)+'s');
  u.updateText(v.switchLabel,'SCREEN '+(index+1)+' → PLATFORM '+(r.switches[index]?'B':'A')+(r.stopped[index]?' · STOPPED':''));
  v.signal.update({fill:r.stopped[index]?C.coral:C.mint});v.diag.update({fill:r.switches[index]?C.gold:[95,116,125,65]});v.route.update({fill:!r.switches[index]?C.gold:[95,116,125,65]});}
 result(id,v){const {u}=v;const box=u.rect(9,31,82,36,C.cream);u.text(this.phase==='won'?'RIGHT ON TIME!':'END OF THE LINE',50,36,4,C.ink,box,'center');u.text(this.rail.delivered+' deliveries · '+this.rail.missed+' missed platforms',50,44,2.2,C.muted,box,'center');if(id===this.owner)u.button('Run another service',17,52,66,9,who=>this.start(who),C.mint,box);else u.text('Waiting for the next departure',50,56,2,C.muted,box,'center');}
 tick(){this.t+=1/20;if(this.phase!=='run')return;this.rail.tick(1/20);for(const v of this.views.values())this.drawTrains(v);if(this.rail.phase!=='run'){this.phase=this.rail.phase;this.best=Math.max(this.best,this.rail.delivered);this.save();this.render();}}
}
module.exports=TabletopRailway;
