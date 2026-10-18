'use strict';
const { TEAM_COLORS }=require('./arena-ui');
// World props are ordinary projected Squish geometry. The caller performs the
// same camera/wall culling used for players before any of these nodes exist.
function drawLandmark(s,o,x,y,w,h,clip,time) {
    const key=o.id,col=o.data.color||'#a4b7bc',dark='#16252e',light='#e5e3d7';
    const r=(id,xx,yy,ww,hh,c,a=255)=>s.rect(key+id,x+xx*w,y+yy*h,ww*w,hh*h,c,a,clip);
    const p=(id,pts,c)=>s.poly(key+id,pts.map(([xx,yy])=>[x+xx*w,y+yy*h]),c,255,clip);
    const label=(text,yy,c=light)=>{
        if(o.depth<24&&w>3&&clip[1]<y+yy*h&&y+yy*h+Math.min(1.4,w*.11)<clip[3]&&clip[0]<=x&&clip[2]>=x+w)
            s.text(key+'label',text,x+w/2,y+yy*h,Math.min(1.4,w*.11),c,'center');
    };
    switch(o.data.type){
    case 'fridge':
        r('body',0,0,1,1,col);r('edge',.9,0,.1,1,'#afc4bb');r('seam',.02,.3,.88,.018,dark);
        r('freezer',.13,.12,.07,.12,light);r('handle',.13,.38,.07,.31,light);
        r('magnet',.47,.15,.13,.06,'#efb357');r('note',.49,.48,.25,.2,'#f7e7b1');
        r('note-line',.53,.53,.17,.015,'#ba694e');r('note-line2',.53,.58,.14,.015,'#ba694e');label('MIDNIGHT SNACKS',.77,dark);break;
    case 'stove':
        r('body',0,0,1,1,'#d6d8c7');r('top',0,0,1,.2,dark);
        for(let i=0;i<4;i++){r('knob'+i,.12+i*.22,.06,.1,.06,col);}
        r('door',.08,.28,.84,.65,dark);r('window',.17,.43,.66,.39,'#633625');r('heat',.23,.6,.54,.05,'#ec8b46');
        r('handle',.13,.32,.74,.045,light);label('CAUTION / HOT',.82,'#ffc977');break;
    case 'sink':
        r('counter',0,.48,1,.16,light);r('basin',.11,.5,.74,.11,'#54888e');r('cabinet',.06,.64,.88,.36,col);
        r('seam',.49,.66,.018,.34,dark);r('handle1',.4,.7,.05,.14,light);r('handle2',.55,.7,.05,.14,light);
        p('tap',[[.4,.48],[.4,.11],[.47,.04],[.7,.04],[.76,.1],[.76,.24],[.67,.24],[.67,.13],[.49,.13],[.49,.48]],'#a6c9cb');break;
    case 'cereal':
        r('box',0,0,1,1,col);r('side',.87,0,.13,1,'#a74b33');r('band',0,.1,.87,.29,'#ffe6a0');
        label('SQUISH FLAKES',.19,dark);p('bowl',[[.12,.68],[.76,.68],[.67,.85],[.22,.85]],'#e4f5d8');
        for(let i=0;i<7;i++)r('flake'+i,.17+(i%4)*.14,.59-Math.floor(i/4)*.09,.085,.04,'#ffca52');
        r('stripe',.08,.91,.7,.018,'#ffe6a0');break;
    case 'table':case 'island':
        r('top',0,.04,1,.15,col);r('lip',0,.19,1,.05,'#dcad78');
        r('leg1',.06,.24,.13,.76,'#875b48');r('leg2',.81,.24,.13,.76,'#875b48');
        if(o.data.type==='island'){r('cabinet',.18,.24,.64,.67,'#a7be94');r('seam',.49,.24,.018,.67,dark);r('handle1',.38,.32,.05,.1,light);r('handle2',.56,.32,.05,.1,light);}break;
    case 'chair':
        r('back1',.08,0,.12,.59,col);r('back2',.8,0,.12,.59,col);r('back',.08,.06,.84,.12,col);
        r('seat',0,.5,1,.12,'#bf8860');r('leg1',.09,.62,.12,.38,col);r('leg2',.79,.62,.12,.38,col);break;
    case 'billboard':
        r('post',.46,.56,.08,.44,dark);r('border',0,0,1,.7,col);r('screen',.025,.03,.95,.64,'#17213b');
        p('bolt',[[.57,.09],[.27,.39],[.48,.39],[.36,.6],[.78,.27],[.55,.27]],'#f578ce');
        r('light',.06,.61,.87,.025,col);label('NEON / AFTER DARK',.47);break;
    case 'hvac':
        r('case',0,.1,1,.9,col);r('face',.1,.22,.8,.66,dark);
        for(let i=0;i<6;i++)r('vent'+i,.16,.28+i*.095,.68,.03,'#607388');
        r('rim',0,.05,1,.07,'#aeb8bc');break;
    case 'antenna':
        r('mast',.46,0,.08,1,col);r('bar1',.08,.18,.84,.04,col);r('bar2',.22,.38,.56,.035,col);
        r('beacon',.43,.015,.14,.045,Math.sin(time*3)>0?'#ff6574':'#613346');p('base',[[.5,.53],[.08,1],[.21,1],[.5,.7],[.79,1],[.92,1]],dark);break;
    case 'furnace':
        r('body',0,0,1,1,col);r('lip',0,.03,1,.08,'#8a8273');r('opening',.12,.23,.76,.58,dark);
        r('fire',.19,.43,.62,.31,'#ee7034');p('flame',[[.2,.69],[.34,.29],[.43,.54],[.6,.25],[.8,.69]],'#ffbc50');
        for(let i=0;i<4;i++)r('grate'+i,.23+i*.17,.26,.045,.53,'#483f3b');r('base',0,.91,1,.09,dark);break;
    case 'conveyor':
        r('legs',.06,.5,.12,.5,dark);r('legs2',.82,.5,.12,.5,dark);r('belt',0,.3,1,.3,col);
        for(let i=0;i<7;i++)r('roller'+i,.035+i*.14,.34,.045,.21,'#323b40');r('cargo',.35,0,.27,.3,'#b48a4e');break;
    case 'gantry':
        r('leg1',.02,0,.09,1,col);r('leg2',.89,0,.09,1,col);r('beam',0,.07,1,.12,col);
        for(let i=0;i<4;i++)p('brace'+i,[[i*.22,.09],[i*.22+.2,.3],[i*.22+.22,.27],[i*.22+.02,.07]],dark);
        r('hook',.49,.17,.018,.42,dark);r('hook-bottom',.42,.56,.09,.05,col);break;
    case 'cryopod':
        p('pod',[[.13,0],[.87,0],[1,.1],[1,.89],[.87,1],[.13,1],[0,.89],[0,.1]],col);
        r('glass',.14,.12,.72,.7,'#246276');r('person',.38,.29,.24,.42,'#6aafb7');r('head',.4,.19,.2,.13,'#9ee4df');
        r('light',.21,.89,.58,.025,'#a1f6dd');r('glint',.19,.16,.04,.62,'#72dfed');break;
    case 'reactor':
        r('base',.1,.87,.8,.13,dark);p('shell',[[.2,0],[.8,0],[1,.2],[1,.79],[.8,1],[.2,1],[0,.79],[0,.2]],col);
        r('core',.25,.15,.5,.71,'#195966');r('energy',.41,.2,.18,.6,'#a6fff3');
        for(let i=0;i<3;i++)r('ring'+i,.05,.23+i*.22,.9,.065,dark);label('ZERO POINT',.79);break;
    case 'airlock':
        r('frame',0,0,1,1,col);r('door',.13,.09,.74,.84,dark);r('seam',.49,.1,.025,.83,'#82dce4');
        r('panel',.68,.42,.1,.14,'#8dffd6');r('window',.22,.2,.55,.13,'#367a8c');label('AIRLOCK',.7);break;
    default:
        r('crate',0,0,1,1,col);r('band1',.1,0,.09,1,dark);r('band2',.81,0,.09,1,dark);r('band3',0,.11,1,.08,dark);r('band4',0,.81,1,.08,dark);
    }
}
function drawObjective(s,o,x,y,w,h,clip,time) {
    const data=o.data,col=TEAM_COLORS[data.team||data.owner]||'#abbcc5',key=o.id;
    if(o.type==='flag'){
        s.rect(key+'base',x,y+h*.94,w,h*.06,'#293d48',255,clip);
        s.rect(key+'pole',x+w*.2,y,w*.055,h,'#e4e6d8',255,clip);
        const wave=Math.sin(time*4)*h*.035;
        s.poly(key+'cloth',[[x+w*.26,y],[x+w,y+wave],[x+w*.89,y+h*.29+wave],[x+w*.26,y+h*.3]],col,255,clip);
        s.rect(key+'stripe',x+w*.31,y+h*.05,w*.1,h*.19,'#f3f0e6',255,clip);
    }else{
        s.poly(key+'base',[[x,y+h*.94],[x+w*.5,y+h*.8],[x+w,y+h*.94],[x+w*.5,y+h]],col,200,clip);
        s.rect(key+'beam',x+w*.4,y+h*.17,w*.2,h*.68,col,90,clip);
        s.poly(key+'diamond',[[x+w*.5,y],[x+w*.86,y+h*.14],[x+w*.5,y+h*.28],[x+w*.14,y+h*.14]],col,255,clip);
        if(o.depth<20&&x>=clip[0]&&x+w<=clip[2]&&y>clip[1]&&y+h*.1<clip[3])s.text(key+'letter',data.id,x+w*.5,y+h*.05,Math.min(2,w*.28),'#101b24','center');
    }
}
module.exports={drawLandmark,drawObjective};
