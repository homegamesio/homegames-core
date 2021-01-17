const server = require('./game_server');
const config = require('./config');
const linkHelper = require('./src/util/link-helper');

if (config.LINK_ENABLED) {
    linkHelper.linkConnect().then(() => {
        console.log("Established connection to homegames.link");
    }).catch(err => {
        console.error("Failed to connect to homegames.link");
        console.error(err);
    });
}

server();
