/**
 * Homegames client bootstrap — served by homegames-core itself.
 *
 * START_PATH browser mode supplies /boot.json. Dashboard/WebSocket mode has
 * no boot config and keeps deriving its WS URL from window.location.
 * HomegamesClient (UMD global, loaded before this script) handles
 * all rendering, input, and socket lifecycle.
 *
 * Modes:
 *   /                                  — connect to the dashboard session
 *   /?gameId=<id>[&versionId=<id>]     — connect, deep-linked to a game modal
 *   /?localGame=<key>[&versionId=<id>] — run a game single-player in-browser
 *                                        (LocalSession; its home button
 *                                        connects back to the dashboard)
 */
(async () => {
    let errorDiv = null;
    const showError = (message) => {
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.setAttribute('role', 'status');
            errorDiv.style.cssText = 'position:fixed;left:50%;top:20px;transform:translateX(-50%);max-width:90vw;padding:16px 22px;border-radius:10px;background:#242424;color:white;text-align:center;font:16px system-ui;z-index:1000';
            document.body.appendChild(errorDiv);
        }
        errorDiv.textContent = message;
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

    const invitation = HomegamesClient.readInvitation();
    let boot = null;
    if (!invitation && !localGameKey) {
        const response = await fetch('/boot.json');
        if (response.ok) boot = await response.json();
        else if (response.status !== 404) throw new Error('Unable to load startup configuration');
    }

    let dashboardSharing = null;
    if (!boot && !invitation) {
        const response = await fetch('/rtc-config');
        if (response.ok) dashboardSharing = await response.json();
    }
    const guestFrame = invitation ? HomegamesClient.createSessionFrame(
        'homegames-main', 'Shared game', '/', {
            getLink: () => client.getShareLink(),
            hintText: 'Scan to join this session. The host needs to keep their game open.',
            onOpen: () => client.inputHandler?.detach(),
            onClose: () => { if (client.rendering) client.inputHandler?.attach(); },
        }, { status: 'Connecting to host…' }) : null;

    const client = new HomegamesClient({
        containerId: guestFrame ? guestFrame.containerId : 'homegames-main',
        wsUrl,
        workerUrl: '/socket-worker.js',
        requestedGame,
        transport: invitation ? HomegamesClient.createRtcTransport(invitation) : null,
        localHome: boot ? false : true,
        share: boot ? boot.share : dashboardSharing ? game => ({
            ...dashboardSharing, autoStart: game.multiplayer,
            ...HomegamesClient.householdRoom(game, err => showError(err.message)),
        }) : null,
        onLocalPlayRedirect: info => {
            if (info.invitation) {
                const { roomId, invite, signalingUrl } = info.invitation;
                window.location.hash = new URLSearchParams({ room: roomId, invite, signal: signalingUrl }).toString();
                window.location.reload();
            } else client.startLocalGame(info);
        },
        loadLocalGame: boot ? async (_, options) => ({
            ...await HomegamesClient.loadLocalGame({ manifestUrl: boot.manifestUrl, gameKey: boot.gameKey }, options),
            name: boot.title,
        }) : undefined,
        onSaveData: showSaveToast,
        onReady: (playerId) => {
            guestFrame?.setStatus('Connected to host');
            console.log('Connected as player ' + playerId);
        },
        onClose: () => {
            guestFrame?.setStatus('Session ended');
            console.log('Disconnected');
            if (invitation && !errorDiv) showError('The host disconnected. Reopen the invitation to join again.');
        },
        onError: (err) => {
            guestFrame?.setStatus('Unable to join');
            console.error('Connection error:', err);
            showError('Error: ' + (err.message || err));
        },
    });

    window.addEventListener('pagehide', () => { client.stop(); guestFrame?.dispose(); });
    if (invitation) {
        client.start();
    } else if (boot?.mode === 'browser') {
        document.title = `${boot.title} — Homegames`;
        client.startLocalGame({});
    } else if (localGameKey) {
        // Single player straight from the URL — no session until the player
        // hits the home button, which connects this client to the dashboard.
        client.startLocalGame({ gameKey: localGameKey, versionId: params.get('versionId') });
    } else {
        client.start();
    }
})().catch(err => {
    const message = document.createElement('p');
    message.style.cssText = 'color:white;font:18px system-ui;padding:24px';
    message.textContent = err.message || 'Unable to start Homegames';
    document.body.appendChild(message);
});
