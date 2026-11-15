// IRON VEIL look plan, in one place. A dusk industrial palette: cold slate and concrete,
// warm amber accents, olive drab, and two team colours (Vanguard blue, Sentinel amber).
// The same names are the CSS custom properties in index.html.
export const PALETTE = {
  canvas: '#10141a',
  surface: '#1a2027',
  hairline: '#2a323c',
  ink: '#e8e4da',
  muted: '#8b98a5',
  accent: '#f0a830',
  olive: '#5c6650',
  rust: '#8a4a2e',
  steel: '#3a4550',
  concrete: '#6b7280',
  container: '#7a5c33',
  vanguard: '#4a7fb5',
  sentinel: '#e8a33d',
  danger: '#d84a35',
  grass: '#3d4a33',
};

export function shade(name) {
  return PALETTE[name];
}
