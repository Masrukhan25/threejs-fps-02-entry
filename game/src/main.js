// IRON VEIL — entrypoint. Owns the renderer, the fixed-step loop and the wiring between
// modules; the sim itself lives in the modules. Shot mode (?shot=start|play|end&seed=N)
// stages a scene for screenshots without pointer lock.
import * as THREE from 'three';
import { createWorld, SPAWNS, BOMB_SITES } from './world.js';
import { createPlayer } from './player.js';
import { createInput } from './input.js';
import { createArsenal, WEAPONS } from './weapons.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createCombat } from './combat.js';
import { createBots } from './bots.js';
import { createRounds } from './rounds.js';
import { createHud } from './hud.js';
import { PALETTE } from './palette.js';
import { loadQuality, saveQuality, applyQuality } from './quality.js';

const FIXED = 1 / 60;
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || 1);
const DEMO = SHOT !== null;

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = DEMO ? mulberry32(SEED) : Math.random;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
document.getElementById('app').appendChild(renderer.domElement);
// Graphics level, read before the first frame (saved choice, else HIGH).
let qualityLevel = loadQuality();

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 30, 95);
const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.08, 220);
camera.rotation.order = 'YXZ';
scene.add(camera);

const world = createWorld(scene);
applyQuality(renderer, world, qualityLevel);
// The start-screen buttons switch the level live and save the choice.
for (const btn of document.querySelectorAll('#quality-row button')) {
  if (btn.dataset.quality === qualityLevel) btn.classList.add('on');
  else btn.classList.remove('on');
  btn.addEventListener('click', () => {
    qualityLevel = btn.dataset.quality;
    saveQuality(qualityLevel);
    applyQuality(renderer, world, qualityLevel);
    for (const b of document.querySelectorAll('#quality-row button')) b.classList.toggle('on', b === btn);
  });
}
const effects = createEffects(scene, camera);
const audio = createAudio();
const input = createInput(renderer.domElement, (locked) => {
  if (!locked && !DEMO) hud.showStart();
  else if (locked) hud.hideStart();
});
const player = createPlayer(world.colliders, SPAWNS.vanguard[0]);
const arsenal = createArsenal(camera);
const hud = createHud((kind, id) => buy(kind, id));

const playerHitbox = new THREE.Mesh(
  new THREE.BoxGeometry(0.7, 1.7, 0.7),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
);
playerHitbox.position.set(0, 0.85, 0);
scene.add(playerHitbox);

const playerActor = {
  team: 'vanguard',
  name: 'You',
  position: player.state.position,
  get alive() {
    return player.state.alive;
  },
  kills: 0,
  deaths: 0,
  damage(amount, isHead) {
    if (!player.state.alive) return false;
    player.damage(amount);
    hud.damageFlash();
    audio.hurt();
    if (!player.state.alive) {
      playerActor.deaths += 1;
      rounds.onDeath();
      hud.showAnnouncement('YOU DIED', 'Spectating a teammate — respawn next round', 4000);
    }
    return !player.state.alive;
  },
};

const actors = [playerActor];
const playerHittables = [];
const botHittables = [];
function rebuildHittables() {
  playerHittables.length = 0;
  botHittables.length = 0;
  for (const s of world.shootables) {
    playerHittables.push(s);
    botHittables.push(s);
  }
  for (const m of bots.hitMeshes) {
    playerHittables.push(m);
    botHittables.push(m);
  }
  botHittables.push(playerHitbox);
}

const combat = createCombat(scene, world, effects, audio, {
  onHit(shooter, target, part, killed) {
    const sName = shooter === playerActor ? 'You' : `${shooter.team === 'vanguard' ? 'Vanguard' : 'Sentinel'} ${shooter.personality}`;
    const tName = target === playerActor ? 'You' : `${target.team === 'vanguard' ? 'Vanguard' : 'Sentinel'} ${target.personality}`;
    if (shooter === playerActor) {
      hud.hitmarker(killed);
      if (killed) audio.kill();
      else audio.hit();
    }
    if (killed) {
      hud.addKillFeed(`${sName} ${part === 'head' ? '⌖' : '▸'} ${tName}`, shooter === playerActor);
      if (shooter === playerActor) {
        playerActor.kills += 1;
        rounds.onKill(true);
      }
      if (target === playerActor) rounds.onDeath();
    }
  },
  onExplode(pos, radius, dmg) {
    for (const a of actors) {
      if (!a.alive) continue;
      const d = Math.hypot(a.position.x - pos.x, a.position.z - pos.z);
      if (d > radius) continue;
      const from = new THREE.Vector3(pos.x, pos.y + 0.5, pos.z);
      const to = new THREE.Vector3(a.position.x, a.position.y + 1.2, a.position.z);
      if (combat.lineBlocked(from, to, effects.smokeCenters())) continue;
      const amount = dmg * (1 - d / radius * 0.7);
      const killed = a.damage(amount, false);
      if (killed) {
        hud.addKillFeed(`Explosion ▸ ${a === playerActor ? 'You' : a.team + ' ' + a.personality}`, false);
        if (a === playerActor) rounds.onDeath();
      }
      if (a === playerActor) {
        hud.damageFlash();
        audio.hurt();
      }
    }
  },
  onPlanted(site) {
    rounds.onPlanted();
    hud.showAnnouncement('BOMB PLANTED', `Site ${site === BOMB_SITES.A ? 'A' : 'B'} — defend it`, 3000);
  },
  onDefused() {
    rounds.onDefused();
    rounds.endRound('sentinel', 'Bomb defused');
  },
  onExploded(site) {
    rounds.endRound('vanguard', 'Bomb detonated');
  },
});

const bots = createBots(scene, world, combat, effects, audio);
const rounds = createRounds({
  onRoundStart(n) {
    respawnAll();
    hud.showAnnouncement(`ROUND ${n}`, n === 1 ? 'Plant the bomb at Site A or B' : 'Buy up — B opens the buy menu', 3000);
    audio.roundStart();
  },
  onLive() {
    hud.showAnnouncement('GO GO GO', '', 1500);
  },
  onRoundEnd(winner, reason, s) {
    hud.showAnnouncement(winner === 'vanguard' ? 'ROUND WON' : 'ROUND LOST', reason, 4000);
    if (winner === 'vanguard') audio.roundWin();
    else audio.roundLose();
  },
  onNextRound(n) {
    respawnAll();
  },
  onMatchEnd(winner, s) {
    hud.showMatchEnd(winner, s);
    document.exitPointerLock?.();
  },
  onBuyWeapon(w) {
    if (arsenal.buy(w.id)) {
      audio.buy();
      return true;
    }
    audio.denied();
    return false;
  },
  onBuyGrenade(g) {
    if (arsenal.buyGrenade(g.id)) {
      audio.buy();
      return true;
    }
    audio.denied();
    return false;
  },
  onBuyArmor() {
    if (player.state.armor >= 100) {
      audio.denied();
      return false;
    }
    player.state.armor = 100;
    audio.buy();
    return true;
  },
});

function respawnAll() {
  combat.reset();
  const vLoad = ['rifle', 'dmr', 'smg', 'sniper'];
  const sLoad = ['rifle', 'rifle', 'sniper', 'smg', 'dmr'];
  bots.spawnRound(vLoad, sLoad);
  actors.length = 1;
  for (const b of bots.bots) actors.push(b);
  rebuildHittables();
  player.reset(SPAWNS.vanguard[Math.floor(rng() * SPAWNS.vanguard.length)]);
  arsenal.refillAmmo();
  playerHitbox.position.set(player.state.position.x, 0.85, player.state.position.z);
}

function buy(kind, id) {
  if (!rounds.state.buyOpen) {
    audio.denied();
    return;
  }
  if (kind === 'weapon') rounds.buyWeapon(id);
  else if (kind === 'grenade') rounds.buyGrenade(id);
  else rounds.buyArmor();
}

function plantOrDefuse(dt) {
  const p = player.state;
  if (!p.alive || rounds.state.phase !== 'live') {
    combat.plantCancel();
    combat.defuseCancel();
    return;
  }
  const using = input.state.keys.has('KeyE');
  if (combat.bomb.state === 'idle' && using) {
    for (const key of ['A', 'B']) {
      const site = BOMB_SITES[key];
      const d = Math.hypot(p.position.x - site.x, p.position.z - site.z);
      if (d < 3) {
        if (combat.bomb.state === 'idle') combat.plantStart(site);
        break;
      }
    }
  }
  if (combat.bomb.state === 'planting') {
    if (using) combat.plantTick(dt);
    else combat.plantCancel();
  }
  if (combat.bomb.state === 'planted' && using) {
    const site = combat.bomb.site;
    const d = Math.hypot(p.position.x - site.x, p.position.z - site.z);
    if (d < 2) combat.defuseTick(dt);
    else combat.defuseCancel();
  } else if (combat.bomb.state === 'planted') {
    combat.defuseCancel();
  }
}

function playerShoot(dt) {
  const p = player.state;
  if (!p.alive || (rounds.state.phase !== 'live' && rounds.state.phase !== 'buy')) return;
  if (input.state.firing && arsenal.ready()) {
    if (!arsenal.takeRound()) {
      audio.dryFire();
      arsenal.reload();
      return;
    }
    arsenal.pullTrigger();
    audio.shot(arsenal.def().kind);
    const spread = arsenal.spread(player.groundSpeed());
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const from = new THREE.Vector3();
    camera.getWorldPosition(from);
    combat.fire(playerActor, arsenal.def(), from, dir, spread, rng, playerHittables);
    player.recoil(arsenal.def().kick, (rng() - 0.5) * arsenal.def().kick * 0.5);
  }
}

function step(dt, time) {
  const p = player.state;
  const look = input.takeLook();
  // Buy menu toggle works whether locked or not: opening it unlocks the pointer
  // (so the menu can be clicked), closing it re-locks.
  if (input.takePressed('KeyB') && rounds.state.phase === 'buy') {
    rounds.state.buyOpen = !rounds.state.buyOpen;
    if (rounds.state.buyOpen) document.exitPointerLock?.();
    else input.requestLock();
  }
  if (input.state.locked && p.alive) {
    player.look(look.x, look.y);
    player.step(dt, input.state.keys);
    if (input.takePressed('KeyR')) arsenal.reload();
    if (input.takePressed('KeyG')) {
      const g = arsenal.throwGrenade('frag');
      if (g) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const from = new THREE.Vector3();
        camera.getWorldPosition(from);
        combat.throwGrenade(from, dir, g);
      }
    }
    if (input.takePressed('KeyH')) {
      const g = arsenal.throwGrenade('smoke');
      if (g) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const from = new THREE.Vector3();
        camera.getWorldPosition(from);
        combat.throwGrenade(from, dir, g);
      }
    }
    for (let i = 0; i < 6; i += 1) {
      if (input.takePressed(`Digit${i + 1}`)) arsenal.switchTo(i);
    }
    if (Math.abs(player.groundSpeed()) > 0.5 && p.onGround) audio.step();
    plantOrDefuse(dt);
    playerShoot(dt);
  }
  if (input.state.keys.has('Tab')) {
    hud.showScoreboard([
      { name: 'You', team: 'vanguard', kills: playerActor.kills, deaths: playerActor.deaths, alive: p.alive },
      ...bots.bots.map((b) => ({ name: `${b.team === 'vanguard' ? 'Vanguard' : 'Sentinel'} ${b.personality}`, team: b.team, kills: 0, deaths: b.alive ? 0 : 1, alive: b.alive })),
    ]);
  } else {
    hud.hideScoreboard();
  }
  // Weapon feel: sway follows the mouse, bob follows the stride.
  arsenal.step(dt, player.groundSpeed(), look.x, look.y);
  combat.step(dt);
  bots.step(dt, time, { actors, smokes: effects.smokeCenters(), bomb: combat.bomb, hittables: botHittables });
  rounds.step(dt, {
    aliveCount: (team) => (team === 'vanguard' ? (p.alive ? 1 : 0) + bots.aliveCount('vanguard') : bots.aliveCount('sentinel')),
    bomb: combat.bomb,
  });
  effects.step(dt);
  playerHitbox.position.set(p.position.x, 0.85, p.position.z);
}

function updateCamera() {
  const p = player.state;
  if (p.alive) {
    camera.position.set(p.position.x, p.position.y + p.eye, p.position.z);
    // Subtle head bob while moving on foot — never in DEMO shots.
    if (!DEMO && p.onGround) camera.position.y += Math.sin(time * 9) * 0.014 * Math.min(1, player.groundSpeed() / 5);
    camera.rotation.set(p.pitch, p.yaw, 0);
  } else {
    const mate = bots.bots.find((b) => b.team === 'vanguard' && b.alive);
    if (mate) {
      camera.position.set(mate.position.x, mate.position.y + 1.5, mate.position.z);
      camera.rotation.set(mate.pitch, mate.yaw, 0);
    } else {
      camera.position.set(p.position.x, p.position.y + p.eye, p.position.z);
      camera.rotation.set(p.pitch, p.yaw, 0);
    }
  }
}

function hudSnapshot() {
  const p = player.state;
  const a = arsenal.ammoOf(arsenal.def().id);
  const bomb = combat.bomb;
  let objective = 'Plant the bomb at Site A or B';
  if (bomb.state === 'planting') objective = `Planting… ${Math.ceil(bomb.plant * 100 / 3.5)}%`;
  else if (bomb.state === 'planted') objective = 'BOMB PLANTED — defend it';
  else if (bomb.state === 'defused') objective = 'Bomb defused';
  else if (bomb.state === 'exploded') objective = 'Bomb detonated';
  return {
    phase: rounds.state.phase,
    phaseLeft: rounds.state.phaseLeft,
    roundLeft: rounds.state.roundLeft,
    vanguardWins: rounds.state.vanguardWins,
    sentinelWins: rounds.state.sentinelWins,
    round: rounds.state.round,
    health: p.health,
    armor: p.armor,
    mag: a.mag,
    magMax: arsenal.def().mag,
    reserve: a.reserve,
    weaponName: arsenal.def().name,
    frag: arsenal.grenades.frag,
    smoke: arsenal.grenades.smoke,
    objective,
    bombFuse: bomb.state === 'planted' ? bomb.fuse : 0,
    spread: 4 + arsenal.spread(player.groundSpeed()) * 900,
    money: rounds.state.money,
    buyOpen: rounds.state.buyOpen,
    locked: input.state.locked,
    demo: DEMO,
    plant: bomb.state === 'planting' ? bomb.plant / 3.5 : 0,
    defuse: bomb.state === 'planted' ? bomb.defuse / 5 : 0,
  };
}

let last = performance.now();
let acc = 0;
let time = 0;
// Rolling performance readout (FPS + frame ms over the last 60 frames).
const perf = { fps: 0, frameMs: 0, frames: 0, accMs: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  perf.frames += 1;
  perf.accMs += dt * 1000;
  if (perf.frames >= 60) {
    perf.frameMs = perf.accMs / perf.frames;
    perf.fps = 1000 / perf.frameMs;
    perf.frames = 0;
    perf.accMs = 0;
  }
  if (!paused) {
    acc += dt;
    let n = 0;
    while (acc >= FIXED && n < 5) {
      step(FIXED, time);
      time += FIXED;
      acc -= FIXED;
      n += 1;
    }
    if (n === 5) acc = 0;
  }
  updateCamera();
  hud.update(hudSnapshot());
  renderer.render(scene, camera);
}

let paused = false;
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
window.addEventListener('wheel', (event) => {
  if (!input.state.locked) return;
  const dir = event.deltaY > 0 ? 1 : -1;
  const idx = arsenal.owned.indexOf(arsenal.def());
  const next = (idx + dir + arsenal.owned.length) % arsenal.owned.length;
  arsenal.switchTo(next);
}, { passive: true });
document.getElementById('play-btn').addEventListener('click', () => {
  audio.unlock();
  input.requestLock();
  hud.hideStart();
});
document.getElementById('restart-btn').addEventListener('click', () => {
  rounds.reset();
  playerActor.kills = 0;
  playerActor.deaths = 0;
  arsenal.reset();
  respawnAll();
  rounds.startRound();
  hud.hideEnd();
  input.requestLock();
});

// Debug handle (not part of the game): exposes live state for automated testing.
window.__ironveil = {
  rounds: rounds.state,
  player: player.state,
  input: input.state,
  bomb: combat.bomb,
  bots,
  perf,
  quality: () => qualityLevel,
};

// Boot.
respawnAll();
rounds.startRound();
if (DEMO) {
  hud.hideStart();
  // Stage the shot, let the sim run a few seconds so bots move and fight, then
  // re-apply the scripted camera (a round reset during the settle may have moved
  // the player), paint twice and signal readiness, then freeze.
  rounds.state.phase = 'live';
  rounds.state.phaseLeft = 100;
  rounds.state.roundLeft = 100;
  rounds.state.buyOpen = false;
  for (let i = 0; i < 240; i += 1) {
    step(FIXED, time);
    time += FIXED;
  }
  if (SHOT === 'start') {
    player.state.position.set(-19, 0, 0);
    player.state.yaw = -Math.PI / 2;
    player.state.pitch = 0;
    rounds.state.phase = 'buy';
    rounds.state.phaseLeft = 12;
    rounds.state.buyOpen = true;
  } else if (SHOT === 'play') {
    // Mid corridor, ground level, looking down the lane toward the Sentinel side.
    player.state.position.set(-16, 0, 2);
    player.state.yaw = -1.49;
    player.state.pitch = 0;
  } else if (SHOT === 'end') {
    // Close on the planted bomb on Site A (now inside the warehouse interior).
    player.state.position.set(2, 0, -10);
    player.state.yaw = 1.03;
    player.state.pitch = -0.05;
    combat.forcePlant(BOMB_SITES.A, 18);
    hud.showAnnouncement('BOMB PLANTED', 'Site A — defend it', 8000);
  }
  // Stage the shot with effects only (no sim hooks): the DEMO boot never steps
  // again after this, so everything triggered here is frozen at paint time.
  if (SHOT === 'play') {
    const foe = bots.bots.find((b) => b.team === 'sentinel' && b.alive);
    if (foe) {
      const from = new THREE.Vector3(-16, 1.5, 2);
      const to = new THREE.Vector3(foe.position.x, foe.position.y + 1.2, foe.position.z);
      effects.tracer(from, to);
      effects.muzzle(new THREE.Vector3(foe.position.x, foe.position.y + 1.35, foe.position.z));
    }
    effects.smokeCloud(-14, 0, -6, 2.2, 12);
  } else if (SHOT === 'end') {
    // Defending the planted bomb: smoke drifting across the site and a Sentinel
    // firing at the player from the warehouse doorway.
    effects.smokeCloud(-1, 0, -11, 2, 12);
    const foe = bots.bots.find((b) => b.team === 'sentinel' && b.alive);
    if (foe) {
      const from = new THREE.Vector3(foe.position.x, foe.position.y + 1.35, foe.position.z);
      effects.tracer(from, new THREE.Vector3(2, 1.4, -10));
      effects.muzzle(from);
    }
  }
  if (SHOT === 'play' || SHOT === 'start') hud.hideAnnouncement();
  let painted = 0;
  function paint() {
    updateCamera();
    hud.update(hudSnapshot());
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      document.title = 'IRON VEIL — shot ready';
      return;
    }
    requestAnimationFrame(paint);
  }
  requestAnimationFrame(paint);
} else {
  hud.showStart();
  requestAnimationFrame(frame);
}
