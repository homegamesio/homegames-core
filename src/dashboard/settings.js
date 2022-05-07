const { fork } = require('child_process');
const http = require('http');
const https = require('https');
const path = require('path');
const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-0710');
const unzipper = require('unzipper');
const fs = require('fs');

export default function SettingsModal() {
	return new GameNode.Shape({
		shapeType:
	})
}