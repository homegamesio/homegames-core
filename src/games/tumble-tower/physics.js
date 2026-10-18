// A compact 2-D rigid-body solver for wooden blocks and real toy projectiles.
// Distances are scene units, mass is arbitrary, and impulses are mass * units/s.
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const length = v => Math.hypot(v.x, v.y);
let nextId = 1;

function base(x, y, mass, inertia, options = {}) {
    return { id: nextId++, x, y, angle: 0, vx: 0, vy: 0, spin: 0, mass, inertia,
        fixed: !!options.fixed, sleeping: !!options.sleeping, restTime: 0,
        restitution: options.restitution ?? .13, friction: options.friction ?? .64 };
}
function box(x, y, width, height, fixed = false) {
    const options = typeof fixed === 'object' ? fixed : { fixed };
    const mass = options.mass ?? width * height / 80;
    return { ...base(x, y, mass, mass * (width * width + height * height) / 12, options), shape: 'box', width, height };
}
function circle(x, y, radius, options = {}) {
    const mass = options.mass ?? Math.PI * radius * radius / 80;
    return { ...base(x, y, mass, mass * radius * radius / 2, { restitution: .5, friction: .45, ...options }),
        shape: 'circle', radius, width: radius * 2, height: radius * 2 };
}
function vertices(body) {
    const c = Math.cos(body.angle), s = Math.sin(body.angle);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => ({
        x: body.x + x * body.width / 2 * c - y * body.height / 2 * s,
        y: body.y + x * body.width / 2 * s + y * body.height / 2 * c,
    }));
}
function axis(body) { return [{ x: Math.cos(body.angle), y: Math.sin(body.angle) }, { x: -Math.sin(body.angle), y: Math.cos(body.angle) }]; }
function face(body, direction) {
    const axes = axis(body), dots = axes.map(a => dot(a, direction));
    const index = Math.abs(dots[0]) > Math.abs(dots[1]) ? 0 : 1;
    const n = { x: axes[index].x * Math.sign(dots[index]), y: axes[index].y * Math.sign(dots[index]) };
    const t = axes[1 - index], half = index ? body.height / 2 : body.width / 2;
    const extent = index ? body.width / 2 : body.height / 2;
    const center = { x: body.x + n.x * half, y: body.y + n.y * half };
    return { center, normal: n, tangent: t, extent, points: [
        { x: center.x - t.x * extent, y: center.y - t.y * extent },
        { x: center.x + t.x * extent, y: center.y + t.y * extent },
    ] };
}
function clip(points, normal, limit) {
    if (points.length < 2) return points;
    const distances = points.map(p => dot(p, normal) - limit), result = [];
    if (distances[0] <= 0) result.push(points[0]);
    if (distances[1] <= 0) result.push(points[1]);
    if (distances[0] * distances[1] < 0) {
        const t = distances[0] / (distances[0] - distances[1]);
        result.push({ x: points[0].x + (points[1].x - points[0].x) * t, y: points[0].y + (points[1].y - points[0].y) * t });
    }
    return result;
}
function boxContact(a, b) {
    const av = vertices(a), bv = vertices(b), axes = [...axis(a), ...axis(b)];
    let depth = Infinity, normal, reference = a;
    for (let i = 0; i < axes.length; i++) {
        const n = axes[i], ap = av.map(v => dot(v, n)), bp = bv.map(v => dot(v, n));
        const overlap = Math.min(Math.max(...ap), Math.max(...bp)) - Math.max(Math.min(...ap), Math.min(...bp));
        if (overlap < -.035) return null;
        if (overlap < depth) { depth = overlap; normal = n; reference = i < 2 ? a : b; }
    }
    if (dot(sub(b, a), normal) < 0) normal = { x: -normal.x, y: -normal.y };
    const rn = reference === a ? normal : { x: -normal.x, y: -normal.y };
    const ref = face(reference, rn), incident = face(reference === a ? b : a, { x: -rn.x, y: -rn.y });
    let points = clip(incident.points, ref.tangent, dot(ref.center, ref.tangent) + ref.extent);
    const reverse = { x: -ref.tangent.x, y: -ref.tangent.y };
    points = clip(points, reverse, dot(ref.center, reverse) + ref.extent);
    points = points.filter(p => dot(sub(p, ref.center), rn) <= .04).map(p => {
        const separation = dot(sub(p, ref.center), rn);
        return { x: p.x - rn.x * separation / 2, y: p.y - rn.y * separation / 2 };
    });
    if (!points.length) points = [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }];
    return { normal, depth: Math.max(0, depth), points, point: points[0] };
}
function circleContact(a, b) {
    const delta = sub(b, a), distance = length(delta), depth = a.radius + b.radius - distance;
    if (depth < -.035) return null;
    const normal = distance > .0001 ? { x: delta.x / distance, y: delta.y / distance } : { x: 1, y: 0 };
    const point = { x: a.x + normal.x * (a.radius - depth / 2), y: a.y + normal.y * (a.radius - depth / 2) };
    return { normal, depth: Math.max(0, depth), point, points: [point] };
}
function circleBox(ball, block) {
    const axes = axis(block), relative = sub(ball, block);
    const local = { x: dot(relative, axes[0]), y: dot(relative, axes[1]) };
    const closest = { x: clamp(local.x, -block.width / 2, block.width / 2), y: clamp(local.y, -block.height / 2, block.height / 2) };
    let delta = sub(closest, local), distance = length(delta), depth = ball.radius - distance;
    if (depth < -.035) return null;
    if (distance < .00001) {
        const dx = block.width / 2 - Math.abs(local.x), dy = block.height / 2 - Math.abs(local.y);
        // A center inside a box needs a normal toward the box interior, so
        // position correction moves the ball out through the nearest face.
        delta = dx < dy ? { x: local.x >= 0 ? -1 : 1, y: 0 } : { x: 0, y: local.y >= 0 ? -1 : 1 };
        distance = 1; depth = ball.radius + Math.min(dx, dy);
        closest.x = local.x - delta.x * Math.min(dx, dy); closest.y = local.y - delta.y * Math.min(dx, dy);
    }
    const normal = { x: (axes[0].x * delta.x + axes[1].x * delta.y) / distance,
        y: (axes[0].y * delta.x + axes[1].y * delta.y) / distance };
    const point = { x: block.x + axes[0].x * closest.x + axes[1].x * closest.y,
        y: block.y + axes[0].y * closest.x + axes[1].y * closest.y };
    return { normal, depth: Math.max(0, depth), point, points: [point] };
}
function contact(a, b) {
    if (a.shape === 'circle' && b.shape === 'circle') return circleContact(a, b);
    if (a.shape === 'circle') return circleBox(a, b);
    if (b.shape === 'circle') {
        const result = circleBox(b, a);
        if (result) result.normal = { x: -result.normal.x, y: -result.normal.y };
        return result;
    }
    return boxContact(a, b);
}
const inverse = body => body.fixed || body.sleeping ? 0 : 1 / body.mass;
const inverseInertia = body => body.fixed || body.sleeping ? 0 : 1 / body.inertia;
function velocity(body, point) { return { x: body.vx - body.spin * (point.y - body.y), y: body.vy + body.spin * (point.x - body.x) }; }
function apply(body, impulse, point, sign = 1) {
    const mass = inverse(body), inertia = inverseInertia(body);
    body.vx += impulse.x * mass * sign; body.vy += impulse.y * mass * sign;
    body.spin += cross(sub(point, body), impulse) * inertia * sign;
}
function aabb(body) {
    if (body.shape === 'circle') return { left: body.x - body.radius, right: body.x + body.radius, top: body.y - body.radius, bottom: body.y + body.radius };
    const points = vertices(body);
    return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
        top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
}

class ToyWorld {
    constructor({ left = 7, right = 143, top = 18, bottom = 76 } = {}) {
        this.bodies = []; this.gravity = 70; this.impacts = []; this.accumulator = 0;
        this.bounds = { left, right, top, bottom };
        const centerX = (left + right) / 2, centerY = (top + bottom) / 2;
        this.walls = [box(centerX, bottom + 5, right - left + 20, 10, true),
            box(left - 5, centerY, 10, bottom - top + 20, true),
            box(right + 5, centerY, 10, bottom - top + 20, true),
            box(centerX, top - 6, right - left + 20, 12, true)];
        this.cache = new Map(); this.neighbors = new Map();
    }
    wake(body) {
        const queue = [body], seen = new Set();
        while (queue.length) {
            const current = queue.pop(); if (seen.has(current) || current.fixed) continue;
            seen.add(current); current.sleeping = false; current.restTime = 0;
            for (const other of this.neighbors.get(current) || []) if (!other.fixed && !seen.has(other)) queue.push(other);
        }
    }
    impulse(body, impulse, point = body) {
        if (!body || body.fixed || !Number.isFinite(impulse?.x) || !Number.isFinite(impulse?.y)) return false;
        this.wake(body); apply(body, impulse, point); return true;
    }
    explode(x, y, { radius = 34, strength = 120 } = {}) {
        if (![x, y, radius, strength].every(Number.isFinite) || radius <= 0) return 0;
        let affected = 0;
        for (const body of this.bodies) {
            const dx = body.x - x, dy = body.y - y, distance = Math.hypot(dx, dy);
            if (body.fixed || distance >= radius) continue;
            // Strength is peak impulse, not a velocity. Heavy blocks respond
            // less, and the impulse smoothly falls to zero at the blast edge.
            const force = strength * (1 - distance / radius), scale = distance > .001 ? force / distance : 0;
            this.impulse(body, { x: dx * scale, y: distance > .001 ? dy * scale : -force }); affected++;
        }
        return affected;
    }
    manifolds() {
        const all = [...this.bodies, ...this.walls], bounds = all.map(aabb), result = [];
        const neighbors = new Map();
        for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < all.length; j++) {
            const a = all[i], b = all[j], aa = bounds[i], bb = bounds[j];
            if (a.fixed && b.fixed) continue;
            if (aa.right < bb.left - .04 || aa.left > bb.right + .04 || aa.bottom < bb.top - .04 || aa.top > bb.bottom + .04) continue;
            const hit = contact(a, b); if (!hit) continue;
            if (!neighbors.has(a)) neighbors.set(a, new Set());
            if (!neighbors.has(b)) neighbors.set(b, new Set());
            neighbors.get(a).add(b); neighbors.get(b).add(a);
            result.push({ a, b, ...hit, key: `${a.id}:${b.id}`, floor: j >= this.bodies.length });
        }
        // Keep all connections, including sleepers, so hitting a support wakes
        // its whole connected structure instead of leaving floating blocks.
        this.neighbors = neighbors;
        return result;
    }
    substep(h, heard) {
        for (const b of this.bodies) if (!b.fixed && !b.sleeping) {
            b.vy += this.gravity * h;
            b.vx *= Math.exp(-.025 * h); b.spin *= Math.exp(-.08 * h);
            b.vx = clamp(b.vx, -180, 180); b.vy = clamp(b.vy, -180, 180); b.spin = clamp(b.spin, -24, 24);
            b.x += b.vx * h; b.y += b.vy * h; b.angle += b.spin * h;
        }
        const collisions = this.manifolds();
        for (const m of collisions) {
            const speeds = m.points.map(p => -dot(sub(velocity(m.b, p), velocity(m.a, p)), m.normal));
            m.speed = Math.max(...speeds);
            if (m.speed > .7 && ((m.a.sleeping && !m.b.sleeping && !m.b.fixed) || (m.b.sleeping && !m.a.sleeping && !m.a.fixed))) {
                this.wake(m.a); this.wake(m.b);
            }
            if (m.speed > 2.8 && !heard.has(m.key)) {
                heard.add(m.key); this.impacts.push({ speed: m.speed, body: m.a, other: m.b, floor: m.floor,
                    point: { x: m.point.x, y: m.point.y }, contact: { x: m.point.x, y: m.point.y } });
            }
            const old = this.cache.get(m.key) || [];
            m.constraints = m.points.map(point => {
                const prior = old.find(p => Math.hypot(p.x - point.x, p.y - point.y) < 1.5);
                const vn = dot(sub(velocity(m.b, point), velocity(m.a, point)), m.normal);
                return { ...point, normalImpulse: (prior?.normalImpulse || 0) * .85, tangentImpulse: (prior?.tangentImpulse || 0) * .85,
                    bounce: vn < -4 && !old.length ? -vn * Math.max(m.a.restitution, m.b.restitution) : 0 };
            });
            if (!inverse(m.a) && !inverse(m.b)) continue;
            const t = { x: -m.normal.y, y: m.normal.x };
            for (const c of m.constraints) {
                const impulse = { x: m.normal.x * c.normalImpulse + t.x * c.tangentImpulse, y: m.normal.y * c.normalImpulse + t.y * c.tangentImpulse };
                apply(m.a, impulse, c, -1); apply(m.b, impulse, c);
            }
        }
        // Accumulated impulses, warm starting and two clipped face contacts
        // let tall stacks rest without artificial fixed bodies.
        for (let iteration = 0; iteration < 24; iteration++) for (const m of collisions) {
            const ia = inverse(m.a), ib = inverse(m.b); if (!ia && !ib) continue;
            const ja = inverseInertia(m.a), jb = inverseInertia(m.b), n = m.normal, t = { x: -n.y, y: n.x };
            const normalDelta = (c, next) => {
                const delta = next - c.normalImpulse; c.normalImpulse = next;
                const impulse = { x: n.x * delta, y: n.y * delta };
                apply(m.a, impulse, c, -1); apply(m.b, impulse, c);
            };
            let coupled = false;
            if (m.constraints.length === 2) {
                // Solve both ends of a resting face together. Treating these
                // as unrelated single contacts makes tall stacks seesaw.
                const [c1, c2] = m.constraints;
                const an1 = cross(sub(c1, m.a), n), bn1 = cross(sub(c1, m.b), n);
                const an2 = cross(sub(c2, m.a), n), bn2 = cross(sub(c2, m.b), n);
                const k11 = ia + ib + an1 * an1 * ja + bn1 * bn1 * jb;
                const k22 = ia + ib + an2 * an2 * ja + bn2 * bn2 * jb;
                const k12 = ia + ib + an1 * an2 * ja + bn1 * bn2 * jb;
                const determinant = k11 * k22 - k12 * k12;
                if (determinant > 1e-7) {
                    const b1 = dot(sub(velocity(m.b, c1), velocity(m.a, c1)), n) - c1.bounce - k11 * c1.normalImpulse - k12 * c2.normalImpulse;
                    const b2 = dot(sub(velocity(m.b, c2), velocity(m.a, c2)), n) - c2.bounce - k12 * c1.normalImpulse - k22 * c2.normalImpulse;
                    let x1 = (k12 * b2 - k22 * b1) / determinant, x2 = (k12 * b1 - k11 * b2) / determinant;
                    if (x1 >= 0 && x2 >= 0) coupled = true;
                    else if (-b1 / k11 >= 0 && k12 * (-b1 / k11) + b2 >= 0) { x1 = -b1 / k11; x2 = 0; coupled = true; }
                    else if (-b2 / k22 >= 0 && k12 * (-b2 / k22) + b1 >= 0) { x1 = 0; x2 = -b2 / k22; coupled = true; }
                    else if (b1 >= 0 && b2 >= 0) { x1 = 0; x2 = 0; coupled = true; }
                    if (coupled) { normalDelta(c1, x1); normalDelta(c2, x2); }
                }
            }
            if (!coupled) for (const c of m.constraints) {
                const ra = sub(c, m.a), rb = sub(c, m.b);
                const vn = dot(sub(velocity(m.b, c), velocity(m.a, c)), n);
                const mass = ia + ib + cross(ra, n) ** 2 * ja + cross(rb, n) ** 2 * jb;
                normalDelta(c, Math.max(0, c.normalImpulse + (c.bounce - vn) / mass));
            }
            for (const c of m.constraints) {
                const ra = sub(c, m.a), rb = sub(c, m.b);
                const vt = dot(sub(velocity(m.b, c), velocity(m.a, c)), t);
                const tangentMass = ia + ib + cross(ra, t) ** 2 * ja + cross(rb, t) ** 2 * jb;
                const limit = Math.sqrt(m.a.friction * m.b.friction) * c.normalImpulse, previousTangent = c.tangentImpulse;
                c.tangentImpulse = clamp(previousTangent - vt / tangentMass, -limit, limit);
                const f = c.tangentImpulse - previousTangent, friction = { x: t.x * f, y: t.y * f };
                apply(m.a, friction, c, -1); apply(m.b, friction, c);
            }
        }
        this.cache = new Map(collisions.map(m => [m.key, m.constraints]));
        for (let iteration = 0; iteration < 4; iteration++) for (const m of collisions) {
            const ia = inverse(m.a), ib = inverse(m.b); if (!ia && !ib) continue;
            const hit = contact(m.a, m.b); if (!hit) continue;
            // Split position correction never injects kinetic energy.
            const correction = Math.min(.9, Math.max(0, hit.depth - .018) * .3) / (ia + ib);
            m.a.x -= hit.normal.x * correction * ia; m.a.y -= hit.normal.y * correction * ia;
            m.b.x += hit.normal.x * correction * ib; m.b.y += hit.normal.y * correction * ib;
        }
        for (const b of this.bodies) if (!b.fixed && !b.sleeping) {
            // A final split correction keeps even a fast corner strike inside
            // the playfield. Collision impulses above still supply the bounce.
            const bounds = aabb(b);
            if (bounds.left < this.bounds.left) b.x += this.bounds.left - bounds.left;
            else if (bounds.right > this.bounds.right) b.x -= bounds.right - this.bounds.right;
            if (bounds.top < this.bounds.top) b.y += this.bounds.top - bounds.top;
            else if (bounds.bottom > this.bounds.bottom) b.y -= bounds.bottom - this.bounds.bottom;
            const settled = this.neighbors.has(b) && Math.hypot(b.vx, b.vy) < .32 && Math.abs(b.spin) < .055;
            b.restTime = settled ? b.restTime + h : 0;
            if (b.restTime > .75) { b.sleeping = true; b.vx = 0; b.vy = 0; b.spin = 0; }
        }
    }
    step(dt) {
        this.impacts = [];
        if (!Number.isFinite(dt) || dt <= 0) return;
        // Projectiles can expire or be replaced while supporting a sleeping
        // pile. Wake that connected pile before dropping the old contacts;
        // otherwise its blocks would remain suspended over the missing ball.
        const present = new Set(this.bodies);
        for (const [body, neighbors] of this.neighbors) {
            if (body.fixed || present.has(body)) continue;
            for (const neighbor of neighbors) if (present.has(neighbor)) this.wake(neighbor);
        }
        this.accumulator += Math.min(dt, .1);
        const heard = new Set(), h = 1 / 120;
        for (let i = 0; this.accumulator + 1e-9 >= h && i < 12; i++) {
            this.accumulator -= h; this.substep(h, heard);
        }
        this.accumulator = Math.max(0, this.accumulator);
    }
}

module.exports = { ToyWorld, box, circle, vertices, contact };
