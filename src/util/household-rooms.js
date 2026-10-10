// A home server lists its browsers' RTC games for other household browsers.
// Invitations still use public signaling; no gameplay passes through Core.
const crypto = require('crypto');

const createHouseholdRooms = ({ resolveGame, signalingUrl, now = Date.now, leaseMs = 90000 }) => {
    const rooms = new Map();
    const prune = () => { for (const [id, room] of rooms) if (now() - room.updatedAt >= leaseMs) rooms.delete(id); };
    const list = () => {
        prune();
        return [...rooms.values()].map(({ owner, updatedAt, ...room }) => room);
    };
    const handleRequest = (req, res) => {
        if (req.url !== '/household-rooms') return false;
        const respond = (status, body) => {
            res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify(body));
        };
        // No cross-origin publication or CORS. The existing home-server page
        // is the authority to register a household invitation.
        if (req.headers.origin && req.headers.origin !== `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`) {
            respond(403, { error: 'Use the home server to share a game' }); return true;
        }
        if (req.method === 'GET') { respond(200, { rooms: list() }); return true; }
        if (req.method !== 'POST' || !/^application\/json(?:;|$)/.test(req.headers['content-type'] || '')) {
            respond(405, { error: 'JSON POST required' }); return true;
        }
        let body = '', size = 0;
        req.on('data', chunk => { size += chunk.length; if (size <= 4096) body += chunk; });
        req.on('end', () => {
            if (size > 4096) return respond(413, { error: 'Request too large' });
            let data;
            try { data = JSON.parse(body); } catch (_) { return respond(400, { error: 'Invalid JSON' }); }
            if (!data || typeof data !== 'object') return respond(400, { error: 'Invalid room' });
            prune();
            if (data.id) {
                const room = rooms.get(data.id);
                if (!room || room.owner !== data.owner) return respond(404, { error: 'Room unavailable' });
                if (data.remove) { rooms.delete(data.id); return respond(200, {}); }
                if (!Number.isInteger(data.playerCount) || data.playerCount < 1 || data.playerCount > room.maxPlayers) {
                    return respond(400, { error: 'Invalid player count' });
                }
                room.playerCount = data.playerCount; room.updatedAt = now();
                return respond(200, { id: room.id });
            }
            if (rooms.size >= 128) return respond(429, { error: 'Too many household games' });
            if (typeof data.gameKey !== 'string' || typeof data.versionId !== 'string'
                || !/^[\w-]{24}$/.test(data.roomId || '') || !/^[\w-]{24}$/.test(data.invite || '')) {
                return respond(400, { error: 'Invalid invitation' });
            }
            const game = resolveGame(data.gameKey, data.versionId);
            if (!game) return respond(404, { error: 'Game is not installed' });
            const id = 'rtc-' + crypto.randomBytes(18).toString('base64url');
            const owner = crypto.randomBytes(24).toString('base64url');
            rooms.set(id, { id, owner, updatedAt: now(), game: data.gameKey, versionId: data.versionId,
                name: game.name, maxPlayers: Math.min(17, game.maxPlayers || 17), playerCount: 1,
                invitation: { roomId: data.roomId, invite: data.invite, signalingUrl } });
            respond(201, { id, owner });
        });
        return true;
    };
    return { list, handleRequest };
};
module.exports = { createHouseholdRooms };
