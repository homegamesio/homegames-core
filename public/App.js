let title = document.getElementById('title');

const socket = new WebSocket('ws://192.168.1.17:8080');

socket.binaryType = 'arraybuffer';

let socketIsReady = false;

socket.onopen = function(e) {
	socketIsReady = true;
};

const canvas = document.getElementById("game");
const ctx = canvas.getContext('2d');

let scaledWidth = 1280;
let scaledHeight = 720;
let bytesPerPixel = 4;
let tempPixels = new Uint8ClampedArray(scaledWidth * scaledHeight * bytesPerPixel);

let scalePixels = function(buff) {
	let arr = new Uint8ClampedArray(buff);

//	let pixels = [];
//	for (let i = 0; i < arr.length; i+=4) {
//		pixels.push(arr.slice(i, i+4));
//	}
	
//	let newPixels2D = new Array(scaledWidth);
//	for (let i = 0; i < scaledWidth; i++) {
//		newPixels2D[i] = new Array(scaledHeight);
//	}
//	for (let i = 0; i < pixels.length; i++) {	
//		startX = 10 * Math.floor(i / 100);
//		startY = 10 * (i % 100);
//		for (let x = startX; x < startX + 10; x++) {
//			for (let y = startY; y < startY + 10; y++) {
//				newPixels2D[x][y] = pixels[i];
//			}
//		}
//	}				

	//let newPixelsIndex = 0;
	// For each pixel in source 1D array
//	for (let i = 0; i < arr.length; i+=4) {
//		let startX = 10 * (Math.floor( i/ 100));
//		let startY = 10 * ( i % 100);
//		for (let x = startX; x < startX + 10; x++) {
//			for (let y = startY; y < startY + 10; y++) {
//				console.log(newPixels2D[x][y]);
//				let theNewIndex = 4 * (1000 * x) + 4 * y;
//	  		tempPixels[theNewIndex] = newPixels2D[x][y][0];
//	  		tempPixels[theNewIndex + 1] = newPixels2D[x][y][1];
//	  		tempPixels[theNewIndex + 2] = newPixels2D[x][y][2];
//	  		tempPixels[theNewIndex + 3] = newPixels2D[x][y][3];
//				//tempPixels[newIndex] = arr[i];
//				//tempPixels[newIndex + 1] = arr[i + 1];
//				//tempPixels[newIndex + 2] = arr[i + 2];
//				//tempPixels[newIndex + 3] = arr[i + 3];
//			}
//		}
//	}
	
	for (let k = 0; k < arr.length; k+=4) {
		let startX = 10 * Math.floor( (k/4) / 128);
		let startY = 10 * ( (k/4) % 128);
		for (let x = startX; x < startX + 10; x++) {
			for (let y = startY; y < startY + 10; y++) {
				let theNewIndex = 4 * (1280 * x) + 4 * y;
				tempPixels[theNewIndex] = arr[k];
				tempPixels[theNewIndex + 1] = arr[k + 1];
				tempPixels[theNewIndex + 2] = arr[k + 2];
				tempPixels[theNewIndex + 3] = arr[k + 3];
				//tempPixels[theNewIndex] = newPixels2D[x][y][0];
				//tempPixels[theNewIndex + 1] = newPixels2D[x][y][1];
				//tempPixels[theNewIndex + 2] = newPixels2D[x][y][2];
				//tempPixels[theNewIndex + 3] = newPixels2D[x][y][3];
			}
		}
	}
//		let startX =  Math.floor((k/4) / 100); 
//		let startY =  (k/4) % 100;
//		for (let x = startX; x < startX + 10; x++) {
//			for (let y = startY; y < startY + 10; y++) {
//				let theNewIndex = (4 * (1000 * x)) + ( 4 * y);
//				tempPixels[theNewIndex] = newPixels2D[x][y][0];
//				tempPixels[theNewIndex + 1] = newPixels2D[x][y][1];
//				tempPixels[theNewIndex + 2] = newPixels2D[x][y][2];
//				tempPixels[theNewIndex + 3] = newPixels2D[x][y][3];
//			}
//		}
//	}

//	for (let i = 0; i < newPixels2D.length; i++) {
//		for (let j = 0; j < newPixels2D[0].length; j++) {
//			let theNewIndex = 4 * (1000 * i) + 4 * j;
//			tempPixels[theNewIndex] = newPixels2D[i][j][0];
//			tempPixels[theNewIndex + 1] = newPixels2D[i][j][1];
//			tempPixels[theNewIndex + 2] = newPixels2D[i][j][2];
//			tempPixels[theNewIndex + 3] = newPixels2D[i][j][3];
//		}
//	}

	return tempPixels;
};

socket.onmessage = function(msg) {
	let newPixels = scalePixels(msg.data);
	let imageData = new ImageData(newPixels, 1280, 720);
  ctx.clearRect(0, 0, 1280, 720);
  ctx.putImageData(imageData, 0, 0);
};
