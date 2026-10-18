'use strict';
const { normalizeMetadata } = require('homegames-common/runtime-metadata');
const { squishMap } = require('homegames-common/game-loader');
const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);

const validateMetadata = (metadata, detectedSquishVersion) => {
    const errors = [];
    const warnings = [];

    if (!isPlainObject(metadata)) {
        return { errors: ['metadata() must return an object'], warnings, metadata };
    }

    try {
        metadata = normalizeMetadata(metadata, { runtime: detectedSquishVersion, legacy: true });
        if (!squishMap[metadata.squishVersion]) errors.push('The Squish import must select a supported runtime');
    } catch (error) { errors.push(error.message); }

    // name — required for catalog display
    if (metadata.name === undefined || metadata.name === null) {
        errors.push('metadata() must return a name');
    } else if (typeof metadata.name !== 'string' || metadata.name.trim().length === 0) {
        errors.push('metadata().name must be a non-empty string');
    } else if (metadata.name.length > 100) {
        errors.push('metadata().name must be 100 characters or fewer');
    }

    if (metadata.description !== undefined && (typeof metadata.description !== 'string' || metadata.description.length > 1000)) {
        errors.push('metadata().description must be a string of 1000 characters or fewer');
    }

    if (metadata.author !== undefined && typeof metadata.author !== 'string') {
        errors.push('metadata().author must be a string');
    }

    if (metadata.aspectRatio !== undefined) {
        const ar = metadata.aspectRatio;
        if (!isPlainObject(ar) || !isFiniteNumber(ar.x) || !isFiniteNumber(ar.y) || ar.x <= 0 || ar.y <= 0) {
            errors.push('metadata().aspectRatio must be an object like { x: 16, y: 9 } with positive numbers');
        }
    }

    if (metadata.tickRate !== undefined) {
        if (!isFiniteNumber(metadata.tickRate) || metadata.tickRate < 1 || metadata.tickRate > 120) {
            errors.push('metadata().tickRate must be a number between 1 and 120');
        }
    }

    if (metadata.assets !== undefined) {
        if (!isPlainObject(metadata.assets)) {
            errors.push('metadata().assets must be an object mapping keys to Asset instances');
        } else {
            for (const key of Object.keys(metadata.assets)) {
                const asset = metadata.assets[key];
                const info = asset && asset.info;
                if (!info || typeof info !== 'object') {
                    errors.push(`metadata().assets["${key}"] is not a valid Asset (missing info)`);
                } else if (info.id !== undefined && (typeof info.id !== 'string' || info.id.trim().length === 0)) {
                    errors.push(`metadata().assets["${key}"] has an invalid id`);
                }
            }
        }
    }

    return { errors, warnings, metadata };
};

module.exports = { validateMetadata };
