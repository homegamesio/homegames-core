**Security and dependency checkpoint — October 17, 2026**

Local working-tree evidence for the launch cleanup. Nothing was published or deployed. Existing unrelated changes remain in these repositories. This directory records targeted verification, not a certification of the complete release.

**Results**

| Evidence | Result |
| --- | --- |
| `common-tests.log` | 49 passing tests, including guarded archive extraction, download limits, network identity, registration budgets and exception containment. |
| `api-tests.log` | 32 passing tests: connection API, certificate policy/runner, DNS-only ACME and real local MongoDB recovery. ACME includes a signed exchange through native fetch to a local HTTPS fixture with certificate verification enabled. No live CA or AWS calls. |
| `core-csr-tests.log`, `core-certificate-tests.log` | 3 CSR tests and 10 certificate-manager tests pass. Existing RSA/EC key formats, renewal identity and interrupted submission are covered. |
| `link-tests.log` | 9 passing local HTTP/WebSocket tests with AWS writes disabled. |
| `legacy-mcp-tests.log` | 17 passing tests for the retained account/Forgejo adapter; that adapter is excluded from the current launch. |
| `website-tests.log`, `website-build.log` | 70 tests pass; 78 games / 12 featured selections build. |
| `website-browser.log` | Chrome 143.0.7499.169 passes catalog/search/download/play/private RTC/expired invite/copy/export/import/mobile layout, with no external HTTP requests. Local direct RTC does not establish TURN or WAN compatibility. |
| `stage-runtime.log`, `runtime-candidate.json` | Final unpublished Common/Client tarball integrities, shared source hashes, bundle hash and installed versions. |
| `candidate-audit-summary.json`, `candidate-audits/` | Six fresh installs with local tarballs: zero all-dependency and production advisories. Includes the isolated manifests and generated lockfiles used by each audit. |
| `registry-before/`, `registry-after/` | Audit snapshots of repository lockfiles before/after cleanup. Consumers still resolving published Common/Client retain findings until new packages are published and pinned. |
| `docker-manifest-audit.json`, `legacy-mcp-audit.json` | Final zero-advisory results for these independent manifests. No Docker image or native launcher build was performed. |
| `source-sha256.json` | SHA-256 fingerprints of relevant implementation, tests and manifest/lock files after the final staging pass. |

The browser and Link runs preceded a final server-only guard rejecting scoped IPv6 values such as `fe80::1%en0` before URL normalization. The final Common suite covers that guard; the final candidate and website were rebuilt afterward. There was no browser-runtime change after the passing Chrome run.

**Audit interpretation and release handoff**

The candidate directory was `/tmp/homegames-security-runtime-verified`. Its Common 1.7.2 / Client 0.1.2 version fields are placeholders inherited from source, not published replacements. Tarballs are outside the repository; the integrity values in `runtime-candidate.json` identify the tested bytes. The isolated audit locks contain local tarball paths and are evidence, not production lockfiles. Registry snapshots of the native wrapper do not recursively certify its local Core dependency or packaged executable.

| Package/service | Before: all advisories | After: repository lock | After: local candidate |
| --- | ---: | ---: | ---: |
| Common | 4 | 0 | 0 |
| Client | 8 | 5 | 0 |
| Core | 9 | 6 | 0 |
| Website | 17 | 6 | 0 |
| Legacy web shell | 9 | 6 | 0 |
| API | 11 | 5 | 0 |
| Link | 9 | 0 | Not dependent on Common/Client |
| Retained legacy MCP adapter | 1 | 0 | Not dependent on Common/Client |

Counts overlap across consumers; do not add them together as unique vulnerabilities. A zero audit means no matching registry advisory at check time. It does not validate deployment, reachability, all code paths or third-party licenses. Dependency install scripts were disabled for isolated audit installs.

The user will publish and deploy incrementally. Finish MIT/third-party notice work before the intended MIT package releases. Publish a new Common version first, pin it into Client and rebuild/publish Client, then pin both throughout consumers and regenerate artifacts. Re-run clean registry installation and acceptance against that released set. Existing consumer `npm ci` currently restores the older packages and can undo the staged metadata/security fixes.

**Reproduction**

Use Node 24 with its bin directory on `PATH`. From Core, use a fresh output directory each time:

```sh
npm run stage:runtime -- --out /tmp/homegames-runtime-review
npm run audit:runtime -- /tmp/homegames-runtime-review
node --test test/CertificateCsr.test.cjs
node testRunner.js ./test/CertManager.test.js
```

Run `npm test` in Common, website and Link. From API run:

```sh
node --test test/connection-api.test.js test/certificates.test.js test/acme-dns-client.test.js test/certificates-mongo.test.js
npm --prefix chatgpt-app test
```

Build the website with `npm run build`. Run `test/static-site-browser.cjs` with `PLAYWRIGHT_MODULE` and `CHROME_PATH` pointing to the available Playwright installation and Chrome executable; `RTC_TEST_DISABLE_MDNS=1` was used for this local fixture. Network-listening tests and Chrome require local socket/process access. See the adjacent logs for exact results and the browser artifact directory.

The full Core game suites, native/container builds, live ACME/DNS, production migration/rollback, forced TURN, sustained load, physical devices and license inventory remain separate launch gates. The earlier broad-suite failures remain documented in the launch review.

**Upstream references used for the changes**

- [RFC 8555](https://www.rfc-editor.org/rfc/rfc8555.html) defines the ACME exchange implemented by the narrow DNS adapter. This adapter deliberately does not implement EAB, account-key rollover or revocation.
- [Forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv) and [decompress advisory](https://github.com/advisories/GHSA-mp2f-45pm-3cg9) informed removal of those dependencies from active paths.
- [fflate advisory](https://github.com/advisories/GHSA-px8p-9vwx-vf98) informed the 0.8.3 pin and archive validation checks.
- [Peculiar X509](https://github.com/PeculiarVentures/x509) supplies CSR/X509 encoding and parsing around native keys.
- [coturn configuration](https://github.com/coturn/coturn/blob/master/examples/etc/turnserver.conf) documents the bandwidth settings (bytes per second in each direction) and peer-address controls. The checked-in example still needs live acceptance.
