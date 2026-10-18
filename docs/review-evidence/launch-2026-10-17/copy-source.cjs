// Build first. Exercises real RTC, separate device storage and a cold offline
// browser restart. WebKit covers the engine, not an actual iOS installation UI.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { attachRtcSignaling } = require('homegames-common/rtc-signaling');
const { readDirectory, readArchive, options } = require('homegames-common/portable-project-node');
const { createProject, exportArchive } = require('homegames-common/portable-project');
const { buildStudioOffline } = require('../scripts/build-studio-offline');
const { buildGameApp } = require('../scripts/build-game-app');
const { readHtmlArchive } = require('homegames-common/portable-html');
const { importArchive } = require('homegames-common/portable-project');
// Chromium's compositor can retain the iframe hit-test surface briefly after
// a parent modal opens. Wait for its painted frames before pointer interaction.
const openOptions = async page => {
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('dialog', { name: 'Game options', exact: true }).evaluate(() =>
        new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};

(async () => {
    const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'homegames-copy-browser-'));
    const site = path.join(artifacts, 'site'); fs.cpSync(path.join(__dirname, '../web'), site, { recursive: true });
    process.env.HOMEGAMES_SITE_DIR = site;
    console.log('Artifacts:', artifacts);
    const server = require('../app');
    let rtc = attachRtcSignaling(server, { getIceServers: () => [] });
    const requests = []; server.on('request', req => requests.push({ method: req.method, url: req.url }));
    const engine = process.env.BROWSER_ENGINE || 'chromium', browserType = playwright[engine];
    const launchOptions = engine => ({ headless: true, ...(engine === 'chromium' ? { args: ['--disable-features=WebRtcHideLocalIpsWithMdns'],
        ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) } : {}) });
    const launch = launchOptions(engine);
    let browser, receiverContext;
    const errors = [], external = [], frames = [];
    const track = context => {
        context.on('request', req => { if (/^https?:/.test(req.url()) && new URL(req.url()).hostname !== '127.0.0.1') external.push(req.url()); });
        context.on('page', page => {
            page.setDefaultTimeout(30000); page.on('pageerror', e => errors.push(e.message));
            page.on('websocket', ws => ws.on('framesent', frame => frames.push(String(frame.payload))));
        });
        return context.addInitScript(() => {
            const Peer = RTCPeerConnection; window.testPeers = [];
            window.RTCPeerConnection = class extends Peer { constructor(...args) { super(...args); window.testPeers.push(this); } };
            window.testText = []; window.testImages = 0; window.testSounds = 0;
            const text = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function(...args) { window.testText.push(String(args[0])); if (window.testText.length > 500) window.testText.shift(); return text.apply(this, args); };
            const draw = CanvasRenderingContext2D.prototype.drawImage;
            CanvasRenderingContext2D.prototype.drawImage = function(...args) { window.testImages++; return draw.apply(this, args); };
            const start = AudioBufferSourceNode.prototype.start;
            AudioBufferSourceNode.prototype.start = function(...args) { window.testSounds++; return start.apply(this, args); };
        });
    };
    const share = async target => {
        const page = target.page ? target.page() : target;
        await page.bringToFront();
        await openOptions(page);
        await page.getByRole('button', { name: 'Share a copy', exact: true }).click();
        const input = target.getByRole('textbox', { name: 'Invitation link' });
        await input.waitFor().catch(async error => { console.error('SHARE UI', await page.locator('body').innerText(), await target.locator('body').innerText(), errors); throw error; });
        for (let i = 0; i < 100; i++) { if ((await input.inputValue()).includes('#copy=1')) return input.inputValue(); await new Promise(r => setTimeout(r, 50)); }
        throw Error('Copy invitation was not created: ' + await target.locator('body').innerText());
    };
    const saved = async page => { try { await page.locator('#status').filter({ hasText: 'Saved on this device' }).waitFor(); } catch (err) { console.error('RECEIVE DIAGNOSTIC', JSON.stringify({body:await page.locator('body').innerText(),errors,peers:await page.evaluate(()=>window.testPeers.map(p=>({connection:p.connectionState,ice:p.iceConnectionState,signaling:p.signalingState})))})); await page.screenshot({path:require('node:path').join(artifacts,'receive-timeout.png')}); throw err; } };
    const play = async page => {
        if (await page.locator('#play').isVisible()) await page.locator('#play').click();
        const frame = await (await page.locator('#player iframe').elementHandle()).contentFrame();
        await frame.waitForFunction(() => window.testText.includes('POCKET CHIME') && window.testImages > 0);
        const canvas = frame.locator('canvas'), bounds = await canvas.boundingBox();
        await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
        await frame.waitForFunction(() => window.testSounds > 0 && window.testText.includes('Chimes shared: 1'));
        assert.equal(await page.locator('#player iframe').getAttribute('sandbox'), 'allow-scripts allow-pointer-lock');
        return frame;
    };
    const accept = async page => { await page.waitForFunction(() => !document.getElementById('receive').disabled); await page.locator('#receive').click(); await saved(page); };
    const manifest = async page => {
        await page.locator('link[rel=manifest]').waitFor({ state: 'attached' });
        return page.evaluate(() => fetch(document.querySelector('link[rel=manifest]').href).then(r => r.json()));
    };
    try {
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
        const port = server.address().port, origin = `http://127.0.0.1:${port}`;
        const configFile = path.join(site, 'site-config.js');
        fs.writeFileSync(configFile, fs.readFileSync(configFile, 'utf8').replace(/"signalingUrl":"[^"]+"/, `"signalingUrl":"${origin.replace('http:', 'ws:')}/rtc"`));
        const client = fs.readdirSync(site).find(name => /^homegames-client\.[a-f0-9]{16}\.js$/.test(name));
        buildStudioOffline(path.join(__dirname, '..'), site, client);
        buildGameApp(path.join(__dirname, '..'), site, client);
        const original = await readDirectory(path.join(__dirname, '../../homegames-core/test/fixtures/portable-sound'));
        const files = Object.fromEntries(original.reader.listFiles().map(name => [name, original.reader.readFile(name)]));
        // A real archive above the 10 MiB RTC packet limit, including binary
        // material that cannot be compressed away. It must travel in chunks.
        files['notes.bin'] = require('node:crypto').randomBytes(11 * 1024 * 1024);
        const project = await createProject(files, options), zip = path.join(artifacts, 'source.zip');
        fs.writeFileSync(zip, await exportArchive(project));
        const senderEngine = process.env.SENDER_ENGINE || engine;
        browser = await playwright[senderEngine].launch(launchOptions(senderEngine));
        const senderContext = await browser.newContext({ acceptDownloads: true }); await track(senderContext);
        const studio = await senderContext.newPage(); await studio.goto(origin + '/studio.html'); await studio.locator('#portable-import:enabled').waitFor();
        await studio.locator('#portable-zip-input').setInputFiles(zip);
        await studio.waitForFunction(() => typeof currentGame !== 'undefined' && currentGame?.portable).catch(async error => { console.error('IMPORT DIAGNOSTIC', await studio.locator('body').innerText(), errors); throw error; });
        await studio.locator('#studio-export-menu > summary').click(); await studio.locator('#portable-share-copy').click();
        await studio.getByRole('textbox', { name: 'Invitation link' }).waitFor();
        await studio.getByRole('button', { name: 'Stop sharing', exact: true }).click();
        const htmlDownload = studio.waitForEvent('download'); await studio.locator('#studio-export-menu > summary').click(); await studio.locator('#portable-export-html').click();
        const html = path.join(artifacts, 'pocket-chime.html'); await (await htmlDownload).saveAs(html); await studio.close();
        const sender = await senderContext.newPage(); await sender.goto(pathToFileURL(html).href);
        const senderFrame = await (await sender.locator('iframe').elementHandle()).contentFrame();
        await sender.locator('.hg-player-status').filter({ hasText: 'Playing locally' }).waitFor();
        const invitation = await share(senderFrame);
        assert.equal(new URL(invitation).origin, origin);
        console.log('PASS: Studio imports and exports a playable HTML; local file creates a private copy invitation');

        assert.equal(new URL(invitation).pathname, '/game-app.html');
        assert.equal(new URL(invitation).searchParams.get('game'), project.manifest.gameId);
        const profile = path.join(artifacts, 'receiver-profile');
        receiverContext = await browserType.launchPersistentContext(profile, { ...launch, viewport: { width: 390, height: 844 }, acceptDownloads: true }); await track(receiverContext);
        let recipient = await receiverContext.newPage(); await recipient.goto(invitation);
        await recipient.waitForFunction(() => !document.getElementById('receive').disabled);
        assert.equal(await recipient.locator('iframe').count(), 0);
        await recipient.locator('#cancel').click(); assert.equal(await recipient.locator('iframe').count(), 0);
        await recipient.reload(); await accept(recipient);
        assert.equal(await recipient.locator('iframe').count(), 0, 'Receiving does not execute a game');
        assert.equal(await recipient.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await recipient.screenshot({ path: path.join(artifacts, 'received-mobile.png'), fullPage: true });
        const appManifest = await manifest(recipient);
        assert.equal(appManifest.name, 'Pocket Chime'); assert.equal(appManifest.id, new URL(invitation).pathname + new URL(invitation).search);
        assert.equal(appManifest.start_url, invitation); assert.equal(appManifest.scope, '/game-app');
        if (engine === 'chromium') {
            const cdp = await receiverContext.newCDPSession(recipient);
            const fetched = await cdp.send('Page.getAppManifest');
            assert.deepEqual(fetched.errors, []); assert.equal(JSON.parse(fetched.data).id, appManifest.id);
            const installability = await cdp.send('Page.getInstallabilityErrors');
            assert.deepEqual(installability.installabilityErrors, []);
            await cdp.detach();
        }
        const zipDownload = recipient.waitForEvent('download'); await recipient.locator('#zip').click();
        const receivedZip = path.join(artifacts, 'received.zip'); await (await zipDownload).saveAs(receivedZip);
        const received = await readArchive(receivedZip); assert.equal(received.revision, project.revision);
        for (const name of original.reader.listFiles()) assert.deepEqual(received.reader.readFile(name), original.reader.readFile(name), name);
        assert.deepEqual(received.reader.readFile('notes.bin'), new Uint8Array(files['notes.bin']));
        const receivedHtmlDownload = recipient.waitForEvent('download'); await recipient.locator('#download').click();
        const receivedHtml = path.join(artifacts, 'received.html'); await (await receivedHtmlDownload).saveAs(receivedHtml);
        assert.equal((await importArchive(readHtmlArchive(fs.readFileSync(receivedHtml, 'utf8')), options)).revision, project.revision);
        await sender.close(); await receiverContext.close();
        // Stop the origin, not just browser networking: WebKit's offline flag
        // can reject a navigation before its service worker gets the request.
        rtc.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
        receiverContext = await browserType.launchPersistentContext(profile, { ...launch, viewport: { width: 390, height: 844 }, acceptDownloads: true }); await track(receiverContext);
        recipient = await receiverContext.newPage(); await recipient.goto(origin + appManifest.id);
        await recipient.locator('#player iframe').waitFor(); await play(recipient);
        await recipient.screenshot({ path: path.join(artifacts, 'playing-offline-mobile.png'), fullPage: true });
        await recipient.reload(); await recipient.locator('.hg-player-status').filter({ hasText: 'Playing locally' }).waitFor();
        const offlineFile = await senderContext.newPage(); await offlineFile.goto(pathToFileURL(receivedHtml).href);
        await offlineFile.locator('.hg-player-status').filter({ hasText: 'Playing locally' }).waitFor();
        if (!await offlineFile.locator('#portable-html-copy').isVisible()) await openOptions(offlineFile);
        const secondHtmlDownload = offlineFile.waitForEvent('download'); await offlineFile.locator('#portable-html-copy').click();
        const secondHtml = path.join(artifacts, 'copied-again.html'); await (await secondHtmlDownload).saveAs(secondHtml);
        assert.equal((await importArchive(readHtmlArchive(fs.readFileSync(secondHtml, 'utf8')), options)).revision, project.revision);
        console.log('PASS: consent/cancel, >11 MiB RTC copy, identical source/media, downloadable self-contained HTML, per-game manifest; cold offline game launch and HTML file playback with the origin shut down');

        rtc = attachRtcSignaling(server, { getIceServers: () => [] }); await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
        const localFrame = await (await offlineFile.locator('iframe').elementHandle()).contentFrame();
        const reshared = await share(localFrame);
        // No copying of Safari storage: a separately installed app starts fresh.
        const installed = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        await track(installed); await installed.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
        const app = await installed.newPage(); await app.goto(reshared);
        assert.equal(await app.locator('iframe').count(), 0);
        await app.waitForFunction(() => !document.getElementById('receive').disabled);
        await manifest(app); assert.equal(await app.locator('#install-help').isVisible(), false);
        await app.evaluate(() => { const put = GameAppStorage.keep; GameAppStorage.keep = async (...args) => { window.persistingCopy = true; await new Promise(resolve => setTimeout(resolve, 1500)); return put(...args); }; });
        await app.locator('#receive').click(); await app.waitForFunction(() => window.persistingCopy);
        await localFrame.getByRole('button', { name: 'Stop sharing', exact: true }).click(); await saved(app);
        await installed.setOffline(true); await app.reload(); await app.locator('#player iframe').waitFor(); await play(app);
        assert.equal(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await installed.close(); await offlineFile.close();
        console.log('PASS: the received HTML itself shares onward; fresh Home Screen-style storage receives its own copy, survives sender disconnect during persistence, and launches directly offline');

        const recovery = await browser.newContext({ acceptDownloads: true }); await track(recovery);
        const recover = await recovery.newPage(); await recover.goto(invitation);
        await recover.locator('#status').filter({ hasText: 'invitation has ended or is invalid' }).waitFor();
        const recipientFrame = await (await recipient.locator('#player iframe').elementHandle()).contentFrame();
        const recoveryInvitation = await share(recipientFrame); await recover.goto(recoveryInvitation);
        await recover.waitForFunction(() => !document.getElementById('receive').disabled);
        await recover.evaluate(() => { GameAppStorage.keep = async () => { throw new Error('Device storage is full'); }; });
        await recover.locator('#receive').click(); await recover.locator('#status').filter({ hasText: 'Device storage is full' }).waitFor();
        const recoveredDownload = recover.waitForEvent('download'); await recover.locator('#download').click();
        const recoveredPath = path.join(artifacts, 'storage-recovery.html'); await (await recoveredDownload).saveAs(recoveredPath);
        assert.equal((await importArchive(readHtmlArchive(fs.readFileSync(recoveredPath, 'utf8')), options)).revision, project.revision);
        const noRuntime = await recovery.newPage(); await noRuntime.goto(recoveryInvitation);
        await noRuntime.waitForFunction(() => !document.getElementById('receive').disabled);
        await noRuntime.evaluate(() => { const original = window.fetch; window.fetch = (...args) => args[0] === HomegamesSiteConfig.runtimeUrl ? Promise.resolve(new Response('', { status: 503 })) : original(...args); });
        await noRuntime.locator('#receive').click(); await noRuntime.locator('#status').filter({ hasText: 'Could not load the player' }).waitFor();
        const sourceDownload = noRuntime.waitForEvent('download'); await noRuntime.locator('#zip').click();
        const sourcePath = path.join(artifacts, 'runtime-failure.zip'); await (await sourceDownload).saveAs(sourcePath);
        assert.equal((await readArchive(sourcePath)).revision, project.revision);
        await noRuntime.close();
        await recipientFrame.getByRole('button', { name: 'Stop sharing', exact: true }).click();
        await recover.goto(origin + '/game-app.html');
        // Only the embedded ZIP is imported; arbitrary HTML wrapper scripts are ignored.
        const poisoned = path.join(artifacts, 'wrapper.html'); fs.writeFileSync(poisoned, '<script>window.wrapperExecuted=true</script>' + fs.readFileSync(receivedHtml, 'utf8'));
        await recover.locator('#game-file').setInputFiles(poisoned); await saved(recover);
        assert.equal(await recover.evaluate(() => window.wrapperExecuted), undefined); assert.equal(await recover.locator('iframe').count(), 0);
        await play(recover);
        const firstIdentity = (await manifest(recover)).id;
        const secondFiles = { ...files, 'homegame.json': Buffer.from(JSON.stringify({ ...project.manifest, gameId: require('node:crypto').randomUUID() })),
            'index.js': Buffer.from(Buffer.from(files['index.js']).toString().replace('Pocket Chime', 'Another Chime')) };
        const secondProject = await createProject(secondFiles, options), secondZip = path.join(artifacts, 'second.zip'); fs.writeFileSync(secondZip, await exportArchive(secondProject));
        const second = await recovery.newPage(); await second.goto(origin + '/game-app.html');
        await second.locator('#game-file').setInputFiles(secondZip); await saved(second);
        const secondManifest = await manifest(second); assert.notEqual(secondManifest.id, firstIdentity); assert.equal(secondManifest.name, 'Another Chime');
        await recover.reload(); await recover.locator('#player iframe').waitFor(); await recover.waitForFunction(() => document.title === 'Pocket Chime');
        await second.reload(); await second.locator('#player iframe').waitFor(); await second.waitForFunction(() => document.title === 'Another Chime');
        await recover.goto(origin + '/studio.html');
        await recover.locator('#portable-zip-input').setInputFiles(receivedZip); await recover.locator('.portable-project').waitFor({ state: 'attached' });
        assert.equal(await recover.locator('.portable-project').count(), 1, 'Only an explicit Studio import creates an authoring project');
        await recovery.close();
        assert.deepEqual(external, []); assert.deepEqual(errors, []);
        assert.ok(requests.every(request => ['GET', 'HEAD'].includes(request.method)), 'No game content is uploaded over HTTP');
        for (const data of frames) assert.ok(['create', 'join', 'signal', 'heartbeat', 'remove'].includes(JSON.parse(data).type), 'Signaling carries no archive messages');
        assert.ok([...rtc.rooms.values()].every(room => room.visibility === 'private'));
        console.log('PASS: expired invitations, HTML recovery after storage failure, data-only HTML import, separate game identities/launches, explicit Studio restore, no external HTTP or uncaught errors');
    } finally {
        await receiverContext?.close(); await browser?.close(); rtc.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
