const gameNode = require('./GameNode');
const { colors } = require('./Colors');
const SessionManager = require('./SessionManager');
const MoveTest = require('./games/move-test');

class SessionDashboard {
    constructor(portRange) {
        this.sessionManager = new SessionManager(portRange);
        this.base = gameNode(colors.RED, this.handleClick.bind(this), {'x': 0, 'y': 0}, {'x': 100, 'y': 100}, {'x': 45, 'y': 45, 'text': 'welcome'}, null);
        let currentSessions = this.sessionManager.listSessions();
        this.canDoNewSession = true;

        if (currentSessions.length < 1) {
            this.base.clearChildren();
            const newSessionButton = gameNode(colors.BLUE, this.newSession.bind(this), {'x': 20, 'y': 20}, {'x': 10, 'y': 10}, {'x': 50, 'y': 50, 'text': 'new session'}, null);
            this.base.addChild(newSessionButton);
        }
    }

    newSession() {
        if (this.canDoNewSession) {
            const newSession = this.sessionManager.newSession(new MoveTest(), 7105);
            console.log(newSession);
        }
        this.canDoNewSession = false;
    }

    handleClick(player, x, y) {
        console.log("player clicked");
        console.log(x);
        console.log(y);
    }

    getResolution() {
        return {x: 1600, y: 900};
    }

    getRoot() {
        return this.base;
    }

}

module.exports = SessionDashboard;
