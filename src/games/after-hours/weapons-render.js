'use strict';

// First-person exhibit weapons built entirely from the existing Squish Scene
// polygons, rectangles and text. Part keys stay stable throughout animation;
// changing weapon lets Scene detach the previous model's unreferenced nodes.
const WHITE = '#eef4ea', EDGE = '#101a22', DARK = '#24313c', STEEL = '#748c94';
const CLIP = [0, 10, 100, 84];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const ring = (x, y, rx, ry, points = 10, phase = 0) => Array.from({ length: points }, (_, index) => {
    const a = phase + index * Math.PI * 2 / points;
    return [x + Math.cos(a) * rx, y + Math.sin(a) * ry];
});

function painter(scene, id, dx, dy) {
    const key = part => 'gun/' + id + '/' + part;
    const poly = (part, points, color, alpha = 255) => scene.poly(key(part), points.map(([x, y]) => [x + dx, y + dy]), color, alpha, CLIP);
    const rect = (part, x, y, w, h, color, alpha = 255) => scene.rect(key(part), x + dx, y + dy, w, h, color, alpha, CLIP);
    const ellipse = (part, x, y, rx, ry, color, alpha = 255) => poly(part, ring(x, y, rx, ry, 12), color, alpha);
    const text = (part, value, x, y, size, color) => scene.text(key(part), value, x + dx, y + dy, size, color, 'left', 'monospace');
    const bolt = (part, x, y, size = .38) => {
        poly(part, ring(x, y, size, size * 1.35, 6), STEEL);
        rect(part + '-slot', x - size * .55, y - .09, size * 1.1, .18, EDGE);
    };
    return { poly, rect, ellipse, text, bolt };
}

function hands(d, heavy = false) {
    d.poly('sleeve', [[74, 79], [83, 78], [92, 92], [72, 93]], '#263846');
    d.poly('sleeve-lit', [[79, 79], [83, 80], [90, 91], [86, 93]], '#486371');
    d.poly('cuff', [[72.8, 80], [78.8, 77.5], [84, 82], [78.5, 86.5]], EDGE);
    d.poly('hand', [[68, 76], [72, 72.4], [78.5, 75.4], [80, 81.5], [76, 85], [69, 82]], '#485256');
    d.poly('knuckles', [[69, 76], [71.6, 74], [76.8, 76], [78, 78.4], [73.7, 79.2]], '#80928a');
    d.poly('thumb', [[68, 75.2], [69.1, 73.5], [73.7, 76], [73, 78], [70, 77.4]], '#a1a798');
    for (let i = 0; i < 3; i++) d.poly('finger-' + i, [[70 + i * 1.8, 78], [71.2 + i * 1.8, 78.2], [72 + i * 1.8, 81.8], [70.8 + i * 1.8, 81.6]], '#263639');
    if (heavy) {
        d.poly('support-arm', [[54, 79], [59, 74], [66, 76], [68, 86], [54, 88]], '#344d55');
        d.poly('support-glove', [[56, 75], [59, 72.7], [64, 72.2], [67, 74.6], [65, 80.4], [59, 81]], '#59675f');
        d.poly('support-thumb', [[57.7, 74.5], [59.2, 72.2], [64.4, 73.7], [65, 75.4], [62, 76.6]], '#929c8a');
    }
}

function powderFlash(d, x, y, strength, broad = false) {
    if (strength <= 0) return;
    const radius = (broad ? 4.7 : 3.2) * (.55 + strength * .45);
    const points = Array.from({ length: 12 }, (_, index) => {
        const angle = index * Math.PI / 6, r = index % 2 ? radius * .38 : radius;
        return [x + Math.cos(angle) * r, y + Math.sin(angle) * r * 1.5];
    });
    d.poly('flash-outer', points, '#ffae50', Math.round(180 + strength * 75));
    d.poly('flash-inner', ring(x, y, radius * .4, radius * .7, 6), '#ffeec2');
    d.ellipse('flash-hot', x, y, radius * .16, radius * .31, WHITE);
}

function pulse(d, p, flash) {
    hands(d);
    d.poly('grip', [[67, 71], [73, 73], [74, 85], [69, 84]], EDGE);
    d.poly('receiver-edge', [[57, 66], [62, 59], [69, 62], [77, 76], [67, 80], [59, 73]], EDGE);
    d.poly('receiver-top', [[57.8, 65.8], [62.4, 60.3], [68.6, 63], [71.6, 69.4], [64, 72.2]], '#c9d8cc');
    d.poly('receiver-side', [[64, 72.2], [71.6, 69.4], [76, 76], [67.3, 79]], '#627b7e');
    d.poly('receiver-light', [[58, 66], [64, 72.2], [67, 79], [60, 72.7]], '#8ca6a2');
    d.poly('emitter', [[60, 65], [59.4, 59], [62.4, 56.8], [65.1, 58.8], [67, 65.4]], EDGE);
    d.poly('emitter-inlay', [[61, 59.3], [62.6, 58.2], [64, 59.3], [64.5, 62.8], [61.5, 62.4]], '#a0eaf0');
    d.poly('capacitor', [[68.5, 64.9], [70.6, 65.8], [75, 75.5], [72.7, 75.9]], '#4eb8cd');
    for (let i = 0; i < 4; i++) d.rect('vent-' + i, 63 + i * 1.05, 66.4 + i * .55, .48, 2.3, EDGE);
    d.rect('rear-sight', 67.7, 65, 3.1, .6, EDGE);
    d.rect('sight-light', 68.8, 64.5, .7, .7, '#d4ffff');
    d.bolt('fastener-front', 61.4, 69.1); d.bolt('fastener-rear', 69, 74.7);
    d.text('mark', 'P-01', 66.8, 71.5, .73, '#d7ede1');
    if (flash > 0) {
        d.ellipse('pulse-bloom', 62.4, 57.5, 2.6, 3.3, '#67d4eb', 135);
        d.poly('pulse-star', [[62.3, 53], [63.1, 56.5], [65, 57.6], [63, 58.5], [62.2, 61], [61.5, 58.8], [59.8, 57.5], [61.3, 56.5]], '#c5f5ff');
    }
}

function machinegun(d, p, flash, cycle) {
    hands(d, true);
    d.poly('stock', [[74, 74], [82, 78], [86, 88], [76, 88], [71, 79]], '#1a252d');
    d.poly('stock-pad', [[81, 79.5], [83, 80.5], [86, 88], [83.8, 88]], '#6e7d70');
    d.poly('magazine', [[68, 73], [74, 74.2], [77, 83], [75, 88], [69, 86]], '#4c5d48');
    for (let i = 0; i < 4; i++) d.poly('mag-rib-' + i, [[70, 77 + i * 2], [74.2, 78 + i * 2], [74.5, 78.7 + i * 2], [70.1, 77.7 + i * 2]], '#26382f');
    d.poly('receiver-shadow', [[57, 62], [62, 57.5], [74, 69], [80, 79], [69, 81], [58, 70]], EDGE);
    d.poly('receiver-top', [[57.4, 62.1], [62.2, 58.6], [72.1, 67.8], [66.5, 71.4]], '#718478');
    d.poly('receiver-side', [[66.5, 71.4], [72.1, 67.8], [78.6, 77.9], [69.4, 79.7]], '#3a4e4b');
    d.poly('receiver-left', [[57.4, 62.1], [66.5, 71.4], [69.4, 79.7], [58.7, 69.6]], '#4d625b');
    d.poly('heat-shield', [[55.8, 61], [60.2, 57.8], [66.6, 65], [62.7, 68.7]], '#273a40');
    for (let i = 0; i < 5; i++) d.poly('barrel-vent-' + i, [[57.8 + i * .85, 61.1 + i * .96], [58.6 + i * .85, 60.5 + i * .96], [59.6 + i * .85, 61.7 + i * .96], [58.8 + i * .85, 62.3 + i * .96]], '#8ba28e');
    d.poly('muzzle-brake', [[54.2, 56.9], [56.8, 54.8], [60, 58.6], [57.2, 60.8]], '#596d70');
    d.poly('muzzle-hole', [[54.7, 56.8], [56.5, 55.4], [57.4, 56.6], [55.6, 58]], '#070e16');
    for (let i = 0; i < 3; i++) d.poly('rail-tooth-' + i, [[61 + i * 2, 61 + i * 2], [62.3 + i * 2, 60.3 + i * 2], [63.1 + i * 2, 61.1 + i * 2], [61.8 + i * 2, 61.8 + i * 2]], '#abb4a0');
    d.poly('ejection-port', [[69, 69.9], [72.2, 70.1], [75.1, 74.4], [71.6, 73.6]], '#111c21');
    d.poly('moving-bolt', [[69.5 + cycle * .7, 70.6 + cycle], [71.5 + cycle * .7, 70.7 + cycle], [72.7 + cycle * .7, 72.4 + cycle], [70.8 + cycle * .7, 72.1 + cycle]], '#87979a');
    d.poly('charging-handle', [[73, 69.6], [75.5, 68.9], [76, 69.9], [73.4, 70.8]], '#b7b49b');
    d.rect('sight-base', 64.6, 62.4, 3.6, 1.3, EDGE);
    d.rect('sight-pin', 66.1, 61.5, .5, 1.1, '#ffcc83');
    d.bolt('receiver-bolt-1', 66.8, 74.7); d.bolt('receiver-bolt-2', 75.1, 76.4);
    d.text('mark', 'MG / 09', 70.1, 75.4, .62, '#d0d9b8');
    if (flash > .2) d.poly('ejected-case', [[79 + cycle * 6, 66 - cycle * 5], [80.5 + cycle * 6, 66.7 - cycle * 5], [80.1 + cycle * 6, 67.6 - cycle * 5], [78.6 + cycle * 6, 66.9 - cycle * 5]], '#ecc16c');
    powderFlash(d, 55.7, 56.8, flash);
}

function shotgun(d, p, flash, cycle) {
    hands(d, true);
    d.poly('stock-outline', [[68, 73], [75, 72], [87, 84], [86, 91], [76, 88]], EDGE);
    d.poly('walnut-stock', [[69, 74], [74.7, 73.3], [85.7, 83.9], [83.7, 88.9], [76.8, 86.6]], '#824e31');
    d.poly('stock-grain', [[74, 75.6], [76, 76], [83.4, 84.6], [80.3, 84]], '#c18a52');
    d.poly('stock-grain-dark', [[76, 78.9], [80, 81.5], [83.8, 87], [80.5, 84.9]], '#58391f');
    d.poly('rubber-pad', [[84.7, 83.3], [87.1, 85.3], [85.7, 90.7], [83.1, 89]], '#20302f');
    d.poly('receiver', [[62, 64], [66.8, 63], [75.7, 74.4], [70.8, 79], [62.4, 70]], EDGE);
    d.poly('receiver-top', [[62.4, 64.5], [66.2, 63.8], [72, 70.9], [68.6, 73.1]], '#b2bab0');
    d.poly('receiver-side', [[68.6, 73.1], [72, 70.9], [74.8, 74.6], [71, 77.8]], '#687876');
    d.poly('shell-port', [[66.8, 68.6], [68.9, 69], [71.8, 73], [69.5, 72.5]], '#1d2b30');
    d.poly('shell-brass', [[68.2, 70], [69.4, 70.5], [70.6, 72.1], [69.4, 71.8]], '#d5ad5f');
    d.poly('long-barrel', [[56.1, 55.7], [58.8, 53.6], [68, 65.9], [65.5, 68.5]], '#374c55');
    d.poly('barrel-highlight', [[56.5, 55.5], [57.2, 55.1], [66.5, 67], [65.7, 67.8]], '#b1c4bf');
    d.poly('under-tube', [[57.4, 60], [59.1, 58.5], [66.1, 68], [64.5, 69.2]], '#172830');
    d.poly('muzzle-rim', [[55.2, 54.8], [57.9, 52.8], [59.3, 54.6], [56.5, 56.7]], '#8a9d9c');
    d.poly('muzzle-bore', [[55.8, 54.8], [57.7, 53.4], [58.5, 54.4], [56.6, 55.8]], '#050b10');
    const pump = Math.sin(cycle * Math.PI) * 2;
    d.poly('pump-outline', [[59 + pump, 62 + pump], [62.8 + pump, 61 + pump], [68 + pump, 68 + pump], [64.2 + pump, 71 + pump]], '#392b24');
    d.poly('pump-wood', [[59.8 + pump, 62.5 + pump], [62.4 + pump, 62 + pump], [66.8 + pump, 68 + pump], [64.3 + pump, 69.5 + pump]], '#a36b3f');
    for (let i = 0; i < 6; i++) d.poly('pump-groove-' + i, [[60.4 + i * .74 + pump, 63.1 + i * .96 + pump], [62.7 + i * .74 + pump, 62.7 + i * .96 + pump], [63 + i * .74 + pump, 63.1 + i * .96 + pump], [60.7 + i * .74 + pump, 63.7 + i * .96 + pump]], '#543b2d');
    for (let i = 0; i < 3; i++) {
        d.poly('spare-shell-' + i, [[73.5 + i * 1.7, 77 + i * .5], [74.6 + i * 1.7, 77.4 + i * .5], [76 + i * 1.7, 81 + i * .5], [74.8 + i * 1.7, 80.8 + i * .5]], '#ad473b');
        d.rect('spare-shell-cap-' + i, 74.9 + i * 1.7, 80.6 + i * .5, 1.05, .6, '#d9b46a');
    }
    d.rect('bead', 58.9, 54.5, .45, .7, '#ffdb8b');
    d.bolt('receiver-bolt', 72.1, 75.5);
    powderFlash(d, 56.5, 54.5, flash, true);
}

function rocket(d, p, flash, cycle) {
    hands(d, true);
    d.poly('launcher-shadow', [[51.5, 61], [55, 51.8], [62, 51], [79, 72.5], [83.5, 84], [70, 87], [54, 71]], '#122325');
    d.poly('tube-top', [[53.3, 60.2], [57, 53.4], [62.3, 52.8], [77.2, 72.8], [68.2, 75.9]], '#778362');
    d.poly('tube-side', [[68.2, 75.9], [77.2, 72.8], [82, 82.7], [71, 85]], '#3d5548');
    d.poly('tube-left', [[53.3, 60.2], [68.2, 75.9], [71, 85], [55.2, 70.3]], '#546952');
    d.poly('tube-highlight', [[56.8, 54.8], [59.2, 53.9], [75.9, 74.9], [72.9, 75.3]], '#a4a681');
    d.ellipse('muzzle-collar', 56.9, 58.2, 5.1, 6.3, '#82918b');
    d.ellipse('muzzle-dark', 56.9, 58.2, 4.05, 5.1, '#182a29');
    d.ellipse('bore-shadow', 57, 58.1, 3.25, 4.15, '#091819');
    if (cycle < .8) {
        d.poly('loaded-rocket', [[54.8, 59.3], [55.5, 55.6], [57.2, 53.8], [58.7, 56.2], [59.3, 59.5], [57.1, 61.1]], '#cbb873');
        d.poly('warhead-highlight', [[57.2, 53.8], [58.7, 56.2], [59.3, 59.5], [57.3, 60]], '#f0d695');
        d.poly('warhead-band', [[55, 58.3], [59.1, 58.1], [59.4, 59.3], [54.8, 59.3]], '#b56844');
    }
    d.poly('front-strap', [[60.7, 62.3], [64.1, 60.5], [69.1, 67], [65.7, 69]], '#273e3b');
    d.poly('rear-strap', [[68.9, 72.2], [73.6, 70.4], [80.9, 79.6], [74.2, 82.4]], '#253c37');
    d.poly('trigger-housing', [[72, 74], [77.8, 76], [77, 85], [72.5, 83]], '#1c2e2d');
    d.poly('carry-handle', [[62.7, 57.1], [66.7, 58.7], [71.6, 65.1], [69.1, 66.3], [64.4, 60.4], [62.7, 59.7]], '#172b2d');
    d.poly('sight-stalk', [[61.1, 57.9], [60.5, 51.8], [61.6, 51.7], [62.8, 59]], '#566f6c');
    d.rect('sight-cap', 59.8, 51.1, 2.5, .8, '#aabc9d');
    for (let i = 0; i < 3; i++) d.poly('warning-band-' + i, [[68 + i * 1.2, 73.6 + i * 1.4], [69.3 + i * 1.2, 73.1 + i * 1.4], [70.5 + i * 1.2, 74.7 + i * 1.4], [69.1 + i * 1.2, 75.2 + i * 1.4]], '#d9b267');
    d.bolt('strap-bolt-1', 66.4, 66.7); d.bolt('strap-bolt-2', 75.9, 79.2);
    d.text('mark', 'RKT  /  HE', 71.6, 77.2, .69, '#ccd9a8');
    if (flash > 0) {
        d.ellipse('launch-cloud', 56.6, 56.8, 6, 6.8, '#bac5b6', Math.round(flash * 130));
        d.poly('launch-flame', [[55, 57], [54, 49.4], [56.6, 53], [58.5, 48.4], [59.5, 56], [58, 59]], '#ffc16e');
        d.ellipse('launch-core', 56.9, 55.7, 1.8, 3, '#fff4d2');
    }
}

function rail(d, p, flash, cycle, time) {
    hands(d, true);
    d.poly('body-edge', [[61, 64], [66.8, 61.2], [79, 74], [81, 85], [69, 85], [60, 73]], EDGE);
    d.poly('body-top', [[61.4, 64.5], [66.3, 62.2], [75.8, 71.9], [69, 75.1]], '#bdc5ce');
    d.poly('body-side', [[69, 75.1], [75.8, 71.9], [79.4, 82.5], [69.8, 83.8]], '#596175');
    d.poly('body-face', [[61.4, 64.5], [69, 75.1], [69.8, 83.8], [61, 73]], '#7c91a1');
    d.poly('rail-left', [[53.9, 52.8], [55.3, 51.7], [67.1, 66.6], [65.3, 68.4]], '#7595ab');
    d.poly('rail-left-edge', [[54, 52.8], [54.6, 52.4], [66.3, 67.4], [65.3, 68.4]], '#d3e1dc');
    d.poly('rail-right', [[57.9, 51.5], [59.7, 50.3], [71.6, 66.1], [69.7, 67.2]], '#93b2c3');
    d.poly('rail-channel', [[55.7, 53], [57.4, 52.6], [70, 68.2], [67.8, 69.3]], '#412d65');
    const glow = .62 + Math.sin(time * 5) * .15 + flash * .22;
    for (let i = 0; i < 6; i++) {
        const x = 57.5 + i * 1.57, y = 54.1 + i * 2.08;
        d.poly('coil-dark-' + i, [[x - 1.5, y], [x + 2, y - 1.7], [x + 3.25, y], [x - .1, y + 2.1]], '#272a4b');
        d.poly('coil-light-' + i, [[x - 1.1, y + .1], [x + 2, y - 1.2], [x + 2.6, y - .5], [x - .4, y + 1]], '#d0aeff', Math.round(glow * 255));
    }
    d.poly('scope-base', [[67, 62.7], [70, 63.5], [73.7, 67.5], [70.7, 69]], '#283248');
    d.poly('scope-tube', [[64.4, 60.9], [65.8, 58.6], [69.3, 58.8], [74, 64.3], [73, 67.4], [70.5, 67]], '#283849');
    d.ellipse('scope-rim', 72, 65.9, 2.2, 2.7, '#87959f');
    d.ellipse('scope-glass', 72, 65.9, 1.45, 1.85, '#382963');
    d.poly('scope-reflection', [[71, 64.8], [72.1, 64.2], [73, 66.8], [71.9, 67.3]], '#d0a8df');
    d.poly('capacitor', [[73, 72.7], [75.9, 73.2], [77.7, 80.2], [74.2, 80.5]], '#2b3e59');
    for (let i = 0; i < 4; i++) d.rect('charge-light-' + i, 74.6 + i * .25, 74.3 + i * 1.4, 1.55, .75, cycle < i / 4 ? '#d4bbff' : '#614e78');
    d.bolt('side-bolt-1', 64.7, 72); d.bolt('side-bolt-2', 71.1, 79.9);
    d.text('mark', 'R / 7', 66.3, 75.7, .73, '#e2d7ef');
    if (flash > 0) {
        d.poly('rail-discharge', [[55.4, 53.6], [53.5, 48.6], [56.1, 52], [57.2, 47.5], [57.8, 51.8], [60.1, 50.2], [58.4, 54]], '#d6b6ff', 220);
        d.ellipse('rail-core', 57, 52.9, 1.8, 1.6, '#f5edff');
    }
}

function plasma(d, p, flash, cycle, time) {
    hands(d, true);
    d.poly('housing-edge', [[55.8, 61.6], [61.7, 57], [70, 60], [80.7, 74], [80.9, 83], [68, 86], [56.7, 76]], EDGE);
    d.poly('ceramic-top', [[57, 62.1], [62.1, 58.2], [68.8, 61.1], [76.2, 69.9], [67.8, 73.4]], '#dce4cd');
    d.poly('ceramic-side', [[67.8, 73.4], [76.2, 69.9], [79.6, 77], [78.6, 82.3], [68.3, 83.8]], '#849d8d');
    d.poly('ceramic-left', [[57, 62.1], [67.8, 73.4], [68.3, 83.8], [57.8, 75]], '#adc2a6');
    d.poly('ceramic-seam', [[58.4, 66.4], [65.8, 74], [66.1, 81.9], [64.9, 81.3], [64.9, 74.5], [57.9, 67.3]], '#59786c');
    d.ellipse('reactor-ring', 69.9, 70.9, 5.2, 6.9, '#223f41');
    d.ellipse('reactor-ring-lit', 69.9, 70.9, 4.45, 5.95, '#579c82');
    d.ellipse('reactor-glass', 69.9, 70.9, 3.6, 4.95, '#124e43');
    const beat = .78 + Math.sin(time * 7) * .13 + flash * .09;
    d.ellipse('reactor-glow', 69.9, 70.9, 2.7 * beat, 3.8 * beat, '#56ecb7');
    d.ellipse('reactor-core', 69.4, 70.1, 1.15, 2.2, '#d4ffe3');
    d.poly('reactor-reflection', [[68, 66.5], [69.4, 65.6], [71.3, 73.6], [70.2, 75.1]], '#d8fff0', 140);
    d.poly('upper-cage', [[66, 64.7], [67.2, 64], [74, 75.4], [72.9, 77]], '#60776d');
    d.poly('lower-cage', [[65.7, 69], [66.6, 67.4], [74, 72], [73.8, 74]], '#aec5a8');
    d.poly('emitter-neck', [[54.7, 60.5], [57.8, 56.3], [63.8, 61], [62.6, 67.5], [58.4, 67]], '#355f60');
    d.ellipse('emitter-mouth', 57.6, 59.5, 3.5, 4.1, '#92bfa2');
    d.ellipse('emitter-dark', 57.6, 59.5, 2.75, 3.25, '#124447');
    d.ellipse('emitter-plasma', 57.6, 59.5, 1.65 + flash * .8, 2.1 + flash, '#92ffd0');
    for (let i = 0; i < 4; i++) d.poly('cooling-fin-' + i, [[72.3 + i * 1.2, 64.8 + i * 1.4], [74 + i * 1.2, 64.3 + i * 1.4], [76 + i * 1.2, 67.5 + i * 1.4], [74.7 + i * 1.2, 68.2 + i * 1.4]], '#355b54');
    d.poly('power-hose', [[63.1, 73], [64.7, 77], [68.7, 79.5], [73, 80.6], [73.1, 82], [68.1, 81], [63.5, 78.2], [61.8, 73.4]], '#284c42');
    d.poly('hose-ridge', [[63.5, 73], [65, 76.8], [68.9, 79], [72.5, 80], [72.5, 80.4], [68.6, 79.7], [64.5, 77.5], [63, 73.2]], '#78c9a4');
    d.bolt('ceramic-bolt-1', 60.1, 69); d.bolt('ceramic-bolt-2', 77.1, 78.4);
    d.text('mark', 'ION', 74.4, 75.7, .82, '#e3f7cc');
    if (flash > 0) {
        d.ellipse('plasma-corona', 56.8, 57.8, 4 + flash, 4.8 + flash, '#47e9ac', 105);
        d.poly('plasma-arc', [[53.7, 54.6], [54.9, 52.7], [56.4, 56.4], [59.8, 53.2], [58.7, 57.1], [61.3, 60.1], [57.4, 58.9], [55.2, 60.7], [55.7, 56.5]], '#a6ffdd');
        d.ellipse('plasma-shot', 56.8, 57.1, 1.55, 1.9, '#effff3');
    }
}

const MODELS = { pulse, machinegun, shotgun, rocket, rail, plasma };
const RECOIL = { pulse: 1.9, machinegun: 1.1, shotgun: 4, rocket: 3.6, rail: 3, plasma: 1.5 };

function renderGun(scene, player, weapons, time = 0) {
    const id = player.weapon === 'scatter' ? 'shotgun' : (MODELS[player.weapon] ? player.weapon : 'pulse');
    const weapon = weapons[player.weapon] || weapons[id] || weapons.pulse || {};
    const flash = clamp((player.shotFlash || 0) / .15, 0, 1);
    const cycle = clamp((player._cooldown || 0) / Math.max(.05, weapon.cooldown || .3), 0, 1);
    const moving = player.moving ? 1 : .12;
    const dx = Math.sin(time * (player.moving ? 12 : 1.4)) * .43 * moving;
    const dy = Math.abs(Math.cos(time * 12)) * .65 * moving + flash * RECOIL[id];
    const d = painter(scene, id, dx, dy);
    MODELS[id](d, player, flash, cycle, time);
}

module.exports = { renderGun };
