const { Game, GameNode, Shapes, ShapeUtils } = require('squish-145');
const INK = [233, 244, 230, 255], MUTED = [154, 178, 161, 255];

class WalkieTalkie extends Game {
    static metadata() {
        return { name: 'Walkie Talkie', author: 'Joseph Garcia', squishVersion: '145',
            aspectRatio: { x: 4, y: 5 }, isTest: true, services: ['multiplayer'], maxPlayers: 6 };
    }
    constructor({ media }) {
        super(); this.media = media; this.people = new Map(); this.speaker = null;
        this.base = this.shape(0, 0, 100, 100, [19, 32, 29, 255]);
        this.text('WALKIE TALKIE', 50, 4, 4, this.base);
        this.audienceLabel = this.text('One podium. Everyone tuned in.', 50, 12, 1.9, this.base, MUTED);
        this.podium = this.shape(6, 18, 88, 46, [11, 22, 19, 255]); this.base.addChild(this.podium);
        this.stageTitle = this.text('The podium is open', 50, 34, 4, this.podium);
        this.stageHint = this.text('Hold below to claim the broadcast', 50, 44, 2.2, this.podium, MUTED);
        this.speakerLabel = this.text('First to hold gets the podium', 50, 67, 2.5, this.base);
        this.unsubscribe = media.onChange(info => this.mediaChanged(info));
    }
    shape(x, y, w, h, fill, extra = {}) {
        return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(x, y, w, h), fill, ...extra });
    }
    text(text, x, y, size, parent, color = INK) {
        const node = new GameNode.Text({ textInfo: { text, x, y, size, align: 'center', color } });
        parent.addChild(node); return node;
    }
    setText(node, text) {
        if (node.node.text.text === text) return;
        node.node.text.text = text; node.node.onStateChange();
    }
    button(parent, label, x, y, w, h, onClick, offClick, fill = [43, 68, 59, 255], size = 2.4) {
        const button = this.shape(x, y, w, h, fill, { onClick, offClick }); parent.addChild(button);
        button.label = this.text(label, x + w / 2, y + h / 2 - size / 2, size, parent); return button;
    }
    handleNewPlayer({ playerId, info }) {
        const controls = this.shape(0, 0, 0, 0, null, { playerIds: [playerId] }); this.base.addChild(controls);
        const person = { name: (info?.name || `Player ${playerId}`).slice(0, 18), controls, holds: new Set() };
        this.people.set(playerId, person);
        person.status = this.text('', 50, 72, 2, controls, MUTED);
        person.talk = this.button(controls, 'HOLD TO CLAIM PODIUM', 13, 77, 74, 11,
            id => { if (id === playerId) this.talk(id); },
            id => { if (id === playerId) this.release(id, 'pointer'); }, [92, 114, 53, 255], 2.8);
        this.button(controls, 'Enable microphone', 8, 90, 40, 7, id => { if (id === playerId) this.enable(id, false); }, null, undefined, 2);
        this.button(controls, 'Camera + microphone', 52, 90, 40, 7, id => { if (id === playerId) this.enable(id, true); }, null, undefined, 2);
        this.renderPodium();
    }
    async enable(id, video) {
        const person = this.people.get(id);
        if (!person || person.pending) return;
        if (person.stream) { person.notice = 'Disconnect your current microphone / camera first'; this.renderPodium(); return; }
        person.pending = true; person.notice = 'Approve microphone / camera on your device'; this.renderPodium();
        try {
            await this.media.request(id, { audio: true, video, transmitting: false, pushToTalk: true });
        } catch (error) { if (this.people.get(id) === person) person.notice = error.message; }
        finally { person.pending = false; this.renderPodium(); }
    }
    mediaChanged(info) {
        const person = this.people.get(info.playerId);
        if (!person) return;
        if (info.state === 'ended') {
            if (person.stream === info.id) person.stream = null;
            if (this.speaker === info.playerId) this.speaker = null;
            person.notice = 'Microphone / camera disconnected';
        } else {
            person.stream = info.id; person.video = info.video;
            if (!info.transmitting && this.speaker === info.playerId) this.speaker = null;
            person.notice = null;
        }
        this.renderPodium();
    }
    talk(id, input = 'pointer') {
        const person = this.people.get(id);
        if (!person) return;
        const alreadyHeld = person.holds.has(input); person.holds.add(input);
        // A busy press is not a queue entry. Key repeats cannot grab the podium
        // when it opens later; the player must release and make a fresh press.
        if (alreadyHeld) return;
        if (this.speaker === id) return;
        if (this.speaker !== null) {
            person.notice = null; person.blocked = true;
            this.renderPodium(); return;
        }
        if (!person.stream) { this.enable(id, false); return; }
        person.notice = null;
        this.speaker = id; this.speakerInput = input;
        this.media.setTransmitting(person.stream, true); this.renderPodium();
    }
    release(id, input) {
        const person = this.people.get(id);
        if (!person) return;
        if (input) person.holds.delete(input); else person.holds.clear();
        if (this.speaker !== id) {
            if (!person.holds.size && person.blocked) { person.blocked = false; this.renderPodium(); }
            return;
        }
        // Release the control that claimed the podium, even if a different
        // control is still held. A fresh mouse press can follow Space without
        // waiting for the client's keyup debounce to arrive.
        if (input && input !== this.speakerInput) return;
        this.speaker = null; this.media.setTransmitting(person.stream, false); this.renderPodium();
    }
    handleMouseUp(id) { this.release(id, 'pointer'); }
    handleKeyDown(id, key) { if (key === ' ') this.talk(id, 'space'); }
    handleKeyUp(id, key) { if (key === ' ') this.release(id, 'space'); }
    handlePlayerDisconnect(id) {
        this.release(id); const person = this.people.get(id);
        if (person) this.base.removeChild(person.controls.id);
        this.people.delete(id); this.renderPodium();
    }
    renderPodium() {
        const speaker = this.people.get(this.speaker);
        const stream = speaker?.stream || null;
        this.setText(this.audienceLabel, `${this.people.size} connected. One shared broadcast.`);
        this.setText(this.speakerLabel, speaker ? `${speaker.name} has the podium` : 'First to hold gets the podium');
        this.setText(this.stageTitle, !speaker ? 'The podium is open' : speaker.video ? '' : speaker.name);
        this.setText(this.stageHint, !speaker ? 'Hold below to claim the broadcast' : speaker.video ? '' : 'LIVE AUDIO');
        // Only the current broadcast is in the shared scene. Keep its node
        // stable through other players' joins, permission prompts and presses.
        if (this.podiumStream !== stream) {
            if (this.podiumNode) this.podium.removeChild(this.podiumNode.id);
            this.podiumStream = stream; this.podiumNode = null;
            if (stream) {
                this.podiumNode = new GameNode.Stream({ streamId: stream,
                    pos: { x: 6, y: 21.2 }, size: { x: speaker.video ? 88 : 0, y: speaker.video ? 39.6 : 0 }, audio: true });
                this.podium.addChild(this.podiumNode);
            }
        }
        for (const [id, person] of this.people) {
            const own = this.speaker === id;
            this.setText(person.talk.label, own ? 'LIVE - RELEASE TO FINISH' : speaker ? 'PODIUM OCCUPIED' : 'HOLD TO CLAIM PODIUM');
            const fill = own ? [142, 60, 42, 255] : speaker ? [43, 68, 59, 255] : [92, 114, 53, 255];
            if (String(person.talk.node.fill) !== String(fill)) { person.talk.node.fill = fill; person.talk.node.onStateChange(); }
            this.setText(person.status, person.notice || (own ? 'Everyone is tuned in to you' : person.blocked ? 'Release, then press again when the podium is open.' : speaker ? 'Listen now. Claim the podium when it opens.' : person.stream ? 'Ready. Hold the button or Space to broadcast.' : 'Choose microphone or camera below to get ready.'));
        }
    }
    getLayers() { return [{ root: this.base }]; }
    close() { this.unsubscribe?.(); super.close(); }
}
module.exports = WalkieTalkie;
