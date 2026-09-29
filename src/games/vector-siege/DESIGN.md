# Vector Siege: the implemented decision loops

This document describes v02 as built. The next playtest should judge whether these systems produce interesting decisions while keeping aim, movement and impact immediate.

## Every few seconds: read, commit, collect

A formation combines different demands. A Warden rewards target prioritization; a Bastion rewards changing angle; a Rail Eye creates a temporary forbidden line; a Lancer commits to a dodgeable lane; a Mineweaver punishes moving predictably. Seekers and fragments make those positional decisions urgent. A Scavenger competes for the reward left on the floor.

The intended sequence is to read the dangerous unit, open a lane, commit to a kill, and move through the geoms. Retreating remains possible, but it delays salvage, multiplier and flux income. The resulting choice is spatial and visible rather than a hidden accuracy or damage penalty.

Dash has two charges and three jobs: reposition safely, strike a formation, and convert bullets into flux. Razor Wake makes the strike powerful enough to define a build. Afterimage enables more frequent commitments. The short exit immunity prevents a successful dodge from immediately becoming a collision hit.

Overload is the payoff for participating in that loop. It clears danger immediately, gives a short offensive window, and draws in rewards. Holding it provides insurance; spending it sooner helps finish the next group and starts the next charging cycle sooner. Kills during Overload still give geoms and salvage, but cannot refill flux during the same activation.

The separate kill chain is a moment-to-moment flourish; the geom multiplier rewards sustained collection over the operation. Damage halves the multiplier rather than erasing every reward already earned.

## Every operation: commit to a purpose

A capture and a raid have different completion conditions and different consequences.

A capture commits the player to three uplinks, a site-specific elite guard, and holding ground. Reactor uplinks also create local pulses and stun enemies on destruction. Destroying the last uplink announces the counterattack. The guard blocks capture until defeated even if lured away from the center. This gives the operation a climax without requiring the player to chase every remaining enemy around the arena.

A raid asks for one marked target and extraction. The player can get out quickly, stay to collect more geoms, or wait for cargo to satisfy Interdiction. The remaining defenders do not need to be cleared. A raid is finite and cannot be repeated to generate unlimited rewards; that territory can still be captured later.

Contracts add an optional second criterion. Clean Breach encourages careful execution. Blitz rewards fast objective focus. Interdiction creates an explicit detour toward the northern cargo lane. Flow State encourages collecting through combat rather than shooting from safety. Failure loses only the bonus, keeping the principal mission worthwhile.

## Between operations: spend, route, or finish

Three resources are distinct:

- **Geoms** exist in the arena, can be stolen, and connect proximity to score, flux and salvage.
- **Salvage** persists through the run and creates a repair-versus-build decision on the map.
- **Enemy stock** belongs to producing sites and becomes concrete Citadel defenses.

Capture both removes an enemy advantage and adds a friendly one. The Ion Array improves Overload frequency, the Foundry adds sustained fire, and the Relay improves recovery across subsequent deployments. Their order therefore matters even when the player eventually captures all three.

Raids immediately reduce stock, but later combat time lets surviving production rebuild it. This encourages following a raid with an assault instead of treating every operation as an automatic checklist. Captures stop production permanently but raise alert more and require a longer fight. Tactical menus pause the clock so reading and choosing are free.

The fortress remains available from the beginning. A direct assault is a skill challenge with few tools and large defender budgets. Fully preparing gives more modules, friendly support, and fewer boss adds. Mixed routes occupy the space between those extremes.

## Builds change behavior

The module set aims for combinations with a clear play pattern:

| Pattern | Useful modules | What changes in play |
| --- | --- | --- |
| Penetrating lines | Phase Rounds, Arc Conductor, Core Amplifier | Align multiple bodies; prioritize the shielding unit |
| Close-range cascades | Detonation, Forked Light, Gravity Well | Break a packed formation, then collect through its center |
| Dash fighter | Razor Wake, Afterimage, Capacitor | Cross enemy bodies and bullet lanes to feed the next Overload |
| Pickup sustain | Reclamation, Gravity Well, Cryo Rounds | Control pursuit and heal by staying near the fight |
| Arena coverage | Bank Shot, Forked Light, Overclock | Use wall angles and projectile coverage to catch flankers |

Three starter weapons establish different ranges and targeting needs before the first draft. Forked Light increases total volley damage even on Scatter. Damage upgrades stack additively, while most behavior changes are unique. Repair remains available when the catalog is nearly exhausted, avoiding a dead-end purchase screen.

## The boss tests the route and the combat skills

The Citadel's stock is locked on entry. Shield energy determines pylon health; heavy stock supplies Bastions; reserve stock supplies support waves. Deployments consume those resources, so adds are finite.

The core itself always has three phases. It starts with readable radial gaps and aimed bursts, adds rail warnings at 67% hull, and combines denser radial fire with three locked rail lanes at 33%. Clearing bullets during phase transitions provides a readable reset. The transition protects the core briefly so an extremely strong volley cannot visually skip the pattern change.

This preserves a boss fight after all support sites are captured. Strategic preparation removes extra systems layered on that fight and gives the player additional tools to answer it.

## Feedback and performance

Movement and firing never pause for impact effects. Short hit slowdown affects enemies and hazards while the player retains control. Directional armor, shield links, charging lanes and mine countdowns communicate collision rules before damage. Distinct weapon sounds, brighter impact centers, shield-collapse rings, recoil, lightning, debris and grid ripples reinforce causality.

Pool limits are part of the design: gameplay bodies and hostile shots must remain readable when chain reactions fill the screen. Repeated shield links are deduplicated and capped; particles yield capacity to the player and HUD. Native frame serialization and saturated scenes are verified, alongside the pure simulation.

## What remains open after this pass

- Human playtesting must establish difficulty and weapon balance. Automated pilots have perfect aim and crude evasion, so their completion rate is not a human win-rate estimate.
- The sector is deliberately short. Alert currently changes support garrisons; it does not create a global campaign timer or add hidden boss health.
- Salvage income may let strong players acquire too much of the module catalog in a single sector. Watch whether drafts produce a build identity or converge on everything.
- The current three arena arrangements change target positions. Solid terrain, cover destruction and traversal-specific rooms are not implemented.
- Friendly support currently consists of a wingman, flux production and medical supply. Auralux-style fleets, territorial adjacency and autonomous friendly invasions would require another strategic layer.
- Runs reset cleanly. Unlock progression, multi-sector campaigns, gamepad/touch input and resumable runs remain future work.
