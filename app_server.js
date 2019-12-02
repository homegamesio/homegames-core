const http = require("http");
const fs = require('fs');

http.createServer((req, res) => {
    const path = req.url;
    let contentType, payload;

    switch(path) {
        case '/': {
            const index = fs.readFileSync('web/index.html');
            contentType = 'text/html';
            payload = index;
            break;
        }
        case '/app.js': {
            const app = fs.readFileSync('web/app.js');
            contentType = 'text/javascript';
            payload = app;
            break;
        }
        case '/app.css': {
            const style = fs.readFileSync('web/app.css');
            contentType = 'text/css';
            payload = style;
            break;
        }
        case '/favicon.ico': {
            const icon = fs.readFileSync('web/favicon.ico');
            contentType = 'image/x-icon'
            payload = icon;
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
