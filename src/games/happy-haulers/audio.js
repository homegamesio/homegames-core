const { Asset, GameNode } = require('squish-150');

const SAMPLE_RATE = 16000;
const PITCHES = [261.63, 329.63, 392, 440, 523.25, 659.25];
const PLINK_SECONDS = .46;
const CELEBRATION_SECONDS = 1.5;

// Original, quiet PCM sounds: a soft attack and a complete fade avoid clicks.
// Typed arrays keep generation identical in browsers and hosted sessions.
function wave(duration, sample) {
    const count = Math.ceil(duration * SAMPLE_RATE);
    const bytes = new Uint8Array(44 + count * 2);
    const view = new DataView(bytes.buffer);
    const text = (value, offset) => {
        for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i);
    };
    text('RIFF', 0); view.setUint32(4, bytes.length - 8, true);
    text('WAVEfmt ', 8); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, SAMPLE_RATE * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text('data', 36); view.setUint32(40, count * 2, true);
    for (let i = 0; i < count; i++) {
        const value = i === count - 1 ? 0 : sample(i / SAMPLE_RATE);
        view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, value)) * 32767), true);
    }
    return bytes;
}

function tone(frequency, time, duration) {
    if (time <= 0 || time >= duration) return 0;
    const attack = Math.min(1, time / .018);
    const envelope = attack * Math.pow(1 - time / duration, 2);
    const phase = time * frequency * Math.PI * 2;
    return (Math.sin(phase) + .16 * Math.sin(phase * 2)) * envelope / 1.16;
}

class HaulerAudio {
    constructor(root) {
        this.root = root;
        this.assets = {};
        this.voices = [];
        this.time = 0;
        this.closed = false;
        PITCHES.forEach((frequency, index) => {
            const bytes = wave(PLINK_SECONDS, time => tone(frequency, time, PLINK_SECONDS) * .052);
            // The renderer deduplicates by asset key. Alternating keys allows
            // another tap while the previous note is still fading away.
            for (let copy = 0; copy < 2; copy++) this.add(index, copy, bytes, PLINK_SECONDS);
        });
        const melody = [PITCHES[0], PITCHES[2], PITCHES[3], PITCHES[5]];
        this.add('celebrate', 0, wave(CELEBRATION_SECONDS, time => {
            let value = 0;
            melody.forEach((frequency, index) => {
                value += tone(frequency, time - index * .25, index === 3 ? .75 : .5) * .045;
            });
            return value;
        }), CELEBRATION_SECONDS);
    }

    add(name, copy, bytes, duration) {
        const key = `happy_haulers_${name}_${copy}`;
        const node = new GameNode.Asset({ assetInfo: {} });
        node.node.asset = undefined;
        this.assets[key] = new Asset({ id: key, type: 'audio' }, bytes);
        this.voices.push({ key, name, node, duration, until: 0, readyAt: 0, active: false });
    }

    play(index) {
        if (this.closed) return false;
        // Keep busy little hands from building a loud stack of sounds.
        if (index !== 'celebrate' && this.voices.filter(voice => voice.active).length >= 4) return false;
        const voice = this.voices.find(candidate => candidate.name === index && !candidate.active && candidate.readyAt <= this.time);
        if (!voice) return false;
        voice.active = true;
        voice.until = this.time + voice.duration;
        voice.node.node.asset = { [voice.key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } };
        this.sync();
        return true;
    }

    tick(dt) {
        if (this.closed) return false;
        this.time += Number.isFinite(dt) && dt > 0 ? dt : 0;
        let changed = false;
        for (const voice of this.voices) {
            if (!voice.active || voice.until > this.time) continue;
            voice.active = false;
            voice.node.node.asset = undefined;
            // Leave the key absent for rendered frames before reusing it.
            voice.readyAt = this.time + .1;
            changed = true;
        }
        if (changed) this.sync();
        return changed;
    }

    sync() {
        this.root.node.children = this.voices.filter(voice => voice.active).map(voice => voice.node);
        this.root.node.onStateChange();
    }

    mute() {
        const changed = this.voices.some(voice => voice.active);
        for (const voice of this.voices) {
            if (voice.active) voice.readyAt = this.time + .1;
            voice.active = false;
            voice.node.node.asset = undefined;
        }
        if (changed) this.sync();
        return changed;
    }

    close() {
        this.mute();
        this.closed = true;
    }
}

module.exports = { HaulerAudio };
