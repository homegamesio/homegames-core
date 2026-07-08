// A CHIP-8 virtual machine (1977) and a two-pass assembler for its
// instruction set. The Cabinet boots this CPU and feeds it a ROM; the
// game on screen is whatever the machine computes.

const FONT = [
    0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
    0x20, 0x60, 0x20, 0x20, 0x70, // 1
    0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
    0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
    0x90, 0x90, 0xF0, 0x10, 0x10, // 4
    0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
    0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
    0xF0, 0x10, 0x20, 0x40, 0x40, // 7
    0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
    0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
    0xF0, 0x90, 0xF0, 0x90, 0x90, // A
    0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
    0xF0, 0x80, 0x80, 0x80, 0xF0, // C
    0xE0, 0x90, 0x90, 0x90, 0xE0, // D
    0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
    0xF0, 0x80, 0xF0, 0x80, 0x80  // F
];
const FONT_BASE = 0x50;
const ROM_BASE = 0x200;

class Chip8 {
    constructor(rom, opts = {}) {
        this.timerDiv = opts.timerDiv || 150; // cycles per 60Hz timer step
        this.rng = opts.rng || Math.random;
        this.reset(rom);
    }

    reset(rom) {
        this.mem = new Uint8Array(4096);
        this.mem.set(FONT, FONT_BASE);
        this.mem.set(rom, ROM_BASE);
        this.V = new Uint8Array(16);
        this.i = 0;
        this.pc = ROM_BASE;
        this.stack = [];
        this.dt = 0;
        this.st = 0;
        this.keys = new Array(16).fill(false);
        this.display = new Uint8Array(64 * 32);
        this.cycles = 0;
    }

    run(count) {
        for (let c = 0; c < count; c++) {
            this.step();
        }
    }

    step() {
        const op = (this.mem[this.pc] << 8) | this.mem[this.pc + 1];
        this.pc = (this.pc + 2) & 0xFFF;
        const x = (op >> 8) & 0xF;
        const y = (op >> 4) & 0xF;
        const n = op & 0xF;
        const nn = op & 0xFF;
        const nnn = op & 0xFFF;
        const V = this.V;
        switch (op >> 12) {
            case 0x0:
                if (op === 0x00E0) {
                    this.display.fill(0);
                } else if (op === 0x00EE) {
                    this.pc = this.stack.pop() ?? ROM_BASE;
                }
                break;
            case 0x1: this.pc = nnn; break;
            case 0x2: this.stack.push(this.pc); this.pc = nnn; break;
            case 0x3: if (V[x] === nn) this.pc = (this.pc + 2) & 0xFFF; break;
            case 0x4: if (V[x] !== nn) this.pc = (this.pc + 2) & 0xFFF; break;
            case 0x5: if (V[x] === V[y]) this.pc = (this.pc + 2) & 0xFFF; break;
            case 0x6: V[x] = nn; break;
            case 0x7: V[x] = (V[x] + nn) & 0xFF; break;
            case 0x8:
                switch (n) {
                    case 0x0: V[x] = V[y]; break;
                    case 0x1: V[x] |= V[y]; break;
                    case 0x2: V[x] &= V[y]; break;
                    case 0x3: V[x] ^= V[y]; break;
                    case 0x4: {
                        const sum = V[x] + V[y];
                        V[x] = sum & 0xFF;
                        V[0xF] = sum > 0xFF ? 1 : 0;
                        break;
                    }
                    case 0x5: {
                        const noBorrow = V[x] >= V[y] ? 1 : 0;
                        V[x] = (V[x] - V[y]) & 0xFF;
                        V[0xF] = noBorrow;
                        break;
                    }
                    case 0x6: {
                        const bit = V[x] & 1;
                        V[x] >>= 1;
                        V[0xF] = bit;
                        break;
                    }
                    case 0x7: {
                        const noBorrow = V[y] >= V[x] ? 1 : 0;
                        V[x] = (V[y] - V[x]) & 0xFF;
                        V[0xF] = noBorrow;
                        break;
                    }
                    case 0xE: {
                        const bit = (V[x] >> 7) & 1;
                        V[x] = (V[x] << 1) & 0xFF;
                        V[0xF] = bit;
                        break;
                    }
                }
                break;
            case 0x9: if (V[x] !== V[y]) this.pc = (this.pc + 2) & 0xFFF; break;
            case 0xA: this.i = nnn; break;
            case 0xB: this.pc = (nnn + V[0]) & 0xFFF; break;
            case 0xC: V[x] = Math.floor(this.rng() * 256) & nn; break;
            case 0xD: this.drawSprite(V[x], V[y], n); break;
            case 0xE:
                if (nn === 0x9E && this.keys[V[x] & 0xF]) this.pc = (this.pc + 2) & 0xFFF;
                if (nn === 0xA1 && !this.keys[V[x] & 0xF]) this.pc = (this.pc + 2) & 0xFFF;
                break;
            case 0xF:
                switch (nn) {
                    case 0x07: V[x] = this.dt; break;
                    case 0x0A: {
                        const k = this.keys.findIndex(Boolean);
                        if (k === -1) {
                            this.pc = (this.pc - 2) & 0xFFF;
                        } else {
                            V[x] = k;
                        }
                        break;
                    }
                    case 0x15: this.dt = V[x]; break;
                    case 0x18: this.st = V[x]; break;
                    case 0x1E: this.i = (this.i + V[x]) & 0xFFF; break;
                    case 0x29: this.i = FONT_BASE + (V[x] & 0xF) * 5; break;
                    case 0x33:
                        this.mem[this.i] = Math.floor(V[x] / 100);
                        this.mem[this.i + 1] = Math.floor(V[x] / 10) % 10;
                        this.mem[this.i + 2] = V[x] % 10;
                        break;
                    case 0x55: for (let r = 0; r <= x; r++) this.mem[(this.i + r) & 0xFFF] = V[r]; break;
                    case 0x65: for (let r = 0; r <= x; r++) V[r] = this.mem[(this.i + r) & 0xFFF]; break;
                }
                break;
        }
        this.cycles++;
        if (this.cycles % this.timerDiv === 0) {
            if (this.dt > 0) this.dt--;
            if (this.st > 0) this.st--;
        }
    }

    drawSprite(px, py, rows) {
        px %= 64;
        py %= 32;
        this.V[0xF] = 0;
        for (let r = 0; r < rows; r++) {
            const yy = py + r;
            if (yy >= 32) {
                break;
            }
            const byte = this.mem[(this.i + r) & 0xFFF];
            for (let b = 0; b < 8; b++) {
                if (!((byte >> (7 - b)) & 1)) {
                    continue;
                }
                const xx = px + b;
                if (xx >= 64) {
                    continue;
                }
                const idx = yy * 64 + xx;
                if (this.display[idx]) {
                    this.V[0xF] = 1;
                }
                this.display[idx] ^= 1;
            }
        }
    }

    opcodeAt(addr) {
        return (this.mem[addr & 0xFFF] << 8) | this.mem[(addr + 1) & 0xFFF];
    }
}

// ---- assembler ----

const REG = /^V([0-9A-F])$/i;

const reg = (tok) => {
    const m = (tok || '').match(REG);
    return m ? parseInt(m[1], 16) : null;
};

const assemble = (source) => {
    const lines = source.split('\n')
        .map(line => line.replace(/;.*$/, '').trim())
        .filter(Boolean);

    // Pass 1: measure and collect labels
    const labels = {};
    const items = [];
    let addr = ROM_BASE;
    lines.forEach(line => {
        let rest = line;
        const labelMatch = rest.match(/^([A-Za-z_]\w*):\s*(.*)$/);
        if (labelMatch) {
            if (labels[labelMatch[1]] !== undefined) {
                throw new Error(`duplicate label: ${labelMatch[1]}`);
            }
            labels[labelMatch[1]] = addr;
            rest = labelMatch[2].trim();
        }
        if (!rest) {
            return;
        }
        const [mnemonic, ...opTokens] = rest.split(/\s+/);
        const ops = opTokens.join(' ').split(',').map(s => s.trim()).filter(Boolean);
        const item = { mn: mnemonic.toUpperCase(), ops, line };
        items.push(item);
        addr += item.mn === 'DB' ? item.ops.length : 2;
    });

    const num = (tok) => {
        if (/^0X[0-9A-F]+$/i.test(tok)) {
            return parseInt(tok, 16);
        }
        if (/^\d+$/.test(tok)) {
            return parseInt(tok, 10);
        }
        if (labels[tok] !== undefined) {
            return labels[tok];
        }
        throw new Error(`unknown operand "${tok}"`);
    };

    // Pass 2: encode
    const bytes = [];
    const emit = (word) => {
        bytes.push((word >> 8) & 0xFF, word & 0xFF);
    };
    items.forEach(({ mn, ops, line }) => {
        try {
            const [a, b, c] = ops;
            const ra = reg(a);
            const rb = reg(b);
            switch (mn) {
                case 'CLS': emit(0x00E0); break;
                case 'RET': emit(0x00EE); break;
                case 'JP':
                    if (ops.length === 2 && a.toUpperCase() === 'V0') {
                        emit(0xB000 | (num(b) & 0xFFF));
                    } else {
                        emit(0x1000 | (num(a) & 0xFFF));
                    }
                    break;
                case 'CALL': emit(0x2000 | (num(a) & 0xFFF)); break;
                case 'SE':
                    emit(rb !== null ? (0x5000 | (ra << 8) | (rb << 4)) : (0x3000 | (ra << 8) | (num(b) & 0xFF)));
                    break;
                case 'SNE':
                    emit(rb !== null ? (0x9000 | (ra << 8) | (rb << 4)) : (0x4000 | (ra << 8) | (num(b) & 0xFF)));
                    break;
                case 'ADD':
                    if (a.toUpperCase() === 'I') {
                        emit(0xF01E | (rb << 8));
                    } else if (rb !== null) {
                        emit(0x8004 | (ra << 8) | (rb << 4));
                    } else {
                        emit(0x7000 | (ra << 8) | (num(b) & 0xFF));
                    }
                    break;
                case 'OR': emit(0x8001 | (ra << 8) | (rb << 4)); break;
                case 'AND': emit(0x8002 | (ra << 8) | (rb << 4)); break;
                case 'XOR': emit(0x8003 | (ra << 8) | (rb << 4)); break;
                case 'SUB': emit(0x8005 | (ra << 8) | (rb << 4)); break;
                case 'SUBN': emit(0x8007 | (ra << 8) | (rb << 4)); break;
                case 'SHR': emit(0x8006 | (ra << 8)); break;
                case 'SHL': emit(0x800E | (ra << 8)); break;
                case 'RND': emit(0xC000 | (ra << 8) | (num(b) & 0xFF)); break;
                case 'DRW': emit(0xD000 | (ra << 8) | (rb << 4) | (num(c) & 0xF)); break;
                case 'SKP': emit(0xE09E | (ra << 8)); break;
                case 'SKNP': emit(0xE0A1 | (ra << 8)); break;
                case 'LD': {
                    const A = a.toUpperCase();
                    const B = (b || '').toUpperCase();
                    if (ra !== null && rb !== null) {
                        emit(0x8000 | (ra << 8) | (rb << 4));
                    } else if (ra !== null && B === 'DT') {
                        emit(0xF007 | (ra << 8));
                    } else if (ra !== null && B === 'K') {
                        emit(0xF00A | (ra << 8));
                    } else if (ra !== null && B === '[I]') {
                        emit(0xF065 | (ra << 8));
                    } else if (ra !== null) {
                        emit(0x6000 | (ra << 8) | (num(b) & 0xFF));
                    } else if (A === 'I') {
                        emit(0xA000 | (num(b) & 0xFFF));
                    } else if (A === 'DT') {
                        emit(0xF015 | (rb << 8));
                    } else if (A === 'ST') {
                        emit(0xF018 | (rb << 8));
                    } else if (A === 'F') {
                        emit(0xF029 | (rb << 8));
                    } else if (A === 'B') {
                        emit(0xF033 | (rb << 8));
                    } else if (A === '[I]') {
                        emit(0xF055 | (rb << 8));
                    } else {
                        throw new Error('bad LD form');
                    }
                    break;
                }
                case 'DB': ops.forEach(tok => bytes.push(num(tok) & 0xFF)); break;
                default: throw new Error(`unknown mnemonic "${mn}"`);
            }
        } catch (err) {
            throw new Error(`assemble error at "${line}": ${err.message}`);
        }
    });

    return { bytes: new Uint8Array(bytes), labels };
};

module.exports = { Chip8, assemble, FONT, FONT_BASE, ROM_BASE };
