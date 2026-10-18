'use strict';
// Short, readable lessons live beside the real implementation they describe.
module.exports = [
    {
        title: 'Make a little somebody', short: 'Shapes & scenes', tag: '01 / THE DRAWING DESK',
        intro: ['A game starts with a scene.', 'Shapes, text and images are', 'nodes. Put them together', 'and something comes alive.'],
        goal: ['Make a mint triangle.', 'Then turn its glow on.'],
        code: ['class Backstage extends Game {', '  getLayers() {', '    return [{ root: this.base }];', '  }', '}', '', 'root.addChild(new GameNode.Shape({', '  shapeType: Shapes.POLYGON,', '  coordinates2d: points,', '  fill: [129, 222, 184, 255]', '}));'],
        detail: ['This workshop is a regular Game.', 'Its nodes use a 0–100 screen.', 'Children draw over their parent;', 'later children draw on top.', 'Glow uses effects.shadow.', 'Source: ui.js / robot'], reference: 'Studio: Make a shape · Core: shape-test',
    },
    {
        title: 'Give your toy a job', short: 'Inputs', tag: '02 / THE CONTROL ROOM',
        intro: ['Inputs turn a picture into a toy.', 'Clicks and touch can share', 'the same action. Keys and', 'controllers can move it too.'],
        goal: ['Name your toy. Move it into', 'the socket, then drag the', 'gold plug into the mint dock.'],
        code: ['onClick: (id, x, y) => move(x, y)', 'onDrag: (id, x, y) => drag(x, y)', 'offClick: id => release(id)', '', "input: { type: 'text',", '  oninput: (id, text) => rename(text)', '}', '', 'handleKeyDown(id, key) { ... }', 'handleKeyUp(id, key) { ... }', 'handleGamepadInput(id, state) { ... }'],
        detail: ['Tap the floor or use the arrows.', 'WASD / arrow keys work too.', 'A controller can use its left stick.', 'The gold plug uses drag + release.', 'Hover also changes its outline.', 'Source: index.js / renderInputs'], reference: 'Studio: Move / Drag · Core: move-test',
    },
    {
        title: 'Find the rhythm', short: 'Time & sound', tag: '03 / THE HEARTBEAT',
        intro: ['A tick changes the world.', 'Small changes, repeated,', 'become motion. An audio', 'asset gives an action a voice.'],
        goal: ['Tap CATCH as the moving', 'spark crosses the mint zone.', 'Catch three to start the heart.'],
        code: ['static metadata() {', '  return { tickRate: 20, assets: {', "    chime: new Asset({ type: 'audio',", "      path: './assets/chime.wav' })", '  }};', '}', '', 'tick() { this.time += 1 / 20; }', '// Move an existing node:', 'spark.update({ coordinates2d: points });', '// A fresh Asset node plays a sound.'],
        detail: ['Pause freezes this experiment.', 'Speed changes the simulation.', 'The chime is bundled in the game.', 'Your first tap enables audio.', 'Animation can also swap images.', 'Source: index.js / tick, sound'], reference: 'Studio: Sound · Core: animation-test',
    },
    {
        title: 'There is more offscreen', short: 'Worlds & cameras', tag: '04 / THE LOOKOUT',
        intro: ['A ViewableGame has a world', 'larger than the screen.', 'A view selects a window.', 'Each player can look at a', 'different part of that world.'],
        goal: ['Pan to find three beacons.', 'Tap each one to light it.', 'Try zooming the camera too.'],
        code: ['class Lookout extends ViewableGame {', '  constructor() { super(200); }', '}', 'world.getPlane().addChild(landmark);', '', 'const slice = ViewUtils.getView(', '  world.getPlane(),', '  { x, y, w: 100, h: 100 },', '  [playerId],', '  { x: 6, y: 29 },', '  { x: 0.58, y: 0.40 }', ');'],
        detail: ['This station uses a real', 'ViewableGame inside the workshop.', 'The world is 200 × 200.', 'The HUD stays in screen space.', 'Only your camera moves.', 'Source: lookout.js'], reference: 'Studio: Scrolling World · Core: draw',
    },
    {
        title: 'A secret, a signal, a friend', short: 'Multiplayer', tag: '05 / THE SHARED MACHINE',
        intro: ['One game can serve a room.', 'Some things are shared.', 'Some things belong on just', 'one player’s screen. A player', 'ID tells the game who acted.'],
        goal: ['Read your private symbol.', 'Send it to charge the machine.', 'Invite a friend with Share,', 'or use the labeled solo helper.'],
        code: ['handleNewPlayer({ playerId, info }) {', '  // Make their private screen.', '  const root = new GameNode.Shape({', '    ...panel, playerIds: [playerId]', '  });', '}', '', 'onClick: id => {', '  if (id !== owner) return;', '  // Check who may act, too.', '}', 'handlePlayerDisconnect(id) { ... }'],
        detail: ['Your symbol is scoped by playerIds.', 'The charge count is shared state.', 'Hiding a control is not permission:', 'callbacks check the actor’s ID.', 'A helper is a bot, not a second user.', 'Source: index.js / renderTogether'], reference: 'Studio: Together · Core: defuse / engine-room',
    },
    {
        title: 'Put something of yours in it', short: 'Files & assets', tag: '06 / THE MEDIA BOOTH',
        intro: ['Games can carry images and', 'sound, and accept image,', 'audio or video uploads.', 'A file becomes an Asset', 'that the scene can display.'],
        goal: ['Play the bundled postcard', 'and chime, or choose your', 'own image, audio or video.'],
        code: ["input: { type: 'file',", '  oninput: async (id, bytes, meta) => {', '    const asset = await', '      handleFileUpload(id, bytes, meta);', '    root.addChild(new GameNode.Asset({', '      assetInfo: { [asset.key]: {', '        pos: { x: 12, y: 33 },', '        size: { x: 46, y: 30 },', '        startTime: 0', '      }}', '    }));', '  }', '}'],
        detail: ['Uploads stay in this session.', 'Use short clips under 5 MiB.', 'A fresh node replays the asset.', 'Playback clocks are per device.', 'Export bytes explicitly to keep them.', 'Source: index.js / upload'], reference: 'Studio: Image Upload · Core: input-test',
    },
    {
        title: 'Step into the broadcast', short: 'Streams & recording', tag: '07 / ON AIR · OPTIONAL',
        intro: ['A stream is live media.', 'A recording is a new file.', 'Both ask for your permission.', 'Live media needs browser', 'RTC play and a secure page.'],
        goal: ['Try a microphone or camera,', 'or record a three-second clip.', 'No gear? Take the no-device', 'route and keep exploring.'],
        code: ['const stream = await media.request(id,', '  { audio: true, video: true });', 'root.addChild(new GameNode.Stream({', '  streamId: stream.id,', '  pos: { x: 12, y: 33 },', '  size: { x: 46, y: 30 }, audio: true', '}));', 'media.stop(stream.id);', '', 'const { bytes, meta } = await', '  media.record(id, { durationSeconds: 3 });'],
        detail: ['Everyone in the session may receive', 'live streams; hidden nodes do not', 'make private voice channels.', 'Leaving this booth stops capture.', 'A recording plays back as an Asset.', 'Source: index.js / capture, record'], reference: 'Core: walkie-talkie / pitch-pot',
    },
    {
        title: 'Make it yours. Keep it.', short: 'Saves & exports', tag: '08 / THE PACKING TABLE',
        intro: ['A save remembers progress.', 'An export is a file you made.', 'A portable game carries code', 'and assets, plus your exports.', 'Your toy can leave this room.'],
        goal: ['Save a checkpoint. Then', 'export your toy and passport.', 'Open View exports in the', 'player menu to download them.'],
        code: ['await saveGame({ schema: 1,', '  design, done, visited });', '// Next session: constructor({saveData})', '', 'await createExport(', "  'backstage-design.json',", '  new TextEncoder().encode(', '    JSON.stringify(design)', '  )', ');', '// Copies receive constructor({userExports}).'],
        detail: ['Save keeps this tour’s checkpoint.', 'Export keeps a JSON design, a text', 'passport and an SVG postcard.', 'Download game ZIP to edit in Studio;', 'game HTML can play offline.', 'Source: index.js / checkpoint, exportToy'], reference: 'Core: savegame_demo / draw-your-own-boss',
    },
];
