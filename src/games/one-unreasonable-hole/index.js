'use strict';
const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');
const { UI, C, circle, line, clamp } = require('./ui');
const { design, Golf, geometry } = require('./rules');
const initial = require('./creation');
const COLORS = [C.coral, C.blue, C.gold, C.white];
const TOOLS = ['wall', 'bumper', 'fan', 'ramp', 'moving', 'tee', 'cup', 'erase'];
function readUserDesign(files) { try { return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(files?.['course.json'])); } catch (_) { return null; } }
class OneUnreasonableHole extends Game {
    static metadata() { return {
            thumbnail: './assets/thumbnail.png',
            name: 'One Hole, Absolutely Unreasonable',
            description: 'Build a tiny golf course with fans, bumpers, ramps and moving walls. Play together, then send your ridiculous creation as a complete game.',
            author: "Joseph Garcia",
            aspectRatio: { x: 1, y: 1 },
            tickRate: 30,
            maxPlayers: 4,
            gameId: "dade3cb2-096a-45f9-a0ee-33ad8d1270f8"
        }; }
    constructor(options = {}) {
        super(); this.options = options; this.creation = design(readUserDesign(options.userExports) || options.saveData?.creation || initial);
        this.players = new Map(); this.owner = null; this.phase = 'edit'; this.tool = 'wall'; this.rotation = 0; this.undo = []; this.aims = new Map();
        this.notice = '';
        this.base = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100), fill: C.cream });
        this.ui = new UI(this.base); this.render();
    }
    getLayers() { return [{ root: this.base }]; }
    canAddPlayer() { return this.players.size < 4; }
    handleNewPlayer({ playerId, info }) {
        if (!this.canAddPlayer()) return;
        this.players.set(playerId, String(info?.name || 'Golfer ' + (this.players.size + 1)).slice(0, 12));
        if (this.owner === null) this.owner = playerId;
        if (this.phase === 'play') this.golf.join(playerId);
        this.render();
    }
    handlePlayerDisconnect(id) { this.players.delete(id); this.aims.delete(id); this.golf?.leave(id); if (this.owner === id) this.owner = this.players.keys().next().value ?? null; this.render(); }

    save() { return Promise.all([this.options.saveGame?.({creation:this.creation}), this.options.createExport?.('course.json', new TextEncoder().encode(JSON.stringify(this.creation,null,2)))]).catch(() => { this.notice='Could not save the creation. Try again before closing.'; }); }
    edit(id, fn) { if (id !== this.owner || this.phase !== 'edit') return; fn(); this.save(); this.render(); }
    remember() { this.undo.push(design(this.creation)); if (this.undo.length > 30) this.undo.shift(); }
    place(id, x, y) {
        if (id !== this.owner || this.phase !== 'edit') return;
        this.edit(id, () => {
            if (this.tool === 'erase') { const i = this.creation.obstacles.findIndex(o => Math.hypot(o.x - x, o.y - y) < 9); if (i >= 0) { this.remember(); this.creation.obstacles.splice(i, 1); } return; }
            const point = { x: clamp(Math.round(x / 2) * 2, 10, 90), y: clamp(Math.round(y / 2) * 2, 26, 74) };
            if (this.tool === 'tee' || this.tool === 'cup') {
                const other = this.tool === 'tee' ? this.creation.cup : this.creation.tee;
                if (Math.hypot(point.x - other.x, point.y - other.y) < 8) { this.notice = 'Give the tee and cup a little space.'; return; }
                if (this.creation.obstacles.some(o => Math.hypot(o.x - point.x, o.y - point.y) < 11)) { this.notice = 'Place the tee or cup on clear grass.'; return; }
                this.remember(); this.creation[this.tool] = point;
            } else {
                point.x = clamp(point.x, 18, 82); point.y = clamp(point.y, 34, 66);
                if (this.creation.obstacles.length >= 14) { this.notice = 'Fourteen obstacles is plenty. Erase one to add another.'; return; }
                if ([this.creation.tee, this.creation.cup].some(p => Math.hypot(p.x - point.x, p.y - point.y) < 11)) { this.notice = 'Leave clear grass around the tee and cup.'; return; }
                this.remember(); this.creation.obstacles.push({ type: this.tool, ...point, rotation: this.rotation });
            }
            this.notice = '';
        });
    }
    start(id) { if (id !== this.owner) return; this.save(); this.golf = new Golf(this.creation, [...this.players.keys()]); this.aims.clear(); this.phase = 'play'; this.render(); }
    aim(id) { if (!this.aims.has(id)) this.aims.set(id, { dx: this.creation.cup.x - this.creation.tee.x, dy: this.creation.cup.y - this.creation.tee.y, power: .5, dragging: false }); return this.aims.get(id); }
    press(id, x, y) {
        if (this.phase === 'edit') return this.place(id, x, y);
        const ball = this.golf?.balls.get(id); if (!this.golf?.stationary(ball)) return;
        const aim = this.aim(id); aim.dragging = Math.hypot(ball.x - x, ball.y - y) < 5;
        if (!aim.dragging) { aim.dx = x - ball.x; aim.dy = y - ball.y; }
    }
    drag(id, x, y) { const aim = this.aim(id), ball = this.golf?.balls.get(id); if (this.phase !== 'play' || !aim.dragging || !this.golf.stationary(ball)) return; aim.dx = ball.x - x; aim.dy = ball.y - y; aim.power = clamp(Math.hypot(aim.dx, aim.dy) / 24, 0, 1); }
    release(id, x, y) { const aim = this.aim(id); if (!aim.dragging) return; this.drag(id, x, y); aim.dragging = false; if (Math.hypot(aim.dx, aim.dy) > 1) this.shoot(id); }
    shoot(id) { if (this.phase !== 'play') return; const a = this.aim(id); this.golf.shoot(id, a.dx, a.dy, a.power); }
    render() {
        this.base.clearChildren(); const u = this.ui;

        u.text(this.phase === 'edit' ? 'Choose a tool, then tap the grass.' : 'Drag the ball back to putt.', 5, 18, 1.85, C.ink);
        u.rect(4, 20, 92, 60, C.ink); u.rect(6, 22, 88, 56, C.mint);
        for (let x = 6; x < 94; x += 12) u.rect(x, 22, 6, 56, [131,207,174,255]);
        const cup = this.creation.cup, tee = this.creation.tee;
        u.shape(circle(tee.x, tee.y, 2.3), C.white); u.text('TEE', tee.x, tee.y + 3, 1.7, C.ink, undefined, 'center');
        u.shape(circle(cup.x, cup.y, 2.6), C.ink); u.rect(cup.x + 1, cup.y - 10, .5, 10, C.ink); u.shape([[cup.x+1,cup.y-10],[cup.x+8,cup.y-8],[cup.x+1,cup.y-6],[cup.x+1,cup.y-10]], C.coral);
        this.movers = [];
        this.creation.obstacles.forEach(o => {
            if (o.type === 'wall' || o.type === 'moving') { const g = geometry(o, this.golf?.time || 0), node = u.rect(g.x-g.w/2, g.y-g.h/2, g.w, g.h, o.type === 'moving' ? C.coral : C.navy); if (o.type === 'moving') this.movers.push({ o, node }); }
            if (o.type === 'bumper') { u.shape(circle(o.x,o.y,3.3), C.gold); u.shape(circle(o.x,o.y,1.8), C.coral); }
            if (o.type === 'fan' || o.type === 'ramp') { u.rect(o.x-4,o.y-4,8,8,o.type === 'fan' ? C.blue : C.gold); u.text(['→','↓','←','↑'][o.rotation],o.x,o.y-3,5,C.ink,undefined,'center'); u.text(o.type.toUpperCase(),o.x,o.y+5,1.4,C.ink,undefined,'center'); }
        });
        this.ballNodes = new Map(); this.privateViews = new Map();
        if (this.phase !== 'edit') for (const [id, ball] of this.golf.balls) {
            const color = COLORS[[...this.players.keys()].indexOf(id) % 4];
            this.ballNodes.set(id, { body: u.shape(circle(ball.x, ball.y, 1.25), color), label: u.text('', ball.x, ball.y+2, 1.5, C.ink, undefined, 'center') });
        }
        if (this.phase === 'edit') this.editor();
        else for (const id of this.players.keys()) this.controls(id);
        // Keep the aiming line from intercepting a press on the ball.
        u.rect(6,22,88,56,[0,0,0,0],this.base,{onClick:(id,x,y)=>this.press(id,x,y),onDrag:(id,x,y)=>this.drag(id,x,y),offClick:(id,x,y)=>this.release(id,x,y)});
        if (this.phase === 'result') this.result();
    }
    editor() {
        const u = this.ui;
        TOOLS.forEach((tool,i)=>u.button(tool === 'moving' ? 'Mover' : tool[0].toUpperCase()+tool.slice(1),4+i*11.6,82,11,6,id=>this.edit(id,()=>{this.tool=tool;this.notice='';}),this.tool===tool?C.gold:C.white));
        u.button('Rotate '+['→','↓','←','↑'][this.rotation],4,90,25,7,id=>this.edit(id,()=>{this.rotation=(this.rotation+1)%4;}),C.blue);
        u.button('Undo',31,90,18,7,id=>this.edit(id,()=>{if(this.undo.length)this.creation=this.undo.pop();}),C.white);
        u.button('Clear',51,90,18,7,id=>this.edit(id,()=>{this.remember();this.creation.obstacles=[];}),C.white);
        u.button('PLAY',71,90,25,7,id=>this.start(id),C.coral);
        u.text(this.notice.slice(0,85),4,98,1.45,C.muted);
        u.text('Creator edits · '+this.players.size+' / 4 players',96,6,1.65,C.muted,undefined,'right');
    }
    controls(id) {
        const root = this.ui.group(this.base,[id]), u = new UI(root), color = COLORS[[...this.players.keys()].indexOf(id)%4];
        const guide=u.shape([[0,0],[0,0],[0,0]],[255,253,242,130]);
        const status=u.text('',5,83,2.3,C.ink), power=u.text('',50,90,2,C.ink,undefined,'center');
        u.button('−',5,89,12,8,who=>{if(who===id)this.aim(id).power=clamp(this.aim(id).power-.1,0,1);},C.white);
        u.button('+',20,89,12,8,who=>{if(who===id)this.aim(id).power=clamp(this.aim(id).power+.1,0,1);},C.white);
        u.button('PUTT',70,89,25,8,who=>{if(who===id)this.shoot(who);},color);
        if(id===this.owner)u.button('Edit course',73,4,22,6,who=>{if(who===id){this.phase='edit';this.render();}},C.white);
        this.privateViews.set(id,{u,guide,status,power});
    }
    update() {
        for(const {o,node} of this.movers){const g=geometry(o,this.golf.time);this.ui.move(node,g.x-g.w/2,g.y-g.h/2,g.w,g.h);}
        let index=0;
        for(const [id,ball] of this.golf.balls){const nodes=this.ballNodes.get(id);if(!nodes)continue;
            this.ui.ball(nodes.body,ball.x,ball.y,ball.sunk?.65:1.25);nodes.label.node.text.x=ball.x;nodes.label.node.text.y=ball.y+2;this.ui.updateText(nodes.label,ball.sunk?'✓':String(++index));nodes.label.node.onStateChange();
            const view=this.privateViews.get(id);if(!view)continue;const {u,guide,status,power}=view,aim=this.aim(id),distance=Math.hypot(aim.dx,aim.dy);
            u.updateText(status,this.players.get(id)+' · '+ball.strokes+' / 12 strokes'+(ball.sunk?' · IN THE CUP!':ball.retired?' · Try again':this.golf.stationary(ball)?' · Your ball is ready':' · Rolling…'));
            u.updateText(power,'Power '+Math.round(aim.power*100)+'%');
            if(this.golf.stationary(ball)&&distance>0){const length=5+aim.power*14;guide.update({coordinates2d:line(ball.x,ball.y,ball.x+aim.dx/distance*length,ball.y+aim.dy/distance*length,.6)});}else u.hide(guide);
        }
    }
    result() {
        const u=this.ui,box=u.rect(13,29,74,43,C.cream);u.text('SCORECARD',50,33,3.4,C.ink,box,'center');
        [...this.golf.balls.values()].sort((a,b)=>Number(b.sunk)-Number(a.sunk)||a.strokes-b.strokes).forEach((ball,i)=>u.text(this.players.get(ball.id)+' · '+(ball.sunk?ball.strokes+' strokes':'12 strokes · next time'),50,41+i*5,2.2,C.muted,box,'center'));
        u.button('Another round',20,63,60,7,id=>this.start(id),C.gold,box);
    }
    tick() { if(this.phase!=='play')return;this.golf.tick(1/30);this.update();if(this.golf.finished){this.phase='result';this.render();} }
}
module.exports=OneUnreasonableHole;
