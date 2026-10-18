'use strict';
const { FIELD, clamp } = require('./content');

// The camera moves the battlefield only. Menus and the posse controls remain
// in the same 160 × 100 screen coordinates as the rest of the game.
const VIEWPORT = Object.freeze({ x: 0, y: 18, w: 124, h: 64.5 });
const MAX_ZOOM = 1.6;
const screenCenter = { x: VIEWPORT.x + VIEWPORT.w / 2, y: VIEWPORT.y + VIEWPORT.h / 2 };

function worldBounds(level) {
    const bounds = level?.bounds;
    const w = Number.isFinite(bounds?.w) && bounds.w > 0 ? bounds.w : FIELD.w;
    const h = Number.isFinite(bounds?.h) && bounds.h > 0 ? bounds.h : FIELD.h;
    return { x: 0, y: 18, w: w + 8, h: h + 2.5 };
}

function fitZoom(level) {
    const world = worldBounds(level);
    return Math.min(1, VIEWPORT.w / world.w, VIEWPORT.h / world.h);
}

function clampCamera(camera, level) {
    const world = worldBounds(level);
    camera.zoom = clamp(Number.isFinite(camera.zoom) ? camera.zoom : fitZoom(level), fitZoom(level), MAX_ZOOM);
    for (const [axis, extent, visible] of [['x', 'w', VIEWPORT.w], ['y', 'h', VIEWPORT.h]]) {
        const center = world[axis] + world[extent] / 2;
        const half = visible / camera.zoom / 2;
        const value = Number.isFinite(camera[axis]) ? camera[axis] : center;
        camera[axis] = half * 2 >= world[extent] ? center : clamp(value, world[axis] + half, world[axis] + world[extent] - half);
    }
    return camera;
}

function createCamera(level, overview = true) {
    const world = worldBounds(level);
    return clampCamera({ x: world.x + world.w / 2, y: world.y + world.h / 2, zoom: overview ? fitZoom(level) : 1 }, level);
}

function worldToScreen(camera, x, y) {
    return { x: screenCenter.x + (x - camera.x) * camera.zoom, y: screenCenter.y + (y - camera.y) * camera.zoom };
}

function screenToWorld(camera, x, y) {
    return { x: camera.x + (x - screenCenter.x) / camera.zoom, y: camera.y + (y - screenCenter.y) / camera.zoom };
}

function panCamera(camera, level, dx, dy) {
    clampCamera(camera, level);
    camera.x += Number.isFinite(dx) ? dx : 0;
    camera.y += Number.isFinite(dy) ? dy : 0;
    return clampCamera(camera, level);
}

function zoomCamera(camera, level, factor, anchorScreen = screenCenter) {
    clampCamera(camera, level);
    if (!Number.isFinite(factor) || factor <= 0) return camera;
    const anchor = Number.isFinite(anchorScreen?.x) && Number.isFinite(anchorScreen?.y) ? anchorScreen : screenCenter;
    const world = screenToWorld(camera, anchor.x, anchor.y);
    camera.zoom = clamp(camera.zoom * factor, fitZoom(level), MAX_ZOOM);
    camera.x = world.x - (anchor.x - screenCenter.x) / camera.zoom;
    camera.y = world.y - (anchor.y - screenCenter.y) / camera.zoom;
    return clampCamera(camera, level);
}

function fitCamera(camera, level) {
    Object.assign(camera, createCamera(level));
    return camera;
}

module.exports = { VIEWPORT, worldBounds, createCamera, fitZoom, clampCamera, worldToScreen, screenToWorld, panCamera, zoomCamera, fitCamera };
