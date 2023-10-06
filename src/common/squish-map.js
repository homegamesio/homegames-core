let isMain = true;

try {
    require.resolve('homegames-core');
    isMain = false;
} catch (err) {
    console.log('Running web as main module');
}

// versions before 1004 will fail when using electron because they use the wrong base data directory. when running in electron (not as main process), use 1004 instead of those older versions
const electronOverrideVersion = require.resolve('squish-1004');

module.exports = {
    '0756': isMain ? require.resolve('squish-0756') : electronOverrideVersion,
    '0762': isMain ? require.resolve('squish-0762') : electronOverrideVersion,
    '0765': isMain ? require.resolve('squish-0765') : electronOverrideVersion,
    '0766': isMain ? require.resolve('squish-0766') : electronOverrideVersion,
    '0767': isMain ? require.resolve('squish-0767') : electronOverrideVersion,
    '1000': isMain ? require.resolve('squish-1000') : electronOverrideVersion,
    '1004': require.resolve('squish-1004'),
};
