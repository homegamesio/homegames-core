console.log('hello!');
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process');

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

        }
    }
}, 500);

process.on('exit', () => child && child.kill());
process.on('SIGINT', () => child && child.kill());
