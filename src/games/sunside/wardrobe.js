const OUTFITS=[
    {id:'coast',label:'COAST',description:'Athletic two-piece swimwear'},
    {id:'court',label:'COURT',description:'Volleyball tank and shorts'},
    {id:'summer',label:'SUMMER',description:'Sleeveless summer dress'},
];
function buildWardrobe(m,{outfit='coast',color,rootX=0,rootY=0,cloth=0}){
    const trim=[44,98,104,255],white=[255,247,227,255];
    const p=(x,y,z=0)=>[x+rootX,y+rootY,z];
    const rings=(sections,fill,bias=0)=>m.rings(sections.map(s=>({...s,y:s.y+rootY,x:rootX+(s.x||0)})),fill,16,bias);
    if(outfit==='summer'){
        rings([
            {y:.94,rx:.39,rz:.25,x:cloth},{y:1.18,rx:.345,rz:.22,x:cloth*.6},
            {y:1.44,rx:.295,rz:.18},{y:1.65,rx:.224,rz:.145},
            {y:1.88,rx:.245,rz:.159},{y:2.07,rx:.311,rz:.187},{y:2.16,rx:.316,rz:.166},
        ],color);
        rings([{y:.94,rx:.392,rz:.252,x:cloth},{y:1.00,rx:.381,rz:.245,x:cloth*.9}],white,.018);
        rings([{y:1.62,rx:.233,rz:.155},{y:1.67,rx:.228,rz:.153}],trim,.02);
        // Two fabric ties move slightly with the skirt's secondary motion.
        m.face([p(-.018,1.64,.162),p(.020,1.64,.162),p(.071+cloth,1.41,.190),p(.029+cloth,1.38,.191)],white,null,true);
    }else{
        rings([{y:1.22,rx:.284,rz:.168},{y:1.43,rx:.289,rz:.177},{y:1.57,rx:.251,rz:.157}],trim);
        rings([{y:1.55,rx:.257,rz:.163},{y:1.59,rx:.248,rz:.158}],white,.025);
        if(outfit==='court'){
            rings([{y:1.57,rx:.258,rz:.164},{y:1.68,rx:.224,rz:.148},{y:1.88,rx:.247,rz:.164},{y:2.07,rx:.311,rz:.187},{y:2.18,rx:.316,rz:.166}],color);
            rings([{y:1.58,rx:.257,rz:.163},{y:1.63,rx:.245,rz:.162}],white,.025);
            // Jersey stripe and a geometric badge; no text or asset dependencies.
            m.face([p(-.21,1.99,.18),p(.21,1.99,.18),p(.21,2.035,.19),p(-.21,2.035,.19)],white,null,true);
            m.disk(.16+rootX,2.10+rootY,.18,.026,.028,trim,6);
        }else{
            rings([{y:1.94,rx:.253,rz:.159},{y:2.07,rx:.308,rz:.183},{y:2.16,rx:.314,rz:.16}],color);
            rings([{y:1.94,rx:.256,rz:.162},{y:1.972,rx:.271,rz:.171}],white,.025);
        }
    }
    for(const side of [-1,1]){
        const half = outfit === 'coast' ? .019 : .031;
        m.face([p(side*.19-half,2.12,.16),p(side*.19+half,2.12,.16),p(side*.20+half,2.254,.084),p(side*.20-half,2.254,.084)],color,[0,2,0]);
        m.face([p(side*.20-half,2.254,.084),p(side*.20+half,2.254,.084),p(side*.20+half,2.25,-.091),p(side*.20-half,2.25,-.091)],color,[0,2,0]);
        m.face([p(side*.20-half,2.25,-.091),p(side*.20+half,2.25,-.091),p(side*.19+half,2.12,-.16),p(side*.19-half,2.12,-.16)],color,[0,2,0]);
    }
}
module.exports={OUTFITS,buildWardrobe};
