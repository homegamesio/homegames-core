// Adapter over the canonical squish map in homegames-common.
// Maps version string → resolved module path (used for SQUISH_PATH and require()).
const { squishMap } = require('homegames-common');

const resolvedMap = {};

for (const [version, packageName] of Object.entries(squishMap)) {
    resolvedMap[version] = require.resolve(packageName);
}

module.exports = resolvedMap;
