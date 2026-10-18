# House Band

Make music by yourself or with friends

Up to eight people edit the same 16-step loop, with independent **DRUMS**,
**BASS**, **FX**, and **ROOM** tabs. Press **PLAY** to hear the starting pattern.
The first device has sound enabled; joining devices start muted and can use
**SOUND OFF / SOUND ON** at the top to enable or mute their own audio. In the
same room, use one speaker to avoid delayed copies. Remote listeners hear notes
as they arrive; devices are not acoustically synchronized.

- Use **Invite** in the Homegames toolbar to bring friends into the session.
- Tap drum pads to toggle beats. **1–8** and **9–16** select half of the bar.
- In Bass, choose a note, then place it in a step; tap the same note to erase.
- Drag the FX pad: right opens the tone; up adds echo. The nine combinations
  affect new notes. Room has shared track mutes and the connected players.
- **EXPORT WAV** renders four bars. Open **More → View exports** to preview or
  save `house-band-loop.wav`.

Space starts/stops playback, 1–4 change your tab, Z undoes your most recent step
edit, and M changes sound on your device. Undo preserves later edits by other
people. Only the first connected person can clear the pattern; two separate
presses are required, and an intervening arrangement edit cancels confirmation.

## Keep it, share it, remix it

Edits autosave through the host's local save/export storage. The
`house-band.json` arrangement is included in subsequent HTML and ZIP downloads;
a fresh copy uses it as its starting loop. Existing local progress takes
precedence when reopening the same installation. The optional WAV also travels
inside the pack and captures the pattern at the moment Export was pressed.
Failed saves remain visible; **SAVE AGAIN** retries. Sound choices, connections,
playback position and personal undo history are not part of the arrangement.
Reloading preserves the music and opens paused. Playback stops when the room
empties; one listener leaving or muting does not stop the others.

The synthesizer in `sound.js` generates original kick, snare, hat and pentatonic
bass samples, including all tone/echo variants. No samples, fonts, account APIs
or external audio services are fetched. Source and synthesis are MIT licensed.

## Timing and release acceptance

Live notes follow the host's scene clock. Keep the host visible and awake; a
suspended host skips missed beats on return rather than playing them all at
once. WAV export uses exact sample positions and wraps the tail for looping.
Idle sessions stop emitting frames after sound and meters settle. Active audio
uses a bounded voice pool; every voice is scoped to opted-in listeners.

The instrument has a one-bar pattern, three drum voices, five bass notes,
tempo, track mutes, and nine tone/space settings. It does not record microphones
or upload samples. Physical phones, real-group pacing and constrained-network
latency remain release acceptance work. See the [polish review](../../../docs/review-evidence/house-band-polish-2026-10-18/README.md).
