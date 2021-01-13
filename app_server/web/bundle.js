/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 4);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports) {

let id = 0;

class InternalGameNode {
    constructor(color, onClick, coordinates2d, border, fill, text, asset, playerIds = [], effects = null, input = null) {
        this.id = id++;
        this.children = new Array();
        this.color = color;
        this.handleClick = onClick;
        this.coordinates2d = coordinates2d;
        this.border = border;
        this.fill = fill;
        this.text = text;
        this.asset = asset;
        this.effects = effects;
        this.input = input;
        this.listeners = new Set();
        if (playerIds && !(playerIds instanceof Array)) {
            playerIds = [playerIds];
        }
        this.playerIds = playerIds || [];
    }

    addChild(node) {
        this.children.push(node);
        this.onStateChange();
    }

    addChildren(...nodes) {
        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
            this.addChild(nodes[nodeIndex]);
        }
    }

    removeChild(nodeId) {
        const removeIndex = this.children.findIndex(child => child.node.id == nodeId);
        if (removeIndex >= 0) {
            if (this._animation) {
                clearInterval(this._animation);
            }
            this.children.splice(removeIndex, 1);
            // hack to invoke update listener
            this.id = this.id;
        }
    }

    addListener(listener) {
        this.listeners.add(listener);
    }

    onStateChange() {
        for (const listener of this.listeners) {
            listener.handleStateChange(this);
        }
    }

    clearChildren(excludedNodeIds) {
        if (!excludedNodeIds) {
            this.children = new Array();
        } else {
            const newChildren = this.children.filter(child => {
                return excludedNodeIds.includes(child.id);
            });
            this.children = newChildren;
        }
    }
}

module.exports = InternalGameNode;



/***/ }),
/* 1 */
/***/ (function(module, exports) {

const COLORS = {
    AQUA: [188, 212, 230, 255],
    BLACK: [0, 0, 0, 255],
    BLUE: [0, 0, 255, 255],
    BRONZE: [227, 151, 17, 255],
    BROWN: [145, 97, 11, 255],
    CREAM: [240, 224, 136, 255],
    EMERALD: [39, 89, 45, 255],
    FUCHSIA: [255, 0, 255, 255],
    GOLD: [255, 198, 35, 255],
    GRAY: [190, 190, 190, 255],
    GREEN: [0, 255, 0, 255],
    HG_BLACK: [26, 26, 26, 255],
    HG_BLUE: [148, 210, 230, 255],
    HG_RED: [241, 112, 112, 255],
    HG_YELLOW: [255, 247, 143, 255],
    LAVENDER: [230, 230, 250, 255],
    MAGENTA: [255, 0, 255, 255],
    MAROON: [128, 0, 0, 255],
    MUSTARD: [232, 219, 32, 255],
    ORANGE: [255, 165, 0, 255],
    ORANGE_RED: [255, 69, 0, 255],
    PERRYWINKLE: [204, 204, 255, 255],
    PINK: [255, 192, 203, 255],
    PURPLE: [128, 0, 128, 255],
    RED: [255, 0, 0, 255],
    SILVER: [192, 192, 192, 255],
    TEAL: [0, 128, 128, 255],
    TERRACOTTA: [226, 114, 91, 255],
    TURQUOISE: [64, 224, 208, 255],
    WHITE: [255, 255, 255, 255],
    YELLOW: [255, 255, 0, 255]
};

const colorKeys = Object.keys(COLORS);

const randomColor = function(exclusionList=[]) {
    const filteredList = exclusionList.length ? filterList(colorKeys, exclusionList) : colorKeys;
    const colorIndex = Math.floor(Math.random() * filteredList.length);
    return COLORS[filteredList[colorIndex]];
};

const filterList = (colorKeys, exclusionList) => {
    if (colorKeys.length === exclusionList.length) {
        return ["WHITE"];
    }

    return colorKeys.filter(key => {
        for (const exclude of exclusionList) {
            if (key === exclude) {
                return false;
            }
        }
        return true;
    });
};

module.exports = {
    COLORS,
    randomColor
};


/***/ }),
/* 2 */
/***/ (function(module, exports) {

var g;

// This works in non-strict mode
g = (function() {
	return this;
})();

try {
	// This works if eval is allowed (see CSP)
	g = g || Function("return this")() || (1,eval)("this");
} catch(e) {
	// This works if the window reference is available
	if(typeof window === "object")
		g = window;
}

// g can still be undefined, but nothing to do about it...
// We return undefined, instead of nothing here, so it's
// easier to handle this case. if(!global) { ...}

module.exports = g;


/***/ }),
/* 3 */
/***/ (function(module, exports) {

const Shapes = {
    CIRCLE: 1,
    POLYGON: 2,
    LINE: 3
};

module.exports = Shapes;



/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

let { squish, unsquish, Colors } = __webpack_require__(5);
Colors = Colors.COLORS;

const socketWorker = new Worker('socket.js');

let currentBuf;

let rendering = false;

let aspectRatio;

let mousePos;
let clientWidth;

socketWorker.onmessage = (socketMessage) => {
    if (socketMessage.data.constructor === Object) {
        if (socketMessage.data.type === 'SOCKET_CLOSE') {
            rendering = false;
        }
    } else {
        currentBuf = new Uint8ClampedArray(socketMessage.data);
        if (currentBuf[0] == 2) {
            window.playerId = currentBuf[1];
            const aspectRatioX = currentBuf[2];
            const aspectRatioY = currentBuf[3];
            aspectRatio = {x: aspectRatioX, y: aspectRatioY};
            initCanvas();
        } else if (currentBuf[0] == 1) {
            storeAssets(currentBuf);
        } else if (currentBuf[0] === 5) {
            let a = String(currentBuf[1]);
            let b = String(currentBuf[2]).length > 1 ? currentBuf[2] : "0" + currentBuf[2];
            let newPort = a + b;

            socketWorker.postMessage({
                socketInfo: {
                    hostname: window.location.hostname,
                    playerId: window.playerId || null,
                    port: Number(newPort)
                }
            });

        } else if (currentBuf[0] == 3 && !rendering) {
            rendering = true;
            req();
        }
    }
};

socketWorker.postMessage({
    socketInfo: {
        hostname: window.location.hostname,
        playerId: window.playerId || null,
        port: 7000
    }
});

let gamepad;
let moving;

window.playerId = null;

let mouseDown = false;
const keysDown = {};

let audioCtx, source;

const gameAssets = {};
const imageCache = {};

const canvas = document.getElementById("game");
const gameDiv = document.getElementById('homegames-main');
const divColor = Colors.BLACK;
gameDiv.style.background = `rgba(${divColor[0]}, ${divColor[1]}, ${divColor[2]}, ${divColor[3]})`; 

const ctx = canvas.getContext("2d", {alpha: false});

const initCanvas = () => {
    const maxWidth = window.innerWidth;
    const maxHeight = window.innerHeight;

    const canFitHeight = (maxWidth * aspectRatio.y / aspectRatio.x) <= maxHeight;

    let canvasHeight, canvasWidth;

    if (canFitHeight) { 
        const width = window.innerWidth;
        canvasWidth = width;
        canvasHeight = Math.floor(width * (aspectRatio.y / aspectRatio.x));
    } else {
        // fit canvas to height
        const height = window.innerHeight;
        canvasWidth = Math.floor(height * (aspectRatio.x / aspectRatio.y));
        canvasHeight = height;
    }

    canvas.height = 2 * canvasHeight;
    canvas.width = 2 * canvasWidth;
    clientWidth = .5 * canvas.width;
    clientHeight = .5 * canvas.height;
    canvas.style.height = `${clientHeight}px`;
    canvas.style.width = `${clientWidth}px`;
};

const storeAssets = (buf) => {
    let i = 0;

    while (buf && i < buf.length) {
        const frameType = buf[i];

        if (frameType === 1) {
            const assetType = buf[i + 1];
            // image
            if (assetType === 1) {
                const payloadLengthBase32 = String.fromCharCode.apply(null, buf.slice(i + 2, i + 12));
                const payloadLength = parseInt(payloadLengthBase32, 36);

                const payloadKeyRaw = buf.slice(i + 12, i + 12 + 32);
                const payloadData = buf.slice(i + 12 + 32, i + 12 +  payloadLength);
                const payloadKey = String.fromCharCode.apply(null, payloadKeyRaw.filter(k => k)); 
                let imgBase64String = "";
                for (let i = 0; i < payloadData.length; i++) {
                    imgBase64String += String.fromCharCode(payloadData[i]);
                }
                const imgBase64 = btoa(imgBase64String);
                gameAssets[payloadKey] = {"type": "image", "data": "data:image/jpeg;base64," + imgBase64};
                i += 12 + payloadLength;
            } else {
                // audio
                const payloadLengthBase32 = String.fromCharCode.apply(null, buf.slice(i + 2, i + 12));
                const payloadLength = parseInt(payloadLengthBase32, 36);
                const payloadKeyRaw = buf.slice(i + 12, i + 12 + 32);
                const payloadData = buf.slice(i + 12 + 32, i + 12 +  payloadLength);
                const payloadKey = String.fromCharCode.apply(null, payloadKeyRaw.filter(k => k)); 
                if (!audioCtx) {
                    gameAssets[payloadKey] = {"type": "audio", "data": payloadData.buffer, "decoded": false};
                } else {
///                    audioCtx.decodeAudioData(payloadData.buffer, (buffer) => {
 //                       gameAssets[payloadKey] = {"type": "audio", "data": buffer, "decoded": true};
 //                   });
                }

                i += 12 + payloadLength;
            }
        }
    }
}

let thingIndices = [];

function renderBuf(buf) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let i = 0;
    thingIndices = [];
    
    while (buf && i < buf.length) {
        const frameType = buf[i];

        const frameSize = buf[i + 1];

        let bufIndex = i + 2;
        let thing = unsquish(buf.slice(i, i + frameSize));

        if (!thing.coordinates2d && thing.input && thing.text) {
            const maxTextSize = Math.floor(canvas.width);
            const fontSize = (thing.text.size / 100) * maxTextSize;
            ctx.font = fontSize + "px sans-serif";
 
            const textInfo = ctx.measureText(thing.text.text);
            let textStartX = thing.text.x * canvas.width / 100;
            
            if (thing.text.align && thing.text.align == 'center') {
                textStartX -= textInfo.width / 2;
            }

            textStartX = textStartX / canvas.width * 100;
            const textHeight = textInfo.actualBoundingBoxDescent - textInfo.actualBoundingBoxAscent;
            const textWidthPercent = textInfo.width / canvas.width * 100;
            const textHeightPercent = textHeight / canvas.height * 100;

            const clickableChunk = [
                !!thing.handleClick,
                thing.input && thing.input.type,
                thing.id,
                [textStartX, thing.text.y, textStartX + textWidthPercent, thing.text.y, textStartX + textWidthPercent, thing.text.y + textHeightPercent, textStartX, thing.text.y + textHeightPercent, textStartX, thing.text.y]
            ];
            thingIndices.push(clickableChunk);
        } else if (thing.coordinates2d !== null && thing.coordinates2d !== undefined) {// && thing.flll !== null) {
            const clickableChunk = [
                !!thing.handleClick,
                thing.input && thing.input.type,
                thing.id,
                thing.coordinates2d
            ];
            thingIndices.push(clickableChunk);

            if (thing.effects && thing.effects.shadow) {
                const shadowColor = thing.effects.shadow.color;
                ctx.shadowColor = "rgba(" + shadowColor[0] + "," + shadowColor[1] + "," + shadowColor[2] + "," + shadowColor[3] + ")";
                if (thing.effects.shadow.blur) {
                    ctx.shadowBlur = thing.effects.shadow.blur;
                }
            }

            if (thing.color) {
                ctx.globalAlpha = thing.color[3] / 255;
            }
            if (thing.fill !== null && thing.fill !== undefined) {
                ctx.fillStyle = "rgba(" + thing.fill[0] + "," + thing.fill[1] + "," + thing.fill[2] + "," + thing.fill[3] + ")";
            }
            if (thing.border !== undefined && thing.border !== null) {
                ctx.lineWidth = (thing.border / 255) * .1 * canvas.width;
                ctx.strokeStyle = "rgba(" + thing.color[0] + "," + thing.color[1] + "," + thing.color[2] + "," + thing.color[3] + ")";
            } 

            if (thing.coordinates2d !== null && thing.coordinates2d !== undefined) {
                ctx.beginPath();
                
                ctx.moveTo(thing.coordinates2d[0] * canvas.width / 100, thing.coordinates2d[1] * canvas.height / 100);
                for (let i = 2; i < thing.coordinates2d.length; i+=2) {
                    ctx.lineTo(canvas.width / 100 * thing.coordinates2d[i], thing.coordinates2d[i+1] * canvas.height / 100);
                }
    
                if (thing.fill !== undefined && thing.fill !== null) {
                    ctx.fill();
                }
    
                if (thing.border !== undefined && thing.border !== null) {
                    ctx.stroke();
                }
            }
            ctx.shadowColor = null;
            ctx.shadowBlur = 0;
            ctx.lineWidth = 0;
            ctx.strokeStyle = null;
        }

        if (thing.text) {
            ctx.globalAlpha = thing.text.color[3] / 255;
            ctx.fillStyle = "rgba(" + thing.text.color[0] + "," + thing.text.color[1] + "," + thing.text.color[2] + "," + thing.text.color[3] + ")";
            const maxTextSize = Math.floor(canvas.width);
            const fontSize = (thing.text.size / 100) * maxTextSize;
            ctx.font = fontSize + "px sans-serif";
            if (thing.text.align) {
                ctx.textAlign = thing.text.align;
            }
            ctx.textBaseline = "top";
            ctx.fillText(thing.text.text, thing.text.x * canvas.width/ 100, thing.text.y * canvas.height / 100);
        }

        if (thing.asset) {
            const assetKey = Object.keys(thing.asset)[0];

            if (gameAssets[assetKey] && gameAssets[assetKey]["type"] === "audio") {
                if (audioCtx && gameAssets[assetKey].decoded) {
                    source = audioCtx.createBufferSource();
                    source.connect(audioCtx.destination);
                    source.buffer = gameAssets[assetKey].data;
                    source.start(0);
                } else {
                    console.warn("Cant play audio");
                }
            } else {
                const asset = thing.asset[assetKey];
                let image;

                if (imageCache[assetKey]) {
                    image = imageCache[assetKey];
                    image.width = asset.size.x / 100 * canvas.width;
                    image.height = asset.size.y / 100 * canvas.height;
                    ctx.drawImage(image, (asset.pos.x / 100) * canvas.width, 
                        (asset.pos.y / 100) * canvas.height, image.width, image.height);
                } else {
                    image = new Image(asset.size.x / 100 * canvas.width, asset.size.y / 100 * canvas.height);
                    imageCache[assetKey] = image;
                    image.onload = () => {
                        ctx.drawImage(image, (asset.pos.x / 100) * canvas.width, 
                            (asset.pos.y / 100) * canvas.height, image.width, image.height);
                    };

                    if (gameAssets[assetKey]) {
                        image.src = gameAssets[assetKey].data;
                    }
                }
            }

        }

        i += frameSize;

        ctx.globalAlpha = 1;
    }
}

let gamepads;

const getGamepadMappings = (gamepadId) => {
    if (gamepadId.indexOf('Xbox 360') >= 0 || gamepadId.indexOf('Xbox One') >= 0) { 
        const leftStickXIndex = 0;
        const leftStickYIndex = 1;

        const rightStickXIndex = 2;
        const rightStickYIndex = 3;

        const stickInputThreshold = 0.2;

        const aButtonIndex = 0;
        const bButtonIndex = 1;
        const xButtonIndex = 2;
        const yButtonIndex = 3;

        const stickMappings = {
            [leftStickXIndex]: (val) => {
                if (Math.abs(val) >= stickInputThreshold) {
                    if (val < 0) {
                        keydown('a');
                        keysDown['a'] = true;
                    } else {
                        keydown('d');
                        keysDown['d'] = true;
                    }
                } else {
                    keysDown['a'] = false;
                    keysDown['d'] = false;
                }
            },
            [leftStickYIndex]: (val) => {
                if (Math.abs(val) >= stickInputThreshold) {
                    if (val < 0) {
                        keydown('w');
                        keysDown['w'] = true;
                    } else {
                        keydown('s');
                        keysDown['s'] = true;
                    }
                } else {
                    keysDown['w'] = false;
                    keysDown['s'] = false;
                }
            },
            [rightStickXIndex]: (val) => {
                if (Math.abs(val) >= stickInputThreshold) {
                    if (val < 0) {
                        keydown('ArrowLeft');
                        keysDown['ArrowLeft'] = true;
                    } else {
                        keydown('ArrowRight');
                        keysDown['ArrowRight'] = true;
                    }
                } else {
                    keysDown['ArrowLeft'] = false;
                    keysDown['ArrowRight'] = false;
                }
            },
            [rightStickYIndex]: (val) => {
                if (Math.abs(val) >= stickInputThreshold) {
                    if (val < 0) {
                        keydown('ArrowUp');
                        keysDown['ArrowUp'] = true;
                    } else {
                        keydown('ArrowDown');
                        keysDown['ArrowDown'] = true;
                    }
                } else {
                    keysDown['ArrowDown'] = false;
                    keysDown['ArrowUp'] = false;
                }
            }
        };

        const buttonMappings = {
            [aButtonIndex]: {
                press: () => {
                    console.log('a');
                },
                depress: () => {
                    console.log(':(');
                }
            },
            [bButtonIndex]: {
                press: () => {
                    console.log('b');
                },
                depress: () => {
                    console.log('no b');
                }
            },
            [xButtonIndex]: {
                press: () => {
                    console.log('x');
                },
                depress: () => {
                    console.log('no x');
                }
            },
            [yButtonIndex]: {
                press: () => {
                    console.log('y');
                },
                depress: () => {
                    console.log('no y');
                }

            }
        }

        return {
            stickMappings,
            buttonMappings
        }
    }
};

const gamepadsPressed = {};

const getActiveGamepads = (gamepads) => {
    const activeGamepads = new Map();

    for (let gamepadIndex = 0; gamepadIndex < gamepads.length; gamepadIndex++) {
        const gamepad = gamepads[gamepadIndex];
        activeGamepads.set(gamepadIndex, gamepad);
    }

    return activeGamepads;
};

let clickStopper;

function req() {
    if (!rendering) {
        return;
    }

    gamepads = navigator.getGamepads();

    Object.keys(keysDown).filter(k => keysDown[k]).forEach(k => keydown(k));

    const activeGamepads = getActiveGamepads(gamepads);

    if (activeGamepads.length) {
        activeGamepads.forEach((gamepadIndex, gamepad) => {
            if (!gamepadsPressed.hasOwnProperty(gamepadIndex)) {
                gamepadsPressed[gamepadIndex] = {};
            }
            const inputMappings = getGamepadMappings(gamepad.id);
            if (inputMappings) {
                for (let stickIndex in inputMappings.stickMappings) {
                    inputMappings.stickMappings[stickIndex](gamepad.axes[stickIndex]);
                }

                for (let buttonIndex in inputMappings.buttonMappings) {
                    if (!gamepadsPressed[gamepadIndex].hasOwnProperty(buttonIndex)) {
                        gamepadsPressed[gamepadIndex][buttonIndex] = false;
                    }
                    if (gamepad.buttons[buttonIndex].pressed && !gamepadsPressed[gamepadIndex][buttonIndex]) {
                        gamepadsPressed[gamepadIndex][buttonIndex] = true;
                        inputMappings.buttonMappings[buttonIndex].press();
                    } else if (!gamepad.buttons[buttonIndex].pressed && gamepadsPressed[gamepadIndex][buttonIndex]) {
                        gamepadsPressed[gamepadIndex][buttonIndex] = false;
                        inputMappings.buttonMappings[buttonIndex].depress();
                    }
                }
            }
        });
    } 

    if (mousePos) {
        const clickInfo = canClick(mousePos[0], mousePos[1]);//e.clientX, e.clientY);

        if (mouseDown && !clickStopper) {
            click(clickInfo);
            clickStopper = setTimeout(() => {
                clickStopper = null;
            }, 30);
        }


        if (clickInfo.isClickable || clickInfo.action) {
            canvas.style.cursor = 'pointer';
        } else {
            canvas.style.cursor = 'initial';
        }

        mousePos = null;
    }

    currentBuf && currentBuf.length > 1 && currentBuf[0] == 3 && renderBuf(currentBuf);

    window.requestAnimationFrame(req);
}

const click = function(clickInfo = {}) {
    if (!mousePos) {
        return;
    }
    const x = mousePos[0];
    const y = mousePos[1];
    const clickX = (x - canvas.offsetLeft) / clientWidth * 100;//) - canvas.offsetLeft;
    const clickY = y / clientHeight * 100;
    
    if (clickInfo.action) {
        if (clickInfo.action === 'text') {
            // mouseup doesnt fire when you call prompt
            mouseDown = false;
            const textInput = prompt('Input text');
            socketWorker.postMessage(JSON.stringify({
                type: 'input',
                input: textInput,
                nodeId: clickInfo.nodeId
            }));
        } else if (clickInfo.action === 'file') {
            mouseDown = false;
            const inputEl = document.getElementById('file-input');
            inputEl.click();
            inputEl.onchange = (e) => {
                if (inputEl.files.length > 0) {
                    const fileReader = new FileReader();
                    fileReader.onload = (data) => {
                        socketWorker.postMessage(JSON.stringify({
                            type: 'input',
                            // this is absolutely the wrong way to do this (????)
                            input: new Uint8Array(fileReader.result),
                            nodeId: clickInfo.nodeId
                        }));
                    };
                    fileReader.readAsArrayBuffer(inputEl.files[0]);
                }
            };
        }
    } else {
        if (clickX <= 100 && clickY <= 100) {
            const payload = {type: "click",  data: {x: clickX, y: clickY}};
            socketWorker.postMessage(JSON.stringify(payload));
        }
    }
};

const keydown = function(key) {
    const payload = {type: "keydown",  key: key};
    socketWorker.postMessage(JSON.stringify(payload));
};

const keyup = function(key) {
    const payload = {type: "keyup",  key: key};
    socketWorker.postMessage(JSON.stringify(payload));
};

const unlock = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)(); 
        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }
        for (const key in gameAssets) {
            if (gameAssets[key]["type"] === "audio" && !gameAssets[key]["decoded"]) {
                audioCtx.decodeAudioData(gameAssets[key].data, (buffer) => {
                    gameAssets[key].data = buffer;
                    gameAssets[key].decoded = true;
                });
            }
        }
    }
};

document.addEventListener("touchstart", unlock, false);

const canClick = (x, y) => {
    let isClickable = false;
    let action = null;
    let nodeId = null;

    if (x < canvas.offsetLeft - window.scrollLeft) {
        return false;
    }

    for (const chunkIndex in thingIndices) {
        const clickableIndexChunk = thingIndices[chunkIndex];

        let vertices = clickableIndexChunk[3];
        // TODO: fix this hack
        if (!vertices[0].length) {
            let verticesSwp = new Array(vertices.length / 2);
            for (let i = 0; i < vertices.length; i+=2) {
                verticesSwp[i/2] = [vertices[i], vertices[i+1]];
            }
            vertices = verticesSwp;
        }
        let isInside = false;

        let minX = translateX(vertices[0][0]);
        let maxX = translateX(vertices[0][0]);
        let minY = translateY(vertices[0][1]);
        let maxY = translateY(vertices[0][1]);

        if (vertices.length == 5 && false) {

            const startX = vertices[0][0];// * canvas.width / 100;
            const startY = vertices[0][1];// * canvas.height / 100;
            ctx.fillStyle = 'rgba(255,0,0,255)';
            ctx.fillRect(500, 500, 500, 500);
//            ctx.fillRect(translateX(startX), translateY(startY), 1000, 1000);
//            ctx.fillRect(textStartX * canvas.width / 100, thing.text.y * canvas.height / 100, textWidthPercent * canvas.width, textHeightPercent * canvas.height);


        }

        for (let i = 1; i < vertices.length; i++) {
            const vert = vertices[i];
            minX = Math.min(translateX(vert[0]), minX);
            maxX = Math.max(translateX(vert[0]), maxX);
            minY = Math.min(translateY(vert[1]), minY);
            maxY = Math.max(translateY(vert[1]), maxY);
        }

        if (!(x < minX || x > maxX || y < minY || y > maxY)) {
            let i = 0;
            let j = vertices.length - 1;
            for (i, j; i < vertices.length; j=i++) {
                if ((translateY(vertices[i][1]) > y) != (translateY(vertices[j][1]) > y) &&
                        x < (translateX(vertices[j][0]) - translateX(vertices[i][0])) * (y - translateY(vertices[i][1])) / (translateY(vertices[j][1]) - translateY(vertices[i][1])) + translateX(vertices[i][0])) {
                        isInside = !isInside;
                }
            }
        }
 
        if (isInside) {
            isClickable = clickableIndexChunk[0];
            action = clickableIndexChunk[1];
            nodeId = clickableIndexChunk[2];
        }


//        const intersects = (
//            x >= clickableIndexChunk[3] && 
//            x <= clickableIndexChunk[4]
//        ) && (
//            y >= clickableIndexChunk[5] && 
//            y <= clickableIndexChunk[6]) ;
//        if (intersects) {
//            isClickable = clickableIndexChunk[0];
//            action = clickableIndexChunk[1];
//            nodeId = clickableIndexChunk[2];
//        }
    }

    return {
        isClickable,
        action,
        nodeId
    }
};

const translateX = (x) => {
    const translated = (x * clientWidth / 100) + canvas.offsetLeft + window.scrollX;
    return translated;
};
const translateY = (y) => {
    return (y * clientHeight / 100) + canvas.offsetTop + window.scrollY;
};

window.addEventListener("mousedown", function(e) {
    mouseDown = true;
    mousePos = [e.clientX, e.clientY];
    unlock();
//    const clickInfo = canClick(mousePos[0], mousePos[1]);//e.clientX, e.clientY);
//    click(clickInfo);//e.clientX + window.scrollX, e.clientY + window.scrollY);
});

window.addEventListener("mouseup", function(e) {
    mouseDown = false;
});

canvas.addEventListener("mousemove", function(e) {
});

window.addEventListener("touchstart", function(e) {
    e.preventDefault();
    mouseDown = true;
    mousePos = [e.touches["0"].clientX + window.scrollX, e.touches["0"].clientY + window.scrollY];
//    const clickInfo = canClick(mousePos[0], mousePos[1]);//e.clientX, e.clientY);
//    click(clickInfo);
});

canvas.addEventListener("touchmove", function(e) {
    e.preventDefault();
    mouseDown = true;
    mousePos = [e.touches["0"].clientX + window.scrollX, e.touches["0"].clientY + window.scrollY];
});

window.addEventListener('touchend', () => {
    mouseDown = false;
});

function keyMatters(event) {
    // Key code values 36-40 are the arrow keys
    return event.key.length == 1 && event.key >= " " && event.key <= "z" || event.keyCode >= 36 && event.keyCode <= 40 || event.key === "Meta" || event.key == "Backspace";
}

function isMobile() {
    return /Android/i.test(navigator.userAgent);
}

if (isMobile()) {
} else {
    document.addEventListener("keydown", function(e) {
        if (keyMatters(e) && !keysDown["Meta"]) {
            e.preventDefault();
            keydown(e.key);
            keysDown[e.key] = true;
        }
    });
    document.addEventListener("keyup", function(e) {
        if (keyMatters(e)) {
            e.preventDefault();
            keyup(e.key);
            keysDown[e.key] = false;
        }
    });
}

window.addEventListener('mousemove', (e) => {
    mousePos = [e.clientX + window.scrollX, e.clientY + window.scrollY];
});

window.addEventListener('resize', () => {
    initCanvas(window.gameWidth, window.gameHeight);
    currentBuf && currentBuf.length > 1 && currentBuf[0] == 3 && renderBuf(currentBuf);
});


/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

const { squish, unsquish } = __webpack_require__(6);
const { gameNode, GameNode } = __webpack_require__(13);
const InternalGameNode = __webpack_require__(0);
const Colors = __webpack_require__(1);
const Game = __webpack_require__(15);
const Shapes = __webpack_require__(3);
const shapeUtils = __webpack_require__(16);

module.exports = {
    squish,
    unsquish,
    gameNode,
    Game,
    GameNode,
    Colors,
    Shapes,
    ShapeUtils: shapeUtils
};


/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

const InternalGameNode = __webpack_require__(0);
const Colors = __webpack_require__(1);

const assert = __webpack_require__(7);

const ASSET_TYPE = 1;

const COLOR_SUBTYPE = 42;
const ID_SUBTYPE = 43;
const PLAYER_ID_SUBTYPE = 44;
const POS_SUBTYPE = 45;
const SIZE_SUBTYPE = 46;
const TEXT_SUBTYPE = 47;
const ASSET_SUBTYPE = 48;
const EFFECTS_SUBTYPE = 49;
const ONCLICK_SUBTYPE = 50;
const INPUT_SUBTYPE = 51;
const COORDINATES_2D_SUBTYPE = 52;
const FILL_SUBTYPE = 53;
const BORDER_SUBTYPE = 54;

const { getFractional, hypLength } = __webpack_require__(12);

const squishSpec = {
    id: {
        type: ID_SUBTYPE,
        squish: (i) => {
            return [i];
        },
        unsquish: (arr) => {
            return arr[0];
        }
    },
    color: {
        type: COLOR_SUBTYPE,
        squish: (c) => {
            return [c[0], c[1], c[2], c[3]];
        },
        unsquish: (squished) => {
            return [squished[0], squished[1], squished[2], squished[3]];
        }
    },
    playerIds: {
        type: PLAYER_ID_SUBTYPE,
        squish: (i) => i,
        unsquish: (squished) => squished
    }, 
    pos: {
        type: POS_SUBTYPE,
        squish: (p) => {
            return [Math.floor(p.x), Math.round(100 * (p.x - Math.floor(p.x))), Math.floor(p.y), Math.round(100 * (p.y - Math.floor(p.y)))] 
        },
        unsquish: (squished) => {
            return {
                x: squished[0] + squished[1] / 100,
                y: squished[2] + squished[3] / 100
            }
        }
    },
    coordinates2d: {
        type: COORDINATES_2D_SUBTYPE,
        squish: (p, scale) => {
            const originalCoords = p.flat();
            const squished = new Array(originalCoords.length * 2);
 
            for (const i in originalCoords) {
                if (scale) {
                    const isX = i % 2 == 0;
                    const scaleValue = isX ? scale.x : scale.y;
                    const scaled = scaleValue * originalCoords[i];

                    const removedSpace = Math.round(100 * (1 - scaleValue));

                    const shifted = scaled + (removedSpace / 2);

                    squished[2 * i] = shifted;
                    squished[(2 * i) + 1] = getFractional(shifted);

                } else {
                    squished[2 * i] = Math.floor(originalCoords[i]);
                    squished[(2 * i) + 1] = Math.round(100 * (originalCoords[i] - Math.floor(originalCoords[i])));
                }
            }

            return squished;
        },
        unsquish: (squished) => {
            const unsquished = new Array(squished.length / 2);
            for (let i = 0; i < squished.length; i += 2) {
                const value = squished[i] + (squished[i + 1] / 100);
                unsquished[i / 2] = value;
            }
            return unsquished;
        }
    },
    fill: {
        type: FILL_SUBTYPE,
        squish: (c) => {
            return [c[0], c[1], c[2], c[3]];
        },
        unsquish: (squished) => {
            return [squished[0], squished[1], squished[2], squished[3]];
        }
    },
    size: {
        type: SIZE_SUBTYPE,
        squish: (s) => {
            return [Math.floor(s.x), Math.round(100 * (s.x - Math.floor(s.x))), Math.floor(s.y), Math.round(100 * (s.y - Math.floor(s.y)))] 
        },
        unsquish: (squished) => {
            return {
                x: squished[0] + squished[1] / 100,
                y: squished[2] + squished[3] / 100
            }
        }
    }, 
    text: {
        type: TEXT_SUBTYPE,
        squish: (t, scale) => {
            const textX = scale ? (t.x * scale.x) + Math.round(100 * (1 - scale.x)) / 2 : t.x;
            const textY = scale ? (t.y * scale.y) + Math.round(100 * (1 - scale.y)) / 2 : t.y;

            const align = t.align || 'left';
            const squishedText = new Array(t.text.length + 10 + align.length);
            
            squishedText[0] = Math.floor(textX);
            squishedText[1] = Math.round(100 * (textX - Math.floor(textX)));

            squishedText[2] = Math.floor(textY);
            squishedText[3] = Math.round(100 * (textY - Math.floor(textY)));
            
            const textSize = t.size || 1;
            const scaledTextSize = scale ? textSize * hypLength(scale.x, scale.y) : textSize;

            squishedText[4] = Math.floor(scaledTextSize);
            squishedText[5] = Math.round(100 * (scaledTextSize - Math.floor(scaledTextSize)));

            const textColor = t.color || Colors.BLACK;
            const squishedTextColor = squishSpec.color.squish(textColor);

            for (let i = 0; i < squishedTextColor.length; i++) {
                squishedText[6 + i] = squishedTextColor[i];
            }

            squishedText[6 + squishedTextColor.length] = align.length;

            for (let i = 0; i < align.length; i++) {
                squishedText[6 + squishedTextColor.length + 1 + i] = align.charCodeAt(i);
            }

            for (let i = 0; i < t.text.length; i++) {
                squishedText[6 + squishedTextColor.length + align.length + 1 + i] = t.text.charCodeAt(i);
            }
            
            return squishedText;
        }, 
        unsquish: (squished) => {
            const textPosX = squished[0] + squished[1] / 100;
            const textPosY = squished[2] + squished[3] / 100;
            const textSize = squished[4] + squished[5] / 100;
            const textColor = squished.slice(6, 10);
            const textAlignLength = squished[10];
            const align = String.fromCharCode.apply(null, squished.slice(11, 11 + textAlignLength));

            const text = String.fromCharCode.apply(null, squished.slice(11 + textAlignLength));

            return {
                x: textPosX,
                y: textPosY,
                text: text,
                size: textSize,
                color: textColor,
                align
            };
        }
    },
    asset: {
        type: ASSET_SUBTYPE,
        squish: (a, scale) => {
            const assetKey = Object.keys(a)[0];
            const squishedAssets = new Array(8 + assetKey.length);

            const asset = a[assetKey];

            const posX = scale ? ((scale.x * asset.pos.x) + Math.round(100 * (1 - scale.x)) / 2) : asset.pos.x;
            const posY = scale ? ((scale.y * asset.pos.y) + Math.round(100 * (1 - scale.y)) / 2) : asset.pos.y;

            const sizeX = scale ? scale.x * asset.size.x : asset.size.x;
            const sizeY = scale ? scale.y * asset.size.y : asset.size.y;

            squishedAssets[0] = Math.floor(posX);
            squishedAssets[1] = getFractional(posX);

            squishedAssets[2] = Math.floor(posY);
            squishedAssets[3] = getFractional(posY);

            squishedAssets[4] = Math.floor(sizeX);
            squishedAssets[5] = getFractional(sizeX);

            squishedAssets[6] = Math.floor(sizeY);
            squishedAssets[7] = getFractional(sizeY);

            for (let i = 0; i < assetKey.length; i++) {
                squishedAssets[8 + i] = assetKey.charCodeAt(i);
            }
            
            return squishedAssets;
        }, 
        unsquish: (squished) => {
            const assetPosX = squished[0] + squished[1] / 100;
            const assetPosY = squished[2] + squished[3] / 100;

            const assetSizeX = squished[4] + squished[5] / 100;
            const assetSizeY = squished[6] + squished[7] / 100;

            const assetKey = String.fromCharCode.apply(null, squished.slice(8));
            return {
                [assetKey]: {
                    pos: {
                        x: assetPosX,
                        y: assetPosY
                    },
                    size: {
                        x: assetSizeX,
                        y: assetSizeY
                    }
                }
            }
        }
    },
    effects: {
        type: EFFECTS_SUBTYPE,
        squish: (a) => {
            if (a['shadow']) {
                const assetKey = 'shadow';
                let squishedLength = assetKey.length + 4; // + 4 for color
                if (a['shadow'].blur) {
                    squishedLength += 2;
                }
                const squishedEffects = new Array(squishedLength);
                for (let i = 0; i < assetKey.length; i++) {
                    squishedEffects[i] = assetKey.charCodeAt(i);
                }
                squishedEffects[assetKey.length] = a.shadow.color[0];
                squishedEffects[assetKey.length + 1] = a.shadow.color[1];
                squishedEffects[assetKey.length + 2] = a.shadow.color[2];
                squishedEffects[assetKey.length + 3] = a.shadow.color[3];

                if (a.shadow.blur) {
                    squishedEffects[assetKey.length + 4] = Math.floor(a.shadow.blur / 10)
                    squishedEffects[assetKey.length + 5] = a.shadow.blur % 10
                }

                return squishedEffects;
            }
        },
        unsquish: (squished) => {
            // 'shadow' is all (for now)
            const assetKey = String.fromCharCode.apply(null, squished.slice(0, 6));
            const color = squished.slice(6, 10);
            let blur;
            if (squished.length > 10) {
                blur = squished[10] * 10 + squished[11];
            }

            const unsquished = {
                [assetKey]: {
                    color
                }
            };

            if (blur) {
                unsquished[assetKey].blur = blur;
            }

            return unsquished;
        }
    },
    handleClick: {
        type: ONCLICK_SUBTYPE,
        squish: (a) => {
            return a ? [1] : [0];
        },
        unsquish: (a) => {
            return a[0] === 1;
        }
    },
    border: {
        type: BORDER_SUBTYPE,
        squish: (a) => {
            return [a];
        },
        unsquish: (s) => {
            return s[0];
        }
    },
    input: {
        type: INPUT_SUBTYPE,
        squish: (a) => {
            const squished = new Array(a.type.length);
            for (let i = 0; i < a.type.length; i++) {
                squished[i] = a.type.charCodeAt(i);
            }
            return squished;
        },
        unsquish: (squished) => {
            return {
                type: String.fromCharCode.apply(null, squished)
            }
        }
    }
};

const squishSpecKeys = [
    'id', 
    'color', 
    'playerIds', 
    'coordinates2d',
    'fill',
    'pos', 
    'size', 
    'text', 
    'asset',
    'effects',
    'border',
    'handleClick',
    'input'
];

const typeToSquishMap = {};

for (const key in squishSpec) {
    typeToSquishMap[Number(squishSpec[key]['type'])] = key;
}

const unsquish = (squished) => {
        assert(squished[0] == 3);
    
        assert(squished.length === squished[1]);

        let squishedIndex = 2;

        let constructedGameNode = new InternalGameNode();

        while(squishedIndex < squished.length) {

            const subFrameType = squished[squishedIndex];
            const subFrameLength = squished[squishedIndex + 1];
            const subFrame = squished.slice(squishedIndex + 2, squishedIndex + subFrameLength);

            if (!typeToSquishMap[subFrameType]) {
                console.warn("Unknown sub frame type " + subFrameType);
                break;
            } else {
                const objField = typeToSquishMap[subFrameType];  
                const unsquishFun = squishSpec[objField]['unsquish'];
                const unsquishedVal = unsquishFun(subFrame);
                constructedGameNode[objField] = unsquishedVal;
            }
            squishedIndex += subFrameLength;
        }
        
        return constructedGameNode;
    }

const squish = (entity, scale = null) => {
    let squishedPieces = [];

    for (const keyIndex in squishSpecKeys) {
        const key = squishSpecKeys[keyIndex];
        if (key in entity) {
            const attr = entity[key];
            if (attr !== undefined && attr !== null) {
                const squished = squishSpec[key].squish(attr, scale);
                squishedPieces.push([squishSpec[key]['type'], squished.length + 2, ...squished]);
            }
        } 
    }

    const squished = squishedPieces.flat();
    return [3, squished.length + 2, ...squished];

}

module.exports = {
    squish,
    unsquish
};


/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(global) {

// compare and isBuffer taken from https://github.com/feross/buffer/blob/680e9e5e488f22aac27599a57dc844a6315928dd/index.js
// original notice:

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
function compare(a, b) {
  if (a === b) {
    return 0;
  }

  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }

  if (x < y) {
    return -1;
  }
  if (y < x) {
    return 1;
  }
  return 0;
}
function isBuffer(b) {
  if (global.Buffer && typeof global.Buffer.isBuffer === 'function') {
    return global.Buffer.isBuffer(b);
  }
  return !!(b != null && b._isBuffer);
}

// based on node assert, original notice:

// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var util = __webpack_require__(8);
var hasOwn = Object.prototype.hasOwnProperty;
var pSlice = Array.prototype.slice;
var functionsHaveNames = (function () {
  return function foo() {}.name === 'foo';
}());
function pToString (obj) {
  return Object.prototype.toString.call(obj);
}
function isView(arrbuf) {
  if (isBuffer(arrbuf)) {
    return false;
  }
  if (typeof global.ArrayBuffer !== 'function') {
    return false;
  }
  if (typeof ArrayBuffer.isView === 'function') {
    return ArrayBuffer.isView(arrbuf);
  }
  if (!arrbuf) {
    return false;
  }
  if (arrbuf instanceof DataView) {
    return true;
  }
  if (arrbuf.buffer && arrbuf.buffer instanceof ArrayBuffer) {
    return true;
  }
  return false;
}
// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

var regex = /\s*function\s+([^\(\s]*)\s*/;
// based on https://github.com/ljharb/function.prototype.name/blob/adeeeec8bfcc6068b187d7d9fb3d5bb1d3a30899/implementation.js
function getName(func) {
  if (!util.isFunction(func)) {
    return;
  }
  if (functionsHaveNames) {
    return func.name;
  }
  var str = func.toString();
  var match = str.match(regex);
  return match && match[1];
}
assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  } else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = getName(stackStartFunction);
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function truncate(s, n) {
  if (typeof s === 'string') {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}
function inspect(something) {
  if (functionsHaveNames || !util.isFunction(something)) {
    return util.inspect(something);
  }
  var rawname = getName(something);
  var name = rawname ? ': ' + rawname : '';
  return '[Function' +  name + ']';
}
function getMessage(self) {
  return truncate(inspect(self.actual), 128) + ' ' +
         self.operator + ' ' +
         truncate(inspect(self.expected), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

assert.deepStrictEqual = function deepStrictEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'deepStrictEqual', assert.deepStrictEqual);
  }
};

function _deepEqual(actual, expected, strict, memos) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;
  } else if (isBuffer(actual) && isBuffer(expected)) {
    return compare(actual, expected) === 0;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if ((actual === null || typeof actual !== 'object') &&
             (expected === null || typeof expected !== 'object')) {
    return strict ? actual === expected : actual == expected;

  // If both values are instances of typed arrays, wrap their underlying
  // ArrayBuffers in a Buffer each to increase performance
  // This optimization requires the arrays to have the same type as checked by
  // Object.prototype.toString (aka pToString). Never perform binary
  // comparisons for Float*Arrays, though, since e.g. +0 === -0 but their
  // bit patterns are not identical.
  } else if (isView(actual) && isView(expected) &&
             pToString(actual) === pToString(expected) &&
             !(actual instanceof Float32Array ||
               actual instanceof Float64Array)) {
    return compare(new Uint8Array(actual.buffer),
                   new Uint8Array(expected.buffer)) === 0;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else if (isBuffer(actual) !== isBuffer(expected)) {
    return false;
  } else {
    memos = memos || {actual: [], expected: []};

    var actualIndex = memos.actual.indexOf(actual);
    if (actualIndex !== -1) {
      if (actualIndex === memos.expected.indexOf(expected)) {
        return true;
      }
    }

    memos.actual.push(actual);
    memos.expected.push(expected);

    return objEquiv(actual, expected, strict, memos);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b, strict, actualVisitedObjects) {
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b))
    return a === b;
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b))
    return false;
  var aIsArgs = isArguments(a);
  var bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b, strict);
  }
  var ka = objectKeys(a);
  var kb = objectKeys(b);
  var key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length !== kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] !== kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key], strict, actualVisitedObjects))
      return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

assert.notDeepStrictEqual = notDeepStrictEqual;
function notDeepStrictEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'notDeepStrictEqual', notDeepStrictEqual);
  }
}


// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  }

  try {
    if (actual instanceof expected) {
      return true;
    }
  } catch (e) {
    // Ignore.  The instanceof check doesn't work for arrow functions.
  }

  if (Error.isPrototypeOf(expected)) {
    return false;
  }

  return expected.call({}, actual) === true;
}

function _tryBlock(block) {
  var error;
  try {
    block();
  } catch (e) {
    error = e;
  }
  return error;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (typeof block !== 'function') {
    throw new TypeError('"block" argument must be a function');
  }

  if (typeof expected === 'string') {
    message = expected;
    expected = null;
  }

  actual = _tryBlock(block);

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  var userProvidedMessage = typeof message === 'string';
  var isUnwantedException = !shouldThrow && util.isError(actual);
  var isUnexpectedException = !shouldThrow && actual && !expected;

  if ((isUnwantedException &&
      userProvidedMessage &&
      expectedException(actual, expected)) ||
      isUnexpectedException) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws(true, block, error, message);
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/error, /*optional*/message) {
  _throws(false, block, error, message);
};

assert.ifError = function(err) { if (err) throw err; };

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(2)))

/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(global, process) {// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = __webpack_require__(10);

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = __webpack_require__(11);

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(2), __webpack_require__(9)))

/***/ }),
/* 9 */
/***/ (function(module, exports) {

// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };


/***/ }),
/* 10 */
/***/ (function(module, exports) {

module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}

/***/ }),
/* 11 */
/***/ (function(module, exports) {

if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}


/***/ }),
/* 12 */
/***/ (function(module, exports) {

const hypLength = (x, y) => Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));

// get the first 2 digits after the decimal
const getFractional = (number) => {
    return Math.round(100 * (number - Math.floor(number)));
};

module.exports = {
    hypLength,
    getFractional
};


/***/ }),
/* 13 */
/***/ (function(module, exports, __webpack_require__) {

const listenable = __webpack_require__(14);
const InternalGameNode = __webpack_require__(0);
const Shapes = __webpack_require__(3);

const gameNode = (color, onClick, coordinates2d, border, fill, text, asset, playerIds, effects, input) => {
    const node = new InternalGameNode(color, onClick, coordinates2d, border, fill, text, asset, playerIds, effects, input);
    return listenable(node, node.onStateChange.bind(node));
};

class Shape {
    constructor({ color, onClick, shapeType, coordinates2d, border, fill, playerIds, effects, input }) {
        if (!coordinates2d || !shapeType) {
            throw new Error("Shape requires coordinates2d and shapeType");
        }

        this.node = gameNode(color, onClick, coordinates2d, border, fill, null, null, playerIds, effects, input);
        this.id = this.node.id;
    }

    addChild(child) {
        this.node.addChild(child);
    }

    addChildren(...nodes) {
        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
            this.addChild(nodes[nodeIndex]);
        }
    }

    removeChild(nodeId) {
        this.node.removeChild(nodeId);
    }

    addListener(listener) {
        this.node.addListener(listener);
    }

    clearChildren(excludedNodeIds) {
        this.node.clearChildren(excludedNodeIds);
    }
}

class Text {
    constructor({ textInfo, playerIds, input }) {
        if (!textInfo) {
            throw new Error("Text node requires textInfo");
        }

        this.node = gameNode(null, null, null, null, null, textInfo, null, playerIds, null, input);
        this.id = this.node.id;
    }

    addChild(child) {
        this.node.addChild(child);
    }

    addChildren(...nodes) {
        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
            this.addChild(nodes[nodeIndex]);
        }
    }

    removeChild(nodeId) {
        this.node.removeChild(nodeId);
    }

    addListener(listener) {
        this.node.addListener(listener);
    }

    clearChildren(excludedNodeIds) {
        this.node.clearChildren(excludedNodeIds);
    }
}

class Asset {
    constructor({ assetInfo, onClick, coordinates2d, playerIds }) {
        if (!assetInfo) {
            throw new Error("Asset node requires assetInfo");
        }
        this.node = gameNode(null, onClick, coordinates2d, null, null, null, assetInfo, playerIds);
        this.id = this.node.id;
    }

    addChild(child) {
        this.node.addChild(child);
    }

    addChildren(...nodes) {
        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
            this.addChild(nodes[nodeIndex]);
        }
    }

    removeChild(nodeId) {
        this.node.removeChild(nodeId);
    }

    addListener(listener) {
        this.node.addListener(listener);
    }

    clearChildren(excludedNodeIds) {
        this.node.clearChildren(excludedNodeIds);
    }


}

const GameNode = {
    Asset,
    Shape,
    Text
};

// todo: fix this hack
module.exports = {gameNode, GameNode};


/***/ }),
/* 14 */
/***/ (function(module, exports) {

const listenable = function(obj, onChange) {
    const handler = {
        get(target, property, receiver) {
            return Reflect.get(target, property, receiver);
        },
        defineProperty(target, property, descriptor) {
            const change = Reflect.defineProperty(target, property, descriptor);
            onChange && onChange();
            return change;
        },
        deleteProperty(target, property) {
            const change = Reflect.deleteProperty(target, property);
            onChange && onChange();
            return change;
        }
    };

    return new Proxy(obj, handler);
};

module.exports = listenable;


/***/ }),
/* 15 */
/***/ (function(module, exports) {

class Game {
    constructor() {
        this.players = {};
        this.listeners = new Set();
        this.root = null;
    }

    _hgAddPlayer(player) {
        this.players[player.id] = player;
    }

    _hgRemovePlayer(playerId) {
        delete this.players[playerId];
    }

    addStateListener(listener) {
        this.listeners.add(listener);
    }

    removeStateListener(listener) {
        this.listeners.remove(listener);
    }

    getRoot() {
        return this.root;
    }
}

module.exports = Game;



/***/ }),
/* 16 */
/***/ (function(module, exports) {

const rectangle = (startX, startY, width, height) => {
    return [
        [startX, startY],
        [startX + width, startY],
        [startX + width, startY + height],
        [startX, startY + height],
        [startX, startY],
    ];
};

const triangle = (x1, y1, x2, y2, x3, y3) => {
    return [
        [x1, y1],
        [x2, y2],
        [x3, y3],
        [x1, y1]
    ];
};


module.exports = {
    triangle,
    rectangle
}


/***/ })
/******/ ]);