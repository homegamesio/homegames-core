// Insert your local IP + port here
// 192.168.1.11
const socket = new WebSocket('ws://192.168.1.11:8080');

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
				let theNewIndex = BYTES_PER_PIXEL * ((originalWidth * scaleFactor * x) + y);
				tempPixels[theNewIndex] = arr[k];
				tempPixels[theNewIndex + 1] = arr[k + 1];
				tempPixels[theNewIndex + 2] = arr[k + 2];
				tempPixels[theNewIndex + 3] = arr[k + 3];
			}
		}
	}

	return tempPixels;
};

let imageData = null;//new ImageData(new Uint8ClampedArray(), canvasWidth);

socket.onmessage = function(msg) {
	let newPixels = scalePixels(msg.data);
	imageData = new ImageData(newPixels, originalWidth * scaleFactor, originalHeight * scaleFactor);
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

const draw = function(x, y) {
	let pixelWidth = canvas.width / originalWidth;
	let pixelHeight = canvas.height / originalHeight;
	let clickX = Math.floor(x / pixelWidth);
	let clickY = Math.floor(y  / pixelWidth);
	let clickIndex = (originalWidth * clickY) + clickX;
	let clickIndices = [clickIndex, clickIndex+1, clickIndex + originalWidth, clickIndex + originalWidth+1];
	socket.send(clickIndices);
};

canvas.addEventListener('mousedown', function(e) {
	mouseDown = true;
	draw(e.clientX, e.clientY);
});

canvas.addEventListener('mouseup', function(e) {
	mouseDown = false;
});

canvas.addEventListener('mousemove', function(e) {
	if (mouseDown) {
		draw(e.clientX, e.clientY);
	}
});

canvas.addEventListener('touchmove', function(e) {
	e.preventDefault();
	draw(e.touches['0'].clientX, e.touches['0'].clientY);
});

function render(timestamp) {
	if (imageData) {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
  	ctx.putImageData(imageData, 0, 0);
	}

	window.requestAnimationFrame(render);
};

window.requestAnimationFrame(render);
