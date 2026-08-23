// Certificate lifecycle for this server — moved here from the homegames
// launcher so core owns it end to end and it NEVER blocks startup.
//
// The flow (unchanged from the launcher, hardened):
//   1. GET /cert-status — the API identifies this network by public IP and
//      answers with the certDomain this network may claim
//      (md5(publicIP).homegames.link) and, eventually, the issued cert.
//   2. Generate a keypair + CSR locally (the private key NEVER leaves this
//      machine; only the CSR is submitted).
//   3. POST /request-cert with the CSR. The key is written to disk (0600)
//      only after a successful submission, so "key on disk but no cert"
//      reliably means "CSR submitted — keep polling".
//   4. Poll /cert-status until the cert is issued (the API's worker completes
//      an ACME dns-01 order asynchronously — this takes minutes).
//
// Acquisition runs in the background: the server starts on HTTP immediately
// and the dashboard shows progress via getStatus()/onUpdate(). A cert
// acquired while running takes effect on the next restart (the restart
// contract); a cert RENEWED while already serving HTTPS is hot-swapped into
// the live server via the 'renewed' update (see socket.js).

const fs = require('fs');
const https = require('https');
const path = require('path');
const { X509Certificate } = require('crypto');

const { getConfigValue, getAppDataPath } = require('homegames-common');

const log = process.env.LOGGER_LOCATION ? require(process.env.LOGGER_LOCATION) : { info: console.log, error: console.error };

const DEFAULT_CERT_PATH = path.join(getAppDataPath(), 'hg-certs');

const CERT_FILE = 'homegames.cert';
const KEY_FILE = 'homegames.key';

// ---------------------------------------------------------------------------
// API transport (injectable for tests)
// ---------------------------------------------------------------------------

const createTransport = (apiUrl) => {
    const apiHost = new URL(apiUrl).host.split(':')[0];

    // Both requests carry error + timeout handlers: without them a network
    // failure emits 'error' with no listener (process crash), and a
    // black-hole connection hangs forever.
    return {
        // The API identifies this network by its public IP — no body needed.
        getCertStatus: () => new Promise((resolve, reject) => {
            const req = https.request({ hostname: apiHost, port: 443, path: '/cert-status', method: 'GET' }, (res) => {
                let responseData = '';
                res.on('data', (chunk) => { responseData += chunk; });
                res.on('end', () => resolve(responseData));
            });
            req.on('error', reject);
            req.setTimeout(15 * 1000, () => req.destroy(new Error('cert-status request timed out')));
            req.end();
        }),

        requestCert: (csr) => new Promise((resolve, reject) => {
            const payload = JSON.stringify({ csr });
            const req = https.request({
                hostname: apiHost,
                port: 443,
                path: '/request-cert',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                },
            }, (res) => {
                let responseData = '';
                res.on('data', (chunk) => { responseData += chunk; });
                res.on('end', () => {
                    if (res.statusCode > 199 && res.statusCode < 300) {
                        resolve(responseData);
                    } else {
                        reject(new Error(`request-cert failed (${res.statusCode}): ${responseData}`));
                    }
                });
            });
            req.on('error', reject);
            req.setTimeout(15 * 1000, () => req.destroy(new Error('request-cert timed out')));
            req.write(payload);
            req.end();
        }),
    };
};

// ---------------------------------------------------------------------------
// Cert manager
// ---------------------------------------------------------------------------

const createCertManager = ({
    certPath = DEFAULT_CERT_PATH,
    apiUrl = getConfigValue('API_URL', 'https://api.homegames.io:443'),
    transport = null,
    createCsr = null, // ({ commonName }) -> Promise<[keyPem, csr]>; default acme-client
    pollIntervalMs = 20 * 1000,
    pollTimeoutMs = 5 * 60 * 1000,
    renewWindowMs = 14 * 24 * 60 * 60 * 1000,
    renewCheckIntervalMs = 24 * 60 * 60 * 1000,
} = {}) => {
    const api = transport || createTransport(apiUrl);
    const generateCsr = createCsr || ((opts) => require('acme-client').crypto.createCsr(opts));

    const certFile = path.join(certPath, CERT_FILE);
    const keyFile = path.join(certPath, KEY_FILE);

    const listeners = [];
    let status = { state: 'idle', detail: null, certDomain: null, expiresAt: null, updatedAt: Date.now() };
    let renewalTimer = null;
    let renewalInFlight = false;
    let acquisitionInFlight = null; // promise — dedupes concurrent ensureCert calls

    const setStatus = (state, detail = null, extra = {}) => {
        status = { ...status, state, detail, updatedAt: Date.now(), ...extra };
        log.info(`[cert] ${state}${detail ? ': ' + detail : ''}`);
        listeners.forEach(cb => {
            try { cb(status); } catch (e) { /* listener errors are not ours */ }
        });
    };

    const certExpiry = () => {
        try {
            const { validTo } = new X509Certificate(fs.readFileSync(certFile));
            return new Date(validTo).getTime();
        } catch (e) {
            return null;
        }
    };

    const hasValidCert = () => {
        if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) return false;
        const expiry = certExpiry();
        return expiry !== null && expiry > Date.now();
    };

    // { key, cert } PEM strings, or null when not (validly) present.
    const readCertificate = () => {
        if (!hasValidCert()) return null;
        return {
            key: fs.readFileSync(keyFile).toString(),
            cert: fs.readFileSync(certFile).toString(),
        };
    };

    // Poll until the API's async ACME order completes and the cert arrives.
    const pollForCert = () => new Promise((resolve, reject) => {
        const timeoutTime = Date.now() + pollTimeoutMs;
        const checker = setInterval(() => {
            if (Date.now() >= timeoutTime) {
                clearInterval(checker);
                setStatus('error', 'Timed out waiting for certificate. Try again later or contact support@homegames.io');
                reject(new Error('Timed out waiting for certificate'));
                return;
            }
            api.getCertStatus().then((raw) => {
                let currentStatus;
                try {
                    currentStatus = JSON.parse(raw);
                } catch (e) {
                    return; // malformed response — next tick retries
                }
                if (currentStatus && currentStatus.cert) {
                    clearInterval(checker);
                    fs.writeFileSync(certFile, Buffer.from(currentStatus.cert, 'base64'));
                    setStatus('valid', 'Certificate issued', { expiresAt: certExpiry() });
                    resolve();
                } else {
                    setStatus('waiting', 'Certificate not ready yet — waiting');
                }
            }).catch(err => {
                // A failed poll (network blip) is non-fatal: the next tick retries
                // until the overall timeout.
                log.error('[cert] status poll failed; will retry');
                log.error(err);
            });
        }, pollIntervalMs);
    });

    // Full acquisition: learn our domain, generate key+CSR locally, submit,
    // then poll. The key is written only AFTER a successful submission.
    const requestCertFlow = () => {
        setStatus('requesting', 'Requesting certificate domain from the Homegames API');
        return api.getCertStatus().then((raw) => {
            let commonName;
            try {
                commonName = JSON.parse(raw).certDomain;
            } catch (e) {
                throw new Error('Could not parse cert status from API');
            }
            if (!commonName) {
                throw new Error('API did not return a cert domain for this network');
            }

            setStatus('requesting', `Generating key for ${commonName}`, { certDomain: commonName });
            return generateCsr({ commonName }).then(([key, csr]) => {
                setStatus('requesting', 'Submitting certificate request');
                return api.requestCert(csr.toString()).then(() => {
                    if (!fs.existsSync(certPath)) {
                        fs.mkdirSync(certPath, { recursive: true });
                    }
                    // Private key -> 0600 so other local users can't read it.
                    fs.writeFileSync(keyFile, key, { mode: 0o600 });
                    setStatus('waiting', 'Request submitted — waiting for certificate');
                    return pollForCert();
                });
            });
        }).catch(err => {
            setStatus('error', `${err && err.message || err}`);
            throw err;
        });
    };

    // Make sure a valid cert exists on disk, acquiring one if needed.
    // Never blocks the server: callers kick this off and read status.
    const ensureCert = () => {
        if (acquisitionInFlight) return acquisitionInFlight;

        let flow;
        if (hasValidCert()) {
            setStatus('valid', 'Valid certificate on disk', { expiresAt: certExpiry() });
            flow = Promise.resolve();
        } else if (fs.existsSync(keyFile)) {
            // Key but no (valid) cert: the key is only written after a CSR was
            // successfully submitted, so an issued cert may already be waiting.
            setStatus('waiting', 'Certificate request in flight — checking status');
            flow = pollForCert().catch((err) => {
                // The pending request may have expired server-side — start over.
                log.info('[cert] pending request never completed; starting a fresh request');
                return requestCertFlow();
            });
        } else {
            flow = requestCertFlow();
        }

        acquisitionInFlight = flow.finally(() => {
            acquisitionInFlight = null;
        });
        return acquisitionInFlight;
    };

    // Renewal — daily check; re-acquire when inside the renewal window.
    // Guarded so a slow/failing renewal never stacks concurrent ACME orders
    // (straight into Let's Encrypt's rate limits).
    const maybeRenew = () => {
        try {
            if (!fs.existsSync(certFile)) return Promise.resolve(false);
            const expiry = certExpiry();
            if (expiry === null || expiry - Date.now() > renewWindowMs) return Promise.resolve(false);
            if (renewalInFlight) {
                log.info('[cert] renewal already in progress; skipping this check');
                return Promise.resolve(false);
            }
            renewalInFlight = true;
            setStatus('renewing', 'Certificate within renewal window — requesting a new one');
            return requestCertFlow().then(() => {
                setStatus('renewed', 'Certificate renewed', { expiresAt: certExpiry() });
                return true;
            }).catch(err => {
                log.error('[cert] renewal failed');
                log.error(err);
                return false;
            }).finally(() => {
                renewalInFlight = false;
            });
        } catch (err) {
            log.error('[cert] error during renewal check');
            log.error(err);
            return Promise.resolve(false);
        }
    };

    const scheduleRenewal = () => {
        if (renewalTimer) return;
        renewalTimer = setInterval(maybeRenew, renewCheckIntervalMs);
        // Don't hold the process open just to renew certs
        if (renewalTimer.unref) renewalTimer.unref();
    };

    const stop = () => {
        if (renewalTimer) {
            clearInterval(renewalTimer);
            renewalTimer = null;
        }
    };

    return {
        certPath,
        getStatus: () => ({ ...status }),
        onUpdate: (cb) => listeners.push(cb),
        hasValidCert,
        readCertificate,
        ensureCert,
        maybeRenew,
        scheduleRenewal,
        stop,
    };
};

// Process-wide instance, set by index.js at boot so the dashboard (config
// section) and socket.js (renewal hot-swap) can reach the same manager.
let defaultInstance = null;
const setDefaultInstance = (mgr) => { defaultInstance = mgr; };
const getDefaultInstance = () => defaultInstance;

module.exports = { createCertManager, setDefaultInstance, getDefaultInstance, DEFAULT_CERT_PATH };
