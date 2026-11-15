// The arsenal: six weapons with distinct stats, view models, muzzle flash and reload,
// plus frag and smoke grenades. It owns ammo and fire timing; combat.js owns the ray and
// the damage. Every weapon is bought in the buy menu (rounds.js) except the sidearm.
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

const BODY = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });
const GRIP = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
const WOOD = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.container), roughness: 0.8, metalness: 0.05 });
const SCOPE = new THREE.MeshStandardMaterial({ color: new THREE.Color('#0c0e12'), roughness: 0.3, metalness: 0.6 });

function box(w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function buildModel(def) {
  const g = new THREE.Group();
  if (def.kind === 'rifle') {
    g.add(box(0.09, 0.1, 0.42, 0, 0, 0, BODY), box(0.045, 0.045, 0.4, 0, 0.025, -0.38, GRIP), box(0.075, 0.08, 0.22, 0, -0.02, 0.3, GRIP), box(0.03, 0.05, 0.12, 0, 0.07, -0.05, SCOPE));
  } else if (def.kind === 'dmr') {
    g.add(box(0.08, 0.09, 0.5, 0, 0, 0, BODY), box(0.04, 0.04, 0.45, 0, 0.02, -0.44, GRIP), box(0.07, 0.07, 0.2, 0, -0.02, 0.32, WOOD), box(0.05, 0.06, 0.16, 0, 0.08, -0.08, SCOPE));
  } else if (def.kind === 'sniper') {
    g.add(box(0.07, 0.09, 0.62, 0, 0, 0, BODY), box(0.035, 0.035, 0.5, 0, 0.02, -0.52, GRIP), box(0.07, 0.08, 0.26, 0, -0.02, 0.36, WOOD), box(0.06, 0.07, 0.22, 0, 0.09, -0.1, SCOPE), box(0.02, 0.1, 0.02, 0, -0.08, 0.1, GRIP));
  } else if (def.kind === 'smg') {
    g.add(box(0.08, 0.09, 0.3, 0, 0, 0, BODY), box(0.04, 0.04, 0.24, 0, 0.02, -0.26, GRIP), box(0.06, 0.12, 0.05, 0, -0.1, 0.05, GRIP), box(0.05, 0.05, 0.1, 0, -0.02, 0.2, WOOD));
  } else if (def.kind === 'shotgun') {
    g.add(box(0.08, 0.09, 0.46, 0, 0, 0, WOOD), box(0.045, 0.045, 0.42, 0, 0.03, -0.4, BODY), box(0.07, 0.08, 0.24, 0, -0.02, 0.32, WOOD), box(0.05, 0.05, 0.18, 0, -0.01, -0.12, GRIP));
  } else {
    g.add(box(0.06, 0.08, 0.22, 0, 0, 0, BODY), box(0.05, 0.1, 0.05, 0, -0.08, 0.06, GRIP), box(0.03, 0.03, 0.1, 0, 0.02, -0.14, GRIP));
  }
  g.scale.setScalar(0.62);
  g.position.set(0.27, -0.23, -0.5);
  return g;
}

export function createArsenal(camera) {
  const models = WEAPONS.map((w) => buildModel(w));
  for (const m of models) {
    m.visible = false;
    camera.add(m);
  }
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, -0.95);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  const owned = [WEAPONS[0], WEAPONS[5]];
  const ammo = new Map();
  for (const w of WEAPONS) ammo.set(w.id, { mag: w.mag, reserve: w.reserve });
  const grenades = { frag: 0, smoke: 0 };
  let current = 0;
  models[0].visible = true;
  const state = { cooldown: 0, reloadLeft: 0, flash: 0, kick: 0, switching: 0 };
  const def = () => owned[current];

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.switching = Math.max(0, state.switching - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    const model = models[WEAPONS.indexOf(def())];
    model.position.z = -0.5 + state.kick;
    model.rotation.x = state.kick * 2.2;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (def().reload - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const a = ammo.get(def().id);
        const take = Math.min(def().mag - a.mag, a.reserve);
        a.mag += take;
        a.reserve -= take;
      }
    }
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
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
      this.refillAmmo();
    },
  };
}
