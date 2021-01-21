const path = require('path');
const fs = require('fs');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require(`${baseDir}/src/util/config`);

const AUTH_DIR = getConfigValue('HG_AUTH_DIR', `${process.cwd()}/.hg_auth`);
const CERT_PATH = getConfigValue('HG_CERT_PATH', `${process.cwd()}/.hg_certs`);

fs.exists(AUTH_DIR, (exists) => {
    if (exists) {
        fs.rmdir(AUTH_DIR, {recursive: true}, (err) => {
            console.log('cleaned auth dir');
        });
    }
    fs.exists(CERT_PATH, (exists) => {
        if (exists) {
            fs.rmdir(CERT_PATH, {recursive: true}, (err) => {
                console.log('cleaned cert path');
            });
        }
    });
});
