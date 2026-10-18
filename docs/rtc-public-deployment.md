# Historical deployment guide: public QR invitations

> This document describes the earlier hosted catalog/public-room deployment. Do not use its old website/API rollout steps for the current static product. Use `homegamesio/README.md` for the static build and `api/README.md` for private signaling and optional certificates. The [October 14 audit](local-ownership-audit.md) records remaining cutover gates. TURN configuration examples below are historical setup examples, not evidence of a configured or tested live relay.

The local browser keeps running layer-test. The phone loads a static player
from S3/CloudFront, exchanges connection information with the EC2 API, and joins
over WebRTC. Coturn on EC2 relays the connection when a direct path fails.
You do not need to expose your home computer or forward its ports.

Defaults are `https://homegames.io/play.html` and `wss://api.homegames.io/rtc`.
`/play` is not an S3 object. The deployed API passed invitation signaling on
October 3, 2026, with STUN but **no TURN**. This release adds public discovery,
so the API needs another update before publishing the new website.
Nothing below has been deployed by the assistant.

## 1. Build and stage on your Mac

```bash
cd /Users/josephgarcia/homegames/homegamesio
npm --prefix ../homegames-client run build
npm run build
HG_STAGE_DIR="$(mktemp -d /tmp/homegames-rtc-release.XXXXXX)"
node scripts/prepare-rtc-site.js "$HG_STAGE_DIR"
```

Keep this terminal open: `HG_STAGE_DIR` is used below. The script stages
Play, Studio, the catalog bundle from **web/bundle.js**, homepage/catalog
buttons, admin session list, and updated player/developer docs. Play and Studio
both reference a versioned client. The old deploy.sh is insufficient.

## 2. Update EC2 API, then upload S3

The API needs `index.js`, `handlers.js`, and the updated installed common modules.
The same built client must be available to the API for standalone HTML downloads.
This direct-copy option uses your known API checkout `/home/ec2-user/api`;
replace the SSH host and confirm the installed common directory first.

On EC2, from the API checkout, locate the actual installed package:

```bash
cd /home/ec2-user/api
node -p "require.resolve('homegames-common/package.json')"
```

Back on the Mac, in the terminal with `HG_STAGE_DIR`:

```bash
cd /Users/josephgarcia/homegames
HG_SSH='ec2-user@YOUR_EC2_HOST'
HG_API_DIR='/home/ec2-user/api'
HG_COMMON_DIR='/home/ec2-user/api/node_modules/homegames-common'

scp api/index.js api/handlers.js "$HG_SSH:$HG_API_DIR/"
scp homegames-common/rtc-signaling.js homegames-common/local-play.js \
  homegames-common/local-play-shared.js "$HG_SSH:$HG_COMMON_DIR/"
scp homegames-client/dist/homegames-client.js "$HG_SSH:$HG_API_DIR/homegames-client.js"
scp api/scripts/check-rtc.js "$HG_SSH:$HG_API_DIR/check-rtc.js"
scp api/deploy/rtc-nginx.conf api/deploy/turnserver.conf.example "$HG_SSH:/tmp/"
```

Include these changes in your normal package deployment too; npm install may
replace files copied into node_modules. No database migration is required.
Use **one API process** for `/rtc` and `/rooms`: its live directory is in memory.
An API restart ends invitations; hosts can use Share to make a new one.

On EC2:

```bash
cd /home/ec2-user/api
node --check index.js
node --check handlers.js
node -e "require('homegames-common/rtc-signaling'); require('homegames-common/local-play'); console.log('RTC modules ready')"
sudo systemctl edit hg-api.service
```

Add these settings to the service override, preserving your existing settings:

```ini
[Service]
Environment=RTC_ENABLED=true
Environment=RTC_TRUST_PROXY=true
Environment=CLIENT_BUNDLE_PATH=/home/ec2-user/api/homegames-client.js
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart hg-api.service
sudo journalctl -u hg-api.service -n 40 --no-pager
curl --fail https://api.homegames.io/rooms
node check-rtc.js wss://api.homegames.io/rtc
```

`/rooms` should return JSON with `rooms` and `total`. Your existing nginx `/rtc`
upgrade rule stays. Ordinary HTTP `/rooms` requests must reach the same Node
process; a normal `location /` API proxy already does this. Do not cache `/rooms`.
If a published-game Play cannot register, inspect the service logs and verify
its Forgejo and Mongo settings; registration checks the published commit.

Now publish the staged website from the Mac:

```bash
aws s3 cp "$HG_STAGE_DIR/" s3://homegames.io/ --recursive \
  --exclude '*' --include 'homegames-client-rtc.*' \
  --cache-control 'public,max-age=31536000,immutable'
aws s3 cp "$HG_STAGE_DIR/" s3://homegames.io/ --recursive \
  --exclude 'homegames-client-rtc.*' --cache-control 'no-cache'
HG_DISTRIBUTION_ID='YOUR_CLOUDFRONT_DISTRIBUTION_ID'
aws cloudfront create-invalidation --distribution-id "$HG_DISTRIBUTION_ID" --paths '/*'
```

The new files use `?format=rtc2` for HTML downloads to bypass old immutable
solo-download responses. Downloaded files are unlisted RTC hosts; downloading
alone does not register a room. Publish the assets before HTML, wait for the
invalidation, and keep existing bucket access controls.

The public website no longer requests gameplay sessions or preview logs from
Core/Homenames. Its admin Sessions view now lists public browser rooms without
pinning. Old API session endpoints remain for compatibility but are unused by
these website flows. Test Play, public Join, Private, Download, Studio Share,
and Home with this release before stopping your public Core service.

## 3. Install coturn on EC2

The following package commands assume **Ubuntu/Debian**. On Amazon Linux, use
its package/container installation instead; the coturn config is the same.

```bash
sudo apt-get update
sudo apt-get install -y coturn
```

Set the instance's actual stable public IPv4 (preferably an Elastic IP) and
private IPv4. This example assumes `api.homegames.io` resolves directly to
this EC2 host. If it points to a load balancer/CDN, use a separate TURN hostname
pointing directly to the instance in both the config and environment below.

```bash
HG_PUBLIC_IP='YOUR_EC2_PUBLIC_IPV4'
HG_PRIVATE_IP='YOUR_EC2_PRIVATE_IPV4'
HG_TURN_SECRET="$(openssl rand -hex 32)"

sed -e "s/PUBLIC_IPV4/$HG_PUBLIC_IP/g" \
    -e "s/PRIVATE_IPV4/$HG_PRIVATE_IP/g" \
    -e "s/REPLACE_WITH_RANDOM_SECRET/$HG_TURN_SECRET/g" \
    /tmp/turnserver.conf.example | sudo tee /etc/turnserver.conf >/dev/null
sudo chown root:turnserver /etc/turnserver.conf
sudo chmod 640 /etc/turnserver.conf

sudo install -m 600 /dev/null /etc/homegames-rtc.env
{
  printf '%s\n' 'RTC_ENABLED=true' 'RTC_TRUST_PROXY=true'
  printf '%s\n' 'RTC_STUN_URLS=stun:api.homegames.io:3478'
  printf '%s\n' 'RTC_TURN_URLS=turn:api.homegames.io:3478?transport=udp,turn:api.homegames.io:3478?transport=tcp'
  printf 'RTC_TURN_SECRET=%s\n' "$HG_TURN_SECRET"
} | sudo tee /etc/homegames-rtc.env >/dev/null
unset HG_TURN_SECRET

sudo systemctl enable --now coturn
sudo systemctl restart coturn
sudo systemctl status coturn --no-pager
```

If your distro's coturn init wrapper requires it, enable `TURNSERVER_ENABLED=1`
in `/etc/default/coturn`. The secret in both files must match. Keep it on EC2;
the API issues expiring credentials to browsers. The example uses TURN over
UDP and TCP on 3478 and an explicit EC2 public/private address mapping, following
[coturn's configuration reference](https://github.com/coturn/coturn/blob/master/examples/etc/turnserver.conf).

Add these inbound EC2 security group rules, and equivalent rules to any enabled
OS firewall. Existing HTTPS 443 remains open. TURN must also be able to send
outbound traffic to its peers.

```bash
HG_SECURITY_GROUP='sg-YOUR_EC2_SECURITY_GROUP'
aws ec2 authorize-security-group-ingress --group-id "$HG_SECURITY_GROUP" \
  --ip-permissions '[
    {"IpProtocol":"udp","FromPort":3478,"ToPort":3478,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]},
    {"IpProtocol":"tcp","FromPort":3478,"ToPort":3478,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]},
    {"IpProtocol":"udp","FromPort":49160,"ToPort":49260,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]}
  ]'
```

This is an initial relay setup for the cellular test. Networks that block these
ports can still fail. TURN/TLS on 5349 or a dedicated 443 listener with a valid
certificate can be added later; nginx's normal HTTP proxy cannot proxy TURN.
Do not advertise a `turns:` URL until that TLS listener exists.

## 4. Enable the API and nginx WebSocket route

Have your existing Node process manager load `/etc/homegames-rtc.env` **in
addition to its existing environment**. For systemd, replace the service name:

```bash
sudo systemctl edit hg-api.service
```

Add this override:

```ini
[Service]
EnvironmentFile=/etc/homegames-rtc.env
```

For a manually started Node process, set the same five environment variables
in its existing launcher. An export in a separate SSH shell does not update an
already running service. Keep the environment file readable only by its owner;
systemd reads the root-owned file for the service.

The nginx snippet assumes Node listens on **8004**, as in the checked-in nginx
config. Change that port to the actual API port. Install the snippet:

```bash
sudo install -d /etc/nginx/snippets
sudo install -m 644 /tmp/rtc-nginx.conf /etc/nginx/snippets/homegames-rtc.conf
```

Inside your **existing HTTPS server block for api.homegames.io**, add:

```nginx
include /etc/nginx/snippets/homegames-rtc.conf;
```

This forwards WebSocket upgrades at `/rtc` to Node. `RTC_TRUST_PROXY=true`
accepts the overwritten `X-Real-IP` only from a loopback proxy, so all households
do not share nginx's single per-IP room limit. See
[nginx's WebSocket proxy documentation](https://nginx.org/en/docs/http/websocket.html).

```bash
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl restart hg-api.service
sudo systemctl reload nginx
```

## 5. Verify and join from the phone

From your Mac:

```bash
cd /Users/josephgarcia/homegames/api
node scripts/check-rtc.js wss://api.homegames.io/rtc --require-turn
```

It must report successful room/guest admission and expiring TURN credentials.
This tests signaling and credential issuance, **not relay reachability**. The
probe creates a temporary room and closes it. Ordinary `curl /rtc` may still
return 404 because this route is a WebSocket upgrade, not an HTTP API.

Restart your local Homegames process, refresh layer-test, and click Share to
make a fresh invitation. Existing host tabs retain their earlier boot settings.
The link should now start with `https://homegames.io/play.html#room=...` and its
`signal` value should point at `wss://api.homegames.io/rtc`. Remove any earlier
`RTC_SHARE_ORIGIN`, `RTC_SIGNAL_URL`, or `RTC_JOIN_URL` overrides unless they are
deliberate. Your START_PATH configuration can remain unchanged.

Turn the phone's Wi-Fi off and scan the QR. Keep the host tab open and awake.
Tap the colored layer-test canvas; both devices should change together.

For a decisive relay check, temporarily set `RTC_ICE_TRANSPORT_POLICY` to
`"relay"` in Core config (or its environment), restart/refresh the host, and
create a new invitation. Restore `"all"` after testing. A successful join in
relay mode proves TURN is carrying the connection; a normal join may use a
direct path instead.

The automated browser acceptance test can also target the real deployment:

```bash
cd /Users/josephgarcia/homegames/homegames-core
RTC_TEST_PUBLIC_SIGNAL_URL=wss://api.homegames.io/rtc \
RTC_TEST_PUBLIC_JOIN_URL=https://homegames.io/play.html \
RTC_TEST_RELAY=true node test/rtc-browser.cjs
```

This requires Playwright/Chromium (or `PLAYWRIGHT_MODULE` and `CHROME_PATH` set
to existing installations). It asserts a selected relay candidate, checks
guest touch and host input, then rejoining and host shutdown. The default test
uses separate local servers and does not contact production signaling.
