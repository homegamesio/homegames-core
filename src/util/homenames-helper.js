const path = require('path');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('/src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require(`${baseDir}/src/util/config`);
const http = require('http');

const makeGet = (path = '', headers = {}) => new Promise((resolve, reject) => {
    const host = 'http://localhost:' + getConfigValue('HOMENAMES_PORT');
    http.get(`${host}${path}`, (res) => {
        let buf = '';
        res.on('data', (chunk) => {
            buf += chunk.toString();
        });

        res.on('end', () => {
            resolve(JSON.parse(buf));
        });
    });
});

const makePost = (path, _payload) => new Promise((resolve, reject) => {
    const payload = JSON.stringify(_payload);

    let module, hostname, port;

    // TODO: when we fully support HTTPS, use appropriate module + port
    module = http;
    port =  getConfigValue('HOMENAMES_PORT');
    hostname = 'localhost';

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

class HomenamesHelper {
    constructor(sessionPort) {
        this.sessionPort = sessionPort;
        this.playerListeners = {};
    }

    getPlayerInfo(playerId) {
        return new Promise((resolve, reject) => {
            makeGet(`/info/${playerId}`).then(resolve).catch(err => {
                console.log('watttt');
                console.log(err);
            });
        });
        console.log('what abc');
    }

    addListener(playerId) {//=> new Promise((resolve, reject) => {
        return new Promise((resolve, reject) => {
            makePost('/add_listener', { playerId, sessionPort: this.sessionPort }).then(resolve).catch(reject);
        });
        // if (!this.playerListeners[playerId]) {
        //     this.playerListeners[playerId] = new Set();
        // }

        // this.playerListeners[playerId].add(cb);
    }

    getPlayerSettings(playerId) {
        return new Promise((resolve, reject) => {
            makeGet(`/settings/${playerId}`).then(resolve).catch(err => {
                console.log('watttt');
                console.log(err);
            });
        });
        console.log('what def');   
    }

    updatePlayerInfo(playerId, { playerName }) {

        console.log('what ghi');
        return new Promise((resolve, reject) => {
            makePost('/' + playerId + '/info', { name: playerName }).then(resolve);
        });
    }

    updatePlayerSetting(playerId, settingKey, value) {

        console.log('what jkl');
        return new Promise((resolve, reject) => {
            makePost('/' + playerId + '/settings', {[settingKey]: value}).then(resolve);
        });
    }
}

module.exports = HomenamesHelper;