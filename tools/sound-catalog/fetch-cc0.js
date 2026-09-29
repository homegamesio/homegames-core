// Downloads verified CC0 / public-domain audio collections that are legal to
// re-host in the Homegames public asset catalog.
//
// Sources (all verified 2026-08-19 — each is re-verified at fetch time by
// checking the source page still says CC0 before downloading):
//   kenney        — kenney.nl audio packs (CC0, game-ready SFX/jingles/voice)
//   kenney-images — kenney.nl 2D art packs (CC0 sprites/tiles/UI — ideal placeholders)
//   oga           — OpenGameArt packs explicitly released CC0 (retro SFX, creatures, sci-fi)
//   freepd  — FreePD music mirror on archive.org (CC0/public domain music;
//             freepd.com shut down in 2025, files remain CC0 forever).
//             Only the curated genre directories are taken — the item's root
//             and "Page2" contain unvetted strays (e.g. a BBC soundtrack) and
//             are excluded.
//
// Usage:
//   node tools/sound-catalog/fetch-cc0.js                         # kenney + oga + freepd default genres
//   node tools/sound-catalog/fetch-cc0.js --sources kenney,oga    # skip the big music grab
//   node tools/sound-catalog/fetch-cc0.js --freepd-genres epic,horror,upbeat
//   node tools/sound-catalog/fetch-cc0.js --dry-run               # show what would download
//
// Everything lands in tools/sound-catalog/downloads/<source>/... with a
// sources-manifest.json recording license + provenance per collection.
// Re-running skips files that already exist.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DEST = path.join(__dirname, 'downloads');

// FreePD genre dirs on the archive.org item, with approx sizes.
// 'misc' (950MB) and 'Page2' (4.5GB, unvetted) are opt-in via --freepd-genres.
const FREEPD_DEFAULT_GENRES = ['comedy', 'electronic', 'epic', 'featured', 'horror', 'romantic', 'scoring', 'upbeat', 'world'];
const FREEPD_ALL_GENRES = [...FREEPD_DEFAULT_GENRES, 'misc'];

const KENNEY_PACKS = [
    'ui-audio', 'rpg-audio', 'digital-audio', 'casino-audio', 'impact-sounds',
    'sci-fi-sounds', 'interface-sounds', 'music-jingles', 'voiceover-pack',
    'voiceover-pack-fighter'
];

// 2D image packs — placeholder/prototype-friendly game art (all CC0, verified 2026-08-19)
const KENNEY_IMAGE_PACKS = [
    'prototype-textures',       // literal placeholder textures
    'shape-characters', 'physics-assets',
    'pixel-platformer', 'new-platformer-pack', 'platformer-characters', 'background-elements',
    'pixel-shmup',              // space shooters
    'tiny-dungeon', 'tiny-town', 'rpg-urban-pack', 'roguelike-rpg-pack',
    'playing-cards-pack', 'boardgame-pack',
    'animal-pack', 'fish-pack',
    'ui-pack', 'game-icons', 'emotes-pack',
    'particle-pack', 'puzzle-pack-2', 'sokoban', 'racing-pack'
];

const OGA_PACKS = [
    { slug: '512-sound-effects-8-bit-style', author: 'Juhani Junkala (SubspaceAudio)' },
    { slug: '100-cc0-sfx', author: 'rubberduck' },
    { slug: '100-cc0-sfx-2', author: 'rubberduck' },
    { slug: '50-cc0-sci-fi-sfx', author: 'rubberduck' },
    { slug: '60-cc0-sci-fi-sfx', author: 'rubberduck' },
    { slug: '80-cc0-creature-sfx', author: 'rubberduck' }
];

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const getFlag = (name, def) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : def;
};
const DRY_RUN = args.includes('--dry-run');
const SOURCES = getFlag('sources', 'kenney,kenney-images,oga,freepd').split(',');
const genreArg = getFlag('freepd-genres', FREEPD_DEFAULT_GENRES.join(','));
const FREEPD_GENRES = genreArg === 'all' ? FREEPD_ALL_GENRES : genreArg.split(',');

const curlText = (url) => execFileSync('curl', ['-sL', '--fail', url], { maxBuffer: 64 * 1024 * 1024 }).toString();

const curlDownload = (url, dest) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const tmp = dest + '.part';
    execFileSync('curl', ['-sL', '--fail', '--retry', '2', url, '-o', tmp], { stdio: 'inherit' });
    fs.renameSync(tmp, dest);
};

const unzip = (zipPath, destDir) => {
    fs.mkdirSync(destDir, { recursive: true });
    execFileSync('unzip', ['-o', '-q', zipPath, '-d', destDir]);
};

const AUDIO_RE = /\.(wav|mp3|ogg|m4a|flac)$/i;
const IMAGE_RE = /\.(png|jpg|jpeg|gif|svg|webp)$/i;

// manual walk — readdirSync {recursive} needs Node >= 18.17
const countFiles = (dir, re) => {
    let n = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) n += countFiles(p, re);
        else if (re.test(entry.name)) n++;
    }
    return n;
};
const countAudioFiles = (dir) => countFiles(dir, AUDIO_RE);

const manifest = [];
const failures = [];

// ---------------------------------------------------------------------------
// kenney.nl — scrape each pack page for its zip URL, verify CC0 on the page
// ---------------------------------------------------------------------------

const fetchKenney = (packs, subdir, fileRe, countKey) => {
    for (const slug of packs) {
        const pageUrl = `https://kenney.nl/assets/${slug}`;
        const dir = path.join(DEST, subdir, slug);
        try {
            const html = curlText(pageUrl);
            if (!/CC0/i.test(html)) {
                console.log(`SKIP ${subdir}/${slug}: page no longer says CC0 — verify manually`);
                failures.push(`${subdir}/${slug} (license check failed)`);
                continue;
            }
            const m = html.match(/https:\/\/kenney\.nl\/media\/pages\/assets\/[^"'\s]*\.zip/);
            if (!m) throw new Error('no zip URL found on page');
            if (DRY_RUN) {
                console.log(`[dry-run] ${subdir}/${slug}  <- ${m[0]}`);
                continue;
            }
            if (fs.existsSync(dir) && countFiles(dir, fileRe) > 0) {
                console.log(`skip ${subdir}/${slug} (already downloaded)`);
            } else {
                const zipPath = path.join(DEST, subdir, `${slug}.zip`);
                curlDownload(m[0], zipPath);
                unzip(zipPath, dir);
                fs.unlinkSync(zipPath);
                console.log(`${subdir}/${slug}: ${countFiles(dir, fileRe)} files`);
            }
            manifest.push({
                source: 'kenney.nl', name: slug, license: 'CC0-1.0', attribution: 'none required',
                author: 'Kenney', page: pageUrl, dir: path.relative(DEST, dir),
                [countKey]: countFiles(dir, fileRe)
            });
        } catch (err) {
            console.error(`FAIL ${subdir}/${slug}: ${err.message}`);
            failures.push(`${subdir}/${slug}`);
        }
    }
};

// ---------------------------------------------------------------------------
// OpenGameArt — verified CC0 packs; re-check CC0 on the page, grab the file link
// ---------------------------------------------------------------------------

const fetchOga = () => {
    for (const { slug, author } of OGA_PACKS) {
        const pageUrl = `https://opengameart.org/content/${slug}`;
        const dir = path.join(DEST, 'opengameart', slug);
        try {
            const html = curlText(pageUrl);
            // The license badge on OGA pages links to the CC0 deed.
            if (!/creativecommons\.org\/publicdomain\/zero|CC0/i.test(html)) {
                console.log(`SKIP oga/${slug}: page no longer says CC0 — verify manually`);
                failures.push(`oga/${slug} (license check failed)`);
                continue;
            }
            const m = html.match(/href="(https:\/\/opengameart\.org\/sites\/default\/files\/[^"]*\.zip)"/);
            if (!m) throw new Error('no zip URL found on page');
            if (DRY_RUN) {
                console.log(`[dry-run] oga/${slug}  <- ${m[1]}`);
                continue;
            }
            if (fs.existsSync(dir) && countAudioFiles(dir) > 0) {
                console.log(`skip oga/${slug} (already downloaded)`);
            } else {
                const zipPath = path.join(DEST, 'opengameart', `${slug}.zip`);
                curlDownload(m[1], zipPath);
                unzip(zipPath, dir);
                fs.unlinkSync(zipPath);
                console.log(`oga/${slug}: ${countAudioFiles(dir)} audio files`);
            }
            manifest.push({
                source: 'opengameart.org', name: slug, license: 'CC0-1.0', attribution: 'none required',
                author, page: pageUrl, dir: path.relative(DEST, dir),
                audioFiles: countAudioFiles(dir)
            });
        } catch (err) {
            console.error(`FAIL oga/${slug}: ${err.message}`);
            failures.push(`oga/${slug}`);
        }
    }
};

// ---------------------------------------------------------------------------
// FreePD via archive.org — download mp3s from curated genre directories only
// ---------------------------------------------------------------------------

const fetchFreepd = () => {
    let meta;
    try {
        meta = JSON.parse(curlText('https://archive.org/metadata/freepd'));
    } catch (err) {
        console.error(`FAIL freepd: could not fetch archive.org metadata: ${err.message}`);
        failures.push('freepd (metadata)');
        return;
    }
    for (const genre of FREEPD_GENRES) {
        const tracks = meta.files.filter((f) =>
            f.name.startsWith(`${genre}/`) && f.name.toLowerCase().endsWith('.mp3'));
        if (tracks.length === 0) {
            console.log(`freepd/${genre}: no tracks found (bad genre name?)`);
            continue;
        }
        const totalMb = Math.round(tracks.reduce((s, f) => s + (+f.size || 0), 0) / 1048576);
        if (DRY_RUN) {
            console.log(`[dry-run] freepd/${genre}: ${tracks.length} tracks, ~${totalMb}MB`);
            continue;
        }
        console.log(`freepd/${genre}: ${tracks.length} tracks (~${totalMb}MB)`);
        let done = 0, skipped = 0;
        for (const f of tracks) {
            const dest = path.join(DEST, 'freepd', f.name);
            if (fs.existsSync(dest)) { skipped++; continue; }
            const url = 'https://archive.org/download/freepd/' +
                f.name.split('/').map(encodeURIComponent).join('/');
            try {
                curlDownload(url, dest);
                done++;
                if (done % 10 === 0) console.log(`  ...${done}/${tracks.length - skipped}`);
            } catch (err) {
                console.error(`  FAIL ${f.name}: ${err.message}`);
                failures.push(`freepd/${f.name}`);
            }
        }
        console.log(`  ${done} downloaded, ${skipped} already present`);
        manifest.push({
            source: 'freepd.com (archive.org mirror)', name: `freepd-${genre}`,
            license: 'CC0-1.0 / public domain', attribution: 'none required',
            author: 'Kevin MacLeod and FreePD contributors',
            page: 'https://archive.org/details/freepd', dir: `freepd/${genre}`,
            audioFiles: tracks.length - failures.filter((x) => x.startsWith(`freepd/${genre}/`)).length
        });
    }
};

// ---------------------------------------------------------------------------

fs.mkdirSync(DEST, { recursive: true });
if (SOURCES.includes('kenney')) fetchKenney(KENNEY_PACKS, 'kenney', AUDIO_RE, 'audioFiles');
if (SOURCES.includes('kenney-images')) fetchKenney(KENNEY_IMAGE_PACKS, 'kenney-images', IMAGE_RE, 'imageFiles');
if (SOURCES.includes('oga')) fetchOga();
if (SOURCES.includes('freepd')) fetchFreepd();

if (!DRY_RUN) {
    // merge with any manifest from a previous run so partial fetches accumulate
    const manifestPath = path.join(DEST, 'sources-manifest.json');
    let existing = [];
    if (fs.existsSync(manifestPath)) {
        existing = JSON.parse(fs.readFileSync(manifestPath)).filter(
            (e) => !manifest.some((m) => m.name === e.name));
    }
    const merged = [...existing, ...manifest];
    fs.writeFileSync(manifestPath, JSON.stringify(merged, null, 2));
    console.log(`\nmanifest: ${manifestPath} (${merged.length} collections)`);
}
if (failures.length) {
    console.error(`\n${failures.length} failures:\n  ${failures.join('\n  ')}`);
    process.exitCode = 1;
} else {
    console.log('all requested sources fetched cleanly');
}
