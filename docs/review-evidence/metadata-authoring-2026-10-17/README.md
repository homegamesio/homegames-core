# Metadata and authoring checkpoint

Local validation of the October 17, 2026 working trees. No deployment, registry publication or license change occurred. The launch review records the scope and remaining gates.

- `common-tests.log`: 39 passing checks.
- `core-metadata-unit.log`: 14 passing checks, including all 78 identities, save schemas and dashboard keys.
- `core-http.log`: 14 passing portable import/local-play checks.
- `core-sessions.log`: 224 passing session/input/save/web checks.
- `website-tests.log`: 64 passing checks; ChatGPT project/MCP logs contain 7 and 1 passing checks.
- `metadata-browser.log`: actual Studio v1/v2 compatibility, solo controls and editable-copy checks.
- `examples-browser.log`: examples, two localhost RTC players, mobile layout, explicit unsaved-edit cancellation/save, exports and recovery.
- `catalog-browser.log`: all 78 selected games launch/render/respond through portable installation with external HTTP blocked.
- `authoring-examples.cjs` and its log: both full guide examples validate, round-trip and exercise their input/lifecycle hooks. Run the script with Node 24 in the sibling checkout layout.
- `core-catalog-audit.log`: intentionally retained failures for four thumbnail requirements and stale screenshot inventory. These are not closed by this checkpoint.
- `runtime-candidate.json`, `stage.log`, `site-build.log`, `games.json`, `identities-before.json`, `source-sha256.json` and `results.json`: artifact/source identity and results.

The Common/Client tarballs were built and installed with `npm run stage:runtime -- --out /tmp/homegames-metadata-runtime-4`. They use existing package version fields but contain unpublished source changes; `npm ci` restores the registry baseline. The staging command verified unchanged consumer manifests/locks. Every installed Common top-level JavaScript file and the copied authoring guides were checked against source before recording these fingerprints.

Browser tests use Node 24, Playwright and Chrome, disposable localhost servers and isolated browser profiles. They do not prove real TURN/WAN behavior, complete game playthroughs, physical mobile performance or an entire release suite. Passing suites overlap; do not sum their counts. Earlier browser harness timing/menu/unsaved-edit assumptions were corrected; the saved browser logs are the final passing runs. No production code changed after the tested website build.
