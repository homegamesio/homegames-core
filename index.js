const server = require('./game_server');
const assert = require('assert');
//const squish061 = require('squish-061');
//const squish063 = require('squish-063');
//const squish0631 = require('squish-0631');
//const squish0632 = require('squish-0632');
//const squish0633 = require('squish-0633');
//const squish0642 = require('squish-0642');

const process = require('process');


let __squishMap;
if (process.argv.length > 2) {
    try {
        const squishMap = JSON.parse(process.argv[2]);
        assert(squishMap['squish-061']);
        __squishMap = squishMap;
    } catch (err) {
        console.log('could not parse squish map');
        console.log(err);
    }
}

const path = require('path');
let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require(`${baseDir}/src/util/config`);

const linkHelper = require('./src/util/link-helper');

const { guaranteeCerts, guaranteeDir, authWorkflow } = require('homegames-common');

const LINK_ENABLED = getConfigValue('LINK_ENABLED', true);
const AUTH_DIR = getConfigValue('HG_AUTH_DIR', `${process.cwd()}/.hg_auth`);
const LINK_DNS_ENABLED = getConfigValue('LINK_DNS_ENABLED', false);
const HTTPS_ENABLED = getConfigValue('HTTPS_ENABLED', false);
const CERT_PATH = getConfigValue('HG_CERT_PATH', `${process.cwd()}/.hg_certs`);

const actions = [];

const linkInit = () => new Promise((resolve, reject) => {
    linkHelper.linkConnect().then((wsClient) => {
        console.log('linked idk');
        resolve();
    }).catch(err => {
        console.log("Failed to initialize link.");
        console.log(err);
        reject();
    });
});

const httpsInit = () => new Promise((resolve, reject) => {
    guaranteeDir(AUTH_DIR).then(() => {
        guaranteeCerts(`${AUTH_DIR}/tokens.json`, CERT_PATH).then(certPaths => {
            resolve(certPaths);
        });
    });
});

const linkDNSInit = () => new Promise((resolve, reject) => {
    let requestId;
    const dnsMessageHandler = (_msg) => {
        console.log(_msg);
        const msg = JSON.parse(_msg);
        if (requestId && msg.msgId === requestId) {
            if (msg.success) {
                console.log('Verified DNS record');
                resolve(msg.url);
            } else {
                console.log("failed to verify");
                reject();
            }
        }
    };

    linkHelper.linkConnect(dnsMessageHandler).then((wsClient) => {
        guaranteeDir(AUTH_DIR).then(() => {
            authWorkflow(`${AUTH_DIR}/tokens.json`).then(authInfo => {
                const clientInfo = linkHelper.getClientInfo();
                linkHelper.verifyDNS(wsClient, authInfo.username, authInfo.tokens.accessToken, clientInfo.localIp).then(_requestId => {
                    requestId = _requestId;
                });
            });
        });
    });

});

if (LINK_DNS_ENABLED) {
    actions.push(linkDNSInit);
    if (HTTPS_ENABLED) {
        actions.push(httpsInit);
    }
} else if (LINK_ENABLED) {
    actions.push(linkInit);
} else if (HTTPS_ENABLED) {
    actions.push(() => new Promise((resolve, reject) => {
        console.log("One day: custom certs");
        resolve();
    }));
} else {
    console.log('you want nothing');
}

actions.push((_out) => new Promise((resolve, reject) => {
    if (!HTTPS_ENABLED || !_out || !_out.certPath) {
        console.log('regular server');
        server(null, __squishMap);
        resolve();
    } else if (CERT_PATH) {
        console.log('secure server');
        server(CERT_PATH, __squishMap);
        resolve();
    } else {
        console.log('idk');
    }
}));

// trash workflow
const doWork = () => new Promise((resolve, reject) => {
    let i = 0;
    let _result;
    const _doWork = (cb) => {
        if (!actions[i]) {
            cb();
        } else {
            actions[i](_result).then((result) => {
                i++;
                _result = result;
                _doWork(cb);
            }).catch(err => {
                console.log("Failed to perform action");
                console.log(err);
                i++;
                _result = null;
                _doWork(cb);
            });
        }
    }

    _doWork(resolve)
});

doWork();
