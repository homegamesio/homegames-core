# Little Zoo Walk

Explore six friendly habitats at your own pace. Meet an elephant, giraffe, lion, penguin, monkey, and zebra, each with its own movement, original quiet sound, and illustrated snack. There are two activities to choose from, with no countdown, penalty, or reading requirement.

- **Feed:** choose a pictured snack, then tap the animal inside the pulsing gold guide. The snack flies over and the animal responds. Apples, leafy branches, meat, fish, bananas, and greens suit the different animals.
- **Play:** tap the gently moving striped ball to send it to the animal. Watch its return arc, then find it again. The target is generous and never expires.
- Three feeds or catches earn a gold animal stamp. The six stamps persist when walking forward, backward, or around the zoo; play can continue after earning them.
- Tap an animal with empty hands or **say hello!** to greet it. The elephant curls its trunk, the giraffe nods, the lion roars, the penguin flaps, the monkey hops, and the zebra trots.
- Bottom arrows walk between habitats. Keyboard: left/right walk; **1** picks up a snack; **2** chooses catch; Space or Enter feeds, returns the ball, or greets. Holding a key or pointer never repeats or queues an action.
- Upper-left **sound on/off** interrupts or restores sound. No activity requires sound.

All audio is original, deterministic synthesis: playful animal impressions rather than field recordings. The seven cues use fourteen alternating inline PCM WAV assets, with a peak below 6% and at most three simultaneous voices. Scene nodes and audio voices remain bounded during repeated visits.

Portable Squish 1.5.0, vector art, 3:2 landscape. Copy this whole folder including its MIT `LICENSE`; no other game folder, service, or external asset is required.

```sh
node testRunner.js ./test/games/LittleZooWalk.test.js
```

Checks cover every habitat and snack, moving catch targets, two-stage feeding, persistent stamps, input/repeat guards, muting, WAV limits, and actual production GameSession/playerFrame serialization during greetings, walking, food flights, and catch arcs.
