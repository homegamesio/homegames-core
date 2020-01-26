const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../../config');

if (!fs.existsSync(config.ASSET_PATH)) {
    fs.mkdirSync(config.ASSET_PATH);
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
                const filePath = config.ASSET_PATH + '/' + fileHash;
                if (fs.existsSync(filePath)) {
                    resolve(fs.readFileSync(filePath));
                } else {
                    const writeStream = fs.createWriteStream(filePath);
                    https.get(uri, (res) => {
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

    getData() {
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
