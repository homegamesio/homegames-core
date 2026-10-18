# Tabletop Railway

Invite up to four players, physically line up their screens, and use Move left /
Move right until the screen numbers match. The first player starts the service.
There is no automatic device-location or physical-screen detection.

Each player sees their own station. Trains travel left to right and wrap from the
last screen to the first. Cargo labels name the destination screen and platform:
`2B` means screen 2, platform B. Set the switch before a train reaches the middle
of the screen; the route locks as it enters the junction. Stop / Go holds arriving
trains at the approach signal. Deliver twelve trains before four minutes or three
lost trains. A missed platform gives a train another lap. Solo practice uses a
single looping screen.

Joining or leaving during a run returns everyone to arrangement so no train is
stranded on a missing screen. First-player ownership transfers on departure.
`rules.js` owns the shared simulation; Squish player-scoped roots produce a
separate station view for each device. `creation.js` supplies pace and delivery
goal defaults. The game writes settings as named `railway.json` bytes via `createExport` and
reads them from `userExports`. The session stores the file in `user-exports/` and
includes it in game copies. Active trains and screen assignments are excluded. Graphics are local geometry; all files are MIT
licensed and the portable game can run offline (online invitations are optional).
