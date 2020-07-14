// this came from: https://www.sohamkamani.com/blog/javascript/making-a-node-js-test-runner/
const path = require('path');
const fs = require('fs');
let tests = [];

function test(name, fn) {
    tests.push({ name, fn });
}

function run() {
	tests.forEach(t => {
		try {
			t.fn();
			console.log('✅ (passed) ', t.name);
		} catch (e) {
			console.log('❌ (failed)', t.name);
			console.log(e.stack);
		}
	})
}

function searchForFiles(startPath, filter) {
	let toReturn = [];
	if (!fs.existsSync(startPath)){
		console.log("no dir: ", startPath);
		return [];
	}
	const files = fs.readdirSync(startPath);
	files.forEach(file => {
		const filename = path.join(startPath,file);
		if (fs.lstatSync(filename).isDirectory()) {
			const values = searchForFiles(filename, filter);
			toReturn = toReturn.concat(values);
		} else if (filename.indexOf(filter) > -1) {
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
})

run();