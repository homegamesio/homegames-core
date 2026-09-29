// Procedural 3D geometry. No images, models, textures, fonts or other assets.
// Coordinates are in meters, with Y up and +Z toward the character's front.
const {Mesh,TAU,add,sub,mul,cross,unit,lerp}=require('./geometry');
const {sampleRig}=require('./animation');
const {buildWardrobe}=require('./wardrobe');
const {CHARACTER_COLORS:COLORS}=require('./settings');

function buildCharacter({time=0,pose='idle',action=0,color=[223,112,91,255],outfit='coast',motion=null}={}) {
    const m=new Mesh(),c=COLORS;
    const rig=motion?motion.rig:sampleRig(pose,time,action);
    const rootY=rig.rootY,sway=rig.rootX,celebrate=pose==='cheer';
    const p=(x,y,z=0)=>[x+sway,y+rootY,z];
    const white=c.white,trim=[44,98,104,255];

    // Adult proportions, a neutral athletic stance, and solid sport swimwear.
    for(const side of [-1,1]) {
        const key=side===-1?'left':'right';
        const hip=p(...rig[key+'Hip']),knee=p(...rig[key+'Knee']),ankle=p(...rig[key+'Ankle']);
        const foot=(dx,y,z)=>[ankle[0]+dx,ankle[1]-.17+y,ankle[2]+z];
        m.tube(hip,knee,.135,.081,c.skin,10);
        m.ellipse(knee,[.084,.084,.085],c.skin,8,4);
        m.tube(knee,ankle,.087,.048,c.skin,10);
        m.ellipse(foot(0,.105,.068),[.07,.055,.15],c.skinLight,10,4);
        m.ellipse(foot(0,.065,.075),[.077,.018,.16],c.sole,10,3);
        m.tube(foot(-.063,.135,.13),foot(.063,.135,.10),.011,.011,trim,5);
        m.tube(foot(0,.145,.17),foot(0,.15,.022),.011,.011,trim,5);
    }
    const torso=[
        {y:1.25,rx:.24,rz:.14},{y:1.43,rx:.277,rz:.165},
        {y:1.66,rx:.207,rz:.132},{y:1.88,rx:.225,rz:.144},
        {y:2.07,rx:.296,rz:.172},{y:2.20,rx:.31,rz:.14},
        {y:2.265,rx:.16,rz:.105},
    ].map(s=>({...s,y:s.y+rootY,x:sway}));
    m.rings(outfit==='coast'?torso:torso.slice(4),c.skin,16);
    m.tube(p(0,2.23,0),p(0,2.42,0),.085,.077,c.skin,10);

    buildWardrobe(m,{outfit,color,rootX:sway,rootY,cloth:motion?motion.cloth:0});

    for(const side of [-1,1]) {
        const key=side===-1?'left':'right';
        const shoulder=p(...rig[key+'Shoulder']),elbow=p(...rig[key+'Elbow']),wrist=p(...rig[key+'Wrist']);
        m.ellipse(shoulder,[.09,.097,.087],c.skin,8,4);
        m.tube(shoulder,elbow,.084,.064,c.skin,9);
        m.ellipse(elbow,[.065,.067,.068],c.skin,8,4);
        m.tube(elbow,wrist,.067,.042,c.skin,9);
        const direction=unit(sub(wrist,elbow));
        const tip=add(wrist,mul(direction,.098));
        m.tube(wrist,tip,.044,.047,c.skinLight,7);
        const across=unit(cross(direction,[0,0,1]));
        for(let f=0;f<4;f++){
            const start=add(tip,mul(across,(f-1.5)*.019));
            const finger=add(start,mul(direction,.052+(f===1||f===2?.015:0)));
            m.tube(start,finger,.010,.007,c.skinLight,5);
        }
        m.tube(add(wrist,mul(across,.043)),add(tip,mul(across,.070)),.017,.009,c.skinLight,5);
        if(side===-1) m.tube(lerp(elbow,wrist,.88),lerp(elbow,wrist,.96),.048,.046,color,9);
    }

    // Head, jaw and small facial features. No image planes or facial textures.
    const head=p(0,2.596,.004);
    m.ellipse(head,[.205,.252,.18],c.skinLight,18,9);
    m.ellipse(p(0,2.465,.024),[.137,.105,.14],c.skinLight,14,5);
    for(const side of [-1,1]) {
        m.ellipse(p(side*.207,2.568,.006),[.035,.057,.026],c.skin,8,4);
        m.disk(side*.213+sway+(motion?motion.earrings:0),2.51+rootY,.032,.012,.022,c.gold,6);
    }
    const blinking=time%4.3>.0 && time%4.3<.14;
    const eyeY=2.633+rootY;
    const eyeZ=.174;
    for(const side of [-1,1]) {
        const x=side*.087+sway;
        if(blinking || celebrate) {
            m.face([[x-.048,eyeY+.003,eyeZ+.008],[x,eyeY+.014,eyeZ+.015],[x+.048,eyeY+.003,eyeZ+.008],[x,eyeY+.024,eyeZ+.015]],c.ink,null,true);
        } else {
            m.face([[x-.056,eyeY,eyeZ],[x-.031,eyeY+.034,eyeZ+.004],[x+.020,eyeY+.038,eyeZ+.006],[x+.057,eyeY+.008,eyeZ],[x+.028,eyeY-.027,eyeZ+.009],[x-.027,eyeY-.029,eyeZ+.009]],white,null,true);
            m.disk(x,eyeY+.004,eyeZ+.012,.028,.036,c.iris,14);
            m.disk(x,eyeY+.008,eyeZ+.014,.013,.026,c.ink,10);
            m.disk(x-.01,eyeY+.021,eyeZ+.016,.009,.011,white,6);
            m.disk(x+.011,eyeY-.016,eyeZ+.016,.004,.004,white,5);
            m.face([[x-.058,eyeY+.003,eyeZ+.013],[x-.035,eyeY+.043,eyeZ+.013],[x+.022,eyeY+.048,eyeZ+.013],[x+.068,eyeY+.010,eyeZ+.013],[x+.024,eyeY+.034,eyeZ+.017],[x-.030,eyeY+.031,eyeZ+.017]],c.ink,null,true);
        }
        m.face([[x-.042,eyeY+.080,eyeZ-.009],[x+.038,eyeY+.083,eyeZ-.009],[x+.043,eyeY+.070,eyeZ-.006],[x-.043,eyeY+.070,eyeZ-.006]],c.hair,null,true);
    }
    m.face([p(-.013,2.587,.178),p(0,2.538,.210),p(.020,2.544,.179)],c.skin,null,true);
    m.face([p(-.037,2.492,.160),p(0,2.481,.177),p(.037,2.495,.160),p(0,2.487,.179)],c.lips,null,true);

    // Sculpted cap: its front edge is higher to leave the eyes unobscured.
    const hairCenter=p(0,2.62,-.010),segments=20,rows=6,rings=[];
    for(let row=0;row<=rows;row++){
        rings.push(Array.from({length:segments},(_,i)=>{
            const theta=i*TAU/segments;
            const front=(Math.cos(theta)+1)/2;
            const limit=1.95-front*.96;
            const phi=(row/rows)*limit;
            return add(hairCenter,[Math.sin(theta)*.234*Math.sin(phi),Math.cos(phi)*.292,Math.cos(theta)*.208*Math.sin(phi)]);
        }));
    }
    for(let row=0;row<rows;row++)for(let i=0;i<segments;i++){
        const j=(i+1)%segments;
        m.face([rings[row][i],rings[row][j],rings[row+1][j],rings[row+1][i]],i%5===0?c.hairLight:c.hair,hairCenter);
    }
    // Fringe in six separate locks, with lighter inner facets.
    for(let i=0;i<6;i++) {
        const x=-.21+i*.071;
        const tipX=x+.035+(i<3?-.018:.016);
        const tipY=2.704+(i%3)*.022;
        const a=p(x,2.817,.133),b=p(x+.082,2.818,.133),tip=p(tipX,tipY,.207);
        m.face([a,b,tip],i%2?c.hair:c.hairLight,null,true);
        m.face([lerp(a,b,.5),b,tip],c.hair,null,true);
    }
    // Wind is limited to hair ribbons; body motion follows the pose skeleton.
    const breeze=motion?motion.hair:Math.sin(time*1.4)*.046;
    for(let i=0;i<10;i++){
        const x=-.255+i*.052;
        const points=[p(x,2.70,-.14),p(x+.07,2.70,-.14),p(x+.10+breeze,2.12,-.17),p(x+.055+breeze*1.8,1.91+(i%3)*.06,-.12),p(x-.026+breeze,2.22,-.21)];
        m.face(points,i%3?c.hair:c.hairLight,[0,2.35,.1],false,true);
        m.face(points.slice().reverse().map(v=>add(v,[0,0,-.015])),i%3?c.hair:c.hairShine,[0,2.35,.1],false,true);
    }
    for(const side of [-1,1]) {
        const x=side*.22;
        m.face([p(x-side*.022,2.764,.09),p(x+side*.060,2.697,.02),p(x+side*.067+breeze,2.338,.0),p(x+side*.022+breeze,2.194,.022),p(x-side*.014,2.493,.10)],c.hairLight,[0,2.50,-.1]);
        m.face([p(x+side*.016,2.713,.1),p(x+side*.035,2.691,.11),p(x+side*.03+breeze,2.368,.09),p(x+side*.006+breeze,2.281,.065)],c.hairShine,[0,2.50,-.1]);
    }
    // Geometric flower clip: an adult beach-accessory detail, not a texture.
    for(let i=0;i<5;i++){
        const a=i*TAU/5;
        m.disk(.192+sway+Math.cos(a)*.028,2.738+rootY+Math.sin(a)*.028,.148,.020,.018,white,5);
    }
    m.disk(.192+sway,2.738+rootY,.15,.011,.011,c.gold,6);
    return m.faces;
}

function buildBall(center,radius=.14,angle=0) {
    const m=new Mesh(),segments=10,rows=5;
    const rings=[];
    for(let j=0;j<=rows;j++)rings.push(Array.from({length:segments},(_,i)=>{
        const lat=-Math.PI/2+j*Math.PI/rows,a=i*TAU/segments+angle;
        return add(center,[Math.sin(a)*radius*Math.cos(lat),Math.sin(lat)*radius,Math.cos(a)*radius*Math.cos(lat)]);
    }));
    for(let j=0;j<rows;j++)for(let i=0;i<segments;i++){
        const k=(i+1)%segments;
        m.face([rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i]],(i+j)%3===0?[64,130,149,255]:COLORS.white,center);
    }
    return m.faces;
}

module.exports={buildCharacter,buildBall};
