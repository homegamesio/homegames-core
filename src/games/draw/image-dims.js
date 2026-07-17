// Parse intrinsic pixel dimensions from image bytes (PNG, GIF, JPEG, WebP).
// Returns { width, height } or null when the format isn't recognized.
const getImageDimensions = (bytes) => {
    const b = bytes;
    const len = b.length;

    // PNG: IHDR is always the first chunk; width/height are big-endian at 16/20.
    if (len > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) {
        const width = b[16] * 0x1000000 + b[17] * 0x10000 + b[18] * 0x100 + b[19];
        const height = b[20] * 0x1000000 + b[21] * 0x10000 + b[22] * 0x100 + b[23];
        return (width > 0 && height > 0) ? { width, height } : null;
    }

    // GIF: little-endian logical screen size at 6/8.
    if (len > 9 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
        const width = b[6] | (b[7] << 8);
        const height = b[8] | (b[9] << 8);
        return (width > 0 && height > 0) ? { width, height } : null;
    }

    // JPEG: walk segments to the first start-of-frame marker.
    if (len > 3 && b[0] === 0xFF && b[1] === 0xD8) {
        let i = 2;
        while (i + 9 < len) {
            if (b[i] !== 0xFF) { i++; continue; }
            const marker = b[i + 1];
            if (marker === 0xFF) { i++; continue; }
            if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
                const height = (b[i + 5] << 8) | b[i + 6];
                const width = (b[i + 7] << 8) | b[i + 8];
                return (width > 0 && height > 0) ? { width, height } : null;
            }
            if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD9)) {
                i += 2; // marker without a payload
                continue;
            }
            i += 2 + ((b[i + 2] << 8) | b[i + 3]);
        }
        return null;
    }

    // WebP: RIFF....WEBP, then the first chunk decides the encoding.
    if (len > 29 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
        && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
        const fourCC = String.fromCharCode(b[12], b[13], b[14], b[15]);
        if (fourCC === 'VP8 ') { // lossy
            const width = (b[26] | (b[27] << 8)) & 0x3FFF;
            const height = (b[28] | (b[29] << 8)) & 0x3FFF;
            return (width > 0 && height > 0) ? { width, height } : null;
        }
        if (fourCC === 'VP8L') { // lossless: 14-bit fields packed after the signature byte
            const width = 1 + (b[21] | ((b[22] & 0x3F) << 8));
            const height = 1 + ((b[22] >> 6) | (b[23] << 2) | ((b[24] & 0x0F) << 10));
            return { width, height };
        }
        if (fourCC === 'VP8X') { // extended: 24-bit minus-one canvas size
            const width = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
            const height = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
            return { width, height };
        }
    }

    return null;
};

module.exports = { getImageDimensions };
