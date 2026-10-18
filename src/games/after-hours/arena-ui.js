'use strict';
const { MAPS, createWorld } = require('./world');
const { MODES } = require('./engine');
const INK='#ece7db', GOLD='#e3b968', MUTED='#9aabb0', PANEL='#101b24';
const TEAM_COLORS={amber:'#ffc36b',cyan:'#72ddf6'};
const MAP_CARDS=()=>MAPS.map((map,i)=>({map,x:5+i*18.2,y:27,w:17.2,h:25}));
const MODE_CARDS=()=>MODES.map((mode,i)=>({mode,x:5+i*30.4,y:56,w:29.4,h:12}));
const READY_BUTTON={x:68,y:73,w:27.5,h:6};
const previews=new Map();
function preview(id) {
    if(previews.has(id))return previews.get(id);
    const world=createWorld(id),rects=[];let previous=new Map();
    for(let y=0;y<world.height;y++){
        const next=new Map();
        for(let x=0;x<world.width;x++){
            if(!world.cells[y][x])continue;
            const start=x;while(x+1<world.width&&world.cells[y][x+1])x++;
            const w=x-start+1,key=start+':'+w;
            let r=previous.get(key);if(r)r.h++;else{r={x:start,y,w,h:1};rects.push(r);}next.set(key,r);
        }
        previous=next;
    }
    const result={rects,width:world.width,height:world.height};previews.set(id,result);return result;
}
function drawLobby(s,e,view,p) {
    const own=e.votes[p.id]||{},selection=e.lobbySelection||{},votes=Object.values(e.votes);
    s.rect('lobby-shade',0,10,100,74,'#071018',235);
    s.rect('lobby-panel',3,13,94,68,PANEL);
    s.rect('lobby-edge',3,13,94,.35,GOLD);
    s.text('lobby-kicker',e.round.winner?'ROUND '+e.round.number+' COMPLETE  /  '+e.round.winner:'THE AFTER HOURS ARENA TOUR',5,16,1,GOLD);
    s.text('lobby-title','CHOOSE YOUR NEXT NIGHT',5,19.3,2.8,INK);
    s.text('lobby-timer',String(Math.ceil(e.round.intermission)).padStart(2,'0'),94,16,3.6,GOLD,'right');
    s.text('lobby-timer-label','SECONDS TO GO',94,24,.65,MUTED,'right');
    for(const {map,x,y,w,h} of MAP_CARDS()){
        const key='lobby-map-'+map.id,selected=own.mapId===map.id,leading=selection.mapId===map.id;
        const col=map.palette.accent,mini=preview(map.id),scale=Math.min((w-2)/mini.width,13/mini.height);
        s.rect(key+'border',x,y,w,h,selected?col:'#293744');
        s.rect(key+'bg',x+.18,y+.25,w-.36,h-.5,selected?'#22323c':'#14232d');
        const ox=x+(w-mini.width*scale)/2,oy=y+1;
        s.rect(key+'floor',ox,oy,mini.width*scale,mini.height*scale,map.palette.floor);
        mini.rects.forEach((r,i)=>s.rect(key+'wall'+i,ox+r.x*scale,oy+r.y*scale,r.w*scale+.015,r.h*scale+.015,col));
        s.text(key+'name',map.name.toUpperCase(),x+w/2,y+15,map.id==='museum'?.86:1.03,INK,'center');
        s.text(key+'sub',map.subtitle,x+w/2,y+18,.66,MUTED,'center');
        const count=votes.filter(v=>v.mapId===map.id).length;
        s.text(key+'votes',(selected?'YOUR VOTE  /  ':'')+count+' VOTE'+(count===1?'':'S'),x+w/2,y+21,.65,selected?col:MUTED,'center');
        if(leading)s.rect(key+'leading',x+.2,y+h-.65,w-.4,.4,col);
    }
    s.text('lobby-mode-label','CHOOSE THE RULES',5,53.5,.75,GOLD);
    const descriptions={ffa:'Every visitor for themselves. First to '+e.targetScore+'.',ctf:'Steal their flag. Bring it home. First to '+e.captureTarget+'.',domination:'Hold A, B and C. First team to '+e.dominationTarget+'.'};
    for(const {mode,x,y,w,h} of MODE_CARDS()){
        const key='lobby-mode-'+mode.id,selected=own.mode===mode.id;
        s.rect(key+'edge',x,y,w,h,selected?GOLD:'#293744');s.rect(key+'bg',x+.18,y+.25,w-.36,h-.5,selected?'#30332f':'#14232d');
        if(selection.mode===mode.id)s.rect(key+'leading',x+.2,y+h-.65,w-.4,.4,GOLD);
        s.text(key+'name',mode.name.toUpperCase(),x+1,y+1.4,1.2,INK);
        s.text(key+'desc',descriptions[mode.id],x+1,y+4.5,.67,MUTED);
        const count=votes.filter(v=>v.mode===mode.id).length;
        s.text(key+'votes',(selected?'YOUR VOTE  /  ':'')+count+' VOTE'+(count===1?'':'S'),x+1,y+8,.65,selected?GOLD:MUTED);
    }
    const humans=[...e.players.values()].filter(v=>!v.bot),ready=humans.filter(v=>e.ready[v.id]).length;
    s.text('lobby-ready-count',ready+' / '+humans.length+' PLAYERS READY',5,72.5,1,INK);
    s.text('lobby-hint','Click a map and mode. All ready starts early. Votes can change.',5,76,.76,MUTED);
    const b=READY_BUTTON;s.rect('lobby-ready',b.x,b.y,b.w,b.h,e.ready[p.id]?'#29484b':GOLD);
    s.text('lobby-ready-text',e.ready[p.id]?'READY  /  CLICK TO WAIT':'READY UP  >',b.x+b.w/2,b.y+1.5,1.2,e.ready[p.id]?INK:PANEL,'center');
}
function drawObjectiveHUD(s,e,p) {
    if(e.mode==='ffa')return;
    const score=e.teamScores;
    s.rect('team-score-bg',33,10.5,34,8,'#101b24',230);
    s.text('team-score-amber','AMBER '+Math.floor(score.amber),35,11.5,1.15,TEAM_COLORS.amber);
    s.text('team-score-cyan',Math.floor(score.cyan)+' CYAN',65,11.5,1.15,TEAM_COLORS.cyan,'right');
    s.text('your-team','YOU: '+(p.team||'').toUpperCase(),50,15,.67,TEAM_COLORS[p.team]||INK,'center');
    if(e.mode==='ctf'){
        const flag=e.flags[p.team],enemy=e.flags[p.team==='amber'?'cyan':'amber'];
        const message=p.carryingFlag?'FLAG TAKEN — RETURN TO YOUR BASE':!flag.atBase?'RECOVER YOUR FLAG':enemy.carrierId?'ESCORT YOUR FLAG CARRIER':'STEAL THE ENEMY FLAG';
        s.text('objective-hint',message,50,20,.86,p.carryingFlag?GOLD:INK,'center');
    }else for(const [i,point] of e.controlPoints.entries()){
        const x=39+i*8,col=TEAM_COLORS[point.owner]||MUTED;
        s.rect('control-'+point.id,x,19.3,6,4,'#101b24',230);
        s.text('control-name-'+point.id,point.id+(point.contested?' !':''),x+3,19.8,1,col,'center');
        s.rect('control-bar-'+point.id,x,23,6*(point.capturingTeam?point.progress:point.owner?1:0),.35,TEAM_COLORS[point.capturingTeam]||col);
    }
}
module.exports={MAP_CARDS,MODE_CARDS,READY_BUTTON,TEAM_COLORS,drawLobby,drawObjectiveHUD};
