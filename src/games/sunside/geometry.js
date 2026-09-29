const {CHARACTER_COLORS}=require('./settings');
const TAU = Math.PI * 2;
const add = (a,b) => a.map((v,i)=>v+b[i]);
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const mul = (a,s) => a.map(v=>v*s);
const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit = a => mul(a,1/(Math.sqrt(dot(a,a))||1));
const lerp = (a,b,t) => a.map((v,i)=>v+(b[i]-v)*t);

class Mesh {
    constructor() { this.faces=[]; }
    face(points,color,center=null,unlit=false,twoSided=false) {
        let normal=unit(cross(sub(points[1],points[0]),sub(points[2],points[0])));
        if(center) {
            const mid=mul(points.reduce((a,p)=>add(a,p),[0,0,0]),1/points.length);
            if(dot(normal,sub(mid,center))<0){points=points.slice().reverse();normal=mul(normal,-1);}
        }
        // Facial illustrations are laid onto the front of the 3D head.
        if(unlit&&normal[2]<0){points=points.slice().reverse();normal=mul(normal,-1);}
        const face={points,color,normal,unlit,twoSided,skin:color===CHARACTER_COLORS.skin||color===CHARACTER_COLORS.skinLight};
        this.faces.push(face);return face;
    }
    ellipse(center,radii,color,segments=12,rows=6) {
        const rings=[];
        for(let j=0;j<=rows;j++){
            const lat=-Math.PI/2+j*Math.PI/rows;
            rings.push(Array.from({length:segments},(_,i)=>{
                const a=i*TAU/segments;
                return add(center,[Math.sin(a)*radii[0]*Math.cos(lat),Math.sin(lat)*radii[1],Math.cos(a)*radii[2]*Math.cos(lat)]);
            }));
        }
        for(let j=0;j<rows;j++)for(let i=0;i<segments;i++){
            const k=(i+1)%segments;
            this.face([rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i]],color,center);
        }
    }
    tube(a,b,ra,rb,color,segments=8) {
        const axis=unit(sub(b,a));
        const u=unit(cross(axis,Math.abs(axis[2])<.8?[0,0,1]:[0,1,0]));
        const v=cross(axis,u), center=lerp(a,b,.5);
        const ring=(p,r)=>Array.from({length:segments},(_,i)=>add(p,add(mul(u,Math.cos(i*TAU/segments)*r),mul(v,Math.sin(i*TAU/segments)*r))));
        const lo=ring(a,ra),hi=ring(b,rb);
        for(let i=0;i<segments;i++){const k=(i+1)%segments;this.face([lo[i],lo[k],hi[k],hi[i]],color,center);}
        this.face(lo,color,center);this.face(hi,color,center);
    }
    rings(sections,color,segments=14,bias=0) {
        const points=sections.map(s=>Array.from({length:segments},(_,i)=>{
            const a=i*TAU/segments;
            return [(s.x||0)+Math.sin(a)*s.rx,s.y,(s.z||0)+Math.cos(a)*s.rz];
        }));
        for(let j=0;j<sections.length-1;j++)for(let i=0;i<segments;i++){
            const k=(i+1)%segments,center=[0,(sections[j].y+sections[j+1].y)/2,0];
            this.face([points[j][i],points[j][k],points[j+1][k],points[j+1][i]],color,center).bias=bias;
        }
    }
    disk(x,y,z,rx,ry,color,n=12) {
        const pts=Array.from({length:n},(_,i)=>[x+Math.cos(i*TAU/n)*rx,y+Math.sin(i*TAU/n)*ry,z]);
        this.face(pts,color,null,true);
    }
}

module.exports={Mesh,TAU,add,sub,mul,dot,cross,unit,lerp};
