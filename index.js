// check config for what we should do
// link ?
// https ?
// init server with config


const linkHelper = require('./src/util/link-helper');
const path = require('path');
const { getConfigValue } = require(`${path.resolve()}/src/util/config`);

const linkEnabled = getConfigValue('LINK_ENABLED', false);
const httpsEnabled = getConfigValue('HTTPS_ENABLED', false);
const dnsAliasEnabled = getConfigValue('DNS_ALIAS_ENABLED', false);

const dnsWorkflow = () => {
    const authDir = getConfigValue('AUTH_DIR');
    let requestId;

    authWorkflow(authDir).then(() => {
        console.log('ayylmao');
    });
    // const message = JSON.parse(_message);
    // if (requestId && msg.msgId === requestId) {
    //     if (msg.success) {
    //         console.log('Verified DNS record');
    //         resolve(msg.url);
    //     } else {
    //         console.log("failed to verify");
    //         reject();
    //     }
    // }
};

//     

//     linkHelper.linkConnect(dnsMessageHandler).then((wsClient) => {
//         guaranteeDir(AUTH_DIR).then(() => {
//             authWorkflow(`${AUTH_DIR}/tokens.json`).then(authInfo => {
//                 const clientInfo = linkHelper.getClientInfo();
//                 linkHelper.verifyDNS(wsClient, authInfo.username, authInfo.tokens.accessToken, clientInfo.localIp).then(_requestId => {
//                     requestId = _requestId;
//                 });
//             });
//         });
//     });

// });
if (linkEnabled) {
    linkHelper.linkConnect(dnsAliasEnabled ? dnsWorkflow : null).then((wsClient) => {
        console.log('got link websocket client');
    }).catch(err => {
        console.error(`Failed to initialize link. ${err}`);
    });
}

if (httpsEnabled) {
    guaranteeDir(AUTH_DIR).then(() => {
        guaranteeCerts(`${AUTH_DIR}/tokens.json`, CERT_PATH).then(certPaths => {
            resolve(certPaths);
        });
    });
}

// const server = require('./src/server/game_server');
// const assert = require('assert');

// const process = require('process');

// let __squishMap;
// if (process.argv.length > 2) {
//     try {
//         const squishMap = JSON.parse(process.argv[2]);
//         assert(squishMap['squish-061']);
//         __squishMap = squishMap;
//     } catch (err) {
//         console.log('could not parse squish map');
//         console.log(err);
//     }
// }

// const path = require('path');

// const { getConfigValue } = require(`${path.resolve()}/src/util/config`);

// const linkHelper = require('./src/util/link-helper');

// const { guaranteeCerts, guaranteeDir, authWorkflow } = require('homegames-common');

// const LINK_ENABLED = getConfigValue('LINK_ENABLED', true);
// const AUTH_DIR = getConfigValue('HG_AUTH_DIR', `${process.cwd()}/.hg_auth`);
// const LINK_DNS_ENABLED = getConfigValue('LINK_DNS_ENABLED', false);
// const HTTPS_ENABLED = getConfigValue('HTTPS_ENABLED', false);
// const CERT_PATH = getConfigValue('HG_CERT_PATH', `${process.cwd()}/.hg_certs`);

// const actions = [];

// const linkInit = () => new Promise((resolve, reject) => {
//     linkHelper.linkConnect().then((wsClient) => {
//         resolve();
//     }).catch(err => {
//         console.log("Failed to initialize link.");
//         console.log(err);
//         reject();
//     });
// });

// const httpsInit = () => new Promise((resolve, reject) => {
//     guaranteeDir(AUTH_DIR).then(() => {
//         guaranteeCerts(`${AUTH_DIR}/tokens.json`, CERT_PATH).then(certPaths => {
//             resolve(certPaths);
//         });
//     });
// });

// const linkDNSInit = () => new Promise((resolve, reject) => {
//     let requestId;
//     const dnsMessageHandler = (_msg) => {
//         console.log(_msg);
//         const msg = JSON.parse(_msg);
//         if (requestId && msg.msgId === requestId) {
//             if (msg.success) {
//                 console.log('Verified DNS record');
//                 resolve(msg.url);
//             } else {
//                 console.log("failed to verify");
//                 reject();
//             }
//         }
//     };

//     linkHelper.linkConnect(dnsMessageHandler).then((wsClient) => {
//         guaranteeDir(AUTH_DIR).then(() => {
//             authWorkflow(`${AUTH_DIR}/tokens.json`).then(authInfo => {
//                 const clientInfo = linkHelper.getClientInfo();
//                 linkHelper.verifyDNS(wsClient, authInfo.username, authInfo.tokens.accessToken, clientInfo.localIp).then(_requestId => {
//                     requestId = _requestId;
//                 });
//             });
//         });
//     });

// });

// if (LINK_DNS_ENABLED) {
//     actions.push(linkDNSInit);
//     if (HTTPS_ENABLED) {
//         actions.push(httpsInit);
//     }
// } else if (LINK_ENABLED) {
//     actions.push(linkInit);
// } else if (HTTPS_ENABLED) {
//     actions.push(() => new Promise((resolve, reject) => {
//         console.log("One day: custom certs");
//         resolve();
//     }));
// } else {
//     console.log('you want nothing');
// }

// actions.push((_out) => new Promise((resolve, reject) => {
//     if (!HTTPS_ENABLED || !_out || !_out.certPath) {
//         console.log('regular server');
//         server(null, __squishMap);
//         resolve();
//     } else if (CERT_PATH) {
//         console.log('secure server');
//         server(CERT_PATH, __squishMap);
//         resolve();
//     } else {
//         console.log('idk');
//     }
// }));

// // trash workflow
// const doWork = () => new Promise((resolve, reject) => {
//     let i = 0;
//     let _result;
//     const _doWork = (cb) => {
//         if (!actions[i]) {
//             cb();
//         } else {
//             actions[i](_result).then((result) => {
//                 i++;
//                 _result = result;
//                 _doWork(cb);
//             }).catch(err => {
//                 console.log("Failed to perform action");
//                 console.log(err);
//                 i++;
//                 _result = null;
//                 _doWork(cb);
//             });
//         }
//     }

//     _doWork(resolve)
// });

// doWork();
