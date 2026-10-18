const MAX_PLAYERS = 8;
const CLIP_SECONDS = 30;
const clean = (value, limit) => String(value || '').replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
const shuffle = (items, random = Math.random) => {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

class PitchRules {
    constructor() {
        this.people = new Map(); this.hostId = null; this.phase = 'lobby';
        this.round = 0; this.entries = new Map(); this.votes = new Map(); this.order = [];
    }
    join(id, name) {
        if (this.people.has(id) || this.people.size >= MAX_PLAYERS) return false;
        this.people.set(id, { name: clean(name, 24) || `Player ${id}` });
        if (this.hostId === null) this.hostId = id;
        return true;
    }
    leave(id) {
        this.people.delete(id);
        if (this.hostId === id) this.hostId = this.people.keys().next().value ?? null;
        const entry = this.entries.get(id);
        if (entry) entry.connected = false;
        if (this.phase === 'write') {
            this.entries.delete(id);
            if (this.entries.size < 2) { this.phase = 'lobby'; this.entries.clear(); }
            else this.dealIfReady();
        } else if (this.phase === 'record') {
            if (entry && !entry.clip) entry.skipped = true;
            this.screenIfReady();
        } else if (this.phase === 'vote') {
            this.votes.delete(id); this.finishIfVoted();
        }
        if (!this.people.size) { this.phase = 'lobby'; this.entries.clear(); this.order = []; this.votes.clear(); }
    }
    start(id) {
        if (id !== this.hostId || !['lobby', 'results'].includes(this.phase) || this.people.size < 2) return false;
        this.round++; this.phase = 'write'; this.votes.clear(); this.order = []; this.index = -1;
        this.entries = new Map([...this.people].map(([id, player]) => [id, {
            id, name: player.name, connected: true, idea: '', assignment: null, clip: null, skipped: false,
        }]));
        return true;
    }
    submit(id, text) {
        const entry = this.entries.get(id), idea = clean(text, 90);
        if (this.phase !== 'write' || !entry?.connected || entry.idea || !idea) return false;
        entry.idea = idea; this.dealIfReady(); return true;
    }
    dealIfReady() {
        if (this.entries.size < 2 || [...this.entries.values()].some(entry => !entry.idea)) return;
        // A random cycle uses every idea exactly once and has no fixed points.
        const ring = shuffle([...this.entries.values()]);
        ring.forEach((entry, i) => {
            const author = ring[(i + 1) % ring.length];
            entry.assignment = { idea: author.idea, authorId: author.id, authorName: author.name };
        });
        this.phase = 'record';
    }
    acceptClip(id, key) {
        const entry = this.entries.get(id);
        if (this.phase !== 'record' || !entry?.connected || entry.clip || entry.skipped) return false;
        entry.clip = key; this.screenIfReady(); return true;
    }
    skip(id) {
        const entry = this.entries.get(id);
        if (this.phase !== 'record' || !entry?.connected || entry.clip || entry.skipped) return false;
        entry.skipped = true; this.screenIfReady(); return true;
    }
    screenIfReady() {
        if ([...this.entries.values()].some(entry => !entry.clip && !entry.skipped)) return;
        this.order = shuffle([...this.entries.values()].filter(entry => entry.clip).map(entry => entry.id));
        this.index = -1; this.phase = this.order.length ? 'screen' : 'results';
    }
    get current() { return this.entries.get(this.order[this.index]); }
    advance(id, now = Date.now()) {
        if (id !== this.hostId || this.phase !== 'screen' || (this.index >= 0 && now < this.deadline)) return false;
        this.index++;
        if (this.index >= this.order.length) { this.phase = 'vote'; this.deadline = now + 45000; this.finishIfVoted(); }
        else this.deadline = now + CLIP_SECONDS * 1000;
        return true;
    }
    replay(id, now = Date.now()) {
        if (id !== this.hostId || this.phase !== 'screen' || !this.current || now < this.deadline) return false;
        this.deadline = now + CLIP_SECONDS * 1000; return true;
    }
    voters() {
        return [...this.entries.values()].filter(entry => entry.connected && this.order.some(id => id !== entry.id));
    }
    vote(id, target) {
        if (this.phase !== 'vote' || this.votes.has(id) || id === target
            || !this.voters().some(entry => entry.id === id) || !this.order.includes(target)) return false;
        this.votes.set(id, target); this.finishIfVoted(); return true;
    }
    finishIfVoted() {
        if (this.voters().every(entry => this.votes.has(entry.id))) this.phase = 'results';
    }
    tick(now = Date.now()) {
        if (this.phase === 'vote' && now >= this.deadline) { this.phase = 'results'; return true; }
        return false;
    }
    results() {
        return this.order.map(id => ({ ...this.entries.get(id), votes: [...this.votes.values()].filter(target => target === id).length }))
            .sort((a, b) => b.votes - a.votes);
    }
}
module.exports = { PitchRules, CLIP_SECONDS, MAX_PLAYERS, clean };
