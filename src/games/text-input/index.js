const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');

// A live typing surface: every connected player gets a panel, and keystrokes
// appear on screen instantly, like a shared document.
//
// The trick: the client re-sends every held key at ~33ms with NO initial
// delay, so naive `buffer += key` turns a normal keystroke into "hhhh". This
// game reconstructs real keyboard feel server-side by gating repeats like an
// OS keyboard: a key not seen for >400ms is a fresh press (types instantly);
// while held, its 33ms repeats are used as a heartbeat and only let through
// after a 450ms initial delay, then at ~18 chars/sec.

const TICK_RATE = 8;

const KEY_STALE_MS = 400;      // no keydown for this long = key was released
const REPEAT_DELAY_MS = 450;   // hold this long before repeating
const REPEAT_EVERY_MS = 55;    // then ~18 chars/sec

const MAX_CHARS = 900;
const MAX_PANELS = 4;

const TEXT_H = 16 / 9;

const PALETTE = [
    [64, 224, 208, 255],
    [255, 150, 90, 255],
    [180, 130, 255, 255],
    [120, 220, 120, 255]
];

const BG = [26, 26, 30, 255];
const PANEL = [246, 243, 235, 255];
const INK = [40, 38, 50, 255];
const FAINT = [150, 145, 160, 255];

class Typewriter extends Game {
    static metadata() {
        return {
            aspectRatio: { x: 16, y: 9 },
            squishVersion: '142',
            author: 'Joseph Garcia',
            name: 'Typewriter',
            description: 'A live shared typing wall. Every keystroke lands on screen instantly - bring a keyboard and write together.',
            tickRate: TICK_RATE
        };
    }

    constructor() {
        super();

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: BG
        });

        this.base.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 1.2, text: 'TYPEWRITER - JUST START TYPING', size: 1.4, align: 'center', font: 'monospace', color: [200, 195, 210, 255] }
        }), false);

        this.panelLayer = this.makeContainer();
        this.base.addChild(this.panelLayer, false);

        this.players = {};
        this.writers = {};      // pid -> { buffer, keys, panel, colorIndex }
        this.tickCount = 0;
    }

    makeContainer() {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
    }

    playerName(playerId) {
        return String((this.players[playerId] && this.players[playerId].name) || ('PLAYER ' + playerId)).toUpperCase().slice(0, 12);
    }

    // --- layout ---

    panelRects(count) {
        if (count <= 1) return [{ x: 6, y: 8, w: 88, h: 86 }];
        if (count === 2) return [
            { x: 3, y: 8, w: 46, h: 86 },
            { x: 51, y: 8, w: 46, h: 86 }
        ];
        return [
            { x: 3, y: 6, w: 46, h: 44 },
            { x: 51, y: 6, w: 46, h: 44 },
            { x: 3, y: 53, w: 46, h: 44 },
            { x: 51, y: 53, w: 46, h: 44 }
        ];
    }

    rebuildPanels() {
        this.panelLayer.clearChildren();
        const pids = Object.keys(this.writers).map(Number);
        const rects = this.panelRects(pids.length);
        const textSize = pids.length <= 1 ? 2 : 1.4;

        pids.forEach((pid, i) => {
            const writer = this.writers[pid];
            const rect = rects[i % MAX_PANELS];
            const lineH = textSize * TEXT_H * 1.25;
            const headerH = 4.5;
            const maxLines = Math.max(1, Math.floor((rect.h - headerH - 2) / lineH));
            // Canvas 'monospace' metrics vary by device (advance widths from
            // ~0.6 to ~0.85 of the font size), so estimate WIDE: lines wrap a
            // little early on narrow fonts instead of overflowing on wide ones.
            const charsPerLine = Math.max(8, Math.floor((rect.w - 4) / (textSize * 0.85)));

            const bg = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(rect.x, rect.y, rect.w, rect.h),
                fill: PANEL,
                color: writer.color,
                border: 5,
                // Mobile fallback: no keyboard -> tap the panel to type via prompt.
                input: {
                    type: 'text',
                    oninput: (inputPid, value) => {
                        if (inputPid === pid && value) {
                            writer.buffer = (writer.buffer + value).slice(-MAX_CHARS);
                            this.renderWriter(pid);
                            this.base.node.onStateChange();
                        }
                    }
                }
            });

            const nameLabel = new GameNode.Text({
                textInfo: { x: rect.x + 2, y: rect.y + 1, text: this.playerName(pid), size: 1.3, font: 'monospace', color: writer.color }
            });
            const youLabel = new GameNode.Text({
                textInfo: { x: rect.x + rect.w - 2, y: rect.y + 1, text: 'YOU', size: 1.1, align: 'right', font: 'monospace', color: writer.color },
                playerIds: [pid]
            });

            const lineNodes = [];
            for (let l = 0; l < maxLines; l++) {
                const line = new GameNode.Text({
                    textInfo: { x: rect.x + 2, y: rect.y + headerH + l * lineH, text: '', size: textSize, font: 'monospace', color: INK }
                });
                lineNodes.push(line);
                bg.addChild(line, false);
            }

            bg.addChildren(nameLabel, youLabel);
            this.panelLayer.addChild(bg, false);

            if (writer.blinkOn === undefined) writer.blinkOn = true;
            writer.panel = { rect, textSize, lineH, headerH, maxLines, charsPerLine, lineNodes };
            this.renderWriter(pid);
        });
        this.base.node.onStateChange();
    }

    // --- text rendering ---

    wrapBuffer(buffer, charsPerLine) {
        const lines = [];
        buffer.split('\n').forEach(paragraph => {
            if (paragraph.length === 0) {
                lines.push('');
                return;
            }
            for (let i = 0; i < paragraph.length; i += charsPerLine) {
                lines.push(paragraph.slice(i, i + charsPerLine));
            }
        });
        return lines;
    }

    renderWriter(pid, fromTyping) {
        const writer = this.writers[pid];
        const panel = writer.panel;
        if (!panel) return;

        if (fromTyping) {
            // Typing resets the blink to visible, like every editor.
            writer.blinkOn = true;
            writer.blinkHold = 2;
        }

        // The cursor is a text glyph appended to the buffer BEFORE wrapping,
        // so it always sits exactly after the last character — regardless of
        // which monospace font each client's canvas actually resolves — and
        // wraps to the next line exactly like the next typed character would.
        // Blink-off swaps it for a space so the wrap doesn't shift.
        const cursorChar = writer.blinkOn ? '▌' : ' ';
        const empty = writer.buffer.length === 0;
        const lines = this.wrapBuffer(writer.buffer + cursorChar, panel.charsPerLine);
        const visible = lines.slice(-panel.maxLines);

        panel.lineNodes.forEach((node, i) => {
            node.node.text.text = visible[i] || '';
            node.node.text.color = INK;
        });

        if (empty && panel.lineNodes.length > 1) {
            panel.lineNodes[1].node.text.text = 'type something...';
            panel.lineNodes[1].node.text.color = FAINT;
        }
    }

    // --- keyboard: OS-feel repeat gating ---

    applyKey(pid, key) {
        const writer = this.writers[pid];
        if (key === 'Backspace') {
            writer.buffer = writer.buffer.slice(0, -1);
        } else if (key === 'Enter') {
            writer.buffer += '\n';
        } else if (key.length === 1) {
            if (writer.buffer.length >= MAX_CHARS) return;
            writer.buffer += key;
        } else {
            return;
        }
        this.renderWriter(pid, true);
        this.base.node.onStateChange();
    }

    handleKeyDown(playerId, key) {
        const writer = this.writers[playerId];
        if (!writer) return;
        if (key !== 'Backspace' && key !== 'Enter' && key.length !== 1) return;

        const now = Date.now();
        const state = writer.keys[key];

        if (!state || now - state.lastSeen > KEY_STALE_MS) {
            // Fresh physical press: type immediately.
            writer.keys[key] = { lastSeen: now, repeatAt: now + REPEAT_DELAY_MS };
            this.applyKey(playerId, key);
            return;
        }

        // Held key: the client's ~33ms re-sends are our hold heartbeat.
        state.lastSeen = now;
        if (now >= state.repeatAt) {
            state.repeatAt = now + REPEAT_EVERY_MS;
            this.applyKey(playerId, key);
        }
    }

    handleKeyUp(playerId, key) {
        const writer = this.writers[playerId];
        if (writer) {
            delete writer.keys[key];
        }
    }

    // --- simulation (cursor blink only) ---

    tick() {
        this.tickCount++;
        if (this.tickCount % 4 !== 0) return;   // blink phase: toggle every 0.5s
        let changed = false;
        Object.keys(this.writers).map(Number).forEach(pid => {
            const writer = this.writers[pid];
            if (!writer.panel) return;
            if (writer.blinkHold > 0) {
                writer.blinkHold--;
                return;
            }
            {
                writer.blinkOn = !writer.blinkOn;
                this.renderWriter(pid);
                changed = true;
            }
        });
        if (changed) {
            this.base.node.onStateChange();
        }
    }

    // --- platform hooks ---

    handleNewPlayer({ playerId, info }) {
        this.players[playerId] = { name: (info && info.name) || ('PLAYER ' + playerId) };
        if (Object.keys(this.writers).length < MAX_PANELS) {
            const used = new Set(Object.values(this.writers).map(w => w.colorIndex));
            const colorIndex = PALETTE.findIndex((c, i) => !used.has(i));
            this.writers[playerId] = {
                buffer: '',
                keys: {},
                color: PALETTE[Math.max(0, colorIndex)],
                colorIndex: Math.max(0, colorIndex),
                blinkHold: 0,
                panel: null
            };
            this.rebuildPanels();
        }
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
        if (this.writers[playerId]) {
            delete this.writers[playerId];
            this.rebuildPanels();
        }
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = Typewriter;
