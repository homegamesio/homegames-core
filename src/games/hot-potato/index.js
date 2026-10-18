const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const COLORS = Colors.COLORS;
const BG = [87, 42, 19, 255];

class HotPotato extends Game {
    static metadata() {
        return {
            aspectRatio: { x: 1, y: 1 },
            author: "Joseph Garcia",
            description: 'Tap the potato to get it out of your hands before it explodes',
            name: 'Hot Potato',
            thumbnail: './assets/thumbnail.png',
            assets: {
                'potato':       new Asset({ path: './assets/48685183f94c7a3c14f315444c6460bd.png', type: 'image' }),
                'potato-dead':  new Asset({ path: './assets/5fc598f08a887c8cd437bb3d9cdca197.png', type: 'image' }),
                'hiss':         new Asset({ path: './assets/9de51f059a02e37356da0faefcabe643.mp3', type: 'audio' }),
                'potato-bleh':  new Asset({ path: './assets/600513b2cbd50c1f8c465b3098c22c56.mp3', type: 'audio' })
            },
            gameId: "db3ac967-cf0a-5426-a6b6-78140ad315d6",
            maxPlayers: 8
        };
    }

    constructor({ random = Math.random, now = Date.now } = {}) {
        super();
        this.random = random;
        this.now = now;
        this.closed = false;
        // Root container only. Its fill never renders to a player who has a
        // scoped node, so each player's own backdrop is the real background.
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: BG
        });
        this.players = {};
        this.soundTimestamp = null;
    }

    // Game tracks timers for shutdown; remove completed/cancelled handles too,
    // so a long-running party does not retain every previous round's callbacks.
    clearTimer(key) {
        const timer = this[key];
        if (timer == null) return;
        clearTimeout(timer);
        this.timeouts = this.timeouts.filter(item => item !== timer);
        this[key] = null;
    }

    scheduleTimer(key, delay, callback) {
        this.clearTimer(key);
        const timer = this.setTimeout(() => {
            if (this.closed || this[key] !== timer) return;
            this.clearTimer(key); callback();
        }, delay);
        this[key] = timer;
    }

    clearRound() {
        for (const key of ['explosionTimer', 'resultTimer', 'soundTimer']) this.clearTimer(key);
        for (const key of ['potato', 'deadPotato', 'deadSound']) {
            if (this[key]) this.base.removeChild(this[key].id);
            this[key] = null;
        }
        this.potatoSound = null;
    }

    close() {
        this.closed = true; this.clearRound(); super.close();
    }

    // Per-player backdrop scoped to that player. Added first so every player
    // appears in the per-player frame map (otherwise they'd fall back to the
    // full unscoped frame and see everyone's potato).
    addBackdrop(playerId) {
        const backdrop = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: BG,
            playerIds: [Number(playerId)]
        });
        this.players[playerId].backdrop = backdrop;
        this.base.addChild(backdrop);
        const status = new GameNode.Text({
            textInfo: { text: '', x: 50, y: 44, color: COLORS.WHITE, size: 4, align: 'center' }
        });
        const statusTail = new GameNode.Text({
            textInfo: { text: '', x: 50, y: 52, color: COLORS.WHITE, size: 4, align: 'center' }
        });
        backdrop.addChildren(status, statusTail);
        this.players[playerId].status = status;
        this.players[playerId].statusTail = statusTail;
        // A late arrival's backdrop must stay behind the potato when it is
        // eventually passed to them.
        for (const foreground of [this.potato, this.deadPotato]) {
            if (foreground) { this.base.removeChild(foreground.id); this.base.addChild(foreground); }
        }
    }

    updateMessage() {
        const need = Object.keys(this.players).length < 2;
        for (const player of Object.values(this.players)) {
            player.status.node.text.text = need ? 'The potato demands' : '';
            player.statusTail.node.text.text = need ? 'at least two players.' : '';
            player.status.node.onStateChange();
            player.statusTail.node.onStateChange();
        }
        this.base.node.onStateChange();
    }

    randomPlayerId(excludedIds = []) {
        const ids = Object.keys(this.players).filter(k => excludedIds.indexOf(Number(k)) < 0);
        return ids[Math.floor(this.random() * ids.length)];
    }

    explode() {
        if (this.closed || !this.potato) return;
        this.clearTimer('explosionTimer');
        const holderIds = this.potato.node.playerIds;   // capture before removing
        this.base.removeChild(this.potato.node.id);
        this.potato = null;

        this.deadPotato = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(25, 25, 50, 50),
            assetInfo: { 'potato-dead': { pos: { x: 30, y: 35 }, size: { x: 40, y: 30 } } },
            playerIds: holderIds
        });
        this.deadSound = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            assetInfo: { 'potato-bleh': { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } },
            playerIds: holderIds
        });
        this.base.addChildren(this.deadPotato, this.deadSound);
        this.updateMessage();

        // The supplied clip lasts 340 ms. Let it finish before removing it.
        this.scheduleTimer('soundTimer', 500, () => {
            if (this.deadSound) this.base.removeChild(this.deadSound.id);
            this.deadSound = null;
        });
        this.scheduleTimer('resultTimer', 3 * 1000, () => {
            if (this.deadPotato) { this.base.removeChild(this.deadPotato.id); this.deadPotato = null; }
            if (Object.keys(this.players).length > 1) this.createPotato();
            this.updateMessage();
        });
    }

    createPotato(assignedPlayerId) {
        if (this.closed || Object.keys(this.players).length < 2) return;
        if (assignedPlayerId == null) assignedPlayerId = Number(this.randomPlayerId());
        assignedPlayerId = Number(assignedPlayerId);
        if (!Number.isSafeInteger(assignedPlayerId) || !this.players[assignedPlayerId]) return;

        this.clearRound();

        this.potato = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(25, 25, 50, 50),
            assetInfo: { 'potato': { pos: { x: 30, y: 35 }, size: { x: 40, y: 30 } } },
            playerIds: [assignedPlayerId]
        });

        const potato = this.potato;
        this.songPlayedAt = this.now();
        this.soundTimestamp = 0;
        this.explodeAt = this.songPlayedAt + (5 + Math.floor(this.random() * 15)) * 1000;

        // No playerIds on the overlay/sound: they inherit the potato's, so a
        // pass (set potato.playerIds) re-scopes them automatically.
        const overlay = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(15, 15, 70, 70),
            fill: [0, 0, 0, 0],
            onClick: playerId => { if (this.potato === potato) this.tryPass(playerId); }
        });
        this.potatoSound = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            assetInfo: { 'hiss': { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: this.soundTimestamp } }
        });

        this.base.addChild(this.potato);                  // after backdrops -> renders on top
        this.potato.addChildren(this.potatoSound, overlay);

        this.scheduleTimer('explosionTimer', this.explodeAt - this.songPlayedAt, () => this.explode());
        this.updateMessage();
        this.base.node.onStateChange();
    }

    tryPass(playerId) {
        if (this.closed || !this.players[playerId] || !this.potato?.node.playerIds.includes(Number(playerId))) return;
        const next = Number(this.randomPlayerId(this.potato.node.playerIds));
        this.passPotato(next);
    }

    // Pass to a new holder: re-scope the potato (overlay + sound inherit) and
    // resume the hiss from where it was.
    passPotato(newHolderId) {
        newHolderId = Number(newHolderId);
        if (this.closed || !this.potato || !Number.isSafeInteger(newHolderId) || !this.players[newHolderId]) return;
        const now = this.now();
        // A delayed timer (for example, a backgrounded host tab) cannot let an
        // input pass an already-expired potato to somebody else.
        if (now >= this.explodeAt) { this.explode(); return; }
        this.soundTimestamp += (now - this.songPlayedAt) / 1000;
        this.songPlayedAt = now;

        this.potato.removeChild(this.potatoSound.id);
        this.potatoSound = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            assetInfo: { 'hiss': { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: this.soundTimestamp } }
        });
        this.potato.addChild(this.potatoSound);

        this.potato.node.playerIds = [newHolderId];        // re-scopes potato + inherited children
        this.updateMessage();
        this.base.node.onStateChange();
    }


    handleNewPlayer({ playerId, info, settings, clientInfo }) {
        if (this.closed || !Number.isSafeInteger(Number(playerId)) || Number(playerId) < 1) return;
        if (this.players[playerId]) { this.players[playerId].info = info; return; }
        if (Object.keys(this.players).length >= HotPotato.metadata().maxPlayers) return;
        this.players[playerId] = { info, settings, clientInfo };
        this.addBackdrop(playerId);
        this.updateMessage();
        if (Object.keys(this.players).length > 1 && !this.potato && !this.deadPotato) this.createPotato();
        this.base.node.onStateChange();
    }

    handlePlayerDisconnect(playerId) {
        const p = this.players[playerId];
        if (p && p.backdrop) this.base.removeChild(p.backdrop.id);
        delete this.players[playerId];

        // Stop a round as soon as fewer than two people remain, whichever one left.
        if (Object.keys(this.players).length < 2) {
            this.clearRound();
        } else if (this.potato && this.potato.node.playerIds.indexOf(Number(playerId)) >= 0) {
            const next = Number(this.randomPlayerId());
            if (Object.keys(this.players).length > 1 && !Number.isNaN(next)) this.passPotato(next);
            else { this.base.removeChild(this.potato.node.id); this.potato = null; }
        }
        this.updateMessage();
        this.base.node.onStateChange();
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = HotPotato;
