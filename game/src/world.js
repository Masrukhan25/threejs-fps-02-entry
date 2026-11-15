// IRON VEIL map: an industrial military compound, ~44 x 36 m. Two bomb sites (A warehouse
// north, B storage yard south), a mid corridor, A and B lanes, flanking routes, a raised
// catwalk sniper spot, and cover everywhere. Every box is a collider and a bullet surface.
// Waypoints below are the bot navigation graph (y included for the catwalk stairs).
import * as THREE from 'three';
import { PALETTE } from './palette.js';

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

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' || name === 'ink' ? 0.55 : 0.92,
      metalness: name === 'steel' ? 0.35 : 0.03,
    });
  }
  const colliders = [];
  const shootables = [];
  function box(w, h, d, x, y, z, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials[mat]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }
  function cyl(rt, rb, h, x, y, z, mat, seg = 14) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), materials[mat]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }

  // Ground and outer walls (44 x 36, 5 m high).
  box(44.4, 0.4, 36.4, 0, -0.2, 0, 'canvas');
  box(0.4, 5, 36.4, -22.2, 2.5, 0, 'surface');
  box(0.4, 5, 36.4, 22.2, 2.5, 0, 'surface');
  box(44.4, 5, 0.4, 0, 2.5, -18.2, 'surface');
  box(44.4, 5, 0.4, 0, 2.5, 18.2, 'surface');

  // SITE A warehouse (north): walls with two door gaps, interior pillars, crates.
  box(10, 4, 0.5, -8, 2, -8.6, 'concrete');
  box(3.4, 4, 0.5, -14.6, 2, -8.6, 'concrete');
  box(3.4, 4, 0.5, -1.4, 2, -8.6, 'concrete');
  box(0.5, 4, 7, -13, 2, -12, 'concrete');
  box(0.5, 4, 7, -3, 2, -12, 'concrete');
  box(1.2, 3.4, 1.2, -8, 1.7, -15.4, 'hairline');
  box(2.2, 1.1, 1.2, -11, 0.55, -11, 'container');
  box(1.4, 1.1, 1.4, -5.4, 0.55, -13.6, 'container');
  box(1.2, 0.7, 1.2, -8, 0.35, -10.2, 'olive');

  // SITE B storage yard (south): container stacks forming lanes and cover.
  box(3.2, 2.6, 1.4, 6, 1.3, 14.6, 'container');
  box(3.2, 2.6, 1.4, 11, 1.3, 14.6, 'rust');
  box(3.2, 2.6, 1.4, 8.6, 3.9, 14.6, 'steel');
  box(1.4, 1.1, 1.4, 4.6, 0.55, 10.4, 'container');
  box(1.4, 1.1, 1.4, 11.6, 0.55, 9.6, 'olive');
  box(2.4, 1.1, 1.2, 8, 0.55, 12.4, 'hairline');

  // Mid: central pillar, low walls splitting lanes, crates.
  box(1.4, 3.6, 1.4, 0, 1.8, 0, 'steel');
  box(4, 1.1, 0.8, -3.4, 0.55, -3.4, 'hairline');
  box(4, 1.1, 0.8, 3.4, 0.55, 3.4, 'hairline');
  box(1.6, 0.7, 1.6, -8.6, 0.35, 2.6, 'olive');
  box(1.6, 0.7, 1.6, 8.6, 0.35, -2.6, 'olive');
  box(0.9, 1.7, 0.9, -16.4, 0.85, 4.6, 'hairline');
  box(0.9, 1.7, 0.9, 16.4, 0.85, -4.6, 'hairline');

  // Catwalk (north, 2.4 m) with a 3-step stair; sniper sightline down mid.
  box(5, 0.3, 2.2, -2, 2.25, -9, 'steel');
  box(5, 1.1, 0.3, -2, 1.7, -10.1, 'steel');
  box(0.5, 0.6, 0.9, -2, 0.3, -5.8, 'hairline');
  box(0.5, 1.2, 0.9, -2, 0.6, -6.6, 'hairline');
  box(0.5, 1.8, 0.9, -2, 0.9, -7.4, 'hairline');

  // Landmarks: water tower (NE), fuel tanks (SW), watchtower legs (SE).
  cyl(1.6, 1.6, 2.2, 16, 6.4, -14, 'rust');
  cyl(0.5, 0.5, 5.4, 16, 2.7, -14, 'steel');
  cyl(1.1, 1.1, 2.4, -16, 1.2, 14, 'steel');
  cyl(1.1, 1.1, 2.4, -13.4, 1.2, 14, 'steel');
  box(0.4, 4.4, 0.4, 17.5, 2.2, 15, 'hairline');
  box(0.4, 4.4, 0.4, 19.5, 2.2, 15, 'hairline');
  box(2.4, 0.3, 2.4, 18.5, 4.5, 15, 'steel');

  // Dusk lighting: warm low key sun, cool sky fill, hemisphere gradient, fog.
  // Fog is a light dusk blue-grey (not near-black) so distant structures stay readable.
  scene.fog = new THREE.Fog(new THREE.Color('#39404e'), 40, 120);
  const sky = new THREE.HemisphereLight(new THREE.Color('#8fa3b8'), new THREE.Color('#2a2e35'), 1.3);
  scene.add(sky);
  const ambient = new THREE.AmbientLight(new THREE.Color('#7a8494'), 0.35);
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
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(new THREE.Color('#5a6d84'), 0.9);
  fill.position.set(12, 10, -12);
  scene.add(fill);
  // Amber site lamps.
  for (const s of [BOMB_SITES.A, BOMB_SITES.B]) {
    const lamp = new THREE.PointLight(new THREE.Color(PALETTE.accent), 14, 12);
    lamp.position.set(s.x, 3.4, s.z);
    scene.add(lamp);
  }
  return { colliders, shootables, group };
}
