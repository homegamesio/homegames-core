const fs = require('fs');
const express = require('express');
const https = require('https');
const http = require('http');
const app = express();

const privateKey = fs.readFileSync('ssl/localhost.key');
const certificate = fs.readFileSync('ssl/localhost.crt');

const ensureSecure = (req, res, next) => {
    if (req.secure) {
        return next();
    }

    res.redirect('https://' + req.hostname + req.url);
}

app.all('*', ensureSecure);

http.createServer(app).listen(80);

https.createServer({
    key: privateKey,
    cert: certificate
}, app).listen(443);

app.use(express.static('web'));
