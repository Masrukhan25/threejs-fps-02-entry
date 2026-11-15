// The arsenal: six weapons with distinct stats, detailed view models, and the feel
// of a real shooter — weapon sway, walk bob, recoil kick, a reload dip, shell
// ejection, and a muzzle flash that lights the room. It owns ammo and fire timing;
// combat.js owns the ray and the damage. Every weapon is bought in the buy menu
// (rounds.js) except the sidearm.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = [
  { id: 'rifle', name: 'VK-7 Vanguard', kind: 'rifle', price: 2700, auto: true, mag: 30, reserve: 90, dmg: 34, head: 100, gap: 0.096, reload: 1.9, spreadStill: 0.0022, spreadMove: 0.028, kick: 0.009, range: 80, pellets: 1 },
  { id: 'dmr', name: 'LM-12 Longshot', kind: 'dmr', price: 2400, auto: false, mag: 20, reserve: 60, dmg: 55, head: 140, gap: 0.16, reload: 2.2, spreadStill: 0.0015, spreadMove: 0.02, kick: 0.014, range: 90, pellets: 1 },
  { id: 'sniper', name: 'SR-9 Sentinel', kind: 'sniper', price: 4750, auto: false, mag: 5, reserve: 15, dmg: 110, head: 220, gap: 1.1, reload: 3.0, spreadStill: 0.0008, spreadMove: 0.03, kick: 0.03, range: 120, pellets: 1 },
  { id: 'smg', name: 'KX-5 Striker', kind: 'smg', price: 1500, auto: true, mag: 32, reserve: 96, dmg: 26, head: 78, gap: 0.07, reload: 1.6, spreadStill: 0.004, spreadMove: 0.035, kick: 0.006, range: 50, pellets: 1 },
  { id: 'shotgun', name: 'M870 Breacher', kind: 'shotgun', price: 1100, auto: false, mag: 6, reserve: 24, dmg: 12, head: 24, gap: 0.85, reload: 2.6, spreadStill: 0.03, spreadMove: 0.045, kick: 0.035, range: 22, pellets: 8 },
  { id: 'pistol', name: 'P9 Sidearm', kind: 'pistol', price: 0, auto: false, mag: 12, reserve: 36, dmg: 28, head: 84, gap: 0.14, reload: 1.4, spreadStill: 0.003, spreadMove: 0.022, kick: 0.008, range: 45, pellets: 1 },
];
export const GRENADES = [
  { id: 'frag', name: 'Frag Grenade', price: 300, radius: 6, dmg: 120, fuse: 1.6 },
  { id: 'smoke', name: 'Smoke Grenade', price: 300, radius: 4, dmg: 0, fuse: 1.2, life: 12 },
];

// Gunmetal, polymer, wood and glass: the four materials every weapon is built from.
const GUNMETAL = new THREE.MeshStandardMaterial({ color: new THREE.Color('#23262b'), roughness: 0.32, metalness: 0.85 });
const GUNMETAL_LIGHT = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a3f46'), roughness: 0.28, metalness: 0.9 });
const POLYMER = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1a1c1f'), roughness: 0.72, metalness: 0.15 });
const WOOD = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.container), roughness: 0.8, metalness: 0.05 });
const BRASS = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c8a24a'), roughness: 0.3, metalness: 0.9 });
const LENS = new THREE.MeshStandardMaterial({ color: new THREE.Color('#0a1a24'), roughness: 0.05, metalness: 0.4, emissive: new THREE.Color('#0d2f3a'), emissiveIntensity: 0.6 });

function part(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cy = (r, len, seg = 12) => new THREE.CylinderGeometry(r, r, len, seg);

// Each model is built from its parts: receiver, barrel, furniture, sights, optic.
// The gun points down -z, like the camera; the group is scaled and placed by the
// arsenal so the weapon sits low-right in the first-person view.
function buildModel(def) {
  const g = new THREE.Group();
  if (def.kind === 'rifle') {
    g.add(part(bx(0.09, 0.1, 0.42), GUNMETAL, 0, 0, 0));
    g.add(part(bx(0.075, 0.075, 0.2), POLYMER, 0, -0.005, -0.28));
    g.add(part(cy(0.022, 0.22), GUNMETAL_LIGHT, 0, 0.01, -0.5, Math.PI / 2));
    g.add(part(bx(0.05, 0.05, 0.06), GUNMETAL_LIGHT, 0, 0.01, -0.6));
    g.add(part(bx(0.07, 0.09, 0.05), POLYMER, 0, -0.09, 0.06));
    g.add(part(bx(0.06, 0.14, 0.09), POLYMER, 0, -0.1, 0.16, 0.25));
    g.add(part(bx(0.05, 0.06, 0.14), POLYMER, 0, -0.08, -0.18, -0.15));
    g.add(part(bx(0.08, 0.05, 0.16), POLYMER, 0, -0.01, 0.3));
    g.add(part(cy(0.028, 0.12), GUNMETAL, 0, 0.075, -0.12, Math.PI / 2));
    g.add(part(cy(0.02, 0.02), LENS, 0, 0.075, -0.185, Math.PI / 2));
    g.add(part(bx(0.015, 0.05, 0.02), GUNMETAL_LIGHT, 0, 0.075, -0.38));
    g.add(part(bx(0.02, 0.03, 0.03), GUNMETAL_LIGHT, 0.05, 0.06, 0.1));
    for (let i = 0; i < 3; i += 1) g.add(part(bx(0.085, 0.012, 0.03), GUNMETAL_LIGHT, 0, 0.045, -0.2 - i * 0.06));
  } else if (def.kind === 'dmr') {
    g.add(part(bx(0.085, 0.09, 0.5), GUNMETAL, 0, 0, 0));
    g.add(part(cy(0.02, 0.3), GUNMETAL_LIGHT, 0, 0.01, -0.55, Math.PI / 2));
    g.add(part(bx(0.07, 0.07, 0.2), WOOD, 0, -0.015, 0.32));
    g.add(part(bx(0.06, 0.1, 0.1), POLYMER, 0, -0.09, 0.12, 0.22));
    g.add(part(bx(0.05, 0.07, 0.12), POLYMER, 0, -0.08, -0.16, -0.12));
    g.add(part(cy(0.03, 0.14), GUNMETAL, 0, 0.085, -0.1, Math.PI / 2));
    g.add(part(cy(0.022, 0.02), LENS, 0, 0.085, -0.175, Math.PI / 2));
    g.add(part(bx(0.015, 0.04, 0.02), GUNMETAL_LIGHT, 0, 0.07, -0.42));
    g.add(part(bx(0.04, 0.03, 0.1), GUNMETAL_LIGHT, -0.04, -0.09, 0.28, 0, 0, 0.3));
    g.add(part(bx(0.04, 0.03, 0.1), GUNMETAL_LIGHT, 0.04, -0.09, 0.28, 0, 0, -0.3));
  } else if (def.kind === 'sniper') {
    g.add(part(bx(0.075, 0.09, 0.58), GUNMETAL, 0, 0, 0));
    g.add(part(cy(0.018, 0.42), GUNMETAL_LIGHT, 0, 0.015, -0.62, Math.PI / 2));
    g.add(part(bx(0.05, 0.05, 0.08), GUNMETAL_LIGHT, 0, 0.015, -0.8));
    g.add(part(bx(0.07, 0.08, 0.24), WOOD, 0, -0.015, 0.36));
    g.add(part(bx(0.05, 0.05, 0.1), WOOD, 0, 0.02, 0.24));
    g.add(part(bx(0.05, 0.08, 0.08), POLYMER, 0, -0.09, 0.08, 0.22));
    g.add(part(bx(0.05, 0.06, 0.1), POLYMER, 0, -0.08, -0.14, -0.12));
    g.add(part(cy(0.032, 0.2), GUNMETAL, 0, 0.1, -0.08, Math.PI / 2));
    g.add(part(cy(0.028, 0.03), LENS, 0, 0.1, -0.185, Math.PI / 2));
    g.add(part(cy(0.012, 0.09), GUNMETAL_LIGHT, 0.05, -0.02, -0.05, 0, 0, Math.PI / 2));
    g.add(part(bx(0.03, 0.03, 0.03), BRASS, 0.095, -0.02, -0.05));
    g.add(part(bx(0.02, 0.16, 0.02), GUNMETAL_LIGHT, -0.05, -0.14, -0.3, 0.5, 0, 0.2));
    g.add(part(bx(0.02, 0.16, 0.02), GUNMETAL_LIGHT, 0.05, -0.14, -0.3, 0.5, 0, -0.2));
  } else if (def.kind === 'smg') {
    g.add(part(bx(0.08, 0.09, 0.3), GUNMETAL, 0, 0, 0));
    g.add(part(cy(0.026, 0.2), GUNMETAL_LIGHT, 0, 0.01, -0.24, Math.PI / 2));
    g.add(part(bx(0.06, 0.12, 0.05), POLYMER, 0, -0.1, 0.05, 0.15));
    g.add(part(bx(0.05, 0.09, 0.06), POLYMER, 0, -0.09, -0.1, 0.2));
    g.add(part(bx(0.05, 0.05, 0.14), POLYMER, 0, -0.01, 0.2, 0, 0.5, 0));
    g.add(part(bx(0.04, 0.04, 0.06), GUNMETAL_LIGHT, 0, 0.06, -0.06));
    g.add(part(bx(0.015, 0.04, 0.02), GUNMETAL_LIGHT, 0, 0.065, -0.2));
    g.add(part(bx(0.07, 0.04, 0.1), POLYMER, 0, -0.02, -0.02));
  } else if (def.kind === 'shotgun') {
    g.add(part(bx(0.08, 0.09, 0.46), WOOD, 0, 0, 0));
    g.add(part(cy(0.024, 0.4), GUNMETAL_LIGHT, 0, 0.03, -0.38, Math.PI / 2));
    g.add(part(cy(0.02, 0.36), GUNMETAL, 0, -0.03, -0.36, Math.PI / 2));
    g.add(part(bx(0.07, 0.09, 0.2), WOOD, 0, -0.02, -0.12));
    g.add(part(bx(0.07, 0.08, 0.22), WOOD, 0, -0.015, 0.3));
    g.add(part(bx(0.05, 0.08, 0.08), POLYMER, 0, -0.08, 0.08, 0.2));
    g.add(part(bx(0.012, 0.03, 0.012), BRASS, 0, 0.075, -0.56));
    g.add(part(bx(0.03, 0.03, 0.06), GUNMETAL_LIGHT, 0, 0.06, -0.3));
  } else {
    g.add(part(bx(0.055, 0.07, 0.2), GUNMETAL, 0, 0, 0));
    g.add(part(bx(0.05, 0.05, 0.06), GUNMETAL_LIGHT, 0, 0.01, -0.12));
    g.add(part(bx(0.05, 0.11, 0.055), POLYMER, 0, -0.085, 0.05, 0.18));
    g.add(part(bx(0.012, 0.03, 0.05), GUNMETAL_LIGHT, 0, -0.045, -0.02));
    g.add(part(bx(0.015, 0.02, 0.02), GUNMETAL_LIGHT, 0, 0.045, -0.08));
    g.add(part(bx(0.02, 0.015, 0.02), GUNMETAL_LIGHT, 0, 0.045, 0.08));
  }
  g.scale.setScalar(0.62);
  g.position.set(0.27, -0.23, -0.5);
  return g;
}

// A soft radial sprite texture, drawn once, for the flash glow and barrel smoke.
function radialTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createArsenal(camera) {
  const models = WEAPONS.map((w) => buildModel(w));
  for (const m of models) {
    m.visible = false;
    camera.add(m);
  }
  const glowTex = radialTexture();
  // A dim light that rides with the camera, so the view model is never a black
  // silhouette in the dusk — the gun stays readable in every lighting mood.
  const viewLight = new THREE.PointLight(new THREE.Color('#ffd9a0'), 0.7, 2.5, 2);
  viewLight.position.set(0.15, 0.1, -0.35);
  camera.add(viewLight);
  // Muzzle flash: two crossed planes plus a glow sprite, all at the muzzle.
  const flashMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const flashA = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), flashMat);
  const flashB = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), flashMat.clone());
  flashB.rotation.z = Math.PI / 2;
  const flashGroup = new THREE.Group();
  flashGroup.add(flashA, flashB);
  flashGroup.position.set(0.24, -0.18, -0.95);
  flashGroup.visible = false;
  camera.add(flashGroup);
  const flashGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color('#ffb36b'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  flashGlow.scale.setScalar(0.5);
  flashGlow.position.set(0.24, -0.18, -0.95);
  camera.add(flashGlow);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);
  // Barrel smoke: a soft puff that lingers after the shot.
  const smoke = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color('#9aa3ab'), transparent: true, opacity: 0, depthWrite: false }));
  smoke.scale.setScalar(0.12);
  smoke.position.set(0.24, -0.16, -0.9);
  camera.add(smoke);
  // Spent shells: six brass cases, pooled, ejected on every shot.
  const shells = [];
  const shellGeo = new THREE.BoxGeometry(0.02, 0.02, 0.035);
  for (let i = 0; i < 6; i += 1) {
    const s = new THREE.Mesh(shellGeo, BRASS);
    s.visible = false;
    camera.add(s);
    shells.push({ mesh: s, life: 0, vel: new THREE.Vector3(), spin: 0 });
  }

  const owned = [WEAPONS[0], WEAPONS[5]];
  const ammo = new Map();
  for (const w of WEAPONS) ammo.set(w.id, { mag: w.mag, reserve: w.reserve });
  const grenades = { frag: 0, smoke: 0 };
  let current = 0;
  models[0].visible = true;
  const state = { cooldown: 0, reloadLeft: 0, flash: 0, kick: 0, switching: 0 };
  const def = () => owned[current];
  let walkPhase = 0;
  let swayX = 0;
  let swayY = 0;
  let smokeLife = 0;

  function ejectShell() {
    const s = shells.find((x) => x.life <= 0) ?? shells[0];
    s.mesh.visible = true;
    s.mesh.position.set(0.3, -0.2, -0.55);
    s.mesh.rotation.set(0, 0, 0);
    s.vel.set(0.9 + Math.random() * 0.5, 0.9 + Math.random() * 0.4, 0.2);
    s.spin = 8 + Math.random() * 8;
    s.life = 0.45;
  }

  function step(dt, moveSpeed = 0, lookX = 0, lookY = 0) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.switching = Math.max(0, state.switching - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    const model = models[WEAPONS.indexOf(def())];
    // Walk bob: the gun rises and falls with the stride, faster when sprinting.
    walkPhase += dt * (2 + moveSpeed * 1.6);
    const bob = Math.min(1, moveSpeed / 5) * 0.012;
    const bobX = Math.sin(walkPhase * 2) * bob;
    const bobY = Math.abs(Math.cos(walkPhase * 2)) * bob * 0.7;
    // Sway: the gun lags behind the mouse, then settles — no instant snaps.
    swayX += ((-lookX * 0.00045) - swayX) * Math.min(1, dt * 10);
    swayY += ((lookY * 0.00045) - swayY) * Math.min(1, dt * 10);
    model.position.x = 0.27 + bobX + swayX;
    model.position.y = -0.23 + bobY + swayY;
    model.position.z = -0.5 + state.kick;
    model.rotation.x = state.kick * 2.2;
    model.rotation.y = swayX * 1.4;
    if (state.switching > 0) {
      // Lower the old gun, raise the new one: a clean draw, never a pop.
      const t = 1 - state.switching / 0.35;
      model.position.y -= Math.sin(Math.min(1, t) * Math.PI) * 0.14;
      model.rotation.x -= Math.sin(Math.min(1, t) * Math.PI) * 0.5;
    }
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      const done = 1 - state.reloadLeft / def().reload;
      // Dip, tilt, and lift back: the reload reads as one motion.
      model.rotation.x = -0.55 * Math.sin(Math.min(1, done * 1.6) * Math.PI * 0.5);
      model.rotation.z = 0.35 * Math.sin(Math.min(1, done) * Math.PI);
      model.position.y -= Math.sin(Math.min(1, done) * Math.PI) * 0.09;
      if (state.reloadLeft === 0) {
        const a = ammo.get(def().id);
        const take = Math.min(def().mag - a.mag, a.reserve);
        a.mag += take;
        a.reserve -= take;
        model.rotation.z = 0;
      }
    }
    const flashOn = state.flash > 0;
    flashGroup.visible = flashOn;
    flashGroup.rotation.z = Math.random() * Math.PI;
    flashGlow.material.opacity = flashOn ? 0.85 : 0;
    flashGlow.scale.setScalar(0.4 + Math.random() * 0.25);
    flashLight.intensity = flashOn ? 18 : 0;
    smokeLife = Math.max(0, smokeLife - dt);
    smoke.material.opacity = smokeLife > 0 ? Math.min(0.3, smokeLife * 0.4) : 0;
    if (smokeLife > 0) {
      smoke.position.y += dt * 0.08;
      smoke.scale.setScalar(0.12 + (0.8 - smokeLife) * 0.25);
    }
    for (const s of shells) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.vel.y -= 5 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.z += s.spin * dt;
      s.mesh.rotation.x += s.spin * 0.6 * dt;
      if (s.life <= 0) s.mesh.visible = false;
    }
  }

  return {
    owned,
    grenades,
    state,
    def,
    ammoOf(id) {
      return ammo.get(id);
    },
    step,
    ready() {
      const a = ammo.get(def().id);
      return a.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0 && state.switching === 0;
    },
    pullTrigger() {
      state.cooldown = def().gap;
      state.flash = 0.06;
      state.kick = 0.055;
      smokeLife = 0.8;
      smoke.position.set(0.24, -0.16, -0.9);
      smoke.scale.setScalar(0.12);
      ejectShell();
    },
    takeRound() {
      const a = ammo.get(def().id);
      if (a.mag <= 0) return false;
      a.mag -= 1;
      return true;
    },
    reload() {
      const a = ammo.get(def().id);
      if (state.reloadLeft > 0 || a.mag === def().mag || a.reserve === 0) return;
      state.reloadLeft = def().reload;
    },
    spread(speed) {
      const d = def();
      return d.spreadStill + Math.min(1, speed / 5.2) * d.spreadMove;
    },
    switchTo(index) {
      if (index < 0 || index >= owned.length || index === current || state.switching > 0) return false;
      models[WEAPONS.indexOf(def())].visible = false;
      current = index;
      models[WEAPONS.indexOf(def())].visible = true;
      state.reloadLeft = 0;
      state.switching = 0.35;
      return true;
    },
    buy(id) {
      const w = WEAPONS.find((x) => x.id === id);
      if (!w || owned.includes(w)) return false;
      owned.push(w);
      return true;
    },
    buyGrenade(id) {
      if (grenades[id] >= 2) return false;
      grenades[id] += 1;
      return true;
    },
    throwGrenade(id) {
      if (grenades[id] <= 0) return null;
      grenades[id] -= 1;
      return GRENADES.find((g) => g.id === id);
    },
    refillAmmo() {
      for (const w of WEAPONS) {
        const a = ammo.get(w.id);
        a.mag = w.mag;
        a.reserve = w.reserve;
      }
    },
    reset() {
      owned.length = 0;
      owned.push(WEAPONS[0], WEAPONS[5]);
      grenades.frag = 0;
      grenades.smoke = 0;
      current = 0;
      for (const m of models) m.visible = false;
      models[0].visible = true;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
      state.switching = 0;
      smokeLife = 0;
      smoke.material.opacity = 0;
      for (const s of shells) {
        s.life = 0;
        s.mesh.visible = false;
      }
      this.refillAmmo();
    },
  };
}
