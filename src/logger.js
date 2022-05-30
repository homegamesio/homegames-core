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
}

const logger = {
	error: (err) => console.error(`[HOMEGAMES-ERROR] ${msgToString(msg)}`)
}

if (LOG_LEVEL === 'INFO') {
	logger.info = (msg) => console.log(`[HOMEGAMES-INFO] ${msgToString(msg)}`);
} else {
	logger.info = () => {};
}

if (LOG_LEVEL === 'DEBUG') {
	logger.debug = (msg) => console.warn(`[HOMEGAMES-DEBUG] ${msgToString(msg)}`);
	logger.info = (msg) => console.log(`[HOMEGAMES-INFO] ${msgToString(msg)}`);
} else {
	logger.debug = () => {};
}

module.exports = logger;