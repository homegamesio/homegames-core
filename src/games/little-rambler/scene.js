const { creature, berry, seed, scrap, COATS } = require('./creature');
const { BUILDINGS } = require('./engine');
const C = { ink:[36,56,49], dark:[22,40,36], cream:[248,234,201], paper:[236,223,187],
    muted:[132,157,134], green:[101,139,106], gold:[231,181,96], rust:[168,91,65], white:[255,246,218] };
const TAU = Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function wrap(p,text,x,y,width=32,size=1.65,color=C.ink,max=4) {
    const lines=[];let line='';
    for(const word of String(text||'').split(/\s+/)){
        if(line && line.length+word.length+1>width){lines.push(line);line=word;}else line+=(line?' ':'')+word;
    }
    if(line)lines.push(line);lines.slice(0,max).forEach((s,i)=>p.text(s,x,y+i*size*1.4,size,color));
    return Math.min(max,lines.length)*size*1.4;
}
function panel(p,x,y,w,h){
    p.roundRect(x+.5,y+.7,w,h,2,C.dark,null,.35);
    p.roundRect(x,y,w,h,2,C.paper,[170,146,107]);
    p.line(x+2,y+1,x+w-2,y+1,C.white,.16,.7);
}
function pill(p,label,x,y,w=18){p.roundRect(x,y,w,4.1,1.5,C.dark,null,.84);p.text(label,x+w/2,y+1,1.4,C.cream,'center');}
function resources(p,s,x=100,y=4){
    berry(p,x,y+1.1,1);p.text(s.berries,x+2,y,1.8,C.cream);
    seed(p,x+14,y+1.1,1);p.text(s.seeds,x+16,y,1.8,C.cream);
    scrap(p,x+28,y+1.1,1);p.text(s.scrap,x+30,y,1.8,C.cream);
}
function header(p,g,subtitle){
    p.rect(0,0,160,10.7,C.dark,.96);
    p.ellipse(4.5,5,1.3,2.2,C.green);p.line(4.1,6.4,5,3.4,C.gold,.2);

    p.text(subtitle,8,7,1.35,C.muted);
    resources(p,g.engine.save,91,3.8);
    p.button(g.music?'Music on':'Music off',136,2.4,20,5.6,'music',false,true);
}
function furnish(p,id,x,y,t,built,growth=0,small=false){
    const s=small?.75:1;
    if(id==='planter'){
        p.poly([[x-5*s,y-5*s],[x+5*s,y-5*s],[x+4*s,y],[x-4*s,y]],C.rust);
        p.roundRect(x-5.5*s,y-6*s,11*s,2*s,.6,[204,137,84]);
        p.ellipse(x,y-5*s,4.8*s,.7*s,[74,59,43]);
        for(let i=0;i<3;i++){
            const xx=x+(i-1)*2.5*s, yy=y-(9+Math.sin(t*2+i)*.35+(built?growth*3:0))*s;
            p.line(xx,y-5*s,xx,yy,[97,136,83],.4*s);
            p.ellipse(xx-1*s,yy+.7*s,1.5*s,.7*s,[153,184,105]);
            p.ellipse(xx+1*s,yy,1.3*s,.7*s,[126,163,90]);
        }
        if(growth>=1)berry(p,x,y-11*s,1.25*s);
    } else if(id==='bell'){
        p.line(x,y-17*s,x,y-9*s,[114,81,52],.45*s);
        p.arc(x,y-6.5*s,3.1*s,Math.PI,Math.PI,C.gold,1.6*s);
        p.poly([[x-2.3*s,y-7*s],[x+2.3*s,y-7*s],[x+3.1*s,y-4*s],[x-3.1*s,y-4*s]],C.gold);
        p.ellipse(x,y-4*s,3.2*s,.65*s,[173,116,57]);p.circle(x,y-3.5*s,.8*s,C.cream);
        p.line(x-1.1*s,y-7.8*s,x-.7*s,y-5*s,[255,224,147],.35*s);
    } else {
        p.line(x-9*s,y+1*s,x-9*s,y-11*s,[111,78,50],.65*s);
        p.line(x+9*s,y+1*s,x+9*s,y-11*s,[111,78,50],.65*s);
        p.poly([[x-9*s,y-9*s],[x-5*s,y-5*s],[x+5*s,y-5*s],[x+9*s,y-9*s],[x+6*s,y-1*s],[x-5*s,y-1*s]],[186,114,88]);
        p.poly([[x-6*s,y-6*s],[x+3*s,y-4.5*s],[x+5*s,y-1*s],[x-4*s,y-1*s]],[233,189,115]);
        for(let i=-2;i<4;i++)p.line(x+i*1.6*s,y-4*s,x+(i+1)*1.6*s,y-1.1*s,[141,92,70],.2*s);
    }
}
function home(p,g){
    const e=g.engine,s=e.save,t=g.clock,c=e.creature;
    p.image('rambler_home',0,0,160,90);
    p.rect(0,10.6,160,3,C.dark,.12);
    if(s.home.planter){furnish(p,'planter',45,64,t,true,s.planterGrowth/45);p.buttons.push({x:36,y:48,w:17,h:19,action:'use:planter'});}
    if(s.home.bell){
        furnish(p,'bell',104+(c.activity==='ringing'?Math.sin(t*12)*.6:0),37,t,true);
        p.buttons.push({x:98,y:19,w:12,h:20,action:'use:bell'});
    }
    if(s.home.hammock){furnish(p,'hammock',108,67,t,true);p.buttons.push({x:97,y:56,w:22,h:13,action:'use:hammock'});}
    const growth=e.getGrowth(),scale=2.6+Math.min(2,growth.stage)*.23;
    creature(p,c.x*1.6,c.y*.9,scale,t,{...c,coat:s.coat});
    p.buttons.push({x:c.x*1.6-9,y:c.y*.9-25,w:18,h:28,action:'pet'});
    // A ripe berry stays harvestable when Pip leans over the planter.
    if(s.home.planter&&s.planterGrowth>=45)p.buttons.push({x:41,y:49,w:8,h:8,action:'use:planter'});
    pill(p,s.name,c.x*1.6-9,66,18);
    for(let i=0;i<5;i++)p.circle(12+(i*23+t*1.2)%101,18+(i*9+t*.7)%35,.10+(i%2)*.06,C.gold,null,.4);
    panel(p,123,14,33,56);
    p.heading(s.name,126,21,4,C.ink);
    p.text(growth.label,126,27,1.7,C.rust);
    p.roundRect(126,32,27,1.1,.4,[199,188,153]);p.roundRect(126,32,Math.max(.7,27*growth.progress),1.1,.4,C.green);
    wrap(p,growth.next,126,35,26,1.4,C.ink,3);
    p.line(126,43,153,43,[185,171,135],.13);
    p.text('A LITTLE PROJECT',126,46,1.25,C.rust);
    const next=BUILDINGS.find(b=>!s.home[b.id]);
    if(next){p.heading(next.name,126,49.3,2,C.ink);wrap(p,next.description.replace(/Pip/g,s.name),126,53,25,1.4,C.ink,3);}
    else{p.heading('A place of our own',126,49.3,2,C.ink);wrap(p,'A berry patch, a tiny song, a place to dream.',126,53,25,1.4,C.ink,3);}
    p.button('Field notes',126,63,27,4.4,'journal',false,true);
    header(p,g,'');
    p.rect(0,73,160,17,C.dark,.97);
    p.text(e.message,80,75.1,1.65,C.cream,'center');
    p.button('Oat bites',4,80,27,6.4,'feed:staple',false,false);
    p.button('Berry  '+s.berries,34,80,27,6.4,'feed:berry',false,false);
    p.button('Pet '+s.name,64,80,27,6.4,'pet',false,false);
    p.button('Make a home',94,80,28,6.4,'builds',false,false);
    p.button('Go exploring',125,80,31,6.4,'outings',true,false);
    if(s.favoriteFound)p.text('Favorite!',47.5,87.5,1.05,C.muted,'center');
}
function terrain(p,platform,camera){
    const x=(platform.x-camera)*1.6,y=platform.y*.9,w=platform.w*1.6,h=platform.h*.9;
    if(x+w<0||x>160)return;
    p.roundRect(x,y,w,h+2,.8,[69,80,48]);p.roundRect(x,y,w,1.8,.8,[139,167,85]);
    p.line(x+.5,y+.3,x+w-.5,y+.3,[192,208,113],.28);
    for(let j=2;j<w;j+=5.6){if(x+j>0&&x+j<160)p.poly([[x+j,y+1.5],[x+j+1,y+3.3],[x+j+2.3,y+1.5]],[111,143,69]);}
}
function garden(p,g){
    const e=g.engine,a=e.garden,t=g.clock;
    p.image('rambler_garden',0,0,160,90);
    for(const platform of a.platforms)terrain(p,platform,a.camera);
    for(const item of a.items){
        const x=(item.x-a.camera)*1.6,y=item.y*.9+Math.sin(t*2+item.id)*.5;
        if(item.collected||x<1||x>159)continue;
        p.ellipse(x,y+1.9,1.3,.3,C.dark,.3);
        if(item.kind==='berry')berry(p,x,y,1.4);else seed(p,x,y,1.5);
    }
    const gateX=(a.exitX-a.camera)*1.6;
    if(gateX>-5&&gateX<166){
        p.line(gateX-3,70,gateX-3,48,[189,151,90],.8);
        p.poly([[gateX-3,48],[gateX+6,48],[gateX+4,53],[gateX-3,53]],C.rust);
        p.text('HOME',gateX+1,49.2,1.5,C.cream,'center');
    }
    creature(p,(a.player.x-a.camera)*1.6,a.player.y*.9,.89,t,
        {coat:e.save.coat,moving:Math.abs(a.player.vx)>1,facing:a.player.facing,activity:'idle'});
    header(p,g,'The giant garden  /  A little foraging adventure');
    pill(p,'Berries  '+a.rewards.berries,4,13,21);pill(p,'Seeds  '+a.rewards.seeds,27,13,20);
    pill(p,Math.ceil(a.timeLeft)+'s',131,13,12);
    p.rect(0,77,160,13,C.dark,.97);
    p.button('<',4,80,13,7,'left',false,false);p.button('>',19,80,13,7,'right',false,false);
    p.button('Hop',35,80,22,7,'jump',true,false);
    p.text('Arrows / A D to move · Space to hop',62,81,1.6,C.cream);
    p.text('Follow the leaves. Your discoveries come home.',62,84.5,1.35,C.muted);
    p.button('Head home',132,80,24,7,'finish',false,true);
}
function salvage(p,g){
    const e=g.engine,a=e.salvage,t=g.clock;
    p.image('rambler_lagoon',0,0,160,90);
    p.roundRect(7,19,146,50,4,C.dark,[161,181,128],.13);
    for(const b of a.bumpers){
        const x=b.x*1.6,y=b.y*.9,r=b.r*1.2;
        p.ellipse(x,y+1,r*1.3,r*.9,[37,80,71],.5);
        p.ellipse(x,y,r*1.2,r*.8,[95,139,87]);
        p.ellipse(x-.2,y-.3,r*1.05,r*.64,[148,174,107]);
        p.line(x,y,x+r*.7,y-r*.2,[195,203,132],.25);
        p.circle(x,y,r*.35,[205,154,86]);
    }
    for(const item of a.targets){
        if(item.collected)continue;
        const x=item.x*1.6,y=item.y*.9+Math.sin(t*2+item.id)*.35;
        p.ellipse(x,y+2,3.5,1,[167,202,173],.25);
        scrap(p,x,y,item.value===2?2.1:1.6);
        if(item.value===2)p.star(x+1.4,y-1.6,.6,C.cream);
    }
    for(let i=0;i<(a.trail||[]).length;i++){
        const v=a.trail[i];p.circle(v.x*1.6,v.y*.9,.25+(i/a.trail.length)*.45,C.cream,null,.12+i/a.trail.length*.4);
    }
    if(!a.ball.active){
        const vx=g.aim.vx,vy=g.aim.vy;
        for(let i=1;i<17;i++){
            const dt=i*.045,x=50+vx*dt,y=72+vy*dt+17.5*dt*dt;
            if(x<5||x>95||y<20||y>77)break;
            p.circle(x*1.6,y*.9,.20+i*.025,C.cream,null,.75-i*.025);
        }
        creature(p,67,76,1.15,t,{coat:e.save.coat});
    }
    const bx=a.ball.x*1.6,by=a.ball.y*.9;
    p.circle(bx,by,2.2,C.dark);p.arc(bx,by,1.6,0,Math.PI*1.65,[205,109,83],.9);
    p.circle(bx+1.3,by-.5,.6,C.cream);p.circle(bx+.5,by-1.4,.6,C.cream);
    header(p,g,'The junk lagoon  /  Cast a magnet. Find a little treasure.');
    pill(p,'Scrap  '+a.rewards.scrap,4,13,21);pill(p,'Casts left  '+a.shotsLeft,27,13,23);
    p.rect(0,78,160,12,C.dark,.97);
    p.button('<',4,81,11,6,'aim:left');p.button('>',17,81,11,6,'aim:right');
    p.button(a.ball.active?'In the water…':'Cast magnet',31,81,31,6,'cast',!a.ball.active,false);
    p.text('Drag from the magnet, then release.',67,81,1.65,C.cream);
    p.text('Or aim with arrows and cast with Space.',67,84.5,1.35,C.muted);
    p.button('Head home',132,81,24,6,'finish',false,true);
}
function curtain(p){p.rect(0,0,160,90,C.dark,.76);}
function outings(p,g){
    curtain(p);panel(p,15,15,130,61);
    p.heading('A little farther from home',80,19,4.4,C.ink,'center');
    p.text('Pick an adventure. Bring something back for '+g.engine.save.name+'.',80,26,1.8,C.ink,'center');
    const cards=[{x:21,key:'garden',title:'The giant garden',sub:'Run, hop, and forage',line:'Sweet berries. Seeds for your windowsill.',image:'rambler_garden'},
        {x:83,key:'salvage',title:'The junk lagoon',sub:'Aim, bounce, and discover',line:'Little treasures for a better home.',image:'rambler_lagoon'}];
    for(const c of cards){
        p.image(c.image,c.x,32,56,23);
        p.rect(c.x,49,56,6,C.dark,.85);p.heading(c.title,c.x+28,50,2.7,C.cream,'center');
        p.text(c.sub,c.x+28,57,1.75,C.ink,'center');p.text(c.line,c.x+28,61,1.35,C.ink,'center');
        p.button('Let\'s go',c.x+9,65,38,6,'start:'+c.key,true,false);
    }
    p.button('Back',67,80,26,5,'close',false,true);
}
function builds(p,g){
    curtain(p);panel(p,11,13,138,64);
    p.heading('Make this place ours',80,17,4.4,C.ink,'center');
    p.text('Things to grow, things to play with, somewhere to dream.',80,24,1.75,C.ink,'center');
    BUILDINGS.forEach((b,i)=>{
        const x=17+i*44,s=g.engine.save,owned=s.home[b.id],can=s.seeds>=b.cost.seeds&&s.scrap>=b.cost.scrap;
        p.roundRect(x,30,39,42,2,[247,235,204],[201,184,140]);
        furnish(p,b.id,x+19.5,45,g.clock,owned,s.planterGrowth/45,true);
        p.heading(b.name,x+19.5,48,2.1,C.ink,'center');
        wrap(p,b.description.replace(/Pip/g,s.name),x+3,52,29,1.4,C.ink,3);
        const cost=[b.cost.seeds?b.cost.seeds+' seeds':'',b.cost.scrap?b.cost.scrap+' scrap':''].filter(Boolean).join(' + ');
        p.text(owned?'Made with love':cost,x+19.5,62,1.4,C.rust,'center');
        p.button(owned?'Try it':can?'Make it':'Find materials',x+3,65,33,5,owned?'use:'+b.id:can?'build:'+b.id:'outings',can,false);
    });
    p.button('Back home',65,80,30,5,'close',false,true);
}
function journal(p,g){
    curtain(p);panel(p,29,10,102,70);
    p.text('OUR FIRST CHAPTER',35,15,1.35,C.rust);
    p.heading('Small things, remembered',35,19,4,C.ink);
    g.engine.getMilestones().forEach((m,i)=>{
        const y=28+i*7.8;p.circle(37,y+1.2,1.25,m.complete?C.green:[195,184,148]);
        if(m.complete)p.text('+',37,y-.1,1.8,C.cream,'center');
        p.heading(m.label,41,y,2,C.ink);p.text(m.text,41,y+3.1,1.45,[95,114,92]);
    });
    p.button('Name & colors',36,70,35,5,'custom',false,true);
    p.button(g.sound?'Sound on':'Sound off',76,70,31,5,'sound',false,true);
    p.button('Back home',65,83,30,5,'close',false,true);
}
function custom(p,g){
    curtain(p);panel(p,34,15,92,63);
    p.heading('One of a kind',80,20,4.5,C.ink,'center');
    creature(p,59,59,2.6,g.clock,{coat:g.engine.save.coat});
    p.text('A NAME FOR YOUR FRIEND',79,31,1.35,C.rust);
    p.roundRect(79,36,39,7,1,[255,244,216],C.green);
    p.heading(g.nameDraft+(Math.floor(g.clock*2)%2?'|':''),81,37.3,2.7,C.ink);
    p.text('Type a name · up to 16 letters',79,45,1.2,C.ink);
    ['moss','peach','lilac'].forEach((coat,i)=>{
        const x=82+i*13;p.circle(x,54,4,COATS[coat][1],g.engine.save.coat===coat?C.ink:null);
        p.buttons.push({x:x-5,y:49,w:10,h:11,action:'coat:'+coat});
    });
    p.button('Keep this little friend',49,65,62,7,'name:save',true,false);
    p.text('On a phone, tap the name box to use the keyboard.',80,74,1.35,C.ink,'center');
    p.buttons.push({x:79,y:36,w:39,h:8,action:'name:input'});
}
function result(p,g){
    const r=g.engine.result||{},s=g.engine.save;
    p.image(r.kind==='garden'?'rambler_garden':'rambler_lagoon',0,0,160,90);curtain(p);panel(p,28,13,104,65);
    p.text('BACK FROM A LITTLE ADVENTURE',80,18,1.35,C.rust,'center');
    p.heading(r.title||'Homeward bound',80,23,4,C.ink,'center');
    p.text(r.text||'',80,30,1.6,C.ink,'center');
    const rewards=r.rewards||{};const items=[['berries',berry,'berries'],['seeds',seed,'seeds'],['scrap',scrap,'scrap']];
    items.forEach(([key,draw,label],i)=>{
        const x=53+i*27;draw(p,x,41,2.8);p.heading('+'+(rewards[key]||0),x,46,3.4,C.ink,'center');p.text(label,x,51,1.5,C.ink,'center');
    });
    (r.milestones||[]).slice(0,2).forEach((m,i)=>p.text(m,80,56+i*3,1.5,C.rust,'center'));
    p.button('Take our finds home',47,66,66,7,'home',true,false);
    p.text(g.saveStatus==='unavailable'?'Saving is unavailable. Keep this window open to keep playing.':'Your discoveries are safely back in the house.',80,81,1.5,C.cream,'center');
}
function welcome(p,g){
    curtain(p);panel(p,24,16,112,60);

    creature(p,80,56,2.8,g.clock,{coat:g.engine.save.coat});

    p.button('Hello, Pip',53,64,54,7,'welcome:done',true,false);
    p.text('Progress saves automatically. Your friend is safe while you are away.',80,81,1.6,C.cream,'center');
}
function render(p,g){
    p.begin();p.focusAction=g.focusAction||'';p.hoverAction=g.hoverAction||'';
    const mode=g.engine.mode;
    if(mode==='garden')garden(p,g);else if(mode==='salvage')salvage(p,g);else if(mode==='result')result(p,g);else home(p,g);
    if(g.overlay){
        p.buttons=[];
        const screens={welcome,outings,builds,journal,custom};
        if(screens[g.overlay])screens[g.overlay](p,g);
    }
    if(g.paused){curtain(p);panel(p,47,28,66,31);p.heading('A little breather',80,34,4,C.ink,'center');
        p.buttons=[];p.button('Keep exploring',59,46,42,7,'resume',true,false);}
    p.end();
}
module.exports={render};
