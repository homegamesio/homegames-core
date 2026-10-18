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
const { effectiveGameMetadata, readGameMetadata } = require('../util/game-metadata');

// Pure recursive scan for index.js entry points under `dir`. Returns a Set of
// absolute paths. Missing/unreadable directories are logged and treated as empty.
const getGamePaths = (dir) => {
    if (fs.existsSync(path.join(dir, 'homegame.json'))) {
        try {
            const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'homegame.json'), 'utf8'));
            const entry = require('homegames-common/portable-project').normalizePath(manifest.entry);
            const file = path.join(dir, entry);
            if (fs.statSync(file).isFile()) return new Set([file]);
        } catch (error) { log.error(`Invalid game folder ${dir}: ${error.message}`); }
        return new Set();
    }
    // Helpers inside a game may also be named index.js; they are not games.
    if (fs.existsSync(path.join(dir, 'index.js'))) return new Set([path.join(dir, 'index.js')]);
    let entries = [];
    try {
        entries = fs.readdirSync(dir);
    } catch (err) {
        console.error('Unable to read game directory');
        console.error(err);
    }
    const results = new Set();

    entries.forEach((entry) => {
        if (entry.startsWith('.') || entry === 'node_modules' || entry === 'assets') return;
        const entryPath = path.resolve(`${dir}${path.sep}${entry}`);

        const metadata = fs.lstatSync(entryPath);
        if (metadata.isSymbolicLink()) return;
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
    // Removing redundant authored manifests must not move existing server saves
    // or household links to a different dashboard key.
    const legacyKeysFile = path.join(sourceGameDir, 'legacy-dashboard-keys.json');
    const legacyKeys = fs.existsSync(legacyKeysFile) ? JSON.parse(fs.readFileSync(legacyKeysFile, 'utf8')) : {};


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
            try {
            let projectRoot = path.dirname(gamePath), manifest = null;
            while (projectRoot !== path.dirname(projectRoot)) {
                const candidate = path.join(projectRoot, 'homegame.json');
                if (fs.existsSync(candidate)) { manifest = JSON.parse(fs.readFileSync(candidate, 'utf8')); break; }
                if ([sourceGameDir, downloadedGameDir].includes(projectRoot)) break;
                projectRoot = path.dirname(projectRoot);
            }
            const relativeDownload = path.relative(downloadedGameDir, gamePath).split(path.sep);
            if (!manifest && relativeDownload[0] === 'portable' && /^[a-f0-9]{64}$/.test(relativeDownload[2] || '')) {
                const parsed = readGameMetadata(gamePath);
                if (parsed.error) throw new Error(parsed.error);
                if (parsed.gameId?.toLowerCase() !== relativeDownload[1].toLowerCase()) throw new Error('Imported game identity does not match its installation directory');
                projectRoot = path.join(downloadedGameDir, ...relativeDownload.slice(0, 3));
                manifest = { gameId: parsed.gameId, entry: path.relative(projectRoot, gamePath) };
            }
            const isLocal = sourceGames.has(gamePath) || !!manifest;
            if (isLocal) {
                // Imported packs are inspected as data. Execute their source
                // only when a player explicitly starts a game session.
                const gameClass = manifest ? class PortableGame {
                    static metadata() { return readGameMetadata(gamePath); }
                } : require('homegames-common/game-loader').loadGameClassFromPath(gamePath);
                if (manifest) Object.defineProperty(gameClass, 'name', { value: manifest.gameId.toLowerCase().replace(/-/g, '') });

                if (!gameClass.name || !gameClass.metadata) {
                    log.info('Unknown game at path ' + gamePath);
                } else {
                    const gameMetadata = manifest ? gameClass.metadata() : effectiveGameMetadata(gameClass, gamePath);
                    if (gameMetadata.error) throw new Error(gameMetadata.error);
                    const gameKey = sourceGames.has(gamePath) && legacyKeys[gameMetadata.gameId] || gameClass.name;
                    const versionId = manifest && /^[a-f0-9]{64}$/.test(path.basename(projectRoot)) ? path.basename(projectRoot) : 'local-game-version';
                    const existingVersions = games[gameKey]?.versions || {};

                    games[gameKey] = {
                        metadata: {
                            name: gameMetadata.name || gameClass.name,
                            thumbnail: gameMetadata.thumbnail,
                            thumbnailSource: gameMetadata.thumbnailSource,
                            author: gameMetadata.author || gameMetadata.createdBy || 'Unknown author',
                            description: gameMetadata.description,
                            gamePath,
                            isTest: gameMetadata.isTest || false
                        },
                        versions: {
                            ...existingVersions,
                            [versionId]: {
                                gameId: gameKey,
                                class: gameClass,
                                metadata: { ...gameMetadata },
                                gamePath,
                                versionId,
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
            } catch (error) { log.error(`Unable to load game ${gamePath}: ${error.message}`); }
        });

        if (localGameDir) {
            const resolvedLocalGameDir = path.resolve(localGameDir);

            if (!fs.existsSync(localGameDir)) {
                fs.mkdirSync(localGameDir);
            }

            const localGamePaths = getGamePaths(resolvedLocalGameDir);

            localGamePaths.forEach((gamePath) => {
                log.info('Using local game at path ' + gamePath);
                const gameClass = require('homegames-common/game-loader').loadGameClassFromPath(gamePath);
                const gameMetadata = effectiveGameMetadata(gameClass, gamePath);

                games[gameClass.name] = {
                    metadata: {
                        name: gameMetadata.name || gameClass.name,
                        thumbnail: gameMetadata.thumbnail,
                        description: gameMetadata.description,
                        thumbnailSource: gameMetadata.thumbnailSource,
                        author: gameMetadata.author || gameMetadata.createdBy || 'Unknown author',
                        gamePath,
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
            });
        }

        // Known published predecessors of the built-ins remain available for
        // review, but must not bypass curation under their old remote IDs.
        // This explicit map avoids treating unrelated games with similar names
        // or generic class names as duplicates. It never modifies cached files.
        const aliasesPath = path.join(sourceGameDir, 'legacy-game-aliases.json');
        if (fs.existsSync(aliasesPath)) {
            const aliases = JSON.parse(fs.readFileSync(aliasesPath, 'utf8'));
            for (const [legacyId, folder] of Object.entries(aliases)) {
                const canonicalPath = path.resolve(sourceGameDir, folder, 'index.js');
                const canonical = Object.entries(games).find(([id, game]) =>
                    id !== legacyId && game.metadata.gamePath === canonicalPath);
                if (!canonical || !games[legacyId]) continue;
                const old = games[legacyId].metadata;
                games[legacyId].metadata = { ...old, isTest: true,
                    name: `${old.name || legacyId} (legacy download)`, supersededBy: canonical[0],
                    description: `Earlier downloaded version. The maintained built-in is ${canonical[1].metadata.name}. ${old.description || ''}` };
            }
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
