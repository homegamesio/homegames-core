const { Game, GameNode, Shapes, ShapeUtils } = require('squish-146');

const INK = [28, 34, 45, 255];
const CREAM = [248, 248, 236, 255];
const BLUE = [122, 192, 225, 255];
const YELLOW = [255, 236, 125, 255];

class InputTest extends Game {
    static metadata() {
        return {
            aspectRatio: { x: 16, y: 9 }, squishVersion: '146',
            author: 'Joseph Garcia', name: 'Input Test',
            thumbnail: 'c6d38aca68fed708d08d284a5d201a0a',
            isTest: true,
        };
    }

    constructor({ handleFileUpload }) {
        super();
        this.handleFileUpload = handleFileUpload;
        this.media = {}; this.mediaNodes = {}; this.uploadGeneration = 0;
        this.base = this.shape(0, 0, 100, 100, CREAM);
        this.label('INPUT TEST', 50, 3, 3.2);
        this.textNode = this.label('Tap to edit text', 30, 32, 2);
        this.statusNode = this.label('Choose an image, audio file or short video (up to 5 MB)', 50, 38, 1.8);

        this.textInputNode = this.button('Edit text', 20, 12, 20, 15, BLUE, null, {
            type: 'text', oninput: (player, text) => {
                if (text) this.setText(this.textNode, text.slice(0, 80));
            },
        });
        this.fileInputNode = this.button('Upload media', 60, 12, 20, 15, YELLOW, null, {
            type: 'file', oninput: (playerId, bytes, metadata) => this.upload(playerId, bytes, metadata),
        });

        for (const [kind, x] of [['image', 4], ['audio', 36], ['video', 68]]) {
            this.base.addChild(this.shape(x, 44, 28, 38, [222, 230, 230, 255]));
            this.label(kind.toUpperCase(), x + 14, 46, 2.1);
            this.label(kind === 'audio' ? 'Sound plays here' : 'Nothing uploaded yet', x + 14, 62, 1.5);
        }
        this.button('Replay audio', 37, 85, 26, 8, BLUE, () => this.replay('audio'));
        this.button('Replay video', 69, 85, 26, 8, BLUE, () => this.replay('video'));
        this.button('Clear media', 5, 85, 26, 8, YELLOW, () => this.clearMedia());
        this.label('Tap the canvas to enable sound on this device', 50, 96, 1.5);
    }

    shape(x, y, width, height, fill, extra = {}) {
        return new GameNode.Shape({ shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, width, height), fill, ...extra });
    }
    label(text, x, y, size, font = 'default') {
        const node = new GameNode.Text({ textInfo: { text, x, y, size, align: 'center', color: INK, font } });
        this.base.addChild(node); return node;
    }
    button(text, x, y, width, height, fill, onClick, input) {
        const node = this.shape(x, y, width, height, fill, { onClick, input });
        this.base.addChild(node);
        this.label(text, x + width / 2, y + height / 2 - 1.3, 2);
        return node;
    }
    setText(node, text) {
        node.node.text.text = text; node.node.onStateChange();
    }

    async upload(playerId, bytes, metadata) {
        const generation = this.uploadGeneration;
        try {
            const asset = await this.handleFileUpload(playerId, bytes, metadata);
            if (this.stopped || generation !== this.uploadGeneration) return;
            this.media[asset.info.type] = asset;
            this.showMedia(asset.info.type);
            this.setText(this.statusNode, `${asset.info.type}: ${(asset.info.fileName || 'upload').slice(0, 32)} / player ${playerId}`);
        } catch (error) {
            if (!this.stopped && generation === this.uploadGeneration) this.setText(this.statusNode, error.message);
        }
    }
    showMedia(kind) {
        const asset = this.media[kind];
        if (!asset) return;
        if (this.mediaNodes[kind]) this.base.removeChild(this.mediaNodes[kind].id);
        const visual = kind !== 'audio';
        const node = new GameNode.Asset({ assetInfo: {
            [asset.key]: { pos: { x: kind === 'image' ? 5 : 69, y: 53 },
                size: { x: visual ? 26 : 0, y: visual ? 27 : 0 }, startTime: 0 },
        } });
        this.mediaNodes[kind] = node; this.base.addChild(node);
    }
    replay(kind) {
        if (!this.media[kind]) return;
        // A fresh node means a new playback, even if a busy guest skipped the
        // intermediate frame where the old node was removed.
        this.showMedia(kind);
    }
    clearMedia() {
        this.uploadGeneration++;
        for (const node of Object.values(this.mediaNodes)) this.base.removeChild(node.id);
        this.media = {}; this.mediaNodes = {};
        this.setText(this.statusNode, 'Choose an image, audio file or short video (up to 5 MB)');
    }
    getLayers() { return [{ root: this.base }]; }
    close() { this.stopped = true; super.close(); }
}

module.exports = InputTest;
