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

const HG_ASSET_PATH = getConfigValue('HG_ASSET_PATH', `${process.cwd()}/.asset_cache`);

if (!fs.existsSync(HG_ASSET_PATH)) {
    fs.mkdirSync(HG_ASSET_PATH);
}

const getHash = (str) => {
    const shasum = crypto.createHash('sha1');
    shasum.update(str);
    return shasum.digest('hex');
}

const downloadFile = (uri, path) => new Promise((resolve, reject) => {
    const fileHash = getHash(uri);
    const filePath = `${path}/${fileHash}`;

    const writeStream = fs.createWriteStream(filePath);
    const getModule = uri.startsWith('https') ? https : http;

    let data = '';
    getModule.get(uri, (res) => {
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
        const fileHash = getHash(this.info.location);
        return `${HG_ASSET_PATH}/${fileHash}`;
    }

    existsLocally() {
        return new Promise((resolve, reject) => {
            const fileLocation = this.getFileLocation(this.info.location);
            fs.exists(fileLocation, (exists) => {
                resolve(exists && fileLocation);
            });
        });
    }

    download(force) {
//        console.log('you want me to download ' + uri + ' to ' + HG_ASSET_PATH);

        return new Promise((resolve, reject) => {
            this.existsLocally(this.info.location).then(fileLocation => {
                if (fileLocation && !force) {
                    this.initialized = true;
                    resolve(fileLocation);
                } else {
                    downloadFile(this.info.location, HG_ASSET_PATH).then((fileLocation) => {
                        this.initialized = true;
                        resolve(fileLocation);
                    });
                }
            });
        });
//            console.log('downloading');
//            if (this.data && !force) {
//                console.log("NICE JOB B");
//                resolve(this.data)
//            }
//            try {
//                const shasum = crypto.createHash('sha1');
//                shasum.update(uri);
//                const fileHash = shasum.digest('hex');
//                const filePath = `${HG_ASSET_PATH}/${fileHash}`;
//                if (fs.existsSync(filePath)) {
//                    console.log('says you have it');
//                    this.data = fs.readFileSync(filePath);
//                    resolve(this.data);
//                } else {
//                    const writeStream = fs.createWriteStream(filePath);
//                    const getModule = uri.startsWith('https') ? https : http;
//                    getModule.get(uri, (res) => {
//                        res.on('data', (chunk) => {
//                            writeStream.write(chunk);
//                        });
//                        res.on('end', () => {
//                            writeStream.end();
//                            this.data = fs.readFileSync(filePath);
//                            resolve(this.data);
//                        });
//                    }).on('error', error => {
//                        reject(error);
//                    });
//                }    
//            } catch(err) {
//                reject(err);
//            }
//        });
    }

    getData() {
        return new Promise((resolve, reject) => {
            if (this.sourceType === 'url') {
                this.download().then(fileLocation => {
                    fs.readFile(fileLocation, (err, buf) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(buf);//fs.readFile(fileLocation));
                        }
                    });
                });
            }
        }); 
    }
}

module.exports = Asset;
