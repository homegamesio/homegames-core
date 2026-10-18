# MIT and Squish 1.5.0 release handoff

Squish 1.5.0, Common 1.7.3 and Client 0.2.0 are published and verified on npm.
Active consumers now use clean registry installs. No production deployment was
performed during this verification.
This covers the eleven repositories in this launch workspace: Squish, Common,
Client, Core, API, website, legacy web shell, Link, Homepad, launcher and retired
Mac worker. Historical releases keep their existing licenses and contents.

## Scope and attribution

The maintainer confirmed written permission or assignments for the contributors
identified during review, and confirmed that Homegames assets are cleared for
MIT. First-party source, game notices, templates, examples and cleared media now
use MIT. Existing MIT copyright notices are retained; newly supplied notices
credit Joseph Garcia and Homegames contributors.

Every Core game except Squarer now declares `author: 'Joseph Garcia'`: 146 of
147 game directories, including internal fixtures. Squarer still credits
Yazeed Loonat. All 78 selected website games carry Joseph Garcia through their
catalog records and downloadable source packages. Game IDs are unchanged;
source revisions change when metadata, imports or license files change.

Third-party dependency and media terms remain separate. The client build gathers
full notices from bundled modules, embeds them in its JavaScript after
minification, and writes a sidecar. Standalone HTML carries the same embedded
notices. ZIPs preserve project notices, including third-party files; importing or
exporting someone else's project does not relicense it. The launcher copies its
own notices and preserves package/game notices in the production tree.

The optional sound-tool download cache is not part of the website release and
retains upstream terms; in particular, its Kenney Future font metadata declares
CC BY-SA 3.0. Historical audit records and the API's legacy GPL reference text
remain intact. The retained legacy project validator accepts complete MIT or
the original GPL text; this does not restore the retired publishing service.

## One bundled runtime

New builds support only `squishjs@1.5.0`, aliased as `squish-150`. All built-in
game imports and the shared/browser runtime maps use 150. Earlier npm versions
remain untouched. The maintainer chose not to add an upgrade UI for old saved
or imported games: old runtime imports are rejected rather than silently
substituting 150. Manual source updates require a fresh playthrough.

Squish 1.5.0 starts from the 1.4.6 implementation and adds a regression-covered
coordinate clamp for scaled, framed game layers. Unscaled layers retain their
existing byte-safe slide-off range. The authoring guide now describes the actual
150 behavior for held presses, drag/release, hover, text hit targets, cropping,
streams and per-player visibility. It retains the existing performance guidance
on change notifications, detached nodes and snapshot/network budgets.

## Published packages and consumer locks

| Package | Published MIT version |
| --- | --- |
| Squish | `squishjs@1.5.0`, installed as `squish-150` |
| Common | `homegames-common@1.7.3` |
| Client | `homegames-client@0.2.0`, with Common pinned to 1.7.3 |

The downloaded registry tarballs match the reviewed candidate's source files.
Common differs only in its version field. Client differs in package version,
Common pin, and the version labels in its embedded notices; its executable bundle
is unchanged after normalizing those notice labels. Squish's files are identical.

Registry lock refresh and clean `npm ci --ignore-scripts` passed in Common,
Client, Core, website, API, legacy web shell, Docker runner and native launcher.
These active locks contain no old Squish aliases or temporary candidate tarball
paths. The launcher deliberately retains its workspace `file:../homegames-core`
dependency; final native packaging must copy and verify that production tree.
The retired API tooling and Mac worker keep their historical manifests and are
not release dependencies.

The website and legacy web shell were rebuilt using published Client 0.2.0.
The final HTML verifier confirms the single runtime and preserved project and
third-party notices. All eight registry installations have zero npm advisories
in both all-dependency and production-only reports. See the
[published-package evidence](review-evidence/published-runtime-2026-10-17/README.md).

Remaining artifact work: publish other first-party packages under new versions
where needed, build and accept the final native/container releases, then deploy
and run the live acceptance checks. Docker's daemon was unavailable during this
pass, so the runner's lock/install was checked but its image was not built.

For future unpublished changes, local preparation remains available (Node 24 on PATH, run from Core):

```sh
npm run stage:runtime -- --out /tmp/homegames-mit-new-candidate
# In the website repository:
npm run build
# Back in Core:
node tools/verify-mit-release.cjs /tmp/homegames-mit-new-candidate
npm run audit:runtime -- /tmp/homegames-mit-new-candidate
```

Use a new output directory each time. Staging packs Squish, then Common, builds
and packs Client, and installs the exact tarballs into local consumers. It does
not update release locks or publish. Verification checks package notices, all
Core authors, all selected game ZIPs, the single runtime map and a complete HTML
export/import with an unchanged third-party notice.

## Verification and remaining gates

The original [MIT/runtime evidence](review-evidence/mit-runtime-2026-10-17/README.md)
is retained. The new published-package pass covers Common 40, website 70, API 29,
Core session/input/web 215, portable/export/CSR 38, and launcher 48 passed with
two platform checks skipped. The rebuilt site and Chrome private RTC/Studio flow
pass. The new dashboard-setting checks are recorded separately in that evidence.

In the preceding broader migration pass:
The local site builds 78 games and 12 featured selections. Chrome's all-game
smoke and final private-invite/Studio/export/import checks pass. Squish passes
38 tests, Common 40, website 70, portable/runtime/export checks 35, and launcher
48 with two platform-specific checks skipped. The broad Core suite passes 920
checks and retains three failures: thumbnail requirements, screenshot inventory,
and Moonbounce's Patient Pendulum playthrough. They remain launch work.

This does not close live certificate/Route 53 acceptance, forced TURN on separate
networks, final native/container installs, physical-device performance, featured
game playthroughs or the small user pilot. Existing downloaded HTML and installed
native apps keep their embedded old runtimes until replaced.
