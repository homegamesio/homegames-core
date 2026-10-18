'use strict';

const { BIOMES } = require('../data/content');

const WORLD_SIZE = 1048576;
const WORLD_CENTER = WORLD_SIZE / 2;
const CHUNK_SIZE = 64;
const DUNGEON_CELL = 46;
const DUNGEON_GRID = 6;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function mix32(value) {
    let x = value | 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d);
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b);
    x ^= x >>> 16;
    return x >>> 0;
}

function hash(seed, x, y, salt) {
    let value = mix32((seed | 0) ^ Math.imul(x | 0, 0x45d9f3b) ^ Math.imul(y | 0, 0x27d4eb2d) ^ (salt | 0));
    value = mix32(value + 0x9e3779b9);
    return value / 4294967296;
}

function makeRng(seed, x, y, salt) {
    let state = mix32((seed | 0) ^ Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ (salt | 0));
    return function next() {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function idFor(prefix, cx, cy, index) {
    return `${prefix}:${cx}:${cy}:${index}`;
}

function biomeFor(seed, cx, cy) {
    const coarseX = Math.floor(cx / 4);
    const coarseY = Math.floor(cy / 4);
    const value = hash(seed, coarseX, coarseY, 77);
    if (value < 0.28) return BIOMES.meadow;
    if (value < 0.55) return BIOMES.pine;
    if (value < 0.79) return BIOMES.amber;
    return BIOMES.mire;
}

function choose(list, value) {
    if (!list || list.length === 0) return null;
    return list[Math.min(list.length - 1, Math.floor(value * list.length))];
}

function localPoint(cx, cy, rx, ry) {
    return {
        x: cx * CHUNK_SIZE + rx * CHUNK_SIZE,
        y: cy * CHUNK_SIZE + ry * CHUNK_SIZE
    };
}

function startingTownChunk(cx, cy) {
    return cx === 0 && cy === 0;
}

function generateChunk(seed, cx, cy) {
    const rng = makeRng(seed, cx, cy, 991);
    const biome = biomeFor(seed, cx, cy);
    const props = [];
    const enemies = [];
    const npcs = [];
    const dungeons = [];
    const secrets = [];
    const landmarks = [];
    const isStart = startingTownChunk(cx, cy);

    const propCount = isStart ? 12 : 18 + Math.floor(rng() * 12);
    for (let index = 0; index < propCount; index += 1) {
        let rx = 0.08 + rng() * 0.84;
        let ry = 0.08 + rng() * 0.84;
        if (isStart && Math.abs(rx - 0.5) < 0.28 && Math.abs(ry - 0.5) < 0.24) {
            rx = rx < 0.5 ? 0.12 + rng() * 0.12 : 0.76 + rng() * 0.12;
        }
        const point = localPoint(cx, cy, rx, ry);
        const kindRoll = rng();
        const kind = kindRoll < 0.58 ? 'tree' : kindRoll < 0.86 ? 'rock' : 'brush';
        const radius = kind === 'tree' ? 2.2 + rng() * 1.8 : kind === 'rock' ? 1.8 + rng() * 1.5 : 1.1 + rng() * 1.2;
        props.push({
            id: idFor('prop', cx, cy, index),
            x: point.x,
            y: point.y,
            radius,
            kind,
            solid: kind !== 'brush',
            color: kind === 'tree' ? biome.propA : biome.propB
        });
    }

    if (isStart) {
        const center = localPoint(cx, cy, 0.5, 0.5);
        landmarks.push({ id: 'start-fire', x: center.x, y: center.y, kind: 'campfire' });
        npcs.push({
            id: 'npc:warden-mira',
            x: center.x - 10,
            y: center.y + 3,
            name: 'Mira',
            questKind: 'hunt',
            color: [240, 196, 105, 255]
        });
        npcs.push({
            id: 'npc:delver-orrin',
            x: center.x + 11,
            y: center.y - 2,
            name: 'Orrin',
            questKind: 'dungeon',
            color: [128, 193, 255, 255]
        });
        dungeons.push({
            id: 'dungeon:first-hollow',
            x: center.x + 22,
            y: center.y - 18,
            level: 1,
            name: 'The First Hollow'
        });
        secrets.push({
            id: 'secret:start-cache',
            x: center.x - 22,
            y: center.y + 18,
            kind: 'cache',
            reward: 'iron-longsword'
        });
    } else {
        const regionX = Math.floor(cx / 5);
        const regionY = Math.floor(cy / 5);
        const settlementRoll = hash(seed, regionX, regionY, 440);
        const settlementCx = regionX * 5 + Math.floor(hash(seed, regionX, regionY, 441) * 5);
        const settlementCy = regionY * 5 + Math.floor(hash(seed, regionX, regionY, 442) * 5);
        if (settlementRoll < 0.34 && cx === settlementCx && cy === settlementCy) {
            const point = localPoint(cx, cy, 0.5, 0.5);
            landmarks.push({ id: idFor('camp', cx, cy, 0), x: point.x, y: point.y, kind: 'campfire' });
            npcs.push({
                id: idFor('npc', cx, cy, 0),
                x: point.x - 5,
                y: point.y + 2,
                name: choose(['Tess', 'Bran', 'Ilya', 'Nox', 'Perrin'], rng()),
                questKind: choose(['hunt', 'dungeon', 'secret'], rng()),
                color: [210, 180 + Math.floor(rng() * 55), 120 + Math.floor(rng() * 100), 255]
            });
        }

        if (hash(seed, cx, cy, 211) < 0.085) {
            const point = localPoint(cx, cy, 0.18 + rng() * 0.64, 0.18 + rng() * 0.64);
            dungeons.push({
                id: idFor('dungeon', cx, cy, 0),
                x: point.x,
                y: point.y,
                level: 1 + Math.floor((Math.abs(cx) + Math.abs(cy)) / 4),
                name: choose(['Sunken Vault', 'Briar Crypt', 'Hollow Engine', 'Amber Catacomb'], rng())
            });
        }

        if (hash(seed, cx, cy, 311) < 0.09) {
            const point = localPoint(cx, cy, 0.12 + rng() * 0.76, 0.12 + rng() * 0.76);
            secrets.push({
                id: idFor('secret', cx, cy, 0),
                x: point.x,
                y: point.y,
                kind: 'cache',
                reward: choose(['gold', 'upgrade', 'hunter-bow'], rng())
            });
        }
    }

    const danger = Math.min(6, Math.floor((Math.abs(cx) + Math.abs(cy)) / 4));
    const enemyCount = isStart ? 5 : Math.floor(rng() * 3) + (rng() < 0.58 ? 2 : 0) + Math.floor(danger / 2);
    for (let index = 0; index < enemyCount; index += 1) {
        const point = localPoint(cx, cy, 0.1 + rng() * 0.8, 0.1 + rng() * 0.8);
        if (isStart && Math.hypot(point.x - CHUNK_SIZE / 2, point.y - CHUNK_SIZE / 2) < 27) continue;
        let type = choose(biome.enemies, rng());
        if (danger >= 3 && rng() < 0.18) type = 'sentinel';
        enemies.push({
            id: idFor('enemy', cx, cy, index),
            x: point.x,
            y: point.y,
            type,
            level: 1 + danger,
            homeX: point.x,
            homeY: point.y
        });
    }

    return {
        key: `${cx},${cy}`,
        cx,
        cy,
        biome,
        props,
        enemies,
        npcs,
        dungeons,
        secrets,
        landmarks
    };
}

function roomKey(x, y) {
    return `${x},${y}`;
}

function directionBetween(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 1) return 'E';
    if (dx === -1) return 'W';
    if (dy === 1) return 'S';
    return 'N';
}

function opposite(direction) {
    if (direction === 'N') return 'S';
    if (direction === 'S') return 'N';
    if (direction === 'E') return 'W';
    return 'E';
}

function addDoor(room, direction) {
    if (!room.doors.includes(direction)) room.doors.push(direction);
}

function createRoom(x, y, index) {
    return {
        id: `room:${index}`,
        gx: x,
        gy: y,
        x: x * DUNGEON_CELL,
        y: y * DUNGEON_CELL,
        w: DUNGEON_CELL,
        h: DUNGEON_CELL,
        doors: [],
        index,
        boss: false,
        secret: false
    };
}

function wallSegmentsForRoom(room, roomIndex, secretDoor) {
    const thickness = 3.2;
    const opening = 12;
    const left = room.x;
    const top = room.y;
    const right = room.x + room.w;
    const bottom = room.y + room.h;
    const middleX = left + room.w / 2;
    const middleY = top + room.h / 2;
    const walls = [];

    function push(id, x, y, w, h, extra) {
        walls.push(Object.assign({ id, x, y, w, h, solid: true, secret: false, hp: 0 }, extra || {}));
    }

    if (room.doors.includes('N')) {
        push(`wall:${roomIndex}:n1`, left, top, room.w / 2 - opening / 2, thickness);
        push(`wall:${roomIndex}:n2`, middleX + opening / 2, top, room.w / 2 - opening / 2, thickness);
    } else {
        push(`wall:${roomIndex}:n`, left, top, room.w, thickness, secretDoor === 'N' ? { secret: true, hp: 2 } : null);
    }
    if (room.doors.includes('S')) {
        push(`wall:${roomIndex}:s1`, left, bottom - thickness, room.w / 2 - opening / 2, thickness);
        push(`wall:${roomIndex}:s2`, middleX + opening / 2, bottom - thickness, room.w / 2 - opening / 2, thickness);
    } else {
        push(`wall:${roomIndex}:s`, left, bottom - thickness, room.w, thickness, secretDoor === 'S' ? { secret: true, hp: 2 } : null);
    }
    if (room.doors.includes('W')) {
        push(`wall:${roomIndex}:w1`, left, top, thickness, room.h / 2 - opening / 2);
        push(`wall:${roomIndex}:w2`, left, middleY + opening / 2, thickness, room.h / 2 - opening / 2);
    } else {
        push(`wall:${roomIndex}:w`, left, top, thickness, room.h, secretDoor === 'W' ? { secret: true, hp: 2 } : null);
    }
    if (room.doors.includes('E')) {
        push(`wall:${roomIndex}:e1`, right - thickness, top, thickness, room.h / 2 - opening / 2);
        push(`wall:${roomIndex}:e2`, right - thickness, middleY + opening / 2, thickness, room.h / 2 - opening / 2);
    } else {
        push(`wall:${roomIndex}:e`, right - thickness, top, thickness, room.h, secretDoor === 'E' ? { secret: true, hp: 2 } : null);
    }
    return walls;
}

function generateDungeon(seed, dungeonId, level) {
    let dungeonHash = 0;
    for (let index = 0; index < dungeonId.length; index += 1) dungeonHash = mix32(dungeonHash ^ dungeonId.charCodeAt(index));
    const rng = makeRng(seed ^ dungeonHash, level | 0, dungeonId.length, 7331);
    const rooms = [];
    const occupied = {};
    let current = { x: Math.floor(DUNGEON_GRID / 2), y: DUNGEON_GRID - 1 };
    const start = createRoom(current.x, current.y, 0);
    rooms.push(start);
    occupied[roomKey(current.x, current.y)] = start;
    const desired = clamp(7 + Math.floor(rng() * 4) + Math.floor(level / 3), 7, 13);

    for (let index = 1; index < desired; index += 1) {
        const candidates = [];
        const directions = [
            { x: 0, y: -1 },
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 }
        ];
        for (const direction of directions) {
            const nx = current.x + direction.x;
            const ny = current.y + direction.y;
            if (nx < 0 || ny < 0 || nx >= DUNGEON_GRID || ny >= DUNGEON_GRID) continue;
            if (occupied[roomKey(nx, ny)]) continue;
            let score = rng();
            if (direction.y < 0) score += 0.38;
            if (direction.y > 0) score -= 0.2;
            candidates.push({ x: nx, y: ny, score });
        }
        if (candidates.length === 0) {
            current = rooms[Math.floor(rng() * rooms.length)];
            index -= 1;
            continue;
        }
        candidates.sort((a, b) => b.score - a.score);
        const next = candidates[0];
        const room = createRoom(next.x, next.y, index);
        const previous = occupied[roomKey(current.x, current.y)];
        const direction = directionBetween(current, next);
        addDoor(previous, direction);
        addDoor(room, opposite(direction));
        rooms.push(room);
        occupied[roomKey(next.x, next.y)] = room;
        current = next;
    }

    const bossRoom = rooms[rooms.length - 1];
    bossRoom.boss = true;

    let secretRoom = null;
    let secretParent = null;
    let secretDirection = null;
    for (let attempt = 0; attempt < rooms.length * 4 && !secretRoom; attempt += 1) {
        const parent = rooms[1 + Math.floor(rng() * Math.max(1, rooms.length - 2))];
        const dirs = [
            { name: 'N', x: 0, y: -1 },
            { name: 'E', x: 1, y: 0 },
            { name: 'W', x: -1, y: 0 },
            { name: 'S', x: 0, y: 1 }
        ];
        const d = dirs[Math.floor(rng() * dirs.length)];
        const sx = parent.gx + d.x;
        const sy = parent.gy + d.y;
        if (sx < 0 || sy < 0 || sx >= DUNGEON_GRID || sy >= DUNGEON_GRID) continue;
        if (occupied[roomKey(sx, sy)]) continue;
        secretRoom = createRoom(sx, sy, rooms.length);
        secretRoom.secret = true;
        secretParent = parent;
        secretDirection = d.name;
        occupied[roomKey(sx, sy)] = secretRoom;
        rooms.push(secretRoom);
    }

    const walls = [];
    for (const room of rooms) {
        let secretDoor = null;
        if (secretParent && room.id === secretParent.id) secretDoor = secretDirection;
        if (secretRoom && room.id === secretRoom.id) secretDoor = opposite(secretDirection);
        walls.push(...wallSegmentsForRoom(room, room.index, secretDoor));
    }

    const enemies = [];
    let enemyIndex = 0;
    for (const room of rooms) {
        if (room.index === 0 || room.secret) continue;
        const centerX = room.x + room.w / 2;
        const centerY = room.y + room.h / 2;
        if (room.boss) {
            enemies.push({
                id: `${dungeonId}:boss`,
                x: centerX,
                y: centerY,
                homeX: centerX,
                homeY: centerY,
                type: 'warden',
                level: Math.max(1, level + 1),
                boss: true,
                roomId: room.id
            });
            continue;
        }
        const count = 1 + Math.floor(rng() * 2) + (level > 3 && rng() < 0.45 ? 1 : 0);
        for (let index = 0; index < count; index += 1) {
            const roll = rng();
            const type = roll < 0.35 ? 'raider' : roll < 0.63 ? 'archer' : roll < 0.85 ? 'sentinel' : 'wolf';
            enemies.push({
                id: `${dungeonId}:enemy:${enemyIndex++}`,
                x: centerX + (rng() - 0.5) * 17,
                y: centerY + (rng() - 0.5) * 17,
                homeX: centerX,
                homeY: centerY,
                type,
                level: Math.max(1, level),
                boss: false,
                roomId: room.id
            });
        }
    }

    const startCenter = {
        x: start.x + start.w / 2,
        y: start.y + start.h / 2
    };
    const bossCenter = {
        x: bossRoom.x + bossRoom.w / 2,
        y: bossRoom.y + bossRoom.h / 2
    };
    const secret = secretRoom ? {
        id: `${dungeonId}:secret`,
        x: secretRoom.x + secretRoom.w / 2,
        y: secretRoom.y + secretRoom.h / 2,
        kind: 'relic',
        reward: level >= 4 ? 'moon-spear' : 'upgrade',
        roomId: secretRoom.id
    } : null;

    return {
        id: dungeonId,
        name: 'Procedural Hollow',
        level,
        width: DUNGEON_GRID * DUNGEON_CELL,
        height: DUNGEON_GRID * DUNGEON_CELL,
        rooms,
        walls,
        enemies,
        start: startCenter,
        exit: { id: `${dungeonId}:exit`, x: startCenter.x, y: startCenter.y + 9 },
        bossCenter,
        secret,
        rewardWeapon: level >= 4 ? 'ember-edge' : 'iron-longsword'
    };
}

module.exports = {
    WORLD_SIZE,
    WORLD_CENTER,
    CHUNK_SIZE,
    generateChunk,
    generateDungeon,
    biomeFor,
    hash
};
