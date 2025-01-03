const server = require('./game_server');
const fs = require('fs');
const assert = require('assert');
const { reportBug } = require('./src/common/util');

const process = require('process');

const path = require('path');
let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const linkHelper = require('./src/util/link-helper');

const { guaranteeCerts, guaranteeDir, authWorkflow, getConfigValue } = require('homegames-common');

const log = process.env.LOGGER_LOCATION ? require(process.env.LOGGER_LOCATION) : { info: (msg) => console.log(msg), error: (msg) => console.error(msg)};

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

if (!usernameArg && fs.existsSync(`${baseDir}/.hg_auth/username`)) {
    usernameArg = fs.readFileSync(`${baseDir}/.hg_auth/username`).toString();
}

if (HTTPS_ENABLED && fs.existsSync(`${baseDir}/hg-certs`)) {
    certPathArg = `${baseDir}/hg-certs`;
}

if (certPathArg) {
    process.env.HTTPS_ENABLED = true;
}

if (LINK_ENABLED) {
    linkInit(usernameArg).then(() => {
        log.info('starting server with link enabled');
        server(certPathArg, null, usernameArg);
    }).catch(() => {
        log.info('encountered error with link connection. starting server with link disabled');
        try {
            server(certPathArg, null, usernameArg);
        } catch (serverErr) {
            log.error('Server error: ' + serverErr);
            reportBug(`Error starting server: ${serverErr}`);
        }
    });
} else {
    log.info('starting server with link disabled');
    try { 
        server(certPathArg, null, usernameArg);
    } catch (serverErr) {
        log.error('Server error: ' + serverErr);
        reportBug(`Error starting server: ${serverErr}`);
    }
}
