// Generates the Homegames stock sound catalog: UI/feedback SFX, action SFX,
// and seamless ambient/music loops. All sounds are synthesized from scratch
// (original works — safe to publish CC0).
//
// Usage: node tools/sound-catalog/generate.js [output-dir]
// Default output: tools/sound-catalog/output/

const fs = require('fs');
const path = require('path');
const {
    SR, TAU, makeRng, render, osc,
    whiteNoise, pinkNoise, brownNoise,
    onePoleLP, onePoleHP, svfBandPass,
    expDecay, adsr, fadeWindow,
    mixAt, mixWrap, gainBuf, normalize, softClip, echo, echoWrap, makeLoop,
    mtof, sequence, writeWav
} = require('./synth');

// ---------------------------------------------------------------------------
// voices / building blocks
// ---------------------------------------------------------------------------

// Simple pitch sweep tone with exponential amplitude decay.
const chirp = (type, f0, f1, dur, decayRate) => {
    const o = osc(type, (t) => f0 + (f1 - f0) * Math.min(1, t / dur));
    const env = expDecay(decayRate);
    return render(dur, (t) => o(t) * env(t));
};

// Bell/marimba-ish pluck: fundamental + soft overtone, exp decay.
const pluck = (freq, dur, decayRate = 6, overtoneGain = 0.35) => {
    const o1 = osc('sine', freq);
    const o2 = osc('sine', freq * 2.01);
    const o3 = osc('sine', freq * 3.02);
    const env = expDecay(decayRate);
    return render(dur, (t) =>
        (o1(t) + o2(t) * overtoneGain + o3(t) * overtoneGain * 0.3) * env(t) * Math.min(1, t / 0.004));
};

// Chiptune square voice with a touch of vibrato.
const chipVoice = (freq, dur) => {
    const o = osc('square', (t) => freq * (1 + 0.004 * Math.sin(TAU * 6 * t)));
    const env = adsr(0.008, 0.04, 0.65, 0.04, dur);
    return render(dur, (t) => o(t) * env(t) * 0.5);
};

const triVoice = (freq, dur) => {
    const o = osc('triangle', freq);
    const env = adsr(0.01, 0.03, 0.8, 0.06, dur);
    return render(dur, (t) => o(t) * env(t));
};

const softSine = (freq, dur) => {
    const o = osc('sine', freq);
    const o2 = osc('sine', freq * 2);
    const env = adsr(0.02, 0.1, 0.5, Math.min(0.3, dur / 3), dur);
    return render(dur, (t) => (o(t) + 0.25 * o2(t)) * env(t));
};

// Filtered noise burst; cutoff sweeps c0 -> c1.
const noiseBurst = (dur, c0, c1, decayRate, seed = 7, noiseKind = 'white') => {
    const rng = makeRng(seed);
    const src = noiseKind === 'brown' ? brownNoise(rng)
        : noiseKind === 'pink' ? pinkNoise(rng) : whiteNoise(rng);
    const lp = onePoleLP((t) => c0 + (c1 - c0) * Math.min(1, t / dur));
    const env = expDecay(decayRate);
    return render(dur, (t) => lp(src(), t) * env(t));
};

// Short percussive click through a band-pass (ball clacks, wood ticks).
const click = (dur, center, q, decayRate, seed = 3) => {
    const rng = makeRng(seed);
    const noise = whiteNoise(rng);
    const bp = svfBandPass(center, q);
    const env = expDecay(decayRate);
    return render(dur, (t) => bp(noise(), t) * env(t));
};

const kick = () => {
    const o = osc('sine', (t) => 110 * Math.exp(-t * 16) + 42);
    const env = expDecay(15);
    return render(0.22, (t) => o(t) * env(t));
};

const hat = (seed = 11, decayRate = 90) => {
    const rng = makeRng(seed);
    const noise = whiteNoise(rng);
    const hp = onePoleHP(6500);
    const env = expDecay(decayRate);
    return render(0.06, (t) => hp(noise(), t) * env(t));
};

const snare = (seed = 13) => {
    const rng = makeRng(seed);
    const noise = whiteNoise(rng);
    const bp = svfBandPass(1800, 0.9);
    const tone = osc('sine', 190);
    const env = expDecay(24);
    return render(0.2, (t) => (bp(noise(), t) * 0.8 + tone(t) * 0.4) * env(t));
};

// Detuned saw pad (looping texture voice). Returns fn(t) for makeLoop.
const padChordFn = (midis, cutoffFn, seed = 1, detune = 0.004) => {
    const rng = makeRng(seed);
    const voices = [];
    for (const m of midis) {
        const f = mtof(m);
        for (let k = 0; k < 3; k++) {
            voices.push(osc('saw', f * (1 + (rng() * 2 - 1) * detune)));
        }
    }
    const lp = onePoleLP(cutoffFn);
    const g = 1 / voices.length;
    return (t) => {
        let s = 0;
        for (const v of voices) s += v(t);
        return lp(s * g, t);
    };
};

// Wandering band-passed noise (wind). Returns fn(t).
const windFn = (seed, base = 500, depth = 320, rate = 0.09) => {
    const rng = makeRng(seed);
    const noise = whiteNoise(rng);
    const bp = svfBandPass(
        (t) => base + depth * Math.sin(TAU * rate * t + 1.3) + 130 * Math.sin(TAU * rate * 2.63 * t),
        1.2
    );
    return (t) => bp(noise(), t) * (0.7 + 0.3 * Math.sin(TAU * rate * 1.71 * t + 0.5));
};

const dripSound = (f0 = 620, f1 = 1500) => {
    const o = osc('sine', (t) => f0 + (f1 - f0) * Math.min(1, t / 0.09));
    const env = expDecay(28);
    return render(0.14, (t) => o(t) * env(t) * Math.min(1, t / 0.003));
};

const bubbleSound = (f0 = 320, f1 = 820, dur = 0.07) => {
    const o = osc('sine', (t) => f0 + (f1 - f0) * (t / dur));
    const env = expDecay(30);
    return render(dur, (t) => o(t) * env(t) * Math.min(1, t / 0.004));
};

// ---------------------------------------------------------------------------
// catalog
// ---------------------------------------------------------------------------
// Each entry: build() -> Float32Array (mono) or [L, R] (stereo).
// peak: normalization target. loop: seamless-loop flag for the manifest.

const LOOP_DUR = 24;
const LOOP_WRAP = 3;

const sounds = {

    // ----- UI -----

    'ui-click': {
        desc: 'Short neutral tap for buttons', tags: ['ui'],
        build: () => chirp('sine', 1900, 900, 0.07, 55)
    },

    'ui-tick': {
        desc: 'Tiny tick for hover/scroll/selection movement', tags: ['ui'],
        build: () => click(0.045, 2600, 2.5, 90)
    },

    'ui-select': {
        desc: 'Two-note confirm blip (up)', tags: ['ui'],
        build: () => {
            const out = new Float32Array(Math.round(0.3 * SR));
            mixAt(out, pluck(660, 0.15, 14), 0, 0.8);
            mixAt(out, pluck(880, 0.2, 12), 0.08, 0.9);
            return out;
        }
    },

    'ui-back': {
        desc: 'Two-note cancel blip (down)', tags: ['ui'],
        build: () => {
            const out = new Float32Array(Math.round(0.3 * SR));
            mixAt(out, pluck(740, 0.15, 14), 0, 0.85);
            mixAt(out, pluck(520, 0.2, 12), 0.08, 0.85);
            return out;
        }
    },

    'ui-error': {
        desc: 'Soft error buzz', tags: ['ui'],
        build: () => {
            const o = osc('square', 145);
            const lp = onePoleLP(900);
            const env = fadeWindow(0.01, 0.06, 0.28);
            return render(0.28, (t) => lp(o(t), t) * env(t) * (0.75 + 0.25 * Math.sin(TAU * 22 * t)));
        }
    },

    'ui-notify': {
        desc: 'Gentle two-tone notification ding', tags: ['ui'],
        build: () => {
            const out = new Float32Array(Math.round(0.9 * SR));
            mixAt(out, pluck(660, 0.5, 6), 0, 0.8);
            mixAt(out, pluck(990, 0.7, 5), 0.12, 0.9);
            return out;
        }
    },

    'countdown-beep': {
        desc: 'Single countdown beep (3... 2... 1...)', tags: ['ui', 'timer'],
        build: () => {
            const o = osc('sine', 620);
            const env = fadeWindow(0.005, 0.03, 0.14);
            return render(0.14, (t) => o(t) * env(t));
        }
    },

    'countdown-go': {
        desc: 'Higher, longer "GO!" beep to end a countdown', tags: ['ui', 'timer'],
        build: () => {
            const o = osc('sine', 930);
            const o2 = osc('sine', 1240);
            const env = fadeWindow(0.005, 0.2, 0.5);
            return render(0.5, (t) => (o(t) + 0.4 * o2(t)) * env(t));
        }
    },

    'timer-tick': {
        desc: 'Clock tick for countdowns/turn timers', tags: ['ui', 'timer'],
        build: () => click(0.05, 1900, 3, 110, 5)
    },

    'timer-tock': {
        desc: 'Lower counterpart to timer-tick', tags: ['ui', 'timer'],
        build: () => click(0.055, 1250, 3, 95, 9)
    },

    // ----- feedback / scoring -----

    'success-chime': {
        desc: 'Ascending three-note success arpeggio', tags: ['feedback', 'win'],
        build: () => {
            const out = new Float32Array(Math.round(1.1 * SR));
            mixAt(out, pluck(523.25, 0.6, 6), 0, 0.8);     // C5
            mixAt(out, pluck(659.25, 0.6, 6), 0.09, 0.8);  // E5
            mixAt(out, pluck(783.99, 0.8, 5), 0.18, 0.9);  // G5
            return echo(out, 0.14, 0.3, 0.22);
        }
    },

    'win-fanfare': {
        desc: 'Big game-over victory fanfare', tags: ['feedback', 'win'],
        build: () => {
            const out = new Float32Array(Math.round(1.9 * SR));
            const v = (f, d) => {
                const a = triVoice(f, d);
                const b = chipVoice(f, d);
                const m = new Float32Array(a.length);
                mixAt(m, a, 0, 0.7);
                mixAt(m, b, 0, 0.5);
                return m;
            };
            mixAt(out, v(523.25, 0.14), 0.0);
            mixAt(out, v(523.25, 0.14), 0.16);
            mixAt(out, v(783.99, 0.3), 0.32);
            for (const f of [523.25, 659.25, 783.99, 1046.5]) {
                mixAt(out, v(f, 0.9), 0.66, 0.8);
            }
            return echo(out, 0.16, 0.3, 0.2);
        }
    },

    'fail-notes': {
        desc: 'Three sad descending notes', tags: ['feedback', 'lose'],
        build: () => {
            const out = new Float32Array(Math.round(1.2 * SR));
            const lpv = (f, d, at, g) => {
                const o = osc('square', f);
                const lp = onePoleLP(1100);
                const env = adsr(0.01, 0.05, 0.7, 0.06, d);
                mixAt(out, render(d, (t) => lp(o(t), t) * env(t)), at, g);
            };
            lpv(329.63, 0.2, 0, 0.7);    // E4
            lpv(261.63, 0.2, 0.24, 0.7); // C4
            lpv(220.0, 0.55, 0.48, 0.8); // A3
            return out;
        }
    },

    'lose-womp': {
        desc: 'Cartoon trombone-ish "womp womp" pitch fall', tags: ['feedback', 'lose'],
        build: () => {
            const out = new Float32Array(Math.round(1.3 * SR));
            const womp = (f0, f1, dur) => {
                const o = osc('saw', (t) => f0 + (f1 - f0) * (t / dur));
                const lp = onePoleLP(850);
                const env = fadeWindow(0.02, 0.1, dur);
                return render(dur, (t) => lp(o(t), t) * env(t));
            };
            mixAt(out, womp(255, 165, 0.4), 0, 0.9);
            mixAt(out, womp(195, 88, 0.65), 0.5, 0.9);
            return out;
        }
    },

    'coin': {
        desc: 'Classic two-note coin pickup', tags: ['feedback', 'pickup'],
        build: () => {
            const out = new Float32Array(Math.round(0.6 * SR));
            const v = (f, d) => {
                const o = osc('square', f);
                const s = osc('sine', f);
                const env = expDecay(7);
                return render(d, (t) => (o(t) * 0.35 + s(t) * 0.65) * env(t));
            };
            mixAt(out, v(987.77, 0.09), 0);        // B5
            mixAt(out, v(1318.51, 0.5), 0.085);    // E6
            return out;
        }
    },

    'point': {
        desc: 'Single bright point/score blip', tags: ['feedback', 'pickup'],
        build: () => pluck(1174.66, 0.3, 12)
    },

    'powerup': {
        desc: 'Six-note rising power-up arpeggio', tags: ['feedback', 'pickup'],
        build: () => {
            const out = new Float32Array(Math.round(0.9 * SR));
            const notes = [72, 76, 79, 84, 88, 91]; // C5 E5 G5 C6 E6 G6
            notes.forEach((n, i) => mixAt(out, chipVoice(mtof(n), 0.09), i * 0.07, 0.9));
            mixAt(out, pluck(mtof(96), 0.4, 8), notes.length * 0.07, 0.7);
            return echo(out, 0.1, 0.3, 0.2);
        }
    },

    'powerdown': {
        desc: 'Descending power-down / debuff arpeggio', tags: ['feedback'],
        build: () => {
            const out = new Float32Array(Math.round(0.8 * SR));
            const notes = [84, 79, 76, 72, 67, 64];
            notes.forEach((n, i) => mixAt(out, chipVoice(mtof(n), 0.09), i * 0.07, 0.85));
            return out;
        }
    },

    'level-up': {
        desc: 'Layered level-up flourish (bigger than powerup)', tags: ['feedback', 'win'],
        build: () => {
            const out = new Float32Array(Math.round(1.5 * SR));
            const notes = [60, 64, 67, 72, 76, 79, 84];
            notes.forEach((n, i) => {
                mixAt(out, chipVoice(mtof(n), 0.11), i * 0.08, 0.7);
                mixAt(out, pluck(mtof(n + 12), 0.3, 9), i * 0.08, 0.35);
            });
            mixAt(out, pluck(mtof(88), 0.7, 5), notes.length * 0.08, 0.8);
            return echo(out, 0.13, 0.32, 0.25);
        }
    },

    'correct': {
        desc: 'Warm "correct answer" ding (word/trivia games)', tags: ['feedback', 'win'],
        build: () => {
            const out = new Float32Array(Math.round(0.8 * SR));
            mixAt(out, pluck(880, 0.6, 6, 0.25), 0, 0.9);
            mixAt(out, pluck(1108.73, 0.6, 6, 0.25), 0.07, 0.7); // C#6 -> major third shimmer
            return out;
        }
    },

    'wrong': {
        desc: 'Double low buzz for wrong answers', tags: ['feedback', 'lose'],
        build: () => {
            const buzz = () => {
                const o = osc('square', 130);
                const o2 = osc('square', 131.5);
                const lp = onePoleLP(750);
                const env = fadeWindow(0.008, 0.04, 0.16);
                return render(0.16, (t) => lp(o(t) + o2(t), t) * 0.5 * env(t));
            };
            const out = new Float32Array(Math.round(0.5 * SR));
            mixAt(out, buzz(), 0);
            mixAt(out, buzz(), 0.21);
            return out;
        }
    },

    'streak-riser': {
        desc: 'One-second riser for combos/streaks/round-start build-up', tags: ['feedback'],
        build: () => {
            const rng = makeRng(21);
            const noise = whiteNoise(rng);
            const lp = onePoleLP((t) => 350 + 3800 * t);
            const o = osc('square', (t) => 190 + 640 * t * t);
            const env = fadeWindow(0.05, 0.02, 1.0);
            return render(1.0, (t) => (lp(noise(), t) * 0.7 + o(t) * 0.25 * t) * env(t));
        }
    },

    // ----- action -----

    'jump': {
        desc: 'Rising jump sweep', tags: ['action'],
        build: () => {
            const o = osc('square', (t) => 165 + 520 * Math.min(1, t / 0.22));
            const env = expDecay(9);
            return render(0.3, (t) => o(t) * env(t) * Math.min(1, t / 0.006));
        }
    },

    'land': {
        desc: 'Soft landing thud', tags: ['action'],
        build: () => {
            const out = new Float32Array(Math.round(0.28 * SR));
            mixAt(out, noiseBurst(0.16, 500, 140, 22, 31, 'brown'), 0, 0.9);
            mixAt(out, chirp('sine', 96, 52, 0.16, 18), 0, 0.8);
            return out;
        }
    },

    'hit': {
        desc: 'Generic impact/damage hit', tags: ['action'],
        build: () => {
            const out = new Float32Array(Math.round(0.22 * SR));
            mixAt(out, chirp('sine', 185, 55, 0.15, 22), 0, 0.9);
            mixAt(out, noiseBurst(0.05, 4500, 900, 60, 17), 0, 0.5);
            return out;
        }
    },

    'punch': {
        desc: 'Bigger punchy impact (slaps!)', tags: ['action'],
        build: () => {
            const out = new Float32Array(Math.round(0.35 * SR));
            mixAt(out, chirp('sine', 220, 48, 0.25, 14), 0, 1.0);
            mixAt(out, noiseBurst(0.09, 3800, 500, 35, 41), 0, 0.7);
            mixAt(out, click(0.03, 2800, 1.5, 120, 43), 0, 0.5);
            return softClip(out, 1.6);
        }
    },

    'laser-small': {
        desc: 'Quick pew laser (doodle-invaders style)', tags: ['action', 'space'],
        build: () => {
            const o = osc('square', (t) => 1750 * Math.exp(-t * 14) + 240);
            const s = osc('sine', (t) => 1750 * Math.exp(-t * 14) + 240);
            const env = expDecay(14);
            return render(0.22, (t) => (o(t) * 0.4 + s(t) * 0.6) * env(t) * Math.min(1, t / 0.004));
        }
    },

    'laser-big': {
        desc: 'Heavier laser blast with sub', tags: ['action', 'space'],
        build: () => {
            const o = osc('saw', (t) => 820 * Math.exp(-t * 7) + 70);
            const sub = osc('sine', (t) => 130 * Math.exp(-t * 5) + 38);
            const lp = onePoleLP(3400);
            const env = expDecay(6);
            const out = render(0.55, (t) => (lp(o(t), t) * 0.6 + sub(t) * 0.5) * env(t) * Math.min(1, t / 0.005));
            return softClip(out, 1.4);
        }
    },

    'zap': {
        desc: 'Electric zap (zap-tap!)', tags: ['action'],
        build: () => {
            const rng = makeRng(55);
            const o = osc('square', () => 700 + rng() * 900);
            const env = expDecay(28);
            return render(0.15, (t) => o(t) * env(t) * Math.min(1, t / 0.003));
        }
    },

    'explosion-small': {
        desc: 'Short explosion pop', tags: ['action'],
        build: () => {
            const out = noiseBurst(0.6, 5200, 160, 8, 61);
            mixAt(out, chirp('sine', 130, 45, 0.3, 10), 0, 0.6);
            return softClip(out, 1.5);
        }
    },

    'explosion-big': {
        desc: 'Big rumbling explosion', tags: ['action'],
        build: () => {
            const out = new Float32Array(Math.round(2.1 * SR));
            mixAt(out, noiseBurst(2.0, 3300, 70, 2.6, 71, 'brown'), 0, 1.0);
            mixAt(out, noiseBurst(0.4, 6000, 800, 12, 73), 0, 0.7);
            mixAt(out, chirp('sine', 62, 30, 1.4, 2.5), 0.02, 0.9);
            return softClip(out, 1.7);
        }
    },

    'whoosh': {
        desc: 'Air whoosh for swipes/throws/transitions', tags: ['action'],
        build: () => {
            const rng = makeRng(81);
            const noise = pinkNoise(rng);
            const dur = 0.6;
            const bp = svfBandPass((t) => 280 + 2400 * Math.sin(Math.PI * Math.min(1, t / dur)), 1.4);
            return render(dur, (t) => bp(noise(), t) * Math.sin(Math.PI * Math.min(1, t / dur)));
        }
    },

    'swoosh-fast': {
        desc: 'Quick short swipe (flick!)', tags: ['action'],
        build: () => {
            const rng = makeRng(83);
            const noise = pinkNoise(rng);
            const dur = 0.25;
            const bp = svfBandPass((t) => 500 + 3200 * Math.sin(Math.PI * Math.min(1, t / dur)), 1.6);
            return render(dur, (t) => bp(noise(), t) * Math.sin(Math.PI * Math.min(1, t / dur)));
        }
    },

    'bounce': {
        desc: 'Rubbery bounce', tags: ['action'],
        build: () => {
            const o = osc('sine', (t) => 420 * Math.exp(-t * 11) + 130);
            const env = expDecay(16);
            const out = render(0.28, (t) => o(t) * env(t) * Math.min(1, t / 0.004));
            mixAt(out, click(0.02, 2200, 2, 160, 85), 0, 0.3);
            return out;
        }
    },

    'boing': {
        desc: 'Cartoon spring boing', tags: ['action', 'silly'],
        build: () => {
            const o = osc('sine', (t) => (430 * Math.exp(-t * 4) + 120) * (1 + 0.14 * Math.exp(-t * 4) * Math.sin(TAU * 21 * t)));
            const env = expDecay(4.5);
            return render(0.8, (t) => o(t) * env(t) * Math.min(1, t / 0.005));
        }
    },

    'clack': {
        desc: 'Billiard ball clack', tags: ['action', 'billiards'],
        build: () => {
            const out = new Float32Array(Math.round(0.16 * SR));
            mixAt(out, click(0.05, 2400, 1.6, 120, 91), 0, 1.0);
            mixAt(out, pluck(1850, 0.1, 40, 0.15), 0.001, 0.5);
            return out;
        }
    },

    'pocket-drop': {
        desc: 'Ball dropping into a pocket (thump + rattle)', tags: ['action', 'billiards'],
        build: () => {
            const out = new Float32Array(Math.round(0.7 * SR));
            mixAt(out, chirp('sine', 150, 65, 0.25, 13), 0, 0.9);
            mixAt(out, noiseBurst(0.1, 900, 300, 30, 95, 'pink'), 0, 0.5);
            [0.16, 0.27, 0.36, 0.43].forEach((at, i) => {
                mixAt(out, click(0.04, 1500 - i * 150, 2, 130, 97 + i), at, 0.4 - i * 0.07);
            });
            return out;
        }
    },

    'splash': {
        desc: 'Water splash', tags: ['action', 'water'],
        build: () => {
            const out = noiseBurst(0.8, 2600, 350, 6, 101, 'pink');
            mixAt(out, dripSound(500, 1100), 0.18, 0.5);
            mixAt(out, dripSound(650, 1400), 0.31, 0.4);
            mixAt(out, dripSound(430, 900), 0.42, 0.35);
            return out;
        }
    },

    'drip': {
        desc: 'Single water droplet plink', tags: ['action', 'water'],
        build: () => dripSound()
    },

    'pop': {
        desc: 'Bubble pop', tags: ['action', 'silly'],
        build: () => {
            const out = bubbleSound(300, 950, 0.06);
            mixAt(out, click(0.012, 3000, 1.5, 250, 105), 0, 0.4);
            return out;
        }
    },

    'bubbles': {
        desc: 'A few bubbles rising (aquarium)', tags: ['action', 'water'],
        build: () => {
            const out = new Float32Array(Math.round(0.9 * SR));
            const rng = makeRng(111);
            let at = 0;
            for (let i = 0; i < 5; i++) {
                const f0 = 260 + rng() * 240;
                mixAt(out, bubbleSound(f0, f0 * 2.4, 0.05 + rng() * 0.04), at, 0.6 + rng() * 0.3);
                at += 0.1 + rng() * 0.12;
            }
            return out;
        }
    },

    'sparkle': {
        desc: 'Magic sparkle shimmer', tags: ['action', 'magic'],
        build: () => {
            const out = new Float32Array(Math.round(0.9 * SR));
            const rng = makeRng(121);
            for (let i = 0; i < 9; i++) {
                const f = 1900 + rng() * 2300;
                mixAt(out, pluck(f, 0.25, 16, 0.1), i * 0.06 + rng() * 0.03, 0.35 + rng() * 0.3);
            }
            return echo(out, 0.09, 0.35, 0.3);
        }
    },

    'teleport': {
        desc: 'Rising teleport/warp shimmer', tags: ['action', 'magic', 'space'],
        build: () => {
            const dur = 0.75;
            const o = osc('sine', (t) => (280 + 1500 * (t / dur)) * (1 + 0.05 * Math.sin(TAU * 30 * t)));
            const o2 = osc('sine', (t) => (560 + 3000 * (t / dur)));
            const env = fadeWindow(0.04, 0.18, dur);
            const out = render(dur, (t) => (o(t) + 0.3 * o2(t)) * env(t));
            return echo(out, 0.08, 0.4, 0.35);
        }
    },

    'alarm': {
        desc: 'Two-tone warning alarm', tags: ['action', 'space', 'timer'],
        build: () => {
            const dur = 1.2;
            const o = osc('square', (t) => (Math.floor(t / 0.15) % 2 === 0 ? 880 : 659));
            const lp = onePoleLP(2600);
            const env = fadeWindow(0.01, 0.1, dur);
            return render(dur, (t) => lp(o(t), t) * env(t) * 0.6);
        }
    },

    'heartbeat': {
        desc: 'Single lub-dub heartbeat (tension moments)', tags: ['action', 'tension'],
        build: () => {
            const thump = (g) => gainBuf(chirp('sine', 88, 46, 0.18, 16), g);
            const out = new Float32Array(Math.round(0.6 * SR));
            mixAt(out, thump(1.0), 0);
            mixAt(out, thump(0.7), 0.24);
            return out;
        }
    },

    'footstep': {
        desc: 'Soft footstep tap', tags: ['action'],
        build: () => noiseBurst(0.09, 520, 200, 45, 131, 'pink')
    },

    'card-flip': {
        desc: 'Card flip/deal snap', tags: ['action', 'cards'],
        build: () => {
            const out = new Float32Array(Math.round(0.14 * SR));
            mixAt(out, click(0.06, 3200, 1.1, 70, 141), 0, 0.8);
            mixAt(out, noiseBurst(0.08, 5000, 1500, 40, 143), 0.01, 0.6);
            return out;
        }
    },

    'dice-roll': {
        desc: 'Dice tumbling (vegas!)', tags: ['action', 'cards'],
        build: () => {
            const out = new Float32Array(Math.round(0.65 * SR));
            const rng = makeRng(151);
            let at = 0;
            for (let i = 0; i < 7; i++) {
                mixAt(out, click(0.04, 1800 + rng() * 900, 1.8, 120, 153 + i), at, 0.8 - i * 0.08);
                at += 0.05 + rng() * 0.07;
            }
            return out;
        }
    },

    'gunshot': {
        desc: 'Western gunshot crack (vegas-trail, sundown)', tags: ['action', 'western'],
        build: () => {
            const out = new Float32Array(Math.round(1.1 * SR));
            mixAt(out, noiseBurst(0.05, 7000, 2500, 45, 161), 0, 1.0);
            mixAt(out, noiseBurst(1.0, 2200, 90, 4.5, 163, 'brown'), 0.01, 0.9);
            mixAt(out, chirp('sine', 95, 40, 0.5, 6), 0.01, 0.6);
            return softClip(out, 1.8);
        }
    },

    'ricochet': {
        desc: 'Ricochet whine', tags: ['action', 'western'],
        build: () => {
            const dur = 0.7;
            const o = osc('sine', (t) => (2200 * Math.exp(-t * 3.2) + 300) * (1 + 0.06 * Math.sin(TAU * 34 * t)));
            const env = expDecay(4);
            const out = render(dur, (t) => o(t) * env(t) * Math.min(1, t / 0.005));
            mixAt(out, click(0.02, 3500, 1.5, 200, 171), 0, 0.6);
            return out;
        }
    },

    // ----- ambient loops (seamless, ~24s) -----

    'loop-calm-pad': {
        desc: 'Warm major pad — menus, aquarium, gentle games', tags: ['loop', 'ambient'], loop: true, stereo: true,
        build: () => {
            const mk = (seed) => makeLoop(LOOP_DUR, LOOP_WRAP,
                padChordFn([48, 55, 64, 71, 74], (t) => 620 + 380 * Math.sin(TAU * t / 12), seed));
            return [mk(201), mk(202)];
        }
    },

    'loop-space-drone': {
        desc: 'Deep space drone with shimmer — nova-guard, star-sweeper', tags: ['loop', 'ambient', 'space'], loop: true, stereo: true,
        build: () => {
            const mk = (seed) => {
                const base = makeLoop(LOOP_DUR, LOOP_WRAP, (() => {
                    const pad = padChordFn([33, 40, 52], (t) => 300 + 140 * Math.sin(TAU * t / 16), seed, 0.006);
                    const rng = makeRng(seed + 5);
                    const noise = pinkNoise(rng);
                    const lp = onePoleLP(400);
                    return (t) => pad(t) + lp(noise(), t) * 0.25;
                })());
                const rng = makeRng(seed + 9);
                for (let i = 0; i < 8; i++) {
                    const f = 1100 + rng() * 1600;
                    mixWrap(base, pluck(f, 2.5, 1.2, 0.05), rng() * LOOP_DUR, 0.05 + rng() * 0.05);
                }
                return base;
            };
            return [mk(211), mk(212)];
        }
    },

    'loop-spooky': {
        desc: 'Eerie minor drone + wind — seance, halloween-words', tags: ['loop', 'ambient', 'spooky'], loop: true, stereo: true,
        build: () => {
            const mk = (seed) => {
                const base = makeLoop(LOOP_DUR, LOOP_WRAP, (() => {
                    const pad = padChordFn([38, 45, 53, 56], (t) => 380 + 200 * Math.sin(TAU * t / 14 + 2), seed, 0.007);
                    const wind = windFn(seed + 3, 420, 260, 0.07);
                    return (t) => pad(t) * 0.8 + wind(t) * 0.35;
                })());
                const rng = makeRng(seed + 7);
                for (let i = 0; i < 4; i++) {
                    mixWrap(base, pluck(mtof(74 + Math.floor(rng() * 5)), 3, 1, 0.05), rng() * LOOP_DUR, 0.04);
                }
                return base;
            };
            return [mk(221), mk(222)];
        }
    },

    'loop-dungeon': {
        desc: 'Low medieval dungeon drone with drips — iron-keep', tags: ['loop', 'ambient', 'spooky'], loop: true, stereo: true,
        build: () => {
            const mk = (seed) => {
                const base = makeLoop(LOOP_DUR, LOOP_WRAP, (() => {
                    const pad = padChordFn([28, 35, 40], (t) => 220 + 90 * Math.sin(TAU * t / 18), seed, 0.005);
                    const rng = makeRng(seed + 2);
                    const noise = brownNoise(rng);
                    const lp = onePoleLP(160);
                    return (t) => pad(t) + lp(noise(), t) * 0.3;
                })());
                const rng = makeRng(seed + 4);
                for (let i = 0; i < 6; i++) {
                    mixWrap(base, dripSound(500 + rng() * 400, 1100 + rng() * 600), rng() * LOOP_DUR, 0.12 + rng() * 0.08);
                }
                for (let i = 0; i < LOOP_DUR / 4; i++) {
                    mixWrap(base, chirp('sine', 55, 38, 1.2, 3), i * 4 + 0.5, 0.25);
                }
                return base;
            };
            return [mk(231), mk(232)];
        }
    },

    'loop-desert-wind': {
        desc: 'Dry wind + sparse warm pad — sundown, vegas-trail', tags: ['loop', 'ambient', 'western'], loop: true, stereo: true,
        build: () => {
            const mk = (seed) => makeLoop(LOOP_DUR, LOOP_WRAP, (() => {
                const wind = windFn(seed, 520, 340, 0.08);
                const pad = padChordFn([45, 52, 59, 64], (t) => 350 + 150 * Math.sin(TAU * t / 20 + 1), seed + 1, 0.004);
                return (t) => wind(t) * 0.55 + pad(t) * 0.45;
            })());
            return [mk(241), mk(242)];
        }
    },

    'loop-underwater': {
        desc: 'Muffled underwater ambience with bubbles — aquarium, raft', tags: ['loop', 'ambient', 'water'], loop: true, stereo: true,
        build: () => {
            const mk = (seed) => {
                const base = makeLoop(LOOP_DUR, LOOP_WRAP, (() => {
                    const rng = makeRng(seed);
                    const noise = brownNoise(rng);
                    const lp = onePoleLP(240);
                    const pad = padChordFn([41, 48, 57], (t) => 260 + 120 * Math.sin(TAU * t / 13), seed + 1, 0.005);
                    return (t) => lp(noise(), t) * 0.5 + pad(t) * 0.5;
                })());
                const rng = makeRng(seed + 6);
                for (let i = 0; i < 14; i++) {
                    const f0 = 220 + rng() * 260;
                    mixWrap(base, bubbleSound(f0, f0 * 2.3, 0.05 + rng() * 0.05), rng() * LOOP_DUR, 0.08 + rng() * 0.1);
                }
                return base;
            };
            return [mk(251), mk(252)];
        }
    },

    'loop-rain': {
        desc: 'Steady rain with droplets', tags: ['loop', 'ambient', 'water'], loop: true, stereo: true,
        build: () => {
            const mk = (seed) => {
                const base = makeLoop(LOOP_DUR, LOOP_WRAP, (() => {
                    const rng = makeRng(seed);
                    const noise = whiteNoise(rng);
                    const hp = onePoleHP(900);
                    const lp = onePoleLP(5200);
                    const flutter = makeRng(seed + 1);
                    let g = 0.8;
                    return (t) => {
                        g += (flutter() - 0.5) * 0.02;
                        g = Math.max(0.6, Math.min(1, g));
                        return lp(hp(noise(), t), t) * g * 0.7;
                    };
                })());
                const rng = makeRng(seed + 3);
                for (let i = 0; i < 20; i++) {
                    mixWrap(base, dripSound(700 + rng() * 800, 1600 + rng() * 900), rng() * LOOP_DUR, 0.04 + rng() * 0.05);
                }
                return base;
            };
            return [mk(261), mk(262)];
        }
    },

    'loop-ocean-waves': {
        desc: 'Ocean waves rolling in ~8s cycles — raft', tags: ['loop', 'ambient', 'water'], loop: true, stereo: true,
        build: () => {
            const mk = (seed) => makeLoop(LOOP_DUR, LOOP_WRAP, (() => {
                const rng = makeRng(seed);
                const noise = pinkNoise(rng);
                const lp = onePoleLP((t) => 500 + 1800 * Math.pow(0.5 + 0.5 * Math.sin(TAU * t / 8 - Math.PI / 2), 2));
                return (t) => {
                    const swell = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(TAU * t / 8 - Math.PI / 2), 1.5);
                    return lp(noise(), t) * swell;
                };
            })());
            return [mk(271), mk(272)];
        }
    },

    'loop-tension': {
        desc: 'Heartbeat pulse over dark drone — hot-potato, timers', tags: ['loop', 'ambient', 'tension'], loop: true, stereo: true,
        build: () => {
            const mk = (seed) => {
                const base = makeLoop(LOOP_DUR, LOOP_WRAP,
                    padChordFn([38, 44, 50], (t) => 280 + 130 * Math.sin(TAU * t / 12), seed, 0.008));
                gainBuf(base, 0.55);
                const thump = (g) => gainBuf(chirp('sine', 84, 44, 0.16, 18), g);
                for (let beat = 0; beat < LOOP_DUR / 1.2; beat++) {
                    mixWrap(base, thump(0.9), beat * 1.2, 1);
                    mixWrap(base, thump(0.6), beat * 1.2 + 0.22, 1);
                }
                return base;
            };
            return [mk(281), mk(282)];
        }
    },

    // ----- music loops (seamless, 24s) -----

    'music-chill': {
        desc: 'Mellow 80bpm chord loop with soft arp — dashboards, casual games', tags: ['loop', 'music'], loop: true, stereo: true,
        build: () => {
            // 80bpm: beat .75s, bar 3s, 8 bars = 24s
            const bars = [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 65]];
            const mkChannel = (seed, arpOffset) => {
                const out = new Float32Array(Math.round(LOOP_DUR * SR));
                for (let bar = 0; bar < 8; bar++) {
                    const chord = bars[bar % 4];
                    for (const m of chord) {
                        mixWrap(out, softSine(mtof(m), 2.9), bar * 3, 0.11);
                    }
                    // gentle eighth-note arp on chord tones + octave
                    const arpNotes = [...chord.slice(1), chord[1] + 12, chord[2] + 12];
                    for (let e = 0; e < 8; e++) {
                        const m = arpNotes[(e + arpOffset) % arpNotes.length];
                        mixWrap(out, pluck(mtof(m + 12), 0.5, 7, 0.15), bar * 3 + e * 0.375, 0.16);
                    }
                }
                return echoWrap(out, 0.5625, 0.3, 2); // dotted-eighth echo
            };
            return [mkChannel(301, 0), mkChannel(302, 2)];
        }
    },

    'music-upbeat': {
        desc: 'Bouncy 120bpm chiptune loop — party/action games', tags: ['loop', 'music'], loop: true, stereo: true,
        build: () => {
            // 120bpm: beat .5s, bar 2s, 12 bars = 24s
            const roots = [48, 43, 45, 41]; // C G A F
            const penta = [72, 74, 76, 79, 81, 84];
            const rng = makeRng(311);
            const melody = [];
            for (let i = 0; i < 48; i++) { // quarter-note melody grid, some rests
                melody.push(rng() < 0.75 ? penta[Math.floor(rng() * penta.length)] : null);
            }
            const mkChannel = (leadGain, bassGain, drumGain) => {
                const out = new Float32Array(Math.round(LOOP_DUR * SR));
                for (let bar = 0; bar < 12; bar++) {
                    const root = roots[bar % 4];
                    for (let e = 0; e < 8; e++) { // eighth-note bass
                        const m = e % 4 === 2 ? root + 7 : root;
                        mixWrap(out, triVoice(mtof(m + 12), 0.2), bar * 2 + e * 0.25, bassGain * 0.5);
                    }
                    for (let b = 0; b < 4; b++) {
                        const at = bar * 2 + b * 0.5;
                        if (b % 2 === 0) mixWrap(out, kick(), at, drumGain * 0.9);
                        else mixWrap(out, snare(), at, drumGain * 0.5);
                        mixWrap(out, hat(11 + b), at, drumGain * 0.25);
                        mixWrap(out, hat(15 + b), at + 0.25, drumGain * 0.15);
                        const m = melody[bar * 4 + b];
                        if (m !== null) mixWrap(out, chipVoice(mtof(m), 0.22), at, leadGain * 0.55);
                    }
                }
                return out;
            };
            return [mkChannel(0.9, 0.7, 0.8), mkChannel(0.7, 0.9, 0.8)];
        }
    },

    'music-mystery': {
        desc: 'Slow minor arpeggio loop — imposter, snap-judgment, puzzles', tags: ['loop', 'music'], loop: true, stereo: true,
        build: () => {
            // 90bpm: eighth 1/3s, bar 8/3s, 9 bars = 24s
            const arp = [57, 60, 64, 69, 72, 69, 64, 60];
            const mkChannel = (seed, offset) => {
                const out = new Float32Array(Math.round(LOOP_DUR * SR));
                const eighth = 1 / 3;
                for (let bar = 0; bar < 9; bar++) {
                    for (let e = 0; e < 8; e++) {
                        const m = arp[(e + offset) % arp.length] + (bar % 3 === 2 ? -2 : 0);
                        mixWrap(out, pluck(mtof(m), 0.8, 5, 0.2), bar * (8 * eighth) + e * eighth, 0.3);
                    }
                    mixWrap(out, softSine(mtof(33), 8 * eighth - 0.1), bar * (8 * eighth), 0.22);
                }
                return echoWrap(out, eighth * 1.5, 0.35, 3);
            };
            return [mkChannel(321, 0), mkChannel(322, 3)];
        }
    }
};

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const outDir = process.argv[2] || path.join(__dirname, 'output');
fs.mkdirSync(outDir, { recursive: true });

const only = process.argv[3]; // optional single-sound regen: node generate.js output ui-click
const manifest = [];

for (const [name, def] of Object.entries(sounds)) {
    if (only && name !== only) continue;
    const started = Date.now();
    let result = def.build();
    if (!Array.isArray(result)) result = [result];

    // Interleave a bit of each channel into the other so stereo isn't too wide,
    // then normalize channels together to preserve balance.
    if (result.length === 2) {
        const [l, r] = result;
        const l2 = new Float32Array(l.length);
        const r2 = new Float32Array(r.length);
        for (let i = 0; i < l.length; i++) {
            l2[i] = l[i] * 0.85 + r[i] * 0.15;
            r2[i] = r[i] * 0.85 + l[i] * 0.15;
        }
        result = [l2, r2];
    }

    const peak = def.loop ? 0.55 : 0.85;
    let max = 0;
    for (const ch of result) {
        for (let i = 0; i < ch.length; i++) max = Math.max(max, Math.abs(ch[i]));
    }
    if (max > 0) {
        for (const ch of result) gainBuf(ch, peak / max);
    }

    const file = `${name}.wav`;
    writeWav(path.join(outDir, file), result);
    const durationSec = result[0].length / SR;
    manifest.push({
        name,
        file,
        description: def.desc,
        tags: def.tags,
        loop: !!def.loop,
        channels: result.length,
        durationSec: Math.round(durationSec * 100) / 100,
        license: 'CC0-1.0'
    });
    console.log(`${name}.wav  (${durationSec.toFixed(2)}s, ${result.length}ch, ${Date.now() - started}ms)`);
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\n${manifest.length} sounds written to ${outDir}`);
