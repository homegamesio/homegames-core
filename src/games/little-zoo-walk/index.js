const { Game, GameNode, Shapes } = require('squish-150');
const { ZooAudio } = require('./audio');
const { SPECIES, buildAnimal } = require('./animals');
const { TAU, HIDDEN, closed, rect, oval, stroke, heart } = require('./shapes');
const C = {
    ink: [62, 79, 73, 255], cream: [255, 251, 234, 255], leaf: [90, 163, 119, 255],
    mint: [188, 223, 186, 255], coral: [234, 137, 121, 255], gold: [242, 191, 96, 255],
    muted: [113, 133, 116, 255], path: [240, 215, 177, 255], wood: [169, 137, 98, 255],
};
const clamp = (n, max = 100) => Math.max(0, Math.min(max, n));
const ease = p => { p = clamp(p, 1); return p * p * (3 - 2 * p); };
const project = points => points.map(([x, y]) => [clamp(x / 1.5), clamp(y)]);

class LittleZooWalk extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Little Zoo Walk',
            author: "Joseph Garcia",
            createdBy: "Joseph Garcia",
            description: 'Feed six friendly animals, play catch, and collect zoo stamps. Choose your own gentle adventure through colorful habitats.',
            aspectRatio: { x: 3, y: 2 },
            maxPlayers: 1,
            tickRate: 30,
            assets: {},
            gameId: "86f9e9a7-8fd8-527f-ab43-1e55e7d3d7d2"
        };
    }
    constructor({ addAsset } = {}) {
        super(); this.addAsset = addAsset; this.players = new Map(); this.time = 0; this.sound = true;
        this.habitatIndex = 0; this.phase = 'ready'; this.started = 0; this.hellos = 0; this.walks = 0; this.direction = 1;
        this.activity = 'feed'; this.selectedFood = -1;
        this.visits = SPECIES.map(() => ({ fed: 0, played: 0, stamp: false }));
        this.base = this.shape(rect(0, 0, 150, 100), C.cream);
        this.scenery = this.group(this.base); this.buildBackground();
        this.decorLayer = this.group(this.base); this.animalLayer = this.group(this.base);
        this.pathLayer = this.group(this.base); this.buildPath();
        this.visitorLayer = this.group(this.base); this.buildVisitor();
        this.effects = this.group(this.base); this.hearts = Array.from({ length: 7 }, () => this.put(this.effects, this.shape(HIDDEN, C.coral)));
        this.hud = this.group(this.base); this.buildHud();
        this.activityLayer = this.group(this.base); this.buildActivities();
        this.audioRoot = this.group(this.base); this.audio = new ZooAudio(this.audioRoot);
        this.buildHabitat(); this.setText(this.messageLabel,this.activityHint());this.render();
        const touch = this.put(this.base, this.shape(rect(0, 0, 150, 100), null, { onClick: (id, x, y) => this.pointerDown(id, x, y) }));
        // Squish 1.5.0 only reads this hook when attached after construction.
        touch.node.offClick = id => { const player = this.players.get(id); if (player) player.pointer = false; };
    }
    get species() { return SPECIES[this.habitatIndex]; }
    get animalTarget() { return { x: 96 / 1.5, y: 48, radiusX: 36 / 1.5, radiusY: 32 }; }
    get previousTarget() { return { x: 19 / 1.5, y: 91 }; }
    get nextTarget() { return { x: 131 / 1.5, y: 91 }; }
    get visit() { return this.visits[this.habitatIndex]; }
    get ballTarget() { return { x: (57 + Math.sin(this.time * .8) * 11) / 1.5, y: 48 + Math.sin(this.time * 1.3) * 6 }; }
    getLayers() { return [{ root: this.base }]; }
    getAssets() { return this.audio.assets; }
    shape(points, fill, options = {}) { return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: project(points), ...(fill ? { fill } : {}), ...options }); }
    put(parent, node) { parent.addChild(node, false); return node; }
    group(parent) { return this.put(parent, this.shape(HIDDEN)); }
    disk(parent, x, y, rx, ry, fill) { return this.put(parent, this.shape(oval(x, y, rx, ry), fill)); }
    text(parent, value, x, y, size, color = C.ink) {
        return this.put(parent, new GameNode.Text({ textInfo: { text: value, x: x / 1.5, y, size: size / (1.5 * Math.SQRT2), color, align: 'center', font: 'Trebuchet MS, sans-serif' } }));
    }
    setText(node, text) { node.node.text = { ...node.node.text, text }; }
    object(parent) { return { root: this.group(parent), parts: [] }; }
    part(object, points, color, role, pivot = [0, 0]) {
        const node = this.put(object.root, this.shape(HIDDEN, color));
        object.parts.push({ node, points, role, pivot }); return node;
    }
    place(object, x, y, scale = 1, angle = 0, excitement = 0) {
        const ca = Math.cos(angle), sa = Math.sin(angle);
        object.parts.forEach((part, index) => {
            let turn = 0, sx = 1, sy = 1;
            if (part.role === 'ear') turn = excitement * Math.sin(this.time * 13) * .15;
            if (part.role === 'trunk') turn = excitement * -.65;
            if (part.role === 'wing') turn = excitement * (.6 + Math.sin(this.time * 17) * .35);
            if (part.role === 'wing2') turn = excitement * (-.6 - Math.sin(this.time * 17) * .35);
            if (part.role === 'wave') turn = excitement * (1 + Math.sin(this.time * 13) * .4);
            if (part.role === 'leg') turn = excitement * Math.sin(this.time * 11 + index) * .09;
            if (part.role === 'mouth') { sy += excitement * 2; sx += excitement * .5; }
            const ct = Math.cos(turn), st = Math.sin(turn), [px, py] = part.pivot;
            part.node.node.coordinates2d = project(part.points.map(([ox, oy]) => {
                const lx = (ox - px) * sx, ly = (oy - py) * sy;
                const ax = px + lx * ct - ly * st, ay = py + lx * st + ly * ct;
                return [x + (ax * ca - ay * sa) * scale, y + (ax * sa + ay * ca) * scale];
            }));
        });
    }
    buildBackground() {
        this.sky = this.put(this.scenery, this.shape(rect(0, 0, 150, 80), this.species.sky));
        [[32, 24, 8], [115, 19, 7]].forEach(([x, y, r]) => {
            this.disk(this.scenery, x, y, r * 1.5, r * .45, C.cream);
            this.disk(this.scenery, x - r * .5, y - r * .35, r * .6, r * .6, C.cream);
            this.disk(this.scenery, x + r * .3, y - r * .45, r * .65, r * .65, C.cream);
        });
        this.disk(this.scenery, 135, 29, 5.5, 5.5, C.gold);
        this.hill = this.put(this.scenery, this.shape(closed([[0, 55], [20, 48], [44, 54], [73, 48], [109, 52], [150, 46], [150, 81], [0, 81]]), C.mint));
        this.ground = this.put(this.scenery, this.shape(rect(0, 62, 150, 23), this.species.ground));
    }
    buildPath() {
        this.put(this.pathLayer, this.shape(closed([[0, 75], [35, 73], [73, 75], [113, 73], [150, 76], [150, 86], [109, 84], [71, 86], [34, 83], [0, 85]]), C.path));
        this.pathDots = Array.from({ length: 13 }, (_, i) => this.disk(this.pathLayer, i * 13, 80 + (i % 2) * 1.2, 1.5, .55, [221, 191, 153, 255]));
    }
    buildVisitor() {
        this.visitor = this.object(this.visitorLayer);
        const add = (p, color, role, pivot) => this.part(this.visitor, p, color, role, pivot);
        add(oval(0, 8, 7.5, 1.6), [169, 151, 122, 65]);
        add(stroke([[-2.6, -1], [-3.2, 6.5], [-6, 7]], 2.8), [77, 111, 129, 255], 'leg', [-2.6, -1]);
        add(stroke([[2.6, -1], [3.2, 6.5], [6, 7]], 2.8), [77, 111, 129, 255], 'leg', [2.6, -1]);
        add(oval(-5, -7, 3.5, 5.4), C.gold);
        add(stroke([[-3, -10], [-7, -5], [-6, -1]], 2.4), [205, 153, 112, 255]);
        add(stroke([[3, -10], [7, -5], [10, -8]], 2.4), [205, 153, 112, 255], 'wave', [3, -10]);
        add(closed([[-4,-11],[4,-11],[5,0],[-5,0]]), C.coral);
        add(heart(0, -5, 1.8), C.cream);
        add(oval(0, -17, 6, 6.3), [217, 169, 128, 255]);
        add(oval(-2.2, -17, .5, .75), C.ink); add(oval(2.2, -17, .5, .75), C.ink);
        add(stroke([[-1.6,-14.5],[0,-13.8],[1.6,-14.5]], .4), C.ink);
        add(oval(0, -21.5, 7.9, 1.9), C.gold); add(oval(0, -23.2, 5.4, 3.1), C.gold);
        add(rect(-5.2, -23, 10.4, 1.5), C.coral);
    }
    buildHud() {

        this.disk(this.hud, 13, 7.1, 10, 4.1, C.cream);
        this.soundLabel = this.text(this.hud, 'sound on', 13, 5.85, 2);
        this.disk(this.hud, 131, 7.1, 12, 4.1, C.cream);
        this.text(this.hud, 'say hello!', 131, 5.85, 2.1);
        this.put(this.hud, this.shape(rect(0, 86, 150, 14), C.cream));
        for (const [x, direction] of [[19, -1], [131, 1]]) {
            this.disk(this.hud, x, 92, 12, 6.2, C.leaf);
            this.put(this.hud, this.shape(stroke([[x - direction * 3.6,92],[x + direction * 3.6,92]],1.2),C.cream));
            this.put(this.hud, this.shape(stroke([[x+direction*.2,88.7],[x+direction*3.6,92],[x+direction*.2,95.3]],1.2),C.cream));
        }
        this.nameLabel = this.text(this.hud, 'elephant', 75, 87.5, 3.6);
        this.messageLabel = this.text(this.hud, 'Tap the animal to say hello', 75, 93.1, 2.2, C.muted);
        this.visitDots = SPECIES.map((_, i) => this.disk(this.hud, 67.5 + i * 3, 98.2, .7, .7, C.mint));
    }
    foodIcon(parent) {
        const food = this.object(parent), add = (p, c) => this.part(food, p, c);
        const name = this.species.name;
        if (name === 'penguin') {
            add(oval(0, 0, 4.8, 2.7), [101,172,195,255]);
            add(closed([[3,0],[7,-3],[7,3]]), [101,172,195,255]); add(oval(-2,-.5,.45),C.ink);
        } else if (name === 'giraffe' || name === 'zebra') {
            add(stroke([[-4,3],[4,-3]],.55),C.wood);
            [[-2,1],[1,-1],[3,-2]].forEach(([x,y])=>add(oval(x,y,3,1.7),C.leaf));
        } else if (name === 'monkey') {
            add(stroke([[-4,-2],[-3,1],[0,3],[3,2],[5,-1]],2.7),C.gold);
            add(stroke([[-4,-2],[-4,-3]],.65),C.wood);
        } else if (name === 'lion') {
            add(oval(0,0,5,3.5),C.coral); add(oval(0,0,2.8,1.4),C.cream);
        } else {
            add(oval(-1.7,0,3.3,3.7),C.coral); add(oval(1.7,0,3.3,3.7),C.coral);
            add(stroke([[0,-3],[.7,-5]],.7),C.wood);add(oval(2,-4,2,1),C.leaf);
        }
        return food;
    }
    buildActivities() {
        this.activityLayer.clearChildren();
        this.activityButtons = [23,48].map(x=>this.disk(this.activityLayer,x,26,11,7,C.cream));
        this.foodModeIcon = this.foodIcon(this.activityLayer); this.place(this.foodModeIcon,23,24,.7);
        this.text(this.activityLayer,'feed',23,29,1.8);
        this.disk(this.activityLayer,48,24,3,3,C.coral);
        this.put(this.activityLayer,this.shape(stroke([[45,24],[51,24]],.6),C.cream));
        this.text(this.activityLayer,'play',48,29,1.8);
        this.foods = [18,37,56].map(x=>({x, object:this.foodIcon(this.activityLayer)}));
        this.ball = this.object(this.activityLayer);
        this.part(this.ball,oval(0,0,6),C.coral);
        this.part(this.ball,stroke([[-5,0],[5,0]],.9),C.cream);
        this.part(this.ball,stroke([[0,-5],[0,5]],.9),C.cream);
        this.activityDots = [25,36,47].map(x=>this.disk(this.activityLayer,x,35.5,1.2,1.2,C.mint));
        this.feedGuide=Array.from({length:8},()=>this.put(this.activityLayer,this.shape(HIDDEN,C.gold)));
        this.foodHeld = this.foodIcon(this.activityLayer);
    }
    activityHint() {
        if (this.visit.stamp) return 'A zoo stamp! Keep playing or explore';
        return this.activity === 'play' ? 'Tap the moving ball to play catch' : this.selectedFood >= 0 ? 'Now tap the animal to feed it' : 'Pick a snack, then tap the animal';
    }
    completeActivity() {
        if (this.visit.fed >= 3 || this.visit.played >= 3) this.visit.stamp = true;
        this.visitDots.forEach((dot,i)=>{dot.node.fill=this.visits[i].stamp?C.gold:i===this.habitatIndex?C.coral:C.mint;});
    }
    feedAnimal() {
        if (this.phase !== 'ready' || this.selectedFood < 0) return;
        this.phase='feeding'; this.started=this.time; this.visit.fed++;
        this.completeActivity(); this.setText(this.messageLabel,'Yum! Thank you!');
        if(this.sound)this.audio.play(this.species.name);
    }
    catchBall() {
        if(this.phase!=='ready')return;
        this.ballStart=this.ballTarget;this.phase='playing';this.started=this.time;
        this.visit.played++;this.completeActivity();this.setText(this.messageLabel,'Back to you!');
        if(this.sound)this.audio.play(this.species.name);
    }
    buildHabitat() {
        this.decorLayer.clearChildren(); this.animalLayer.clearChildren();
        this.decor = this.object(this.decorLayer);
        const add = (p, c) => this.part(this.decor, p, c);
        const tree = (x, y, scale = 1) => {
            add(rect(x - 1.3 * scale, y - 22 * scale, 2.6 * scale, 23 * scale), C.wood);
            add(stroke([[x,y-12*scale],[x-7*scale,y-19*scale]],1.3*scale),C.wood);
            add(oval(x,y-25*scale,13*scale,6.7*scale),C.leaf);
            add(oval(x-8*scale,y-22*scale,9*scale,4.5*scale),C.leaf);
            add(oval(x+7*scale,y-21*scale,10*scale,5*scale),C.leaf);
            add(oval(x-3*scale,y-27*scale,6*scale,2.7*scale),[124,185,139,255]);
        };
        if (this.species.name === 'penguin') {
            add(oval(98, 68, 36, 6), [118, 191, 211, 255]);
            add(oval(96, 65, 24, 5.7), C.cream);
            add(closed([[7,64],[22,34],[33,55],[44,45],[57,66]]),[235,247,245,255]);
            add(closed([[119,58],[132,42],[146,63]]),[238,250,249,255]);
            add(stroke([[18,65],[32,67],[45,65]],.65),[118,191,211,255]);
        } else {
            tree(18, 64, 1.02); tree(135, 64, .82);
            if (this.species.name === 'monkey') {
                add(stroke([[55,18],[53,30],[58,41],[55,51]],1.2),C.leaf);
                add(oval(55,50,3,1.6),C.leaf);
                [[31,57],[122,55]].forEach(([x,y]) => { add(oval(x,y,8,4),C.leaf); add(oval(x-4,y-3,5,4),C.leaf); });
            } else if (this.species.name === 'elephant') {
                add(oval(113,68,26,5),[128,199,205,255]);
                add(stroke([[102,68],[110,68.7],[119,68]],.6),[205,235,228,255]);
            } else {
                [[60,67],[123,68],[10,68]].forEach(([x,y]) => add(stroke([[x-3,y],[x-2,y-4],[x,y],[x+1,y-3],[x+3,y]],.7),C.leaf));
                if (this.species.name === 'lion') add(oval(102,67,23,4),[205,188,135,255]);
            }
        }
        add(oval(96,73,24,2.2),[71,91,66,35]);
        this.animal = buildAnimal(this, this.animalLayer, this.species.name);
        if(this.activityLayer){this.selectedFood=-1;this.buildActivities();}
        this.sky.node.fill = this.species.sky; this.ground.node.fill = this.species.ground;
        this.hill.node.fill = this.species.ground.map((v, i) => i === 3 ? 255 : Math.round(v + (255 - v) * .34));
        this.setText(this.nameLabel, this.species.name);
        this.completeActivity();
    }
    hello() {
        if (this.phase !== 'ready') return;
        this.phase = 'hello'; this.started = this.time; this.hellos++;
        this.setText(this.messageLabel, this.species.hello);
        if (this.sound) this.audio.play(this.species.name);
    }
    walk(direction) {
        if (this.phase !== 'ready') return;
        this.phase = 'walking'; this.started = this.time; this.direction = direction; this.swapped = false; this.walks++;
        this.setText(this.messageLabel, 'Off we go!'); if (this.sound) this.audio.play('walk');
    }
    render() {
        const age = this.time - this.started;
        const exciting = ['hello','feeding','playing'].includes(this.phase) ? Math.sin(Math.PI * clamp(age / (this.phase==='hello'?1.8:1), 1)) : 0;
        const walking = this.phase === 'walking';
        const p = ease(age / 1.4);
        const shift = walking ? (p < .5 ? -p * 150 : (1 - p) * 150) * this.direction : 0;
        this.place(this.decor, shift, 0);
        const hop = exciting * (this.species.name === 'monkey' ? Math.abs(Math.sin(age * 7)) * 5 : Math.abs(Math.sin(age * 5)) * 1.7);
        const animalY = this.species.name === 'giraffe' ? 54 : this.species.name === 'penguin' ? 57.5 : 57;
        this.place(this.animal, 96 + shift, animalY - hop, 1, exciting * Math.sin(age * 5) * .045, exciting);
        this.place(this.visitor, 42 + (walking ? Math.sin(p * Math.PI) * this.direction * 6 : 0),
            72 - (walking ? Math.abs(Math.sin(age * 12)) * 1.4 : 0), 1, 0, walking ? 1 : exciting * .55);
        this.pathDots.forEach((node, i) => {
            let x = (i * 13 - (walking ? age * 30 * this.direction : 0)) % 156; if (x < 0) x += 156;
            node.node.coordinates2d = project(oval(x - 3, 80 + (i % 2) * 1.2, 1.5, .55));
        });
        this.hearts.forEach((node, i) => {
            const life = age - i * .1;
            node.node.coordinates2d = ['hello','feeding','playing'].includes(this.phase) && life > 0 && life < 1.25
                ? project(heart(75 + i * 6 + Math.sin(life * 3 + i) * 2, 38 - life * 13 - (i % 3) * 3, Math.sin(life / 1.25 * Math.PI) * 1.5)) : HIDDEN;
        });
        const hide = object=>object.parts.forEach(part=>{part.node.node.coordinates2d=HIDDEN;});
        this.activityButtons.forEach((node,i)=>{node.node.fill=(i===0)===(this.activity==='feed')?C.gold:C.cream;});
        const count=this.activity==='feed'?this.visit.fed:this.visit.played;
        this.activityDots.forEach((node,i)=>{node.node.fill=i<Math.min(3,count)?C.coral:C.mint;});
        this.feedGuide.forEach((node,i)=>{
            const angle=i*TAU/8,radius=27+Math.sin(this.time*3)*.7;
            node.node.coordinates2d=this.selectedFood>=0&&this.phase==='ready'?project(stroke(Array.from({length:4},(_,j)=>[96+Math.cos(angle+j*.11)*radius,49+Math.sin(angle+j*.11)*24]),.7)):HIDDEN;
        });
        this.foods.forEach((food,i)=>{
            if(walking||this.activity!=='feed'||i===this.selectedFood)hide(food.object);
            else this.place(food.object,food.x,45,1+Math.sin(this.time*2+i)*.03);
        });
        if(!walking&&this.activity==='feed'&&this.selectedFood>=0){
            const progress=this.phase==='feeding'?ease(age/.75):0;
            this.place(this.foodHeld,49+(88-49)*progress,53+(this.species.name==='giraffe'?-15:-5)*progress-Math.sin(progress*Math.PI)*12,1-progress*.75);
        }else hide(this.foodHeld);
        if(!walking&&this.activity==='play'){
            const start=this.phase==='playing'?this.ballStart:this.ballTarget;
            const progress=this.phase==='playing'?Math.sin(Math.PI*clamp(age,1)):0;
            this.place(this.ball,start.x*1.5+(100-start.x*1.5)*progress,start.y-20*progress,1, this.time*.4);
        }else hide(this.ball);
    }
    tap(x, y) {
        if (![x,y].every(Number.isFinite) || x < 0 || x > 100 || y < 0 || y > 100) return;
        const worldX = x * 1.5;
        if (worldX <= 26 && y <= 14) {
            this.sound = !this.sound; if (!this.sound) this.audio.mute();
            this.setText(this.soundLabel, this.sound ? 'sound on' : 'sound off'); this.base.node.onStateChange(); return;
        }
        if (worldX >= 116 && y <= 14) { this.hello(); return; }
        if(this.phase==='ready' && y>=18 && y<=34 && worldX>=11 && worldX<=60){
            this.activity=worldX<36?'feed':'play';this.selectedFood=-1;
            this.setText(this.messageLabel,this.activityHint());this.render();return;
        }
        if (y >= 84 && worldX <= 35) this.walk(-1);
        else if (y >= 84 && worldX >= 115) this.walk(1);
        else {
            if(this.phase==='ready'&&this.activity==='play'){
                const ball=this.ballTarget;
                if(Math.hypot((x-ball.x)*1.5,y-ball.y)<=12){this.catchBall();return;}
            }
            if(this.phase==='ready'&&this.activity==='feed'&&worldX>=8&&worldX<=65&&y>=36&&y<=53){
                this.selectedFood=Math.max(0,Math.min(2,Math.round((worldX-18)/19)));
                this.setText(this.messageLabel,this.activityHint());this.render();return;
            }
            const t = this.animalTarget;
            if (Math.pow((x-t.x)/t.radiusX,2) + Math.pow((y-t.y)/t.radiusY,2) <= 1) {
                if(this.selectedFood>=0)this.feedAnimal();else this.hello();
            }
        }
    }
    pointerDown(id, x, y) { const p = this.players.get(id); if (!p || p.pointer) return; p.pointer = true; this.tap(x,y); }
    handleMouseUp(id, pos) {
        const p = this.players.get(id); if (!p) return;
        if (!p.pointer && pos) this.tap(pos.x, pos.y); p.pointer = false;
    }
    handleKeyDown(id, key) {
        const p = this.players.get(id); if (!p || p.keys.has(key)) return;
        if (!['ArrowLeft','ArrowRight',' ','Enter','1','2'].includes(key)) return;
        p.keys.add(key);
        if (key === 'ArrowLeft' || key === 'ArrowRight') this.walk(key === 'ArrowLeft' ? -1 : 1);
        else if(this.phase==='ready'&&(key==='1'||key==='2')){this.activity=key==='1'?'feed':'play';this.selectedFood=key==='1'?this.visit.fed%3:-1;this.setText(this.messageLabel,this.activityHint());}
        else if(this.phase==='ready'&&this.activity==='play')this.catchBall();
        else if(this.selectedFood>=0)this.feedAnimal();
        else this.hello();
    }
    handleKeyUp(id, key) { this.players.get(id)?.keys.delete(key); }
    handleNewPlayer({ playerId }) {
        this.players.set(playerId, { pointer: false, keys: new Set() });
        if (!this.assetsRegistered && typeof this.addAsset === 'function') {
            this.assetsRegistered = true;
            for (const [key, asset] of Object.entries(this.audio.assets)) {
                try { this.addAsset(key, asset)?.catch(() => {}); } catch (_) { /* Exploration works silently too. */ }
            }
        }
    }
    handlePlayerDisconnect(id) { this.players.delete(id); }
    tick() {
        if (!this.players.size) return;
        this.time += 1 / 30; this.audio.tick(1 / 30);
        const age = this.time - this.started;
        if (this.phase === 'walking' && age >= .7 && !this.swapped) {
            this.swapped = true; this.habitatIndex = (this.habitatIndex + this.direction + SPECIES.length) % SPECIES.length; this.buildHabitat();
        }
        if ((this.phase === 'walking' && age >= 1.4) || (this.phase === 'hello' && age >= 1.8) || (['feeding','playing'].includes(this.phase)&&age>=1)) {
            this.phase = 'ready';this.selectedFood=-1; this.setText(this.messageLabel, this.activityHint());
        }
        this.render(); this.base.node.onStateChange();
    }
    close() { this.audio.close(); this.players.clear(); super.close(); }
}
module.exports = LittleZooWalk;
