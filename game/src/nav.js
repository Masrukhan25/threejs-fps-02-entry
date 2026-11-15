// Bot navigation: A* over the map's waypoint graph (world.js WAYPOINTS). Nodes carry y
// (catwalk stairs), so routes climb. One job: give a bot a list of points to walk.
import { WAYPOINTS } from './world.js';

const nodes = new Map();
for (const w of WAYPOINTS) nodes.set(w.id, w);

function dist(a, b) {
  const dx = a.p[0] - b.p[0];
  const dy = a.p[1] - b.p[1];
  const dz = a.p[2] - b.p[2];
  return Math.hypot(dx, dy, dz);
}

export function nearestWaypoint(x, y, z) {
  let best = null;
  let bestD = Infinity;
  for (const w of WAYPOINTS) {
    const d = (w.p[0] - x) ** 2 + (w.p[2] - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return best.id;
}

export function findPath(fromId, toId) {
  if (fromId === toId) return [nodes.get(toId).p];
  const open = [{ id: fromId, g: 0, f: dist(nodes.get(fromId), nodes.get(toId)), parent: null }];
  const came = new Map();
  const gScore = new Map([[fromId, 0]]);
  const closed = new Set();
  while (open.length > 0) {
    let bi = 0;
    for (let i = 1; i < open.length; i += 1) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.id === toId) {
      const path = [];
      let node = cur;
      while (node) {
        path.unshift(nodes.get(node.id).p);
        node = node.parent;
      }
      return path;
    }
    closed.add(cur.id);
    for (const nid of nodes.get(cur.id).n) {
      if (closed.has(nid)) continue;
      const g = cur.g + dist(nodes.get(cur.id), nodes.get(nid));
      if (gScore.has(nid) && g >= gScore.get(nid)) continue;
      gScore.set(nid, g);
      came.set(nid, cur);
      open.push({ id: nid, g, f: g + dist(nodes.get(nid), nodes.get(toId)), parent: cur });
    }
  }
  return [nodes.get(toId).p];
}

export function waypointPos(id) {
  return nodes.get(id).p;
}
