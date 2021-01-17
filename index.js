const server = require('./game_server');
const config = require('./config');
const linkHelper = require('./src/util/link-helper');
const process = require('process');

if (process.env.LINK_ENABLED === 'true') {
    linkHelper.linkConnect().then(() => {
        console.log("Established connection to homegames.link");
    }).catch(err => {
        console.error("Failed to connect to homegames.link");
        console.error(err);
    });
}

server();
