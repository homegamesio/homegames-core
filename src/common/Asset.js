const https = require('https');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const process = require('process');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('/src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require(`${baseDir}/src/util/config`);

const HG_ASSET_PATH = getConfigValue('HG_ASSET_PATH', `${process.cwd()}/.asset_cache`);

if (!fs.existsSync(HG_ASSET_PATH)) {
    fs.mkdirSync(HG_ASSET_PATH);
}

const getHash = (str) => {
    // console.log('creating hash from str ' + str);
    const shasum = crypto.createHash('sha1');
    // console.log(str);
    // console.log(shasum);
    shasum.update(str);
    return shasum.digest('hex');
}

const downloadFile = (assetId, path) => new Promise((resolve, reject) => {
    const fileHash = getHash(assetId);
    const filePath = `${path}/${fileHash}`;

    const writeStream = fs.createWriteStream(filePath);
    const getModule = https;

    let data = '';
    getModule.get(`https://assets.homegames.io/${assetId}`, (res) => {
        res.on('data', (chunk) => {
            data += chunk;
            writeStream.write(chunk);
        });
        res.on('end', () => {
            writeStream.end();
            resolve(filePath);
        });
    }).on('error', error => {
        reject(error);
    });

});

class Asset {
    constructor(sourceType, info) {
        this.sourceType = sourceType;
        this.info = info;
    }

    getFileLocation() {
        const fileHash = getHash(this.info.id);
        return `${HG_ASSET_PATH}/${fileHash}`;
    }

    existsLocally() {
        return new Promise((resolve, reject) => {
            const fileLocation = this.getFileLocation(this.info.id);
            fs.exists(fileLocation, (exists) => {
                resolve(exists && fileLocation);
            });
        });
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
        console.log('getting data');
        console.log(this);
        return new Promise((resolve, reject) => {
            if (this.sourceType === 'url') {
                this.download().then(fileLocation => {
                    console.log('just saved a file to ' + fileLocation);
                    fs.readFile(fileLocation, (err, buf) => {
                        if (err) {
                            reject(err);
                        } else {
                            console.log('this is buf');
                            console.log(buf);
                            resolve(buf);//fs.readFile(fileLocation));
                        }
                    });
                });
            }
        }); 
    }
}

module.exports = Asset;
