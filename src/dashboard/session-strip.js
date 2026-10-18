const { GameNode, Colors, ShapeUtils, Shapes } = require('squish-150');

const COLORS = Colors.COLORS;

// Matches the dashboard's site palette (see HomegamesDashboard.js).
const CARD_FILL = COLORS.WHITE;
const CARD_BORDER_COLOR = [77, 77, 77, 255]; // #4D4D4D
const TEXT_COLOR = COLORS.ALMOST_BLACK;
const MUTED_TEXT_COLOR = [120, 122, 116, 255];
const LABEL_COLOR = COLORS.WHITE; // sits on the coral header band

const MAX_CARDS = 4;

const truncate = (text, max = 16) => {
    const s = `${text}`;
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
};

/**
 * Active-sessions strip: one joinable card per running session, shown between
 * the top bar and the game grid so players can jump into an existing session
 * without hunting for the right game's modal.
 *
 * sessions: [{ id, port, name, playerCount|null }] — already filtered
 * (non-private) and name-resolved by the dashboard.
 * onJoin(session) — join handler (movePlayer under the hood).
 * area: { x, y, width, height } — where the strip lives (0-100 plane).
 */
const sessionStrip = ({ sessions, playerId, onJoin, area }) => {
    const strip = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
        playerIds: [playerId]
    });

    strip.addChild(new GameNode.Text({
        textInfo: {
            x: area.x,
            y: area.y,
            align: 'left',
            size: 1.1,
            text: 'Active sessions — tap to join',
            color: LABEL_COLOR
        },
        playerIds: [playerId]
    }));

    const cardsY = area.y + 3;
    const cardsHeight = area.height - 3;
    const gap = 1;
    const cardWidth = (area.width - ((MAX_CARDS - 1) * gap)) / MAX_CARDS;

    const visible = sessions.slice(0, MAX_CARDS);

    visible.forEach((session, i) => {
        const x = area.x + (i * (cardWidth + gap));

        const card = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, cardsY, cardWidth, cardsHeight),
            playerIds: [playerId],
            fill: CARD_FILL,
            border: 2,
            color: CARD_BORDER_COLOR,
            onClick: () => onJoin(session)
        });

        card.addChild(new GameNode.Text({
            textInfo: {
                x: x + 1,
                y: cardsY + 1,
                align: 'left',
                size: 1.1,
                text: truncate(session.name),
                color: TEXT_COLOR
            },
            playerIds: [playerId]
        }));

        const countText = session.playerCount === null || session.playerCount === undefined
            ? `Session ${session.id}`
            : `${session.playerCount} ${session.playerCount === 1 ? 'player' : 'players'}`;

        card.addChild(new GameNode.Text({
            textInfo: {
                x: x + 1,
                y: cardsY + 4,
                align: 'left',
                size: 0.95,
                text: countText,
                color: MUTED_TEXT_COLOR
            },
            playerIds: [playerId]
        }));

        strip.addChild(card);
    });

    if (sessions.length > MAX_CARDS) {
        strip.addChild(new GameNode.Text({
            textInfo: {
                x: area.x + area.width + 1,
                y: cardsY + 3,
                align: 'left',
                size: 1.0,
                text: `+${sessions.length - MAX_CARDS} more`,
                color: LABEL_COLOR
            },
            playerIds: [playerId]
        }));
    }

    return strip;
};

module.exports = sessionStrip;
