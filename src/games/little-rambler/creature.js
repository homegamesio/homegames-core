const TAU = Math.PI * 2;
const COATS = {
    moss: [[59, 91, 78], [111, 157, 121], [164, 193, 144]],
    peach: [[139, 84, 71], [214, 145, 106], [240, 188, 139]],
    lilac: [[97, 85, 123], [158, 140, 183], [195, 178, 213]],
};
const CREAM = [248, 224, 172], INK = [38, 44, 40], CORAL = [211, 123, 106];

// Hand-built character geometry: independent limbs, ears, face and reaction poses.
// x/y is the feet; scale is a world-space unit, so the same pet inhabits every game.
function creature(p, x, y, scale, t, options = {}) {
    const [dark, base, light] = COATS[options.coat] || COATS.moss;
    const activity = options.activity || 'idle', reaction = options.reaction || '';
    const sleep = activity === 'sleeping' || activity === 'sleep' || activity === 'resting';
    const walk = activity === 'walking' || options.moving;
    const eat = reaction === 'eat' || reaction === 'eating' || activity === 'eating' || reaction.includes('berry');
    const happy = reaction === 'pet' || reaction === 'happy' || reaction === 'petted' || activity === 'petting' || activity === 'happy' || reaction === 'build';
    const bob = sleep ? Math.sin(t * 1.7) * .08 : walk ? Math.abs(Math.sin(t * 9)) * .26 : Math.sin(t * 2.3) * .09;
    const s = scale, by = y - bob * s, dir = options.facing === -1 ? -1 : 1;
    p.ellipse(x, y + .2 * s, 2.5 * s, .45 * s, [24, 39, 34], .23);
    if(sleep){
        p.ellipse(x,by-1.4*s,2.6*s,1.55*s,dark);
        p.ellipse(x,by-1.6*s,2.45*s,1.4*s,base);
        p.ellipse(x+.4*s,by-1.4*s,1.7*s,1.1*s,CREAM);
        p.ellipse(x-1.5*s,by-2.1*s,1.25*s,1.2*s,light);
        p.ellipse(x-2.25*s,by-3.15*s,.7*s,1.2*s,base);
        p.ellipse(x-1.1*s,by-3.0*s,.65*s,1.2*s,base);
        p.arc(x-1.7*s,by-2.0*s,.3*s,0,Math.PI,INK,.08*s);
        p.arc(x-.9*s,by-2.0*s,.3*s,0,Math.PI,INK,.08*s);
        p.text('z',x+2.9*s,by-(3.7+(t%2))*s,1.2*s,CREAM,'center',.8);
        return;
    }
    // Long soft ears, leaflike rather than rabbitlike; cream interiors.
    for (const side of [-1, 1]) {
        const sway = Math.sin(t * 2.6 + side) * .18 + (happy ? Math.sin(t * 12) * .25 : 0);
        const pts = [[x + side * 1.1 * s, by - 6.1 * s], [x + side * 1.7 * s, by - 8.8 * s],
            [x + side * (3.4 + sway) * s, by - (sleep ? 6.8 : 8.7) * s],
            [x + side * (3.05 + sway) * s, by - 6.5 * s], [x + side * 2 * s, by - 5.8 * s]];
        p.poly(pts, dark); p.poly(pts.map(([xx, yy]) => [x + (xx - x) * .92, yy + .14 * s]), base);
        p.poly([[x + side * 1.7 * s, by - 6.6 * s], [x + side * 1.95 * s, by - 8.05 * s],
            [x + side * (2.87 + sway) * s, by - 8.2 * s], [x + side * 2.5 * s, by - 6.9 * s]], CORAL);
    }
    const step = walk ? Math.sin(t * 9) * .22 * s : 0;
    p.ellipse(x - 1.25 * s, y - .22 * s + step, 1.0 * s, .49 * s, dark);
    p.ellipse(x + 1.25 * s, y - .22 * s - step, 1.0 * s, .49 * s, dark);
    p.ellipse(x, by - 2.4 * s, 2.3 * s, 2.5 * s, dark);
    p.ellipse(x, by - 2.55 * s, 2.12 * s, 2.36 * s, base);
    p.ellipse(x - .27 * s, by - 3 * s, 1.8 * s, 1.82 * s, light, .55);
    p.ellipse(x + .1 * s, by - 2.1 * s, 1.35 * s, 1.67 * s, CREAM);
    // Scarf is Pip's little travelling memento.
    p.poly([[x - 1.75 * s, by - 4.25 * s], [x + 1.8 * s, by - 4.25 * s],
        [x + 1.4 * s, by - 3.7 * s], [x - 1.5 * s, by - 3.7 * s]], [171, 80, 55]);
    p.poly([[x + 1.15 * s, by - 4.1 * s], [x + 2.5 * s, by - 3.65 * s],
        [x + 2.05 * s, by - 2.1 * s], [x + 1.25 * s, by - 2.75 * s]], [204, 112, 69]);
    const armY = eat ? by - 3.2 * s : by - 2.7 * s;
    p.ellipse(x - (eat ? 1.3 : 2.05) * s, armY, .68 * s, 1.0 * s, base);
    p.ellipse(x + (eat ? 1.3 : 2.05) * s, armY - (happy ? .6 * s : 0), .68 * s, .98 * s, base);
    p.ellipse(x, by - 5.45 * s, 2.42 * s, 2.08 * s, dark);
    p.ellipse(x, by - 5.48 * s, 2.25 * s, 1.94 * s, base);
    p.ellipse(x - .25 * s, by - 5.8 * s, 1.92 * s, 1.45 * s, light, .7);
    p.ellipse(x + .2 * s, by - 4.82 * s, 1.46 * s, .88 * s, CREAM);
    // Three tiny freckles make the silhouette's simple face feel hand drawn.
    for (const side of [-1, 1]) {
        p.ellipse(x + side * 1.5 * s, by - 4.95 * s, .39 * s, .22 * s, CORAL, .55);
        const eyeX = x + side * .93 * s + dir * .07 * s;
        const blink = sleep || Math.sin(t * 1.2) > .993;
        if (blink || happy) p.arc(eyeX, by - 5.65 * s, .33 * s, happy ? Math.PI : 0, Math.PI, INK, .10 * s);
        else {
            p.ellipse(eyeX, by - 5.75 * s, .34 * s, .48 * s, INK);
            p.ellipse(eyeX - .10 * s, by - 5.91 * s, .095 * s, .14 * s, [255, 251, 227]);
        }
    }
    p.ellipse(x + dir * .1 * s, by - 5.0 * s, .27 * s, .19 * s, [99, 76, 71]);
    if (eat) p.ellipse(x + dir * .1 * s, by - 4.56 * s, .25 * s, (.15 + Math.sin(t * 20) * .05) * s, INK);
    else p.arc(x + dir * .1 * s, by - 4.76 * s, .34 * s, .1, Math.PI - .2, INK, .075 * s);
    if (eat) {
        p.circle(x, by - 3.65 * s, .57 * s, reaction.includes('berry') ? [178, 68, 92] : [220, 176, 94]);
        p.circle(x - .2 * s, by - 3.84 * s, .15 * s, CREAM, null, .8);
    }
    if (happy) {
        for (let i = 0; i < 3; i++) heart(p, x + (i - 1) * 2 * s,
            by - (9.3 + ((t * 1.8 + i * .65) % 2)) * s, .47 * s, CORAL);
    }
    if (sleep) p.text('z', x + 2.9 * s, by - (6.7 + (t % 2)) * s, 1.2 * s, CREAM, 'center', .8);
}
function heart(p, x, y, r, color) {
    p.poly(Array.from({length:24},(_,i)=>{
        const a=i*TAU/24;
        return [x+Math.pow(Math.sin(a),3)*r,y-(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))*r/16];
    }),color);
}
function berry(p,x,y,r=1) {
    p.circle(x,y,r,[105,45,66]);p.circle(x-.12*r,y-.12*r,.85*r,[199,83,105]);
    p.circle(x-.28*r,y-.3*r,.22*r,[245,177,162]);
    p.poly([[x,y-r*.8],[x-.8*r,y-r*1.3],[x,y-r*1.1],[x+.5*r,y-r*1.7],[x+.4*r,y-r*.8]],[125,171,101]);
}
function seed(p,x,y,r=1) { p.ellipse(x,y,r*.65,r,[233,189,101]);p.line(x,y-r*.6,x,y+r*.65,[156,108,59],.16); }
function scrap(p,x,y,r=1) {
    p.ngon(x,y,r,8,.3,[181,137,73]);p.ngon(x,y,r*.73,8,.3,[228,186,109]);p.circle(x,y,r*.38,[71,113,108]);
}
module.exports={creature,heart,berry,seed,scrap,COATS};
