# SquishJS Game Authoring — Technical Reference for Code Generation

> Context document for an LLM that writes Homegames games. Everything here is verified against `squishjs@1.3.8` (the `squish-138` alias) and real published games. If you generate a game, follow this contract exactly. Code that violates the **Hard Constraints** section will be auto-rejected by the publishing pipeline before a human ever sees it.

---

## 1. What a Homegames game is

A Homegames game is a **single JavaScript class** that extends `Game` from a versioned SquishJS package. The server (`homegames-core`) instantiates the class, repeatedly serializes ("squishes") its scene graph into a compact binary form, and streams it to every connected browser client over WebSocket. Clients render the scene and send input (clicks, key presses) back to the server, which calls methods on your game instance.

Key mental model:

- **You never render or draw.** You build and mutate a tree of nodes (`Shape`, `Text`, `Asset`). The client draws them.
- **You never write networking.** The server multiplexes all players into one shared game instance. Player input arrives as method calls.
- **The coordinate plane is `0–100` on both axes**, regardless of screen size or aspect ratio. `(0,0)` is top-left, `(100,100)` is bottom-right. Think percentages.
- **State changes are not automatic.** After you mutate a node, you must signal it (see §4). This is the #1 mistake — read §4 carefully.
- **The game is shared, not per-player.** One instance serves all players. Per-player visuals are done with `playerIds` (see §8), not separate instances.

---

## 2. Hard Constraints (your code is validated automatically)

The publish pipeline runs an AST scan, then loads and runs your game in a Docker sandbox for ~5 seconds. To pass:

1. **Entry point is `index.js`** and it must `module.exports = YourGameClass;` (a class, not an instance).
2. **`require` only the SquishJS package and your own local files.** Use `require('squish-138')`. Do **not** require Node built-ins (`fs`, `http`, `https`, `net`, `child_process`, `os`, `path`, `crypto`, `cluster`, `dgram`, etc.). Do not make network requests, touch the filesystem, spawn processes, or read `process.env`.
3. **No dynamic code execution:** no `eval`, no `new Function(...)`, no `require(variable)`.
4. **`static metadata()` is required** and must return an object whose `squishVersion` matches the package you imported (`'138'` for `squish-138`).
5. **It must not throw** during `require`, construction, or the first few seconds of ticking. A crash = rejected.
6. **Size limits:** total game ≤ 20 MB, any single file ≤ 5 MB. Keep assets external (referenced by id), not inlined.
7. **License:** published games are GPLv3. A `LICENSE` file is required at publish time (not your concern when generating the game code itself, but don't add a conflicting license header).

Default to **`squish-138` / `squishVersion: '138'`** for all new games. (Older games pin other versions like `1006`, `0767`, `136`; the version in the `require` and in `metadata()` must always match.)

---

## 3. The Game class contract

Extend `Game` and implement these. Only `metadata()`, the constructor, and `getLayers()` are mandatory; the rest are optional hooks the server calls when present.

```js
const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-138');
const { COLORS } = Colors;

class MyGame extends Game {
    // REQUIRED. Static. Describes the game. squishVersion must match the require above.
    static metadata() { return { squishVersion: '138', name: 'My Game' /* ... */ }; }

    // REQUIRED. Build your initial scene graph. ALWAYS call super() first.
    constructor() {
        super();
        // build this.base and children here
    }

    // REQUIRED. Return the layer list. Almost always a single root.
    getLayers() {
        return [{ root: this.base }];
    }

    // OPTIONAL HOOKS (implement the ones you need):

    // A player joined. info.name is their display name.
    handleNewPlayer({ playerId, info, settings, clientInfo }) {}

    // A player left. Clean up their nodes/state.
    handlePlayerDisconnect(playerId) {}

    // Keyboard input. key is like 'ArrowUp', 'w', 'a', ' ', 'Enter', etc.
    handleKeyDown(playerId, key) {}
    handleKeyUp(playerId, key) {}

    // Called every frame if metadata().tickRate is set. Use for game loops/physics.
    tick() {}

    // Gatekeeper for joins. Return false to refuse the player (e.g. game full).
    canAddPlayer() { return true; }

    // Called when the session ends. Base Game.close() clears tracked timers (see §10).
    // Override to also remove nodes, but you usually don't need to.
    close() { super.close?.(); }
}

module.exports = MyGame;
```

**Method signatures are exact and important:**
- `handleNewPlayer` receives a **single object** `{ playerId, info, settings, clientInfo }` — destructure it. `playerId` is a number. `info.name` is the player's name.
- `handlePlayerDisconnect(playerId)` receives the **bare id**, not an object.
- `handleKeyDown(playerId, key)` / `handleKeyUp(playerId, key)` — two positional args.
- A node's `onClick` receives `(playerId, x, y)` — see §9.

---

## 4. The single most important rule: state changes need `onStateChange()`

Node properties (`coordinates2d`, `fill`, `color`, `text`, `playerIds`, ...) are **plain fields with no setters**. Mutating them updates your data but does **not** push anything to clients. You must notify after mutating:

```js
// Move a node and recolor it:
this.player.node.coordinates2d = ShapeUtils.rectangle(newX, newY, 5, 5);
this.player.node.fill = COLORS.RED;
this.base.node.onStateChange();   // <-- REQUIRED. Without this, nothing updates on screen.
```

Rules of thumb:
- After a batch of direct property mutations, call `onStateChange()` **once** on your root node (`this.base.node.onStateChange()`).
- The convenience methods that change tree structure already notify for you: `addChild`, `addChildren`, `removeChild`, `clearChildren`, and `BaseNode.update(...)`. You do **not** need an extra `onStateChange()` after those.
- In a `tick()` loop, do all your mutations, then one `onStateChange()` at the end.

Two equivalent ways to change a node:

```js
// (a) BaseNode.update() — sets fill and/or coordinates2d AND notifies:
this.box.update({ fill: COLORS.GREEN, coordinates2d: ShapeUtils.rectangle(10, 10, 20, 20) });

// (b) Direct field mutation + explicit notify:
this.box.node.fill = COLORS.GREEN;
this.base.node.onStateChange();
```

To change text, reassign the whole `text` object (then notify):

```js
this.scoreText.node.text = { text: `Score: ${this.score}`, x: 50, y: 10, size: 3, align: 'center', color: COLORS.WHITE };
this.base.node.onStateChange();
```

---

## 5. `metadata()` reference

```js
static metadata() {
    return {
        squishVersion: '138',          // REQUIRED. Must match require('squish-138').
        name: 'Hot Potato',            // Display name.
        author: 'Your Name',           // Creator.
        description: 'One-line pitch shown in the catalog.',
        aspectRatio: { x: 16, y: 9 },  // Display aspect ratio. Common: {16,9}, {4,3}, {1,1}.
        thumbnail: 'asset-id-hash',     // Optional asset id used as the catalog thumbnail.
        tickRate: 60,                   // Frames/sec for tick(). Omit if you have no game loop.
        assets: {                       // Optional. Images/audio/fonts (see §11).
            'potato': new Asset({ id: '48685183f94c7a3c14f315444c6460bd', type: 'image' })
        }
    };
}
```

- The plane is always `0–100`; `aspectRatio` only controls how that square is presented (letterboxing on the client). Build your layout in `0–100` space and pick an aspect ratio that suits it.
- `tickRate` is frames per second. `60` for action games, `10–30` for casual, omit entirely for purely event-driven games (click/turn-based) that update only in handlers.

---

## 6. Coordinates and colors

**Coordinates** are `[x, y]` pairs in `0–100` space. A shape's `coordinates2d` is an array of vertices. Build rectangles and triangles with `ShapeUtils`:

```js
ShapeUtils.rectangle(x, y, width, height)
// returns [[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]  (top-left origin, closed loop)

ShapeUtils.triangle(x1, y1, x2, y2, x3, y3)
// returns [[x1,y1],[x2,y2],[x3,y3],[x1,y1]]
```

You can also pass a raw vertex array for arbitrary polygons: `coordinates2d: [[10,10],[90,10],[50,90],[10,10]]`.

**Reading a rectangle's position/size back** (common in physics/collision code):

```js
const x = node.node.coordinates2d[0][0];
const y = node.node.coordinates2d[0][1];
const w = node.node.coordinates2d[1][0] - x;
const h = node.node.coordinates2d[2][1] - y;
```

**Colors** are `[r, g, b, a]` arrays, each `0–255`. `a` (alpha) of `0` is fully transparent, `255` fully opaque.

```js
const { COLORS } = Colors;
COLORS.RED;            // [255, 0, 0, 255]
COLORS.HG_BLUE;        // [148, 210, 230, 255]  (Homegames brand blue)
[0, 0, 0, 0];          // transparent (useful for invisible click targets / hit boxes)
Colors.randomColor();  // a random named color
Colors.randomColor([COLORS.BLACK, COLORS.WHITE]); // random, excluding given colors
```

There is a large named palette (e.g. `BLACK, WHITE, RED, GREEN, BLUE, GOLD, EMERALD, CORAL, TEAL, PURPLE, HG_BLUE, HG_RED, HG_YELLOW, CANDY_RED, CANDY_PINK, SKY_BLUE, ...`). When unsure, use a named color or an explicit `[r,g,b,a]` array.

---

## 7. Node types

There are exactly three, all created via `GameNode`. All accept an optional numeric `id`, `playerIds`, and (for visible nodes) `onClick`, `onHover`, `offHover`.

### 7.1 `GameNode.Shape` — polygons, rectangles, lines

```js
const box = new GameNode.Shape({
    shapeType: Shapes.POLYGON,                      // POLYGON | LINE  (do NOT use CIRCLE)
    coordinates2d: ShapeUtils.rectangle(10, 10, 30, 20),
    fill: COLORS.CORAL,                             // interior color (RGBA). PREFER fill.
    // color: COLORS.BLACK,                          // also accepted; used for lines/strokes
    border: { color: [0, 0, 0, 255], width: 2 },    // optional outline
    onClick: (playerId, x, y) => { /* ... */ },     // optional; makes it interactive
    playerIds: [0]                                   // [0] = everyone (default). See §8.
});
```

- `shapeType` comes from `Shapes`: `Shapes.POLYGON` (the workhorse) or `Shapes.LINE`.
- **`Shapes.CIRCLE` exists as a constant but is NOT rendered — do not use it.** Approximate circles with a many-sided polygon if you truly need a round shape, but in practice rectangles/polygons cover everything.
- **Use `fill` for the shape's color.** (`color` is also accepted and is primarily for line/stroke color; real games overwhelmingly use `fill` for polygons.)
- Rectangles and arbitrary polygons via `POLYGON` cover ~95% of needs. Prefer them.
- Transparent fill `[0,0,0,0]` + an `onClick` makes an invisible hit-box / button overlay.
- A `Shape` can also carry an `input` field (to act as an on-screen text box) and `onHover`/`offHover` callbacks — see §9.

### 7.2 `GameNode.Text`

```js
const label = new GameNode.Text({
    textInfo: {
        text: 'Hello',
        x: 50, y: 20,        // anchor position in 0–100 space
        size: 2,             // relative font size (1 ≈ small, 3 ≈ large heading)
        align: 'center',     // 'left' | 'center' | 'right'
        color: COLORS.WHITE,
        font: 'default'      // optional
    }
});
```

Note the field is `textInfo` in the constructor, but it is stored on the node as `node.text` (so you update it via `label.node.text = {...}`, see §4).

> **Text nodes are NOT clickable.** Unlike `Shape` and `Asset`, the `Text` constructor only accepts `{ textInfo, playerIds, input, node, id }` — there is **no `onClick`, `onHover`, or `offHover`**. Passing an `onClick` to a `Text` node does nothing; it is silently dropped and the text will never respond to taps. **To make a clickable text label / "button", put the click handler on a `Shape` and render the `Text` on top of it** — see §7.2.1.

#### 7.2.1 Text is not a button — build buttons from a Shape + Text

There is no button node and text cannot receive clicks. A "button" is just a **clickable `Shape` polygon with a `Text` node positioned on top of it**. The `Shape` carries the `onClick` and the visible background; the `Text` carries the label and must be drawn *after* (or as a sibling added after) the shape so it sits on top. Size the shape — not the text — to define the tap target, and center the text over it.

```js
// Reusable helper: a rectangular button at (x,y) sized (w,h) with a centered label.
makeButton({ x, y, w, h, label, fill, onClick }) {
    const bg = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(x, y, w, h),
        fill,
        onClick   // the SHAPE is what's clickable
    });
    const text = new GameNode.Text({
        textInfo: {
            text: label,
            x: x + w / 2,        // horizontal center of the shape
            y: y + h / 2 - 1.5,  // nudge up so the text baseline looks vertically centered
            size: 2,
            align: 'center',     // pairs with x being the center
            color: COLORS.WHITE
        }
        // NO onClick here — it would be ignored. The bg shape handles the tap.
    });
    bg.addChild(text);           // text rides along as a child of the button background
    return bg;
}

// usage:
const startBtn = this.makeButton({
    x: 35, y: 45, w: 30, h: 12, label: 'Start', fill: COLORS.GREEN,
    onClick: (playerId, x, y) => this.startGame(playerId)
});
this.base.addChild(startBtn);
```

Notes:
- The text's `x`/`y` are independent plane coordinates, **not** relative to the parent shape — compute them from the shape's position (`x + w/2`, etc.). Adding the text as a child of the shape only affects render order and tree cleanup, not positioning.
- Because the text is a child of the button shape, removing the button (`removeChild(bg.id)`) removes the label with it.
- The whole shape is the hit target, so the player can tap anywhere on the button — including directly on the letters — and the shape's `onClick` fires. The text being non-interactive doesn't create a "dead zone".
- For an invisible text-over-image button, use the same pattern with a transparent fill `[0,0,0,0]` or an `Asset` node as the background.

### 7.3 `GameNode.Asset` — images and audio

```js
const sprite = new GameNode.Asset({
    coordinates2d: ShapeUtils.rectangle(25, 25, 50, 50),  // clickable bounds of the node
    assetInfo: {
        'potato': {                       // KEY must match a key in metadata().assets
            pos:  { x: 30, y: 35 },       // where the image's top-left sits, 0–100 space
            size: { x: 40, y: 30 }        // image width/height, 0–100 space
        }
    },
    playerIds: [0]
});
```

Audio is also an `Asset` node — give it zero size and a `startTime` (seconds into the clip):

```js
const sound = new GameNode.Asset({
    coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
    assetInfo: {
        'hiss': { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 }
    }
});
// Add it to the tree to play; remove it to stop:
this.base.addChild(sound);
this.setTimeout(() => this.base.removeChild(sound.id), 250);
```

The `assetInfo` key (`'potato'`, `'hiss'`) is a **reference to `metadata().assets`** — you do not embed image/audio bytes in the game; you reference them by the asset id declared in metadata.

---

## 8. Player visibility model (`playerIds`)

Every node has `playerIds`, an array controlling who sees it:

- `[0]` (the default) → **visible to all players.**
- `[42]` → visible only to player `42`.
- `[42, 99]` → visible to players `42` and `99`.

This is how you build per-player UI (private hands, individual HUDs, "your turn" prompts) in a single shared game. Helpers on every node:

```js
node.showFor(playerId);   // add a player to the visibility set (and drop the "everyone" 0)
node.hideFor(playerId);   // remove a player; if none left, reverts to [0] (everyone)
// or set directly, then notify:
node.node.playerIds = [playerId];
this.base.node.onStateChange();
```

Example — give each player their own colored marker only they can see:

```js
handleNewPlayer({ playerId }) {
    const marker = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(45, 90, 10, 5),
        fill: Colors.randomColor(),
        playerIds: [playerId]   // only this player sees it
    });
    this.players[playerId] = marker;
    this.base.addChild(marker);
}
```

---

## 9. Input

### Clicks / taps
Attach `onClick` to a **`Shape` or `Asset`** node (the only node types that accept it — **`Text` does not**, see §7.2). Signature: **`(playerId, x, y)`** — the clicking player's id, and the click position in `0–100` plane space. To make a clickable label, put the `onClick` on a `Shape` and lay a `Text` node on top of it (§7.2.1).

```js
const button = new GameNode.Shape({
    shapeType: Shapes.POLYGON,
    coordinates2d: ShapeUtils.rectangle(40, 40, 20, 20),
    fill: COLORS.GREEN,
    onClick: (playerId, x, y) => {
        // Only the owner may press their button:
        if (Number(playerId) === Number(this.ownerId)) this.doThing();
    }
});
```

Clicks and taps are unified — `onClick` fires for both mouse and touch. Make tap targets generously sized for mobile.

### Keyboard
Implement `handleKeyDown(playerId, key)` / `handleKeyUp(playerId, key)`. `key` is the standard browser key string: `'ArrowUp'`, `'ArrowDown'`, `'ArrowLeft'`, `'ArrowRight'`, `'w'`, `'a'`, `'s'`, `'d'`, `' '` (space), `'Enter'`, single characters, etc. Support both arrows and WASD for movement. Debounce with per-player cooldowns if needed (see the movement example in §14).

> Mobile players have no physical keyboard. If your game needs keyboard control, also provide on-screen `onClick` buttons, or design click/tap-first.

### Text input (on-screen fields)

Besides clicks and keyboard there is a third input path: a node can present an **editable text field** via an `input` property. It is accepted on **`Shape` and `Text`** nodes (not `Asset`). The client renders an input box over the node's bounds; as the player edits it, the server calls your `oninput(playerId, value)` with the field's current contents:

```js
const searchBox = new GameNode.Shape({
    shapeType: Shapes.POLYGON,
    coordinates2d: ShapeUtils.rectangle(20, 5, 60, 10),
    fill: COLORS.WHITE,
    input: {
        type: 'text',
        oninput: (playerId, value) => {
            this.query = value;             // `value` is the full current text, not one keystroke
            this.runSearch(playerId);       // mutate state, then onStateChange()
        }
    }
});
```

- `oninput` fires on change; treat `value` as the field's entire current string.
- This is exactly the mechanism the Homegames dashboard's own search box uses, so it is the same well-trodden path the platform relies on.
- Scope the field with `playerIds` (§8) so only the intended player sees and edits it — `input` is per node, but visibility still follows `playerIds`.
- There is also `type: 'file'` for uploads; its `oninput(playerId, files)` receives an **array** of files instead of a string. Rarely needed in games.

### Hover

`Shape` and `Asset` nodes also accept `onHover(playerId)` and `offHover(playerId)` (pointer enter / leave). Use them only for cosmetic affordances — **touch devices have no hover**, so never gate a mechanic on it.

---

## 10. Timing and game loop

- Set `metadata().tickRate` (FPS) and implement `tick()` for continuous simulation (movement, physics, timers counting down). Do mutations in `tick()` and end with one `onStateChange()`.
- For delayed / repeating logic, **use the tracked timer helpers from the base `Game` class**, not the globals — they are auto-cleared when the session closes, preventing leaks:

```js
this.setTimeout(() => this.explode(), 5000);          // tracked
this.setInterval(() => this.spawnEnemy(), 1000);      // tracked
```

`Game.close()` clears all timers created via `this.setInterval` / `this.setTimeout`. If you use the global `setTimeout`/`setInterval`, you are responsible for clearing them yourself in `close()`.

---

## 11. Assets (images, audio, fonts)

1. Declare them in `metadata().assets`, keyed by a short name, each an `Asset` instance with an `id` (the asset's hash in the Homegames asset store) and `type`:

```js
const { Asset } = require('squish-138');
// ...
assets: {
    'hero':   new Asset({ id: 'c0ffee...hash', type: 'image' }),
    'jump':   new Asset({ id: 'deadbe...hash', type: 'audio' }),
}
```

2. Reference them by key in `GameNode.Asset` `assetInfo` (see §7.3). Images use real `size`; audio uses zero size + `startTime`.
3. `type` is `'image'`, `'audio'`, or `'font'`. Keep total size within the limits in §2.

> When generating a game from scratch with no real asset ids available, prefer **drawing with shapes and text** rather than inventing fake asset ids (a fake id will load nothing). Only use `Asset` nodes when you have, or are given, valid asset ids.

---

## 12. Utilities

- `ShapeUtils.rectangle(x,y,w,h)`, `ShapeUtils.triangle(...)` — vertex builders (§6).
- `Colors.COLORS.*`, `Colors.randomColor(exclusions?)` — palette (§6).
- `GeometryUtils.checkCollisions(root, node, filter?)` — returns nodes under `root` that overlap `node` (axis-aligned rectangle test). Optional `filter(node) => boolean` to limit candidates. Useful but simple; many games hand-roll AABB checks for control (see §14).
- `ViewUtils.getView(plane, view, playerIds, translation?, scale?)` — projects a slice of a large world into the `0–100` viewport; optional `translation`/`scale` inset the projection into part of the screen (see §13 / §13.1).
- `Shapes.POLYGON | LINE` — shape type enum (`CIRCLE` exists but is not rendered).

---

## 13. Large scrolling worlds and per-player cameras (`ViewableGame`)

Everything above renders directly into the shared `0–100` plane, where every player sees the same thing. For games with a **world larger than one screen** (scrolling levels, top-down arenas, anything with a camera) or **per-player cameras** (each player sees their own region), extend **`ViewableGame`** instead of `Game`.

`ViewableGame` gives you a large square **world plane** of size `planeSize × planeSize` (in its own world units), plus a separate **view root** that is what clients actually render. The rendered viewport is **always `0–100`** — you project a rectangular slice of the big world into that `0–100` viewport, per player. This is how you get cameras, scrolling, and split per-player views in one shared game.

### Setup

```js
const { ViewableGame, GameNode, Colors, Shapes, ShapeUtils, ViewUtils } = require('squish-138');

class MyWorld extends ViewableGame {
    constructor() {
        super(1000);   // world is 1000 x 1000 world-units. Call super(planeSize), NOT super().
        this.playerViews = {};
        // ... build world content (Approach A) or keep entities as plain data (Approach B)
    }

    getLayers() {
        return [{ root: this.getViewRoot() }];   // render the VIEW root, not the world plane
    }
}
```

API added by `ViewableGame`:
- `super(planeSize)` — **required**; sets up the world plane and the view root. (Plain `Game` uses `super()` with no args; `ViewableGame` needs the size.)
- `getPlane()` — the world plane `Shape` (size `planeSize`). For the built-in projection approach, add your world content as children of this.
- `getPlaneSize()` / `updatePlaneSize(n)` — read / change the world size.
- `getViewRoot()` — the **render root**. It starts **empty**. Whatever you want on screen must be added here, normally per-player view roots restricted with `playerIds`.

> **Critical:** with `ViewableGame`, `getViewRoot()` is empty by default and the world plane is **not** rendered directly. If you build a world in `getPlane()` but never put a projected view under `getViewRoot()`, **players see a blank screen.**

A "view" is a rectangle into the world: `{ x, y, w, h }` in world units. You render the slice of the world inside that rectangle, scaled to fill the `0–100` viewport.

### Approach A — built-in projection with `ViewUtils.getView`

Build the world once in `getPlane()`, then per player project a view window into a render root. `ViewUtils.getView(plane, view, playerIds)` clones the world nodes inside `view`, translates/clips them into `0–100`, and tags them for `playerIds`. (It has two more optional args, `translation` and `scale`, for placing the projection in only part of the screen — see §13.1.):

```js
handleNewPlayer({ playerId }) {
    const view = { x: 0, y: 0, w: 100, h: 100 };   // window into the world, in world units

    // A solid backdrop this player always sees, so they never see blank space:
    const playerRoot = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
        fill: Colors.COLORS.BLACK,
        playerIds: [playerId]
    });
    playerRoot.addChild(ViewUtils.getView(this.getPlane(), view, [playerId]));

    this.playerViews[playerId] = { view, root: playerRoot };
    this.getViewRoot().addChild(playerRoot);
}

// To move a player's camera, recompute the view and rebuild that player's projection:
panCamera(playerId, dx, dy) {
    const pv = this.playerViews[playerId];
    pv.view = { ...pv.view, x: pv.view.x + dx, y: pv.view.y + dy };
    pv.root.node.clearChildren();
    pv.root.node.addChild(ViewUtils.getView(this.getPlane(), pv.view, [playerId]));
    pv.root.node.onStateChange();
}
```

### Approach B — manual projection (best for camera-follow / many moving entities)

Keep world entities as **plain data** (not nodes), and rebuild each player's view nodes yourself whenever they move or each tick. Full control — e.g. a camera centered on the player. World→view transform: `viewCoord = ((world − viewOrigin) / viewSize) * 100`.

```js
createPlayerView(playerId) {
    const player = this.players[playerId];
    const { w: viewW, h: viewH } = player.view;     // camera window size, in world units
    const viewX = player.x - viewW / 2;             // center the camera on the player
    const viewY = player.y - viewH / 2;

    const viewRoot = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),   // viewport is always 0–100
        fill: [50, 50, 50, 255],
        playerIds: [playerId]
    });

    const toView = (wx, wy, wsize) => ({
        x: ((wx - viewX) / viewW) * 100,
        y: ((wy - viewY) / viewH) * 100,
        size: (wsize / viewW) * 100
    });

    // player is always drawn centered:
    const ps = (player.size / viewW) * 100;
    viewRoot.addChild(new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(50 - ps / 2, 50 - ps / 2, ps, ps),
        fill: player.color, playerIds: [playerId]
    }));

    for (const e of this.enemies) {
        const r = toView(e.x, e.y, e.size);
        viewRoot.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(r.x - r.size / 2, r.y - r.size / 2, r.size, r.size),
            fill: e.color, playerIds: [playerId]
        }));
    }
    return viewRoot;
}

// On movement, swap the player's view root under getViewRoot():
updatePlayerView(playerId) {
    const player = this.players[playerId];
    if (player.viewRoot) this.getViewRoot().removeChild(player.viewRoot.node.id);
    player.viewRoot = this.createPlayerView(playerId);
    this.getViewRoot().addChild(player.viewRoot);
    player.viewRoot.node.onStateChange();
}
```

### 13.1 Projecting into a sub-region (static frame around a scrolling viewport)

`getView` takes two optional trailing arguments that let you place the projection somewhere other than the full screen:

```js
ViewUtils.getView(plane, view, playerIds, translation, scale)
```

- `translation` — `{ x, y, filter? }`. After a node is projected, shift it by `x`/`y` (plane units). The optional `filter(node) => boolean` applies the shift to only the nodes it returns true for.
- `scale` — `{ x, y }`. Multiplies the projected coordinates per axis; values `< 1` shrink the projection so it fills only part of the viewport.

Per-vertex transform order is: subtract the view origin and clamp to `0–100`, **then** multiply by `scale`, **then** add `translation`, then clamp again.

This is how you keep **static UI fixed on screen while a world region scrolls inside an inset panel** — the exact pattern the Homegames dashboard uses: a search box and scroll arrows are plain `0–100` nodes, and the scrollable game grid is a `getView` projection scaled down and pushed below them.

```js
renderForPlayer(playerId) {
    const root = this.playerRoots[playerId];          // full-screen node tagged [playerId]

    // 1) static chrome: plain nodes, fixed position, NOT projected
    root.node.addChild(this.buildToolbar(playerId));  // e.g. the search field from §9

    // 2) the scrollable world, projected into the lower/inset part of the screen
    const view = this.playerStates[playerId].view;     // { x, y, w, h } in world units
    root.node.addChild(ViewUtils.getView(
        this.getPlane(), view, [playerId],
        { x: 12.5, y: 18 },        // push the projection right + down, clear of the toolbar
        { x: 0.75, y: 0.75 }       // shrink it to leave margins
    ));
    root.node.onStateChange();
}
```

Gotchas:
- The projection includes only nodes that **overlap** the `view` rectangle (a collision test against the plane's children), so off-screen world content is free — but a node straddling the view edge has its vertices **clamped to `0–100` individually**, which can distort a shape that's half in and half out. Size views so content isn't sliced, or accept the clamp.
- `getView` returns a brand-new subtree each call. To scroll or pan, rebuild that player's projection (`clearChildren()` + re-add, or swap the subtree) and `onStateChange()` — see the `panCamera` example above.
- `onClick` survives projection (the clone keeps its handler), so projected world nodes stay tappable.

**Choosing:** use plain `Game` for single-screen games (most party/casual games). Use `ViewableGame` only when the world exceeds one screen or players need different cameras. Approach A is less code when the world is mostly static nodes; Approach B is better for smooth camera-follow and lots of moving entities. Either way: clean up a player's view root in `handlePlayerDisconnect`, and `getLayers()` returns `[{ root: this.getViewRoot() }]`.

---

## 14. Complete, correct examples

### 14.1 Single-player click game (event-driven, no tick)

```js
const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-138');
const { COLORS } = Colors;

class ClickCounter extends Game {
    static metadata() {
        return {
            squishVersion: '138',
            name: 'Click Counter',
            author: 'AI',
            description: 'Tap the square to score points.',
            aspectRatio: { x: 16, y: 9 }
        };
    }

    constructor() {
        super();
        this.score = 0;

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.HG_BLUE
        });

        this.scoreText = new GameNode.Text({
            textInfo: { text: 'Score: 0', x: 50, y: 12, size: 4, align: 'center', color: COLORS.WHITE }
        });

        this.button = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(35, 35, 30, 30),
            fill: COLORS.CANDY_RED,
            onClick: (playerId, x, y) => {
                this.score += 1;
                this.scoreText.node.text = {
                    text: `Score: ${this.score}`, x: 50, y: 12, size: 4, align: 'center', color: COLORS.WHITE
                };
                this.base.node.onStateChange();   // REQUIRED after mutating text
            }
        });

        this.base.addChildren(this.scoreText, this.button);
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = ClickCounter;
```

### 14.2 Multiplayer movement game (players join, move with keys, tick loop)

```js
const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-138');
const { COLORS } = Colors;

class Movers extends Game {
    static metadata() {
        return {
            squishVersion: '138',
            name: 'Movers',
            author: 'AI',
            description: 'Everyone gets a square. Move with arrows or WASD.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 30
        };
    }

    constructor() {
        super();
        this.players = {};          // playerId -> { node, vx, vy }
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.ALMOST_BLACK
        });
    }

    handleNewPlayer({ playerId, info }) {
        const square = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(47, 47, 6, 6),
            fill: Colors.randomColor([COLORS.ALMOST_BLACK])
        });
        const name = new GameNode.Text({
            textInfo: { text: info?.name || 'player', x: 50, y: 5, size: 1.5, align: 'center', color: COLORS.WHITE },
            playerIds: [playerId]   // each player sees only their own name banner
        });
        this.players[playerId] = { node: square, vx: 0, vy: 0 };
        this.base.addChildren(square, name);
    }

    handlePlayerDisconnect(playerId) {
        const p = this.players[playerId];
        if (p) {
            this.base.removeChild(p.node.id);
            delete this.players[playerId];
        }
    }

    handleKeyDown(playerId, key) {
        const p = this.players[playerId];
        if (!p) return;
        if (key === 'ArrowUp' || key === 'w') p.vy = -1;
        else if (key === 'ArrowDown' || key === 's') p.vy = 1;
        else if (key === 'ArrowLeft' || key === 'a') p.vx = -1;
        else if (key === 'ArrowRight' || key === 'd') p.vx = 1;
    }

    handleKeyUp(playerId, key) {
        const p = this.players[playerId];
        if (!p) return;
        if (key === 'ArrowUp' || key === 'w' || key === 'ArrowDown' || key === 's') p.vy = 0;
        if (key === 'ArrowLeft' || key === 'a' || key === 'ArrowRight' || key === 'd') p.vx = 0;
    }

    tick() {
        let changed = false;
        for (const id in this.players) {
            const p = this.players[id];
            if (p.vx === 0 && p.vy === 0) continue;
            const x = p.node.node.coordinates2d[0][0];
            const y = p.node.node.coordinates2d[0][1];
            const nx = Math.max(0, Math.min(94, x + p.vx));   // clamp to plane (square is 6 wide)
            const ny = Math.max(0, Math.min(94, y + p.vy));
            p.node.node.coordinates2d = ShapeUtils.rectangle(nx, ny, 6, 6);
            changed = true;
        }
        if (changed) this.base.node.onStateChange();   // ONE notify per tick
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = Movers;
```

---

## 15. Idioms and anti-patterns (checklist before you output)

Do:
- [ ] `module.exports = TheClass;` at the end (export the class, not an instance).
- [ ] `require('squish-138')` and `squishVersion: '138'` agree.
- [ ] Call `super()` first thing in the constructor.
- [ ] Build a single root `this.base` shape sized `rectangle(0,0,100,100)`; return it from `getLayers()` as `[{ root: this.base }]`. (For worlds bigger than one screen or per-player cameras, extend `ViewableGame` and render `getViewRoot()` instead — §13.)
- [ ] Call `onStateChange()` on the root after any direct property mutation (§4).
- [ ] Use `this.setTimeout` / `this.setInterval` (tracked) for timers.
- [ ] Clean up a leaving player's nodes in `handlePlayerDisconnect`.
- [ ] Size click/tap targets generously and support tap-first or both arrows+WASD.
- [ ] Keep everything in `0–100` coordinate space.

Don't:
- [ ] Don't forget `onStateChange()` — mutating `coordinates2d`/`fill`/`text` without it shows nothing.
- [ ] Don't put `onClick` on a `Text` node — it's silently ignored. Build buttons as a clickable `Shape` with a `Text` on top (§7.2.1).
- [ ] Don't `require` Node built-ins, hit the network/filesystem, read `process.env`, or use `eval`/`new Function`.
- [ ] Don't spin up one game instance per player — it's one shared instance; use `playerIds` for per-player views.
- [ ] Don't invent asset ids. If you have none, draw with shapes and text instead of `Asset` nodes.
- [ ] Don't use coordinates outside `0–100` expecting them to be visible.
- [ ] Don't block the event loop (no busy loops, no synchronous long work); drive motion from `tick()`.
- [ ] Don't assume a keyboard exists on mobile — provide on-screen controls if keys are core.

---

## 16. Quick reference card

```
require('squish-138')  ->  { Game, GameNode, Colors, Shapes, ShapeUtils, GeometryUtils, Asset, Physics, ... }

Game hooks:   metadata() [static, required] · constructor()->super() · getLayers()->[{root}]
              handleNewPlayer({playerId,info,settings,clientInfo}) · handlePlayerDisconnect(playerId)
              handleKeyDown(playerId,key) · handleKeyUp(playerId,key) · tick() · canAddPlayer() · close()

Nodes:        GameNode.Shape({ shapeType, coordinates2d, fill, border, onClick, playerIds })  // clickable
              GameNode.Text({ textInfo:{ text,x,y,size,align,color,font }, playerIds })       // NO onClick
              GameNode.Asset({ coordinates2d, assetInfo:{ key:{pos:{x,y},size:{x,y},startTime} }, playerIds })  // clickable
Button:       no button node + Text isn't clickable -> clickable Shape (onClick) with a Text node on top (§7.2.1)

Tree ops:     n.addChild(c) · n.addChildren(a,b) · n.removeChild(id) · n.clearChildren([keepIds])
              n.findChild(id) · n.update({fill,coordinates2d}) · n.showFor(pid) · n.hideFor(pid)
NOTIFY:       n.node.onStateChange()   // after direct field mutation; tree ops notify for you

Shapes:       Shapes.POLYGON | LINE   (CIRCLE constant exists but does NOT render — don't use)
Coords:       ShapeUtils.rectangle(x,y,w,h) · ShapeUtils.triangle(x1,y1,x2,y2,x3,y3) · plane is 0..100
Colors:       Colors.COLORS.RED ... ([r,g,b,a] 0..255) · Colors.randomColor([exclude])
onClick:      (playerId, x, y) => {}    // Shape/Asset only
text input:   Shape/Text input:{ type:'text', oninput:(playerId, value)=>{} }  // value = full field text
hover:        Shape/Asset onHover(pid) / offHover(pid)   // cosmetic only; no hover on touch
playerIds:    [0] = everyone (default) · [id,...] = only those players

Big worlds:   extend ViewableGame · super(planeSize) · getPlane()/getPlaneSize() = world
              getViewRoot() = render root (starts EMPTY) · getLayers()->[{root:getViewRoot()}]
              ViewUtils.getView(plane,{x,y,w,h},[pid], translation?, scale?) projects a world slice into 0..100
                translation={x,y,filter?} scale={x,y} -> inset the projection (static frame + scroll region, §13.1)
```
