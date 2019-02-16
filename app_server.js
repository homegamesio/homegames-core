const http = require("http");
const fs = require('fs');

const index = fs.readFileSync('web/index.html');
const app = fs.readFileSync('web/app.js');
const style = fs.readFileSync('web/app.css');

http.createServer((req, res) => {
    const path = req.url;
    let contentType, payload;

    switch(path) {
        case '/': {
            contentType = 'text/html';
            payload = index;
            break;
        }
        case '/app.js': {
            contentType = 'text/javascript';
            payload = app;
            break;
        }
        case '/app.css': {
            contentType = 'text/css';
            payload = style;
            break;
        }
        default: {
            res.statusCode = 404;
            res.end();
            return;
        }
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.end(payload);
}).listen(80);
