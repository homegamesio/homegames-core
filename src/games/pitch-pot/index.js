const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');
const { PitchRules, CLIP_SECONDS, MAX_PLAYERS, clean } = require('./rules');
const C = { cream: [255, 248, 235, 255], ink: [48, 33, 62, 255], muted: [116, 102, 116, 255],
    coral: [245, 104, 75, 255], lime: [220, 236, 147, 255], paper: [242, 231, 215, 255], white: [255, 255, 255, 255] };

class PitchPot extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Pitch Pot',
            author: "Joseph Garcia",
            description: 'Write a ridiculous object. Trade ideas. Record a 30-second sales pitch, watch the premieres, and vote for the best.',
            aspectRatio: { x: 4, y: 5 },
            maxPlayers: 8,
            tickRate: 4,
            gameId: "9c77e586-883d-469c-a96d-d47502dc9b3a"
        };
    }
    constructor({ media, handleFileUpload, createExport, userExports = {} } = {}) {
        super(); this.media = media; this.handleFileUpload = handleFileUpload; this.createExport = createExport;
        this.exportNames = new Set(Object.keys(userExports).map(name => name.toLowerCase()));
        this.rules = new PitchRules(); this.views = new Map(); this.devices = new Map();
        this.base = this.rect(null, 0, 0, 100, 100, C.cream);
        this.shared = this.rect(this.base, 0, 0, 0, 0, null);
        this.videoLayer = this.rect(this.base, 0, 0, 0, 0, null);
        this.render();
    }
    rect(parent, x, y, w, h, fill, extra = {}) {
        const node = new GameNode.Shape({ shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h), fill, ...extra });
        parent?.addChild(node); return node;
    }
    text(parent, value, x, y, size = 3, color = C.ink, align = 'center') {
        const node = new GameNode.Text({ textInfo: { text: value, x, y, size, color, align } });
        parent.addChild(node); return node;
    }
    lines(parent, value, y, size = 4, max = 30, color = C.ink) {
        const words = String(value).match(new RegExp(`.{1,${max}}(?:\\s|$)|.{1,${max}}`, 'g')) || [''];
        words.slice(0, 4).forEach((line, i) => this.text(parent, line.trim(), 50, y + i * size * 1.02, size, color));
    }
    button(root, id, label, y, action, fill = C.ink, x = 8, w = 84, size = 3, h = 9) {
        const node = this.rect(root, x, y, w, h, fill, { onClick: who => { if (who === id) action(); } });
        this.text(node, label, x + w / 2, y + h / 2 - size * 0.4, size, fill === C.ink ? C.cream : C.ink); return node;
    }
    setText(node, text) {
        if (node && node.node.text.text !== text) { node.node.text.text = text; node.node.onStateChange(); }
    }
    canAddPlayer() { return this.rules.people.size < MAX_PLAYERS; }
    handleNewPlayer({ playerId, info }) {
        if (!this.rules.join(playerId, info?.name)) return;
        this.views.set(playerId, this.rect(this.base, 0, 0, 0, 0, null, { playerIds: [playerId] }));
        this.devices.set(playerId, { pending: false, notice: '' }); this.render();
    }
    handlePlayerDisconnect(id) {
        this.media?.cancelRecording?.(id, 'The player left');
        const root = this.views.get(id); if (root) this.base.removeChild(root.id);
        this.views.delete(id); this.devices.delete(id); this.rules.leave(id); this.render();
    }
    start(id) {
        if (!this.rules.start(id)) return;
        for (const device of this.devices.values()) { device.pending = false; device.notice = ''; }
        this.render();
    }
    submit(id, value) {
        if (!this.rules.submit(id, value)) {
            const device = this.devices.get(id); if (device && this.rules.phase === 'write') device.notice = 'Type an object before putting it in the pot.';
        }
        this.render();
    }
    async record(id) {
        const entry = this.rules.entries.get(id), device = this.devices.get(id), round = this.rules.round;
        if (this.closed || this.rules.phase !== 'record' || !entry?.connected || entry.clip || entry.skipped || device?.pending) return;
        device.pending = true; device.notice = 'Finish recording on your device.'; this.render();
        const active = () => !this.closed && this.devices.get(id) === device && this.rules.round === round
            && this.rules.phase === 'record' && this.rules.entries.get(id) === entry && !entry.skipped && !entry.clip;
        try {
            if (!this.media?.record || !this.handleFileUpload) throw new Error('This client does not support recording.');
            const clip = await this.media.record(id, { durationSeconds: CLIP_SECONDS, maxBytes: 2 * 1024 * 1024, prompt: entry.assignment.idea });
            if (!active()) return;
            device.notice = 'Sending your pitch to the screening room…'; this.render();
            const asset = await this.handleFileUpload(id, clip.bytes, clip.meta, { slot: 'pitch' });
            if (active()) {
                this.rules.acceptClip(id, asset.key); device.notice = ''; this.render();
                const idea = entry.assignment.idea.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'pitch';
                const base = `pitch-${round}-${id}-${idea}`, extension = /^video\/mp4(?:;|$)/i.test(clip.meta.contentType) ? 'mp4' : 'webm';
                let name = `${base}.${extension}`, suffix = 2;
                while (this.exportNames.has(name.toLowerCase())) name = `${base}-${suffix++}.${extension}`;
                this.exportNames.add(name.toLowerCase());
                try {
                    if (!this.createExport) throw new Error('This host cannot save exports');
                    await this.createExport(name, clip.bytes);
                } catch (error) {
                    this.exportNames.delete(name.toLowerCase());
                    device.notice = clean(`Pitch plays this round, but the video was not saved: ${error.message}`, 120);
                }
            }
        } catch (error) { if (active()) device.notice = clean(error.message || 'Recording failed. Try again.', 120); }
        finally { device.pending = false; if (!this.closed) this.render(); }
    }
    skip(id) {
        if (!this.rules.skip(id)) return;
        this.media?.cancelRecording?.(id); this.render();
    }
    advance(id) { if (this.rules.advance(id)) this.render(); }
    replay(id) { if (this.rules.replay(id)) { this.videoKey = null; this.render(); } }
    vote(id, target) { if (this.rules.vote(id, target)) this.render(); }
    tick() {
        if (this.rules.tick()) this.render();
        else if (this.timer) this.setText(this.timer, this.timerText());
    }
    timerText() {
        const left = Math.max(0, Math.ceil((this.rules.deadline - Date.now()) / 1000));
        return this.rules.phase === 'vote' ? `${left}s to decide` : left ? `${left}s · let them cook` : 'Pitch complete · replay or continue';
    }
    render() {
        if (this.closed) return;
        this.shared.clearChildren(); this.timer = null;
        const { phase, round } = this.rules;
        this.rect(this.shared, 0, 0, 100, 1.5, C.coral);

        this.text(this.shared, phase === 'lobby' ? '' : `ROUND ${round}`, 92, 6, 1.9, C.muted, 'right');
        if (phase === 'lobby') this.lobby();
        else if (phase === 'write') this.heading('Into the pot.', 'Invent an object for somebody else to sell.');
        else if (phase === 'record') this.heading('Make us need it.', 'Videos are saved in View exports for the room.');
        else if (phase === 'screen') this.screen();
        else if (phase === 'vote') this.heading('Who sold it best?', 'One vote each. You cannot vote for yourself.');
        else this.results();
        const current = phase === 'screen' ? this.rules.current : null;
        const key = current?.clip || null;
        if (this.videoKey !== key) {
            this.videoLayer.clearChildren(); this.videoKey = key;
            if (key) this.videoLayer.addChild(new GameNode.Asset({ assetInfo: {
                [key]: { pos: { x: 5, y: 38 }, size: { x: 90, y: 40.5 }, startTime: 0 },
            } }));
        }
        for (const [id, root] of this.views) {
            const entry = this.rules.entries.get(id);
            // Keep a player's text-input node alive while other players submit.
            // A client may still have that node's input dialog open.
            const writeKey = phase === 'write' ? JSON.stringify([round, entry?.connected, entry?.idea, this.devices.get(id).notice]) : null;
            if (writeKey === null || root.writeKey !== writeKey) {
                root.writeCount = null; root.clearChildren(); this.controls(root, id); root.writeKey = writeKey;
            }
            if (root.writeCount) this.setText(root.writeCount, `${[...this.rules.entries.values()].filter(e => e.idea).length} / ${this.rules.entries.size} ideas in the pot`);
        }
    }
    heading(title, subtitle) {
        this.text(this.shared, title, 50, 16, 6);
        this.text(this.shared, subtitle, 50, 25, 2.5, C.muted);
    }
    lobby() {

        this.rect(this.shared, 32, 40, 20, 14, C.lime);
        this.text(this.shared, 'IDEA', 42, 45, 3);
        this.rect(this.shared, 54, 42, 15, 12, C.paper);
        const bowl = new GameNode.Shape({ shapeType: Shapes.POLYGON,
            coordinates2d: [[25, 52], [75, 52], [67, 65], [33, 65], [25, 52]], fill: C.coral });
        this.shared.addChild(bowl);
        this.text(this.shared, 'Pitch a friend’s invention in 30 seconds.', 50, 70, 3.4);
        this.text(this.shared, '2–8 players · camera + microphone', 50, 76, 2.5, C.muted);
        this.text(this.shared, [...this.rules.people.values()].map(p => p.name).join(' · ').slice(0, 64), 50, 81, 2, C.muted);
    }
    screen() {
        const entry = this.rules.current;
        if (!entry) {
            this.heading('The premiere.', `${this.rules.order.length} pitches. Absolutely no refunds.`);
            this.text(this.shared, 'Turn your sound up.', 50, 45, 5);
            this.text(this.shared, 'Tap the screen to enable audio.', 50, 55, 2.8, C.muted);
            return;
        }
        this.text(this.shared, `PITCH ${this.rules.index + 1} / ${this.rules.order.length} · ${entry.name}`, 50, 14, 2.8, C.muted);
        this.lines(this.shared, entry.assignment.idea, 20, 4.1, 36);
        this.text(this.shared, `Idea by ${entry.assignment.authorName}`, 50, 33, 2.6, C.muted);
        this.rect(this.shared, 5, 38, 90, 40.5, C.ink);
        this.timer = this.text(this.shared, this.timerText(), 50, 81, 2.6, C.muted);
    }
    results() {
        const scores = this.rules.results(), high = scores[0]?.votes || 0;
        const winners = high ? scores.filter(entry => entry.votes === high) : [];
        this.heading(winners.length > 1 ? 'A shared crown!' : winners.length ? 'Consider it sold.' : 'No winner this time.',
            winners.length ? 'The room has spoken.' : 'Start another round and give it a shot.');
        scores.forEach((entry, i) => {
            const y = 33 + i * 6;
            this.rect(this.shared, 8, y, 84, 5.3, high && entry.votes === high ? C.lime : C.paper);
            this.text(this.shared, entry.name, 11, y + 1.3, 2.8, C.ink, 'left');
            this.text(this.shared, `${entry.votes} ${entry.votes === 1 ? 'vote' : 'votes'}`, 89, y + 1.3, 2.8, C.ink, 'right');
        });
    }
    controls(root, id) {
        const { phase, hostId } = this.rules, host = id === hostId;
        const entry = this.rules.entries.get(id), device = this.devices.get(id);
        const hostName = this.rules.people.get(hostId)?.name || 'host';
        if (phase !== 'record' && device.notice) this.lines(root, device.notice, 96, 1.7, 70, C.coral);
        if (phase === 'lobby' || phase === 'results') {
            if (host && this.rules.people.size >= 2) this.button(root, id, phase === 'lobby' ? 'LET’S COOK' : 'ANOTHER ROUND', 86, () => this.start(id), C.lime);
            else this.text(root, this.rules.people.size < 2 ? 'Use Share to invite at least one friend.' : `${hostName} starts the next round.`, 50, 90, 2.7, C.muted);
        } else if (phase === 'write') {
            if (!entry?.connected) { this.spectating(root); return; }
            if (entry.idea) {
                this.text(root, 'In the pot!', 50, 42, 5);
                this.lines(root, entry.idea, 51, 3.5);
                this.text(root, 'Your idea is locked. Someone else gets to sell it.', 50, 73, 2.5, C.muted);
            } else {
                this.rect(root, 8, 36, 84, 34, C.white);
                this.text(root, 'What does the world need?', 50, 42, 4);
                this.text(root, 'A self-warming spoon?', 50, 52, 3, C.muted);
                this.text(root, 'Roller skates for a houseplant?', 50, 58, 3, C.muted);
                const input = this.rect(root, 8, 76, 84, 10, C.ink, { input: { type: 'text',
                    oninput: (who, value) => { if (who === id) this.submit(id, value); } } });
                this.text(input, 'TYPE & TOSS IT IN', 50, 79.4, 3.4, C.cream);
            }
            root.writeCount = this.text(root, '', 50, 91, 2.6, C.muted);
            if (device.notice) this.text(root, device.notice, 50, 96, 2.1, C.coral);
        } else if (phase === 'record') {
            if (!entry?.connected) { this.spectating(root); return; }
            this.rect(root, 8, 34, 84, 26, C.lime);
            this.text(root, 'YOUR OBJECT TO SELL', 50, 38, 2.1, C.muted);
            this.lines(root, entry.assignment.idea, 44, 4.5, 28);
            if (entry.clip || entry.skipped) {
                this.text(root, entry.clip ? 'Pitch in the can!' : 'Sitting this pitch out.', 50, 70, 4);
                this.text(root, 'The screening starts when everyone is done.', 50, 80, 2.5, C.muted);
            } else if (device.pending) this.text(root, 'Your recording booth is open.', 50, 73, 3.3);
            else {
                this.button(root, id, 'OPEN RECORDING BOOTH', 65, () => this.record(id), C.ink);
                this.button(root, id, 'Camera trouble? Skip this pitch', 77, () => this.skip(id), C.paper, 8, 84, 2.5);
            }
            if (device.notice) this.lines(root, device.notice, 89, 2.2, 58, C.muted);
            else this.text(root, `${[...this.rules.entries.values()].filter(e => e.clip || e.skipped).length} / ${this.rules.entries.size} finished`, 50, 92, 2.6, C.muted);
        } else if (phase === 'screen') {
            if (host) {
                if (!this.rules.current) this.button(root, id, 'PLAY THE FIRST PITCH', 86, () => this.advance(id), C.lime);
                else {
                    this.button(root, id, 'REPLAY', 86, () => this.replay(id), C.paper, 8, 26, 2.5);
                    this.button(root, id, this.rules.index === this.rules.order.length - 1 ? 'TIME TO VOTE' : 'NEXT PITCH', 86, () => this.advance(id), C.lime, 38, 54, 2.5);
                }
            } else this.text(root, `${hostName} is running the screening.`, 50, 90, 2.7, C.muted);
        } else if (phase === 'vote') {
            if (!entry?.connected) { this.spectating(root); return; }
            if (this.rules.votes.has(id)) {
                this.text(root, 'Vote locked in.', 50, 46, 5);
                this.text(root, 'Waiting for the rest of the room…', 50, 55, 2.8, C.muted);
            } else {
                const options = this.rules.order.filter(target => target !== id);
                options.forEach((target, i) => {
                    const candidate = this.rules.entries.get(target);
                    const y = 32 + i * 7.4;
                    const button = this.rect(root, 8, y, 84, 6.4, C.paper, {
                        onClick: who => { if (who === id) this.vote(id, target); },
                    });
                    this.text(button, candidate.name, 50, y + 0.7, 2.8);
                    this.text(button, candidate.assignment.idea.length > 42 ? candidate.assignment.idea.slice(0, 39) + '…' : candidate.assignment.idea,
                        50, y + 3.6, 1.8, C.muted);
                });
                if (!options.length) this.text(root, 'Everyone else is voting on your pitch.', 50, 50, 3);
            }
            // One shared timer is enough, outside private player roots.
            if (!this.timer) this.timer = this.text(this.shared, this.timerText(), 50, 91, 2.7, C.muted);
        }
    }
    spectating(root) {
        this.text(root, 'You’re on the guest list.', 50, 47, 4);
        this.text(root, 'Watch this round. You’ll play in the next one.', 50, 56, 2.5, C.muted);
    }
    getLayers() { return [{ root: this.base }]; }
    close() {
        this.closed = true;
        for (const id of this.devices.keys()) this.media?.cancelRecording?.(id, 'The game ended');
        super.close();
    }
}
module.exports = PitchPot;
