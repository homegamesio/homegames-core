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
                console.log('make get request for ' + playerId);
                let payload = {};
                if (this.playerInfo[playerId]) {
                    payload = this.playerInfo[playerId];
                } 
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                console.log('ending here with paylod');
                console.log(payload);
                res.end(JSON.stringify(payload));

            } else if (req.method === 'POST') {
                console.log("I GOT A DAMN INFO");

                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString(); // convert Buffer to string
                });

                req.on('end', () => {
                    console.log(body)
                
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
