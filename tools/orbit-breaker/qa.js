// Development-only browser harness. Not included in the game or offline build.
// Exercises navigator -> Homepad -> InputHandler -> LocalDispatcher -> game.
const raw = { id: 'Orbit Breaker QA Standard Controller', index: 0, connected: true, mapping: 'standard',
    axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
let connected = false, pilot = false;
const setButton = (i, down) => { raw.buttons[i] = { pressed: !!down, value: down ? 1 : 0 }; };
const press = i => { setButton(i, true); setTimeout(() => setButton(i, false), 130); };
const neutral = () => { raw.axes = [0, 0, 0, 0]; raw.buttons.forEach((_, i) => setButton(i, false)); };
function segmentDistance(x, y, xx, yy, p) {
    const dx = xx - x, dy = yy - y, len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((p.x - x) * dx + (p.y - y) * dy) / len)) : 0;
    return Math.hypot(p.x - x - dx * t, p.y - y - dy * t);
}
Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => {
    if (pilot && window.orbitBreakerSession?.game) {
        const e = window.orbitBreakerSession.game.engine; neutral();
        if (e.phase === 'title' || e.phase === 'upgrade') setButton(0, true);
        else if (e.phase === 'play' && !e.paused) {
            const p = e.player, target = e.enemies.filter(v => v.hp > 0).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
            const incoming = e.bullets.filter(b => segmentDistance(b.x, b.y, b.x + b.vx * .4, b.y + b.vy * .4, p) < 7)
                .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
            const aim = incoming || target || { x: p.x + 1, y: p.y }, angle = Math.atan2(aim.y - p.y, aim.x - p.x);
            const t = e.time * .42, dx = 67 + Math.cos(t) * 33 - p.x, dy = 47 + Math.sin(t) * 21 - p.y, len = Math.max(3, Math.hypot(dx, dy));
            raw.axes = [dx / len, dy / len, Math.cos(angle), Math.sin(angle)];
            setButton(6, true); setButton(7, !incoming || p.orbit.length > 0);
            setButton(5, e.beams.some(b => b.age > b.duration - .2 && segmentDistance(b.x, b.y, b.x + Math.cos(b.angle) * 160, b.y + Math.sin(b.angle) * 160, p) < 5));
            setButton(4, p.energy >= 100 && e.enemies.length > 1);
        }
    }
    return connected ? [raw] : [];
} });
const panel = document.createElement('div');
panel.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10;background:#18222a;color:white;font:11px monospace;display:flex;gap:5px;align-items:center';
document.body.appendChild(panel);
const button = (name, action) => { const b = document.createElement('button'); b.textContent = name; b.onclick = action; panel.appendChild(b); };
button('Connect pad', () => { connected = true; });
button('A', () => press(0)); button('START', () => press(9)); button('D-pad right', () => press(15));
button('Move and aim', () => { raw.axes = [1, 0, 0, -1]; setTimeout(() => { raw.axes = [0, 0, 1, 0]; }, 900); });
button('Catch', () => setButton(6, !raw.buttons[6].pressed)); button('Fire', () => setButton(7, !raw.buttons[7].pressed));
button('Disconnect', () => { pilot = false; connected = false; neutral(); });
button('Run pilot', () => { const g = window.orbitBreakerSession.game; g.action('title'); g.engine.seed = 2; connected = true; pilot = true; });
button('Boss scene', () => { const g = window.orbitBreakerSession.game; g.action('start'); g.engine.sector = 2; g.engine.enterSector(); connected = true; pilot = true; });
button('Upgrade scene', () => { pilot = false; neutral(); window.orbitBreakerSession.game.engine.completeSector(); });
const status = document.createElement('output'); status.id = 'qa-status';
status.style.cssText = 'position:fixed;bottom:0;left:0;background:#18222a;color:#afffe1;font:11px monospace;z-index:10;padding:3px';
document.body.appendChild(status);
setInterval(() => {
    const s = window.orbitBreakerSession; if (!s?.game) return;
    const e = s.game.engine;
    status.textContent = JSON.stringify({ phase: e.phase, paused: e.paused, sector: e.sector + 1, time: Math.round(e.time),
        training: e.training, catches: e.stats.catches, returns: e.stats.returns, kills: e.stats.kills, hull: e.player.hp,
        shapes: s.game.painter.si, overflow: s.game.painter.overflow,
        decodedSounds: Object.values(s.assetManager.assets).filter(a => a.decoded).length, audio: s.assetManager.audioCtx?.state });
}, 200);
