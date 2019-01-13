const fs = require('fs');
const express = require('express');
const https = require('https');
const app = express();

const privateKey = fs.readFileSync('ssl/localhost.key');
const certificate = fs.readFileSync('ssl/localhost.crt');

https.createServer({
    key: privateKey,
    cert: certificate
}, app).listen(443);

app.use(express.static('web'));
