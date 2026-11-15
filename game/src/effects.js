// Visual effects, pooled and allocation-free in the hot loop: bullet tracers, surface-
// specific impacts (concrete dust, metal sparks, wood chips), layered smoke, explosions
// with fireball, shockwave and scorch, and muzzle glints for bot guns. All meshes and
// sprites are created once and reused; step() only moves and fades them.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createTextures } from './textures.js';

const MAX_TRACERS = 24;
const MAX_SPARKS = 120;
const MAX_DUST = 40;
const MAX_SMOKE_CLOUDS = 8;
const SMOKE_PER_CLOUD = 5;
const MAX_RINGS = 4;
const MAX_SCORCH = 6;
const MAX_MUZZLE = 8;

export function createEffects(scene, camera) {
  const tex = createTextures();
  const tmp = new THREE.Vector3();

  // ---- Tracers: additive lines, bright enough to read at dusk. ----
  const tracers = [];
  for (let i = 0; i < MAX_TRACERS; i += 1) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color('#ffd9a0'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }

  // ---- Sparks and chips: small pooled boxes with gravity. ----
  const sparks = [];
  const sparkGeo = new THREE.BoxGeometry(0.045, 0.045, 0.045);
  const sparkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347') });
  const chipMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#8a7a5a') });
  const concreteMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9a9a96') });
  for (let i = 0; i < MAX_SPARKS; i += 1) {
    const mesh = new THREE.Mesh(sparkGeo, i % 3 === 0 ? chipMat : i % 3 === 1 ? concreteMat : sparkMat);
    mesh.visible = false;
    scene.add(mesh);
    sparks.push({ mesh, life: 0, vel: new THREE.Vector3(), spin: 0 });
  }

  // ---- Dust puffs: soft sprites that bloom and fade. ----
  const dusts = [];
  for (let i = 0; i < MAX_DUST; i += 1) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.smoke, color: new THREE.Color('#b8b0a0'), transparent: true, opacity: 0, depthWrite: false }));
    s.visible = false;
    scene.add(s);
    dusts.push({ sprite: s, life: 0, maxLife: 1, grow: 1 });
  }

  // ---- Smoke clouds: five layered sprites each, so the cloud reads as volume. ----
  const clouds = [];
  for (let c = 0; c < MAX_SMOKE_CLOUDS; c += 1) {
    const parts = [];
    for (let i = 0; i < SMOKE_PER_CLOUD; i += 1) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.smoke, color: new THREE.Color('#a8adb2'), transparent: true, opacity: 0, depthWrite: false }));
      s.visible = false;
      scene.add(s);
      parts.push({ sprite: s, ox: 0, oy: 0, oz: 0, size: 1 });
    }
    clouds.push({ parts, life: 0, maxLife: 1, radius: 1, cx: 0, cy: 0, cz: 0 });
  }

  // ---- Shockwave rings: an expanding torus that fades. ----
  const rings = [];
  for (let i = 0; i < MAX_RINGS; i += 1) {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.09, 8, 32),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf8a'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    scene.add(m);
    rings.push({ mesh: m, life: 0 });
  }

  // ---- Scorch decals left behind by explosions. ----
  const scorch = [];
  for (let i = 0; i < MAX_SCORCH; i += 1) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshBasicMaterial({ map: tex.scorch, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    scene.add(m);
    scorch.push({ mesh: m, life: 0 });
  }

  // ---- Muzzle glints: a brief glow where a bot's gun fires. ----
  const muzzles = [];
  for (let i = 0; i < MAX_MUZZLE; i += 1) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: new THREE.Color('#ffb36b'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.visible = false;
    scene.add(s);
    muzzles.push({ sprite: s, life: 0 });
  }

  // ---- The explosion's light, reused for every blast. ----
  const flash = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 16);
  scene.add(flash);
  // Fireball: an emissive sphere that swells and dies in a third of a second.
  const fireball = new THREE.Mesh(
    new THREE.SphereGeometry(1, 14, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a2a'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  fireball.visible = false;
  scene.add(fireball);
  let fireLife = 0;

  function tracer(from, to) {
    const t = tracers.find((x) => x.life <= 0) ?? tracers[0];
    const pos = t.line.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    t.line.visible = true;
    t.line.material.opacity = 0.9;
    t.life = 0.09;
  }

  function puff(point, n, size, color, speed, life) {
    let placed = 0;
    for (const d of dusts) {
      if (d.life > 0) continue;
      d.sprite.visible = true;
      d.sprite.position.copy(point);
      d.sprite.material.color.setHex(color);
      d.sprite.scale.setScalar(size * (0.7 + Math.random() * 0.6));
      d.sprite.material.opacity = 0.55;
      d.life = life * (0.7 + Math.random() * 0.6);
      d.maxLife = d.life;
      d.grow = speed;
      if (++placed >= n) break;
    }
  }

  function burst(point, normal, n, mat) {
    let placed = 0;
    for (const p of sparks) {
      if (p.life > 0) continue;
      p.mesh.visible = true;
      p.mesh.material = mat;
      p.mesh.position.copy(point);
      p.vel.set((Math.random() - 0.5) * 4 + normal.x * 2.5, Math.random() * 3 + 1.2, (Math.random() - 0.5) * 4 + normal.z * 2.5);
      p.spin = (Math.random() - 0.5) * 20;
      p.life = 0.3 + Math.random() * 0.35;
      if (++placed >= n) break;
    }
  }

  // Surface-specific impacts: concrete throws dust and chips, metal throws bright
  // sparks, wood throws brown chips. The surface comes from the hit mesh's
  // userData.surface, set when the world is built.
  function impact(point, normal, surface = 'concrete') {
    if (surface === 'metal') {
      burst(point, normal, 9, sparkMat);
      puff(point, 1, 0.5, 0x8a8a86, 1, 0.4);
    } else if (surface === 'wood') {
      burst(point, normal, 7, chipMat);
      puff(point, 3, 0.7, 0xa88a5a, 1, 0.6);
    } else if (surface === 'glass') {
      burst(point, normal, 8, sparkMat);
      puff(point, 2, 0.6, 0xb8c8d0, 1, 0.5);
    } else {
      burst(point, normal, 5, concreteMat);
      puff(point, 4, 0.9, 0xb8b0a0, 1.4, 0.7);
    }
  }

  function muzzle(pos) {
    const m = muzzles.find((x) => x.life <= 0) ?? muzzles[0];
    m.sprite.visible = true;
    m.sprite.position.copy(pos);
    m.sprite.scale.setScalar(0.55);
    m.sprite.material.opacity = 0.95;
    m.life = 0.07;
  }

  function smokeCloud(x, y, z, radius, life) {
    const c = clouds.find((x) => x.life <= 0) ?? clouds[0];
    c.cx = x;
    c.cy = y + 0.6;
    c.cz = z;
    c.radius = radius;
    c.life = life;
    c.maxLife = life;
    for (let i = 0; i < c.parts.length; i += 1) {
      const p = c.parts[i];
      const a = (i / c.parts.length) * Math.PI * 2;
      p.ox = Math.cos(a) * radius * 0.45;
      p.oy = (i - 2) * 0.35;
      p.oz = Math.sin(a) * radius * 0.45;
      p.size = radius * (0.7 + (i % 3) * 0.25);
      p.sprite.visible = true;
      p.sprite.position.set(x + p.ox, y + 0.6 + p.oy, z + p.oz);
      p.sprite.scale.setScalar(p.size);
      p.sprite.material.opacity = 0.3;
    }
  }

  function explosion(point) {
    flash.position.copy(point);
    flash.intensity = 90;
    fireball.visible = true;
    fireball.position.copy(point);
    fireball.scale.setScalar(0.6);
    fireLife = 0.32;
    const ring = rings.find((x) => x.life <= 0) ?? rings[0];
    ring.mesh.visible = true;
    ring.mesh.position.set(point.x, Math.max(0.15, point.y - 0.3), point.z);
    ring.mesh.scale.setScalar(0.5);
    ring.mesh.material.opacity = 0.9;
    ring.life = 0.5;
    let n = 0;
    for (const p of sparks) {
      if (p.life > 0) continue;
      p.mesh.visible = true;
      p.mesh.material = sparkMat;
      p.mesh.position.copy(point);
      tmp.set(Math.random() - 0.5, Math.random() * 0.7 + 0.25, Math.random() - 0.5).normalize().multiplyScalar(7 + Math.random() * 6);
      p.vel.copy(tmp);
      p.spin = (Math.random() - 0.5) * 24;
      p.life = 0.5 + Math.random() * 0.45;
      if (++n >= 20) break;
    }
    puff(point, 6, 1.6, 0x5a4a38, 1.8, 1.1);
    smokeCloud(point.x, point.y, point.z, 2.4, 3.2);
    const s = scorch.find((x) => x.life <= 0) ?? scorch[0];
    s.mesh.visible = true;
    s.mesh.position.set(point.x, 0.03, point.z);
    s.mesh.rotation.z = Math.random() * Math.PI;
    s.mesh.material.opacity = 0.85;
    s.life = 30;
  }

  function step(dt) {
    for (const t of tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
      if (t.life <= 0) t.line.visible = false;
    }
    for (const p of sparks) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vel.y -= 11 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.spin * dt;
      if (p.mesh.position.y < 0.03) {
        p.mesh.position.y = 0.03;
        p.vel.y = Math.abs(p.vel.y) * 0.3;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
      }
      if (p.life <= 0) p.mesh.visible = false;
    }
    for (const d of dusts) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.sprite.material.opacity = 0.55 * Math.max(0, d.life / d.maxLife);
      d.sprite.scale.addScalar(d.grow * dt);
      d.sprite.position.y += dt * 0.25;
      if (d.life <= 0) d.sprite.visible = false;
    }
    for (const c of clouds) {
      if (c.life <= 0) continue;
      c.life -= dt;
      const k = Math.max(0, c.life / c.maxLife);
      const grow = 1 + (1 - k) * 0.45;
      for (const p of c.parts) {
        p.sprite.material.opacity = 0.3 * k;
        p.sprite.scale.setScalar(p.size * grow);
        p.sprite.position.y += dt * 0.12;
      }
      if (c.life <= 0) for (const p of c.parts) p.sprite.visible = false;
    }
    for (const r of rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      r.mesh.scale.addScalar(dt * 16);
      r.mesh.material.opacity = Math.max(0, r.life / 0.5) * 0.9;
      if (r.life <= 0) r.mesh.visible = false;
    }
    for (const s of scorch) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life < 5) s.mesh.material.opacity = 0.85 * (s.life / 5);
      if (s.life <= 0) s.mesh.visible = false;
    }
    for (const m of muzzles) {
      if (m.life <= 0) continue;
      m.life -= dt;
      m.sprite.material.opacity = Math.max(0, m.life / 0.07) * 0.95;
      if (m.life <= 0) m.sprite.visible = false;
    }
    if (fireLife > 0) {
      fireLife -= dt;
      fireball.scale.addScalar(dt * 9);
      fireball.material.opacity = Math.max(0, fireLife / 0.32) * 0.85;
      if (fireLife <= 0) fireball.visible = false;
    }
    flash.intensity = Math.max(0, flash.intensity - dt * 320);
  }

  return {
    tracer,
    impact,
    muzzle,
    smokeCloud,
    explosion,
    step,
    smokeCenters() {
      return clouds.filter((c) => c.life > 0).map((c) => ({ x: c.cx, y: c.cy, z: c.cz, r: c.radius }));
    },
  };
}
