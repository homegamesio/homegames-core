const https = require('https');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const process = require('process');

let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require(`${baseDir}/src/util/config`);

const HG_ASSET_PATH = getConfigValue('HG_ASSET_PATH', `${baseDir}/.asset_cache`);

if (!fs.existsSync(HG_ASSET_PATH)) {
    fs.mkdirSync(HG_ASSET_PATH);
}

class Asset {
    constructor(sourceType, info, data) {
        this.sourceType = sourceType;
        this.info = info;
        this.data = data;
    }

    download(uri) {
        return new Promise((resolve, reject) => {
            try {
                const shasum = crypto.createHash('sha1');
                shasum.update(uri);
                const fileHash = shasum.digest('hex');
                const filePath = `${HG_ASSET_PATH}/${fileHash}`;
                if (fs.existsSync(filePath)) {
                    resolve(fs.readFileSync(filePath));
                } else {
                    const writeStream = fs.createWriteStream(filePath);
                    const getModule = uri.startsWith('https') ? https : http;
                    getModule.get(uri, (res) => {
                        res.on('data', (chunk) => {
                            writeStream.write(chunk);
                        });
                        res.on('end', () => {
                            writeStream.end();
                            resolve(fs.readFileSync(filePath));
                        });
                    }).on('error', error => {
                        reject(error);
                    });
                }    
            } catch(err) {
                reject(err);
            }
        });
    }

    async getData() {
        if (this.data) {
            return this.data;
        }

        if (this.sourceType === 'url') {
            return this.download(this.info.location).then(payload => {
                this.data = payload;
                this.done = true;
                return payload;
            });
        } 
    }
}

module.exports = Asset;
