'use strict';
const initial=require('./creation');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const ATTACKS=['charge','spit','summon'];
function design(value=initial){return {version:1,name:String(value?.name||'My Monster').replace(/[\r\n]/g,' ').slice(0,24),difficulty:clamp(Math.round(value?.difficulty||1),1,3),
    attacks:ATTACKS.filter(a=>value?.attacks?.includes(a)).length?ATTACKS.filter(a=>value.attacks.includes(a)):['spit'],
    pixels:Array.from({length:144},(_,i)=>clamp(Math.floor(value?.pixels?.[i]),0,6))};}
class BossFight {
    constructor(creation,ids){this.design=design(creation);this.people=new Map();ids.forEach(id=>this.join(id));this.boss={x:50,y:29,hp:400+(ids.length-1)*160,max:400+(ids.length-1)*160};
        this.boss.hp*=1+(this.design.difficulty-1)*.25;this.boss.max=this.boss.hp;this.phase='fight';this.time=0;this.nextAttack=2;this.attackIndex=0;this.attack=null;
        this.shots=Array.from({length:36},()=>({life:0}));this.bullets=Array.from({length:48},()=>({life:0}));this.minions=Array.from({length:8},()=>({hp:0}));this.roars=0;}
    join(id){if(this.people.has(id)||this.people.size>=4)return;const i=this.people.size;this.people.set(id,{id,x:30+i*13,y:78,tx:30+i*13,ty:78,hp:5,inv:0,cooldown:.2,down:0,color:i});}
    leave(id){this.people.delete(id);if(!this.people.size)this.phase='lost';}
    steer(id,x,y){const p=this.people.get(id);if(p){p.tx=clamp(x,7,93);p.ty=clamp(y,16,90);}}
    hurt(p){if(p.hp<=0||p.inv>0)return;p.hp--;p.inv=1.6;p.down=0;}
    launch(pool,value){const slot=pool.find(b=>b.life<=0);if(slot)Object.assign(slot,value);}
    beginAttack(){const alive=[...this.people.values()].filter(p=>p.hp>0);if(!alive.length)return;const p=alive[this.attackIndex%alive.length];
        const kind=this.design.attacks[this.attackIndex++%this.design.attacks.length];this.attack={kind,time:0,tx:p.x,ty:p.y,started:false};this.roars++;}
    tick(dt){if(this.phase!=='fight')return;dt=Math.min(.05,Math.max(0,dt));this.time+=dt;
        const alive=[...this.people.values()].filter(p=>p.hp>0);if(!alive.length){this.phase='lost';return;}
        if(!this.attack&&this.time>=this.nextAttack)this.beginAttack();
        if(this.attack){const a=this.attack;a.time+=dt;
            if(a.time>=1&&!a.started){a.started=true;
                if(a.kind==='spit'){const angle=Math.atan2(a.ty-this.boss.y,a.tx-this.boss.x);for(let i=-3;i<=3;i++)this.launch(this.bullets,{x:this.boss.x,y:this.boss.y,vx:Math.cos(angle+i*.2)*22,vy:Math.sin(angle+i*.2)*22,life:5});}
                if(a.kind==='summon')for(let i=0;i<3;i++){const m=this.minions.find(m=>m.hp<=0);if(m)Object.assign(m,{x:25+i*25,y:45,hp:3});}
            }
            if(a.kind==='charge'&&a.time>=1&&a.time<1.8){const dx=a.tx-this.boss.x,dy=a.ty-this.boss.y,d=Math.hypot(dx,dy);if(d>1){this.boss.x+=dx/d*Math.min(d,dt*60);this.boss.y+=dy/d*Math.min(d,dt*60);}}
            if(a.time>2.1){this.attack=null;this.nextAttack=this.time+1.8;}
        }else{this.boss.x+=(50-this.boss.x)*dt*1.3;this.boss.y+=(29-this.boss.y)*dt*1.3;}
        for(const p of this.people.values()){
            p.inv=Math.max(0,p.inv-dt);
            if(p.hp<=0){p.down+=dt;if(p.down>4){p.hp=3;p.inv=2;p.y=82;p.ty=82;}continue;}
            const dx=p.tx-p.x,dy=p.ty-p.y,d=Math.hypot(dx,dy);if(d>.1){p.x+=dx/d*Math.min(d,dt*28);p.y+=dy/d*Math.min(d,dt*28);}
            if(Math.hypot(p.x-this.boss.x,p.y-this.boss.y)<10)this.hurt(p);
            p.cooldown-=dt;
            if(p.cooldown<=0){p.cooldown=.4;const m=this.minions.filter(m=>m.hp>0).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];const target=m||this.boss;
                const a=Math.atan2(target.y-p.y,target.x-p.x);this.launch(this.shots,{x:p.x,y:p.y,vx:Math.cos(a)*65,vy:Math.sin(a)*65,life:2,color:p.color});}
        }
        for(const m of this.minions){if(m.hp<=0)continue;const p=alive.reduce((a,b)=>Math.hypot(a.x-m.x,a.y-m.y)<Math.hypot(b.x-m.x,b.y-m.y)?a:b);
            const dx=p.x-m.x,dy=p.y-m.y,d=Math.hypot(dx,dy);if(d>0){m.x+=dx/d*dt*9;m.y+=dy/d*dt*9;}if(d<3)this.hurt(p);}
        for(const s of this.shots){if(s.life<=0)continue;s.life-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;
            const m=this.minions.find(m=>m.hp>0&&Math.hypot(m.x-s.x,m.y-s.y)<3);if(m){m.hp--;s.life=0;}
            else if(Math.hypot(s.x-this.boss.x,s.y-this.boss.y)<8){this.boss.hp=Math.max(0,this.boss.hp-5);s.life=0;}}
        for(const b of this.bullets){if(b.life<=0)continue;b.life-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;for(const p of alive)if(Math.hypot(p.x-b.x,p.y-b.y)<3){this.hurt(p);b.life=0;break;}}
        if(this.boss.hp<=0)this.phase='won';
    }
}
module.exports={design,BossFight,ATTACKS};
