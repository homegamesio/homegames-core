'use strict';
// Game-local projection, composed entirely from existing Squish nodes/crops.
const { GameNode, Shapes, ShapeUtils } = require('squish-150');
const { EYE_HEIGHT, BODY_HEIGHT, HEAD_HEIGHT, TORSO_HEIGHT, CEILING_HEIGHT, WEAPON_ORDER } = require('./engine');
const { renderGun } = require('./weapons-render');
const { drawLobby, drawObjectiveHUD, TEAM_COLORS } = require('./arena-ui');
const { drawLandmark, drawObjective } = require('./arena-objects');
const COLS = 80, FOV = .76, HORIZON = 47, PROJ = 50 / FOV, VPROJ = PROJ * 16 / 9;
const TOP = 10, BOTTOM = 84, EYE = EYE_HEIGHT, WALL_HEIGHT = CEILING_HEIGHT;
const WHITE = [255,255,255,255], INK = [236,231,219,255], GOLD = [227,185,104,255];
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const rgba = c => typeof c==='string' ? [parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16),255] : c;
const tint = (c,k) => { c=rgba(c);return [Math.round(clamp(c[0]*k,0,255)),Math.round(clamp(c[1]*k,0,255)),Math.round(clamp(c[2]*k,0,255)),255]; };
const container = playerId => new GameNode.Shape({ shapeType:Shapes.POLYGON,coordinates2d:ShapeUtils.rectangle(0,0,0,0),playerIds:playerId===undefined?[]:[playerId] });

// Keep node IDs stable while visible. Detach off-camera content, don't serialize
// invisible pools for every object in the museum. Root's audience is inherited.
class Scene {
    constructor(root) { this.root=root;this.nodes=new Map(); }
    begin() { this.order=[];this.used=new Set(); }
    node(key,kind,fields) {
        let item=this.nodes.get(key);
        if(!item){ item=kind==='text'?new GameNode.Text({textInfo:fields.text}):kind==='asset'?new GameNode.Asset({assetInfo:fields.asset,color:WHITE}):new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:[],fill:WHITE,color:WHITE});this.nodes.set(key,item);this.root.addChild(item,false); }
        Object.assign(item.node,fields);this.order.push(item);this.used.add(key);return item;
    }
    rect(key,x,y,w,h,color,alpha=255,bounds=[0,0,100,100]) {
        const x1=Math.max(bounds[0],x),y1=Math.max(bounds[1],y),x2=Math.min(bounds[2],x+w),y2=Math.min(bounds[3],y+h);
        if(x2<=x1||y2<=y1)return;
        return this.node(key,'shape',{coordinates2d:ShapeUtils.rectangle(x1,y1,x2-x1,y2-y1),fill:rgba(color),color:[255,255,255,alpha]});
    }
    poly(key,points,color,alpha=255,bounds=[0,0,100,100]) {
        let out=points;
        for(const [axis,edge,sign] of [[0,bounds[0],1],[0,bounds[2],-1],[1,bounds[1],1],[1,bounds[3],-1]]) {
            const src=out;out=[];if(!src.length)break;
            for(let i=0;i<src.length;i++){const a=src[i],b=src[(i+1)%src.length],ai=(a[axis]-edge)*sign>=0,bi=(b[axis]-edge)*sign>=0;
                if(ai)out.push(a);if(ai!==bi){const t=(edge-a[axis])/(b[axis]-a[axis]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}
        }
        if(out.length<3)return;
        return this.node(key,'shape',{coordinates2d:out,fill:rgba(color),color:[255,255,255,alpha]});
    }
    text(key,text,x,y,size,color=INK,align='left',font='sans-serif') {
        return this.node(key,'text',{text:{text:String(text).slice(0,120),x,y,size,color:rgba(color),align,font}});
    }
    image(key,asset,x,y,w,h,crops={},bounds=[0,TOP,100,BOTTOM]) {
        const l=Math.max(bounds[0],x),t=Math.max(bounds[1],y),r=Math.min(bounds[2],x+w),b=Math.min(bounds[3],y+h);
        if(r<=l||b<=t||w<=0||h<=0)return;
        const sl=crops.left||0,sr=crops.right||0,st=crops.top||0,sb=crops.bottom||0;
        return this.node(key,'asset',{color:WHITE,asset:{[asset]:{pos:{x:l,y:t},size:{x:r-l,y:b-t},startTime:0,
            cropLeft:sl+(100-sl-sr)*(l-x)/w,cropRight:sr+(100-sl-sr)*(x+w-r)/w,
            cropTop:st+(100-st-sb)*(t-y)/h,cropBottom:sb+(100-st-sb)*(y+h-b)/h}}});
    }
    end() {
        for(const [key,item] of this.nodes){if(!this.used.has(key)){this.root.removeChild(item.id,false);this.nodes.delete(key);}}
        // Reorder existing children for depth sorting; their IDs/listeners survive.
        this.root.node.children=this.order;
    }
}
function project(p,x,y,z=0) {
    const dx=x-p.x,dy=y-p.y,cos=Math.cos(p.angle),sin=Math.sin(p.angle),depth=cos*dx+sin*dy;
    // A pitched 2.5D camera: the center ray and authoritative aim share the
    // same height/slope. Jumping raises the eye independently of look pitch.
    return {x:50+(-sin*dx+cos*dy)*PROJ/depth,y:HORIZON+Math.tan(p.pitch||0)*VPROJ+(EYE+(p.z||0)-z)*VPROJ/depth,depth};
}
function line(s,key,a,b,color,width=.07) {
    const dx=b.x-a.x,dy=b.y-a.y,n=Math.hypot(dx,dy)||1,ox=-dy/n*width,oy=dx/n*width;
    s.poly(key,[[a.x+ox,a.y+oy],[b.x+ox,b.y+oy],[b.x-ox,b.y-oy],[a.x-ox,a.y-oy]],color,255,[0,TOP,100,BOTTOM]);
}
function gridLine(s,key,p,a,b,color) {
    let pa=project(p,a[0],a[1]),pb=project(p,b[0],b[1]);
    if(pa.depth<.3&&pb.depth<.3)return;
    if(pa.depth<.3){const t=(.3-pa.depth)/(pb.depth-pa.depth);a=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];pa=project(p,...a);}
    if(pb.depth<.3){const t=(.3-pb.depth)/(pa.depth-pb.depth);b=[b[0]+(a[0]-b[0])*t,b[1]+(a[1]-b[1])*t];pb=project(p,...b);}
    line(s,key,pa,pb,color);
}
function paintingAt(world,hit) {
    for(const e of world.exhibits){
        const along=e.axis==='x'?hit.x-e.x:hit.y-e.y,plane=e.axis==='x'?hit.y-e.y:hit.x-e.x;
        if(Math.abs(plane)>.025||along<0||along>e.length)continue;
        let u=along/e.length;
        if((e.axis==='x'&&e.face<0)||(e.axis==='y'&&e.face>0))u=1-u;
        return {e,u};
    }
    return null;
}
function span(depths,x,w,depth) {
    const left=Math.max(0,x),right=Math.min(100,x+w);if(right<=left)return null;
    const start=Math.max(0,Math.floor(left*COLS/100)),end=Math.min(COLS-1,Math.ceil(right*COLS/100)-1);
    let run=null,best=null;
    for(let c=start;c<=end+1;c++){
        const visible=c<=end&&depth<depths[c]+.04;
        if(visible&&run===null)run=c;
        if(!visible&&run!==null){const candidate=[Math.max(left,run*100/COLS),Math.min(right,c*100/COLS)];if(!best||candidate[1]-candidate[0]>best[1]-best[0])best=candidate;run=null;}
    }
    return best;
}
function polygon(n,cx,cy,rx,ry,angle=0){return Array.from({length:n},(_,i)=>[cx+Math.cos(angle+i*Math.PI*2/n)*rx,cy+Math.sin(angle+i*Math.PI*2/n)*ry]);}

// Clip beams against the same per-column wall depths as actors. Adjacent visible
// spans coalesce, so a long rail trail normally costs one existing Squish node.
function beam(s,key,p,depths,from,to,color,width) {
    let a=project(p,from.x,from.y,from.z),b=project(p,to.x,to.y,to.z);
    if(a.depth<.2&&b.depth<.2)return;
    if(a.depth<.2){const t=(.2-a.depth)/(b.depth-a.depth);a=project(p,from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t,from.z+(to.z-from.z)*t);}
    if(b.depth<.2){const t=(.2-b.depth)/(a.depth-b.depth);b=project(p,to.x+(from.x-to.x)*t,to.y+(from.y-to.y)*t,to.z+(from.z-to.z)*t);}
    if(a.x>b.x)[a,b]=[b,a];
    const invA=1/a.depth,slope=1/b.depth-invA,dx=b.x-a.x;
    const point=t=>({x:a.x+dx*t,y:a.y+(b.y-a.y)*t});
    const intervals=[];
    const add=(lo,hi,depth)=>{
        const threshold=1/Math.max(.12,depth-.025);
        if(Math.abs(slope)<1e-10){if(invA<threshold)return;}
        else if(slope>0)lo=Math.max(lo,(threshold-invA)/slope);
        else hi=Math.min(hi,(threshold-invA)/slope);
        if(hi<=lo)return;
        const last=intervals[intervals.length-1];
        if(last&&Math.abs(last[1]-lo)<1e-6)last[1]=hi;else intervals.push([lo,hi]);
    };
    if(dx<.001){if(a.x<0||a.x>=100)return;add(0,1,depths[Math.floor(a.x*COLS/100)]);}
    else for(let c=Math.max(0,Math.floor(a.x*COLS/100));c<=Math.min(COLS-1,Math.floor(b.x*COLS/100));c++){
        add(Math.max(0,(c*100/COLS-a.x)/dx),Math.min(1,((c+1)*100/COLS-a.x)/dx),depths[c]);
    }
    intervals.forEach(([lo,hi],i)=>line(s,key+'-'+i,point(lo),point(hi),color,width));
}
function renderTracers(s,p,depths,effects) {
    for(const effect of effects.filter(e=>e.type==='tracer').slice(-24)){
        const fade=clamp(1-effect.age/effect.life,0,1),color=rgba(effect.color||GOLD);
        color[3]=Math.round(255*fade);
        beam(s,'effect'+effect.id,p,depths,effect,{x:effect.endX,y:effect.endY,z:effect.endZ},color,effect.weapon==='rail'?.16:.055);
    }
}

const sameColor=(a,b)=>a.every((value,index)=>value===b[index]);
const samePlane=(a,b)=>a.hit.side===b.hit.side&&Math.abs((a.hit.side===0?a.hit.x:a.hit.y)-(b.hit.side===0?b.hit.x:b.hit.y))<.00001;
function planeDepth(column,p,x) {
    const camera=(x/50-1)*FOV,cos=Math.cos(p.angle),sin=Math.sin(p.angle);
    const distance=column.hit.side===0?(column.hit.x-p.x)/(cos-sin*camera):(column.hit.y-p.y)/(sin+cos*camera);
    return Math.max(.12,distance);
}
function planePanel(s,key,p,first,last,color,topZ,bottomZ,bounds) {
    const left=first.c*100/COLS,right=(last.c+1)*100/COLS+.055;
    const leftDepth=planeDepth(first,p,left),rightDepth=planeDepth(last,p,right);
    const y=(z,depth)=>HORIZON+Math.tan(p.pitch||0)*VPROJ+(EYE+(p.z||0)-z)*VPROJ/depth;
    s.poly(key,[[left,y(topZ,leftDepth)],[right,y(topZ,rightDepth)],
        [right,y(bottomZ,rightDepth)],[left,y(bottomZ,leftDepth)]],color,255,bounds);
}
function wallPanels(s,p,columns,property,topZ,bottomZ,bounds) {
    for(let start=0;start<columns.length;){
        const first=columns[start];let end=start;
        // Only a common wall plane and identical encoded colors may share a
        // polygon. This preserves the existing distance shading and panel seams.
        while(end+1<columns.length&&samePlane(first,columns[end+1])&&sameColor(first[property],columns[end+1][property]))end++;
        planePanel(s,property+start,p,first,columns[end],first[property],topZ,bottomZ,bounds);
        start=end+1;
    }
}

// Reuse each landmark's authored 0–100 drawing on a fixed world-space face.
// A camera-facing sprite intersects its backing wall when viewed obliquely;
// these polygons and their occlusion depths instead follow the actual plane.
function wallLandmarkSurface(s,p,prop,columns) {
    const horizontal=prop.axis==='x',normal=horizontal?p.y-prop.y:p.x-prop.x;
    if(normal*prop.face<=0)return null;
    const direction=horizontal?prop.face:-prop.face,near=.2;
    const cos=Math.cos(p.angle),sin=Math.sin(p.angle);
    const worldPoint=([x,y])=>({
        x:prop.x+(horizontal?(x/100-.5)*prop.width*direction:0),
        y:prop.y+(horizontal?0:(x/100-.5)*prop.width*direction),z:(1-y/100)*prop.height
    });
    const cameraDepth=a=>(a.x-p.x)*cos+(a.y-p.y)*sin;
    const projectFace=points=>{
        const source=points.map(worldPoint),clipped=[];
        for(let i=0;i<source.length;i++){
            const a=source[i],b=source[(i+1)%source.length],da=cameraDepth(a),db=cameraDepth(b);
            if(da>=near)clipped.push(a);
            if((da>=near)!==(db>=near)){
                const t=(near-da)/(db-da);
                clipped.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
            }
        }
        return clipped.map(a=>{const q=project(p,a.x,a.y,a.z);return [q.x,q.y];});
    };
    const outline=projectFace([[0,0],[100,0],[100,100],[0,100]]);
    if(outline.length<3)return null;
    const left=Math.max(0,Math.min(...outline.map(q=>q[0]))),right=Math.min(100,Math.max(...outline.map(q=>q[0])));
    if(right<=left||Math.max(...outline.map(q=>q[1]))<TOP||Math.min(...outline.map(q=>q[1]))>BOTTOM)return null;
    const plane={hit:{side:horizontal?1:0,x:prop.x,y:prop.y}},spans=[];
    for(let c=Math.floor(left*COLS/100);c<Math.min(COLS,Math.ceil(right*COLS/100));c++){
        const lo=Math.max(left,c*100/COLS),hi=Math.min(right,(c+1)*100/COLS),x=(lo+hi)/2;
        // Compare both planes at the same screen position, including columns
        // partly occupied by this face. Keep every visible run around blockers.
        if(planeDepth(plane,p,x)>planeDepth(columns[c],p,x)+.0001)continue;
        const last=spans[spans.length-1];
        if(last&&Math.abs(last[1]-lo)<1e-7)last[1]=hi;else spans.push([lo,hi]);
    }
    if(!spans.length)return null;
    const surface={
        poly(key,points,color,alpha=255){
            const projected=projectFace(points);
            if(projected.length<3)return;
            spans.forEach(([lo,hi],i)=>s.poly(key+(i?'-span'+i:''),projected,color,alpha,[lo,TOP,hi,BOTTOM]));
        },
        rect(key,x,y,w,h,color,alpha=255){surface.poly(key,[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],color,alpha);},
        text(key,text,x,y,size,color,align,font){
            // Squish text stays horizontal. Only label a fully visible face,
            // with its anchor and size following the projected surface.
            const a=worldPoint([x,y]),anchor=project(p,a.x,a.y,a.z);
            const width=prop.width*PROJ/anchor.depth,sizeOnScreen=Math.min(size,width*.11);
            if(cameraDepth(a)<near||width<=3||spans.length!==1||left<=0||right>=100||
                spans[0][0]>left||spans[0][1]<right||anchor.y<TOP||anchor.y+sizeOnScreen>BOTTOM)return;
            s.text(key,text,anchor.x,anchor.y,sizeOnScreen,color,align,font);
        }
    };
    return surface;
}

const directoryGeometry=new WeakMap();
function directoryWalls(world) {
    if(directoryGeometry.has(world))return directoryGeometry.get(world);
    const rectangles=[];let previous=new Map();
    for(let y=0;y<world.height;y++){
        const next=new Map();
        for(let x=0;x<world.width;){
            if(!world.cells[y][x]){x++;continue;}
            const start=x,color=tint(world.regionAt(x,y).color,.7);
            while(x+1<world.width&&world.cells[y][x+1]&&sameColor(color,tint(world.regionAt(x+1,y).color,.7)))x++;
            const width=x-start+1,key=[start,width,...color].join(':');
            let rectangle=previous.get(key);
            if(rectangle)rectangle.height++;
            else{rectangle={x:start,y,width,height:1,color};rectangles.push(rectangle);}
            next.set(key,rectangle);x++;
        }
        previous=next;
    }
    directoryGeometry.set(world,rectangles);
    return rectangles;
}

function renderWorld(game,view,p) {
    const s=view.scene,e=game.engine,world=e.world,room=world.regionAt(p.x,p.y),bounds=[0,TOP,100,BOTTOM];
    const wallHeight=world.wallHeight||WALL_HEIGHT;
    const horizon=HORIZON+Math.tan(p.pitch||0)*VPROJ,eye=EYE+(p.z||0),floorStart=clamp(horizon,TOP,BOTTOM);
    s.rect('ceiling',0,TOP,100,floorStart-TOP,room.ceiling||[29,35,36,255]);
    for(let i=0;i<8;i++)s.rect('floor-'+i,0,floorStart+i*(BOTTOM-floorStart)/8,100,(BOTTOM-floorStart)/8+.03,tint(room.floor||[62,66,58],.7+i*.045));
    // Floor seams are world-space projected geometry; walls drawn later occlude them.
    for(let i=-8;i<=8;i++){
        const gx=Math.floor(p.x/2)*2+i*2,gy=Math.floor(p.y/2)*2+i*2;
        gridLine(s,'grid-x'+i,p,[gx,p.y-18],[gx,p.y+18],tint(room.floor||[60,65,60],1.2));
        gridLine(s,'grid-y'+i,p,[p.x-18,gy],[p.x+18,gy],tint(room.floor||[60,65,60],1.2));
    }
    const depths=view.depths=[],columns=[],cos=Math.cos(p.angle),sin=Math.sin(p.angle);
    let looking=null;
    for(let c=0;c<COLS;c++){
        const camera=(2*(c+.5)/COLS-1)*FOV,dx=cos-sin*camera,dy=sin+cos*camera,length=Math.hypot(dx,dy);
        const hit=e.raycast(p.x,p.y,dx/length,dy/length,60),depth=Math.max(.12,hit.distance/length);depths[c]=depth;
        const x=c*100/COLS,w=100/COLS+.055,top=horizon-(wallHeight-eye)*VPROJ/depth,bottom=horizon+eye*VPROJ/depth;
        const wr=world.regionAt(hit.x-(dx/length)*.05,hit.y-(dy/length)*.05),shade=clamp(1.06-depth*.018,.3,1)*(hit.side===0?.89:1);
        let base=world.wallStyles?.[hit.wall]?.color||wr.color||[187,176,151];
        if(hit.u<.025||hit.u>.975)base=tint(base,.93);
        // Original per-ray rectangles retained for comparison. Same-color
        // portions of a wall now use one perspective-correct Squish polygon.
        // s.rect('wall'+c,x,top,w,bottom-top,tint(base,shade),255,bounds);
        // s.rect('plinth'+c,x,bottom-.17*VPROJ/depth,w,.17*VPROJ/depth,tint(wr.accent||GOLD,shade*.7),255,bounds);
        const art=paintingAt(world,hit);
        columns.push({c,hit,depth,x,w,art,wall:tint(base,shade),plinth:tint(wr.accent||GOLD,shade*.7)});
        if(art&&c===Math.floor(COLS/2)&&depth<8)looking=art.e;
    }
    wallPanels(s,p,columns,'wall',wallHeight,0,bounds);
    wallPanels(s,p,columns,'plinth',.17,0,bounds);
    for(let start=0;start<columns.length;){
        const first=columns[start];if(!first.art){start++;continue;}
        let end=start;
        while(end+1<columns.length&&columns[end+1].art?.e===first.art.e&&samePlane(first,columns[end+1]))end++;
        const height=first.art.e.height||1.43;
        // The whole gold surround is a planar surface, including for oblique
        // artwork. Cropped image columns below retain perspective and occlusion.
        planePanel(s,'frame'+start,p,first,columns[end],tint(GOLD,.82),1.73+height/2+.045,1.73-height/2-.045,bounds);
        start=end+1;
    }
    for(let c=0;c<columns.length;){
        const first=columns[c],art=first.art;
        if(!art){c++;continue;}
        const u=clamp(art.u,0,1);if(u<=.015||u>=.985){c++;continue;}
        let end=c;
        // Front-facing art is an ordinary rectangular image, not eighty
        // independent strips. Angled art keeps every ray's original crop.
        while(end+1<columns.length){
            const next=columns[end+1];
            if(next.art?.e!==art.e||Math.abs(next.depth-first.depth)>.00001||next.art.u<=.015||next.art.u>=.985||!samePlane(first,next))break;
            end++;
        }
        const last=columns[end],height=art.e.height||1.43,depth=first.depth;
        const artTop=horizon-(1.73+height/2-eye)*VPROJ/depth,artH=height*VPROJ/depth;
        const du=clamp(depth*2*FOV/COLS/art.e.length,.004,.07);
        // s.rect('frame'+c,x,artTop-.045*VPROJ/depth,w,artH+.09*VPROJ/depth,tint(GOLD,.82),255,bounds);
        // if(u>.015&&u<.985)s.image('art'+c,art.e.key,x,artTop,w,artH,{left:clamp((u-du*.5)*100,0,99.8),right:clamp((1-u-du*.5)*100,0,99.8)});
        s.image('art'+c,art.e.key,first.x,artTop,last.x+last.w-first.x,artH,
            {left:clamp((u-du*.5)*100,0,99.8),right:clamp((1-last.art.u-du*.5)*100,0,99.8)});
        c=end+1;
    }
    const items=[];
    for(const prop of world.landmarks||[]){
        const item={id:'landmark'+prop.id,type:'landmark',data:prop,x:prop.x,y:prop.y,width:prop.width,height:prop.height};
        if(prop.axis){
            const surface=wallLandmarkSurface(s,p,prop,columns);
            if(surface)drawLandmark(surface,{...item,depth:project(p,prop.x,prop.y).depth},0,0,100,100,[0,0,100,100],e.time);
        }else items.push(item);
    }
    if(e.mode==='ctf')for(const flag of Object.values(e.flags)){
        if(flag.carrierId===p.id)continue;
        const carrier=flag.carrierId===null?null:e.getPlayer(flag.carrierId);
        items.push({id:'flag'+flag.team,type:'flag',data:flag,x:carrier?.x??flag.x,y:carrier?.y??flag.y,z:carrier?(carrier.z||0)+1.1:0,width:.95,height:2.4});
    }
    if(e.mode==='domination')for(const point of e.controlPoints)items.push({id:'point'+point.id,type:'point',data:point,x:point.x,y:point.y,width:1.5,height:2.7});
    for(const other of e.players.values())if(other.id!==p.id&&other.hp>0&&!other.respawn)items.push({id:'person'+other.id,type:'person',data:other,x:other.x,y:other.y,z:other.z||0,width:.65,height:BODY_HEIGHT});
    for(const item of e.pickups)if(item.active)items.push({id:'pickup'+item.id,type:'pickup',data:item,x:item.x,y:item.y,width:.6,height:.8});
    for(const screen of world.screens)items.push({id:'screen'+screen.id,type:'screen',data:screen,x:screen.x,y:screen.y,width:screen.width||2.1,height:(screen.width||2.1)*.75+.45});
    for(const shot of e.projectiles||[])items.push({id:'projectile'+shot.id,type:'projectile',data:shot,x:shot.x,y:shot.y,z:shot.z-shot.radius,width:Math.max(.2,shot.radius*2),height:Math.max(.2,shot.radius*2)});
    for(const effect of e.effects||[])if(effect.type!=='tracer'){
        const radius=effect.type==='explosion'?effect.radius*(.22+.78*effect.age/effect.life):Math.max(.08,effect.radius||.15);
        items.push({id:'effect'+effect.id,type:effect.type,data:effect,x:effect.x,y:effect.y,z:effect.z-radius,width:radius*2,height:radius*2});
    }
    const isFx=item=>['projectile','explosion','impact'].includes(item.type);
    const visibleItems=items.map(item=>({...item,...project(p,item.x,item.y,item.z||0)}))
        .filter(item=>item.depth>.2&&item.depth<48&&item.x+item.width*PROJ/item.depth/2>0&&item.x-item.width*PROJ/item.depth/2<100&&item.y>=TOP&&item.y-item.height*VPROJ/item.depth<=BOTTOM)
        .map(item=>({...item,visible:span(depths,item.x-item.width*PROJ/item.depth/2,item.width*PROJ/item.depth,item.depth)}))
        .filter(item=>item.visible&&item.visible[1]-item.visible[0]>=.15)
        .sort((a,b)=>a.depth-b.depth);
    // Preserve nearby threats when there is a lot of distant plasma/debris.
    // Select by distance first, then paint the retained objects back to front.
    const projected=[...visibleItems.filter(item=>!isFx(item)&&item.type!=='landmark').slice(0,22),...visibleItems.filter(item=>item.type==='landmark').slice(0,12),...visibleItems.filter(isFx).slice(0,36)]
        .sort((a,b)=>b.depth-a.depth);
    for(const o of projected){
        const w=o.width*PROJ/o.depth,h=o.height*VPROJ/o.depth,x=o.x-w/2,bottom=o.y;
        const visible=o.visible,clip=[visible[0],TOP,visible[1],BOTTOM];
        if(o.type==='landmark'){
            drawLandmark(s,o,x,bottom-h,w,h,clip,e.time);
        }else if(o.type==='flag'||o.type==='point'){
            drawObjective(s,o,x,bottom-h,w,h,clip,e.time);
        }else if(o.type==='projectile'){
            const col=o.data.color||[114,229,255,255],cy=bottom-h/2;
            s.poly(o.id+'glow',polygon(8,o.x,cy,w*.85,h*.85,e.time*5),col,100,clip);
            s.poly(o.id+'core',polygon(o.data.weapon==='rocket'?4:8,o.x,cy,w*.42,h*.42,e.time*5),WHITE,255,clip);
            const tail=o.data.trail?.[Math.max(0,o.data.trail.length-3)];
            if(tail)beam(s,o.id+'tail',p,depths,o.data,tail,col,Math.min(.45,w*.14));
        }else if(o.type==='explosion'||o.type==='impact'){
            const progress=clamp(o.data.age/o.data.life,0,1),col=o.data.color||[255,178,86,255],cy=bottom-h/2;
            s.poly(o.id+'halo',polygon(12,o.x,cy,w*.5,h*.5,progress),col,Math.round(180*(1-progress)),clip);
            s.poly(o.id+'core',polygon(8,o.x,cy,w*.23,h*.23,-progress),WHITE,Math.round(235*(1-progress)),clip);
            if(o.type==='explosion')for(let i=0;i<4;i++){const a=i*Math.PI/2+progress*2;s.poly(o.id+'spark'+i,polygon(3,o.x+Math.cos(a)*w*.36,cy+Math.sin(a)*h*.36,w*.06,h*.1,a),col,Math.round(220*(1-progress)),clip);}
        }else if(o.type==='screen'){
            const mediaH=o.width*.75*VPROJ/o.depth,standH=.45*VPROJ/o.depth,yy=bottom-mediaH-standH;
            s.rect(o.id+'stand',o.x-w*.025,bottom-standH,w*.05,standH,[29,32,32,255],255,clip);
            s.rect(o.id+'frame',x-.1,yy-.1,w+.2,mediaH+.2,[11,16,19,255],255,clip);
            // One decoder per monitor. A new node every six seconds restarts
            // the authored six-second loop using existing playback semantics.
            s.image(o.id+'video'+Math.floor(e.time/6),o.data.key,x,yy,w,mediaH,{},clip);
            s.rect(o.id+'light',x,yy+mediaH,w,.12,tint(room.accent||GOLD,1.2),255,clip);
            if(o.depth<7&&Math.abs(o.x-50)<12)looking=o.data;
        }else if(o.type==='pickup'){
            const col=o.data.type==='health'?[127,230,181,255]:o.data.type==='shield'?[119,201,255,255]:(game.weapons[o.data.weapon]?.color||GOLD),yy=bottom-h;
            s.rect(o.id+'base',x,bottom-h*.2,w,h*.2,tint(room.color||[150,140,120],.7),255,clip);
            s.poly(o.id+'gem',polygon(4,o.x,yy+h*.34+Math.sin(e.time*2+o.data.x)*.16,w*.32,h*.23,Math.PI/4),col,255,clip);
            s.rect(o.id+'shine',o.x-w*.05,yy+h*.2,w*.1,h*.25,WHITE,210,clip);
            if(o.depth<4&&Math.abs(o.x-50)<12)looking={title:o.data.type==='health'?'RESTORATION / + HEALTH':o.data.type==='shield'?'SHIELD / + PROTECTION':(game.weapons[o.data.weapon]?.name||'AMMUNITION'),artist:'WALK OVER TO COLLECT'};
        }else{
            const col=TEAM_COLORS[o.data.team]||o.data.color||[110,218,228,255],y=bottom-h,flash=o.data.damageFlash>0,body=flash?WHITE:col;
            const headBottom=bottom-HEAD_HEIGHT*VPROJ/o.depth,legTop=bottom-TORSO_HEIGHT*VPROJ/o.depth;
            const ground=project(p,o.data.x,o.data.y,0);
            s.rect(o.id+'shadow',x-w*.2,ground.y-.1,w*1.4,.22,[15,17,17,255],150,clip);
            s.poly(o.id+'body',[[x+w*.18,headBottom],[x+w*.82,headBottom],[x+w*.915,legTop],[x+w*.085,legTop]],tint(body,.8),255,clip);
            s.rect(o.id+'head',x+w*.2,y,w*.6,headBottom-y,body,255,clip);
            s.rect(o.id+'visor',x+w*.24,y+h*.095,w*.52,h*.07,[16,28,35,255],255,clip);
            s.rect(o.id+'eye',x+w*.34,y+h*.105,w*.32,h*.024,o.data.bot?GOLD:WHITE,255,clip);
            if(o.data.aimFlash>0)s.poly(o.id+'aim',polygon(4,o.x,y+h*.47,w*(.12+o.data.aimFlash*.18),h*.12),[255,91,58,255],Math.round(120+o.data.aimFlash*135),clip);
            const gait=o.data.moving?Math.sin(e.time*10+o.data.id)*h*.045:0;
            s.rect(o.id+'leg1',x+w*.13,legTop,w*.3,bottom-legTop-Math.max(0,gait),tint(col,.48),255,clip);
            s.rect(o.id+'leg2',x+w*.57,legTop,w*.3,bottom-legTop-Math.max(0,-gait),tint(col,.48),255,clip);
            s.rect(o.id+'gun',x+w*.74,y+h*.48,w*.5,h*.09,[39,45,47,255],255,clip);
            if(o.data.shotFlash>0)s.poly(o.id+'spark',polygon(8,x+w*1.3,y+h*.52,w*.35,h*.15),[255,234,149,255],255,clip);
            if(o.depth<9&&visible[1]-visible[0]>w*.8)s.text(o.id+'name',o.data.name,o.x,Math.max(TOP+1,y-2.1),.85,o.data.bot?GOLD:INK,'center');
        }
    }
    renderTracers(s,p,depths,e.effects||[]);
    return {room,looking};
}
/* Original three-weapon viewmodel retained while the detailed arsenal evolves.
function renderGun(s,p,weapons,time){
    const weapon=weapons[p.weapon]||weapons.pulse,col=weapon.color||GOLD;
    const bob=p.moving?Math.sin(time*9)*.5:Math.sin(time)*.08,recoil=(p.shotFlash||0)*7,dx=bob,dy=recoil;
    const P=points=>points.map(([x,y])=>[x+dx,y+dy]);
    s.poly('hand',P([[65,82],[73,74],[83,79],[92,94],[64,96]]),[112,94,74,255]);
    s.poly('glove',P([[61,77],[67,74],[77,79],[74,94],[62,94]]),[30,39,42,255]);
    s.poly('gun-side',P([[57,69],[65,61],[75,65],[79,84],[62,84]]),[50,59,64,255]);
    s.poly('gun-top',P([[57,69],[65,61],[72,63],[65,73]]),[176,183,176,255]);
    s.poly('gun-face',P([[57,69],[65,73],[68,81],[61,79]]),[94,107,111,255]);
    s.poly('gun-accent',P([[66,64],[71,65],[75,80],[71,79]]),col);
    const barrel=p.weapon==='rail'?[[61,66],[61.5,54],[64,53],[68,66]]:p.weapon==='scatter'?[[58,68],[58,61],[64,58],[68,65]]:[[60,68],[60,62],[65,60],[68,66]];
    s.poly('barrel',P(barrel),[20,29,35,255]);
    s.rect('sight',63+dx,61+dy,1,.8,col);
    if(p.shotFlash>0){const pts=Array.from({length:12},(_,i)=>{const radius=i%2?2:4.8;return[63+dx+Math.cos(i*Math.PI/6)*radius,58+dy+Math.sin(i*Math.PI/6)*radius*1.7];});s.poly('muzzle',pts,[255,225,128,255]);s.poly('muzzlecore',polygon(6,63+dx,58+dy,1.5,2),WHITE);}
}
*/
function renderMuseum(game,view,p){
    const s=view.scene,e=game.engine;s.begin();
    const {room,looking}=renderWorld(game,view,p);
    if(p.hp>0)renderGun(s,p,game.weapons,e.time);
    s.rect('hud-top',0,0,100,10,[13,21,24,255]);s.rect('top-line',0,9.8,100,.2,room.accent||GOLD);
    s.text('room',room.name.toUpperCase(),28,2.5,1.18,room.accent||GOLD);
    const humans=[...e.players.values()].filter(v=>!v.bot).length;
    s.text('players',humans+' VISITOR'+(humans===1?'':'S')+'  /  '+Math.floor(Math.max(0,e.round.remaining)/60)+':'+String(Math.floor(Math.max(0,e.round.remaining)%60)).padStart(2,'0'),97,2.5,1.25,INK,'right');
    s.rect('hud-bottom',0,BOTTOM,100,16,[13,21,24,255]);s.rect('bottom-line',0,BOTTOM,100,.2,[68,75,71,255]);
    s.text('health-label','CONDITION',3,87,.9,[142,153,148,255]);s.text('health',Math.ceil(p.hp).toString().padStart(3,'0'),3,90,3.3,p.hp<35?[255,117,99,255]:INK);
    s.rect('healthbar-bg',12.5,93,12,.65,[48,58,57,255]);s.rect('healthbar',12.5,93,12*clamp(p.hp/100,0,1),.65,room.accent||GOLD);
    s.text('shield','SHIELD '+String(Math.ceil(p.shield||0)).padStart(2,'0'),12.5,95,.68,[119,201,255,255]);
    const weapon=game.weapons[p.weapon]||game.weapons.pulse;
    s.text('weapon-label','EXHIBIT / '+weapon.name.toUpperCase(),30,87,1.2,weapon.color||GOLD);
    const abbreviations=['MG','SG','RL','RAIL','PLASMA','PULSE'];
    WEAPON_ORDER.forEach((id,i)=>s.text('slot'+i,(i+1)+' '+abbreviations[i],30+i*6.8,95.3,.63,id===p.weapon?(game.weapons[id].color||GOLD):p.owned.includes(id)?INK:[68,83,88,255]));
    s.text('ammo-label','CHARGE',74,87,.9,[142,153,148,255]);s.text('ammo',p.weapon==='pulse'?'INF':String(p.ammo[p.weapon]||0).padStart(2,'0'),74,90,3,INK);
    s.text('score-label',e.mode==='ctf'?'CAPTURES':'TAGS',89,87,.9,[142,153,148,255]);s.text('score',String(e.mode==='ctf'?p.captures||0:p.kills||0).padStart(2,'0')+(e.mode==='ffa'?' / '+e.targetScore:''),89,91,1.7,INK);
    s.rect('cross-v',49.94,HORIZON-1.1,.12,2.2,WHITE,215);s.rect('cross-h',49.38,HORIZON-.11,1.24,.22,WHITE,215);
    if(p.hitFlash>0)for(const [i,[dx,dy]] of [[-1,-1],[1,-1],[-1,1],[1,1]].entries())line(s,'hit-marker'+i,{x:50+dx*.8,y:HORIZON+dy*1.4},{x:50+dx*1.4,y:HORIZON+dy*2.4},p.lastHitZone==='head'?[255,118,99,255]:GOLD,.1);
    if(p.damageFlash>0){const alpha=clamp(p.damageFlash*330,0,110);s.rect('damage-top',0,TOP,100,1.2,[224,73,61,255],alpha);s.rect('damage-bottom',0,BOTTOM-1.2,100,1.2,[224,73,61,255],alpha);}
    if(looking&&view.started){s.rect('caption-bg',29,74,42,7,[13,21,24,255],220);s.text('caption-title',looking.title||'MOTION STUDY',50,75,1.17,INK,'center');s.text('caption-credit',looking.artist||'AFTER HOURS COLLECTION / MOVING IMAGE',50,78,.65,room.accent||GOLD,'center');}
    const feed=(e.killFeed||[]).slice(0,2);feed.forEach((item,i)=>s.text('feed'+i,typeof item==='string'?item:(item.text||((item.killer||'')+' / '+(item.victim||''))),97,12+i*2.3,.9,INK,'right'));
    if(p.invulnerable>0&&view.started)s.text('protected','RESTORING / PROTECTED',50,e.mode==='ffa'?16:26,.9,GOLD,'center');
    if(view.message&&view.messageUntil>e.time)s.text('toast',view.message,50,e.mode==='ffa'?21:29,1.4,GOLD,'center');
    if(view.started&&e.round.phase!=='lobby')drawObjectiveHUD(s,e,p);
    if(view.map)drawMap(s,e,p);
    if(!view.started||view.help)drawWelcome(s,view);
    if(p.respawn>0){s.rect('respawn-back',28,33,44,23,[13,21,24,255],235);s.text('respawn-title','EXHIBIT INTERRUPTED',50,37,2.6,INK,'center');s.text('respawn-time','REASSEMBLING IN '+Math.ceil(p.respawn),50,45,1.5,GOLD,'center');}
    /* Original automatic rematch overlay retained; the lobby now owns intermission.
    if(e.round.winner){s.rect('round-back',22,29,56,29,[13,21,24,255],245);s.text('round-title','THE NIGHT BELONGS TO',50,33,1.2,GOLD,'center');s.text('round-winner',e.round.winner,50,39,3.3,INK,'center');s.text('round-next','NEXT EXHIBITION IN '+Math.ceil(e.round.intermission),50,49,1.15,GOLD,'center');}
    */
    if(view.started&&e.round.phase==='lobby')drawLobby(s,e,view,p);
    s.end();
}
function drawWelcome(s,view){
    s.rect('welcome',4,43,46,30,[13,21,24,255],245);s.rect('welcome-accent',4,43,.35,30,GOLD);

    s.text('welcome-copy',view.started?'Arena controls':'Choose an arena. Ready up.',7,51,1.1,[173,184,179,255]);
    s.text('welcome-key2','WASD move  Mouse aim  Space jump  Click / F fire',7,58,.78,INK);
    if(view.help)s.text('welcome-key3','Esc cursor  Shift sprint  1-6 / R weapons  M map  H help',7,60.5,.71,INK);
    s.rect('welcome-enter-bg',7,64,40,6.2,GOLD);
    s.text('welcome-enter',view.started?'RETURN TO ARENA  >':'PLAY  >',27,65.5,1.35,[20,28,29,255],'center');
}
function drawMap(s,e,p){
    s.rect('map-panel',26,16,48,64,[13,21,24,255],248);s.text('map-title',e.world.name.toUpperCase(),50,18,1.3,GOLD,'center');
    const scale=.95,ox=50-e.world.width*scale/2,oy=23;
    // The directory is static: adjacent equal-color wall cells share rectangles
    // while every doorway and gallery boundary keeps its original position.
    // for(let y=0;y<e.world.height;y++)for(let x=0;x<e.world.width;x++)if(e.world.cells[y][x])s.rect('map'+x+':'+y,ox+x*scale,oy+y*scale,scale+.02,scale+.02,tint(e.world.regionAt(x,y).color,.7));
    directoryWalls(e.world).forEach((wall,index)=>s.rect('map-wall'+index,ox+wall.x*scale,oy+wall.y*scale,wall.width*scale+.02,wall.height*scale+.02,wall.color));
    if(e.mode==='ctf')for(const flag of Object.values(e.flags))s.rect('map-flag-'+flag.team,ox+flag.base.x*scale-.45,oy+flag.base.y*scale-.45,.9,.9,TEAM_COLORS[flag.team]);
    if(e.mode==='domination')for(const point of e.controlPoints)s.text('map-point-'+point.id,point.id,ox+point.x*scale,oy+point.y*scale-.6,1.1,TEAM_COLORS[point.owner]||INK,'center');
    s.poly('map-player',polygon(3,ox+p.x*scale,oy+p.y*scale,.8,.8,p.angle),[255,236,175,255]);
    s.text('map-note','M / CLOSE    WEAPONS RESTOCK THROUGHOUT THE NIGHT',50,76,.74,INK,'center');
}
module.exports={Scene,container,renderMuseum,COLS,TOP,BOTTOM};
