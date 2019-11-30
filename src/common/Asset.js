const https = require("https");
const fs = require("fs");
const crypto = require("crypto");

const CACHE_DIR = "./.asset_cache/";

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
            try {
                const shasum = crypto.createHash("sha1");
                shasum.update(uri);
                const fileHash = shasum.digest("hex");
                const filePath = CACHE_DIR + fileHash;
                if (fs.existsSync(filePath)) {
                    resolve(fs.readFileSync(filePath));
                } else {
                    const writeStream = fs.createWriteStream(filePath);
                    https.get(uri, (res) => {
                        res.on("data", (chunk) => {
                            writeStream.write(chunk);
                        });
                        res.on("end", () => {
                            writeStream.end();
                            resolve(fs.readFileSync(filePath));
                        });
                    }).on("error", error => {
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

        if (this.sourceType === "url") {
            return this.download(this.info.location).then(payload => {
                this.data = payload;
                return payload;
            });
        }
    }
}

module.exports = Asset;
