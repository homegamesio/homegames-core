# ViewableGame Development Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [View System Mechanics](#view-system-mechanics)
3. [Coordinate System Transformations](#coordinate-system-transformations)
4. [Node Management](#node-management)
5. [Layer System & Click Handling](#layer-system--click-handling)
6. [Performance Optimization](#performance-optimization)
7. [Common Patterns](#common-patterns)
8. [Troubleshooting & Gotchas](#troubleshooting--gotchas)
9. [Example Implementations](#example-implementations)

---

## Architecture Overview

### ViewableGame vs Game Classes

**Standard Game**: All players see the same global view
```javascript
class StandardGame extends Game {
    // Single shared view for all players
    // Simple but limited for large worlds
}
```

**ViewableGame**: Each player has their own independent view window
```javascript
class MyViewableGame extends ViewableGame {
    constructor() {
        super(planeSize); // Large world plane (e.g., 500x500)
        this.viewSize = 100;  // Each player sees 100x100 window
    }
}
```

### Key Architectural Components

```
World Plane (large, e.g., 500x500)
├── Static World Objects (resources, terrain)
├── Dynamic Entities (players, enemies)
└── Player Views (each 100x100 window)
    ├── View Root (container)
    ├── Content Layer (dynamic objects)
    └── Click Layer (input handling)
```

---

## View System Mechanics

### The Three-Layer System

1. **World Plane**: The large game world containing all objects
2. **View Root**: Per-player view container
3. **Content Layers**: Dynamic content within each view

```javascript
// Initialize player view system
handleNewPlayer({ playerId }) {
    // 1. Create stable view wrapper
    const stableWrapper = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
        fill: [0, 0, 0, 0], // Transparent container
        playerIds: [playerId]
    });

    // 2. Create content layer (gets updated frequently)
    const contentLayer = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
        fill: [0, 0, 0, 0],
        playerIds: [playerId]
    });

    // 3. Create click layer (persistent for input)
    const clickLayer = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
        fill: [0, 0, 0, 0],
        onClick: (clickPlayerId, x, y) => {
            // Handle click events
        },
        playerIds: [playerId]
    });

    // 4. Assemble layers
    stableWrapper.addChild(contentLayer);
    stableWrapper.addChild(clickLayer); // Click layer goes on top!

    // 5. Store references
    this.playerViews[playerId] = {
        view: { x: 0, y: 0, w: 100, h: 100 },
        viewRoot: stableWrapper,
        contentLayer: contentLayer,
        clickLayer: clickLayer
    };

    this.getViewRoot().addChild(stableWrapper);
}
```

### View Updates

**❌ Inefficient (recreates everything)**:
```javascript
updatePlayerView(playerId) {
    // DON'T: Remove and recreate entire view
    this.getViewRoot().removeChild(oldView);
    const newView = this.createCompleteView(playerId);
    this.getViewRoot().addChild(newView);
}
```

**✅ Efficient (update content only)**:
```javascript
updatePlayerView(playerId) {
    const currentView = this.playerViews[playerId];
    
    // Only update content layer
    currentView.contentLayer.node.clearChildren();
    const newContent = this.createViewContent(playerId, currentView.view);
    currentView.contentLayer.node.addChild(newContent);
    currentView.contentLayer.node.onStateChange();
}
```

---

## Coordinate System Transformations

### World vs View Coordinates

Every object exists in **world coordinates** but must be rendered in **view coordinates**.

```javascript
// World: Large coordinate system (0-500)
const worldX = 250;
const worldY = 300;

// Player's view window in world space
const view = { x: 200, y: 250, w: 100, h: 100 };

// Transform to view coordinates (0-100)
const viewX = worldX - view.x; // 250 - 200 = 50
const viewY = worldY - view.y; // 300 - 250 = 50
```

### Camera/View Management

```javascript
updatePlayerView(playerId) {
    const player = this.players[playerId];
    const currentView = this.playerViews[playerId].view;
    
    // Calculate new view position (center on player)
    const newView = {
        x: Math.max(0, Math.min(player.x - 50, this.worldSize - 100)),
        y: Math.max(0, Math.min(player.y - 50, this.worldSize - 100)),
        w: 100,
        h: 100
    };
    
    // Only update if view moved significantly
    if (Math.abs(newView.x - currentView.x) > 2 || 
        Math.abs(newView.y - currentView.y) > 2) {
        this.playerViews[playerId].view = newView;
        this.refreshViewContent(playerId);
    }
}
```

### Visibility Culling

Only render objects visible in the current view:

```javascript
addObjectsToView(viewRoot, view, playerId) {
    for (const obj of this.worldObjects) {
        // Check if object is visible in current view
        if (obj.x + obj.size >= view.x && obj.x <= view.x + view.w &&
            obj.y + obj.size >= view.y && obj.y <= view.y + view.h) {
            
            // Convert to view coordinates
            const viewX = obj.x - view.x;
            const viewY = obj.y - view.y;
            
            const objNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(viewX, viewY, obj.size, obj.size),
                fill: obj.color,
                playerIds: [playerId]
            });
            
            viewRoot.addChild(objNode);
        }
    }
}
```

---

## Node Management

### GameNode Creation Patterns

**Basic Shape**:
```javascript
const shape = new GameNode.Shape({
    shapeType: Shapes.POLYGON,
    coordinates2d: ShapeUtils.rectangle(x, y, width, height),
    fill: [r, g, b, alpha],
    border: { color: [r, g, b, alpha], width: 2 }, // Optional
    playerIds: [playerId] // Critical for ViewableGame!
});
```

**Text Elements**:
```javascript
const text = new GameNode.Text({
    textInfo: {
        x: centerX,
        y: centerY,
        color: [255, 255, 255, 255],
        text: "Hello World",
        align: 'center', // 'left', 'center', 'right'
        size: 2.0
    },
    playerIds: [playerId]
});
```

**Interactive Elements**:
```javascript
const button = new GameNode.Shape({
    shapeType: Shapes.POLYGON,
    coordinates2d: ShapeUtils.rectangle(x, y, w, h),
    fill: [100, 150, 200, 255],
    onClick: (clickPlayerId, x, y) => {
        if (Number(clickPlayerId) === Number(playerId)) {
            // Handle click for correct player
            this.handleButtonClick(playerId);
        }
    },
    playerIds: [playerId]
});
```

### Dynamic Node Updates

**❌ Don't do this** (causes flickering):
```javascript
// Recreating nodes every frame
tick() {
    this.clearAllNodes();
    this.recreateAllNodes();
}
```

**✅ Do this** (smooth updates):
```javascript
// Update existing node properties
updatePlayerPosition(player) {
    if (player.nodeId) {
        const node = this.getNodeById(player.nodeId);
        node.coordinates2d = ShapeUtils.rectangle(
            player.x - view.x, 
            player.y - view.y, 
            this.playerSize, 
            this.playerSize
        );
        node.onStateChange();
    }
}
```

---

## Layer System & Click Handling

### The Layer Stack (bottom to top)

```
4. Click Layer (transparent, handles input)
3. UI Layer (health bars, timers)
2. Entity Layer (players, enemies)
1. Background Layer (terrain, resources)
```

### Click Coordinate Transformation

```javascript
const clickLayer = new GameNode.Shape({
    shapeType: Shapes.POLYGON,
    coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
    fill: [0, 0, 0, 0], // Transparent
    onClick: (clickPlayerId, x, y) => {
        if (Number(clickPlayerId) === Number(playerId)) {
            const currentView = this.playerViews[playerId];
            
            // Transform click coordinates to world coordinates
            const worldX = x + currentView.view.x;
            const worldY = y + currentView.view.y;
            
            this.handleWorldClick(playerId, worldX, worldY);
        }
    },
    playerIds: [playerId]
});
```

### Multi-Layer Click Prevention

```javascript
// Problem: Clicks go through multiple layers
// Solution: Handle clicks at the top layer only

// ❌ Multiple click handlers compete
backgroundLayer.onClick = handleBackgroundClick;
entityLayer.onClick = handleEntityClick;
uiLayer.onClick = handleUIClick;

// ✅ Single click handler dispatches appropriately
clickLayer.onClick = (playerId, x, y) => {
    if (this.isUIClick(x, y)) {
        this.handleUIClick(playerId, x, y);
    } else if (this.isEntityClick(x, y)) {
        this.handleEntityClick(playerId, x, y);
    } else {
        this.handleBackgroundClick(playerId, x, y);
    }
};
```

---

## Performance Optimization

### View Update Strategies

**Strategy 1: Frame-based Updates**
```javascript
tick() {
    // Update game logic every tick (60fps)
    this.updateGameLogic();
    
    // Only update views when necessary
    Object.keys(this.players).forEach(playerId => {
        if (this.needsViewUpdate(playerId)) {
            this.updatePlayerView(playerId);
        }
    });
}

needsViewUpdate(playerId) {
    const player = this.players[playerId];
    const view = this.playerViews[playerId].view;
    
    // Update if player moved significantly relative to view
    const distanceFromCenter = Math.abs(player.x - (view.x + 50)) + 
                              Math.abs(player.y - (view.y + 50));
    return distanceFromCenter > 25; // Update when player near edge
}
```

**Strategy 2: Selective Content Updates**
```javascript
updateViewContent(playerId) {
    const view = this.playerViews[playerId];
    
    // Only update changed elements
    if (this.resourcesChanged) {
        this.updateResourceDisplay(playerId);
    }
    
    if (this.playerMoved(playerId)) {
        this.updatePlayerPosition(playerId);
    }
    
    if (this.enemiesChanged) {
        this.updateEnemyPositions(playerId);
    }
}
```

### Memory Management

```javascript
handlePlayerDisconnect(playerId) {
    // Clean up view references
    if (this.playerViews[playerId]) {
        const viewData = this.playerViews[playerId];
        
        // Remove from view root
        this.getViewRoot().removeChild(viewData.viewRoot.node.id);
        
        // Clear references
        delete this.playerViews[playerId];
        delete this.players[playerId];
    }
}
```

### Efficient Indicator Management

```javascript
// Clean up expired visual indicators
tick() {
    const currentTime = Date.now();
    
    // Remove expired indicators (prevents memory leaks)
    this.damageIndicators = this.damageIndicators.filter(
        indicator => currentTime - indicator.createdAt < indicator.duration
    );
    
    this.gatherIndicators = this.gatherIndicators.filter(
        indicator => currentTime - indicator.createdAt < indicator.duration
    );
}
```

---

## Common Patterns

### Game State Management

```javascript
class MyViewableGame extends ViewableGame {
    constructor() {
        super(500);
        this.gameState = 'playing'; // 'playing', 'paused', 'gameOver'
        this.players = {};
        this.playerViews = {};
    }
    
    tick() {
        if (this.gameState !== 'playing') return;
        
        // Game logic only runs during active play
        this.updateGameLogic();
        this.checkGameOverConditions();
    }
    
    createPlayerView(playerId, view) {
        if (this.gameState === 'gameOver') {
            return this.createGameOverView(playerId);
        }
        
        return this.createGameplayView(playerId, view);
    }
}
```

### Smooth Movement Implementation

```javascript
// Small increment movement for smooth animation
movePlayerTowards(playerId, targetX, targetY) {
    const player = this.players[playerId];
    const distance = this.calculateDistance(player.x, player.y, targetX, targetY);
    
    if (distance > 0.5) { // Keep moving if not at target
        const angle = Math.atan2(targetY - player.y, targetX - player.x);
        const moveAmount = 0.3; // Small increments for smooth movement
        
        player.x += Math.cos(angle) * moveAmount;
        player.y += Math.sin(angle) * moveAmount;
        player.moving = true;
    } else {
        player.x = targetX;
        player.y = targetY;
        player.moving = false;
    }
}
```

### Auto-Action System (gathering, attacking)

```javascript
tick() {
    Object.keys(this.players).forEach(playerId => {
        const player = this.players[playerId];
        const currentTime = Date.now();
        
        // Auto-gather with cooldown
        if (currentTime - player.lastGatherTime >= this.gatherCooldown) {
            const target = this.findGatherTarget(player);
            if (target) {
                this.gatherFrom(target, playerId);
                player.lastGatherTime = currentTime;
            }
        }
        
        // Auto-attack with cooldown
        if (currentTime - player.lastAttackTime >= this.attackCooldown) {
            const enemy = this.findAttackTarget(player);
            if (enemy) {
                this.attackEnemy(enemy, playerId);
                player.lastAttackTime = currentTime;
            }
        }
    });
}
```

---

## Troubleshooting & Gotchas

### Common Issues

**1. Flickering Views**
```javascript
// ❌ Cause: Recreating view content every frame
tick() {
    this.updateAllPlayerViews(); // Called 60 times per second!
}

// ✅ Solution: Only update when necessary
tick() {
    // Update game state
    this.updateGameLogic();
    
    // Only update views that actually changed
    this.updateChangedViews();
}
```

**2. Click Events Not Working**
```javascript
// ❌ Problem: Click layer is underneath content
stableWrapper.addChild(contentLayer);
stableWrapper.addChild(clickLayer);   // Might be covered

// ✅ Solution: Ensure click layer is on top and properly transparent
stableWrapper.addChild(contentLayer);
stableWrapper.addChild(clickLayer);   // Always add click layer last
// And ensure clickLayer has fill: [0, 0, 0, 0] for transparency
```

**3. Coordinate Confusion**
```javascript
// ❌ Common mistake: Using world coordinates in view
const playerNode = new GameNode.Shape({
    coordinates2d: ShapeUtils.rectangle(
        player.x, player.y, // ❌ World coordinates!
        this.playerSize, this.playerSize
    )
});

// ✅ Correct: Transform to view coordinates
const relativeX = player.x - view.x;
const relativeY = player.y - view.y;
const playerNode = new GameNode.Shape({
    coordinates2d: ShapeUtils.rectangle(
        relativeX, relativeY, // ✅ View coordinates!
        this.playerSize, this.playerSize
    )
});
```

**4. playerIds Missing**
```javascript
// ❌ Nodes without playerIds won't show for specific players
const node = new GameNode.Shape({
    shapeType: Shapes.POLYGON,
    coordinates2d: ShapeUtils.rectangle(0, 0, 10, 10),
    fill: [255, 0, 0, 255]
    // ❌ Missing playerIds!
});

// ✅ Always specify playerIds for ViewableGame
const node = new GameNode.Shape({
    shapeType: Shapes.POLYGON,
    coordinates2d: ShapeUtils.rectangle(0, 0, 10, 10),
    fill: [255, 0, 0, 255],
    playerIds: [playerId] // ✅ Essential for ViewableGame!
});
```

### Debugging Tips

```javascript
// Add debug information to views
addDebugInfo(viewRoot, view, playerId) {
    const debugText = new GameNode.Text({
        textInfo: {
            x: 5, y: 95,
            color: [255, 255, 0, 255],
            text: `View: (${view.x}, ${view.y}) Player: ${playerId}`,
            align: 'left',
            size: 1
        },
        playerIds: [playerId]
    });
    viewRoot.addChild(debugText);
}
```

---

## Example Implementations

### Complete ViewableGame Template

```javascript
const { ViewableGame, GameNode, Shapes, ShapeUtils } = require('squish-136');

class MyViewableGame extends ViewableGame {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '136',
            author: 'Developer',
            thumbnail: 'game-thumbnail',
            tickRate: 60,
            description: 'Example ViewableGame implementation'
        };
    }

    constructor() {
        super(500); // World size: 500x500
        
        // Game state
        this.players = {};
        this.playerViews = {};
        this.gameState = 'playing';
        this.viewSize = 100;
        
        // Initialize world
        this.initializeWorld();
    }

    initializeWorld() {
        // Create world objects
        // Add them to the plane using this.getPlane().addChild()
    }

    handleNewPlayer({ playerId }) {
        // Initialize player data
        this.players[playerId] = {
            x: 250, y: 250,
            health: 100,
            // ... other properties
        };

        // Create player view
        this.createPlayerViewSystem(playerId);
        this.updatePlayerView(playerId);
    }

    createPlayerViewSystem(playerId) {
        const initialView = { x: 200, y: 200, w: 100, h: 100 };
        
        // Create stable wrapper
        const stableWrapper = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [0, 0, 0, 0],
            playerIds: [playerId]
        });

        // Create content layer
        const contentLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [0, 0, 0, 0],
            playerIds: [playerId]
        });

        // Create click layer
        const clickLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [0, 0, 0, 0],
            onClick: (clickPlayerId, x, y) => {
                this.handleClick(clickPlayerId, x, y);
            },
            playerIds: [playerId]
        });

        // Assemble layers
        stableWrapper.addChild(contentLayer);
        stableWrapper.addChild(clickLayer);

        // Store references
        this.playerViews[playerId] = {
            view: initialView,
            viewRoot: stableWrapper,
            contentLayer: contentLayer,
            clickLayer: clickLayer
        };

        this.getViewRoot().addChild(stableWrapper);
    }

    updatePlayerView(playerId) {
        const player = this.players[playerId];
        const currentView = this.playerViews[playerId];
        
        // Calculate new view position
        const newView = {
            x: Math.max(0, Math.min(player.x - 50, 400)),
            y: Math.max(0, Math.min(player.y - 50, 400)),
            w: 100, h: 100
        };

        currentView.view = newView;
        
        // Update content
        const newContent = this.createViewContent(playerId, newView);
        currentView.contentLayer.node.clearChildren();
        currentView.contentLayer.node.addChild(newContent);
        currentView.contentLayer.node.onStateChange();
    }

    createViewContent(playerId, view) {
        const viewRoot = ViewUtils.getView(this.getPlane(), view, [playerId]);
        
        // Add game objects to view
        this.addGameObjectsToView(viewRoot, view, playerId);
        
        return viewRoot;
    }

    handleClick(playerId, x, y) {
        const view = this.playerViews[playerId].view;
        const worldX = x + view.x;
        const worldY = y + view.y;
        
        // Handle click in world coordinates
        this.processWorldClick(playerId, worldX, worldY);
    }

    tick() {
        if (this.gameState !== 'playing') return;
        
        // Update game logic
        this.updateGameLogic();
        
        // Update views as needed
        this.updateChangedViews();
    }

    getLayers() {
        return [{root: this.getViewRoot()}];
    }
}

module.exports = MyViewableGame;
```

---

This guide covers the essential patterns and techniques for building robust ViewableGame implementations. The key principles are:

1. **Separate concerns**: World logic vs. view rendering
2. **Transform coordinates**: World space → View space
3. **Layer management**: Content vs. interaction layers
4. **Performance**: Update only when necessary
5. **Player isolation**: Each player sees their own view

Use this as a reference when building complex ViewableGame implementations! 