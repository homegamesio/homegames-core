const { Asset, Colors, Game, GameNode, Shapes, ShapeUtils } = require('squish-142');
const { getImageDimensions } = require('./image-dims');

const COLORS = Colors.COLORS;

// World-space board. The screen is a camera window into this larger plane.
// 4000x4000 = 1600 default-zoom screenfuls; new players spawn scattered across it.
const WORLD_SIZE = 4000;
const ZOOM_WIDTHS = [25, 50, 100, 200, 500, 1000, 2000]; // camera width in world units per zoom level
const DEFAULT_ZOOM_INDEX = 2;
const SPAWN_GRID = 6; // joiners land in scattered cells of a 6x6 region grid

const TOOLBAR_HEIGHT = 8;

const PAPER_COLOR = COLORS.ALMOST_WHITE;
const GRID_COLOR = [214, 214, 214, 255];
const EDGE_COLOR = [130, 130, 130, 255];

// Strokes are polyline "chunks": one polygon node per viewer, rebuilt as points arrive.
// A strip strip has 2 * points + 1 vertices; the wire format caps a node at ~126.
const MAX_POINTS_PER_CHUNK = 55;
const MAX_CHUNKS = 4000;
// Pen thickness is fixed in WORLD units: boldest at the closest zoom, fading
// toward a hairline as you zoom out.
const PEN_WORLD_WIDTH = 0.7;
const ERASER_MULTIPLIER = 4;
const MIN_HALF_WIDTH = 0.08;    // below serialization precision the stroke vanishes
// Far-away strokes render simplified so a zoomed-out view stays small on the wire.
const DOT_LOD_EXTENT = 1.2;     // screen units; below this a chunk is just a speck
const STROKE_LINK_MS = 400;     // held-drag re-clicks arrive ~every 30ms; a longer gap ends the stroke
const MIN_POINT_SCREEN_DIST = 0.25;

const CLEAR_COOLDOWN_MS = 60 * 1000;

// Uploaded board objects. Every upload rebroadcasts the full asset bundle to
// every player, so the count is FIFO-capped.
const MAX_BOARD_ITEMS = 20;
const IMAGE_MAX_WORLD = 200;   // longest image side, world units
const AUDIO_BLOCK_WORLD = 50;  // audio play-block is 50x50 world units
const PAN_STEP = 0.06;          // fraction of the view per pan event
const PAN_GATE_MS = 45;         // held buttons/keys re-fire ~every 30ms
const ZOOM_KEY_GATE_MS = 250;

// Last entry doubles as the eraser (matches the paper color, draws extra thick).
const PALETTE = ['BLACK', 'CANDY_RED', 'CORAL', 'GOLD', 'CANDY_GREEN', 'DARK_TURQUOISE', 'BLUE', 'FUNNY_PURPLE', 'HARD_PINK', 'ALMOST_WHITE'];
const ERASER_INDEX = PALETTE.length - 1;

const SWATCH_X = (i) => 4 + i * 4;
const SWATCH_Y = 1.8;
const SWATCH_W = 3.4;
const SWATCH_H = 4.4;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const clampScreen = (v) => clamp(v, 0, 100);

class Draw extends Game {
    static metadata() {
        return {
            name: 'Draw',
            description: 'A big shared drawing board. Scroll, zoom, and doodle together.',
            aspectRatio: { x: 1, y: 1 },
            squishVersion: '142',
            author: 'Joseph Garcia',
            thumbnail: '1e844026921f7662a62ce72da869da63'
        };
    }

    constructor(options = {}) {
        super();

        this.addAsset = (options && options.addAsset) || (() => Promise.resolve());

        this.players = {};
        this.chunks = [];
        this.items = [];           // uploaded board objects (world-space)
        this.uploadedAssets = {};  // assetKey -> squish Asset, served via getAssets()
        this.soundNodes = {};      // assetKey -> currently playing audio node
        this.itemCounter = 0;
        this.joinCounter = 0;
        this.clearReadyAt = 0;
        this.clearTicker = null;
        this.clearVotes = new Set();

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: PAPER_COLOR
        });

        this.gridRoot = this.makeContainer();
        this.imageRoot = this.makeContainer();   // below ink: you can draw on pictures
        this.strokeRoot = this.makeContainer();

        // Above the strokes so drawing over existing ink works, below the toolbar so buttons win.
        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            onClick: this.handleDraw.bind(this)
        });

        // Above the tap catcher: audio blocks must receive their own clicks.
        this.audioRoot = this.makeContainer();
        this.soundRoot = this.makeContainer();   // zero-size audio playback nodes, shared

        this.buildToolbar();
        this.buildControlBar();

        this.base.addChildren(
            this.gridRoot, this.imageRoot, this.strokeRoot, this.tapCatcher,
            this.audioRoot, this.soundRoot, this.toolbar, this.controlBar
        );
    }

    getLayers() {
        return [{ root: this.base }];
    }

    // Uploaded assets are registered at runtime; the Squisher merges these
    // with metadata().assets when it rebuilds the asset bundle.
    getAssets() {
        return this.uploadedAssets;
    }

    makeContainer(playerIds) {
        // Zero-size so the container itself can never swallow clicks.
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds
        });
    }

    // ------------------------------------------------------------------
    // Toolbar
    // ------------------------------------------------------------------

    buildToolbar() {
        this.toolbar = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, TOOLBAR_HEIGHT),
            fill: COLORS.CHARCOAL
        });

        // Per-player selection rings render beneath the swatches.
        this.markerRoot = this.makeContainer();
        this.toolbar.addChild(this.markerRoot);

        PALETTE.forEach((name, i) => {
            this.toolbar.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(SWATCH_X(i), SWATCH_Y, SWATCH_W, SWATCH_H),
                fill: COLORS[name],
                onClick: (playerId) => this.selectColor(playerId, i)
            }));
        });

        this.clearButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(46, 1.5, 10, 5),
            fill: COLORS.CANDY_RED,
            onClick: (playerId) => this.voteClear(playerId)
        });
        this.clearLabel = new GameNode.Text({
            textInfo: { text: 'CLEAR', x: 51, y: 2.1, size: 1.5, align: 'center', color: COLORS.WHITE }
        });
        this.clearVotesLabel = new GameNode.Text({
            textInfo: { text: '0/0', x: 51, y: 4.2, size: 1.1, align: 'center', color: COLORS.WHITE }
        });
        this.clearButton.addChildren(this.clearLabel, this.clearVotesLabel);

        this.toolbar.addChildren(
            this.clearButton,
            this.makeUploadButton(59, 'IMAGE', COLORS.COOL_BLUE),
            this.makeUploadButton(73, 'AUDIO', COLORS.FUNNY_PURPLE)
        );
    }

    // Zoom and pan live in their own bar, bottom-right, out of the way of the palette.
    buildControlBar() {
        this.controlBar = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(56, 92, 44, 8),
            fill: COLORS.CHARCOAL
        });

        this.zoomLabelRoot = this.makeContainer();

        this.controlBar.addChildren(
            this.makeToolButton(58, 93.5, '-', (playerId) => this.zoomCamera(playerId, 1)),
            this.makeToolButton(67, 93.5, '+', (playerId) => this.zoomCamera(playerId, -1)),
            this.zoomLabelRoot,
            this.makeToolButton(76, 93.5, '<', (playerId) => this.panCamera(playerId, -1, 0)),
            this.makeToolButton(81, 93.5, '^', (playerId) => this.panCamera(playerId, 0, -1)),
            this.makeToolButton(86, 93.5, 'v', (playerId) => this.panCamera(playerId, 0, 1)),
            this.makeToolButton(91, 93.5, '>', (playerId) => this.panCamera(playerId, 1, 0))
        );
    }

    makeToolButton(x, y, label, onClick) {
        const button = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, 4, 5),
            fill: COLORS.GUN_METAL_GRAY,
            onClick
        });
        button.addChild(new GameNode.Text({
            textInfo: { text: label, x: x + 2, y: y + 1.5, size: 2, align: 'center', color: COLORS.WHITE }
        }));
        return button;
    }

    // The click on this button opens the client's file picker; the picked
    // file arrives via oninput as bytes plus { kind, contentType, fileName }.
    makeUploadButton(x, label, fill) {
        const button = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, 1.5, 11, 5),
            fill,
            input: {
                type: 'file',
                oninput: (playerId, bytes, meta) => this.handleUpload(playerId, bytes, meta)
            }
        });
        button.addChild(new GameNode.Text({
            textInfo: { text: label, x: x + 5.5, y: 3, size: 1.6, align: 'center', color: COLORS.WHITE }
        }));
        return button;
    }

    markerCoordinates(colorIndex) {
        return ShapeUtils.rectangle(SWATCH_X(colorIndex) - 0.5, SWATCH_Y - 0.5, SWATCH_W + 1, SWATCH_H + 1);
    }

    selectColor(playerId, colorIndex) {
        const player = this.players[Number(playerId)];
        if (!player) {
            return;
        }
        player.colorIndex = colorIndex;
        player.lastDraw = null;
        player.activeChunk = null;
        player.marker.node.coordinates2d = this.markerCoordinates(colorIndex);
        this.base.node.onStateChange();
    }

    // ------------------------------------------------------------------
    // Players
    // ------------------------------------------------------------------

    // Scatter joiners across the board so 100 players get their own patch
    // instead of piling onto one spot. Stride 13 is coprime with 36, so
    // consecutive joiners land in far-apart cells.
    spawnCamera() {
        const cell = (this.joinCounter * 13) % (SPAWN_GRID * SPAWN_GRID);
        const cellSize = WORLD_SIZE / SPAWN_GRID;
        const centerX = ((cell % SPAWN_GRID) + 0.5) * cellSize;
        const centerY = (Math.floor(cell / SPAWN_GRID) + 0.5) * cellSize;
        const width = ZOOM_WIDTHS[DEFAULT_ZOOM_INDEX];
        return {
            x: clamp(centerX - width / 2, 0, WORLD_SIZE - width),
            y: clamp(centerY - width / 2, 0, WORLD_SIZE - width),
            zoomIndex: DEFAULT_ZOOM_INDEX
        };
    }

    handleNewPlayer({ playerId }) {
        const pid = Number(playerId);
        const player = {
            camera: this.spawnCamera(),
            colorIndex: this.joinCounter++ % ERASER_INDEX,
            lastDraw: null,
            activeChunk: null,
            lastPanAt: 0,
            lastZoomKeyAt: 0,
            gridLayer: this.makeContainer([pid]),
            imageLayer: this.makeContainer([pid]),
            strokeLayer: this.makeContainer([pid]),
            audioLayer: this.makeContainer([pid]),
            marker: null,
            zoomLabel: null
        };
        player.marker = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: this.markerCoordinates(player.colorIndex),
            fill: COLORS.WHITE,
            playerIds: [pid]
        });
        player.zoomLabel = new GameNode.Text({
            textInfo: this.zoomLabelText(DEFAULT_ZOOM_INDEX),
            playerIds: [pid]
        });

        this.players[pid] = player;
        this.gridRoot.addChild(player.gridLayer);
        this.imageRoot.addChild(player.imageLayer);
        this.strokeRoot.addChild(player.strokeLayer);
        this.audioRoot.addChild(player.audioLayer);
        this.markerRoot.addChild(player.marker);
        this.zoomLabelRoot.addChild(player.zoomLabel);

        this.renderGrid(pid);
        this.renderStrokes(pid);
        this.renderItems(pid);
        this.updateClearButton();
    }

    handlePlayerDisconnect(playerId) {
        const pid = Number(playerId);
        const player = this.players[pid];
        if (!player) {
            return;
        }
        for (const chunk of this.chunks) {
            delete chunk.nodes[pid];
        }
        this.gridRoot.removeChild(player.gridLayer.id);
        this.imageRoot.removeChild(player.imageLayer.id);
        this.strokeRoot.removeChild(player.strokeLayer.id);
        this.audioRoot.removeChild(player.audioLayer.id);
        this.markerRoot.removeChild(player.marker.id);
        this.zoomLabelRoot.removeChild(player.zoomLabel.id);
        delete this.players[pid];
        this.clearVotes.delete(pid);
        // The remaining votes may now be a majority of the remaining players.
        this.checkClearVotes();
        this.updateClearButton();
    }

    // ------------------------------------------------------------------
    // Camera
    // ------------------------------------------------------------------

    cameraWidth(player) {
        return ZOOM_WIDTHS[player.camera.zoomIndex];
    }

    screenToWorld(player, screenX, screenY) {
        const camWidth = this.cameraWidth(player);
        return [
            player.camera.x + (screenX / 100) * camWidth,
            player.camera.y + (screenY / 100) * camWidth
        ];
    }

    zoomLabelText(zoomIndex) {
        const percent = Math.round(100 * ZOOM_WIDTHS[DEFAULT_ZOOM_INDEX] / ZOOM_WIDTHS[zoomIndex]);
        return { text: `${percent}%`, x: 64.5, y: 95.2, size: 1.6, align: 'center', color: COLORS.WHITE };
    }

    panCamera(playerId, dx, dy) {
        const player = this.players[Number(playerId)];
        if (!player) {
            return;
        }
        const now = Date.now();
        if (now - player.lastPanAt < PAN_GATE_MS) {
            return;
        }
        player.lastPanAt = now;

        const camWidth = this.cameraWidth(player);
        const newX = clamp(player.camera.x + dx * camWidth * PAN_STEP, 0, WORLD_SIZE - camWidth);
        const newY = clamp(player.camera.y + dy * camWidth * PAN_STEP, 0, WORLD_SIZE - camWidth);
        if (newX === player.camera.x && newY === player.camera.y) {
            return;
        }
        player.camera.x = newX;
        player.camera.y = newY;
        this.refreshView(Number(playerId));
    }

    zoomCamera(playerId, delta) {
        const player = this.players[Number(playerId)];
        if (!player) {
            return;
        }
        const newIndex = clamp(player.camera.zoomIndex + delta, 0, ZOOM_WIDTHS.length - 1);
        if (newIndex === player.camera.zoomIndex) {
            return;
        }
        const oldWidth = this.cameraWidth(player);
        const newWidth = ZOOM_WIDTHS[newIndex];
        const centerX = player.camera.x + oldWidth / 2;
        const centerY = player.camera.y + oldWidth / 2;
        player.camera.zoomIndex = newIndex;
        player.camera.x = clamp(centerX - newWidth / 2, 0, WORLD_SIZE - newWidth);
        player.camera.y = clamp(centerY - newWidth / 2, 0, WORLD_SIZE - newWidth);
        this.refreshView(Number(playerId));
    }

    refreshView(pid) {
        const player = this.players[pid];
        this.renderGrid(pid);
        this.renderStrokes(pid);
        this.renderItems(pid);
        player.zoomLabel.node.text = this.zoomLabelText(player.camera.zoomIndex);
        this.base.node.onStateChange();
    }

    handleKeyDown(playerId, key) {
        const player = this.players[Number(playerId)];
        if (!player) {
            return;
        }
        if (key === 'ArrowLeft' || key === 'a') {
            this.panCamera(playerId, -1, 0);
        } else if (key === 'ArrowRight' || key === 'd') {
            this.panCamera(playerId, 1, 0);
        } else if (key === 'ArrowUp' || key === 'w') {
            this.panCamera(playerId, 0, -1);
        } else if (key === 'ArrowDown' || key === 's') {
            this.panCamera(playerId, 0, 1);
        } else if (key === '=' || key === '+' || key === '-' || key === '_') {
            const now = Date.now();
            if (now - player.lastZoomKeyAt < ZOOM_KEY_GATE_MS) {
                return;
            }
            player.lastZoomKeyAt = now;
            this.zoomCamera(playerId, (key === '=' || key === '+') ? -1 : 1);
        }
    }

    // ------------------------------------------------------------------
    // Drawing
    // ------------------------------------------------------------------

    handleDraw(playerId, x, y) {
        const pid = Number(playerId);
        const player = this.players[pid];
        if (!player) {
            return;
        }

        const now = Date.now();
        const [worldX, worldY] = this.screenToWorld(player, x, y);
        const worldPerScreen = this.cameraWidth(player) / 100;

        const linked = player.activeChunk
            && player.lastDraw
            && (now - player.lastDraw.time) < STROKE_LINK_MS;

        if (linked) {
            let chunk = player.activeChunk;
            const lastPoint = chunk.points[chunk.points.length - 1];
            if (Math.hypot(worldX - lastPoint[0], worldY - lastPoint[1]) < MIN_POINT_SCREEN_DIST * worldPerScreen) {
                player.lastDraw = { time: now };
                return;
            }
            if (chunk.points.length >= MAX_POINTS_PER_CHUNK) {
                // Chain a new chunk starting where the full one ended so the line stays continuous.
                chunk = this.startChunk(lastPoint[0], lastPoint[1], chunk.color, chunk.thickness);
                player.activeChunk = chunk;
            }
            chunk.points.push([worldX, worldY]);
            chunk.bounds.minX = Math.min(chunk.bounds.minX, worldX);
            chunk.bounds.maxX = Math.max(chunk.bounds.maxX, worldX);
            chunk.bounds.minY = Math.min(chunk.bounds.minY, worldY);
            chunk.bounds.maxY = Math.max(chunk.bounds.maxY, worldY);
        } else {
            const isEraser = player.colorIndex === ERASER_INDEX;
            const thickness = PEN_WORLD_WIDTH * (isEraser ? ERASER_MULTIPLIER : 1);
            player.activeChunk = this.startChunk(worldX, worldY, COLORS[PALETTE[player.colorIndex]], thickness);
        }

        player.lastDraw = { time: now };
        this.refreshChunkNodes(player.activeChunk);
        this.base.node.onStateChange();
    }

    handleMouseUp(playerId) {
        const player = this.players[Number(playerId)];
        if (!player) {
            return;
        }
        player.lastDraw = null;
        player.activeChunk = null;
    }

    startChunk(worldX, worldY, color, thickness) {
        const chunk = {
            color,
            thickness,
            points: [[worldX, worldY]],
            bounds: { minX: worldX, maxX: worldX, minY: worldY, maxY: worldY },
            nodes: {}
        };
        this.chunks.push(chunk);

        while (this.chunks.length > MAX_CHUNKS) {
            const oldest = this.chunks.shift();
            for (const pid in oldest.nodes) {
                const viewer = this.players[pid];
                if (viewer) {
                    viewer.strokeLayer.removeChild(oldest.nodes[pid].id);
                }
            }
            for (const pid in this.players) {
                if (this.players[pid].activeChunk === oldest) {
                    this.players[pid].activeChunk = null;
                    this.players[pid].lastDraw = null;
                }
            }
        }
        return chunk;
    }

    chunkVisible(chunk, player) {
        const camWidth = this.cameraWidth(player);
        const margin = chunk.thickness;
        return chunk.bounds.minX - margin < player.camera.x + camWidth
            && chunk.bounds.maxX + margin > player.camera.x
            && chunk.bounds.minY - margin < player.camera.y + camWidth
            && chunk.bounds.maxY + margin > player.camera.y;
    }

    // A stroke rendered for one viewer: the polyline extruded into a thin closed strip.
    // Far-away chunks are simplified (a speck, or a point-sampled strip) so massive
    // zoomed-out views stay cheap to serialize.
    buildChunkCoordinates(chunk, player) {
        const camWidth = this.cameraWidth(player);
        const scale = 100 / camWidth;
        const half = Math.max((chunk.thickness / 2) * scale, MIN_HALF_WIDTH);
        const extent = Math.max(
            chunk.bounds.maxX - chunk.bounds.minX,
            chunk.bounds.maxY - chunk.bounds.minY
        ) * scale;

        if (chunk.points.length === 1 || extent < DOT_LOD_EXTENT) {
            const centerX = ((chunk.bounds.minX + chunk.bounds.maxX) / 2 - player.camera.x) * scale;
            const centerY = ((chunk.bounds.minY + chunk.bounds.maxY) / 2 - player.camera.y) * scale;
            const size = Math.max(extent / 2, half);
            return ShapeUtils.rectangle(centerX - size, centerY - size, size * 2, size * 2)
                .map(([vx, vy]) => [clampScreen(vx), clampScreen(vy)]);
        }

        let sourcePoints = chunk.points;
        const targetPoints = clamp(Math.round(extent * 1.5), 8, MAX_POINTS_PER_CHUNK);
        if (sourcePoints.length > targetPoints) {
            const stride = Math.ceil(sourcePoints.length / targetPoints);
            const sampled = [];
            for (let i = 0; i < sourcePoints.length; i += stride) {
                sampled.push(sourcePoints[i]);
            }
            const last = sourcePoints[sourcePoints.length - 1];
            if (sampled[sampled.length - 1] !== last) {
                sampled.push(last);
            }
            sourcePoints = sampled;
        }

        const points = sourcePoints.map(([wx, wy]) => [
            (wx - player.camera.x) * scale,
            (wy - player.camera.y) * scale
        ]);

        const top = [];
        const bottom = [];
        for (let i = 0; i < points.length; i++) {
            const prev = points[Math.max(0, i - 1)];
            const next = points[Math.min(points.length - 1, i + 1)];
            const dx = next[0] - prev[0];
            const dy = next[1] - prev[1];
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            top.push([clampScreen(points[i][0] + nx * half), clampScreen(points[i][1] + ny * half)]);
            bottom.push([clampScreen(points[i][0] - nx * half), clampScreen(points[i][1] - ny * half)]);
        }
        bottom.reverse();
        const strip = top.concat(bottom);
        strip.push([strip[0][0], strip[0][1]]);
        return strip;
    }

    // Incremental update as a stroke grows: touch only the viewers who can see it.
    refreshChunkNodes(chunk) {
        for (const pid in this.players) {
            const player = this.players[pid];
            if (!this.chunkVisible(chunk, player)) {
                continue;
            }
            const existing = chunk.nodes[pid];
            if (existing) {
                existing.node.coordinates2d = this.buildChunkCoordinates(chunk, player);
            } else {
                const node = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: this.buildChunkCoordinates(chunk, player),
                    fill: chunk.color,
                    playerIds: [Number(pid)]
                });
                chunk.nodes[pid] = node;
                player.strokeLayer.addChild(node);
            }
        }
    }

    // Full rebuild of one viewer's strokes; used after camera moves.
    renderStrokes(pid) {
        const player = this.players[pid];
        player.strokeLayer.clearChildren();
        const visibleNodes = [];
        for (const chunk of this.chunks) {
            delete chunk.nodes[pid];
            if (this.chunkVisible(chunk, player)) {
                const node = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: this.buildChunkCoordinates(chunk, player),
                    fill: chunk.color,
                    playerIds: [pid]
                });
                chunk.nodes[pid] = node;
                visibleNodes.push(node);
            }
        }
        if (visibleNodes.length) {
            player.strokeLayer.addChildren(...visibleNodes);
        }
    }

    renderGrid(pid) {
        const player = this.players[pid];
        player.gridLayer.clearChildren();
        const camWidth = this.cameraWidth(player);
        const scale = 100 / camWidth;
        const lines = [];

        const vertical = (screenX, width, color) => {
            lines.push(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(clamp(screenX - width / 2, 0, 100 - width), 0, width, 100),
                fill: color,
                playerIds: [pid]
            }));
        };
        const horizontal = (screenY, width, color) => {
            lines.push(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, clamp(screenY - width / 2, 0, 100 - width), 100, width),
                fill: color,
                playerIds: [pid]
            }));
        };

        // Grid spacing tracks the zoom so a handful of lines are always visible.
        const spacing = camWidth / 4;
        for (let g = Math.ceil(player.camera.x / spacing) * spacing; g <= player.camera.x + camWidth; g += spacing) {
            if (g > 0 && g < WORLD_SIZE) {
                vertical((g - player.camera.x) * scale, 0.15, GRID_COLOR);
            }
        }
        for (let g = Math.ceil(player.camera.y / spacing) * spacing; g <= player.camera.y + camWidth; g += spacing) {
            if (g > 0 && g < WORLD_SIZE) {
                horizontal((g - player.camera.y) * scale, 0.15, GRID_COLOR);
            }
        }

        // World borders, drawn heavier so hitting the edge of the board is obvious.
        for (const edge of [0, WORLD_SIZE]) {
            const screenX = (edge - player.camera.x) * scale;
            if (screenX >= -1 && screenX <= 101) {
                vertical(screenX, 0.5, EDGE_COLOR);
            }
            const screenY = (edge - player.camera.y) * scale;
            if (screenY >= -1 && screenY <= 101) {
                horizontal(screenY, 0.5, EDGE_COLOR);
            }
        }

        if (lines.length) {
            player.gridLayer.addChildren(...lines);
        }
    }

    // ------------------------------------------------------------------
    // Uploaded board objects (images and audio blocks)
    // ------------------------------------------------------------------

    handleUpload(playerId, bytes, meta) {
        const player = this.players[Number(playerId)];
        if (!player || !meta || !meta.kind) {
            return;
        }

        const kind = meta.kind;
        const assetKey = `upload-${++this.itemCounter}`;
        const camWidth = this.cameraWidth(player);

        let width, height;
        if (kind === 'image') {
            const dims = getImageDimensions(bytes);
            const aspect = (dims && dims.width > 0 && dims.height > 0) ? dims.width / dims.height : 1;
            if (aspect >= 1) {
                width = IMAGE_MAX_WORLD;
                height = IMAGE_MAX_WORLD / aspect;
            } else {
                height = IMAGE_MAX_WORLD;
                width = IMAGE_MAX_WORLD * aspect;
            }
        } else {
            width = AUDIO_BLOCK_WORLD;
            height = AUDIO_BLOCK_WORLD;
        }

        // Drop it in the middle of the uploader's current view.
        const x = clamp(player.camera.x + camWidth / 2 - width / 2, 0, WORLD_SIZE - width);
        const y = clamp(player.camera.y + camWidth / 2 - height / 2, 0, WORLD_SIZE - height);

        const asset = new Asset({ id: assetKey, type: kind }, bytes);
        this.uploadedAssets[assetKey] = asset;

        this.addAsset(assetKey, asset).then(() => {
            this.items.push({ kind, assetKey, x, y, width, height });
            while (this.items.length > MAX_BOARD_ITEMS) {
                this.dropOldestItem();
            }
            this.renderAllItems();
        }).catch(() => {
            delete this.uploadedAssets[assetKey];
        });
    }

    dropOldestItem() {
        const oldest = this.items.shift();
        delete this.uploadedAssets[oldest.assetKey];
        const soundNode = this.soundNodes[oldest.assetKey];
        if (soundNode) {
            this.soundRoot.removeChild(soundNode.id);
            delete this.soundNodes[oldest.assetKey];
        }
    }

    renderAllItems() {
        for (const pid in this.players) {
            this.renderItems(Number(pid));
        }
        this.base.node.onStateChange();
    }

    // Project a world-space item through a player's camera. Returns the raw
    // screen rect plus its viewport-clamped visible portion, or null when
    // fully off-screen.
    projectItem(item, player) {
        const camWidth = this.cameraWidth(player);
        const scale = 100 / camWidth;
        const sx = (item.x - player.camera.x) * scale;
        const sy = (item.y - player.camera.y) * scale;
        const sw = item.width * scale;
        const sh = item.height * scale;
        const vx0 = Math.max(0, sx);
        const vy0 = Math.max(0, sy);
        const vx1 = Math.min(100, sx + sw);
        const vy1 = Math.min(100, sy + sh);
        // Skip sub-precision slivers: the wire rounds coordinates and crops to
        // 2 decimals, so a fraction-of-a-unit visible edge renders as a
        // stretched band of edge pixels rather than meaningful content.
        if (vx1 - vx0 < 0.1 || vy1 - vy0 < 0.1) {
            return null;
        }
        return { sx, sy, sw, sh, vx0, vy0, vx1, vy1 };
    }

    renderItems(pid) {
        const player = this.players[pid];
        player.imageLayer.clearChildren();
        player.audioLayer.clearChildren();
        const images = [];
        const blocks = [];
        for (const item of this.items) {
            const rect = this.projectItem(item, player);
            if (!rect) {
                continue;
            }
            if (item.kind === 'image') {
                images.push(this.buildImageNode(item, rect, pid));
            } else {
                blocks.push(...this.buildAudioNodes(item, rect, pid));
            }
        }
        if (images.length) {
            player.imageLayer.addChildren(...images);
        }
        if (blocks.length) {
            player.audioLayer.addChildren(...blocks);
        }
    }

    // Images keep their aspect ratio at every zoom; when partially off-screen
    // the visible sub-region is selected with the crop fields so nothing is
    // drawn (or squashed) outside the viewport.
    buildImageNode(item, rect, pid) {
        // Exact crop percentages; the previous coarse 0-99 clamp caused up to
        // a 1%-of-source mismatch between dest rect and source rect, which
        // reads as a visible stretch/smear band on edge slivers.
        const cropPct = (hidden, total) => clamp((hidden / total) * 100, 0, 99.95);
        return new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            assetInfo: {
                [item.assetKey]: {
                    pos: { x: rect.vx0, y: rect.vy0 },
                    size: { x: rect.vx1 - rect.vx0, y: rect.vy1 - rect.vy0 },
                    cropLeft: cropPct(rect.vx0 - rect.sx, rect.sw),
                    cropTop: cropPct(rect.vy0 - rect.sy, rect.sh),
                    cropRight: cropPct(rect.sx + rect.sw - rect.vx1, rect.sw),
                    cropBottom: cropPct(rect.sy + rect.sh - rect.vy1, rect.sh)
                }
            },
            playerIds: [pid]
        });
    }

    // An audio upload is a glowing play-button block on the board.
    buildAudioNodes(item, rect, pid) {
        const clampPoint = ([px, py]) => [clampScreen(px), clampScreen(py)];
        const onClick = () => this.playBoardAudio(item);

        const block = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(rect.sx, rect.sy, rect.sw, rect.sh).map(clampPoint),
            fill: COLORS.HG_BLACK,
            effects: { shadow: { color: [0, 255, 255, 255], blur: 14 } },
            onClick,
            playerIds: [pid]
        });
        // The triangle shares the block's onClick — a non-clickable node on
        // top would swallow taps that land on it.
        const triangle = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [rect.sx + rect.sw * 0.38, rect.sy + rect.sh * 0.28],
                [rect.sx + rect.sw * 0.38, rect.sy + rect.sh * 0.72],
                [rect.sx + rect.sw * 0.74, rect.sy + rect.sh * 0.5],
                [rect.sx + rect.sw * 0.38, rect.sy + rect.sh * 0.28]
            ].map(clampPoint),
            fill: [0, 255, 255, 255],
            onClick,
            playerIds: [pid]
        });
        return [block, triangle];
    }

    playBoardAudio(item) {
        // The client starts a sound when its node appears and stops it when
        // the node leaves the tree — remove, then re-add a beat later, restarts
        // playback for everyone.
        const existing = this.soundNodes[item.assetKey];
        if (existing) {
            this.soundRoot.removeChild(existing.id);
            delete this.soundNodes[item.assetKey];
        }
        this.setTimeout(() => {
            if (!this.uploadedAssets[item.assetKey]) {
                return; // dropped or cleared while waiting
            }
            const node = new GameNode.Asset({
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                assetInfo: {
                    [item.assetKey]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 }
                }
            });
            this.soundNodes[item.assetKey] = node;
            this.soundRoot.addChild(node);
        }, 100);
    }

    // ------------------------------------------------------------------
    // Clear (vote-gated: strict majority of connected players, then cooldown)
    // ------------------------------------------------------------------

    voteClear(playerId) {
        if (Date.now() < this.clearReadyAt) {
            return;
        }
        const pid = Number(playerId);
        if (!this.players[pid]) {
            return;
        }
        if (this.clearVotes.has(pid)) {
            this.clearVotes.delete(pid);
        } else {
            this.clearVotes.add(pid);
        }
        this.checkClearVotes();
        this.updateClearButton();
    }

    checkClearVotes() {
        const total = Object.keys(this.players).length;
        if (total > 0 && this.clearVotes.size > total / 2) {
            this.executeClear();
        }
    }

    executeClear() {
        for (const chunk of this.chunks) {
            chunk.nodes = {};
        }
        this.chunks = [];
        this.items = [];
        this.uploadedAssets = {};
        for (const key in this.soundNodes) {
            this.soundRoot.removeChild(this.soundNodes[key].id);
        }
        this.soundNodes = {};
        for (const pid in this.players) {
            const player = this.players[pid];
            player.strokeLayer.clearChildren();
            player.imageLayer.clearChildren();
            player.audioLayer.clearChildren();
            player.activeChunk = null;
            player.lastDraw = null;
        }
        this.clearVotes.clear();
        this.clearReadyAt = Date.now() + CLEAR_COOLDOWN_MS;
        this.clearTicker = this.setInterval(() => this.updateClearButton(), 1000);
    }

    updateClearButton() {
        const msLeft = this.clearReadyAt - Date.now();
        if (msLeft <= 0) {
            if (this.clearTicker) {
                clearInterval(this.clearTicker);
                this.clearTicker = null;
            }
            const total = Object.keys(this.players).length;
            this.clearButton.node.fill = COLORS.CANDY_RED;
            this.clearLabel.node.text = { text: 'CLEAR', x: 51, y: 2.1, size: 1.5, align: 'center', color: COLORS.WHITE };
            this.clearVotesLabel.node.text = { text: `${this.clearVotes.size}/${total}`, x: 51, y: 4.2, size: 1.1, align: 'center', color: COLORS.WHITE };
        } else {
            this.clearButton.node.fill = COLORS.DIM_GRAY;
            this.clearLabel.node.text = { text: `${Math.ceil(msLeft / 1000)}s`, x: 51, y: 2.1, size: 1.5, align: 'center', color: COLORS.WHITE };
            this.clearVotesLabel.node.text = { text: '', x: 51, y: 4.2, size: 1.1, align: 'center', color: COLORS.WHITE };
        }
        this.base.node.onStateChange();
    }
}

module.exports = Draw;
