# Published runtime and Docker opt-in verification

October 17, 2026. The maintainer published Squish **1.5.0**, Common **1.7.3** and
Client **0.2.0**. This pass downloaded and inspected those npm releases, refreshed
active consumer locks, clean-installed, rebuilt and tested locally. No production
deployment, npm publication or service restart was performed by this pass.

## Registry and artifact checks

`registry-release.json` contains the actual npm tarball integrity values.
`published-comparison.json` compares their extracted files with the previously
reviewed local candidate. Squish files are identical; Common changes only its
package version. Client changes its manifest and built notices/bundle.
`bundle-comparison.json` verifies the entire client bundle is identical after
normalizing the Common/Client version labels in its notice block. Tarball
integrity can differ even when extracted file contents are identical.

`registry-installs.json` records successful lock refresh and clean installs in
Common, Client, Core, website, API, legacy web shell, Docker runner and native
launcher. Installs used Node 24, disabled lifecycle scripts and fetched real npm
packages. The active locks contain no old Squish aliases or temporary tarballs.
The native launcher intentionally links its sibling Core checkout. Retired API
tooling and the Mac worker remain outside this release graph and were not
installed or upgraded.

`verification.json` checks registry lock integrity/version pins and installed MIT
metadata, all 147 Core authors, all 78 selected ZIPs, the single runtime, full
embedded dependency notices and a complete HTML export/import preserving a
separate third-party notice. The website uses published Client 0.2.0; it was not
rebuilt against an unpublished Common replacement.

## Results

| Check | Result |
| --- | --- |
| Common | 40 passed |
| Website | 70 passed |
| API | 29 passed; live ACME/DNS and the separate MongoDB integration suite were not run here |
| Core session/input/web | 215 passed |
| Portable/runtime/export/CSR | 38 passed |
| Launcher before setting change | 48 passed, 2 platform-specific skips |
| Website build | 78 games / 12 featured |
| Legacy web shell build | Passed, with existing webpack mode/size warnings |
| Chrome 143.0.7499.169 | No-JS browsing, search, pack download, isolated play, private RTC invitations/expiry, Studio copy/export/import and mobile layout passed |
| Registry audits | Zero advisories, both complete and production-only, across all eight installs |

The preceding broad Core run had 920 passing checks and three failures involving
thumbnails, screenshot inventory and Moonbounce's Patient Pendulum playthrough.
That broad suite was not repeated: the published executable files match the
reviewed candidate. Those failures remain launch work. All-game Chrome smoke was
also retained from the preceding pass; this pass reran the representative full
browser flow with the actual published bundle.

Docker is installed but its daemon socket was absent. The Docker runner's lock
and clean install were checked; no image build or container acceptance is claimed.
No full native release was built or signed. Physical-device/WAN/TURN and live
certificate/discovery acceptance remain open.

## Dashboard setting

The existing host-only fork permission is now labeled **Run games without
Docker**, with a small adjacent warning: **Games run on your machine outside of
a sandbox.** Core explicitly defaults it to false, and new native bundles now
ship false instead of automatically enabling it. Existing saved choices retain
their normal config precedence. Docker remains preferred; the toggle permits
fallback child processes for subsequent server sessions when Docker is absent.
No restart is required for that permission change. The restart hint now names
only page-size and port changes, and the launch error points to the current label.

Separate checks after this change passed: **12** settings/fork tests, **9** native
config/build tests and **6** host-access integration scenarios. They exercise
default gating, live permission changes, bundle defaults and guest/disconnected
host rejection. A temporary portable fixture rendered the actual settings-modal
source with the published browser runtime; Chrome verified Off → On → Off using
rendered pixel states and reported no browser errors. `settings-off.png` and
`settings-on.png` show the layout with another setting's restart notice visible
to check that the warning does not overlap it. This fixture does not write any
real host configuration; authorization/persistence are covered by the separate
host-access tests.

These UI/config changes affect Core and the native bundle builder only. No new
Common or Client release is needed for them.

## Reproduction

Use Node 24 and `npm ci --ignore-scripts` in each active repository (including
Core's `docker/` and the launcher), then run the respective `npm test` suites.
In Core, run `npm run test:sessions`, the portable/export/CSR tests named in
`portable-tests.log`, and:

```sh
node testRunner.js ./test/dashboard/SettingsModal.test.js ./test/SessionForkGate.test.js
node --test test/host-access.test.cjs
```

Build the website with `npm run build`; its `test/static-site-browser.cjs` needs
`PLAYWRIGHT_MODULE`, `CHROME_PATH` and `RTC_TEST_DISABLE_MDNS=1` for local RTC.
Run `npm audit --json` and `npm audit --omit=dev --json` in the eight installs.
Download the three registry tarballs to a fresh directory, copy the recorded
`registry-release.json` there, then run Core's
`node tools/verify-mit-release.cjs DIRECTORY` after building the site.

Logs, advisory reports and relevant source/lock fingerprints are retained here.
Earlier evidence directories remain historical snapshots.
