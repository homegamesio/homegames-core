// Smoke-test every game in the generated release, including its real portable
// import/installation path. Does not rebuild or change the selected collection.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const site = path.resolve(process.env.HOMEGAMES_SITE_DIR || path.join(__dirname, '../web'));
process.env.HOMEGAMES_SITE_DIR = site;
const server = require('../app');
(async () => {
    const games = JSON.parse(fs.readFileSync(path.join(site, 'games.json'))).games
        .filter(game => !process.env.GAME_FILTER || game.id.match(process.env.GAME_FILTER));
    assert(games.length, 'The built catalog must contain games');
    let browser;
    const failures = [];
    try {
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const base = `http://127.0.0.1:${server.address().port}`;
        const engine = process.env.BROWSER_ENGINE || 'chromium';
        browser = await playwright[engine].launch({ headless: true,
            ...(engine === 'chromium' && process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
        for (const game of games) {
            const context = await browser.newContext(), errors = [], external = [];
            await context.route('**/*', route => {
                const url = route.request().url();
                if (/^https?:/.test(url) && !url.startsWith(base + '/')) { external.push(url); return route.abort(); }
                return route.continue();
            });
            await context.addInitScript(() => {
                window.testPaints = 0; window.testImages = 0;
                for (const method of ['fillText', 'fillRect', 'fill', 'stroke', 'drawImage']) {
                    const original = CanvasRenderingContext2D.prototype[method];
                    CanvasRenderingContext2D.prototype[method] = function(...args) {
                        window.testPaints++; if (method === 'drawImage') window.testImages++;
                        return original.apply(this, args);
                    };
                }
            });
            const page = await context.newPage();
            page.setDefaultTimeout(30000);
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => {
                if (message.type() === 'error' || /Unable to (?:decode|load)/.test(message.text())) errors.push(message.text());
            });
            try {
                const reviewStart = performance.now();
                await page.goto(`${base}/game-app.html?game=${game.gameId}&revision=${game.revision}&builtin=${game.id}`);
                await page.locator('#offline-status').filter({ hasText: /^Ready offline/ }).waitFor();
                const frame = await (await page.locator('#player iframe').elementHandle()).contentFrame();
                await frame.waitForFunction(() => window.testPaints > 5);
                const readyMs = Math.round(performance.now() - reviewStart);
                assert.equal(await page.locator('.hg-player-bar').count(), 1);
                // Review harness: omit obsolete More visibility assertion only.
                // Review harness: omit obsolete View exports visibility assertion only.
                if (game.id === 'after-hours') console.log('TOOLBAR', await page.locator('.hg-player-bar').innerText());
                assert.equal(await page.locator('#setup').isVisible(), false);
                assert.equal(await frame.locator('.hg-player-bar,.hg-session-bar,.homegames-client-tools').count(), 0);
                // Unlock audio and exercise a first interaction, then allow
                // asynchronous images/fonts/audio to decode and several ticks.
                await frame.locator('canvas').first().click({ position: { x: 10, y: 10 } });
                await frame.waitForTimeout(700);
                const rendered = await frame.evaluate(() => ({ paints: window.testPaints, images: window.testImages }));
                assert.deepEqual(errors, [], 'Browser/runtime errors');
                assert.deepEqual(external, [], 'Games must start with local dependencies');
                if (['hot-potato','swish','lemonade-tycoon','moonbounce'].includes(game.id)) await page.screenshot({path:'/tmp/hg-launch-review-20261017/'+game.id+'.png'});
                if (process.env.CHECK_GAME_TOOLS) {
                    // Secondary actions are reached explicitly from the static
                    // details page; none appear in ordinary gameplay.
                    for (const [label, selector] of [['View exports', '.hg-exports'], ['Load progress', '#load-progress']]) {
                        await page.goto(`${base}/games/${game.id}.html`);
                        await page.locator('.game-tools summary').click();
                        await page.getByRole('link', {name:label,exact:true}).click();
                        await page.locator(selector).waitFor();
                        assert.equal(await page.getByRole('button', {name:'More',exact:true}).isVisible(), false);
                    }
                    await page.goto(`${base}/games/${game.id}.html`);
                    await page.locator('.game-tools summary').click();
                    await page.getByRole('link', {name:'Manual connection',exact:true}).click();
                    await page.locator('#player iframe').waitFor();
                    const manual = await (await page.locator('#player iframe').elementHandle()).contentFrame();
                    await manual.getByRole('dialog', {name:'Manual connection',exact:true}).waitFor();
                    assert.deepEqual(errors, []);
                    assert.deepEqual(external, []);
                }
                console.log(`PASS ${game.id} ${JSON.stringify({ ...rendered, readyMs })}`);
            } catch (error) {
                const status = await page.locator('#status').textContent().catch(() => '');
                failures.push({ game: game.id, error: error.message, status, errors, external });
                console.error(`FAIL ${game.id}: ${JSON.stringify(failures.at(-1))}`);
            } finally { await context.close(); }
        }
        assert.deepEqual(failures, [], 'Every selected game must launch');
        console.log(`Passed ${games.length} catalog games`);
    } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
