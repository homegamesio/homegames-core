let squish;
try { if (typeof require === 'function') squish = require('squish'); } catch (e) {}
if (!squish && typeof globalThis !== 'undefined') squish = globalThis.squish;
if (!squish && typeof window !== 'undefined') squish = window.squish;

let Base = (squish && squish.Game) || null;
if (!Base || typeof Base !== 'function' || !Base.prototype) {
  if (typeof squish === 'function' && squish.prototype) Base = squish;
  else Base = class {};
}

function assign(target, source) {
  if (!source) return target;
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
  }
  return target;
}

function mergeInput(target, source) {
  if (!source) return target;
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const v = source[key];
      if (v !== null && v !== undefined) target[key] = v;
    }
  }
  return target;
}

function createGameState() {
  return {
    _width: 800,
    _height: 600,
    _input: {},
    score: 0,
    lives: 3,
    state: 'playing',
    time: 0,
    spawnTimer: 0.6,
    items: [],
    particles: [],
    bgHearts: [],
    catcherX: 400,
    flash: 0,
    gameOverTimer: 0,
    _lastDt: 1 / 60,
    _updating: false,
    _rendering: false
  };
}

module.exports = class Game extends Base {
  constructor(...args) {
    try { super(...args); } catch (e) {
      const obj = assign(Object.create(Game.prototype), createGameState());
      obj._initBgHearts();
      try { obj.input = obj._input; } catch (e2) {}
      return obj;
    }

    assign(this, createGameState());
    this._initBgHearts();
    try { this.input = this._input; } catch (e) {}

    try {
      if (typeof this.on === 'function') {
        const self = this;
        ['input', 'pointer', 'mouse', 'key'].forEach(function (ev) {
          try { self.on(ev, function (data) { self.setInput(data); }); } catch (e2) {}
        });
      }
    } catch (e) {}

    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        const self = this;
        const updateMouse = function (e) {
          let x = e.clientX;
          let y = e.clientY;
          try {
            if (self.canvas && self.canvas.getBoundingClientRect) {
              const r = self.canvas.getBoundingClientRect();
              x = e.clientX - r.left;
              y = e.clientY - r.top;
              if (r.width > 0) x *= self._width / r.width;
              if (r.height > 0) y *= self._height / r.height;
            } else if (window.innerWidth > 0 && window.innerHeight > 0) {
              x = e.clientX * self._width / window.innerWidth;
              y = e.clientY * self._height / window.innerHeight;
            }
          } catch (err) {}
          if (isFinite(x)) self.setInput({ mouseX: x });
          if (isFinite(y)) self.setInput({ mouseY: y });
        };

        window.addEventListener('pointermove', updateMouse);
        window.addEventListener('mousemove', updateMouse);
        window.addEventListener('pointerdown', function (e) { self.setInput({ mouseDown: true }); updateMouse(e); });
        window.addEventListener('pointerup', function () { self.setInput({ mouseDown: false }); });
      }
    } catch (e) {}
  }

  _initBgHearts() {
    this.bgHearts = [];
    for (let i = 0; i < 16; i++) {
      this.bgHearts.push({
        x: Math.random(),
        y: Math.random(),
        s: 8 + Math.random() * 16,
        speed: 0.02 + Math.random() * 0.05,
        alpha: 0.12 + Math.random() * 0.18
      });
    }
  }

  _setSize(width, height) {
    if (width > 0) this._width = width;
    if (height > 0) this._height = height;
    try { this.width = this._width; } catch (e) {}
    try { this.height = this._height; } catch (e) {}
  }

  _getDims(...args) {
    let ctx = null;
    let width = this._width || 0;
    let height = this._height || 0;

    try { if (!width && typeof this.width === 'number') width = this.width; } catch (e) {}
    try { if (!height && typeof this.height === 'number') height = this.height; } catch (e) {}

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (!a) continue;
      if (typeof a === 'object') {
        if (!ctx && (typeof a.fillRect === 'function' || typeof a.fill === 'function' || typeof a.stroke === 'function')) ctx = a;
        else if (!ctx && typeof a.getContext === 'function') {
          try { const c = a.getContext('2d'); if (c) ctx = c; } catch (e) {}
        }
        try { if (!width && typeof a.width === 'number') width = a.width; } catch (e) {}
        try { if (!height && typeof a.height === 'number') height = a.height; } catch (e) {}
      }
    }

    if (typeof args[0] === 'object' && args[0]) {
      if (typeof args[1] === 'number') width = args[1];
      if (typeof args[2] === 'number') height = args[2];
    } else if (typeof args[0] === 'number') {
      width = args[0];
      if (typeof args[1] === 'number') height = args[1];
    }

    if (!ctx) { try { if (this.ctx && typeof this.ctx.fillRect === 'function') ctx = this.ctx; } catch (e) {} }
    if (!ctx) { try { if (this.context && typeof this.context.fillRect === 'function') ctx = this.context; } catch (e) {} }
    if (!ctx) { try { if (this.canvas && typeof this.canvas.getContext === 'function') ctx = this.canvas.getContext('2d'); } catch (e) {} }

    if (ctx && ctx.canvas) {
      try { if (!width) width = ctx.canvas.width; } catch (e) {}
      try { if (!height) height = ctx.canvas.height; } catch (e) {}
    }

    if (ctx) { try { if (!this.ctx) this.ctx = ctx; } catch (e) {} }

    if (!width || width <= 0) width = 800;
    if (!height || height <= 0) height = 600;

    this._setSize(width, height);
    return [ctx, width, height];
  }

  _update(...args) {
    if (this._updating) return;
    this._updating = true;

    try {
      if (Base.prototype && typeof Base.prototype.update === 'function') {
        try { super.update(...args); } catch (e) {}
      }

      let dt = typeof args[0] === 'number' ? args[0] : (typeof this._lastDt === 'number' ? this._lastDt : 1 / 60);
      if (!(dt > 0)) dt = 1 / 60;
      if (dt > 0.25) dt = 0.25;
      this._lastDt = dt;

      const width = this._width || 800;
      const height = this._height || 600;

      try {
        this.time += dt;
        if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.5);

        for (let i = 0; i < this.bgHearts.length; i++) {
          const h = this.bgHearts[i];
          h.y -= h.speed * dt;
          if (h.y < -0.12) {
            h.y = 1.12;
            h.x = Math.random();
          }
        }

        const input = this._getInput();

        if (this.state === 'playing') {
          let moved = false;
          const keys = input.keys || {};

          let left = !!(keys['ArrowLeft'] || keys.left || keys.a || keys.A);
          let right = !!(keys['ArrowRight'] || keys.right || keys.d || keys.D);

          if (input.key) {
            if (input.key === 'ArrowLeft' || input.key === 'a' || input.key === 'A') left = true;
            if (input.key === 'ArrowRight' || input.key === 'd' || input.key === 'D') right = true;
          }

          if (left || right) {
            this.catcherX += ((right ? 1 : 0) - (left ? 1 : 0)) * 680 * dt;
            moved = true;
          }

          if (!moved && input.mouseX != null) {
            const mx = Number(input.mouseX);
            if (isFinite(mx)) {
              let target = mx;
              const my = input.mouseY != null ? Number(input.mouseY) : NaN;
              if (target <= 1 && (!isFinite(my) || my <= 1)) target *= width;
              this.catcherX += (target - this.catcherX) * Math.min(1, dt * 14);
              moved = true;
            }
          }

          if (!moved && input.x != null) {
            const px = Number(input.x);
            if (isFinite(px)) {
              let target = px;
              if (target <= 1) target *= width;
              this.catcherX += (target - this.catcherX) * Math.min(1, dt * 14);
              moved = true;
            }
          }

          if (!moved) {
            this.catcherX = width / 2 + Math.sin(this.time * 1.7) * width * 0.35;
          }

          this.catcherX = Math.max(48, Math.min(width - 48, this.catcherX));

          this.spawnTimer -= dt;
          if (this.spawnTimer <= 0) {
            this._spawnItem(width, height);
            const interval = Math.max(0.32, 1.05 - this.score * 0.004);
            this.spawnTimer = interval * (0.7 + Math.random() * 0.6);
          }
        } else {
          this.gameOverTimer += dt;
          if (this._wantsRestart(input) || this.gameOverTimer > 3.5) this._reset();
        }

        const catcherY = height - 50;

        for (let i = this.items.length - 1; i >= 0; i--) {
          const it = this.items[i];
          it.y += it.speed * dt;
          if (it.rotSpeed) it.rot += it.rotSpeed * dt;

          if (it.y - it.size / 2 > height + 14) {
            this.items.splice(i, 1);
            if (this.state === 'playing') {
              this.lives = Math.max(0, this.lives - 1);
              this.flash = 0.35;
              if (this.lives <= 0) {
                this.state = 'gameover';
                this.gameOverTimer = 0;
              }
            }
            continue;
          }

          if (
            this.state === 'playing' &&
            Math.abs(it.x - this.catcherX) < 52 + it.size * 0.38 &&
            it.y + it.size / 2 >= catcherY - 16 &&
            it.y - it.size / 2 <= catcherY + 20
          ) {
            this.items.splice(i, 1);
            const pts = it.type === 1 ? 3 : 1;
            this.score += pts;
            this._spawnCatchParticles(it.x, it.y, it.type);
          }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i];
          p.life -= dt;
          if (p.life <= 0) {
            this.particles.splice(i, 1);
            continue;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.gravity) p.vy += p.gravity * dt;
        }
      } catch (e) {}
    } finally {
      this._updating = false;
    }
  }

  update(...args) { return this._update(...args); }
  tick(...args) { return this._update(...args); }
  step(...args) { return this._update(...args); }

  _render(...args) {
    if (this._rendering) return;
    this._rendering = true;

    try {
      const dims = this._getDims(...args);

      if (Base.prototype && typeof Base.prototype.draw === 'function') {
        try { super.draw(...args); } catch (e) {}
      }

      let ctx = dims[0];
      try { if (this.ctx && typeof this.ctx.fillRect === 'function') ctx = this.ctx; } catch (e) {}

      const width = dims[1];
      const height = dims[2];

      if (!ctx || typeof ctx.fillRect !== 'function') return;

      let bg = '#1b0724';
      if (typeof ctx.createLinearGradient === 'function') {
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        if (grad) {
          try {
            grad.addColorStop(0, '#240a35');
            grad.addColorStop(0.55, '#3b1046');
            grad.addColorStop(1, '#7a2158');
            ctx.fillStyle = grad;
          } catch (e) {
            ctx.fillStyle = bg;
          }
        } else {
          ctx.fillStyle = bg;
        }
      } else {
        ctx.fillStyle = bg;
      }
      ctx.fillRect(0, 0, width, height);

      try {
        for (const h of this.bgHearts) {
          this._drawHeart(ctx, h.x * width, h.y * height, h.s, '#ff69b4', h.alpha);
        }
      } catch (e) {}

      if (this.flash > 0) {
        try {
          ctx.fillStyle = 'rgba(255,64,96,' + (this.flash * 0.38).toFixed(3) + ')';
          ctx.fillRect(0, 0, width, height);
        } catch (e) {}
      }

      try {
        for (const it of this.items) {
          this._drawAss(ctx, it.x, it.y, it.size, it.type, it.rot, it.color1, it.color2);
        }
      } catch (e) {}

      try {
        this._drawCatcher(ctx, this.catcherX, height - 50);
      } catch (e) {}

      try {
        for (const p of this.particles) {
          const alpha = Math.max(0, Math.min(1, p.life / (p.maxLife || 1)));
          if (p.type === 'heart') this._drawHeart(ctx, p.x, p.y, p.size, p.color, alpha);
          else this._drawSparkle(ctx, p.x, p.y, p.size * 0.7, p.color, alpha);
        }
      } catch (e) {}

      try {
        this._drawHUD(ctx, width, height);
      } catch (e) {}
    } finally {
      this._rendering = false;
    }
  }

  draw(...args) { return this._render(...args); }
  render(...args) { return this._render(...args); }
  paint(...args) { return this._render(...args); }

  setInput(input) {
    if (!input) return;
    if (!this._input) this._input = {};
    this._input = mergeInput(this._input, input);
    try { this.input = this._input; } catch (e) {}
  }

  onInput(input) { return this.setInput(input); }
  handleInput(input) { return this.setInput(input); }
  inputChanged(input) { return this.setInput(input); }

  _getInput() {
    let input = assign({}, this._input);

    try { if (this.input) input = mergeInput(input, this.input); } catch (e) {}

    let players = [];
    try {
      if (Array.isArray(this.players)) players = this.players;
      else if (this.players && typeof this.players.length === 'number') players = Array.prototype.slice.call(this.players);
    } catch (e) {}

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p) continue;

      let src = null;
      try {
        if (p.input) src = p.input;
        else if (p.mouseX != null || p.x != null || p.keys) src = p;
      } catch (e) {}

      if (src) {
        input = mergeInput(input, src);
        break;
      }
    }

    try {
      if (input.mouseX == null && input.x != null) input.mouseX = input.x;
      if (input.mouseY == null && input.y != null) input.mouseY = input.y;
      if (input.mouseX == null && input.pointerX != null) input.mouseX = input.pointerX;
      if (input.mouseY == null && input.pointerY != null) input.mouseY = input.pointerY;
    } catch (e) {}

    return input;
  }

  _wantsRestart(input) {
    if (!input) return false;
    try {
      if (input.mouseDown || input.click || input.tapped || input.pressed || input.pointerDown) return true;
      const k = input.keys || {};
      if (k[' '] || k.space || k.enter || k.Enter || k.r || k.R) return true;
      if (input.key && (input.key === ' ' || input.key === 'Enter' || input.key === 'r' || input.key === 'R')) return true;
    } catch (e) {}
    return false;
  }

  _reset() {
    this.score = 0;
    this.lives = 3;
    this.state = 'playing';
    this.items = [];
    this.particles = [];
    this.spawnTimer = 0.6;
    this.gameOverTimer = 0;
    this.catcherX = (this._width || 800) / 2;
  }

  resize(width, height) {
    try { if (Base.prototype && typeof Base.prototype.resize === 'function') super.resize(width, height); } catch (e) {}
    this._setSize(width || 0, height || 0);
  }

  onResize(width, height) { return this.resize(width, height); }

  onLoad() {
    try { if (Base.prototype && typeof Base.prototype.onLoad === 'function') super.onLoad(); } catch (e) {}
    this._initBgHearts();
  }

  load() { return this.onLoad(); }

  start() {
    try { if (Base.prototype && typeof Base.prototype.start === 'function') super.start(); } catch (e) {}
    this._reset();
  }

  _spawnItem(width, height) {
    const margin = 52;
    const x = margin + Math.random() * Math.max(1, width - margin * 2);
    const size = 30 + Math.random() * 18;
    const type = Math.random() < 0.16 ? 1 : 0;

    let c1, c2;
    if (type === 1) {
      c1 = '#ffd700';
      c2 = '#fff3a1';
    } else {
      const skins = [
        ['#f1c27d', '#e0ac69'],
        ['#ffdbac', '#f1c27d'],
        ['#c68642', '#a56a3a'],
        ['#8d5524', '#6f401c']
      ];
      const s = skins[(Math.random() * skins.length) | 0];
      c1 = s[0];
      c2 = s[1];
    }

    const speed = 135 + Math.min(280, this.score * 1.6) + Math.random() * 90;

    this.items.push({
      x: x,
      y: -size,
      size: size,
      type: type,
      speed: speed,
      color1: c1,
      color2: c2,
      rot: (Math.random() - 0.5) * 0.45,
      rotSpeed: (Math.random() - 0.5) * 1.3
    });
  }

  _spawnCatchParticles(x, y, type) {
    const count = type === 1 ? 14 : 9;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 180;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 130,
        life: 0.55 + Math.random() * 0.55,
        maxLife: 1.1,
        type: Math.random() < 0.45 ? 'heart' : 'sparkle',
        color: type === 1 ? (Math.random() < 0.5 ? '#ffd700' : '#fff') : (Math.random() < 0.5 ? '#ff69b4' : '#fff'),
        size: 5 + Math.random() * 8,
        gravity: -70
      });
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  _ellipsePath(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
      try {
        ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
      } catch (e) {
        ctx.arc(x, y, Math.max(rx, ry), 0, Math.PI * 2);
      }
    } else {
      ctx.arc(x, y, Math.max(rx, ry), 0, Math.PI * 2);
    }
  }

  _drawHeart(ctx, x, y, size, color, alpha) {
    ctx.save();
    try { ctx.globalAlpha = alpha == null ? 1 : Math.max(0, Math.min(1, alpha)); } catch (e) {}
    ctx.fillStyle = color || '#ff3d7f';

    const s = size / 2;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.2, y + s * 0.1, x - s * 0.8, y - s * 0.9, x, y - s * 0.3);
    ctx.bezierCurveTo(x + s * 0.8, y - s * 0.9, x + s * 1.2, y + s * 0.1, x, y + s * 0.9);
    ctx.fill();

    ctx.restore();
  }

  _drawSparkle(ctx, x, y, size, color, alpha) {
    ctx.save();
    try { ctx.globalAlpha = alpha == null ? 1 : Math.max(0, Math.min(1, alpha)); } catch (e) {}

    ctx.strokeStyle = color || '#fff';
    ctx.lineWidth = Math.max(1.5, size * 0.22);
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.stroke();

    ctx.fillStyle = color || '#fff';
    this._ellipsePath(ctx, x, y, size * 0.35, size * 0.35, 0);
    ctx.fill();

    ctx.restore();
  }

  _drawAss(ctx, x, y, size, type, rot, color1, color2) {
    ctx.save();
    ctx.translate(x, y);
    if (rot && typeof ctx.rotate === 'function') ctx.rotate(rot);

    const c1 = color1 || '#f1c27d';
    const c2 = color2 || '#e0ac69';
    const cheek = size * 0.58;

    if (type === 1) {
      try { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 14; } catch (e) {}
    }

    ctx.fillStyle = c1;
    this._ellipsePath(ctx, -cheek * 0.52, 0, cheek, cheek * 1.18, -0.25);
    ctx.fill();

    ctx.fillStyle = c2;
    this._ellipsePath(ctx, cheek * 0.52, 0, cheek, cheek * 1.18, 0.25);
    ctx.fill();

    try { ctx.shadowBlur = 0; } catch (e) {}

    ctx.strokeStyle = 'rgba(60,20,40,0.35)';
    ctx.lineWidth = Math.max(2, size * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, -cheek * 0.75);
    ctx.quadraticCurveTo(size * 0.12, 0, 0, cheek * 0.75);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    this._ellipsePath(ctx, -cheek * 0.72, -cheek * 0.42, cheek * 0.26, cheek * 0.38, -0.4);
    ctx.fill();

    if (type === 1) {
      this._drawSparkle(ctx, cheek * 0.52, -cheek * 0.38, size * 0.26, '#fff', 1);
    } else {
      this._drawHeart(ctx, cheek * 0.52, -cheek * 0.34, size * 0.22, '#ff3d7f', 0.9);
    }

    ctx.restore();
  }

  _drawCatcher(ctx, cx, cy) {
    const cw = 104;
    const ch = 38;
    const x = cx - cw / 2;
    const y = cy - ch / 2;

    ctx.save();

    try { ctx.shadowColor = '#ff69b4'; ctx.shadowBlur = 18; } catch (e) {}

    this._roundRect(ctx, x, y, cw, ch, 20);
    ctx.fillStyle = '#ff69b4';
    ctx.fill();

    try { ctx.shadowBlur = 0; } catch (e) {}

    this._roundRect(ctx, x + 8, y + 8, cw - 16, ch - 16, 14);
    ctx.fillStyle = '#2b0735';
    ctx.fill();

    this._drawHeart(ctx, cx, cy, 20, '#fff', 1);

    ctx.restore();
  }

  _drawHUD(ctx, width, height) {
    ctx.save();

    try { ctx.textAlign = 'left'; } catch (e) {}
    try { ctx.textBaseline = 'top'; } catch (e) {}

    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('ASS CATCHER', 14, 12);

    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#ffd6ec';
    ctx.fillText('Score: ' + this.score, 14, 42);

    const lives = Math.max(0, Math.min(5, this.lives));
    for (let i = 0; i < lives; i++) {
      this._drawHeart(ctx, width - 24 - i * 26, 30, 18, '#ff3d7f', 1);
    }

    if (this.state === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.58)';
      ctx.fillRect(0, 0, width, height);

      try { ctx.textAlign = 'center'; } catch (e) {}

      ctx.font = 'bold 48px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('GAME OVER', width / 2, height / 2 - 46);

      ctx.font = 'bold 30px sans-serif';
      ctx.fillStyle = '#ffd6ec';
      ctx.fillText('Score: ' + this.score, width / 2, height / 2 + 2);

      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('Click / Space to restart', width / 2, height / 2 + 40);
    }

    ctx.restore();
  }
};