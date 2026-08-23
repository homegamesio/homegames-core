/**
 * Homegames client bootstrap — served by homegames-core itself.
 *
 * The page comes from the same server that runs the game WebSocket, so the
 * WS URL derives entirely from window.location: no config fetch, no port
 * discovery. HomegamesClient (UMD global, loaded before this script) handles
 * all rendering, input, and socket lifecycle.
 *
 * Modes:
 *   /                                  — connect to the dashboard session
 *   /?gameId=<id>[&versionId=<id>]     — connect, deep-linked to a game modal
 *   /?localGame=<key>[&versionId=<id>] — run a game single-player in-browser
 *                                        (LocalSession; its home button
 *                                        connects back to the dashboard)
 */
(() => {
    const showError = (message) => {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position:absolute;width:100vw;top:0;text-align:center;font-size:6vw;color:white;';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
    };

    // Shown when the server delivers a save to this browser (servers with save
    // files disabled). The save is already persisted locally by the client; the
    // toast offers a downloadable copy.
    let saveToast = null;
    const showSaveToast = (envelope) => {
        if (saveToast) saveToast.remove();
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:16px;right:16px;background:#222;color:#fff;'
            + 'padding:10px 14px;border-radius:8px;font-family:sans-serif;font-size:14px;'
            + 'cursor:pointer;z-index:1000;box-shadow:0 2px 8px rgba(0,0,0,0.4);';
        toast.textContent = '💾 Game saved — click to download';
        toast.onclick = () => {
            HomegamesClient.downloadSave(envelope);
            toast.remove();
            if (saveToast === toast) saveToast = null;
        };
        document.body.appendChild(toast);
        saveToast = toast;
        setTimeout(() => {
            if (saveToast === toast) {
                toast.remove();
                saveToast = null;
            }
        }, 10000);
    };

    const params = new URLSearchParams(window.location.search);
    const localGameKey = params.get('localGame');

    // ?gameId=<id>[&versionId=<id>] deep-links to a game's modal on the
    // dashboard. Strip consumed params from the address bar so a refresh
    // lands on the plain dashboard.
    let requestedGame = null;
    if (params.get('gameId')) {
        requestedGame = {
            gameId: params.get('gameId'),
            versionId: params.get('versionId'),
        };
    }
    if (params.get('gameId') || localGameKey) {
        const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${window.location.host}`;

    const client = new HomegamesClient({
        containerId: 'homegames-main',
        wsUrl,
        workerUrl: '/socket-worker.js',
        requestedGame,
        onSaveData: showSaveToast,
        onReady: (playerId) => {
            console.log('Connected as player ' + playerId);
        },
        onClose: () => {
            console.log('Disconnected');
        },
        onError: (err) => {
            console.error('Connection error:', err);
            showError('Error: ' + (err.message || err));
        },
    });

    if (localGameKey) {
        // Single player straight from the URL — no session until the player
        // hits the home button, which connects this client to the dashboard.
        client.startLocalGame({ gameKey: localGameKey, versionId: params.get('versionId') });
    } else {
        client.start();
    }
})();
