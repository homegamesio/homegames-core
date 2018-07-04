let title = document.getElementById('title');

const socket = new WebSocket('ws://127.0.0.1:8080');

socket.binaryType = 'arraybuffer';

let socketIsReady = false;

socket.onopen = function(e) {
	socketIsReady = true;
};


const canvas = document.getElementById("game");
const ctx = canvas.getContext('2d');

let x = 0;
let y = 0;

socket.onmessage = function(msg) {
	let newPixels = new Uint8ClampedArray(msg.data);
	let imageData = new ImageData(newPixels, 240, 135);
  ctx.clearRect(0, 0, 240, 135);
  ctx.putImageData(imageData, x++, y++);
};

const paintCanvas = function(ctx) {
	// says pixels plz
	if(socketIsReady) {
		socket.send("p");
	}
	//let pixels = new Uint8ClampedArray(4 * 320 * 640);
	//let pixelIndex = 0;

	//let pixelRandom = Math.floor(Math.random() * 256);

	//for(let y = 0; y < 320; y++) {
	//	for(let x = 0; x < 640; x++) {
	//	  pixels[pixelIndex++] = pixelRandom;
	//	  pixels[pixelIndex++] = pixelRandom;
	//		pixels[pixelIndex++] = 137;//pixelRandom;
	//		pixels[pixelIndex++] = 255;
	//	}
	//}

	//let justTheBuffer = pixels.buffer;

	//let newPixels = new Uint8ClampedArray(justTheBuffer);

	//let imageData = new ImageData(newPixels, 320, 640);

	ctx.putImageData(imageData, 0, 0);
};
//const onAnimate = function(timestamp) {
	//paintCanvas(ctx);
	//window.requestAnimationFrame(onAnimate);
//};

//window.requestAnimationFrame(onAnimate);
