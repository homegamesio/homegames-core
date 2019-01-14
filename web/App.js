// Insert your local IP + port here
const socket = new WebSocket('wss://192.168.1.14:7080');

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
setTimeout(() => {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    source = audioCtx.createBufferSource();
}, 5000);

socket.onmessage = function(msg) {
    setTimeout(() => {
        audioCtx.decodeAudioData(msg.data, (buffer) => {
            source.buffer = buffer;
            source.connect(audioCtx.destination);
            source.start(0);
            //source.loop = true;
        }, (error) => {
            console.error(error);
        })
    }, 5500);
        //const snd = new Audio("data:audio/wav;base64," + msg.data);

        //if (snd !== undefined && audioAllowed) {
        //    snd.play().then(_ => {
        //        console.log('Autoplay started!');
        //    }).catch(error => {
        //        console.log('nooo');
        //        console.log(error);
        //    });
        //}
    return;
    let color, startX, startY, width, height;
    const buf = new Uint8ClampedArray(msg.data);
    let i = 0;
    while (i < buf.length) {
        const frameSize = buf[i];
        const start = i + 1;
        // todo: store some code here to signify what fields it has/doesnt have instead of frame size
        color = buf.slice(start, start + 4);
        startX = (buf[start + 4] / 100) * horizontalScale;
        startX += (buf[start + 5] /10000) * horizontalScale;
        startY = (buf[start + 6] / 100) * verticalScale;
        startY += (buf[start + 7] / 10000) * verticalScale;
        width = (buf[start + 8] / 100) * horizontalScale;
        width += (buf[start + 9] / 10000) * horizontalScale;
        height = (buf[start + 10] / 100) * verticalScale;
        height += (buf[start + 11] / 10000) * verticalScale;
        ctx.fillStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + color[3] + ')';
        ctx.fillRect(startX, startY, width, height);

        if (frameSize > 13) {
            // has text
            const textStartX = (buf[start + 12] / 100) * horizontalScale;
            const textStartY = (buf[start + 13] / 100) * verticalScale;
            const textArray = buf.slice(start + 14, start + frameSize);
            const string = String.fromCharCode(...textArray);

            // todo: encode this in the payload
            ctx.fillStyle = "black";
            ctx.font = '48px sans-serif';
            ctx.textAlign = "center";
            
            ctx.fillText(string, textStartX, textStartY);
        }

        i += frameSize;
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

canvas.addEventListener('mousedown', function(e) {
    mouseDown = true;
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

document.getElementById('unmute').addEventListener('click', () => {
    audioAllowed = !audioAllowed;
});
