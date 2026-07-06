// LocalLibrary — the dashboard's view of games installed on disk.
//
// Extracted from HomegamesDashboard.js (getGameMap / getGamePathsHelper / the
// .metadata read+write helpers). This is the offline source of truth: it scans
// the built-in (source) games and the downloaded games directory, and resolves
// each into the {metadata, versions} shape the dashboard renders.
//
// Directories are injected (rather than read from module-load-time globals), so
// the scan, the downloaded-game mapping, and the .metadata round-trip can be
// unit-tested against temp directories without touching real app data.

const fs = require('fs');
const path = require('path');

const { log } = require('homegames-common');

// Pure recursive scan for index.js entry points under `dir`. Returns a Set of
// absolute paths. Missing/unreadable directories are logged and treated as empty.
const getGamePaths = (dir) => {
    let entries = [];
    try {
        entries = fs.readdirSync(dir);
    } catch (err) {
        console.error('Unable to read game directory');
        console.error(err);
    }
    const results = new Set();

    entries.forEach((entry) => {
        const entryPath = path.resolve(`${dir}${path.sep}${entry}`);

        const metadata = fs.statSync(entryPath);
        if (metadata.isFile()) {
            const pathSep = path.sep === '\\' ? '\\\\' : path.sep;
            const pathRegex = new RegExp(`(?:^|[${pathSep}])index\\.js$`);
            const isMatch = pathRegex.test(entryPath);

            if (isMatch) {
                if (entryPath.endsWith('index.js')) {
                    results.add(entryPath);
                }
            }
        } else if (metadata.isDirectory()) {
            const nestedPaths = getGamePaths(entryPath);
            nestedPaths.forEach((nestedPath) => results.add(nestedPath));
        }
    });

    return results;
};

const createLocalLibrary = ({ sourceGameDir, downloadedGameDir, localGameDir = null }) => {
    if (!sourceGameDir || !downloadedGameDir) {
        throw new Error('createLocalLibrary requires sourceGameDir and downloadedGameDir');
    }

    const metadataFile = downloadedGameDir + path.sep + '.metadata';

    const writeMetadataMap = (newMetadata) => {
        fs.writeFileSync(metadataFile, JSON.stringify(newMetadata));
    };

    const readMetadataMap = () => {
        if (fs.existsSync(metadataFile)) {
            return JSON.parse(fs.readFileSync(metadataFile));
        }
        return {};
    };

    // Ensure the downloaded-games directory exists (best-effort, logged on failure).
    const ensureDirs = () => {
        if (!fs.existsSync(downloadedGameDir)) {
            try {
                fs.mkdirSync(downloadedGameDir, { recursive: true });
            } catch (err) {
                log.error('Unable to create downloaded game directory');
                log.error(err);
            }
        }
    };

    // Build the full game map: built-in source games (loaded via require, carrying
    // the synthetic 'local-game-version') merged with downloaded games (resolved
    // from .metadata, grouped by gameId/versionId).
    const scan = () => {
        const sourceGames = getGamePaths(sourceGameDir);
        const downloadedGames = getGamePaths(downloadedGameDir);

        const gamePaths = Array.from(new Set([...sourceGames, ...downloadedGames])).sort();

        const games = {};

        const gameMetadataMap = readMetadataMap();
        gamePaths.forEach((gamePath) => {
            const isLocal = sourceGames.has(gamePath);
            if (isLocal) {
                const gameClass = require(gamePath);

                if (!gameClass.name || !gameClass.metadata) {
                    log.info('Unknown game at path ' + gamePath);
                } else {
                    const gameMetadata = gameClass.metadata ? gameClass.metadata() : {};

                    games[gameClass.name] = {
                        metadata: {
                            name: gameMetadata.name || gameClass.name,
                            thumbnail: gameMetadata.thumbnail,
                            thumbnailSource: gameMetadata.thumbnailSource,
                            author: gameMetadata.createdBy || 'Unknown author',
                            isTest: gameMetadata.isTest || false
                        },
                        versions: {
                            'local-game-version': {
                                gameId: gameClass.name,
                                class: gameClass,
                                metadata: { ...gameMetadata },
                                gamePath,
                                versionId: 'local-game-version',
                                description: gameMetadata.description || 'No description available',
                                version: 0,
                                approved: true
                            }
                        }
                    };
                }
            } else {
                const storedMetadata = gameMetadataMap[gamePath] || {};

                const gameId = storedMetadata?.game?.gameId;
                const versionId = storedMetadata?.version?.versionId;

                if (!gameId || !versionId) {
                    console.warn('Unknown game at ' + gamePath);
                } else {
                    if (!games[gameId]) {
                        games[gameId] = {
                            metadata: storedMetadata.game,
                            versions: {}
                        };
                    }

                    games[gameId].versions[versionId] = {
                        gameId,
                        metadata: storedMetadata.version,
                        gamePath,
                        versionId,
                        version: storedMetadata.version.version,
                        approved: storedMetadata.version.approved
                    };
                }
            }
        });

        if (localGameDir) {
            const resolvedLocalGameDir = path.resolve(localGameDir);

            if (!fs.existsSync(localGameDir)) {
                fs.mkdirSync(localGameDir);
            }

            const localGamePaths = getGamePaths(resolvedLocalGameDir);

            localGamePaths.forEach((gamePath) => {
                log.info('Using local game at path ' + gamePath);
                const gameClass = require(gamePath);
                const gameMetadata = gameClass.metadata ? gameClass.metadata() : {};

                games[gameClass.name] = {
                    metadata: {
                        name: gameMetadata.name || gameClass.name,
                        thumbnail: gameMetadata.thumbnail,
                        description: gameMetadata.description,
                        thumbnailSource: gameMetadata.thumbnailSource,
                        author: gameMetadata.createdBy || 'Unknown author'
                    },
                    versions: {
                        'local-game-version': {
                            gameId: gameClass.name,
                            class: gameClass,
                            metadata: { ...gameMetadata },
                            gamePath,
                            versionId: 'local-game-version',
                            description: gameMetadata.description || 'No description available',
                            version: 0,
                            approved: true
                        }
                    }
                };
            });
        }

        return games;
    };

    return {
        scan,
        getGamePaths,
        readMetadataMap,
        writeMetadataMap,
        ensureDirs,
        sourceGameDir,
        downloadedGameDir,
        metadataFile,
    };
};

module.exports = { createLocalLibrary, getGamePaths };
