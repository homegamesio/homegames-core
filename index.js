const server = require('./game_server');
const fs = require('fs');
const assert = require('assert');
const { reportBug } = require('./src/common/util');

const process = require('process');

// Catch-all error handlers — log and report but don't crash
process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught exception:', err);
    try { reportBug(`Uncaught exception: ${err.message}\n${err.stack}`); } catch (e) {}
});

process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] Unhandled promise rejection:', reason);
    try { reportBug(`Unhandled rejection: ${reason}`); } catch (e) {}
});

const path = require('path');
let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const linkHelper = require('./src/util/link-helper');

const { guaranteeDir, getConfigValue, getAppDataPath } = require('homegames-common');

const log = process.env.LOGGER_LOCATION ? require(process.env.LOGGER_LOCATION) : { info: (msg) => console.log(msg), error: (msg) => console.error(msg)};

const LINK_ENABLED = getConfigValue('LINK_ENABLED', true);
const HTTPS_ENABLED = getConfigValue('HTTPS_ENABLED', false);

// ---------------------------------------------------------------------------
// Bundled assets — offline support for read-only bundles (CD/USB builds).
// The bundle ships the configured game's asset files (named by asset id) in a
// directory; we seed the shared asset cache from it at boot so every squish
// version's Asset.getData() finds them as cache hits and never needs the
// network. The cache uses sha1(assetId) filenames (squish Asset.getFileLocation).
// ---------------------------------------------------------------------------
const seedAssetCache = (bundledDir) => {
    const crypto = require('crypto');
    const cacheDir = path.join(getAppDataPath(), 'asset-cache');
    let entries;
    try {
        entries = fs.readdirSync(bundledDir);
    } catch (e) {
        console.error('BUNDLED_ASSET_PATH set but unreadable: ' + bundledDir);
        return;
    }
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    let seeded = 0;
    entries.forEach((assetId) => {
        if (assetId === 'manifest.json') return;
        const src = path.join(bundledDir, assetId);
        try {
            if (!fs.statSync(src).isFile()) return;
            const hash = crypto.createHash('sha1').update(assetId).digest('hex');
            const dest = path.join(cacheDir, hash);
            if (!fs.existsSync(dest)) {
                fs.copyFileSync(src, dest);
                seeded++;
            }
        } catch (e) {
            console.error('Failed to seed bundled asset ' + assetId);
            console.error(e);
        }
    });
    if (seeded > 0) {
        console.log(`Seeded ${seeded} bundled asset(s) into the asset cache`);
    }
};

const bundledAssetPath = getConfigValue('BUNDLED_ASSET_PATH', null);
if (bundledAssetPath) {
    seedAssetCache(path.isAbsolute(bundledAssetPath) ? bundledAssetPath : path.resolve(baseDir, bundledAssetPath));
}

const linkInit = (username) => new Promise((resolve, reject) => {
    linkHelper.linkConnect(null, username).then((wsClient) => {
        log.info('Initialized connection to homegames.link');
        resolve(wsClient);
    }).catch(err => {
        log.error('Failed to initialize link', err);
        reject();
    });
});

const certPathArgs = process.argv.filter(a => a.startsWith('--cert-path=')).map(a => a.replace('--cert-path=', ''));

const usernameArgs = process.argv.filter(a => a.startsWith('--username=')).map(a => a.replace('--username=', ''));

let certPathArg = certPathArgs && certPathArgs.length > 0 ? certPathArgs[0] : null;
let usernameArg = usernameArgs && usernameArgs.length > 0 ? usernameArgs[0] : null;

if (!usernameArg && fs.existsSync(`${baseDir}/.hg_auth/username`)) {
    usernameArg = fs.readFileSync(`${baseDir}/.hg_auth/username`).toString();
}

// ---------------------------------------------------------------------------
// Certificates — owned by core now (moved out of the launcher). The server
// starts immediately; acquisition/renewal runs in the background.
//
// Cert dir resolution: explicit --cert-path, then the legacy baseDir/hg-certs,
// then the launcher's historical default <appData>/hg-certs (so existing
// installs keep their cert).
// ---------------------------------------------------------------------------
const { createCertManager, setDefaultInstance, DEFAULT_CERT_PATH } = require('./src/util/cert-manager');

const certDir = certPathArg
    || (HTTPS_ENABLED && fs.existsSync(`${baseDir}/hg-certs`) ? `${baseDir}/hg-certs` : null)
    || DEFAULT_CERT_PATH;

const certManager = createCertManager({ certPath: certDir });
setDefaultInstance(certManager);

// Serve HTTPS only when the user opted in (HTTPS_ENABLED) AND a valid cert
// is on disk RIGHT NOW — a cert acquired while running takes effect on the
// next restart (the restart contract), and a leftover cert with HTTPS
// disabled stays unused.
certPathArg = (HTTPS_ENABLED && certManager.hasValidCert()) ? certDir : null;

if (certPathArg) {
    process.env.HTTPS_ENABLED = true;
    certManager.scheduleRenewal();
}

if (HTTPS_ENABLED && !certPathArg) {
    // Opted into HTTPS but no usable cert yet: acquire in the background
    // while the server runs over HTTP. Status is visible via the cert
    // manager (dashboard config section).
    certManager.ensureCert().then(() => {
        log.info('Certificate ready — HTTPS will be served on the next restart');
    }).catch(err => {
        log.error('Certificate acquisition failed');
        log.error(err);
    });
}

if (LINK_ENABLED) {
    linkInit(usernameArg).then((wsClient) => {
        log.info('starting server with link enabled');
        server(certPathArg, null, usernameArg);
        // The HTTPS server is now up (cert was provisioned before this process
        // started). Mark this instance ready so homegames.link redirects to the
        // secure subdomain rather than serving the "setting up" page.
        if (HTTPS_ENABLED && certPathArg) {
            linkHelper.setHttpsReady(wsClient, true).catch(err => {
                log.error('Failed to mark HTTPS ready with link');
                log.error(err);
            });
        }
    }).catch(() => {
        log.info('encountered error with link connection. starting server with link disabled');
        try {
            server(certPathArg, null, usernameArg);
        } catch (serverErr) {
            log.error('Server error: ' + serverErr);
            reportBug(`Error starting server: ${serverErr}`);
        }
    });
} else {
    log.info('starting server with link disabled');
    try { 
        server(certPathArg, null, usernameArg);
    } catch (serverErr) {
        log.error('Server error: ' + serverErr);
        reportBug(`Error starting server: ${serverErr}`);
    }
}
