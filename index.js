const server = require('./game_server');

const path = require('path');
const baseDir = path.dirname(require.main.filename);

const { getConfigValue } = require(`${baseDir}/src/util/config`);

const linkHelper = require('./src/util/link-helper');
const process = require('process');
const { getLoginInfo, promptLogin, login, storeTokens, verifyAccessToken } = require('homegames-common');

const LINK_ENABLED = getConfigValue('LINK_ENABLED', true);
const AUTH_DIR = getConfigValue('HG_AUTH_DIR', `${process.cwd()}/.hg_auth`);
const LINK_DNS_ENABLED = getConfigValue('LINK_DNS_ENABLED', false);

if (LINK_ENABLED) {
    let verifyDnsRequest;
    const linkMessageHandler = (_msg) => {
        const msg = JSON.parse(_msg);
        if (verifyDnsRequest && msg.msgId === verifyDnsRequest) {
            if (msg.success) {
                console.log('Verified DNS record for ' + msg.url);
            }
        }
    };

    linkHelper.linkConnect(linkMessageHandler).then((wsClient) => {
        console.log("Established connection to homegames.link");
        const doLogin = () => new Promise((resolve, reject) => {
            promptLogin().then(info => {
                login(info.username, info.password).then(tokens => {
                    storeTokens(`${AUTH_DIR}/tokens.json`, info.username, tokens).then(() => {
                        verifyAccessToken(info.username, tokens.accessToken).then(() => {
                            resolve({tokens, username: info.username});

                        });
                    });
                }).catch(err => {
                    console.error('Failed to login');
                    console.error(err);
                });
            });
        });

        if (LINK_DNS_ENABLED) {
            console.log(`DNS requires login.`); 
            if (!AUTH_DIR) {
                console.error('Failed to verify DNS record: no authentication directory found. Set process.env.AUTH_DIR or set AUTH_DIR = true in your config file');
            } else {
                console.log(`Verifying credentials at ${AUTH_DIR}`);
                getLoginInfo(`${AUTH_DIR}/tokens.json`).then((loginInfo) => {
                    verifyAccessToken(loginInfo.username, loginInfo.tokens.accessToken).then(() => {
                        const clientInfo = linkHelper.getClientInfo();
                        linkHelper.verifyDNS(wsClient, loginInfo.username, loginInfo.tokens.accessToken, clientInfo.localIp).then((requestId) => {
                            verifyDnsRequest = requestId;
                        });
                    }).catch(err => {
                        console.error('Failed to verify access token. Please log in');
                        doLogin().then(loginInfo => {
                            const clientInfo = linkHelper.getClientInfo();
                            linkHelper.verifyDNS(wsClient, loginInfo.username, loginInfo.tokens.accessToken, clientInfo.localIp).then((requestId) => {
                                verifyDnsRequest = requestId;
                            });
                        });
                    });
                }).catch(err => {
                    if (err.type === 'DATA_NOT_FOUND') {
                        console.log(`No credential data found at ${AUTH_DIR}. Please log in with your homegames account (to register, go to https://homegames.io)`);
                        doLogin().then(loginInfo => {
                            const clientInfo = linkHelper.getClientInfo();
                            linkHelper.verifyDNS(wsClient, loginInfo.username, loginInfo.tokens.accessToken, clientInfo.localIp).then((requestId) => {
                                verifyDnsRequest = requestId;
                            });
                        }).catch(err => {
                            console.error('Failed to login');
                            console.error(err);
                        });
                    } else {
                        console.error('Failed to get login info');
                        console.error(err);
                    }
                });
            }
        }
    }).catch(err => {
        console.error("Failed to connect to homegames.link");
        console.error(err);
    });
}

server();
