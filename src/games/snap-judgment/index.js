// ===========================================================================
// SNAP JUDGMENT - a photo scavenger hunt for a room full of phones.
//
// Each round one player sits out as the judge. Everyone else gets a prompt and
// 60 seconds to run around the house, photograph something that fits, and
// upload it. The photos come up one at a time, anonymously; the judge picks a
// favourite; then the photographers are revealed.
//
// Prompts are deliberately subjective ("the saddest object in this house") so
// there is never a fact of the matter to argue about. The judge's taste IS the
// game.
//
// Uses the platform's file-upload input: photos are registered as real assets
// at runtime via addAsset, so nothing is baked into the game.
// ===========================================================================

const { Game, GameNode, Shapes, ShapeUtils, Asset } = require('squish-143');

// ---------------------------------------------------------------------------
// TUNING - every gameplay number lives here. Durations are in SECONDS and the
// clock is real wall time, so tickRate is a smoothness knob only.
// ---------------------------------------------------------------------------
const TUNING = {
    TICK: 10,           // tickRate - MUST match the tickRate literal in metadata()
    MAX_PLAYERS: 8,     // MUST match the maxPlayers literal in metadata()

    MIN_PLAYERS: 3,     // judge + two photographers, or there is nothing to compare
    SHOOT_SECONDS: 60,
    HURRY_SECONDS: 10,  // countdown turns urgent under this
    ROUND_LAPS: 1,      // rounds = players * laps, so everyone judges once per lap

    LIKE_POINTS: 2,     // a thumbs up
    SUBMIT_POINTS: 1,   // showing up beats having an interesting house

    // Hard caps: memory / bandwidth budgets, not design knobs.
    MAX_UPLOADS: 48,    // total photos a session will hold
    PROMPT_CHARS: 26    // wrap width for the prompt, in characters
};

const TICK = TUNING.TICK;

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
const BG = [18, 17, 26, 255];
const BG_SOFT = [27, 25, 40, 255];
const PANEL = [33, 31, 48, 255];
const EDGE = [86, 78, 122, 255];
const INK = [240, 238, 246, 255];
const DIM = [146, 140, 168, 255];
const GOLD = [255, 198, 92, 255];
const HOT = [255, 104, 122, 255];
const GO = [122, 226, 178, 255];
const JUDGE_C = [186, 140, 255, 255];

const SEAT_COLORS = [
    [92, 214, 226, 255], [255, 152, 74, 255], [186, 132, 255, 255], [140, 226, 118, 255],
    [255, 122, 168, 255], [120, 168, 255, 255], [244, 214, 96, 255], [126, 232, 200, 255]
];

const YS = 16 / 9;      // y-units per x-unit for a visually square shape at 16:9

// The judging screen's photo frame, referenced from the draw and detach paths.
const JUDGE_FRAME = [18, 15, 64, 57];

// A thumb, in a 0..1 box with y running downward. Thumbs-down is the same
// outline flipped, so there is one piece of geometry rather than two.
const THUMB = [
    [0.16, 0.94], [0.16, 0.50], [0.25, 0.41], [0.31, 0.39],
    [0.31, 0.17], [0.37, 0.06], [0.47, 0.10], [0.47, 0.31],
    [0.45, 0.39], [0.86, 0.39], [0.86, 0.94]
];
const thumbPoly = (x, y, w, h, up) => THUMB.map(p => [
    x + p[0] * w,
    y + (up ? p[1] : 1 - p[1]) * h
]);

// ---------------------------------------------------------------------------
// Prompts. Subjective on purpose: there is no way to "not match" one of these,
// which is exactly what stops a party game turning into a rules argument.
// Keep them under ~52 characters so they wrap to two lines.
// ---------------------------------------------------------------------------
const PROMPTS = [
    'the saddest object in this house',
    'something that has clearly seen things',
    'the least trustworthy item in your kitchen',
    'something you would grab in a fire, but should not',
    'the most cursed texture here',
    'an object that owes you money',
    'something older than everyone in this room',
    'the most passive aggressive thing you own',
    'something that should have been thrown out years ago',
    'the item most likely to be haunted',
    'something you have no memory of buying',
    'the ugliest gift you ever received',
    'proof that you are an adult',
    'proof that you are not an adult',
    'the most suspicious food in your fridge',
    'something with a story you will not explain',
    'an object that has been moved but never used',
    'the most fragile thing you own',
    'something you would defend in court',
    'the loneliest corner of this house',
    'an object that looks illegal',
    'the most aggressive piece of furniture',
    'an item that has clearly given up',
    'the least comfortable seat here',
    'something that would confuse an alien',
    'the most emotionally significant appliance',
    'an object with unresolved issues',
    'something that belongs in a museum, badly',
    'the beigest thing you can find',
    'something you are pretending to understand',
    'a thing that has outlived its purpose',
    'the most dangerous item within reach',
    'something your parents would judge',
    'an object that peaked years ago',
    'the most photogenic piece of garbage',
    'something that makes a bad noise',
    'the softest thing here',
    'an object that has never once been washed',
    'something you would bring to a seance',
    'the most expensive mistake in this house',
    'something you keep for no reason at all',
    'the item most likely to be a portal',
    'something that looks like it is watching you',
    'the worst thing in the back of a drawer',
    'an object that would win a fight',
    'something that feels damp',
    'a thing you would describe as unwell',
    'the most haunted appliance',
    'something that has been here longer than you',
    'an object you are weirdly loyal to',
    'the least photogenic thing you own',
    'something that would not survive a move',
    'the most optimistic object here',
    'something you are quietly ashamed of',
    'an item that has never worked properly',
    'the smuggest thing in this house',
    'something that should not be reachable',
    'an object that has never been used correctly',
    'the most suspicious stain available',
    'something that would upset a guest',
    'the thing you would save from a flood',
    'an object that seems to be plotting',
    'the most out of place item here',
    'something that has been fixed badly',
    'a thing that is technically furniture',
    'the most disappointing drawer',
    'something you would not explain to a landlord',
    'an object that has absorbed too much',
    'the most tired thing in this room',
    'something that has never been level',
    'an item you have apologised for',
    'the loudest object you own',
    'something that has been rebranded by wear',
    'an object that has clearly been dropped',
    'the most nostalgic piece of plastic',
    'something you inherited by accident',
    'a thing that lives where it should not',
    'the most confusing object in your home',
    'something that has never fit anywhere',
    'an object that was a phase',
    'the least useful gadget you own',
    'something that survived something',
    'an item that has changed colour over time',
    'the most formal thing in a casual room',
    'something you would describe as feral',
    'an object that could be evidence',
    'the last thing you would show a date',
    'something that has been in every home you had',
    'a thing that makes the room worse',
    'the most unnecessary object here',
    'something you would call a family heirloom, wrongly',
    'an object that has never been photographed',
    'the most structurally concerning thing here',
    'something that has been fine for too long',
    'an item that should be in a different room',
    'the most honest object you own',
    'something that has been sat on too much',
    'an object with an unearned sense of importance',
    'the greasiest thing you can safely photograph',
    'something that would be hard to explain to a child'
];

// ---------------------------------------------------------------------------
// Image header reading.
//
// The game gets raw bytes and cannot decode an image (no zlib, no built-ins),
// but it does not need to - the width and height sit in plain sight in the
// header, and that is enough to letterbox each photo at its true aspect
// instead of stretching a portrait phone shot into a 16:9 box.
// ---------------------------------------------------------------------------
const readImageSize = (bytes) => {
    const b = bytes;
    if (!b || typeof b.length !== 'number') return null;
    const n = b.length;

    // PNG: 8-byte signature, then IHDR with width/height as big-endian uint32
    if (n > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) {
        const rd = (o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
        const w = rd(16), h = rd(20);
        if (w > 0 && h > 0) return { w: w, h: h };
        return null;
    }

    // GIF: 'GIF8', then width/height as little-endian uint16
    if (n > 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) {
        const w = b[6] | (b[7] << 8), h = b[8] | (b[9] << 8);
        if (w > 0 && h > 0) return { w: w, h: h };
        return null;
    }

    // JPEG: walk the segment chain to a start-of-frame marker
    if (n > 4 && b[0] === 0xFF && b[1] === 0xD8) {
        let o = 2;
        let guard = 0;
        while (o + 9 < n && guard++ < 4096) {
            if (b[o] !== 0xFF) { o++; continue; }
            const m = b[o + 1];
            if (m === 0xFF) { o++; continue; }                       // fill byte
            if (m === 0x01 || (m >= 0xD0 && m <= 0xD9)) { o += 2; continue; }
            const seg = (b[o + 2] << 8) | b[o + 3];
            // SOF0-SOF15 carry the dimensions; C4/C8/CC are tables, not frames
            if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
                const h = (b[o + 5] << 8) | b[o + 6];
                const w = (b[o + 7] << 8) | b[o + 8];
                if (w > 0 && h > 0) return { w: w, h: h };
                return null;
            }
            if (m === 0xDA) break;                                   // start of scan
            if (seg < 2) break;
            o += 2 + seg;
        }
    }
    return null;    // HEIC and friends: fall back to a sane default aspect
};

// Fit a w:h image inside a plane-space box, preserving its real on-screen
// shape. One x-unit is 16/9 wider than one y-unit, hence the YS terms.
const fitBox = (imgW, imgH, bx, by, bw, bh) => {
    const r = (imgW && imgH) ? (imgW / imgH) : (4 / 3);
    let dh = bh;
    let dw = dh * r / YS;
    if (dw > bw) { dw = bw; dh = dw * YS / r; }
    return { x: bx + (bw - dw) / 2, y: by + (bh - dh) / 2, w: dw, h: dh };
};

// ===========================================================================

class SnapJudgment extends Game {
    static metadata() {
        return {
            squishVersion: '143',
            name: 'Snap Judgment',
            author: 'AI',
            description: 'A photo scavenger hunt. Run around your house, photograph the prompt, let one friend judge you.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 10,     // keep in sync with TUNING.TICK (this must stay a literal)
            maxPlayers: 8,    // keep in sync with TUNING.MAX_PLAYERS (must stay a literal)
            services: ['multiplayer']
        };
    }

    constructor(opts) {
        super();
        // A local session stubs services, and the constructor may be called
        // with nothing at all - never destructure the argument blind.
        this.addAsset = (opts && opts.addAsset) || null;

        this.phase = 'lobby';       // lobby | shoot | judge | reveal | final
        this.players = {};          // pid -> { name, score, seat, submitted }
        this.seats = {};            // seat index -> pid
        this.order = [];            // judge rotation, in join order
        this.round = 0;
        this.totalRounds = 0;
        this.judgeId = null;
        this.prompt = '';
        this.promptPool = [];
        this.shots = [];            // this round: { pid, key, w, h }
        this.viewIndex = 0;
        this.deadline = 0;          // wall-clock ms for the shooting phase
        this.uploads = 0;
        // assetKey -> Asset. The Squisher rebuilds the client asset bundle from
        // getAssets(), so an upload that is not in here never reaches anybody,
        // however successfully addAsset resolved.
        this.uploadedAssets = {};
        this.lastRemaining = -1;

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: BG
        });

        this.buildChrome();
        this.buildLobby();
        this.buildShoot();
        this.buildJudge();
        this.buildReveal();

        this.showPhase();
    }

    getLayers() {
        return [{ root: this.base }];
    }

    // Uploaded photos are registered at runtime; the Squisher merges these with
    // metadata().assets when it rebuilds the asset bundle. Without this the
    // Asset nodes point at keys the client was never sent, and every photo
    // renders as nothing at all.
    getAssets() {
        return this.uploadedAssets;
    }

    // -----------------------------------------------------------------------
    // Construction helpers
    // -----------------------------------------------------------------------

    // Zero-size: a full-screen container swallows every click beneath it.
    // Also used as a fixed SLOT for the photo nodes - because those get added
    // and removed as photos come and go, an empty slot holds their place in the
    // draw order so they never jump in front of the buttons.
    makeContainer(parent) {
        const n = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
        (parent || this.base).addChild(n);
        return n;
    }

    poly(pts, fill, line, border) {
        const cfg = { shapeType: Shapes.POLYGON, coordinates2d: pts, fill: fill };
        if (border) { cfg.color = line; cfg.border = border; }
        return new GameNode.Shape(cfg);
    }

    label(text, x, y, size, color, align) {
        return new GameNode.Text({
            textInfo: {
                text: text, x: x, y: y, size: size,
                align: align || 'center', font: 'monospace', color: color
            }
        });
    }

    // Text cannot receive clicks, so a button is a clickable Shape with a Text
    // laid on top of it.
    button(x, y, w, h, text, fill, onClick) {
        const bg = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill: fill,
            color: INK,
            border: 4,
            onClick: onClick
        });
        const t = this.label(text, x + w / 2, y + h / 2 - h * 0.22, 2, [16, 14, 24, 255]);
        bg.addChild(t);
        bg._label = t;
        return bg;
    }

    setVisible(node, on, only) {
        node.node.playerIds = on ? (only || []) : [0];
    }

    buildChrome() {
        this.chrome = this.makeContainer();
        this.roundText = this.label('', 3, 2.5, 1.6, DIM, 'left');
        this.titleText = this.label('SNAP JUDGMENT', 50, 2.5, 1.6, DIM);
        this.clockText = this.label('', 97, 2.5, 1.6, DIM, 'right');
        this.chrome.addChild(this.roundText);
        this.chrome.addChild(this.titleText);
        this.chrome.addChild(this.clockText);
    }

    // ---- lobby ----
    buildLobby() {
        this.lobby = this.makeContainer();
        this.lobby.addChild(this.poly(ShapeUtils.rectangle(0, 0, 100, 100), BG_SOFT));
        this.lobby.addChild(this.label('SNAP JUDGMENT', 50, 10, 6, INK));
        this.lobby.addChild(this.label('photograph the prompt. one friend decides.', 50, 22, 1.8, DIM));

        this.seatRows = [];
        for (let i = 0; i < TUNING.MAX_PLAYERS; i++) {
            const x = 12 + (i % 2) * 40;
            const y = 32 + Math.floor(i / 2) * 8;
            const chip = this.poly(ShapeUtils.rectangle(x, y, 2, 5), [0, 0, 0, 0]);
            const name = this.label('', x + 4, y + 0.4, 2, DIM, 'left');
            const you = new GameNode.Text({
                textInfo: {
                    text: 'YOU', x: x + 34, y: y + 0.6, size: 1.4, align: 'right',
                    font: 'monospace', color: INK
                },
                playerIds: [0]
            });
            this.lobby.addChild(chip);
            this.lobby.addChild(name);
            this.lobby.addChild(you);
            this.seatRows.push({ chip: chip, name: name, you: you });
        }

        this.lobbyHint = this.label('', 50, 74, 2, DIM);
        this.lobby.addChild(this.lobbyHint);
        this.startBtn = this.button(35, 80, 30, 10, 'START', GO, () => this.startGame());
        this.lobby.addChild(this.startBtn);
    }

    // ---- shooting ----
    buildShoot() {
        this.shoot = this.makeContainer();
        this.promptLines = [];
        for (let i = 0; i < 3; i++) {
            const t = this.label('', 50, 22 + i * 6.2, 3.2, INK);
            this.promptLines.push(t);
            this.shoot.addChild(t);
        }
        this.shoot.addChild(this.label('PHOTOGRAPH', 50, 13, 1.6, DIM));

        this.timerTrack = this.poly(ShapeUtils.rectangle(20, 48, 60, 2.4), PANEL, EDGE, 3);
        this.timerFill = this.poly(ShapeUtils.rectangle(20, 48, 60, 2.4), GO);
        this.shoot.addChild(this.timerTrack);
        this.shoot.addChild(this.timerFill);

        this.tallyText = this.label('', 50, 54, 1.8, DIM);
        this.shoot.addChild(this.tallyText);

        // Judge-only banner. Also serves as every judge's privacy anchor.
        this.judgeBanner = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(20, 64, 60, 14),
            fill: PANEL, color: JUDGE_C, border: 5,
            playerIds: [0]
        });
        this.judgeBanner.addChild(this.label('YOU ARE THE JUDGE', 50, 67, 2.4, JUDGE_C));
        this.judgeBanner.addChild(this.label('sit this one out. no photos.', 50, 72.5, 1.6, DIM));
        this.shoot.addChild(this.judgeBanner);

        // Photographers get the file picker. Scoped per player at round start.
        this.uploadBtn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(22, 64, 56, 15),
            fill: GO, color: INK, border: 5,
            playerIds: [0],
            input: {
                type: 'file',
                oninput: (playerId, bytes, meta) => this.handleUpload(playerId, bytes, meta)
            }
        });
        this.uploadBtn.addChild(this.label('TAKE A PHOTO', 50, 69, 2.6, [16, 14, 24, 255]));
        this.shoot.addChild(this.uploadBtn);

        this.doneBanner = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(22, 64, 56, 15),
            fill: PANEL, color: GO, border: 5,
            playerIds: [0]
        });
        this.doneBanner.addChild(this.label('PHOTO IN', 50, 68, 2.6, GO));
        this.doneBanner.addChild(this.label('tap again to replace it', 50, 74, 1.5, DIM));
        this.shoot.addChild(this.doneBanner);

        this.shootNote = this.label('', 50, 84, 1.6, DIM);
        this.shoot.addChild(this.shootNote);
    }

    // ---- judging ----
    buildJudge() {
        this.judging = this.makeContainer();
        this.judging.addChild(this.poly(ShapeUtils.rectangle(0, 0, 100, 100), BG_SOFT));
        // The judge is comparing photos against a prompt they last read a
        // minute ago, so it stays on screen while they decide.
        this.judgePromptLines = [];
        for (let i = 0; i < 2; i++) {
            const t = this.label('', 50, 3 + i * 3.7, 1.9, INK);
            this.judgePromptLines.push(t);
            this.judging.addChild(t);
        }
        this.photoCount = this.label('', 97, 3.2, 1.5, DIM, 'right');
        this.judging.addChild(this.photoCount);

        this.photoFrame = this.poly(
            ShapeUtils.rectangle(JUDGE_FRAME[0], JUDGE_FRAME[1], JUDGE_FRAME[2], JUDGE_FRAME[3]),
            PANEL, EDGE, 4);
        this.judging.addChild(this.photoFrame);

        // ONE reusable Asset node - its asset key is swapped per photo rather
        // than creating a node per upload. It is NOT in the tree yet: an Asset
        // node whose assetInfo is empty has no key for the serializer to write,
        // which takes down the whole session on the first frame. It joins the
        // tree only once it has a real photo to show.
        this.photoSlot = this.makeContainer(this.judging);
        this.photoNode = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            assetInfo: {}
        });
        this.photoNode._attached = false;

        // Verdict dots: one per photo, so the judge can see how far through
        // they are and what they have already said without remembering it.
        this.verdictDots = [];
        for (let i = 0; i < TUNING.MAX_PLAYERS - 1; i++) {
            const d = this.poly(ShapeUtils.rectangle(0, 0, 0, 0), [0, 0, 0, 0]);
            this.verdictDots.push(d);
            this.judging.addChild(d);
        }

        // One verdict per photo, delivered while you are looking at it. Both
        // buttons advance, so there is no mode and nothing to remember.
        this.thumbDownBtn = this.judgeThumb(11, 75, false, HOT, 'NOPE');
        this.thumbUpBtn = this.judgeThumb(55, 75, true, GO, 'LOVE IT');
        this.judging.addChild(this.thumbDownBtn);
        this.judging.addChild(this.thumbUpBtn);

        // Everyone else watches, and is told who they are waiting on.
        this.judgeWait = this.label('', 50, 84, 2, DIM);
        this.judging.addChild(this.judgeWait);
    }

    // A big tap target with a thumb drawn on it and a word underneath.
    judgeThumb(x, y, up, fill, word) {
        const w = 34, h = 19;
        const btn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill: fill,
            color: INK,
            border: 4,
            onClick: () => this.judgePhoto(up)
        });
        const iw = 6.5, ih = iw * YS;
        btn.addChild(this.poly(
            thumbPoly(x + (w - iw) / 2, y + 1.6, iw, ih, up), [16, 14, 24, 255]));
        btn.addChild(this.label(word, x + w / 2, y + h - 4.4, 1.9, [16, 14, 24, 255]));
        return btn;
    }

    // ---- reveal / final ----
    buildReveal() {
        this.reveal = this.makeContainer();
        this.reveal.addChild(this.poly(ShapeUtils.rectangle(0, 0, 100, 100), BG_SOFT));
        this.revealTitle = this.label('', 50, 6, 3.4, GOLD);
        this.revealWho = this.label('', 50, 14, 2.4, INK);
        this.reveal.addChild(this.revealTitle);
        this.reveal.addChild(this.revealWho);

        // One cell per photo: the picture, who took it, and what the judge
        // said. Everyone just saw these full size, so small is fine here - the
        // payoff is the names, not the pictures.
        this.revealCells = [];
        for (let i = 0; i < TUNING.MAX_PLAYERS - 1; i++) {
            const slot = this.makeContainer(this.reveal);
            const photo = new GameNode.Asset({
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                assetInfo: {}
            });
            photo._attached = false;
            const thumb = this.poly(ShapeUtils.rectangle(0, 0, 0, 0), [0, 0, 0, 0]);
            const who = this.label('', 0, 0, 1.5, INK);
            const pts = this.label('', 0, 0, 1.4, DIM);
            this.reveal.addChild(thumb);
            this.reveal.addChild(who);
            this.reveal.addChild(pts);
            this.revealCells.push({ slot, photo, thumb, who, pts });
        }

        this.scoreRows = [];
        for (let i = 0; i < TUNING.MAX_PLAYERS; i++) {
            const x = 8 + (i % 2) * 46;
            const y = 62 + Math.floor(i / 2) * 5.2;
            const chip = this.poly(ShapeUtils.rectangle(x, y, 1.6, 3.6), [0, 0, 0, 0]);
            const name = this.label('', x + 3, y - 0.2, 1.7, DIM, 'left');
            const pts = this.label('', x + 40, y - 0.2, 1.7, INK, 'right');
            this.reveal.addChild(chip);
            this.reveal.addChild(name);
            this.reveal.addChild(pts);
            this.scoreRows.push({ chip: chip, name: name, pts: pts });
        }

        this.nextRoundBtn = this.button(33, 88, 34, 10, 'NEXT ROUND', GO, () => this.nextRound());
        this.reveal.addChild(this.nextRoundBtn);
    }

    // -----------------------------------------------------------------------
    // Phase plumbing
    // -----------------------------------------------------------------------

    // Release both photo nodes from the tree. A node must never point at an
    // asset key that has left the bundle, so this always runs BEFORE assets are
    // dropped, not after.
    detachPhotos() {
        if (this.photoNode && this.photoNode._attached) {
            this.showPhoto(this.photoNode, this.photoSlot, JUDGE_FRAME, null);
        }
        (this.revealCells || []).forEach(c => {
            if (c.photo._attached) this.showPhoto(c.photo, c.slot, [0, 0, 0, 0], null);
        });
    }

    showPhase() {
        // Leaving a screen releases its photo node, so no stale asset reference
        // lingers in the tree between rounds.
        if (this.phase !== 'judge' && this.photoNode && this.photoNode._attached) {
            this.showPhoto(this.photoNode, this.photoSlot, JUDGE_FRAME, null);
        }
        if (this.phase !== 'reveal' && this.phase !== 'final') {
            (this.revealCells || []).forEach(c => {
                if (c.photo._attached) this.showPhoto(c.photo, c.slot, [0, 0, 0, 0], null);
            });
        }
        this.setVisible(this.lobby, this.phase === 'lobby');
        this.setVisible(this.shoot, this.phase === 'shoot');
        this.setVisible(this.judging, this.phase === 'judge');
        this.setVisible(this.reveal, this.phase === 'reveal' || this.phase === 'final');
        this.setVisible(this.chrome, this.phase !== 'lobby');
        // On the judging screen the prompt is the header, so the decorative
        // centre title stands down rather than sitting on top of it.
        this.setVisible(this.titleText, this.phase !== 'judge');
    }

    playerIds() {
        return Object.keys(this.players).map(Number);
    }

    shooters() {
        return this.playerIds().filter(pid => pid !== this.judgeId);
    }

    name(pid) {
        const p = this.players[pid];
        return p ? p.name : ('PLAYER ' + pid);
    }

    seatColor(pid) {
        const p = this.players[pid];
        return p ? SEAT_COLORS[p.seat % SEAT_COLORS.length] : DIM;
    }

    wrapPrompt(text, maxLines) {
        const words = String(text).split(' ');
        const lines = [];
        let line = '';
        words.forEach(w => {
            if (!line.length) { line = w; return; }
            if ((line + ' ' + w).length <= TUNING.PROMPT_CHARS) line += ' ' + w;
            else { lines.push(line); line = w; }
        });
        if (line.length) lines.push(line);
        return lines.slice(0, maxLines || this.promptLines.length);
    }

    // Lay the current prompt into a set of Text nodes, block-centred on
    // centerY. Used for both the big shooting-screen prompt and the small
    // reminder above the photos, so there is one copy of this arithmetic.
    renderPromptInto(nodes, centerY, size) {
        const lines = this.wrapPrompt(this.prompt.toUpperCase(), nodes.length);
        const lineH = size * YS * 1.1;
        const startY = centerY - ((lines.length - 1) * lineH) / 2 - (size * YS) / 2;
        nodes.forEach((node, i) => {
            node.node.text.text = lines[i] || '';
            node.node.text.y = startY + i * lineH;
            node.node.text.size = size;
        });
    }

    drawPrompt() {
        this.renderPromptInto(this.promptLines, 26, 3.2);
        this.renderPromptInto(this.judgePromptLines, 6.15, 1.9);
    }

    // -----------------------------------------------------------------------
    // Round flow
    // -----------------------------------------------------------------------

    startGame() {
        if (this.playerIds().length < TUNING.MIN_PLAYERS) return;
        this.order = this.playerIds().sort((a, b) =>
            this.players[a].seat - this.players[b].seat);
        this.totalRounds = this.order.length * TUNING.ROUND_LAPS;
        this.round = 0;
        this.promptPool = [];
        this.playerIds().forEach(pid => { this.players[pid].score = 0; });
        this.beginRound();
    }

    nextPrompt() {
        if (!this.promptPool.length) {
            this.promptPool = PROMPTS.slice();
            // shuffle so a session never repeats until the pool is exhausted
            for (let i = this.promptPool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const t = this.promptPool[i];
                this.promptPool[i] = this.promptPool[j];
                this.promptPool[j] = t;
            }
        }
        return this.promptPool.pop();
    }

    beginRound() {
        this.round++;
        // Judge rotates through join order, so everyone sits out exactly once
        // per lap even if the player list changed.
        this.order = this.order.filter(pid => this.players[pid]);
        this.playerIds().forEach(pid => {
            if (this.order.indexOf(pid) < 0) this.order.push(pid);
        });
        this.judgeId = this.order[(this.round - 1) % this.order.length];

        this.prompt = this.nextPrompt();
        this.detachPhotos();             // drop the nodes first...
        this.releaseRound(this.shots);   // ...then the assets they pointed at
        this.shots = [];
        this.viewIndex = 0;
        this.playerIds().forEach(pid => { this.players[pid].submitted = false; });

        this.deadline = Date.now() + TUNING.SHOOT_SECONDS * 1000;
        this.lastRemaining = -1;
        this.phase = 'shoot';
        this.drawPrompt();
        this.applyRoleScoping();
        this.showPhase();
        this.drawAll();
        this.base.node.onStateChange();
    }

    // Judge sees the judge banner; everyone else sees the file picker. Both are
    // per-player scoped nodes, which also keeps every connected player on the
    // filtered-frame path.
    applyRoleScoping() {
        const shooters = this.shooters();
        const waiting = shooters.filter(pid => !this.players[pid].submitted);
        const done = shooters.filter(pid => this.players[pid].submitted);
        this.judgeBanner.node.playerIds = this.judgeId !== null ? [this.judgeId] : [0];
        this.uploadBtn.node.playerIds = waiting.length ? waiting : [0];
        this.doneBanner.node.playerIds = done.length ? done : [0];
    }

    finishShooting() {
        if (this.phase !== 'shoot') return;
        this.phase = 'judge';
        // Anonymise: the display order must not leak who shot what.
        for (let i = this.shots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = this.shots[i];
            this.shots[i] = this.shots[j];
            this.shots[j] = t;
        }
        this.viewIndex = 0;
        this.shots.forEach(s => { s.verdict = false; });
        if (!this.shots.length) {
            this.phase = 'reveal';      // nobody submitted; no round to judge
        }
        this.showPhase();
        this.drawAll();
        this.base.node.onStateChange();
    }

    // One tap = one verdict = advance. The last verdict ends the round.
    judgePhoto(liked) {
        if (this.phase !== 'judge') return;
        const shot = this.shots[this.viewIndex];
        if (!shot) return;
        shot.verdict = !!liked;
        if (this.viewIndex < this.shots.length - 1) {
            this.viewIndex++;
            this.drawAll();
            this.base.node.onStateChange();
            return;
        }
        this.finishJudging();
    }

    finishJudging() {
        this.shots.forEach(s => {
            const p = this.players[s.pid];
            if (!p) return;
            p.score += TUNING.SUBMIT_POINTS;
            if (s.verdict) p.score += TUNING.LIKE_POINTS;
        });
        this.phase = 'reveal';
        this.showPhase();
        this.drawAll();
        this.base.node.onStateChange();
    }

    nextRound() {
        if (this.phase === 'final') { this.startGame(); return; }
        if (this.phase !== 'reveal') return;
        if (this.round >= this.totalRounds) {
            this.phase = 'final';
            this.showPhase();
            this.drawAll();
            this.base.node.onStateChange();
            return;
        }
        this.beginRound();
    }

    // -----------------------------------------------------------------------
    // Uploads
    // -----------------------------------------------------------------------

    handleUpload(playerId, bytes, meta) {
        const pid = Number(playerId);
        if (this.phase !== 'shoot') return;
        if (pid === this.judgeId) return;             // judges do not shoot
        if (!this.players[pid]) return;
        if (!meta || meta.kind !== 'image') return;   // server-sniffed, trust it
        if (!this.addAsset) return;
        if (this.uploads >= TUNING.MAX_UPLOADS) return;

        const size = readImageSize(bytes);
        const key = 'shot-' + (++this.uploads);

        const asset = new Asset({ id: key, type: 'image' }, bytes);
        this.uploadedAssets[key] = asset;

        this.addAsset(key, asset).then(() => {
            if (this.phase !== 'shoot') {             // arrived after time
                this.releaseAsset(key);
                return;
            }
            const existing = this.shots.filter(s => s.pid === pid)[0];
            if (existing) {                            // replacing an earlier shot
                this.releaseAsset(existing.key);       // the old one is orphaned now
                existing.key = key;
                existing.w = size ? size.w : 0;
                existing.h = size ? size.h : 0;
            } else {
                this.shots.push({
                    pid: pid, key: key,
                    w: size ? size.w : 0,
                    h: size ? size.h : 0
                });
            }
            this.players[pid].submitted = true;
            this.applyRoleScoping();
            this.drawAll();
            this.base.node.onStateChange();
            if (this.shots.length >= this.shooters().length) this.finishShooting();
        }).catch(() => {
            this.releaseAsset(key);   // a failed upload leaves the player un-submitted
        });
    }

    // Every upload rebroadcasts the whole asset bundle to every player, so the
    // bundle is kept down to just the photos currently on screen: a round's
    // shots are released once the next round starts and nothing points at them.
    releaseAsset(key) {
        if (key) delete this.uploadedAssets[key];
    }

    releaseRound(shots) {
        (shots || []).forEach(s => this.releaseAsset(s.key));
    }

    // -----------------------------------------------------------------------
    // Drawing
    // -----------------------------------------------------------------------

    // An Asset node is only ever in the tree while it holds a real, registered
    // asset key - see buildJudge.
    showPhoto(node, slot, frameRect, shot) {
        if (!shot || !shot.key) {
            if (node._attached) {
                slot.removeChild(node.id);
                node._attached = false;
            }
            node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            return;
        }
        const box = fitBox(shot.w, shot.h, frameRect[0] + 1, frameRect[1] + 1,
            frameRect[2] - 2, frameRect[3] - 2);
        // The picture is drawn entirely from assetInfo pos/size. coordinates2d
        // is only the node's click area, and a photo is not interactive, so it
        // stays zero-size rather than swallowing taps meant for things beneath.
        node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        const info = {};
        info[shot.key] = {
            pos: { x: box.x, y: box.y },
            size: { x: box.w, y: box.h }
        };
        node.node.asset = info;
        if (!node._attached) {
            slot.addChild(node);
            node._attached = true;
        }
    }

    drawLobby() {
        const ids = this.playerIds().sort((a, b) => this.players[a].seat - this.players[b].seat);
        this.seatRows.forEach((row, i) => {
            const pid = ids[i];
            if (pid === undefined) {
                row.chip.node.fill = [0, 0, 0, 0];
                row.name.node.text.text = '';
                return;
            }
            row.chip.node.fill = this.seatColor(pid);
            row.name.node.text.text = this.name(pid);
            row.name.node.text.color = INK;
        });
        const n = ids.length;
        const short = TUNING.MIN_PLAYERS - n;
        this.lobbyHint.node.text.text = short > 0
            ? ('NEED ' + short + ' MORE PLAYER' + (short === 1 ? '' : 'S'))
            : (n + ' PLAYERS - ' + (n * TUNING.ROUND_LAPS) + ' ROUNDS, EVERYONE JUDGES ONCE');
        this.setVisible(this.startBtn, short <= 0);
    }

    drawShoot() {
        const remaining = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
        const frac = Math.max(0, Math.min(1, (this.deadline - Date.now())
            / (TUNING.SHOOT_SECONDS * 1000)));
        this.timerFill.node.coordinates2d =
            ShapeUtils.rectangle(20, 48, Math.max(0.4, 60 * frac), 2.4);
        this.timerFill.node.fill = remaining <= TUNING.HURRY_SECONDS ? HOT : GO;
        this.clockText.node.text.text = remaining + 's';
        this.clockText.node.text.color = remaining <= TUNING.HURRY_SECONDS ? HOT : DIM;

        const total = this.shooters().length;
        this.tallyText.node.text.text = this.shots.length + ' / ' + total + ' PHOTOS IN';
        this.shootNote.node.text.text = 'JUDGE: ' + this.name(this.judgeId).toUpperCase();
    }

    drawJudge() {
        const shot = this.shots[this.viewIndex];
        const n = this.shots.length;
        this.photoCount.node.text.text = (this.viewIndex + 1) + '/' + n;
        this.showPhoto(this.photoNode, this.photoSlot, JUDGE_FRAME, shot);

        // Progress dots: filled behind you, hollow ahead, ringed on the current
        // one. Nothing here asks the judge to remember anything.
        const dotW = 2.2, gap = 1.1;
        const totalW = n * dotW + (n - 1) * gap;
        const x0 = 50 - totalW / 2;
        this.verdictDots.forEach((d, i) => {
            if (i >= n) {
                d.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                d.node.fill = [0, 0, 0, 0];
                return;
            }
            const s = this.shots[i];
            const done = i < this.viewIndex;
            const here = i === this.viewIndex;
            d.node.coordinates2d =
                ShapeUtils.rectangle(x0 + i * (dotW + gap), here ? 11.1 : 11.6,
                    dotW, here ? 2.6 : 1.8);
            d.node.fill = done ? (s.verdict ? GO : HOT) : (here ? INK : PANEL);
        });

        // Only the judge gets the buttons; everyone else is told who to nag.
        const j = this.judgeId !== null ? [this.judgeId] : [0];
        this.thumbDownBtn.node.playerIds = j;
        this.thumbUpBtn.node.playerIds = j;

        const others = this.playerIds().filter(pid => pid !== this.judgeId);
        this.judgeWait.node.playerIds = others.length ? others : [0];
        this.judgeWait.node.text.text = this.name(this.judgeId).toUpperCase() + ' IS DECIDING';
    }

    drawReveal() {
        const done = this.phase === 'final';
        const liked = this.shots.filter(s => s.verdict).length;

        if (done) {
            const ranked = this.playerIds().sort((a, b) =>
                this.players[b].score - this.players[a].score);
            const top = ranked[0];
            this.revealTitle.node.text.text = 'FINAL';
            this.revealWho.node.text.text = top ? (this.name(top).toUpperCase() + ' WINS') : '';
            this.revealWho.node.text.color = top ? this.seatColor(top) : DIM;
        } else if (!this.shots.length) {
            this.revealTitle.node.text.text = 'NOBODY SUBMITTED';
            this.revealWho.node.text.text = 'awkward';
            this.revealWho.node.text.color = DIM;
        } else {
            this.revealTitle.node.text.text = 'THE VERDICT';
            this.revealWho.node.text.text = liked === 0
                ? 'the judge liked nothing'
                : (liked + ' of ' + this.shots.length + ' approved');
            this.revealWho.node.text.color = liked ? GO : DIM;
        }

        // Lay the round's photos out in a strip, each with its author revealed
        // and the judge's verdict beside it.
        const shots = done ? [] : this.shots;
        const n = shots.length;
        const cellW = n ? Math.min(22, (94 - (n - 1) * 2) / n) : 0;
        const x0 = 50 - (n * cellW + (n - 1) * 2) / 2;
        this.revealCells.forEach((c, i) => {
            const s = shots[i];
            if (!s) {
                this.showPhoto(c.photo, c.slot, [0, 0, 0, 0], null);
                c.thumb.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                c.thumb.node.fill = [0, 0, 0, 0];
                c.who.node.text.text = '';
                c.pts.node.text.text = '';
                return;
            }
            const x = x0 + i * (cellW + 2);
            const cx = x + cellW / 2;
            this.showPhoto(c.photo, c.slot, [x, 20, cellW, 26], s);
            const iw = Math.min(3.4, cellW * 0.28), ih = iw * YS;
            c.thumb.node.coordinates2d = thumbPoly(cx - iw / 2, 47, iw, ih, s.verdict);
            c.thumb.node.fill = s.verdict ? GO : HOT;
            // Names shrink to their cell: seven photos leave far less room per
            // name than four, and the scoreboard sits right underneath.
            const nameSize = 1.3;
            const fits = Math.max(3, Math.floor(cellW / (nameSize * 0.85)));
            c.who.node.text.text = this.name(s.pid).slice(0, fits);
            c.who.node.text.size = nameSize;
            c.who.node.text.x = cx;
            c.who.node.text.y = 47 + ih + 0.6;
            c.who.node.text.color = this.seatColor(s.pid);
            c.pts.node.text.text = '+' + (TUNING.SUBMIT_POINTS
                + (s.verdict ? TUNING.LIKE_POINTS : 0));
            c.pts.node.text.x = cx;
            c.pts.node.text.y = 47 + ih + 3.4;
        });

        this.nextRoundBtn._label.node.text.text = done ? 'PLAY AGAIN'
            : (this.round >= this.totalRounds ? 'FINAL SCORES' : 'NEXT ROUND');

        const ids = this.playerIds().sort((a, b) => this.players[b].score - this.players[a].score);
        this.scoreRows.forEach((row, i) => {
            const pid = ids[i];
            if (pid === undefined) {
                row.chip.node.fill = [0, 0, 0, 0];
                row.name.node.text.text = '';
                row.pts.node.text.text = '';
                return;
            }
            row.chip.node.fill = this.seatColor(pid);
            row.name.node.text.text = this.name(pid);
            row.pts.node.text.text = String(this.players[pid].score);
        });
    }

    drawAll() {
        if (this.phase === 'lobby') { this.drawLobby(); return; }
        this.roundText.node.text.text = 'ROUND ' + this.round + ' / ' + this.totalRounds;
        if (this.phase === 'shoot') this.drawShoot();
        else this.clockText.node.text.text = '';
        if (this.phase === 'judge') this.drawJudge();
        if (this.phase === 'reveal' || this.phase === 'final') this.drawReveal();
    }

    // -----------------------------------------------------------------------
    // Loop - only the shooting countdown needs one
    // -----------------------------------------------------------------------

    tick() {
        if (this.phase !== 'shoot') return;          // nothing else animates
        const remaining = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
        if (remaining <= 0) { this.finishShooting(); return; }
        if (remaining === this.lastRemaining) return; // only redraw on a tick over
        this.lastRemaining = remaining;
        this.drawShoot();
        this.base.node.onStateChange();
    }

    // -----------------------------------------------------------------------
    // Platform hooks
    // -----------------------------------------------------------------------

    handleNewPlayer({ playerId, info }) {
        const pid = Number(playerId);
        let seat = 0;
        while (seat < TUNING.MAX_PLAYERS && this.seats[seat] !== undefined) seat++;
        if (seat >= TUNING.MAX_PLAYERS) seat = TUNING.MAX_PLAYERS - 1;
        this.seats[seat] = pid;

        this.players[pid] = {
            name: String((info && info.name) || ('PLAYER ' + pid)).toUpperCase().slice(0, 12),
            score: 0,
            seat: seat,
            submitted: false
        };
        if (this.order.indexOf(pid) < 0) this.order.push(pid);
        this.seatRows[seat].you.node.playerIds = [pid];
        if (this.phase === 'shoot') this.applyRoleScoping();
        this.drawAll();
        this.base.node.onStateChange();
    }

    handlePlayerDisconnect(playerId) {
        const pid = Number(playerId);
        const p = this.players[pid];
        if (!p) return;
        this.seatRows[p.seat].you.node.playerIds = [0];
        delete this.seats[p.seat];
        delete this.players[pid];
        this.order = this.order.filter(id => id !== pid);

        if (this.phase !== 'lobby' && this.playerIds().length < TUNING.MIN_PLAYERS) {
            this.phase = 'lobby';                     // too few to continue
            this.showPhase();
        } else if (pid === this.judgeId && this.phase !== 'lobby') {
            // The judge left mid-round: hand the role to the next in rotation
            // rather than stranding everyone.
            this.judgeId = this.order.length
                ? this.order[(this.round - 1) % this.order.length] : null;
            if (this.phase === 'shoot') this.applyRoleScoping();
        } else if (this.phase === 'shoot') {
            this.applyRoleScoping();
            if (this.shots.length >= this.shooters().length) this.finishShooting();
        }
        this.drawAll();
        this.base.node.onStateChange();
    }
}

module.exports = SnapJudgment;
