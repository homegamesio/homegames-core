const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('/src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue, getUserHash, log } = require('homegames-common');

const HTTPS_ENABLED = getConfigValue('HTTPS_ENABLED', false);

const getLocalIP = () => {
    const ifaces = os.networkInterfaces();
    let localIP;

    Object.keys(ifaces).forEach((ifname) => {
        ifaces[ifname].forEach((iface) => {
            if ('IPv4' !== iface.family || iface.internal) {
                return;
            }
            localIP = localIP || iface.address;
        });
    });

    return localIP;
};

const getPublicIP = () => new Promise((resolve, reject) => {
    https.get(`https://api.homegames.io/ip`, (res) => {
        let buf = '';
        res.on('data', (chunk) => {
            buf += chunk.toString();
        });

        res.on('end', () => {
            resolve(buf.toString());
        });
    });
});

const makeGet = (path = '', headers = {}, username) => new Promise((resolve, reject) => {    
    const protocol = HTTPS_ENABLED ? 'https' : 'http';
    // todo: fix
    getPublicIP().then(publicIp => {
        const host = HTTPS_ENABLED ? (getUserHash(publicIp) + '.homegames.link') : 'localhost';
        const base = `${protocol}://${host}:${getConfigValue('HOMENAMES_PORT')}`;//'http://localhost:' + getConfigValue('HOMENAMES_PORT');
        (HTTPS_ENABLED ? https : http).get(`${base}${path}`, (res) => {
            let buf = '';
            res.on('data', (chunk) => {
                buf += chunk.toString();
            });

            res.on('end', () => {
                resolve(JSON.parse(buf));
            });
        });
    });
});

const makePost = (path, _payload, username) => new Promise((resolve, reject) => {
    const payload = JSON.stringify(_payload);

    let module, hostname, port;

    module = HTTPS_ENABLED ? https : http;
    port =  getConfigValue('HOMENAMES_PORT');
    console.log('dfjgndf! dsffgdg');

    getPublicIP().then(publicIp => {
        hostname = HTTPS_ENABLED ? (getUserHash(publicIp) + '.homegames.link') : 'localhost';

        const headers = {};

        Object.assign(headers, {
            'Content-Type': 'application/json',
            'Content-Length': payload.length
        });

        const options = {
            hostname,
            path,
            port,
            method: 'POST',
            headers
        };

        let responseData = '';
        
        const req = module.request(options, (res) => {
            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                resolve(responseData);
            });
        });

        req.write(payload);
        req.end();
    });
});

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
            });
        });
    }

    getClientInfo(playerId) {
        return new Promise((resolve, reject) => {
            makeGet(`/client_info/${playerId}`, null, this.username).then(resolve).catch(err => {
                log.error('homenames helper client info error', err);
            });
        });
    }

    updatePlayerInfo(playerId, { playerName }) {
        return new Promise((resolve, reject) => {
            makePost('/' + playerId + '/info', { name: playerName }, this.username).then(resolve);
        });
    }

    updatePlayerSetting(playerId, settingKey, value) {
        return new Promise((resolve, reject) => {
            makePost('/' + playerId + '/settings', {[settingKey]: value}, this.username).then(resolve);
        });
    }

    updateClientInfo(playerId, clientInfo) {
        return new Promise((resolve, reject) => {
            makePost('/' + playerId + '/client_info', clientInfo, this.username).then(resolve);
        });
    }
}

module.exports = HomenamesHelper;
