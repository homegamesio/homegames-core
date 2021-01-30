const server = require('./game_server');

const path = require('path');
let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require(`${baseDir}/src/util/config`);

const linkHelper = require('./src/util/link-helper');
const process = require('process');

const { guaranteeCerts, guaranteeDir, authWorkflow } = require('homegames-common');

const LINK_ENABLED = getConfigValue('LINK_ENABLED', true);
const AUTH_DIR = getConfigValue('HG_AUTH_DIR', `${process.cwd()}/.hg_auth`);
const LINK_DNS_ENABLED = getConfigValue('LINK_DNS_ENABLED', false);
const HTTPS_ENABLED = getConfigValue('HTTPS_ENABLED', false);
const CERT_PATH = getConfigValue('HG_CERT_PATH', `${process.cwd()}/.hg_certs`);

const actions = [];

const linkInit = () => new Promise((resolve, reject) => {
    linkHelper.linkConnect().then((wsClient) => {
        resolve();
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
    if (!_out || !_out.certPath) {
        console.log('regular server');
        server();
        resolve();
    } else {
        console.log('secure server');
        server(_out);
        resolve();
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
            });
        }
    }

    _doWork(resolve)
});

doWork();
