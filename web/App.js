const hostRequest = new XMLHttpRequest();
hostRequest.onreadystatechange = (res) => {
    console.log("RESPONSE");
    console.log(res);
};

hostRequest.open('GET', 'http://homegames.link');
hostRequest.send();

// Insert your local IP + port here
const socket = new WebSocket('wss://192.168.1.16:7080');

socket.binaryType = 'arraybuffer';
//socket.binaryType = 'blob';

let socketIsReady = false;
let audioAllowed = false;

socket.onopen = function(e) {
    socketIsReady = true;
};

const canvas = document.getElementById("game");
const ctx = canvas.getContext('2d');

let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;

const originalWidth = 320;
const originalHeight = 180;
const scaleFactor = Math.floor(windowWidth / originalWidth);
const horizontalScale = originalWidth * scaleFactor;
const verticalScale = originalHeight * scaleFactor;

canvas.height = verticalScale;
canvas.width = horizontalScale;

let mouseDown = false;
const keysDown = {};

let audioCtx, source;


//const noteMap = {
//    C0: 16.35,
//    C1: 32.70
//};
//
//let o;
//setTimeout(() => {
//    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
//    o = audioCtx.createOscillator()
//    //const g = audioCtx.createGain();
//    //o.connect(g);
//    o.frequency.value = 440;//noteMap.C0;
//    o.connect(audioCtx.destination);
//    o.start(0);
//
////    source = audioCtx.createBufferSource();
//}, 5000);
//

const FRAME_TYPES = {
    1: {
        'type': 'asset'
    },
    2: {
        'type': 'info'
    },
    3: {
        'type': 'entity'
    }
};

const gameAssets = {};

const imageCache = {};

socket.onmessage = function(msg) {
    const buf = new Uint8ClampedArray(msg.data);
    let color, startX, startY, width, height;
    let i = 0;
    while (i < buf.length) {
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
                let imgBase64String = '';
                for (let i = 0; i < payloadData.length; i++) {
                    imgBase64String += String.fromCharCode(payloadData[i]);
                }
                const imgBase64 = btoa(imgBase64String);
                gameAssets[payloadKey] = {'type': 'image', 'data': "data:image/jpeg;base64," + imgBase64};
                i += 6 + payloadLength;
            } else {
                // audio
                const payloadLengthBase32 = String.fromCharCode.apply(null, buf.slice(i + 2, i + 6));
                const payloadLength = parseInt(payloadLengthBase32, 36);
                const payloadKeyRaw = buf.slice(i + 6, i + 6 + 32);
                const payloadData = buf.slice(i + 6 + 32, i + 6 +  payloadLength);
                const payloadKey = String.fromCharCode.apply(null, payloadKeyRaw.filter(k => k)); 
                if (!audioCtx) {
                    gameAssets[payloadKey] = {'type': 'audio', 'data': payloadData.buffer, 'decoded': false};
                } else {
                    audioCtx.decodeAudioData(payloadData.buffer, (buffer) => {
                        gameAssets[payloadKey] = {'type': 'audio', 'data': buffer, 'decoded': true};
                        //source.buffer = buffer;
                        //source.start(0);
                        //source.loop = true;
                    });
                }

                i += 6 + payloadLength;
            }
        } else {
            const frameSize = buf[i + 1];
            const start = i + 2;
            color = buf.slice(start, start + 4);
            startX = ((buf[start + 4] / 100) + (buf[start + 5] / 10000)) * horizontalScale;
            startY = ((buf[start + 6] / 100) + (buf[start + 7] / 10000)) * verticalScale;
            width = ((buf[start + 8] / 100) + (buf[start + 9] / 10000)) * horizontalScale;
            height = ((buf[start + 10] / 100) + (buf[start + 11] / 10000)) * verticalScale;
            ctx.fillStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + color[3] + ')';
            ctx.fillRect(startX, startY, width, height);

            const textX = (buf[start + 12] / 100) * horizontalScale;
            const textY = (buf[start + 13] / 100) * verticalScale;
            const textArray = buf.slice(start + 14, start + 14 + 32);
            const textStripped = textArray.filter(x => x);
            const text = String.fromCharCode.apply(null, textStripped);
            if (text) {
                // todo: encode this in the payload
                ctx.fillStyle = "black";
                ctx.font = '48px sans-serif';
                ctx.textAlign = "center";

                ctx.fillText(text, textX, textY);
            }

            if (frameSize > 2 + 46) { 
                const assetPosX = buf[start + 46];
                const assetPosY = buf[start + 47];
                
                const assetSizeX = buf[start + 48];
                const assetSizeY = buf[start + 49];

                const assetKeyArray = buf.slice(start + 50, start + 50 + 32);
                const assetKey = String.fromCharCode.apply(null, assetKeyArray.filter(x => x));
                
                if (gameAssets[assetKey]['type'] === 'audio') {
                    if (audioCtx) {
                        source = audioCtx.createBufferSource();
                        source.connect(audioCtx.destination);
                        source.buffer = gameAssets[assetKey].data;
                        source.start(0);
                    } else {
                        console.log("Cant play audio");
                    }
                } else {
                
                    let image;
                    if (imageCache[assetKey]) {
                        image = imageCache[assetKey];
                        ctx.drawImage(image, (assetPosX / 100) * horizontalScale, 
                            (assetPosY / 100) * verticalScale, image.width, image.height)

                    } else {
                        image = new Image(assetSizeX / 100 * horizontalScale, assetSizeY / 100 * verticalScale);
                        imageCache[assetKey] = image;
                        image.onload = () => {
                            ctx.drawImage(image, (assetPosX / 100) * horizontalScale, 
                                (assetPosY / 100) * verticalScale, image.width, image.height)
                        };

                        image.src = gameAssets[assetKey].data;
                    }
                }
            }

            i += frameSize;

        }
    }

};

const click = function(x, y) {
    const pixelWidth = canvas.width / originalWidth;
    const pixelHeight = canvas.height / originalHeight;
    const clickX = Math.floor(x / pixelWidth);
    const clickY = Math.floor(y  / pixelHeight);
    const payload = {type: 'click',  data: {x: clickX, y: clickY}};
    socket.send(JSON.stringify(payload));
};

const keydown = function(key) {
    const payload = {type: 'keydown',  key: key};
    socket.send(JSON.stringify(payload));
};

const keyup = function(key) {
    const payload = {type: 'keyup',  key: key};
    socket.send(JSON.stringify(payload));
};

const unlock = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)(); 
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        for (const key in gameAssets) {
            if (gameAssets[key]['type'] === 'audio' && !gameAssets[key]['decoded']) {
                audioCtx.decodeAudioData(gameAssets[key].data, (buffer) => {
                    gameAssets[key].data = buffer;
                    gameAssets[key].decoded = true;
                });
            }
        }
    }
}

document.addEventListener('touchstart', unlock, false);

canvas.addEventListener('mousedown', function(e) {
    mouseDown = true;
    unlock();
});

canvas.addEventListener('mouseup', function(e) {
    click(e.clientX, e.clientY);
    mouseDown = false;
});

canvas.addEventListener('mousemove', function(e) {
    if (mouseDown) {
        click(e.clientX, e.clientY);
    }
});

canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    click(e.touches['0'].clientX, e.touches['0'].clientY);
});

function keyMatters(event) {
    // Key code values 36-40 are the arrow keys
    return event.key.length == 1 && event.key >= ' ' && event.key <= 'z' || event.keyCode >= 36 && event.keyCode <= 40;
}

document.addEventListener('keydown', function(e) {
    if (keyMatters(e)) {
        e.preventDefault();
        keydown(e.key);
        keysDown[e.key] = true;
    }
});

document.addEventListener('keyup', function(e) {
    if (keyMatters(e)) {
        e.preventDefault();
        keyup(e.key);
        keysDown[e.key] = false;
    }
});

