// IRON VEIL procedural textures — every surface texture in the game is drawn on a
// canvas at load time, so the game ships zero image files and makes zero network
// requests. A seeded generator keeps the look identical on every load (and every
// screenshot). Each surface returns a colour map plus a matching bump map; decals and
// particle sprites are transparent canvases drawn the same way.
import * as THREE from 'three';

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return [c, c.getContext('2d')];
}

function finish(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Speckle noise: thousands of tiny alpha dots, the cheapest way to kill a flat look.
function speckle(g, size, rng, n, alpha, light, dark) {
  for (let i = 0; i < n; i += 1) {
    const v = rng();
    g.fillStyle = v < 0.5 ? light : dark;
    g.globalAlpha = alpha * (0.4 + rng() * 0.6);
    const s = 1 + rng() * 2.2;
    g.fillRect(rng() * size, rng() * size, s, s);
  }
  g.globalAlpha = 1;
}

// A hairline crack: a short random walk that branches once.
function crack(g, size, rng, x, y, len, dark) {
  g.strokeStyle = dark;
  g.lineWidth = 1;
  g.globalAlpha = 0.5;
  let px = x;
  let py = y;
  let ang = rng() * Math.PI * 2;
  g.beginPath();
  g.moveTo(px, py);
  for (let i = 0; i < len; i += 1) {
    ang += (rng() - 0.5) * 0.9;
    px += Math.cos(ang) * 4;
    py += Math.sin(ang) * 4;
    g.lineTo(px, py);
  }
  g.stroke();
  g.globalAlpha = 1;
}

// Soft dark blotches: grime that pools in corners and low spots.
function blotch(g, size, rng, n, rMin, rMax, color, alpha) {
  for (let i = 0; i < n; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const r = rMin + rng() * (rMax - rMin);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = alpha * (0.4 + rng() * 0.6);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

function concretePair(seed, base, size = 512) {
  const rng = mulberry32(seed);
  const [cc, g] = canvas(size);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  // Large tonal patches: poured concrete is never one shade.
  for (let i = 0; i < 26; i += 1) {
    g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    const w = 40 + rng() * 120;
    const h = 30 + rng() * 90;
    g.fillRect(rng() * size, rng() * size, w, h);
  }
  speckle(g, size, rng, 5200, 0.16, 'rgba(255,255,255,0.5)', 'rgba(0,0,0,0.5)');
  blotch(g, size, rng, 9, 40, 130, 'rgba(20,18,14,0.55)', 0.5);
  for (let i = 0; i < 7; i += 1) crack(g, size, rng, rng() * size, rng() * size, 14 + rng() * 22, 'rgba(30,28,24,0.8)');
  // Formwork lines: faint horizontal seams from the pour.
  g.strokeStyle = 'rgba(0,0,0,0.12)';
  g.lineWidth = 2;
  for (let y = 64; y < size; y += 128) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(size, y);
    g.stroke();
  }
  const [bc, b] = canvas(size);
  b.fillStyle = '#808080';
  b.fillRect(0, 0, size, size);
  speckle(b, size, rng, 4200, 0.3, 'rgba(255,255,255,0.6)', 'rgba(0,0,0,0.6)');
  for (let i = 0; i < 7; i += 1) crack(b, size, rng, rng() * size, rng() * size, 14 + rng() * 22, 'rgba(0,0,0,0.9)');
  return { map: finish(cc), bump: finish(bc, false) };
}

function floorPair(seed) {
  const size = 512;
  const rng = mulberry32(seed);
  const [cc, g] = canvas(size);
  g.fillStyle = '#5d6066';
  g.fillRect(0, 0, size, size);
  // Four concrete slabs, each a slightly different shade, with dark expansion seams.
  const slab = size / 2;
  for (let sx = 0; sx < 2; sx += 1) {
    for (let sy = 0; sy < 2; sy += 1) {
      const shade = 88 + Math.floor(rng() * 22);
      g.fillStyle = `rgb(${shade},${shade + 2},${shade + 6})`;
      g.fillRect(sx * slab + 3, sy * slab + 3, slab - 6, slab - 6);
    }
  }
  g.strokeStyle = 'rgba(15,15,18,0.85)';
  g.lineWidth = 6;
  g.strokeRect(0, 0, size, size);
  g.beginPath();
  g.moveTo(size / 2, 0);
  g.lineTo(size / 2, size);
  g.moveTo(0, size / 2);
  g.lineTo(size, size / 2);
  g.stroke();
  speckle(g, size, rng, 6500, 0.18, 'rgba(255,255,255,0.45)', 'rgba(0,0,0,0.5)');
  blotch(g, size, rng, 12, 30, 110, 'rgba(18,16,12,0.6)', 0.55);
  // Tyre scuff arcs: the yard has seen trucks.
  g.strokeStyle = 'rgba(20,20,22,0.35)';
  g.lineWidth = 9;
  for (let i = 0; i < 5; i += 1) {
    g.beginPath();
    g.arc(rng() * size, rng() * size, 60 + rng() * 130, rng() * Math.PI, rng() * Math.PI + 1.2);
    g.stroke();
  }
  for (let i = 0; i < 5; i += 1) crack(g, size, rng, rng() * size, rng() * size, 10 + rng() * 16, 'rgba(25,24,22,0.7)');
  const [bc, b] = canvas(size);
  b.fillStyle = '#7a7a7a';
  b.fillRect(0, 0, size, size);
  speckle(b, size, rng, 5000, 0.35, 'rgba(255,255,255,0.6)', 'rgba(0,0,0,0.6)');
  b.strokeStyle = 'rgba(0,0,0,0.9)';
  b.lineWidth = 6;
  b.strokeRect(0, 0, size, size);
  b.beginPath();
  b.moveTo(size / 2, 0);
  b.lineTo(size / 2, size);
  b.moveTo(0, size / 2);
  b.lineTo(0, size / 2);
  b.stroke();
  return { map: finish(cc), bump: finish(bc, false) };
}

function metalPair(seed, base, rusty) {
  const size = 256;
  const rng = mulberry32(seed);
  const [cc, g] = canvas(size);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  // Corrugation: vertical ribs catch the dusk light.
  for (let x = 0; x < size; x += 16) {
    const grad = g.createLinearGradient(x, 0, x + 16, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0.14)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.16)');
    grad.addColorStop(1, 'rgba(255,255,255,0.05)');
    g.fillStyle = grad;
    g.fillRect(x, 0, 16, size);
  }
  speckle(g, size, rng, 2600, 0.2, 'rgba(255,255,255,0.5)', 'rgba(0,0,0,0.55)');
  if (rusty) {
    // Rust weeps down from the top edge and from every scratch.
    for (let i = 0; i < 22; i += 1) {
      const x = rng() * size;
      const len = 20 + rng() * 90;
      const grad = g.createLinearGradient(0, 0, 0, len);
      grad.addColorStop(0, 'rgba(122,62,28,0.75)');
      grad.addColorStop(1, 'rgba(122,62,28,0)');
      g.fillStyle = grad;
      g.fillRect(x, 0, 3 + rng() * 5, len);
    }
    blotch(g, size, rng, 8, 12, 46, 'rgba(110,58,26,0.6)', 0.6);
  }
  // Scratches: bright metal showing through paint.
  g.strokeStyle = 'rgba(210,210,205,0.5)';
  g.lineWidth = 1;
  for (let i = 0; i < 14; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rng() - 0.5) * 40, y + (rng() - 0.5) * 12);
    g.stroke();
  }
  const [bc, b] = canvas(size);
  b.fillStyle = '#808080';
  b.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 16) {
    b.fillStyle = x % 32 === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
    b.fillRect(x, 0, 8, size);
  }
  return { map: finish(cc), bump: finish(bc, false) };
}

function containerPair(seed, base, label) {
  const size = 512;
  const rng = mulberry32(seed);
  const [cc, g] = canvas(size);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  // Vertical container ribs.
  for (let x = 0; x < size; x += 32) {
    const grad = g.createLinearGradient(x, 0, x + 32, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.22)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.10)');
    grad.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = grad;
    g.fillRect(x, 0, 32, size);
  }
  speckle(g, size, rng, 4200, 0.16, 'rgba(255,255,255,0.45)', 'rgba(0,0,0,0.5)');
  // Rust blooms along the bottom edge and corners.
  for (let i = 0; i < 14; i += 1) {
    const x = rng() * size;
    const y = size - rng() * 60;
    blotch(g, size, rng, 1, 8, 30, 'rgba(96,48,20,0.7)', 0.7);
    g.fillStyle = 'rgba(96,48,20,0.5)';
    g.fillRect(x, y, 4 + rng() * 8, 3 + rng() * 6);
  }
  // Faded stencil label, like a shipping mark.
  g.fillStyle = 'rgba(235,230,220,0.75)';
  g.font = 'bold 44px monospace';
  g.textAlign = 'center';
  g.fillText(label, size / 2, size / 2 - 8);
  g.font = 'bold 20px monospace';
  g.fillText('IRON VEIL DEPOT', size / 2, size / 2 + 26);
  g.strokeStyle = 'rgba(235,230,220,0.5)';
  g.lineWidth = 2;
  g.strokeRect(size / 2 - 120, size / 2 - 60, 240, 120);
  const [bc, b] = canvas(size);
  b.fillStyle = '#808080';
  b.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 32) {
    b.fillStyle = 'rgba(0,0,0,0.4)';
    b.fillRect(x, 0, 4, size);
    b.fillStyle = 'rgba(255,255,255,0.35)';
    b.fillRect(x + 16, 0, 4, size);
  }
  return { map: finish(cc), bump: finish(bc, false) };
}

function woodPair(seed) {
  const size = 512;
  const rng = mulberry32(seed);
  const [cc, g] = canvas(size);
  const plankH = size / 5;
  for (let p = 0; p < 5; p += 1) {
    const tone = 118 + Math.floor(rng() * 26);
    g.fillStyle = `rgb(${tone},${Math.floor(tone * 0.72)},${Math.floor(tone * 0.45)})`;
    g.fillRect(0, p * plankH, size, plankH);
    // Grain: long wavy darker lines running the length of the plank.
    g.strokeStyle = 'rgba(60,38,18,0.4)';
    g.lineWidth = 1.2;
    for (let i = 0; i < 9; i += 1) {
      const y0 = p * plankH + rng() * plankH;
      g.beginPath();
      g.moveTo(0, y0);
      for (let x = 0; x <= size; x += 32) {
        g.lineTo(x, y0 + Math.sin(x * 0.02 + p * 3 + i) * 3 + (rng() - 0.5) * 2);
      }
      g.stroke();
    }
    // Knots.
    for (let i = 0; i < 2; i += 1) {
      const kx = rng() * size;
      const ky = p * plankH + plankH / 2;
      g.strokeStyle = 'rgba(52,32,14,0.7)';
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(kx, ky, 7, 4.5, 0, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.ellipse(kx, ky, 3, 2, 0, 0, Math.PI * 2);
      g.stroke();
    }
    // Plank seam + nail heads.
    g.fillStyle = 'rgba(20,12,6,0.8)';
    g.fillRect(0, p * plankH, size, 2);
    g.fillStyle = 'rgba(30,30,32,0.9)';
    g.beginPath();
    g.arc(14, p * plankH + plankH / 2, 3, 0, Math.PI * 2);
    g.arc(size - 14, p * plankH + plankH / 2, 3, 0, Math.PI * 2);
    g.fill();
  }
  speckle(g, size, rng, 1800, 0.12, 'rgba(255,255,255,0.4)', 'rgba(0,0,0,0.4)');
  const [bc, b] = canvas(size);
  b.fillStyle = '#808080';
  b.fillRect(0, 0, size, size);
  for (let p = 0; p < 5; p += 1) {
    b.fillStyle = 'rgba(0,0,0,0.7)';
    b.fillRect(0, p * plankH, size, 2);
  }
  return { map: finish(cc), bump: finish(bc, false) };
}

function hazardPair() {
  const size = 256;
  const [cc, g] = canvas(size);
  g.fillStyle = '#d8a31a';
  g.fillRect(0, 0, size, size);
  g.fillStyle = '#151517';
  for (let i = -size; i < size * 2; i += 64) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 32, 0);
    g.lineTo(i + 32 + size, size);
    g.lineTo(i + size, size);
    g.closePath();
    g.fill();
  }
  speckle(g, size, mulberry32(77), 900, 0.2, 'rgba(255,255,255,0.4)', 'rgba(0,0,0,0.5)');
  return { map: finish(cc), bump: null };
}

function gratePair() {
  const size = 256;
  const [cc, g] = canvas(size);
  g.fillStyle = '#23262b';
  g.fillRect(0, 0, size, size);
  g.fillStyle = '#3d434b';
  for (let y = 0; y < size; y += 16) g.fillRect(0, y, size, 5);
  for (let x = 0; x < size; x += 16) g.fillRect(x, 0, 5, size);
  speckle(g, size, mulberry32(91), 1500, 0.25, 'rgba(255,255,255,0.4)', 'rgba(0,0,0,0.6)');
  return { map: finish(cc), bump: null };
}

// A transparent decal canvas: draw with a callback, keep alpha.
function decal(size, draw) {
  const [c, g] = canvas(size);
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createTextures() {
  if (createTextures.cache) return createTextures.cache;
  const out = buildTextures();
  createTextures.cache = out;
  return out;
}

function buildTextures() {
  const concrete = concretePair(11, '#7d8187');
  const concreteDark = concretePair(23, '#565a60');
  const floor = floorPair(31);
  const metal = metalPair(41, '#4c565e', true);
  const metalClean = metalPair(43, '#5a666e', false);
  const containerA = containerPair(51, '#6e5a2e', 'IV-07');
  const containerB = containerPair(53, '#7a3d24', 'IV-12');
  const containerC = containerPair(59, '#46586a', 'IV-21');
  const wood = woodPair(61);
  const hazard = hazardPair();
  const grate = gratePair();

  const bullet = decal(128, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(8,8,8,0.95)');
    grad.addColorStop(0.35, 'rgba(20,18,16,0.75)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(10,10,10,0.8)';
    g.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      g.beginPath();
      g.moveTo(s / 2, s / 2);
      g.lineTo(s / 2 + Math.cos(a) * s * 0.42, s / 2 + Math.sin(a) * s * 0.42);
      g.stroke();
    }
  });
  const scorch = decal(256, (g, s) => {
    const rng = mulberry32(71);
    for (let i = 0; i < 5; i += 1) {
      const x = s / 2 + (rng() - 0.5) * 60;
      const y = s / 2 + (rng() - 0.5) * 60;
      const r = 50 + rng() * 60;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(5,5,5,0.9)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  });
  const oil = decal(256, (g, s) => {
    const rng = mulberry32(83);
    for (let i = 0; i < 7; i += 1) {
      const x = s / 2 + (rng() - 0.5) * 90;
      const y = s / 2 + (rng() - 0.5) * 90;
      const r = 24 + rng() * 48;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(8,8,10,0.75)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  });
  function siteLetter(letter) {
    return decal(256, (g, s) => {
      g.fillStyle = 'rgba(232,225,210,0.92)';
      g.font = 'bold 190px monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(letter, s / 2, s / 2 + 8);
      // Weather the paint: knock holes in it with destination-out speckle.
      g.globalCompositeOperation = 'destination-out';
      const rng = mulberry32(letter === 'A' ? 97 : 101);
      for (let i = 0; i < 260; i += 1) {
        g.globalAlpha = 0.5 + rng() * 0.5;
        g.fillRect(rng() * s, rng() * s, 2 + rng() * 5, 2 + rng() * 5);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    });
  }
  const signDanger = decal(256, (g, s) => {
    g.fillStyle = '#d8a31a';
    g.beginPath();
    g.moveTo(s / 2, 18);
    g.lineTo(s - 18, s - 24);
    g.lineTo(18, s - 24);
    g.closePath();
    g.fill();
    g.strokeStyle = '#151517';
    g.lineWidth = 8;
    g.stroke();
    g.fillStyle = '#151517';
    g.font = 'bold 84px monospace';
    g.textAlign = 'center';
    g.fillText('!', s / 2, s - 84);
    g.font = 'bold 26px monospace';
    g.fillText('DANGER', s / 2, s - 44);
  });

  // Soft particle sprites.
  function radialSprite(seed, stops) {
    return decal(128, (g, s) => {
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      for (const [at, col] of stops) grad.addColorStop(at, col);
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      // Clump the smoke: a few darker blobs so it reads as volume, not a disc.
      if (seed) {
        const rng = mulberry32(seed);
        g.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 9; i += 1) {
          g.globalAlpha = 0.12 + rng() * 0.2;
          g.beginPath();
          g.arc(rng() * s, rng() * s, 8 + rng() * 18, 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }
    });
  }
  const smoke = radialSprite(113, [[0, 'rgba(255,255,255,0.85)'], [0.5, 'rgba(230,230,230,0.45)'], [1, 'rgba(220,220,220,0)']]);
  const glow = radialSprite(0, [[0, 'rgba(255,240,200,1)'], [0.25, 'rgba(255,180,80,0.7)'], [1, 'rgba(255,120,20,0)']]);
  const dust = radialSprite(127, [[0, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]);

  return {
    concrete, concreteDark, floor, metal, metalClean,
    containerA, containerB, containerC, wood, hazard, grate,
    bullet, scorch, oil, signDanger,
    letterA: siteLetter('A'),
    letterB: siteLetter('B'),
    smoke, glow, dust,
  };
}
