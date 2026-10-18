# Maintainer-supplied EC2 evidence — October 18, 2026

These observations came from command output pasted by the maintainer. The agent did not run SSH commands.

- `homegames-turn.service` active since 17:43:51 UTC; coturn 4.18.0, binary `/opt/homegames-turn/4.18.0/bin/turnserver`, config `/etc/homegames-turn/turnserver.conf`, six tasks, 4.6 MiB observed RAM and 512 MiB limit. Private relay IP 172.31.30.122; two relay threads and two authentication threads.
- `hg-api.service` active since 17:43:52 UTC; `/usr/bin/node /home/ec2-user/api/index.js`, with the separate `80-homegames-turn.conf` drop-in.
- One startup TLS socket `Broken pipe` entry was shown. The installer deliberately opens and closes a local TLS handshake check at startup, making that a plausible source; the specific log entry was not correlated to a packet trace. Subsequent verified TLS game traffic passed.
- The first nftables guard installation applied successfully, then its test exited on `PermissionError` at the intentionally blocked send. The test was corrected to accept that Linux denial and still require the positive relay-range packet to arrive.
- The corrected check printed: `PASS: local receiver works; coturn UID is blocked outside the relay range; relay traffic remains allowed.` No API/TURN restart was needed. Backup: `/var/lib/homegames-turn-setup/firewall.RSCyzodq`.
- `inet homegames_turn` output chain, priority -10, default accept: coturn UID 985, self addresses 52.32.110.71 / 172.31.30.122. UDP destination 49160–49260 accepted (one packet / 35 bytes); UDP listener-source responses 3478/5349 accepted (zero packets); other UDP self-destinations dropped (one packet / 35 bytes).
- nftables installed from AL2023: `1:1.0.4-3.amzn2023.0.2`. The package-manager output also reports that newer AL2023 releases exist; no OS upgrade was performed in this step.
- `/usr/bin/certbot` exists. `/etc/letsencrypt/renewal-hooks/deploy/homegames-turn` is root-owned and executable (0750). Initially no certbot/letsencrypt match was returned from all systemd timers, root crontab, or `/etc/cron.d`, `/etc/cron.daily`, `/etc/cron.weekly`. Other scheduling mechanisms/user crontabs were not inspected.
- Certbot 2.6.0 originally offered only standalone/webroot. `renew --cert-name api.homegames.io --dry-run` failed because standalone could not bind nginx's port 80. After installing the nginx plugin, `reconfigure --cert-name api.homegames.io --nginx --run-deploy-hooks` reported `Successfully updated configuration. Changes will apply when the certificate renews.`
- Saved renewal fields now read `authenticator = nginx` and `installer = nginx`. TURN remained active, with `ActiveEnterTimestamp=Sun 2026-10-18 18:06:06 UTC` following the hook test.
- `homegames-api-cert-renew.timer` is scheduled; next invocation shown as `Mon 2026-10-19 00:10:47 UTC`, activating `homegames-api-cert-renew.service`. This confirms scheduling, not a completed future production renewal. The staging test used the existing live certificate for its deploy hook.

## Physical-device check

The maintainer opened House Band on a laptop and joined its invitation from a phone with Wi-Fi off, enabled phone sound, started/paused the shared loop, and reloaded the phone to rejoin. They reported “Everything works.” Browser/OS details and the phone’s selected ICE candidate pair were not supplied; do not treat this as a comprehensive mobile matrix.
