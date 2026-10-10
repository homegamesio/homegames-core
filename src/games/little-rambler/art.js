const { Asset } = require('squish-142');
const home = require('./art/home-data');
const garden = require('./art/garden-data');
const lagoon = require('./art/lagoon-data');

function decode(source) {
    const lookup = new Uint8Array(128), alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    for (let i = 0; i < alphabet.length; i++) lookup[alphabet.charCodeAt(i)] = i;
    const bytes = new Uint8Array(source.length / 4 * 3 - (source.endsWith('==') ? 2 : source.endsWith('=') ? 1 : 0));
    let at = 0;
    for (let i = 0; i < source.length; i += 4) {
        const value = lookup[source.charCodeAt(i)] << 18 | lookup[source.charCodeAt(i + 1)] << 12 |
            lookup[source.charCodeAt(i + 2)] << 6 | lookup[source.charCodeAt(i + 3)];
        if (at < bytes.length) bytes[at++] = value >> 16 & 255;
        if (at < bytes.length) bytes[at++] = value >> 8 & 255;
        if (at < bytes.length) bytes[at++] = value & 255;
    }
    return bytes;
}
function artAssets() {
    return Object.fromEntries(Object.entries({ rambler_home: home, rambler_garden: garden, rambler_lagoon: lagoon })
        .map(([id, value]) => [id, new Asset({ id, type: 'image' }, decode(value))]));
}
module.exports = { artAssets };
