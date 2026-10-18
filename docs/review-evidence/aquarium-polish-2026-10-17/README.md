# Aquarium polish — October 17, 2026

Local implementation and verification checkpoint. Nothing was published or deployed.

## Maintainer choices

- Title: **Aquarium**.
- Description, verbatim: **Manage an aquarium until it gets unreasonable**.
- Keep the wide aquarium; use a full-width shop with three larger items per page.
- Replace event flavor phrases with factual labels and bonuses. Keep creature and unlock names.
- Move Aquarium from 60 to 30 Hz to reduce CPU/network work while retaining game-time pacing.

The interview record is in `homegamesio/docs/content-interview.json`, outside the generated site. Existing automatic save/resume authorization remains in effect.

## Changes

Larger shop, touch camera controls, inspection and event text; wrapped status messages and bounded detail text. Every shop page maps to the correct item, including the last alien. Invisible information panels now have zero hit area until shown. The old inspection panel could silently intercept clicks; enlarging it exposed the defect in the browser test. Era resets remove old shop nodes, disconnected players release their records and votes, and joins enforce eight players. Keyboard feeding follows the water/space camera instead of always dropping into water. Event feedback reports the actual upgraded multiplier. The thumbnail is an unedited browser capture of an ordinary resumed purchase.

## Verification

- **20 Aquarium tests pass**: save/restore, failure/retry, coalescing, future-save preservation, bounded restoration and full-capacity saves; 200 join/leave cycles; three-item pagination; solo confirmation and strict-majority era resets; real-dispatch hit testing; feeding/cooldown; and 30/60 Hz comparison of timed saves, behavior, rewards and event duration.
- **55 existing scoped-frame/catalog checks pass**. All **32 selected games** pass the source/asset audit. Website build contains **32 games / 12 featured**.
- `aquarium-launch-browser.cjs`: normal touch feeding to earn the first purchase; unaffordable purchase rejected; guest shop privacy; purchased fish persist across host reload. Then explicitly seeded late-game scenarios check all shop pages and rendered text bounds, majority reset, removal of old shops, private touch zoom and era save/reload. Real local RTC; no external HTTP requests or browser errors.
- `aquarium-rtc-browser.cjs`: actual renderer, RTC workers and eight participants; 1,000 fish + 400 aliens; alternating water/space cameras; received frames match only the recipient's subtree byte-for-byte; offscreen fish detached; remote feeding and player cleanup; uninstrumented portable HTML opens. Full results and source fingerprints are preserved here.
- `aquarium-package-browser.cjs`: the generated package runs through ordinary feeding/purchase, reload, save download/import, and preserves an imported future-format save after the autosave interval. Downloaded HTML feeds, buys and resumes with the browser offline. This ran against revision `ecc99e91a70533e555cf458ae2e3af03ea319b3df30c0ee93f40375aecdf6982`.
- A thumbnail-only rebuild produced final revision **`888f3aa71abea828926af08724190e1d0a4cfc042c75165c00df45fe9ff4d456`**. The final generated catalog installation/opening smoke check passes. Gameplay source is unchanged from the full package test.

## Performance and remaining acceptance

At the final 30 Hz setting, the populated eight-player loopback run sustained about 30.4 host updates/sec and used **23.22 Mbps aggregate host application upload**, down from **48.98 Mbps** in the earlier 60 Hz run. Short samples and random scene placement make this an approximate comparison. Final host tick/serialization/frame-preparation p95 were **2.6/5.0/2.9 ms**, respectively. A populated single guest used **3.51 Mbps** underwater and **3.16 Mbps** in space; starter play used **2.30 Mbps**. No queued bytes remained at the measurement endpoint. These figures exclude SCTP/DTLS/IP overhead and are not EC2 or physical-phone capacity claims.

The ordinary opening is tested without granting money. Late-game populations and era readiness were seeded; this does **not** establish natural pacing through all expansions or long-term enjoyment. Physical phones, real groups, constrained uplinks, WAN/TURN, long soaks and final native/self-hosted artifacts remain launch acceptance work. A full aquarium is still network-heavy even at 30 Hz.

## Evidence files

`unit.log`, `scoped.log`, `browser.log`, `package.log`, `final-catalog.log`, `build.log`, `audit.json`, `performance-60.json`, `performance-30.json`, and `source-hashes.json`; phone shop/world/era captures, ordinary resumed gameplay, the refreshed thumbnail, and the offline resumed player screenshot.

Run the three Aquarium browser scripts with Node 24 and local Chrome. `PLAYWRIGHT_MODULE` and `CHROME_PATH` can override their defaults. The package test requires a current website build. These tests use only local fixtures; there are no production credentials or service mutations.
