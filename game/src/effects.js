// Visual effects, pooled and allocation-free in the hot loop: bullet tracers, impact
// sparks and dust, smoke clouds, explosions, and the red damage vignette. All meshes are
// created once and reused; step() only moves and fades them.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const MAX_TRACERS = 24;
const MAX_PARTICLES = 160;
const MAX_SMOKE = 8;

export function createEffects(scene, camera) {
  const tracers = [];
  for (let i = 0; i < MAX_TRACERS; i += 1) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0 }));
    line.visible = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  const particles = [];
  const pGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  const sparkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent) });
  const dustMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.muted), transparent: true, opacity: 0.7 });
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    const mesh = new THREE.Mesh(pGeo, i % 2 ? sparkMat : dustMat);
    mesh.visible = false;
    scene.add(mesh);
    particles.push({ mesh, life: 0, vel: new THREE.Vector3() });
  }
  const smokes = [];
  const smokeGeo = new THREE.SphereGeometry(1, 10, 8);
  const smokeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9aa3ab'), transparent: true, opacity: 0.32, depthWrite: false });
  for (let i = 0; i < MAX_SMOKE; i += 1) {
    const mesh = new THREE.Mesh(smokeGeo, smokeMat.clone());
    mesh.visible = false;
    scene.add(mesh);
    smokes.push({ mesh, life: 0, maxLife: 1, radius: 1 });
  }
  const flash = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 14);
  scene.add(flash);
  const tmp = new THREE.Vector3();

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

  function impact(point, normal) {
    let n = 0;
    for (const p of particles) {
      if (p.life > 0) continue;
      p.mesh.visible = true;
      p.mesh.position.copy(point);
      p.vel.set((Math.random() - 0.5) * 3 + normal.x * 2, Math.random() * 2.5 + 1, (Math.random() - 0.5) * 3 + normal.z * 2);
      p.life = 0.35 + Math.random() * 0.25;
      if (++n >= 7) break;
    }
  }

  function smokeCloud(x, y, z, radius, life) {
    const s = smokes.find((x) => x.life <= 0) ?? smokes[0];
    s.mesh.visible = true;
    s.mesh.position.set(x, y + 0.6, z);
    s.mesh.scale.setScalar(radius);
    s.mesh.material.opacity = 0.32;
    s.life = life;
    s.maxLife = life;
    s.radius = radius;
  }

  function explosion(point) {
    flash.position.copy(point);
    flash.intensity = 60;
    let n = 0;
    for (const p of particles) {
      if (p.life > 0) continue;
      p.mesh.visible = true;
      p.mesh.position.copy(point);
      tmp.set(Math.random() - 0.5, Math.random() * 0.7 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(6 + Math.random() * 5);
      p.vel.copy(tmp);
      p.life = 0.5 + Math.random() * 0.4;
      if (++n >= 18) break;
    }
    smokeCloud(point.x, point.y, point.z, 2.2, 2.5);
  }

  function step(dt) {
    for (const t of tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
      if (t.life <= 0) t.line.visible = false;
    }
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vel.y -= 9 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.life <= 0) p.mesh.visible = false;
    }
    for (const s of smokes) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.mesh.material.opacity = 0.32 * Math.max(0, s.life / s.maxLife);
      s.mesh.scale.setScalar(s.radius * (1 + (1 - s.life / s.maxLife) * 0.4));
      if (s.life <= 0) s.mesh.visible = false;
    }
    flash.intensity = Math.max(0, flash.intensity - dt * 260);
  }

  return {
    tracer,
    impact,
    smokeCloud,
    explosion,
    step,
    smokeCenters() {
      return smokes.filter((s) => s.life > 0).map((s) => ({ x: s.mesh.position.x, y: s.mesh.position.y, z: s.mesh.position.z, r: s.radius }));
    },
  };
}
