const https = require('https');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const process = require('process');

let baseDir = process.cwd();

if (!fs.existsSync(`${process.cwd()}/src/util/config.js`)) {
    baseDir = path.dirname(require.main.filename);
}

if (baseDir.endsWith('/src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require('homegames-common');

const HG_ASSET_PATH = getConfigValue('HG_ASSET_PATH', `${process.cwd()}/.asset_cache`);

if (!fs.existsSync(HG_ASSET_PATH)) {
    fs.mkdirSync(HG_ASSET_PATH);
}

const getHash = (str) => {
    const shasum = crypto.createHash('sha1');
    shasum.update(str);
    return shasum.digest('hex');
};

const downloadFile = (assetId, path) => new Promise((resolve, reject) => {
    const fileHash = getHash(assetId);
    const filePath = `${path}/${fileHash}`;

    const writeStream = fs.createWriteStream(filePath);
    const getModule = https;

    writeStream.on('close', () => {
        resolve(filePath);
    });

    let data = '';
    getModule.get(`https://assets.homegames.io/${assetId}`, (res) => {
        res.on('data', (chunk) => {
            data += chunk;
            writeStream.write(chunk);
        });
        res.on('end', () => {
            writeStream.end();
        });
    }).on('error', error => {
        reject(error);
    });

});

class Asset {
    constructor(info) {
        this.info = info;
    }

    getFileLocation() {
        const fileHash = getHash(this.info.id);
        return `${HG_ASSET_PATH}/${fileHash}`;
    }

    existsLocallySync() {
        const fileLocation = this.getFileLocation(this.info.id);
        return fs.existsSync(fileLocation);
    }
    
    existsLocally() {
        return new Promise((resolve, reject) => {
            const fileLocation = this.getFileLocation(this.info.id);
            fs.exists(fileLocation, (exists) => {
                resolve(exists && fileLocation);
            });
        });
    }

    async downloadSync(force) {
        const fileLocationExists = this.existsLocallySync();
        const fileLocation = this.getFileLocation(this.info.id);

        if (fileLocationExists && !force) {
            this.initialized = true;
            return fileLocation;
        } else {
            const fileLocation2 = await downloadFileSync(this.info.id, HG_ASSET_PATH);
            this.initialized = true;
            return fileLocation;
        }
    }
    
    download(force) {
        return new Promise((resolve, reject) => {
            this.existsLocally().then(fileLocation => {
                if (fileLocation && !force) {
                    this.initialized = true;
                    resolve(fileLocation);
                } else {
                    downloadFile(this.info.id, HG_ASSET_PATH).then((fileLocation) => {
                        this.initialized = true;
                        resolve(fileLocation);
                    });
                }
            });
        });
    }

    getData() {
        return new Promise((resolve, reject) => {
            this.download().then(fileLocation => {
                fs.readFile(fileLocation, (err, buf) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(buf);
                    }
                });
            });
        }); 
    }
    
}

module.exports = Asset;
