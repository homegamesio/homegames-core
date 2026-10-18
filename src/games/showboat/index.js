const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');
const ShowboatRules = require('./rules');

const C = {
    paper: [249, 241, 219, 255], ink: [34, 48, 64, 255], muted: [100, 108, 111, 255],
    coral: [238, 106, 78, 255], gold: [247, 193, 72, 255], teal: [34, 116, 119, 255],
    pale: [230, 222, 203, 255], white: [255, 251, 239, 255], night: [24, 40, 52, 255],
};

// One live stage, private cue cards, and a room full of very questionable products.
class Showboat extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Showboat',
            author: "Joseph Garcia",
            description: 'Turn ordinary objects into outrageous inventions. Pitch your secret purpose on the live camera stage, then guess your friends\' pitches. 2–6 players, together or remote.',
            aspectRatio: { x: 4, y: 5 },
            maxPlayers: 6,
            tickRate: 10,
            gameId: "c9d7200e-4a80-5ae5-a0cc-f6c0f05d7f08"
        };
    }

    constructor({ media, random } = {}) {
        super();
        this.rules = new ShowboatRules({ random });
        this.media = media;
        this.devices = new Map();
        this.views = new Map();
        this.mediaEpoch = 0;
        this.applause = new Set();
        this.base = this.rect(null, 0, 0, 100, 100, C.paper);
        this.shared = this.container(this.base);
        this.stage = this.container(this.base);
        this.privateLayer = this.container(this.base);
        this.unsubscribe = media?.onChange(info => this.mediaChanged(info));
        this.render();
    }

    container(parent, playerId) {
        return this.rect(parent, 0, 0, 0, 0, null,
            playerId === undefined ? {} : { playerIds: [playerId] });
    }
    rect(parent, x, y, w, h, fill, extra = {}) {
        const node = new GameNode.Shape({ shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h), fill,
            playerIds: parent?.node.playerIds || [], ...extra });
        parent?.addChild(node); return node;
    }
    text(parent, text, x, y, size = 3, color = C.ink, align = 'left') {
        const node = new GameNode.Text({ playerIds: parent.node.playerIds,
            textInfo: { text, x, y, size, color, align, font: 'sans-serif' } });
        parent.addChild(node); return node;
    }
    lines(parent, text, x, y, width, size = 3, color = C.ink, maxLines = 3) {
        // Squish scales text separately from geometry; leave room for wide glyphs.
        const limit = Math.floor(width / (size * 0.75));
        const lines = []; let line = '';
        for (const word of text.split(/\s+/)) {
            if (line && (line + ' ' + word).length > limit) { lines.push(line); line = ''; }
            line += (line ? ' ' : '') + word;
        }
        if (line) lines.push(line);
        lines.slice(0, maxLines).forEach((str, i) => this.text(parent, str, x, y + i * size * 1.3, size, color));
    }
    button(parent, label, x, y, w, h, action, fill = C.teal, size = 3.2) {
        const owner = parent.node.playerIds[0];
        const button = this.rect(parent, x, y, w, h, fill, {
            onClick: id => { if (!this.closed && (owner === undefined || owner === id)) action(id); },
        });
        this.text(button, label, x + w / 2, y + (h - size * 1.13) / 2, size,
            fill === C.pale || fill === C.gold || fill === C.paper ? C.ink : C.white, 'center');
        return button;
    }
    setText(node, text) {
        if (!node || node.node.text.text === text) return;
        node.node.text = { ...node.node.text, text }; node.node.onStateChange();
    }
    name(id) { return this.rules.people.get(id)?.name || 'Someone'; }
    timerLabel() {
        const seconds = Math.ceil(this.rules.remainingTicks / 10);
        return this.rules.phase === 'prep' ? `Starts in ${seconds}s` : `${seconds}s`;
    }
    mug(parent, x, y, size = 20) {
        this.rect(parent, x + size * 0.7, y + size * 0.2, size * 0.45, size * 0.45, C.coral);
        this.rect(parent, x + size * 0.83, y + size * 0.3, size * 0.2, size * 0.22, C.paper);
        this.rect(parent, x, y, size * 0.85, size * 0.85, C.coral);
        this.rect(parent, x + size * 0.08, y + size * 0.07, size * 0.69, size * 0.08, C.night);
    }

    handleNewPlayer({ playerId, info }) {
        if (this.devices.has(playerId)) this.handlePlayerDisconnect(playerId);
        if (!this.rules.addPlayer(playerId, String(info?.name || `Player ${playerId}`).slice(0, 16))) return;
        this.devices.set(playerId, { notice: '', stream: null, liveRound: null });
        // A persistent scoped root for EVERY connection prevents unfiltered secret frames.
        this.views.set(playerId, this.container(this.privateLayer, playerId));
        this.render();
    }
    handlePlayerDisconnect(id) {
        const device = this.devices.get(id);
        this.devices.delete(id);
        if (device?.stream) this.media?.stop(device.stream);
        const view = this.views.get(id);
        if (view) this.privateLayer.removeChild(view.id);
        this.views.delete(id);
        this.change(() => this.rules.removePlayer(id));
    }
    change(action) {
        const before = `${this.rules.phase}:${this.rules.roundNumber}`;
        const changed = action();
        if (!changed) return;
        if (before !== `${this.rules.phase}:${this.rules.roundNumber}`) {
            this.applause.clear();
            for (const device of this.devices.values()) { device.settingsOpen = false; device.hintOpen = false; }
        }
        this.silenceInactive(); this.render();
    }
    setMode(id, mode) {
        if (!this.rules.setMode(id, mode)) return;
        this.mediaEpoch++;
        for (const device of this.devices.values()) {
            if (device.stream) this.media?.stop(device.stream);
            device.notice = 'Mode changed. Set up your camera again.';
        }
        this.render();
    }

    async enable(id, video = true) {
        const device = this.devices.get(id);
        if (!device || device.pending || device.stream || this.closed) return;
        if (!video && this.rules.mode === 'room') return;
        const epoch = this.mediaEpoch;
        device.pending = true; device.requestEpoch = epoch;
        device.notice = 'Approve the device dialog to get ready.'; this.render();
        try {
            if (!this.media) throw new Error('Use browser Play for live camera and sound.');
            const stream = await this.media.request(id, {
                audio: this.rules.mode === 'remote', video, transmitting: false, pushToTalk: false,
            });
            if (this.closed || this.devices.get(id) !== device || epoch !== this.mediaEpoch) {
                this.media.stop(stream.id); return;
            }
            device.notice = '';
        } catch (error) {
            if (this.devices.get(id) === device && epoch === this.mediaEpoch) {
                device.notice = String(error.message || 'Could not enable your device.').slice(0, 100);
            }
        } finally {
            device.pending = false;
            if (!this.closed) this.render();
        }
    }
    mediaChanged(info) {
        const device = this.devices.get(info.playerId);
        if (!device || this.closed) return;
        if (info.state === 'ready') {
            if (device.requestEpoch !== this.mediaEpoch) { this.media.stop(info.id); return; }
            device.stream = info.id; device.video = info.video; device.audio = info.audio;
            device.transmitting = false; device.liveRound = null;
        } else if (device.stream === info.id) {
            device.transmitting = !!info.transmitting;
            if (!info.transmitting) device.liveRound = null;
            if (info.state === 'ended') {
                device.stream = null; device.transmitting = false;
                device.liveRound = null; device.notice = 'Disconnected. You can set up again.';
            }
        }
        this.render();
    }
    silenceInactive() {
        for (const [id, device] of this.devices) {
            const active = this.rules.phase === 'perform' && this.rules.current?.performerId === id
                && device.liveRound === this.rules.roundNumber;
            if (!active && device.stream && device.transmitting) {
                device.liveRound = null;
                this.media?.setTransmitting(device.stream, false);
            }
        }
    }
    goLive(id) {
        const device = this.devices.get(id);
        if (this.rules.current?.performerId !== id || !['prep', 'perform'].includes(this.rules.phase)) return;
        if (this.rules.phase === 'prep') {
            this.rules.advance(id);
            for (const d of this.devices.values()) { d.settingsOpen = false; d.hintOpen = false; }
        }
        // Permission completion and timed phase changes never start a broadcast.
        if (device?.stream && !device.transmitting) {
            device.liveRound = this.rules.roundNumber;
            this.media?.setTransmitting(device.stream, true);
        }
        this.render();
    }
    stopLive(id) {
        const device = this.devices.get(id);
        if (device?.stream) { device.liveRound = null; this.media?.setTransmitting(device.stream, false); }
        this.render();
    }
    clap(id) {
        if (this.rules.phase !== 'perform' || !this.devices.has(id)
            || this.rules.current.performerId === id || this.applause.has(id)) return;
        this.applause.add(id); this.render();
    }

    render() {
        if (this.closed) return;
        this.shared.clearChildren();
        const { phase } = this.rules;
        this.rect(this.shared, 0, 0, 100, 1.2, C.coral);

        this.timer = null;
        if (phase === 'lobby') this.renderLobby();
        else if (phase === 'finished') this.renderFinal();
        else this.renderRound();
        this.syncStage();
        for (const [id, root] of this.views) {
            root.clearChildren();
            if (phase === 'lobby') this.lobbyControls(root, id);
            else if (phase === 'finished') this.finalControls(root, id);
            else this.roundControls(root, id);
            this.mediaControls(root, id);
        }
    }
    renderLobby() {
        this.text(this.shared, 'Sell a silly invention.', 50, 22, 4.4, C.ink, 'center');
        this.text(this.shared, 'Your friends guess what it is.', 50, 28, 3.5, C.muted, 'center');
        this.mug(this.shared, 16, 39, 19);
        this.text(this.shared, 'becomes', 47, 45, 2.6, C.muted, 'center');
        this.rect(this.shared, 59, 38, 32, 20, C.gold);
        this.text(this.shared, 'Cat', 75, 42, 4, C.ink, 'center');
        this.text(this.shared, 'translator', 75, 48, 3.3, C.ink, 'center');
        if (this.rules.people.size < 2) {
            this.text(this.shared, 'Use Share. Everyone joins on their phone.', 50, 66, 2.9, C.teal, 'center');
        } else Array.from(this.rules.people).forEach(([, person], i) => {
            const x = 6 + (i % 2) * 45, y = 62 + Math.floor(i / 2) * 4;
            this.rect(this.shared, x, y + 0.6, 1.2, 1.2, C.teal);
            this.text(this.shared, person.name.length > 14 ? person.name.slice(0, 13) + '.' : person.name, x + 3, y, 2.8);
        });
    }
    lobbyControls(root, id) {
        const host = id === this.rules.hostId;
        const { mode } = this.rules;
        if (host) {
            this.button(root, 'Same room', 6, 74, 42, 7,
                () => this.setMode(id, 'room'), mode === 'room' ? C.teal : C.pale);
            this.button(root, 'Remote', 51, 74, 43, 7,
                () => this.setMode(id, 'remote'), mode === 'remote' ? C.teal : C.pale);
            this.button(root, 'Start', 6, 83, 88, 9,
                () => this.change(() => this.rules.start(id)), this.rules.people.size < 2 ? C.pale : C.coral, 4);
        } else {
            this.text(root, `Waiting for ${this.name(this.rules.hostId)}`, 50, 85, 3.2, C.muted, 'center');
        }
    }
    renderRound() {
        const r = this.rules, current = r.current;
        if (!current) return;
        this.timer = this.text(this.shared, this.timerLabel(), 94, 5, 2.9, C.muted, 'right');
        if (r.phase !== 'perform') return;
        this.rect(this.shared, 6, 18, 88, 39.6, C.night);
        const device = this.devices.get(current.performerId);
        const live = device?.transmitting;
        if (!live || !device.video) {
            this.text(this.shared, this.name(current.performerId), 50, 32, 4.5, C.white, 'center');
            this.text(this.shared, live ? 'Listen to their pitch' : r.mode === 'room' ? 'Watch them in your room' : 'Camera is paused',
                50, 41, 3.2, C.paper, 'center');
        }
        if (live && device.video) this.text(this.shared, this.name(current.performerId), 6, 60, 2.8, C.muted);
        if (this.applause.size) this.text(this.shared, `${this.applause.size} claps`, 94, 60, 2.8, C.teal, 'right');
    }
    roundControls(root, id) {
        const r = this.rules, current = r.current;
        if (!current) return;
        const isStar = id === current.performerId;
        const device = this.devices.get(id);
        if (r.phase === 'reveal') {
            const answer = current.prompt.choices[current.prompt.correctIndex];
            this.text(root, 'It was...', 10, 24, 3.5, C.muted);
            this.lines(root, answer.label, 10, 34, 80, 6, C.ink, 2);
            const correct = current.result?.correctVoterIds || [];
            const points = isStar ? correct.length * 100 : correct.includes(id) ? 100 : 0;
            const result = points ? `+${points}` : isStar ? 'A tough one!' : current.voters.includes(id) ? 'Maybe next time!' : `${correct.length} guessed it`;
            this.text(root, result, 10, 59, points ? 7 : 4, points ? C.teal : C.muted);
            if (points) this.text(root, isStar ? 'They guessed it!' : 'You got it!', 10, 70, 3.3, C.teal);
            if (id === r.hostId) this.button(root, 'Next', 6, 83, 88, 9,
                () => this.change(() => r.advance(id)), C.coral, 4);
            return;
        }
        if (r.phase === 'vote') {
            if (!current.voters.includes(id)) {
                this.text(root, 'They\'re guessing...', 50, 37, 5, C.ink, 'center');
                this.text(root, `${current.votes.size} / ${current.voters.length}`, 50, 51, 4, C.muted, 'center');
                return;
            }
            const voted = current.votes.has(id);
            this.text(root, voted ? 'Guess locked in' : 'What were they selling?', 50, 25, 4.4, C.ink, 'center');
            current.prompt.choices.forEach((choice, index) => {
                const selected = current.votes.get(id) === index;
                const x = 6 + (index % 2) * 45, y = 39 + Math.floor(index / 2) * 19;
                const button = this.button(root, '', x, y, 43, 16,
                    () => this.change(() => r.vote(id, index)), selected ? C.gold : voted ? C.pale : C.teal);
                this.lines(button, choice.label, x + 3, y + 3, 37, 3.2,
                    selected || voted ? C.ink : C.white, 3);
            });
            return;
        }
        if (isStar) {
            const secret = current.prompt.choices[current.prompt.correctIndex];
            if (r.phase === 'prep') {
                this.text(root, 'Your secret', 10, 19, 4, C.teal);
                this.text(root, 'Sell any object as a...', 10, 29, 3.6, C.muted);
                this.lines(root, secret.label, 10, 38, 80, 6, C.ink, 2);
                this.text(root, 'Don\'t say the name. Make them guess.', 10, 60, 3.1, C.muted);
                this.button(root, device.hintOpen ? 'Hide hint' : 'Need a hint?', 6, 67, 88, 5,
                    () => { device.hintOpen = !device.hintOpen; this.render(); }, C.paper, 2.7);
                if (device.hintOpen) this.lines(root, secret.brief, 10, 73, 80, 2.4, C.muted, 3);
                this.button(root, device?.stream ? 'Start + go live' : 'Start my pitch', 6, 83, 88, 9,
                    () => this.goLive(id), C.coral, 3.6);
            } else {
                this.lines(root, secret.label, 6, 67, 88, 4.2, C.ink, 2);
                this.button(root, device?.transmitting ? 'Pause camera' : device?.stream ? 'Go live' : 'Enable camera', 6, 85, 42, 9,
                    () => device?.transmitting ? this.stopLive(id) : device?.stream ? this.goLive(id)
                        : (device.settingsOpen = true, this.render()), C.teal, 3);
                this.button(root, 'Done', 51, 85, 43, 9,
                    () => this.change(() => r.advance(id)), C.coral, 3.6);
            }
        } else {
            if (r.phase === 'prep') {
                this.mug(root, 39, 26, 20);
                this.text(root, this.name(current.performerId), 50, 53, 4.3, C.ink, 'center');
                this.text(root, 'is getting ready', 50, 60, 3.4, C.muted, 'center');
                if (r.roundNumber === 1) this.text(root, 'Watch their pitch. Then guess what it is.', 50, 73, 3, C.teal, 'center');
            } else {
                this.text(root, 'What are they selling?', 50, 71, 4, C.ink, 'center');
                this.button(root, this.applause.has(id) ? 'Clapped!' : 'Clap', 28, 85, 44, 9,
                    () => this.clap(id), this.applause.has(id) ? C.pale : C.gold, 3.3);
            }
        }
    }
    mediaControls(root, id) {
        const device = this.devices.get(id), { phase, mode } = this.rules;
        // Keep setup out of the way until a player asks for it.
        if (device.settingsOpen) {
            this.rect(root, 0, 14, 100, 86, C.paper, { onClick: () => {} });
            this.text(root, 'Camera & sound', 8, 25, 5);
            this.lines(root, mode === 'room' ? 'Talk out loud. The camera is optional.'
                : 'Your camera and mic are live only on your turn.', 8, 39, 83, 3.5, C.muted, 2);
            this.text(root, device.transmitting ? 'You are live now.' : 'Tap Go live on your turn to share.', 8, 54, 3, C.teal);
            if (device.stream) this.button(root, 'Disconnect', 8, 65, 84, 9,
                () => this.media?.stop(device.stream), C.coral);
            else if (!device.pending) {
                this.button(root, mode === 'room' ? 'Enable camera' : 'Camera + microphone', 8, 65, 84, 9,
                    () => this.enable(id), C.teal);
                if (mode === 'remote') this.button(root, 'Microphone only', 8, 76, 84, 8,
                    () => this.enable(id, false), C.pale);
            }
            this.lines(root, device.notice, 8, 86, 83, 2.9, C.muted, 2);
        }
        this.button(root, device.settingsOpen ? 'Done' : device.stream ? 'Camera ready' : 'Camera & sound',
            6, 94, 88, 6, () => { device.settingsOpen = !device.settingsOpen; this.render(); },
            device.settingsOpen ? C.pale : C.paper, 2.6);
    }
    renderFinal() {
        this.text(this.shared, 'Nice show!', 50, 21, 7, C.ink, 'center');
        const ranked = Array.from(this.rules.people).filter(([id]) => this.rules.roster.includes(id))
            .sort((a, b) => b[1].score - a[1].score);
        ranked.forEach(([id, person], i) => {
            const y = 37 + i * 7;
            const rank = ranked.findIndex(([, p]) => p.score === person.score) + 1;
            this.rect(this.shared, 6, y - 0.5, 88, 5.8, rank === 1 ? C.gold : C.pale);
            this.text(this.shared, `${rank}. ${person.name}`, 10, y + 0.7, 3.5);
            this.text(this.shared, String(person.score), 89, y + 0.7, 3.5, C.ink, 'right');
        });
    }
    finalControls(root, id) {
        if (id === this.rules.hostId) this.button(root, 'Play again', 6, 83, 88, 9,
            () => this.change(() => this.rules.advance(id)), C.teal, 3.5);
        else this.text(root, 'Waiting for the host', 50, 87, 3.2, C.muted, 'center');
    }
    syncStage() {
        const d = this.devices.get(this.rules.current?.performerId);
        const stream = this.rules.phase === 'perform' && d?.transmitting ? d.stream : null;
        if (stream === this.stageStream) return;
        this.stage.clearChildren(); this.stageStream = stream; this.stageNode = null;
        if (stream && GameNode.Stream) {
            this.stageNode = new GameNode.Stream({ streamId: stream,
                pos: { x: 6, y: 18 }, size: { x: d.video ? 88 : 0, y: d.video ? 39.6 : 0 },
                audio: this.rules.mode === 'remote' });
            this.stage.addChild(this.stageNode);
        }
    }
    tick() {
        if (this.closed) return;
        const before = `${this.rules.phase}:${this.rules.roundNumber}`;
        if (!this.rules.tick()) return;
        if (before !== `${this.rules.phase}:${this.rules.roundNumber}`) {
            for (const device of this.devices.values()) { device.settingsOpen = false; device.hintOpen = false; }
            this.applause.clear(); this.silenceInactive(); this.render();
        } else this.setText(this.timer, this.timerLabel());
    }
    getLayers() { return [{ root: this.base }]; }
    close() {
        this.closed = true; this.unsubscribe?.();
        for (const device of this.devices.values()) if (device.stream) this.media?.stop(device.stream);
        super.close();
    }
}

module.exports = Showboat;
