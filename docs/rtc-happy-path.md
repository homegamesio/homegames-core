# Browser game + Share invitation

> Historical October 3 checkpoint: public catalog discovery and hosted API paths described below are no longer the current website architecture. See the [October 14 audit](local-ownership-audit.md), `homegamesio/README.md` and `api/README.md` for the static/private deployment and current release gaps.

The implementation now covers browser Play from the self-hosted dashboard,
website Play/Download, public website discovery, unlisted QR invitations, and
Studio preview sharing. Core's dashboard stays on WebSocket. Its primary Play
starts a browser host; Host with WebSocket starts a separate Core game. Home
from a local host returns to the dashboard and ends its RTC game.

Home-server browser games register their invitation in a household-only
90-second directory on Core; other dashboard players can join over RTC.
Multiplayer games do this when ready; other games can opt in by pressing Share.
The invitation itself uses public signaling and a public guest page, so outside
guests never fetch game files from the private home server. These rooms do not
appear on the website. Household discovery means browsers using the same home
server; it is not a scan of every device on the subnet.

Website multiplayer Play automatically registers a public catalog room unless
Private is selected. Game-page and homepage lists refresh every ten seconds.
Share reuses the running room; Private changes listing visibility without
restarting it. API validation checks the published game/version. Room metadata
has counts and capacity, with socket ownership and 90-second host leases.
Downloads contain the game, runtime and declared assets; Share uses RTC, and
downloaded games remain unlisted. Studio Share also stays unlisted and adds
players to the existing preview. The website has no gameplay WebSocket fallback.

Deploy the API, client bundle for downloads, and staged S3 release using
[the EC2/S3 setup guide](rtc-public-deployment.md). No deployment or service
shutdown has been performed by the assistant.

The current local layer-test uses `https://homegames.io/play.html` for guests
and the already deployed API for signaling. The API admission probe passed on
October 3, 2026; TURN was not configured. Publish the static player using
section 1 of the deployment guide, then restart/refresh the local host and
create a fresh invitation.

Set these values in the config you normally use, then start Homegames:

```json
{
  "START_PATH": "./src/games/layer-test/index.js",
  "START_MODE": "browser"
}
```

`browser` is the default when `START_PATH` is set. With no `START_PATH`, the
dashboard behaves as before. `START_MODE: "websocket"` retains the existing
Node-hosted game and WebSocket client, including server-only services.

For a standalone development launch from homegames-core:

```sh
START_PATH=./src/games/layer-test/index.js START_MODE=browser LINK_ENABLED=false npm start
```

Open the normal Homegames URL (default `http://localhost:9801`). The game runs
in that tab immediately. **Share**, below the canvas, opens a QR code and a
copyable invitation. After deploying the public services, scan it on a phone
on Wi-Fi or cellular. Both devices see the
same running game; either can change the colors in layer-test. The footer
shows when the second player is connected. Closing the overlay leaves sharing
active. Closing or refreshing the host tab ends that game and invitation.
Guests may reopen the invitation while the host stays open; each connection
joins as a new player, without restoring the previous player's identity.

## Local-only development

Public invitations default to `https://homegames.io/play.html` with signaling
at `wss://api.homegames.io/rtc`. If the public service is unavailable, Share
reports an error; it does not substitute a LAN-only invitation. Single-player
play does not contact the invitation service.

For a self-contained LAN test, explicitly set `RTC_SHARE_ORIGIN` to `"local"`.

Core uses the hostname you opened for invitations, including a
`*.homegames.link` HTTPS hostname. When opened through localhost over HTTP,
it picks a LAN IPv4 address. Over HTTPS, a localhost visit uses a concrete DNS
name from the serving certificate instead of an IP that the certificate does
not cover. If the machine has multiple network interfaces, or needs a different
reachable hostname, set the address explicitly:

```json
{
  "RTC_SHARE_ORIGIN": "http://192.168.1.10:9801"
}
```

Use your machine's actual address and configured port. The guest must be able
to load that URL; guest Wi-Fi isolation, a firewall, or a phone on cellular
can prevent access. With HTTPS enabled, use a hostname covered by the serving
certificate. The private room exists only after Share is clicked. A second
tab opened at the bare server URL starts another game; an invitation joins
the existing game.

## Public invitations

Neither mode requires a hosted Core or Homenames. For invitations across
networks, deploy the shared signaling module with the API, the updated static
player and client bundle to S3, and coturn on EC2. See the [deployment commands](rtc-public-deployment.md).
The host defaults to these addresses; override them for another deployment:

```json
{
  "RTC_SIGNAL_URL": "wss://api.homegames.io/rtc",
  "RTC_JOIN_URL": "https://homegames.io/play.html"
}
```

These addresses require the corresponding deployment; this change does not
deploy anything. The public guest only downloads the renderer, never the
host's source. Frame and input traffic goes over RTC directly or through TURN.

API environment (behind its HTTPS proxy, forwarding WebSocket upgrades at
`/rtc`):

```sh
RTC_ENABLED=true
RTC_STUN_URLS=stun:your-turn-host:3478
RTC_TURN_URLS='turn:your-turn-host:3478?transport=udp,turn:your-turn-host:3478?transport=tcp'
RTC_TURN_SECRET='same-shared-secret-configured-in-coturn'
```

The API issues expiring TURN credentials on room/peer admission. The shared
secret stays on the server. STUN/TURN must be separately running and reachable;
an API route is not itself a TURN relay. Credentials follow coturn's
[TURN REST mechanism](https://github.com/coturn/coturn/blob/master/README.turnserver).
The same environment variables work for Core's local signaling service.
Alternatively Core accepts `RTC_ICE_SERVERS`, an array of standard WebRTC ICE
server objects, in JSON config. Do not put a long-lived TURN secret there.
The default uses Google's public `stun:stun.l.google.com:19302`; it is contacted
only when sharing/joining, not during single-player play. Configure your own
STUN service with `RTC_STUN_URLS`. An explicitly empty `RTC_STUN_URLS` disables
STUN for direct-only testing, but then both browsers must be able to resolve
each other's local candidates. STUN alone does not guarantee connectivity
through every NAT/firewall; use TURN for that fallback.

`RTC_ICE_TRANSPORT_POLICY: "relay"` can force the host to use configured TURN
for a relay test. Leave it as `"all"` for normal use. Signaling and ICE have
separate jobs, as described in the [WebRTC connection guide](https://webrtc.org/getting-started/peer-connections).

The first signaling service is in-memory and serves private invitations.
Use one process/instance (or routing that keeps every socket for a room on the
same instance). Restarting it ends its rooms. Public discovery, durable room
records, host migration, player resumption, and automatic reconnect are later
work. Keep the host tab/device awake; browser suspension can pause gameplay.

## Code ownership

- `homegames-common/session-runtime.js`: clock ownership and per-player frame
  encoding, used by Node `GameSession` and browser `LocalSession`.
- Existing common `GameDispatcher`: game-facing input for both paths.
- `homegames-client/src/local-session.js`: local and remote seats in one game.
- `homegames-client/src/rtc-session.js`: signaling/peer lifecycle and the guest
  transport plugged into the existing `HomegamesClient` renderer.
- `homegames-client/src/rtc-channel.js`: reliable ordered packet transfer,
  16 KiB chunks, bounded queues, and coalescing of pending game frames.
- `homegames-common/rtc-signaling.js`: invitation-scoped signaling shared by
  Core and the API. No simulation or game frame handling.
- `homegames-core/src/util/browser-game-server.js`: startup manifest, static
  client, public invitation defaults and optional LAN signaling.

## Verification

Build the client after changing it:

```sh
npm --prefix ../homegames-client run build
npm run test:sessions
```

The optional real-browser acceptance test uses Playwright and Chromium:

```sh
node test/rtc-browser.cjs
```

`PLAYWRIGHT_MODULE` can point to an existing Playwright installation;
`CHROME_PATH` can select an installed Chrome executable. Use a Node version
supported by that Playwright installation. `RTC_SCREENSHOT` optionally saves
the Share overlay. The test uses separate game and guest/signaling servers on
free ports. The guest is blocked from HTTP access to the game server and shares
state through real RTC. It checks touch input, return frames, rejoining and host
shutdown, then tears everything down. `RTC_TEST_LOCAL=true` selects the LAN
fixture instead.

To check a deployment with a forced TURN relay, set
`RTC_TEST_PUBLIC_SIGNAL_URL=wss://api.homegames.io/rtc`,
`RTC_TEST_PUBLIC_JOIN_URL=https://homegames.io/play.html`, and
`RTC_TEST_RELAY=true`. The test then uses those real public services and asserts
that the selected host candidate is a TURN relay. This is opt-in; the default
test does not contact production signaling.

## October 3 implementation checks

- API catalog validation test: published refs, cached-ref revalidation, source never executed, session stats.
- Session suite: shared runtime, input, saves, lifecycle, public directory/privacy/capacity/leases.
- Focused dashboard tests: browser default, explicit WebSocket fallback, household listing/join, catalog installs.
- Real Chrome: website Play/public Join/private toggle/private startup; Home teardown; file:// download RTC; household listing/counts/cleanup; Studio shares the same preview.
- Real Chrome START_PATH test: separate guest origin, phone touch and host input update both canvases, leave/rejoin, host shutdown.

TURN is still not configured in production. Browser tests use real RTC with
STUN on this machine; they do not prove cellular/strict-NAT connectivity.
The dashboard's actual developer game collection includes intentionally
unresolved Squish aliases, so routing tests use an isolated library; those
aliases were not changed. No host migration, pinned browser rooms, or
contentGenerator replacement was added. Keep host tabs awake; browser suspension
can stop games and expire discovery. Public discovery currently caps a room at
17 players, including its host.
