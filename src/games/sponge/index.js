const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');

const COLORS = Colors.COLORS;

// Every gameplay number lives here (authoring doc §15.2).
const TUNING = {
    TICK: 30,          // MUST match the tickRate literal in metadata()
    MAX_PLAYERS: 2,    // MUST match the maxPlayers literal in metadata()
    WIN_SCORE: 7,
    SERVE_DELAY_TICKS: 24,   // ~0.8s at tick 30
    KEY_HOLD_TICKS: 8,       // held keys re-send keydown every ~33ms; this is the staleness window

    BALL: {
        size: 5,
        baseSpeed: 1.15,          // units per tick
        speedUp: 1.06,            // multiplier per paddle hit
        maxSpeed: 2.3,
        maxBounceAngle: Math.PI / 4   // hit near a paddle edge -> steeper return
    },
    PADDLE: { w: 5, h: 25, speed: 2.2 },
    BOT: { speed: 1.55, deadZone: 2.5, offsetRange: 8 }   // slower than a human, with per-serve aim error
};

const BALL = TUNING.BALL;
const PADDLE = TUNING.PADDLE;
const CENTER_PADDLE_Y = (100 - PADDLE.h) / 2;
const CENTER_BALL = (100 - BALL.size) / 2;

class Sponge extends Game {
    static metadata() {
        return {
            isTest: true, // Showcase review: docs/game-curation.json.

            name: 'Sponge',
            aspectRatio: { x: 4, y: 3 },
            description: 'Fast pong in a sink. Tap anywhere or use W/S / arrows to move your paddle.',
            author: "Joseph Garcia",
            thumbnail: './assets/thumbnail.png',
            squishVersion: '150',
            services: ['multiplayer'],
            maxPlayers: 2,   // keep in sync with TUNING.MAX_PLAYERS (must stay a literal)
            tickRate: 30,    // keep in sync with TUNING.TICK (must stay a literal)
            assets: {
                'beep': new Asset({ path: './assets/32c45968d7f335e5cce579c98d6132f3.mp3', type: 'audio' }),
                'boop': new Asset({ path: './assets/08eb24e6606a30f9563e32a450b9e30c.mp3', type: 'audio' }),
                'pluck': new Asset({ path: './assets/d56e115f08d4324667f697cd2200e042.mp3', type: 'audio' }),
                'sink': new Asset({ path: './assets/9f0c25811d212b5211512a92deb84985.png', type: 'image' }),
                'ball': new Asset({ path: './assets/81f534b27e5062a701cde269b5a29cec.png', type: 'image' }),
                'left-paddle': new Asset({ path: './assets/6bd1f090f531fbf17c34746af6696776.png', type: 'image' }),
                'right-paddle': new Asset({ path: './assets/4b1a650712d18a5ddfcbf08d6599d69a.png', type: 'image' })
            }
        };
    }

    constructor() {
        super();

        this._t = 0;
        this.phase = 'lobby';           // 'lobby' | 'serving' | 'playing' | 'gameover'
        this.serveAt = 0;
        this.serveDir = Math.random() < 0.5 ? -1 : 1;
        this.changed = false;
        this.activeSounds = {};
        this.players = {};
        this.score = { left: 0, right: 0 };

        // Ball state lives in plain vars; nodes are only written to (doc §6, §13B).
        this.ball = { x: CENTER_BALL, y: CENTER_BALL, vx: 0, vy: 0, speed: BALL.baseSpeed };

        // A side with playerId === null is bot-controlled (doc §14.3).
        this.sides = {
            left: this.makeSideState(),
            right: this.makeSideState()
        };

        // --- Nodes: every node tick() ever touches is created here (doc §10) ---

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.BLACK
        });

        const sinkAsset = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            assetInfo: {
                'sink': { pos: { x: 0, y: 0 }, size: { x: 100, y: 100 } }
            }
        });

        // Dashed center line. fill alpha is near-binary, so translucency
        // comes from the `color` channel instead (doc §7.4).
        const dashes = [];
        for (let i = 0; i < 9; i++) {
            dashes.push(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(49.4, 2 + i * 11, 1.2, 6),
                fill: COLORS.WHITE,
                color: [255, 255, 255, 70]
            }));
        }

        this.ballAsset = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(CENTER_BALL, CENTER_BALL, BALL.size, BALL.size),
            assetInfo: {
                'ball': { pos: { x: CENTER_BALL, y: CENTER_BALL }, size: { x: BALL.size, y: BALL.size } }
            }
        });

        this.leftPaddleAsset = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, CENTER_PADDLE_Y, PADDLE.w, PADDLE.h),
            assetInfo: {
                'left-paddle': { pos: { x: 0, y: CENTER_PADDLE_Y }, size: { x: PADDLE.w, y: PADDLE.h } }
            }
        });

        this.rightPaddleAsset = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(100 - PADDLE.w, CENTER_PADDLE_Y, PADDLE.w, PADDLE.h),
            assetInfo: {
                'right-paddle': { pos: { x: 100 - PADDLE.w, y: CENTER_PADDLE_Y }, size: { x: PADDLE.w, y: PADDLE.h } }
            }
        });

        this.leftScoreText = new GameNode.Text({
            textInfo: { text: '0', x: 25, y: 1, size: 4, align: 'center', color: COLORS.WHITE }
        });

        this.rightScoreText = new GameNode.Text({
            textInfo: { text: '0', x: 75, y: 1, size: 4, align: 'center', color: COLORS.WHITE }
        });

        // Per-player "YOU" markers under each score (doc §8, frameless identity).
        this.youLeft = new GameNode.Text({
            textInfo: { text: 'YOU', x: 25, y: 7, size: 1.4, align: 'center', color: COLORS.HG_YELLOW },
            playerIds: [0]
        });
        this.youRight = new GameNode.Text({
            textInfo: { text: 'YOU', x: 75, y: 7, size: 1.4, align: 'center', color: COLORS.HG_YELLOW },
            playerIds: [0]
        });

        // Tap catcher sits ABOVE the playfield, BELOW the overlay buttons (doc §9.1),
        // so taps on the ball or paddles no longer die on non-clickable nodes.
        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            onClick: (playerId, x, y) => this.handleTap(Number(playerId), x, y)
        });

        // Game-over overlay, created up front and hidden with playerIds [0].
        this.winText = new GameNode.Text({
            textInfo: { text: '', x: 50, y: 36, size: 5, align: 'center', color: COLORS.HG_YELLOW },
            playerIds: [0]
        });

        this.playAgainBtn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(35, 52, 30, 12),
            fill: COLORS.SUCCESS_GREEN,
            playerIds: [0],
            onClick: () => this.resetMatch()
        });
        this.playAgainBtn.addChild(new GameNode.Text({
            textInfo: { text: 'PLAY AGAIN', x: 50, y: 56.3, size: 2.5, align: 'center', color: COLORS.WHITE }
        }));

        this.base.addChildren(
            sinkAsset,
            ...dashes,
            this.ballAsset,
            this.leftPaddleAsset,
            this.rightPaddleAsset,
            this.leftScoreText,
            this.rightScoreText,
            this.youLeft,
            this.youRight,
            this.tapCatcher,
            this.winText,
            this.playAgainBtn
        );
    }

    makeSideState() {
        return { playerId: null, y: CENTER_PADDLE_Y, dir: 0, holdUntil: 0, targetY: null, botOffset: 0 };
    }

    // Writes both the hit-box and the drawn image so they stay aligned (doc §7.3).
    placeAsset(node, key, x, y, w, h) {
        node.node.coordinates2d = ShapeUtils.rectangle(x, y, w, h);
        node.node.asset = { [key]: { pos: { x, y }, size: { x: w, y: h } } };
    }

    // ------------------------------------------------------------------ tick

    tick() {
        this._t++;
        if (this.phase === 'lobby') return;   // nothing to simulate, nothing to broadcast

        this.changed = false;

        this.updatePaddle(this.sides.left, 'left');
        this.updatePaddle(this.sides.right, 'right');

        if (this.phase === 'serving' && this._t >= this.serveAt) this.launchBall();
        if (this.phase === 'playing') this.updateBall();

        if (this.changed) this.base.node.onStateChange();   // ONE notify, only when needed
    }

    updatePaddle(side, name) {
        let ny = side.y;

        if (!side.playerId) {
            // Bot: tracks the ball only while it approaches, slower than a human,
            // with a per-serve aim offset so it can genuinely miss (doc §14.3).
            const incoming = this.phase === 'playing' &&
                ((name === 'right' && this.ball.vx > 0) || (name === 'left' && this.ball.vx < 0));
            const target = incoming
                ? this.ball.y + BALL.size / 2 - PADDLE.h / 2 + side.botOffset
                : CENTER_PADDLE_Y;
            ny = this.moveToward(side.y, target, TUNING.BOT.speed, TUNING.BOT.deadZone);
        } else if (side.dir !== 0 && this._t < side.holdUntil) {
            ny = side.y + side.dir * PADDLE.speed;
            side.targetY = null;
        } else {
            if (side.dir !== 0) side.dir = 0;   // held-key heartbeat went stale; un-stick
            if (side.targetY !== null) {
                ny = this.moveToward(side.y, side.targetY, PADDLE.speed, 0.5);
            }
        }

        ny = Math.max(0, Math.min(100 - PADDLE.h, ny));
        if (Math.abs(ny - side.y) >= 0.05) {   // serialization resolution floor (doc §6)
            side.y = ny;
            this.placeAsset(
                name === 'left' ? this.leftPaddleAsset : this.rightPaddleAsset,
                name === 'left' ? 'left-paddle' : 'right-paddle',
                name === 'left' ? 0 : 100 - PADDLE.w,
                side.y, PADDLE.w, PADDLE.h
            );
            this.changed = true;
        }
    }

    moveToward(cur, target, speed, deadZone) {
        const d = target - cur;
        if (Math.abs(d) <= deadZone) return cur;
        return cur + Math.sign(d) * Math.min(speed, Math.abs(d));
    }

    launchBall() {
        this.phase = 'playing';
        const angle = (Math.random() - 0.5) * (Math.PI / 3);   // serve within ±30°
        this.ball.speed = BALL.baseSpeed;
        this.ball.vx = Math.cos(angle) * this.ball.speed * this.serveDir;
        this.ball.vy = Math.sin(angle) * this.ball.speed;
        this.sides.left.botOffset = (Math.random() - 0.5) * TUNING.BOT.offsetRange;
        this.sides.right.botOffset = (Math.random() - 0.5) * TUNING.BOT.offsetRange;
    }

    updateBall() {
        const b = this.ball;
        b.x += b.vx;
        b.y += b.vy;

        if (b.y <= 0) {
            b.y = 0;
            b.vy = Math.abs(b.vy);
            this.playSound('pluck');
        } else if (b.y >= 100 - BALL.size) {
            b.y = 100 - BALL.size;
            b.vy = -Math.abs(b.vy);
            this.playSound('pluck');
        }

        // One mirrored helper for both paddle planes (doc §15.1).
        if (b.vx < 0 && b.x <= PADDLE.w) {
            this.resolvePaddle(this.sides.left, 1, PADDLE.w, 'beep', 'right');
        } else if (b.vx > 0 && b.x + BALL.size >= 100 - PADDLE.w) {
            this.resolvePaddle(this.sides.right, -1, 100 - PADDLE.w - BALL.size, 'boop', 'left');
        }

        if (this.phase !== 'playing') return;   // the rally may have ended mid-tick (doc §10)

        this.placeAsset(this.ballAsset, 'ball', b.x, b.y, BALL.size, BALL.size);
        this.changed = true;
    }

    // dirSign: +1 bounces the ball rightward (left paddle), -1 leftward (right paddle).
    resolvePaddle(side, dirSign, resetX, soundKey, scorerIfMiss) {
        const b = this.ball;
        const ballCenter = b.y + BALL.size / 2;

        const hit = ballCenter >= side.y - 1 && ballCenter <= side.y + PADDLE.h + 1;
        if (!hit) {
            this.grantPoint(scorerIfMiss);
            return;
        }

        // Classic pong: where the ball meets the paddle sets the return angle.
        const rel = Math.max(-1, Math.min(1, (ballCenter - (side.y + PADDLE.h / 2)) / (PADDLE.h / 2)));
        b.speed = Math.min(BALL.maxSpeed, b.speed * BALL.speedUp);
        const angle = rel * BALL.maxBounceAngle;
        b.vx = Math.cos(angle) * b.speed * dirSign;
        b.vy = Math.sin(angle) * b.speed;
        b.x = resetX + dirSign * 0.1;
        this.playSound(soundKey);
    }

    grantPoint(scorer) {
        this.score[scorer]++;
        this.setScoreText(scorer);
        this.playSound('pluck');

        this.ball.x = CENTER_BALL;
        this.ball.y = CENTER_BALL;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.placeAsset(this.ballAsset, 'ball', CENTER_BALL, CENTER_BALL, BALL.size, BALL.size);
        this.changed = true;

        if (this.score[scorer] >= TUNING.WIN_SCORE) {
            this.showGameOver(scorer);
            return;
        }

        this.phase = 'serving';
        this.serveDir = scorer === 'left' ? 1 : -1;   // serve toward the side that conceded
        this.serveAt = this._t + TUNING.SERVE_DELAY_TICKS;
    }

    setScoreText(sideName) {
        const node = sideName === 'left' ? this.leftScoreText : this.rightScoreText;
        node.node.text = {
            text: '' + this.score[sideName],
            x: sideName === 'left' ? 25 : 75,
            y: 1, size: 4, align: 'center', color: COLORS.WHITE
        };
        this.changed = true;
    }

    showGameOver(winner) {
        this.phase = 'gameover';
        this.winText.node.text = {
            text: (winner === 'left' ? 'LEFT' : 'RIGHT') + ' WINS!',
            x: 50, y: 36, size: 5, align: 'center', color: COLORS.HG_YELLOW
        };
        this.winText.node.playerIds = [];
        this.playAgainBtn.node.playerIds = [];
        this.changed = true;
    }

    // "Play again" = reset state in place; never reload anything (doc §1).
    resetMatch() {
        if (this.phase !== 'gameover') return;
        this.score.left = 0;
        this.score.right = 0;
        this.setScoreText('left');
        this.setScoreText('right');
        this.winText.node.playerIds = [0];
        this.playAgainBtn.node.playerIds = [0];
        this.phase = 'serving';
        this.serveDir = Math.random() < 0.5 ? -1 : 1;
        this.serveAt = this._t + TUNING.SERVE_DELAY_TICKS;
        this.base.node.onStateChange();   // event handlers flush directly
    }

    // ------------------------------------------------------------------ input

    handleTap(playerId, x, y) {
        const side = this.sideOf(playerId);
        if (!side) return;
        side.targetY = Math.max(0, Math.min(100 - PADDLE.h, y - PADDLE.h / 2));
        side.dir = 0;
    }

    handleKeyDown(playerId, key) {
        const side = this.sideOf(Number(playerId));
        if (!side) return;
        let dir = 0;
        if (key === 'ArrowUp' || key === 'w') dir = -1;
        else if (key === 'ArrowDown' || key === 's') dir = 1;
        else return;
        side.dir = dir;
        side.holdUntil = this._t + TUNING.KEY_HOLD_TICKS;   // refreshed by the ~33ms re-sends
        side.targetY = null;
    }

    handleKeyUp(playerId, key) {
        const side = this.sideOf(Number(playerId));
        if (!side) return;
        if (key === 'ArrowUp' || key === 'w' || key === 'ArrowDown' || key === 's') {
            side.dir = 0;
        }
    }

    sideOf(playerId) {
        if (this.sides.left.playerId === playerId) return this.sides.left;
        if (this.sides.right.playerId === playerId) return this.sides.right;
        return null;
    }

    // ------------------------------------------------------------------ players

    handleNewPlayer({ playerId, info }) {
        const pid = Number(playerId);
        this.players[pid] = { name: (info && info.name) || ('PLAYER ' + pid) };

        const sideName = !this.sides.left.playerId ? 'left'
            : (!this.sides.right.playerId ? 'right' : null);
        if (sideName) {
            this.sides[sideName].playerId = pid;
            const marker = sideName === 'left' ? this.youLeft : this.youRight;
            marker.node.playerIds = [pid];
        }

        if (this.phase === 'lobby') {
            this.phase = 'serving';
            this.serveAt = this._t + TUNING.SERVE_DELAY_TICKS;
        }
        this.base.node.onStateChange();
    }

    handlePlayerDisconnect(playerId) {
        const pid = Number(playerId);
        delete this.players[pid];

        for (const name of ['left', 'right']) {
            const s = this.sides[name];
            if (s.playerId === pid) {
                s.playerId = null;   // hand the paddle to the bot; the rally continues
                s.dir = 0;
                s.targetY = null;
                (name === 'left' ? this.youLeft : this.youRight).node.playerIds = [0];
            }
        }

        if (Object.keys(this.players).length === 0) {
            // Nobody left: park the simulation and reset for the next session.
            this.phase = 'lobby';
            this.score.left = 0;
            this.score.right = 0;
            this.setScoreText('left');
            this.setScoreText('right');
            this.winText.node.playerIds = [0];
            this.playAgainBtn.node.playerIds = [0];
            this.ball.x = CENTER_BALL;
            this.ball.y = CENTER_BALL;
            this.ball.vx = 0;
            this.ball.vy = 0;
            this.placeAsset(this.ballAsset, 'ball', CENTER_BALL, CENTER_BALL, BALL.size, BALL.size);
            this.sides.left.y = CENTER_PADDLE_Y;
            this.sides.right.y = CENTER_PADDLE_Y;
            this.placeAsset(this.leftPaddleAsset, 'left-paddle', 0, CENTER_PADDLE_Y, PADDLE.w, PADDLE.h);
            this.placeAsset(this.rightPaddleAsset, 'right-paddle', 100 - PADDLE.w, CENTER_PADDLE_Y, PADDLE.w, PADDLE.h);
        }
        this.base.node.onStateChange();
    }

    // ------------------------------------------------------------------ audio

    playSound(key) {
        if (this.activeSounds[key]) return;   // audio dedupes by key (doc §7.3); throttle re-fires
        const soundNode = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            assetInfo: {
                [key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 }
            }
        });
        this.activeSounds[key] = true;
        this.base.addChild(soundNode);
        this.setTimeout(() => {   // tracked timer: auto-cleared on close (doc §10)
            this.base.removeChild(soundNode.id);
            delete this.activeSounds[key];
        }, 250);
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = Sponge;