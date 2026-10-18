# SUNWAKE — The Last Skyship

One impossible ship. Up to six crewmates. Bring back the dawn.

SUNWAKE is a complete cooperative skyship expedition built for Homegames browser hosting and RTC guests. The crew shares one ship, one battery, one hull and one destination. Players can change stations at any time. Empty stations receive basic automation; a human crew has faster weapons, stronger repairs, longer scans and a much longer salvage reach.

The core tension is simple: the gunner wants another barrage, the engineer sees an overheating reactor, the scout has spotted a survivor off course, and the pilot is trying to get everyone out of an Eclipse pulse. Voice helps, but every action and objective also works without microphone access.

## Play locally

Restart Homegames, open **homegames.link**, find **SUNWAKE** in the local library and choose browser play. The local game key is `Sunwake`. Choose a station, optionally name the ship or upload a crew flag, then **Cast off together**. Share admits guests directly into the current expedition. Public QR invitations use the existing homegames.io player.

The game uses the existing upload and live-media features. This build also fixes a client audio bug: enabling sound detached the original asset bytes and broke later RTC joins. The local client has been rebuilt with that fix. Hard-refresh existing host tabs. Website-hosted sessions should use the updated client too; no API changes are needed. The game has not been published to the public catalog.

The matching website client and player page are staged at `/tmp/sunwake-rtc-release`; its `DEPLOY.md` lists the minimal S3/CloudFront commands. Publishing SUNWAKE itself is separate: its five JavaScript files and MIT `LICENSE` are the complete game source, with no external art or sound downloads.

Phones work with touch; landscape gives the sky and controls more room. Keyboard and gamepad controls are also available. A first voyage is intended to take a few minutes, with room to explore, rescue people and learn stations. Solo play is supported; two to four communicating players are the intended sweet spot, with six seats available.

## Stations

| Station | In the world | Main action | Other action |
| --- | --- | --- | --- |
| Helm | Tap a destination; drag to revise it. WASD/arrows steer in screen directions. | Boost: fast escape with damage reduction | Anchor/unanchor |
| Gunner | Hold on a target and drag to track it. The Fire button auto-aims if no target has been set. | Fire harpoons | Five-shot barrage |
| Engineer | Watch the hull, reactor heat and shared battery | Patch hull and vent heat; scrap improves repairs | Cycle balanced / engines / weapons / shields |
| Scout | Tap to mark a position and try a tractor pickup | Pull a survivor or salvage from farther away | Expose armored hearts with a scan |

Space uses the main action; E uses the other action. Number keys 1–4 select stations; Q cycles stations. H opens help and M toggles ship sounds. The gamepad uses the left stick/D-pad, primary and secondary face buttons, right shoulder to change stations, and Start for help. Only one player can occupy the helm; other stations can be shared, with shared ability cooldowns.

The ship moves toward the helm’s chosen point. Its first short launch does **not** pilot the entire voyage for you. Keep choosing destinations; the gold diamond points toward the beacon. When the helm is empty, automation heads toward the objective. Red rings warn where lightning or an Eclipse pulse will land. Boost or steer clear before they fire.

## A complete voyage

1. **The Glass Shoals:** learn the ship, rescue the first survivors and break the beacon’s armored Warden. Approach the beacon after defeating it; the ship relights it over five seconds.
2. **Crew decision:** everyone votes on a combined refit and route. Living Timbers repairs and strengthens the hull; Sunlance improves damage; Storm Sails improves reactor recharge. The associated paths emphasize survivors, salvage/armor or lightning. A 22-second deadline keeps the expedition moving; ties choose the safer tied route.
3. **The Verdant Grave:** find a chained skywhale. This rescue is optional. Destroy both anchors and it becomes a persistent voyage ally: it follows the ship, restores shields and attacks nearby foes. Leaving it behind is possible.
4. **The Cinder Crown:** another Warden, more dangerous sky and the last dark beacon. The third crew vote is a final refit before the boss.
5. **The Eclipse Engine:** three hearts, armored phases, spreading volleys, telegraphed pulses and reinforcements when hearts break. Scan its armor, manage heat and keep moving. Destroying it reveals the dawn before the debrief.

Rescued people, lit beacons, the skywhale and victory grant renown. The persistent logbook tracks renown, rescues, voyages, victories, high score, ship name and selected ship. Kestrel unlocks at 15 renown: faster, larger battery, less hull. Bastion unlocks at 35: slower and much tougher. The first crewmate chooses the ship in harbor. Refits last for the current voyage. Logbook progress is saved at the end; this version does not resume an interrupted voyage.

## Crew identity and live radio

- **Hoist your flag** accepts an image and sends it through the existing session upload system. It appears above the ship for current and late-joining players. It stays for this session; image bytes are not placed in the logbook.
- **Radio** first asks for microphone permission. After setup, hold it to talk and release to stop. One crew member owns the radio at a time. **Cam Radio** in harbor requests camera plus microphone, showing a small bridge camera during that player’s transmission. To change capture mode, use the platform’s Disconnect microphone / camera control first.
- Voice and camera are optional. The game is fully playable with visual objectives, station controls, scan feedback and pings.
- The platform releases held transmission on touch cancellation, blur, hidden pages and disconnect. Native WebRTC carries media; it is not encoded into Squish frames.
- Core/WebSocket fallback can run the game and uploads, but its live radio is unavailable. Media permission errors stay in the player’s status line.

## Implementation

`engine.js` is a browser-safe deterministic simulation with seeded world generation, finite phases, scoped player commands, swept projectile collisions and bounded populations. `scene.js` projects the world into a clipped polygon scene. A private painter pool reuses shapes and attaches only the shapes currently visible. The art is original code: no texture downloads, external art services or fabricated asset IDs. `audio.js` synthesizes small, quiet WAV effects into real in-memory Homegames assets. `index.js` owns the Squish UI, individual station controls, platform services, save integration and cleanup.

The simulation and outgoing scenes run at 20 Hz. There are caps on active enemies, projectiles, weather warnings and effects. The scenery pool is capped at 320 shapes; normal scenes are much smaller. Unit checks serialize real per-player Squish frames and reject non-finite/off-screen geometry, invalid polygon flags, oversized frames and pool overflow. This is a measured budget, not a claim that every phone/network has been profiled.

## Verification

```bash
node testRunner.js ./test/games/Sunwake.test.js
```

The tests cover full campaigns at 1/2/4/6 players with multiple seeds; role ownership and abilities; armor, heat and shared cooldowns; skywhale rescue; voting, route hazards and failure; save validation and single-award semantics; Core fallback asset/frame delivery; and all game phases through the actual Squish codec with a frame budget.

`test/sunwake-browser.cjs` uses Playwright and Chrome. Set `PLAYWRIGHT_MODULE` and `CHROME_PATH` when those dependencies are outside the normal install. It starts only local services and uses synthetic camera/microphone devices. It checks the built browser client with real RTC peers, landscape phone touch, repair/power input, generated audio decoding, image-flag transfer, text input, microphone/camera radio, late joins, votes, the optional ally, victory and cleanup. Visual captures are written to `/tmp/sunwake-*.png`.

Physical phones, Safari, actual cellular links and human difficulty feedback remain valuable follow-up playtests. The public catalog publishing/deployment workflow is intentionally separate from creating this local game.
