const http = require("http");
const fs = require('fs');
const path = require('path');

const PATH_MAP = {
    "/": { 
        path: "web/index.html",
        contentType: "text/html"
    },
    "/app.js": {
        path: "web/app.js",
        contentType: "text/javascript"
    },
    "/app.css": {
        path: "web/app.css",
        contentType: "text/css"
    },
    "/favicon.ico": {
        path: "web/favicon.ico",
        contentType: "image/x-icon"
    }
};

http.createServer((req, res) => {
    const pathMapping = PATH_MAP[req.url];

    if (pathMapping) {
        res.statusCode = 200;
        res.setHeader("Content-Type", pathMapping.contentType);
        const payload = fs.readFileSync(path.join(__dirname, pathMapping.path));
        res.end(payload);
    } else {
        res.statusCode = 404;
        res.end();
    }
}).listen(80);
