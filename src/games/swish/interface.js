'use strict';
const { ShapeUtils } = require('squish-150');
const { C, BALL_COLORS, add, ellipse, text, setText, icon } = require('./art');
const { THEMES, themeIds, DURATIONS } = require('./themes');
const { keyFor } = require('./records');
const clock = seconds => `${Math.floor(Math.ceil(seconds) / 60)}:${String(Math.ceil(seconds) % 60).padStart(2, '0')}`;
const inBox = (x, y, bx, by, w, h) => x >= bx && x <= bx + w && y >= by && y <= by + h;
const themeX = [17, 40, 63], timeX = [20, 41, 62];

class Interface {
    constructor(game, wall, menu) { this.game = game; this.wall = wall; this.menu = menu; this.buildWall(); }
    buildWall() {
        const g = this.game, root = this.wall;
        root.clearChildren(); this.scores = new Map();
        add(root, ShapeUtils.rectangle(6.5, 3.7, 88, 10.4), g.art.colors.boardShadow);
        add(root, ShapeUtils.rectangle(6, 3, 88, 10.4), C.ink);
        text(root, 'SCORE', 28, 3.8, 2.4, C.cream);
        text(root, 'TIME', 61, 3.8, 2.4, C.cream);
        text(root, 'BEST', 83, 3.8, 2.4, C.cream);
        const balls = [...g.court.balls.values()];
        balls.forEach((ball, i) => {
            const x = balls.length === 1 ? 28 : 28 + (i - (balls.length - 1) / 2) * 10;
            add(root, ellipse(x, 11.9, .55), BALL_COLORS[ball.seat]);
            this.scores.set(ball.id, text(root, ball.score, x, 6.1, 4.1, BALL_COLORS[ball.seat]));
        });
        this.timer = text(root, clock(g.remaining), 61, 6.1, 4.1, C.cream);
        this.best = text(root, g.best(), 83, 6.1, 4.1, C.gold);
    }
    update() {
        const g = this.game;
        for (const [id, node] of this.scores) setText(node, g.court.balls.get(id)?.score || 0);
        setText(this.timer, clock(g.remaining)); setText(this.best, g.best());
    }
    showMenu() {
        const g = this.game, root = this.menu, accent = g.art.colors.accent;
        root.clearChildren();
        const records = g.records.scores[keyFor(g.theme, g.duration)] || [];
        const top = records.length ? 24 : 40;
        add(root, ShapeUtils.rectangle(13, top + 1, 76, 93 - top), [35, 40, 40, 65]);
        add(root, ShapeUtils.rectangle(12, top, 76, 93 - top), C.cream);
        if (records.length) text(root, 'HIGH SCORES', 50, 28.2, 3);
        for (let i = 0; i < records.length; i++) {
            text(root, records[i], 50 + (i - (records.length - 1) / 2) * 12.5, 34.1, 2.8, i === 0 ? accent : C.ink);
        }
        themeIds.forEach((theme, i) => {
            const x = themeX[i];
            add(root, ShapeUtils.rectangle(x, 43, 20, 16), theme === g.theme ? accent : [231, 232, 213, 255]);
            add(root, ShapeUtils.rectangle(x + .4, 43.4, 19.2, 15.2), theme === g.theme ? [247, 241, 214, 255] : [240, 239, 221, 255]);
            icon(root, theme, x + 10, 49.3, .85);
            text(root, THEMES[theme].name, x + 10, 54, 3);
        });
        DURATIONS.forEach((duration, i) => {
            add(root, ShapeUtils.rectangle(timeX[i], 65, 18, 7), duration === g.duration ? accent : [231, 232, 213, 255]);
            text(root, clock(duration), timeX[i] + 9, 66.7, 3, duration === g.duration ? C.cream : C.ink);
        });
        if (g.owner !== null) {
            const visible = { playerIds: [g.owner] };
            add(root, ShapeUtils.rectangle(37, 79, 26, 9), accent, visible);
            add(root, [[48, 81], [48, 86], [53, 83.5], [48, 81]], C.cream, visible);
            const guests = [...g.players.keys()].filter(id => id !== g.owner);
            if (guests.length) text(root, 'Host chooses the round', 50, 82, 3, C.ink, 'center', guests);
        }
        this.saveNotice = text(root, g.saveFailed ? 'Scores not saved · tap to retry' : '', 50, 90, 2.5, C.rim);
    }
    hit(x, y) {
        for (let i = 0; i < 3; i++) {
            if (inBox(x, y, themeX[i], 43, 20, 16)) return { theme: themeIds[i] };
            if (inBox(x, y, timeX[i], 65, 18, 7)) return { duration: DURATIONS[i] };
        }
        if (inBox(x, y, 37, 79, 26, 9)) return { start: true };
        if (inBox(x, y, 20, 89, 60, 8)) return { retry: true };
        return null;
    }
}
module.exports = { Interface, clock };
