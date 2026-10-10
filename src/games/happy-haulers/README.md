# Happy Haulers

A friendly dump truck delivers colorful toy blocks to build a little town. Designed for small hands: tap anywhere to load, tap again to drive, and tap again to tip the blocks into place. Each action has a short animation, and the next action waits patiently. Three deliveries build a castle, followed by a gentle celebration and automatic replay. No losing, deadlines, steering, or reading required.

- Touch or mouse: tap anywhere in the playfield. Taps during an animation make little stars.
- Keyboard: space, Enter, arrows, letters, or numbers. Held keys and held pointers count once until released.
- Gamepad: any face button.
- Sound: top-right sound control turns soft musical notes on or off.

The game uses original polygon illustrations and generated quiet PCM WAV sounds. It runs in both local and hosted Homegames sessions through Squish 142, with no downloads or outside services. Sounds and particles have fixed bounds; each new town clears the previous one.

Run the native regression checks from homegames-core:

```sh
node testRunner.js ./test/games/HappyHaulers.test.js
```
