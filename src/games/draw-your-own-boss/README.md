# Draw Your Own Boss

Paint a 12 × 12 monster, name it, choose charge/spit/minion attacks and a difficulty,
then bring it to life. Tap to move or use WASD/arrows; firing is automatic. Up to
four players share one fight. Downed players revive while a teammate survives.

The first player controls the workshop; ownership transfers on departure. Share
invites friends into the fight. Download game or Share a copy includes the edited
monster and recorded roar. Recording uses the session's media request; capable
clients handle permission and return audio bytes. The bundled roar works without
a microphone. Node/WebSocket sessions support the same named-byte export and
game-copy protocol.

`creation.js` contains the default design and `assets/roar.wav` is original,
local synthesized audio. The game saves overrides with
`createExport('monster.json', bytes)` and `createExport('roar.wav', bytes)` and
reads them from constructor `userExports`. On disk, the session places these in
`user-exports/`: edit the files and restart to try a mod. Browser hosts persist
them locally and include them in newly downloaded copies. Source and default
assets are unchanged; an active fight is not exported. All code and bundled media
in this directory are MIT licensed.
