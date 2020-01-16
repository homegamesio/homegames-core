// copied stuff
let id = 0;

class GameNode {
    constructor(color, onClick, pos, size, text, asset, playerId = 0) {
        this.id = id++;
        this.children = new Array();
        this.color = color;
        this.handleClick = onClick;
        this.pos = pos;
        this.size = size;
        this.text = text;
        this.asset = asset;
        this.listeners = new Set();
        this.playerId = Number(playerId);
    }

    addChild(node) {
        this.children.push(node);
        this.onStateChange();
    }

    removeChild(nodeId) {
        const removeIndex = this.children.findIndex(child => child.id == nodeId);
        removeIndex >= 0 && this.children.splice(removeIndex, 1);
        // hack to invoke update listener
        this.id = this.id;
    }

    addListener(listener) {
        this.listeners.add(listener);
    }

    onStateChange() {
        for (const listener of this.listeners) {
            listener.handleStateChange(this);
        }
    }

    clearChildren(excludedNodeIds) {
        if (!excludedNodeIds) {
            this.children = new Array();
        } else {
            const newChildren = this.children.filter(child => {
                return excludedNodeIds.includes(child.id);
            });
            this.children = newChildren;
        }
    }
}

const gameNode = (color, onClick, pos, size, text, asset, playerId) => {
    const node = new GameNode(color, onClick, pos, size, text, asset, playerId);
    return node;//, node.onStateChange.bind(node));
};

const ASSET_TYPE = 1;

const COLOR_SUBTYPE = 42;
const ID_SUBTYPE = 43;
const PLAYER_ID_SUBTYPE = 44;
const POS_SUBTYPE = 45;
const SIZE_SUBTYPE = 46;
const TEXT_SUBTYPE = 47;
const ASSET_SUBTYPE = 48;

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
    },
    size: {
        type: SIZE_SUBTYPE,
        squish: (s) => {
            return [Math.floor(s.x), Math.round(100 * (s.x - Math.floor(s.x))), Math.floor(s.y), Math.round(100 * (s.y - Math.floor(s.y)))] 
        },
        unsquish: (squished) => {
            return {
                x: squished[0] + squished[1] / 100,
                y: squished[2] + squished[3] / 100
            }
        }
    }, 
    text: {
        type: TEXT_SUBTYPE,
        squish: (t) => {
            const squishedText = new Array(t.text.length + 6);
            console.log("AY AY");
            console.log(t);
            squishedText[0] = Math.floor(t.x);
            squishedText[1] = Math.round(100 * (t.x - Math.floor(t.x)));

            squishedText[2] = Math.floor(t.y);
            squishedText[3] = Math.round(100 * (t.y - Math.floor(t.y)));
            
            const textSize = t.size || 12;
            squishedText[4] = Math.floor(textSize);
            squishedText[5] = Math.round(100 * (textSize - Math.floor(textSize)));

            for (let i = 0; i < t.text.length; i++) {
                squishedText[6 + i] = t.text.charCodeAt(i);
            }

            return squishedText;
        }, 
        unsquish: (squished) => {
            const textPosX = squished[0] + squished[1] / 100;
            const textPosY = squished[2] + squished[3] / 100;
            const textSize = squished[4] + squished[5] / 100;

            const text = String.fromCharCode.apply(null, squished.slice(6));

            return {
                pos: {
                    x: textPosX,
                    y: textPosY
                },
                text: text,
                size: textSize
            };
        }
    },
    asset: {
        type: ASSET_SUBTYPE,
        squish: (a) => {
            const assetKey = Object.keys(a)[0];
            const squishedAssets = new Array(8 + assetKey.length);
            
            squishedAssets[0] = Math.floor(a[assetKey].pos.x);
            squishedAssets[1] = Math.round(100 * (a[assetKey].pos.x - Math.floor(a[assetKey].pos.x)));

            squishedAssets[2] = Math.floor(a[assetKey].pos.y);
            squishedAssets[3] = Math.round(100 * (a[assetKey].pos.y - Math.floor(a[assetKey].pos.y)));

            squishedAssets[4] = Math.floor(a[assetKey].size.x);
            squishedAssets[5] = Math.round(100 * (a[assetKey].size.x - Math.floor(a[assetKey].size.x)));

            squishedAssets[6] = Math.floor(a[assetKey].size.y);
            squishedAssets[7] = Math.round(100 * (a[assetKey].size.y - Math.floor(a[assetKey].size.y)));

            for (let i = 0; i < assetKey.length; i++) {
                squishedAssets[8 + i] = assetKey.charCodeAt(i);
            }
            
            return squishedAssets;
        }, 
        unsquish: (squished) => {
            const assetPosX = squished[0] + squished[1] / 100;
            const assetPosY = squished[2] + squished[3] / 100;

            const assetSizeX = squished[4] + squished[5] / 100;
            const assetSizeY = squished[6] + squished[7] / 100;

            const assetKey = String.fromCharCode.apply(null, squished.slice(8));
            return {
                [assetKey]: {
                    pos: {
                        x: assetPosX,
                        y: assetPosY
                    },
                    size: {
                        x: assetSizeX,
                        y: assetSizeY
                    }
                }
            }
        }
    }
};

const squishSpecKeys = [
    'id', 
    'color', 
    'playerId', 
    'pos', 
    'size', 
    'text', 
    'asset' 
];

const typeToSquishMap = {};

for (const key in squishSpec) {
    typeToSquishMap[Number(squishSpec[key]['type'])] = key;
}

const unsquish = (squished) => {
        let squishedIndex = 2;

        let constructedGameNode = gameNode();

        while(squishedIndex < squished.length) {

            const subFrameType = squished[squishedIndex];
            const subFrameLength = squished[squishedIndex + 1];
            const subFrame = squished.slice(squishedIndex + 2, squishedIndex + subFrameLength);

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
        
        return constructedGameNode;
    }

const squish = (entity) => {
        let squishedPieces = [];

        for (const keyIndex in squishSpecKeys) {
            const key = squishSpecKeys[keyIndex];
            if (key in entity) {
                const attr = entity[key];
                if (attr !== undefined) {
                    const squished = squishSpec[key].squish(attr);
                    squishedPieces.push([squishSpec[key]['type'], squished.length + 2, ...squished]);
                }
            } 
        }

        const squished = squishedPieces.flat();
        return [3, squished.length + 2, ...squished];

}

// end of copied stuff

const hostname = window.location.hostname;

let socket;

let gamepad;
let moving;

let horizontalScale = 1;
let verticalScale = 1;
let scaleFactor = 1;

window.playerId = null;

let mouseDown = false;
const keysDown = {};

let audioCtx, source;

const gameAssets = {};
const imageCache = {};

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

let currentBuf;
let rendering = false;

const initSocket = (port) => {
    socket && socket.close();
    socket = new WebSocket("ws://" + hostname + ":" + port);

    socket.binaryType = "arraybuffer";

    socket.onopen = () => {
        socket.send(JSON.stringify({
            type: "ready",
            id: window.playerId || null
        }));
    };

    socket.onerror = (err) => {
        console.log("ERROR");
        console.log(err);
    };

    socket.onclose = () => {
    };

    socket.onmessage = function(msg) {
        console.log("GOT MESSAGE");
        console.log(msg);
        currentBuf = new Uint8ClampedArray(msg.data);
        if (currentBuf[0] == 2) {
            window.playerId = currentBuf[1];
            let gameWidth1 = String(currentBuf[2]);
            let gameWidth2 = String(currentBuf[3]).length > 1 ? currentBuf[3] : "0" + currentBuf[3];

            let gameHeight1 = String(currentBuf[4]);
            let gameHeight2 = String(currentBuf[5]);//.length > 1 ? currentBuf[5] : '0' + currentBuf[5];
            initCanvas(Number(gameWidth1 + gameWidth2), Number(gameHeight1 + gameHeight2));
        } else if (currentBuf[0] == 1) {
            console.log("STORING ASSETS");
            storeAssets(currentBuf);
        } else if (currentBuf[0] === 5) {
            let a = String(currentBuf[1]);
            let b = String(currentBuf[2]).length > 1 ? currentBuf[2] : "0" + currentBuf[2];
            let newPort = a + b;
            initSocket(Number(newPort).toString());
        } else if (currentBuf[0] == 3) {
            currentBuf && currentBuf.length > 1 && currentBuf[0] == 3 && renderBuf(currentBuf);
        }
    };
};

const initCanvas = (gameWidth, gameHeight) => {
    let windowWidth = window.innerWidth;
    window.gameWidth = gameWidth;
    window.gameHeight = gameHeight;
    
    scaleFactor = Math.floor(windowWidth / gameWidth) || windowWidth / gameWidth;

    horizontalScale = gameWidth * scaleFactor;
    verticalScale = gameHeight * scaleFactor;

    canvas.height = verticalScale;
    canvas.width = horizontalScale;
};

initCanvas(DEFAULT_WIDTH, DEFAULT_HEIGHT);
initSocket(7000);

const storeAssets = (buf) => {
    let i = 0;

    while (buf && i < buf.length) {
        const frameType = buf[i];

        if (frameType === 1) {
            const assetType = buf[i + 1];
            // image
            if (assetType === 1) {
                const payloadLengthBase32 = String.fromCharCode.apply(null, buf.slice(i + 2, i + 6));
                const payloadLength = parseInt(payloadLengthBase32, 36);

                const payloadKeyRaw = buf.slice(i + 6, i + 6 + 32);
                const payloadData = buf.slice(i + 6 + 32, i + 6 +  payloadLength);
                const payloadKey = String.fromCharCode.apply(null, payloadKeyRaw.filter(k => k)); 
                let imgBase64String = "";
                for (let i = 0; i < payloadData.length; i++) {
                    imgBase64String += String.fromCharCode(payloadData[i]);
                }
                const imgBase64 = btoa(imgBase64String);
                gameAssets[payloadKey] = {"type": "image", "data": "data:image/jpeg;base64," + imgBase64};
                i += 6 + payloadLength;
            } else {
                // audio
                const payloadLengthBase32 = String.fromCharCode.apply(null, buf.slice(i + 2, i + 6));
                const payloadLength = parseInt(payloadLengthBase32, 36);
                const payloadKeyRaw = buf.slice(i + 6, i + 6 + 32);
                const payloadData = buf.slice(i + 6 + 32, i + 6 +  payloadLength);
                const payloadKey = String.fromCharCode.apply(null, payloadKeyRaw.filter(k => k)); 
                if (!audioCtx) {
                    gameAssets[payloadKey] = {"type": "audio", "data": payloadData.buffer, "decoded": false};
                } else {
                    audioCtx.decodeAudioData(payloadData.buffer, (buffer) => {
                        gameAssets[payloadKey] = {"type": "audio", "data": buffer, "decoded": true};
                    });
                }

                i += 6 + payloadLength;
            }
        }
    }
}

function renderBuf(buf) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let color, startX, startY, width, height;
    let i = 0;
    let its = 0;
    
    while (buf && i < buf.length) {
        its += 1;

        if (its > 5) {
            break;
        }
        const frameType = buf[i];

        const playerId = 0;//buf[i + 1];
        const frameSize = buf[i + 1];

        let bufIndex = i + 2;
        let thing = unsquish(buf.slice(i, i + frameSize));
//        while (bufIndex < frameSize) {
//            const miniFrameType = buf[bufIndex];
//            const miniFrameSize = buf[bufIndex + 1];
//            if (miniFrameType == 43) {
//                console.log("ID");
//                console.log(buf[bufIndex + 2]);
//            }
//            bufIndex += miniFrameSize;
//        }
        console.log(thing);

        i += frameSize;

        continue;
       // if (playerId !== 0 && playerId !== window.playerId) {
       //     console.log(playerId);
       //     console.log("THIS ONE?");
       //     i += frameSize;
       //     continue;
       // }
        const start = i + 2;
        color = buf.slice(start, start + 4);
        startX = ((buf[start + 4] / 100) + (buf[start + 5] / 10000)) * horizontalScale;
        startY = ((buf[start + 6] / 100) + (buf[start + 7] / 10000)) * verticalScale;
        width = ((buf[start + 8] / 100) + (buf[start + 9] / 10000)) * horizontalScale;
        height = ((buf[start + 10] / 100) + (buf[start + 11] / 10000)) * verticalScale;
        ctx.fillStyle = "rgba(" + color[0] + "," + color[1] + "," + color[2] + "," + color[3] + ")";
        ctx.fillRect(startX, startY, width, height);
        
        // has text
        if (frameSize > 15) {
            const textX = (buf[start + 12] / 100) * horizontalScale;
            const textY = (buf[start + 13] / 100) * verticalScale;
            const textSize = buf[start + 14];
            const textArray = buf.slice(start + 15, start + 15 + 32);
            const textStripped = textArray.filter(x => x);
            const text = String.fromCharCode.apply(null, textStripped);
            if (text) {
                // todo: encode this in the payload
                ctx.fillStyle = "black";
                let fontSize = textSize * scaleFactor;
                ctx.font = fontSize + "px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillText(text, textX, textY);
            }
        }

        if (frameSize > 1 + 3 + 46) { 
            const assetPosX = buf[start + 47];
            const assetPosY = buf[start + 48];
            
            const assetSizeX = buf[start + 49];
            const assetSizeY = buf[start + 50];

            const assetKeyArray = buf.slice(start + 51, start + 51 + 32);
            const assetKey = String.fromCharCode.apply(null, assetKeyArray.filter(x => x));
            
            if (gameAssets[assetKey] && gameAssets[assetKey]["type"] === "audio") {
                if (audioCtx) {
                    source = audioCtx.createBufferSource();
                    source.connect(audioCtx.destination);
                    source.buffer = gameAssets[assetKey].data;
                    source.start(0);
                } else {
                    console.warn("Cant play audio");
                }
            } else {
                let image;
                if (imageCache[assetKey]) {
                    image = imageCache[assetKey];
                    ctx.drawImage(image, (assetPosX / 100) * horizontalScale, 
                        (assetPosY / 100) * verticalScale, image.width, image.height);
                } else {
                    image = new Image(assetSizeX / 100 * horizontalScale, assetSizeY / 100 * verticalScale);
                    imageCache[assetKey] = image;
                    image.onload = () => {
                        ctx.drawImage(image, (assetPosX / 100) * horizontalScale, 
                            (assetPosY / 100) * verticalScale, image.width, image.height);
                    };

                    if (gameAssets[assetKey]) {
                        image.src = gameAssets[assetKey].data;
                    }
                }
            }
        }

        console.log("increasing");
        console.log(frameSize);
        i += frameSize;
    }
}

function req() {
    console.log(currentBuf);
    currentBuf && currentBuf.length > 1 && currentBuf[0] == 3 && renderBuf(currentBuf);

    //window.requestAnimationFrame(req);
}

const click = function(x, y) {
    if (socket) {
        const pixelWidth = canvas.width / window.gameWidth;
        const pixelHeight = canvas.height / window.gameHeight;
        const clickX = Math.floor((x + window.scrollX) / pixelWidth);
        const clickY = Math.floor((y + window.scrollY) / pixelHeight);
        const payload = {type: "click",  data: {x: clickX, y: clickY}};
        socket.readyState === 1 && socket.send(JSON.stringify(payload));
    }
};

const keydown = function(key) {
    if (socket) {
        const payload = {type: "keydown",  key: key};
        socket.readyState === 1 && socket.send(JSON.stringify(payload));
    }
};

const keyup = function(key) {
    if (socket) {
        const payload = {type: "keyup",  key: key};
        socket.readyState === 1 && socket.send(JSON.stringify(payload));
    }
};

const unlock = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)(); 
        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }
        for (const key in gameAssets) {
            if (gameAssets[key]["type"] === "audio" && !gameAssets[key]["decoded"]) {
                audioCtx.decodeAudioData(gameAssets[key].data, (buffer) => {
                    gameAssets[key].data = buffer;
                    gameAssets[key].decoded = true;
                });
            }
        }
    }
};

document.addEventListener("touchstart", unlock, false);

canvas.addEventListener("mousedown", function() {
    mouseDown = true;
    unlock();
});

canvas.addEventListener("mouseup", function(e) {
    click(e.clientX, e.clientY);
    mouseDown = false;
});

canvas.addEventListener("mousemove", function(e) {
    if (mouseDown) {
        click(e.clientX, e.clientY);
    }
});

canvas.addEventListener("touchstart", function(e) {
    e.preventDefault();
    click(e.touches["0"].clientX, e.touches["0"].clientY);
});

canvas.addEventListener("touchmove", function(e) {
    e.preventDefault();
    click(e.touches["0"].clientX, e.touches["0"].clientY);
});

function keyMatters(event) {
    // Key code values 36-40 are the arrow keys
    return event.key.length == 1 && event.key >= " " && event.key <= "z" || event.keyCode >= 36 && event.keyCode <= 40 || event.key === "Meta" || event.key == "Backspace";
}

function isMobile() {
    return /Android/i.test(navigator.userAgent);
}

if (isMobile()) {
    document.getElementById("text-hack").addEventListener("input", (e) => {
        let eventKey = e.data ? e.data.charAt(e.data.length - 1) : "Backspace";
        e.key = eventKey;
        if (keyMatters(e) && !keysDown["Meta"]) {
            e.preventDefault && e.preventDefault();
            keydown(e.key);
        }
    });
} else {
    document.addEventListener("keydown", function(e) {
        if (keyMatters(e) && !keysDown["Meta"]) {
            e.preventDefault();
            keydown(e.key);
            keysDown[e.key] = true;
        }
    });
    document.addEventListener("keyup", function(e) {
        if (keyMatters(e)) {
            e.preventDefault();
            keyup(e.key);
            keysDown[e.key] = false;
        }
    });
}

window.addEventListener('resize', () => {
    initCanvas(window.gameWidth, window.gameHeight);
});
