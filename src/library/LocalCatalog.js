'use strict';
// The dashboard's existing browse/search interface, backed entirely by disk.
function createLocalCatalog(library) {
    const records = () => Object.entries(library.scan()).map(([id, game]) => ({ id,
        name: game.metadata.name || id, description: game.metadata.description || '',
        developerId: game.metadata.author || '', thumbnail: game.metadata.thumbnail || null,
        isTest: game.metadata.isTest, versions: game.versions }));
    const visible = () => records().filter(game => require('homegames-common').getConfigValue('TESTS_ENABLED', false) || !game.isTest);
    const find = id => { const game = records().find(game => game.id === id); if (!game) throw new Error('Game is not installed on this server'); return game; };
    return {
        list: async ({ offset = 0, limit = 12 } = {}) => ({ games: visible().slice(offset, offset + limit) }),
        searchGames: async query => ({ games: visible().filter(game => `${game.name} ${game.description} ${game.developerId}`.toLowerCase().includes(query.toLowerCase())) }),
        getGameDetails: async id => { const game = find(id); return { game, versions: Object.values(game.versions).map(v => ({ ...v, id: v.versionId })) }; },
        getGameVersionDetails: async (id, versionId) => find(id).versions[versionId],
        getPublishedVersions: async () => ({ versions: [] }),
    };
}
module.exports = { createLocalCatalog };
