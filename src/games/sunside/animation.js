// Pose sampling is independent of geometry and Homegames. All joint positions
// are local meters. Only hair/clothing/accessories use secondary spring motion.
const POSES = ['idle','wave','dance','warmup','rally','cheer'];
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
function solveArm(shoulder,target,hint){
    const vector=target.map((v,i)=>v-shoulder[i]);
    const length=Math.hypot(...vector)||1;
    const direction=vector.map(v=>v/length),distance=clamp(length,.08,.649);
    const projected=hint.reduce((sum,v,i)=>sum+(v-shoulder[i])*direction[i],0);
    let bend=hint.map((v,i)=>v-shoulder[i]-direction[i]*projected);
    const bendLength=Math.hypot(...bend)||1;bend=bend.map(v=>v/bendLength);
    const along=(.34*.34-.31*.31+distance*distance)/(2*distance);
    const height=Math.sqrt(Math.max(0,.34*.34-along*along));
    return {
        elbow:shoulder.map((v,i)=>v+direction[i]*along+bend[i]*height),
        wrist:shoulder.map((v,i)=>v+direction[i]*distance),
    };
}
function sampleRig(pose='idle',time=0,action=0) {
    if(!POSES.includes(pose))pose='idle';
    const beat=Math.sin(time*3.1),lift=Math.sin(time*3.1+Math.PI/2);
    const rig={rootX:Math.sin(time*.8)*.012,rootY:Math.sin(time*1.6)*.007};
    if(pose==='dance'){rig.rootX+=beat*.042;rig.rootY+=Math.abs(lift)*.015;}
    if(pose==='rally')rig.rootY+=Math.sin(time*4)*.014;
    for(const side of [-1,1]){
        const key=side===-1?'left':'right';
        let knee=[side*.16,.76,.022],ankle=[side*.19,.17-rig.rootY,.005];
        let elbow=[side*.40,1.86,.005],wrist=[side*.355,1.55,.07];
        if(pose==='rally'){elbow=[side*.33,1.92,.23];wrist=[side*.09,1.79+Math.sin(action*Math.PI)*.17,.51];}
        if(pose==='wave'&&side===1){elbow=[.54,2.20,.02];wrist=[.56+Math.sin(time*8)*.04,2.59,.075];}
        if(pose==='cheer'){elbow=[side*.47,2.37,0];wrist=[side*.54,2.67,.02];}
        if(pose==='dance'){
            elbow=[side*.48,2.12+side*beat*.10,.05];
            wrist=[side*.62,2.32+side*beat*.19,.15];
            knee=[side*.16+beat*.025,.75,.04];
            ankle[0]+=side*Math.max(0,side*lift)*.055;
            ankle[1]+=Math.max(0,side*lift)*.023;
        }
        if(pose==='warmup'){
            const stretch=(Math.sin(time*1.4)+1)/2;
            elbow=[side*(.50-stretch*.13),2.24+stretch*.16,.0];
            wrist=[side*(.65-stretch*.49),2.23+stretch*.54,.02];
        }
        rig[key+'Hip']=[side*.145,1.31,0];rig[key+'Knee']=knee;rig[key+'Ankle']=ankle;
        const shoulder=[side*.32,2.185,0],arm=solveArm(shoulder,wrist,elbow);
        rig[key+'Shoulder']=shoulder;rig[key+'Elbow']=arm.elbow;rig[key+'Wrist']=arm.wrist;
    }
    return rig;
}
function mixRig(a,b,t){
    const result={};
    for(const key of Object.keys(b))result[key]=Array.isArray(b[key])
        ? b[key].map((v,i)=>a[key][i]+(v-a[key][i])*t)
        : a[key]+(b[key]-a[key])*t;
    return result;
}
class Animator {
    constructor(){this.pose='idle';this.rig=sampleRig();this.from=null;this.blend=1;this.hair=0;this.hairVelocity=0;this.lastRootX=0;}
    update(pose,time,action=0,dt=.05){
        if(!POSES.includes(pose))pose='idle';
        if(pose!==this.pose){this.from=this.rig;this.blend=0;this.pose=pose;}
        this.blend=Math.min(1,this.blend+dt/.32);
        const smooth=this.blend*this.blend*(3-2*this.blend);
        const next=sampleRig(pose,time,action);
        this.rig=this.from&&this.blend<1?mixRig(this.from,next,smooth):next;
        const velocity=(this.rig.rootX-this.lastRootX)/dt;
        this.lastRootX=this.rig.rootX;
        const target=clamp(Math.sin(time*1.4)*.04-velocity*.07,-.07,.07);
        // Stable substeps, damped toward wind and the character's movement.
        for(let i=0;i<3;i++){
            this.hairVelocity+=((target-this.hair)*38-this.hairVelocity*9)*(dt/3);
            this.hair=clamp(this.hair+this.hairVelocity*(dt/3),-.09,.09);
        }
        return {rig:this.rig,hair:this.hair,cloth:this.hair*.35,earrings:this.hair*.12};
    }
}
module.exports={POSES,sampleRig,Animator};
