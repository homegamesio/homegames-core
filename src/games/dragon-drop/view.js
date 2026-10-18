const { GameNode, Shapes, ShapeUtils } = require('squish-150');
const HIDDEN = [[0,0],[0,0],[0,0],[0,0]];
const INK = [246,241,221,255], MUTED = [185,211,211,255];
const NAMES = ['Ember','Clover','Nimbus','Sunny','Plum','Dew'];
const PALETTE = [[247,159,153,255],[157,224,187,255],[160,194,245,255],[250,209,129,255],[206,172,239,255],[144,224,219,255]];
const shape = (fill, x=0,y=0,w=0,h=0, onClick) => new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:ShapeUtils.rectangle(x,y,w,h),fill:[...fill.slice(0,3),255],color:[255,255,255,fill[3]],onClick});
const tint = (node,fill) => {node.node.fill=[...fill.slice(0,3),255];node.node.color=[255,255,255,fill[3]];};
const text = (value,x,y,size,color=INK,align='center') => new GameNode.Text({textInfo:{text:value,x,y,size,color,align}});
const image = () => { const node=new GameNode.Asset({assetInfo:{}});node.node.asset=undefined;return node; };
function oval(cx,cy,rx,ry) {return Array.from({length:25},(_,i)=>{const a=i/24*Math.PI*2;return [cx+Math.cos(a)*rx,cy+Math.sin(a)*ry];});}
function sprite(node,color,x,y,r,mood='open',sx=1,sy=1) {
 const w=r*3.6*sx,h=r*3.6*sy;
 node.node.asset = {['dragon-'+color+'-'+mood]:{pos:{x:x-w/2,y:y-h*.55},size:{x:w,y:h}}};
 node.node.playerIds=[];
}
function label(node,value,color) {node.node.text={...node.node.text,text:value,...(color?{color}:{})};}
function button(root,title,x,y,w,run) {
 const back=shape([32,52,73,230],x,y,w,8,run),caption=text(title,x+w/2,y+2.6,1.7);
 caption.node.onClick=run; back.addChild(caption);root.addChild(back);return {back,caption};
}
function create(game) {
 const root=game.base=shape([34,43,81,255],0,0,100,100);
 const scene=image();scene.node.asset={sanctuary:{pos:{x:0,y:0},size:{x:100,y:100}}};root.addChild(scene);
 root.addChildren(text('drag ’n’ drop',50,4.3,4.3),text('a little dragon sanctuary',50,10.2,1.5,MUTED));
 game.scoreText=text('0',8.5,5,3.3,INK);game.bestText=text('0',91.5,5,2.2,MUTED);
 root.addChildren(text('SCORE',8.5,2.6,1,MUTED),game.scoreText,text('BEST',91.5,2.6,1,MUTED),game.bestText);
 game.pauseButton=button(root,'PAUSE',2,18,13,()=>game.togglePause());
 game.soundButton=button(root,'SOUND ON',85,18,13,()=>game.toggleSound());
 game.cloudLine=shape([215,237,219,70]);
 const dashRoot=game.cloudLine;
 for(let x=18;x<82;x+=3.2)dashRoot.addChild(shape([210,235,222,95],x,43,1.7,.16));
 root.addChildren(dashRoot,text('CLOUDLINE',80,40.8,.85,[203,224,221,190],'right'));
 game.ballLayer=shape([0,0,0,0]);root.addChild(game.ballLayer);
 for(const b of game.balls){b.node=image();b.halo=shape([0,0,0,0]);game.ballLayer.addChildren(b.halo,b.node);}
 game.flyers=Array.from({length:24},()=>({active:false,node:image()}));
 game.flyers.forEach(f=>{f.node.node.playerIds=[0];root.addChild(f.node);});
 game.fx=Array.from({length:64},()=>({active:false,node:shape([0,0,0,0])}));game.fx.forEach(f=>root.addChild(f.node));
 game.popups=Array.from({length:5},()=>({active:false,node:text(' ',0,-10,2)}));game.popups.forEach(p=>root.addChild(p.node));
 game.slots=[];
 for(let i=0;i<3;i++){
  const x=[32,50,68][i],run=(id,px,py)=>game.beginDrop(id,i,px,py);
  const back=shape([230,240,224,18],x-8,14,16,15,run),body=image(),ring=shape([255,243,188,0]);
  for(const n of [back,body]){n.node.onClick=run;n.node.onHover=id=>game.pointerCursor(id,'grab');n.node.offHover=id=>{if(!game.drag)game.pointerCursor(id,null);};}
  const name=text('',x,27,1.65,MUTED);back.addChildren(ring,body,name);root.addChild(back);
  game.slots.push({x,color:0,back,body,ring,name});
 }
 game.chainText=text('',50,33.4,2,[255,228,162,255]);
 game.hintText=text('Drag a dragon into the sky',50,93.6,2.2);
 game.subHint=text('Match 3 of a kind to help them fly.',50,97,1.5,MUTED);
 root.addChildren(game.chainText,game.hintText,game.subHint);
 game.tapCatcher=shape([0,0,0,0],17,30,66,62,(id,x,y)=>game.handleTap(id,x,y));root.addChild(game.tapCatcher);
 game.guide=shape([200,228,218,110]);game.landing=shape([220,239,217,55]);game.dropPreview=image();
 game.dropPreview.node.playerIds=[0];root.addChildren(game.guide,game.landing,game.dropPreview);
 game.overlay=shape([15,26,49,225],0,0,100,100,()=>{});game.overlay.node.playerIds=[0];
 game.bannerText=text('Take a little breather',50,37,3.6);game.bannerSub=text('',50,44,2.1,MUTED);
 game.overlay.addChildren(game.bannerText,game.bannerSub);
 game.resumeButton=button(game.overlay,'KEEP PLAYING',30,51,40,()=>game.togglePause());
 button(game.overlay,'NEW SANCTUARY',30,61,40,()=>{game.initRun();game.persist();});
 game.motionButton=button(game.overlay,'GENTLE MOTION: OFF',30,71,40,()=>game.toggleMotion());
 root.addChild(game.overlay);
 game.voices=Array.from({length:6},()=>{const node=image();node.node.asset=undefined;root.addChild(node);return {node,until:0};});
}
function preview(game) {
 const d=game.drag;
 if(!d?.moved){game.dropPreview.node.playerIds=[0];game.guide.node.coordinates2d=HIDDEN;game.landing.node.coordinates2d=HIDDEN;return;}
 const p=game.dropPosition(d.x,d.y);d.valid=p.valid;
 sprite(game.dropPreview,game.slots[d.slot].color,p.x,p.y,game.radius*1.08,'happy');
 game.landing.node.coordinates2d=p.valid?oval(p.x,p.landing,game.radius,game.radius*.38):HIDDEN;
 game.guide.node.coordinates2d=p.valid?ShapeUtils.rectangle(p.x-.065,p.y+game.radius,.13,Math.max(0,p.landing-p.y-game.radius)):HIDDEN;
}
function hud(game) {
 label(game.scoreText,String(game.score));label(game.bestText,String(game.best));
 label(game.chainText,game.chainMult>1&&game.chainT>0?'FLYAWAY CHAIN ×'+game.chainMult:'');
 for(let i=0;i<3;i++){
  const s=game.slots[i],selected=game.selected===i;
  tint(s.back,selected?[255,233,180,45]:[230,240,224,18]);
  s.ring.node.coordinates2d=oval(s.x,23.6,5.7,1.4);tint(s.ring,selected?[255,227,152,95]:[15,26,46,55]);
  sprite(s.body,s.color,s.x,21,4.8,selected?'happy':'open');
  if(game.drag?.moved&&game.drag.slot===i)s.body.node.playerIds=[0];
  label(s.name,NAMES[s.color],selected?[255,227,168,255]:MUTED);
 }
 const dragging=game.drag?.moved;
 label(game.hintText,dragging?(game.drag.valid?'Let go. Watch them tumble.':'Bring them over the sanctuary'):
  game.selected>=0?'Tap the sky to drop · Esc to cancel':'Drag a dragon into the sky');
 label(game.subHint,game.rescued?"You've helped "+game.rescued+' little dragons fly.':'Match 3 of a kind to help them fly.');
 label(game.soundButton.caption,game.sound?'SOUND ON':'SOUND OFF');
 label(game.motionButton.caption,'GENTLE MOTION: '+(game.reduced?'ON':'OFF'));
 game.overlay.node.playerIds=game.paused||game.gameOver?[]:[0];
 label(game.bannerText,game.gameOver?'A very full sanctuary':'Take a little breather');
 label(game.bannerSub,game.gameOver?game.rescued+' dragons flew home · '+game.score+' points':'Your little dragons will wait here.');
 game.resumeButton.back.node.playerIds=game.gameOver?[0]:[];
}
function render(game) {
 let wrote=false;
 const time=game._t, R=game.radius;
 for(const b of game.balls){
  if(!b.active){if(b.rx!==-999){b.node.node.playerIds=[0];b.halo.node.coordinates2d=HIDDEN;b.rx=-999;wrote=true;}continue;}
  const charging=b.chargeT>0, blink=(time+b.id*43)%263<8;
  const mood=charging?'happy':blink?'blink':'open';
  const speed=game.reduced?0:Math.min(1,Math.abs(b.vy)/.75), squash=game.reduced?0:Math.max(-.09,Math.min(.15,b.squash||0));
  const sx=1+squash-(b.asleep?0:speed*.045),sy=1-squash+(b.asleep?0:speed*.06);
  const key=[b.color,mood,Math.round(b.x*100),Math.round(b.y*100),Math.round(sx*100),Math.round(sy*100),charging?Math.floor(time/4):0].join(':');
  if(key!==b.renderKey){sprite(b.node,b.color,b.x,b.y,R,mood,sx,sy);b.renderKey=key;b.rx=b.x;b.ry=b.y;wrote=true;
   b.halo.node.coordinates2d=charging?oval(b.x,b.y,R*(1.05+.045*Math.sin(time*.2)),R*1.05):HIDDEN;
   tint(b.halo,[...PALETTE[b.color].slice(0,3),75]);}
  b.squash=(b.squash||0)*.79;
 }
 for(const f of game.flyers){if(!f.active)continue;wrote=true;f.life--;
  if(f.life<=0){f.active=false;f.node.node.playerIds=[0];continue;}
  const t=1-f.life/f.max,e=t*t; sprite(f.node,f.color,f.x+Math.sin(t*7+f.seed)*t*5,f.y-e*34,R*(1-t*.8),'happy',1+Math.sin(t*26)*.05,1);
 }
 for(const f of game.fx){if(!f.active)continue;wrote=true;f.life--;f.x+=f.vx;f.y+=f.vy;f.vy+=.003;
  if(f.life<=0){f.active=false;f.node.node.coordinates2d=HIDDEN;continue;}
  const r=.12+.28*f.life/f.max;
  f.node.node.coordinates2d=[[f.x-r,f.y],[f.x,f.y-r*2],[f.x+r,f.y],[f.x,f.y+r*2],[f.x-r,f.y]];
  tint(f.node,[...f.fill.slice(0,3),Math.round(220*f.life/f.max)]);
 }
 for(const p of game.popups){if(!p.active)continue;wrote=true;p.life--;p.y-=.025;
  p.node.node.text={...p.node.node.text,text:p.life>0?p.str:'',x:p.x,y:p.y,color:[255,239,180,Math.min(255,p.life*20)]};if(p.life<=0)p.active=false;
 }
 for(const v of game.voices)if(v.until&&time>=v.until){v.node.node.asset=undefined;v.until=0;wrote=true;}
 if(game.chainT>0&&--game.chainT===0){game.chainMult=1;game.uiDirty=true;}
 return wrote;
}
module.exports={create,preview,hud,render,sprite,PALETTE,NAMES};
