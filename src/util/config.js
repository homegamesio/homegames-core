const path = require('path');
const process = require('process');

const baseDir = path.dirname(require.main.filename);

const getConfigValue = (key, _default = undefined) => {
    let envValue = process.env[key] && `${process.env[key]}`;
    console.log(process.env);
    console.log("helllllo " + key);
    console.log(envValue);
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
        const _config = require(`${baseDir}/config`);
        console.log(`Using config at ${baseDir}/config`);
        if (!_config[key]) {
            throw new Error(`No value for ${key} found in ${baseDir}/config`);
        }
        return _config[key];
    } catch(err) {
        if (_default === undefined) {
            throw new Error(`No config value found for ${key}`);
        } else {
            console.log(`Could not find config at ${baseDir}/config for key ${key}. Using default: ${_default}`);
            return _default;
        }
    }
};

module.exports = { getConfigValue };
