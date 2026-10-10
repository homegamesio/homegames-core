const { Game, GameNode, Shapes, ShapeUtils } = require('squish-142');
const { CafeAudio } = require('./audio');
const { ANIMALS, OUTFITS, createCustomer } = require('./customers');
const { makePaperCup, addWhippedCream, makeCreamDispenser } = require('./cream');

const C = {
    cream: [255, 239, 202, 255], white: [255, 251, 231, 255], coral: [217, 77, 47, 255],
    orange: [239, 128, 55, 255], gold: [244, 183, 53, 255], peach: [248, 192, 144, 255],
    mint: [159, 207, 168, 255], teal: [40, 124, 112, 255], brown: [88, 47, 30, 255],
    coffee: [133, 72, 36, 255], caramel: [190, 123, 66, 255], milk: [255, 225, 165, 255],
    whip: [255, 252, 229, 255], foam: [255, 252, 229, 255], chocolate: [92, 49, 32, 255], water: [203, 150, 89, 255],
};
const TUNING = { tickRate: 30, actionSeconds: 1, artSeconds: .8, serveSeconds: 1.1, cheerSeconds: 1.8, particles: 32 };
// Author the landscape UI in square units; project to Squish's 0–100 axes.
const VIEW = { width: 150, aspect: 1.5, stageScale: 1.34, stageX: 8, stageY: -14 };
const CREAM_POUR = { x: 61, y: 36, angle: -2.3 };
const INGREDIENTS = ['chocolate', 'espresso', 'water', 'milk', 'foam', 'whip'];
const RECIPES = [
    { name: 'espresso', steps: ['grind', 'tamp', 'espresso'], layers: { espresso: .36 }, color: C.coral },
    { name: 'americano', steps: ['grind', 'tamp', 'espresso', 'water'], layers: { espresso: .22, water: .59 }, color: C.gold },
    { name: 'cortado', steps: ['grind', 'tamp', 'espresso', 'milk'], layers: { espresso: .4, milk: .4 }, color: C.teal },
    { name: 'cappuccino', steps: ['grind', 'tamp', 'espresso', 'milk', 'foam'], layers: { espresso: .24, milk: .22, foam: .38 }, color: C.orange },
    { name: 'latte', steps: ['grind', 'tamp', 'espresso', 'milk', 'foam'], layers: { espresso: .14, milk: .59, foam: .11 }, color: C.mint },
    { name: 'mocha', steps: ['chocolate', 'grind', 'tamp', 'espresso', 'milk', 'foam'], layers: { chocolate: .12, espresso: .19, milk: .39, foam: .14 }, color: C.coral },
    { name: 'coffee cream', steps: ['cup', 'whip'], layers: { whip: 1 }, paper: true, color: C.coral },
];
const STEP_NAMES = {
    grind: 'Grind the beans', tamp: 'Tamp the coffee', espresso: 'Pour the espresso', water: 'Add warm water',
    milk: 'Pour the milk', foam: 'Fluffy milk foam', chocolate: 'A little chocolate',
    cup: 'Pick the paper cup', whip: 'Add whipped cream', serve: 'Serve our friend!',
};
// Authored counter coordinates; the same geometry drives both the ring and taps.
const TARGETS = {
    grind: { x: 19, y: 50, rx: 9, ry: 9 },
    tamp: { x: 33, y: 59, rx: 9, ry: 9 },
    espresso: { x: 60, y: 36, rx: 6, ry: 6 },
    water: { x: 80, y: 60, rx: 7, ry: 7 },
    milk: { x: 80, y: 60, rx: 7, ry: 7 },
    foam: { x: 76, y: 44, rx: 6, ry: 6 },
    chocolate: { x: 6.5, y: 62, rx: 5.5, ry: 5.5 },
    cup: { x: 53.5, y: 59.8, rx: 9, ry: 9 },
    whip: { x: 80, y: 59, rx: 8, ry: 8 },
    serve: { x: 91, y: 39, rx: 10, ry: 19 },
};
const HIDDEN = [[0, 0], [0, 0], [0, 0]], TAU = Math.PI * 2;
const closed = points => [...points, points[0]];
const mix = (a, b, p) => a + (b - a) * p;
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const ease = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
const oval = (x, y, rx, ry = rx, n = 24) => Array.from({ length: n + 1 }, (_, i) => [x + Math.cos(i * TAU / n) * rx, y + Math.sin(i * TAU / n) * ry]);
const heart = (x, y, size) => closed(Array.from({ length: 40 }, (_, i) => {
    const t = i * TAU / 40;
    return [x + Math.pow(Math.sin(t), 3) * size, y - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * size / 16];
}));
const stroke = (points, width) => {
    const top = [], bottom = [];
    points.forEach(([x, y], i) => {
        const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
        const a = Math.atan2(after[1] - before[1], after[0] - before[0]);
        top.push([x - Math.sin(a) * width / 2, y + Math.cos(a) * width / 2]);
        bottom.unshift([x + Math.sin(a) * width / 2, y - Math.cos(a) * width / 2]);
    });
    return closed([...top, ...bottom]);
};
const liquidShape = (bottom, top) => {
    const width = y => 5.05 + (4.9 - y) * .108;
    return closed([[-width(top), top], [width(top), top], [width(bottom), bottom], [-width(bottom), bottom]]);
};

class TinyBeanCafe extends Game {
    static metadata() {
        return {
            name: 'Tiny Bean Café', squishVersion: '142', author: 'Joseph Garcia', createdBy: 'Joseph Garcia',
            description: 'A colorful pretend café for little hands. Follow animal orders, tap the glowing tools, make seven little treats including whipped-cream cups, then tap the customer to serve. Gentle sounds and endless play.',
            aspectRatio: { x: 3, y: 2 }, tickRate: TUNING.tickRate, maxPlayers: 1, services: [], assets: {},
        };
    }
    constructor({ addAsset, random = Math.random } = {}) {
        super();
        this.customerRandom = random; this.animalBag = []; this.outfitBag = []; this.clothingBag = []; this.orderBag = [];
        this.addAsset = addAsset; this.players = new Map(); this.time = 0; this.sound = true;
        this.selectedRecipe = 6; this.drinksServed = 0; this.phase = 'ready'; this.phaseStarted = 0;
        this.stepIndex = 0; this.ingredients = {}; this.cupLayers = {}; this.artProgress = 0;
        this.base = this.shape(ShapeUtils.rectangle(0, 0, VIEW.width, 100), C.cream);
        this.scenery = this.group(this.base);
        this.equipmentLayer = this.group(this.base); this.cupLayer = this.group(this.base);
        this.effects = this.group(this.base); this.highlightLayer = this.group(this.base); this.hud = this.group(this.base); this.audioRoot = this.group(this.base);
        for (const layer of [this.highlightLayer, this.equipmentLayer, this.cupLayer, this.effects]) layer.cafeStage = true;
        this.audio = new CafeAudio(this.audioRoot);
        this.buildRoom(); this.buildEquipment(); this.buildHud();
        this.particles = Array.from({ length: TUNING.particles }, () => ({ life: 0, node: this.put(this.effects, this.shape(HIDDEN, [0, 0, 0, 0])) }));
        this.stream = this.put(this.effects, this.shape(HIDDEN, C.coffee));
        this.steam = Array.from({ length: 3 }, () => this.put(this.effects, this.shape(HIDDEN, C.white)));
        this.resetCup(); this.draw();
        const touch = this.put(this.base, this.shape(ShapeUtils.rectangle(0, 0, VIEW.width, 100), null, { onClick: (id, x, y) => this.pointerDown(id, x, y) }));
        // Squish 142's constructor omits offClick; its dispatcher reads this node hook.
        touch.node.offClick = id => { const p = this.players.get(id); if (p) p.pointer = false; };
    }
    getLayers() { return [{ root: this.base }]; }
    getAssets() { return this.audio.assets; }
    get recipe() { return RECIPES[this.selectedRecipe]; }
    get nextStep() { return this.recipe.steps[this.stepIndex]; }
    get targetStep() { return this.phase === 'serve_ready' ? 'serve' : this.phase === 'ready' ? this.nextStep : null; }
    get activeTarget() {
        const step = this.targetStep, target = TARGETS[step];
        if (!target) return null;
        const [[x, y]] = this.project([[target.x, target.y]], true);
        // A little extra margin around the visible ring forgives small hands.
        return { x, y, radiusX: (target.rx + 2.5) * VIEW.stageScale / VIEW.aspect,
            radiusY: (target.ry + 2.5) * VIEW.stageScale, step };
    }
    project(points, stage = false) {
        if (points === HIDDEN) return HIDDEN;
        return points.map(([x, y]) => [
            clamp((stage ? VIEW.stageX + x * VIEW.stageScale : x) / VIEW.aspect, 0, 100),
            clamp(stage ? VIEW.stageY + y * VIEW.stageScale : y, 0, 100),
        ]);
    }
    coordinates(node, points) { node.node.coordinates2d = this.project(points, node.cafeStage); }
    shape(points, fill, options = {}) {
        const node = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: this.project(points), ...(fill ? { fill } : {}), ...options });
        node.cafePoints = points;
        return node;
    }
    put(parent, child) {
        child.cafeStage = !!parent.cafeStage;
        if (child.cafeStage && child.cafePoints) this.coordinates(child, child.cafePoints);
        parent.addChild(child, false); return child;
    }
    group(parent) { return this.put(parent, this.shape(HIDDEN)); }
    disk(parent, x, y, rx, ry, color) { return this.put(parent, this.shape(oval(x, y, rx, ry), color)); }
    rect(parent, x, y, w, h, color) { return this.put(parent, this.shape(ShapeUtils.rectangle(x, y, w, h), color)); }
    line(parent, points, width, color) { return this.put(parent, this.shape(stroke(points, width), color)); }
    text(parent, text, x, y, size, color = C.brown) {
        return this.put(parent, new GameNode.Text({ textInfo: { text, x: x / VIEW.aspect, y, size: size / (VIEW.aspect * Math.SQRT2), color, align: 'center', font: 'Trebuchet MS, sans-serif' } }));
    }
    setText(node, text) { node.node.text = { ...node.node.text, text }; }
    dirty() { this.base.node.onStateChange(); }
    object(parent) { return { root: this.group(parent), parts: [] }; }
    part(object, points, color) {
        const part = { points, node: this.put(object.root, this.shape(points, color)) };
        object.parts.push(part); return part;
    }
    place(object, x, y, scale = 1, angle = 0) {
        const ca = Math.cos(angle), sa = Math.sin(angle);
        for (const p of object.parts) this.coordinates(p.node, p.points.map(([px, py]) => [
            x + (px * ca - py * sa) * scale, y + (px * sa + py * ca) * scale,
        ]));
    }
    bean(parent, x, y, size, angle = 0) {
        const bean = this.object(parent);
        this.part(bean, oval(0, 0, size * .72, size), C.brown);
        this.part(bean, stroke([[.18 * size, -.73 * size], [-.22 * size, 0], [.16 * size, .73 * size]], size * .15), C.peach);
        this.place(bean, x, y, 1, angle); return bean;
    }
    buildRoom() {
        this.rect(this.scenery, 0, 0, VIEW.width, 14, C.coral);
        this.rect(this.scenery, 0, 77, VIEW.width, 3, C.orange);
        this.rect(this.scenery, 0, 77, VIEW.width, .8, C.brown);
        this.rect(this.scenery, 0, 80, VIEW.width, 20, C.mint);
        // A quiet, plain wall keeps the equipment and active tool easy to see.
        this.highlightOutline = this.put(this.highlightLayer, this.shape(HIDDEN, C.teal));
        this.highlight = this.put(this.highlightLayer, this.shape(HIDDEN, C.gold));
    }
    buildEquipment() {
        const e = this.equipmentLayer;
        // Grinder: bean hopper, burr body, knob, chute, and a little collection basket.
        this.put(e, this.shape(closed([[10, 29], [28, 29], [25.5, 42], [12.5, 42]]), C.brown));
        this.put(e, this.shape(closed([[11.4, 30], [26.6, 30], [24.3, 40.3], [13.7, 40.3]]), C.peach));
        this.beans = [[15, 33, -.6], [21, 32.5, .7], [24, 36, -.4], [18, 36.8, .4], [15, 39, -.4], [22, 39, .8]].map(([x, y, a]) => {
            const bean = this.bean(e, x, y, 1.5, a); bean.x = x; bean.y = y; bean.angle = a; return bean;
        });
        this.rect(e, 9.5, 27.4, 19, 2.2, C.brown); this.rect(e, 15, 25.9, 8, 1.5, C.brown);
        this.rect(e, 16, 41, 6, 4, C.brown);
        this.rect(e, 10, 44, 20, 17.5, C.gold); this.rect(e, 8, 61.5, 24, 2.5, C.brown);
        this.disk(e, 19, 51, 5.7, 5.7, C.coral); this.disk(e, 19, 51, 3.9, 3.9, C.cream);
        this.grinderNeedle = this.line(e, [[19, 51], [21, 48]], .65, C.brown);
        this.rect(e, 28, 47, 5.3, 3.3, C.brown); this.rect(e, 31, 49, 2.3, 4.8, C.brown);
        // Espresso machine: contrasting cream fascia, pressure gauge, buttons and brew head.
        this.rect(e, 37, 29, 35, 33, C.coral); this.rect(e, 35, 28, 39, 2.7, C.brown);
        this.rect(e, 39.2, 32, 30.6, 8, C.peach);
        this.disk(e, 47, 36, 3.1, 3.1, C.brown); this.disk(e, 47, 36, 2.45, 2.45, C.white);
        this.gaugeNeedle = this.line(e, [[47, 36], [46, 34.5]], .35, C.coral);
        this.disk(e, 60, 36, 1.6, 1.6, C.teal); this.disk(e, 66, 36, 1.6, 1.6, C.gold);
        this.rect(e, 41, 42.5, 26, 19.5, C.brown);
        this.rect(e, 49, 42.5, 9, 3.5, C.cream); this.rect(e, 51, 46, 5, 3.8, C.gold);
        this.rect(e, 37, 64, 35, 2.6, C.brown); this.rect(e, 40, 64, 29, .8, C.peach);
        for (let x = 42; x < 69; x += 4) this.rect(e, x, 64.7, 1.4, .8, C.brown);
        this.line(e, [[71, 38], [76, 40], [76, 48], [79, 51]], 1.4, C.brown);
        this.disk(e, 74, 38.5, 2, 2, C.gold);
        // Chunky toy tools: a deep basket, substantial grip, and a broad tamping foot.
        this.rect(e, 25, 64.1, 21, 2.4, C.teal);
        this.rect(e, 26, 64.1, 19, .65, C.mint);
        this.portafilter = this.object(e);
        this.part(this.portafilter, ShapeUtils.rectangle(-11, -.1, 8.5, 3.2), C.teal);
        this.part(this.portafilter, oval(-11, 1.5, 1.7, 1.6), C.teal);
        this.part(this.portafilter, ShapeUtils.rectangle(-10.7, .3, 4.8, .65), C.mint);
        this.part(this.portafilter, closed([[-4.7, -1.2], [4.7, -1.2], [3.5, 3.3], [-3.5, 3.3]]), C.brown);
        this.part(this.portafilter, closed([[-3.9, -.3], [3.9, -.3], [2.9, 2.5], [-2.9, 2.5]]), C.peach);
        this.part(this.portafilter, ShapeUtils.rectangle(-1.1, 3, 2.2, 1.8), C.brown);
        this.part(this.portafilter, oval(0, -1.2, 4.8, 1.85), C.cream);
        this.part(this.portafilter, oval(0, -1.2, 3.85, 1.25), C.brown);
        this.grounds = this.part(this.portafilter, HIDDEN, C.coffee);
        this.groundFlecks = [-2, 0, 2].map(() => this.part(this.portafilter, HIDDEN, C.caramel));
        this.tamper = this.object(e);
        this.tamperFoot = this.part(this.tamper, closed([[-3.55, -2.3], [3.55, -2.3], [3.55, -.25], [3.1, .2], [-3.1, .2], [-3.55, -.25]]), C.teal);
        this.part(this.tamper, ShapeUtils.rectangle(-2.8, -1.8, 5.6, .65), C.mint);
        this.part(this.tamper, ShapeUtils.rectangle(-1.25, -5.5, 2.5, 3.3), C.cream);
        this.part(this.tamper, oval(0, -6.3, 2.9, 2.8), C.brown);
        this.part(this.tamper, oval(0, -6.3, 2.35, 2.25), C.gold);
        this.part(this.tamper, oval(-.8, -7.3, .7, .65), C.cream);
        this.place(this.portafilter, 32, 59.3);
        this.place(this.tamper, 41.3, 64);
        this.pitcher = this.object(e);
        this.part(this.pitcher, oval(4.5, -.2, 2.7, 3), C.teal);
        this.part(this.pitcher, oval(4.5, -.2, 1.4, 1.8), C.cream);
        this.part(this.pitcher, closed([[-5, -5.5], [3.7, -5.5], [4.4, 4.6], [-4.4, 4.6], [-4, -3.7], [-6.2, -5.5]]), C.mint);
        this.part(this.pitcher, stroke([[-3.8, -5.3], [3.3, -5.3]], .6), C.white);
        this.part(this.pitcher, ShapeUtils.rectangle(-2.5, -2.5, 1.2, 5.5), C.white);
        this.place(this.pitcher, 80, 61);
        this.rect(e, 3, 59, 6.5, 7.3, C.brown); this.rect(e, 2.5, 57.8, 7.5, 1.6, C.coral);
        this.rect(e, 3.8, 61, 4.9, 3.2, C.peach); this.bean(e, 6.2, 62.6, .85, .3);
        this.creamDispenser = makeCreamDispenser(this, e);
        this.customerLayer = this.group(e);
        this.nextCustomer();
    }
    shuffled(choices, previous) {
        const bag = [...choices];
        for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(this.customerRandom() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        if (bag[bag.length - 1] === previous) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
        return bag;
    }
    takeVariation(bag, choices, previous) {
        if (!bag.length) bag.push(...this.shuffled(choices, previous));
        return bag.pop();
    }
    nextCustomer() {
        if (this.orderIndex === undefined) {
            // Introduce the family's new treat first, then visit every other recipe.
            this.orderIndex = 6;
            this.orderBag = this.shuffled([0, 1, 2, 3, 4, 5]);
        } else this.orderIndex = this.takeVariation(this.orderBag, RECIPES.map((_, i) => i), this.orderIndex);
        this.selectedRecipe = this.orderIndex;
        const previous = this.customerAppearance || {};
        this.customerAppearance = {
            animal: this.takeVariation(this.animalBag, ANIMALS, previous.animal),
            outfit: this.takeVariation(this.outfitBag, OUTFITS, previous.outfit),
            color: this.takeVariation(this.clothingBag, [C.teal, C.coral, C.mint, C.gold], previous.color),
        };
        this.customerLayer.clearChildren();
        this.customer = createCustomer(this, this.customerLayer, this.customerAppearance);
        this.customerForDrink = this.drinksServed;
        this.place(this.customer, 91, 42, .8);
    }
    makeCup(parent) {
        const cup = this.object(parent);
        this.part(cup, oval(0, 6.4, 8.6, 1.2), C.brown);
        this.part(cup, oval(0, 6, 8.4, 1), C.mint);
        this.part(cup, oval(7, -.2, 3.1, 3.8), C.teal);
        this.part(cup, oval(7, -.2, 1.65, 2.3), C.cream);
        this.part(cup, closed([[-7, -6], [7, -6], [5.8, 5.8], [-5.8, 5.8]]), C.teal);
        this.part(cup, liquidShape(4.9, -5.1), C.white);
        return cup;
    }
    buildHud() {
        this.text(this.hud, 'tiny bean café', 49, 4.4, 4.3, C.cream);
        this.disk(this.hud, 12, 7, 9, 4.2, C.cream);
        this.soundLabel = this.text(this.hud, 'sound on', 12, 5.65, 2.2);
        this.rect(this.hud, 85, 2, 53, 10, C.cream);
        this.disk(this.hud, 85, 7, 5, 5, C.cream);
        this.disk(this.hud, 138, 7, 5, 5, C.cream);
        this.put(this.hud, this.shape(closed([[120, 10], [129, 10], [124, 17]]), C.cream));
        this.orderSpeech = this.text(this.hud, '', 111.5, 5.3, 2.8);

        // The guest's picture order replaces the free-play drink selector.
        this.rect(this.hud, 7, 83, 60, 14, C.cream);
        this.recipePreview = this.group(this.hud);
        this.text(this.hud, 'OUR ORDER', 44, 85, 1.8, C.teal);
        this.recipeLabel = this.text(this.hud, '', 44, 89, 3.1);
        this.message = this.text(this.hud, '', 109, 85.1, 3.6, C.brown);
        this.tapLabel = this.text(this.hud, 'tap the glowing circle', 109, 92, 2.2, C.teal);
        this.previewRecipe = -1;
    }
    updateRecipePreview() {
        if (this.previewRecipe === this.selectedRecipe) return;
        this.previewRecipe = this.selectedRecipe;
        this.recipePreview.clearChildren();
        const cup = this.recipe.paper ? makePaperCup(this, this.recipePreview) : this.makeCup(this.recipePreview);
        let level = 4.9;
        for (const ingredient of INGREDIENTS) {
            if (!this.recipe.layers[ingredient] || ingredient === 'whip') continue;
            const next = level - this.recipe.layers[ingredient] * 10;
            this.part(cup, liquidShape(level, next), ingredient === 'espresso' ? C.coffee : C[ingredient]);
            level = next;
        }
        if (this.recipe.layers.foam) this.part(cup, heart(0, level + .8, 1.2), C.caramel);
        if (this.recipe.paper) addWhippedCream(this, cup).update(1);
        this.place(cup, 18, this.recipe.paper ? 92.1 : 90, this.recipe.paper ? .53 : .7);
        this.setText(this.recipeLabel, this.recipe.name);
        this.setText(this.orderSpeech, this.recipe.name + ', please!');
    }
    resetCup() {
        if (this.customerForDrink !== this.drinksServed) this.nextCustomer();
        this.phase = 'ready'; this.phaseStarted = this.time; this.stepIndex = 0; this.ingredients = {};
        this.artProgress = 0; this.cupLayer.clearChildren();
        this.cup = this.recipe.paper ? makePaperCup(this, this.cupLayer) : this.makeCup(this.cupLayer);
        this.whippedCream = this.recipe.paper ? addWhippedCream(this, this.cup) : null;
        this.cupLayers = {}; this.artPart = null; this.updateHud(); this.drawCup();
    }
    updateHud() {
        let text = STEP_NAMES[this.nextStep] || 'Share a little cup';
        if (this.phase === 'art') text = 'A little heart!';
        else if (this.phase === 'serve_ready') text = STEP_NAMES.serve;
        else if (this.phase === 'serving') text = 'For our friend!';
        else if (this.phase === 'celebrate') text = 'Thank you!';
        this.setText(this.message, text);
        this.setText(this.tapLabel, this.phase === 'ready' ? 'tap the glowing circle' : this.phase === 'serve_ready' ? 'tap the animal' : '');
        this.setText(this.orderSpeech, this.phase === 'celebrate' ? 'Thank you!' : this.recipe.name + ', please!');
        this.updateRecipePreview();
    }
    playSound(name) { if (this.sound) this.audio.play(name); }
    advance() {
        if (this.phase === 'serve_ready') {
            this.phase = 'serving'; this.phaseStarted = this.time;
            this.updateHud(); this.draw(); this.dirty(); return;
        }
        if (this.phase !== 'ready') return;
        this.phase = 'action'; this.phaseStarted = this.time;
        if (INGREDIENTS.includes(this.nextStep)) {
            this.ingredients[this.nextStep] = 0;
            if (this.nextStep !== 'whip') this.cupLayers[this.nextStep] = this.part(this.cup, HIDDEN, this.nextStep === 'espresso' ? C.coffee : C[this.nextStep]);
        }
        this.playSound(this.nextStep); this.updateHud(); this.draw(); this.dirty();
    }
    finishAction() {
        if (INGREDIENTS.includes(this.nextStep)) this.ingredients[this.nextStep] = this.recipe.layers[this.nextStep];
        this.stepIndex++;
        if (this.stepIndex < this.recipe.steps.length) this.phase = 'ready';
        else if (this.recipe.layers.foam) {
            this.phase = 'art'; this.artPart = this.part(this.cup, HIDDEN, C.caramel);
        } else this.phase = 'serve_ready';
        this.phaseStarted = this.time; this.updateHud();
    }
    drawCup() {
        let level = 4.9;
        for (const key of INGREDIENTS) {
            const part = this.cupLayers[key]; if (!part) continue;
            const next = level - (this.ingredients[key] || 0) * 10;
            part.points = liquidShape(level, next); level = next;
        }
        if (this.artPart) this.artPart.points = heart(0, level + Math.min(.8, (this.recipe.layers.foam || 0) * 5), 1.5 * this.artProgress);
        if (this.whippedCream) this.whippedCream.update(this.ingredients.whip || 0);
        let x = 53.5, y = 59.8, scale = .9;
        if (this.phase === 'action' && this.nextStep === 'cup') y -= Math.sin(clamp((this.time - this.phaseStarted) / TUNING.actionSeconds) * Math.PI) * 2;
        if (this.phase === 'serving') {
            const p = ease((this.time - this.phaseStarted) / TUNING.serveSeconds);
            x = mix(x, 87, p); y = mix(y, 58, p) - Math.sin(p * Math.PI) * 5; scale = mix(scale, .65, p);
        } else if (this.phase === 'celebrate') { x = 87; y = 58; scale = .65; }
        this.place(this.cup, x, y, scale);
    }
    drawPrep(step, active, p) {
        const groundStep = this.recipe.steps.indexOf('grind');
        const tampStep = this.recipe.steps.indexOf('tamp');
        const brewStep = this.recipe.steps.indexOf('espresso');
        const filled = groundStep >= 0 && this.stepIndex > groundStep ? 1 : active && step === 'grind' ? ease(p) : 0;
        const tamping = active && step === 'tamp';
        const compressed = tampStep >= 0 && this.stepIndex > tampStep ? 1 : tamping ? ease((p - .25) / .35) : 0;
        this.grounds.points = filled > 0 ? oval(0, -1.15 - (1 - compressed) * filled * .6, 3.55, (.25 + .95 * filled) * (1 - compressed * .3)) : HIDDEN;
        this.groundFlecks.forEach((part, i) => {
            part.points = filled > .3 ? oval((i - 1) * 1.8, -1.2 - (1 - compressed) * filled * .6, .35, .18) : HIDDEN;
        });
        // Lift the prepared basket into the brew head before the espresso starts.
        const dock = brewStep >= 0 && this.stepIndex > brewStep ? 1 : active && step === 'espresso' ? ease(p / .25) : 0;
        const basketX = mix(32, 53.5, dock), basketY = mix(59.3, 46.8, dock);
        this.place(this.portafilter, basketX, basketY);
        let tamperX = 41.3, tamperY = 64;
        if (tamping) {
            if (p < .25) {
                const travel = ease(p / .25);
                tamperX = mix(41.3, 32, travel); tamperY = mix(64, 54.2, travel);
            } else if (p < .6) {
                tamperX = 32; tamperY = mix(54.2, 58.1, ease((p - .25) / .35));
            } else if (p < .76) { tamperX = 32; tamperY = 58.1; }
            else {
                const travel = ease((p - .76) / .24);
                tamperX = mix(32, 41.3, travel); tamperY = mix(58.1, 64, travel) - Math.sin(travel * Math.PI) * 5;
            }
        }
        this.place(this.tamper, tamperX, tamperY);
    }
    draw() {
        const elapsed = this.time - this.phaseStarted;
        const p = this.phase === 'action' ? clamp(elapsed / TUNING.actionSeconds) : 0;
        const step = this.nextStep, active = this.phase === 'action';
        const target = TARGETS[this.targetStep];
        if (target) {
            const pulse = Math.sin(this.time * 4) * .45;
            // A contrasting edge keeps the gold ring visible on the yellow grinder.
            const outline = oval(target.x, target.y, target.rx + .3 + pulse, target.ry + .3 + pulse, 48);
            const outlineHole = oval(target.x, target.y, target.rx - 1.35 + pulse, target.ry - 1.35 + pulse, 48).reverse();
            this.coordinates(this.highlightOutline, [...outline, ...outlineHole, outline[0]]);
            const outer = oval(target.x, target.y, target.rx + pulse, target.ry + pulse, 48);
            const inner = oval(target.x, target.y, target.rx - 1.05 + pulse, target.ry - 1.05 + pulse, 48).reverse();
            this.coordinates(this.highlight, [...outer, ...inner, outer[0]]);
            this.highlight.node.fill = [244, 183, 53, Math.round(205 + Math.sin(this.time * 4) * 35)];
        } else {
            this.coordinates(this.highlightOutline, HIDDEN);
            this.coordinates(this.highlight, HIDDEN);
        }
        this.beans.forEach((bean, i) => this.place(bean, bean.x, bean.y + (active && step === 'grind' ? Math.sin(this.time * 25 + i) * .4 : 0), 1, bean.angle));
        const spin = active && step === 'grind' ? this.time * 16 : -.8;
        this.coordinates(this.grinderNeedle, stroke([[19, 51], [19 + Math.cos(spin) * 2.8, 51 + Math.sin(spin) * 2.8]], .65));
        const gauge = active && step === 'espresso' ? -.6 + Math.sin(p * Math.PI) * 1.8 : -.6;
        this.coordinates(this.gaugeNeedle, stroke([[47, 36], [47 + Math.sin(gauge) * 1.8, 36 - Math.cos(gauge) * 1.8]], .35));
        this.drawPrep(step, active, p);
        const pouring = active && ['water', 'milk', 'foam'].includes(step);
        if (this.recipe.paper) {
            this.pitcher.parts.forEach(part => this.coordinates(part.node, HIDDEN));
            const dispensing = active && step === 'whip';
            this.place(this.creamDispenser, dispensing ? CREAM_POUR.x : 80, dispensing ? CREAM_POUR.y : 61, 1, dispensing ? CREAM_POUR.angle : 0);
        } else {
            this.place(this.pitcher, pouring ? 68 : 80, pouring ? 48 : 61, 1, pouring ? -.58 : 0);
            this.creamDispenser.parts.forEach(part => this.coordinates(part.node, HIDDEN));
        }
        this.coordinates(this.stream, HIDDEN);
        this.steam.forEach(node => { this.coordinates(node, HIDDEN); });
        if (active && step === 'grind') {
            this.stream.node.fill = C.coffee;
            this.coordinates(this.stream, stroke([[32, 53], [32 + Math.sin(this.time * 30) * .25, 58]], 1.05));
        } else if (active && INGREDIENTS.includes(step)) {
            const pour = step === 'espresso' ? clamp((p - .25) / .75) : p;
            this.ingredients[step] = this.recipe.layers[step] * ease(pour);
            let start = step === 'espresso' ? [53.5, 51.5] : step === 'chocolate' ? [44, 51] : [61.2, 46.5];
            if (step === 'whip') {
                const [nx, ny] = this.creamDispenser.nozzle, { x, y, angle } = CREAM_POUR;
                start = [x + nx * Math.cos(angle) - ny * Math.sin(angle), y + nx * Math.sin(angle) + ny * Math.cos(angle)];
            }
            this.stream.node.fill = step === 'espresso' ? C.coffee : C[step];
            const endY = step === 'whip' ? 54 - ease(p) * 6 : 59;
            const middleY = step === 'whip' ? mix(start[1], endY, .55) : 53;
            if (pour > 0) this.coordinates(this.stream, stroke([start, [mix(start[0], 53.5, .7), middleY], [53.5, endY]], step === 'whip' ? 2 : step === 'foam' ? 1.5 : .8));
            if (step === 'foam') this.steam.forEach((node, i) => {
                const y = 44 - (this.time * 4 + i * 2) % 7;
                this.coordinates(node, stroke([[76 + i * .6, y + 3], [77 + i * .6, y + 1.5], [76.5 + i * .6, y]], .45));
            });
        }
        if (this.phase === 'art') this.artProgress = ease(elapsed / TUNING.artSeconds);
        const hop = this.phase === 'celebrate' ? Math.abs(Math.sin(elapsed * 6)) * 1 : Math.sin(this.time * 2) * .08;
        this.place(this.customer, 91, 42 - hop, .8, this.phase === 'celebrate' ? Math.sin(elapsed * 6) * .045 : 0);
        this.drawCup();
    }
    burst(x, y, count) {
        for (const particle of this.particles) {
            if (count <= 0) break;
            if (particle.life > 0) continue;
            const a = Math.random() * TAU;
            particle.x = x; particle.y = y; particle.vx = Math.cos(a) * 8; particle.vy = Math.sin(a) * 7 - 5;
            particle.life = .8 + Math.random() * .6; particle.size = .6 + Math.random() * .4;
            particle.node.node.fill = [C.coral, C.gold, C.teal, C.orange][count % 4]; count--;
        }
    }
    handleNewPlayer({ playerId }) {
        this.players.set(playerId, { pointer: false, keys: new Set() });
        if (!this.assetsRegistered && typeof this.addAsset === 'function') {
            this.assetsRegistered = true;
            for (const [key, asset] of Object.entries(this.audio.assets)) {
                try { this.addAsset(key, asset)?.catch(() => {}); } catch (_) { /* Pretend café remains playable without sound. */ }
            }
        }
    }
    handlePlayerDisconnect(id) { this.players.delete(id); }
    pointerDown(id, x, y) {
        const player = this.players.get(id); if (!player || player.pointer) return;
        player.pointer = true; this.tap(x, y);
    }
    handleMouseUp(id, position) {
        const player = this.players.get(id); if (!player) return;
        if (!player.pointer && position) this.tap(position.x, position.y);
        player.pointer = false;
    }
    tap(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) return;
        if (x <= 22 / VIEW.aspect && y <= 14) {
            this.sound = !this.sound;
            if (this.sound) this.audio.play('select'); else this.audio.mute();
            this.setText(this.soundLabel, this.sound ? 'sound on' : 'sound off'); this.dirty(); return;
        }
        const target = this.activeTarget;
        if (!target) return;
        const dx = (x - target.x) / target.radiusX, dy = (y - target.y) / target.radiusY;
        if (dx * dx + dy * dy <= 1) this.advance();
    }
    // This game practices pointing at a tool; generic keys cannot bypass that task.
    handleKeyDown() {}
    handleKeyUp(id, key) { this.players.get(id)?.keys.delete(key); }
    tick() {
        if (!this.players.size) return;
        const dt = 1 / TUNING.tickRate; this.time += dt; this.audio.tick(dt);
        const elapsed = this.time - this.phaseStarted;
        if (this.phase === 'action' && elapsed >= TUNING.actionSeconds) this.finishAction();
        else if (this.phase === 'art' && elapsed >= TUNING.artSeconds) {
            this.artProgress = 1; this.phase = 'serve_ready'; this.phaseStarted = this.time; this.updateHud();
        } else if (this.phase === 'serving' && elapsed >= TUNING.serveSeconds) {
            this.drinksServed++; this.phase = 'celebrate'; this.phaseStarted = this.time;
            this.burst(87, 38, 22); this.playSound('serve'); this.updateHud();
        } else if (this.phase === 'celebrate' && elapsed >= TUNING.cheerSeconds) this.resetCup();
        this.draw();
        for (const p of this.particles) {
            if (p.life <= 0) continue;
            p.life -= dt;
            if (p.life <= 0) { this.coordinates(p.node, HIDDEN); p.node.node.fill = [0, 0, 0, 0]; continue; }
            p.x += p.vx * dt; p.y += p.vy * dt; p.vy += dt * 8;
            const size = p.size * Math.min(1, p.life * 3);
            this.coordinates(p.node, heart(clamp(p.x, size, 100 - size), clamp(p.y, size, 100 - size), size));
        }
        this.dirty();
    }
    close() { this.audio.close(); this.players.clear(); super.close(); }
}

module.exports = TinyBeanCafe;
