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
const { X509Certificate, createPrivateKey, createHash, randomUUID } = require('crypto');

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
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) return resolve(data);
                // Keep server errors bounded; never display a whole proxy error page.
                let detail;
                try { detail = JSON.parse(data).error; } catch (_) { /* non-JSON proxy response */ }
                reject(new Error(typeof detail === 'string' ? detail.slice(0, 240) : `Certificate API returned HTTP ${res.statusCode}`));
            });
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
    createCsr = null, // ({ commonName }, existingKey) -> Promise<[keyPem, csr]>
    pollIntervalMs = 20 * 1000,
    pollTimeoutMs = 5 * 60 * 1000,
    renewWindowMs = 14 * 24 * 60 * 60 * 1000,
    renewCheckIntervalMs = 24 * 60 * 60 * 1000,
    networkCheckIntervalMs = 5 * 60 * 1000,
} = {}) => {
    const api = transport || createTransport(apiUrl);
    const generateCsr = createCsr || require('./certificate-csr').createCsr;

    const certFile = path.join(certPath, CERT_FILE);
    const keyFile = path.join(certPath, KEY_FILE);
    const pendingFile = path.join(certPath, 'pending-request.json');
    const preparedFile = path.join(certPath, 'next-network-certificate.json');
    const networkFile = domain => path.join(certPath, 'networks', createHash('sha256').update(domain).digest('hex') + '.json');
    let stopped = false;

    const listeners = [];
    let status = { state: 'idle', detail: null, certDomain: null, expiresAt: null, updatedAt: Date.now() };
    let renewalTimer = null;
    let renewalInFlight = false;
    let acquisitionInFlight = null; // promise — dedupes concurrent ensureCert calls
    let networkTimer = null;
    let networkCheckInFlight = null;

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
        fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
        const temporary = `${file}.${randomUUID()}.tmp`;
        try { fs.writeFileSync(temporary, data, { mode: 0o600 }); fs.renameSync(temporary, file); }
        finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    };
    const readPending = (file = pendingFile) => {
        if (!fs.existsSync(file)) return null;
        const pending = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!pending.key || !pending.csr || !pending.requestId || !pending.domain) throw new Error('Invalid pending certificate request');
        createPrivateKey(pending.key);
        return pending;
    };
    const readPrepared = () => {
        if (!fs.existsSync(preparedFile)) return null;
        const next = JSON.parse(fs.readFileSync(preparedFile, 'utf8'));
        return validPair(next.cert, fs.readFileSync(keyFile), next.domain) ? next : null;
    };
    const preparedStatus = next => setStatus('restart-required',
        'Certificate ready for this network. Restart when everyone is finished playing.',
        { certDomain: next.domain, networkChanged: true, restartRequired: true });
    // Called once by index.js before creating any TLS listeners. Preparing a
    // new hostname never replaces the certificate of an active game session.
    const activatePreparedCertificate = () => {
        try {
            const next = readPrepared();
            if (!next) return false;
            atomicWrite(certFile, next.cert);
            fs.unlinkSync(preparedFile);
            setStatus('valid', 'Certificate installed for this network', { certDomain: next.domain,
                expiresAt: certExpiry(), networkChanged: false, restartRequired: false });
            return true;
        } catch (error) {
            setStatus('error', 'Could not install the prepared certificate. The previous certificate was kept.');
            return false;
        }
    };
    const checkServiceStatus = current => {
        if (current.certificatesEnabled === false) throw new Error('Certificate service is temporarily unavailable. Local play still works.');
        if (current.needsReview || current.status === 'MIGRATION_REQUIRED') {
            const error = new Error('The certificate request needs review by the Homegames operator. Local play still works.');
            error.needsReview = true;
            throw error;
        }
        if (current.status === 'FAILED') throw new Error(current.error || 'Certificate issuance failed');
    };
    const install = (cert, pending) => {
        if (!validPair(cert, pending.key, pending.domain)) throw new Error('Certificate does not match this server key and domain');
        // Renewal reuses the existing TLS key, so replacing the certificate is
        // one atomic rename. Never change a working pair to an unrelated key.
        if (hasValidCert() && !new X509Certificate(fs.readFileSync(certFile)).checkPrivateKey(createPrivateKey(pending.key))) {
            throw new Error('Refusing to replace a working certificate with an unrelated key');
        }
        let previous;
        try {
            previous = new X509Certificate(fs.readFileSync(certFile));
            if (!previous.checkPrivateKey(createPrivateKey(fs.readFileSync(keyFile)))) previous = null;
        } catch (_) { previous = null; /* no usable installed pair */ }
        if (previous && previous.checkPrivateKey(createPrivateKey(pending.key))
            && pending.domain && !previous.checkHost(pending.domain, { wildcards: false })) {
            // The old hostname must keep working until the host restarts.
            // Retain completed/pending requests per network so moving back
            // never loses an ambiguous order or needlessly issues a new one.
            const next = { cert: cert.toString(), domain: pending.domain, requestId: pending.requestId };
            atomicWrite(networkFile(pending.domain), JSON.stringify({ ...pending, cert: next.cert }));
            atomicWrite(preparedFile, JSON.stringify(next));
            if (fs.existsSync(pendingFile)) fs.unlinkSync(pendingFile);
            preparedStatus(next);
            return;
        }
        if (!fs.existsSync(keyFile) || fs.readFileSync(keyFile, 'utf8') !== pending.key) atomicWrite(keyFile, pending.key);
        atomicWrite(certFile, cert);
        if (fs.existsSync(pendingFile)) fs.unlinkSync(pendingFile);
        setStatus('valid', 'Certificate issued', { expiresAt: certExpiry(), networkChanged: false, restartRequired: false });
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
            if (current) checkServiceStatus(current);
            if (pending.domain && current?.certDomain && current.certDomain !== pending.domain) {
                throw new Error('The network changed during the certificate request. The saved request is preserved; retry on this network.');
            }
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
    const requestCertFlow = async (current = null) => {
        try {
            let pending = readPending();
            if (current) {
                checkServiceStatus(current);
                if (pending && pending.domain !== current.certDomain) {
                    atomicWrite(networkFile(pending.domain), JSON.stringify(pending));
                    fs.unlinkSync(pendingFile);
                    pending = null;
                }
                if (!pending) {
                    const saved = readPending(networkFile(current.certDomain));
                    if (saved?.cert && validPair(saved.cert, saved.key, current.certDomain)) return install(saved.cert, saved);
                    // A completed expired certificate needs a new renewal;
                    // an unfinished order always keeps its original identity.
                    if (saved && !saved.cert) {
                        pending = saved;
                        atomicWrite(pendingFile, JSON.stringify(pending));
                    }
                }
            }
            if (!pending) {
                setStatus('requesting', 'Requesting certificate domain from the Homegames API');
                current = current || JSON.parse(await api.getCertStatus());
                checkServiceStatus(current);
                if (stopped) throw new Error('Certificate manager stopped');
                const { certDomain: commonName } = current;
                if (!commonName) throw new Error('API did not return a certificate domain');
                let existingKey = null;
                try { existingKey = fs.readFileSync(keyFile); createPrivateKey(existingKey); } catch (_) { existingKey = null; }
                const [key, csr] = await generateCsr({ commonName }, existingKey);
                if (stopped) throw new Error('Certificate manager stopped');
                pending = { key: key.toString(), csr: csr.toString(), domain: commonName, requestId: randomUUID() };
                // Persist before submission: a lost HTTP response can safely be
                // retried with the same request ID, CSR and locally-held key.
                atomicWrite(pendingFile, JSON.stringify(pending));
            }
            if (stopped) throw new Error('Certificate manager stopped');
            setStatus('requesting', 'Submitting certificate request', { certDomain: pending.domain });
            await api.requestCert(pending.csr, pending.requestId);
            setStatus('waiting', 'Request submitted — waiting for certificate');
            return await pollForCert(pending);
        } catch (err) { setStatus(err.needsReview ? 'review' : 'error', err.message); throw err; }
    };

    // Make sure a valid cert exists on disk, acquiring one if needed.
    // Never blocks the server: callers kick this off and read status.
    const ensureCert = () => {
        if (acquisitionInFlight) return acquisitionInFlight;
        if (networkCheckInFlight) return networkCheckInFlight;

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
            if (stopped) return Promise.resolve(false);
            if (!fs.existsSync(certFile)) return Promise.resolve(false);
            const expiry = certExpiry();
            // Recover a persisted request even if the certificate was installed
            // just before a crash but pending-request.json was not removed.
            if (expiry === null || (!fs.existsSync(pendingFile) && expiry - Date.now() > renewWindowMs)) return Promise.resolve(false);
            if (fs.existsSync(preparedFile)) {
                const next = readPrepared();
                if (next) { preparedStatus(next); return Promise.resolve(false); }
            }
            if (renewalInFlight || acquisitionInFlight || networkCheckInFlight) {
                log.info('[cert] renewal already in progress; skipping this check');
                return Promise.resolve(false);
            }
            renewalInFlight = true;
            setStatus('renewing', 'Certificate within renewal window — requesting a new one');
            return requestCertFlow().then(() => {
                if (!status.restartRequired) setStatus('renewed', 'Certificate renewed', { expiresAt: certExpiry() });
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

    const checkNetwork = () => {
        if (networkCheckInFlight) return networkCheckInFlight;
        if (stopped || renewalInFlight || acquisitionInFlight) return Promise.resolve(false);
        networkCheckInFlight = (async () => {
            let current;
            try { current = JSON.parse(await api.getCertStatus()); }
            catch (error) {
                // Losing internet does not invalidate an installed certificate
                // or turn ordinary offline play into a renewal failure.
                if (hasValidCert() && !status.networkChanged) {
                    if (status.state === 'idle') setStatus('valid', 'Valid certificate on disk; network check is unavailable', { expiresAt: certExpiry() });
                    return false;
                }
                throw error;
            }
            if (stopped) return false;
            if (typeof current.certDomain !== 'string' || !current.certDomain) throw new Error('API did not return a certificate domain');
            const key = fs.existsSync(keyFile) ? fs.readFileSync(keyFile) : null;
            const cert = fs.existsSync(certFile) ? fs.readFileSync(certFile) : null;
            if (cert && validPair(cert, key, current.certDomain)) {
                // A return to the original network cancels a pending switch,
                // while the other network's issued certificate stays cached.
                if (fs.existsSync(preparedFile)) fs.unlinkSync(preparedFile);
                const pending = readPending();
                if (pending && pending.domain !== current.certDomain) {
                    atomicWrite(networkFile(pending.domain), JSON.stringify(pending));
                    fs.unlinkSync(pendingFile);
                }
                if (status.networkChanged || status.state === 'idle') setStatus('valid', 'Certificate matches this network',
                    { certDomain: current.certDomain, networkChanged: false, restartRequired: false, expiresAt: certExpiry() });
                return false;
            }
            if (cert) setStatus('requesting', 'Network changed. Preparing a certificate for this network.',
                { certDomain: current.certDomain, networkChanged: true, restartRequired: false });
            const next = readPrepared();
            if (next?.domain === current.certDomain) { preparedStatus(next); return true; }
            await requestCertFlow(current);
            return true;
        })().catch(error => {
            if (!stopped) setStatus(error.needsReview ? 'review' : 'error', error.message);
            return false;
        }).finally(() => { networkCheckInFlight = null; });
        return networkCheckInFlight;
    };
    const scheduleNetworkChecks = () => {
        if (stopped || networkTimer) return;
        networkTimer = setInterval(() => { void checkNetwork(); }, networkCheckIntervalMs);
        networkTimer.unref?.();
        void checkNetwork();
    };

    const scheduleRenewal = () => {
        if (stopped || renewalTimer) return;
        renewalTimer = setInterval(maybeRenew, renewCheckIntervalMs);
        // Don't hold the process open just to renew certs
        if (renewalTimer.unref) renewalTimer.unref();
        // Do not make a newly restarted server wait a day to recover renewal.
        void maybeRenew();
    };

    const stop = () => {
        stopped = true;
        if (networkTimer) { clearInterval(networkTimer); networkTimer = null; }
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
        activatePreparedCertificate,
        ensureCert,
        maybeRenew,
        checkNetwork,
        scheduleNetworkChecks,
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
