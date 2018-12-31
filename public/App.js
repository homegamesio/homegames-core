// Insert your local IP + port here
const socket = new WebSocket('ws://192.168.0.104:7080');

socket.binaryType = 'arraybuffer';

let socketIsReady = false;

socket.onopen = function(e) {
	socketIsReady = true;
};

const canvas = document.getElementById("game");
const ctx = canvas.getContext('2d');

let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;

let originalWidth = 320;
let originalHeight = 180;
let scaleFactor = Math.floor(windowWidth / originalWidth);
let BYTES_PER_PIXEL = 4;

const maxWidth = scaleFactor * originalWidth;
const maxHeight = scaleFactor * originalHeight;

canvas.height = maxHeight;
canvas.width = maxWidth;

let mouseDown = false;

socket.onmessage = function(msg) {
    let buf = new Uint8ClampedArray(msg.data);
    for (let i = 0; i < buf.length; i+=8) {
        let color = buf.slice(i, i + 4);
        let startX = (buf[i + 4]/100) * originalWidth * scaleFactor;
        let startY = (buf[i + 5]/100) * originalHeight * scaleFactor;
        let width = (buf[i + 6] / 100) * originalWidth * scaleFactor;
        let height = (buf[i + 7] / 100) * originalHeight * scaleFactor;
        ctx.fillStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + color[3] + ')';
        ctx.fillRect(startX, startY, width, height);
    }
};

const click = function(x, y) {
	const pixelWidth = canvas.width / originalWidth;
	const pixelHeight = canvas.height / originalHeight;
	const clickX = Math.floor(x / pixelWidth);
	const clickY = Math.floor(y  / pixelWidth);
	const clickIndex = (originalWidth * clickY) + clickX;
    const payload = {type: 'click',  data: {x: clickX, y: clickY}};
    socket.send(JSON.stringify(payload));
};

const keydown = function(key) {
    const payload = {type: 'keydown',  data: {key: key}};
    socket.send(JSON.stringify(payload));
};

const keyup = function(key) {
    const payload = {type: 'keydown',  data: {key: key}};
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

document.addEventListener('keydown', function(e) {
    e.preventDefault();
    keydown(e.key);
});

document.addEventListener('keyup', function(e) {
    e.preventDefault();
    keyup(e.key);
});
