// Insert your local IP + port here
const socket = new WebSocket('ws://192.168.1.14:7080');

socket.binaryType = 'arraybuffer';

let socketIsReady = false;

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

socket.onmessage = function(msg) {
    let color, startX, startY, width, height;
    const buf = new Uint8ClampedArray(msg.data);
    console.log(buf);
    for (let i = 0; i < buf.length; i += 42) {
        color = buf.slice(i, i + 4);
        startX = (buf[i + 4] / 100) * horizontalScale;
        startY = (buf[i + 5] / 100) * verticalScale;
        width = (buf[i + 6] / 100) * horizontalScale;
        height = (buf[i + 7] / 100) * verticalScale;
        ctx.fillStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + color[3] + ')';
        ctx.fillRect(startX, startY, width, height);
        // todo: remove magic numbers, make this a function
        if (buf[i + 10] !== 0) {
            const textStartX = (buf[i + 8] / 100) * horizontalScale;
            const textStartY = (buf[i + 9] / 100) * verticalScale;
            const textArray = buf.slice(i + 10, buf.indexOf(0, i + 10));
            const string = String.fromCharCode(...textArray);
            // todo: encode this in the payload
            ctx.font = '48px sans-serif';
            ctx.fillStyle = "black";
            ctx.textAlign = "center";
            ctx.fillText(string, textStartX, textStartY);
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
