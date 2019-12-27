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

const initSocket = (port) => {
    socket && socket.close();
    socket = new WebSocket("ws://" + hostname + ":" + port);

    socket.binaryType = "arraybuffer";

    socket.onopen = () => {
        socket.send("ready");
        window.requestAnimationFrame(req);
    };

    socket.onerror = (err) => {
        console.log("ERROR");
        console.log(err);
    };

    socket.onclose = () => {
    };

    socket.onmessage = function(msg) {
        currentBuf = new Uint8ClampedArray(msg.data);
        if (currentBuf[0] == 2) {
            window.playerId = currentBuf[1];
            let gameWidth1 = String(currentBuf[2]);
            let gameWidth2 = String(currentBuf[3]).length > 1 ? currentBuf[3] : "0" + currentBuf[3];

            let gameHeight1 = String(currentBuf[4]);
            let gameHeight2 = String(currentBuf[5]);//.length > 1 ? currentBuf[5] : '0' + currentBuf[5];
            initCanvas(Number(gameWidth1 + gameWidth2), Number(gameHeight1 + gameHeight2));
        } else if (currentBuf[0] === 5) {
            let a = String(currentBuf[1]);
            let b = String(currentBuf[2]).length > 1 ? currentBuf[2] : "0" + currentBuf[2];
            let newPort = a + b;
            initSocket(Number(newPort).toString());
        } else {
            renderBuf(currentBuf);
        }
    };
};

const initCanvas = (gameWidth, gameHeight) => {
    let windowWidth = window.innerWidth;
    window.gameWidth = gameWidth;
    window.gameHeight = gameHeight;
    
    scaleFactor = Math.floor(windowWidth / gameWidth) || Math.floor(gameWidth / windowWidth);

    horizontalScale = gameWidth * scaleFactor;
    verticalScale = gameHeight * scaleFactor;

    canvas.height = verticalScale;
    canvas.width = horizontalScale;
};

initCanvas(DEFAULT_WIDTH, DEFAULT_HEIGHT);
initSocket(7000);

function renderBuf(buf) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let color, startX, startY, width, height;
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
        } else {
            const playerId = buf[i + 1];
            const frameSize = buf[i + 2];
            if (playerId !== 0 && playerId !== window.playerId) {
                i += frameSize;
                continue;
            }
            const start = i + 3;
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
                const textArray = buf.slice(start + 14, start + 14 + 32);
                const textStripped = textArray.filter(x => x);
                const text = String.fromCharCode.apply(null, textStripped);
                if (text) {
                    // todo: encode this in the payload
                    ctx.fillStyle = "black";
                    let fontSize = 14 * scaleFactor;
                    ctx.font = fontSize + "px sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "top";
                    ctx.fillText(text, textX, textY);
                }
            }

            if (frameSize > 3 + 46) { 
                const assetPosX = buf[start + 46];
                const assetPosY = buf[start + 47];
                
                const assetSizeX = buf[start + 48];
                const assetSizeY = buf[start + 49];

                const assetKeyArray = buf.slice(start + 50, start + 50 + 32);
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

            i += frameSize;

        }
    }
}

function req() {
    gamepad=navigator.getGamepads()[0]; 
    moving = false;
    if (gamepad) {
        // left stick x
        if (gamepad.axes[2] > 0.2) {
            moving = true;
            keydown("ArrowRight");
            keysDown["ArrowRight"] = true;

            if (keysDown["ArrowLeft"]) {
                keyup("ArrowLeft");
                keysDown["ArrowLeft"] = false;
            }

            if (keysDown["ArrowUp"]) {
                keyup("ArrowUp");
                keysDown["ArrowUp"] = false;
            }

            if (keysDown["ArrowDown"]) {
                keyup("ArrowDown");
                keysDown["ArrowDown"] = false;
            }
        } if (gamepad.axes[2] < -0.2) {
            moving = true;
            keydown("ArrowLeft");
            keysDown["ArrowLeft"] = true;

            if (keysDown["ArrowRight"]) {
                keyup("ArrowRight");
                keysDown["ArrowRight"] = false;
            }

            if (keysDown["ArrowUp"]) {
                keyup("ArrowUp");
                keysDown["ArrowUp"] = false;
            }

            if (keysDown["ArrowDown"]) {
                keyup("ArrowDown");
                keysDown["ArrowDown"] = false;
            }
        } if (gamepad.axes[3] > 0.2) {
            moving = true;
            keydown("ArrowDown");
            keysDown["ArrowDown"] = true;

            if (keysDown["ArrowLeft"]) {
                keyup("ArrowLeft");
                keysDown["ArrowLeft"] = false;
            }

            if (keysDown["ArrowRight"]) {
                keyup("ArrowRight");
                keysDown["ArrowRight"] = false;
            }

            if (keysDown["ArrowUp"]) {
                keyup("ArrowUp");
                keysDown["ArrowUp"] = false;
            }
        } if (gamepad.axes[3] < -0.2) {
            moving = true;
            keydown("ArrowUp");
            keysDown["ArrowUp"] = true;

            if (keysDown["ArrowLeft"]) {
                keyup("ArrowLeft");
                keysDown["ArrowLeft"] = false;
            }

            if (keysDown["ArrowDown"]) {
                keyup("ArrowDown");
                keysDown["ArrowDown"] = false;
            }

            if (keysDown["ArrowRight"]) {
                keyup("ArrowRight");
                keysDown["ArrowRight"] = false;
            }
        } 

        // right stick x
        if (gamepad.axes[0] > 0.2) {
            moving = true;
            keydown("d");
            keysDown["d"] = true;

            if (keysDown["a"]) {
                keyup("a");
                keysDown["a"] = false;
            }

            if (keysDown["w"]) {
                keyup("w");
                keysDown["w"] = false;
            }

            if (keysDown["s"]) {
                keyup("s");
                keysDown["s"] = false;
            }
        } if (gamepad.axes[0] < -0.2) {
            moving = true;
            keydown("a");
            keysDown["a"] = true;

            if (keysDown["d"]) {
                keyup("d");
                keysDown["d"] = false;
            }

            if (keysDown["w"]) {
                keyup("w");
                keysDown["w"] = false;
            }

            if (keysDown["s"]) {
                keyup("s");
                keysDown["s"] = false;
            }
        } if (gamepad.axes[1] > 0.2) {
            moving = true;
            keydown("s");
            keysDown["s"] = true;

            if (keysDown["a"]) {
                keyup("a");
                keysDown["a"] = false;
            }

            if (keysDown["d"]) {
                keyup("d");
                keysDown["d"] = false;
            }

            if (keysDown["w"]) {
                keyup("w");
                keysDown["w"] = false;
            }
        } if (gamepad.axes[1] < -0.2) {
            moving = true;
            keydown("w");
            keysDown["w"] = true;

            if (keysDown["a"]) {
                keyup("a");
                keysDown["a"] = false;
            }

            if (keysDown["s"]) {
                keyup("s");
                keysDown["s"] = false;
            }

            if (keysDown["d"]) {
                keyup("d");
                keysDown["d"] = false;
            }
        } 

    } else {
        for (let key in keysDown) {
            if (keysDown[key]) {
                keydown(key);
                moving = true;
            }
        }
    }
        
    if (!moving) {
        if (keysDown["ArrowLeft"]) {
            keyup("ArrowLeft");
            keysDown["ArrowLeft"] = false;
        }

        if (keysDown["ArrowUp"]) {
            keyup("ArrowUp");
            keysDown["ArrowUp"] = false;
        }

        if (keysDown["ArrowDown"]) {
            keyup("ArrowDown");
            keysDown["ArrowDown"] = false;
        }

        if (keysDown["ArrowRight"]) {
            keyup("ArrowRight");
            keysDown["ArrowRight"] = false;
        }

        if (keysDown["w"]) {
            keyup("w");
            keysDown["w"] = false;
        }

        if (keysDown["a"]) {
            keyup("a");
            keysDown["a"] = false;
        }

        if (keysDown["s"]) {
            keyup("s");
            keysDown["s"] = false;
        }

        if (keysDown["d"]) {
            keyup("d");
            keysDown["d"] = false;
        }

    }

    currentBuf && currentBuf.length > 1 && (currentBuf[0] == 3 || currentBuf[0] == 1) && renderBuf(currentBuf);

    window.requestAnimationFrame(req);
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
