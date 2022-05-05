const WebSocket = require('ws');
const http = require('http');

class Homenames {
    constructor(port) {
        console.log("running homenames on port " + port);
        this.playerInfo = {};
        const server = http.createServer((req, res) => {
            const reqPath = req.url.split('/');
            const playerId = reqPath[reqPath.length - 1];
            if (req.method === 'GET') {
                let payload = {};
                if (this.playerInfo[playerId]) {
                    payload = this.playerInfo[playerId];
                } 
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(payload));

            } else if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString(); // convert Buffer to string
                });

                req.on('end', () => {
                    this.playerInfo[playerId] = JSON.parse(body);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(this.playerInfo[playerId]));
                });
            }
        }).listen(port); 
    }
}

module.exports = Homenames;
