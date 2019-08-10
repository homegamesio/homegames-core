const data = require("./dictionary");
const length = data.length;

const generateName = (numberOfWords) => {
	let toReturn = "";
	for(let i = 0; i < numberOfWords - 1; i++) {
		toReturn += `${data[Math.floor( Math.random() * length )]} `;
	}
	toReturn += `${data[Math.floor( Math.random() * length )]}`;
	return toReturn;
};

module.exports = generateName;
