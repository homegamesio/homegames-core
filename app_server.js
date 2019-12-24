#!/usr/bin/env/node

const http = require("http");
const fs = require('fs');
const path = require('path');

http.createServer((req, res) => {
    let contentType, payload;

    switch(req.url) {
        case '/': {
            const index = fs.readFileSync(path.join(__dirname, 'web/index.html'));
            contentType = 'text/html';
            payload = index;
            break;
        }
        case '/app.js': {
            const app = fs.readFileSync(path.join(__dirname, 'web/app.js'));
            contentType = 'text/javascript';
            payload = app;
            break;
        }
        case '/app.css': {
            const style = fs.readFileSync(path.join(__dirname, 'web/app.css'));
            contentType = 'text/css';
            payload = style;
            break;
        }
        case '/favicon.ico': {
            const icon = fs.readFileSync(path.join(__dirname, 'web/favicon.ico'));
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
