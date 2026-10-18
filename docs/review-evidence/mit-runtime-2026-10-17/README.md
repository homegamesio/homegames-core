# MIT / Squish 1.5.0 / author credits evidence

Local working-tree checkpoint, October 17, 2026. No npm publication, production
deployment or historical-release modification occurred. The maintainer will
publish incrementally; see [the release handoff](../../mit-release.md).

## Candidate and scope

`runtime-candidate.json` records the final staged packages in
`/tmp/homegames-mit-ready`, including exact tarball integrity and installed shared
module/bundle fingerprints. Squish is 1.5.0; Common 1.7.2 and Client 0.1.2 are
unpublished candidate contents with old source version fields. They are not the
registry releases bearing those version numbers. Assign new versions before
publishing Common/Client, then update consumers and all registry locks.

`verification.json` records the 147 source-game author checks and every selected
catalog package's identity, revision and author. Squarer remains Yazeed Loonat;
the other 146 source games credit Joseph Garcia. The current catalog selects 78
of these games, all credited to Joseph Garcia; Squarer is an internal fixture.
All selected ZIPs have MIT notices and runtime 150. The verifier also checks the
three npm tarballs' notices and integrity, the runtime map, complete embedded
dependency notices, and an HTML round trip preserving every project file plus a
separate third-party notice. It does not evaluate the imported game during this
round trip.

`source-fingerprints.json` records relevant first-party manifests, notices, game
entry points, the authoring guide, build/verification tools and generated catalog.
The source permissions/asset clearance are the maintainer's confirmations in the
conversation; no private assignment documents were copied into this repository.

## Results

| Check | Result |
| --- | --- |
| Squish | 38 passed, 0 failed. |
| Common | 40 passed, 0 failed. The old four-runtime parameterization is now one runtime. |
| Core broad default suite | 920 passed, 3 failed. The remaining failures are thumbnail requirements, screenshot inventory and Moonbounce's Patient Pendulum ordinary-shot replay. |
| Portable/runtime/export subset | 35 passed, 0 failed. Includes runtime rejection, source/media/license integrity, lifecycle, streams and bounded transfers. |
| Website units | 70 passed, 0 failed. |
| Native launcher/packaging units | 48 passed, 0 failed, 2 platform-specific checks skipped. Updated the incomplete test fixture to carry the shared metadata reader; no full native release was assembled. |
| Legacy project license policy | 1 passed; accepts complete MIT or the preserved GPL reference, rejects truncated/modified MIT. |
| Website build | 78 games, 12 featured. Final output includes notices and the current authoring guide. |
| All-game Chrome smoke | 78 passed through portable launch/render/initial input. This ran before the framed-coordinate fix and author metadata rewrite; the final runtime/export suites and browser flow below cover the resulting candidate. The all-game browser path is frameless. |
| Final Chrome flow | No-JS catalog/details, search, download, isolated play, private RTC guest, expired-invite recovery, Studio copy/export/import and mobile layout pass, without external HTTP requests. |
| Legacy web shell build | Passed; webpack reports its existing production-mode/bundle-size warnings. |
| Candidate dependency audits | All and production-only audits report 0 advisories in Common, Client, Core, website, legacy web shell and API. This is an advisory-database check, not an exploit-free guarantee. |

Logs have corresponding names in this directory. The test machine used Node 24
and Chrome 143.0.7499.169. Local server/browser tests needed sandbox escalation
for loopback listeners and Chrome launch. No live DNS or certificate operations
were performed. The separate historical CJS suites for the removed Tremulous
fixture were not rerun here.

The final documentation-only correction followed the audit and browser run.
`audited-runtime-candidate.json` identifies the exact audited tarballs;
`audit-comparison.json` records a member-by-member comparison with the final
candidate. Only Common's `docs/homegames-context.md` differs. Squish, Client,
all executable files, all package manifests and the built client are identical.
The final site was rebuilt and the artifact/author verifier rerun afterward.

The existing trailing whitespace on `pitch-pot/index.js`'s `addChild(bowl)` line
was outside this change. No gameplay code was changed to make the three existing
Core failures pass.

## Reproduce

Use Node 24 on PATH. Run `npm run stage:runtime -- --out NEW_DIRECTORY` in Core,
then `npm run build` in the website. In Core, run:

```sh
node tools/verify-mit-release.cjs NEW_DIRECTORY
npm test
node --test test/portable-project.test.cjs test/LocalJsonModules.test.cjs test/session/SquishRuntime.test.cjs test/session/UserExports.test.cjs test/session/ProjectTransfer.test.cjs
npm run audit:runtime -- NEW_DIRECTORY
```

Run `npm test` in Squish, Common, website and launcher. The browser scripts are
`test/catalog-browser.cjs` and `test/static-site-browser.cjs` in the website, with
`PLAYWRIGHT_MODULE`, `CHROME_PATH` and, for local RTC, `RTC_TEST_DISABLE_MDNS=1`.
The audit command writes disposable installs under the candidate's `audits/`;
use a new candidate directory for another complete run.

Publication/pins, live ACME/Route 53 and restart acceptance, forced TURN on real
networks, native/container release installation, physical-device performance,
curation/game playthroughs and a small user pilot remain open launch gates.
