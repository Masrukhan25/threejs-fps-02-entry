// Graphics settings: LOW / MEDIUM / HIGH / ULTRA. Each level trades shadow resolution,
// pixel ratio, dust and exposure against frame rate; the sim, the map and the AI are
// identical at every level. The choice is saved in localStorage and read before the
// renderer is created, so the first frame already runs at the right level.
import * as THREE from 'three';

export const QUALITY_LEVELS = ['low', 'medium', 'high', 'ultra'];

const PRESETS = {
  low: { pixelRatio: 1, shadows: false, shadowSize: 1024, shadowType: THREE.PCFShadowMap, dust: false, exposure: 1.3 },
  medium: { pixelRatio: 1.25, shadows: true, shadowSize: 1024, shadowType: THREE.PCFShadowMap, dust: true, exposure: 1.35 },
  high: { pixelRatio: 2, shadows: true, shadowSize: 2048, shadowType: THREE.PCFSoftShadowMap, dust: true, exposure: 1.35 },
  ultra: { pixelRatio: 2, shadows: true, shadowSize: 2048, shadowType: THREE.PCFSoftShadowMap, dust: true, exposure: 1.45 },
};

export function loadQuality() {
  try {
    const saved = localStorage.getItem('ironveil-quality');
    if (QUALITY_LEVELS.includes(saved)) return saved;
  } catch (e) { /* storage unavailable — fall through to the default */ }
  return 'high';
}

export function saveQuality(level) {
  try {
    localStorage.setItem('ironveil-quality', level);
  } catch (e) { /* storage unavailable — the level still applies this session */ }
}

export function applyQuality(renderer, world, level) {
  const p = PRESETS[level] || PRESETS.high;
  renderer.setPixelRatio(Math.min(devicePixelRatio, p.pixelRatio));
  renderer.shadowMap.enabled = p.shadows;
  renderer.shadowMap.type = p.shadowType;
  renderer.toneMappingExposure = p.exposure;
  if (world.keyLight) {
    world.keyLight.shadow.mapSize.set(p.shadowSize, p.shadowSize);
    // Force the shadow map to be re-created at the new resolution.
    if (world.keyLight.shadow.map) {
      world.keyLight.shadow.map.dispose();
      world.keyLight.shadow.map = null;
    }
  }
  if (world.dustPoints) world.dustPoints.visible = p.dust;
  renderer.setSize(innerWidth, innerHeight);
  return p;
}
