const socket = new WebSocket('ws://192.168.1.17:8080');

socket.binaryType = 'arraybuffer';

let socketIsReady = false;

socket.onopen = function(e) {
	socketIsReady = true;
};

const canvas = document.getElementById("game");
const ctx = canvas.getContext('2d');

let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;

canvas.height = windowHeight;
canvas.width = windowWidth;

let originalWidth = 16;
let originalHeight = 9;
let scaleFactor = Math.floor(windowWidth / originalWidth);
let BYTES_PER_PIXEL = 4;

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

socket.onmessage = function(msg) {
	let newPixels = scalePixels(msg.data);
	let imageData = new ImageData(newPixels, originalWidth * scaleFactor, originalHeight * scaleFactor);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(imageData, 0, 0);
};

window.addEventListener("resize", function(x) {
	// todo: this should not interfere with current pixels being repainted
	windowWidth = window.innerWidth;
	windowHeight = window.innerHeight;
	scaleFactor = Math.floor(windowWidth / originalWidth);
	tempPixels = new Uint8ClampedArray(originalWidth * originalHeight * scaleFactor * scaleFactor * BYTES_PER_PIXEL);
	canvas.height = windowHeight;
	canvas.width = windowWidth;
});

