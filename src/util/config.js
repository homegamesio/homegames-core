const path = require('path');
const process = require('process');

const getConfigValue = (key, _default = undefined) => {
    let envValue = process.env[key] && `${process.env[key]}`;
    if (envValue !== undefined) {
        if (envValue === 'true') {
            envValue = true;
        } else if (envValue === 'false') {
            envValue = false;
        }
        console.log(`Using environment value: ${envValue} for key: ${key}`);
        return envValue;
    }
    try {
        const _config = require(`${process.cwd()}/config`);
        console.log(`Using config at ${process.cwd()}/config for ${key}`);
        if (_config[key] === undefined) {
            throw new Error(`No value for ${key} found in ${process.cwd()}/config`);
        }
        console.log(`Found value ${_config[key]} in config`);
        return _config[key];
    } catch(err) {
        if (_default === undefined) {
            throw new Error(`No config value found for ${key}`);
        } else {
            console.log(`Could not find config at ${process.cwd()}/config for key ${key}. Using default: ${_default}`);
            return _default;
        }
    }
};

module.exports = { getConfigValue };
