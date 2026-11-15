# IRON VEIL — a three.js tactical FPS

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/Masrukhan25/threejs-fps-02-entry/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/Masrukhan25/threejs-fps-02-entry/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

An original premium stylized tactical military FPS (Counter-Strike-style, not a copy
of any commercial game). One industrial military compound, two teams, bomb objectives,
an economy, and 9 AI bots with personalities.

## How to play

You are **Vanguard** (blue, attackers). Plant the bomb at **Site A** (north warehouse)
or **Site B** (south storage yard), or eliminate the **Sentinel** defenders (amber).
First to 8 rounds wins the match (max 15 rounds). If the bomb is planted, the round
only ends when it explodes (Vanguard wins) or is defused (Sentinel wins).

### Controls

| Input | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look (pointer lock) |
| Click | Fire |
| Shift | Sprint |
| Ctrl / C | Crouch |
| Space | Jump |
| R | Reload |
| 1–6 / wheel | Switch weapon |
| E (hold) | Plant / defuse the bomb |
| B | Buy menu (buy phase only) |
| G | Throw frag grenade |
| H | Throw smoke grenade |
| Tab (hold) | Scoreboard |

### Economy

Start $800. +$300 per kill, +$325 round win, +$1400 round loss, +$300 plant/defuse.
Buy menu (B, during the 12 s buy phase): 5 weapons ($1100–$4750), frag and smoke
grenades ($300, max 2 each), Kevlar armour ($650, absorbs half of damage).

### Weapons

VK-7 Vanguard rifle, LM-12 Longshot DMR, SR-9 Sentinel sniper, KX-5 Striker SMG,
M870 Breacher shotgun, P9 Sidearm. Each has distinct damage, fire rate, recoil,
spread, magazine, reload time and range. Headshots deal bonus damage.

### Bots

4 Vanguard + 5 Sentinel bots. Personalities: **Assault** (pushes), **Defender**
(holds a site), **Sniper** (catwalk / long sightlines), **Support** (covers a
teammate), **Tactical** (plays the objective). They pathfind on a waypoint graph
(A*), hold positions, flank, react with a delay, fire in bursts, reload, throw
frag grenades at last-seen positions, plant and defuse the bomb.

### Map

Industrial military compound (~44×36 m): concrete corridors, warehouses, cover,
an elevated sniper catwalk, flanking routes, and landmarks (water tower NE, fuel
tanks SW, watchtower SE). Dusk lighting, amber site lamps, fog.

## Architecture (one module, one job)

```
game/index.html        page + HUD DOM + import map (three -> ./vendor/three/...)
game/src/main.js       boot, fixed-step loop (60 Hz), wiring, shot mode
game/src/world.js      map geometry, colliders, shootables, sites, spawns, lighting
game/src/nav.js        waypoint graph + A* pathfinding
game/src/palette.js    the IRON VEIL colour palette
game/src/player.js     movement, collision, sprint/crouch/jump, health + armour
game/src/input.js      keyboard/mouse, pointer lock, one-shot key presses
game/src/weapons.js    six weapons, view models, ammo, reload, grenade inventory
game/src/combat.js     hitscan shooting, grenade projectiles, bomb plant/fuse/defuse
game/src/bots.js       bot AI: perception, routes, holds, flanking, bursts, objectives
game/src/rounds.js     round state machine, economy, buy menu logic
game/src/effects.js    pooled tracers, impact particles, smoke, explosions
game/src/audio.js      procedural WebAudio sounds (no network, no audio files)
game/src/hud.js        all DOM updates (HUD, kill feed, buy menu, scoreboard)
game/vendor/three/     three.js 0.187.0, vendored byte-for-byte
```

Simulation runs at a fixed 60 Hz step, separate from rendering. No per-frame
allocations in the hot loop (pooled effects, reused vectors). No network requests
during gameplay: all audio is synthesized, all assets are local.

## Screenshots

`?shot=start|play|end&seed=N` stages a deterministic frame for capture and sets
`window.__shotReady` when painted. Serve with `node serve.ts` (http://localhost:8080),
then capture each shot at 1280×720.

## Build

Node 22, standard library only. `MAKEFUN_OUTPUT_DIR=out node main.ts` copies
`game/` + `screenshots/` to the output dir and writes `dossier.json`.
