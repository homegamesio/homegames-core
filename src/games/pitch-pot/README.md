# Pitch Pot

A camera party game for 2–8 players (best with 3 or more). Each player writes one
object, then pitches someone else's invention in a 30-second video. Everyone
watches the clips together and votes for the most convincing salesperson.

Open **Pitch Pot** in the Homegames dashboard with **browser Play**, then invite
friends using Share. Use the updated client on every device; camera access needs
HTTPS or localhost. This game needs the updated `media.record` service, available in browser play,
automatic RTC and Core/WebSocket hosting. Manual RTC pairing does not provide
a recording endpoint.

1. The first connected player starts the round. Everyone submits one idea (up to
   90 characters). Submitted ideas are locked.
2. Every idea goes to exactly one other player, with no self-assignments. Each
   player sees only their assigned idea, without its writer's name yet.
3. Open the recording booth, enable camera and microphone, check the preview,
   and press Record. After a three-second countdown, record for 30 seconds with
   the idea visible. Recording stops automatically and the clip is submitted.
   Capture stays on that device; there is no live broadcast. Permission errors
   and cancellations allow retries. Skip is available for camera trouble.
4. Once everyone finishes, the host plays each clip. Each screening shows the
   pitcher's name, the idea, and the writer's session name.
   Replay/Next unlock after 30 seconds. Tap the game to enable playback sound.
5. Round participants have 45 seconds to vote for one other pitch. Results appear
   once all eligible players vote or time expires. Ties share the win. The host
   can start a new round, including anyone who joined during the last one.

Leaving transfers the host controls. An unfinished pitch from a departing player
is skipped; their completed clip and original writing credit are retained. Late
arrivals watch this round and participate in the next. No clips means no winner.

Clips are limited to 2 MiB each and sent to the room on completion. Pitch Pot also
calls `createExport(name, bytes)` to retain each clip as a named WebM or MP4 file.
Open **View exports** in the game frame to preview and save any pitch, including
clips from earlier rounds. Everyone in the room can download them, even before
the screening. Names include round, player ID and idea, with a suffix to avoid
replacing an imported clip. The session stores exports locally; game ZIP/HTML
downloads and peer copies include them. No account or media API is involved.

A player's next clip replaces their old playback asset in session storage,
keeping the eight live recording slots within the RTC transfer budget. Export
files are separate: the host caps them at 128 files and 64 MiB total. If storage
fails or fills, the clip still plays this round and the game reports that it was
not saved. Imported clips remain available in View exports; they do not restore
an old round or its votes. Playback is local to each
device; the host can replay if a slow connection or late join misses a clip.
Browser codecs and permission behavior vary. Mobile hardware testing is separate
from automated desktop browser coverage.
