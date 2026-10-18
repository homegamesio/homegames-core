const { oval, rect, stroke, closed } = require('./shapes');
const C = {
    ink: [57, 64, 65, 255], cream: [255, 250, 225, 255], pink: [245, 164, 157, 255],
    elephant: [151, 175, 192, 255], ear: [193, 193, 204, 255], yellow: [247, 204, 104, 255],
    spot: [181, 124, 78, 255], mane: [181, 110, 63, 255], orange: [236, 159, 77, 255],
    brown: [158, 109, 78, 255], face: [231, 193, 153, 255], black: [69, 85, 99, 255],
};
const SPECIES = [
    { name: 'elephant', hello: 'Pawoo! Hello, elephant!', sky: [224, 242, 237, 255], ground: [183, 215, 153, 255] },
    { name: 'giraffe', hello: 'A tall hello!', sky: [250, 234, 205, 255], ground: [211, 216, 148, 255] },
    { name: 'lion', hello: 'A little roar!', sky: [249, 228, 214, 255], ground: [222, 212, 144, 255] },
    { name: 'penguin', hello: 'Waddle, waddle!', sky: [219, 240, 249, 255], ground: [206, 231, 236, 255] },
    { name: 'monkey', hello: 'Ooh ooh! Hello!', sky: [222, 241, 216, 255], ground: [157, 206, 159, 255] },
    { name: 'zebra', hello: 'Happy little hooves!', sky: [251, 236, 211, 255], ground: [210, 220, 162, 255] },
];

function buildAnimal(game, parent, name) {
    const animal = game.object(parent);
    const add = (points, color, role, pivot) => game.part(animal, points, color, role, pivot);
    const disk = (x, y, rx, ry, color, role, pivot) => add(oval(x, y, rx, ry), color, role, pivot);
    const line = (points, width, color, role, pivot) => add(stroke(points, width), color, role, pivot);
    const face = (x, y, spacing = 3.1) => {
        disk(x - spacing, y, .6, .9, C.ink); disk(x + spacing, y, .6, .9, C.ink);
        disk(x - spacing - 1.1, y + 2, 1.4, .7, C.pink); disk(x + spacing + 1.1, y + 2, 1.4, .7, C.pink);
        line([[x - 1.8, y + 2.1], [x, y + 3], [x + 1.8, y + 2.1]], .45, C.ink);
    };
    if (name === 'elephant') {
        line([[11, -3], [20, 0], [22, 5]], 1.7, C.elephant);
        disk(22, 5, 1.4, 2, C.ink);
        [-8, 6].forEach(x => add(rect(x, 2, 6, 13), C.elephant, 'leg', [x + 3, 3]));
        disk(2, -3, 17, 12, C.elephant);
        disk(-9, -8, 10, 11.8, C.ear, 'ear', [-4, -11]);
        disk(-13, -7, 9, 10, C.elephant);
        line([[-18, -5], [-21, 3], [-21, 11], [-25, 13], [-28, 9]], 5, C.elephant, 'trunk', [-19, -5]);
        disk(-27.8, 8.5, 2.5, 2.1, C.elephant, 'trunk', [-19, -5]);
        disk(-27.8, 7.8, .65, .45, C.ink, 'trunk', [-19, -5]);
        disk(-17, -10, .65, .95, C.ink); disk(-9.7, -10, .65, .95, C.ink);
        disk(-11.2, -7, 1.8, .9, C.pink);
        line([[-12, -4.6], [-10, -3.9], [-8, -4.7]], .5, C.ink);
        [-5, 9].forEach(x => [-1.2, .6, 2.4].forEach(dx => disk(x + dx, 14, .55, .85, C.cream)));
    } else if (name === 'giraffe') {
        line([[-11, -1], [-19, -3], [-21, 2]], 1.3, C.yellow); disk(-21, 2, 1.5, 2.4, C.spot);
        [-9, -2, 8, 14].forEach((x, i) => {
            add(rect(x, 0, 3.2, 20), C.yellow, 'leg', [x, 2]); add(rect(x - .2, 18, 3.6, 2.3), C.spot, 'leg', [x, 2]);
        });
        disk(2, -3, 15.5, 8.5, C.yellow);
        add(closed([[8, 0], [10, -28], [17, -29], [18, 0]]), C.yellow);
        for (const [x, y, rx, ry] of [[-6,-5,2.9,2.3],[1,-1,2.4,2.6],[7,-6,2.4,2],[13,-12,2,2.3],[13,-21,2,2.7]]) disk(x,y,rx,ry,C.spot);
        line([[12, -30], [11, -36]], 1.4, C.yellow); line([[18, -30], [20, -36]], 1.4, C.yellow);
        disk(11, -36, 1.4, 1.4, C.spot); disk(20, -36, 1.4, 1.4, C.spot);
        disk(9, -30, 4.5, 2, C.yellow); disk(23, -30, 4, 2, C.yellow);
        disk(16, -27, 7, 6.4, C.yellow); disk(16, -23.4, 5.5, 3, C.cream);
        face(16, -28, 2.6);
    } else if (name === 'lion') {
        line([[10, -4], [19, -6], [23, -3], [22, 3]], 2, C.orange); disk(22, 4, 2.4, 3.4, C.mane);
        [-7, 6].forEach(x => { add(rect(x, 3, 6.3, 12), C.orange, 'leg', [x, 3]); disk(x + 2, 14, 4, 2.5, C.orange, 'leg', [x, 3]); });
        disk(4, -2, 14, 10, C.yellow);
        for (let i = 0; i < 12; i++) {
            const a = i * Math.PI / 6;
            disk(-10 + Math.cos(a) * 10, -7 + Math.sin(a) * 10, 5, 5, C.mane);
        }
        disk(-10, -7, 11.5, 11.5, C.mane);
        disk(-17, -14, 3, 3, C.orange); disk(-3, -14, 3, 3, C.orange);
        disk(-10, -7, 9.4, 8.8, C.yellow);
        disk(-13, -7, .7, 1, C.ink); disk(-6.7, -7, .7, 1, C.ink);
        disk(-12, -3, 2.8, 2.4, C.cream); disk(-8, -3, 2.8, 2.4, C.cream);
        add(closed([[-11.5,-5.4],[-8.5,-5.4],[-10,-3.8]]),C.ink);
        disk(-10, -.9, 1.5, 1, C.ink, 'mouth', [-10, -1]);
    } else if (name === 'penguin') {
        disk(-6, 14.3, 5.6, 2.5, C.orange); disk(6, 14.3, 5.6, 2.5, C.orange);
        disk(-11.5, 0, 3.6, 10.4, C.black, 'wing', [-10, -7]);
        disk(11.5, 0, 3.6, 10.4, C.black, 'wing2', [10, -7]);
        disk(0, -1, 12, 16.2, C.black); disk(0, 2, 9, 11, C.cream);
        disk(0, -13, 10.5, 10, C.black);
        disk(-4.2, -12, 5, 6, C.cream); disk(4.2, -12, 5, 6, C.cream);
        disk(-4, -13, .72, 1.1, C.ink); disk(4, -13, .72, 1.1, C.ink);
        add(closed([[-3, -9], [3, -9], [0, -6.5]]), C.orange);
        disk(-7, -9, 1.5, .9, C.pink); disk(7, -9, 1.5, .9, C.pink);
        add(rect(-8, -2, 16, 2.8), [235, 147, 150, 255]);
        add(rect(3, 0, 3, 6), [235, 147, 150, 255]);
    } else if (name === 'monkey') {
        line([[9, 6], [19, 6], [24, 0], [22, -9], [17, -11], [14, -7], [17, -4]], 3.2, C.brown);
        line([[-5, 3], [-8, 14], [-13, 15]], 5, C.brown, 'leg', [-5, 3]);
        line([[5, 3], [8, 14], [13, 15]], 5, C.brown, 'leg', [5, 3]);
        line([[-8, -5], [-14, -2], [-18, -9]], 4.5, C.brown, 'wave', [-8, -5]);
        disk(-18, -10, 3, 3.2, C.face, 'wave', [-8, -5]);
        line([[8, -5], [14, 2], [12, 7]], 4.5, C.brown);
        disk(0, 0, 9, 11, C.brown); disk(0, 1.5, 5.5, 7.5, C.face);
        [-10, 10].forEach(x => { disk(x, -14, 4.8, 5.2, C.brown); disk(x, -14, 3, 3.3, C.face); });
        disk(0, -14, 11, 10, C.brown);
        disk(-4, -13.5, 5.6, 6.7, C.face); disk(4, -13.5, 5.6, 6.7, C.face);
        disk(0, -8.8, 7.2, 4.5, C.face); face(0, -13, 3.7);
        line([[-2, -23], [1, -26], [2, -22]], 1.8, C.brown);
    } else {
        line([[11, -3], [20, -2], [23, 5]], 1.5, C.cream); disk(23, 5, 1.7, 3, C.black);
        [-9, -3, 8, 14].forEach(x => {
            add(rect(x, 1, 3.4, 14.5), C.cream, 'leg', [x, 2]);
            add(rect(x, 8, 3.4, 2), C.black, 'leg', [x, 2]);
            add(rect(x - .2, 13, 3.8, 2.8), C.black, 'leg', [x, 2]);
        });
        disk(2, -4, 16, 9, C.cream);
        [-7, -1, 5, 11].forEach(x => add(closed([[x-1,-11.4],[x+2,-11],[x-.2,3],[x-2.2,2]]), C.black));
        add(closed([[-14,0],[-20,-19],[-13,-22],[-5,-2]]), C.cream);
        add(closed([[-20,-19],[-15,-23],[-9,-16],[-13,-15]]), C.black);
        disk(-17, -20, 7, 7.8, C.cream); disk(-20.6, -16.5, 5.6, 4, C.black);
        disk(-22, -26, 2, 5, C.cream); disk(-13, -27, 2, 5, C.cream);
        disk(-22, -26, .8, 3, C.pink); disk(-13, -27, .8, 3, C.pink);
        disk(-18, -21, .7, .9, C.ink); disk(-12.4, -20.5, .7, .9, C.ink);
        add(closed([[-20,-26],[-17,-26],[-17.5,-22]]), C.black);
        line([[-22,-16],[-20,-15],[-18.5,-16]], .45, C.cream);
    }
    return animal;
}
module.exports = { SPECIES, buildAnimal };
