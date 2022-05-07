const path = require('path');
const baseDir = path.dirname(require.main.filename);
const { getConfigValue } = require(`${baseDir}/src/util/config`);
const http = require('http');

const makeGet = (path = '', headers = {}) => new Promise((resolve, reject) => {
    const host = 'http://localhost:' + getConfigValue('HOMENAMES_PORT');
    console.log('jhkdsf');
    console.log(path)
    http.get(`${host}${path}`, (res) => {
        let buf = '';
        res.on('data', (chunk) => {
            console.log('chunk');
            console.log(chunk);
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
	constructor() {
	}

	getPlayerInfo(playerId) {
		return new Promise((resolve, reject) => {
			makeGet(`/info/${playerId}`).then(resolve).catch(err => {
                console.log('watttt');
                console.log(err);
            });
		});
	}

    getPlayerSettings(playerId) {
        return new Promise((resolve, reject) => {
            makeGet(`/settings/${playerId}`).then(resolve).catch(err => {
                console.log('watttt');
                console.log(err);
            });
        });   
    }

	updatePlayerInfo(playerId, { playerName }) {
		return new Promise((resolve, reject) => {
			makePost('/' + playerId + '/info', { name: playerName }).then(resolve);
		});
	}

    updatePlayerSetting(playerId, settingKey, value) {
        return new Promise((resolve, reject) => {
            makePost('/' + playerId + '/settings', {[settingKey]: value}).then(resolve);
        });
    }
}

module.exports = HomenamesHelper;