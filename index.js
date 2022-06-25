const server = require('./game_server');
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


const linkInit = () => new Promise((resolve, reject) => {
    linkHelper.linkConnect().then((wsClient) => {
        log.info('Initialized connection to homegames.link');
        resolve();
    }).catch(err => {
        log.error('Failed to initialize link', err);
        reject();
    });
});


if (LINK_ENABLED) {
    linkInit().then(() => {
        log.info('starting server with link enabled');
        server();
    }).catch(() => {
        log.info('encountered error with link connection. starting server with link disabled');
        server();
    });
} else {
    log.info('starting server with link disabled');
    server();
}