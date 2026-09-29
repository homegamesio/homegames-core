// Certificate lifecycle for this server — moved here from the homegames
// launcher so core owns it end to end and it NEVER blocks startup.
//
// The flow (unchanged from the launcher, hardened):
//   1. GET /cert-status — the API identifies this network by public IP and
//      answers with the certDomain this network may claim
//      (md5(publicIP).homegames.link) and, eventually, the issued cert.
//   2. Generate a keypair + CSR locally (the private key NEVER leaves this
//      machine; only the CSR is submitted).
//   3. Persist a private pending request (0600) and submit its CSR + ID.
//      Existing working key/certificate files remain intact until validation.
//   4. Poll /cert-status?requestId=... until the cert is issued (the API's worker completes
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
const { X509Certificate, createPrivateKey, randomUUID } = require('crypto');

const { getConfigValue, getAppDataPath } = require('homegames-common');

const log = process.env.LOGGER_LOCATION ? require(process.env.LOGGER_LOCATION) : { info: console.log, error: console.error };

const DEFAULT_CERT_PATH = path.join(getAppDataPath(), 'hg-certs');

const CERT_FILE = 'homegames.cert';
const KEY_FILE = 'homegames.key';

// ---------------------------------------------------------------------------
// API transport (injectable for tests)
// ---------------------------------------------------------------------------

const createTransport = (apiUrl) => {
    const request = (endpoint, body) => new Promise((resolve, reject) => {
        const url = new URL(endpoint, apiUrl);
        const payload = body ? JSON.stringify(body) : null;
        const transport = url.protocol === 'https:' ? https : require('http');
        const req = transport.request(url, { method: payload ? 'POST' : 'GET', headers: payload ? {
            'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload),
        } : {} }, res => {
            let data = '';
            res.on('data', chunk => {
                data += chunk;
                if (data.length > 256000) req.destroy(new Error('Certificate response too large'));
            });
            res.on('error', reject);
            res.on('end', () => res.statusCode >= 200 && res.statusCode < 300
                ? resolve(data) : reject(new Error(`Certificate API returned HTTP ${res.statusCode}`)));
        });
        const timer = setTimeout(() => req.destroy(new Error('Certificate API timed out')), 15000);
        req.on('close', () => clearTimeout(timer)); req.on('error', reject); req.end(payload);
    });
    return {
        getCertStatus: requestId => request('/cert-status' + (requestId ? `?requestId=${encodeURIComponent(requestId)}` : '')),
        requestCert: (csr, requestId) => request('/request-cert', { csr, requestId }),
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
    const generateCsr = createCsr || ((opts, key) => require('acme-client').crypto.createCsr(opts, key));

    const certFile = path.join(certPath, CERT_FILE);
    const keyFile = path.join(certPath, KEY_FILE);
    const pendingFile = path.join(certPath, 'pending-request.json');
    let stopped = false;

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

    const validPair = (cert, key, domain) => {
        try {
            const parsed = new X509Certificate(cert);
            return Date.parse(parsed.validTo) > Date.now() && Date.parse(parsed.validFrom) <= Date.now()
                && parsed.checkPrivateKey(createPrivateKey(key))
                && (!domain || !!parsed.checkHost(domain, { wildcards: false }));
        } catch (_) { return false; }
    };
    const hasValidCert = () => {
        try { return validPair(fs.readFileSync(certFile), fs.readFileSync(keyFile)); }
        catch (_) { return false; }
    };
    const readCertificate = () => {
        if (!hasValidCert()) return null;
        return { key: fs.readFileSync(keyFile, 'utf8'), cert: fs.readFileSync(certFile, 'utf8') };
    };
    const atomicWrite = (file, data) => {
        fs.mkdirSync(certPath, { recursive: true });
        const temporary = `${file}.${randomUUID()}.tmp`;
        try { fs.writeFileSync(temporary, data, { mode: 0o600 }); fs.renameSync(temporary, file); }
        finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    };
    const readPending = () => {
        if (!fs.existsSync(pendingFile)) return null;
        const pending = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
        if (!pending.key || !pending.csr || !pending.requestId || !pending.domain) throw new Error('Invalid pending certificate request');
        createPrivateKey(pending.key);
        return pending;
    };
    const install = (cert, pending) => {
        if (!validPair(cert, pending.key, pending.domain)) throw new Error('Certificate does not match this server key and domain');
        // Renewal reuses the existing TLS key, so replacing the certificate is
        // one atomic rename. Never change a working pair to an unrelated key.
        if (hasValidCert() && !new X509Certificate(fs.readFileSync(certFile)).checkPrivateKey(createPrivateKey(pending.key))) {
            throw new Error('Refusing to replace a working certificate with an unrelated key');
        }
        if (!fs.existsSync(keyFile) || fs.readFileSync(keyFile, 'utf8') !== pending.key) atomicWrite(keyFile, pending.key);
        atomicWrite(certFile, cert);
        if (fs.existsSync(pendingFile)) fs.unlinkSync(pendingFile);
        setStatus('valid', 'Certificate issued', { expiresAt: certExpiry() });
    };
    const pollForCert = async pending => {
        const until = Date.now() + pollTimeoutMs;
        while (!stopped && Date.now() < until) {
            let current;
            let timer;
            try {
                const raw = await Promise.race([api.getCertStatus(pending.requestId), new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new Error('Certificate poll timed out')), Math.max(1, until - Date.now()));
                })]);
                current = JSON.parse(raw);
            } catch (_) { /* A bounded network failure can retry within this poll budget. */ }
            finally { clearTimeout(timer); }
            if (stopped) throw new Error('Certificate manager stopped');
            if (current?.status === 'FAILED') throw new Error(current.error || 'Certificate issuance failed');
            if (current?.cert) {
                const cert = Buffer.from(current.cert, 'base64');
                const domain = pending.domain || current.certDomain;
                // A legacy API may return the previous issuance. Keep waiting
                // until its cert matches our pending key instead of installing it.
                if (validPair(cert, pending.key, domain)) { install(cert, { ...pending, domain }); return; }
            }
            if (Date.now() < until) await new Promise(resolve => setTimeout(resolve, Math.min(pollIntervalMs, until - Date.now())));
        }
        throw new Error(stopped ? 'Certificate manager stopped' : 'Timed out waiting for certificate');
    };
    const requestCertFlow = async () => {
        try {
            let pending = readPending();
            if (!pending) {
                setStatus('requesting', 'Requesting certificate domain from the Homegames API');
                const { certDomain: commonName } = JSON.parse(await api.getCertStatus());
                if (!commonName) throw new Error('API did not return a certificate domain');
                let existingKey = null;
                try { existingKey = fs.readFileSync(keyFile); createPrivateKey(existingKey); } catch (_) { existingKey = null; }
                const [key, csr] = await generateCsr({ commonName }, existingKey);
                pending = { key: key.toString(), csr: csr.toString(), domain: commonName, requestId: randomUUID() };
                // Persist before submission: a lost HTTP response can safely be
                // retried with the same request ID, CSR and locally-held key.
                atomicWrite(pendingFile, JSON.stringify(pending));
            }
            setStatus('requesting', 'Submitting certificate request', { certDomain: pending.domain });
            await api.requestCert(pending.csr, pending.requestId);
            setStatus('waiting', 'Request submitted — waiting for certificate');
            return await pollForCert(pending);
        } catch (err) { setStatus('error', err.message); throw err; }
    };

    // Make sure a valid cert exists on disk, acquiring one if needed.
    // Never blocks the server: callers kick this off and read status.
    const ensureCert = () => {
        if (acquisitionInFlight) return acquisitionInFlight;

        let flow;
        if (hasValidCert()) {
            setStatus('valid', 'Valid certificate on disk', { expiresAt: certExpiry() });
            flow = Promise.resolve();
        } else if (fs.existsSync(pendingFile)) {
            flow = requestCertFlow();
        } else if (fs.existsSync(keyFile)) {
            // Key but no (valid) cert: the key is only written after a CSR was
            // successfully submitted, so an issued cert may already be waiting.
            setStatus('waiting', 'Certificate request in flight — checking status');
            flow = pollForCert({ key: fs.readFileSync(keyFile, 'utf8') }).catch((err) => {
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
            if (renewalInFlight || acquisitionInFlight) {
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
        stopped = true;
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
