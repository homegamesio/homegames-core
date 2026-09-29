# Tug Club

**Tiny ships. Big hauls. Bring it home.**

A cooperative orbital salvage game for one to six pilots, built natively for Homegames with Squish 1.4.2. All artwork is made from polygons. Text uses the player's built-in font. There are no image, audio, or downloaded font assets, and the game makes no network requests.

## Play

Tap a destination or use WASD / arrow keys to fly your little tug. Get close to a gold cargo pod and a tether attaches automatically. The number on a pod is how many lights it powers. Tow it into the home dock in the middle.

Fill twelve lights, then bring the oversized **heart** home before the three-minute storm timer expires. The heart is heavy: everyone can attach and pull it together. Solo pilots can complete the entire expedition too.

| Control | Action |
|---|---|
| Tap / click, or hold and drag | Fly toward that point |
| WASD / arrows | Direct steering |
| Space / BOOST button | Short burst of thrust; recharges automatically |
| E / DROP button | Release your cargo; briefly disables automatic latching |
| Enter / start button | Begin or replay an expedition |

Coral debris knocks you around and can break your line. Nobody is eliminated. You can reattach and keep helping. Players can join mid-round; disconnecting releases their tether. An empty session pauses the expedition timer.

## Run in Homegames

This folder is the complete native game: `index.js`, `README.md`, and `LICENSE`. Its only runtime dependency is `squish-142`, supplied by Homegames.

Place the folder at `homegames-core/src/games/tug-club`. The core LocalLibrary scanner discovers its `index.js`. Restart the local host if its library is already loaded, then launch **Tug Club** from the game library. Use the existing Homegames session/link flow for multiplayer. No platform code changes are required.

For Studio, use the contents of `index.js` as the game entry point and keep this README and LICENSE beside it. The game declares the multiplayer service and is also eligible for local play. Publishing and any catalog presentation requirements remain part of the normal Homegames workflow; this deliverable is not published to the public catalog.

The separately supplied `tug-club.html` contains this same source and the existing Homegames player, bundled into one offline solo copy. Open it in a regular browser. No build step or account is needed. A hosted session is needed for people on separate devices to play together.

## Why this game

Tug Club makes the Homegames idea visible in one round: enter immediately, invite another person, and make a shared space better together. Physics provides the little stories—two pilots pulling the wrong way, a last-second boost, a crew arriving with the big heart. The home is the score: windows light up, a roof appears, a garden grows, and a flag goes up.

The first pass is deliberately forgiving. Fast, coordinated crews can finish well ahead of the timer; best completion time gives them a replay target. Real group playtesting should guide the next balance pass.

## Make it yours

`RULES` at the top of `index.js` is the workbench for duration, flight speed, boost, rope length and effects budget. The literal metadata `tickRate` and `maxPlayers` must stay consistent with their RULES counterparts.

- Change `C` and `CREW` for a different look.
- Change the cargo spots in `start()` to design a new expedition.
- Change `drawHome()` to build a garden, castle, station, or something stranger.
- Adjust the heart's mass in `addCargo()` to tune the final shared haul.

Completed homes and the best completion time use the platform's `saveGame` callback where available. Mid-round state is not saved. The offline copy uses its own stable game key, `tug-club-v1`; broader platform save/version behavior follows the installed Homegames runtime.

## Implementation notes

The game uses shared world state with private identity/control HUDs. Tethers apply spring forces to the ship and the cargo, so multiple pilots contribute real forces. Transient particles use a bounded pool; ships, cargo and per-player HUDs are removed when they leave the scene. Rendering stays within the Squish 142 polygon and coordinate constraints.

The game also completes pointer actions on release because short presses can occur between the existing client's input frames. This is handled inside the game.

Sound and controller-specific input are intentionally left for a later pass.

## License

GNU GPL version 3. See `LICENSE` for the complete text.
