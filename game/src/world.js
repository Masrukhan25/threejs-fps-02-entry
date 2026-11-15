// IRON VEIL map: an industrial military compound, ~44 x 36 m. Two bomb sites (A warehouse
// north, B storage yard south), a mid corridor, A and B lanes, flanking routes, a raised
// catwalk sniper spot, and cover everywhere. Every box is a collider and a bullet surface.
// Waypoints below are the bot navigation graph (y included for the catwalk stairs).
//
// VISUAL PASS (v2): every surface now carries a procedural texture (canvas-drawn in
// textures.js — no image files, no network), with matching bump maps and honest
// roughness/metalness: concrete reads as concrete, rusted metal as metal, wood as wood.
// The compound is dressed like a real place: pilasters and coping on the walls, roof
// beams and hanging lamps in the warehouse, a gantry crane over Site B, sandbags,
// barrels, pipes, puddles, oil stains, bullet marks, scorch, stencilled site letters,
// a dusk sky dome with a distant skyline, and drifting dust. All of it is visual
// dressing around the v1 collision layout — the colliders, spawn points, bomb sites
// and waypoints are byte-identical to v1, so movement, AI routes and tactics do not
// change.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createTextures } from './textures.js';

export const BOMB_SITES = {
  A: { x: -3, z: -13, r: 3.4, name: 'SITE A — WAREHOUSE' },
  B: { x: 8, z: 12, r: 3.4, name: 'SITE B — STORAGE' },
};
export const SPAWNS = {
  vanguard: [
    { x: -19, z: -3, yaw: -Math.PI / 2 },
    { x: -19, z: 0, yaw: -Math.PI / 2 },
    { x: -19, z: 3, yaw: -Math.PI / 2 },
    { x: -17, z: -5, yaw: -Math.PI / 2 },
  ],
  sentinel: [
    { x: 19, z: -3, yaw: Math.PI / 2 },
    { x: 19, z: 0, yaw: Math.PI / 2 },
    { x: 19, z: 3, yaw: Math.PI / 2 },
    { x: 17, z: -5, yaw: Math.PI / 2 },
    { x: 17, z: 5, yaw: Math.PI / 2 },
  ],
};

// Waypoint graph: id, position, neighbours. Bots pathfind on it (A* in nav.js).
export const WAYPOINTS = [
  { id: 'vSpawn', p: [-19, 0, 0], n: ['vMid', 'vA', 'vB'] },
  { id: 'vMid', p: [-12, 0, 0], n: ['vSpawn', 'midW', 'vA', 'vB'] },
  { id: 'vA', p: [-14, 0, -8], n: ['vSpawn', 'vMid', 'aLane', 'aSite'] },
  { id: 'vB', p: [-14, 0, 8], n: ['vSpawn', 'vMid', 'bLane', 'bSite'] },
  { id: 'aLane', p: [-6, 0, -8], n: ['vA', 'aSite', 'midN'] },
  { id: 'bLane', p: [-8, 0, 11], n: ['vB', 'bSite', 'midS'] },
  { id: 'aSite', p: [-3, 0, -13], n: ['aLane', 'midN', 'sSpawn'] },
  { id: 'bSite', p: [8, 0, 12], n: ['bLane', 'midS', 'sSpawn'] },
  { id: 'midW', p: [-6, 0, 0], n: ['vMid', 'mid', 'aLane', 'bLane'] },
  { id: 'mid', p: [0, 0, 0], n: ['midW', 'midE', 'midN', 'midS', 'catLow'] },
  { id: 'midE', p: [6, 0, 0], n: ['mid', 'sMid', 'midN', 'midS'] },
  { id: 'midN', p: [0, 0, -8], n: ['mid', 'midE', 'aLane', 'aSite', 'catWalk'] },
  { id: 'midS', p: [0, 0, 8], n: ['mid', 'midE', 'bLane', 'bSite'] },
  { id: 'sMid', p: [12, 0, 0], n: ['midE', 'sSpawn', 'sA', 'sB'] },
  { id: 'sA', p: [14, 0, -8], n: ['sMid', 'sSpawn', 'aSite'] },
  { id: 'sB', p: [14, 0, 8], n: ['sMid', 'sSpawn', 'bSite'] },
  { id: 'sSpawn', p: [19, 0, 0], n: ['sMid', 'sA', 'sB'] },
  { id: 'catLow', p: [-2, 0, -5], n: ['mid', 'catStep1'] },
  { id: 'catStep1', p: [-2, 0.6, -5.8], n: ['catLow', 'catStep2'] },
  { id: 'catStep2', p: [-2, 1.2, -6.6], n: ['catStep1', 'catStep3'] },
  { id: 'catStep3', p: [-2, 1.8, -7.4], n: ['catStep2', 'catWalk'] },
  { id: 'catWalk', p: [-2, 2.4, -9], n: ['catStep3', 'midN'] },
];

// Scale a geometry's UVs so a texture tiles about once every `tile` metres.
function uvScale(geo, tile) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) {
    uv.setXY(i, uv.getX(i) * tile, uv.getY(i) * tile);
  }
  return geo;
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1a2233');
  grad.addColorStop(0.42, '#3a4358');
  grad.addColorStop(0.58, '#7a5a44');
  grad.addColorStop(0.68, '#c47a3a');
  grad.addColorStop(0.74, '#2a2e35');
  grad.addColorStop(1, '#14161a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const tex = createTextures();
  const C = (hex) => new THREE.Color(hex);

  // ---- Materials: texture + bump + honest roughness/metalness. ----
  const M = {
    concrete: new THREE.MeshStandardMaterial({ map: tex.concrete.map, bumpMap: tex.concrete.bump, bumpScale: 0.6, roughness: 0.95, metalness: 0.02 }),
    concreteDark: new THREE.MeshStandardMaterial({ map: tex.concreteDark.map, bumpMap: tex.concreteDark.bump, bumpScale: 0.6, roughness: 0.96, metalness: 0.02 }),
    floor: new THREE.MeshStandardMaterial({ map: tex.floor.map, bumpMap: tex.floor.bump, bumpScale: 0.5, roughness: 0.92, metalness: 0.03 }),
    metal: new THREE.MeshStandardMaterial({ map: tex.metal.map, bumpMap: tex.metal.bump, bumpScale: 0.4, roughness: 0.48, metalness: 0.72 }),
    metalClean: new THREE.MeshStandardMaterial({ map: tex.metalClean.map, bumpMap: tex.metalClean.bump, bumpScale: 0.3, roughness: 0.34, metalness: 0.85 }),
    containerA: new THREE.MeshStandardMaterial({ map: tex.containerA.map, bumpMap: tex.containerA.bump, bumpScale: 0.4, roughness: 0.62, metalness: 0.42 }),
    containerB: new THREE.MeshStandardMaterial({ map: tex.containerB.map, bumpMap: tex.containerB.bump, bumpScale: 0.4, roughness: 0.62, metalness: 0.42 }),
    containerC: new THREE.MeshStandardMaterial({ map: tex.containerC.map, bumpMap: tex.containerC.bump, bumpScale: 0.4, roughness: 0.58, metalness: 0.45 }),
    wood: new THREE.MeshStandardMaterial({ map: tex.wood.map, bumpMap: tex.wood.bump, bumpScale: 0.5, roughness: 0.85, metalness: 0.0 }),
    hazard: new THREE.MeshStandardMaterial({ map: tex.hazard.map, roughness: 0.7, metalness: 0.1 }),
    grate: new THREE.MeshStandardMaterial({ map: tex.grate.map, roughness: 0.55, metalness: 0.65 }),
    dark: new THREE.MeshStandardMaterial({ color: C(PALETTE.hairline), roughness: 0.6, metalness: 0.5 }),
    rust: new THREE.MeshStandardMaterial({ color: C(PALETTE.rust), roughness: 0.8, metalness: 0.35 }),
    olive: new THREE.MeshStandardMaterial({ color: C(PALETTE.olive), roughness: 0.9, metalness: 0.05 }),
    steel: new THREE.MeshStandardMaterial({ color: C(PALETTE.steel), roughness: 0.4, metalness: 0.7 }),
    glass: new THREE.MeshPhysicalMaterial({ color: C('#9db8c8'), roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
    lampGlow: new THREE.MeshBasicMaterial({ color: C('#ffd9a0') }),
    beacon: new THREE.MeshBasicMaterial({ color: C('#ff2a1a') }),
    puddle: new THREE.MeshStandardMaterial({ color: C('#0a0e12'), roughness: 0.06, metalness: 0.9 }),
    accent: new THREE.MeshStandardMaterial({ color: C(PALETTE.accent), roughness: 0.55, metalness: 0.1 }),
  };
  const SURFACE = {
    concrete: 'concrete', concreteDark: 'concrete', floor: 'concrete',
    metal: 'metal', metalClean: 'metal', steel: 'metal',
    containerA: 'metal', containerB: 'metal', containerC: 'metal',
    wood: 'wood', olive: 'wood', hazard: 'metal', grate: 'metal',
    dark: 'metal', rust: 'metal', glass: 'glass', accent: 'metal',
  };

  const colliders = [];
  const shootables = [];
  // Visual-only meshes live in `group` but never become colliders or bullet surfaces.
  function box(w, h, d, x, y, z, matKey, opts = {}) {
    const geo = uvScale(new THREE.BoxGeometry(w, h, d), opts.tile ?? Math.max(w, d) / 2.2);
    const mesh = new THREE.Mesh(geo, M[matKey]);
    mesh.position.set(x, y, z);
    if (opts.ry) mesh.rotation.y = opts.ry;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.surface = SURFACE[matKey] || 'concrete';
    group.add(mesh);
    if (!opts.decor) {
      colliders.push(new THREE.Box3().setFromObject(mesh));
      shootables.push(mesh);
    }
    return mesh;
  }
  function cyl(rt, rb, h, x, y, z, matKey, seg = 14, opts = {}) {
    const geo = uvScale(new THREE.CylinderGeometry(rt, rb, h, seg), opts.tile ?? 2);
    const mesh = new THREE.Mesh(geo, M[matKey]);
    mesh.position.set(x, y, z);
    if (opts.rx) mesh.rotation.x = opts.rx;
    if (opts.rz) mesh.rotation.z = opts.rz;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.surface = SURFACE[matKey] || 'metal';
    group.add(mesh);
    if (!opts.decor) {
      colliders.push(new THREE.Box3().setFromObject(mesh));
      shootables.push(mesh);
    }
    return mesh;
  }
  // A flat decal plane (bullet mark, stain, letter) hugging a surface.
  function decalPlane(texMap, w, h, x, y, z, ry = 0, rx = 0, opacity = 1) {
    const mat = new THREE.MeshBasicMaterial({ map: texMap, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, 0);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  // ---- Ground and outer walls (44 x 36, 5 m high). Same boxes as v1. ----
  const ground = box(44.4, 0.4, 36.4, 0, -0.2, 0, 'floor', { tile: 9 });
  ground.receiveShadow = true;
  box(0.4, 5, 36.4, -22.2, 2.5, 0, 'concreteDark');
  box(0.4, 5, 36.4, 22.2, 2.5, 0, 'concreteDark');
  box(44.4, 5, 0.4, 0, 2.5, -18.2, 'concreteDark');
  box(44.4, 5, 0.4, 0, 2.5, 18.2, 'concreteDark');
  // Wall dressing: pilasters, coping trim and skirting, flush against the walls.
  for (const x of [-18, -9, 0, 9, 18]) {
    box(0.7, 5, 0.5, x, 2.5, -17.9, 'concrete', { decor: true, tile: 1.5 });
    box(0.7, 5, 0.5, x, 2.5, 17.9, 'concrete', { decor: true, tile: 1.5 });
  }
  for (const z of [-13.5, -4.5, 4.5, 13.5]) {
    box(0.5, 5, 0.7, -21.9, 2.5, z, 'concrete', { decor: true, tile: 1.5 });
    box(0.5, 5, 0.7, 21.9, 2.5, z, 'concrete', { decor: true, tile: 1.5 });
  }
  box(44.4, 0.25, 0.6, 0, 5.05, -18.2, 'dark', { decor: true, tile: 8 });
  box(44.4, 0.25, 0.6, 0, 5.05, 18.2, 'dark', { decor: true, tile: 8 });
  box(0.6, 0.25, 36.4, -22.2, 5.05, 0, 'dark', { decor: true, tile: 8 });
  box(0.6, 0.25, 36.4, 22.2, 5.05, 0, 'dark', { decor: true, tile: 8 });

  // Ground dressing: oil stains, puddles that catch the sun, hazard strips at doors.
  decalPlane(tex.oil, 3.2, 3.2, 5, 0.02, -4, 0, -Math.PI / 2, 0.85);
  decalPlane(tex.oil, 2.4, 2.4, -12, 0.02, 6, 0, -Math.PI / 2, 0.8);
  decalPlane(tex.oil, 2.8, 2.8, 10, 0.02, -12, 0, -Math.PI / 2, 0.75);
  const puddle1 = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), M.puddle);
  puddle1.rotation.x = -Math.PI / 2;
  puddle1.position.set(-6, 0.015, 5);
  puddle1.receiveShadow = true;
  group.add(puddle1);
  const puddle2 = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24), M.puddle);
  puddle2.rotation.x = -Math.PI / 2;
  puddle2.position.set(13, 0.015, -6);
  puddle2.receiveShadow = true;
  group.add(puddle2);
  decalPlane(tex.scorch, 3.6, 3.6, -3, 0.02, -13, 0, -Math.PI / 2, 0.9);
  decalPlane(tex.scorch, 3.0, 3.0, 8, 0.02, 12, 0, -Math.PI / 2, 0.85);

  // ---- SITE A warehouse (north): same walls as v1, now dressed. ----
  box(10, 4, 0.5, -8, 2, -8.6, 'concrete');
  box(3.4, 4, 0.5, -14.6, 2, -8.6, 'concrete');
  box(3.4, 4, 0.5, -1.4, 2, -8.6, 'concrete');
  box(0.5, 4, 7, -13, 2, -12, 'concrete');
  box(0.5, 4, 7, -3, 2, -12, 'concrete');
  box(1.2, 3.4, 1.2, -8, 1.7, -15.4, 'dark');
  box(2.2, 1.1, 1.2, -11, 0.55, -11, 'wood');
  box(1.4, 1.1, 1.4, -5.4, 0.55, -13.6, 'wood');
  box(1.2, 0.7, 1.2, -8, 0.35, -10.2, 'olive');
  // Warehouse interior: roof beams, hanging lamp fixtures, windows, roller door.
  for (const z of [-10.5, -13, -15.5]) {
    box(10, 0.35, 0.4, -8, 3.9, z, 'dark', { decor: true, tile: 3 });
  }
  // Windows high on the north wall: glass panes in steel frames.
  for (const x of [-11, -8, -5]) {
    const frame = box(1.6, 1.1, 0.12, x, 3.2, -17.95, 'dark', { decor: true, tile: 0.6 });
    frame.castShadow = false;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), M.glass);
    glass.position.set(x, 3.2, -17.88);
    group.add(glass);
    const bar = box(0.06, 0.9, 0.05, x, 3.2, -17.86, 'dark', { decor: true, tile: 0.2 });
    bar.castShadow = false;
  }
  // Roller door on the east wall of the warehouse (visual, on the wall face).
  box(0.12, 3.0, 2.6, -2.72, 1.5, -12, 'metalClean', { decor: true, tile: 1.2 });
  box(0.14, 0.4, 2.6, -2.72, 0.2, -12, 'hazard', { decor: true, tile: 1 });
  // Hanging lamps: cord + emissive housing (the point light below is the real source).
  for (const [lx, lz] of [[-11, -12], [-5, -12]]) {
    cyl(0.02, 0.02, 0.9, lx, 3.5, lz, 'dark', 6, { decor: true });
    const shade = cyl(0.28, 0.42, 0.25, lx, 3.0, lz, 'dark', 12, { decor: true });
    shade.castShadow = false;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), M.lampGlow);
    bulb.position.set(lx, 2.88, lz);
    group.add(bulb);
  }
  // Pipes along the warehouse south wall, with elbow joints.
  cyl(0.09, 0.09, 9.6, -8, 3.1, -8.3, 'metalClean', 10, { rz: Math.PI / 2, decor: true });
  cyl(0.06, 0.06, 9.6, -8, 2.85, -8.3, 'rust', 10, { rz: Math.PI / 2, decor: true });
  // Rusty barrels and a pallet under the crates.
  cyl(0.42, 0.42, 0.95, -11.8, 0.48, -14.6, 'rust', 14, { decor: true });
  cyl(0.42, 0.42, 0.95, -4.2, 0.48, -10.6, 'metal', 14, { decor: true });
  box(2.6, 0.12, 1.6, -11, 0.06, -11, 'wood', { decor: true, tile: 1 });
  box(1.8, 0.12, 1.8, -5.4, 0.06, -13.6, 'wood', { decor: true, tile: 1 });
  // Stencilled site letter and danger sign on the warehouse walls.
  decalPlane(tex.letterA, 2.6, 2.6, -8, 2.1, -8.32, Math.PI, 0, 0.9);
  decalPlane(tex.signDanger, 0.9, 0.9, -13.2, 2.2, -8.32, Math.PI, 0, 0.95);
  // Bullet marks where firefights happen: around the door gaps.
  for (const [bx, by, bz, ry] of [[-6.2, 1.4, -8.32, Math.PI], [-9.8, 1.1, -8.32, Math.PI], [-12.7, 1.6, -11.7, Math.PI / 2], [-3.3, 1.3, -11.7, -Math.PI / 2]]) {
    decalPlane(tex.bullet, 0.5, 0.5, bx, by, bz, ry, 0, 0.9);
  }

  // ---- SITE B storage yard (south): container stacks, gantry, sandbags. ----
  box(3.2, 2.6, 1.4, 6, 1.3, 14.6, 'containerA');
  box(3.2, 2.6, 1.4, 11, 1.3, 14.6, 'containerB');
  box(3.2, 2.6, 1.4, 8.6, 3.9, 14.6, 'containerC');
  box(1.4, 1.1, 1.4, 4.6, 0.55, 10.4, 'wood');
  box(1.4, 1.1, 1.4, 11.6, 0.55, 9.6, 'olive');
  box(2.4, 1.1, 1.2, 8, 0.55, 12.4, 'dark');
  // Gantry crane over the yard: two legs and a beam, a landmark silhouette.
  box(0.5, 5.4, 0.5, 4.2, 2.7, 15.8, 'metalClean', { decor: true, tile: 1.5 });
  box(0.5, 5.4, 0.5, 12.2, 2.7, 15.8, 'metalClean', { decor: true, tile: 1.5 });
  box(8.5, 0.6, 0.6, 8.2, 5.5, 15.8, 'metalClean', { decor: true, tile: 3 });
  box(0.8, 0.5, 0.8, 8.2, 5.0, 15.8, 'dark', { decor: true, tile: 0.4 });
  cyl(0.02, 0.02, 1.6, 8.2, 4.1, 15.8, 'dark', 6, { decor: true });
  box(0.5, 0.4, 0.5, 8.2, 3.2, 15.8, 'rust', { decor: true, tile: 0.2 });
  // Corner castings on the containers + pallets under the crates.
  for (const [cx, cz] of [[6, 14.6], [11, 14.6]]) {
    for (const [ox, oz] of [[-1.5, -0.6], [1.5, -0.6], [-1.5, 0.6], [1.5, 0.6]]) {
      box(0.22, 0.22, 0.22, cx + ox, 2.5, cz + oz, 'dark', { decor: true, tile: 0.1 });
    }
  }
  box(1.8, 0.12, 1.8, 4.6, 0.06, 10.4, 'wood', { decor: true, tile: 1 });
  box(1.8, 0.12, 1.8, 11.6, 0.06, 9.6, 'wood', { decor: true, tile: 1 });
  // Sandbag line guarding the B approach.
  for (let i = 0; i < 6; i += 1) {
    const sx = 3.4 + i * 0.85;
    const bag = box(0.8, 0.32, 0.45, sx, 0.16 + (i % 2) * 0.3, 8.6, 'olive', { decor: true, tile: 0.4, ry: (i % 2 ? 0.12 : -0.1) });
    bag.castShadow = true;
  }
  decalPlane(tex.letterB, 2.6, 2.6, 8.6, 2.2, 13.88, 0, 0, 0.9);
  decalPlane(tex.signDanger, 0.9, 0.9, 5.2, 1.8, 13.88, 0, 0, 0.95);
  for (const [bx, by, bz, ry] of [[5.2, 1.2, 13.88, 0], [11.8, 1.5, 13.88, 0], [4.4, 1.4, 13.88, 0]]) {
    decalPlane(tex.bullet, 0.5, 0.5, bx, by, bz, ry, 0, 0.9);
  }

  // ---- Mid: central pillar, low walls, crates, comms mast. ----
  box(1.4, 3.6, 1.4, 0, 1.8, 0, 'metal');
  box(4, 1.1, 0.8, -3.4, 0.55, -3.4, 'concrete');
  box(4, 1.1, 0.8, 3.4, 0.55, 3.4, 'concrete');
  box(1.6, 0.7, 1.6, -8.6, 0.35, 2.6, 'olive');
  box(1.6, 0.7, 1.6, 8.6, 0.35, -2.6, 'olive');
  box(0.9, 1.7, 0.9, -16.4, 0.85, 4.6, 'dark');
  box(0.9, 1.7, 0.9, 16.4, 0.85, -4.6, 'dark');
  // Pillar dressing: concrete base, metal bands, hazard base, comms mast + beacon.
  box(1.9, 0.3, 1.9, 0, 0.15, 0, 'concreteDark', { decor: true, tile: 0.8 });
  box(1.5, 0.18, 1.5, 0, 1.1, 0, 'hazard', { decor: true, tile: 0.8 });
  box(1.5, 0.18, 1.5, 0, 2.6, 0, 'dark', { decor: true, tile: 0.8 });
  cyl(0.05, 0.05, 2.2, 0, 4.7, 0, 'metalClean', 8, { decor: true });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), M.beacon);
  beacon.position.set(0, 5.85, 0);
  group.add(beacon);
  // Lamp post near mid with an emissive head.
  cyl(0.07, 0.09, 3.4, 3.2, 1.7, -3.2, 'dark', 8, { decor: true });
  box(0.7, 0.08, 0.08, 3.0, 3.4, -3.2, 'dark', { decor: true, tile: 0.3 });
  const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.2), M.lampGlow);
  lampHead.position.set(2.65, 3.38, -3.2);
  group.add(lampHead);
  // Mid debris: instanced rubble chunks, cheap and scattered.
  {
    const rubbleGeo = new THREE.BoxGeometry(0.22, 0.1, 0.18);
    const rubbleMat = new THREE.MeshStandardMaterial({ color: C('#55585e'), roughness: 0.95 });
    const rubble = new THREE.InstancedMesh(rubbleGeo, rubbleMat, 46);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    let placed = 0;
    let guard = 0;
    while (placed < 46 && guard < 400) {
      guard += 1;
      const x = (Math.random() - 0.5) * 40;
      const z = (Math.random() - 0.5) * 32;
      // Keep the main lanes clear-ish: rubble hugs walls and cover.
      const nearLane = Math.abs(z) < 2.5 && Math.abs(x) < 16;
      const nearSite = (Math.hypot(x + 3, z + 13) < 3.5) || (Math.hypot(x - 8, z - 12) < 3.5);
      if (nearLane || nearSite) continue;
      e.set(0, Math.random() * Math.PI, 0);
      q.setFromEuler(e);
      v.set(x, 0.05, z);
      const sc = 0.6 + Math.random() * 1.1;
      s.set(sc, sc * 0.7, sc);
      m4.compose(v, q, s);
      rubble.setMatrixAt(placed, m4);
      placed += 1;
    }
    rubble.count = placed;
    rubble.castShadow = true;
    rubble.receiveShadow = true;
    group.add(rubble);
  }

  // ---- Catwalk (north, 2.4 m) with a 3-step stair. Same boxes as v1. ----
  box(5, 0.3, 2.2, -2, 2.25, -9, 'grate');
  box(5, 1.1, 0.3, -2, 1.7, -10.1, 'metal');
  box(0.5, 0.6, 0.9, -2, 0.3, -5.8, 'concrete');
  box(0.5, 1.2, 0.9, -2, 0.6, -6.6, 'concrete');
  box(0.5, 1.8, 0.9, -2, 0.9, -7.4, 'concrete');
  // Catwalk dressing: support beams under the deck, a side skirt, hazard nosing.
  box(0.3, 2.2, 0.3, -4.2, 1.1, -9, 'dark', { decor: true, tile: 0.8 });
  box(0.3, 2.2, 0.3, 0.2, 1.1, -9, 'dark', { decor: true, tile: 0.8 });
  box(5, 0.25, 0.08, -2, 2.28, -7.92, 'hazard', { decor: true, tile: 2 });

  // ---- Landmarks: water tower (NE), fuel tanks (SW), watchtower (SE). ----
  cyl(1.6, 1.6, 2.2, 16, 6.4, -14, 'rust');
  cyl(0.5, 0.5, 5.4, 16, 2.7, -14, 'metal');
  // Water tower: cone roof, four legs, ladder rail.
  cyl(0.1, 1.7, 1.0, 16, 8.0, -14, 'dark', 14, { decor: true });
  for (const [lx, lz] of [[14.8, -15.2], [17.2, -15.2], [14.8, -12.8], [17.2, -12.8]]) {
    cyl(0.08, 0.08, 5.4, lx, 2.7, lz, 'dark', 6, { decor: true });
  }
  box(0.3, 4.6, 0.06, 16, 2.6, -12.35, 'metalClean', { decor: true, tile: 0.6 });
  cyl(1.1, 1.1, 2.4, -16, 1.2, 14, 'metal');
  cyl(1.1, 1.1, 2.4, -13.4, 1.2, 14, 'metal');
  // Fuel tank dressing: pipes, valve wheels, hazard bands.
  cyl(0.08, 0.08, 3.2, -14.7, 1.6, 14, 'rust', 8, { rz: Math.PI / 2, decor: true });
  for (const tx of [-16, -13.4]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 16), M.dark);
    wheel.position.set(tx, 1.5, 12.85);
    wheel.castShadow = true;
    group.add(wheel);
    cyl(1.14, 1.14, 0.18, tx, 2.25, 14, 'hazard', 16, { decor: true });
  }
  box(0.4, 4.4, 0.4, 17.5, 2.2, 15, 'dark');
  box(0.4, 4.4, 0.4, 19.5, 2.2, 15, 'dark');
  box(2.4, 0.3, 2.4, 18.5, 4.5, 15, 'metal');
  // Watchtower cabin: glass windows, roof, railing.
  box(2.2, 1.6, 2.2, 18.5, 5.5, 15, 'concreteDark', { decor: true, tile: 1 });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), M.glass);
  win.position.set(18.5, 5.6, 13.88);
  group.add(win);
  box(2.6, 0.15, 2.6, 18.5, 6.4, 15, 'dark', { decor: true, tile: 1 });

  // ---- Sky: dusk gradient dome, distant skyline, low sun. ----
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(190, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  const skylineMat = new THREE.MeshBasicMaterial({ color: C('#232833'), fog: true });
  const skyline = new THREE.Group();
  const skySeed = [38, 55, 72, 48, 66, 30, 80, 44, 60, 52, 74, 36];
  for (let i = 0; i < skySeed.length; i += 1) {
    const a = (i / skySeed.length) * Math.PI * 2 + 0.3;
    const r = 62 + (i % 3) * 12;
    const h = 9 + skySeed[i] * 0.35;
    const b = new THREE.Mesh(new THREE.BoxGeometry(10 + (i % 4) * 4, h, 8), skylineMat);
    b.position.set(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r);
    b.rotation.y = a;
    skyline.add(b);
  }
  // Two construction cranes on the skyline.
  for (const a of [0.9, 3.6]) {
    const mast = new THREE.Mesh(new THREE.BoxGeometry(1.2, 34, 1.2), skylineMat);
    mast.position.set(Math.cos(a) * 78, 16, Math.sin(a) * 78);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(22, 1, 1), skylineMat);
    jib.position.set(Math.cos(a) * 78, 32, Math.sin(a) * 78);
    jib.rotation.y = a + 0.5;
    skyline.add(mast, jib);
  }
  scene.add(skyline);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(9, 24),
    new THREE.MeshBasicMaterial({ color: C('#ffb36b'), fog: false }),
  );
  sun.position.set(-120, 26, 82);
  sun.lookAt(0, 0, 0);
  scene.add(sun);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: C('#ff9a3d'), transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
  sunGlow.scale.setScalar(70);
  sunGlow.position.copy(sun.position);
  scene.add(sunGlow);

  // ---- Dusk lighting. ----
  scene.fog = new THREE.Fog(new THREE.Color('#39404e'), 40, 120);
  const hemi = new THREE.HemisphereLight(new THREE.Color('#8fa3b8'), new THREE.Color('#2a2e35'), 1.3);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(new THREE.Color('#7a8494'), 0.32);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(new THREE.Color('#ffb36b'), 3.2);
  key.position.set(-14, 18, 10);
  key.target.position.set(4, 0, -4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -26;
  key.shadow.camera.right = 26;
  key.shadow.camera.top = 26;
  key.shadow.camera.bottom = -26;
  key.shadow.camera.far = 70;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(new THREE.Color('#5a6d84'), 0.9);
  fill.position.set(12, 10, -12);
  scene.add(fill);
  // Amber site lamps, now with visible fixtures.
  for (const s of [BOMB_SITES.A, BOMB_SITES.B]) {
    const lamp = new THREE.PointLight(new THREE.Color(PALETTE.accent), 14, 12);
    lamp.position.set(s.x, 3.4, s.z);
    scene.add(lamp);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.24), M.dark);
    housing.position.set(s.x, 3.55, s.z);
    group.add(housing);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.16), M.lampGlow);
    bulb.position.set(s.x, 3.47, s.z);
    group.add(bulb);
  }
  // Warm interior light inside the warehouse: indoor/outdoor contrast.
  const warehouseLight = new THREE.PointLight(new THREE.Color('#ffc27a'), 9, 11);
  warehouseLight.position.set(-8, 3.0, -12);
  scene.add(warehouseLight);

  // ---- Drifting dust motes: cheap atmosphere that never blocks a sightline. ----
  const DUST_N = 220;
  const dustPos = new Float32Array(DUST_N * 3);
  const dustSeed = new Float32Array(DUST_N * 2);
  for (let i = 0; i < DUST_N; i += 1) {
    dustPos[i * 3] = (Math.random() - 0.5) * 42;
    dustPos[i * 3 + 1] = 0.3 + Math.random() * 5;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 34;
    dustSeed[i * 2] = Math.random() * Math.PI * 2;
    dustSeed[i * 2 + 1] = 0.1 + Math.random() * 0.25;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    map: tex.dust, size: 0.14, transparent: true, opacity: 0.5,
    color: C('#c8b898'), depthWrite: false, sizeAttenuation: true,
  }));
  scene.add(dust);
  const dustBase = dustPos.slice();

  return {
    colliders,
    shootables,
    group,
    keyLight: key,
    dustPoints: dust,
    step(dt, time) {
      // Dust drifts sideways and bobs; the mast beacon blinks.
      const pos = dustGeo.attributes.position;
      for (let i = 0; i < DUST_N; i += 1) {
        const ph = dustSeed[i * 2];
        const sp = dustSeed[i * 2 + 1];
        pos.setX(i, dustBase[i * 3] + Math.sin(time * sp + ph) * 0.8);
        pos.setY(i, dustBase[i * 3 + 1] + Math.sin(time * sp * 0.7 + ph * 2) * 0.35);
      }
      pos.needsUpdate = true;
      beacon.material.color.setHex(Math.sin(time * 2.4) > 0 ? 0xff2a1a : 0x551008);
    },
  };
}
