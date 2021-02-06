console.log('hello!');
const WebSocket = require('ws');
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');

const hotloadClients = {};

const getAllFiles = (dirPath, arrayOfFiles) => {
  files = fs.readdirSync(dirPath)

  arrayOfFiles = arrayOfFiles || []

    files.forEach((file) => {
        if (file.charAt(0) === '.') {
            return;
        }
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
        } else {
            arrayOfFiles.push(path.join(__dirname, dirPath, "/", file))
        }
    });

    return arrayOfFiles
};

const fileData = {};
let child = spawn("node", ["index"],
    {
        cwd: process.cwd(),
        detached: true,
        stdio: "inherit"
    }
);

setInterval(() => {
    const filePaths = getAllFiles('./src/');
    for (const i in filePaths) {
        const fileName = filePaths[i];
        const fileContent = fs.readFileSync(fileName);
        if (!fileData[fileName]) {
            fileData[fileName] = fileContent;
        } else if (fileData[fileName].compare(fileContent) !== 0) {
            fileData[fileName] = fileContent;
            let hadChild = !!child;
            if (child) {
                child.kill();
            }
            child = spawn("node", ["index.js"],
                {
                    cwd: process.cwd(),
                    detached: true,
                    stdio: "inherit"
                }
            );
            // todo: get ready state from new one

            console.log("DID HAD CHILD");
            if (hadChild) {
                setTimeout(() => {
                    console.log("HAD CHILD");
                    for (const wsId in hotloadClients) {
                        hotloadClients[wsId].send('reload');
                    }
                }, 1000);
            }


        }
    }
}, 500);

const server = http.createServer();

let clientId = 0;
const hotloadServer = new WebSocket.Server({
    server
});

hotloadServer.on('connection', (ws) => {
    console.log('hotload client connected');
    clientId += 1;
    ws.id = clientId;
    hotloadClients[ws.id] = ws;

    ws.on('close', () => {
        console.log('client left :(');
        delete hotloadClients[ws.id];
    });
});

console.log('lisng');
server.listen(7101);

process.on('exit', () => {
    child && child.kill()
});

process.on('SIGINT', () => child && child.kill());

