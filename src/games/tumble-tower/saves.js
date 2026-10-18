// Saves contain a rebuildable design, never live solver state or velocities.
const SHAPES=[[17,6],[6,17],[10,10],[31,4],[4,31]];
function restoreBuild(value){
    if(!Array.isArray(value)||value.length>24)return [];
    const result=[];
    for(const b of value){
        if(!b||!['x','y','width','height','angle','colorIndex'].every(k=>Number.isFinite(b[k]))||
            !SHAPES.some(([w,h])=>w===b.width&&h===b.height)||Math.abs(b.angle)>10000||!Number.isInteger(b.colorIndex)||b.colorIndex<0||b.colorIndex>5)return [];
        const angle=((b.angle%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
        const halfX=(Math.abs(Math.cos(angle))*b.width+Math.abs(Math.sin(angle))*b.height)/2;
        const halfY=(Math.abs(Math.sin(angle))*b.width+Math.abs(Math.cos(angle))*b.height)/2;
        if(b.x<29+halfX-.2||b.x>143-halfX+.2||b.y<18+halfY-.2||b.y>76-halfY+.2)return [];
        // Select fields explicitly; imported saves cannot alter physics properties.
        result.push({x:b.x,y:b.y,width:b.width,height:b.height,angle:b.angle,colorIndex:b.colorIndex});
    }
    return result;
}
module.exports={restoreBuild};
