// Original paper-cut café friends. Each customer is a single transformable object.
const ANIMALS = ['cat', 'cow', 'giraffe', 'dog', 'pig', 'horse'];
const OUTFITS = ['heart-shirt', 'stripes', 'overalls', 'bow-tie'];
const C = {
    cream: [255, 239, 202, 255], white: [255, 251, 231, 255], coral: [217, 77, 47, 255],
    orange: [239, 128, 55, 255], gold: [244, 183, 53, 255], peach: [248, 192, 144, 255],
    mint: [159, 207, 168, 255], teal: [40, 124, 112, 255], brown: [88, 47, 30, 255],
    caramel: [190, 123, 66, 255], pink: [237, 150, 139, 255], blush: [220, 112, 109, 255],
};
const TAU = Math.PI * 2;
const closed = points => [...points, points[0]];
const oval = (x, y, rx, ry = rx) => Array.from({ length: 25 }, (_, i) => [
    x + Math.cos(i * TAU / 24) * rx, y + Math.sin(i * TAU / 24) * ry,
]);
const rect = (x, y, w, h) => closed([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
const heart = (x, y, size) => closed(Array.from({ length: 32 }, (_, i) => {
    const t = i * TAU / 32;
    return [x + Math.pow(Math.sin(t), 3) * size,
        y - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * size / 16];
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

function createCustomer(game, parent, appearance = {}) {
    const animal = ANIMALS.includes(appearance.animal) ? appearance.animal : 'cat';
    const outfit = OUTFITS.includes(appearance.outfit) ? appearance.outfit : 'heart-shirt';
    const color = appearance.color || C.teal;
    const dark = color.slice(0, 3).map((v, i) => Math.round(v * .68 + C.brown[i] * .32)).concat(255);
    const light = (color[0] * .299 + color[1] * .587 + color[2] * .114) > 175;
    const detail = light ? C.teal : C.cream;
    const friend = game.object(parent);
    const part = (points, fill) => game.part(friend, points, fill);
    const disk = (x, y, rx, ry, fill) => part(oval(x, y, rx, ry), fill);
    const line = (points, width, fill) => part(stroke(points, width), fill);
    const eye = (x, y) => {
        disk(x, y, .46, .7, C.brown);
        disk(x - .12, y - .24, .12, .15, C.white);
    };
    const eyes = (y, gap = 2.5) => { eye(-gap, y); eye(gap, y); };
    const smile = (y, width = 1.6) => line([
        [-width, y], [-width * .55, y + .55], [0, y + .7], [width * .55, y + .55], [width, y],
    ], .35, C.brown);
    const cheeks = (x, y, fill = C.peach) => {
        disk(-x, y, 1.05, .6, fill); disk(x, y, 1.05, .6, fill);
    };

    // Broad shoulders and a rounded hem leave plenty of room for a bold outfit.
    const shirt = outfit === 'overalls' ? C.cream : color;
    disk(-4.8, 6.4, 2.6, 3.2, shirt); disk(4.8, 6.4, 2.6, 3.2, shirt);
    disk(0, 8.6, 6.6, 8.4, shirt);
    let fur;

    if (animal === 'cat') {
        fur = C.orange;
        part(closed([[-6, -5], [-6.7, -12.5], [-1, -8]]), fur);
        part(closed([[6, -5], [6.7, -12.5], [1, -8]]), fur);
        part(closed([[-5.2, -6], [-5.7, -10.2], [-2.6, -7.3]]), C.coral);
        part(closed([[5.2, -6], [5.7, -10.2], [2.6, -7.3]]), C.coral);
        disk(0, -3.5, 6.4, 6.5, fur);
        part(closed([[-1.3, -9.8], [0, -6.9], [1.3, -9.8]]), C.caramel);
        disk(-2, -1, 2.3, 2, C.cream); disk(2, -1, 2.3, 2, C.cream);
        eyes(-4.5, 2.6);
        part(closed([[-.85, -2], [.85, -2], [0, -1.05]]), C.coral);
        line([[-1.5, -.3], [-.75, .3], [0, -.35], [.75, .3], [1.5, -.3]], .3, C.brown);
        line([[-4.7, -1], [-7.6, -1.5]], .3, C.brown);
        line([[4.7, -1], [7.6, -1.5]], .3, C.brown);
    } else if (animal === 'cow') {
        fur = C.white;
        part(closed([[-4.7, -8.3], [-5.7, -14], [-2.1, -10]]), C.gold);
        part(closed([[4.7, -8.3], [5.7, -14], [2.1, -10]]), C.gold);
        disk(-6.2, -6.6, 2.5, 1.85, C.brown); disk(6.2, -6.6, 2.5, 1.85, fur);
        disk(-6.4, -6.4, 1.4, .85, C.pink); disk(6.4, -6.4, 1.4, .85, C.pink);
        disk(0, -4.1, 6.25, 7, fur);
        disk(-3.5, -7.5, 2.3, 2.4, C.brown);
        disk(-2.1, -8.6, 1.9, 1.4, C.brown);
        eyes(-4.9, 2.55);
        disk(0, -.45, 4.7, 2.9, C.pink);
        disk(-1.9, -.95, .52, .66, C.brown); disk(1.9, -.95, .52, .66, C.brown);
        smile(.5, 1.65);
    } else if (animal === 'giraffe') {
        fur = C.gold;
        // The long spotted neck and little knobbed horns carry the silhouette.
        part(closed([[-2.8, -12], [2.8, -12], [3.3, 4], [-3.3, 4]]), fur);
        disk(-1.75, -4.5, 1.05, 1.6, C.caramel); disk(1.8, -.2, 1.05, 1.5, C.caramel);
        line([[-2.9, -17.2], [-3.3, -22]], 1.35, C.caramel);
        line([[2.9, -17.2], [3.3, -22]], 1.35, C.caramel);
        disk(-3.3, -22, 1.15, 1.35, C.brown); disk(3.3, -22, 1.15, 1.35, C.brown);
        part(closed([[-4.2, -16.2], [-8.25, -19.1], [-7.4, -14.8], [-4.4, -13.2]]), fur);
        part(closed([[4.2, -16.2], [8.25, -19.1], [7.4, -14.8], [4.4, -13.2]]), fur);
        part(closed([[-4.8, -16], [-7.3, -17.7], [-6.75, -15.1]]), C.caramel);
        part(closed([[4.8, -16], [7.3, -17.7], [6.75, -15.1]]), C.caramel);
        disk(0, -12.5, 5.6, 6.8, fur);
        disk(-3.6, -15.5, 1.45, 1.45, C.caramel);
        disk(3.3, -16.8, 1.2, 1.25, C.caramel);
        eyes(-13.4, 2.2);
        disk(0, -8.75, 4.5, 2.8, C.peach);
        disk(-1.6, -9.55, .4, .5, C.brown); disk(1.6, -9.55, .4, .5, C.brown);
        smile(-8.4, 1.5);
    } else if (animal === 'dog') {
        fur = C.peach;
        disk(-5.9, -3.9, 2.75, 5.8, C.caramel); disk(5.9, -3.9, 2.75, 5.8, C.caramel);
        disk(0, -4.1, 6.2, 6.8, fur);
        disk(-2.9, -6.1, 2.1, 2.9, C.caramel);
        eyes(-4.8, 2.55);
        disk(0, -.8, 3.9, 2.65, C.cream);
        disk(0, -1.55, 1.25, .85, C.brown);
        line([[0, -1.1], [0, .15]], .32, C.brown);
        smile(.1, 1.6);
        disk(.55, 1.15, .65, .9, C.coral);
    } else if (animal === 'pig') {
        fur = C.pink;
        part(closed([[-5.4, -5.8], [-7.1, -12.2], [-2.5, -10.8], [-1, -6.8]]), fur);
        part(closed([[5.4, -5.8], [7.1, -12.2], [2.5, -10.8], [1, -6.8]]), fur);
        part(closed([[-5.2, -7.3], [-5.9, -10.5], [-3.2, -9.8]]), C.blush);
        part(closed([[5.2, -7.3], [5.9, -10.5], [3.2, -9.8]]), C.blush);
        disk(0, -3.6, 6.55, 6.55, fur);
        eyes(-5.05, 2.5);
        cheeks(4.35, -2.45, C.blush);
        disk(0, -1.45, 3.55, 2.15, C.blush);
        disk(-1.35, -1.55, .58, .8, C.brown); disk(1.35, -1.55, .58, .8, C.brown);
        smile(1.15, 1.45);
    } else {
        fur = C.caramel;
        // Tall ears, a cream blaze and a long muzzle make a pony, not a dog.
        part(closed([[-4.9, -9], [-5.4, -18], [-2, -15.2], [-1.7, -8]]), fur);
        part(closed([[4.9, -9], [5.4, -18], [2, -15.2], [1.7, -8]]), fur);
        part(closed([[-4.2, -11], [-4.5, -16.1], [-2.9, -14.4], [-2.8, -10]]), C.peach);
        part(closed([[4.2, -11], [4.5, -16.1], [2.9, -14.4], [2.8, -10]]), C.peach);
        disk(-3.7, -6.2, 3.2, 7.9, C.brown);
        disk(0, -5.8, 5.9, 8.25, fur);
        part(closed([[-1.4, -12.7], [1.4, -12.7], [.7, -6.9], [1.55, -2.7], [-1.55, -2.7], [-.7, -6.9]]), C.cream);
        part(closed([[-4.3, -11.6], [-2.4, -14.2], [1, -14.5], [3.7, -12.4], [1.3, -10.2], [.3, -12.1], [-1.3, -9.7], [-2, -12.1]]), C.brown);
        eyes(-6.7, 2.6);
        disk(0, -.8, 5.15, 3.5, C.peach);
        disk(-2.25, -1.5, .48, .7, C.brown); disk(2.25, -1.5, .48, .7, C.brown);
        smile(.3, 1.9);
    }

    if (outfit === 'heart-shirt') {
        line([[-2.2, 3], [-1.1, 3.8], [1.1, 3.8], [2.2, 3]], .6, detail);
        part(heart(0, 8.8, 2.6), detail);
    } else if (outfit === 'stripes') {
        // Follow the round shirt edge so stripes never poke outside the body.
        for (const y of [5.4, 9.2, 13]) {
            const edge = yy => 6.6 * Math.sqrt(1 - Math.pow((yy - 8.6) / 8.4, 2));
            const left = [], right = [];
            for (let i = 0; i <= 4; i++) {
                const yy = y + i * .4;
                left.push([-edge(yy), yy]); right.unshift([edge(yy), yy]);
            }
            part(closed([...left, ...right]), detail);
        }
    } else if (outfit === 'overalls') {
        part(closed([[-3.8, 5.9], [3.8, 5.9], [3.8, 10], [6.45, 10], [6, 12.2], [5.2, 14], [3.8, 15.5], [2.2, 16.55], [0, 17], [-2.2, 16.55], [-3.8, 15.5], [-5.2, 14], [-6, 12.2], [-6.45, 10], [-3.8, 10]]), color);
        part(rect(-3.85, 2.8, 1.55, 5.4), color); part(rect(2.3, 2.8, 1.55, 5.4), color);
        disk(-3.08, 6.7, .55, .55, C.gold); disk(3.08, 6.7, .55, .55, C.gold);
        part(closed([[-2.1, 9], [2.1, 9], [2.1, 11.5], [0, 12.55], [-2.1, 11.5]]), dark);
        part(heart(0, 10.55, .9), C.cream);
    } else {
        part(closed([[-3.1, 2.5], [0, 3.65], [-2.1, 5.8], [-3.65, 3.7]]), C.cream);
        part(closed([[3.1, 2.5], [0, 3.65], [2.1, 5.8], [3.65, 3.7]]), C.cream);
        line([[0, 5.8], [0, 15.9]], .42, dark);
        part(closed([[-2.15, 3.75], [0, 4.5], [-2.15, 5.75]]), detail);
        part(closed([[2.15, 3.75], [0, 4.5], [2.15, 5.75]]), detail);
        disk(0, 4.75, .7, .7, C.gold);
        for (const y of [8, 11, 14]) disk(0, y, .48, .48, C.gold);
    }
    // Round hands rest at the edge of the counter, in front of the sleeves.
    disk(-6.05, 10.5, 1.95, 2.4, fur); disk(6.05, 10.5, 1.95, 2.4, fur);
    if (animal === 'cow' || animal === 'horse') {
        disk(-6.05, 11.4, 1.8, 1.15, C.brown); disk(6.05, 11.4, 1.8, 1.15, C.brown);
    }
    return friend;
}

module.exports = { ANIMALS, OUTFITS, createCustomer };
