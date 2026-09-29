// Software camera and painter-style polygon renderer, independent of GameNode.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mix=(a,b,t)=>a.map((v,i)=>i===3?255:Math.round(v+(b[i]-v)*clamp(t,0,1)));
const close=p=>p.concat([p[0]]);
// Clip geometry before it reaches Squish's unsigned coordinate encoding.
function clipPolygon(points) {
    const edges=[{axis:0,value:0,keep:1},{axis:0,value:100,keep:-1},{axis:1,value:13,keep:1},{axis:1,value:84,keep:-1}];
    for(const {axis,value,keep} of edges){
        const result=[];
        for(let i=0;i<points.length;i++){
            const a=points[i],b=points[(i+1)%points.length];
            const ina=(a[axis]-value)*keep>=0,inb=(b[axis]-value)*keep>=0;
            if(ina)result.push(a);
            if(ina!==inb){const t=(value-a[axis])/(b[axis]-a[axis]);result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
        }
        points=result;if(points.length<3)return [];
    }
    return points;
}

function project(point,camera){
        const yaw=camera.yaw,co=Math.cos(yaw),si=Math.sin(yaw);
        const x=point[0]*co+point[2]*si,z=point[2]*co-point[0]*si;
        const zoom=camera.zoom;
        const focus=1.43+clamp((zoom-1)/1.05,0,1)*1.075;
        const scale=23*zoom/(1-z*.085);
        return {xy:[65+x*scale,49-(point[1]-focus)*scale],depth:z};
    }

function projectMesh(faces,camera,sunset=false){
        const projected=[],co=Math.cos(camera.yaw),si=Math.sin(camera.yaw);
        for(const face of faces){
            const nz=face.normal[2]*co-face.normal[0]*si;
            if(nz<.002&&!face.twoSided)continue;
            const pts=face.points.map(p=>project(p,camera));
            const clipped=clipPolygon(pts.map(p=>p.xy));if(clipped.length<3)continue;
            const nx=face.normal[0]*co+face.normal[2]*si;
            const light=clamp(-nx*.36+face.normal[1]*.76+nz*.55,0,1);
            const shade = face.unlit ? 1 : face.skin
                ? .85 + Math.floor(light * 4) * .0375
                : .70 + Math.floor(light * 4) * .075;
            let color=face.color.map((v,i)=>i===3?255:Math.round(v*shade));
            if(sunset)color=mix(color,[255,191,132,255],.075);
            projected.push({points:close(clipped),depth:pts.reduce((s,p)=>s+p.depth,0)/pts.length+(face.bias||0),color});
        }
        projected.sort((a,b)=>a.depth-b.depth);
    return projected;
}
module.exports={clipPolygon,project,projectMesh};
