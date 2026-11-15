// Combat: hitscan shooting with head/body damage and falloff, grenade projectiles
// (frag blast, smoke that blocks sight), and the bomb (plant / fuse / defuse). It does
// not own teams or rounds; it reports kills and bomb events through callbacks.
import * as THREE from 'three';

const GRAVITY = 12;

export function createCombat(scene, world, effects, audio, hooks) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 140;
  const dir = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const grenades = [];
  const bomb = { state: 'idle', site: null, fuse: 0, plant: 0, defuse: 0, mesh: null, beep: 0 };
  const bombGeo = new THREE.BoxGeometry(0.5, 0.3, 0.35);
  const bombMat = new THREE.MeshStandardMaterial({ color: 0xd84a35, roughness: 0.5, metalness: 0.3, emissive: 0x881111 });
  const nadeGeo = new THREE.SphereGeometry(0.09, 10, 8);
  const nadeMat = new THREE.MeshStandardMaterial({ color: 0x2a323c, roughness: 0.4, metalness: 0.6 });

  function lineBlocked(from, to, smokes) {
    dir.subVectors(to, from);
    const len = dir.length();
    if (len < 0.01) return false;
    dir.normalize();
    raycaster.set(from, dir);
    raycaster.far = len;
    const hit = raycaster.intersectObjects(world.shootables, false)[0];
    if (hit) return true;
    for (const s of smokes) {
      const mx = (from.x + to.x) / 2;
      const mz = (from.z + to.z) / 2;
      const dx = mx - s.x;
      const dz = mz - s.z;
      if (dx * dx + dz * dz < s.r * s.r) return true;
    }
    return false;
  }

  function fire(shooter, def, from, aimDir, spread, random, hittables) {
    let hitAny = null;
    // Bots get a visible muzzle glint at their gun; the player has the view-model flash.
    if (shooter && shooter.isBot) effects.muzzle(from);
    for (let p = 0; p < def.pellets; p += 1) {
      dir.copy(aimDir);
      dir.x += (random() * 2 - 1) * spread;
      dir.y += (random() * 2 - 1) * spread;
      dir.z += (random() * 2 - 1) * spread;
      dir.normalize();
      raycaster.set(from, dir);
      raycaster.far = def.range;
      const hits = raycaster.intersectObjects(hittables, false);
      // Skip the shooter's own body: the ray starts inside its head hitbox.
      let hit = null;
      for (const h of hits) {
        if (h.object.userData.actor === shooter) continue;
        hit = h;
        break;
      }
      if (!hit) {
        origin.copy(from).addScaledVector(dir, def.range);
        effects.tracer(from, origin);
        continue;
      }
      effects.tracer(from, hit.point);
      const ud = hit.object.userData;
      if (ud.actor && ud.actor !== shooter && ud.actor.alive) {
        const dist = hit.distance;
        const falloff = dist > def.range * 0.6 ? 0.6 : 1;
        const dmg = (ud.part === 'head' ? def.head : def.dmg) * falloff;
        const killed = ud.actor.damage(dmg, ud.part === 'head');
        hitAny = { actor: ud.actor, part: ud.part, killed, dmg };
        hooks.onHit(shooter, ud.actor, ud.part, killed);
      } else {
        effects.impact(hit.point, hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0), ud.surface || 'concrete');
      }
    }
    return hitAny;
  }

  function throwGrenade(from, aimDir, def) {
    const mesh = new THREE.Mesh(nadeGeo, nadeMat);
    mesh.position.copy(from);
    scene.add(mesh);
    grenades.push({
      mesh,
      def,
      vel: new THREE.Vector3(aimDir.x * 16, aimDir.y * 16 + 4.5, aimDir.z * 16),
      fuse: def.fuse,
    });
  }

  function explode(g) {
    scene.remove(g.mesh);
    if (g.def.id === 'frag') {
      effects.explosion(g.mesh.position);
      audio.explosion();
      hooks.onExplode(g.mesh.position, g.def.radius, g.def.dmg);
    } else {
      effects.smokeCloud(g.mesh.position.x, g.mesh.position.y, g.mesh.position.z, g.def.radius, g.def.life);
      audio.beep();
    }
  }

  function stepGrenades(dt) {
    for (let i = grenades.length - 1; i >= 0; i -= 1) {
      const g = grenades[i];
      g.fuse -= dt;
      g.vel.y -= GRAVITY * dt;
      g.mesh.position.addScaledVector(g.vel, dt);
      if (g.mesh.position.y < 0.09) {
        g.mesh.position.y = 0.09;
        g.vel.y = Math.abs(g.vel.y) * 0.35;
        g.vel.x *= 0.6;
        g.vel.z *= 0.6;
      }
      if (g.fuse <= 0) {
        explode(g);
        grenades.splice(i, 1);
      }
    }
  }

  function plantStart(site) {
    if (bomb.state !== 'idle') return false;
    bomb.state = 'planting';
    bomb.site = site;
    bomb.plant = 0;
    return true;
  }
  function plantTick(dt) {
    if (bomb.state !== 'planting') return false;
    bomb.plant += dt;
    if (bomb.plant >= 3.5) {
      bomb.state = 'planted';
      bomb.fuse = 35;
      bomb.beep = 0;
      bomb.mesh = new THREE.Mesh(bombGeo, bombMat);
      bomb.mesh.position.set(bomb.site.x, 0.15, bomb.site.z);
      scene.add(bomb.mesh);
      audio.plant();
      hooks.onPlanted(bomb.site);
      return true;
    }
    return false;
  }
  function plantCancel() {
    if (bomb.state === 'planting') {
      bomb.state = 'idle';
      bomb.site = null;
      bomb.plant = 0;
    }
  }
  function defuseTick(dt) {
    if (bomb.state !== 'planted') return false;
    bomb.defuse += dt;
    if (bomb.defuse >= 5) {
      bomb.state = 'defused';
      if (bomb.mesh) scene.remove(bomb.mesh);
      bomb.mesh = null;
      hooks.onDefused();
      return true;
    }
    return false;
  }
  function defuseCancel() {
    if (bomb.state === 'planted') bomb.defuse = 0;
  }
  // Stage a planted bomb directly (used by the screenshot shot mode).
  function forcePlant(site, fuse) {
    if (bomb.mesh) scene.remove(bomb.mesh);
    bomb.state = 'planted';
    bomb.site = site;
    bomb.fuse = fuse;
    bomb.plant = 3.5;
    bomb.defuse = 0;
    bomb.beep = 0;
    bomb.mesh = new THREE.Mesh(bombGeo, bombMat);
    bomb.mesh.position.set(site.x, 0.15, site.z);
    scene.add(bomb.mesh);
  }

  function stepBomb(dt) {
    if (bomb.state === 'planted') {
      bomb.fuse -= dt;
      bomb.beep += dt;
      const interval = bomb.fuse > 15 ? 1 : bomb.fuse > 5 ? 0.5 : 0.25;
      if (bomb.beep >= interval) {
        bomb.beep = 0;
        audio.beep();
      }
      if (bomb.fuse <= 0) {
        bomb.state = 'exploded';
        if (bomb.mesh) scene.remove(bomb.mesh);
        bomb.mesh = null;
        effects.explosion(new THREE.Vector3(bomb.site.x, 0.5, bomb.site.z));
        audio.explosion();
        hooks.onExploded(bomb.site);
      }
    }
  }

  function reset() {
    for (const g of grenades) scene.remove(g.mesh);
    grenades.length = 0;
    if (bomb.mesh) scene.remove(bomb.mesh);
    bomb.mesh = null;
    bomb.state = 'idle';
    bomb.site = null;
    bomb.fuse = 0;
    bomb.plant = 0;
    bomb.defuse = 0;
    bomb.beep = 0;
  }

  return {
    bomb,
    fire,
    throwGrenade,
    lineBlocked,
    plantStart,
    plantTick,
    plantCancel,
    defuseTick,
    defuseCancel,
    forcePlant,
    step(dt) {
      stepGrenades(dt);
      stepBomb(dt);
    },
    reset,
  };
}
