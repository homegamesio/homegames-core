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

let maxWidth = scaleFactor * originalWidth;
let maxHeight = scaleFactor * originalHeight;

let canvasWidth = maxWidth;
let canvasHeight = maxHeight;
//if (windowWidth > maxWidth) {
//	canvasWidth = maxWidth;
//	canvasHeight = (windowWidth/canvasWidth) * windowHeight;
//}

canvas.height = canvasHeight;
canvas.width = canvasWidth;

let mouseDown = false;

let tempPixels = new Uint8ClampedArray(originalWidth * originalHeight * scaleFactor * scaleFactor * BYTES_PER_PIXEL);

let scalePixels = function(buff) {
	let arr = new Uint8ClampedArray(buff);

	for (let k = 0; k < arr.length; k+=BYTES_PER_PIXEL) {
		let startX = scaleFactor * Math.floor((k / BYTES_PER_PIXEL) / originalWidth);
		let startY = scaleFactor * ((k / BYTES_PER_PIXEL) % originalWidth);
		for (let x = startX; x < startX + scaleFactor; x++) {
			for (let y = startY; y < startY + scaleFactor; y++) {
				let newIndex = BYTES_PER_PIXEL * ((originalWidth * scaleFactor * x) + y);
				tempPixels[newIndex] = arr[k];
				tempPixels[newIndex + 1] = arr[k + 1];
				tempPixels[newIndex + 2] = arr[k + 2];
				tempPixels[newIndex + 3] = arr[k + 3];
			}
		}
	}

	return tempPixels;
};

let imageData = null;//new ImageData(new Uint8ClampedArray(), canvasWidth);

socket.onmessage = function(msg) {
    console.log("GOT");
    console.log(msg.data);
    let buf = new Uint8ClampedArray(msg.data);
    let color = buf.slice(0, 4);
    let startX = buf[4];
    let startY = buf[5];
    let width = buf[6];
    let height = buf[7];
    
    ctx.fillStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + color[3] + ')';
    ctx.rect(startX, startY, originalWidth * scaleFactor * width, originalHeight * height * scaleFactor);
    ctx.fill();
	//let newPixels = scalePixels(msg.data);
    //imageData = new ImageData(newPixels, originalWidth * scaleFactor, originalHeight * scaleFactor);
};

window.addEventListener("resize", function(x) {
	// todo: this should not interfere with current pixels being repainted

	windowWidth = window.innerWidth;
	windowHeight = window.innerHeight;
	scaleFactor = Math.floor(windowWidth / originalWidth);
	tempPixels = new Uint8ClampedArray(originalWidth * originalHeight * scaleFactor * scaleFactor * BYTES_PER_PIXEL);
	canvas.height = windowHeight;
	canvas.width = windowWidth;
	socket.send(JSON.stringify({"req": true}));
});

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

function render(timestamp) {
	if (imageData) {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
  	    ctx.putImageData(imageData, 0, 0);
	}

	window.requestAnimationFrame(render);
};

window.requestAnimationFrame(render);
