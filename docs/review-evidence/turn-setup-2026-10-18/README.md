# Live TURN and 404 verification — October 18, 2026

The maintainer authorized TURN setup/testing and the website 404 fix, and clarified that they run commands directly on EC2. No SSH or remote command execution was attempted by the agent. Self-hosted polishing and certificate issuance acceptance follow this step; the final native build will be published after testing/fixes.

## Completed live AWS changes

- CloudFront `EFBDCEDUOW3NO` (`homegames.io`) now maps origin 404 to `/404.html`, preserves status 404 and uses a five-second minimum error cache TTL. The conditional ETag update preserved all other settings and reached `Deployed`. A fresh missing URL returned the exact Homegames error-page HTML and HTTP 404. The narrow receipt is `cloudfront.json`; full backup configurations remain local temporary files.
- Verified API DNS `52.32.110.71` matches instance `i-0331952fb09fcc4bf`, private IP `172.31.30.122`, type t2.medium, in us-west-2.
- Created dedicated group `sg-0fc46ac393910927e` (`homegames-turn`) in `vpc-7e9a591b`. Inbound: TCP 3478/5349, UDP 3478 and UDP 49160–49260 for public IPv4 clients. Removed its default egress rule, leaving outbound control with the existing group.
- Attached it to primary interface `eni-0ebdfb8cb66d05d74`, retaining existing `sg-07f1c201899bf3767` (`launch-wizard-11`). Existing service/DNS rules were not modified. The API remained healthy afterward.
- No new EC2 instance or Elastic IP was allocated. The current public IP is not an Elastic IP; stop/start address changes require DNS/mapping attention.

## Installer and local validation

The user supplied the actual `hg-api.service` name, API Certbot paths, and DNF output showing no coturn package in enabled repositories. `api/deploy/install-turn-al2023.sh` builds official coturn 4.18.0 from its fixed SHA-256 archive, runs a separate unprivileged service, generates/reuses a private secret, installs restricted certificate copies/renewal hook, and adds a separate API environment overlay. It checks local TLS before advertising TURN and restarts the API once. It does not enable certificate issuance, alter nginx HTTPS routing, or require a new npm publication.

The source builds locally on macOS against OpenSSL 3/libevent. **Nine real-coturn checks pass**: authenticated allocation; private/loopback/metadata permission denial; public-peer permission allowed; wrong password, expired credentials and unauthenticated allocations rejected/challenged; and packet exchange over UDP, TCP and certificate-verified TLS. Loopback packet exchange uses an explicit test-only override after testing the production deny list. No fixture secret/config files are saved here.

The positive public-peer test caught a defect in the older example: `denied-peer-ip=::` is interpreted as an unbounded range and blocks public peers. Removed it from installer and example; coturn already rejects unspecified addresses internally. The final positive and negative permission tests pass together. An initial negative-only run missed this.

The maintainer ran the installer on AL2023 and supplied active service status for coturn and the API. Shell/Node syntax checks pass. See `ec2-operator-checks.md` for the host observations and limits on what they establish.

## Live relay and security verification

`check-rtc.js --require-turn` passes: temporary credentials, room admission and host notification. `scripts/check-turn-browser.cjs` separately exercises the deployed House Band/runtime/API in two Chrome contexts, with both peers forced to relay and only one TURN transport offered per run. UDP, TCP and TLS have successful runs with selected local/remote relay candidates, the expected relay protocol, real guest input, both devices' audio, sustained frames, guest reload/rejoin and host-close recovery. The test makes no game-source or production configuration changes.

- Initial successful transport runs: `live-udp.json`, `live-tcp-tls.json`.
- After the firewall guard: `live-guarded.json` has successful UDP/TLS plus one TCP disconnect during the configuration work. The cause was not established. The subsequent isolated 30-second active TCP sample, reload and host-close checks pass in `live-tcp-guarded-repeat.json`.
- After the certificate hook: HTTPS and TURN TLS both verify with TLS 1.3 and serve the same live certificate (`live-tls-after-hook.json`, expiration December 27, 2026). The fresh TLS game/rejoin check passes in `live-tls-after-hook-repeat.json`.
- Harness fixes are separate from application findings: the initial host needed a canvas gesture to unlock audio; later, selected-pair received-byte counters reported zero despite working input/audio. The helper now checks cumulative data-channel bytes for bidirectional/sustained application traffic, alongside relay-only policy and selected candidate types/protocol. The failed pair-counter sample is preserved as `live-tls-after-hook-pair-counter.json`.

The bounded live policy probe (`live-policy.json`) verifies unauthenticated/wrong-password rejection, a valid API-issued allocation, private/loopback/metadata/CGNAT/multicast permission denial, public-peer permission, and explicit allocation release. No data was sent to those peer destinations. **It discovered that coturn's `external-ip=public/private` mapping adds its own private IP to the allow list, overriding the configured deny ranges.** The local loopback fixture had missed this because loopback is independently rejected before that allow list.

The new `install-turn-firewall-al2023.sh` closes that exception with a dedicated nftables table scoped to coturn's UID and self-destination UDP. Relay ports and listener responses remain allowed. The maintainer supplied a passing real Linux packet check with both an allowed relay-range packet and a dropped non-relay packet. The installer now requires this guard before advertising TURN. Coturn source is unchanged. See [the upstream mapping implementation](https://github.com/coturn/coturn/blob/4.18.0/src/apps/relay/mainrelay.c) and the runbook for why the guard is needed.

## Existing API/TURN certificate renewal

The host had Certbot 2.6.0, but no renewal timer/root cron/system cron entry was found. Its original standalone renewal failed against staging because nginx already owns port 80. The maintainer installed the nginx plugin and successfully ran `certbot reconfigure --cert-name api.homegames.io --nginx --run-deploy-hooks`. The saved authenticator and installer are both nginx. TURN is active with a new activation timestamp of 18:06:06 UTC, consistent with the deploy hook restart; no live certificate was replaced by the staging test.

`homegames-api-cert-renew.timer` is now scheduled twice daily with up to one hour of jitter. The maintainer's next-run output is October 19 at 00:10:47 UTC. Each invocation checks whether renewal is due; it does not renew/restart services twice daily. The timer covers only `api.homegames.io`; other hosted domains were not migrated. The renewal unit/timer are saved under `api/deploy/`. Certificate issuance for Homegames self-hosters remains disabled and unaccepted; it is a separate flow.

## Remaining acceptance

The maintainer also completed the laptop-to-cellular House Band check and reported that joining, shared controls, sound and phone reload/rejoining all worked. That supplies an independent-network physical-device observation; the phone browser/OS and selected candidate pair were not captured. The automated forced-relay tests separately prove public TURN use. Longer credential/refresh soak, loss/latency, representative busy games and larger copies, relay interruption recovery, measured shared-host CPU/RAM/egress, monitoring and native/self-host acceptance remain. No concurrency promise follows from these checks. TLS is on 5349; TLS-443-only networks are not covered. See `api/deploy/turn-al2023.md` for commands, limits and rollback.
