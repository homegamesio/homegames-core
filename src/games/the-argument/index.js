const { Game, GameNode, Shapes, ShapeUtils } = require('squish-142');
const { ROUND_SCRIPT, setupRound, systemCommentary, shuffled } = require('./rounds');

const TICK_RATE = 10;
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 8;

const BRIEFING_SEC = 18;
const DISCUSS_SEC = 75;
const DISCUSS_SEC_ACT3 = 55;
const COMMIT_SEC = 22;
const REVEAL_SEC = 20;
const TRUST_SEC = 10;
const TRUST_BONUS_SEC = 15;

const TRUST_TOKENS = 2;

// 16:9 — corporate terminal from hell
const BG = [10, 12, 16, 255];
const PANEL = [20, 26, 36, 255];
const INK = [228, 232, 240, 255];
const FAINT = [110, 120, 140, 255];
const CYAN = [90, 210, 235, 255];
const CORAL = [235, 95, 85, 255];
const GOLD = [245, 195, 75, 255];
const GOOD = [75, 210, 130, 255];
const BAD = [235, 70, 55, 255];
const CARD = [28, 34, 46, 255];

const PALETTE = [
    { name: 'CYAN', color: [90, 210, 235, 255] },
    { name: 'CORAL', color: [235, 95, 85, 255] },
    { name: 'GOLD', color: [245, 195, 75, 255] },
    { name: 'MINT', color: [80, 210, 160, 255] },
    { name: 'LAV', color: [160, 120, 230, 255] },
    { name: 'AMBER', color: [240, 170, 60, 255] },
    { name: 'PINK', color: [230, 100, 160, 255] },
    { name: 'SKY', color: [70, 140, 230, 255] }
];

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });

class TheArgument extends Game {
    static metadata() {
        return {
            squishVersion: '142',
            name: 'The Argument',
            author: 'Joseph Garcia',
            description: 'Compliance Module 7 gave everyone a different briefing. Argue for 30 minutes. Trust nothing — except maybe Trust Tokens.',
            aspectRatio: { x: 16, y: 9 },
            services: ['multiplayer'],
            maxPlayers: MAX_PLAYERS,
            tickRate: TICK_RATE
        };
    }

    constructor() {
        super();

        this.phase = 'lobby';
        this.players = {};
        this.anchors = {};
        this.joined = [];
        this.participants = [];
        this.playerColors = {};
        this.trustTokens = {};
        this.trustUsedThisRound = false;
        this.trustReveal = null;
        this.trustLog = [];

        this.roundIndex = 0;
        this.roundData = null;
        this.roundDef = null;
        this.briefings = {};
        this.commits = {};
        this.commitLocked = {};
        this.lastResult = null;
        this.history = [];

        this.health = 100;
        this.audit = 0;
        this.phaseTicks = 0;
        this.tickCount = 0;
        this.officerRotation = [];

        this.base = this.rect(0, 0, 100, 100, BG);
        this.screen = this.container();
        this.overlay = this.container();
        this.anchorLayer = this.container();
        this.base.addChildren(this.screen, this.overlay, this.anchorLayer);

        this.renderLobby();
    }

    getLayers() {
        return [{ root: this.base }];
    }

    canAddPlayer() {
        return Object.keys(this.players).length < MAX_PLAYERS;
    }

    // ---- helpers ----

    container() {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
    }

    rect(x, y, w, h, fill, opts = {}) {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill,
            color: opts.color || [255, 255, 255, 255],
            ...opts
        });
    }

    text(str, x, y, size, color, align = 'left', playerIds) {
        return new GameNode.Text({
            textInfo: { text: str, x, y, size, align, font: 'monospace', color },
            playerIds
        });
    }

    glowText(str, x, y, size, color, gc, playerIds) {
        const nodes = [];
        [[-0.2, 0], [0.2, 0], [0, -0.15], [0, 0.15]].forEach(o => {
            nodes.push(this.text(str, x + o[0], y + o[1], size, [gc[0], gc[1], gc[2], 120], 'center', playerIds));
        });
        nodes.push(this.text(str, x, y, size, color, 'center', playerIds));
        return nodes;
    }

    setNodePlayerIds(node, playerIds) {
        node.node.playerIds = playerIds;
        (node.node.children || []).forEach(c => this.setNodePlayerIds(c, playerIds));
    }

    playerName(pid) {
        return String((this.players[pid] && this.players[pid].name) || ('PLAYER ' + pid)).toUpperCase().slice(0, 12);
    }

    colorOf(pid) {
        return this.playerColors[pid] || PALETTE[0];
    }

    assignColor(pid) {
        const used = new Set(Object.values(this.playerColors).map(c => c.name));
        this.playerColors[pid] = PALETTE.find(c => !used.has(c.name)) || PALETTE[pid % PALETTE.length];
    }

    makeButton(label, x, y, w, h, fill, onClick, playerIds) {
        const btn = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill: CARD,
            color: fill,
            border: 6,
            effects: glow(fill, 10),
            onClick,
            playerIds
        });
        btn.addChild(this.text(label, x + w / 2, y + h / 2 - 1.2, 2, fill, 'center', playerIds), false);
        return btn;
    }

    clearScreen() {
        this.screen.clearChildren();
        this.overlay.clearChildren();
    }

    dirty() {
        this.base.node.onStateChange();
    }

    discussDuration() {
        const act = this.roundDef && this.roundDef.act;
        return (act >= 3 ? DISCUSS_SEC_ACT3 : DISCUSS_SEC) * TICK_RATE;
    }

    // ---- lobby ----

    renderLobby() {
        this.phase = 'lobby';
        this.clearScreen();

        this.glowText('THE ARGUMENT', 50, 8, 5, INK, CYAN).forEach(n => this.screen.addChild(n, false));
        this.screen.addChild(this.text('COMPLIANCE MODULE 7', 50, 14, 2, FAINT, 'center'), false);

        const how = [
            'EVERYONE GETS A DIFFERENT BRIEFING',
            'ARGUE. COMMIT. SEE WHO WAS TOLD WHAT.',
            '2 TRUST TOKENS EACH — USE WISELY',
            `${MIN_PLAYERS}-${MAX_PLAYERS} PLAYERS · ~30 MIN`
        ];
        how.forEach((line, i) => this.screen.addChild(this.text(line, 50, 20 + i * 3.5, 1.6, FAINT, 'center'), false));

        this.lobbyList = this.container();
        this.screen.addChild(this.lobbyList, false);

        this.joinBtn = this.makeButton('JOIN COMMITTEE', 25, 58, 50, 9, CYAN, (pid) => {
            if (this.phase !== 'lobby' || this.joined.includes(pid)) return;
            this.joined.push(pid);
            this.assignColor(pid);
            this.trustTokens[pid] = TRUST_TOKENS;
            this.updateLobby();
        });

        this.startBtn = this.makeButton('BEGIN MODULE', 25, 70, 50, 9, GOOD, (pid) => {
            if (this.phase !== 'lobby' || !this.joined.includes(pid)) return;
            if (this.joined.length < MIN_PLAYERS) {
                this.flash(`NEED ${MIN_PLAYERS}+ PLAYERS`, pid);
                return;
            }
            this.startSession();
        });

        this.screen.addChildren(this.joinBtn, this.startBtn);
        this.updateLobby();
    }

    updateLobby() {
        if (this.phase !== 'lobby') return;
        this.lobbyList.clearChildren();
        if (!this.joined.length) {
            this.lobbyList.addChild(this.text('NO COMMITTEE YET — TAP JOIN', 50, 42, 1.8, FAINT, 'center'), false);
        } else {
            this.joined.forEach((pid, i) => {
                const c = this.colorOf(pid);
                const y = 36 + i * 4.5;
                this.lobbyList.addChild(this.rect(22, y, 2.5, 2.5, c.color, { effects: glow(c.color, 8) }), false);
                this.lobbyList.addChild(this.text(this.playerName(pid), 26, y + 0.3, 1.7, INK), false);
                this.lobbyList.addChild(this.text('YOU', 50, y + 0.3, 1.4, GOLD, 'left', [pid]), false);
            });
        }
        const connected = Object.keys(this.players).map(Number);
        const unjoined = connected.filter(pid => !this.joined.includes(pid));
        this.setNodePlayerIds(this.joinBtn, unjoined.length ? unjoined : [0]);
        this.setNodePlayerIds(this.startBtn, this.joined.length ? this.joined.slice() : [0]);
        this.dirty();
    }

    flash(msg, playerId) {
        this.overlay.clearChildren();
        this.glowText(msg, 50, 50, 2.2, CORAL, CORAL, playerId ? [playerId] : undefined).forEach(n => this.overlay.addChild(n, false));
        this.phaseTicks = 3 * TICK_RATE;
        this.dirty();
    }

    // ---- session ----

    startSession() {
        this.participants = this.joined.slice(0, MAX_PLAYERS);
        this.officerRotation = shuffled(this.participants.slice());
        this.roundIndex = 0;
        this.health = 100;
        this.audit = 0;
        this.history = [];
        this.trustLog = [];
        this.participants.forEach(pid => {
            this.trustTokens[pid] = TRUST_TOKENS;
        });
        this.loadRound();
    }

    loadRound() {
        if (this.roundIndex >= ROUND_SCRIPT.length) {
            this.renderDebrief();
            return;
        }

        this.roundDef = ROUND_SCRIPT[this.roundIndex];
        this.roundData = setupRound(this.roundDef, this.participants, {
            roundIndex: this.roundIndex,
            health: this.health,
            officerRotation: this.officerRotation
        });
        this.briefings = this.roundData.briefings;
        this.commits = {};
        this.commitLocked = {};
        this.trustUsedThisRound = false;
        this.trustReveal = null;
        this.lastResult = null;

        this.phase = 'briefing';
        this.phaseTicks = BRIEFING_SEC * TICK_RATE;
        this.renderRoundShell();
    }

    renderRoundShell() {
        this.clearScreen();
        this.renderMeters();
        this.renderPrivateBriefing();
        this.renderSharedSituation();
        this.renderPhaseUi();
        this.dirty();
    }

    renderMeters() {
        const hx = 3;
        const hy = 2;
        this.screen.addChild(this.text('COMPANY HEALTH', hx, hy, 1.2, FAINT), false);
        this.screen.addChild(this.rect(hx, hy + 2.2, 40, 2.5, [40, 45, 55, 255]), false);
        const hw = Math.max(0, Math.min(40, (this.health / 100) * 40));
        const hColor = this.health >= 50 ? GOOD : this.health >= 25 ? GOLD : BAD;
        this.healthBar = this.rect(hx, hy + 2.2, hw, 2.5, hColor, { effects: glow(hColor, 6) });
        this.screen.addChild(this.healthBar, false);
        this.screen.addChild(this.text(String(Math.round(this.health)), hx + 41, hy + 2, 1.3, INK), false);

        this.screen.addChild(this.text('AUDIT', 55, hy, 1.2, FAINT), false);
        const ah = Math.min(25, this.audit);
        this.screen.addChild(this.rect(55, hy + 2.2, 3, 25, [40, 45, 55, 255]), false);
        const aColor = this.audit >= 50 ? BAD : this.audit >= 25 ? GOLD : FAINT;
        this.screen.addChild(this.rect(55, hy + 2.2 + (25 - ah), 3, ah, aColor, { effects: glow(aColor, 6) }), false);
    }

    renderPrivateBriefing() {
        const participants = this.participants;
        participants.forEach(pid => {
            const b = this.briefings[pid];
            if (!b) return;
            const col = this.colorOf(pid).color;
            const panel = this.rect(2, 10, 28, 38, PANEL, {
                color: CYAN,
                border: 4,
                effects: glow(CYAN, 8),
                playerIds: [pid]
            });
            panel.addChild(this.text('YOUR BRIEFING', 16, 11.5, 1.5, CYAN, 'center', [pid]), false);
            panel.addChild(this.text(`P${pid}`, 16, 14, 1.2, col, 'center', [pid]), false);
            (b.lines || []).slice(0, 5).forEach((line, i) => {
                panel.addChild(this.text(line.slice(0, 38), 3, 17 + i * 4.5, 1.35, INK, 'left', [pid]), false);
            });
            const tokens = this.trustTokens[pid] || 0;
            panel.addChild(this.text(`TRUST ●`.repeat(tokens) + `○`.repeat(Math.max(0, TRUST_TOKENS - tokens)), 16, 44, 1.2, GOLD, 'center', [pid]), false);
            this.screen.addChild(panel, false);
        });
    }

    renderSharedSituation() {
        const sit = this.roundData.situation;
        const title = this.roundDef.title + (this.roundDef.systemLine ? '' : '');
        this.screen.addChild(this.text(title, 50, 10, 2.2, GOLD, 'center'), false);
        this.screen.addChild(this.text(sit.prompt, 50, 14, 2.8, INK, 'center'), false);
        this.screen.addChild(this.text(sit.sub, 50, 18.5, 1.5, FAINT, 'center'), false);

        if (sit.logLines) {
            sit.logLines.forEach((line, i) => {
                this.screen.addChild(this.text(`${i + 1}. ${line}`, 50, 24 + i * 3.5, 1.4, INK, 'center'), false);
            });
        }
        if (sit.slotHint) {
            this.screen.addChild(this.text(sit.slotHint, 50, 38, 1.2, FAINT, 'center'), false);
        }
        if (sit.officerId) {
            this.screen.addChild(this.text(`OFFICER: PLAYER ${sit.officerId}`, 50, 42, 1.6, CORAL, 'center'), false);
        }
        if (sit.hiddenNote) {
            this.screen.addChild(this.text(sit.hiddenNote, 50, 46, 1.3, GOLD, 'center'), false);
        }
        if (this.roundDef.systemLine && this.phase === 'briefing') {
            this.screen.addChild(this.text(this.roundDef.systemLine, 50, 48, 1.3, CYAN, 'center'), false);
        }
    }

    renderPhaseUi() {
        this.phaseLayer = this.container();
        this.screen.addChild(this.phaseLayer, false);

        if (this.phase === 'briefing') {
            this.phaseLayer.addChild(this.text('READ YOUR BRIEFING', 50, 52, 2, CYAN, 'center'), false);
            this.timerLabel = this.text('', 50, 56, 1.8, FAINT, 'center');
            this.phaseLayer.addChild(this.timerLabel, false);
        } else if (this.phase === 'discussion') {
            this.phaseLayer.addChild(this.text('DISCUSSION — USE YOUR WORDS', 50, 52, 2, CYAN, 'center'), false);
            this.timerBarBg = this.rect(20, 58, 60, 2, [40, 45, 55, 255]);
            this.timerBar = this.rect(20, 58, 60, 2, CYAN, { effects: glow(CYAN, 6) });
            this.phaseLayer.addChildren(this.timerBarBg, this.timerBar);
            this.renderTrustButtons();
        } else if (this.phase === 'trust_reveal') {
            this.renderTrustOverlay();
        } else if (this.phase === 'commit') {
            this.phaseLayer.addChild(this.text('COMMIT YOUR CHOICE', 50, 50, 2, CORAL, 'center'), false);
            this.renderCommitButtons();
            this.timerLabel = this.text('', 50, 88, 1.6, FAINT, 'center');
            this.phaseLayer.addChild(this.timerLabel, false);
        } else if (this.phase === 'reveal') {
            this.renderReveal();
        } else if (this.phase === 'resolve') {
            this.renderResolve();
        }
    }

    renderTrustButtons() {
        this.participants.forEach(pid => {
            const tokens = this.trustTokens[pid] || 0;
            if (tokens <= 0 || this.trustUsedThisRound) return;
            this.phaseLayer.addChild(this.makeButton('USE TRUST', 2, 50, 26, 6, GOLD, (p) => {
                if (Number(p) !== Number(pid)) return;
                this.invokeTrust(pid);
            }, [pid]), false);
        });
    }

    invokeTrust(pid) {
        if (this.phase !== 'discussion' || this.trustUsedThisRound) return;
        if ((this.trustTokens[pid] || 0) <= 0) return;

        this.trustTokens[pid]--;
        this.trustUsedThisRound = true;
        this.trustReveal = { spender: pid, ticks: TRUST_SEC * TICK_RATE };
        this.trustLog.push({ round: this.roundIndex, playerId: pid });
        this.phase = 'trust_reveal';
        this.phaseTicks = TRUST_SEC * TICK_RATE;

        const bonus = this.roundDef.act < 3 ? TRUST_BONUS_SEC * TICK_RATE : 0;
        this.discussTicksLeft = (this.discussTicksLeft || 0) + bonus;

        this.renderRoundShell();
    }

    renderTrustOverlay() {
        const pid = this.trustReveal && this.trustReveal.spender;
        const b = this.briefings[pid];
        this.overlay.clearChildren();
        this.overlay.addChild(this.rect(5, 15, 90, 70, [0, 0, 0, 200]), false);
        this.glowText('TRUST PROTOCOL ENGAGED', 50, 18, 2.5, GOLD, GOLD).forEach(n => this.overlay.addChild(n, false));
        this.overlay.addChild(this.text(`PLAYER ${pid} — FULL BRIEFING DISCLOSURE`, 50, 23, 1.8, CYAN, 'center'), false);
        (b && b.lines || ['(no briefing on file)']).forEach((line, i) => {
            this.overlay.addChild(this.text(line.slice(0, 55), 50, 28 + i * 4, 1.6, INK, 'center'), false);
        });

        if (this.roundDef.act >= 2) {
            this.overlay.addChild(this.text('OTHER BRIEFINGS (SUMMARY)', 50, 52, 1.5, FAINT, 'center'), false);
            let y = 56;
            this.participants.forEach(other => {
                if (other === pid) return;
                const ob = this.briefings[other];
                const snippet = (ob && ob.lines && ob.lines[0] || '...').slice(0, 42);
                this.overlay.addChild(this.text(`P${other}: "${snippet}..."`, 50, y, 1.2, FAINT, 'center'), false);
                y += 3;
            });
        }

        const sec = Math.ceil((this.phaseTicks || 0) / TICK_RATE);
        this.overlay.addChild(this.text(`${sec}s`, 50, 80, 2, GOLD, 'center'), false);
    }

    renderCommitButtons() {
        const opts = this.roundData.situation.options;
        const n = opts.length;
        const w = Math.min(18, 70 / n);
        const gap = 1.5;
        const total = n * w + (n - 1) * gap;
        let x = 50 - total / 2;

        opts.forEach(opt => {
            this.phaseLayer.addChild(this.makeButton(opt, x, 62, w, 10, CYAN, (pid) => {
                this.lockCommit(pid, opt);
            }), false);
            x += w + gap;
        });

        this.commitStatus = this.text('', 50, 78, 1.4, FAINT, 'center');
        this.phaseLayer.addChild(this.commitStatus, false);
        this.updateCommitStatus();
    }

    lockCommit(pid, choice) {
        if (this.phase !== 'commit') return;
        if (this.roundData.situation.officerId && Number(pid) !== Number(this.roundData.situation.officerId)) {
            this.commits[pid] = choice;
            this.commitLocked[pid] = true;
            this.updateCommitStatus();
            return;
        }
        if (this.roundData.situation.officerId && Number(pid) === Number(this.roundData.situation.officerId)) {
            this.commits = { [pid]: choice };
            this.commitLocked[pid] = true;
            this.finishCommit();
            return;
        }
        this.commits[pid] = choice;
        this.commitLocked[pid] = true;
        const allDone = this.participants.every(p => this.commitLocked[p]);
        if (allDone) this.finishCommit();
        else this.updateCommitStatus();
    }

    updateCommitStatus() {
        if (!this.commitStatus) return;
        const n = this.participants.filter(p => this.commitLocked[p]).length;
        this.commitStatus.node.text = `${n}/${this.participants.length} committed`;
        this.dirty();
    }

    finishCommit() {
        this.phase = 'resolve';
        this.phaseTicks = 2 * TICK_RATE;
        this.lastResult = this.roundData.resolve(this.commits, this.participants);
        this.lastResult.commentary = systemCommentary(this.lastResult, this.roundDef);
        this.health = Math.max(0, Math.min(100, this.health + (this.lastResult.health || 0)));
        this.audit = Math.max(0, Math.min(100, this.audit + (this.lastResult.audit || 0)));

        if (this.trustUsedThisRound && this.lastResult.health < 0) {
            this.audit += 5;
        } else if (this.trustUsedThisRound && this.lastResult.health > 0) {
            this.audit = Math.max(0, this.audit - 5);
        }

        this.history.push({
            round: this.roundDef,
            briefings: JSON.parse(JSON.stringify(this.briefings)),
            commits: { ...this.commits },
            result: { ...this.lastResult }
        });

        this.renderRoundShell();
    }

    renderResolve() {
        const r = this.lastResult;
        this.phaseLayer.addChild(this.text('OUTCOME LOGGED', 50, 52, 2.2, CORAL, 'center'), false);
        this.phaseLayer.addChild(this.text(r.note || '', 50, 57, 1.7, INK, 'center'), false);
        this.phaseLayer.addChild(this.text(r.detail || '', 50, 62, 1.4, FAINT, 'center'), false);
    }

    renderReveal() {
        this.phaseLayer.addChild(this.text('WHAT THE SYSTEM TOLD YOU', 50, 50, 2, GOLD, 'center'), false);

        const cols = Math.min(this.participants.length, 4);
        const colW = 90 / cols;
        this.participants.forEach((pid, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = 5 + col * colW;
            const y = 54 + row * 22;
            const c = this.colorOf(pid).color;
            const panel = this.rect(x, y, colW - 1, 20, PANEL, { color: c, border: 3, playerIds: [] });
            panel.addChild(this.text(`P${pid}`, x + (colW - 1) / 2, y + 1, 1.3, c, 'center'), false);
            const lines = (this.briefings[pid] && this.briefings[pid].lines) || [];
            panel.addChild(this.text(lines[0] ? lines[0].slice(0, 22) : '—', x + 1, y + 4, 1.05, INK), false);
            panel.addChild(this.text(lines[1] ? lines[1].slice(0, 22) : '', x + 1, y + 7.5, 1.05, FAINT), false);
            const choice = this.commits[pid] || '—';
            panel.addChild(this.text(`→ ${choice}`, x + 1, y + 12, 1.2, GOLD), false);
            panel.addChild(this.text('YOU', x + colW - 4, y + 1, 1, GOLD, 'center', [pid]), false);
            this.phaseLayer.addChild(panel, false);
        });

        if (this.lastResult) {
            this.phaseLayer.addChild(this.text(this.lastResult.commentary || '', 50, 92, 1.2, FAINT, 'center'), false);
        }

        this.timerLabel = this.text('(advancing...)', 50, 96, 1.2, FAINT, 'center');
        this.phaseLayer.addChild(this.timerLabel, false);
    }

    renderDebrief() {
        this.phase = 'debrief';
        this.clearScreen();

        this.glowText('SESSION COMPLETE', 50, 6, 4, INK, CYAN).forEach(n => this.screen.addChild(n, false));

        let ending;
        if (this.health >= 80) ending = 'HARMONIOUS MERGER — The System admits it lied for engagement.';
        else if (this.health >= 40) ending = 'HOSTILE TAKEOVER — You survived. Barely.';
        else ending = 'DISSOLVED — Compliance failed. HR is unavailable.';

        this.screen.addChild(this.text(ending, 50, 12, 1.7, GOLD, 'center'), false);
        this.screen.addChild(this.text(`FINAL HEALTH: ${Math.round(this.health)} · AUDIT: ${this.audit}`, 50, 16, 1.5, INK, 'center'), false);
        this.screen.addChild(this.text(`TRUST INVOKED: ${this.trustLog.length} TIMES`, 50, 20, 1.4, FAINT, 'center'), false);

        this.screen.addChild(this.text('INCIDENT LOG', 50, 25, 1.8, CYAN, 'center'), false);
        this.history.slice(0, 8).forEach((h, i) => {
            const line = `${h.round.title}: ${h.result.choice || '?'} (${h.result.health > 0 ? '+' : ''}${h.result.health || 0} HP)`;
            this.screen.addChild(this.text(line, 50, 29 + i * 3, 1.25, FAINT, 'center'), false);
        });

        this.screen.addChild(this.makeButton('PLAY AGAIN', 30, 88, 40, 8, GOOD, (pid) => {
            if (!this.joined.includes(pid)) return;
            this.renderLobby();
        }), false);
        this.dirty();
    }

    advancePhase() {
        if (this.phase === 'briefing') {
            this.phase = 'discussion';
            this.discussTicksLeft = this.discussDuration();
            this.renderRoundShell();
        } else if (this.phase === 'discussion') {
            this.phase = 'commit';
            this.phaseTicks = COMMIT_SEC * TICK_RATE;
            this.renderRoundShell();
        } else if (this.phase === 'trust_reveal') {
            this.phase = 'discussion';
            this.trustReveal = null;
            this.overlay.clearChildren();
            this.renderRoundShell();
        } else if (this.phase === 'commit') {
            this.participants.forEach(pid => {
                if (!this.commits[pid] && this.roundData.situation.options.length) {
                    this.commits[pid] = this.roundData.situation.options[0];
                }
            });
            this.finishCommit();
        } else if (this.phase === 'resolve') {
            this.phase = 'reveal';
            this.phaseTicks = REVEAL_SEC * TICK_RATE;
            this.renderRoundShell();
        } else if (this.phase === 'reveal') {
            this.roundIndex++;
            if (this.health <= 0 && this.roundDef.act < 4) {
                this.flash('HEALTH CRITICAL — FINALE FORCED', null);
            }
            this.loadRound();
        }
    }

    tick() {
        this.tickCount++;

        if (this.phase === 'lobby') return;

        if (this.overlay.node.children.length && this.phase !== 'trust_reveal' && this.phaseTicks > 0) {
            this.phaseTicks--;
            if (this.phaseTicks <= 0) this.overlay.clearChildren();
            this.dirty();
            return;
        }

        if (this.phase === 'briefing') {
            this.phaseTicks--;
            if (this.timerLabel) {
                this.timerLabel.node.text.text = `${Math.ceil(this.phaseTicks / TICK_RATE)}s`;
            }
            if (this.phaseTicks <= 0) this.advancePhase();
        } else if (this.phase === 'discussion') {
            this.discussTicksLeft--;
            if (this.timerBar) {
                const total = this.discussDuration();
                const frac = Math.max(0, this.discussTicksLeft / total);
                this.timerBar.node.coordinates2d = ShapeUtils.rectangle(20, 58, 60 * frac, 2);
            }
            if (this.discussTicksLeft <= 0) this.advancePhase();
        } else if (this.phase === 'trust_reveal') {
            this.phaseTicks--;
            if (this.phaseTicks <= 0) this.advancePhase();
            else this.renderTrustOverlay();
        } else if (this.phase === 'commit') {
            this.phaseTicks--;
            if (this.timerLabel) {
                this.timerLabel.node.text.text = `commit: ${Math.ceil(this.phaseTicks / TICK_RATE)}s`;
            }
            if (this.phaseTicks <= 0) this.advancePhase();
        } else if (this.phase === 'resolve') {
            this.phaseTicks--;
            if (this.phaseTicks <= 0) this.advancePhase();
        } else if (this.phase === 'reveal') {
            this.phaseTicks--;
            if (this.phaseTicks <= 0) this.advancePhase();
        }

        this.dirty();
    }

    handleNewPlayer({ playerId, info }) {
        this.players[playerId] = { name: (info && info.name) || ('PLAYER ' + playerId) };
        if (!this.anchors[playerId]) {
            this.anchors[playerId] = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                playerIds: [playerId]
            });
            this.anchorLayer.addChild(this.anchors[playerId], false);
        }
        if (this.phase === 'lobby') this.updateLobby();
        else this.flash('NEXT MODULE — YOU ARE SPECTATING', playerId);
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
        this.joined = this.joined.filter(p => p !== playerId);
        this.participants = this.participants.filter(p => p !== playerId);
        if (this.anchors[playerId]) {
            this.anchorLayer.removeChild(this.anchors[playerId].id);
            delete this.anchors[playerId];
        }
        if (this.phase === 'lobby') this.updateLobby();
    }
}

module.exports = TheArgument;
