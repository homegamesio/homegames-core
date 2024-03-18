const GameSession = require('./src/GameSession');
const http = require('http');
const https = require('https');
const { socketServer } = require('./src/util/socket');
const Homenames = require('./src/Homenames');
const path = require('path');
const baseDir = path.dirname(require.main.filename);
// const viewtest = require('./src/games/view-test');

const { getConfigValue } = require('homegames-common');

const logger = require('./src/logger');

const HOMENAMES_PORT = getConfigValue('HOMENAMES_PORT', 7100);
const HOME_PORT = getConfigValue('HOME_PORT', 7001);

const server = (certPath, squishMap, username) => {
    logger.debug('running server');

    if (squishMap) {
        logger.debug('custom squish map');
        logger.debug(squishMap);
    }

    const startPathOverride = getConfigValue('START_PATH', null);

    const customStartModule = startPathOverride ? require(startPathOverride) : null;

    const HomegamesDashboard = require('./src/dashboard/HomegamesDashboard');

    // hack kind of. but homegames dashbaoard is special
    let session;

    let services = {};

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

    if (customStartModule?.metadata) {
        const requestedServices = customStartModule.metadata().services || [];
        services = {};
        requestedServices.forEach(s => services[s] = supportedServices[s]);
    }

    const dashboard = customStartModule ? new customStartModule({ 
        squishMap,
        addAsset: (key, asset) => new Promise((resolve, reject) => {
            // if (session) {
            session.handleNewAsset(key, asset).then(resolve).catch(reject);
            // }
        }),
        username,
        certPath,
        services
    }) : new HomegamesDashboard({ 
        squishMap, 
        movePlayer: (params) => {
            session && session.movePlayer(params);
        },
        addAsset: (key, asset) => new Promise((resolve, reject) => {
            // if (session) {
            session.handleNewAsset(key, asset).then(resolve).catch(reject);
            // }
        }),
        username,
        certPath,
        services
    });
    
    session = new GameSession(dashboard, HOME_PORT, username);
    
    const homeNames = new Homenames(HOMENAMES_PORT, certPath);
    
    session.initialize(() => {
        socketServer(session, HOME_PORT, null, certPath, username);
    });
};

module.exports = server;
