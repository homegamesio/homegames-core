const http = require('http');
const https = require('https');

const { getConfigValue } = require('homegames-common');

const services = {};

const API_URL = getConfigValue('API_URL', 'https://api.homegames.io:443');

const parsedUrl = new URL(API_URL);
const isSecure = parsedUrl.protocol == 'https:';

const supportedServices = {
    'contentGenerator': {
        requestContent: (request) => new Promise((resolve, reject) => {
            const makePost = (path, _payload) => new Promise((resolve, reject) => {
                const payload = JSON.stringify(_payload);

                const module = isSecure ? https : http;
                const port = parsedUrl.port || isSecure ? 443 : 80;
                const hostname = parsedUrl.hostname;
            
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

            makePost(`${API_URL}/services`, { type: 'content-generation', ...request }).then((response) => {
                if (!response.startsWith('{')) {
                    reject(response);
                } else {
                    const requestId = JSON.parse(response).requestId;
                    const interval = setInterval(() => {
                        https.get(`${API_URL}/service_requests/${requestId}`, {}, (res) => {
                            let bufs = [];
                            res.on('data', (chunk) => {
                                bufs.push(chunk);
                            });

                            res.on('end', () => {
                                const r = JSON.parse(Buffer.concat(bufs));
                                if (r.response) {
                                    clearInterval(interval);
                                    resolve(r.response);
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
