let title = document.getElementById('title');

const socket = new WebSocket('ws://192.168.1.17:8080');

socket.binaryType = 'arraybuffer';

let socketIsReady = false;

socket.onopen = function(e) {
	socketIsReady = true;
};

const canvas = document.getElementById("game");
const ctx = canvas.getContext('2d');

let scaledWidth = 100;
let scaledHeight = 100;
let bytesPerPixel = 4;
let tempPixels = new Uint8ClampedArray(scaledWidth * scaledHeight * bytesPerPixel);

let scalePixels = function(buff) {
	// arr is 4 * width * height
	let arr = new Uint8ClampedArray(buff);

	let pixels = [];
	for (let i = 0; i < arr.length; i+=4) {
		pixels.push(arr.slice(i, i+4));
	}
	
	let newPixels2D = new Array(scaledWidth);
	for (let i = 0; i < scaledWidth; i++) {
		newPixels2D[i] = new Array(scaledHeight);
	}
	for (let i = 0; i < pixels.length; i++) {	
		startX = 10 * Math.floor(i / 10);
		startY = 10 * (i % 10);
		for (let x = startX; x < startX + 10; x++) {
			for (let y = startY; y < startY + 10; y++) {
				newPixels2D[x][y] = pixels[i];
			}
		}
	}				
	
	let newPixelsIndex = 0;
	for (let i = 0; i < newPixels2D.length; i++) {
		for (let j = 0; j < newPixels2D[0].length; j++) {
			tempPixels[newPixelsIndex] = newPixels2D[i][j][0];
			tempPixels[newPixelsIndex + 1] = newPixels2D[i][j][1];
			tempPixels[newPixelsIndex + 2] = newPixels2D[i][j][2];
			tempPixels[newPixelsIndex + 3] = newPixels2D[i][j][3];
			newPixelsIndex+=4;
		}
	}

	return tempPixels;
};

socket.onmessage = function(msg) {
	let newPixels = scalePixels(msg.data);
	let imageData = new ImageData(newPixels, 100, 100);
  ctx.clearRect(0, 0, 100, 100);
  ctx.putImageData(imageData, 0, 0);
};
