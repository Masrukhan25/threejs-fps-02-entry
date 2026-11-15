// Bots: 9 AI opponents/teammates with personalities, waypoint routes, cover holds,
// flanking, reaction times, burst fire, reloads, grenades and objective play. A bot is
// one state object + one mesh group; its brain runs in step() at the fixed rate.
// Personalities: assault (pushes), defender (holds a site), sniper (catwalk / long
// sightline), support (covers a teammate), tactical (plays the objective).
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { nearestWaypoint, findPath, waypointPos } from './nav.js';
import { WEAPONS } from './weapons.js';
import { BOMB_SITES } from './world.js';

const WALK = 4.4;
const SPRINT = 6.2;
const EYE = 1.5;
const HEALTH = 100;

const PERSONALITY = {
  assault: { speed: 1.15, react: 0.45, acc: 0.5, push: 1 },
  defender: { speed: 0.9, react: 0.4, acc: 0.55, push: 0 },
  sniper: { speed: 0.85, react: 0.35, acc: 0.75, push: 0 },
  support: { speed: 1.0, react: 0.5, acc: 0.5, push: 0.5 },
  tactical: { speed: 1.05, react: 0.45, acc: 0.55, push: 1 },
};

function groundHeight(x, z) {
  if (x > -4.5 && x < 0.5 && z > -10.1 && z < -7.9) return 2.4;
  if (x > -2.5 && x < -1.5 && z > -7.9 && z < -7.1) return 1.8;
  if (x > -2.5 && x < -1.5 && z > -7.1 && z < -6.3) return 1.2;
  if (x > -2.5 && x < -1.5 && z > -6.3 && z < -5.5) return 0.6;
  return 0;
}

export function createBots(scene, world, combat, effects, audio) {
  const bots = [];
  const tmp = new THREE.Vector3();
  const eyePos = new THREE.Vector3();
  const targetPos = new THREE.Vector3();
  const hitMeshes = [];

  // Soldier figures: chest plate, shoulder pads, helmet with a glowing visor slit,
  // backpack, belt, separate swinging legs, and a rifle held forward. The torso and
  // head keep their v1 sizes and positions — they are the hit meshes, so hit
  // detection is unchanged. Team colour reads on the torso and the armband.
  function makeMesh(team, personality) {
    const group = new THREE.Group();
    const teamColor = team === 'vanguard' ? PALETTE.vanguard : PALETTE.sentinel;
    const torsoMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(teamColor), roughness: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.8 });
    const gunMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#23262b'), roughness: 0.35, metalness: 0.8 });
    const visorMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#0a1a24'), roughness: 0.1, metalness: 0.4, emissive: new THREE.Color(teamColor), emissiveIntensity: 0.9 });
    const bandMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(teamColor) });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.78, 0.3), torsoMat);
    torso.position.y = 1.0;
    torso.castShadow = true;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.06), darkMat);
    plate.position.set(0, 1.05, -0.16);
    const padL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.32), darkMat);
    padL.position.set(-0.3, 1.36, 0);
    const padR = padL.clone();
    padR.position.x = 0.3;
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.09, 0.32), darkMat);
    belt.position.y = 0.66;
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.14), darkMat);
    pack.position.set(0, 1.08, 0.22);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.34), bandMat);
    band.position.set(-0.28, 1.22, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), darkMat);
    head.position.y = 1.55;
    head.castShadow = true;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.185, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), torsoMat);
    helmet.position.y = 1.57;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.06), visorMat);
    visor.position.set(0, 1.55, -0.15);
    const gun = new THREE.Group();
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.42), gunMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 8), gunMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.01, -0.3);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.08), darkMat);
    mag.position.set(0, -0.1, 0.02);
    mag.rotation.x = 0.2;
    gun.add(receiver, barrel, mag);
    gun.position.set(0.18, 1.22, -0.28);
    gun.rotation.x = -0.06;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.52, 0.26), darkMat);
    legL.position.set(-0.11, 0.52, 0);
    legL.geometry.translate(0, -0.26, 0);
    const legR = legL.clone();
    legR.position.x = 0.11;
    group.add(torso, plate, padL, padR, belt, pack, band, head, helmet, visor, gun, legL, legR);
    scene.add(group);
    return { group, torso, head, legL, legR, gun };
  }

  function spawnBot(team, personality, x, z, weaponId) {
    const def = WEAPONS.find((w) => w.id === weaponId) || WEAPONS[0];
    const mesh = makeMesh(team, personality);
    const bot = {
      isBot: true,
      team,
      personality,
      def,
      mesh,
      position: new THREE.Vector3(x, groundHeight(x, z), z),
      yaw: team === 'vanguard' ? -Math.PI / 2 : Math.PI / 2,
      pitch: 0,
      health: HEALTH,
      alive: true,
      mag: def.mag,
      reserve: def.reserve,
      cooldown: 0,
      reloadLeft: 0,
      state: 'route',
      path: [],
      pathIndex: 0,
      target: null,
      lastSeen: null,
      lastSeenAt: -99,
      reactAt: 0,
      burstLeft: 0,
      burstGap: 0,
      holdYaw: 0,
      holdUntil: 0,
      grenades: 1,
      nadeAt: 0,
      strafeDir: 1,
      strafeAt: 0,
      fall: 0,
      walkPhase: 0,
      dest: null,
      speed: WALK * PERSONALITY[personality].speed,
    };
    mesh.torso.userData.actor = bot;
    mesh.torso.userData.part = 'torso';
    mesh.head.userData.actor = bot;
    mesh.head.userData.part = 'head';
    hitMeshes.push(mesh.torso, mesh.head);
    bots.push(bot);
    return bot;
  }

  function damageBot(bot, amount, isHead) {
    if (!bot.alive) return false;
    bot.health -= amount;
    if (bot.health <= 0) {
      bot.health = 0;
      bot.alive = false;
      bot.fall = 0;
      return true;
    }
    return false;
  }
  // The actor interface combat.js calls: damage(amount, isHead) -> killed.
  function attachDamage(bot) {
    bot.damage = (amount, isHead) => damageBot(bot, amount, isHead);
  }

  function setRoute(bot, toId) {
    const from = nearestWaypoint(bot.position.x, bot.position.y, bot.position.z);
    bot.path = findPath(from, toId);
    bot.pathIndex = 0;
    bot.state = 'route';
  }

  function pickObjective(bot, bombState, time) {
    const p = PERSONALITY[bot.personality];
    if (bot.team === 'sentinel') {
      if (bombState === 'planted') return { kind: 'defuse' };
      if (bot.personality === 'defender' || bot.personality === 'sniper') {
        return { kind: 'hold', site: bot.personality === 'sniper' ? 'catWalk' : (bot.dest && bot.dest.includes('A') ? 'aSite' : 'bSite') };
      }
      return { kind: 'hold', site: Math.random() < 0.5 ? 'aSite' : 'bSite' };
    }
    if (bombState === 'planted') return { kind: 'hold', site: 'mid' };
    if (bot.personality === 'sniper') return { kind: 'hold', site: 'catWalk' };
    if (bot.personality === 'tactical') return { kind: 'plant', site: Math.random() < 0.5 ? 'aSite' : 'bSite' };
    if (bot.personality === 'defender') return { kind: 'hold', site: 'mid' };
    return { kind: 'plant', site: Math.random() < 0.5 ? 'aSite' : 'bSite' };
  }

  function stepBot(bot, dt, time, ctx) {
    if (!bot.alive) {
      bot.fall = Math.min(1, bot.fall + dt / 0.4);
      bot.mesh.group.rotation.x = -bot.fall * 1.45;
      return;
    }
    bot.cooldown = Math.max(0, bot.cooldown - dt);
    if (bot.reloadLeft > 0) {
      bot.reloadLeft = Math.max(0, bot.reloadLeft - dt);
      if (bot.reloadLeft === 0) {
        const take = Math.min(bot.def.mag - bot.mag, bot.reserve);
        bot.mag += take;
        bot.reserve -= take;
      }
    }
    // Perception: nearest visible enemy.
    let best = null;
    let bestD = 55;
    eyePos.set(bot.position.x, bot.position.y + EYE, bot.position.z);
    for (const other of ctx.actors) {
      if (other === bot || other.team === bot.team || !other.alive) continue;
      const op = other.position;
      const dx = op.x - bot.position.x;
      const dz = op.z - bot.position.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      targetPos.set(op.x, op.y + 1.2, op.z);
      if (combat.lineBlocked(eyePos, targetPos, ctx.smokes)) continue;
      best = other;
      bestD = d;
    }
    if (best) {
      bot.target = best;
      bot.lastSeen = { x: best.position.x, z: best.position.z };
      bot.lastSeenAt = time;
      if (bot.reactAt === 0) bot.reactAt = time + PERSONALITY[bot.personality].react;
    } else if (bot.target && time - bot.lastSeenAt > 2.5) {
      bot.target = null;
      bot.reactAt = 0;
    }

    // Decide.
    const bombState = ctx.bomb.state;
    if (bot.target && time >= bot.reactAt) {
      bot.state = 'engage';
    } else if (bot.state === 'engage' && !bot.target) {
      bot.state = 'route';
      bot.path = [];
    }
    if (bot.state !== 'engage') {
      if (bot.team === 'sentinel' && bombState === 'planted' && ctx.bomb.site) {
        if (bot.personality !== 'sniper' && bot.dest !== 'bomb') {
          bot.dest = 'bomb';
          setRoute(bot, nearestWaypoint(ctx.bomb.site.x, 0, ctx.bomb.site.z));
        }
      } else if (!bot.path.length && bot.state !== 'hold') {
        const obj = pickObjective(bot, bombState, time);
        if (obj.kind === 'hold') {
          bot.state = 'hold';
          bot.dest = obj.site;
          setRoute(bot, obj.site);
          bot.holdUntil = time + 6 + Math.random() * 6;
          bot.holdYaw = Math.random() * Math.PI * 2;
        } else {
          bot.state = 'route';
          bot.dest = obj.site;
          setRoute(bot, obj.site);
        }
      }
      if (bot.state === 'hold' && bot.path.length === 0 && time > bot.holdUntil) {
        bot.state = 'route';
        bot.path = [];
        bot.dest = null;
      }
    }

    // Bomb actions.
    if (bot.team === 'vanguard' && bombState === 'idle' && bot.dest && (bot.dest === 'aSite' || bot.dest === 'bSite')) {
      const site = BOMB_SITES[bot.dest === 'aSite' ? 'A' : 'B'];
      const d = Math.hypot(bot.position.x - site.x, bot.position.z - site.z);
      if (d < 2.5 && bot.path.length === 0) {
        if (combat.plantStart(site)) {
          bot.state = 'planting';
        }
      }
    }
    if (bot.state === 'planting') {
      if (combat.plantTick(dt)) {
        bot.state = 'route';
        bot.path = [];
        bot.dest = null;
      }
      if (bot.target) {
        combat.plantCancel();
        bot.state = 'engage';
      }
    }
    if (bot.team === 'sentinel' && bombState === 'planted' && ctx.bomb.site) {
      const d = Math.hypot(bot.position.x - ctx.bomb.site.x, bot.position.z - ctx.bomb.site.z);
      if (d < 2 && bot.path.length === 0) {
        bot.state = 'defusing';
      }
    }
    if (bot.state === 'defusing') {
      if (combat.defuseTick(dt)) {
        bot.state = 'route';
        bot.path = [];
      }
      if (bot.target) {
        combat.defuseCancel();
        bot.state = 'engage';
      }
    }

    // Movement.
    let mx = 0;
    let mz = 0;
    if (bot.state === 'route' || bot.state === 'hold') {
      if (bot.path.length > 0) {
        const wp = bot.path[bot.pathIndex];
        const dx = wp[0] - bot.position.x;
        const dz = wp[2] - bot.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.7) {
          bot.pathIndex += 1;
          if (bot.pathIndex >= bot.path.length) bot.path = [];
        } else {
          mx = dx / d;
          mz = dz / d;
        }
      }
    } else if (bot.state === 'engage' && bot.target) {
      if (time > bot.strafeAt) {
        bot.strafeAt = time + 0.7 + Math.random() * 0.8;
        bot.strafeDir = Math.random() < 0.5 ? -1 : 1;
      }
      const dx = bot.target.position.x - bot.position.x;
      const dz = bot.target.position.z - bot.position.z;
      const d = Math.hypot(dx, dz) || 1;
      const want = bot.def.range * 0.5;
      const radial = d > want + 2 ? 1 : d < want - 2 ? -0.6 : 0;
      mx = (dx / d) * radial + (-dz / d) * bot.strafeDir * 0.6;
      mz = (dz / d) * radial + (dx / d) * bot.strafeDir * 0.6;
    }
    const spd = bot.state === 'engage' ? bot.speed * 0.45 : bot.speed;
    bot.position.x += mx * spd * dt;
    bot.position.z += mz * spd * dt;
    bot.position.y = groundHeight(bot.position.x, bot.position.z);
    // Face movement or target.
    if (bot.target) {
      bot.yaw = Math.atan2(-(bot.target.position.x - bot.position.x), -(bot.target.position.z - bot.position.z));
      const dy = bot.target.position.y + 1.2 - (bot.position.y + EYE);
      const dd = Math.hypot(bot.target.position.x - bot.position.x, bot.target.position.z - bot.position.z);
      bot.pitch = Math.atan2(dy, dd);
    } else if (mx || mz) {
      bot.yaw = Math.atan2(-mx, -mz);
    } else if (bot.state === 'hold') {
      bot.yaw += Math.sin(time * 0.5 + bot.holdYaw) * dt * 0.4;
    }
    bot.mesh.group.position.copy(bot.position);
    bot.mesh.group.rotation.set(0, bot.yaw, 0);
    // Walk cycle: legs swing in opposition, torso bobs, the gun counter-sways.
    // Dead bots lie flat (fall), so the walk is skipped for them.
    if (bot.alive && (mx || mz)) {
      bot.walkPhase += dt * bot.speed * 2.4;
      const swing = Math.sin(bot.walkPhase) * 0.5;
      bot.mesh.legL.rotation.x = swing;
      bot.mesh.legR.rotation.x = -swing;
      bot.mesh.group.position.y = bot.position.y + Math.abs(Math.cos(bot.walkPhase)) * 0.03;
      bot.mesh.gun.rotation.x = -0.06 + Math.sin(bot.walkPhase * 2) * 0.04;
    } else if (bot.alive) {
      bot.mesh.legL.rotation.x *= 0.8;
      bot.mesh.legR.rotation.x *= 0.8;
      bot.mesh.gun.rotation.x = -0.06;
    }

    // Grenade: throw at last seen enemy position when close and unseen.
    if (bot.grenades > 0 && bot.lastSeen && !bot.target && time - bot.lastSeenAt < 4 && time > bot.nadeAt) {
      const d = Math.hypot(bot.lastSeen.x - bot.position.x, bot.lastSeen.z - bot.position.z);
      if (d < 18 && Math.random() < 0.02) {
        bot.grenades -= 1;
        bot.nadeAt = time + 20;
        tmp.set(bot.lastSeen.x - bot.position.x, 2, bot.lastSeen.z - bot.position.z).normalize();
        combat.throwGrenade(new THREE.Vector3(bot.position.x, bot.position.y + 1.4, bot.position.z), tmp, { id: 'frag', radius: 6, dmg: 120, fuse: 1.6 });
      }
    }

    // Shooting.
    if (bot.state === 'engage' && bot.target && time >= bot.reactAt && bot.reloadLeft === 0) {
      if (bot.mag === 0) {
        bot.reloadLeft = bot.def.reload;
      } else if (bot.cooldown === 0) {
        if (bot.burstLeft === 0) {
          bot.burstLeft = bot.def.auto ? 3 + Math.floor(Math.random() * 3) : 1;
          bot.burstGap = 0;
        }
        if (bot.burstGap <= 0) {
          const acc = PERSONALITY[bot.personality].acc;
          const dist = Math.hypot(bot.target.position.x - bot.position.x, bot.target.position.z - bot.position.z);
          const spread = (0.012 + dist * 0.0009) * (1.6 - acc);
          eyePos.set(bot.position.x, bot.position.y + EYE, bot.position.z);
          targetPos.set(bot.target.position.x, bot.target.position.y + 1.2, bot.target.position.z);
          tmp.subVectors(targetPos, eyePos).normalize();
          bot.mag -= 1;
          bot.cooldown = bot.def.gap;
          bot.burstLeft -= 1;
          bot.burstGap = bot.def.auto ? bot.def.gap : 0.5;
          combat.fire(bot, bot.def, eyePos, tmp, spread, Math.random, ctx.hittables);
          if (bot.burstLeft <= 0) bot.cooldown = Math.max(bot.cooldown, 0.5 + Math.random() * 0.5);
        } else {
          bot.burstGap -= dt;
        }
      }
    } else if (bot.mag === 0 && bot.reloadLeft === 0) {
      bot.reloadLeft = bot.def.reload;
    }
    if (bot.mag < bot.def.mag * 0.3 && !bot.target && bot.reloadLeft === 0) {
      bot.reloadLeft = bot.def.reload;
    }
  }

  function spawnRound(vanguardDefs, sentinelDefs) {
    for (const b of bots) {
      scene.remove(b.mesh.group);
    }
    bots.length = 0;
    hitMeshes.length = 0;
    const vSpots = [[-19, -3], [-19, 0], [-19, 3], [-17, -5]];
    const sSpots = [[19, -3], [19, 0], [19, 3], [17, -5], [17, 5]];
    const vPers = ['assault', 'tactical', 'support', 'sniper'];
    const sPers = ['defender', 'defender', 'sniper', 'assault', 'tactical'];
    for (let i = 0; i < 4; i += 1) {
      const b = spawnBot('vanguard', vPers[i], vSpots[i][0], vSpots[i][1], vanguardDefs[i]);
      attachDamage(b);
    }
    for (let i = 0; i < 5; i += 1) {
      const b = spawnBot('sentinel', sPers[i], sSpots[i][0], sSpots[i][1], sentinelDefs[i]);
      attachDamage(b);
    }
    return bots;
  }

  return {
    bots,
    hitMeshes,
    spawnRound,
    step(dt, time, ctx) {
      for (const bot of bots) stepBot(bot, dt, time, ctx);
    },
    aliveCount(team) {
      return bots.filter((b) => b.team === team && b.alive).length;
    },
    reset() {
      for (const b of bots) {
        scene.remove(b.mesh.group);
      }
      bots.length = 0;
      hitMeshes.length = 0;
    },
  };
}
