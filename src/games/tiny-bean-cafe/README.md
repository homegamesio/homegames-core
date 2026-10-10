# Tiny Bean Café

A colorful pretend coffee shop for little hands. Each animal asks for one of seven illustrated drinks. Tap near the glowing ring to use the next tool, then tap the animal to serve the finished cup. Equipment responds with a short animation and then patiently waits for another tap. There are no failures or countdowns, and the pictures and generous tap targets guide play without reading.

Customers include a cat, cow, giraffe, dog, pig, and horse. Shuffled selections bring a different animal, outfit, and clothing color for each new customer. Four outfit templates include a heart shirt, stripes, overalls, and a bow-tie cardigan. The same friend and order stay throughout preparation, serving, and celebration. All six animals visit before the next shuffled round, with no immediate repeats at the boundary. Orders also shuffle through all seven recipes before repeating; the first order is coffee cream.

The preparation tools are chunky toy shapes: a deep basket with a thick handle, visible coffee grounds, and a broad tamper that presses into the basket. The prepared basket moves into the machine before espresso flows, and resets empty for the next drink.

Six coffee recipes show different layers: espresso, americano (espresso and water), cortado (equal coffee and milk), cappuccino (coffee, milk, and a generous foam cap), latte (more milk and a thin foam cap), and mocha (chocolate, coffee, milk, and foam). Foamy drinks receive an animated heart. Coffee cream is simply whipped cream in a paper cup, with its own dispenser and fluffy topping. These are playful illustrative proportions rather than beverage preparation instructions.

The café uses a spacious 3:2 landscape layout, a plain backdrop, an animal's request bubble, and one illustrated order card at a time. The pulsing ring identifies the next tool, with a short instruction underneath. Only taps near that ring advance preparation; unrelated taps, keyboard input, and taps during animations cannot skip steps or queue actions. Held input counts once and must be released before another action. The finished drink waits indefinitely for a final tap on the highlighted customer. A new order begins after serving and celebration. The top-left sound control mutes all audio.

Original synthesized sound effects follow the equipment: a grinder whirr and bean rattle, a soft tamp, a coarse espresso-machine “grrrr” and trickle, water and milk pours, steam, a chocolate shake, ceramic cup contacts, a paper-cup rustle, and a whipped-cream “psssh.” These are gentle approximations of real café sounds, generated as embedded PCM WAV assets without recordings, downloads, or external services. Repeated taps cannot stack an unlimited number of voices.

The user requested inspiration from *Baby Barista*, the coffee primer by Joel and Amber Palmer, illustrated by Anastasiia Sokolova. The [authors’ book introduction](https://joelandamberphotography.com/baby-barista-coffee-primer/) informed the coffee-shop theme and warm retro board-book palette. All game illustrations, characters, layout, animations, and audio are original; no book images or text are reproduced.

Native Squish 142; works in local and hosted Homegames sessions. All art and audio are generated in this folder without external downloads. Particle and audio pools are bounded, and each cup resets in place. GPLv3; see LICENSE.

Focused regression checks:

```sh
node testRunner.js ./test/games/TinyBeanCafe.test.js
```
