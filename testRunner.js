// this came from: https://www.sohamkamani.com/blog/javascript/making-a-node-js-test-runner/
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

const files = process.argv.slice(2);
global.test = test;

files.forEach(file => {
	require(file);
})

run();