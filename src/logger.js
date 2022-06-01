const path = require('path');
const fs = require('fs');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require(`${baseDir}/src/util/config`);

const LOG_LEVEL = getConfigValue('LOG_LEVEL', 'INFO');

// always log errors
// if INFO, log only info
// if DEBUG, log all

const msgToString = (msg) => {
    return typeof msg === 'object' ? JSON.stringify(msg) : msg;
};

const logger = {
    error: (err, explanation) => console.error(`[HOMEGAMES-ERROR] ${msgToString(err)}${explanation ? ':\n' + msgToString(explanation) : ''}`)
};

if (LOG_LEVEL === 'INFO') {
    logger.info = (msg, explanation) => console.log(`[HOMEGAMES-INFO] ${msgToString(msg)}${explanation ? ':\n' + msgToString(explanation) : ''}`);
} else {
    logger.info = () => {};
}

if (LOG_LEVEL === 'DEBUG') {
    logger.debug = (msg, explanation) => console.warn(`[HOMEGAMES-DEBUG] ${msgToString(msg)}${explanation ? ':\n' + msgToString(explanation) : ''}`);
    logger.info = (msg, explanation) => console.log(`[HOMEGAMES-INFO] ${msgToString(msg)}${explanation ? ':\n' + msgToString(explanation) : ''}`);
} else {
    logger.debug = () => {};
}

module.exports = logger;