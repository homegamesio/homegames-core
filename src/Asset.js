const request = require('request').defaults({ encoding: null });
const Stream = require('stream').Transform;
const fs = require('fs');
const crypto = require('crypto');

const CACHE_DIR = './.asset_cache/';

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR);
}

class Asset {
    constructor(sourceType, info) {
        this.sourceType = sourceType;
        this.info = info;
   }

    download(uri) {
        return new Promise((resolve, reject) => {
            const shasum = crypto.createHash('sha1');
            shasum.update(uri);
            const fileHash = shasum.digest('hex');
            const filePath = CACHE_DIR + fileHash;
            if (false && fs.existsSync(filePath)) {
                resolve(fs.readFileSync(filePath));
            } else {
                request.get(uri, (err, response, body) => {

                    const data = Buffer.from(body);
                    fs.writeFileSync(filePath, data);
                    resolve(data);
                });
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
                return payload;
            });
        }
    }
}

module.exports = Asset;
