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
let child = spawn("node", ["game_server"],
    {
        cwd: process.cwd(),
        detached: true,
        stdio: "inherit"
    }
);
    //, (err, stdout, stderr) => {
//    console.log(stdout);
//});

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
            child = spawn("node", ["game_server"],
                {
                    cwd: process.cwd(),
                    detached: true,
                    stdio: "inherit"
                }
            );

            //child = exec("node game_server", (err, stdout, stderr) => {
            //    console.log(stdout);
            //    console.error(stderr);
            //});
        }
//        console.log(fileName);
    }
}, 1000);
