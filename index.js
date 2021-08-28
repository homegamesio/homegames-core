const server = require('./src/server/game_server');
const linkHelper = require('./src/util/link-helper');
const path = require('path');
const { getConfigValue } = require(`${path.resolve()}/src/util/config`);
const { guaranteeCerts, guaranteeDir, authWorkflow } = require('homegames-common');

const linkEnabled = getConfigValue('LINK_ENABLED', false);
const httpsEnabled = getConfigValue('HTTPS_ENABLED', false);
const linkDnsEnabled = getConfigValue('LINK_DNS_ENABLED', false);
const authDir = getConfigValue('AUTH_DIR', path.resolve('.hg_auth'));
const certPath = getConfigValue('CERT_PATH', path.resolve('.hg_certs'));

let __squishMap;
 if (process.argv.length > 2) {
     try {
         const squishMap = JSON.parse(process.argv[2]);
         assert(squishMap['squish-061']);
         __squishMap = squishMap;
     } catch (err) {
         console.log('could not parse squish map');
         console.log(err);
     }
}

if (linkEnabled) {
	const msgHandler = (_msg) => {
		console.log('meesssage');
		console.log(_msg);
	};
    linkHelper.linkConnect().then((wsClient) => {
        console.log('got link websocket client');
	    if (linkDnsEnabled) {
		    const clientInfo = linkHelper.getClientInfo()
		    authWorkflow(`${authDir}/tokens.json`).then(({username, tokens}) => {

			    console.log('got auth data. verifying dns');
		linkHelper.verifyDNS(wsClient, username, tokens.accessToken, clientInfo.localIp).then(() => {
			console.log('verified dns');
if (httpsEnabled) {
    guaranteeDir(authDir).then(() => {
	    console.log('about to guarantee certs');
        guaranteeCerts(`${authDir}/tokens.json`, certPath).then(certPaths => {
		console.log('got certs at');
		console.log(certPaths);

	         server(certPaths, __squishMap);
        });
    });
} else {
	server(null, __squishMap);
}


		    }).catch(err => {
			console.log("ERRRRROR");
			    console.error(err);
		    });

		}).catch(err => {
			console.error("failed to create DNS alias.");
			console.error(err);
		});
	    }
    }).catch(err => {
        console.error(`Failed to initialize link. ${err}`);
    });
} else {

	server(null, __squishMap);
}

