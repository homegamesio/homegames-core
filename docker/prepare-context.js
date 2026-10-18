'use strict';

// Build from the installed runtime, including a downloaded app with no sibling
// checkout or package lock inside published dependencies. Only runtime files
// enter this context; certificates, config, games and saves do not.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');

const OMIT = new Set(['node_modules', 'test', 'tests', 'docs', 'examples', 'coverage']);
function assertRunnerSupport(core) {
    const Manager = createRequire(path.join(core, 'package.json'))('homegames-common/game-session-manager');
    if (Manager.supportsPreparedImages !== true) {
        throw new Error('The installed homegames-common is outdated. Install the new Common release before building or running this Homegames version.');
    }
}

function packageDirectory(name, from) {
    for (const base of createRequire(path.join(from, 'package.json')).resolve.paths(`${name}/package.json`) || []) {
        const candidate = path.join(base, name);
        if (fs.existsSync(path.join(candidate, 'package.json'))) return fs.realpathSync(candidate);
    }
    throw new Error(`Missing installed runtime dependency: ${name}`);
}

function runtimeFiles(core) {
    core = fs.realpathSync(core);
    const files = new Map();
    function walk(root, relative, destination, packageName) {
        const parts = relative.split(path.sep), name = parts.at(-1);
        if (parts.some(part => part.startsWith('.') || OMIT.has(part)) || /\.(env|pem|key|p12|pfx)$/.test(name)) return;
        // These optional native accelerators have JavaScript fallbacks. Never
        // copy a Mac/Windows binary into the Linux runner.
        if (packageName === 'cpu-features' && parts[0] === 'build') return;
        if (packageName === 'ssh2' && relative.split(path.sep).join('/').startsWith('lib/protocol/crypto/build')) return;
        const source = path.join(root, relative);
        const real = fs.realpathSync(source);
        if (real !== root && !real.startsWith(root + path.sep)) throw new Error(`Runtime symlink leaves its package: ${relative}`);
        const info = fs.statSync(source);
        if (info.isDirectory()) {
            for (const child of fs.readdirSync(source).sort()) walk(root, path.join(relative, child), `${destination}/${child}`, packageName);
        } else if (info.isFile()) {
            if (/\.(node|dylib|dll|so)$/.test(name)) throw new Error(`Unsupported native runtime dependency: ${destination}`);
            files.set(destination, { source, mode: info.mode & 0o111 ? 0o755 : 0o644 });
        } else throw new Error(`Unsupported runtime file: ${destination}`);
    }
    for (const name of ['Dockerfile', 'container-entry.js', 'validate.js']) walk(path.join(core, 'docker'), name, name);
    for (const name of ['package.json', 'LICENSE.md', 'THIRD_PARTY_NOTICES.md']) {
        if (fs.existsSync(path.join(core, name))) walk(core, name, name);
    }
    for (const name of fs.readdirSync(path.join(core, 'src')).sort()) {
        if (name !== 'games') walk(core, path.join('src', name), `src/${name}`);
    }

    const installed = new Map();
    function dependencies(source, destination = '') {
        const pkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json')));
        const pending = [];
        for (const name of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies }).sort()) {
            let dep;
            try { dep = packageDirectory(name, source); }
            catch (error) { if (pkg.optionalDependencies?.[name]) continue; throw error; }
            // Use the same real installed versions, preserving nested conflicts.
            let current = destination, found;
            while (true) {
                const candidate = [current, 'node_modules', name].filter(Boolean).join('/');
                if (installed.has(candidate)) { found = installed.get(candidate); break; }
                if (!current) break;
                const at = current.lastIndexOf('/node_modules/');
                current = at < 0 ? '' : current.slice(0, at);
            }
            if (found === dep) continue;
            const hoisted = `node_modules/${name}`;
            const target = !found && !installed.has(hoisted) ? hoisted : [destination, 'node_modules', name].filter(Boolean).join('/');
            if (installed.get(target) === dep) continue;
            if (installed.has(target)) throw new Error(`Conflicting runtime dependency: ${name}`);
            installed.set(target, dep);
            pending.push([dep, target]);
        }
        for (const [dep, target] of pending) {
            const name = JSON.parse(fs.readFileSync(path.join(dep, 'package.json'))).name;
            for (const child of fs.readdirSync(dep).sort()) walk(dep, child, `${target}/${child}`, name);
            dependencies(dep, target);
        }
    }
    dependencies(core);
    return [...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
}

function prepareContext(core, cacheRoot) {
    const files = runtimeFiles(core);
    const hash = crypto.createHash('sha256');
    fs.mkdirSync(cacheRoot, { recursive: true, mode: 0o700 });
    const temporary = fs.mkdtempSync(path.join(cacheRoot, 'preparing-'));
    try {
        for (const [relative, { source, mode }] of files) {
            const data = fs.readFileSync(source);
            hash.update(JSON.stringify([relative, mode, data.length]) + '\n').update(data);
            const dest = path.join(temporary, relative);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, data, { mode });
        }
        const digest = hash.digest('hex');
        const directory = path.join(cacheRoot, digest);
        // Existing contexts are retained for running/older apps. No shared
        // image tag is overwritten on upgrade.
        if (!fs.existsSync(directory)) fs.renameSync(temporary, directory);
        return { directory, imageName: `homegames-runner:${digest}` };
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}

if (require.main === module) {
    assertRunnerSupport(path.resolve(__dirname, '..'));
    const { getAppDataPath } = require('homegames-common');
    const prepared = prepareContext(path.resolve(__dirname, '..'), path.join(getAppDataPath(), 'docker-runtime'));
    const { ensureImage } = require('homegames-common/docker-helper');
    console.log(`Preparing ${prepared.imageName}`);
    ensureImage(prepared.directory, prepared.imageName).then(() => console.log(`Ready: ${prepared.imageName}`))
        .catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { prepareContext, runtimeFiles, assertRunnerSupport };
