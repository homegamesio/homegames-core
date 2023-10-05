const http = require('http');
const https = require('https');

const { getConfigValue } = require('homegames-common');

const ERROR_REPORTING_ENABLED = getConfigValue('ERROR_REPORTING', false);
const HTTPS_ENABLED = true;//'https://api.homegames.io/bugs';//getConfigValue('HTTPS_ENABLED', false);

let reportingEndpoint;

if (ERROR_REPORTING_ENABLED) {
    reportingEndpoint = getConfigValue('ERROR_REPORTING_ENDPOINT', 'https://api.homegames.io/bugs');
}

const makePost = (exc) => new Promise((resolve, reject) => {
    const payload = exc;//JSON.stringify(exc);

    let module, hostname, port;

    module = reportingEndpoint.startsWith('https') ? https : http;
    port =  reportingEndpoint.startsWith('https') ? 443 : 80;

    hostname = new URL(reportingEndpoint).hostname;
    const headers = {};

    Object.assign(headers, {
        'Content-Type': 'application/json',
        'Content-Length': exc.length
    });

    const options = {
        hostname,
        path: new URL(reportingEndpoint).pathname,
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

    req.write(exc);
    req.end();
});


const reportBug = (err) => {
    if (ERROR_REPORTING_ENABLED && reportingEndpoint) {
        makePost(err.toString());
    } else {
        console.error('Reporting not enabled for bug: ' + err);
    }
};

module.exports = reportBug;
