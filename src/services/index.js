const https = require('https');

const services = {};

const supportedServices = {
    'contentGenerator': {
        requestContent: (request) => new Promise((resolve, reject) => {
            const makePost = (path, _payload) => new Promise((resolve, reject) => {
                const payload = JSON.stringify(_payload);

                let module, hostname, port;
            
                module = https;
                port = 443;
                hostname = 'api.homegames.io';
            
                const headers = {};
            
                Object.assign(headers, {
                    'Content-Type': 'application/json',
                    'Content-Length': payload.length
                });
            
                const options = {
                    hostname,
                    path,
                    port,
                    method: 'POST',
                    headers
                };
            
                let responseData = '';
                
                const req = module.request(options, (res) => {
                    res.on('data', (chunk) => {
                        responseData += chunk;
                    });
            
                    res.on('end', () => {
                        resolve(responseData);
                    });
                });
            
                req.write(payload);
                req.end();
            });

            makePost('https://api.homegames.io/services', request).then((response) => {
                if (!response.startsWith('{')) {
                    reject(response);
                } else {
                    const requestId = JSON.parse(response).requestId;
                    const interval = setInterval(() => {
                        https.get(`https://api.homegames.io/service_requests/${requestId}`, {}, (res) => {
                            let bufs = [];
                            res.on('data', (chunk) => {
                                bufs.push(chunk);
                            });

                            res.on('end', () => {
                                const fin = JSON.parse(Buffer.concat(bufs));
                                const parsed = fin;//JSON.parse(fin);
                                if (parsed.response) {
                                    clearInterval(interval);
                                    resolve(parsed.response);
                                }
                            });
                        });
                    }, 5000);
                }
            }).catch(err => {
                reject(err);
            });
        })
    }
};

const getService = (name) => {
    return supportedServices[name] || null;
};

module.exports = {
    getService
};
