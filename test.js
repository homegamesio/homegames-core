const { socketServer } = require('./src/util/socket');
const assert = require("assert");
const { Asset, gameNode, Colors } = require('./src/common');

const ASSET_TYPE = 1;

const COLOR_SUBTYPE = 42;
const ID_SUBTYPE = 43;
const PLAYER_ID_SUBTYPE = 44;
const POS_SUBTYPE = 45;

const squishSpec = {
    id: {
        type: ID_SUBTYPE,
        squish: (i) => {
            return [i];
        },
        unsquish: (arr) => {
            return arr[0];
        }
    },
    color: {
        type: COLOR_SUBTYPE,
        squish: (c) => {
            return [c[0], c[1], c[2], c[3]];
        },
        unsquish: (squished) => {
            return [squished[0], squished[1], squished[2], squished[3]];
        }
    },
    playerId: {
        type: PLAYER_ID_SUBTYPE,
        squish: (i) => {
            return [i];
        }, 
        unsquish: (squished) => {
            return squished[0];
        }
    }, 
    pos: {
        type: POS_SUBTYPE,
        squish: (p) => {
            return [Math.floor(p.x), Math.round(100 * (p.x - Math.floor(p.x))), Math.floor(p.y), Math.round(100 * (p.y - Math.floor(p.y)))] 
        },
        unsquish: (squished) => {
            return {
                x: squished[0] + squished[1] / 100,
                y: squished[2] + squished[3] / 100
            }
        }
    }
};

const typeToSquishMap = {};

for (const key in squishSpec) {
    typeToSquishMap[Number(squishSpec[key]['type'])] = key;
}

class Game {
    constructor() {
        this.players = {};
        this.listeners = new Set();
        this.root = null;
    }

    addPlayer(player) {
        this.players[player.id] = player;
    }

    removePlayer(playerId) {
        delete this.players[playerId];
    }

    addUpdateListener(listener) {
        this.listeners.add(listener);
    }

    getRoot() {
        return this.root;
    }

    initialize() {
        console.log("INITTING");
    }

    getAssets() {
        return null;
    }
}

class PerfTest extends Game {
    static metadata() {
        return {
            res: {
                width: 1920,
                height: 1080
            },
            author: "Joseph Garcia"
        };
    }

    constructor() {
        super();
        this.base = gameNode(Colors.WHITE, (player) => {
        }, {"x": 0, "y": 0}, {"x": 100, "y": 100});

        this.imageTestNode = gameNode(Colors.WHITE, null, {x: 0, y: 0}, {x: 0, y: 0}, {text: "", x: 0, y: 0}, {"test": {pos: {x: 20, y: 20}, size: {x: 20, y: 20}}});

        this.base.addChild(this.imageTestNode);
       // let xCounter = 0;
       // let yCounter = 0;

       // const filler = setInterval(() => {
       //     let dot = gameNode(Colors.randomColor(), null, {x: xCounter, y: yCounter}, {x: 1, y: 1});
       //     this.base.addChild(dot);
       //     xCounter += 1;
       //     if (xCounter >= 100) {
       //         xCounter = 0;
       //         yCounter++;
       //     }

       //     if (yCounter == 100 && xCounter == 100) {
       //         clearInterval(filler);
       //     }

       // }, 2);
    }

    getAssets() {
        return {
            "test": new Asset("url", {
                "location": "https://www.nicepng.com/png/full/323-3239506_kanye-west-shrug-transparent.png",
                "type": "image"
            })
        }
    }

    getRoot() {
        return this.base;
    }
}


class Squisher {
    constructor(game) {
        this.assets = {};
        this.gameMetadata = game && game.constructor.metadata ? game.constructor.metadata() : null;
        this.width = this.gameMetadata ? this.gameMetadata.res.width : 1280;
        this.height = this.gameMetadata ? this.gameMetadata.res.height : 720;

        this.ids = new Set();

        this.game = game;
        this.game && this.game.getRoot().addListener(this);
        this.listeners = new Set();
    }

    async initialize() {
        const gameAssets = this.game.getAssets ? this.game.getAssets() : [];
        
        let assetBundleSize = 0;

        for (const key in gameAssets) {
            const payload = await gameAssets[key].getData();

            const assetKeyLength = 32;
            let keyIndex = 0;
            const assetKeyArray = new Array(32);
            while (keyIndex < assetKeyLength && keyIndex < key.length) {
                assetKeyArray[keyIndex] = key.charCodeAt(keyIndex);
                keyIndex++;
            }

            const encodedLength = (payload.length + assetKeyLength).toString(36);
            
            const assetType = gameAssets[key].info.type === "image" ? 1 : 2;

            this.assets[key] = [ASSET_TYPE, assetType, encodedLength.charCodeAt(0), encodedLength.charCodeAt(1), encodedLength.charCodeAt(2), encodedLength.charCodeAt(3), ...assetKeyArray, ...payload];
            assetBundleSize += this.assets[key].length;
        }

        const newAssetBundle = new Array(assetBundleSize);

        for (let index = 0; index < assetBundleSize; index++) {
            for (const key in this.assets) {
                for (let y = 0; y < this.assets[key].length; y++) {
                    newAssetBundle[index++] = this.assets[key][y];
                }
            }
        }

        this.assetBundle = newAssetBundle;

    }

    addListener(listener) {
        this.listeners.add(listener);
    }

    removeListener(listener) {
        this.listeners.remove(listener);
    }

    update(node) {
        this.ids = new Set();
        let newSquished = [];
        // todo: fix this
        this.updateHelper(this.game.getRoot(), newSquished);
        this.squished = newSquished.flat();
    }

    updateHelper(node, squished) {
        const newSquish = this.squish(node);
        squished.push(newSquish);

        for (let i = 0; i < node.children.length; i++) {
            this.updateHelper(node.children[i], squished);
        }
    }

    unsquish(squished) {
        console.log("UNSQUISHING");
        console.log(squished);

        assert(squished[0] == 3);
    
        assert(squished.length === squished[1]);

        let squishedIndex = 2;

        let constructedGameNode = gameNode();

        while(squishedIndex < squished.length) {

            const subFrameType = squished[squishedIndex];
            const subFrameLength = squished[squishedIndex + 1];
            const subFrame = squished.slice(squishedIndex + 2, squishedIndex + 2 + subFrameLength);

            if (!typeToSquishMap[subFrameType]) {
                console.warn("Unknown sub frame type " + subFrameType);
                break;
            } else {
                const objField = typeToSquishMap[subFrameType];  
                const unsquishFun = squishSpec[objField]['unsquish'];
                const unsquishedVal = unsquishFun(subFrame);
                constructedGameNode[objField] = unsquishedVal;
            }
            squishedIndex += subFrameLength;
        }
        
        //for (const key in squishSpec) {
        //    if (entity[key]) {
        //        const attr = entity[key];
        //        const squished = squishSpec[key].squish(attr);
        //        squishedPieces.push([squishSpec[key]['type'], squished.length + 2, ...squished]);
        //    }
        //}

        //const newSquished = squishedPieces.flat();
//        return [3, squished.length + 2, ...squished];

        return constructedGameNode;
    }

    squish(entity) {
        // Type (1) + Player ID (1) + Size (1) + color (4) + pos (4) + size (4) + text position (2) + text size (1) + text (32) + assets (37 * assetCount)
        // TODO: store type in array to stop sending unnecessary data 
        //const squishedSize = 1 + 1 + 1 + 4 + 4 + 4 + (entity.text ? 2 + + 1+ 32 : 0) + (entity.assets ? 37 * Object.keys(entity.assets).length : 0);

        //let squishedIndex = 0;
        //squished[squishedIndex++] = 3;
        //squished[squishedIndex++] = entity.playerId;
        //squished[squishedIndex++] = squishedSize;
 
        //if (!(entity.pos && entity.color && entity.size)) {
        //    console.log("UKSDFHSDF");
        //    return squished;
       // }
        // 1 (type) + 1 (size) + (color ? 4 : 0)
        
        const squishedSize = 1 + 1 + (entity.color ? 4 : 0);
        console.log("SQUISHED SIZE");
        console.log(squishedSize);

        let squishedPieces = [];

        for (const key in squishSpec) {
            if (key in entity) {
                const attr = entity[key];
                const squished = squishSpec[key].squish(attr);
                squishedPieces.push([squishSpec[key]['type'], squished.length + 2, ...squished]);
            } 
        }

        const squished = squishedPieces.flat();
        return [3, squished.length + 2, ...squished];
        //cionst squished = new Array(squishedSize);
//        
//        squished[squishedIndex++] = entity.color[0];
//        squished[squishedIndex++] = entity.color[1];
//        squished[squishedIndex++] = entity.color[2];
//        squished[squishedIndex++] = entity.color[3];
//
//        squished[squishedIndex++] = Math.floor(entity.pos.x);
//        squished[squishedIndex++] = Math.floor(100 * (entity.pos.x - Math.floor(entity.pos.x)));
//
//        squished[squishedIndex++] = Math.floor(entity.pos.y);
//        squished[squishedIndex++] = Math.floor( 100 * (entity.pos.y - Math.floor(entity.pos.y)));
//
//        squished[squishedIndex++] = Math.floor(entity.size.x);
//        squished[squishedIndex++] = Math.floor(100 * (entity.size.x - Math.floor(entity.size.x)));
//
//        squished[squishedIndex++] = Math.floor(entity.size.y);
//        squished[squishedIndex++] = Math.floor(100 * (entity.size.y - Math.floor(entity.size.y)));
//
//        if (entity.text) {
//            squished[squishedIndex++] = entity.text && entity.text.x;
//            squished[squishedIndex++] = entity.text && entity.text.y;
//            squished[squishedIndex++] = entity.text.size || 12;
//
//            let textIndex = 0;
//            while (entity.text && textIndex < 32) {
//                if (textIndex < entity.text.text.length) {
//                    squished[squishedIndex++] = entity.text.text.charCodeAt(textIndex);
//                } else {
//                    squished[squishedIndex++] = null;
//                }
//                textIndex++;
//            }
//        }
//        
//        if (entity.assets) {
//            for (const key in entity.assets) {
//                const asset = entity.assets[key];
//                squished[squishedIndex++] = asset.pos.x;
//                squished[squishedIndex++] = asset.pos.y;
//                squished[squishedIndex++] = asset.size.x;
//                squished[squishedIndex++] = asset.size.y;
//                for (let i = 0; i < 32; i++) {
//                    if (i < key.length) {
//                        squished[squishedIndex++] = key.charCodeAt(i);
//                    } else {
//                        squished[squishedIndex++] = null;
//                    }
//                }
//            }
//        }
//
        return squished;

    }

    handleStateChange(node) {
        this.update(this.game.getRoot());
        for (const listener of this.listeners) {
            listener.handleSquisherUpdate(this.squished);
        }
    }
}

const { fork } = require("child_process");
const path = require("path");

const games = require("./src/games");

const config = require("./config");

const sessions = {};

for (let i = config.GAME_SERVER_PORT_RANGE_MIN; i < config.GAME_SERVER_PORT_RANGE_MAX; i++) {
    sessions[i] = null;
}

const getServerPort = () => {
    for (const p in sessions) {
        if (!sessions[p]) {
            return Number(p);
        }
    }
};

let sessionIdCounter = 1;

class HomegamesDashboard extends Game {
    static metadata() {
        return {
            res: {
                width: 1280,
                height: 720
            },
            author: "Joseph Garcia"
        };
    }

    constructor() {
        super();
        this.assets = {};
        this.playerNodes = {};
        this.playerEditStates = {};
        this.keyCoolDowns = {};
        this.modals = {};
        Object.keys(games).filter(k => games[k].metadata && games[k].metadata().thumbnail).forEach(key => {
            this.assets[key] = new Asset("url", {
                "location": games[key].metadata && games[key].metadata().thumbnail,
                "type": "image"
            });
        });

        this.assets['default'] = new Asset("url", {
            "location": config.DEFAULT_GAME_THUMBNAIL,
            "type": "image"
        });

        this.base = gameNode(Colors.CREAM, null, {x: 0, y: 0}, {x: 100, y: 100});
        this.sessions = {};
        this.gameIds = {};
        this.requestCallbacks = {};
        this.requestIdCounter = 1;
        setInterval(this.heartbeat.bind(this), config.CHILD_SESSION_HEARTBEAT_INTERVAL);

        this.renderGameList();
    }

    heartbeat() {
        Object.values(this.sessions).forEach(session => {
            session.sendHeartbeat();
        });
    }

    joinSession(player, session) {
        player.receiveUpdate([5, Math.floor(session.port / 100), Math.floor(session.port % 100)]);
//            for (const sessionIndex in activeSessions) {
//                const session = activeSessions[sessionIndex];
//                const sessionNode = gameNode(Colors.BLUE, (player) => {
//                    player.receiveUpdate([5, Math.floor(session.port / 100), Math.floor(session.port % 100)]);
//                }, {x: xIndex + 3, y: 25 + (sessionIndex * 6)}, {x: 5, y: 5}, {"text": "session", x: xIndex + 3, y: 25 + (sessionIndex * 6)});
//                this.base.addChild(sessionNode);
//            }


    }

    startSession(player, gameKey) { 
        const sessionId = sessionIdCounter++;
        const port = getServerPort();

        const childSession = fork(path.join(__dirname, "src/child_game_server.js"));

        sessions[port] = childSession;

        childSession.send(JSON.stringify({
            key: gameKey,
            port,
            player: {
                id: player.id,
                name: player.name
            }
        }));

        childSession.on("message", (thang) => {
            const jsonMessage = JSON.parse(thang);
            if (jsonMessage.success) {
                player.receiveUpdate([5, Math.floor(port / 100), Math.floor(port % 100)]);
            }
            else if (jsonMessage.requestId) {
                this.requestCallbacks[jsonMessage.requestId] && this.requestCallbacks[jsonMessage.requestId](jsonMessage.payload);
            }
        });

        childSession.on("close", () => {
            sessions[port] = null;
            delete this.sessions[sessionId];
            this.renderGameList();  
        });
        
        this.sessions[sessionId] = {
            game: gameKey,
            port: port,
            sendMessage: () => {
            },
            getPlayers: (cb) => {
                const requestId = this.requestIdCounter++;
                if (cb) {
                    this.requestCallbacks[requestId] = cb;
                }
                childSession.send(JSON.stringify({
                    "api": "getPlayers",
                    "requestId": requestId
                }));
            },
            sendHeartbeat: () => {
                childSession.send(JSON.stringify({
                    "type": "heartbeat"
                }));
            }
        };
         
        this.renderGameList();
    }
    
    renderGameList() {
        let xIndex = 5;
        let yIndex = 10;
        this.base.clearChildren();
        for (const key in games) {
            const activeSessions = Object.values(this.sessions).filter(s => s.game === key);

            const assetKey = games[key].metadata && games[key].metadata().thumbnail ? key : 'default';
            const gameOption = gameNode(Colors.CREAM, (player) => {

                const gameInfoModal = gameNode(Colors.ORANGE, (player) => {
                
                }, {x: 5, y: 5}, {x: 90, y: 90}, {text: key, x: 50, y: 10, size: 20}, null, player.id);
                
                const playButton = gameNode(Colors.GREEN, (player) => {
                
                    this.startSession(player, key);
                
                }, {x: 42.5, y: 25}, {x: 15, y: 10}, {text: "Create Session", x: 50, y: 29, size: 18}, null, player.id);
                
                const otherSessionsText = activeSessions.length > 0 ? 'or join an existing session' : 'No current sessions';

                const orText = gameNode(Colors.ORANGE, null, {x: 45, y: 35}, {x: 0, x: 0}, {x: 50, y: 40, text: otherSessionsText, size: 18}, null, player.id);
                gameInfoModal.addChild(orText);
                gameInfoModal.addChild(playButton);

                let sessionOptionXIndex = 20;
                let sessionOptionYIndex = 50;
                activeSessions.forEach(s => {
                    const sessionOption = gameNode(Colors.WHITE, (player) => {
                        this.joinSession(player, s);
                    }, {x: sessionOptionXIndex, y: sessionOptionYIndex}, {x: 10, y: 10}, {text: "Session", x: sessionOptionXIndex + 3, y: sessionOptionYIndex + 3}, null, player.id);
                    gameInfoModal.addChild(sessionOption);
                    sessionOptionXIndex += 15;

                    if (sessionOptionXIndex >= 100) {
                        sessionOptionXIndex = 20;
                        sessionYOptionIndex += 15;
                    }
                });
                
                const closeModalButton = gameNode(Colors.ORANGE, (player) => {
                
                    delete this.modals[player.id];
                    
                    this.base.removeChild(gameInfoModal.id);
                
                }, {x: 6, y: 7}, {x: 4, y: 8}, {text: "X", x: 8, y: 8, size: 60}, null, player.id);
                
                this.modals[player.id] = gameInfoModal;
                
                gameInfoModal.addChild(closeModalButton);
                
                this.base.addChild(gameInfoModal);

            }, {x: xIndex, y: yIndex}, {x: 10, y: 10}, {"text": (games[key].metadata && games[key].metadata().name || key) + "", x: xIndex + 5, y: yIndex + 12}, {
                [assetKey]: {
                    pos: {x: xIndex, y: yIndex},
                    size: {x: 10, y: 10}
                }
            });

            const authorInfoNode = gameNode(Colors.CREAM, null, {
                x: xIndex + 5, 
                y: yIndex + 15
            },
            {
                x: 10,
                y: 10
            },
            {
                text: "by " + (games[key].metadata && games[key].metadata()["author"] || "Unknown Author"),
                x: xIndex + 5,
                y: yIndex + 15
            });

            xIndex += 15;

            if (xIndex + 10 >= 100) {
                yIndex += 25;
                xIndex = 5;
            }

            this.base.addChild(gameOption);
            this.base.addChild(authorInfoNode);
        }
    }

    isText(key) {
        return key.length == 1 && (key >= "A" && key <= "Z") || (key >= "a" && key <= "z") || key === " " || key === "Backspace";
    }

    handleKeyDown(player, key) {
        if (!this.playerEditStates[player.id] || !this.isText(key)) {
            return;
        }

        if (!this.keyCoolDowns[player.id] || !this.keyCoolDowns[player.id][key]) {
            const newText = this.playerNodes[player.id].text;
            if (newText.text.length > 0 && key === "Backspace") {
                newText.text = newText.text.substring(0, newText.text.length - 1); 
            } else if(key !== "Backspace") {
                newText.text = newText.text + key;
            }
            this.playerNodes[player.id].text = newText;
            this.keyCoolDowns[player.id][key] = setTimeout(() => {
                clearTimeout(this.keyCoolDowns[player.id][key]);
                delete this.keyCoolDowns[player.id][key];
            }, 200);
        }
    }

    handleKeyUp(player, key) {
        if (this.keyCoolDowns[player.id][key]) {
            clearTimeout(this.keyCoolDowns[player.id][key]);
            delete this.keyCoolDowns[player.id][key];
        }
    }

    handleNewPlayer(player) {
        this.keyCoolDowns[player.id] = {};
        const playerNameNode = gameNode(Colors.CREAM, (player) => {
            this.playerEditStates[player.id] = !this.playerEditStates[player.id];
            playerNameNode.color = this.playerEditStates[player.id] ? Colors.WHITE : Colors.CREAM;
            if (!this.playerEditStates[player.id]) {
                player.name = this.playerNodes[player.id].text.text;
            }
        }, {x: 2, y: 2}, {x: 5, y: 5}, {text: player.name, x: 5, y: 5}, null, player.id);
        this.playerNodes[player.id] = playerNameNode;
        this.base.addChild(playerNameNode);
    }

    handlePlayerDisconnect(playerId) {
        delete this.keyCoolDowns[playerId];

        if (this.playerNodes[playerId]) {
            this.base.removeChild(this.playerNodes[playerId].id);
            delete this.playerNodes[playerId];
        }
        if (this.modals[playerId]) {
            this.base.removeChild(this.modals[playerId].id);
            delete this.modals[playerId];
        }
    }

    getRoot() {
        return this.base;
    }

    getAssets() {
        return this.assets;
    }
}

class GameSession {
    constructor(squisher) {
        this.game = squisher.game;
        this.squisher = squisher;
        this.squisher.addListener(this);
    }

    handleSquisherUpdate(squished) {
        for (const playerId in this.game.players) {
            this.game.players[playerId].receiveUpdate(squished);
        }
    }

    addPlayer(player) {
        this.squisher.assetBundle && player.receiveUpdate(this.squisher.assetBundle);
        player.receiveUpdate(this.squisher.squished);
        this.game.addPlayer(player);
    }

    handlePlayerDisconnect(player) {
    }

    initialize(cb) {
        if (this.initialized) {
            cb && cb();
        } else {
            this.squisher.initialize().then(() => {
                this.initialized = true;
                cb && cb();
            });
        }
    }
    
}

//const thang = new HomegamesDashboard();

//const squisher = new Squisher(thang);

//const session = new GameSession(squisher);

//session.initialize(() => {
//    socketServer(session, 7000);
//})
//
const testOne = () => {
    const squisher = new Squisher(); 
    const initialGameNode = gameNode(Colors.RED, null, {x: 20.42, y: 20.52});

    let squished = squisher.squish(initialGameNode);

    assert(squished.length == squished[1]);

    const unsquished = squisher.unsquish(squished);
    
    for (const key in initialGameNode) {
        if (key == 'handleClick' || key == 'children' || key == 'listeners') {
            continue;
        }
        try {
            if (initialGameNode[key] === undefined) {
                assert(unsquished[key] === undefined);
                continue;
            }
            if (Array.isArray(initialGameNode[key])) {
                const l1 = initialGameNode[key];
                const l2 = unsquished[key];
                for (let i = 0; i < l1.length; i++) {
                    assert(l1[i] === l2[i]);
                }
            } else if (initialGameNode[key].constructor === Object) {
                for (const k in initialGameNode[key]) {
                    assert(initialGameNode[key][k] === unsquished[key][k]);
                }
            } else {
                assert(initialGameNode[key] === unsquished[key]);
            }
        } catch (err) {
            console.error("Failed: " + key);
        }
    }
};

testOne();
