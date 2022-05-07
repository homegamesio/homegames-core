const WebSocket = require('ws');
const http = require('http');

class Homenames {
    constructor(port) {
        console.log("running homenames on port " + port);
        
        this.playerInfo = {};
        this.playerSettings = {};

        const server = http.createServer((req, res) => {
            const reqPath = req.url.split('/');
            if (req.method === 'GET') {
                const playerId = reqPath[reqPath.length - 1];
                if (reqPath[reqPath.length - 2] === 'info') {
                    let payload = {};
                    if (this.playerInfo[playerId]) {
                        payload = this.playerInfo[playerId];
                    } 
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(payload));
                } else if (reqPath[reqPath.length - 2] === 'settings') {
                    let payload = {};
                    if (this.playerSettings[playerId]) {
                        payload = this.playerSettings[playerId];
                    } 
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(payload));
                }

            } else if (req.method === 'POST') {
                console.log('watt');
                console.log(reqPath);

                const playerId = reqPath[reqPath.length - 2];
                console.log(playerId);

                if (reqPath[reqPath.length - 1] === 'info') {
                    let body = '';
                    req.on('data', chunk => {
                        body += chunk.toString(); 
                    });

                    req.on('end', () => {
                        this.playerInfo[playerId] = JSON.parse(body);
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(this.playerInfo[playerId]));
                    });
                } else if (reqPath[reqPath.length - 1] === 'settings') {
                    let body = '';
                    req.on('data', chunk => {
                        body += chunk.toString(); 
                    });

                    req.on('end', () => {
                        const payload = JSON.parse(body);
                        const newSettings = this.playerSettings[playerId] || {};
                        Object.assign(newSettings, payload);
                        this.playerSettings[playerId] = newSettings;
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(this.playerSettings[playerId]));
                    });
                }
            }
        }).listen(port); 
    }
}

module.exports = Homenames;
