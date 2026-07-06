// this came from: https://www.sohamkamani.com/blog/javascript/making-a-node-js-test-runner/
const path = require('path');
const fs = require('fs');

const packageRoot = path.dirname(require.main.filename);

global.gameRoot = `${packageRoot}/src/games`;

const tests = [];

function test(name, fn) {
    tests.push({ name, fn });
}

async function run() {
    let failures = 0;
    for (const t of tests) {
        try {
            await t.fn(); // awaiting a non-promise is a no-op, so sync tests still work
            console.log('✅ (passed) ', t.name);
        } catch (e) {
            failures++;
            console.log('❌ (failed)', t.name);
            console.log(e.stack);
        }
    }
    if (failures > 0) {
        process.exitCode = 1;
    }
}

function searchForFiles(startPath, filter) {
    let toReturn = [];
    if (!fs.existsSync(startPath)){
        console.log('no dir: ', startPath);
        return [];
    }
    const files = fs.readdirSync(startPath);
    files.forEach(file => {
        const filename = path.join(startPath,file);
        const filenamePieces = filename.split('/');
        if (fs.lstatSync(filename).isDirectory()) {
            const values = searchForFiles(filename, filter);
            toReturn = toReturn.concat(values);
        } else if (filenamePieces[filenamePieces.length - 1].charAt(0) != '.' && filename.indexOf(filter) > -1) {
            toReturn.push(`./${filename}`);
        }
    });
    return toReturn;
}

let files = process.argv.slice(2);
global.test = test;

if (!(files && files.length)) {
    files = searchForFiles('./test','.test.js');
}

files.forEach(file => {
    require(`${file}`);
});

run();
