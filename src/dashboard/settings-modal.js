const { GameNode, Colors, ShapeUtils, Shapes } = require('squish-150');

const COLORS = Colors.COLORS;

// Same treatment as the game modal (homegames.io modal palette): charcoal
// panel, white text, butter primary buttons, coral accents.
const PANEL_COLOR = [77, 77, 77, 255];
const PANEL_BORDER_COLOR = [26, 26, 26, 255];
const CORAL_COLOR = [241, 112, 111, 255];
const BUTTER_COLOR = [255, 247, 142, 255];
const PANEL_TEXT_COLOR = COLORS.WHITE;
const MUTED_TEXT_COLOR = [206, 209, 200, 255];
const OK_COLOR = [144, 238, 144, 255];

const centerTextY = (barY, barH, size) => barY + ((barH - (size * 16 / 9)) / 2);

const button = ({ x, y, width, height, text, playerId, onClick, fill = BUTTER_COLOR, textColor = COLORS.ALMOST_BLACK, size = 1.2 }) => {
    const node = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(x, y, width, height),
        playerIds: [playerId],
        fill,
        border: 2,
        color: PANEL_BORDER_COLOR,
        onClick: (pid, ...args) => {
            if (Number(pid) === Number(playerId)) onClick(pid, ...args);
        }
    });
    node.addChild(new GameNode.Text({
        textInfo: {
            x: x + (width / 2),
            y: centerTextY(y, height, size),
            align: 'center',
            size,
            color: textColor,
            text
        }
    }));
    return node;
};

const label = ({ x, y, text, playerId, size = 1.2, color = PANEL_TEXT_COLOR, align = 'left' }) => new GameNode.Text({
    textInfo: { x, y, align, size, color, text },
    playerIds: [playerId]
});

// Human line for the multiplayer/cert block, from the state the dashboard
// assembles (see HomegamesDashboard._settingsState).
const multiplayerStatusLines = ({ servingHttps, httpsEnabled, certStatus, discoveryStatus, offline }) => {
    if (offline) return { headline: "Offline mode", detail: "LAN play is available. Relaunch normally to use homegames.link.", color: OK_COLOR };
    if ((httpsEnabled || servingHttps) && discoveryStatus?.state === 'network-conflict') return {
        headline: 'homegames.link is in use on another computer',
        detail: 'Only one computer per network can use HTTPS. Stop Homegames on the other computer, then check again.',
        color: CORAL_COLOR
    };
    if ((httpsEnabled || servingHttps) && ['dns-unavailable', 'disconnected'].includes(discoveryStatus?.state)) return {
        headline: 'homegames.link is unavailable',
        detail: 'Discovery will retry automatically. Games already running can continue.',
        color: CORAL_COLOR
    };
    const state = certStatus && certStatus.state;
    if (certStatus?.restartRequired) return {
        headline: 'Certificate ready for this network',
        detail: 'Restart when everyone is finished playing to update homegames.link.',
        color: OK_COLOR
    };
    if ((httpsEnabled || servingHttps) && (state === 'review' || state === 'error')) {
        return {
            headline: state === 'review' ? 'Certificate request needs operator review'
                : servingHttps ? 'Certificate renewal failed' : 'Certificate request failed',
            detail: certStatus.detail || 'Please try again later. Local play still works.',
            color: CORAL_COLOR
        };
    }
    if (servingHttps) {
        return {
            headline: certStatus?.networkChanged ? 'Setting up homegames.link for this network' : 'homegames.link is enabled',
            detail: certStatus?.networkChanged ? 'Preparing a certificate. Keep this window open; existing games can continue.'
                : state === 'renewing' || state === 'requesting' || state === 'waiting'
                ? 'Renewing the certificate. Players can keep playing.' : 'Players can join at homegames.link',
            color: OK_COLOR
        };
    }
    if (!httpsEnabled) {
        return {
            headline: 'homegames.link is off',
            detail: 'Enabling requests a certificate for this network (takes a few minutes)',
            color: MUTED_TEXT_COLOR
        };
    }
    // Opted in, not serving yet — the cert manager is (or was) working on it.
    if (state === 'valid' || state === 'renewed') {
        return {
            headline: 'Certificate ready',
            detail: 'Restart to start serving via homegames.link',
            color: OK_COLOR
        };
    }
    if (state === 'requesting' || state === 'waiting' || state === 'renewing') {
        return {
            headline: 'Setting up secure connection…',
            detail: (certStatus && certStatus.detail) || 'Working…',
            color: MUTED_TEXT_COLOR
        };
    }
    return {
        headline: 'homegames.link waiting for certificate',
        detail: 'Certificate status unavailable',
        color: MUTED_TEXT_COLOR
    };
};

/**
 * Server settings modal.
 *
 * state: {
 *   servingHttps, httpsEnabled, certStatus, pendingRestart,
 *   pageSize, homePort, homenamesPort, allowFork
 * }
 * handlers: onEnableMultiplayer, onDisableMultiplayer, onRestart(openLink),
 *   onRetryCertificate, onSetPageSize(n), onSetPort(key, rawValue), onToggleAllowFork, onClose
 */
const settingsModal = ({ playerId, state, handlers }) => {
    const modal = new GameNode.Shape({
        coordinates2d: ShapeUtils.rectangle(5, 5, 90, 90),
        fill: PANEL_COLOR,
        border: 2,
        color: PANEL_BORDER_COLOR,
        shapeType: Shapes.POLYGON,
        playerIds: [playerId]
    });

    modal.addChild(label({ x: 50, y: 8.5, text: 'Server settings', playerId, size: 2, align: 'center' }));

    // Close X (same affordance as the game modal)
    const closeButton = new GameNode.Shape({
        coordinates2d: ShapeUtils.rectangle(88, 6.5, 5.5, 6),
        fill: [0, 0, 0, 0],
        shapeType: Shapes.POLYGON,
        onClick: handlers.onClose,
        playerIds: [playerId]
    });
    closeButton.addChild(new GameNode.Text({
        textInfo: { x: 90.75, y: centerTextY(6.5, 6, 1.8), text: '✕', align: 'center', color: CORAL_COLOR, size: 1.8 }
    }));
    modal.addChild(closeButton);

    // --- Multiplayer / homegames.link block ---
    modal.addChild(label({ x: 10, y: 17, text: 'Easy LAN joining (homegames.link)', playerId, size: 1.5 }));

    const status = multiplayerStatusLines(state);
    modal.addChild(label({ x: 10, y: 23, text: status.headline, playerId, size: 1.25, color: status.color }));
    const detailLines = String(status.detail).replace(/\s+/g, ' ').match(/.{1,90}(?:\s|$)|.{1,90}/g) || [];
    detailLines.slice(0, 2).forEach((text, i) => modal.addChild(label({ x: 10, y: 27 + i * 2.3,
        text: text.trim() + (i === 1 && detailLines.length > 2 ? '…' : ''), playerId, size: 1.05, color: MUTED_TEXT_COLOR })));

    const certReady = state.certStatus && (state.certStatus.state === 'valid' || state.certStatus.state === 'renewed');

    if (!state.offline && (state.httpsEnabled || state.servingHttps)
        && ['network-conflict', 'dns-unavailable', 'disconnected'].includes(state.discoveryStatus?.state)) {
        modal.addChild(button({ x: 10, y: 32, width: 30, height: 8,
            text: 'Check homegames.link', playerId, onClick: handlers.onRetryDiscovery }));
    } else if (!state.offline && state.certStatus?.restartRequired) {
        modal.addChild(button({
            x: 10, y: 32, width: 34, height: 8,
            text: 'Restart to update homegames.link', playerId,
            onClick: () => handlers.onRestart(true)
        }));
    } else if (!state.offline && !state.httpsEnabled && !state.servingHttps) {
        modal.addChild(button({
            x: 10, y: 32, width: 30, height: 8,
            text: 'Enable homegames.link',
            playerId,
            onClick: handlers.onEnableMultiplayer
        }));
    } else if (!state.offline && state.httpsEnabled && !state.servingHttps && certReady) {
        modal.addChild(button({
            x: 10, y: 32, width: 34, height: 8,
            text: 'Restart to enable homegames.link',
            playerId,
            onClick: () => handlers.onRestart(true)
        }));
    } else if (!state.offline && (state.httpsEnabled || state.servingHttps) && ['error', 'review'].includes(state.certStatus?.state)) {
        modal.addChild(button({
            x: 10, y: 32, width: 30, height: 8,
            text: state.certStatus.state === 'review' ? 'Check certificate status' : 'Retry certificate request',
            playerId,
            onClick: handlers.onRetryCertificate
        }));
    }

    if (!state.offline && (state.httpsEnabled || state.servingHttps)) {
        modal.addChild(button({
            x: 46, y: 32, width: 22, height: 8,
            text: 'Disable homegames.link',
            playerId,
            fill: COLORS.WHITE,
            onClick: handlers.onDisableMultiplayer
        }));
    }

    // --- Server configuration block ---
    modal.addChild(label({ x: 10, y: 46, text: 'Server configuration', playerId, size: 1.5 }));
    modal.addChild(label({ x: 10, y: 51, text: 'Page size and port changes need a restart', playerId, size: 1.0, color: MUTED_TEXT_COLOR }));

    // Games per page: 3 / 6 / 9
    modal.addChild(label({ x: 10, y: 57.5, text: 'Games per page', playerId, size: 1.2 }));
    [3, 6, 9].forEach((n, i) => {
        modal.addChild(button({
            x: 32 + (i * 9), y: 56, width: 7, height: 6,
            text: `${n}`,
            playerId,
            fill: state.pageSize === n ? BUTTER_COLOR : COLORS.WHITE,
            onClick: () => handlers.onSetPageSize(n)
        }));
    });

    // Ports: text inputs (same input mechanism as the dashboard search box)
    const portField = ({ y, labelText, value, configKey, fromEnvironment }) => {
        modal.addChild(label({ x: 10, y: y + 1.5, text: labelText, playerId, size: 1.2 }));
        const box = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(32, y, 16, 6),
            playerIds: [playerId],
            fill: COLORS.WHITE,
            border: 2,
            color: PANEL_BORDER_COLOR,
            ...(fromEnvironment ? {} : { input: {
                type: 'text',
                oninput: (pid, input) => {
                    // Text inputs are addressed by node ID. A guest can guess
                    // another player's node, so bind the action to its sender.
                    if (Number(pid) === Number(playerId)) handlers.onSetPort(configKey, input);
                }
            } })
        });
        box.addChild(new GameNode.Text({
            textInfo: {
                x: 33.5,
                y: centerTextY(y, 6, 1.2),
                align: 'left',
                size: 1.2,
                color: COLORS.ALMOST_BLACK,
                text: `${value}`
            }
        }));
        modal.addChild(box);
        if (fromEnvironment) modal.addChild(label({ x: 51, y: y + 1.5,
            text: `Set by ${configKey}`, playerId, size: 1, color: MUTED_TEXT_COLOR }));
    };

    portField({ y: 63.5, labelText: 'Game port', value: state.homePort, configKey: 'HOME_PORT', fromEnvironment: state.homePortFromEnvironment });
    portField({ y: 70.5, labelText: 'Identity port', value: state.homenamesPort, configKey: 'HOMENAMES_PORT', fromEnvironment: state.homenamesPortFromEnvironment });

    // Fork opt-in: without Docker, game sessions run via fork() with no
    // isolation — off by default. Applies to new sessions immediately
    // (the session manager reads it per launch), hence no pendingRestart.
    modal.addChild(label({ x: 10, y: 79, text: 'Run games without Docker', playerId, size: 1.2 }));
    modal.addChild(button({
        x: 44, y: 77.5, width: 10, height: 6,
        text: state.allowFork ? 'On' : 'Off',
        playerId,
        fill: state.allowFork ? BUTTER_COLOR : COLORS.WHITE,
        onClick: () => handlers.onToggleAllowFork()
    }));
    modal.addChild(label({
        x: 56, y: 78,
        text: 'Games run on your machine',
        playerId, size: 0.95, color: CORAL_COLOR
    }));
    modal.addChild(label({
        x: 56, y: 80.5,
        text: 'outside of a sandbox.',
        playerId, size: 0.95, color: CORAL_COLOR
    }));

    // --- Restart to apply ---
    if (state.pendingRestart) {
        modal.addChild(button({
            x: 10, y: 85.5, width: 30, height: 8,
            text: 'Restart to apply changes',
            playerId,
            onClick: () => handlers.onRestart(false)
        }));
        modal.addChild(label({
            x: 42, y: 88.5,
            text: 'Restarting briefly disconnects everyone',
            playerId, size: 1.0, color: MUTED_TEXT_COLOR
        }));
    }

    return modal;
};

module.exports = settingsModal;
module.exports.multiplayerStatusLines = multiplayerStatusLines;
