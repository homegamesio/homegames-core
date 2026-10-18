const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');
const { HaulerAudio } = require('./audio');

const TUNING = {
    tickRate: 30, loadSeconds: .5, driveSeconds: 1.5, tipSeconds: 1.25,
    returnSeconds: 1.1, deliveriesPerRound: 3,
    homeX: 34, destinationX: 64, truckY: 81, particles: 40,
};
const C = {
    sky: [225, 244, 241, 255], cream: [255, 252, 237, 255], ink: [65, 83, 99, 255],
    muted: [113, 140, 139, 255], grass: [180, 220, 166, 255], hill: [205, 232, 187, 255],
    leaf: [116, 185, 142, 255], road: [202, 209, 203, 255], shadow: [174, 187, 179, 255],
    white: [255, 255, 247, 255], pink: [244, 171, 153, 255], window: [235, 252, 247, 255],
};
const PALETTE = [
    [245, 155, 87, 255], [107, 186, 198, 255], [245, 200, 91, 255],
    [232, 125, 119, 255], [155, 145, 203, 255], [130, 191, 142, 255],
];
const TRUCK_COLORS = [PALETTE[0], PALETTE[1], PALETTE[3]];
const TAU = Math.PI * 2;
const HIDDEN = [[0, 0], [0, 0], [0, 0]];
const closed = points => [...points, points[0]];
const clamp = value => Math.max(0, Math.min(100, value));
const mix = (a, b, amount) => a + (b - a) * amount;
const ease = value => { const n = Math.max(0, Math.min(1, value)); return n * n * (3 - 2 * n); };
const tint = (color, amount) => color.map((value, i) => i === 3 ? 255 : Math.round(mix(value, 255, amount)));
const oval = (x, y, rx, ry = rx, n = 24) => Array.from({ length: n + 1 }, (_, i) => [
    x + Math.cos(i * TAU / n) * rx, y + Math.sin(i * TAU / n) * ry,
]);
const star = (x, y, radius, angle = 0) => closed(Array.from({ length: 10 }, (_, i) => {
    const a = angle - Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? radius * .46 : radius;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r];
}));
const stroke = (points, width) => {
    const top = [], bottom = [];
    points.forEach(([x, y], i) => {
        const previous = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
        const angle = Math.atan2(next[1] - previous[1], next[0] - previous[0]);
        top.push([x - Math.sin(angle) * width / 2, y + Math.cos(angle) * width / 2]);
        bottom.unshift([x + Math.sin(angle) * width / 2, y - Math.cos(angle) * width / 2]);
    });
    return closed([...top, ...bottom]);
};

class HappyHaulers extends Game {
    static metadata() {
        return {
            thumbnail: './assets/thumbnail.png',
            name: 'Happy Haulers',
            author: "Joseph Garcia",
            createdBy: "Joseph Garcia",
            description: 'Choose a castle, bridge, or flower garden. Pick colorful loads, drive your smiling truck, and build your own little town.',
            aspectRatio: { x: 1, y: 1 },
            tickRate: TUNING.tickRate,
            maxPlayers: 1,
            assets: {},
            gamepadBindings: { ' ': ['FACE_1', 'FACE_2', 'FACE_3', 'FACE_4'] },
            gameId: "df1017cb-44b2-5ceb-a5d2-b550283201e4"
        };
    }

    constructor({ addAsset } = {}) {
        super();
        this.addAsset = addAsset; this.players = new Map(); this.time = 0;
        this.phase = 'choosing'; this.phaseStarted = 0; this.deliveries = 0; this.round = 0; this.project = 'castle';
        this.projects = ['castle','bridge','garden']; this.projectsBuilt = [0,0,0];
        this.sound = true; this.cargo = []; this.buildings = []; this.truckX = TUNING.homeX;
        this.base = this.shape(ShapeUtils.rectangle(0, 0, 100, 100), C.sky);
        this.scenery = this.group(this.base); this.townLayer = this.group(this.base);
        this.vehicleLayer = this.group(this.base); this.effects = this.group(this.base);
        this.hud = this.group(this.base); this.audioRoot = this.group(this.base);
        this.audio = new HaulerAudio(this.audioRoot);
        this.buildScenery();this.blueprintLayer = this.group(this.scenery); this.buildTruck(); this.buildHud();
        this.targetCue=this.put(this.hud,this.shape(HIDDEN,PALETTE[2]));
        this.choiceLayer=this.group(this.hud);this.supplyLayer=this.group(this.hud);this.buildChoices();this.buildSupply();
        this.particles = Array.from({ length: TUNING.particles }, () => ({
            life: 0, node: this.put(this.effects, this.shape(HIDDEN, [0, 0, 0, 0])),
        }));
        this.drawTruck(); this.updateHud();
        // All artwork remains tappable, including the truck's eyes and wheels.
        const touch = this.put(this.base, this.shape(ShapeUtils.rectangle(0, 0, 100, 100), null, {
            onClick: (id, x, y) => this.pointerDown(id, x, y),
        }));
        // Squish 1.5.0 ignores offClick in its constructor; the dispatcher reads the node hook.
        touch.node.offClick = id => { const p = this.players.get(id); if (p) p.pointer = false; };
    }

    getLayers() { return [{ root: this.base }]; }
    getAssets() { return this.audio.assets; }
    shape(points, fill, options = {}) {
        return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: points, ...(fill ? { fill } : {}), ...options });
    }
    put(parent, node) { parent.addChild(node, false); return node; }
    group(parent) { return this.put(parent, this.shape(HIDDEN)); }
    disk(parent, x, y, rx, ry, color) { return this.put(parent, this.shape(oval(x, y, rx, ry), color)); }
    text(parent, text, x, y, size, color = C.ink, align = 'center') {
        return this.put(parent, new GameNode.Text({ textInfo: {
            text, x, y, size: size / Math.SQRT2, color, align, font: 'Trebuchet MS, sans-serif',
        } }));
    }
    setText(node, text, color = C.ink) { node.node.text = { ...node.node.text, text, color }; }
    dirty() { this.base.node.onStateChange(); }
    cloud(x, y, size) {
        this.disk(this.scenery, x, y, size * 1.7, size * .55, C.white);
        this.disk(this.scenery, x - size * .6, y - size * .35, size * .7, size * .7, C.white);
        this.disk(this.scenery, x + size * .35, y - size * .6, size * .9, size * .9, C.white);
    }
    tree(x, y, scale) {
        this.put(this.scenery, this.shape(ShapeUtils.rectangle(x - .6 * scale, y, 1.2 * scale, 6 * scale), [185, 156, 117, 255]));
        this.disk(this.scenery, x, y, 4.1 * scale, 4.7 * scale, C.leaf);
        this.disk(this.scenery, x - 1.2 * scale, y - 1.5 * scale, 1.5 * scale, 1.6 * scale, tint(C.leaf, .2));
    }
    buildScenery() {
        this.cloud(38, 30, 3); this.cloud(89, 23, 3.6); this.cloud(49, 43, 2.3);
        const sunshine = PALETTE[2];
        for (let i = 0; i < 10; i++) {
            const a = i * TAU / 10;
            this.put(this.scenery, this.shape(stroke([[17 + Math.cos(a) * 6.2, 31 + Math.sin(a) * 6.2],
                [17 + Math.cos(a) * 7.3, 31 + Math.sin(a) * 7.3]], .55), sunshine));
        }
        this.disk(this.scenery, 17, 31, 5, 5, sunshine);
        this.disk(this.scenery, 15.5, 30.6, .3, .45, C.ink); this.disk(this.scenery, 18.5, 30.6, .3, .45, C.ink);
        this.put(this.scenery, this.shape(stroke([[15.9, 32.2], [17, 32.7], [18.1, 32.2]], .3), C.ink));
        this.put(this.scenery, this.shape(closed([[0, 54], [18, 47], [34, 49], [48, 55], [68, 48], [85, 46], [100, 51], [100, 100], [0, 100]]), C.hill));
        this.put(this.scenery, this.shape(closed([[0, 62], [21, 58], [45, 64], [70, 58], [100, 59], [100, 100], [0, 100]]), C.grass));
        this.tree(7, 49, .8); this.tree(43, 53, .75); this.tree(95, 49, .85);
        // A tiny toy neighborhood gives the truck somewhere friendly to work.
        [[18, 53, PALETTE[3]], [31, 55, PALETTE[1]]].forEach(([x, y, color]) => {
            this.put(this.scenery, this.shape(ShapeUtils.rectangle(x - 4, y - 7, 8, 9), C.cream));
            this.put(this.scenery, this.shape(closed([[x - 5.2, y - 7], [x, y - 12], [x + 5.2, y - 7]]), color));
            this.put(this.scenery, this.shape(ShapeUtils.rectangle(x - 1, y - 1.3, 2, 3.3), tint(color, .35)));
            this.disk(this.scenery, x, y - 5, 1.2, 1.2, tint(color, .45));
        });
        this.disk(this.scenery, 75, 59.2, 18, 2.1, [157, 198, 146, 255]);
        this.put(this.scenery, this.shape(ShapeUtils.rectangle(60, 56.5, 30, 2.2), C.cream));
        this.put(this.scenery, this.shape(ShapeUtils.rectangle(0, 71, 100, 19), C.road));
        this.put(this.scenery, this.shape(ShapeUtils.rectangle(0, 70.2, 100, .8), C.cream));
        this.put(this.scenery, this.shape(ShapeUtils.rectangle(0, 89.8, 100, .8), C.cream));
        for (let x = 2; x < 100; x += 14) this.put(this.scenery, this.shape(ShapeUtils.rectangle(x, 87, 7, .65), C.cream));
        [[9, 65], [48, 66], [93, 65]].forEach(([x, y]) => {
            this.put(this.scenery, this.shape(stroke([[x, y], [x + .7, y - 1.7], [x + 1.4, y]], .32), C.leaf));
        });
        this.truckShadow = this.disk(this.vehicleLayer, TUNING.homeX, 85.9, 27, 1.6, C.shadow);
    }
    object(parent) { return { root: this.group(parent), parts: [] }; }
    part(object, points, color, recolor = false) {
        const node = this.put(object.root, this.shape(points, color));
        object.parts.push({ points, node, recolor }); return node;
    }
    place(object, x, y, scale = 1, angle = 0) {
        const ca = Math.cos(angle), sa = Math.sin(angle);
        for (const p of object.parts) p.node.node.coordinates2d = p.points.map(([px, py]) => [
            clamp(x + (px * ca - py * sa) * scale), clamp(y + (px * sa + py * ca) * scale),
        ]);
    }
    buildTruck() {
        const bodyColor = TRUCK_COLORS[0];
        this.bed = this.object(this.vehicleLayer);
        this.part(this.bed, closed([[0, -13], [28, -13], [25, 0], [3, 0]]), bodyColor, true);
        this.part(this.bed, closed([[2, -10.8], [25, -10.8], [23.4, -3], [4, -3]]), tint(bodyColor, .3));
        this.bedInset = this.bed.parts[this.bed.parts.length - 1].node;
        [7, 14, 21].forEach(x => this.part(this.bed, stroke([[x, -10], [x - .8, -3.8]], .5), bodyColor, true));
        this.part(this.bed, stroke([[0, -13], [28, -13]], 1.6), C.cream);
        this.cargoLayer = this.group(this.vehicleLayer);
        this.truck = this.object(this.vehicleLayer);
        this.part(this.truck, ShapeUtils.rectangle(-24, -4, 51, 4.5), C.ink);
        this.part(this.truck, closed([[5, -21], [21, -21], [25, -11], [28, -10], [28, -2], [4, -2]]), bodyColor, true);
        this.part(this.truck, closed([[8, -18.5], [19.1, -18.5], [22, -10.7], [8, -10.7]]), C.window);
        this.part(this.truck, oval(11.3, -14, .62, .95), C.ink);
        this.part(this.truck, oval(17.8, -14, .62, .95), C.ink);
        this.part(this.truck, stroke([[12.6, -12], [14.5, -11.4], [16.2, -12]], .4), C.ink);
        this.part(this.truck, oval(9.5, -12.1, 1, .42), C.pink);
        this.part(this.truck, oval(20, -12.1, 1, .42), C.pink);
        this.part(this.truck, ShapeUtils.rectangle(9, -8.7, 3, .6), tint(bodyColor, .62));
        this.part(this.truck, ShapeUtils.rectangle(26, -9, 2.7, 3), C.cream);
        this.part(this.truck, ShapeUtils.rectangle(26.6, -3, 3, 1.6), C.cream);
        this.part(this.truck, ShapeUtils.rectangle(11.5, -23, 6, 2), C.ink);
        this.part(this.truck, oval(14.5, -23.1, 2.1, 1.5), PALETTE[2]);
        this.part(this.truck, star(-11, -1.4, 1.1), C.cream);
        this.wheels = [-16.5, 17].map(x => {
            const wheel = this.object(this.vehicleLayer); wheel.x = x;
            this.part(wheel, oval(0, 0, 5.8, 5.8), C.ink);
            this.part(wheel, oval(0, 0, 3.4, 3.4), C.cream);
            this.part(wheel, oval(0, 0, 2.25, 2.25), bodyColor, true);
            this.part(wheel, oval(0, 0, .65, .65), C.ink);
            for (let i = 0; i < 3; i++) {
                const a = i * TAU / 3;
                this.part(wheel, oval(Math.cos(a) * 1.5, Math.sin(a) * 1.5, .28, .28, 12), C.cream);
            }
            return wheel;
        });
    }
    buildHud() {

        this.message = this.text(this.hud, 'What shall we build?', 50, 16.5, 2.25);
        this.progress = Array.from({ length: TUNING.deliveriesPerRound }, (_, i) =>
            this.disk(this.hud, 69 + i * 6, 23.1, 1.6, 1.6, tint(TRUCK_COLORS[i], .68)));
        this.disk(this.hud, 91, 8.3, 6, 3.1, C.white);
        this.soundLabel = this.text(this.hud, 'sound on', 91, 7.35, 1.5, C.muted);
        this.actionDots = [35, 50, 65].map(x => this.disk(this.hud, x, 94.4, 5.5, 3.3, C.cream));
        this.actionLabels=['load','drive','tip!'].map((value,i)=>this.text(this.hud,value,35+i*15,93.3,2,C.ink));

    }
    buildChoices() {
        this.choiceCards=this.projects.map((name,i)=>{
            const card=this.object(this.choiceLayer),x=20+i*30;
            this.part(card,oval(0,0,13,13),C.cream);
            const color=TRUCK_COLORS[i];
            if(name==='castle'){
                [-5,0,5].forEach(dx=>{this.part(card,ShapeUtils.rectangle(dx-2,-4,4,10),color);this.part(card,closed([[dx-3,-4],[dx,-8],[dx+3,-4]]),PALETTE[2]);});
            }else if(name==='bridge'){
                [-6,6].forEach(dx=>this.part(card,ShapeUtils.rectangle(dx-2,-1,4,8),color));
                this.part(card,ShapeUtils.rectangle(-10,-4,20,4),color);
                this.part(card,stroke([[-9,-7],[-9,-4],[9,-4],[9,-7]],.8),C.ink);
            }else{
                [-5,0,5].forEach((dx,j)=>{
                    this.part(card,stroke([[dx,6],[dx,-4-j%2*2]],.8),C.leaf);
                    this.part(card,oval(dx,-4-j%2*2,3),PALETTE[j]);this.part(card,oval(dx,-4-j%2*2,1),PALETTE[2]);
                });
            }
            card.x=x;this.place(card,x,37);return card;
        });
        this.choiceLabels=this.projects.map((name,i)=>this.text(this.choiceLayer,name,20+i*30,51,2));
    }
    buildSupply() {
        this.supplyLayer.clearChildren();
        this.supplies=[0,1,2].map(i=>{
            const root=this.group(this.supplyLayer),x=15+i*17;
            const disk=this.disk(root,x,28,7.5,7.5,C.cream);
            const block=this.makeBlock(root,PALETTE[(i+this.round)%6],this.deliveries===2);
            this.place(block,x,28,.8);
            return {root,x,block,disk};
        });
    }
    chooseProject(index) {
        if(this.phase!=='choosing')return;
        this.project=this.projects[index];this.blueprintLayer.clearChildren();
        for(let stage=0;stage<3;stage++)for(let i=0;i<3;i++){
            const block=this.makeBlock(this.blueprintLayer,[220,234,201,255],stage===2,stage);
            block.parts.forEach(part=>{part.node.node.fill=[220,234,201,255];});
            this.place(block,65+i*10,52-stage*9.6);
        }
        this.buildSupply();this.enter('ready');this.playNote(3);
    }
    makeBlock(parent, color, roof = false, stage = this.deliveries) {
        const block = this.object(parent); block.roof = roof;
        if(this.project==='garden'){
            if(stage===0){this.part(block,closed([[-4,-4],[4,-4],[3,4],[-3,4]]),color);this.part(block,ShapeUtils.rectangle(-4.5,-4,9,1.5),tint(color,.3));}
            else if(stage===1){this.part(block,stroke([[0,6],[0,-5]],1),C.leaf);this.part(block,oval(-2,0,3,1.8),C.leaf);this.part(block,oval(2,-3,3,1.8),C.leaf);}
            else{for(let i=0;i<5;i++){const a=i*TAU/5;this.part(block,oval(Math.cos(a)*2.6,Math.sin(a)*2.6,2.5),color);}this.part(block,oval(0,0,1.8),PALETTE[2]);}
        }else if(this.project==='bridge'){
            if(stage===0)this.part(block,ShapeUtils.rectangle(-3,-5,6,10),color);
            else if(stage===1){this.part(block,ShapeUtils.rectangle(-5.2,-1.8,10.4,3.6),color);this.part(block,stroke([[-4,0],[4,0]],.4),C.cream);}
            else{this.part(block,stroke([[-4,4],[-4,-3],[4,-3],[4,4]],.9),color);}
        }else if (roof) {
            this.part(block, closed([[-4.8, 4], [0, -4.2], [4.8, 4]]), color);
            this.part(block, closed([[-2.4, 2.2], [0, -1.9], [2.4, 2.2]]), tint(color, .35));
        } else {
            this.part(block, ShapeUtils.rectangle(-4.3, -4.3, 8.6, 8.6), color);
            this.part(block, ShapeUtils.rectangle(-3.5, -3.5, 7, 1.1), tint(color, .3));
            this.part(block, oval(0, .15, 2.1, 2.1), tint(color, .55));
            this.part(block, star(0, .15, 1.3), C.cream);
        }
        return block;
    }
    createCargo(choice=0) {
        const i=this.cargo.length;
        if(i>=3)return;
            const block = this.makeBlock(this.cargoLayer, PALETTE[(choice + this.round) % 6], this.deliveries === 2);
            block.index = i; block.targetX = 65 + i * 10; block.targetY = 52 - this.deliveries * 9.6;
            block.sourceX=this.supplies[choice].x;this.cargo.push(block);
    }
    updateHud() {
        const labels = {
            choosing:'What shall we build?', ready: `Pick a load! ${this.cargo.length} of 3`, loading: 'Plop! Into the truck!', loaded: 'Tap your truck. Let\'s roll!',
            driving: 'Here comes your happy truck!', arrived: 'Tap the building site to tip!',
            unloading: 'Tip, tip, hooray!', returning: 'Beep beep! More building!', celebrate: `You built a ${this.project}!`,
        };
        this.setText(this.message, labels[this.phase]);
        const step = ['choosing','ready', 'loading'].includes(this.phase) ? 0 : ['loaded', 'driving'].includes(this.phase) ? 1 : 2;
        this.actionDots.forEach((node, i) => { node.node.fill = i === step ? tint(TRUCK_COLORS[this.deliveries % 3], .2) : C.cream; });
        this.progress.forEach((node, i) => { node.node.fill = i < this.deliveries ? TRUCK_COLORS[i] : tint(TRUCK_COLORS[i], .68); });
        this.actionLabels.forEach((node,i)=>this.setText(node,this.phase==='celebrate'?(i===1?'again':''):['load','drive','tip!'][i]));
    }
    enter(phase) { this.phase = phase; this.phaseStarted = this.time; this.updateHud(); }
    playNote(note) { if (this.sound) this.audio.play(note); }
    advance(choice=0) {
        if(this.phase==='choosing'){this.chooseProject(choice);return;}
        if(this.phase==='celebrate'){this.resetRound();this.drawTruck();this.dirty();return;}
        if (this.phase === 'ready') {
            this.createCargo(choice); this.enter('loading'); this.playNote(0);
        } else if (this.phase === 'loaded') {
            this.enter('driving'); this.playNote(2);
        } else if (this.phase === 'arrived') {
            this.enter('unloading'); this.playNote(4);
        }
        this.drawTruck(); this.dirty();
    }
    finishDelivery() {
        for (const cargo of this.cargo) {
            this.cargoLayer.removeChild(cargo.root.id);
            this.townLayer.addChild(cargo.root, false);
            this.place(cargo, cargo.targetX, cargo.targetY);
            this.buildings.push(cargo);
        }
        this.cargo = []; this.deliveries++;
        this.burst(75, 40, 16); this.playNote(5);
        if (this.deliveries === TUNING.deliveriesPerRound) {
            this.round++;this.projectsBuilt[this.projects.indexOf(this.project)]++; this.enter('celebrate'); this.playNote('celebrate');
            this.burst(47, 40, 16);
            this.flag = this.object(this.townLayer);
            this.part(this.flag, stroke([[0, 1], [0, -8]], .45), C.ink);
            this.part(this.flag, closed([[.2, -8], [5, -6.4], [.2, -4.8]]), PALETTE[3]);
            this.place(this.flag, 75, 30);
        } else this.enter('returning');
    }
    resetRound() {
        this.deliveries = 0; this.townLayer.clearChildren(); this.buildings = []; this.flag = null;
        this.blueprintLayer.clearChildren();this.truckX=TUNING.homeX;this.enter('choosing');
    }
    setTruckColor() {
        const color = TRUCK_COLORS[(this.deliveries + this.round) % TRUCK_COLORS.length];
        for (const object of [this.truck, this.bed, ...this.wheels]) {
            for (const part of object.parts) if (part.recolor) part.node.node.fill = color;
        }
        this.bedInset.node.fill = tint(color, .3);
    }
    drawTruck() {
        const elapsed = this.time - this.phaseStarted;
        let tip = 0;
        if (this.phase === 'driving') this.truckX = mix(TUNING.homeX, TUNING.destinationX, ease(elapsed / TUNING.driveSeconds));
        if (this.phase === 'returning') this.truckX = mix(TUNING.destinationX, TUNING.homeX, ease(elapsed / TUNING.returnSeconds));
        if (this.phase === 'unloading') tip = -.58 * Math.sin(Math.PI * Math.min(1, elapsed / TUNING.tipSeconds));
        const moving = this.phase === 'driving' || this.phase === 'returning';
        const bounce = moving ? Math.sin(elapsed * 15) * .35 : Math.sin(this.time * 2) * .12;
        const y = TUNING.truckY + bounce;
        this.truckShadow.node.coordinates2d = oval(this.truckX, 85.9, 27, 1.6);
        this.place(this.bed, this.truckX - 24, y - 4, 1, tip);
        this.place(this.truck, this.truckX, y);
        for (const wheel of this.wheels) this.place(wheel, this.truckX + wheel.x, y, 1, moving ? (this.truckX - TUNING.homeX) / 5.8 : 0);
        for (const cargo of this.cargo) {
            const localX = 5 + cargo.index * 8, localY = -15;
            let x = this.truckX - 24 + localX * Math.cos(tip) - localY * Math.sin(tip);
            let blockY = y - 4 + localX * Math.sin(tip) + localY * Math.cos(tip);
            let scale = .86, angle = tip;
            if (this.phase === 'loading'&&cargo.index===this.cargo.length-1) {
                const p = ease(elapsed / TUNING.loadSeconds);
                x=mix(cargo.sourceX,x,p);blockY = mix(28, blockY, p)-Math.sin(p*Math.PI)*9;
                angle = (1 - p) * (cargo.index - 1) * .2;
            } else if (this.phase === 'unloading') {
                const p = ease((elapsed / TUNING.tipSeconds - .15 - cargo.index * .12) / .6);
                x = mix(x, cargo.targetX, p);
                blockY = mix(blockY, cargo.targetY, p) - Math.sin(p * Math.PI) * 9;
                scale = mix(.86, 1, p); angle = tip * (1 - p);
            }
            this.place(cargo, x, blockY, scale, angle);
        }
        if (this.phase === 'celebrate') {
            this.buildings.forEach((block, i) => this.place(block, block.targetX,
                block.targetY - Math.abs(Math.sin(elapsed * 3.5 + Math.floor(i / 3) * .4)) * .45));
            if (this.flag) this.place(this.flag, 75, 30, 1, Math.sin(this.time * 3) * .05);
        }
        if(this.choiceCards){
            const cueY=25+Math.sin(this.time*4)*1.2;
            this.targetCue.node.coordinates2d=this.phase==='arrived'?closed([[70,cueY],[75,cueY+4],[80,cueY],[77,cueY],[75,cueY+1.7],[73,cueY]]):this.phase==='loaded'?closed([[this.truckX+7,53],[this.truckX+12,57],[this.truckX+17,53],[this.truckX+14,53],[this.truckX+12,54.7],[this.truckX+10,53]]):HIDDEN;
            this.choiceCards.forEach(card=>{if(this.phase==='choosing')this.place(card,card.x,37);else card.parts.forEach(p=>p.node.node.coordinates2d=HIDDEN);});
            this.choiceLabels.forEach((node,i)=>this.setText(node,this.phase==='choosing'?this.projects[i]:''));
            this.supplies.forEach((s,i)=>{
                const visible=this.phase==='ready'||this.phase==='loading';
                s.disk.node.coordinates2d=visible?oval(s.x,28,7.5+Math.sin(this.time*3+i)*.2,7.5):HIDDEN;
                if(visible)this.place(s.block,s.x,28,.8);else s.block.parts.forEach(p=>p.node.node.coordinates2d=HIDDEN);
            });
        }
    }
    burst(x, y, count) {
        for (const p of this.particles) {
            if (count <= 0) break;
            if (p.life > 0) continue;
            const a = Math.random() * TAU, speed = 5 + Math.random() * 8;
            p.x = x; p.y = y; p.vx = Math.cos(a) * speed; p.vy = Math.sin(a) * speed - 4;
            p.life = .8 + Math.random() * .6; p.size = .6 + Math.random() * .6; p.turn = a;
            p.node.node.fill = PALETTE[count % PALETTE.length]; count--;
        }
    }
    handleNewPlayer({ playerId }) {
        this.players.set(playerId, { pointer: false, keys: new Set() });
        if (!this.assetsRegistered && typeof this.addAsset === 'function') {
            this.assetsRegistered = true;
            for (const [key, asset] of Object.entries(this.audio.assets)) {
                try { this.addAsset(key, asset)?.catch(() => {}); } catch (_) { /* The truck can play silently. */ }
            }
        }
    }
    handlePlayerDisconnect(id) { this.players.delete(id); }
    pointerDown(id, x, y) {
        const p = this.players.get(id); if (!p || p.pointer) return;
        p.pointer = true; this.tap(x, y);
    }
    handleMouseUp(id, position) {
        const p = this.players.get(id); if (!p) return;
        if (!p.pointer && position) this.tap(position.x, position.y);
        p.pointer = false;
    }
    tap(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 100 || y > 100) return;
        if (x >= 83 && y <= 13) {
            this.sound = !this.sound;
            if (!this.sound) this.audio.mute(); else this.audio.play(4);
            this.setText(this.soundLabel, this.sound ? 'sound on' : 'sound off', C.muted);
            this.dirty(); return;
        }
        if(this.phase==='choosing'&&x>=6&&x<=94&&y>=22&&y<=56){this.advance(Math.max(0,Math.min(2,Math.round((x-20)/30))));return;}
        if(this.phase==='celebrate'&&x>=35&&x<=65&&y>=89){this.advance();return;}
        if(this.phase==='ready'&&y>=19&&y<=38&&x>=6&&x<=58){this.advance(Math.max(0,Math.min(2,Math.round((x-15)/17))));return;}
        if(this.phase==='loaded'&&((x>=this.truckX-29&&x<=this.truckX+31&&y>=56&&y<=89)||(x>=42&&x<=58&&y>=90))){this.advance();return;}
        if(this.phase==='arrived'&&((x>=53&&x<=97&&y>=27&&y<=61)||(x>=58&&x<=73&&y>=90)))this.advance();
    }
    handleKeyDown(id, key) {
        const p = this.players.get(id);
        if (!p || typeof key !== 'string' || p.keys.has(key)) return;
        if (!['Enter',' ','1','2','3'].includes(key)) return;
        p.keys.add(key); this.advance(['1','2','3'].includes(key)?Number(key)-1:0);
    }
    handleKeyUp(id, key) { this.players.get(id)?.keys.delete(key); }
    tick() {
        if (!this.players.size) return;
        const dt = 1 / TUNING.tickRate; this.time += dt; this.audio.tick(dt);
        const elapsed = this.time - this.phaseStarted;
        if (this.phase === 'loading' && elapsed >= TUNING.loadSeconds) this.enter(this.cargo.length===3?'loaded':'ready');
        else if (this.phase === 'driving' && elapsed >= TUNING.driveSeconds) {
            this.truckX = TUNING.destinationX; this.enter('arrived');
        } else if (this.phase === 'unloading' && elapsed >= TUNING.tipSeconds) this.finishDelivery();
        else if (this.phase === 'returning' && elapsed >= TUNING.returnSeconds) {
            this.truckX = TUNING.homeX; this.setTruckColor();this.buildSupply(); this.enter('ready');
        }
        this.drawTruck();
        for (const p of this.particles) {
            if (p.life <= 0) continue;
            p.life -= dt;
            if (p.life <= 0) { p.node.node.coordinates2d = HIDDEN; p.node.node.fill = [0, 0, 0, 0]; continue; }
            p.x += p.vx * dt; p.y += p.vy * dt; p.vy += dt * 8;
            const size = p.size * Math.min(1, p.life * 3);
            const x = Math.max(size, Math.min(100 - size, p.x)), y = Math.max(size, Math.min(100 - size, p.y));
            p.node.node.coordinates2d = star(x, y, size, p.turn + this.time);
        }
        this.dirty();
    }
    close() { this.audio.close(); this.players.clear(); super.close(); }
}

module.exports = HappyHaulers;
