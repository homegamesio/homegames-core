const GameSession = require('./GameSession');

class SessionManager {
    constructor(portRange) {
        this.sessions = {};
        for (let portNumber in portRange) {
            this.sessions[portNumber] = null;
        }

    }

    newSession(game) {
        let newSessionPort;
        for (let portNum in this.sessions) {
            console.log(portNum);
            if (!this.sessions[portNum]) {
                newSessionPort = this.sessions[portNum];
                break;
            }
        }
        console.log("NEW SESSION PORT");
        console.log(newSessionPort);
        this.sessions[newSessionPort] = new GameSession(game, newSessionPort);
        return this.sessions[newSessionPort];
    }

    getSession(sessionId) {

    }

    listSessions() {
        return Object.values(this.sessions).filter(x => x);
    }
}

module.exports = SessionManager;
