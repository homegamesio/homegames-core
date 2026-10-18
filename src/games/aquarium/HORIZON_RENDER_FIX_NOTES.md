# Horizon rendering fix

This pass addresses two visual issues in the Horizon achievement world.

## Stable landmark streaming

- Horizon presentation pools no longer resize to the exact number of markers intersecting the viewport each tick.
- While the Horizon is nearby, each player keeps a small stable pool sized to the unlocked marker count (capped at 8).
- Marker selection uses a generous offscreen preload margin based on the current view width.
- Existing marker ids stay bound to their slots as the camera pans, so permanent islands do not detach/rebind right at the screen edge.
- The pool still detaches entirely when the player is far away from the Horizon, so the normal aquarium/space view does not carry Horizon nodes.

## Island and label layout

- Monument labels now use the landmark's projected position only as an anchor, then clamp vertically into a safe 75–81 screen-space band above the bottom controls.
- Labels use a neutral bright color for readability against the Horizon background.
- Labels remain available slightly farther out (zoom >= 0.42) without becoming dense at maximum overview zoom.
- The shared island base is larger/taller.
- Palm Isle has substantially taller trunks/crowns and a wider sand base so the milestone reads as a major vertical reward.

No economy, milestone, Era, creature, feeding, or reward math changed in this pass.
