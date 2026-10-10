const { Asset } = require('squish-142');
const garden = require('./garden-data');
const worlds = require('./world-art-data');

// Inline bytes keep the exact same artwork available in browser-local, hosted,
// and standalone sessions. No filesystem, network, or browser API is required.
function decodeBase64(source) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Uint8Array(128);
    for (let i = 0; i < alphabet.length; i++) lookup[alphabet.charCodeAt(i)] = i;
    const padding = source.endsWith('==') ? 2 : source.endsWith('=') ? 1 : 0;
    const bytes = new Uint8Array(source.length / 4 * 3 - padding);
    let position = 0;
    for (let i = 0; i < source.length; i += 4) {
        const value = (lookup[source.charCodeAt(i)] << 18) | (lookup[source.charCodeAt(i + 1)] << 12) |
            (lookup[source.charCodeAt(i + 2)] << 6) | lookup[source.charCodeAt(i + 3)];
        if (position < bytes.length) bytes[position++] = value >> 16 & 255;
        if (position < bytes.length) bytes[position++] = value >> 8 & 255;
        if (position < bytes.length) bytes[position++] = value & 255;
    }
    return bytes;
}

function artAssets() {
    return Object.fromEntries(Object.entries({ moonbounce_garden_v2: garden, ...worlds }).map(([id, data]) =>
        [id, new Asset({ id, type: 'image' }, decodeBase64(data))]));
}

module.exports = { artAssets, decodeBase64 };
