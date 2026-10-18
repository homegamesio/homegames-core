'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
function design(v){return {version:1,lineName:String(v?.lineName||'The Kitchen Table Express').slice(0,32),pace:clamp(Math.round(v?.pace||1),1,3),deliveryGoal:clamp(Math.round(v?.deliveryGoal||12),6,24)};}
const laneY=lane=>lane?65:42;
class Railway {
 constructor(ids,creation){this.ids=[...ids];this.design=design(creation);this.switches=ids.map(()=>0);this.stopped=ids.map(()=>false);this.trains=[];this.nextId=0;this.spawnIn=1;this.time=0;this.delivered=0;this.missed=0;this.crashes=0;this.phase='run';this.events=[];}
 switch(id){const i=this.ids.indexOf(id);if(i>=0)this.switches[i]=1-this.switches[i];}
 signal(id){const i=this.ids.indexOf(id);if(i>=0)this.stopped[i]=!this.stopped[i];}
 spawn(){if(this.trains.length>=8)return;const id=this.nextId++;this.trains.push({id,section:0,x:-8,lane:0,entry:0,exit:0,locked:false,dock:0,dest:Math.floor(id/2)%this.ids.length,destLane:id%2,laps:0});}
 y(t){if(t.x<34)return laneY(t.entry);if(t.x>66)return laneY(t.exit);const k=(t.x-34)/32;return laneY(t.entry)+(laneY(t.exit)-laneY(t.entry))*(k*k*(3-2*k));}
 tick(dt){if(this.phase!=='run')return;dt=Math.min(.1,Math.max(0,dt));this.time+=dt;this.events=[];
  this.spawnIn-=dt;if(this.spawnIn<=0&&this.delivered+this.trains.length<this.design.deliveryGoal){this.spawn();this.spawnIn=8-(this.design.pace-1)*1.4;}
  for(const t of this.trains){if(t.done)continue;if(t.dock>0){t.dock-=dt;if(t.dock<=0){t.done=true;this.delivered++;this.events.push('delivery');}continue;}
   const front=this.trains.find(other=>other!==t&&!other.done&&other.section===t.section&&other.x>t.x&&other.x-t.x<12&&Math.abs(this.y(other)-this.y(t))<4);
   if(front)continue;
   if(this.stopped[t.section]&&t.x>=24&&t.x<28)continue;
   t.x+=dt*(9+(this.design.pace-1)*2);
   if(t.x>=30&&!t.locked){t.exit=this.switches[t.section];t.locked=true;}
   if(t.x>=76&&t.x<80&&t.section===t.dest&&t.exit===t.destLane){t.dock=1.5;continue;}
   if(t.x>=100){if(t.section===t.dest&&t.exit!==t.destLane){this.missed++;this.events.push('miss');}t.section=(t.section+1)%this.ids.length;t.x-=100;t.entry=t.exit;t.lane=t.exit;t.locked=false;if(t.section===0)t.laps++;if(t.laps>=3){t.done=true;this.crashes++;}}
  }
  for(let i=0;i<this.trains.length;i++)for(let j=i+1;j<this.trains.length;j++){const a=this.trains[i],b=this.trains[j];
   if(!a.done&&!b.done&&!a.dock&&!b.dock&&a.section===b.section&&Math.abs(a.x-b.x)<7&&Math.abs(this.y(a)-this.y(b))<3){a.done=b.done=true;this.crashes++;this.events.push('crash');}}
  this.trains=this.trains.filter(t=>!t.done);
  if(this.delivered>=this.design.deliveryGoal)this.phase='won';
  else if(this.crashes>=3||this.time>=240)this.phase='lost';
 }
}
module.exports={design,Railway,laneY};
