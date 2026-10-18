const http = require('http');
const https = require('https');
const { getConfigValue, log } = require('homegames-common');
const HTTPS_ENABLED = getConfigValue('HTTPS_ENABLED', false);
const HOMENAMES_PORT = getConfigValue('HOMENAMES_PORT', 7100);

// Player names/settings belong to this home server. A public-IP lookup is
// unnecessary and would delay every player connection without internet.
const request = (method, pathname, value) => new Promise((resolve, reject) => {
    const payload = value === undefined ? null : JSON.stringify(value);
    const req = (HTTPS_ENABLED ? https : http).request({
        hostname: process.env.DOCKER_HOST_HOSTNAME || 'localhost',
        port: HOMENAMES_PORT, path: pathname, method,
        // Certificates name the homegames.link address. These requests stay
        // on loopback or the configured Docker bridge.
        rejectUnauthorized: false,
        headers: payload === null ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('error', reject);
        res.on('end', () => {
            if (res.statusCode < 200 || res.statusCode >= 300) { reject(new Error(`Local player service returned ${res.statusCode}`)); return; }
            try { resolve(method === 'GET' ? JSON.parse(body) : body); } catch (error) { reject(error); }
        });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('Local player service timed out')));
    req.end(payload);
});
const makeGet = pathname => request('GET', pathname);
const makePost = (pathname, payload) => request('POST', pathname, payload);

class HomenamesHelper {
    constructor(sessionPort, username) {
        this.sessionPort = sessionPort;
        this.username = username;
        this.playerListeners = {};
    }

    getPlayerInfo(playerId) {
        return new Promise((resolve, reject) => {
            makeGet(`/info/${playerId}`, null, this.username).then(resolve).catch(err => {
                log.error('homenames helper info error', err);
                reject(err);
            });
        });
    }

    addListener(playerId) {//=> new Promise((resolve, reject) => {
        return new Promise((resolve, reject) => {
            makePost('/add_listener', { playerId, sessionPort: this.sessionPort }, this.username).then(resolve).catch(reject);
        });
    }

    getPlayerSettings(playerId) {
        return new Promise((resolve, reject) => {
            makeGet(`/settings/${playerId}`, null, this.username).then(resolve).catch(err => {
                log.error('homenames helper settings error', err);
                reject(err);
            });
        });
    }

    getClientInfo(playerId) {
        return new Promise((resolve, reject) => {
            makeGet(`/client_info/${playerId}`, null, this.username).then(resolve).catch(err => {
                log.error('homenames helper client info error', err);
                reject(err);
            });
        });
    }

    updatePlayerInfo(playerId, { playerName }) {
        return new Promise((resolve, reject) => {
            makePost('/' + playerId + '/info', { name: playerName }, this.username).then(resolve).catch(reject);
        });
    }

    updatePlayerSetting(playerId, settingKey, value) {
        return new Promise((resolve, reject) => {
            makePost('/' + playerId + '/settings', {[settingKey]: value}, this.username).then(resolve).catch(reject);
        });
    }

    updateClientInfo(playerId, clientInfo) {
        return new Promise((resolve, reject) => {
            makePost('/' + playerId + '/client_info', clientInfo, this.username).then(resolve).catch(reject);
        });
    }
}

module.exports = HomenamesHelper;
