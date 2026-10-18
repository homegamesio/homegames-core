'use strict';

// Hand-authored arenas use the same solid-cell grid, raycaster, collision,
// pickups and player views as the original museum. No separate map renderer.
const MAPS = Object.freeze([
    {id:'museum',name:'After Hours Museum',subtitle:'Four galleries at night',palette:{color:'#bfae8f',accent:'#f4d3a1',floor:'#252932',ceiling:'#101821'}},
    {id:'kitchen',name:'Tiny Kitchen',subtitle:'Breakfast, supersized',palette:{color:'#cfb995',accent:'#ffd788',floor:'#394744',ceiling:'#243532'}},
    {id:'neon',name:'Neon Heights',subtitle:'Three neon skybridges',palette:{color:'#434c70',accent:'#f77cc9',floor:'#171d34',ceiling:'#070d23'}},
    {id:'foundry',name:'Red Foundry',subtitle:'Molten steel arena',palette:{color:'#a24e39',accent:'#ffb257',floor:'#302a2c',ceiling:'#190f15'}},
    {id:'orbital',name:'Frost Station',subtitle:'An icy orbital outpost',palette:{color:'#a5c6d4',accent:'#9af7f2',floor:'#1f3548',ceiling:'#0a182c'}}
].map(map => Object.freeze({...map,palette:Object.freeze(map.palette)})));

const spawn = (x,y,angle=0) => ({x,y,angle});
const point = (id,name,x,y) => ({id,name,x,y});
const landmark = (type,label,x,y,width,height,color) => ({id:type+'-'+x+'-'+y,type,label,x,y,width,height,color});
// Wall-mounted faces have a fixed length axis and outward normal. Freestanding
// landmarks retain their camera-facing presentation.
const wallLandmark = (type,label,x,y,width,height,color,axis,face) => ({...landmark(type,label,x,y,width,height,color),axis,face});
const region = (id,name,color,accent,floor,ceiling) => ({id,name,color,accent,floor,ceiling});

function blank(id, solid=false) {
    const map=MAPS.find(item=>item.id===id),width=43,height=43;
    const cells=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>solid||x===0||y===0||x===width-1||y===height-1?1:0));
    const rect=(x,y,w,h,type=1)=>{
        for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){
            if(xx>0&&yy>0&&xx<width-1&&yy<height-1)cells[yy][xx]=type;
        }
    };
    const main=region(id,map.name,map.palette.color,map.palette.accent,map.palette.floor,map.palette.ceiling);
    const wallHeight=id==='kitchen'?8:id==='foundry'?4.5:3.35;
    const world={id,mapId:id,name:map.name,theme:id,palette:map.palette,wallHeight,ceilingHeight:wallHeight,width,height,cells,regions:{main},regionAt:()=>main,
        exhibits:[],screens:[],pickups:[],spawns:[],landmarks:[],wallStyles:{1:{color:main.color,material:'wall'}}};
    world.isWall=(x,y)=>!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=width||y>=height||cells[Math.floor(y)][Math.floor(x)]!==0;
    return {world,rect};
}

function weapons(world, positions) {
    const names=['machinegun','shotgun','rocket','rail','plasma'];
    for(let i=0;i<positions.length;i++){
        const [x,y]=positions[i],weapon=names[i%names.length];
        world.pickups.push({id:world.id+'-'+weapon+'-'+i,x,y,type:'weapon',weapon});
    }
}

function supplies(world, positions) {
    positions.forEach(([x,y,type='health'],i)=>world.pickups.push({id:world.id+'-'+type+'-'+i,x,y,type}));
}

function kitchen() {
    const {world:w,rect}=blank('kitchen');
    w.wallStyles={
        1:{color:'#d7c7a7',material:'paint'},2:{color:'#7ea9a2',material:'fridge'},
        3:{color:'#494e55',material:'stove'},4:{color:'#a26b43',material:'wood'},
        5:{color:'#d88756',material:'cereal'},6:{color:'#d3cbc0',material:'marble'},
        7:{color:'#bccfd2',material:'porcelain'},8:{color:'#b5aaa0',material:'counter'}
    };
    // Appliance row: the wide refrigerator, recessed sink and range loom
    // over a tiny player's eye level. Their fronts open onto a broad aisle.
    rect(3,1,8,7,2);rect(14,1,10,5,8);rect(17,2,5,4,7);rect(29,1,10,7,3);
    // A solid island divides traffic into north/south routes. Pantry cartons
    // make three western aisles; the east side is an open under-table arena.
    rect(17,16,10,8,6);
    rect(2,13,7,3,5);rect(2,21,7,3,5);rect(2,29,7,3,5);
    // Four table legs and two pairs of chair legs; players can run underneath
    // and between them, rather than meeting another generic rectangular room.
    for(const [x,y] of [[29,29],[37,29],[29,37],[37,37]])rect(x,y,2,2,4);
    for(const [x,y] of [[32,26],[35,26],[32,40],[35,40]])rect(x,y,1,2,4);
    w.regions={
        main:w.regions.main,
        appliances:region('appliances','The Appliance Mile','#a2b4ad','#ddf5dd','#394b49','#243d3c'),
        pantry:region('pantry','Cereal Canyon','#cc905f','#ffe0a0','#4b3b32','#332821'),
        island:region('island','The Marble Island','#d3cbc0','#fff2ce','#394744','#263b38'),
        dining:region('dining','Under The Table','#aa7753','#f5be83','#463d36','#2f251e')
    };
    w.regionAt=(x,y)=>y<11?w.regions.appliances:x<12?w.regions.pantry:x>27&&y>25?w.regions.dining:x>13&&x<29&&y>11&&y<29?w.regions.island:w.regions.main;
    w.landmarks=[
        wallLandmark('fridge','POLAR / REFRIGERATOR',7,8.08,6.8,7.3,'#acd1c1','x',1),
        wallLandmark('stove','GAS RANGE / HOT',34,8.08,7.2,5.4,'#aab2ba','x',1),
        wallLandmark('sink','DEEP SINK',20,6.08,6.5,5.2,'#cbe5e7','x',1),
        wallLandmark('island','MARBLE ISLAND',22,24.08,8.8,5,'#ece2cc','x',1),
        wallLandmark('cereal','MOON OATS',9.08,14.5,2.8,5.8,'#f8c26e','y',1),
        wallLandmark('cereal','COSMIC CRUNCH',9.08,22.5,2.8,5.2,'#f6997e','y',1),
        wallLandmark('cereal','STAR FLAKES',9.08,30.5,2.8,5.5,'#b3d577','y',1),
        landmark('table','THE BREAKFAST TABLE',34,34,9.6,6.2,'#bd8957'),
        landmark('chair','DINING CHAIR',34,25.2,4.6,7,'#a4734b')
    ];
    w.teamSpawns={amber:[spawn(3.5,36.5,0),spawn(5.5,36.5,0),spawn(3.5,39.5,0),spawn(8.5,37.5,0)],cyan:[spawn(39.5,9.5,Math.PI),spawn(37.5,10.5,Math.PI),spawn(39.5,13.5,Math.PI),spawn(34.5,10.5,Math.PI)]};
    w.flagBases={amber:{x:4.5,y:37.5},cyan:{x:38.5,y:11.5}};
    w.dominationPoints=[point('A','Appliance Aisle',12.5,10.5),point('B','Island Crossing',21.5,27.5),point('C','Breakfast Table',34.5,34.5)];
    w.spawns=[spawn(12.5,10.5,0),spawn(27.5,10.5,Math.PI/2),spawn(12.5,24.5,0),spawn(21.5,29.5,-Math.PI/2),spawn(34.5,34.5,-Math.PI/2),spawn(38.5,20.5,Math.PI),spawn(12.5,37.5,-Math.PI/2),spawn(4.5,37.5,0)];
    weapons(w,[[12.5,17.5],[12.5,29.5],[31.5,20.5],[26.5,10.5],[34.5,34.5],[21.5,31.5],[9.5,9.5],[39.5,26.5],[24.5,26.5],[15.5,35.5]]);
    supplies(w,[[4.5,10.5],[12.5,35.5],[39.5,18.5],[26.5,37.5],[21.5,10.5,'shield'],[34.5,39.5,'shield']]);
    return w;
}

function neon() {
    const {world:w,rect}=blank('neon',true);
    w.wallStyles={1:{color:'#252d4d',material:'skyline'},2:{color:'#526080',material:'parapet'},3:{color:'#607785',material:'hvac'},4:{color:'#573f79',material:'signal'}};
    // Two large roof decks connect through three separate seven-cell bridges.
    // Closed areas represent adjacent towers, while the playable lanes stay
    // wide enough for dodging and side-by-side teammates.
    rect(2,3,14,36,0);rect(27,3,14,36,0);
    rect(14,5,15,7,0);rect(14,18,15,7,0);rect(14,31,15,7,0);
    rect(5,10,6,6,3);rect(5,26,6,6,3);rect(32,10,6,6,3);rect(32,27,6,6,3);
    rect(18,18,2,2,4);rect(23,23,2,2,4);
    rect(11,5,2,3,2);rect(28,34,2,3,2);
    w.regions={main:w.regions.main,
        west:region('west-roof','Rainlight Roof','#536185','#ff83cf','#192439','#090f29'),
        east:region('east-roof','Dawnline Roof','#4b7280','#77f2f0','#172c38','#071525'),
        bridge:region('skybridges','The Skybridges','#715489','#e9a1ff','#2b2440','#110b28')};
    w.regionAt=x=>x<16?w.regions.west:x>26?w.regions.east:w.regions.bridge;
    w.landmarks=[
        wallLandmark('hvac','ROOF PLANT / 07',8,16.08,5,2.1,'#a0b5c2','x',1),
        wallLandmark('hvac','ROOF PLANT / 12',35,26.92,5,2.1,'#8dc3cb','x',-1),
        landmark('antenna','NIGHT SIGNAL',12.5,35.5,2.2,3.2,'#ff90d0'),
        landmark('antenna','UPLINK',29.5,7.5,2.2,3.2,'#7ceaf1'),
        landmark('billboard','AFTER HOURS / OPEN LATE',21.5,6.2,6.8,2.8,'#ed90d5'),
        landmark('billboard','CITY WITHOUT SLEEP',21.5,36.8,6.8,2.8,'#82eee0')
    ];
    w.screens=[{id:'neon-north',key:'kinetic',title:'NIGHT SIGNAL',x:21.5,y:8.5,angle:Math.PI/2,width:2.5}];
    w.teamSpawns={amber:[spawn(3.5,19.5,0),spawn(4.5,23.5,0),spawn(7.5,20.5,0),spawn(10.5,23.5,0)],cyan:[spawn(39.5,19.5,Math.PI),spawn(38.5,23.5,Math.PI),spawn(35.5,20.5,Math.PI),spawn(32.5,23.5,Math.PI)]};
    w.flagBases={amber:{x:4.5,y:21.5},cyan:{x:38.5,y:21.5}};
    w.dominationPoints=[point('A','North Skybridge',21.5,8.5),point('B','Signal Bridge',21.5,21.5),point('C','South Skybridge',21.5,34.5)];
    w.spawns=[spawn(4.5,7.5,0),spawn(13.5,14.5,Math.PI/2),spawn(4.5,35.5,0),spawn(13.5,28.5,-Math.PI/2),spawn(38.5,7.5,Math.PI),spawn(29.5,14.5,Math.PI/2),spawn(38.5,35.5,Math.PI),spawn(29.5,28.5,-Math.PI/2)];
    weapons(w,[[12.5,21.5],[8.5,7.5],[21.5,21.5],[21.5,34.5],[30.5,21.5],[34.5,7.5],[34.5,35.5],[21.5,8.5],[8.5,35.5],[29.5,17.5]]);
    supplies(w,[[3.5,17.5],[13.5,36.5],[39.5,25.5],[29.5,4.5],[16.5,8.5,'shield'],[26.5,34.5,'shield']]);
    return w;
}

function foundry() {
    const {world:w,rect}=blank('foundry');
    w.wallStyles={1:{color:'#76594b',material:'brick'},2:{color:'#b55437',material:'furnace'},3:{color:'#686263',material:'smelter'},4:{color:'#95634d',material:'conveyor'},5:{color:'#987b45',material:'crate'}};
    rect(7,7,8,8,2);rect(28,28,8,8,2);rect(29,7,7,7,3);rect(7,29,7,7,3);
    // Split conveyors preserve a central crossing and two outer flanks.
    rect(19,16,5,3,4);rect(19,24,5,3,4);
    rect(3,19,4,4,5);rect(36,19,4,4,5);
    rect(16,5,3,2,5);rect(24,36,3,2,5);
    w.regions={main:w.regions.main,
        furnace:region('furnace-line','Furnace Line','#b66a47','#ffb86d','#382d28','#281615'),
        gantry:region('gantry','The Gantry','#89716c','#f6d792','#33313a','#191821'),
        casting:region('casting','Casting Floor','#a15144','#ff947b','#352a30','#23131c')};
    w.regionAt=(x,y)=>y<16?w.regions.furnace:y>27?w.regions.casting:w.regions.gantry;
    w.landmarks=[
        wallLandmark('furnace','FURNACE 01 / MOLTEN',11,15.08,6.9,3.1,'#ff9850','x',1),
        wallLandmark('furnace','FURNACE 02 / MOLTEN',32,27.92,6.9,3.1,'#ffb060','x',-1),
        wallLandmark('conveyor','CASTING BELT',21.5,19.08,4.6,1.7,'#b69b7b','x',1),
        wallLandmark('conveyor','CASTING BELT',21.5,23.92,4.6,1.7,'#b69b7b','x',-1),
        wallLandmark('crate','STEEL / 24',7.08,21,3.5,2.4,'#d2ab6c','y',1),
        wallLandmark('crate','STEEL / 25',35.92,21,3.5,2.4,'#d2ab6c','y',-1),
        landmark('gantry','GANTRY / KEEP CLEAR',21.5,13.5,7.8,3.2,'#efb956')
    ];
    w.teamSpawns={amber:[spawn(18.5,3.5,Math.PI/2),spawn(21.5,5.5,Math.PI/2),spawn(25.5,3.5,Math.PI/2),spawn(27.5,5.5,Math.PI/2)],cyan:[spawn(17.5,39.5,-Math.PI/2),spawn(21.5,37.5,-Math.PI/2),spawn(23.5,39.5,-Math.PI/2),spawn(27.5,39.5,-Math.PI/2)]};
    w.flagBases={amber:{x:21.5,y:4.5},cyan:{x:21.5,y:38.5}};
    w.dominationPoints=[point('A','West Loading Bay',12.5,21.5),point('B','Casting Crossing',21.5,21.5),point('C','East Loading Bay',30.5,21.5)];
    w.spawns=[spawn(4.5,5.5,0),spawn(21.5,4.5,Math.PI/2),spawn(38.5,5.5,Math.PI),spawn(4.5,26.5,0),spawn(38.5,16.5,Math.PI),spawn(4.5,38.5,0),spawn(21.5,38.5,-Math.PI/2),spawn(38.5,38.5,Math.PI)];
    weapons(w,[[11.5,18.5],[17.5,12.5],[21.5,21.5],[33.5,17.5],[25.5,30.5],[31.5,24.5],[17.5,30.5],[25.5,12.5],[10.5,25.5],[21.5,31.5]]);
    supplies(w,[[4.5,12.5],[38.5,30.5],[12.5,4.5],[30.5,39.5],[21.5,11.5,'shield'],[21.5,30.5,'shield']]);
    return w;
}

function orbital() {
    const {world:w,rect}=blank('orbital',true);
    w.wallStyles={1:{color:'#819dad',material:'bulkhead'},2:{color:'#86bfc8',material:'cryopod'},3:{color:'#b4d4dc',material:'reactor'},4:{color:'#627b97',material:'airlock'}};
    // A central cross plus a complete outer ring connects four laboratories.
    // Every quadrant has an inward route and two links around the station.
    rect(3,18,37,7,0);rect(18,3,7,37,0);
    for(const [x,y] of [[3,3],[28,3],[3,28],[28,28]])rect(x,y,12,12,0);
    rect(12,5,19,6,0);rect(12,32,19,6,0);rect(5,12,6,19,0);rect(32,12,6,19,0);
    for(const [x,y] of [[6,6],[34,6],[6,33],[34,33]])rect(x,y,3,4,2);
    rect(18,18,2,2,3);rect(23,23,2,2,3);
    rect(3,18,2,2,4);rect(38,23,2,2,4);
    w.regions={main:w.regions.main,
        cryo:region('cryo','Cryogenic Garden','#8fc6ca','#b0fff0','#193c48','#092532'),
        observatory:region('observatory','The Observatory','#a9bddd','#d1b9ff','#27364f','#101b32'),
        reactor:region('reactor','Reactor Junction','#abcdd1','#a9ffda','#233b43','#0f262a'),
        docking:region('docking','Docking Ring','#91a8c1','#a2d5ff','#2a374a','#152137')};
    w.regionAt=(x,y)=>x>16&&x<27&&y>16&&y<27?w.regions.reactor:y<16?(x<22?w.regions.cryo:w.regions.observatory):y>27?w.regions.docking:w.regions.main;
    w.landmarks=[
        wallLandmark('cryopod','CRYO / 001',7.5,10.08,2.5,3.1,'#a3fff2','x',1),
        wallLandmark('cryopod','CRYO / 002',35.5,10.08,2.5,3.1,'#c7c8ff','x',1),
        wallLandmark('cryopod','CRYO / 003',7.5,32.92,2.5,3.1,'#a3fff2','x',-1),
        wallLandmark('cryopod','CRYO / 004',35.5,32.92,2.5,3.1,'#c7c8ff','x',-1),
        landmark('reactor','REACTOR / ZERO',21.5,16.5,3.8,3.1,'#a6ffe3'),
        landmark('airlock','AMBER DOCK',5.5,21.5,3.6,3.2,'#ffddaa'),
        landmark('airlock','CYAN DOCK',37.5,21.5,3.6,3.2,'#a1eefa')
    ];
    w.screens=[{id:'orbital-tide',key:'tide',title:'DEEP FIELD / TELEMETRY',x:21.5,y:7.5,angle:Math.PI/2,width:2.5}];
    w.teamSpawns={amber:[spawn(7.5,21.5,0),spawn(5.5,23.5,0),spawn(10.5,19.5,0),spawn(12.5,23.5,0)],cyan:[spawn(35.5,21.5,Math.PI),spawn(37.5,19.5,Math.PI),spawn(32.5,23.5,Math.PI),spawn(30.5,19.5,Math.PI)]};
    w.flagBases={amber:{x:7.5,y:21.5},cyan:{x:35.5,y:21.5}};
    w.dominationPoints=[point('A','North Observation',21.5,7.5),point('B','Reactor Junction',21.5,21.5),point('C','Docking Junction',21.5,35.5)];
    w.spawns=[spawn(11.5,11.5,Math.PI/4),spawn(30.5,11.5,Math.PI*3/4),spawn(11.5,30.5,-Math.PI/4),spawn(30.5,30.5,-Math.PI*3/4),spawn(21.5,4.5,Math.PI/2),spawn(21.5,38.5,-Math.PI/2),spawn(4.5,21.5,0),spawn(38.5,21.5,Math.PI)];
    weapons(w,[[12.5,8.5],[8.5,12.5],[21.5,21.5],[30.5,8.5],[34.5,12.5],[30.5,34.5],[34.5,30.5],[21.5,35.5],[12.5,34.5],[8.5,30.5]]);
    supplies(w,[[4.5,4.5],[38.5,4.5],[4.5,38.5],[38.5,38.5],[21.5,12.5,'shield'],[21.5,30.5,'shield']]);
    return w;
}

function createArenaWorld(id) {
    switch(id){
        case 'kitchen': return kitchen();
        case 'neon': return neon();
        case 'foundry': return foundry();
        case 'orbital': return orbital();
        default: return null;
    }
}

module.exports={MAPS,createArenaWorld};
