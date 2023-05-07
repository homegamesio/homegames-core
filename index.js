const server = require('./game_server');
const fs = require('fs');
const assert = require('assert');

const process = require('process');

const path = require('path');
let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const linkHelper = require('./src/util/link-helper');

const { guaranteeCerts, guaranteeDir, log, authWorkflow, getConfigValue } = require('homegames-common');

const LINK_ENABLED = getConfigValue('LINK_ENABLED', true);
const HTTPS_ENABLED = getConfigValue('HTTPS_ENABLED', false);

const linkInit = (username) => new Promise((resolve, reject) => {
    linkHelper.linkConnect(null, username).then((wsClient) => {
        log.info('Initialized connection to homegames.link');
        resolve();
    }).catch(err => {
        log.error('Failed to initialize link', err);
        reject();
    });
});

const certPathArgs = process.argv.filter(a => a.startsWith('--cert-path=')).map(a => a.replace('--cert-path=', ''));

const usernameArgs = process.argv.filter(a => a.startsWith('--username=')).map(a => a.replace('--username=', ''));

let certPathArg = certPathArgs && certPathArgs.length > 0 ? certPathArgs[0] : null;
let usernameArg = usernameArgs && usernameArgs.length > 0 ? usernameArgs[0] : null;

if (fs.existsSync(`${baseDir}/.hg_auth/username`)) {
    usernameArg = fs.readFileSync(`${baseDir}/.hg_auth/username`);
}

if (fs.existsSync(`${baseDir}/hg-certs`)) {
    certPathArg = `${baseDir}/hg-certs`;
}

console.log("USERNAME ARG " + usernameArg);
if (LINK_ENABLED) {
    console.log('wtffff1');
    linkInit(usernameArg).then(() => {
        console.log('wtffff2');
        log.info('starting server with link enabled');
        server(certPathArg);
    }).catch(() => {
        log.info('encountered error with link connection. starting server with link disabled');
        server(certPathArg);
    });
} else {
    log.info('starting server with link disabled');
    server(certPathArg);
}
