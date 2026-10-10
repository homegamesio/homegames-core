const TAU = Math.PI * 2;
const C = {
    bg: [11, 31, 47], dark: [20, 24, 48], panel: [39, 32, 78], panelLight: [71, 48, 112],
    cream: [255, 249, 216], muted: [191, 205, 218], line: [126, 101, 161],
    orange: [255, 137, 75], coral: [255, 106, 116], gold: [255, 210, 103],
    blue: [98, 207, 241], purple: [188, 130, 255], green: [95, 242, 191], teal: [31, 115, 119],
};

function fiveStar(p, x, y, r, color, alpha = 1) {
    const points = [];
    for (let i = 0; i < 10; i++) {
        const angle = i * Math.PI / 5 - Math.PI / 2, radius = i % 2 ? r * .47 : r;
        points.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius]);
    }
    p.poly(points, color, null, 0, alpha);
}

function display(p, text, x, y, size, color = C.cream, align = 'center', alpha = 1) {
    p.heading(text, x + .12, y + size * .095, size, [33, 20, 65], align, alpha);
    p.heading(text, x, y, size, color, align, alpha);
}

function moon(p, x, y, r, reaction = 'idle', time = 0, color = C.gold, reduced = false) {
    const bounce = reduced ? 0 : Math.sin(time * (reaction === 'wow' ? 9 : 2)) * r * .025;
    y += bounce;
    p.circle(x, y + r * .16, r * 1.06, [28, 37, 67], null, .55);
    p.circle(x, y, r * 1.03, color);
    p.circle(x - r * .035, y - r * .06, r * .93, C.cream);
    p.circle(x + r * .59, y + r * .14, r * .24, color, null, .25);
    p.circle(x - r * .53, y - r * .48, r * .19, color, null, .22);
    p.circle(x - r * .26, y - r * .67, r * .1, color, null, .3);
    p.circle(x + r * .41, y - r * .6, r * .1, color, null, .3);
    p.circle(x - r * .41, y + r * .24, r * .17, C.coral, null, .43);
    p.circle(x + r * .41, y + r * .24, r * .17, C.coral, null, .43);
    const blink = reaction === 'happy' || (!reduced && time % 5.7 > 5.5);
    for (const sign of [-1, 1]) {
        const ex = x + sign * r * .27, ey = y - r * .06;
        if (blink) p.arc(ex, ey + r * .08, r * .14, Math.PI * 1.15, Math.PI * .7, C.dark, r * .055);
        else {
            p.circle(ex, ey, r * (reaction === 'wow' ? .12 : .095), C.dark);
            p.circle(ex - r * .024, ey - r * .035, r * .034, C.cream);
        }
    }
    if (reaction === 'wow') p.circle(x, y + r * .31, r * .18, C.dark);
    else if (reaction === 'sad') p.arc(x, y + r * .47, r * .2, Math.PI * 1.15, Math.PI * .7, C.dark, r * .045);
    else p.arc(x, y + r * .14, r * .25, .16, Math.PI - .32, C.dark, r * .055);
    if (reaction === 'happy' || reaction === 'wow') {
        p.star(x - r * 1.14, y - r * .45, r * .19, C.gold);
        p.star(x + r * 1.13, y + r * .17, r * .15, C.green);
    }
}

function powerIcon(p, id, x, y, size, color) {
    if (id === 'magnet') {
        p.arc(x, y - size * .25, size * .85, 0, Math.PI, color, size * .38);
        p.rect(x - size * 1.05, y - size * .55, size * .4, size * .5, C.cream);
        p.rect(x + size * .65, y - size * .55, size * .4, size * .5, C.cream);
    } else if (id === 'phoenix') {
        p.poly([[x - size * 1.2, y - size * .7], [x - size * .15, y], [x, y + size], [x + size * .15, y], [x + size * 1.2, y - size * .7], [x, y - size * .25]], color);
        p.circle(x, y - size * .4, size * .36, C.cream);
    } else if (id === 'blast') {
        fiveStar(p, x, y, size * 1.15, color);
        p.circle(x, y, size * .48, C.cream);
    } else if (id === 'twin') {
        p.circle(x - size * .45, y + size * .3, size * .67, color);
        p.circle(x + size * .5, y - size * .3, size * .67, C.cream);
        p.circle(x + size * .35, y - size * .5, size * .15, color);
    } else {
        p.arc(x, y + size * .6, size * 1.45, -2.55, 1.7, color, .18);
        p.star(x + size * .9, y - size * .6, size * .5, C.cream);
    }
}

function powerCharacter(p, id, x, y, r, color, time = 0) {
    const rise = Math.sin(time * 2) * .2;
    p.circle(x, y + r * .7, r * .8, C.dark, null, .45);
    if (id === 'magnet') {
        p.poly([[x + r * .6, y - r * .2 + rise], [x - r * 1.8, y - r * 1.1 + rise], [x - r * 1.2, y + r * .35 + rise], [x, y + r * .65 + rise]], C.purple);
        p.circle(x, y + rise, r * .8, color);
        p.star(x - r * 1.3, y - r * .8 + rise, r * .32, C.cream);
    } else if (id === 'phoenix') {
        p.poly([[x - r * 1.2, y - r * .65 + rise], [x - r * .5, y + r * .55 + rise], [x, y + r * 1.1 + rise], [x + r * .5, y + r * .55 + rise], [x + r * 1.2, y - r * .65 + rise], [x, y - r * .3 + rise]], color);
        p.circle(x, y + rise - r * .1, r * .66, C.gold);
        p.poly([[x - r * .2, y - r * .6 + rise], [x, y - r * 1.1 + rise], [x + r * .2, y - r * .6 + rise]], C.coral);
    } else if (id === 'blast') {
        fiveStar(p, x, y + rise, r * 1.1, color);
        p.circle(x, y + rise, r * .73, [255, 188, 116]);
    } else if (id === 'twin') {
        p.circle(x - r * .42, y + rise + r * .1, r * .73, color);
        p.circle(x + r * .49, y + rise - r * .2, r * .6, C.cream);
    } else {
        p.circle(x, y + rise, r * .87, color);
        p.poly([[x - r, y - r * .3 + rise], [x, y - r * 1.3 + rise], [x + r * .8, y - r * .3 + rise]], C.panelLight, C.purple, .1);
        p.star(x, y - r * .7 + rise, r * .23, C.gold);
    }
    for (const sign of [-1, 1]) p.circle(x + sign * r * .25, y + rise, r * .095, C.dark);
    p.arc(x, y + rise + r * .15, r * .21, .1, Math.PI - .2, C.dark, .12);
}

function gem(p, item, time, reduced = false) {
    const { x, y, r = 1.1, type, hit } = item;
    const c = C[type] || C.blue, dark = type === 'orange' ? [182, 57, 70] : type === 'blue' ? [25, 86, 134] :
        type === 'green' ? [19, 125, 112] : [92, 42, 152];
    if (hit) {
        const pulse = reduced ? 1 : 1 + Math.sin(time * 9 + (item.id || 0)) * .08;
        p.circle(x, y, r * 1.7 * pulse, c, null, .16);
        p.circle(x, y, r * 1.08, c);
        p.circle(x, y, r * .74, C.cream);
        if (type !== 'blue') p.star(x, y, r * .9, C.cream, .85);
        return;
    }
    p.circle(x, y + r * .18, r * 1.07, C.dark, null, .6);
    if (type === 'purple') {
        p.ngon(x, y, r, 4, 0, dark);
        p.ngon(x, y - r * .09, r * .84, 4, 0, c);
        p.poly([[x - r * .6, y], [x, y - r * .75], [x + r * .15, y]], C.cream, null, 0, .65);
        return;
    }
    p.circle(x, y, r, dark);
    p.circle(x, y - r * .1, r * .87, c);
    p.circle(x - r * .2, y - r * .34, r * .31, C.cream, null, .8);
    if (type === 'green') {
        p.line(x - r * .4, y + r * .14, x + r * .4, y + r * .14, C.cream, .22);
        p.line(x, y - r * .25, x, y + r * .5, C.cream, .22);
    } else if (type === 'orange') {
        p.circle(x + r * .23, y + r * .29, r * .24, [255, 187, 76], null, .7);
    }
}

function fallbackGarden(p, time = 0) {
    p.rect(0, 0, 160, 90, [24, 50, 78]);
    p.circle(114, 21, 24, [88, 84, 131], null, .28);
    p.circle(114, 21, 17, [112, 113, 145], null, .22);
    p.poly([[0, 62], [18, 45], [39, 65], [68, 49], [91, 64], [123, 41], [160, 58], [160, 90], [0, 90]], [30, 79, 86]);
    p.poly([[0, 75], [26, 61], [52, 72], [81, 62], [111, 73], [142, 55], [160, 73], [160, 90], [0, 90]], [21, 63, 65]);
    for (let i = 0; i < 9; i++) {
        const x = i % 2 ? 153 + Math.sin(i) * 6 : 1 + Math.sin(i) * 6, y = 38 + i * 5.5;
        p.line(x, y, x + (i % 2 ? -7 : 7), y - 6, [43, 128, 109], 1.3);
        p.ngon(x + (i % 2 ? -7 : 7), y - 6, 3, 5, i, i % 3 ? C.purple : C.coral, null, .8);
    }
    for (let i = 0; i < 16; i++) p.star(4 + i * 9.7, 5 + (i * 13.7) % 62, .2 + i % 3 * .14, C.gold, .4 + Math.sin(time + i) * .15);
}

function frame(p, x, y, w, h, color = C.gold) {
    p.roundRect(x, y + 1, w, h, 3.8, C.dark, null, .9);
    p.roundRect(x, y, w, h, 3.8, [113, 75, 63]);
    p.roundRect(x + .25, y + .2, w - .5, h - .7, 3.5, color);
    p.roundRect(x + .7, y + .6, w - 1.4, h - 1.6, 3.1, [63, 55, 104]);
    p.roundRect(x + 1.05, y + .9, w - 2.1, h - 2.2, 2.7, C.teal);
    p.line(x + 4, y + .4, x + w - 4, y + .4, C.cream, .23, .75);
}

module.exports = { C, TAU, fiveStar, display, moon, powerIcon, powerCharacter, gem, fallbackGarden, frame };
